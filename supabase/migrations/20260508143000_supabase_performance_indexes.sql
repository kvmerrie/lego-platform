create index if not exists catalog_sets_status_created_at_desc_idx
on public.catalog_sets (status, created_at desc);

create index if not exists catalog_sets_piece_count_updated_at_asc_idx
on public.catalog_sets (piece_count, updated_at asc);

create index if not exists commerce_offer_seeds_active_valid_set_merchant_idx
on public.commerce_offer_seeds (set_id, merchant_id)
where is_active = true and validation_status = 'valid';

create index if not exists commerce_offer_latest_success_eur_updated_idx
on public.commerce_offer_latest (fetch_status, currency_code, updated_at desc)
where fetch_status = 'success' and currency_code = 'EUR';

create index if not exists commerce_affiliate_sets_merchant_status_seen_idx
on public.commerce_affiliate_discovered_sets (merchant_id, status, last_seen_at desc);

create index if not exists pricing_daily_set_history_nl_eur_new_set_recorded_on_idx
on public.pricing_daily_set_history (set_id, recorded_on desc)
where region_code = 'NL' and currency_code = 'EUR' and condition = 'new';
