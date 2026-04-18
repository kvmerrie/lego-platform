create table if not exists public.catalog_source_themes (
  id text primary key,
  source_system text not null check (
    source_system in ('rebrickable')
  ),
  source_theme_name text not null,
  parent_source_theme_id text null references public.catalog_source_themes (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_source_themes_source_system_idx
on public.catalog_source_themes (source_system);

create index if not exists catalog_source_themes_parent_source_theme_id_idx
on public.catalog_source_themes (parent_source_theme_id);

drop trigger if exists set_catalog_source_themes_updated_at
on public.catalog_source_themes;
create trigger set_catalog_source_themes_updated_at
before update on public.catalog_source_themes
for each row
execute function public.set_updated_at();

alter table public.catalog_source_themes enable row level security;

create table if not exists public.catalog_themes (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  status text not null default 'active' check (
    status in ('active', 'inactive')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_themes_status_idx
on public.catalog_themes (status);

drop trigger if exists set_catalog_themes_updated_at
on public.catalog_themes;
create trigger set_catalog_themes_updated_at
before update on public.catalog_themes
for each row
execute function public.set_updated_at();

alter table public.catalog_themes enable row level security;

create table if not exists public.catalog_theme_mappings (
  source_theme_id text primary key references public.catalog_source_themes (id) on delete cascade,
  primary_theme_id text not null references public.catalog_themes (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_theme_mappings_primary_theme_id_idx
on public.catalog_theme_mappings (primary_theme_id);

drop trigger if exists set_catalog_theme_mappings_updated_at
on public.catalog_theme_mappings;
create trigger set_catalog_theme_mappings_updated_at
before update on public.catalog_theme_mappings
for each row
execute function public.set_updated_at();

alter table public.catalog_theme_mappings enable row level security;

alter table public.catalog_sets_overlay
add column if not exists source_theme_id text null references public.catalog_source_themes (id) on delete set null;

alter table public.catalog_sets_overlay
add column if not exists primary_theme_id text null references public.catalog_themes (id) on delete set null;

create index if not exists catalog_sets_overlay_source_theme_id_idx
on public.catalog_sets_overlay (source_theme_id);

create index if not exists catalog_sets_overlay_primary_theme_id_idx
on public.catalog_sets_overlay (primary_theme_id);
