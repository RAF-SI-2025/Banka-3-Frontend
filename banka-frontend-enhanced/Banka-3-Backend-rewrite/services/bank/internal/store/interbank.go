package store

import (
	"context"

	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/apperr"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/bank/internal/domain"
	"github.com/jackc/pgx/v5"
)

const interbankPaymentCols = `
    id, transaction_id, from_account_id, to_account_number,
    amount::text, currency, recipient_name, payment_code,
    reference_number, purpose, coalesce(reservation_id::text, ''),
    status, coalesce(final_amount::text, ''), coalesce(final_currency, ''),
    coalesce(exchange_rate, ''), coalesce(commission, ''),
    remote_bank_url, coalesce(last_error, ''), created_at, updated_at
`

func scanInterbankPayment(row interface{ Scan(...any) error }) (*domain.InterbankPayment, error) {
	var p domain.InterbankPayment
	var status, currency, finalCurrency string
	if err := row.Scan(
		&p.ID, &p.TransactionID, &p.FromAccountID, &p.ToAccountNumber,
		&p.Amount, &currency, &p.RecipientName, &p.PaymentCode,
		&p.ReferenceNumber, &p.Purpose, &p.ReservationID,
		&status, &p.FinalAmount, &finalCurrency,
		&p.ExchangeRate, &p.Commission,
		&p.RemoteBankURL, &p.LastError, &p.CreatedAt, &p.UpdatedAt,
	); err != nil {
		return nil, err
	}
	p.Currency = domain.Currency(currency)
	p.FinalCurrency = domain.Currency(finalCurrency)
	p.Status = domain.InterbankPaymentStatus(status)
	return &p, nil
}

func (s *Store) UpsertInterbankPayment(ctx context.Context, p *domain.InterbankPayment) (*domain.InterbankPayment, error) {
	const q = `
        insert into bank.interbank_payments (
            transaction_id, from_account_id, to_account_number, amount,
            currency, recipient_name, payment_code, reference_number,
            purpose, remote_bank_url
        ) values (
            $1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, $10
        )
        on conflict (transaction_id) do update set
            updated_at = now()
        returning ` + interbankPaymentCols
	out, err := scanInterbankPayment(s.Pool.QueryRow(ctx, q,
		p.TransactionID, p.FromAccountID, p.ToAccountNumber, p.Amount,
		string(p.Currency), p.RecipientName, p.PaymentCode, p.ReferenceNumber,
		p.Purpose, p.RemoteBankURL,
	))
	if err != nil {
		return nil, apperr.Internal("upsert interbank payment", err)
	}
	return out, nil
}

func (s *Store) SetInterbankReservation(ctx context.Context, transactionID, reservationID string) error {
	_, err := s.Pool.Exec(ctx, `
        update bank.interbank_payments
        set reservation_id = $2::uuid, updated_at = now()
        where transaction_id = $1`,
		transactionID, reservationID,
	)
	if err != nil {
		return apperr.Internal("set interbank reservation", err)
	}
	return nil
}

func (s *Store) MarkInterbankPreparedTx(ctx context.Context, tx pgx.Tx, transactionID, finalAmount, finalCurrency, exchangeRate, commission string) error {
	_, err := tx.Exec(ctx, `
        update bank.interbank_payments
        set status = 'prepared',
            final_amount = $2::numeric,
            final_currency = $3,
            exchange_rate = $4,
            commission = $5,
            last_error = null,
            updated_at = now()
        where transaction_id = $1`,
		transactionID, finalAmount, finalCurrency, exchangeRate, commission,
	)
	if err != nil {
		return apperr.Internal("mark interbank prepared", err)
	}
	return nil
}

func (s *Store) MarkInterbankCommitted(ctx context.Context, transactionID string) error {
	_, err := s.Pool.Exec(ctx, `
        update bank.interbank_payments
        set status = 'committed', last_error = null, updated_at = now()
        where transaction_id = $1`,
		transactionID,
	)
	if err != nil {
		return apperr.Internal("mark interbank committed", err)
	}
	return nil
}

func (s *Store) MarkInterbankFailed(ctx context.Context, transactionID, lastError string) error {
	_, err := s.Pool.Exec(ctx, `
        update bank.interbank_payments
        set status = 'failed', last_error = $2, updated_at = now()
        where transaction_id = $1`,
		transactionID, lastError,
	)
	if err != nil {
		return apperr.Internal("mark interbank failed", err)
	}
	return nil
}

func (s *Store) RememberInterbankCommitError(ctx context.Context, transactionID, lastError string) error {
	_, err := s.Pool.Exec(ctx, `
        update bank.interbank_payments
        set status = 'prepared', last_error = $2, updated_at = now()
        where transaction_id = $1`,
		transactionID, lastError,
	)
	if err != nil {
		return apperr.Internal("remember interbank commit error", err)
	}
	return nil
}

func (s *Store) ListRecoverableInterbankPayments(ctx context.Context, limit int) ([]*domain.InterbankPayment, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.Pool.Query(ctx, `
        select `+interbankPaymentCols+`
        from bank.interbank_payments
        where status = 'prepared'
        order by updated_at
        limit $1`, limit)
	if err != nil {
		return nil, apperr.Internal("list recoverable interbank payments", err)
	}
	defer rows.Close()
	var out []*domain.InterbankPayment
	for rows.Next() {
		p, err := scanInterbankPayment(rows)
		if err != nil {
			return nil, apperr.Internal("scan interbank payment", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ReserveFundsForInterbank creates a held reservation against
// available_balance for a cross-bank payment (c5). Returns the
// reservation ID. Idempotent on opID — a retry returns the existing ID.
//
// Unlike the SAGA-oriented ReserveFunds, this path uses op_kind
// 'interbank_payment' and does not require the caller to be an internal
// actor (the bank service itself drives it from CreateInterbankPayment).
func (s *Store) ReserveFundsForInterbank(ctx context.Context, accountID, amount, currency, opID string) (string, error) {
	// Idempotent: return existing reservation ID if already created.
	var existing string
	err := s.Pool.QueryRow(ctx,
		`SELECT id FROM bank.reservations WHERE op_id = $1 LIMIT 1`,
		opID,
	).Scan(&existing)
	if err == nil {
		return existing, nil
	}
	if err != pgx.ErrNoRows {
		return "", err
	}

	var id string
	err = s.Pool.QueryRow(ctx, `
		WITH deduct AS (
			UPDATE bank.accounts
			SET    available_balance = available_balance - $2::numeric
			WHERE  id = $1
			  AND  available_balance >= $2::numeric
			RETURNING id
		)
		INSERT INTO bank.reservations (account_id, op_id, amount, currency, state, op_kind)
		SELECT $1, $3, $2, $4, 'held', 'interbank_payment'
		FROM   deduct
		RETURNING id`,
		accountID, amount, opID, currency,
	).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", ErrInsufficientFunds
	}
	return id, err
}

// ReleaseInterbankReservation marks a held interbank reservation as
// released and restores the available_balance. No-op if already released.
func (s *Store) ReleaseInterbankReservation(ctx context.Context, reservationID, opID string) error {
	_, err := s.Pool.Exec(ctx, `
		WITH mark AS (
			UPDATE bank.reservations
			SET    state = 'released', settled_at = now()
			WHERE  id = $1 AND state = 'held'
			RETURNING account_id, amount
		)
		UPDATE bank.accounts a
		SET    available_balance = a.available_balance + m.amount
		FROM   mark m
		WHERE  a.id = m.account_id`,
		reservationID,
	)
	return err
}
