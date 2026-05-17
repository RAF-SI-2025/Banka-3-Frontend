// Inter-bank payment logic (c5, spec Celina 5). Two roles:
//
// Banka A (sender) — CreateInterbankPayment. Called by CreatePayment
// when the destination account number carries a foreign bank code.
// 2PC flow:
//   1. ReserveFunds on the sender's account (local, idempotent on opID).
//   2. POST /bank/api/v1/payment/prepare → Banka B.
//      Ready   → proceed to step 3.
//      NotReady → release reservation; return error.
//   3. Commit locally: debit sender, write 'interbank_payment' ledger leg.
//      Release the reservation (funds already moved).
//   4. POST /bank/api/v1/payment/commit → Banka B (credit the recipient).
//      On timeout/error: log for manual reconciliation (sender already debited).
//
// Banka B (receiver) — HandlePrepare + HandleCommitFull. Exposed by
// interbankhttp.Server on the bank service's dedicated HTTP port.
// The gateway reverse-proxies /bank/api/v1/payment/* there.
//
// Idempotency: every operation keys off TransactionID (uuid v4 generated
// by the sender). Retries are safe on both sides.

package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/money"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/bank/internal/domain"
	"github.com/jackc/pgx/v5"
)

// =====================================================================
// Shared message types (used by both sender and receiver sides)
// =====================================================================

// PrepareInput is the JSON body Banka A posts to Banka B at /payment/prepare.
type PrepareInput struct {
	TransactionID   string `json:"transactionId"`
	FromAccount     string `json:"fromAccount"`     // sender's account number (foreign bank)
	ToAccountNumber string `json:"toAccountNumber"` // our client's account number
	Amount          string `json:"amount"`
	Currency        string `json:"currency"` // currency of Amount
	RecipientName   string `json:"recipientName"`
	PaymentCode     string `json:"paymentCode"`
	ReferenceNumber string `json:"referenceNumber"`
	Purpose         string `json:"purpose"`
}

// PrepareResult is Banka B's response to the Prepare request.
type PrepareResult struct {
	Status        string `json:"status"`                  // "ready" | "not_ready"
	Reason        string `json:"reason,omitempty"`
	FinalAmount   string `json:"finalAmount,omitempty"`   // amount credited to recipient (after FX+commission)
	FinalCurrency string `json:"finalCurrency,omitempty"` // currency of FinalAmount
	ExchangeRate  string `json:"exchangeRate,omitempty"`
	Commission    string `json:"commission,omitempty"`
}

// CommitFullInput is the JSON body Banka A posts to Banka B at /payment/commit.
// Contains the full context Banka B needs to credit the recipient.
type CommitFullInput struct {
	TransactionID   string `json:"transactionId"`
	ToAccountNumber string `json:"toAccountNumber"`
	FinalAmount     string `json:"finalAmount"`
	FinalCurrency   string `json:"finalCurrency"`
	RecipientName   string `json:"recipientName"`
	PaymentCode     string `json:"paymentCode"`
	ReferenceNumber string `json:"referenceNumber"`
	Purpose         string `json:"purpose"`
}

// CommitResult is Banka B's confirmation that the credit was applied.
type CommitResult struct {
	Status string `json:"status"` // "committed"
}

// =====================================================================
// Banka B — receiver side
// =====================================================================

// HandlePrepare validates the incoming payment and returns Ready or
// NotReady. Never returns a hard error — network/service failures are
// expressed as not_ready so Banka A can release its reservation cleanly.
func (s *Service) HandlePrepare(ctx context.Context, in PrepareInput) (*PrepareResult, error) {
	if in.TransactionID == "" || in.ToAccountNumber == "" || in.Amount == "" || in.Currency == "" {
		return &PrepareResult{Status: "not_ready", Reason: "missing required fields"}, nil
	}

	amt, err := money.Parse(in.Amount)
	if err != nil || !money.IsPositive(amt) {
		return &PrepareResult{Status: "not_ready", Reason: "invalid amount"}, nil
	}

	fromCurrency := domain.Currency(strings.ToUpper(in.Currency))
	if !fromCurrency.Supported() {
		return &PrepareResult{Status: "not_ready", Reason: "unsupported currency"}, nil
	}

	// Verify the destination account exists and is active.
	toAcc, err := s.Store.GetAccountByNumber(ctx, in.ToAccountNumber)
	if err != nil {
		if isNotFound(err) {
			return &PrepareResult{Status: "not_ready", Reason: "destination account not found"}, nil
		}
		return &PrepareResult{Status: "not_ready", Reason: "account lookup error"}, nil
	}
	if toAcc.Status != domain.AccountActive {
		return &PrepareResult{Status: "not_ready", Reason: "destination account not active"}, nil
	}

	// Compute amount after FX conversion and commission.
	var finalAmt *big.Rat
	var composite *big.Rat
	var commission *big.Rat
	var rate string

	if fromCurrency == toAcc.Currency {
		finalAmt = amt
		commission = big.NewRat(0, 1)
		rate = "1"
	} else {
		if s.Rates == nil {
			return &PrepareResult{Status: "not_ready", Reason: "exchange rates unavailable"}, nil
		}
		composite, finalAmt, err = s.rateAndConvert(ctx, fromCurrency, toAcc.Currency, amt)
		if err != nil {
			return &PrepareResult{Status: "not_ready", Reason: "exchange rate error"}, nil
		}
		commission = money.Mul(finalAmt, s.commissionRate())
		finalAmt = money.Sub(finalAmt, commission)
		if !money.IsPositive(finalAmt) {
			return &PrepareResult{Status: "not_ready", Reason: "amount too small after commission"}, nil
		}
		rate = money.FormatRate(composite)
	}

	return &PrepareResult{
		Status:        "ready",
		FinalAmount:   money.FormatAmount(finalAmt),
		FinalCurrency: string(toAcc.Currency),
		ExchangeRate:  rate,
		Commission:    money.FormatAmount(commission),
	}, nil
}

// HandleCommitFull credits the destination account with the agreed
// FinalAmount. Idempotent on TransactionID — a retry returns immediately
// if the leg was already written.
func (s *Service) HandleCommitFull(ctx context.Context, in CommitFullInput) (*CommitResult, error) {
	if in.TransactionID == "" || in.FinalAmount == "" || in.FinalCurrency == "" || in.ToAccountNumber == "" {
		return nil, apperr.Validation("missing required fields")
	}

	finalAmt, err := money.Parse(in.FinalAmount)
	if err != nil || !money.IsPositive(finalAmt) {
		return nil, apperr.Validation("invalid final_amount")
	}

	opID := in.TransactionID

	// Idempotency: already committed?
	existing, _ := s.Store.GetTransactionsByOpID(ctx, opID)
	if len(existing) > 0 {
		return &CommitResult{Status: "committed"}, nil
	}

	// Load and validate destination.
	toAcc, err := s.Store.GetAccountByNumber(ctx, in.ToAccountNumber)
	if err != nil {
		return nil, apperr.NotFound("destination account not found")
	}
	if toAcc.Status != domain.AccountActive {
		return nil, apperr.FailedPrecondition("destination account not active")
	}

	finalCurrency := domain.Currency(strings.ToUpper(in.FinalCurrency))
	if finalCurrency != toAcc.Currency {
		return nil, apperr.Validation("final_currency does not match account currency")
	}

	// Credit the recipient. The house account in the recipient's currency
	// is debited (representing the wire arriving from outside) and the
	// client's account is credited. This keeps the books balanced.
	amtStr := money.FormatAmount(finalAmt)

	// Get the house account in the destination currency.
	bankAcc, err := s.Store.GetSystemAccount(ctx, toAcc.Currency)
	if err != nil {
		return nil, apperr.Internal("system account unavailable", err)
	}

	negAmt := money.FormatAmount(money.Sub(money.MustParse("0"), finalAmt))

	err = s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		// Debit house account (wire arrived into our pool from partner bank).
		if err := s.Store.AdjustBalance(ctx, tx, bankAcc.ID, negAmt); err != nil {
			return err
		}
		// Credit recipient.
		if err := s.Store.AdjustBalance(ctx, tx, toAcc.ID, amtStr); err != nil {
			return err
		}
		_, err := s.Store.InsertTransaction(ctx, tx, &domain.Transaction{
			OpID:            opID,
			Kind:            domain.TxKindInterbankPayment,
			LegIndex:        1,
			FromAccountID:   bankAcc.ID,
			ToAccountID:     toAcc.ID,
			FromAmount:      amtStr,
			ToAmount:        amtStr,
			RecipientName:   in.RecipientName,
			PaymentCode:     in.PaymentCode,
			ReferenceNumber: in.ReferenceNumber,
			Purpose:         in.Purpose,
			Status:          domain.TxStatusRealized,
		})
		return err
	})
	if err != nil {
		return nil, err
	}

	return &CommitResult{Status: "committed"}, nil
}

// =====================================================================
// Banka A — sender side
// =====================================================================

// InterbankRouter maps bank codes to base URLs of partner banks.
// The app layer populates it from the INTERBANK_ROUTES env var.
type InterbankRouter interface {
	URLForBankCode(code string) (string, bool)
}

// CreateInterbankPaymentInput is the Banka A payment request.
type CreateInterbankPaymentInput struct {
	FromAccountID   string
	ToAccountNumber string
	Amount          string
	RecipientName   string
	PaymentCode     string
	ReferenceNumber string
	Purpose         string
	TransactionID   string // pre-generated uuid; the 2PC correlation key
}

// CreateInterbankPaymentResult is returned on successful 2PC completion.
type CreateInterbankPaymentResult struct {
	TransactionID string
	FinalAmount   string
	FinalCurrency string
	ExchangeRate  string
}

// CreateInterbankPayment drives the full Banka A 2PC payment flow.
func (s *Service) CreateInterbankPayment(ctx context.Context, in CreateInterbankPaymentInput, remoteBankURL string) (*CreateInterbankPaymentResult, error) {
	fromAcc, err := s.Store.GetAccountByID(ctx, in.FromAccountID)
	if err != nil {
		return nil, err
	}
	if fromAcc.Status != domain.AccountActive {
		return nil, apperr.FailedPrecondition("račun pošiljaoca nije aktivan")
	}

	amt, err := parsePositive(in.Amount)
	if err != nil {
		return nil, err
	}

	opID := in.TransactionID

	record, err := s.Store.UpsertInterbankPayment(ctx, &domain.InterbankPayment{
		TransactionID:   in.TransactionID,
		FromAccountID:   in.FromAccountID,
		ToAccountNumber: in.ToAccountNumber,
		Amount:          money.FormatAmount(amt),
		Currency:        fromAcc.Currency,
		RecipientName:   in.RecipientName,
		PaymentCode:     in.PaymentCode,
		ReferenceNumber: in.ReferenceNumber,
		Purpose:         in.Purpose,
		RemoteBankURL:   remoteBankURL,
	})
	if err != nil {
		return nil, err
	}
	if record.Status == domain.InterbankPaymentCommitted {
		return &CreateInterbankPaymentResult{
			TransactionID: in.TransactionID,
			FinalAmount:   record.FinalAmount,
			FinalCurrency: string(record.FinalCurrency),
			ExchangeRate:  record.ExchangeRate,
		}, nil
	}
	if record.Status == domain.InterbankPaymentPrepared {
		return s.retryPreparedInterbankCommit(ctx, record)
	}

	// Step 1 — reserve funds locally (idempotent on opID).
	reservationID, err := s.Store.ReserveFundsForInterbank(ctx, in.FromAccountID, money.FormatAmount(amt), string(fromAcc.Currency), opID)
	if err != nil {
		return nil, fmt.Errorf("reserve funds: %w", err)
	}
	if err := s.Store.SetInterbankReservation(ctx, in.TransactionID, reservationID); err != nil {
		return nil, err
	}

	release := func() { _ = s.Store.ReleaseInterbankReservation(ctx, reservationID, opID) }

	// Step 2 — POST prepare to Banka B.
	prepResult, err := s.postPrepare(ctx, remoteBankURL, PrepareInput{
		TransactionID:   in.TransactionID,
		FromAccount:     fromAcc.Number,
		ToAccountNumber: in.ToAccountNumber,
		Amount:          money.FormatAmount(amt),
		Currency:        string(fromAcc.Currency),
		RecipientName:   in.RecipientName,
		PaymentCode:     in.PaymentCode,
		ReferenceNumber: in.ReferenceNumber,
		Purpose:         in.Purpose,
	})
	if err != nil || prepResult.Status != "ready" {
		release()
		reason := "remote bank not ready"
		if prepResult != nil && prepResult.Reason != "" {
			reason = prepResult.Reason
		}
		_ = s.Store.MarkInterbankFailed(ctx, in.TransactionID, reason)
		return nil, apperr.FailedPrecondition("inter-bank payment rejected: " + reason)
	}

	// Step 3 — commit locally: debit sender → credit house account → write leg.
	_, parseErr := money.Parse(prepResult.FinalAmount)
	if parseErr != nil {
		release()
		_ = s.Store.MarkInterbankFailed(ctx, in.TransactionID, parseErr.Error())
		return nil, apperr.Internal("parse final amount from remote bank", parseErr)
	}

	amtStr := money.FormatAmount(amt)
	negAmt := money.FormatAmount(money.Sub(money.MustParse("0"), amt))

	existingLegs, err := s.Store.GetTransactionsByOpID(ctx, opID)
	if err != nil {
		release()
		return nil, err
	}
	if len(existingLegs) == 0 {
		commitErr := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
			// Debit sender's account.
			if err := s.Store.AdjustBalance(ctx, tx, fromAcc.ID, negAmt); err != nil {
				return err
			}
			// Credit bank's house account in the sender's currency
			// (represents money leaving the bank via the inter-bank wire).
			bankAcc, err := s.Store.GetSystemAccount(ctx, fromAcc.Currency)
			if err != nil {
				return err
			}
			if err := s.Store.AdjustBalance(ctx, tx, bankAcc.ID, amtStr); err != nil {
				return err
			}
			_, err = s.Store.InsertTransaction(ctx, tx, &domain.Transaction{
				OpID:            opID,
				Kind:            domain.TxKindInterbankPayment,
				LegIndex:        1,
				FromAccountID:   fromAcc.ID,
				ToAccountID:     bankAcc.ID,
				FromAmount:      amtStr,
				ToAmount:        amtStr,
				Rate:            prepResult.ExchangeRate,
				RecipientName:   in.RecipientName,
				PaymentCode:     in.PaymentCode,
				ReferenceNumber: in.ReferenceNumber,
				Purpose:         in.Purpose,
				Status:          domain.TxStatusRealized,
			})
			if err != nil {
				return err
			}
			return s.Store.MarkInterbankPreparedTx(ctx, tx, in.TransactionID, prepResult.FinalAmount, prepResult.FinalCurrency, prepResult.ExchangeRate, prepResult.Commission)
		})
		if commitErr != nil {
			release()
			_ = s.Store.MarkInterbankFailed(ctx, in.TransactionID, commitErr.Error())
			return nil, fmt.Errorf("local debit failed: %w", commitErr)
		}
	}

	// Reservation served its purpose — release it (balance already moved).
	release()

	// Step 4 — POST commit to Banka B. At this point our side is done.
	// If Banka B's commit fails (e.g. timeout) we log it for manual
	// reconciliation — we do NOT re-credit the sender (Banka B may have
	// succeeded and the response simply got lost).
	commitResult, commitRemoteErr := s.postCommit(ctx, remoteBankURL, CommitFullInput{
		TransactionID:   in.TransactionID,
		ToAccountNumber: in.ToAccountNumber,
		FinalAmount:     prepResult.FinalAmount,
		FinalCurrency:   prepResult.FinalCurrency,
		RecipientName:   in.RecipientName,
		PaymentCode:     in.PaymentCode,
		ReferenceNumber: in.ReferenceNumber,
		Purpose:         in.Purpose,
	})
	if commitRemoteErr != nil || commitResult == nil || commitResult.Status != "committed" {
		lastErr := "remote bank did not commit"
		if commitRemoteErr != nil {
			lastErr = commitRemoteErr.Error()
		}
		_ = s.Store.RememberInterbankCommitError(ctx, in.TransactionID, lastErr)
		s.log.Error("inter-bank commit to remote bank failed after local debit — manual reconciliation required",
			"transaction_id", in.TransactionID,
			"remote_url", remoteBankURL,
			"error", commitRemoteErr)
		return nil, apperr.Internal("remote bank commit failed — funds debited locally, reconciliation needed", commitRemoteErr)
	}

	if err := s.Store.MarkInterbankCommitted(ctx, in.TransactionID); err != nil {
		return nil, err
	}

	return &CreateInterbankPaymentResult{
		TransactionID: in.TransactionID,
		FinalAmount:   prepResult.FinalAmount,
		FinalCurrency: prepResult.FinalCurrency,
		ExchangeRate:  prepResult.ExchangeRate,
	}, nil
}

func (s *Service) retryPreparedInterbankCommit(ctx context.Context, p *domain.InterbankPayment) (*CreateInterbankPaymentResult, error) {
	commitResult, err := s.postCommit(ctx, p.RemoteBankURL, CommitFullInput{
		TransactionID:   p.TransactionID,
		ToAccountNumber: p.ToAccountNumber,
		FinalAmount:     p.FinalAmount,
		FinalCurrency:   string(p.FinalCurrency),
		RecipientName:   p.RecipientName,
		PaymentCode:     p.PaymentCode,
		ReferenceNumber: p.ReferenceNumber,
		Purpose:         p.Purpose,
	})
	if err != nil || commitResult == nil || commitResult.Status != "committed" {
		lastErr := "remote bank did not commit"
		if err != nil {
			lastErr = err.Error()
		}
		_ = s.Store.RememberInterbankCommitError(ctx, p.TransactionID, lastErr)
		return nil, apperr.Internal("remote bank commit retry failed", err)
	}
	if err := s.Store.MarkInterbankCommitted(ctx, p.TransactionID); err != nil {
		return nil, err
	}
	return &CreateInterbankPaymentResult{
		TransactionID: p.TransactionID,
		FinalAmount:   p.FinalAmount,
		FinalCurrency: string(p.FinalCurrency),
		ExchangeRate:  p.ExchangeRate,
	}, nil
}

func (s *Service) RunInterbankRecoveryJob(ctx context.Context) (int, int, error) {
	rows, err := s.Store.ListRecoverableInterbankPayments(ctx, 50)
	if err != nil {
		return 0, 0, err
	}
	var committed int
	for _, row := range rows {
		if _, err := s.retryPreparedInterbankCommit(ctx, row); err != nil {
			s.log.Warn("inter-bank recovery retry failed",
				"transaction_id", row.TransactionID,
				"remote_url", row.RemoteBankURL,
				"err", err.Error())
			continue
		}
		committed++
	}
	return len(rows), committed, nil
}

// postPrepare sends the Prepare request to Banka B.
// Network errors are returned as not_ready (never a hard error) so
// the caller can always safely release the reservation.
func (s *Service) postPrepare(ctx context.Context, baseURL string, body PrepareInput) (*PrepareResult, error) {
	data, _ := json.Marshal(body)
	url := strings.TrimRight(baseURL, "/") + "/bank/api/v1/payment/prepare"

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return &PrepareResult{Status: "not_ready", Reason: err.Error()}, nil
	}
	req.Header.Set("Content-Type", "application/json")
	if s.Cfg.InterbankAPIKey != "" {
		req.Header.Set("X-Api-Key", s.Cfg.InterbankAPIKey)
	}

	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return &PrepareResult{Status: "not_ready", Reason: "network error: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return &PrepareResult{Status: "not_ready", Reason: fmt.Sprintf("remote server error %d", resp.StatusCode)}, nil
	}

	var result PrepareResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &PrepareResult{Status: "not_ready", Reason: "invalid response from remote bank"}, nil
	}
	return &result, nil
}

// postCommit sends the Commit request to Banka B.
func (s *Service) postCommit(ctx context.Context, baseURL string, body CommitFullInput) (*CommitResult, error) {
	data, _ := json.Marshal(body)
	url := strings.TrimRight(baseURL, "/") + "/bank/api/v1/payment/commit"

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.Cfg.InterbankAPIKey != "" {
		req.Header.Set("X-Api-Key", s.Cfg.InterbankAPIKey)
	}

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("remote bank rejected commit with HTTP %d", resp.StatusCode)
	}

	var result CommitResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode commit response: %w", err)
	}
	return &result, nil
}
