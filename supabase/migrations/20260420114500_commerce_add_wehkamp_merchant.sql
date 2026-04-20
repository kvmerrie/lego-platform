with merchant_seed_values (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
) as (
  values
  (
    'wehkamp',
    'Wehkamp',
    true,
    'direct',
    null,
    'Inspect-first secondary merchant for Dutch retail LEGO coverage'
  )
)
insert into public.commerce_merchants (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
)
select
  merchant_seed_values.slug,
  merchant_seed_values.name,
  merchant_seed_values.is_active,
  merchant_seed_values.source_type,
  merchant_seed_values.affiliate_network,
  merchant_seed_values.notes
from merchant_seed_values
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  affiliate_network = excluded.affiliate_network,
  notes = excluded.notes;
