create or replace function public.list_catalog_current_offer_candidate_set_ids(
  candidate_limit integer default 240
)
returns table(set_id text)
language sql
stable
set search_path = public
as $$
  with normalized_limit as (
    select least(greatest(coalesce(candidate_limit, 240), 1), 500) as value
  ),
  eligible_offers as (
    select
      seeds.set_id,
      latest.price_minor,
      coalesce(latest.observed_at, latest.fetched_at, latest.updated_at) as checked_at
    from public.commerce_offer_latest latest
    join public.commerce_offer_seeds seeds
      on seeds.id = latest.offer_seed_id
    join public.commerce_merchants merchants
      on merchants.id = seeds.merchant_id
    where latest.fetch_status = 'success'
      and latest.currency_code = 'EUR'
      and latest.price_minor > 0
      and latest.availability in ('in_stock', 'limited')
      and coalesce(latest.observed_at, latest.fetched_at, latest.updated_at) is not null
      and seeds.is_active = true
      and seeds.validation_status = 'valid'
      and length(coalesce(seeds.product_url, '')) > 0
      and merchants.is_active = true
      and merchants.slug in (
        'goodbricks',
        'mediamarkt',
        'alternate',
        'coolblue',
        'misterbricks',
        'lidl',
        'conrad'
      )
      and not (
        coalesce(seeds.notes, '') || ' ' || coalesce(seeds.product_url, '')
      ) ~* '\m(magazine|tijdschrift|boekje|booklet|foil pack|accessory|accessoire|sleutelhanger|keychain|display case|vitrine|light kit|verlichting|minifigure frame|blind bag|mystery bag|blindbox|blind box|verrassingszakje|mystery pack|single figure|single minifigure|losse minifiguur|losse figuur|1\s*stuk|per stuk|single pack|foil bag|polybag)\M'
      and (
        seeds.set_id !~ '^710[0-9]{2}(-1)?$'
        or (
          coalesce(seeds.notes, '') || ' ' || coalesce(seeds.product_url, '')
        ) ~* '\m(random box|display box|displaydoos|display|sealed box|complete serie|complete series|complete set|complete collectie|full set|volledige serie|volledige collectie|box of (12|24|36)|(12|24|36)\s*(stuks|pcs|pieces|x))\M'
      )
  ),
  ranked_sets as (
    select
      eligible_offers.set_id,
      count(*) as offer_count,
      min(eligible_offers.price_minor) as best_price_minor,
      max(eligible_offers.checked_at) as latest_checked_at
    from eligible_offers
    group by eligible_offers.set_id
  )
  select ranked_sets.set_id
  from ranked_sets, normalized_limit
  order by
    ranked_sets.offer_count desc,
    ranked_sets.latest_checked_at desc,
    ranked_sets.best_price_minor asc,
    ranked_sets.set_id asc
  limit (select value from normalized_limit);
$$;

revoke all on function public.list_catalog_current_offer_candidate_set_ids(integer) from public;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to anon;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to authenticated;
grant execute on function public.list_catalog_current_offer_candidate_set_ids(integer) to service_role;
