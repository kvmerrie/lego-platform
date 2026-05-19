create table if not exists public.commerce_current_offer_snapshots (
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  region_code text not null default 'NL',
  currency_code text not null default 'EUR',
  condition text not null default 'new',
  best_offer_seed_id uuid null references public.commerce_offer_seeds(id) on delete set null,
  best_merchant_id uuid null references public.commerce_merchants(id) on delete set null,
  best_merchant_slug text null,
  best_merchant_name text null,
  best_price_minor integer null check (best_price_minor is null or best_price_minor > 0),
  best_availability text null,
  best_product_url text null,
  best_commercial_unit_type text null,
  best_checked_at timestamptz null,
  offer_count integer not null default 0 check (offer_count >= 0),
  trusted_offer_count integer not null default 0 check (trusted_offer_count >= 0),
  strategic_manual_offer_count integer not null default 0 check (strategic_manual_offer_count >= 0),
  comparable_offer_count integer not null default 0 check (comparable_offer_count >= 0),
  next_best_price_minor integer null check (next_best_price_minor is null or next_best_price_minor > 0),
  price_spread_minor integer null check (price_spread_minor is null or price_spread_minor >= 0),
  has_anomalous_spread boolean not null default false,
  offers jsonb not null default '[]'::jsonb,
  snapshot_source text not null default 'commerce_sync',
  computed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (set_id, region_code, currency_code, condition)
);

create index if not exists commerce_current_offer_snapshots_best_checked_idx
on public.commerce_current_offer_snapshots (best_checked_at desc)
where offer_count > 0;

create index if not exists commerce_current_offer_snapshots_best_price_idx
on public.commerce_current_offer_snapshots (best_price_minor)
where best_price_minor is not null;

drop trigger if exists set_commerce_current_offer_snapshots_updated_at
on public.commerce_current_offer_snapshots;
create trigger set_commerce_current_offer_snapshots_updated_at
before update on public.commerce_current_offer_snapshots
for each row
execute function public.set_updated_at();

alter table public.commerce_current_offer_snapshots enable row level security;

drop policy if exists "commerce_current_offer_snapshots_select_public"
on public.commerce_current_offer_snapshots;
create policy "commerce_current_offer_snapshots_select_public"
on public.commerce_current_offer_snapshots
for select
to anon, authenticated
using (
  region_code = 'NL' and
  currency_code = 'EUR' and
  condition = 'new' and
  exists (
    select 1
    from public.catalog_sets
    where catalog_sets.set_id = commerce_current_offer_snapshots.set_id
      and catalog_sets.status = 'active'
  )
);
