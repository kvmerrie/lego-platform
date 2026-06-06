insert into public.catalog_collection_presentations (
  collection_slug,
  public_display_name,
  public_description,
  public_image_url,
  public_tile_image_url,
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
  'https://cdn.rebrickable.com/media/sets/40649-1/1000.jpg',
  '#f2c84b',
  '#f2c84b',
  '#171a22',
  '#171a22',
  70,
  70,
  false,
  'inactive',
  '{"seededBy":"20260606150000_repoint_minifigure_memberships","publicSurface":"/themes/collectible-minifigures"}'::jsonb
)
on conflict (collection_slug)
do update set
  public_display_name = coalesce(public.catalog_collection_presentations.public_display_name, excluded.public_display_name),
  public_description = coalesce(public.catalog_collection_presentations.public_description, excluded.public_description),
  public_image_url = coalesce(public.catalog_collection_presentations.public_image_url, excluded.public_image_url),
  public_tile_image_url = coalesce(public.catalog_collection_presentations.public_tile_image_url, excluded.public_tile_image_url),
  public_accent_color = coalesce(public.catalog_collection_presentations.public_accent_color, excluded.public_accent_color),
  public_surface_color = coalesce(public.catalog_collection_presentations.public_surface_color, excluded.public_surface_color),
  public_surface_text_color = coalesce(public.catalog_collection_presentations.public_surface_text_color, excluded.public_surface_text_color),
  public_hero_text_color = coalesce(public.catalog_collection_presentations.public_hero_text_color, excluded.public_hero_text_color),
  public_order = coalesce(public.catalog_collection_presentations.public_order, excluded.public_order),
  public_homepage_order = coalesce(public.catalog_collection_presentations.public_homepage_order, excluded.public_homepage_order),
  is_public = false,
  status = 'inactive',
  metadata_json = public.catalog_collection_presentations.metadata_json || excluded.metadata_json;

insert into public.catalog_set_collections (
  collection_slug,
  set_id,
  assignment_source,
  confidence,
  enabled,
  metadata_json,
  created_at,
  updated_at
)
select
  'collectible-minifigures',
  set_id,
  assignment_source,
  confidence,
  enabled,
  metadata_json || '{"migratedFrom":"lego-minifiguren"}'::jsonb,
  created_at,
  updated_at
from public.catalog_set_collections
where collection_slug = 'lego-minifiguren'
on conflict (collection_slug, set_id)
do update set
  enabled = public.catalog_set_collections.enabled,
  metadata_json = public.catalog_set_collections.metadata_json || excluded.metadata_json;

delete from public.catalog_set_collections
where collection_slug = 'lego-minifiguren';

update public.catalog_collection_presentations
set
  is_public = false,
  status = 'inactive',
  metadata_json = metadata_json || '{"disabledBy":"20260606150000_repoint_minifigure_memberships","replacedBy":"collectible-minifigures"}'::jsonb
where collection_slug = 'lego-minifiguren';
