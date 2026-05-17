-- Inter-bank payment tracking table (c5, 2PC sender-side ledger).
create table bank.interbank_payments (
    id              uuid primary key default gen_random_uuid(),
    transaction_id  text not null unique,
    from_account_id uuid not null references bank.accounts(id),
    to_account_number text not null,
    amount          numeric(28,10) not null check (amount > 0),
    currency        text not null,
    recipient_name  text not null default '',
    payment_code    text not null default '289',
    reference_number text not null default '',
    purpose         text not null default '',
    reservation_id  uuid,
    status          text not null default 'pending'
                        check (status in ('pending','prepared','committed','failed','rolled_back')),
    final_amount    numeric(28,10),
    final_currency  text,
    exchange_rate   text,
    commission      text,
    remote_bank_url text not null default '',
    last_error      text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index interbank_payments_status_idx on bank.interbank_payments (status)
    where status in ('pending', 'prepared');

-- Extend op_kind to include 'interbank_payment' (c5).
alter table bank.transactions
    drop constraint if exists transactions_op_kind_check;

alter table bank.transactions
    add constraint transactions_op_kind_check
        check (op_kind in (
            'payment','transfer','exchange','fee',
            'loan_disbursement','loan_installment',
            'trade','tax','forex_fill',
            'otc_premium','otc_exercise','fund_invest','fund_withdraw',
            'interbank_payment'
        ));
