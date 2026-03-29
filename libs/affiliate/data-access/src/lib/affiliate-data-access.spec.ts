import { describe, expect, test } from 'vitest';
import { listAffiliateOffers } from './affiliate-data-access';

describe('affiliate data access', () => {
  test('returns sorted Dutch affiliate offers for a set', () => {
    expect(
      listAffiliateOffers('10316').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['bol', 'intertoys', 'lego-nl']);
  });

  test('returns curated reviewed offers for newly commerce-enabled sets', () => {
    expect(
      listAffiliateOffers('10333').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['bol', 'intertoys', 'lego-nl']);
  });

  test('returns no affiliate offers for sets outside the commerce slice', () => {
    expect(listAffiliateOffers('10305')).toEqual([]);
  });
});
