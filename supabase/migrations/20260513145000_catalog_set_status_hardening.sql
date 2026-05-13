-- Harden catalog_sets.status against production schema drift and explicit null
-- payloads during catalog promotion. Null source statuses are treated as active;
-- this preserves the existing visibility model while making the default explicit.

create or replace function public.set_missing_catalog_set_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or btrim(new.status) = '' then
    new.status = 'active';
  end if;

  return new;
end;
$$;

update public.catalog_sets
set status = 'active'
where status is null
  or btrim(status) = '';

alter table public.catalog_sets
  alter column status set default 'active',
  alter column status set not null;

drop trigger if exists set_catalog_sets_missing_status
on public.catalog_sets;
create trigger set_catalog_sets_missing_status
before insert or update on public.catalog_sets
for each row
execute function public.set_missing_catalog_set_status();

do $$
declare
  status_column record;
begin
  select column_default, is_nullable
  into status_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'catalog_sets'
    and column_name = 'status';

  if status_column is null then
    raise exception 'catalog_sets.status column is missing';
  end if;

  if status_column.is_nullable <> 'NO'
    or status_column.column_default is null
  then
    raise exception 'catalog_sets.status schema drift remains';
  end if;
end $$;
