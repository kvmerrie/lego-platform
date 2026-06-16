import { describe, expect, it } from 'vitest';
import {
  getCommercePurchasableOfferRejectionReason,
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
});
