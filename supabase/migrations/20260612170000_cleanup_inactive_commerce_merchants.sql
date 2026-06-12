do $$
declare
  lego_merchant_id uuid;
begin
  update public.commerce_merchants
  set is_active = false
  where slug in (
    'amazon-nl',
    'bol',
    'intertoys',
    'smyths-toys',
    'wehkamp',
    'top1toys'
  );

  insert into public.commerce_merchants (
    slug,
    name,
    is_active,
    source_type,
    affiliate_network,
    notes
  )
  values (
    'rakuten-lego-eu',
    'LEGO',
    true,
    'affiliate',
    'Rakuten',
    'Canonical LEGO merchant for Rakuten LEGO EU feed offers/deeplinks.'
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    is_active = true,
    source_type = excluded.source_type,
    affiliate_network = excluded.affiliate_network,
    notes = excluded.notes;

  select id
  into lego_merchant_id
  from public.commerce_merchants
  where slug = 'lego-nl';

  if lego_merchant_id is not null then
    if not exists (
      select 1
      from public.commerce_offer_seeds
      where merchant_id = lego_merchant_id
    ) then
      delete from public.commerce_merchants
      where id = lego_merchant_id;
    else
      update public.commerce_merchants
      set
        is_active = false,
        notes = 'Deprecated; rakuten-lego-eu is the canonical LEGO merchant.'
      where id = lego_merchant_id;
    end if;
  end if;
end $$;
