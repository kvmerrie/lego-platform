import { describe, expect, test } from 'vitest';
import {
  getBestOffer,
  getCatalogOfferComparisonInsight,
  getCatalogOfferMerchantName,
  type CatalogOffer,
} from './affiliate-util';

const baseOffer: CatalogOffer = {
  setId: '10316',
  merchant: 'bol',
  merchantName: 'bol',
  url: 'https://example.test/bol',
  priceCents: 48999,
  currency: 'EUR',
  availability: 'in_stock',
  condition: 'new',
  checkedAt: '2026-03-30T10:00:00.000Z',
  market: 'NL',
};

describe('affiliate util catalog offers', () => {
  test('prefers the lowest in-stock offer for the primary CTA', () => {
    expect(
      getBestOffer([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 47999,
          availability: 'out_of_stock',
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49499,
        },
      ]),
    ).toMatchObject({
      merchant: 'bol',
      merchantName: 'bol',
      priceCents: 48999,
    });
  });

  test('falls back to the cheapest offer when none are in stock', () => {
    expect(
      getBestOffer([
        {
          ...baseOffer,
          availability: 'out_of_stock',
          priceCents: 19999,
        },
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          availability: 'unknown',
          priceCents: 20999,
        },
      ]),
    ).toMatchObject({
      availability: 'out_of_stock',
      priceCents: 19999,
    });
  });

  test('normalizes supported merchant names', () => {
    expect(getCatalogOfferMerchantName('bol')).toBe('bol');
    expect(getCatalogOfferMerchantName('amazon')).toBe('Amazon');
    expect(getCatalogOfferMerchantName('lego')).toBe('LEGO');
  });

  test('flags limited reviewed coverage when only a couple of offers exist', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49999,
        },
      ]),
    ).toBe('Only 2 reviewed offers so far');
  });

  test('describes when reviewed shops are tightly clustered on price', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 49499,
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49799,
        },
      ]),
    ).toBe('Small price gap across reviewed shops');
  });

  test('describes when reviewed shops have a wide price gap', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 51999,
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 52999,
        },
      ]),
    ).toBe('Wide price gap across reviewed shops');
  });
});
