create table if not exists public.commerce_affiliate_discovered_sets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  normalized_set_id text not null,
  source_set_number text not null,
  product_title text not null,
  price_minor integer null check (price_minor is null or price_minor > 0),
  currency_code text null,
  image_url text null,
  product_url text not null,
  confidence text not null default 'low' check (confidence in ('high', 'low')),
  status text not null default 'new' check (status in ('new', 'imported', 'ignored', 'non_set')),
  raw_payload jsonb not null default '{}'::jsonb,
  imported_set_id text null references public.catalog_sets(set_id) on delete set null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists commerce_affiliate_discovered_sets_merchant_product_url_key
on public.commerce_affiliate_discovered_sets (merchant_id, product_url);

create index if not exists commerce_affiliate_discovered_sets_review_idx
on public.commerce_affiliate_discovered_sets (status, confidence, last_seen_at desc);

create index if not exists commerce_affiliate_discovered_sets_set_idx
on public.commerce_affiliate_discovered_sets (normalized_set_id);

drop trigger if exists set_commerce_affiliate_discovered_sets_updated_at
on public.commerce_affiliate_discovered_sets;
create trigger set_commerce_affiliate_discovered_sets_updated_at
before update on public.commerce_affiliate_discovered_sets
for each row
execute function public.set_updated_at();

alter table public.commerce_affiliate_discovered_sets enable row level security;
