alter table public.profiles
add column if not exists wishlist_deal_alerts boolean not null default true;
