create table if not exists public.catalog_user_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('set_view', 'offer_click', 'catalog_set_click')
  ),
  set_num text null,
  merchant_slug text null,
  session_id text not null,
  page_path text null,
  created_at timestamptz not null default now(),
  metadata jsonb null,
  constraint catalog_user_events_set_view_set_num_required check (
    event_type <> 'set_view' or set_num is not null
  ),
  constraint catalog_user_events_metadata_size check (
    metadata is null or octet_length(metadata::text) <= 2048
  )
);

comment on table public.catalog_user_events is
  'Anonymous catalog interaction events. Raw retention target: 30-90 days. Do not store PII, user IDs, IP addresses, user agents, or account links.';

comment on column public.catalog_user_events.session_id is
  'Anonymous browser-local session id; not linked to an account.';

comment on column public.catalog_user_events.metadata is
  'Small allowlisted event context only. No PII.';

create index if not exists catalog_user_events_created_at_idx
  on public.catalog_user_events (created_at desc);

create index if not exists catalog_user_events_event_type_created_at_idx
  on public.catalog_user_events (event_type, created_at desc);

create index if not exists catalog_user_events_set_num_created_at_idx
  on public.catalog_user_events (set_num, created_at desc);

create index if not exists catalog_user_events_merchant_slug_created_at_idx
  on public.catalog_user_events (merchant_slug, created_at desc);

alter table public.catalog_user_events enable row level security;

drop policy if exists "Only service role can insert catalog user events"
  on public.catalog_user_events;

create policy "Only service role can insert catalog user events"
  on public.catalog_user_events
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Only service role can read catalog user events"
  on public.catalog_user_events;

create policy "Only service role can read catalog user events"
  on public.catalog_user_events
  for select
  using (auth.role() = 'service_role');
