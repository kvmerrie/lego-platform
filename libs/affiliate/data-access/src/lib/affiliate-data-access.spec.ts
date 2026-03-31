import { describe, expect, test } from 'vitest';
import { listAffiliateOffers } from './affiliate-data-access';

describe('affiliate data access', () => {
  test('returns reviewed merchant offers with corrected direct product URLs', () => {
    expect(
      listAffiliateOffers('10316').map((affiliateOffer) => ({
        merchantId: affiliateOffer.merchantId,
        outboundUrl: affiliateOffer.outboundUrl,
      })),
    ).toEqual([
      {
        merchantId: 'bol',
        outboundUrl:
          'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
      },
      {
        merchantId: 'lego-nl',
        outboundUrl:
          'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
      },
    ]);
  });

  test('keeps Intertoys only where a verified direct product page is curated', () => {
    expect(
      listAffiliateOffers('76269').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['bol', 'intertoys', 'lego-nl']);

    expect(
      listAffiliateOffers('10333').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['bol', 'lego-nl']);
  });

  test('returns no affiliate offers for sets outside the commerce slice', () => {
    expect(listAffiliateOffers('76419')).toEqual([]);
  });
});
