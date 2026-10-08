-- Fast Equb full schema — run once in Supabase SQL Editor
-- Supports 500+ registered users with shared multiplayer rooms

create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  password_hash text not null,
  balance numeric(14, 2) not null default 100,
  referral_code text not null unique,
  role text not null default 'player',
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_phone_idx on public.app_users (phone);
create index if not exists app_users_role_idx on public.app_users (role);

-- Telebirr deposits
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
  on public.wallet_deposits for all using (true) with check (true);

-- Shared multiplayer (all users see same room state)
create table if not exists public.equb_live_rooms (
  template_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists equb_live_rooms_updated_idx
  on public.equb_live_rooms (updated_at desc);

alter table public.equb_live_rooms enable row level security;
drop policy if exists "service all equb_live_rooms" on public.equb_live_rooms;
create policy "service all equb_live_rooms"
  on public.equb_live_rooms for all using (true) with check (true);

create table if not exists public.equb_round_history (
  id text primary key,
  template_id text not null,
  group_size int not null,
  prize_pool numeric(14, 2) not null,
  winning_number int,
  winner_id uuid,
  winner_name text,
  player_count int not null default 0,
  admin_fee numeric(14, 2) default 0,
  winner_payout numeric(14, 2) default 0,
  created_at timestamptz not null default now()
);

create index if not exists equb_round_history_template_idx on public.equb_round_history (template_id);
create index if not exists equb_round_history_created_idx on public.equb_round_history (created_at desc);

alter table public.equb_round_history enable row level security;
drop policy if exists "service all equb_round_history" on public.equb_round_history;
create policy "service all equb_round_history"
  on public.equb_round_history for all using (true) with check (true);

create or replace function public.app_register(
  p_full_name text,
  p_phone text,
  p_password_hash text
)
returns json
language plpgsql
security definer
as $$
declare
  v_row public.app_users%rowtype;
  v_code text;
begin
  if exists (select 1 from public.app_users where phone = p_phone) then
    raise exception 'phone_exists';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.app_users (full_name, phone, password_hash, balance, referral_code, role)
  values (p_full_name, p_phone, p_password_hash, 100, v_code, 'player')
  returning * into v_row;
  return json_build_object(
    'id', v_row.id,
    'full_name', v_row.full_name,
    'phone', v_row.phone,
    'balance', v_row.balance,
    'referral_code', v_row.referral_code,
    'role', v_row.role,
    'banned', v_row.banned
  );
end;
$$;

create or replace function public.app_login(
  p_phone text,
  p_password_hash text
)
returns json
language plpgsql
security definer
as $$
declare
  v_row public.app_users%rowtype;
begin
  select * into v_row
  from public.app_users
  where phone = p_phone and password_hash = p_password_hash
  limit 1;
  if not found then
    return null;
  end if;
  if v_row.banned then
    raise exception 'account_banned';
  end if;
  return json_build_object(
    'id', v_row.id,
    'full_name', v_row.full_name,
    'phone', v_row.phone,
    'balance', v_row.balance,
    'referral_code', v_row.referral_code,
    'role', v_row.role,
    'banned', v_row.banned
  );
end;
$$;

alter table public.app_users enable row level security;
drop policy if exists "service all app_users" on public.app_users;
create policy "service all app_users"
  on public.app_users for all using (true) with check (true);
