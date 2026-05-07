alter table public.commerce_affiliate_discovered_sets
add column if not exists import_attempted_at timestamptz null,
add column if not exists import_error text null;

create index if not exists commerce_affiliate_discovered_sets_import_retry_idx
on public.commerce_affiliate_discovered_sets (status, import_attempted_at desc)
where import_error is not null;
