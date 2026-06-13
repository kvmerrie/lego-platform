import { describe, expect, test } from 'vitest';
import {
  buildEffectiveSetDealSnapshot,
  buildHeroDealPresentation,
  type HeroDealDecisionInput,
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

const heroDecisionNow = new Date('2026-06-13T12:00:00.000Z');
const highConfidenceHeroInput = {
  availability: 'in_stock',
  currencyCode: 'EUR',
  hasMerchantOffer: true,
  historyDays: 540,
  historyPointCount: 60,
  isTrustedMerchant: true,
  merchantCount: 5,
  now: heroDecisionNow,
  observedAt: '2026-06-13T09:00:00.000Z',
  priceTrend: 'flat',
  referenceLabel: 'LEGO',
  setLifecycle: 'available',
} satisfies HeroDealDecisionInput;

function buildHeroDecision(
  input: HeroDealDecisionInput,
): ReturnType<typeof buildHeroDealPresentation> {
  return buildHeroDealPresentation({
    ...highConfidenceHeroInput,
    ...input,
  });
}

describe('hero deal decision engine', () => {
  test('classifies an exceptional deal and keeps merchant primary', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 6000,
      lowest30dMinor: 6500,
      lowestEverMinor: 6200,
      priceTrend: 'down',
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeGreaterThanOrEqual(90);
    expect(presentation.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(presentation).toMatchObject({
      adviceCategory: 'buy_now',
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'exceptional_deal',
      title: 'Uitzonderlijke deal',
    });
    expect(presentation.evidence).toContain('Laagste prijs in 30 dagen');
  });

  test('classifies a strong deal and keeps merchant primary', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 7600,
      lowest30dMinor: 7600,
      lowestEverMinor: 7000,
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeGreaterThanOrEqual(75);
    expect(presentation.dealScore).toBeLessThan(90);
    expect(presentation).toMatchObject({
      adviceCategory: 'buy_now',
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      state: 'strong_deal',
      title: 'Sterke deal',
    });
  });

  test('classifies a good deal without exceptional deal copy', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 8800,
      lowest30dMinor: 8800,
      lowestEverMinor: 7900,
      merchantCount: 3,
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeGreaterThanOrEqual(60);
    expect(presentation.dealScore).toBeLessThan(75);
    expect(presentation).toMatchObject({
      adviceCategory: 'buy_if_you_want_it',
      state: 'good_deal',
      title: 'Goede prijs',
    });
    expect(presentation.advice).toBe(
      'Een nette prijs, maar geen uitzonderlijke aanbieding.',
    );
  });

  test('classifies market price as informative price checking', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 10000,
      lowest30dMinor: 9500,
      lowestEverMinor: 9500,
      merchantCount: 3,
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeGreaterThanOrEqual(45);
    expect(presentation.dealScore).toBeLessThan(60);
    expect(presentation).toMatchObject({
      adviceCategory: 'neutral',
      merchantCtaIntent: 'price_check',
      primaryAction: 'merchant',
      state: 'market_price',
      title: 'Normale prijs',
    });
    expect(presentation.advice).not.toMatch(/deal|kopen aanbevolen/iu);
  });

  test('classifies a high current price as wait without hiding a purchasable merchant offer', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 11500,
      lowest30dMinor: 9200,
      lowestEverMinor: 8500,
      priceTrend: 'up',
      referencePriceMinor: 10000,
    });

    expect(presentation.state).toBe('wait');
    expect(presentation.primaryAction).toBe('merchant');
    expect(presentation.secondaryAction).toBe('follow');
    expect(presentation.commerceIntent).toBe('balanced');
    expect(presentation.hasPurchasableOffer).toBe(true);
    expect(presentation.followIntent).toBe('wait_for_drop');
    expect(presentation.adviceCategory).toBe('wait');
  });

  test('uses price building when current price data is missing', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: undefined,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 0,
      observedAt: undefined,
      referencePriceMinor: 10000,
    });

    expect(presentation).toMatchObject({
      followIntent: 'track_new_set',
      primaryAction: 'follow',
      state: 'price_building',
      title: 'Prijsbeeld bouwt op',
    });
  });

  test('uses no reliable offer when the available offer is out of stock', () => {
    const presentation = buildHeroDecision({
      availability: 'out_of_stock',
      currentPriceMinor: 9000,
      referencePriceMinor: 10000,
    });

    expect(presentation).toMatchObject({
      followIntent: 'watch_availability',
      hasPurchasableOffer: false,
      primaryAction: 'follow',
      state: 'no_reliable_offer',
      title: 'Geen betrouwbare prijs',
    });
    expect(presentation.riskFlags).toContain('out_of_stock');
  });

  test('downgrades a high deal score when confidence is low', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 6000,
      historyDays: 90,
      historyPointCount: 12,
      lowest30dMinor: 6500,
      lowestEverMinor: 6000,
      merchantCount: 1,
      priceTrend: 'down',
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeGreaterThanOrEqual(90);
    expect(presentation.confidenceScore).toBeLessThan(60);
    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'good_deal',
      title: 'Goede prijs',
    });
    expect(presentation.title).not.toMatch(/Uitzonderlijke|Sterke/iu);
    expect(presentation.advice).not.toMatch(/Nu kopen aanbevolen/iu);
  });

  test('keeps single-merchant deals cautious even with a strong score', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 7000,
      isTrustedMerchant: false,
      lowest30dMinor: 7200,
      lowestEverMinor: 6900,
      merchantCount: 1,
      priceTrend: 'down',
      referencePriceMinor: 10000,
    });

    expect(presentation.state).toBe('strong_deal');
    expect(presentation.primaryAction).toBe('merchant');
    expect(presentation.secondaryAction).toBe('follow');
    expect(presentation.title).toBe('Lijkt een sterke prijs');
    expect(presentation.riskFlags).toContain('single_merchant');
  });

  test('keeps stale prices out of merchant-primary flow', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 7600,
      lowest30dMinor: 7600,
      lowestEverMinor: 7000,
      observedAt: '2026-05-01T09:00:00.000Z',
      priceTrend: 'down',
      referencePriceMinor: 10000,
    });

    expect(presentation.state).toBe('strong_deal');
    expect(presentation.primaryAction).toBe('follow');
    expect(presentation.hasPurchasableOffer).toBe(false);
    expect(presentation.merchantCtaIntent).toBeUndefined();
    expect(presentation.title).toBe('Lijkt een sterke prijs');
    expect(presentation.riskFlags).toContain('stale_price');
  });

  test('blocks price building for a purchasable offer with enough merchant coverage', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 10000,
      dataQualityIssueCount: 3,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      priceVolatilityRatio: 0.2,
      referencePriceMinor: 10000,
    });

    expect(presentation.confidenceScore).toBeLessThan(40);
    expect(presentation.hasPurchasableOffer).toBe(true);
    expect(presentation.state).toBe('market_price');
    expect(presentation.state).not.toBe('price_building');
    expect(presentation.primaryAction).toBe('merchant');
    expect(presentation.secondaryAction).toBe('follow');
  });

  test('keeps a purchasable best offer with enough merchant coverage merchant-first', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 10000,
      dataQualityIssueCount: 3,
      historyDays: 0,
      historyPointCount: 0,
      isBestCurrentOffer: true,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      priceVolatilityRatio: 0.2,
      referencePriceMinor: 10000,
    });

    expect(presentation.confidenceScore).toBeLessThan(40);
    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'market_price',
      title: 'Beste actuele prijs',
    });
    expect(presentation.state).not.toBe('price_building');
  });

  test('keeps merchant primary when historical data is missing but a reference discount is clear', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 7000,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      referencePriceMinor: 10000,
    });

    expect(presentation.riskFlags).toContain('limited_history');
    expect(presentation.hasPurchasableOffer).toBe(true);
    expect(presentation.primaryAction).toBe('merchant');
    expect(presentation.secondaryAction).toBe('follow');
    expect(presentation.title).toBe('Goede prijs');
    expect(presentation.dealScore).toBeLessThanOrEqual(74);
  });

  test('keeps merchant primary for a purchasable offer with at least €20 reference discount', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 28000,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      referencePriceMinor: 30000,
    });

    expect(presentation.dealScore).toBeLessThanOrEqual(74);
    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'good_deal',
      title: 'Goede prijs',
    });
    expect(presentation.evidence).toContain('€20 goedkoper dan LEGO');
  });

  test('keeps merchant primary for a purchasable offer with at least 10% reference discount', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 9000,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      referencePriceMinor: 10000,
    });

    expect(presentation.dealScore).toBeLessThanOrEqual(74);
    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'good_deal',
      title: 'Goede prijs',
    });
    expect(presentation.evidence).toContain('€10 goedkoper dan LEGO');
  });

  test('keeps a purchasable limited-history LEGO discount commercial', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 15800,
      historyDays: 0,
      historyPointCount: 0,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      referencePriceMinor: 21900,
    });

    expect(presentation.dealScore).toBeLessThanOrEqual(74);
    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'deal',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'good_deal',
      title: 'Goede prijs',
    });
    expect(presentation.evidence).toContain('€61 goedkoper dan LEGO');
    expect(presentation.riskFlags).toContain('limited_history');
  });

  test('keeps premium deals with a purchasable offer out of price building', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 15800,
      historyDays: 0,
      historyPointCount: 0,
      isPremiumDeal: true,
      lowest30dMinor: undefined,
      lowestEverMinor: undefined,
      merchantCount: 3,
      referencePriceMinor: 21900,
    });

    expect(presentation).toMatchObject({
      commerceIntent: 'push_merchant',
      hasPurchasableOffer: true,
      isPremiumDeal: true,
      primaryAction: 'merchant',
      state: 'good_deal',
    });
    expect(presentation.state).not.toBe('price_building');
  });

  test('keeps a merchant CTA on price-building copy when the offer is still purchasable', () => {
    const presentation = buildHeroDecision({
      currentPriceMinor: 7000,
      historyDays: 0,
      historyPointCount: 0,
      isBestCurrentOffer: false,
      lowest30dMinor: 7000,
      lowestEverMinor: undefined,
      merchantCount: 1,
      referencePriceMinor: undefined,
    });

    expect(presentation).toMatchObject({
      commerceIntent: 'balanced',
      hasPurchasableOffer: true,
      merchantCtaIntent: 'price_check',
      primaryAction: 'merchant',
      secondaryAction: 'follow',
      state: 'price_building',
      title: 'Actuele aanbieding',
    });
    expect(presentation.advice).toContain('deze aanbieding is nu koopbaar');
    expect(presentation.riskFlags).toContain('limited_history');
  });

  test('never returns a follow-only action set for purchasable offers', () => {
    const presentations = [
      buildHeroDecision({
        currentPriceMinor: 11500,
        lowest30dMinor: 9200,
        lowestEverMinor: 8500,
        priceTrend: 'up',
        referencePriceMinor: 10000,
      }),
      buildHeroDecision({
        currentPriceMinor: 15800,
        historyDays: 0,
        historyPointCount: 0,
        lowest30dMinor: undefined,
        lowestEverMinor: undefined,
        merchantCount: 3,
        referencePriceMinor: 21900,
      }),
    ];

    for (const presentation of presentations) {
      expect(presentation.hasPurchasableOffer).toBe(true);
      expect(presentation.commerceIntent).not.toBe('block_merchant');
      if (presentation.primaryAction === 'follow') {
        expect(presentation.secondaryAction).toBe('merchant');
      } else {
        expect(presentation.primaryAction).toBe('merchant');
      }
      expect(presentation.merchantCtaIntent).toBeDefined();
    }
  });

  test('only no offer, out of stock, or stale prices remove the merchant CTA', () => {
    const noOfferPresentation = buildHeroDecision({
      currentPriceMinor: undefined,
      hasMerchantOffer: false,
      merchantCount: 0,
      observedAt: undefined,
    });
    const outOfStockPresentation = buildHeroDecision({
      availability: 'out_of_stock',
      currentPriceMinor: 9000,
      referencePriceMinor: 10000,
    });
    const stalePresentation = buildHeroDecision({
      currentPriceMinor: 7600,
      lowest30dMinor: 7600,
      lowestEverMinor: 7000,
      observedAt: '2026-05-01T09:00:00.000Z',
      referencePriceMinor: 10000,
    });

    for (const presentation of [
      noOfferPresentation,
      outOfStockPresentation,
      stalePresentation,
    ]) {
      expect(presentation.hasPurchasableOffer).toBe(false);
      expect(presentation.primaryAction).toBe('follow');
      expect(presentation.secondaryAction).toBeUndefined();
      expect(presentation.merchantCtaIntent).toBeUndefined();
    }
  });
});
