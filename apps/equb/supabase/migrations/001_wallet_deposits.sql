-- Migration: wallet_deposits
-- Run in Supabase → SQL Editor if table is missing

create table if not exists public.wallet_deposits (
  id uuid primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null default 'ETB',
  status text not null default 'PENDING',
  merchant_order_id text not null,
  transaction_number text,
  provider_transaction_id text,
  checkout_url text,
  failure_reason text,
  verification_attempts int not null default 0,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  admin_note text
);

create index if not exists wallet_deposits_user_idx on public.wallet_deposits (user_id);
create index if not exists wallet_deposits_status_idx on public.wallet_deposits (status);
create index if not exists wallet_deposits_txn_idx on public.wallet_deposits (transaction_number);

alter table public.wallet_deposits enable row level security;

drop policy if exists "service all wallet_deposits" on public.wallet_deposits;
create policy "service all wallet_deposits"
  on public.wallet_deposits
  for all
  using (true)
  with check (true);
