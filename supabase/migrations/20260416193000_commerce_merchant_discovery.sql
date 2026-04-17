create table if not exists public.commerce_merchant_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  set_id text not null,
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  search_query text not null,
  search_url text not null,
  status text not null default 'running' check (
    status in ('running', 'success', 'failed')
  ),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  error_message text null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_merchant_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.commerce_merchant_discovery_runs(id) on delete cascade,
  set_id text not null,
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  candidate_title text not null,
  candidate_url text not null,
  canonical_url text not null,
  price_minor integer null check (price_minor is null or price_minor > 0),
  currency_code text null,
  availability text null,
  detected_set_id text null,
  confidence_score integer not null check (
    confidence_score >= 0 and confidence_score <= 100
  ),
  status text not null check (
    status in ('auto_approved', 'needs_review', 'rejected')
  ),
  match_reasons jsonb not null default '[]'::jsonb,
  source_rank integer not null default 1 check (source_rank > 0),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  offer_seed_id uuid null references public.commerce_offer_seeds(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (discovery_run_id, canonical_url)
);

create index if not exists commerce_merchant_discovery_runs_set_id_idx
on public.commerce_merchant_discovery_runs (set_id);

create index if not exists commerce_merchant_discovery_runs_merchant_id_idx
on public.commerce_merchant_discovery_runs (merchant_id);

create index if not exists commerce_merchant_discovery_runs_status_idx
on public.commerce_merchant_discovery_runs (status);

create index if not exists commerce_merchant_discovery_candidates_run_id_idx
on public.commerce_merchant_discovery_candidates (discovery_run_id);

create index if not exists commerce_merchant_discovery_candidates_set_id_idx
on public.commerce_merchant_discovery_candidates (set_id);

create index if not exists commerce_merchant_discovery_candidates_merchant_id_idx
on public.commerce_merchant_discovery_candidates (merchant_id);

create index if not exists commerce_merchant_discovery_candidates_status_idx
on public.commerce_merchant_discovery_candidates (status);

create index if not exists commerce_merchant_discovery_candidates_review_status_idx
on public.commerce_merchant_discovery_candidates (review_status);

drop trigger if exists set_commerce_merchant_discovery_runs_updated_at
on public.commerce_merchant_discovery_runs;
create trigger set_commerce_merchant_discovery_runs_updated_at
before update on public.commerce_merchant_discovery_runs
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_merchant_discovery_candidates_updated_at
on public.commerce_merchant_discovery_candidates;
create trigger set_commerce_merchant_discovery_candidates_updated_at
before update on public.commerce_merchant_discovery_candidates
for each row
execute function public.set_updated_at();

alter table public.commerce_merchant_discovery_runs enable row level security;
alter table public.commerce_merchant_discovery_candidates enable row level security;

with merchant_seed_values (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
) as (
  values
  ('misterbricks', 'MisterBricks', false, 'direct', null, 'Discovery-ready merchant for LEGO specialist coverage'),
  ('proshop', 'Proshop', false, 'direct', null, 'Discovery-ready merchant for wider Dutch electronics and hobby coverage'),
  ('smyths-toys', 'Smyths Toys', false, 'direct', null, 'Discovery-ready merchant for toy-retail coverage')
)
insert into public.commerce_merchants (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
)
select
  merchant_seed_values.slug,
  merchant_seed_values.name,
  merchant_seed_values.is_active,
  merchant_seed_values.source_type,
  merchant_seed_values.affiliate_network,
  merchant_seed_values.notes
from merchant_seed_values
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  affiliate_network = excluded.affiliate_network,
  notes = excluded.notes;
