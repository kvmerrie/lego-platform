import {
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  type PricingAvailability,
  type PricingCondition,
  type PricingCurrencyCode,
  type PricingRegionCode,
} from '@lego-platform/pricing/util';

export interface PricingObservationSeed {
  availability: PricingAvailability;
  condition: PricingCondition;
  currencyCode: PricingCurrencyCode;
  merchantId: string;
  merchantProductUrl: string;
  observedAt: string;
  regionCode: PricingRegionCode;
  setId: string;
  totalPriceMinor: number;
}

// Keep merchant product destinations curated per set.
// Do not synthesize product URLs from set ids or merchant naming patterns.
export const curatedDutchPricingObservationSeeds: readonly PricingObservationSeed[] =
  [
    {
      setId: '10316',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
      totalPriceMinor: 48999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:00:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10316',
      merchantId: 'lego-nl',
      merchantProductUrl: 'https://www.lego.com/nl-nl/product/lotr-10316',
      totalPriceMinor: 49999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:10:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21348',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-ideas-dungeons-dragons-het-verhaal-van-de-rode-draak-21348/9300000175725314/',
      totalPriceMinor: 34999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:15:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21348',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/dungeons-dragons-red-dragons-tale-21348',
      totalPriceMinor: 35999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:25:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10332',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-icons-middeleeuws-stadsplein-10332/9300000173010312/',
      totalPriceMinor: 21999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:00:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10332',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/medieval-town-square-10332',
      totalPriceMinor: 22999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:10:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10333',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-de-lord-of-the-rings-barad-majoor-10333/9300000180281419/',
      totalPriceMinor: 44999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:45:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10333',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-barad-dur-10333',
      totalPriceMinor: 45999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:55:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21333',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-ideas-vincent-van-gogh-sterrennacht-21333/9300000070995024/',
      totalPriceMinor: 15999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:15:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21333',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/vincent-van-gogh-the-starry-night-21333',
      totalPriceMinor: 16999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:25:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21349',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-ideas-zwart-witte-kat-21349/9300000173010346/',
      totalPriceMinor: 9999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:30:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21349',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/tuxedo-cat-21349',
      totalPriceMinor: 10999,
      availability: 'in_stock',
      observedAt: '2026-03-29T10:40:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '76269',
      merchantId: 'bol',
      merchantProductUrl:
        'https://www.bol.com/nl/nl/p/lego-avengers-toren-lego-marvel/9300000168131115/',
      totalPriceMinor: 47999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:30:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '76269',
      merchantId: 'intertoys',
      merchantProductUrl:
        'https://www.intertoys.nl/lego-marvel-avengers-toren-76269',
      totalPriceMinor: 48999,
      availability: 'limited',
      observedAt: '2026-03-29T09:35:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '76269',
      merchantId: 'lego-nl',
      merchantProductUrl:
        'https://www.lego.com/nl-nl/product/avengers-tower-76269',
      totalPriceMinor: 49999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:40:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
  ];
