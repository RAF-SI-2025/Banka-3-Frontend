// Package interbankhttp exposes the trading-side OTC receiver endpoints
// used by partner banks during cross-bank OTC negotiation.
package interbankhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/trading/internal/domain"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/trading/internal/service"
)

type Server struct {
	Svc    *service.Service
	APIKey string
	Addr   string
}

func (s *Server) ListenAndServe(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.Handle("POST /bank/api/v1/otc/offers", s.authMW(http.HandlerFunc(s.handleReceiveOffer)))
	mux.Handle("GET /bank/api/v1/otc/offers/{thread_id}", s.authMW(http.HandlerFunc(s.handleGetOffer)))
	mux.Handle("POST /bank/api/v1/otc/offers/{thread_id}/counter", s.authMW(http.HandlerFunc(s.handleCounterOffer)))
	mux.Handle("POST /bank/api/v1/otc/offers/{thread_id}/accept", s.authMW(http.HandlerFunc(s.handleAcceptOffer)))
	mux.Handle("POST /bank/api/v1/otc/offers/{thread_id}/withdraw", s.authMW(http.HandlerFunc(s.handleWithdrawOffer)))
	mux.Handle("GET /bank/api/v1/otc/contracts/{contract_id}", s.authMW(http.HandlerFunc(s.handleGetContract)))
	mux.Handle("POST /bank/api/v1/otc/contracts/{contract_id}/exercise", s.authMW(http.HandlerFunc(s.handleExerciseContract)))
	mux.Handle("POST /internal/api/v1/otc/external/outbound/offers", s.authMW(http.HandlerFunc(s.handleMirrorOutboundOffer)))
	mux.Handle("POST /internal/api/v1/otc/external/outbound/sync-thread", s.authMW(http.HandlerFunc(s.handleSyncOutboundThread)))
	mux.Handle("POST /internal/api/v1/otc/external/outbound/sync-exercise", s.authMW(http.HandlerFunc(s.handleSyncOutboundExercise)))
	mux.Handle("GET /internal/api/v1/otc/external/threads", s.authMW(http.HandlerFunc(s.handleListLocalThreads)))
	mux.Handle("GET /internal/api/v1/otc/external/contracts", s.authMW(http.HandlerFunc(s.handleListLocalContracts)))

	srv := &http.Server{
		Addr:              s.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutCtx)
	case err := <-errCh:
		return err
	}
}

func (s *Server) authMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.APIKey != "" && r.Header.Get("X-Api-Key") != s.APIKey {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

type receiveOfferRequest struct {
	RemoteBankCode    string `json:"remoteBankCode"`
	RemoteThreadID    string `json:"remoteThreadId"`
	RemoteUserRef     string `json:"remoteUserRef"`
	RemoteDisplayName string `json:"remoteDisplayName"`
	RemoteAccountRef  string `json:"remoteAccountRef"`
	SellerHoldingID    string `json:"sellerHoldingId"`
	Quantity          int32  `json:"quantity"`
	PricePerUnit      string `json:"pricePerUnit"`
	Premium           string `json:"premium"`
	SettlementDate    string `json:"settlementDate"`
}

type counterRequest struct {
	Quantity       int32  `json:"quantity"`
	PricePerUnit   string `json:"pricePerUnit"`
	Premium        string `json:"premium"`
	SettlementDate string `json:"settlementDate"`
}

type exerciseRequest struct {
	ExerciseOpID string `json:"exerciseOpId"`
}

type mirrorOutboundOfferRequest struct {
	RemoteBankCode    string `json:"remoteBankCode"`
	RemoteThreadID    string `json:"remoteThreadId"`
	RemoteUserRef     string `json:"remoteUserRef"`
	RemoteDisplayName string `json:"remoteDisplayName"`
	RemoteAccountRef  string `json:"remoteAccountRef"`
	LocalUserID        string `json:"localUserId"`
	LocalUserKind      string `json:"localUserKind"`
	LocalAccountID     string `json:"localAccountId"`
	SecurityTicker     string `json:"securityTicker"`
	SecurityType       string `json:"securityType"`
	Quantity          int32  `json:"quantity"`
	PricePerUnit      string `json:"pricePerUnit"`
	Premium           string `json:"premium"`
	SettlementDate    string `json:"settlementDate"`
}

type syncOutboundThreadRequest struct {
	RemoteBankCode string `json:"remoteBankCode"`
	RemoteThreadID string `json:"remoteThreadId"`
	Quantity       int32  `json:"quantity"`
	PricePerUnit   string `json:"pricePerUnit"`
	Premium        string `json:"premium"`
	SettlementDate string `json:"settlementDate"`
	ModifiedBySide string `json:"modifiedBySide"`
	Status         string `json:"status"`
}

type syncOutboundExerciseRequest struct {
	RemoteBankCode string `json:"remoteBankCode"`
	RemoteThreadID string `json:"remoteThreadId"`
	ExerciseOpID   string `json:"exerciseOpId"`
}

func (s *Server) handleReceiveOffer(w http.ResponseWriter, r *http.Request) {
	var in receiveOfferRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	settlement, ok := parseSettlementDate(w, in.SettlementDate)
	if !ok {
		return
	}
	thread, err := s.Svc.ReceiveExternalOTCOffer(r.Context(), service.ReceiveExternalOTCOfferInput{
		RemoteBankCode:    in.RemoteBankCode,
		RemoteThreadID:    in.RemoteThreadID,
		RemoteUserRef:     in.RemoteUserRef,
		RemoteDisplayName: in.RemoteDisplayName,
		RemoteAccountRef:  in.RemoteAccountRef,
		SellerHoldingID:    in.SellerHoldingID,
		Quantity:          in.Quantity,
		PricePerUnit:      in.PricePerUnit,
		Premium:           in.Premium,
		SettlementDate:    settlement,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleGetOffer(w http.ResponseWriter, r *http.Request) {
	thread, err := s.Svc.Store.GetExternalOTCThread(r.Context(), r.PathValue("thread_id"))
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleCounterOffer(w http.ResponseWriter, r *http.Request) {
	var in counterRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	settlement, ok := parseSettlementDate(w, in.SettlementDate)
	if !ok {
		return
	}
	thread, err := s.Svc.CounterExternalOTCThread(r.Context(), service.CounterExternalOTCThreadInput{
		ThreadID:       r.PathValue("thread_id"),
		Side:           domain.ExternalOTCSideRemote,
		Quantity:       in.Quantity,
		PricePerUnit:   in.PricePerUnit,
		Premium:        in.Premium,
		SettlementDate: settlement,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleWithdrawOffer(w http.ResponseWriter, r *http.Request) {
	thread, err := s.Svc.WithdrawExternalOTCThread(r.Context(), r.PathValue("thread_id"), domain.ExternalOTCSideRemote)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleAcceptOffer(w http.ResponseWriter, r *http.Request) {
	thread, err := s.Svc.AcceptExternalOTCThread(r.Context(), r.PathValue("thread_id"), domain.ExternalOTCSideRemote)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleGetContract(w http.ResponseWriter, r *http.Request) {
	contract, err := s.Svc.Store.GetExternalOTCContract(r.Context(), r.PathValue("contract_id"))
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toContractResponse(r.Context(), contract))
}

func (s *Server) handleExerciseContract(w http.ResponseWriter, r *http.Request) {
	var in exerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	contract, err := s.Svc.ExerciseExternalOTCContract(r.Context(), r.PathValue("contract_id"), domain.ExternalOTCSideRemote, in.ExerciseOpID)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toContractResponse(r.Context(), contract))
}

func (s *Server) handleMirrorOutboundOffer(w http.ResponseWriter, r *http.Request) {
	var in mirrorOutboundOfferRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	settlement, ok := parseSettlementDate(w, in.SettlementDate)
	if !ok {
		return
	}
	thread, err := s.Svc.MirrorOutboundExternalOTCOffer(r.Context(), service.MirrorOutboundExternalOTCOfferInput{
		RemoteBankCode:    in.RemoteBankCode,
		RemoteThreadID:    in.RemoteThreadID,
		RemoteUserRef:     in.RemoteUserRef,
		RemoteDisplayName: in.RemoteDisplayName,
		RemoteAccountRef:  in.RemoteAccountRef,
		LocalUserID:        in.LocalUserID,
		LocalUserKind:      domain.UserKind(in.LocalUserKind),
		LocalAccountID:     in.LocalAccountID,
		SecurityTicker:     in.SecurityTicker,
		SecurityType:       domain.SecurityType(in.SecurityType),
		Quantity:          in.Quantity,
		PricePerUnit:      in.PricePerUnit,
		Premium:           in.Premium,
		SettlementDate:    settlement,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleSyncOutboundThread(w http.ResponseWriter, r *http.Request) {
	var in syncOutboundThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	var settlement time.Time
	if in.SettlementDate != "" {
		t, ok := parseSettlementDate(w, in.SettlementDate)
		if !ok {
			return
		}
		settlement = t
	}
	thread, err := s.Svc.SyncOutboundExternalOTCThread(r.Context(), service.SyncOutboundExternalOTCThreadInput{
		RemoteBankCode: in.RemoteBankCode,
		RemoteThreadID: in.RemoteThreadID,
		Quantity:       in.Quantity,
		PricePerUnit:   in.PricePerUnit,
		Premium:        in.Premium,
		SettlementDate: settlement,
		ModifiedBySide: domain.ExternalOTCSide(in.ModifiedBySide),
		Status:         domain.ExternalOTCStatus(in.Status),
	})
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toThreadResponse(r.Context(), thread))
}

func (s *Server) handleSyncOutboundExercise(w http.ResponseWriter, r *http.Request) {
	var in syncOutboundExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	contract, err := s.Svc.SyncOutboundExternalOTCExercise(r.Context(), service.SyncOutboundExternalOTCExerciseInput{
		RemoteBankCode: in.RemoteBankCode,
		RemoteThreadID: in.RemoteThreadID,
		ExerciseOpID:   in.ExerciseOpID,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.toContractResponse(r.Context(), contract))
}

func (s *Server) handleListLocalThreads(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId is required"})
		return
	}
	var status domain.ExternalOTCStatus
	switch r.URL.Query().Get("status") {
	case "", "open":
		status = domain.ExternalOTCStatusOpen
	case "accepted":
		status = domain.ExternalOTCStatusAccepted
	case "withdrawn":
		status = domain.ExternalOTCStatusWithdrawn
	case "expired":
		status = domain.ExternalOTCStatusExpired
	case "any":
		status = ""
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown status"})
		return
	}
	rows, err := s.Svc.Store.ListExternalOTCThreads(r.Context(), userID, status)
	if err != nil {
		writeAppError(w, err)
		return
	}
	out := make([]threadResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, s.toThreadResponse(r.Context(), row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"threads": out})
}

func (s *Server) handleListLocalContracts(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId is required"})
		return
	}
	var status domain.ExternalOTCContractStatus
	switch r.URL.Query().Get("status") {
	case "", "active":
		status = domain.ExternalOTCContractActive
	case "exercised":
		status = domain.ExternalOTCContractExercised
	case "expired":
		status = domain.ExternalOTCContractExpired
	case "any":
		status = ""
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown status"})
		return
	}
	rows, err := s.Svc.Store.ListExternalOTCContracts(r.Context(), userID, status)
	if err != nil {
		writeAppError(w, err)
		return
	}
	out := make([]contractResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, s.toContractResponse(r.Context(), row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"contracts": out})
}

func parseSettlementDate(w http.ResponseWriter, raw string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02", raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "settlementDate must be YYYY-MM-DD"})
		return time.Time{}, false
	}
	return t, true
}

type threadResponse struct {
	ID                string `json:"id"`
	Direction         string `json:"direction"`
	RemoteBankCode    string `json:"remoteBankCode"`
	RemoteThreadID    string `json:"remoteThreadId"`
	RemoteUserRef     string `json:"remoteUserRef"`
	RemoteDisplayName string `json:"remoteDisplayName"`
	RemoteAccountRef  string `json:"remoteAccountRef"`
	LocalUserID        string `json:"localUserId"`
	LocalUserKind      string `json:"localUserKind"`
	LocalAccountID     string `json:"localAccountId"`
	LocalAccountNumber string `json:"localAccountNumber"`
	LocalRole          string `json:"localRole"`
	SecurityID         string `json:"securityId"`
	SecurityTicker     string `json:"securityTicker"`
	SellerHoldingID    string `json:"sellerHoldingId"`
	Quantity          int32  `json:"quantity"`
	PricePerUnit      string `json:"pricePerUnit"`
	Premium           string `json:"premium"`
	Currency          string `json:"currency"`
	SettlementDate    string `json:"settlementDate"`
	ModifiedBySide    string `json:"modifiedBySide"`
	Status            string `json:"status"`
	CreatedAt         string `json:"createdAt"`
	UpdatedAt         string `json:"updatedAt"`
}

type contractResponse struct {
	ID                string `json:"id"`
	ThreadID          string `json:"threadId"`
	Direction         string `json:"direction"`
	RemoteBankCode    string `json:"remoteBankCode"`
	RemoteThreadID    string `json:"remoteThreadId"`
	RemoteUserRef     string `json:"remoteUserRef"`
	RemoteDisplayName string `json:"remoteDisplayName"`
	RemoteAccountRef  string `json:"remoteAccountRef"`
	LocalUserID        string `json:"localUserId"`
	LocalUserKind      string `json:"localUserKind"`
	LocalAccountID     string `json:"localAccountId"`
	LocalAccountNumber string `json:"localAccountNumber"`
	LocalRole          string `json:"localRole"`
	SecurityID         string `json:"securityId"`
	SecurityTicker     string `json:"securityTicker"`
	SellerHoldingID    string `json:"sellerHoldingId"`
	Quantity          int32  `json:"quantity"`
	StrikePrice       string `json:"strikePrice"`
	PremiumPaid       string `json:"premiumPaid"`
	Currency          string `json:"currency"`
	SettlementDate    string `json:"settlementDate"`
	AcceptedBySide    string `json:"acceptedBySide"`
	Status            string `json:"status"`
	PremiumOpID       string `json:"premiumOpId"`
	ExerciseOpID      string `json:"exerciseOpId"`
	ExercisedAt       string `json:"exercisedAt,omitempty"`
	CreatedAt         string `json:"createdAt"`
	UpdatedAt         string `json:"updatedAt"`
}

func toThreadResponse(t *domain.ExternalOTCThread) threadResponse {
	return threadResponse{
		ID:                t.ID,
		Direction:         string(t.Direction),
		RemoteBankCode:    t.RemoteBankCode,
		RemoteThreadID:    t.RemoteThreadID,
		RemoteUserRef:     t.RemoteUserRef,
		RemoteDisplayName: t.RemoteDisplayName,
		RemoteAccountRef:  t.RemoteAccountRef,
		LocalUserID:        t.LocalUserID,
		LocalUserKind:      string(t.LocalUserKind),
		LocalAccountID:     t.LocalAccountID,
		LocalRole:          string(t.LocalRole),
		SecurityID:         t.SecurityID,
		SecurityTicker:     t.SecurityTicker,
		SellerHoldingID:    t.SellerHoldingID,
		Quantity:          t.Quantity,
		PricePerUnit:      t.PricePerUnit,
		Premium:           t.Premium,
		Currency:          string(t.Currency),
		SettlementDate:    t.SettlementDate.Format("2006-01-02"),
		ModifiedBySide:    string(t.ModifiedBySide),
		Status:            string(t.Status),
		CreatedAt:         t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         t.UpdatedAt.Format(time.RFC3339),
	}
}

func (s *Server) toThreadResponse(ctx context.Context, t *domain.ExternalOTCThread) threadResponse {
	out := toThreadResponse(t)
	if s.Svc != nil && s.Svc.Reservations != nil && t.LocalAccountID != "" {
		if number, err := s.Svc.Reservations.AccountNumber(ctx, t.LocalAccountID); err == nil {
			out.LocalAccountNumber = number
		}
	}
	return out
}

func (s *Server) toContractResponse(ctx context.Context, c *domain.ExternalOTCContract) contractResponse {
	out := contractResponse{
		ID:                c.ID,
		ThreadID:          c.ThreadID,
		Direction:         string(c.Direction),
		RemoteBankCode:    c.RemoteBankCode,
		RemoteThreadID:    c.RemoteThreadID,
		RemoteUserRef:     c.RemoteUserRef,
		RemoteDisplayName: c.RemoteDisplayName,
		RemoteAccountRef:  c.RemoteAccountRef,
		LocalUserID:        c.LocalUserID,
		LocalUserKind:      string(c.LocalUserKind),
		LocalAccountID:     c.LocalAccountID,
		LocalRole:          string(c.LocalRole),
		SecurityID:         c.SecurityID,
		SecurityTicker:     c.SecurityTicker,
		SellerHoldingID:    c.SellerHoldingID,
		Quantity:          c.Quantity,
		StrikePrice:       c.StrikePrice,
		PremiumPaid:       c.PremiumPaid,
		Currency:          string(c.Currency),
		SettlementDate:    c.SettlementDate.Format("2006-01-02"),
		AcceptedBySide:    string(c.AcceptedBySide),
		Status:            string(c.Status),
		PremiumOpID:       c.PremiumOpID,
		ExerciseOpID:      c.ExerciseOpID,
		CreatedAt:         c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         c.UpdatedAt.Format(time.RFC3339),
	}
	if c.ExercisedAt != nil {
		out.ExercisedAt = c.ExercisedAt.Format(time.RFC3339)
	}
	if s.Svc != nil && s.Svc.Reservations != nil && c.LocalAccountID != "" {
		if number, err := s.Svc.Reservations.AccountNumber(ctx, c.LocalAccountID); err == nil {
			out.LocalAccountNumber = number
		}
	}
	return out
}

func writeAppError(w http.ResponseWriter, err error) {
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	status := http.StatusInternalServerError
	switch ae.Kind {
	case apperr.KindNotFound:
		status = http.StatusNotFound
	case apperr.KindConflict:
		status = http.StatusConflict
	case apperr.KindValidation:
		status = http.StatusBadRequest
	case apperr.KindUnauthenticated:
		status = http.StatusUnauthorized
	case apperr.KindPermissionDenied:
		status = http.StatusForbidden
	case apperr.KindFailedPrecondition:
		status = http.StatusPreconditionFailed
	case apperr.KindUnavailable:
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]string{"error": ae.Message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
