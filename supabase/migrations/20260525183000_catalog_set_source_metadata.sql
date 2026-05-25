create table if not exists public.catalog_set_source_metadata (
  catalog_set_id text not null references public.catalog_sets(set_id) on delete cascade,
  set_number text not null,
  source text not null,
  locale text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  match_confidence text not null,
  policy text not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (catalog_set_id, source, locale)
);

create index if not exists catalog_set_source_metadata_source_locale_idx
on public.catalog_set_source_metadata (source, locale, last_seen_at desc);

create index if not exists catalog_set_source_metadata_set_number_idx
on public.catalog_set_source_metadata (set_number);

drop trigger if exists set_catalog_set_source_metadata_updated_at
on public.catalog_set_source_metadata;
create trigger set_catalog_set_source_metadata_updated_at
before update on public.catalog_set_source_metadata
for each row
execute function public.set_updated_at();

alter table public.catalog_set_source_metadata enable row level security;

drop policy if exists "catalog_set_source_metadata_service_role_all"
on public.catalog_set_source_metadata;
create policy "catalog_set_source_metadata_service_role_all"
on public.catalog_set_source_metadata
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
