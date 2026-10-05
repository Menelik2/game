create table if not exists equb_live_rooms (
  template_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table equb_live_rooms enable row level security;
drop policy if exists equb_live_read on equb_live_rooms;
create policy equb_live_read on equb_live_rooms for select using (true);
drop policy if exists equb_live_write on equb_live_rooms;
create policy equb_live_write on equb_live_rooms for all using (true) with check (true);
