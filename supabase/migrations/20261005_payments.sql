create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  provider text not null,
  provider_ref text not null unique,
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null default 'ETB',
  status text not null default 'PENDING',
  direction text not null check (direction in ('deposit', 'withdrawal')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_tx_user_idx
  on public.payment_transactions (user_id, created_at desc);

alter table public.payment_transactions enable row level security;
grant all on public.payment_transactions to service_role;
