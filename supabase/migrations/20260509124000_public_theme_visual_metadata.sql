with curated_theme_visuals(slug, accent_color) as (
  values
    ('editions', '#e0b84f'),
    ('fortnite', '#6f4bd8'),
    ('gabby-s-dollhouse', '#ef8fc0'),
    ('gabby-s-poppenhuis', '#ef8fc0'),
    ('collectible-minifigures', '#f2c84b'),
    ('minifigures', '#f2c84b'),
    ('one-piece', '#d84f45'),
    ('pokemon', '#f0c63b'),
    ('sonic-the-hedgehog', '#2e65c8'),
    ('wicked', '#2f8a64')
)
update public.catalog_themes
set public_accent_color = curated_theme_visuals.accent_color
from curated_theme_visuals
where catalog_themes.slug = curated_theme_visuals.slug
  and nullif(trim(catalog_themes.public_accent_color), '') is null;

update public.catalog_themes
set public_image_url = catalog_sets.image_url
from public.catalog_sets
where catalog_themes.slug = 'editions'
  and catalog_sets.set_id = '43020'
  and nullif(trim(catalog_sets.image_url), '') is not null
  and nullif(trim(catalog_themes.public_image_url), '') is null;
