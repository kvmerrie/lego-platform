create table if not exists public.public_page_sections (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null,
  title text not null,
  subtitle text null,
  layout text null,
  sort_order integer not null default 100,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint public_page_sections_page_section_key unique (page_key, section_key)
);

create table if not exists public.public_page_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.public_page_sections(id) on delete cascade,
  reference_type text not null default 'custom',
  reference_id text null,
  image_set_id text null,
  image_url text null,
  title_override text null,
  alt_override text null,
  cta_label text null,
  cta_url text null,
  sort_order integer not null default 100,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint public_page_section_items_reference_type_check
    check (reference_type in ('theme', 'set', 'collection', 'custom'))
);

create index if not exists public_page_sections_page_sort_idx
on public.public_page_sections (page_key, enabled, sort_order);

create index if not exists public_page_section_items_section_sort_idx
on public.public_page_section_items (section_id, enabled, sort_order);

drop trigger if exists set_public_page_sections_updated_at
on public.public_page_sections;
create trigger set_public_page_sections_updated_at
before update on public.public_page_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_public_page_section_items_updated_at
on public.public_page_section_items;
create trigger set_public_page_section_items_updated_at
before update on public.public_page_section_items
for each row execute function public.set_updated_at();

alter table public.public_page_sections enable row level security;
alter table public.public_page_section_items enable row level security;

drop policy if exists "public_page_sections_select_enabled"
on public.public_page_sections;
create policy "public_page_sections_select_enabled"
on public.public_page_sections
for select
using (enabled = true);

drop policy if exists "public_page_section_items_select_enabled"
on public.public_page_section_items;
create policy "public_page_section_items_select_enabled"
on public.public_page_section_items
for select
using (
  enabled = true
  and exists (
    select 1
    from public.public_page_sections
    where public_page_sections.id = public_page_section_items.section_id
      and public_page_sections.enabled = true
  )
);

with upsert_sections(section_key, title, subtitle, layout, sort_order, enabled, metadata_json) as (
  values
    (
      'discovery_routes',
      'Ontdek LEGO op jouw manier',
      'Kies meteen de route die bij je kast past: nieuw, volwassen, budget, bijna weg of gewoon een scherpe prijs.',
      'visual_tile_rail',
      10,
      true,
      '{}'::jsonb
    ),
    (
      'theme_rail',
      'Fantasy, Star Wars of strak design?',
      null,
      'theme_rail',
      20,
      true,
      '{}'::jsonb
    ),
    (
      'theme_spotlight',
      'Botanicals, kunst of modulaire straten?',
      null,
      'theme_spotlight',
      60,
      true,
      '{}'::jsonb
    )
)
insert into public.public_page_sections (
  page_key,
  section_key,
  title,
  subtitle,
  layout,
  sort_order,
  enabled,
  metadata_json
)
select
  'homepage',
  section_key,
  title,
  subtitle,
  layout,
  sort_order,
  enabled,
  metadata_json
from upsert_sections
on conflict (page_key, section_key)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  layout = excluded.layout,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled,
  metadata_json = public.public_page_sections.metadata_json;

with theme_rail_section as (
  select id
  from public.public_page_sections
  where page_key = 'homepage'
    and section_key = 'theme_rail'
),
seed_items(reference_id, image_set_id, title_override, sort_order) as (
  values
    ('star-wars', '75419', 'Death Star', 10),
    ('marvel', '76269', 'Avengers toren', 20),
    ('harry-potter', '76417', 'Goudgrijp Tovenaarsbank - Verzameleditie', 30),
    ('icons', '11384', 'Golden retriever puppy', 40),
    ('disney', '43222', 'Disney Castle', 50),
    ('technic', '42172', 'McLaren P1', 60)
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
  theme_rail_section.id,
  'theme',
  seed_items.reference_id,
  seed_items.image_set_id,
  seed_items.title_override,
  seed_items.sort_order,
  true,
  '{}'::jsonb
from theme_rail_section
cross join seed_items
where not exists (
  select 1
  from public.public_page_section_items existing_items
  where existing_items.section_id = theme_rail_section.id
);
