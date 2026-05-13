-- Harden catalog_themes.is_public against production schema drift and explicit
-- null upsert payloads. Null visibility must be conservative: private.

create or replace function public.set_missing_catalog_theme_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.is_public is null then
    new.is_public = false;
  end if;

  return new;
end;
$$;

update public.catalog_themes
set is_public = false
where is_public is null;

alter table public.catalog_themes
  alter column is_public set default false,
  alter column is_public set not null;

drop trigger if exists set_catalog_themes_missing_visibility
on public.catalog_themes;

create trigger set_catalog_themes_missing_visibility
before insert or update on public.catalog_themes
for each row
execute function public.set_missing_catalog_theme_visibility();

do $$
declare
  is_public_column record;
begin
  select
    column_default,
    is_nullable
  into is_public_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'catalog_themes'
    and column_name = 'is_public';

  if is_public_column is null then
    raise exception 'catalog_themes.is_public column is missing';
  end if;

  if is_public_column.is_nullable <> 'NO'
    or is_public_column.column_default is null
  then
    raise exception 'catalog_themes.is_public schema drift remains';
  end if;
end;
$$;
