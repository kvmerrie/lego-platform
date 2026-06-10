do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'catalog_set_review_moderation_status'
  ) then
    create type public.catalog_set_review_moderation_status
    as enum ('pending', 'approved', 'rejected', 'hidden');
  end if;
end $$;

create table if not exists public.catalog_set_reviews (
  id uuid primary key default gen_random_uuid(),
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  recommends boolean null,
  review_text text null check (
    review_text is null or char_length(review_text) <= 4000
  ),
  moderation_status public.catalog_set_review_moderation_status not null default 'pending',
  moderation_reason text null,
  moderated_at timestamptz null,
  moderated_by uuid null references auth.users(id) on delete set null,
  build_experience_rating smallint null check (
    build_experience_rating between 1 and 5
  ),
  play_experience_rating smallint null check (
    play_experience_rating between 1 and 5
  ),
  value_for_money_rating smallint null check (
    value_for_money_rating between 1 and 5
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  constraint catalog_set_reviews_one_per_user_set unique (set_id, user_id)
);

create index if not exists catalog_set_reviews_set_public_idx
on public.catalog_set_reviews (
  set_id,
  moderation_status,
  deleted_at,
  created_at desc
);

create index if not exists catalog_set_reviews_user_idx
on public.catalog_set_reviews (user_id, created_at desc);

drop trigger if exists set_catalog_set_reviews_updated_at
on public.catalog_set_reviews;

create trigger set_catalog_set_reviews_updated_at
before update on public.catalog_set_reviews
for each row
execute function public.set_updated_at();

alter table public.catalog_set_reviews enable row level security;

drop policy if exists "catalog_set_reviews_select_approved"
on public.catalog_set_reviews;

create policy "catalog_set_reviews_select_approved"
on public.catalog_set_reviews
for select
to anon, authenticated
using (
  moderation_status = 'approved'
  and deleted_at is null
);

drop policy if exists "catalog_set_reviews_select_own"
on public.catalog_set_reviews;

create policy "catalog_set_reviews_select_own"
on public.catalog_set_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "catalog_set_reviews_insert_own"
on public.catalog_set_reviews;

create policy "catalog_set_reviews_insert_own"
on public.catalog_set_reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and moderation_status = 'pending'
  and deleted_at is null
);

drop policy if exists "catalog_set_reviews_update_own"
on public.catalog_set_reviews;

create policy "catalog_set_reviews_update_own"
on public.catalog_set_reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and moderation_status = 'pending'
);

create or replace view public.catalog_set_review_summaries as
select
  set_id,
  count(*)::integer as review_count,
  round(avg(overall_rating)::numeric, 2) as average_rating,
  count(*) filter (where recommends is true)::integer as recommend_count,
  jsonb_build_object(
    '1', count(*) filter (where overall_rating = 1),
    '2', count(*) filter (where overall_rating = 2),
    '3', count(*) filter (where overall_rating = 3),
    '4', count(*) filter (where overall_rating = 4),
    '5', count(*) filter (where overall_rating = 5)
  ) as rating_distribution
from public.catalog_set_reviews
where moderation_status = 'approved'
  and deleted_at is null
group by set_id;

grant select on public.catalog_set_review_summaries to anon, authenticated;
