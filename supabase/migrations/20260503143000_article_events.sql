create table if not exists public.article_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  event_name text not null check (event_name in ('article_click', 'set_click')),
  created_at timestamptz not null default now()
);

create index if not exists article_events_event_created_slug_idx
  on public.article_events (event_name, created_at desc, slug);

alter table public.article_events enable row level security;

drop policy if exists "Only service role can insert article events" on public.article_events;

create policy "Only service role can insert article events"
  on public.article_events
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Only service role can read article events" on public.article_events;

create policy "Only service role can read article events"
  on public.article_events
  for select
  using (auth.role() = 'service_role');
