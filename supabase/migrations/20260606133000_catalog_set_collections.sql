create table if not exists public.catalog_set_collections (
  collection_slug text not null references public.catalog_collection_presentations (collection_slug) on delete cascade,
  set_id text not null references public.catalog_sets (set_id) on delete cascade,
  assignment_source text not null default 'manual',
  confidence text not null default 'high',
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (collection_slug, set_id),
  constraint catalog_set_collections_assignment_source_check
    check (assignment_source in ('manual', 'manual_seed', 'rule', 'brickset', 'rakuten', 'lego')),
  constraint catalog_set_collections_confidence_check
    check (confidence in ('high', 'medium', 'low'))
);

create index if not exists catalog_set_collections_collection_enabled_idx
on public.catalog_set_collections (
  collection_slug,
  enabled,
  set_id
);

create index if not exists catalog_set_collections_set_id_idx
on public.catalog_set_collections (set_id);

drop trigger if exists set_catalog_set_collections_updated_at
on public.catalog_set_collections;
create trigger set_catalog_set_collections_updated_at
before update on public.catalog_set_collections
for each row execute function public.set_updated_at();

alter table public.catalog_set_collections enable row level security;

drop policy if exists "catalog_set_collections_select_enabled"
on public.catalog_set_collections;
create policy "catalog_set_collections_select_enabled"
on public.catalog_set_collections
for select
using (enabled = true);

insert into public.catalog_collection_presentations (
  collection_slug,
  public_display_name,
  public_description,
  public_image_url,
  public_accent_color,
  public_surface_color,
  public_surface_text_color,
  public_hero_text_color,
  public_order,
  public_homepage_order,
  is_public,
  status,
  metadata_json
)
values (
  'collectible-minifigures',
  'LEGO minifiguren',
  'CMF-series, grote figuren, sleutelhangers en display-accessoires waarin het minifiguur zelf de reden is.',
  'https://cdn.rebrickable.com/media/sets/40649-1/1000.jpg',
  '#f2c84b',
  '#f2c84b',
  '#171a22',
  '#171a22',
  70,
  70,
  false,
  'inactive',
  '{"seededBy":"20260606133000_catalog_set_collections"}'::jsonb
)
on conflict (collection_slug)
do update set
  public_display_name = coalesce(public.catalog_collection_presentations.public_display_name, excluded.public_display_name),
  public_description = coalesce(public.catalog_collection_presentations.public_description, excluded.public_description),
  public_image_url = coalesce(public.catalog_collection_presentations.public_image_url, excluded.public_image_url),
  public_accent_color = coalesce(public.catalog_collection_presentations.public_accent_color, excluded.public_accent_color),
  public_surface_color = coalesce(public.catalog_collection_presentations.public_surface_color, excluded.public_surface_color),
  public_surface_text_color = coalesce(public.catalog_collection_presentations.public_surface_text_color, excluded.public_surface_text_color),
  public_hero_text_color = coalesce(public.catalog_collection_presentations.public_hero_text_color, excluded.public_hero_text_color),
  public_order = coalesce(public.catalog_collection_presentations.public_order, excluded.public_order),
  public_homepage_order = coalesce(public.catalog_collection_presentations.public_homepage_order, excluded.public_homepage_order),
  is_public = false,
  status = 'inactive',
  metadata_json = public.catalog_collection_presentations.metadata_json;

with explicit_seed(set_id, reason) as (
  values
    ('40649', 'large_buildable_minifigure'),
    ('40820', 'large_buildable_minifigure'),
    ('71038', 'collectible_minifigures_series'),
    ('71039', 'collectible_minifigures_series'),
    ('71045', 'collectible_minifigures_series'),
    ('71046', 'collectible_minifigures_series'),
    ('71047', 'collectible_minifigures_series'),
    ('75461', 'large_buildable_minifigure'),
    ('76313', 'minifigure_display_set')
),
existing_seed as (
  select
    catalog_sets.set_id,
    explicit_seed.reason
  from explicit_seed
  join public.catalog_sets
    on catalog_sets.set_id = explicit_seed.set_id
)
insert into public.catalog_set_collections (
  collection_slug,
  set_id,
  assignment_source,
  confidence,
  enabled,
  metadata_json
)
select
  'collectible-minifigures',
  existing_seed.set_id,
  'manual_seed',
  'high',
  true,
  jsonb_build_object('reason', existing_seed.reason)
from existing_seed
on conflict (collection_slug, set_id)
do update set
  enabled = public.catalog_set_collections.enabled,
  metadata_json = public.catalog_set_collections.metadata_json || excluded.metadata_json;

with rule_candidates as (
  select
    catalog_sets.set_id,
    concat_ws(' ', catalog_sets.name, catalog_sets.slug, catalog_sets.source_set_number) as search_text
  from public.catalog_sets
  where catalog_sets.status = 'active'
),
matching_candidates as (
  select set_id
  from rule_candidates
  where search_text ~* '(collectible[ -]?minifig|minifigures? series|minifiguren? serie|\mcmf\M|up[ -]?scaled.*minifig|large.*minifig|buildable.*minifig|grote.*minifiguur|bouwbare.*minifiguur|create[ -]?a[ -]?minifigure|minifigure factory|bouw[ -]?een[ -]?minifiguur|minifig.*(keychain|sleutelhanger|lamp|light|licht|verlichting|puzzle|puzzel|display case|vitrine|display)|(keychain|sleutelhanger|lamp|light|licht|verlichting|puzzle|puzzel|display case|vitrine|display).*(minifig|minifiguur))'
)
insert into public.catalog_set_collections (
  collection_slug,
  set_id,
  assignment_source,
  confidence,
  enabled,
  metadata_json
)
select
  'collectible-minifigures',
  matching_candidates.set_id,
  'rule',
  'medium',
  true,
  '{"rule":"minifigure_title_category"}'::jsonb
from matching_candidates
on conflict (collection_slug, set_id)
do update set
  enabled = public.catalog_set_collections.enabled,
  metadata_json = public.catalog_set_collections.metadata_json || excluded.metadata_json;
