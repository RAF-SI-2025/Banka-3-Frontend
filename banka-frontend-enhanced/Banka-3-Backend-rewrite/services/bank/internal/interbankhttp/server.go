// Package interbankhttp runs a small HTTP server inside the bank service
// that handles incoming calls from other banks (Banka B receiver role).
//
// The server is separate from the gRPC server to keep the proto surface
// clean — the inter-bank protocol uses plain JSON HTTP, not gRPC.
// The gateway reverse-proxies /bank/api/v1/payment/* and
// /bank/api/v1/otc/public to this server.
//
// Endpoints:
//
//	POST /bank/api/v1/payment/prepare  → HandlePrepare (Banka B 2PC phase 1)
//	POST /bank/api/v1/payment/commit   → HandleCommitFull (Banka B 2PC phase 2)
//	GET  /bank/api/v1/otc/public       → OTC discovery feed for cross-bank OTC
package interbankhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/services/bank/internal/service"
)

// OTCPublicProvider is the minimal interface from the trading service
// that the inter-bank HTTP server needs to serve the OTC discovery feed.
type OTCPublicProvider interface {
	ListPublicHoldingsForInterbank(ctx context.Context) (interface{}, error)
}

// Server is the inter-bank HTTP server for the Banka B (receiver) role.
type Server struct {
	Svc    *service.Service
	APIKey string // expected X-Api-Key; empty → open (dev)
	Addr   string
	// OTC is optional — if nil the /otc/public endpoint returns 503.
	OTC OTCPublicProvider
}

// ListenAndServe starts the server and blocks until ctx is cancelled.
func (s *Server) ListenAndServe(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.Handle("POST /bank/api/v1/payment/prepare", s.authMW(http.HandlerFunc(s.handlePrepare)))
	mux.Handle("POST /bank/api/v1/payment/commit", s.authMW(http.HandlerFunc(s.handleCommit)))
	mux.HandleFunc("GET /bank/api/v1/otc/public", s.handleOTCPublic)

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

func (s *Server) handlePrepare(w http.ResponseWriter, r *http.Request) {
	var in service.PrepareInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	result, err := s.Svc.HandlePrepare(r.Context(), in)
	if err != nil {
		writeJSON(w, http.StatusOK, service.PrepareResult{
			Status: "not_ready",
			Reason: err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleCommit(w http.ResponseWriter, r *http.Request) {
	var in service.CommitFullInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	result, err := s.Svc.HandleCommitFull(r.Context(), in)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// handleOTCPublic serves public OTC holdings so other banks can show
// them on their OTC portals. No authentication — public by design.
func (s *Server) handleOTCPublic(w http.ResponseWriter, r *http.Request) {
	if s.OTC == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "OTC service not available"})
		return
	}
	data, err := s.OTC.ListPublicHoldingsForInterbank(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
