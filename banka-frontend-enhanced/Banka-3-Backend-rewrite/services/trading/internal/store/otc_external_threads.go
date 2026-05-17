package store

import (
	"context"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/trading/internal/domain"
	"github.com/jackc/pgx/v5"
)

const externalOTCThreadCols = `
    id, direction, remote_bank_code, coalesce(remote_thread_id, ''),
    remote_user_ref, remote_display_name, remote_account_ref,
    local_user_id, local_user_kind, local_account_id, local_role,
    security_id, security_ticker, coalesce(seller_holding_id::text, ''),
    quantity, price_per_unit::text, premium::text, currency, settlement_date,
    modified_by_side, status, created_at, updated_at`

func scanExternalOTCThread(row pgx.Row) (*domain.ExternalOTCThread, error) {
	var t domain.ExternalOTCThread
	var direction, localKind, localRole, currency, side, status string
	if err := row.Scan(
		&t.ID, &direction, &t.RemoteBankCode, &t.RemoteThreadID,
		&t.RemoteUserRef, &t.RemoteDisplayName, &t.RemoteAccountRef,
		&t.LocalUserID, &localKind, &t.LocalAccountID, &localRole,
		&t.SecurityID, &t.SecurityTicker, &t.SellerHoldingID,
		&t.Quantity, &t.PricePerUnit, &t.Premium, &currency, &t.SettlementDate,
		&side, &status, &t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, err
	}
	t.Direction = domain.ExternalOTCDirection(direction)
	t.LocalUserKind = domain.UserKind(localKind)
	t.LocalRole = domain.ExternalOTCRole(localRole)
	t.Currency = domain.Currency(currency)
	t.ModifiedBySide = domain.ExternalOTCSide(side)
	t.Status = domain.ExternalOTCStatus(status)
	return &t, nil
}

func (s *Store) InsertExternalOTCThread(ctx context.Context, tx pgx.Tx, t *domain.ExternalOTCThread) (*domain.ExternalOTCThread, error) {
	const q = `
        insert into "trading".external_otc_threads (
            direction, remote_bank_code, remote_thread_id,
            remote_user_ref, remote_display_name, remote_account_ref,
            local_user_id, local_user_kind, local_account_id, local_role,
            security_id, security_ticker, seller_holding_id,
            quantity, price_per_unit, premium, currency, settlement_date,
            modified_by_side, status
        ) values (
            $1, $2, nullif($3, ''),
            $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, nullif($13, '')::uuid,
            $14, $15::numeric, $16::numeric, $17, $18,
            $19, $20
        )
        returning ` + externalOTCThreadCols
	row := tx.QueryRow(ctx, q,
		string(t.Direction), t.RemoteBankCode, t.RemoteThreadID,
		t.RemoteUserRef, t.RemoteDisplayName, t.RemoteAccountRef,
		t.LocalUserID, string(t.LocalUserKind), t.LocalAccountID, string(t.LocalRole),
		t.SecurityID, t.SecurityTicker, t.SellerHoldingID,
		t.Quantity, t.PricePerUnit, t.Premium, string(t.Currency), t.SettlementDate,
		string(t.ModifiedBySide), string(t.Status),
	)
	out, err := scanExternalOTCThread(row)
	if err != nil {
		return nil, apperr.Internal("insert external otc thread", err)
	}
	return out, nil
}

func (s *Store) InsertExternalOTCIteration(ctx context.Context, tx pgx.Tx, threadID string, side domain.ExternalOTCSide, quantity int32, pricePerUnit, premium string, settlementDate time.Time) error {
	_, err := tx.Exec(ctx, `
        insert into "trading".external_otc_iterations (
            thread_id, proposed_by_side, quantity, price_per_unit, premium, settlement_date
        ) values ($1, $2, $3, $4::numeric, $5::numeric, $6)`,
		threadID, string(side), quantity, pricePerUnit, premium, settlementDate,
	)
	if err != nil {
		return apperr.Internal("insert external otc iteration", err)
	}
	return nil
}

func (s *Store) GetExternalOTCThread(ctx context.Context, id string) (*domain.ExternalOTCThread, error) {
	const q = `select ` + externalOTCThreadCols + ` from "trading".external_otc_threads where id = $1`
	out, err := scanExternalOTCThread(s.Pool.QueryRow(ctx, q, id))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("eksterna OTC nit ne postoji")
		}
		return nil, apperr.Internal("get external otc thread", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCThreadForUpdate(ctx context.Context, tx pgx.Tx, id string) (*domain.ExternalOTCThread, error) {
	const q = `select ` + externalOTCThreadCols + ` from "trading".external_otc_threads where id = $1 for update`
	out, err := scanExternalOTCThread(tx.QueryRow(ctx, q, id))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("eksterna OTC nit ne postoji")
		}
		return nil, apperr.Internal("lock external otc thread", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCThreadByRemoteForUpdate(ctx context.Context, tx pgx.Tx, remoteBankCode, remoteThreadID string) (*domain.ExternalOTCThread, error) {
	const q = `select ` + externalOTCThreadCols + `
        from "trading".external_otc_threads
        where remote_bank_code = $1 and remote_thread_id = $2
        for update`
	out, err := scanExternalOTCThread(tx.QueryRow(ctx, q, remoteBankCode, remoteThreadID))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("eksterna OTC nit ne postoji")
		}
		return nil, apperr.Internal("lock external otc thread by remote", err)
	}
	return out, nil
}

func (s *Store) UpdateExternalOTCThreadTerms(ctx context.Context, tx pgx.Tx, id string, quantity int32, pricePerUnit, premium string, settlementDate time.Time, side domain.ExternalOTCSide) (*domain.ExternalOTCThread, error) {
	const q = `
        update "trading".external_otc_threads
        set quantity = $2,
            price_per_unit = $3::numeric,
            premium = $4::numeric,
            settlement_date = $5,
            modified_by_side = $6,
            updated_at = now()
        where id = $1 and status = 'open'
        returning ` + externalOTCThreadCols
	out, err := scanExternalOTCThread(tx.QueryRow(ctx, q, id, quantity, pricePerUnit, premium, settlementDate, string(side)))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("eksterna OTC nit ne postoji")
		}
		return nil, apperr.Internal("update external otc thread terms", err)
	}
	return out, nil
}

func (s *Store) MarkExternalOTCThreadStatus(ctx context.Context, tx pgx.Tx, id string, status domain.ExternalOTCStatus) (*domain.ExternalOTCThread, error) {
	const q = `
        update "trading".external_otc_threads
        set status = $2, updated_at = now()
        where id = $1
        returning ` + externalOTCThreadCols
	out, err := scanExternalOTCThread(tx.QueryRow(ctx, q, id, string(status)))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("eksterna OTC nit ne postoji")
		}
		return nil, apperr.Internal("mark external otc thread status", err)
	}
	return out, nil
}

func (s *Store) ListExternalOTCThreads(ctx context.Context, localUserID string, status domain.ExternalOTCStatus) ([]*domain.ExternalOTCThread, error) {
	q := `select ` + externalOTCThreadCols + ` from "trading".external_otc_threads where local_user_id = $1`
	args := []any{localUserID}
	if status != "" {
		q += ` and status = $2`
		args = append(args, string(status))
	}
	q += ` order by updated_at desc`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, apperr.Internal("list external otc threads", err)
	}
	defer rows.Close()
	var out []*domain.ExternalOTCThread
	for rows.Next() {
		t, err := scanExternalOTCThread(rows)
		if err != nil {
			return nil, apperr.Internal("scan external otc thread", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
