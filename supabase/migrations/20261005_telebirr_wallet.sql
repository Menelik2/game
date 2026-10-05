create table if not exists telebirr_config (
  id int primary key default 1,
  merchant_name text not null default 'Menelik',
  merchant_phone text not null default '0977832379',
  environment text not null default 'sandbox',
  enabled boolean not null default true,
  min_deposit numeric(12,2) not null default 10,
  max_deposit numeric(12,2) not null default 50000,
  updated_at timestamptz not null default now()
);
insert into telebirr_config (id) values (1) on conflict (id) do nothing;
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  currency text not null default 'ETB',
  balance numeric(14,2) not null default 0,
  withdrawable_balance numeric(14,2) not null default 0,
  locked_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null default 'telebirr',
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ETB',
  merchant_order_id text not null unique,
  provider_transaction_id text,
  transaction_number text,
  status text not null default 'PENDING',
  verification_attempts int not null default 0,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index if not exists deposits_provider_txn_uidx on deposits (provider, provider_transaction_id) where provider_transaction_id is not null;
create unique index if not exists deposits_txn_number_uidx on deposits (provider, transaction_number) where transaction_number is not null;
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  wallet_id uuid,
  type text not null,
  status text not null,
  payment_method text,
  amount numeric(14,2) not null,
  currency text not null default 'ETB',
  balance_before numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  external_transaction_id text,
  merchant_order_id text,
  transaction_number text,
  description text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create table if not exists payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text,
  event_type text,
  payload_hash text not null,
  signature_valid boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists payment_webhooks_event_uidx on payment_webhooks (provider, event_id) where event_id is not null;
