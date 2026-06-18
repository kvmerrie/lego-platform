import { describe, expect, it } from 'vitest';
import {
  getCommercePurchasableOfferRejectionReason,
  selectCanonicalBestOfferContract,
  selectBestPurchasableOffer,
  type CommerceOfferLike,
} from './commerce-best-purchasable-offer';

const NOW = new Date('2026-06-16T12:00:00.000Z');
const RECENT_CHECKED_AT = '2026-06-15T06:06:05.983Z';
const STALE_CHECKED_AT = '2026-05-07T05:01:00.862Z';

function createOffer(
  overrides: Partial<CommerceOfferLike> = {},
): CommerceOfferLike {
  return {
    availability: 'in_stock',
    checkedAt: RECENT_CHECKED_AT,
    commercialUnitType: 'full_set',
    currency: 'EUR',
    merchant: 'other',
    merchantName: 'Proshop',
    merchantSlug: 'proshop',
    priceCents: 17_667,
    setId: '21061',
    url: 'https://example.com/21061-proshop',
    ...overrides,
  };
}

describe('selectBestPurchasableOffer', () => {
  it('lets a lower current offer beat a trusted merchant', () => {
    const result = selectBestPurchasableOffer(
      [
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_500,
          url: 'https://example.com/21061-proshop',
        }),
        createOffer({
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_667,
          url: 'https://example.com/21061-mediamarkt',
        }),
      ],
      { now: NOW },
    );

    expect(result.offer?.merchantSlug).toBe('proshop');
    expect(result.priceMinor).toBe(17_500);
    expect(result.selectionReason).toBe('lowest_price');
  });

  it('excludes a stale lower offer from the canonical winner', () => {
    const result = selectBestPurchasableOffer(
      [
        createOffer({
          checkedAt: STALE_CHECKED_AT,
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
        createOffer(),
      ],
      { now: NOW },
    );

    expect(result.offer?.merchantSlug).toBe('proshop');
    expect(result.priceMinor).toBe(17_667);
    expect(result.debugSignals.staleFilteredCount).toBe(1);
    expect(
      getCommercePurchasableOfferRejectionReason({
        commerceOffer: createOffer({
          checkedAt: STALE_CHECKED_AT,
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
        now: NOW,
      }),
    ).toBe('stale');
  });

  it('excludes an out-of-stock lower offer from the canonical winner', () => {
    const result = selectBestPurchasableOffer(
      [
        createOffer({
          availability: 'out_of_stock',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
        createOffer(),
      ],
      { now: NOW },
    );

    expect(result.offer?.merchantSlug).toBe('proshop');
    expect(result.priceMinor).toBe(17_667);
    expect(result.debugSignals.outOfStockFilteredCount).toBe(1);
  });

  it('uses trusted merchant reliability as the exact-price tiebreaker', () => {
    const result = selectBestPurchasableOffer(
      [
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_500,
          url: 'https://example.com/21061-proshop',
        }),
        createOffer({
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
      ],
      { now: NOW },
    );

    expect(result.offer?.merchantSlug).toBe('mediamarkt');
    expect(result.priceMinor).toBe(17_500);
    expect(result.selectionReason).toBe('trusted_tiebreak');
    expect(result.debugSignals.tiedOfferCount).toBe(2);
  });

  it.each([
    {
      label: 'Case A - normal best deal',
      offers: [
        createOffer({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceCents: 18_499,
          url: 'https://example.com/21061-goodbricks',
        }),
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case B - lower price is stale',
      offers: [
        createOffer({
          checkedAt: STALE_CHECKED_AT,
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case C - lower price is out of stock',
      offers: [
        createOffer({
          availability: 'out_of_stock',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case D - lower price has no purchasable deeplink',
      offers: [
        createOffer({
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: '',
        }),
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case E - exact equal price uses freshness when policy ties',
      offers: [
        createOffer({
          checkedAt: '2026-06-14T06:06:05.983Z',
          merchantName: 'Coolblue',
          merchantSlug: 'coolblue',
          priceCents: 17_500,
          url: 'https://example.com/21061-coolblue',
        }),
        createOffer({
          checkedAt: RECENT_CHECKED_AT,
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceCents: 17_500,
          url: 'https://example.com/21061-goodbricks',
        }),
      ],
      expectedMerchantSlug: 'goodbricks',
      expectedPriceMinor: 17_500,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case F - trusted tie-break',
      offers: [
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_500,
          url: 'https://example.com/21061-proshop',
        }),
        createOffer({
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 17_500,
          url: 'https://example.com/21061-mediamarkt',
        }),
      ],
      expectedMerchantSlug: 'mediamarkt',
      expectedPriceMinor: 17_500,
      expectedReason: 'trusted_tiebreak',
    },
    {
      label: 'Case G - strategic tie-break',
      offers: [
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_500,
          url: 'https://example.com/21061-proshop',
        }),
        createOffer({
          merchantName: 'bol',
          merchantSlug: 'bol',
          priceCents: 17_500,
          url: 'https://example.com/21061-bol',
        }),
      ],
      strategicMerchantSlug: 'bol',
      expectedMerchantSlug: 'bol',
      expectedPriceMinor: 17_500,
      expectedReason: 'strategic_tiebreak',
    },
    {
      label: 'Case H - LEGO reference is much higher',
      offers: [
        createOffer({
          merchant: 'lego',
          merchantName: 'LEGO',
          merchantSlug: 'rakuten-lego-eu',
          priceCents: 24_999,
          url: 'https://example.com/21061-lego',
        }),
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
    {
      label: 'Case I - single merchant',
      offers: [
        createOffer({
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 17_667,
          url: 'https://example.com/21061-proshop',
        }),
      ],
      expectedMerchantSlug: 'proshop',
      expectedPriceMinor: 17_667,
      expectedReason: 'lowest_price',
    },
  ])(
    'returns one canonical contract for $label',
    ({
      expectedMerchantSlug,
      expectedPriceMinor,
      expectedReason,
      offers,
      strategicMerchantSlug,
    }) => {
      const strategicTieBreakerOffer =
        offers.find((offer) => offer.merchantSlug === strategicMerchantSlug) ??
        null;
      const contract = selectCanonicalBestOfferContract(offers, {
        now: NOW,
        strategicTieBreakerOffer,
      });

      expect(contract).toEqual(
        expect.objectContaining({
          currentPriceMinor: expectedPriceMinor,
          deeplink: expect.stringContaining(expectedMerchantSlug),
          merchantSlug: expectedMerchantSlug,
          selectionReason: expectedReason,
          setId: '21061',
        }),
      );
    },
  );

  it('Case J - no reliable offer returns no canonical contract', () => {
    expect(
      selectCanonicalBestOfferContract(
        [
          createOffer({
            checkedAt: STALE_CHECKED_AT,
            merchantName: 'MediaMarkt',
            merchantSlug: 'mediamarkt',
            priceCents: 17_500,
            url: 'https://example.com/21061-mediamarkt',
          }),
          createOffer({
            availability: 'out_of_stock',
            merchantName: 'Proshop',
            merchantSlug: 'proshop',
            priceCents: 17_667,
            url: 'https://example.com/21061-proshop',
          }),
          createOffer({
            merchantName: 'Coolblue',
            merchantSlug: 'coolblue',
            priceCents: 17_700,
            url: '',
          }),
        ],
        { now: NOW },
      ),
    ).toBeUndefined();
  });
});
