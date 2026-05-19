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

create or replace function public.set_missing_catalog_theme_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = timezone('utc', now());
  end if;

  if new.updated_at is null then
    new.updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.set_missing_catalog_theme_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.is_public is null then
    new.is_public = false;
  end if;

  return new;
end;
$$;

create or replace function public.set_missing_catalog_set_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or btrim(new.status) = '' then
    new.status = 'active';
  end if;

  return new;
end;
$$;

create or replace function public.set_missing_catalog_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = timezone('utc', now());
  end if;

  if new.updated_at is null then
    new.updated_at = timezone('utc', now());
  end if;

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

create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  actor_id text null,
  actor_email text null,
  paths text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  reason text not null,
  success boolean not null,
  response_status integer null,
  duration_ms integer not null check (duration_ms >= 0),
  metadata jsonb null,
  created_at timestamptz not null default timezone('utc', now())
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
  is_public boolean not null default false,
  public_display_name text null,
  public_description text null,
  public_image_url text null,
  public_accent_color text null,
  public_surface_color text null,
  public_surface_text_color text null,
  public_hero_text_color text null,
  public_logo_url text null,
  public_homepage_order integer null,
  public_order integer null,
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
  release_year integer check (release_year >= 1940),
  release_date date null,
  release_date_precision text not null default 'unknown' check (
    release_date_precision in ('day', 'month', 'year', 'unknown')
  ),
  piece_count integer not null check (piece_count >= 0),
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

create table if not exists public.catalog_theme_summaries (
  theme_id text primary key references public.catalog_themes (id) on delete cascade,
  active_set_count integer not null default 0,
  representative_set_id text null references public.catalog_sets (set_id) on delete set null,
  representative_image_url text null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_set_minifig_summaries (
  set_id text primary key references public.catalog_sets(set_id) on delete cascade,
  source_system text not null default 'rebrickable' check (
    source_system in ('rebrickable')
  ),
  minifig_count integer not null default 0 check (minifig_count >= 0),
  source_minifig_count integer null check (
    source_minifig_count is null or source_minifig_count >= 0
  ),
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_set_minifigs (
  id text primary key,
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  source_system text not null default 'rebrickable' check (
    source_system in ('rebrickable')
  ),
  source_set_number text not null,
  source_minifig_number text not null,
  quantity integer not null default 1 check (quantity > 0),
  name text null,
  image_url text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_system, source_set_number, source_minifig_number)
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

create index if not exists catalog_themes_public_navigation_idx
on public.catalog_themes (
  status,
  is_public,
  public_order,
  display_name
);

create index if not exists catalog_themes_public_homepage_order_idx
on public.catalog_themes (public_homepage_order)
where is_public = true and status = 'active';

create index if not exists catalog_theme_mappings_primary_theme_id_idx
on public.catalog_theme_mappings (primary_theme_id);

create index if not exists catalog_sets_status_idx
on public.catalog_sets (status);

create index if not exists catalog_sets_primary_theme_id_idx
on public.catalog_sets (primary_theme_id);

create index if not exists catalog_sets_theme_page_order_idx
on public.catalog_sets (
  primary_theme_id,
  status,
  release_year desc,
  name asc,
  set_id asc
);

create index if not exists catalog_sets_source_theme_id_idx
on public.catalog_sets (source_theme_id);

create index if not exists catalog_set_minifig_summaries_source_system_idx
on public.catalog_set_minifig_summaries (source_system);

create index if not exists catalog_set_minifig_summaries_synced_at_idx
on public.catalog_set_minifig_summaries (synced_at desc);

create index if not exists catalog_set_minifigs_set_id_idx
on public.catalog_set_minifigs (set_id);

create index if not exists catalog_set_minifigs_source_set_number_idx
on public.catalog_set_minifigs (source_system, source_set_number);

create index if not exists catalog_set_minifigs_source_minifig_number_idx
on public.catalog_set_minifigs (source_system, source_minifig_number);

create index if not exists admin_operation_logs_created_at_idx
on public.admin_operation_logs (created_at desc);

create index if not exists admin_operation_logs_operation_type_created_at_idx
on public.admin_operation_logs (operation_type, created_at desc);

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

drop trigger if exists set_catalog_source_themes_missing_timestamps
on public.catalog_source_themes;
create trigger set_catalog_source_themes_missing_timestamps
before insert or update on public.catalog_source_themes
for each row
execute function public.set_missing_catalog_theme_timestamps();

drop trigger if exists set_catalog_themes_updated_at
on public.catalog_themes;
create trigger set_catalog_themes_updated_at
before update on public.catalog_themes
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_themes_missing_timestamps
on public.catalog_themes;
create trigger set_catalog_themes_missing_timestamps
before insert or update on public.catalog_themes
for each row
execute function public.set_missing_catalog_theme_timestamps();

drop trigger if exists set_catalog_themes_missing_visibility
on public.catalog_themes;
create trigger set_catalog_themes_missing_visibility
before insert or update on public.catalog_themes
for each row
execute function public.set_missing_catalog_theme_visibility();

drop trigger if exists set_catalog_theme_mappings_updated_at
on public.catalog_theme_mappings;
create trigger set_catalog_theme_mappings_updated_at
before update on public.catalog_theme_mappings
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_theme_mappings_missing_timestamps
on public.catalog_theme_mappings;
create trigger set_catalog_theme_mappings_missing_timestamps
before insert or update on public.catalog_theme_mappings
for each row
execute function public.set_missing_catalog_theme_timestamps();

drop trigger if exists set_catalog_sets_updated_at
on public.catalog_sets;
create trigger set_catalog_sets_updated_at
before update on public.catalog_sets
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_sets_missing_timestamps
on public.catalog_sets;
create trigger set_catalog_sets_missing_timestamps
before insert or update on public.catalog_sets
for each row
execute function public.set_missing_catalog_set_timestamps();

drop trigger if exists set_catalog_sets_missing_status
on public.catalog_sets;
create trigger set_catalog_sets_missing_status
before insert or update on public.catalog_sets
for each row
execute function public.set_missing_catalog_set_status();

drop trigger if exists set_catalog_set_minifig_summaries_updated_at
on public.catalog_set_minifig_summaries;
create trigger set_catalog_set_minifig_summaries_updated_at
before update on public.catalog_set_minifig_summaries
for each row
execute function public.set_updated_at();

drop trigger if exists set_catalog_set_minifigs_updated_at
on public.catalog_set_minifigs;
create trigger set_catalog_set_minifigs_updated_at
before update on public.catalog_set_minifigs
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

create table if not exists public.editorial_feed_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  title text not null,
  feed_name text not null,
  event_fingerprint text,
  source_published_at timestamptz,
  status text not null default 'new' check (status in ('new', 'drafted', 'ignored', 'low_value', 'published')),
  article_slug text,
  draft_mdx text,
  draft_frontmatter jsonb,
  drafted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editorial_feed_items_event_fingerprint_idx
on public.editorial_feed_items (event_fingerprint)
where event_fingerprint is not null;

create index if not exists editorial_feed_items_status_created_at_idx
on public.editorial_feed_items (status, created_at desc);

create trigger set_editorial_feed_items_updated_at
before update on public.editorial_feed_items
for each row
execute function public.set_updated_at();

create or replace function public.refresh_catalog_theme_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.catalog_theme_summaries (
    theme_id,
    active_set_count,
    representative_set_id,
    representative_image_url,
    updated_at
  )
  select
    catalog_themes.id as theme_id,
    count(catalog_sets.set_id)::integer as active_set_count,
    (
      array_agg(
        catalog_sets.set_id
        order by
          catalog_sets.release_year desc nulls last,
          catalog_sets.name asc,
          catalog_sets.set_id asc
      ) filter (where catalog_sets.set_id is not null)
    )[1] as representative_set_id,
    (
      array_agg(
        catalog_sets.image_url
        order by
          catalog_sets.release_year desc nulls last,
          catalog_sets.name asc,
          catalog_sets.set_id asc
      ) filter (
        where catalog_sets.set_id is not null
          and nullif(trim(catalog_sets.image_url), '') is not null
      )
    )[1] as representative_image_url,
    timezone('utc', now()) as updated_at
  from public.catalog_themes
  left join public.catalog_sets
    on catalog_sets.primary_theme_id = catalog_themes.id
    and catalog_sets.status = 'active'
  group by catalog_themes.id
  on conflict (theme_id) do update
  set
    active_set_count = excluded.active_set_count,
    representative_set_id = excluded.representative_set_id,
    representative_image_url = excluded.representative_image_url,
    updated_at = excluded.updated_at;

  delete from public.catalog_theme_summaries
  where not exists (
    select 1
    from public.catalog_themes
    where catalog_themes.id = catalog_theme_summaries.theme_id
  );
end;
$$;

revoke all on function public.refresh_catalog_theme_summaries() from public;
grant execute on function public.refresh_catalog_theme_summaries() to service_role;

create or replace function public.list_catalog_current_offer_candidate_set_ids(
  candidate_limit integer default 240
)
returns table(set_id text)
language sql
stable
set search_path = public
as $$
  with normalized_limit as (
    select least(greatest(coalesce(candidate_limit, 240), 1), 500) as value
  ),
  eligible_offers as (
    select
      seeds.set_id,
      latest.price_minor,
      coalesce(latest.observed_at, latest.fetched_at, latest.updated_at) as checked_at
    from public.commerce_offer_latest latest
    join public.commerce_offer_seeds seeds
      on seeds.id = latest.offer_seed_id
    join public.commerce_merchants merchants
      on merchants.id = seeds.merchant_id
    where latest.fetch_status = 'success'
      and latest.currency_code = 'EUR'
      and latest.price_minor > 0
      and latest.availability in ('in_stock', 'limited')
      and coalesce(latest.observed_at, latest.fetched_at, latest.updated_at) is not null
      and seeds.is_active = true
      and seeds.validation_status = 'valid'
      and length(coalesce(seeds.product_url, '')) > 0
      and merchants.is_active = true
      and merchants.slug in (
        'goodbricks',
        'mediamarkt',
        'alternate',
        'coolblue',
        'misterbricks',
        'lidl',
        'conrad'
      )
      and not (
        coalesce(seeds.notes, '') || ' ' || coalesce(seeds.product_url, '')
      ) ~* '\m(magazine|tijdschrift|boekje|booklet|foil pack|accessory|accessoire|sleutelhanger|keychain|display case|vitrine|light kit|verlichting|minifigure frame|blind bag|mystery bag|blindbox|blind box|verrassingszakje|mystery pack|single figure|single minifigure|losse minifiguur|losse figuur|1\s*stuk|per stuk|single pack|foil bag|polybag)\M'
      and (
        seeds.set_id !~ '^710[0-9]{2}(-1)?$'
        or (
          coalesce(seeds.notes, '') || ' ' || coalesce(seeds.product_url, '')
        ) ~* '\m(random box|display box|displaydoos|display|sealed box|complete serie|complete series|complete set|complete collectie|full set|volledige serie|volledige collectie|box of (12|24|36)|(12|24|36)\s*(stuks|pcs|pieces|x))\M'
      )
  ),
  ranked_sets as (
    select
      eligible_offers.set_id,
      count(*) as offer_count,
      min(eligible_offers.price_minor) as best_price_minor,
      max(eligible_offers.checked_at) as latest_checked_at
    from eligible_offers
    group by eligible_offers.set_id
  )
  select ranked_sets.set_id
  from ranked_sets, normalized_limit
  order by
    ranked_sets.offer_count desc,
    ranked_sets.latest_checked_at desc,
    ranked_sets.best_price_minor asc,
    ranked_sets.set_id asc
  limit (select value from normalized_limit);
$$;

revoke all on function public.list_catalog_current_offer_candidate_set_ids(integer) from public;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to anon;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to authenticated;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to service_role;

alter table public.profiles enable row level security;
alter table public.user_set_statuses enable row level security;
alter table public.admin_operation_logs enable row level security;
alter table public.wishlist_alert_notification_states enable row level security;
alter table public.catalog_source_themes enable row level security;
alter table public.catalog_themes enable row level security;
alter table public.catalog_theme_mappings enable row level security;
alter table public.catalog_theme_summaries enable row level security;
alter table public.catalog_set_minifig_summaries enable row level security;
alter table public.catalog_set_minifigs enable row level security;
alter table public.catalog_sets enable row level security;
alter table public.commerce_merchants enable row level security;
alter table public.commerce_offer_seeds enable row level security;
alter table public.commerce_offer_latest enable row level security;
alter table public.commerce_benchmark_sets enable row level security;
alter table public.pricing_daily_set_history enable row level security;
alter table public.editorial_feed_items enable row level security;

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

create policy "admin_operation_logs_service_role_all"
on public.admin_operation_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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

create policy "catalog_theme_summaries_select_public"
on public.catalog_theme_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_themes
    where catalog_themes.id = catalog_theme_summaries.theme_id
      and catalog_themes.status = 'active'
      and catalog_themes.is_public = true
  )
);

create policy "catalog_set_minifig_summaries_select_public"
on public.catalog_set_minifig_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_sets
    where catalog_sets.set_id = catalog_set_minifig_summaries.set_id
      and catalog_sets.status = 'active'
  )
);

create policy "catalog_set_minifigs_select_public"
on public.catalog_set_minifigs
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_sets
    where catalog_sets.set_id = catalog_set_minifigs.set_id
      and catalog_sets.status = 'active'
  )
);

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

create policy "editorial_feed_items_service_role_all"
on public.editorial_feed_items
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
