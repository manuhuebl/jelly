create table if not exists public.planner_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

drop policy if exists "planner_state_read" on public.planner_state;
drop policy if exists "planner_state_write" on public.planner_state;

create policy "planner_state_read"
on public.planner_state
for select
to anon
using (true);

create policy "planner_state_write"
on public.planner_state
for all
to anon
using (true)
with check (true);
