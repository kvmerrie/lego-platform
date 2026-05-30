create table if not exists public.collection_page_snapshots (
  collection_slug text not null,
  sort_key text not null,
  page integer not null check (page > 0),
  page_size integer not null check (page_size > 0),
  total_count integer not null default 0 check (total_count >= 0),
  items_json jsonb not null default '[]'::jsonb,
  source_version text null,
  snapshot_source text not null default 'collection_snapshot_sync',
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (collection_slug, sort_key, page, page_size)
);

create index if not exists collection_page_snapshots_generated_idx
on public.collection_page_snapshots (generated_at desc);

drop trigger if exists set_collection_page_snapshots_updated_at
on public.collection_page_snapshots;
create trigger set_collection_page_snapshots_updated_at
before update on public.collection_page_snapshots
for each row
execute function public.set_updated_at();

alter table public.collection_page_snapshots enable row level security;

drop policy if exists "collection_page_snapshots_select_public"
on public.collection_page_snapshots;
create policy "collection_page_snapshots_select_public"
on public.collection_page_snapshots
for select
to anon, authenticated
using (
  collection_slug in (
    'nieuwe-lego-sets',
    'retiring-lego-sets',
    'lego-sets-onder-50-euro'
  )
);

drop policy if exists "collection_page_snapshots_service_role_all"
on public.collection_page_snapshots;
create policy "collection_page_snapshots_service_role_all"
on public.collection_page_snapshots
for all
to service_role
using (true)
with check (true);
