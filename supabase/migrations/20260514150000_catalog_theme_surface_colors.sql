alter table public.catalog_themes
add column if not exists public_accent_color text null;

alter table public.catalog_themes
add column if not exists public_surface_color text null;

alter table public.catalog_themes
add column if not exists public_surface_text_color text null;

alter table public.catalog_themes
add column if not exists public_hero_text_color text null;

with former_theme_visuals(slug, surface_color, text_color) as (
  values
    ('animal-crossing', '#6bbf59', '#10241f'),
    ('architecture', '#6f8594', '#ffffff'),
    ('art', '#d26d53', '#ffffff'),
    ('botanicals', '#7caf76', '#10241f'),
    ('brickheadz', '#e88b57', '#171a22'),
    ('bricklink-designer-program', '#3b82b8', '#ffffff'),
    ('city', '#2f7fc0', '#ffffff'),
    ('classic', '#f2d35b', '#171a22'),
    ('creator', '#7b8bb8', '#ffffff'),
    ('dc', '#345d9d', '#ffffff'),
    ('disney', '#6483d8', '#ffffff'),
    ('dreamzzz', '#7d6ad6', '#ffffff'),
    ('duplo', '#f26d4c', '#171a22'),
    ('editions', '#e0b84f', '#171a22'),
    ('fortnite', '#6f4bd8', '#ffffff'),
    ('friends', '#ef8fc0', '#171a22'),
    ('gabby-s-dollhouse', '#ef8fc0', '#171a22'),
    ('gabby-s-poppenhuis', '#ef8fc0', '#171a22'),
    ('harry-potter', '#7f67bf', '#ffffff'),
    ('harrypotter', '#7f67bf', '#ffffff'),
    ('ideas', '#68b8a0', '#10241f'),
    ('icons', '#f0c63b', '#171a22'),
    ('jurassic-world', '#5f7b70', '#ffffff'),
    ('lord-of-the-rings', '#24362f', '#ffffff'),
    ('marvel', '#cf554c', '#ffffff'),
    ('minecraft', '#5f8a4b', '#ffffff'),
    ('collectible-minifigures', '#f2c84b', '#171a22'),
    ('minifigures', '#f2c84b', '#171a22'),
    ('ninjago', '#bf4b47', '#ffffff'),
    ('nike', '#171a22', '#ffffff'),
    ('one-piece', '#d84f45', '#ffffff'),
    ('pokemon', '#f0c63b', '#1f4f9c'),
    ('seasonal', '#c84f46', '#ffffff'),
    ('sonic-the-hedgehog', '#2e65c8', '#ffffff'),
    ('speed-champions', '#3c5f96', '#ffffff'),
    ('star-wars', '#5573b5', '#ffffff'),
    ('super-mario', '#d85a50', '#ffffff'),
    ('technic', '#a8b4c2', '#171a22'),
    ('the-legend-of-zelda', '#4d8b72', '#ffffff'),
    ('zelda', '#4d8b72', '#ffffff'),
    ('wednesday', '#5d6170', '#ffffff'),
    ('wicked', '#2f8a64', '#ffffff')
)
update public.catalog_themes
set
  public_accent_color = coalesce(
    nullif(trim(catalog_themes.public_accent_color), ''),
    former_theme_visuals.surface_color
  ),
  public_surface_color = former_theme_visuals.surface_color,
  public_surface_text_color = former_theme_visuals.text_color,
  public_hero_text_color = former_theme_visuals.text_color,
  updated_at = timezone('utc', now())
from former_theme_visuals
where catalog_themes.slug = former_theme_visuals.slug;
