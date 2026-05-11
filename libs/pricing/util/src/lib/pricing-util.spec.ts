import { describe, expect, test } from 'vitest';
import {
  buildEffectiveSetDealSnapshot,
  getPriceDealSummary,
  renderPricingObservationsModule,
} from './pricing-util';

const basePricePanelSnapshot = {
  condition: 'new',
  currencyCode: 'EUR',
  headlinePriceMinor: 24999,
  lowestMerchantId: 'lego-nl',
  lowestMerchantName: 'LEGO',
  merchantCount: 1,
  observedAt: '2026-05-05T10:00:00.000Z',
  regionCode: 'NL',
  setId: '42177',
} as const;

const baseCurrentOffer = {
  availabilityLabel: 'Op voorraad',
  condition: 'new',
  currencyCode: 'EUR',
  merchantCount: 2,
  merchantId: 'wehkamp',
  merchantName: 'Wehkamp',
  observedAt: '2026-05-05T10:00:00.000Z',
  priceMinor: 19999,
  regionCode: 'NL',
  setId: '42177',
} as const;

describe('pricing util deal summaries', () => {
  test('surfaces a best current deal label with limited coverage copy', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: -2000,
        merchantCount: 2,
      }),
    ).toEqual({
      label: 'Beste deal nu',
      coverageNote: 'Tot nu toe pas 2 reviewed aanbiedingen',
    });
  });

  test('surfaces above-reference guidance without weak coverage copy when coverage is broader', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: 1500,
        merchantCount: 3,
      }),
    ).toEqual({
      label: 'Boven referentie',
      coverageNote: undefined,
    });
  });

  test('falls back to lowest reviewed offer when no reference price exists yet', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: undefined,
        merchantCount: 1,
      }),
    ).toEqual({
      label: 'Laagste reviewed aanbieding',
      coverageNote: 'Tot nu toe pas 1 reviewed aanbieding',
    });
  });

  test('renders pricing generated modules in a Prettier-stable shape', async () => {
    const { format } = await import('prettier');
    const renderedModule = renderPricingObservationsModule([
      {
        availability: 'in_stock',
        condition: 'new',
        currencyCode: 'EUR',
        merchantId: 'lego-nl',
        observedAt: '2026-04-03T09:00:00.000Z',
        regionCode: 'NL',
        setId: '10316',
        totalPriceMinor: 49999,
      },
    ]);

    await expect(
      format(renderedModule, {
        parser: 'typescript',
        singleQuote: true,
      }),
    ).resolves.toBe(renderedModule);
  });
});

describe('effective set deal snapshots', () => {
  test('uses normal pricePanelSnapshot when delta exists', () => {
    const pricePanelSnapshot = {
      ...basePricePanelSnapshot,
      deltaMinor: -1000,
      referencePriceMinor: 25999,
    };

    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
        discoveryInput: {
          bestPriceMinor: 19999,
          merchantCount: 2,
          referenceDeltaMinor: -5000,
        },
        pricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'price_panel_delta_available',
      snapshot: pricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('uses discovery fallback only on exact best price match', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
        discoveryInput: {
          bestPriceMinor: 20000,
          merchantCount: 2,
          referenceDeltaMinor: -4999,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'discovery_price_mismatch',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('rejects discovery fallback with one merchant', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
        discoveryInput: {
          bestPriceMinor: 19999,
          merchantCount: 1,
          referenceDeltaMinor: -5000,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'insufficient_merchant_coverage',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('rejects discovery fallback below EUR 25 and 15 percent', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: {
          ...baseCurrentOffer,
          priceMinor: 18500,
        },
        discoveryInput: {
          bestPriceMinor: 18500,
          merchantCount: 2,
          referenceDeltaMinor: -2400,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'discount_below_threshold',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('rejects discovery fallback above EUR 25 but below 15 percent', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: {
          ...baseCurrentOffer,
          priceMinor: 97000,
        },
        discoveryInput: {
          bestPriceMinor: 97000,
          merchantCount: 2,
          referenceDeltaMinor: -3000,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'discount_below_threshold',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('rejects discovery fallback below EUR 25 even when above 15 percent', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: {
          ...baseCurrentOffer,
          priceMinor: 1499,
        },
        discoveryInput: {
          bestPriceMinor: 1499,
          merchantCount: 2,
          referenceDeltaMinor: -500,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'discount_below_threshold',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('rejects discovery fallback without reference price', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
        discoveryInput: {
          bestPriceMinor: 19999,
          merchantCount: 2,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'discovery_reference_missing',
      snapshot: basePricePanelSnapshot,
      source: 'price_panel_snapshot',
    });
  });

  test('builds positive verdict input for a 42177-style deal', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
        discoveryInput: {
          bestPriceMinor: 19999,
          merchantCount: 2,
          referenceDeltaMinor: -5000,
        },
        pricePanelSnapshot: basePricePanelSnapshot,
      }),
    ).toEqual({
      reason: 'strong_discovery_discount',
      snapshot: {
        ...basePricePanelSnapshot,
        deltaMinor: -5000,
        headlinePriceMinor: 19999,
        lowestAvailabilityLabel: 'Op voorraad',
        lowestMerchantId: 'wehkamp',
        lowestMerchantName: 'Wehkamp',
        merchantCount: 2,
        referencePriceMinor: 24999,
      },
      source: 'discovery_reference_fallback',
    });
  });

  test('exposes none source when no fallback or snapshot exists', () => {
    expect(
      buildEffectiveSetDealSnapshot({
        currentOffer: baseCurrentOffer,
      }),
    ).toEqual({
      reason: 'discovery_reference_missing',
      snapshot: undefined,
      source: 'none',
    });
  });
});
