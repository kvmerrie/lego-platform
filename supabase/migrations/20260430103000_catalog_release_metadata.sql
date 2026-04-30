alter table public.catalog_sets
add column if not exists release_date date null;

alter table public.catalog_sets
add column if not exists release_date_precision text;

update public.catalog_sets
set release_date_precision = case
  when release_date is not null then 'day'
  when release_year is not null then 'year'
  else 'unknown'
end
where release_date_precision is null;

alter table public.catalog_sets
alter column release_year drop not null;

alter table public.catalog_sets
alter column release_date_precision set default 'unknown';

alter table public.catalog_sets
alter column release_date_precision set not null;

alter table public.catalog_sets
drop constraint if exists catalog_sets_release_date_precision_check;

alter table public.catalog_sets
add constraint catalog_sets_release_date_precision_check check (
  release_date_precision in ('day', 'month', 'year', 'unknown')
);
