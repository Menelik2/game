-- Shared multiplayer rooms — required for 50–500+ concurrent players
-- Run in Supabase → SQL Editor

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
  on public.equb_live_rooms
  for all
  using (true)
  with check (true);

-- Optional: ledger of completed rounds for analytics
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

create index if not exists equb_round_history_template_idx
  on public.equb_round_history (template_id);
create index if not exists equb_round_history_created_idx
  on public.equb_round_history (created_at desc);

alter table public.equb_round_history enable row level security;
drop policy if exists "service all equb_round_history" on public.equb_round_history;
create policy "service all equb_round_history"
  on public.equb_round_history
  for all
  using (true)
  with check (true);
