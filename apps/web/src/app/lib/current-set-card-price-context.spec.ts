import type {
  CatalogCurrentOfferSummary,
  CatalogResolvedOffer,
} from '@lego-platform/catalog/data-access-web';
import type { FeaturedSetPriceContext } from '@lego-platform/pricing/util';
import { describe, expect, it } from 'vitest';
import {
  buildCurrentSetCardPriceContext,
  buildReliableDealDiscount,
  compareReliableDealDiscounts,
} from './current-set-card-price-context';

const RECENT_CHECKED_AT = new Date().toISOString();

function createOffer(
  overrides: Partial<CatalogResolvedOffer> = {},
): CatalogResolvedOffer {
  return {
    availability: 'in_stock',
    checkedAt: RECENT_CHECKED_AT,
    condition: 'new',
    commercialUnitType: 'full_set',
    currency: 'EUR',
    market: 'NL',
    merchant: 'bol',
    merchantName: 'bol',
    priceCents: 4999,
    setId: '10316',
    url: 'https://example.com/deal',
    ...overrides,
  };
}

function createCurrentOfferSummary({
  offers = [createOffer()],
}: {
  offers?: readonly CatalogResolvedOffer[];
} = {}): CatalogCurrentOfferSummary {
  return {
    bestOffer: offers[0],
    offers,
    setId: '10316',
  };
}

function createPricePanelSnapshot(
  overrides: Partial<FeaturedSetPriceContext> = {},
): FeaturedSetPriceContext {
  return {
    currencyCode: 'EUR',
    headlinePriceMinor: 4999,
    merchantCount: 2,
    merchantName: 'bol',
    observedAt: '2026-05-11T07:01:00.000Z',
    setId: '10316',
    ...overrides,
  };
}

describe('buildCurrentSetCardPriceContext', () => {
  it('does not claim a deal reason for weak single-merchant data', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary(),
      theme: 'Icons',
    });

    expect(result?.dealReason).toBeUndefined();
    expect(result?.discountMetric).toBeUndefined();
  });

  it('does not render a discount metric without a reference price', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [createOffer(), createOffer({ merchantName: 'LEGO' })],
      }),
      theme: 'Icons',
    });

    expect(result?.discountMetric).toBeUndefined();
  });

  it('does not render a discount metric for a small reference discount', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ priceCents: 49_500 }),
          createOffer({ merchantName: 'LEGO', priceCents: 50_000 }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        deltaMinor: -500,
        referencePriceMinor: 50_000,
      }),
      theme: 'Icons',
    });

    expect(result?.dealReason).toBe('Laagste prijs');
    expect(result?.discountMetric).toBeUndefined();
  });

  it('does not render a discount metric without reviewed market coverage', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [createOffer({ priceCents: 48_500 })],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        deltaMinor: -1_500,
        merchantCount: 1,
        referencePriceMinor: 50_000,
      }),
      theme: 'Icons',
    });

    expect(result?.dealReason).toBeUndefined();
    expect(result?.discountMetric).toBeUndefined();
  });

  it('does not render a deal metric for a weak three percent reference discount', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ priceCents: 48_500 }),
          createOffer({ merchantName: 'LEGO', priceCents: 50_000 }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        deltaMinor: -1_500,
        referencePriceMinor: 50_000,
      }),
      theme: 'Icons',
    });

    expect(result?.discountMetric).toBeUndefined();
    expect(result?.dealReason).toBe('Beste marktprijs');
    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
  });

  it('uses official LEGO pricing as a public comparison when available', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 49_999,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({
            merchantName: 'Goodbricks',
            priceCents: 39_999,
          }),
          legoOffer,
        ],
      }),
      theme: 'Icons',
    });

    expect(result?.discountMetric).toBe('€ 100,00 goedkoper dan LEGO');
    expect(result?.discountMetric).not.toContain('20%');
    expect(result?.dealReason).toBe('Beste marktprijs');
    expect(result?.decisionLabel).toBe('Sterke deal');
    expect(result?.merchantLabel).toBe('Nu het laagst bij Goodbricks');
  });

  it('shows weak LEGO savings as comparison copy without promoting to a deal', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 26_999,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({
            merchantName: 'Goodbricks',
            priceCents: 25_999,
          }),
          legoOffer,
        ],
      }),
      theme: 'Icons',
    });

    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
    expect(result?.discountMetric).toBe('€ 10,00 goedkoper dan LEGO');
    expect(result?.dealReason).toBe('Beste marktprijs');
  });

  it('shows LEGO comparison for a non-topdeal valid Rakuten reference price', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 7_499,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({
            merchantName: 'Toyshop',
            priceCents: 6_899,
          }),
          legoOffer,
        ],
      }),
      theme: 'Icons',
    });

    expect(result?.discountMetric).toBe('€ 6,00 goedkoper dan LEGO');
    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
    expect(result?.merchantLabel).toBe('Nu het laagst bij Toyshop');
  });

  it('promotes a Trevi-like LEGO saving to a top deal', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 15_999,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({
            merchantName: 'Goodbricks',
            priceCents: 10_900,
          }),
          legoOffer,
        ],
      }),
      theme: 'Architecture',
    });

    expect(result?.decisionLabel).toBe('Topdeal');
    expect(result?.discountMetric).toBe('€ 50,99 goedkoper dan LEGO');
    expect(result?.dealReason).toBe('Beste marktprijs');
  });

  it('does not turn a one euro market spread into a deal claim', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ merchantName: 'Goodbricks', priceCents: 9_999 }),
          createOffer({ merchantName: 'Toyshop', priceCents: 10_099 }),
        ],
      }),
      theme: 'Icons',
    });

    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
    expect(result?.discountMetric).toBeUndefined();
    expect(result?.dealReason).toBe('Laagste prijs');
  });

  it('ignores an out-of-stock cheapest offer for deal quality', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 15_999,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: {
        bestOffer: createOffer({
          availability: 'out_of_stock',
          merchantName: 'Old cheapest',
          priceCents: 8_000,
        }),
        offers: [
          createOffer({
            availability: 'out_of_stock',
            merchantName: 'Old cheapest',
            priceCents: 8_000,
          }),
          createOffer({ merchantName: 'Goodbricks', priceCents: 10_900 }),
          legoOffer,
        ],
        setId: '21062',
      },
      theme: 'Architecture',
    });

    expect(result?.currentPrice).toBe('€ 109,00');
    expect(result?.decisionLabel).toBe('Topdeal');
    expect(result?.merchantLabel).toBe('Nu het laagst bij Goodbricks');
  });

  it('does not compare LEGO against itself', () => {
    const legoOffer = {
      ...createOffer({
        merchant: 'lego',
        merchantName: 'LEGO EU',
        priceCents: 49_999,
      }),
      merchantSlug: 'rakuten-lego-eu',
    };
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: {
        bestOffer: legoOffer,
        offers: [legoOffer],
        setId: '10316',
      },
      theme: 'Icons',
    });

    expect(result?.discountMetric).toBeUndefined();
    expect(result?.dealReason).toBeUndefined();
  });

  it('does not render aggressive deal claims for unknown commercial units', () => {
    const result = buildCurrentSetCardPriceContext({
      catalogDiscoverySignal: {
        bestPriceMinor: 359,
        merchantCount: 2,
        observedAt: '2026-05-11T07:01:00.000Z',
        priceSpreadMinor: 5636,
      },
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({
            commercialUnitType: 'unknown',
            priceCents: 359,
          }),
          createOffer({
            commercialUnitType: 'display_box',
            merchantName: 'Goodbricks',
            priceCents: 5995,
          }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        referencePriceMinor: 5995,
      }),
      theme: 'Minifigures',
    });

    expect(result?.discountMetric).toBeUndefined();
    expect(result?.dealReason).toBeUndefined();
    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
  });

  it('uses a market spread reason only with multiple reviewed merchants', () => {
    const result = buildCurrentSetCardPriceContext({
      catalogDiscoverySignal: {
        bestPriceMinor: 4_999,
        merchantCount: 2,
        observedAt: '2026-05-11T07:01:00.000Z',
        priceSpreadMinor: 1_000,
      },
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer(),
          createOffer({
            merchantName: 'LEGO',
            priceCents: 5_999,
            url: 'https://example.com/lego',
          }),
        ],
      }),
      theme: 'Icons',
    });

    expect(result?.dealReason).toBe('Beste marktprijs');
  });

  it('sorts reliable discounts by percentage, absolute discount, then coverage', () => {
    const highPercentage = buildReliableDealDiscount({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ priceCents: 8_000 }),
          createOffer({ merchantName: 'LEGO', priceCents: 10_000 }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        referencePriceMinor: 10_000,
      }),
    });
    const highAbsolute = buildReliableDealDiscount({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ priceCents: 45_000 }),
          createOffer({ merchantName: 'LEGO', priceCents: 50_000 }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        referencePriceMinor: 50_000,
      }),
    });
    const sameDiscountLowerCoverage = buildReliableDealDiscount({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [
          createOffer({ priceCents: 8_000 }),
          createOffer({ merchantName: 'LEGO', priceCents: 10_000 }),
        ],
      }),
      pricePanelSnapshot: createPricePanelSnapshot({
        referencePriceMinor: 10_000,
      }),
    });

    expect(
      compareReliableDealDiscounts({
        left: highAbsolute,
        leftMerchantCount: 6,
        right: highPercentage,
        rightMerchantCount: 2,
      }),
    ).toBeGreaterThan(0);
    expect(
      compareReliableDealDiscounts({
        left: sameDiscountLowerCoverage,
        leftMerchantCount: 2,
        right: highPercentage,
        rightMerchantCount: 4,
      }),
    ).toBeGreaterThan(0);
  });

  it('does not expose vague deal copy on current offer cards', () => {
    const result = buildCurrentSetCardPriceContext({
      currentOfferSummary: createCurrentOfferSummary({
        offers: [createOffer(), createOffer({ merchantName: 'LEGO' })],
      }),
      theme: 'Icons',
    });

    expect(result?.decisionLabel).toBe('Actuele prijs binnen');
    expect(result?.decisionNote).toBeUndefined();
  });
});
