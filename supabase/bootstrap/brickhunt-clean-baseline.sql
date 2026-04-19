-- Fresh-environment baseline for the Supabase-first Brickhunt data model.
-- Use this on a brand-new Supabase project instead of replaying the full
-- transitional migration chain.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  collector_handle text not null unique,
  tier text not null default 'Collector',
  location text not null default '',
  collection_focus text not null default '',
  wishlist_deal_alerts boolean not null default true,
  wishlist_alerts_last_viewed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_set_statuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  is_owned boolean not null default false,
  is_wanted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, set_id)
);

create table if not exists public.wishlist_alert_notification_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  last_notified_kind text not null,
  last_notified_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, set_id)
);

create table if not exists public.catalog_source_themes (
  id text primary key,
  source_system text not null check (
    source_system in ('rebrickable')
  ),
  source_theme_name text not null,
  parent_source_theme_id text null references public.catalog_source_themes (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_themes (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  status text not null default 'active' check (
    status in ('active', 'inactive')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_theme_mappings (
  source_theme_id text primary key references public.catalog_source_themes (id) on delete cascade,
  primary_theme_id text not null references public.catalog_themes (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_sets (
  set_id text primary key,
  source_set_number text not null unique,
  slug text not null unique,
  name text not null,
  source_theme_id text not null references public.catalog_source_themes (id) on delete restrict,
  primary_theme_id text not null references public.catalog_themes (id) on delete restrict,
  release_year integer not null check (release_year >= 1940),
  piece_count integer not null check (piece_count > 0),
  image_url text null,
  source text not null default 'rebrickable' check (
    source in ('rebrickable')
  ),
  status text not null default 'active' check (
    status in ('active', 'inactive')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_merchants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  source_type text not null default 'direct' check (
    source_type in ('direct', 'affiliate', 'marketplace')
  ),
  affiliate_network text null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_offer_seeds (
  id uuid primary key default gen_random_uuid(),
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  product_url text not null,
  is_active boolean not null default true,
  validation_status text not null default 'pending' check (
    validation_status in ('pending', 'valid', 'invalid', 'stale')
  ),
  last_verified_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (set_id, merchant_id)
);

create table if not exists public.commerce_offer_latest (
  id uuid primary key default gen_random_uuid(),
  offer_seed_id uuid not null unique references public.commerce_offer_seeds(id) on delete cascade,
  price_minor integer null check (price_minor is null or price_minor > 0),
  currency_code text null,
  availability text null,
  fetch_status text not null default 'pending' check (
    fetch_status in ('pending', 'success', 'unavailable', 'error')
  ),
  observed_at timestamptz null,
  fetched_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_benchmark_sets (
  set_id text primary key references public.catalog_sets(set_id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pricing_daily_set_history (
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  region_code text not null,
  currency_code text not null,
  condition text not null,
  headline_price_minor integer not null check (headline_price_minor > 0),
  reference_price_minor integer null check (reference_price_minor > 0),
  lowest_merchant_id text null,
  observed_at timestamptz not null,
  recorded_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (set_id, region_code, currency_code, condition, recorded_on)
);

create index if not exists user_set_statuses_user_id_idx
on public.user_set_statuses (user_id);

create index if not exists wishlist_alert_notification_states_user_id_idx
on public.wishlist_alert_notification_states (user_id);

create index if not exists catalog_source_themes_source_system_idx
on public.catalog_source_themes (source_system);

create index if not exists catalog_source_themes_parent_source_theme_id_idx
on public.catalog_source_themes (parent_source_theme_id);

create index if not exists catalog_themes_status_idx
on public.catalog_themes (status);

create index if not exists catalog_theme_mappings_primary_theme_id_idx
on public.catalog_theme_mappings (primary_theme_id);

create index if not exists catalog_sets_status_idx
on public.catalog_sets (status);

create index if not exists catalog_sets_primary_theme_id_idx
on public.catalog_sets (primary_theme_id);

create index if not exists catalog_sets_source_theme_id_idx
on public.catalog_sets (source_theme_id);

create index if not exists commerce_merchants_is_active_idx
on public.commerce_merchants (is_active);

create index if not exists commerce_offer_seeds_merchant_id_idx
on public.commerce_offer_seeds (merchant_id);

create index if not exists commerce_offer_seeds_set_id_idx
on public.commerce_offer_seeds (set_id);

create index if not exists commerce_offer_seeds_is_active_idx
on public.commerce_offer_seeds (is_active);

create index if not exists commerce_benchmark_sets_created_at_idx
on public.commerce_benchmark_sets (created_at);

create index if not exists pricing_daily_set_history_set_id_recorded_on_idx
on public.pricing_daily_set_history (set_id, recorded_on desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_set_statuses_updated_at on public.user_set_statuses;
create trigger set_user_set_statuses_updated_at
before update on public.user_set_statuses
for each row
execute function public.set_updated_at();

drop trigger if exists set_wishlist_alert_notification_states_updated_at
on public.wishlist_alert_notification_states;
create trigger set_wishlist_alert_notification_states_updated_at
before update on public.wishlist_alert_notification_states
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_source_themes_updated_at
on public.catalog_source_themes;
create trigger set_catalog_source_themes_updated_at
before update on public.catalog_source_themes
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_themes_updated_at
on public.catalog_themes;
create trigger set_catalog_themes_updated_at
before update on public.catalog_themes
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_theme_mappings_updated_at
on public.catalog_theme_mappings;
create trigger set_catalog_theme_mappings_updated_at
before update on public.catalog_theme_mappings
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_sets_updated_at
on public.catalog_sets;
create trigger set_catalog_sets_updated_at
before update on public.catalog_sets
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_merchants_updated_at
on public.commerce_merchants;
create trigger set_commerce_merchants_updated_at
before update on public.commerce_merchants
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_offer_seeds_updated_at
on public.commerce_offer_seeds;
create trigger set_commerce_offer_seeds_updated_at
before update on public.commerce_offer_seeds
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_offer_latest_updated_at
on public.commerce_offer_latest;
create trigger set_commerce_offer_latest_updated_at
before update on public.commerce_offer_latest
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_benchmark_sets_updated_at
on public.commerce_benchmark_sets;
create trigger set_commerce_benchmark_sets_updated_at
before update on public.commerce_benchmark_sets
for each row
execute function public.set_updated_at();

drop trigger if exists set_pricing_daily_set_history_updated_at
on public.pricing_daily_set_history;
create trigger set_pricing_daily_set_history_updated_at
before update on public.pricing_daily_set_history
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_set_statuses enable row level security;
alter table public.wishlist_alert_notification_states enable row level security;
alter table public.catalog_source_themes enable row level security;
alter table public.catalog_themes enable row level security;
alter table public.catalog_theme_mappings enable row level security;
alter table public.catalog_sets enable row level security;
alter table public.commerce_merchants enable row level security;
alter table public.commerce_offer_seeds enable row level security;
alter table public.commerce_offer_latest enable row level security;
alter table public.commerce_benchmark_sets enable row level security;
alter table public.pricing_daily_set_history enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_select_own"
on public.user_set_statuses
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_set_statuses_insert_own"
on public.user_set_statuses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_update_own"
on public.user_set_statuses
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_delete_own"
on public.user_set_statuses
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_select_own"
on public.wishlist_alert_notification_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_insert_own"
on public.wishlist_alert_notification_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_update_own"
on public.wishlist_alert_notification_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_delete_own"
on public.wishlist_alert_notification_states
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "catalog_source_themes_select_public"
on public.catalog_source_themes
for select
to anon, authenticated
using (true);

create policy "catalog_themes_select_public"
on public.catalog_themes
for select
to anon, authenticated
using (status = 'active');

create policy "catalog_theme_mappings_select_public"
on public.catalog_theme_mappings
for select
to anon, authenticated
using (true);

create policy "catalog_sets_select_public"
on public.catalog_sets
for select
to anon, authenticated
using (status = 'active');

create policy "pricing_daily_set_history_select_public"
on public.pricing_daily_set_history
for select
to anon, authenticated
using (
  region_code = 'NL' and
  currency_code = 'EUR' and
  condition = 'new'
);
