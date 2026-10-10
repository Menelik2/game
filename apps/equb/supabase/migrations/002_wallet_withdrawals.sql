-- Player withdrawals (paid out via merchant Telebirr by admin)
create table if not exists public.wallet_withdrawals (
  id uuid primary key,
  user_id text not null,
  user_name text not null default '',
  user_phone text not null default '',
  amount numeric(18, 2) not null,
  currency text not null default 'ETB',
  payout_phone text not null,
  status text not null default 'PENDING',
  admin_note text,
  paid_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists wallet_withdrawals_user_idx
  on public.wallet_withdrawals (user_id);
create index if not exists wallet_withdrawals_status_idx
  on public.wallet_withdrawals (status);
create index if not exists wallet_withdrawals_created_idx
  on public.wallet_withdrawals (created_at desc);

alter table public.wallet_withdrawals enable row level security;

grant all on public.wallet_withdrawals to service_role;
