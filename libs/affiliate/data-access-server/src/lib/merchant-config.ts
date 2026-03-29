import {
  DUTCH_AFFILIATE_REGION_CODE,
  EURO_AFFILIATE_CURRENCY_CODE,
  type AffiliateMerchantConfig,
} from '@lego-platform/affiliate/util';

export const dutchAffiliateMerchantConfigs: readonly AffiliateMerchantConfig[] =
  [
    {
      merchantId: 'lego-nl',
      displayName: 'LEGO NL',
      regionCode: DUTCH_AFFILIATE_REGION_CODE,
      currencyCode: EURO_AFFILIATE_CURRENCY_CODE,
      enabled: true,
      displayRank: 1,
      urlHost: 'www.lego.com',
      disclosureCopy: 'Official direct merchant reference for the Dutch market.',
      ctaLabel: 'Shop direct',
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
        'Affiliate parameters can be appended later. This foundation currently keeps outbound links direct and operator-reviewed.',
      ctaLabel: 'View offer',
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
        'Affiliate parameters can be appended later. This foundation currently keeps outbound links direct and operator-reviewed.',
      ctaLabel: 'View offer',
      perks: 'Strong toy-specialist relevance',
    },
  ];
