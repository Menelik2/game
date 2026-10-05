-- Phone/password app users + balances (demo virtual Birr)
create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  password_hash text not null,
  balance numeric(18, 2) not null default 5000 check (balance >= 0),
  referral_code text not null unique,
  role text not null default 'player' check (role in ('player', 'admin', 'support')),
  banned boolean not null default false,
  referred_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_phone_idx on public.app_users (phone);

create table if not exists public.app_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  entry_type text not null,
  amount numeric(18, 2) not null,
  balance_after numeric(18, 2) not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_ledger enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on public.app_users to service_role;
grant all on public.app_ledger to service_role;

create or replace function public.app_register(p_full_name text, p_phone text, p_password_hash text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_row public.app_users%rowtype;
begin
  if length(trim(p_full_name)) < 2 then raise exception 'FULL_NAME_REQUIRED'; end if;
  if p_phone is null or length(p_phone) < 8 then raise exception 'PHONE_INVALID'; end if;
  if exists(select 1 from public.app_users where phone = p_phone) then raise exception 'PHONE_EXISTS'; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.app_users (full_name, phone, password_hash, balance, referral_code, role)
  values (trim(p_full_name), p_phone, p_password_hash, 5000, v_code, 'player') returning * into v_row;
  insert into public.app_ledger (user_id, entry_type, amount, balance_after, reason)
  values (v_row.id, 'seed', 5000, 5000, 'registration');
  return json_build_object('id', v_row.id, 'fullName', v_row.full_name, 'phone', v_row.phone, 'balance', v_row.balance, 'referralCode', v_row.referral_code, 'role', v_row.role);
end; $$;

create or replace function public.app_login(p_phone text, p_password_hash text)
returns json language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype;
begin
  select * into v_row from public.app_users where phone = p_phone;
  if not found then raise exception 'INVALID_CREDENTIALS'; end if;
  if v_row.banned then raise exception 'BANNED'; end if;
  if v_row.password_hash is distinct from p_password_hash then raise exception 'INVALID_CREDENTIALS'; end if;
  return json_build_object('id', v_row.id, 'fullName', v_row.full_name, 'phone', v_row.phone, 'balance', v_row.balance, 'referralCode', v_row.referral_code, 'role', v_row.role, 'banned', v_row.banned);
end; $$;

create or replace function public.app_get_user(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype;
begin
  select * into v_row from public.app_users where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return json_build_object('id', v_row.id, 'fullName', v_row.full_name, 'phone', v_row.phone, 'balance', v_row.balance, 'referralCode', v_row.referral_code, 'role', v_row.role, 'banned', v_row.banned);
end; $$;

create or replace function public.app_set_balance(p_id uuid, p_balance numeric, p_reason text default 'admin_adjust')
returns json language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype; v_delta numeric;
begin
  if p_balance < 0 then raise exception 'INVALID_BALANCE'; end if;
  select * into v_row from public.app_users where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_delta := p_balance - v_row.balance;
  update public.app_users set balance = p_balance, updated_at = now() where id = p_id returning * into v_row;
  insert into public.app_ledger (user_id, entry_type, amount, balance_after, reason) values (p_id, 'admin_adjust', v_delta, p_balance, p_reason);
  return json_build_object('id', v_row.id, 'balance', v_row.balance, 'fullName', v_row.full_name, 'phone', v_row.phone);
end; $$;

create or replace function public.app_adjust_balance(p_id uuid, p_delta numeric, p_reason text default 'adjust')
returns json language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype; v_next numeric;
begin
  select * into v_row from public.app_users where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_next := v_row.balance + p_delta;
  if v_next < 0 then raise exception 'INSUFFICIENT'; end if;
  update public.app_users set balance = v_next, updated_at = now() where id = p_id returning * into v_row;
  insert into public.app_ledger (user_id, entry_type, amount, balance_after, reason)
  values (p_id, case when p_delta < 0 then 'join_fee' else 'prize_win' end, p_delta, v_next, p_reason);
  return json_build_object('id', v_row.id, 'balance', v_row.balance);
end; $$;

create or replace function public.app_list_users()
returns json language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select json_agg(json_build_object('id', id, 'fullName', full_name, 'phone', phone, 'balance', balance, 'role', role, 'banned', banned, 'referralCode', referral_code, 'createdAt', created_at) order by created_at desc) from public.app_users), '[]'::json);
end; $$;

create or replace function public.app_ensure_admin(p_phone text, p_password_hash text, p_full_name text default 'Admin')
returns json language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype;
begin
  select * into v_row from public.app_users where role = 'admin' limit 1;
  if found then return json_build_object('id', v_row.id, 'phone', v_row.phone, 'exists', true); end if;
  insert into public.app_users (full_name, phone, password_hash, balance, referral_code, role)
  values (p_full_name, p_phone, p_password_hash, 1000000, 'ADMIN001', 'admin') returning * into v_row;
  return json_build_object('id', v_row.id, 'phone', v_row.phone, 'exists', false);
end; $$;

grant execute on function public.app_register(text, text, text) to anon, authenticated, service_role;
grant execute on function public.app_login(text, text) to anon, authenticated, service_role;
grant execute on function public.app_get_user(uuid) to anon, authenticated, service_role;
grant execute on function public.app_set_balance(uuid, numeric, text) to service_role, authenticated;
grant execute on function public.app_adjust_balance(uuid, numeric, text) to service_role, authenticated;
grant execute on function public.app_list_users() to service_role, authenticated;
grant execute on function public.app_ensure_admin(text, text, text) to anon, authenticated, service_role;
