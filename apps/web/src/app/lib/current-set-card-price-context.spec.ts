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

function createOffer(
  overrides: Partial<CatalogResolvedOffer> = {},
): CatalogResolvedOffer {
  return {
    availability: 'in_stock',
    checkedAt: '2026-05-11T07:01:00.000Z',
    condition: 'new',
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

    expect(result?.dealReason).toBeUndefined();
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

  it('renders a discount metric when the reference discount is reliable', () => {
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

    expect(result?.discountMetric).toContain('€ 15,00 goedkoper');
    expect(result?.discountMetric).toContain('3% lager');
    expect(result?.dealReason).toBeUndefined();
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
        offers: [createOffer(), createOffer({ merchantName: 'LEGO' })],
      }),
      theme: 'Icons',
    });

    expect(result?.dealReason).toBe('€ 10,00 goedkoper dan de rest');
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
