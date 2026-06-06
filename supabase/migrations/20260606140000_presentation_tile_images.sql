alter table public.catalog_themes
add column if not exists public_tile_image_url text null;

alter table public.catalog_collection_presentations
add column if not exists public_tile_image_url text null;

alter table public.public_page_section_items
add column if not exists use_custom_image boolean not null default false;

update public.catalog_themes
set public_tile_image_url = public_image_url
where public_tile_image_url is null
  and nullif(trim(public_image_url), '') is not null;

update public.catalog_collection_presentations
set public_tile_image_url = public_image_url
where public_tile_image_url is null
  and nullif(trim(public_image_url), '') is not null;

update public.public_page_section_items
set use_custom_image = true
where reference_type = 'custom'
  and nullif(trim(image_url), '') is not null;
