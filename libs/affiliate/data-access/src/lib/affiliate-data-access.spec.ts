import { describe, expect, test } from 'vitest';
import { listAffiliateOffers } from './affiliate-data-access';

describe('affiliate data access', () => {
  test('returns indexed offers for a reviewed commerce set', () => {
    const offers = listAffiliateOffers('10316');

    expect(offers.length).toBeGreaterThan(0);
    expect(
      offers.every((affiliateOffer) => affiliateOffer.setId === '10316'),
    ).toBe(true);
    expect(offers.map((affiliateOffer) => affiliateOffer.merchantId)).toEqual([
      'proshop',
      'brickfever',
      'misterbricks',
      'rakuten-lego-eu',
    ]);
    expect(
      offers.every((affiliateOffer) => affiliateOffer.outboundUrl.length > 0),
    ).toBe(true);
  });

  test('sorts indexed offers by price before display rank', () => {
    const offers = listAffiliateOffers('76419');

    expect(offers.length).toBeGreaterThan(1);
    expect(
      offers.map((affiliateOffer) => affiliateOffer.totalPriceMinor),
    ).toEqual(
      [...offers]
        .map((affiliateOffer) => affiliateOffer.totalPriceMinor)
        .sort((left, right) => left - right),
    );
  });

  test('does not leak offers across set ids', () => {
    expect(listAffiliateOffers('does-not-exist')).toEqual([]);
  });
});
