-- Run this in Supabase: Dashboard > SQL Editor > New query > paste > Run
create table if not exists public.trips (
  id text primary key,
  created_at timestamptz not null default now(),
  data jsonb not null
);

-- College demo: keep it simple (no login). Allow the API key to read/write.
alter table public.trips enable row level security;
create policy "demo full access" on public.trips
  for all using (true) with check (true);
