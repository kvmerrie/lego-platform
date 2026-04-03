alter table public.profiles
add column if not exists wishlist_alerts_last_viewed_at timestamptz;
