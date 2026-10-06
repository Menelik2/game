-- Fast Equb — run once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste → Run

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

-- Optional RPCs used by the app
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
  v_id uuid;
  v_code text;
  v_row public.app_users%rowtype;
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

-- Allow service role full access; tighten RLS for anon if needed
alter table public.app_users enable row level security;

drop policy if exists "service all app_users" on public.app_users;
create policy "service all app_users"
  on public.app_users
  for all
  using (true)
  with check (true);
