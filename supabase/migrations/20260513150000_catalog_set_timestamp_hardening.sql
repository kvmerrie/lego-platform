-- Harden catalog_sets timestamps against production schema drift and explicit
-- null payloads during catalog promotion.

create or replace function public.set_missing_catalog_set_timestamps()
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

update public.catalog_sets
set
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where created_at is null
  or updated_at is null;

alter table public.catalog_sets
  alter column created_at set default timezone('utc', now()),
  alter column created_at set not null,
  alter column updated_at set default timezone('utc', now()),
  alter column updated_at set not null;

drop trigger if exists set_catalog_sets_missing_timestamps
on public.catalog_sets;
create trigger set_catalog_sets_missing_timestamps
before insert or update on public.catalog_sets
for each row
execute function public.set_missing_catalog_set_timestamps();

do $$
declare
  created_at_column record;
  updated_at_column record;
begin
  select column_default, is_nullable
  into created_at_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'catalog_sets'
    and column_name = 'created_at';

  select column_default, is_nullable
  into updated_at_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'catalog_sets'
    and column_name = 'updated_at';

  if created_at_column is null or updated_at_column is null then
    raise exception 'catalog_sets timestamp column is missing';
  end if;

  if created_at_column.is_nullable <> 'NO'
    or created_at_column.column_default is null
    or updated_at_column.is_nullable <> 'NO'
    or updated_at_column.column_default is null
  then
    raise exception 'catalog_sets timestamp schema drift remains';
  end if;
end $$;
