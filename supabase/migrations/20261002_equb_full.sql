-- Fast Equb full Supabase schema (demo virtual Birr)
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar_url text,
  referral_code text unique not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  referred_by uuid references public.profiles(id),
  role text not null default 'player' check (role in ('player', 'admin', 'support')),
  is_self_excluded boolean not null default false,
  self_excluded_until timestamptz,
  date_of_birth date,
  country_code char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'ETB_VIRTUAL',
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  locked_balance numeric(18, 2) not null default 0 check (locked_balance >= 0),
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  entry_type text not null check (entry_type in (
    'seed', 'join_fee', 'prize_win', 'referral_bonus', 'admin_adjust', 'refund'
  )),
  amount numeric(18, 2) not null,
  balance_after numeric(18, 2) not null,
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_user_created_idx on public.ledger_entries (user_id, created_at desc);

create table if not exists public.equb_templates (
  id text primary key,
  group_size int not null check (group_size between 5 and 100),
  prize_pool numeric(18, 2) not null check (prize_pool > 0),
  contribution numeric(18, 2) not null check (contribution > 0),
  tier text not null default 'entry',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.equb_rounds (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.equb_templates(id),
  group_size int not null,
  prize_pool numeric(18, 2) not null,
  contribution numeric(18, 2) not null,
  status text not null default 'open'
    check (status in ('open', 'drawing', 'completed', 'cancelled')),
  seats_taken int not null default 0,
  winning_number int,
  winner_user_id uuid references public.profiles(id),
  entropy_hex text,
  commitment_hash text,
  draw_at timestamptz not null default (now() + interval '60 seconds'),
  drawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equb_rounds_open_idx
  on public.equb_rounds (template_id, status) where status = 'open';

create table if not exists public.equb_seats (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.equb_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  display_name text not null,
  pick_number int not null check (pick_number >= 1),
  fee_paid numeric(18, 2) not null,
  joined_at timestamptz not null default now(),
  unique (round_id, user_id),
  unique (round_id, pick_number)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists wallets_updated on public.wallets;
create trigger wallets_updated before update on public.wallets
  for each row execute function public.set_updated_at();
drop trigger if exists equb_rounds_updated on public.equb_rounds;
create trigger equb_rounds_updated before update on public.equb_rounds
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare seed_amount numeric(18,2) := 5000; wid uuid;
begin
  insert into public.profiles (id, display_name) values (
    new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Player'));
  insert into public.wallets (user_id, balance) values (new.id, seed_amount) returning id into wid;
  insert into public.ledger_entries (wallet_id, user_id, entry_type, amount, balance_after, idempotency_key, meta)
  values (wid, new.id, 'seed', seed_amount, seed_amount, 'seed:' || new.id::text, '{"source":"signup"}'::jsonb);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.wallet_debit(
  p_user_id uuid, p_amount numeric, p_entry_type text, p_idempotency_key text,
  p_reference_type text default null, p_reference_id uuid default null, p_meta jsonb default '{}'::jsonb
) returns public.wallets language plpgsql security definer set search_path = public as $$
declare w public.wallets; existing uuid;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select id into existing from public.ledger_entries where idempotency_key = p_idempotency_key;
  if existing is not null then select * into w from public.wallets where user_id = p_user_id; return w; end if;
  select * into w from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'wallet not found'; end if;
  if w.balance < p_amount then raise exception 'insufficient balance'; end if;
  update public.wallets set balance = balance - p_amount, version = version + 1 where id = w.id returning * into w;
  insert into public.ledger_entries (wallet_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, idempotency_key, meta)
  values (w.id, p_user_id, p_entry_type, -p_amount, w.balance, p_reference_type, p_reference_id, p_idempotency_key, p_meta);
  return w;
end; $$;

create or replace function public.wallet_credit(
  p_user_id uuid, p_amount numeric, p_entry_type text, p_idempotency_key text,
  p_reference_type text default null, p_reference_id uuid default null, p_meta jsonb default '{}'::jsonb
) returns public.wallets language plpgsql security definer set search_path = public as $$
declare w public.wallets; existing uuid;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select id into existing from public.ledger_entries where idempotency_key = p_idempotency_key;
  if existing is not null then select * into w from public.wallets where user_id = p_user_id; return w; end if;
  select * into w from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'wallet not found'; end if;
  update public.wallets set balance = balance + p_amount, version = version + 1 where id = w.id returning * into w;
  insert into public.ledger_entries (wallet_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, idempotency_key, meta)
  values (w.id, p_user_id, p_entry_type, p_amount, w.balance, p_reference_type, p_reference_id, p_idempotency_key, p_meta);
  return w;
end; $$;

create or replace function public.equb_ensure_open_round(p_template_id text)
returns public.equb_rounds language plpgsql security definer set search_path = public as $$
declare t public.equb_templates; r public.equb_rounds;
begin
  select * into t from public.equb_templates where id = p_template_id and is_active;
  if not found then raise exception 'template not found'; end if;
  select * into r from public.equb_rounds where template_id = p_template_id and status = 'open' order by created_at desc limit 1;
  if found then return r; end if;
  insert into public.equb_rounds (template_id, group_size, prize_pool, contribution, draw_at)
  values (t.id, t.group_size, t.prize_pool, t.contribution, now() + interval '60 seconds') returning * into r;
  return r;
end; $$;

create or replace function public.equb_join_round(p_template_id text, p_pick int, p_display_name text default null)
returns public.equb_rounds language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.equb_rounds; prof public.profiles; fee numeric(18,2);
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into prof from public.profiles where id = uid;
  if prof.is_self_excluded then raise exception 'self-excluded'; end if;
  r := public.equb_ensure_open_round(p_template_id);
  fee := r.contribution;
  if p_pick < 1 or p_pick > r.group_size then raise exception 'invalid pick'; end if;
  if exists (select 1 from public.equb_seats where round_id = r.id and user_id = uid) then raise exception 'already joined this round'; end if;
  if exists (select 1 from public.equb_seats where round_id = r.id and pick_number = p_pick) then raise exception 'number taken'; end if;
  if (select count(*) from public.equb_seats where round_id = r.id) >= r.group_size then
    update public.equb_rounds set status = 'completed' where id = r.id and status = 'open';
    r := public.equb_ensure_open_round(p_template_id);
  end if;
  perform public.wallet_debit(uid, fee, 'join_fee', 'join:' || r.id::text || ':' || uid::text, 'equb_round', r.id, jsonb_build_object('pick', p_pick));
  insert into public.equb_seats (round_id, user_id, display_name, pick_number, fee_paid)
  values (r.id, uid, coalesce(nullif(trim(p_display_name), ''), prof.display_name), p_pick, fee);
  update public.equb_rounds set seats_taken = (select count(*) from public.equb_seats where round_id = r.id) where id = r.id returning * into r;
  return r;
end; $$;

create or replace function public.equb_draw_round(p_round_id uuid)
returns public.equb_rounds language plpgsql security definer set search_path = public as $$
declare r public.equb_rounds; entropy text; commitment text; win_num int; winner uuid; seat_count int; picks int[]; i int;
begin
  select * into r from public.equb_rounds where id = p_round_id for update;
  if not found then raise exception 'round not found'; end if;
  if r.status = 'completed' then return r; end if;
  select count(*) into seat_count from public.equb_seats where round_id = r.id;
  if seat_count < 2 then raise exception 'need at least 2 players'; end if;
  select array_agg(pick_number) into picks from public.equb_seats where round_id = r.id;
  entropy := encode(gen_random_bytes(32), 'hex');
  win_num := (get_byte(decode(substr(entropy, 1, 8), 'hex'), 0)::int + get_byte(decode(substr(entropy, 1, 8), 'hex'), 1)::int * 256) % r.group_size + 1;
  if not (win_num = any (picks)) then
    i := (get_byte(gen_random_bytes(1), 0) % array_length(picks, 1)) + 1;
    win_num := picks[i];
  end if;
  commitment := encode(digest(entropy || ':' || r.group_size::text || ':' || win_num::text, 'sha256'), 'hex');
  select user_id into winner from public.equb_seats where round_id = r.id and pick_number = win_num;
  update public.equb_rounds set status = 'completed', winning_number = win_num, winner_user_id = winner,
    entropy_hex = entropy, commitment_hash = commitment, drawn_at = now(), seats_taken = seat_count
  where id = r.id returning * into r;
  perform public.wallet_credit(winner, r.prize_pool, 'prize_win', 'win:' || r.id::text, 'equb_round', r.id, jsonb_build_object('winning_number', win_num));
  perform public.equb_ensure_open_round(r.template_id);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (winner, 'equb_draw', 'equb_round', r.id::text, jsonb_build_object('winning_number', win_num, 'prize', r.prize_pool));
  return r;
end; $$;

create or replace function public.equb_process_due_rounds()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; cnt int;
begin
  for r in select id from public.equb_rounds where status = 'open' and draw_at <= now() loop
    select count(*) into cnt from public.equb_seats where round_id = r.id;
    if cnt >= 2 then perform public.equb_draw_round(r.id); n := n + 1;
    else update public.equb_rounds set draw_at = now() + interval '60 seconds' where id = r.id; end if;
  end loop;
  return n;
end; $$;

do $$
declare sizes int[] := array[5,10,20,30,40,50,60,70,80,90,100];
  prizes numeric[] := array[500,1000,2000,3000,4000,5000,6000,7000,8000,9000];
  s int; p numeric; contrib numeric; tier text;
begin
  foreach s in array sizes loop
    foreach p in array prizes loop
      contrib := round((p / s)::numeric, 2);
      tier := case when p <= 500 then 'entry' when p < 10000 then 'low' else 'mid' end;
      insert into public.equb_templates (id, group_size, prize_pool, contribution, tier)
      values ('equb-' || s || '-' || p::int, s, p, contrib, tier)
      on conflict (id) do update set contribution = excluded.contribution, is_active = true;
    end loop;
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.equb_templates enable row level security;
alter table public.equb_rounds enable row level security;
alter table public.equb_seats enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
create policy wallets_select_own on public.wallets for select using (auth.uid() = user_id);
create policy ledger_select_own on public.ledger_entries for select using (auth.uid() = user_id);
create policy templates_read on public.equb_templates for select using (is_active);
create policy rounds_read on public.equb_rounds for select using (true);
create policy seats_read on public.equb_seats for select using (true);

grant usage on schema public to anon, authenticated;
grant select on public.equb_templates, public.equb_rounds, public.equb_seats to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.wallets, public.ledger_entries to authenticated;
grant execute on function public.equb_ensure_open_round(text) to authenticated;
grant execute on function public.equb_join_round(text, int, text) to authenticated;
grant execute on function public.equb_draw_round(uuid) to authenticated;
grant execute on function public.equb_process_due_rounds() to service_role;
