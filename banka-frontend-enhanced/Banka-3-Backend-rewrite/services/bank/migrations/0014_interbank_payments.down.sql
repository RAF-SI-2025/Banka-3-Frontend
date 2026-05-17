drop table if exists bank.interbank_payments;

-- Restore op_kind constraint to 0012 state (without interbank_payment).
alter table bank.transactions
    drop constraint if exists transactions_op_kind_check;

alter table bank.transactions
    add constraint transactions_op_kind_check
        check (op_kind in (
            'payment','transfer','exchange','fee',
            'loan_disbursement','loan_installment',
            'trade','tax','forex_fill',
            'otc_premium','otc_exercise','fund_invest','fund_withdraw'
        ));
