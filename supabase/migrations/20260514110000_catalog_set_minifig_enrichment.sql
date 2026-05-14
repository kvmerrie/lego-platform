create table if not exists public.catalog_set_minifig_summaries (
  set_id text primary key references public.catalog_sets(set_id) on delete cascade,
  source_system text not null default 'rebrickable' check (
    source_system in ('rebrickable')
  ),
  minifig_count integer not null default 0 check (minifig_count >= 0),
  source_minifig_count integer null check (
    source_minifig_count is null or source_minifig_count >= 0
  ),
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_set_minifig_summaries_source_system_idx
on public.catalog_set_minifig_summaries (source_system);

create index if not exists catalog_set_minifig_summaries_synced_at_idx
on public.catalog_set_minifig_summaries (synced_at desc);

drop trigger if exists set_catalog_set_minifig_summaries_updated_at
on public.catalog_set_minifig_summaries;
create trigger set_catalog_set_minifig_summaries_updated_at
before update on public.catalog_set_minifig_summaries
for each row
execute function public.set_updated_at();

create table if not exists public.catalog_set_minifigs (
  id text primary key,
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  source_system text not null default 'rebrickable' check (
    source_system in ('rebrickable')
  ),
  source_set_number text not null,
  source_minifig_number text not null,
  quantity integer not null default 1 check (quantity > 0),
  name text null,
  image_url text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_system, source_set_number, source_minifig_number)
);

create index if not exists catalog_set_minifigs_set_id_idx
on public.catalog_set_minifigs (set_id);

create index if not exists catalog_set_minifigs_source_set_number_idx
on public.catalog_set_minifigs (source_system, source_set_number);

create index if not exists catalog_set_minifigs_source_minifig_number_idx
on public.catalog_set_minifigs (source_system, source_minifig_number);

drop trigger if exists set_catalog_set_minifigs_updated_at
on public.catalog_set_minifigs;
create trigger set_catalog_set_minifigs_updated_at
before update on public.catalog_set_minifigs
for each row
execute function public.set_updated_at();

alter table public.catalog_set_minifig_summaries enable row level security;
alter table public.catalog_set_minifigs enable row level security;

drop policy if exists "catalog_set_minifig_summaries_select_public"
on public.catalog_set_minifig_summaries;
create policy "catalog_set_minifig_summaries_select_public"
on public.catalog_set_minifig_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_sets
    where catalog_sets.set_id = catalog_set_minifig_summaries.set_id
      and catalog_sets.status = 'active'
  )
);

drop policy if exists "catalog_set_minifigs_select_public"
on public.catalog_set_minifigs;
create policy "catalog_set_minifigs_select_public"
on public.catalog_set_minifigs
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_sets
    where catalog_sets.set_id = catalog_set_minifigs.set_id
      and catalog_sets.status = 'active'
  )
);
