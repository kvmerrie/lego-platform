create index if not exists commerce_offer_seeds_merchant_set_idx
on public.commerce_offer_seeds (merchant_id, set_id);

create index if not exists commerce_offer_seeds_merchant_product_url_idx
on public.commerce_offer_seeds (merchant_id, product_url);

create index if not exists commerce_offer_latest_fetch_status_availability_idx
on public.commerce_offer_latest (fetch_status, availability);

create index if not exists commerce_current_offer_snapshots_best_merchant_slug_idx
on public.commerce_current_offer_snapshots (best_merchant_slug)
where best_merchant_slug is not null;
