create table if not exists public.rebrickable_themes (
  id integer primary key,
  name text not null,
  parent_id integer null references public.rebrickable_themes(id) on delete set null,
  source_updated_at timestamptz null,
  synced_at timestamptz not null default timezone('utc', now())
);

create index if not exists rebrickable_themes_parent_id_idx
on public.rebrickable_themes(parent_id);

create table if not exists public.rebrickable_sets (
  set_num text primary key,
  name text not null,
  year integer not null check (year >= 1940),
  theme_id integer not null references public.rebrickable_themes(id) on delete restrict,
  num_parts integer not null default 0 check (num_parts >= 0),
  img_url text null,
  set_img_url text null,
  source_updated_at timestamptz null,
  synced_at timestamptz not null default timezone('utc', now())
);

create index if not exists rebrickable_sets_theme_id_idx
on public.rebrickable_sets(theme_id);

create index if not exists rebrickable_sets_canonical_set_id_idx
on public.rebrickable_sets((regexp_replace(set_num, '-[0-9]+$', '')));

alter table public.rebrickable_themes enable row level security;
alter table public.rebrickable_sets enable row level security;

drop policy if exists "rebrickable_themes_service_role_all"
on public.rebrickable_themes;
create policy "rebrickable_themes_service_role_all"
on public.rebrickable_themes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "rebrickable_sets_service_role_all"
on public.rebrickable_sets;
create policy "rebrickable_sets_service_role_all"
on public.rebrickable_sets
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
