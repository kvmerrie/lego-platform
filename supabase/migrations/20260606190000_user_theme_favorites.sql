create table if not exists public.user_theme_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null references public.catalog_themes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, theme_id)
);

create index if not exists user_theme_favorites_user_created_idx
on public.user_theme_favorites (user_id, created_at desc);

create index if not exists user_theme_favorites_theme_id_idx
on public.user_theme_favorites (theme_id);

alter table public.user_theme_favorites enable row level security;

drop policy if exists "user_theme_favorites_select_own"
on public.user_theme_favorites;
create policy "user_theme_favorites_select_own"
on public.user_theme_favorites
for select
using (auth.uid() = user_id);

drop policy if exists "user_theme_favorites_insert_own"
on public.user_theme_favorites;
create policy "user_theme_favorites_insert_own"
on public.user_theme_favorites
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_theme_favorites_delete_own"
on public.user_theme_favorites;
create policy "user_theme_favorites_delete_own"
on public.user_theme_favorites
for delete
using (auth.uid() = user_id);
