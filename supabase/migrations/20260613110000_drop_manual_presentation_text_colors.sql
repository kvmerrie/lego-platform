alter table if exists public.catalog_themes
  drop column if exists public_surface_text_color,
  drop column if exists public_hero_text_color;

alter table if exists public.catalog_collection_presentations
  drop column if exists public_surface_text_color,
  drop column if exists public_hero_text_color;
