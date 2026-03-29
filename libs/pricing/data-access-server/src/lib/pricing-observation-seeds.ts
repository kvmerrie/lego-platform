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

export const curatedDutchPricingObservationSeeds: readonly PricingObservationSeed[] =
  [
    {
      setId: '10316',
      merchantId: 'bol',
      merchantProductUrl: 'https://www.bol.com/nl/nl/p/lego-10316',
      totalPriceMinor: 48999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:00:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10316',
      merchantId: 'intertoys',
      merchantProductUrl: 'https://www.intertoys.nl/product/lego-10316',
      totalPriceMinor: 49499,
      availability: 'limited',
      observedAt: '2026-03-29T09:05:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '10316',
      merchantId: 'lego-nl',
      merchantProductUrl: 'https://www.lego.com/nl-nl/product/10316',
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
      merchantProductUrl: 'https://www.bol.com/nl/nl/p/lego-21348',
      totalPriceMinor: 34999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:15:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21348',
      merchantId: 'intertoys',
      merchantProductUrl: 'https://www.intertoys.nl/product/lego-21348',
      totalPriceMinor: 35499,
      availability: 'limited',
      observedAt: '2026-03-29T09:20:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '21348',
      merchantId: 'lego-nl',
      merchantProductUrl: 'https://www.lego.com/nl-nl/product/21348',
      totalPriceMinor: 35999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:25:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
    {
      setId: '76269',
      merchantId: 'bol',
      merchantProductUrl: 'https://www.bol.com/nl/nl/p/lego-76269',
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
      merchantProductUrl: 'https://www.intertoys.nl/product/lego-76269',
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
      merchantProductUrl: 'https://www.lego.com/nl-nl/product/76269',
      totalPriceMinor: 49999,
      availability: 'in_stock',
      observedAt: '2026-03-29T09:40:00.000Z',
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    },
  ];
