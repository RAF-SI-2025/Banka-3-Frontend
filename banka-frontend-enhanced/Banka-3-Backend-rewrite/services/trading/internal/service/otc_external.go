// Cross-bank OTC discovery (c5). The trading service fetches public
// holdings from partner banks' /bank/api/v1/otc/public endpoint and
// merges them with the local discovery feed.
//
// The external holdings are returned as-is from the partner bank's JSON
// response — we don't store them locally (they're ephemeral snapshots).
// The frontend merges local + remote rows and can additionally display
// the originating bank name.

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/money"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/trading/internal/domain"
	"github.com/jackc/pgx/v5"
)

// ExternalPublicHolding is one row from a partner bank's OTC discovery
// feed. The shape mirrors PublicHoldingRow but uses plain strings for
// cross-bank portability (no domain types needed).
type ExternalPublicHolding struct {
	HoldingID         string `json:"holdingId"`
	Ticker            string `json:"ticker"`
	SecurityType      string `json:"securityType"`
	AvailableCount    int32  `json:"availableCount"`
	PricePerUnit      string `json:"pricePerUnit"`
	Currency          string `json:"currency"`
	SellerAccountID   string `json:"sellerAccountId"`
	SellerAccountNo   string `json:"sellerAccountNumber"`
	SellerDisplayName string `json:"sellerDisplayName"`
	BankCode          string `json:"bankCode"` // filled in by us after fetch
	BankName          string `json:"bankName"`
}

// ExternalBankOTCResult bundles all holdings from one partner bank.
type ExternalBankOTCResult struct {
	BankCode string                  `json:"bankCode"`
	Holdings []*ExternalPublicHolding `json:"holdings"`
	Error    string                   `json:"error,omitempty"`
}

// PartnerBankConfig is one entry in the inter-bank routing table.
type PartnerBankConfig struct {
	Code    string
	Name    string
	BaseURL string
}

// ListExternalOTCHoldings fetches public OTC holdings from all
// configured partner banks in parallel and returns the merged result.
// Errors from individual banks are captured per-bank (not fatal).
func (s *Service) ListExternalOTCHoldings(ctx context.Context, partners []PartnerBankConfig) []*ExternalBankOTCResult {
	if len(partners) == 0 {
		return nil
	}

	type result struct {
		r   *ExternalBankOTCResult
		idx int
	}
	ch := make(chan result, len(partners))

	for i, p := range partners {
		go func(idx int, bank PartnerBankConfig) {
			r := &ExternalBankOTCResult{BankCode: bank.Code}
			holdings, err := fetchExternalOTCHoldings(ctx, bank)
			if err != nil {
				r.Error = err.Error()
			} else {
				r.Holdings = holdings
			}
			ch <- result{r: r, idx: idx}
		}(i, p)
	}

	out := make([]*ExternalBankOTCResult, len(partners))
	for range partners {
		res := <-ch
		out[res.idx] = res.r
	}
	return out
}

// fetchExternalOTCHoldings fetches the public holdings from one bank.
func fetchExternalOTCHoldings(ctx context.Context, bank PartnerBankConfig) ([]*ExternalPublicHolding, error) {
	url := bank.BaseURL + "/bank/api/v1/otc/public"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch from %s: %w", bank.Code, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bank %s returned %d", bank.Code, resp.StatusCode)
	}

	// Partner banks return a JSON array of holdings.
	var raw []json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		// Try object wrapper
		return nil, fmt.Errorf("decode response from %s: %w", bank.Code, err)
	}

	out := make([]*ExternalPublicHolding, 0, len(raw))
	for _, item := range raw {
		var h ExternalPublicHolding
		if err := json.Unmarshal(item, &h); err != nil {
			continue
		}
		h.BankCode = bank.Code
		h.BankName = bank.Name
		out = append(out, &h)
	}
	return out, nil
}

// ListPublicHoldingsForInterbank returns this bank's public OTC holdings
// in a simplified JSON-serializable format for cross-bank consumption.
// Called by interbankhttp.Server via the OTCPublicProvider interface.
func (s *Service) ListPublicHoldingsForInterbank(ctx context.Context) (interface{}, error) {
	rows, err := s.Store.ListPublicHoldings(ctx, "")
	if err != nil {
		return nil, err
	}

	type row struct {
		HoldingID         string `json:"holdingId"`
		Ticker            string `json:"ticker"`
		SecurityType      string `json:"securityType"`
		AvailableCount    int32  `json:"availableCount"`
		PricePerUnit      string `json:"pricePerUnit"`
		Currency          string `json:"currency"`
		SellerAccountID   string `json:"sellerAccountId"`
		SellerAccountNo   string `json:"sellerAccountNumber"`
		SellerDisplayName string `json:"sellerDisplayName"`
	}

	out := make([]row, 0, len(rows))
	for _, h := range rows {
		sec, err := s.Store.GetSecurity(ctx, h.SecurityID)
		if err != nil {
			continue
		}
		// Only stocks are OTC-tradable cross-bank.
		if sec.Type != domain.SecurityStock {
			continue
		}
		avail := h.PublicCount - h.ReservedCount
		if avail <= 0 {
			continue
		}
		price := ""
		if listing, err := s.Store.GetListingBySecurityID(ctx, sec.ID); err == nil {
			price = listing.Ask
		}
		displayName := ""
		if s.Users != nil {
			if name, err := s.Users.DisplayName(ctx, h.UserID, h.UserKind); err == nil {
				displayName = name
			}
		}
		accountNumber := ""
		if s.Reservations != nil && h.AccountID != "" {
			if number, err := s.Reservations.AccountNumber(ctx, h.AccountID); err == nil {
				accountNumber = number
			}
		}
		out = append(out, row{
			HoldingID:         h.ID,
			Ticker:            sec.Ticker,
			SecurityType:      string(sec.Type),
			AvailableCount:    avail,
			PricePerUnit:      price,
			Currency:          string(sec.Currency),
			SellerAccountID:   h.AccountID,
			SellerAccountNo:   accountNumber,
			SellerDisplayName: displayName,
		})
	}
	return out, nil
}

type ReceiveExternalOTCOfferInput struct {
	RemoteBankCode    string
	RemoteThreadID    string
	RemoteUserRef     string
	RemoteDisplayName string
	RemoteAccountRef  string
	SellerHoldingID    string
	Quantity          int32
	PricePerUnit      string
	Premium           string
	SettlementDate    time.Time
}

type MirrorOutboundExternalOTCOfferInput struct {
	RemoteBankCode    string
	RemoteThreadID    string
	RemoteUserRef     string
	RemoteDisplayName string
	RemoteAccountRef  string
	LocalUserID        string
	LocalUserKind      domain.UserKind
	LocalAccountID     string
	SecurityTicker     string
	SecurityType       domain.SecurityType
	Quantity          int32
	PricePerUnit      string
	Premium           string
	SettlementDate    time.Time
}

type SyncOutboundExternalOTCThreadInput struct {
	RemoteBankCode string
	RemoteThreadID string
	Quantity       int32
	PricePerUnit   string
	Premium        string
	SettlementDate time.Time
	ModifiedBySide domain.ExternalOTCSide
	Status         domain.ExternalOTCStatus
}

type SyncOutboundExternalOTCExerciseInput struct {
	RemoteBankCode string
	RemoteThreadID string
	ExerciseOpID   string
}

func (s *Service) ReceiveExternalOTCOffer(ctx context.Context, in ReceiveExternalOTCOfferInput) (*domain.ExternalOTCThread, error) {
	if in.RemoteBankCode == "" || in.SellerHoldingID == "" || in.RemoteUserRef == "" {
		return nil, apperr.Validation("remote_bank_code, seller_holding_id and remote_user_ref are required")
	}
	if err := validateOTCMoneyFields(in.Quantity, in.PricePerUnit, in.Premium); err != nil {
		return nil, err
	}
	if !in.SettlementDate.After(s.now()) {
		return nil, apperr.Validation("settlement_date mora biti u budućnosti")
	}

	holding, err := s.Store.GetHoldingByID(ctx, in.SellerHoldingID)
	if err != nil {
		return nil, err
	}
	sec, err := s.Store.GetSecurity(ctx, holding.SecurityID)
	if err != nil {
		return nil, err
	}
	if sec.Type != domain.SecurityStock && sec.Type != domain.SecurityFuture {
		return nil, apperr.Validation("OTC trgovina ne podržava ovaj tip hartije")
	}

	var out *domain.ExternalOTCThread
	err = s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		locked, err := s.Store.GetHoldingForUpdate(ctx, tx, holding.ID)
		if err != nil {
			return err
		}
		available := locked.PublicCount - locked.ReservedCount
		if available <= 0 {
			return apperr.FailedPrecondition("hartija više nije dostupna na OTC")
		}
		if in.Quantity > available {
			return apperr.FailedPrecondition("nedovoljno raspoloživih akcija")
		}
		if _, err := s.Store.IncrementReservedHolding(ctx, tx, locked.ID, in.Quantity); err != nil {
			return err
		}
		thread, err := s.Store.InsertExternalOTCThread(ctx, tx, &domain.ExternalOTCThread{
			Direction:         domain.ExternalOTCInbound,
			RemoteBankCode:    in.RemoteBankCode,
			RemoteThreadID:    in.RemoteThreadID,
			RemoteUserRef:     in.RemoteUserRef,
			RemoteDisplayName: in.RemoteDisplayName,
			RemoteAccountRef:  in.RemoteAccountRef,
			LocalUserID:        locked.UserID,
			LocalUserKind:      locked.UserKind,
			LocalAccountID:     locked.AccountID,
			LocalRole:          domain.ExternalOTCRoleSeller,
			SecurityID:         sec.ID,
			SecurityTicker:     sec.Ticker,
			SellerHoldingID:    locked.ID,
			Quantity:          in.Quantity,
			PricePerUnit:      money.FormatAmount(money.MustParse(in.PricePerUnit)),
			Premium:           money.FormatAmount(money.MustParse(in.Premium)),
			Currency:          sec.Currency,
			SettlementDate:    in.SettlementDate,
			ModifiedBySide:    domain.ExternalOTCSideRemote,
			Status:            domain.ExternalOTCStatusOpen,
		})
		if err != nil {
			return err
		}
		if err := s.Store.InsertExternalOTCIteration(ctx, tx, thread.ID, domain.ExternalOTCSideRemote, thread.Quantity, thread.PricePerUnit, thread.Premium, thread.SettlementDate); err != nil {
			return err
		}
		out = thread
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) MirrorOutboundExternalOTCOffer(ctx context.Context, in MirrorOutboundExternalOTCOfferInput) (*domain.ExternalOTCThread, error) {
	if in.RemoteBankCode == "" || in.RemoteThreadID == "" || in.LocalUserID == "" || in.LocalAccountID == "" || in.SecurityTicker == "" {
		return nil, apperr.Validation("remote_bank_code, remote_thread_id, local_user_id, local_account_id and security_ticker are required")
	}
	if in.SecurityType == "" {
		in.SecurityType = domain.SecurityStock
	}
	if in.LocalUserKind != domain.KindClient && in.LocalUserKind != domain.KindEmployee {
		return nil, apperr.Validation("local_user_kind is invalid")
	}
	if err := validateOTCMoneyFields(in.Quantity, in.PricePerUnit, in.Premium); err != nil {
		return nil, err
	}
	if !in.SettlementDate.After(s.now()) {
		return nil, apperr.Validation("settlement_date mora biti u budućnosti")
	}

	sec, err := s.Store.GetSecurityByTicker(ctx, in.SecurityTicker, in.SecurityType)
	if err != nil {
		return nil, err
	}

	var out *domain.ExternalOTCThread
	err = s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		thread, err := s.Store.InsertExternalOTCThread(ctx, tx, &domain.ExternalOTCThread{
			Direction:         domain.ExternalOTCOutbound,
			RemoteBankCode:    in.RemoteBankCode,
			RemoteThreadID:    in.RemoteThreadID,
			RemoteUserRef:     in.RemoteUserRef,
			RemoteDisplayName: in.RemoteDisplayName,
			RemoteAccountRef:  in.RemoteAccountRef,
			LocalUserID:        in.LocalUserID,
			LocalUserKind:      in.LocalUserKind,
			LocalAccountID:     in.LocalAccountID,
			LocalRole:          domain.ExternalOTCRoleBuyer,
			SecurityID:         sec.ID,
			SecurityTicker:     sec.Ticker,
			Quantity:          in.Quantity,
			PricePerUnit:      money.FormatAmount(money.MustParse(in.PricePerUnit)),
			Premium:           money.FormatAmount(money.MustParse(in.Premium)),
			Currency:          sec.Currency,
			SettlementDate:    in.SettlementDate,
			ModifiedBySide:    domain.ExternalOTCSideLocal,
			Status:            domain.ExternalOTCStatusOpen,
		})
		if err != nil {
			return err
		}
		if err := s.Store.InsertExternalOTCIteration(ctx, tx, thread.ID, domain.ExternalOTCSideLocal, thread.Quantity, thread.PricePerUnit, thread.Premium, thread.SettlementDate); err != nil {
			return err
		}
		out = thread
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) SyncOutboundExternalOTCThread(ctx context.Context, in SyncOutboundExternalOTCThreadInput) (*domain.ExternalOTCThread, error) {
	if in.RemoteBankCode == "" || in.RemoteThreadID == "" {
		return nil, apperr.Validation("remote_bank_code and remote_thread_id are required")
	}
	if in.Status == "" {
		in.Status = domain.ExternalOTCStatusOpen
	}
	termsPresent := in.Quantity > 0 || in.PricePerUnit != "" || in.Premium != "" || !in.SettlementDate.IsZero()
	var normalizedPrice, normalizedPremium string
	if termsPresent {
		if in.Quantity <= 0 || in.PricePerUnit == "" || in.Premium == "" || in.SettlementDate.IsZero() {
			return nil, apperr.Validation("quantity, price_per_unit, premium and settlement_date are required when syncing OTC terms")
		}
		if err := validateOTCMoneyFields(in.Quantity, in.PricePerUnit, in.Premium); err != nil {
			return nil, err
		}
		normalizedPrice = money.FormatAmount(money.MustParse(in.PricePerUnit))
		normalizedPremium = money.FormatAmount(money.MustParse(in.Premium))
	}
	var out *domain.ExternalOTCThread
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		thread, err := s.Store.GetExternalOTCThreadByRemoteForUpdate(ctx, tx, in.RemoteBankCode, in.RemoteThreadID)
		if err != nil {
			return err
		}
		if termsPresent && thread.Status == domain.ExternalOTCStatusOpen {
			side := in.ModifiedBySide
			if side == "" {
				side = domain.ExternalOTCSideRemote
			}
			thread, err = s.Store.UpdateExternalOTCThreadTerms(ctx, tx,
				thread.ID,
				in.Quantity,
				normalizedPrice,
				normalizedPremium,
				in.SettlementDate,
				side,
			)
			if err != nil {
				return err
			}
			if err := s.Store.InsertExternalOTCIteration(ctx, tx, thread.ID, side, thread.Quantity, thread.PricePerUnit, thread.Premium, thread.SettlementDate); err != nil {
				return err
			}
		}
		if in.Status != "" && thread.Status != in.Status {
			thread, err = s.Store.MarkExternalOTCThreadStatus(ctx, tx, thread.ID, in.Status)
			if err != nil {
				return err
			}
		}
		if in.Status == domain.ExternalOTCStatusAccepted {
			if _, err := s.Store.InsertExternalOTCContract(ctx, tx, &domain.ExternalOTCContract{
				ThreadID:          thread.ID,
				Direction:         thread.Direction,
				RemoteBankCode:    thread.RemoteBankCode,
				RemoteThreadID:    thread.RemoteThreadID,
				RemoteUserRef:     thread.RemoteUserRef,
				RemoteDisplayName: thread.RemoteDisplayName,
				RemoteAccountRef:  thread.RemoteAccountRef,
				LocalUserID:        thread.LocalUserID,
				LocalUserKind:      thread.LocalUserKind,
				LocalAccountID:     thread.LocalAccountID,
				LocalRole:          thread.LocalRole,
				SecurityID:         thread.SecurityID,
				SecurityTicker:     thread.SecurityTicker,
				SellerHoldingID:    thread.SellerHoldingID,
				Quantity:          thread.Quantity,
				StrikePrice:       thread.PricePerUnit,
				PremiumPaid:       thread.Premium,
				Currency:          thread.Currency,
				SettlementDate:    thread.SettlementDate,
				AcceptedBySide:    domain.ExternalOTCSideRemote,
				Status:            domain.ExternalOTCContractActive,
			}); err != nil {
				return err
			}
		}
		out = thread
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) SyncOutboundExternalOTCExercise(ctx context.Context, in SyncOutboundExternalOTCExerciseInput) (*domain.ExternalOTCContract, error) {
	if in.RemoteBankCode == "" || in.RemoteThreadID == "" {
		return nil, apperr.Validation("remote_bank_code and remote_thread_id are required")
	}
	var out *domain.ExternalOTCContract
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		contract, err := s.Store.GetExternalOTCContractByRemoteThreadForUpdate(ctx, tx, in.RemoteBankCode, in.RemoteThreadID)
		if err != nil {
			return err
		}
		if contract.Status == domain.ExternalOTCContractExercised {
			out = contract
			return nil
		}
		if contract.Status != domain.ExternalOTCContractActive {
			return apperr.FailedPrecondition("eksterni OTC ugovor nije aktivan")
		}
		if contract.LocalRole == domain.ExternalOTCRoleBuyer {
			if _, err := s.Store.ApplyBuyFill(ctx, tx, contract.LocalUserID, string(contract.LocalUserKind), contract.SecurityID, contract.LocalAccountID, contract.Quantity, contract.StrikePrice); err != nil {
				return err
			}
		}
		updated, err := s.Store.MarkExternalOTCContractExercised(ctx, tx, contract.ID, in.ExerciseOpID, s.now())
		if err != nil {
			return err
		}
		out = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) ListExternalOTCThreads(ctx context.Context, status string) ([]*domain.ExternalOTCThread, error) {
	p, err := s.requirePrincipal(ctx)
	if err != nil {
		return nil, err
	}
	if err := requireOTCTrader(p); err != nil {
		return nil, err
	}
	var st domain.ExternalOTCStatus
	switch status {
	case "", "open":
		st = domain.ExternalOTCStatusOpen
	case "any":
		st = ""
	default:
		return nil, apperr.Validation("nepoznat status eksternih OTC niti")
	}
	return s.Store.ListExternalOTCThreads(ctx, p.UserID, st)
}

type CounterExternalOTCThreadInput struct {
	ThreadID       string
	Side           domain.ExternalOTCSide
	Quantity       int32
	PricePerUnit   string
	Premium        string
	SettlementDate time.Time
}

func (s *Service) CounterExternalOTCThread(ctx context.Context, in CounterExternalOTCThreadInput) (*domain.ExternalOTCThread, error) {
	if in.ThreadID == "" {
		return nil, apperr.Validation("thread_id is required")
	}
	if in.Side != domain.ExternalOTCSideLocal && in.Side != domain.ExternalOTCSideRemote {
		return nil, apperr.Validation("side is required")
	}
	if err := validateOTCMoneyFields(in.Quantity, in.PricePerUnit, in.Premium); err != nil {
		return nil, err
	}
	if !in.SettlementDate.After(s.now()) {
		return nil, apperr.Validation("settlement_date mora biti u budućnosti")
	}

	var out *domain.ExternalOTCThread
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		thread, err := s.Store.GetExternalOTCThreadForUpdate(ctx, tx, in.ThreadID)
		if err != nil {
			return err
		}
		if thread.Status != domain.ExternalOTCStatusOpen {
			return apperr.FailedPrecondition("eksterna OTC nit nije otvorena")
		}
		if thread.ModifiedBySide == in.Side {
			return apperr.FailedPrecondition("čeka se odgovor druge strane")
		}

		if thread.LocalRole == domain.ExternalOTCRoleSeller && thread.SellerHoldingID != "" {
			delta := in.Quantity - thread.Quantity
			if delta > 0 {
				locked, err := s.Store.GetHoldingForUpdate(ctx, tx, thread.SellerHoldingID)
				if err != nil {
					return err
				}
				if delta > locked.PublicCount-locked.ReservedCount {
					return apperr.FailedPrecondition("nedovoljno raspoloživih akcija")
				}
				if _, err := s.Store.IncrementReservedHolding(ctx, tx, thread.SellerHoldingID, delta); err != nil {
					return err
				}
			} else if delta < 0 {
				if _, err := s.Store.DecrementReservedHolding(ctx, tx, thread.SellerHoldingID, -delta); err != nil {
					return err
				}
			}
		}

		updated, err := s.Store.UpdateExternalOTCThreadTerms(ctx, tx,
			thread.ID,
			in.Quantity,
			money.FormatAmount(money.MustParse(in.PricePerUnit)),
			money.FormatAmount(money.MustParse(in.Premium)),
			in.SettlementDate,
			in.Side,
		)
		if err != nil {
			return err
		}
		if err := s.Store.InsertExternalOTCIteration(ctx, tx, updated.ID, in.Side, updated.Quantity, updated.PricePerUnit, updated.Premium, updated.SettlementDate); err != nil {
			return err
		}
		out = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) WithdrawExternalOTCThread(ctx context.Context, threadID string, side domain.ExternalOTCSide) (*domain.ExternalOTCThread, error) {
	if threadID == "" {
		return nil, apperr.Validation("thread_id is required")
	}
	if side != domain.ExternalOTCSideLocal && side != domain.ExternalOTCSideRemote {
		return nil, apperr.Validation("side is required")
	}

	var out *domain.ExternalOTCThread
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		thread, err := s.Store.GetExternalOTCThreadForUpdate(ctx, tx, threadID)
		if err != nil {
			return err
		}
		if thread.Status != domain.ExternalOTCStatusOpen {
			return apperr.FailedPrecondition("eksterna OTC nit nije otvorena")
		}
		if thread.LocalRole == domain.ExternalOTCRoleSeller && thread.SellerHoldingID != "" && thread.Quantity > 0 {
			if _, err := s.Store.DecrementReservedHolding(ctx, tx, thread.SellerHoldingID, thread.Quantity); err != nil {
				return err
			}
		}
		updated, err := s.Store.MarkExternalOTCThreadStatus(ctx, tx, thread.ID, domain.ExternalOTCStatusWithdrawn)
		if err != nil {
			return err
		}
		out = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) AcceptExternalOTCThread(ctx context.Context, threadID string, side domain.ExternalOTCSide) (*domain.ExternalOTCThread, error) {
	if threadID == "" {
		return nil, apperr.Validation("thread_id is required")
	}
	if side != domain.ExternalOTCSideLocal && side != domain.ExternalOTCSideRemote {
		return nil, apperr.Validation("side is required")
	}

	var out *domain.ExternalOTCThread
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		thread, err := s.Store.GetExternalOTCThreadForUpdate(ctx, tx, threadID)
		if err != nil {
			return err
		}
		if thread.Status != domain.ExternalOTCStatusOpen {
			return apperr.FailedPrecondition("eksterna OTC nit nije otvorena")
		}
		if thread.ModifiedBySide == side {
			return apperr.FailedPrecondition("ne možete prihvatiti sopstveni predlog")
		}
		if _, err := s.Store.InsertExternalOTCContract(ctx, tx, &domain.ExternalOTCContract{
			ThreadID:          thread.ID,
			Direction:         thread.Direction,
			RemoteBankCode:    thread.RemoteBankCode,
			RemoteThreadID:    thread.RemoteThreadID,
			RemoteUserRef:     thread.RemoteUserRef,
			RemoteDisplayName: thread.RemoteDisplayName,
			RemoteAccountRef:  thread.RemoteAccountRef,
			LocalUserID:        thread.LocalUserID,
			LocalUserKind:      thread.LocalUserKind,
			LocalAccountID:     thread.LocalAccountID,
			LocalRole:          thread.LocalRole,
			SecurityID:         thread.SecurityID,
			SecurityTicker:     thread.SecurityTicker,
			SellerHoldingID:    thread.SellerHoldingID,
			Quantity:          thread.Quantity,
			StrikePrice:       thread.PricePerUnit,
			PremiumPaid:       thread.Premium,
			Currency:          thread.Currency,
			SettlementDate:    thread.SettlementDate,
			AcceptedBySide:    side,
			Status:            domain.ExternalOTCContractActive,
		}); err != nil {
			return err
		}
		updated, err := s.Store.MarkExternalOTCThreadStatus(ctx, tx, thread.ID, domain.ExternalOTCStatusAccepted)
		if err != nil {
			return err
		}
		out = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) ExerciseExternalOTCContract(ctx context.Context, contractID string, side domain.ExternalOTCSide, exerciseOpID string) (*domain.ExternalOTCContract, error) {
	if contractID == "" {
		return nil, apperr.Validation("contract_id is required")
	}
	if side != domain.ExternalOTCSideLocal && side != domain.ExternalOTCSideRemote {
		return nil, apperr.Validation("side is required")
	}

	var out *domain.ExternalOTCContract
	err := s.Store.ExecuteAtomic(ctx, func(tx pgx.Tx) error {
		c, err := s.Store.GetExternalOTCContractForUpdate(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if c.Status != domain.ExternalOTCContractActive {
			return apperr.FailedPrecondition("eksterni OTC ugovor nije aktivan")
		}
		if !c.SettlementDate.After(s.now()) {
			return apperr.FailedPrecondition("eksterni OTC ugovor je istekao")
		}
		buyerSide := domain.ExternalOTCSideRemote
		if c.LocalRole == domain.ExternalOTCRoleBuyer {
			buyerSide = domain.ExternalOTCSideLocal
		}
		if side != buyerSide {
			return apperr.PermissionDenied("samo kupac moze da izvrsi ugovor")
		}

		switch c.LocalRole {
		case domain.ExternalOTCRoleSeller:
			if c.SellerHoldingID == "" {
				return apperr.FailedPrecondition("local seller holding is missing")
			}
			h, err := s.Store.GetHoldingByID(ctx, c.SellerHoldingID)
			if err != nil {
				return err
			}
			if h.Quantity < c.Quantity || h.ReservedCount < c.Quantity {
				return apperr.FailedPrecondition("seller holding no longer covers contract quantity")
			}
			if _, err := s.Store.DecrementReservedHolding(ctx, tx, c.SellerHoldingID, c.Quantity); err != nil {
				return err
			}
			if _, _, err := s.Store.ApplySellFill(ctx, tx, h.UserID, string(h.UserKind), h.SecurityID, h.AccountID, c.Quantity); err != nil {
				return err
			}
		case domain.ExternalOTCRoleBuyer:
			if _, err := s.Store.ApplyBuyFill(ctx, tx, c.LocalUserID, string(c.LocalUserKind), c.SecurityID, c.LocalAccountID, c.Quantity, c.StrikePrice); err != nil {
				return err
			}
		default:
			return apperr.Validation("unknown local role")
		}

		updated, err := s.Store.MarkExternalOTCContractExercised(ctx, tx, c.ID, exerciseOpID, s.now())
		if err != nil {
			return err
		}
		out = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
