package store

import (
	"context"
	"time"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/trading/internal/domain"
	"github.com/jackc/pgx/v5"
)

const externalOTCContractCols = `
    id, thread_id, direction, remote_bank_code, remote_thread_id,
    remote_user_ref, remote_display_name, remote_account_ref,
    local_user_id, local_user_kind, local_account_id, local_role,
    security_id, security_ticker, coalesce(seller_holding_id::text, ''),
    quantity, strike_price::text, premium_paid::text, currency, settlement_date,
    accepted_by_side, status, premium_op_id, exercise_op_id, exercised_at,
    created_at, updated_at`

func scanExternalOTCContract(row pgx.Row) (*domain.ExternalOTCContract, error) {
	var c domain.ExternalOTCContract
	var direction, localKind, localRole, currency, acceptedBy, status string
	var exercisedAt *time.Time
	if err := row.Scan(
		&c.ID, &c.ThreadID, &direction, &c.RemoteBankCode, &c.RemoteThreadID,
		&c.RemoteUserRef, &c.RemoteDisplayName, &c.RemoteAccountRef,
		&c.LocalUserID, &localKind, &c.LocalAccountID, &localRole,
		&c.SecurityID, &c.SecurityTicker, &c.SellerHoldingID,
		&c.Quantity, &c.StrikePrice, &c.PremiumPaid, &currency, &c.SettlementDate,
		&acceptedBy, &status, &c.PremiumOpID, &c.ExerciseOpID, &exercisedAt,
		&c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	c.Direction = domain.ExternalOTCDirection(direction)
	c.LocalUserKind = domain.UserKind(localKind)
	c.LocalRole = domain.ExternalOTCRole(localRole)
	c.Currency = domain.Currency(currency)
	c.AcceptedBySide = domain.ExternalOTCSide(acceptedBy)
	c.Status = domain.ExternalOTCContractStatus(status)
	c.ExercisedAt = exercisedAt
	return &c, nil
}

func (s *Store) InsertExternalOTCContract(ctx context.Context, tx pgx.Tx, c *domain.ExternalOTCContract) (*domain.ExternalOTCContract, error) {
	const q = `
        insert into "trading".external_otc_contracts (
            thread_id, direction, remote_bank_code, remote_thread_id,
            remote_user_ref, remote_display_name, remote_account_ref,
            local_user_id, local_user_kind, local_account_id, local_role,
            security_id, security_ticker, seller_holding_id,
            quantity, strike_price, premium_paid, currency, settlement_date,
            accepted_by_side, status, premium_op_id
        ) values (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, nullif($14, '')::uuid,
            $15, $16::numeric, $17::numeric, $18, $19,
            $20, $21, $22
        ) on conflict (thread_id) do update
            set updated_at = "trading".external_otc_contracts.updated_at
        returning ` + externalOTCContractCols
	row := tx.QueryRow(ctx, q,
		c.ThreadID, string(c.Direction), c.RemoteBankCode, c.RemoteThreadID,
		c.RemoteUserRef, c.RemoteDisplayName, c.RemoteAccountRef,
		c.LocalUserID, string(c.LocalUserKind), c.LocalAccountID, string(c.LocalRole),
		c.SecurityID, c.SecurityTicker, c.SellerHoldingID,
		c.Quantity, c.StrikePrice, c.PremiumPaid, string(c.Currency), c.SettlementDate,
		string(c.AcceptedBySide), string(c.Status), c.PremiumOpID,
	)
	out, err := scanExternalOTCContract(row)
	if err != nil {
		return nil, apperr.Internal("insert external otc contract", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCContract(ctx context.Context, id string) (*domain.ExternalOTCContract, error) {
	const q = `select ` + externalOTCContractCols + ` from "trading".external_otc_contracts where id = $1`
	out, err := scanExternalOTCContract(s.Pool.QueryRow(ctx, q, id))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("get external otc contract", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCContractByThread(ctx context.Context, threadID string) (*domain.ExternalOTCContract, error) {
	const q = `select ` + externalOTCContractCols + ` from "trading".external_otc_contracts where thread_id = $1`
	out, err := scanExternalOTCContract(s.Pool.QueryRow(ctx, q, threadID))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("get external otc contract by thread", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCContractByRemoteThreadForUpdate(ctx context.Context, tx pgx.Tx, remoteBankCode, remoteThreadID string) (*domain.ExternalOTCContract, error) {
	const q = `select ` + externalOTCContractCols + `
        from "trading".external_otc_contracts
        where remote_bank_code = $1 and remote_thread_id = $2
        for update`
	out, err := scanExternalOTCContract(tx.QueryRow(ctx, q, remoteBankCode, remoteThreadID))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("lock external otc contract by remote thread", err)
	}
	return out, nil
}

func (s *Store) GetExternalOTCContractForUpdate(ctx context.Context, tx pgx.Tx, id string) (*domain.ExternalOTCContract, error) {
	const q = `select ` + externalOTCContractCols + ` from "trading".external_otc_contracts where id = $1 for update`
	out, err := scanExternalOTCContract(tx.QueryRow(ctx, q, id))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("lock external otc contract", err)
	}
	return out, nil
}

func (s *Store) ListExternalOTCContracts(ctx context.Context, localUserID string, status domain.ExternalOTCContractStatus) ([]*domain.ExternalOTCContract, error) {
	q := `select ` + externalOTCContractCols + ` from "trading".external_otc_contracts where local_user_id = $1`
	args := []any{localUserID}
	if status != "" {
		q += ` and status = $2`
		args = append(args, string(status))
	}
	q += ` order by created_at desc`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, apperr.Internal("list external otc contracts", err)
	}
	defer rows.Close()
	var out []*domain.ExternalOTCContract
	for rows.Next() {
		c, err := scanExternalOTCContract(rows)
		if err != nil {
			return nil, apperr.Internal("scan external otc contract", err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Internal("list external otc contracts rows", err)
	}
	return out, nil
}

func (s *Store) ListExpiredExternalOTCContracts(ctx context.Context, before time.Time) ([]*domain.ExternalOTCContract, error) {
	const q = `select ` + externalOTCContractCols + `
        from "trading".external_otc_contracts
        where status = 'active' and settlement_date < $1
        order by settlement_date`
	rows, err := s.Pool.Query(ctx, q, before)
	if err != nil {
		return nil, apperr.Internal("list expired external otc contracts", err)
	}
	defer rows.Close()
	var out []*domain.ExternalOTCContract
	for rows.Next() {
		c, err := scanExternalOTCContract(rows)
		if err != nil {
			return nil, apperr.Internal("scan expired external otc contract", err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Internal("list expired external otc contracts rows", err)
	}
	return out, nil
}

func (s *Store) MarkExternalOTCContractStatus(ctx context.Context, tx pgx.Tx, id string, status domain.ExternalOTCContractStatus) (*domain.ExternalOTCContract, error) {
	const q = `
        update "trading".external_otc_contracts
        set status = $2, updated_at = now()
        where id = $1
        returning ` + externalOTCContractCols
	out, err := scanExternalOTCContract(tx.QueryRow(ctx, q, id, string(status)))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("mark external otc contract status", err)
	}
	return out, nil
}

func (s *Store) MarkExternalOTCContractExercised(ctx context.Context, tx pgx.Tx, id, exerciseOpID string, exercisedAt time.Time) (*domain.ExternalOTCContract, error) {
	const q = `
        update "trading".external_otc_contracts
        set status = 'exercised',
            exercise_op_id = $2,
            exercised_at = $3,
            updated_at = now()
        where id = $1
        returning ` + externalOTCContractCols
	out, err := scanExternalOTCContract(tx.QueryRow(ctx, q, id, exerciseOpID, exercisedAt))
	if err != nil {
		if noRows(err) {
			return nil, apperr.NotFound("external OTC contract not found")
		}
		return nil, apperr.Internal("mark external otc contract exercised", err)
	}
	return out, nil
}
