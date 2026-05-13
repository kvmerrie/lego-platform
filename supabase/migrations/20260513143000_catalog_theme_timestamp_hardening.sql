-- Harden catalog theme timestamp columns against production schema drift and
-- explicit null upsert payloads from older promote runtimes.
--
-- Expected canonical shape:
-- - created_at timestamptz not null default timezone('utc', now())
-- - updated_at timestamptz not null default timezone('utc', now())
-- - null insert/update payloads are normalized before NOT NULL constraints run.

create or replace function public.set_missing_catalog_theme_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = timezone('utc', now());
  end if;

  if new.updated_at is null then
    new.updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

update public.catalog_source_themes
set
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where created_at is null
  or updated_at is null;

alter table public.catalog_source_themes
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now()),
  alter column created_at set not null,
  alter column updated_at set not null;

drop trigger if exists set_catalog_source_themes_missing_timestamps
on public.catalog_source_themes;

create trigger set_catalog_source_themes_missing_timestamps
before insert or update on public.catalog_source_themes
for each row
execute function public.set_missing_catalog_theme_timestamps();

update public.catalog_themes
set
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where created_at is null
  or updated_at is null;

alter table public.catalog_themes
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now()),
  alter column created_at set not null,
  alter column updated_at set not null;

drop trigger if exists set_catalog_themes_missing_timestamps
on public.catalog_themes;

create trigger set_catalog_themes_missing_timestamps
before insert or update on public.catalog_themes
for each row
execute function public.set_missing_catalog_theme_timestamps();

update public.catalog_theme_mappings
set
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where created_at is null
  or updated_at is null;

alter table public.catalog_theme_mappings
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now()),
  alter column created_at set not null,
  alter column updated_at set not null;

drop trigger if exists set_catalog_theme_mappings_missing_timestamps
on public.catalog_theme_mappings;

create trigger set_catalog_theme_mappings_missing_timestamps
before insert or update on public.catalog_theme_mappings
for each row
execute function public.set_missing_catalog_theme_timestamps();

do $$
declare
  drifted_columns text[];
begin
  select array_agg(format('%I.%I', table_name, column_name) order by table_name, column_name)
  into drifted_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'catalog_source_themes',
      'catalog_themes',
      'catalog_theme_mappings'
    )
    and column_name in ('created_at', 'updated_at')
    and (
      is_nullable <> 'NO'
      or column_default is null
    );

  if drifted_columns is not null then
    raise exception 'Catalog theme timestamp schema drift remains: %', drifted_columns;
  end if;
end;
$$;
