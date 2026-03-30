import { describe, expect, test } from 'vitest';
import {
  getBestOffer,
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
});
