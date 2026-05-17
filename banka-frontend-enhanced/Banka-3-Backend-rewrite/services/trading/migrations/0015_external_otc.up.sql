-- Celina 5: cross-bank OTC negotiation state.
--
-- The existing otc_offers / otc_contracts tables intentionally model
-- local-local negotiations: both parties are local UUID users with local
-- bank account IDs. Cross-bank OTC needs to remember one local party and
-- one remote party without inventing fake local users, so it lives in a
-- separate aggregate.

create table "trading".external_otc_threads (
    id                  uuid primary key default gen_random_uuid(),

    -- inbound: remote buyer/seller contacted this bank.
    -- outbound: local user contacted a remote bank.
    direction           text not null check (direction in ('inbound','outbound')),

    remote_bank_code    text not null,
    remote_thread_id    text,
    remote_user_ref     text not null default '',
    remote_display_name text not null default '',
    remote_account_ref  text not null default '',

    local_user_id       uuid not null,
    local_user_kind     text not null check (local_user_kind in ('client','employee')),
    local_account_id    uuid not null,
    local_role          text not null check (local_role in ('buyer','seller')),

    security_id         uuid not null references "trading".securities(id) on delete restrict,
    security_ticker     text not null,
    seller_holding_id   uuid references "trading".portfolio_holdings(id) on delete restrict,

    quantity            integer       not null check (quantity > 0),
    price_per_unit      numeric(20,4) not null check (price_per_unit >= 0),
    premium             numeric(20,4) not null check (premium >= 0),
    currency            text          not null,
    settlement_date     date          not null,

    modified_by_side    text not null check (modified_by_side in ('local','remote')),
    status              text not null check (status in ('open','accepted','withdrawn','expired')),

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create unique index external_otc_threads_remote_unique
    on "trading".external_otc_threads (remote_bank_code, remote_thread_id)
    where remote_thread_id is not null and remote_thread_id <> '';

create index external_otc_threads_local_idx
    on "trading".external_otc_threads (local_user_id, status);

create index external_otc_threads_remote_bank_idx
    on "trading".external_otc_threads (remote_bank_code, status);

create table "trading".external_otc_iterations (
    id                  uuid primary key default gen_random_uuid(),
    thread_id           uuid not null references "trading".external_otc_threads(id) on delete cascade,
    proposed_by_side    text not null check (proposed_by_side in ('local','remote')),
    quantity            integer       not null check (quantity > 0),
    price_per_unit      numeric(20,4) not null check (price_per_unit >= 0),
    premium             numeric(20,4) not null check (premium >= 0),
    settlement_date     date          not null,
    created_at          timestamptz not null default now()
);

create index external_otc_iterations_thread_idx
    on "trading".external_otc_iterations (thread_id, created_at);

create table "trading".external_otc_contracts (
    id                  uuid primary key default gen_random_uuid(),
    thread_id           uuid not null unique references "trading".external_otc_threads(id) on delete restrict,

    direction           text not null check (direction in ('inbound','outbound')),
    remote_bank_code    text not null,
    remote_thread_id    text not null default '',
    remote_user_ref     text not null default '',
    remote_display_name text not null default '',
    remote_account_ref  text not null default '',

    local_user_id       uuid not null,
    local_user_kind     text not null check (local_user_kind in ('client','employee')),
    local_account_id    uuid not null,
    local_role          text not null check (local_role in ('buyer','seller')),

    security_id         uuid not null references "trading".securities(id) on delete restrict,
    security_ticker     text not null,
    seller_holding_id   uuid references "trading".portfolio_holdings(id) on delete restrict,

    quantity            integer       not null check (quantity > 0),
    strike_price        numeric(20,4) not null check (strike_price >= 0),
    premium_paid        numeric(20,4) not null check (premium_paid >= 0),
    currency            text          not null,
    settlement_date     date          not null,

    accepted_by_side    text not null check (accepted_by_side in ('local','remote')),
    status              text not null check (status in ('active','exercised','expired')),
    premium_op_id       text not null default '',
    exercise_op_id      text not null default '',
    exercised_at        timestamptz,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index external_otc_contracts_local_idx
    on "trading".external_otc_contracts (local_user_id, status);

create index external_otc_contracts_remote_bank_idx
    on "trading".external_otc_contracts (remote_bank_code, status);

create index external_otc_contracts_expiry_idx
    on "trading".external_otc_contracts (settlement_date) where status = 'active';
