create table if not exists public.catalog_theme_summaries (
  theme_id text primary key references public.catalog_themes (id) on delete cascade,
  active_set_count integer not null default 0,
  representative_set_id text null references public.catalog_sets (set_id) on delete set null,
  representative_image_url text null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.refresh_catalog_theme_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.catalog_theme_summaries (
    theme_id,
    active_set_count,
    representative_set_id,
    representative_image_url,
    updated_at
  )
  select
    catalog_themes.id as theme_id,
    count(catalog_sets.set_id)::integer as active_set_count,
    (
      array_agg(
        catalog_sets.set_id
        order by
          catalog_sets.release_year desc nulls last,
          catalog_sets.name asc,
          catalog_sets.set_id asc
      ) filter (where catalog_sets.set_id is not null)
    )[1] as representative_set_id,
    (
      array_agg(
        catalog_sets.image_url
        order by
          catalog_sets.release_year desc nulls last,
          catalog_sets.name asc,
          catalog_sets.set_id asc
      ) filter (
        where catalog_sets.set_id is not null
          and nullif(trim(catalog_sets.image_url), '') is not null
      )
    )[1] as representative_image_url,
    timezone('utc', now()) as updated_at
  from public.catalog_themes
  left join public.catalog_sets
    on catalog_sets.primary_theme_id = catalog_themes.id
    and catalog_sets.status = 'active'
  group by catalog_themes.id
  on conflict (theme_id) do update
  set
    active_set_count = excluded.active_set_count,
    representative_set_id = excluded.representative_set_id,
    representative_image_url = excluded.representative_image_url,
    updated_at = excluded.updated_at;

  delete from public.catalog_theme_summaries
  where not exists (
    select 1
    from public.catalog_themes
    where catalog_themes.id = catalog_theme_summaries.theme_id
  );
end;
$$;

select public.refresh_catalog_theme_summaries();

revoke all on function public.refresh_catalog_theme_summaries() from public;
grant execute on function public.refresh_catalog_theme_summaries() to service_role;

alter table public.catalog_theme_summaries enable row level security;

create policy "catalog_theme_summaries_select_public"
on public.catalog_theme_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_themes
    where catalog_themes.id = catalog_theme_summaries.theme_id
      and catalog_themes.status = 'active'
      and catalog_themes.is_public = true
  )
);
