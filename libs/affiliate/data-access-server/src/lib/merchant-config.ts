import {
  DUTCH_AFFILIATE_REGION_CODE,
  EURO_AFFILIATE_CURRENCY_CODE,
  type AffiliateMerchantConfig,
} from '@lego-platform/affiliate/util';

export const dutchAffiliateMerchantConfigs: readonly AffiliateMerchantConfig[] =
  [
    {
      merchantId: 'lego-nl',
      displayName: 'LEGO',
      regionCode: DUTCH_AFFILIATE_REGION_CODE,
      currencyCode: EURO_AFFILIATE_CURRENCY_CODE,
      enabled: true,
      displayRank: 1,
      urlHost: 'www.lego.com',
      disclosureCopy: 'Direct official merchant link.',
      ctaLabel: 'Shop at LEGO',
      perks: 'Direct brand purchase and reference pricing',
    },
    {
      merchantId: 'bol',
      displayName: 'bol',
      regionCode: DUTCH_AFFILIATE_REGION_CODE,
      currencyCode: EURO_AFFILIATE_CURRENCY_CODE,
      enabled: true,
      displayRank: 2,
      urlHost: 'www.bol.com',
      disclosureCopy:
        'Direct merchant link. Affiliate parameters may be added later.',
      ctaLabel: 'Shop at bol',
      perks: 'Wide Dutch retail reach',
    },
    {
      merchantId: 'intertoys',
      displayName: 'Intertoys',
      regionCode: DUTCH_AFFILIATE_REGION_CODE,
      currencyCode: EURO_AFFILIATE_CURRENCY_CODE,
      enabled: true,
      displayRank: 3,
      urlHost: 'www.intertoys.nl',
      disclosureCopy:
        'Direct merchant link. Affiliate parameters may be added later.',
      ctaLabel: 'Shop at Intertoys',
      perks: 'Strong toy-specialist relevance',
    },
    {
      merchantId: 'amazon-nl',
      displayName: 'Amazon',
      regionCode: DUTCH_AFFILIATE_REGION_CODE,
      currencyCode: EURO_AFFILIATE_CURRENCY_CODE,
      enabled: true,
      displayRank: 4,
      urlHost: 'www.amazon.nl',
      disclosureCopy:
        'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
      ctaLabel: 'Bekijk bij Amazon',
      perks: 'Grote beschikbaarheid en snelle levering',
    },
  ];
