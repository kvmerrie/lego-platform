create table if not exists public.recently_viewed_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  viewed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, set_id),
  constraint recently_viewed_sets_set_id_shape check (
    set_id ~ '^[A-Za-z0-9-]+$'
  )
);

comment on table public.recently_viewed_sets is
  'Per-account recently viewed catalog sets. Users can only read and update their own rows.';

create index if not exists recently_viewed_sets_user_viewed_at_idx
on public.recently_viewed_sets (user_id, viewed_at desc);

alter table public.recently_viewed_sets enable row level security;

drop policy if exists "recently_viewed_sets_select_own"
on public.recently_viewed_sets;
create policy "recently_viewed_sets_select_own"
on public.recently_viewed_sets
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "recently_viewed_sets_insert_own"
on public.recently_viewed_sets;
create policy "recently_viewed_sets_insert_own"
on public.recently_viewed_sets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "recently_viewed_sets_update_own"
on public.recently_viewed_sets;
create policy "recently_viewed_sets_update_own"
on public.recently_viewed_sets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "recently_viewed_sets_delete_own"
on public.recently_viewed_sets;
create policy "recently_viewed_sets_delete_own"
on public.recently_viewed_sets
for delete
to authenticated
using ((select auth.uid()) = user_id);
