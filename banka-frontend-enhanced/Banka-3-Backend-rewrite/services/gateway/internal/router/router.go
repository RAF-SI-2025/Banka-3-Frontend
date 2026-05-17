package router

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	bankpb "github.com/RAF-SI-2025/Banka-3-Backend/gen/proto/bank/v1"
	userpb "github.com/RAF-SI-2025/Banka-3-Backend/gen/proto/user/v1"
	pkgauth "github.com/RAF-SI-2025/Banka-3-Backend/pkg/auth"
	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/verification"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/gateway/internal/auth"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc/status"
)

// Router holds dependencies shared across HTTP handlers.
type Router struct {
	Bank           bankpb.BankServiceClient
	Users          userpb.UserServiceClient
	AuthMW         func(http.Handler) http.Handler
	IdempotencyMW  func(http.Handler) http.Handler
	VerificationMW func(http.Handler) http.Handler
	Verifier       verification.Verifier
	SecureCookies  bool
	// InterbankBankURL is the base URL of the bank service's inter-bank
	// HTTP server (e.g. "http://bank:8090"). When set, the gateway
	// reverse-proxies /bank/api/v1/payment/* and /bank/api/v1/otc/public
	// to that server. Empty → those paths return 503.
	InterbankBankURL     string
	TradingInterbankURL  string
	InterbankRoutes      map[string]string
	InterbankAPIKey      string
	BankCode             string
}

// Mount returns the gateway's top-level handler. Public auth endpoints
// are registered explicitly; everything else is delegated to the
// grpc-gateway runtime (which is wrapped in the auth middleware).
//
// Middleware order on the /api/ path is auth → verification →
// idempotency → gwMux. Auth attaches the principal; verification
// consumes the X-Verification-* headers on routes flagged in the
// rule table (payments, transfers, limit changes, card issuance);
// idempotency replays cached 2xx responses; the grpc-gateway runtime
// dispatches to the upstream service. Login / refresh / logout bypass
// the chain — they must always re-execute (a cached login response
// would replay a stale access token).
func (r *Router) Mount(ctx context.Context, gwMux *runtime.ServeMux, registerGW func(context.Context, *runtime.ServeMux) error) (http.Handler, error) {
	if err := registerGW(ctx, gwMux); err != nil {
		return nil, err
	}

	mux := http.NewServeMux()

	// Public auth endpoints with cookie handling.
	mux.HandleFunc("POST /api/v1/auth/login", r.LoginHandler())
	mux.HandleFunc("POST /api/v1/auth/refresh", r.RefreshHandler())
	mux.HandleFunc("POST /api/v1/auth/logout", r.LogoutHandler())

	verifiedAuth := func(h http.Handler) http.Handler {
		if r.VerificationMW != nil {
			h = r.VerificationMW(h)
		}
		return r.AuthMW(h)
	}

	// Verification: code-issue endpoint is gated by auth (so we know
	// who's asking) but does not itself need a verification code.
	if r.Verifier != nil {
		mux.Handle("POST /api/v1/verification/request", r.AuthMW(http.HandlerFunc(r.VerificationHandler())))
		// Additive: mobile polls this for the active codes to display
		// (spec p.84). Auth-gated so we know whose codes to list.
		mux.Handle("GET /api/v1/verification/pending", r.AuthMW(http.HandlerFunc(r.VerificationPendingHandler())))
	}

	mux.Handle("GET /api/v1/otc/external-discovery", verifiedAuth(http.HandlerFunc(r.ExternalOTCDiscoveryHandler())))
	mux.Handle("GET /api/v1/otc/external-offers", verifiedAuth(http.HandlerFunc(r.ListLocalExternalOTCThreadsHandler())))
	mux.Handle("POST /api/v1/otc/external-offers", verifiedAuth(http.HandlerFunc(r.CreateExternalOTCOfferHandler())))
	mux.Handle("POST /api/v1/otc/external-offers/{bank_code}/{thread_id}/counter", verifiedAuth(http.HandlerFunc(r.ForwardExternalOTCActionHandler("counter"))))
	mux.Handle("POST /api/v1/otc/external-offers/{bank_code}/{thread_id}/accept", verifiedAuth(http.HandlerFunc(r.ForwardExternalOTCActionHandler("accept"))))
	mux.Handle("POST /api/v1/otc/external-offers/{bank_code}/{thread_id}/withdraw", verifiedAuth(http.HandlerFunc(r.ForwardExternalOTCActionHandler("withdraw"))))
	mux.Handle("POST /api/v1/otc/external-offers/{bank_code}/{thread_id}/premium-payment", verifiedAuth(http.HandlerFunc(r.ExternalOTCPremiumPaymentHandler())))
	mux.Handle("GET /api/v1/otc/external-contracts", verifiedAuth(http.HandlerFunc(r.ListLocalExternalOTCContractsHandler())))
	mux.Handle("POST /api/v1/otc/external-contracts/{bank_code}/{contract_id}/strike-payment", verifiedAuth(http.HandlerFunc(r.ExternalOTCStrikePaymentHandler())))
	mux.Handle("POST /api/v1/otc/external-contracts/{bank_code}/{contract_id}/exercise", verifiedAuth(http.HandlerFunc(r.ForwardExternalOTCContractExerciseHandler())))

	// Everything else (activation, password reset, employees, clients,
	// /me, etc.) goes through grpc-gateway under auth + verification +
	// idempotency.
	apiHandler := http.Handler(gwMux)
	if r.IdempotencyMW != nil {
		apiHandler = r.IdempotencyMW(apiHandler)
	}
	if r.VerificationMW != nil {
		apiHandler = r.VerificationMW(apiHandler)
	}
	mux.Handle("/api/", r.AuthMW(apiHandler))

	// Inter-bank receiver endpoints (c5): other banks POST here without
	// JWT. The gateway reverse-proxies directly to the bank service's
	// dedicated inter-bank HTTP server. No auth middleware — the bank
	// server validates X-Api-Key itself.
	if r.InterbankBankURL != "" {
		proxy := r.newInterbankProxy(r.InterbankBankURL)
		mux.Handle("/bank/api/v1/payment/", proxy)
		mux.Handle("/bank/api/v1/otc/public", proxy)
	}
	if r.TradingInterbankURL != "" {
		proxy := r.newInterbankProxy(r.TradingInterbankURL)
		mux.Handle("/bank/api/v1/otc/offers", proxy)
		mux.Handle("/bank/api/v1/otc/offers/", proxy)
		mux.Handle("/bank/api/v1/otc/contracts/", proxy)
	}

	// Plain ping so dev can sanity-check the gateway.
	mux.HandleFunc("GET /api/v1/ping", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	return withCORS(mux), nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

type errBody struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, errBody{Code: code, Message: msg})
}

// writeGRPCError translates a gRPC status to an HTTP error JSON body.
func writeGRPCError(w http.ResponseWriter, err error) {
	st, ok := status.FromError(err)
	if !ok || st == nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpCode := runtime.HTTPStatusFromCode(st.Code())
	writeError(w, httpCode, st.Message())
}

type externalOTCDiscoveryResponse struct {
	Banks []externalOTCBank `json:"banks"`
}

type externalOTCBank struct {
	BankCode string            `json:"bankCode"`
	Holdings []json.RawMessage `json:"holdings,omitempty"`
	Error    string            `json:"error,omitempty"`
}

func (r *Router) ExternalOTCDiscoveryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if len(r.InterbankRoutes) == 0 {
			writeJSON(w, http.StatusOK, externalOTCDiscoveryResponse{})
			return
		}

		type result struct {
			idx  int
			bank externalOTCBank
		}
		codes := make([]string, 0, len(r.InterbankRoutes))
		for code := range r.InterbankRoutes {
			codes = append(codes, code)
		}

		out := make([]externalOTCBank, len(codes))
		ch := make(chan result, len(codes))
		var wg sync.WaitGroup
		for i, code := range codes {
			base := r.InterbankRoutes[code]
			wg.Add(1)
			go func(idx int, bankCode, baseURL string) {
				defer wg.Done()
				holdings, err := fetchExternalOTCHoldings(req.Context(), baseURL)
				res := externalOTCBank{BankCode: bankCode, Holdings: holdings}
				if err != nil {
					res.Error = err.Error()
				}
				ch <- result{idx: idx, bank: res}
			}(i, code, base)
		}
		wg.Wait()
		close(ch)
		for res := range ch {
			out[res.idx] = res.bank
		}
		writeJSON(w, http.StatusOK, externalOTCDiscoveryResponse{Banks: out})
	}
}

func fetchExternalOTCHoldings(ctx context.Context, baseURL string) ([]json.RawMessage, error) {
	url := strings.TrimRight(baseURL, "/") + "/bank/api/v1/otc/public"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: HTTP %d", url, resp.StatusCode)
	}
	var holdings []json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&holdings); err != nil {
		return nil, fmt.Errorf("decode %s: %w", url, err)
	}
	return holdings, nil
}

func (r *Router) ListLocalExternalOTCThreadsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		p, ok := pkgauth.PrincipalFrom(req.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		if r.TradingInterbankURL == "" {
			writeError(w, http.StatusServiceUnavailable, "trading inter-bank URL not configured")
			return
		}
		target := strings.TrimRight(r.TradingInterbankURL, "/") + "/internal/api/v1/otc/external/threads?userId=" + url.QueryEscape(p.UserID)
		if status := req.URL.Query().Get("status"); status != "" {
			target += "&status=" + url.QueryEscape(status)
		}
		outReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, target, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if r.InterbankAPIKey != "" {
			outReq.Header.Set("X-Api-Key", r.InterbankAPIKey)
		}
		resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(outReq)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			writeError(w, http.StatusBadGateway, "failed to read trading response")
			return
		}
		writeRaw(w, resp.StatusCode, resp.Header.Get("Content-Type"), body)
	}
}

func (r *Router) ListLocalExternalOTCContractsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		p, ok := pkgauth.PrincipalFrom(req.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		if r.TradingInterbankURL == "" {
			writeError(w, http.StatusServiceUnavailable, "trading inter-bank URL not configured")
			return
		}
		target := strings.TrimRight(r.TradingInterbankURL, "/") + "/internal/api/v1/otc/external/contracts?userId=" + url.QueryEscape(p.UserID)
		if status := req.URL.Query().Get("status"); status != "" {
			target += "&status=" + url.QueryEscape(status)
		}
		outReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, target, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if r.InterbankAPIKey != "" {
			outReq.Header.Set("X-Api-Key", r.InterbankAPIKey)
		}
		resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(outReq)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			writeError(w, http.StatusBadGateway, "failed to read trading response")
			return
		}
		writeRaw(w, resp.StatusCode, resp.Header.Get("Content-Type"), body)
	}
}

type createExternalOTCOfferRequest struct {
	BankCode        string `json:"bankCode"`
	SellerHoldingID string `json:"sellerHoldingId"`
	BuyerAccountID  string `json:"buyerAccountId"`
	SecurityTicker   string `json:"securityTicker"`
	SecurityType     string `json:"securityType"`
	Quantity        int32  `json:"quantity"`
	PricePerUnit    string `json:"pricePerUnit"`
	Premium         string `json:"premium"`
	SettlementDate  string `json:"settlementDate"`
}

type externalOTCPremiumPaymentRequest struct {
	FromAccountID   string `json:"fromAccountId"`
	ToAccountNumber string `json:"toAccountNumber"`
	Amount          string `json:"amount"`
	RecipientName   string `json:"recipientName"`
	ReferenceNumber string `json:"referenceNumber"`
}

type externalOTCExerciseRequest struct {
	ExerciseOpID string `json:"exerciseOpId"`
}

func (r *Router) CreateExternalOTCOfferHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		p, ok := pkgauth.PrincipalFrom(req.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		var in createExternalOTCOfferRequest
		if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if in.BankCode == "" {
			writeError(w, http.StatusBadRequest, "bankCode is required")
			return
		}
		payload := map[string]any{
			"remoteBankCode":   r.BankCode,
			"remoteUserRef":    p.UserID,
			"remoteAccountRef": in.BuyerAccountID,
			"sellerHoldingId":  in.SellerHoldingID,
			"quantity":         in.Quantity,
			"pricePerUnit":     in.PricePerUnit,
			"premium":          in.Premium,
			"settlementDate":   in.SettlementDate,
		}
		body, err := json.Marshal(payload)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		status, remoteBody, contentType, err := r.partnerOTCRequest(req, in.BankCode, "/bank/api/v1/otc/offers", body)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if status < 200 || status >= 300 {
			writeRaw(w, status, contentType, remoteBody)
			return
		}

		localMirror, mirrorErr := r.mirrorOutboundOTCOffer(req, p, in, remoteBody)
		writeJSON(w, http.StatusCreated, map[string]any{
			"remote":      json.RawMessage(remoteBody),
			"localMirror": localMirror,
			"mirrorError": mirrorErr,
		})
	}
}

func (r *Router) ForwardExternalOTCActionHandler(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		bankCode := req.PathValue("bank_code")
		threadID := req.PathValue("thread_id")
		if bankCode == "" || threadID == "" {
			writeError(w, http.StatusBadRequest, "bank_code and thread_id are required")
			return
		}
		var body []byte
		if action == "counter" {
			raw, err := io.ReadAll(req.Body)
			if err != nil {
				writeError(w, http.StatusBadRequest, "invalid body")
				return
			}
			body = raw
		} else {
			body = []byte(`{}`)
		}
		path := "/bank/api/v1/otc/offers/" + url.PathEscape(threadID) + "/" + action
		status, respBody, contentType, err := r.partnerOTCRequest(req, bankCode, path, body)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if status < 200 || status >= 300 {
			writeRaw(w, status, contentType, respBody)
			return
		}
		localMirror, mirrorErr := r.syncOutboundOTCThread(req, bankCode, action, respBody)
		writeJSON(w, status, map[string]any{
			"remote":      json.RawMessage(respBody),
			"localMirror": localMirror,
			"mirrorError": mirrorErr,
		})
	}
}

func (r *Router) ForwardExternalOTCContractExerciseHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		bankCode := req.PathValue("bank_code")
		contractID := req.PathValue("contract_id")
		if bankCode == "" || contractID == "" {
			writeError(w, http.StatusBadRequest, "bank_code and contract_id are required")
			return
		}
		var in externalOTCExerciseRequest
		if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		body, err := json.Marshal(map[string]string{"exerciseOpId": in.ExerciseOpID})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		path := "/bank/api/v1/otc/contracts/" + url.PathEscape(contractID) + "/exercise"
		status, respBody, contentType, err := r.partnerOTCRequest(req, bankCode, path, body)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if status < 200 || status >= 300 {
			writeRaw(w, status, contentType, respBody)
			return
		}
		localMirror, mirrorErr := r.syncOutboundOTCExercise(req, bankCode, respBody)
		writeJSON(w, status, map[string]any{
			"remote":      json.RawMessage(respBody),
			"localMirror": localMirror,
			"mirrorError": mirrorErr,
		})
	}
}

func (r *Router) forwardPartnerOTC(w http.ResponseWriter, inbound *http.Request, bankCode, path string, body []byte) {
	status, respBody, contentType, err := r.partnerOTCRequest(inbound, bankCode, path, body)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeRaw(w, status, contentType, respBody)
}

func (r *Router) partnerOTCRequest(inbound *http.Request, bankCode, path string, body []byte) (int, []byte, string, error) {
	baseURL := r.InterbankRoutes[bankCode]
	if baseURL == "" {
		return 0, nil, "", fmt.Errorf("unknown partner bank")
	}
	target := strings.TrimRight(baseURL, "/") + path
	outReq, err := http.NewRequestWithContext(inbound.Context(), http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return 0, nil, "", err
	}
	outReq.Header.Set("Content-Type", "application/json")
	if r.InterbankAPIKey != "" {
		outReq.Header.Set("X-Api-Key", r.InterbankAPIKey)
	}
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(outReq)
	if err != nil {
		return 0, nil, "", err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, "", err
	}
	return resp.StatusCode, respBody, resp.Header.Get("Content-Type"), nil
}

func writeRaw(w http.ResponseWriter, status int, contentType string, body []byte) {
	if contentType == "" {
		contentType = "application/json"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func (r *Router) mirrorOutboundOTCOffer(req *http.Request, p pkgauth.Principal, in createExternalOTCOfferRequest, remoteBody []byte) (json.RawMessage, string) {
	if r.TradingInterbankURL == "" {
		return nil, "trading inter-bank URL not configured"
	}
	var remote struct {
		ID                 string `json:"id"`
		LocalUserID        string `json:"localUserId"`
		LocalAccountNumber string `json:"localAccountNumber"`
		LocalAccountID     string `json:"localAccountId"`
		SecurityTicker     string `json:"securityTicker"`
		Quantity           int32  `json:"quantity"`
		PricePerUnit       string `json:"pricePerUnit"`
		Premium            string `json:"premium"`
		SettlementDate     string `json:"settlementDate"`
	}
	if err := json.Unmarshal(remoteBody, &remote); err != nil {
		return nil, err.Error()
	}
	ticker := in.SecurityTicker
	if ticker == "" {
		ticker = remote.SecurityTicker
	}
	securityType := in.SecurityType
	if securityType == "" {
		securityType = "stock"
	}
	payload := map[string]any{
		"remoteBankCode":    in.BankCode,
		"remoteThreadId":    remote.ID,
		"remoteUserRef":     remote.LocalUserID,
		"remoteAccountRef":  remote.LocalAccountNumber,
		"localUserId":       p.UserID,
		"localUserKind":     string(p.UserKind),
		"localAccountId":    in.BuyerAccountID,
		"securityTicker":    ticker,
		"securityType":      securityType,
		"quantity":          remote.Quantity,
		"pricePerUnit":      remote.PricePerUnit,
		"premium":           remote.Premium,
		"settlementDate":    remote.SettlementDate,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err.Error()
	}
	target := strings.TrimRight(r.TradingInterbankURL, "/") + "/internal/api/v1/otc/external/outbound/offers"
	outReq, err := http.NewRequestWithContext(req.Context(), http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return nil, err.Error()
	}
	outReq.Header.Set("Content-Type", "application/json")
	if r.InterbankAPIKey != "" {
		outReq.Header.Set("X-Api-Key", r.InterbankAPIKey)
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(outReq)
	if err != nil {
		return nil, err.Error()
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err.Error()
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, string(respBody)
	}
	return json.RawMessage(respBody), ""
}

func (r *Router) syncOutboundOTCThread(req *http.Request, bankCode, action string, remoteBody []byte) (json.RawMessage, string) {
	if r.TradingInterbankURL == "" {
		return nil, "trading inter-bank URL not configured"
	}
	var remote struct {
		ID             string `json:"id"`
		Quantity       int32  `json:"quantity"`
		PricePerUnit   string `json:"pricePerUnit"`
		Premium        string `json:"premium"`
		SettlementDate string `json:"settlementDate"`
		Status         string `json:"status"`
	}
	if err := json.Unmarshal(remoteBody, &remote); err != nil {
		return nil, err.Error()
	}
	side := "remote"
	if action == "counter" {
		side = "local"
	}
	payload := map[string]any{
		"remoteBankCode": bankCode,
		"remoteThreadId": remote.ID,
		"quantity":       remote.Quantity,
		"pricePerUnit":   remote.PricePerUnit,
		"premium":        remote.Premium,
		"settlementDate": remote.SettlementDate,
		"modifiedBySide": side,
		"status":         remote.Status,
	}
	return r.postTradingMirror(req, "/internal/api/v1/otc/external/outbound/sync-thread", payload)
}

func (r *Router) syncOutboundOTCExercise(req *http.Request, bankCode string, remoteBody []byte) (json.RawMessage, string) {
	if r.TradingInterbankURL == "" {
		return nil, "trading inter-bank URL not configured"
	}
	var remote struct {
		ThreadID     string `json:"threadId"`
		ExerciseOpID string `json:"exerciseOpId"`
	}
	if err := json.Unmarshal(remoteBody, &remote); err != nil {
		return nil, err.Error()
	}
	payload := map[string]any{
		"remoteBankCode": bankCode,
		"remoteThreadId": remote.ThreadID,
		"exerciseOpId":   remote.ExerciseOpID,
	}
	return r.postTradingMirror(req, "/internal/api/v1/otc/external/outbound/sync-exercise", payload)
}

func (r *Router) postTradingMirror(req *http.Request, path string, payload map[string]any) (json.RawMessage, string) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err.Error()
	}
	target := strings.TrimRight(r.TradingInterbankURL, "/") + path
	outReq, err := http.NewRequestWithContext(req.Context(), http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return nil, err.Error()
	}
	outReq.Header.Set("Content-Type", "application/json")
	if r.InterbankAPIKey != "" {
		outReq.Header.Set("X-Api-Key", r.InterbankAPIKey)
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(outReq)
	if err != nil {
		return nil, err.Error()
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err.Error()
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, string(respBody)
	}
	return json.RawMessage(respBody), ""
}

func (r *Router) ExternalOTCPremiumPaymentHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if r.Bank == nil {
			writeError(w, http.StatusServiceUnavailable, "bank service not configured")
			return
		}
		p, ok := pkgauth.PrincipalFrom(req.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		var in externalOTCPremiumPaymentRequest
		if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if in.FromAccountID == "" || in.ToAccountNumber == "" || in.Amount == "" {
			writeError(w, http.StatusBadRequest, "fromAccountId, toAccountNumber and amount are required")
			return
		}
		ctx := pkgauth.AttachToOutgoing(req.Context(), p)
		purpose := "External OTC premium"
		if threadID := req.PathValue("thread_id"); threadID != "" {
			purpose += " - thread " + threadID
		}
		res, err := r.Bank.CreatePayment(ctx, &bankpb.CreatePaymentRequest{
			FromAccountId:   in.FromAccountID,
			ToAccountNumber: in.ToAccountNumber,
			Amount:          in.Amount,
			RecipientName:   in.RecipientName,
			PaymentCode:     "289",
			ReferenceNumber: in.ReferenceNumber,
			Purpose:         purpose,
		})
		if err != nil {
			writeGRPCError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"opId":   res.GetOpId(),
			"status": res.GetStatus().String(),
		})
	}
}

func (r *Router) ExternalOTCStrikePaymentHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if r.Bank == nil {
			writeError(w, http.StatusServiceUnavailable, "bank service not configured")
			return
		}
		p, ok := pkgauth.PrincipalFrom(req.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		var in externalOTCPremiumPaymentRequest
		if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if in.FromAccountID == "" || in.ToAccountNumber == "" || in.Amount == "" {
			writeError(w, http.StatusBadRequest, "fromAccountId, toAccountNumber and amount are required")
			return
		}
		ctx := pkgauth.AttachToOutgoing(req.Context(), p)
		purpose := "External OTC exercise"
		if contractID := req.PathValue("contract_id"); contractID != "" {
			purpose += " - contract " + contractID
		}
		res, err := r.Bank.CreatePayment(ctx, &bankpb.CreatePaymentRequest{
			FromAccountId:   in.FromAccountID,
			ToAccountNumber: in.ToAccountNumber,
			Amount:          in.Amount,
			RecipientName:   in.RecipientName,
			PaymentCode:     "289",
			ReferenceNumber: in.ReferenceNumber,
			Purpose:         purpose,
		})
		if err != nil {
			writeGRPCError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"opId":   res.GetOpId(),
			"status": res.GetStatus().String(),
		})
	}
}

// PublicPrefixes lists request-path prefixes that bypass the auth
// middleware. Everything outside this list requires a valid bearer
// token.
func PublicPrefixes() []string {
	return []string{
		"/api/v1/auth/login",
		"/api/v1/auth/refresh",
		"/api/v1/auth/logout",
		"/api/v1/auth/activate",
		"/api/v1/auth/password-reset",
		"/api/v1/ping",
	}
}

// withCORS handles preflight and adds permissive CORS headers for dev.
// Tighten in prod via env config.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Vary", "Origin")
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Verification-Id, X-Verification-Code")
			w.Header().Set("Access-Control-Max-Age", "300")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// auth and errors imports are referenced indirectly (auth via the
// outer app wiring; errors by writeGRPCError-adjacent code below).
// Surface them so an unused-import lint doesn't bite if a refactor
// drops their last visible call site.
var (
	_ = auth.Middleware
	_ = errors.New
)

// newInterbankProxy creates a reverse-proxy to the bank service's
// inter-bank HTTP server. It strips the /bank prefix so that
// /bank/api/v1/payment/prepare → /bank/api/v1/payment/prepare on the
// upstream (the bank HTTP server uses the same path).
func (r *Router) newInterbankProxy(targetBase string) http.Handler {
	target, err := url.Parse(targetBase)
	if err != nil {
		// config error — return a 503 handler
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusServiceUnavailable, "inter-bank proxy misconfigured")
		})
	}
	return httputil.NewSingleHostReverseProxy(target)
}
