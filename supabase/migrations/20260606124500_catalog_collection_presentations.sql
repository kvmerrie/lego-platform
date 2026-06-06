create table if not exists public.catalog_collection_presentations (
  collection_slug text primary key,
  public_display_name text null,
  public_description text null,
  public_image_url text null,
  public_logo_url text null,
  public_accent_color text null,
  public_surface_color text null,
  public_surface_text_color text null,
  public_hero_text_color text null,
  public_order integer null,
  public_homepage_order integer null,
  is_public boolean not null default true,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint catalog_collection_presentations_status_check
    check (status in ('active', 'inactive'))
);

create index if not exists catalog_collection_presentations_public_idx
on public.catalog_collection_presentations (
  is_public,
  status,
  public_homepage_order,
  public_order,
  collection_slug
);

drop trigger if exists set_catalog_collection_presentations_updated_at
on public.catalog_collection_presentations;
create trigger set_catalog_collection_presentations_updated_at
before update on public.catalog_collection_presentations
for each row execute function public.set_updated_at();

alter table public.catalog_collection_presentations enable row level security;

drop policy if exists "catalog_collection_presentations_select_public"
on public.catalog_collection_presentations;
create policy "catalog_collection_presentations_select_public"
on public.catalog_collection_presentations
for select
using (is_public = true and status = 'active');

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
values
  (
    'nieuwe-lego-sets',
    'Nieuwe sets',
    'Nieuw binnen en meteen het bekijken waard.',
    'https://cdn.rebrickable.com/media/sets/43019-1/167522.jpg',
    '#3aaee8',
    '#3aaee8',
    '#08243a',
    '#08243a',
    10,
    10,
    true,
    'active',
    '{}'::jsonb
  ),
  (
    'lego-voor-volwassenen',
    'LEGO voor volwassenen',
    'Displaysets, grote gebouwen en modellen waar je langer naar blijft kijken.',
    'https://cdn.rebrickable.com/media/sets/10360-1/155899.jpg',
    '#08636f',
    '#08636f',
    '#ffffff',
    '#ffffff',
    20,
    20,
    true,
    'active',
    '{}'::jsonb
  ),
  (
    'lego-sets-onder-50-euro',
    'LEGO sets onder EUR 50',
    'Compacte dozen die wel iets doen op je plank.',
    'https://cdn.rebrickable.com/media/sets/77256-1/162075.jpg',
    '#35b765',
    '#35b765',
    '#062817',
    '#062817',
    30,
    30,
    true,
    'active',
    '{}'::jsonb
  ),
  (
    'lego-sets-onder-100-euro',
    'LEGO sets onder EUR 100',
    'Herkenbare schepen, gebouwen en displaymodellen tot 100 euro.',
    'https://cdn.rebrickable.com/media/sets/75405-1/163908.jpg',
    '#00a99d',
    '#00a99d',
    '#062927',
    '#062927',
    40,
    40,
    true,
    'active',
    '{}'::jsonb
  ),
  (
    'retiring-lego-sets',
    'Binnenkort uit handel',
    'Sets die je niet te lang wilt laten liggen.',
    'https://cdn.rebrickable.com/media/sets/75355-1/119795.jpg',
    '#f28c28',
    '#f28c28',
    '#281400',
    '#281400',
    50,
    50,
    true,
    'active',
    '{}'::jsonb
  ),
  (
    'deals',
    'Interessante deals',
    'Actuele prijzen met een route naar een winkel.',
    'https://cdn.rebrickable.com/media/sets/42207-1/148295.jpg',
    '#00a99d',
    '#00a99d',
    '#062927',
    '#062927',
    60,
    60,
    true,
    'active',
    '{}'::jsonb
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
  is_public = public.catalog_collection_presentations.is_public,
  status = public.catalog_collection_presentations.status,
  metadata_json = public.catalog_collection_presentations.metadata_json;

with discovery_section as (
  select id
  from public.public_page_sections
  where page_key = 'homepage'
    and section_key = 'discovery_routes'
),
seed_items(reference_type, reference_id, image_set_id, image_url, title_override, sort_order, metadata_json) as (
  values
    ('collection', 'nieuwe-lego-sets', null, 'https://cdn.rebrickable.com/media/sets/43019-1/167522.jpg', 'Nieuwe sets', 10, '{"description":"Nieuw binnen en meteen het bekijken waard."}'::jsonb),
    ('collection', 'lego-voor-volwassenen', null, 'https://cdn.rebrickable.com/media/sets/10360-1/155899.jpg', 'LEGO voor volwassenen', 20, '{"description":"Displaysets, grote gebouwen en modellen waar je langer naar blijft kijken."}'::jsonb),
    ('collection', 'lego-sets-onder-50-euro', null, 'https://cdn.rebrickable.com/media/sets/77256-1/162075.jpg', 'LEGO sets onder EUR 50', 30, '{"description":"Compacte dozen die wel iets doen op je plank."}'::jsonb),
    ('collection', 'retiring-lego-sets', null, 'https://cdn.rebrickable.com/media/sets/75355-1/119795.jpg', 'Binnenkort uit handel', 40, '{"description":"Sets die je niet te lang wilt laten liggen."}'::jsonb),
    ('custom', 'deals', null, 'https://cdn.rebrickable.com/media/sets/42207-1/148295.jpg', 'Interessante deals', 50, '{"description":"Actuele prijzen met een route naar een winkel.","href":"/deals","surfaceColor":"#00a99d","surfaceTextColor":"#062927"}'::jsonb),
    ('custom', 'themes', null, 'https://cdn.rebrickable.com/media/sets/72037-1/153296.jpg', 'Populaire thema''s', 60, '{"description":"Begin bij Star Wars, Icons, Technic of je volgende plankthema.","href":"/themes","surfaceColor":"#8758d8","surfaceTextColor":"#ffffff"}'::jsonb)
)
insert into public.public_page_section_items (
  section_id,
  reference_type,
  reference_id,
  image_set_id,
  image_url,
  title_override,
  sort_order,
  enabled,
  metadata_json
)
select
  discovery_section.id,
  seed_items.reference_type,
  seed_items.reference_id,
  seed_items.image_set_id,
  seed_items.image_url,
  seed_items.title_override,
  seed_items.sort_order,
  true,
  seed_items.metadata_json
from discovery_section
cross join seed_items
where not exists (
  select 1
  from public.public_page_section_items existing_items
  where existing_items.section_id = discovery_section.id
);

with spotlight_section as (
  select id
  from public.public_page_sections
  where page_key = 'homepage'
    and section_key = 'theme_spotlight'
),
seed_items(reference_type, reference_id, image_set_id, title_override, sort_order, metadata_json) as (
  values
    ('theme', 'botanicals', '10329', 'Botanicals', 10, '{"description":"Kies deze als je kleur en vorm op je plank wilt."}'::jsonb),
    ('theme', 'art', '31215', 'Kunst voor aan de muur', 20, '{"description":"Voor display waar je niet elke dag stof van een minifig hoeft te halen."}'::jsonb),
    ('theme', 'architecture', '21063', 'Strakke gebouwen', 30, '{"description":"Goed als je liever lijnen en skylines verzamelt."}'::jsonb),
    ('collection', 'lego-sets-onder-100-euro', '75405', 'Goede keuzes tot 100 euro', 40, '{"description":"Herkenbare modellen zonder direct topbudget."}'::jsonb)
)
insert into public.public_page_section_items (
  section_id,
  reference_type,
  reference_id,
  image_set_id,
  title_override,
  sort_order,
  enabled,
  metadata_json
)
select
  spotlight_section.id,
  seed_items.reference_type,
  seed_items.reference_id,
  seed_items.image_set_id,
  seed_items.title_override,
  seed_items.sort_order,
  true,
  seed_items.metadata_json
from spotlight_section
cross join seed_items
where not exists (
  select 1
  from public.public_page_section_items existing_items
  where existing_items.section_id = spotlight_section.id
);
