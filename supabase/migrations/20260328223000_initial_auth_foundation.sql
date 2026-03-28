create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  collector_handle text not null unique,
  tier text not null default 'Collector',
  location text not null default '',
  collection_focus text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_set_statuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  is_owned boolean not null default false,
  is_wanted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, set_id)
);

create index if not exists user_set_statuses_user_id_idx
on public.user_set_statuses (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_set_statuses_updated_at on public.user_set_statuses;
create trigger set_user_set_statuses_updated_at
before update on public.user_set_statuses
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_set_statuses enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_select_own"
on public.user_set_statuses
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_set_statuses_insert_own"
on public.user_set_statuses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_update_own"
on public.user_set_statuses
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_set_statuses_delete_own"
on public.user_set_statuses
for delete
to authenticated
using ((select auth.uid()) = user_id);
