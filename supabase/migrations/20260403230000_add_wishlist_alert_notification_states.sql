create table if not exists public.wishlist_alert_notification_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  last_notified_kind text not null,
  last_notified_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, set_id)
);

create index if not exists wishlist_alert_notification_states_user_id_idx
on public.wishlist_alert_notification_states (user_id);

drop trigger if exists set_wishlist_alert_notification_states_updated_at
on public.wishlist_alert_notification_states;

create trigger set_wishlist_alert_notification_states_updated_at
before update on public.wishlist_alert_notification_states
for each row
execute function public.set_updated_at();

alter table public.wishlist_alert_notification_states enable row level security;

create policy "wishlist_alert_notification_states_select_own"
on public.wishlist_alert_notification_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_insert_own"
on public.wishlist_alert_notification_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_update_own"
on public.wishlist_alert_notification_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "wishlist_alert_notification_states_delete_own"
on public.wishlist_alert_notification_states
for delete
to authenticated
using ((select auth.uid()) = user_id);
