import { describe, expect, test } from 'vitest';
import { getPricePanelSnapshot, listPricingObservations } from './pricing-data-access';

describe('pricing data access', () => {
  test('returns a set-aware Dutch price panel snapshot', () => {
    expect(getPricePanelSnapshot('10316')).toEqual({
      setId: '10316',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 48999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'bol',
      lowestMerchantName: 'bol',
      merchantCount: 3,
      observedAt: '2026-03-29T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -1000,
    });
  });

  test('lists pricing observations for a single set only', () => {
    expect(listPricingObservations('21348')).toHaveLength(3);
    expect(
      listPricingObservations('21348').every(
        (pricingObservation) => pricingObservation.setId === '21348',
      ),
    ).toBe(true);
  });
});
