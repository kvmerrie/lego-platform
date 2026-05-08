alter table public.catalog_themes
add column if not exists is_public boolean not null default false;

alter table public.catalog_themes
add column if not exists public_order integer null;

with curated_public_themes(slug, public_order) as (
  values
    ('animal-crossing', 10),
    ('architecture', 20),
    ('art', 30),
    ('botanicals', 40),
    ('brickheadz', 50),
    ('city', 60),
    ('classic', 70),
    ('creator', 80),
    ('creator-3in1', 80),
    ('creator-3-in-1', 80),
    ('dc', 90),
    ('disney', 100),
    ('dreamzzz', 110),
    ('duplo', 120),
    ('fortnite', 130),
    ('gabby-s-dollhouse', 140),
    ('gabby-s-poppenhuis', 140),
    ('harry-potter', 150),
    ('icons', 160),
    ('ideas', 170),
    ('jurassic-world', 180),
    ('marvel', 190),
    ('minecraft', 200),
    ('minifigures', 210),
    ('minifiguren', 210),
    ('ninjago', 220),
    ('one-piece', 230),
    ('lego-pokemon-speelgoed-en-sets', 240),
    ('pokemon', 240),
    ('pokémon', 240),
    ('sonic-the-hedgehog', 250),
    ('speed-champions', 260),
    ('star-wars', 270),
    ('super-mario', 280),
    ('technic', 290),
    ('the-legend-of-zelda', 300),
    ('wednesday', 310),
    ('wicked', 320)
),
curated_public_theme_names(display_name, public_order) as (
  values
    ('animal crossing', 10),
    ('architecture', 20),
    ('art', 30),
    ('lego art', 30),
    ('botanicals', 40),
    ('botanical collection', 40),
    ('the botanical collection', 40),
    ('brickheadz', 50),
    ('city', 60),
    ('classic', 70),
    ('creator', 80),
    ('creator 3in1', 80),
    ('creator 3 in 1', 80),
    ('dc', 90),
    ('super heroes dc', 90),
    ('disney', 100),
    ('dreamzzz', 110),
    ('duplo', 120),
    ('fortnite', 130),
    ('gabby s dollhouse', 140),
    ('gabby s poppenhuis', 140),
    ('harry potter', 150),
    ('icons', 160),
    ('lego icons', 160),
    ('ideas', 170),
    ('lego ideas and cuusoo', 170),
    ('jurassic world', 180),
    ('marvel', 190),
    ('super heroes marvel', 190),
    ('minecraft', 200),
    ('minifigures', 210),
    ('collectible minifigures', 210),
    ('minifiguren', 210),
    ('ninjago', 220),
    ('one piece', 230),
    ('pokemon', 240),
    ('pok mon', 240),
    ('pokémon', 240),
    ('lego pokemon speelgoed en sets', 240),
    ('lego pok mon speelgoed en sets', 240),
    ('sonic the hedgehog', 250),
    ('speed champions', 260),
    ('star wars', 270),
    ('super mario', 280),
    ('technic', 290),
    ('the legend of zelda', 300),
    ('wednesday', 310),
    ('wicked', 320)
),
matched_theme_orders as (
  select
    catalog_themes.id,
    min(
      coalesce(
        curated_public_themes.public_order,
        curated_public_theme_names.public_order
      )
    ) as public_order
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
  is_public = true,
  public_order = matched_theme_orders.public_order
from matched_theme_orders
where catalog_themes.id = matched_theme_orders.id;

update public.catalog_themes
set public_order = null
where is_public = false;
