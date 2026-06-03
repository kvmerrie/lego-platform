create table if not exists public.catalog_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  normalized_set_id text not null,
  source_set_number text not null,
  source text not null default 'rakuten-lego-eu',
  source_product_url text not null,
  source_product_title text null,
  source_image_url text null,
  source_price_minor integer null check (source_price_minor is null or source_price_minor > 0),
  source_currency_code text null,
  source_payload jsonb not null default '{}'::jsonb,
  rebrickable_payload jsonb null,
  brickset_payload jsonb null,
  evidence jsonb not null default '{}'::jsonb,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  confidence_score integer not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  required_fields_present boolean not null default false,
  auto_create_eligible boolean not null default false,
  status text not null default 'new' check (status in ('new', 'imported', 'ignored', 'rejected')),
  imported_set_id text null references public.catalog_sets(set_id) on delete set null,
  import_error text null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (normalized_set_id)
);

create index if not exists catalog_discovery_candidates_review_idx
on public.catalog_discovery_candidates (status, confidence, auto_create_eligible, last_seen_at desc);

create index if not exists catalog_discovery_candidates_source_number_idx
on public.catalog_discovery_candidates (source_set_number);

drop trigger if exists set_catalog_discovery_candidates_updated_at
on public.catalog_discovery_candidates;
create trigger set_catalog_discovery_candidates_updated_at
before update on public.catalog_discovery_candidates
for each row
execute function public.set_updated_at();

alter table public.catalog_discovery_candidates enable row level security;

drop policy if exists "catalog_discovery_candidates_service_role_all"
on public.catalog_discovery_candidates;
create policy "catalog_discovery_candidates_service_role_all"
on public.catalog_discovery_candidates
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
