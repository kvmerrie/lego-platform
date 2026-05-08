create temporary table catalog_theme_public_navigation_column_state
on commit drop as
select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'catalog_themes'
    and column_name = 'is_public'
) as had_is_public_column;

alter table public.catalog_themes
add column if not exists is_public boolean not null default false;

alter table public.catalog_themes
add column if not exists public_display_name text null;

alter table public.catalog_themes
add column if not exists public_description text null;

alter table public.catalog_themes
add column if not exists public_image_url text null;

alter table public.catalog_themes
add column if not exists public_accent_color text null;

alter table public.catalog_themes
add column if not exists public_logo_url text null;

alter table public.catalog_themes
add column if not exists public_order integer null;

with curated_public_themes(slug, public_order, public_display_name) as (
  values
    ('animal-crossing', 10, 'LEGO® Animal Crossing™'),
    ('architecture', 20, 'Architecture'),
    ('art', 30, 'LEGO® Art'),
    ('botanicals', 40, 'Botanicals'),
    ('brickheadz', 50, 'BrickHeadz'),
    ('city', 60, 'City'),
    ('classic', 70, 'Classic'),
    ('creator', 80, 'Creator 3in1'),
    ('creator-3in1', 80, 'Creator 3in1'),
    ('creator-3-in-1', 80, 'Creator 3in1'),
    ('dc', 90, 'DC'),
    ('disney', 100, 'Disney'),
    ('dreamzzz', 110, 'LEGO® DREAMZzz™'),
    ('duplo', 120, 'LEGO® DUPLO®'),
    ('fortnite', 130, 'LEGO® Fortnite®'),
    ('gabby-s-dollhouse', 140, 'LEGO® Gabby’s Dollhouse'),
    ('gabby-s-poppenhuis', 140, 'LEGO® Gabby’s Dollhouse'),
    ('harry-potter', 150, 'Harry Potter™'),
    ('icons', 160, 'LEGO® Icons'),
    ('ideas', 170, 'Ideas'),
    ('jurassic-world', 180, 'Jurassic World'),
    ('marvel', 190, 'Marvel'),
    ('minecraft', 200, 'Minecraft®'),
    ('minifigures', 210, 'Minifigures'),
    ('minifiguren', 210, 'Minifigures'),
    ('ninjago', 220, 'NINJAGO®'),
    ('one-piece', 230, 'ONE PIECE'),
    ('lego-pokemon-speelgoed-en-sets', 240, 'LEGO® Pokémon™'),
    ('pokemon', 240, 'LEGO® Pokémon™'),
    ('pokémon', 240, 'LEGO® Pokémon™'),
    ('sonic-the-hedgehog', 250, 'Sonic the Hedgehog™'),
    ('speed-champions', 260, 'Speed Champions'),
    ('star-wars', 270, 'Star Wars™'),
    ('super-mario', 280, 'LEGO® Super Mario™'),
    ('technic', 290, 'Technic'),
    ('the-legend-of-zelda', 300, 'LEGO® The Legend of Zelda™'),
    ('wednesday', 310, 'LEGO® Wednesday'),
    ('wicked', 320, 'Wicked')
),
curated_public_theme_names(display_name, public_order, public_display_name) as (
  values
    ('animal crossing', 10, 'LEGO® Animal Crossing™'),
    ('architecture', 20, 'Architecture'),
    ('art', 30, 'LEGO® Art'),
    ('lego art', 30, 'LEGO® Art'),
    ('botanicals', 40, 'Botanicals'),
    ('botanical collection', 40, 'Botanicals'),
    ('the botanical collection', 40, 'Botanicals'),
    ('brickheadz', 50, 'BrickHeadz'),
    ('city', 60, 'City'),
    ('classic', 70, 'Classic'),
    ('creator', 80, 'Creator 3in1'),
    ('creator 3in1', 80, 'Creator 3in1'),
    ('creator 3 in 1', 80, 'Creator 3in1'),
    ('dc', 90, 'DC'),
    ('super heroes dc', 90, 'DC'),
    ('disney', 100, 'Disney'),
    ('dreamzzz', 110, 'LEGO® DREAMZzz™'),
    ('duplo', 120, 'LEGO® DUPLO®'),
    ('fortnite', 130, 'LEGO® Fortnite®'),
    ('gabby s dollhouse', 140, 'LEGO® Gabby’s Dollhouse'),
    ('gabby s poppenhuis', 140, 'LEGO® Gabby’s Dollhouse'),
    ('harry potter', 150, 'Harry Potter™'),
    ('icons', 160, 'LEGO® Icons'),
    ('lego icons', 160, 'LEGO® Icons'),
    ('ideas', 170, 'Ideas'),
    ('lego ideas and cuusoo', 170, 'Ideas'),
    ('jurassic world', 180, 'Jurassic World'),
    ('marvel', 190, 'Marvel'),
    ('super heroes marvel', 190, 'Marvel'),
    ('minecraft', 200, 'Minecraft®'),
    ('minifigures', 210, 'Minifigures'),
    ('collectible minifigures', 210, 'Minifigures'),
    ('minifiguren', 210, 'Minifigures'),
    ('ninjago', 220, 'NINJAGO®'),
    ('one piece', 230, 'ONE PIECE'),
    ('pokemon', 240, 'LEGO® Pokémon™'),
    ('pok mon', 240, 'LEGO® Pokémon™'),
    ('pokémon', 240, 'LEGO® Pokémon™'),
    ('lego pokemon speelgoed en sets', 240, 'LEGO® Pokémon™'),
    ('lego pok mon speelgoed en sets', 240, 'LEGO® Pokémon™'),
    ('sonic the hedgehog', 250, 'Sonic the Hedgehog™'),
    ('speed champions', 260, 'Speed Champions'),
    ('star wars', 270, 'Star Wars™'),
    ('super mario', 280, 'LEGO® Super Mario™'),
    ('technic', 290, 'Technic'),
    ('the legend of zelda', 300, 'LEGO® The Legend of Zelda™'),
    ('wednesday', 310, 'LEGO® Wednesday'),
    ('wicked', 320, 'Wicked')
),
matched_theme_orders as (
  select
    catalog_themes.id,
    min(
      coalesce(
        curated_public_themes.public_order,
        curated_public_theme_names.public_order
      )
    ) as public_order,
    min(
      coalesce(
        curated_public_themes.public_display_name,
        curated_public_theme_names.public_display_name
      )
    ) as public_display_name
  from public.catalog_themes
  left join curated_public_themes
    on catalog_themes.slug = curated_public_themes.slug
  left join curated_public_theme_names
    on regexp_replace(
      lower(
        translate(catalog_themes.display_name, '®™’''-', '     ')
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) = curated_public_theme_names.display_name
  where curated_public_themes.slug is not null
    or curated_public_theme_names.display_name is not null
  group by catalog_themes.id
)
update public.catalog_themes
set
  is_public = case
    when (
      select had_is_public_column
      from catalog_theme_public_navigation_column_state
      limit 1
    ) then catalog_themes.is_public
    when catalog_themes.is_public = false then true
    else catalog_themes.is_public
  end,
  public_order = case
    when catalog_themes.public_order is null then matched_theme_orders.public_order
    else catalog_themes.public_order
  end,
  public_display_name = case
    when nullif(trim(catalog_themes.public_display_name), '') is null
      then matched_theme_orders.public_display_name
    else catalog_themes.public_display_name
  end
from matched_theme_orders
where catalog_themes.id = matched_theme_orders.id;

update public.catalog_themes
set public_order = null
where is_public = false
  and public_order is not null
  and (
    select had_is_public_column
    from catalog_theme_public_navigation_column_state
    limit 1
  ) = false;
