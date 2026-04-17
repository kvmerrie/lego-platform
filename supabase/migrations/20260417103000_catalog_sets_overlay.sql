create table if not exists public.catalog_sets_overlay (
  set_id text primary key,
  source_set_number text not null,
  slug text not null unique,
  name text not null,
  theme text not null,
  release_year integer not null check (release_year >= 1940),
  piece_count integer not null check (piece_count > 0),
  image_url text null,
  source text not null default 'rebrickable' check (
    source in ('rebrickable')
  ),
  status text not null default 'active' check (
    status in ('active', 'inactive')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_sets_overlay_status_idx
on public.catalog_sets_overlay (status);

create index if not exists catalog_sets_overlay_theme_idx
on public.catalog_sets_overlay (theme);

drop trigger if exists set_catalog_sets_overlay_updated_at
on public.catalog_sets_overlay;
create trigger set_catalog_sets_overlay_updated_at
before update on public.catalog_sets_overlay
for each row
execute function public.set_updated_at();

alter table public.catalog_sets_overlay enable row level security;
