alter table public.catalog_themes
add column if not exists public_homepage_order integer null;

create index if not exists catalog_themes_public_homepage_order_idx
on public.catalog_themes (public_homepage_order)
where is_public = true and status = 'active';

with homepage_theme_order(theme_id, slug, public_homepage_order) as (
  values
    ('theme:star-wars', 'star-wars', 10),
    ('theme:marvel', 'marvel', 20),
    ('theme:harry-potter', 'harry-potter', 30),
    ('theme:icons', 'icons', 40),
    ('theme:disney', 'disney', 50),
    ('theme:technic', 'technic', 60)
)
update public.catalog_themes
set
  public_homepage_order = homepage_theme_order.public_homepage_order,
  updated_at = timezone('utc', now())
from homepage_theme_order
where catalog_themes.id = homepage_theme_order.theme_id
  or catalog_themes.slug = homepage_theme_order.slug;
