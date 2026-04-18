import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  getBrowserSupabaseClient: vi.fn(),
}));

vi.mock('@lego-platform/shared/config', () => ({
  getDefaultFormattingLocale: vi.fn(() => 'nl-NL'),
  hasBrowserSupabaseConfig: vi.fn(),
}));

import { getBrowserSupabaseClient } from '@lego-platform/shared/data-access-auth';
import {
  getDefaultFormattingLocale,
  hasBrowserSupabaseConfig,
} from '@lego-platform/shared/config';
import {
  buildBrickhuntValueItems,
  buildSetDecisionPresentation,
  buildSetDecisionSupportItems,
  buildSetDealVerdict,
  buildSetPriceInsights,
  buildWishlistAlertNotificationCandidate,
  buildWishlistPriceAlert,
  buildPriceHistorySummary,
  buildTrackedPriceSummary,
  DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
  getFeaturedSetPriceContext,
  getSetDealVerdict,
  getReviewedPriceSummary,
  listDealSpotlightPriceContexts,
  listWishlistAlertNotificationCandidates,
  listWishlistPriceAlerts,
  listReviewedPriceSetIds,
  getPriceHistorySummary,
  getPriceHistorySummaryState,
  getPricePanelSnapshot,
  isWishlistAlertNotificationCandidateNew,
  listPriceHistory,
  listPricingObservations,
  summarizeWishlistPriceAlerts,
  summarizeNewWishlistAlertCandidates,
} from './pricing-data-access';

describe('pricing data access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(getDefaultFormattingLocale).mockReturnValue('nl-NL');
  });

  test('returns a set-aware Dutch price panel snapshot', () => {
    expect(getPricePanelSnapshot('10316')).toEqual({
      setId: '10316',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 48246,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'amazon-nl',
      lowestMerchantName: 'Amazon',
      merchantCount: 2,
      observedAt: '2026-03-31T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -1753,
    });
  });

  test('returns a set-aware snapshot for newly enabled curated commerce coverage', () => {
    expect(getPricePanelSnapshot('10333')).toEqual({
      setId: '10333',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 43558,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'amazon-nl',
      lowestMerchantName: 'Amazon',
      merchantCount: 2,
      observedAt: '2026-03-31T09:56:00.000Z',
      referencePriceMinor: 45999,
      deltaMinor: -2441,
    });
  });

  test('returns reviewed official-store pricing for newly added curated sets', () => {
    expect(getPricePanelSnapshot('75397')).toEqual({
      setId: '75397',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 49999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'lego-nl',
      lowestMerchantName: 'LEGO',
      merchantCount: 1,
      observedAt: '2026-03-31T11:20:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: 0,
    });
  });

  test('returns reviewed multi-merchant pricing for the newest curated batch', () => {
    expect(getPricePanelSnapshot('10354')).toEqual({
      setId: '10354',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 26999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'lego-nl',
      lowestMerchantName: 'LEGO',
      merchantCount: 2,
      observedAt: '2026-04-03T09:28:00.000Z',
      referencePriceMinor: 26999,
      deltaMinor: 0,
    });
  });

  test('builds a compact featured-set price context from the current snapshot', () => {
    expect(getFeaturedSetPriceContext('10316')).toEqual({
      setId: '10316',
      currencyCode: 'EUR',
      headlinePriceMinor: 48246,
      availabilityLabel: 'In stock',
      merchantName: 'Amazon',
      merchantCount: 2,
      observedAt: '2026-03-31T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -1753,
    });
  });

  test('builds a formatted reviewed price summary for collector list surfaces', () => {
    expect(getReviewedPriceSummary('10354')).toEqual({
      availabilityLabel: 'In stock',
      coverageLabel: 'In stock · 2 reviewed aanbiedingen',
      coverageNote: 'Tot nu toe pas 2 reviewed aanbiedingen',
      currentPrice: '€ 269,99',
      dealLabel: 'Precies op referentie',
      merchantLabel: 'Laagste reviewed prijs bij LEGO',
      pricePositionLabel: 'Op referentie',
      reviewedLabel: 'Gecheckt 3 apr',
    });
  });

  test('builds a decisive deal verdict from the current snapshot', () => {
    expect(getSetDealVerdict('10354')).toEqual({
      explanation:
        'Prima prijs, maar niet uitzonderlijk laag. Alleen kopen als je hem nu graag wilt hebben.',
      label: 'Prima prijs',
      tone: 'info',
    });

    expect(
      buildSetDealVerdict({
        deltaMinor: 0,
      }),
    ).toEqual({
      explanation:
        'Prima prijs, maar niet uitzonderlijk laag. Alleen kopen als je hem nu graag wilt hebben.',
      label: 'Prima prijs',
      tone: 'info',
    });

    expect(
      buildSetDealVerdict({
        deltaMinor: 1299,
      }),
    ).toEqual({
      explanation:
        'Deze prijs ligt boven wat we meestal zien. Wachten is slimmer dan nu kopen.',
      label: 'Wachten loont',
      tone: 'warning',
    });
  });

  test('builds reusable no-offer decision guidance when the price is good but no route is reliable yet', () => {
    expect(
      buildSetDecisionPresentation({
        hasCurrentOffer: false,
        pricePanelSnapshot: {
          deltaMinor: -3000,
        },
        theme: 'Icons',
      }),
    ).toEqual({
      cardLabel: 'Goede prijs',
      cardSupportingCopy: 'Nog geen klikroute',
      followCopy:
        'Sterke prijs gezien, nog zonder betrouwbare klikroute. Volg deze set voor het moment dat die er wel is.',
      followEyebrow: 'Laat Brickhunt meekijken',
      followTitle: 'Volg deze set',
      noOfferCopy:
        'Sterke prijs gezien, maar nog geen betrouwbare route om nu op te klikken.',
      noOfferTitle: 'Nog geen klikroute',
      state: 'buy',
      verdict: {
        explanation:
          'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
        label: 'Goede deal',
        tone: 'positive',
      },
    });
  });

  test('treats live current offers as meaningful even when history is still limited', () => {
    expect(
      buildSetDealVerdict(undefined, {
        hasCurrentOffer: true,
        theme: 'Super Mario',
      }),
    ).toEqual({
      explanation:
        'Actuele prijzen zijn er al. Het prijsverloop bouwt nog op, dus het koopmoment wordt nog scherper.',
      label: 'Actuele prijzen binnen',
      tone: 'info',
    });

    expect(
      buildSetDecisionPresentation({
        hasCurrentOffer: true,
        theme: 'Super Mario',
      }),
    ).toEqual({
      cardLabel: 'Actuele prijzen binnen',
      cardSupportingCopy: 'Prijsverloop bouwt nog op',
      followCopy:
        'We zien de huidige prijzen al. Volg deze set als je ook wilt zien wanneer hij echt scherp zakt.',
      followEyebrow: 'Historie volgt nog',
      followTitle: 'Volg deze prijs',
      noOfferCopy:
        'Actuele prijzen zijn er al, maar het prijsverloop over tijd bouwt nog op.',
      noOfferTitle: 'Prijsverloop bouwt nog op',
      state: 'limited',
      verdict: {
        explanation:
          'Actuele prijzen zijn er al. Het prijsverloop bouwt nog op, dus het koopmoment wordt nog scherper.',
        label: 'Actuele prijzen binnen',
        tone: 'info',
      },
    });
  });

  test('builds compact deal-support copy from current price signals', () => {
    expect(
      buildSetDecisionSupportItems({
        hasCurrentOffer: true,
        pricePanelSnapshot: {
          deltaMinor: -3000,
          merchantCount: 2,
        },
      }),
    ).toEqual([
      {
        id: 'price-below-normal',
        text: 'Onder het normale prijsniveau.',
      },
      {
        id: 'best-price-now',
        text: 'Beste prijs die we nu volgen.',
      },
      {
        id: 'merchant-coverage',
        text: '2 winkels nagekeken.',
      },
    ]);
  });

  test('adds no-offer guidance when Brickhunt sees a price but no reliable route yet', () => {
    expect(
      buildSetDecisionSupportItems({
        hasCurrentOffer: false,
        pricePanelSnapshot: {
          deltaMinor: -3000,
          merchantCount: 2,
        },
      }),
    ).toEqual([
      {
        id: 'price-below-normal',
        text: 'Onder het normale prijsniveau.',
      },
      {
        id: 'merchant-coverage',
        text: '2 winkels nagekeken.',
      },
      {
        id: 'no-reliable-offer',
        text: 'Sterke prijs gezien, maar nog geen betrouwbare route om nu op te klikken.',
      },
    ]);
  });

  test('keeps deal-support truthful when data is still limited', () => {
    expect(
      buildSetDecisionSupportItems({
        hasCurrentOffer: true,
        merchantCount: 1,
      }),
    ).toEqual([
      {
        id: 'best-price-now',
        text: 'Dit is nu de beste prijs die we zien.',
      },
      {
        id: 'merchant-coverage',
        text: '1 winkel nagekeken.',
      },
      {
        id: 'limited-history',
        text: 'Prijsverloop bouwt nog op.',
      },
    ]);
  });

  test('keeps the empty pricing state when no live current offer exists', () => {
    expect(
      buildSetDecisionPresentation({
        hasCurrentOffer: false,
        theme: 'Super Mario',
      }),
    ).toEqual({
      cardLabel: 'Prijsdata nog beperkt',
      cardSupportingCopy: 'Prijsbeeld bouwt nog op',
      followCopy:
        'Brickhunt bouwt het prijsbeeld nog op. Volgen helpt hier het meest.',
      followEyebrow: 'Prijs volgen',
      followTitle: 'Volg deze set',
      noOfferCopy:
        'Nog te weinig prijschecks voor een hard koopmoment of klikroute.',
      noOfferTitle: 'Prijsbeeld bouwt nog op',
      state: 'limited',
      verdict: {
        explanation:
          'Prijsdata nog beperkt. Even volgen geeft straks een beter signaal.',
        label: 'Prijsdata nog beperkt',
        tone: 'neutral',
      },
    });
  });

  test('builds a compact Brickhunt value block for the set detail page', () => {
    expect(
      buildBrickhuntValueItems({
        merchantCount: 3,
      }),
    ).toEqual([
      {
        id: 'brickhunt-monitoring',
        text: '3 winkels worden actief nagekeken.',
      },
      {
        id: 'brickhunt-guidance',
        text: 'Je ziet meteen of deze prijs echt opvalt.',
      },
      {
        id: 'brickhunt-alerts',
        text: 'Nog niet klaar? Volg de prijs.',
      },
    ]);
  });

  test('builds short set-detail price insights before the chart', () => {
    expect(
      buildSetPriceInsights({
        priceHistorySummaryState: {
          pointCount: 30,
          priceHistorySummary: {
            averagePriceMinor: 49249,
            currencyCode: 'EUR',
            currentHeadlinePriceMinor: 46999,
            deltaVsAverageMinor: -2250,
            highPriceMinor: 51999,
            lowPriceMinor: 45999,
            pointCount: 30,
          },
          trackedPriceSummary: {
            currencyCode: 'EUR',
            currentHeadlinePriceMinor: 46999,
            deltaVsTrackedHighMinor: -6000,
            deltaVsTrackedLowMinor: 1000,
            pointCount: 40,
            trackedHighPriceMinor: 52999,
            trackedLowPriceMinor: 45999,
            trackedSinceRecordedOn: '2026-02-20',
          },
        },
        pricePanelSnapshot: getPricePanelSnapshot('10316'),
      }),
    ).toEqual([
      {
        id: 'current-vs-normal',
        text: 'De huidige prijs ligt laag vergeleken met wat we meestal zien.',
      },
      {
        id: 'recent-low',
        text: 'Laagste prijs in 30 dagen: € 459,99',
      },
      {
        id: 'tracked-low',
        text: 'Deze set zakt meestal niet veel lager dan dit.',
      },
    ]);
  });

  test('builds set-detail price insights that separate live prices from limited history', () => {
    expect(
      buildSetPriceInsights({
        hasCurrentOffer: true,
        merchantCount: 3,
      }),
    ).toEqual([
      {
        id: 'limited-data',
        text: 'Actuele prijzen zijn er al.',
      },
      {
        id: 'coverage',
        text: '3 winkels nagekeken.',
      },
      {
        id: 'limited-history',
        text: 'Prijsverloop bouwt nog op.',
      },
    ]);
  });

  test('prefers a new tracked low when building a wishlist alert', () => {
    expect(
      buildWishlistPriceAlert({
        priceHistoryPoints: [
          {
            setId: '76453',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 12999,
            referencePriceMinor: 14999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-04-01T09:00:00.000Z',
            recordedOn: '2026-04-01',
          },
          {
            setId: '76453',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 12499,
            referencePriceMinor: 14999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-04-02T09:00:00.000Z',
            recordedOn: '2026-04-02',
          },
        ],
        savedAt: '2026-04-01T12:00:00.000Z',
        setId: '76453',
      }),
    ).toEqual({
      detail: '€ 119,99 is € 5,00 onder de vorige beste tracked prijs.',
      kind: 'new-best-price',
      label: 'Nieuwe beste reviewed prijs',
      tone: 'positive',
    });
  });

  test('falls back to a strong-deal alert when no saved baseline is available', () => {
    expect(
      buildWishlistPriceAlert({
        setId: '76453',
      }),
    ).toEqual({
      detail: '€ 30,00 onder referentie · In stock',
      kind: 'strong-deal-now',
      label: 'Sterke deal nu',
      tone: 'accent',
    });
  });

  test('shows a lower-than-saved alert when the price improved after save but is not a new low', () => {
    expect(
      buildWishlistPriceAlert({
        priceHistoryPoints: [
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 45999,
            referencePriceMinor: 49999,
            lowestMerchantId: 'bol',
            observedAt: '2026-03-20T09:00:00.000Z',
            recordedOn: '2026-03-20',
          },
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 48999,
            referencePriceMinor: 49999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-03-28T09:00:00.000Z',
            recordedOn: '2026-03-28',
          },
        ],
        savedAt: '2026-03-28T12:00:00.000Z',
        setId: '10316',
      }),
    ).toEqual({
      detail: '€ 482,46 is € 7,53 lager dan toen je deze set opsloeg.',
      kind: 'price-improved-since-save',
      label: 'Lager dan toen je hem opsloeg',
      tone: 'positive',
    });
  });

  test('surfaces deal spotlights by strongest reviewed price gap first', () => {
    expect(
      listDealSpotlightPriceContexts({
        candidateSetIds: ['21348', '10316', '76269', '10333'],
        limit: 3,
      }).map((priceContext) => priceContext.setId),
    ).toEqual(['10333', '76269', '10316']);
  });

  test('uses candidate ordering to break ties between similar deal signals', () => {
    expect(
      listDealSpotlightPriceContexts({
        candidateSetIds: ['10333', '21333'],
        limit: 2,
      }).map((priceContext) => priceContext.setId),
    ).toEqual(['10333']);
  });

  test('lists the reviewed set ids that can drive curated browse prioritization', () => {
    expect(listReviewedPriceSetIds()).toEqual(
      expect.arrayContaining(['10316', '76269', '75397', '10354', '76453']),
    );
    expect(new Set(listReviewedPriceSetIds()).size).toBe(
      listReviewedPriceSetIds().length,
    );
  });

  test('lists pricing observations for a single set only', () => {
    expect(listPricingObservations('21348')).toHaveLength(1);
    expect(
      listPricingObservations('21348').every(
        (pricingObservation) => pricingObservation.setId === '21348',
      ),
    ).toBe(true);
  });

  test('returns the last 30 Dutch history points in chart order for one set', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 48999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'bol',
            observed_at: '2026-03-29T09:00:00.000Z',
            recorded_on: '2026-03-29',
          },
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 49499,
            reference_price_minor: 49999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-03-28T09:00:00.000Z',
            recorded_on: '2026-03-28',
          },
        ],
        error: null,
      }),
    };

    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(true);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    await expect(listPriceHistory('10316')).resolves.toEqual([
      {
        setId: '10316',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 49499,
        referencePriceMinor: 49999,
        lowestMerchantId: 'lego-nl',
        observedAt: '2026-03-28T09:00:00.000Z',
        recordedOn: '2026-03-28',
      },
      {
        setId: '10316',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 48999,
        referencePriceMinor: 49999,
        lowestMerchantId: 'bol',
        observedAt: '2026-03-29T09:00:00.000Z',
        recordedOn: '2026-03-29',
      },
    ]);
  });

  test('batches wishlist alerts across saved sets and uses saved timestamps', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            set_id: '76453',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 12999,
            reference_price_minor: 14999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-04-01T09:00:00.000Z',
            recorded_on: '2026-04-01',
          },
          {
            set_id: '76453',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 12499,
            reference_price_minor: 14999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-04-02T09:00:00.000Z',
            recorded_on: '2026-04-02',
          },
        ],
        error: null,
      }),
    };

    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(true);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    await expect(
      listWishlistPriceAlerts({
        savedAtBySetId: {
          '76453': '2026-04-01T12:00:00.000Z',
        },
        setIds: ['76453'],
      }),
    ).resolves.toEqual({
      '76453': {
        detail: '€ 119,99 is € 5,00 onder de vorige beste tracked prijs.',
        kind: 'new-best-price',
        label: 'Nieuwe beste reviewed prijs',
        tone: 'positive',
      },
    });
  });

  test('summarizes active wishlist alerts by kind', () => {
    expect(
      summarizeWishlistPriceAlerts({
        '10354': {
          detail: '€ 246,43 is € 8,56 below the previous tracked low.',
          kind: 'new-best-price',
          label: 'New best reviewed price',
          tone: 'positive',
        },
        '10316': {
          detail: '€ 469,99 is € 20,00 lower than when you saved it.',
          kind: 'price-improved-since-save',
          label: 'Lower than when you saved it',
          tone: 'positive',
        },
        '76453': {
          detail: '€ 20,00 below reference · In stock',
          kind: 'strong-deal-now',
          label: 'Strong deal right now',
          tone: 'accent',
        },
        '21348': undefined,
      }),
    ).toEqual({
      activeCount: 3,
      newBestPriceCount: 1,
      priceImprovedSinceSaveCount: 1,
      strongDealCount: 1,
    });
    expect(summarizeWishlistPriceAlerts({})).toBeUndefined();
  });

  test('builds a first-run wishlist notification candidate from an active alert', () => {
    expect(
      buildWishlistAlertNotificationCandidate({
        alert: {
          detail: '€ 30,00 below reference · In stock',
          kind: 'strong-deal-now',
          label: 'Strong deal right now',
          tone: 'accent',
        },
        now: '2026-04-03T10:00:00.000Z',
        setId: '76453',
      }),
    ).toEqual({
      cooldownDays: DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
      cooldownEndsAt: undefined,
      dedupeKey: '76453:strong-deal-now',
      detail: '€ 30,00 below reference · In stock',
      evaluatedAt: '2026-04-03T10:00:00.000Z',
      isNewlyNotifiable: true,
      kind: 'strong-deal-now',
      label: 'Strong deal right now',
      notificationReason: 'first-signal',
      priority: 1,
      signalObservedAt: '2026-04-03T09:08:00.000Z',
      setId: '76453',
      supersedesPreviousKind: undefined,
      tone: 'accent',
    });
  });

  test('suppresses the same wishlist signal while its cooldown is active', () => {
    expect(
      buildWishlistAlertNotificationCandidate({
        alert: {
          detail: '€ 30,00 below reference · In stock',
          kind: 'strong-deal-now',
          label: 'Strong deal right now',
          tone: 'accent',
        },
        now: '2026-04-10T10:00:00.000Z',
        previousNotificationState: {
          lastNotifiedAt: '2026-04-03T10:00:00.000Z',
          lastNotifiedKind: 'strong-deal-now',
        },
        setId: '76453',
      }),
    ).toEqual({
      cooldownDays: DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
      cooldownEndsAt: '2026-04-17T10:00:00.000Z',
      dedupeKey: '76453:strong-deal-now',
      detail: '€ 30,00 below reference · In stock',
      evaluatedAt: '2026-04-10T10:00:00.000Z',
      isNewlyNotifiable: false,
      kind: 'strong-deal-now',
      label: 'Strong deal right now',
      priority: 1,
      signalObservedAt: '2026-04-03T09:08:00.000Z',
      setId: '76453',
      suppressionReason: 'cooldown-active',
      tone: 'accent',
    });
  });

  test('allows a stronger wishlist signal to supersede a weaker one during cooldown', () => {
    expect(
      buildWishlistAlertNotificationCandidate({
        alert: {
          detail: '€ 119,99 is € 5,00 below the previous tracked low.',
          kind: 'new-best-price',
          label: 'New best reviewed price',
          tone: 'positive',
        },
        now: '2026-04-10T10:00:00.000Z',
        previousNotificationState: {
          lastNotifiedAt: '2026-04-03T10:00:00.000Z',
          lastNotifiedKind: 'strong-deal-now',
        },
        setId: '76453',
      }),
    ).toEqual({
      cooldownDays: DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
      cooldownEndsAt: '2026-04-17T10:00:00.000Z',
      dedupeKey: '76453:new-best-price',
      detail: '€ 119,99 is € 5,00 below the previous tracked low.',
      evaluatedAt: '2026-04-10T10:00:00.000Z',
      isNewlyNotifiable: true,
      kind: 'new-best-price',
      label: 'New best reviewed price',
      notificationReason: 'higher-priority-signal',
      priority: 3,
      signalObservedAt: '2026-04-03T09:08:00.000Z',
      setId: '76453',
      supersedesPreviousKind: 'strong-deal-now',
      tone: 'positive',
    });
  });

  test('builds notifiable wishlist candidates in batch and preserves inactive sets', () => {
    expect(
      listWishlistAlertNotificationCandidates({
        now: '2026-04-20T10:00:00.000Z',
        previousNotificationStateBySetId: {
          '10316': {
            lastNotifiedAt: '2026-04-03T10:00:00.000Z',
            lastNotifiedKind: 'price-improved-since-save',
          },
        },
        wishlistPriceAlerts: {
          '10316': {
            detail: '€ 482,46 is € 7,53 lower than when you saved it.',
            kind: 'price-improved-since-save',
            label: 'Lower than when you saved it',
            tone: 'positive',
          },
          '76453': {
            detail: '€ 119,99 is € 5,00 below the previous tracked low.',
            kind: 'new-best-price',
            label: 'New best reviewed price',
            tone: 'positive',
          },
          '21348': undefined,
        },
      }),
    ).toEqual({
      '10316': {
        cooldownDays: DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
        cooldownEndsAt: '2026-04-17T10:00:00.000Z',
        dedupeKey: '10316:price-improved-since-save',
        detail: '€ 482,46 is € 7,53 lower than when you saved it.',
        evaluatedAt: '2026-04-20T10:00:00.000Z',
        isNewlyNotifiable: true,
        kind: 'price-improved-since-save',
        label: 'Lower than when you saved it',
        notificationReason: 'cooldown-expired',
        priority: 2,
        signalObservedAt: '2026-03-31T09:00:00.000Z',
        setId: '10316',
        supersedesPreviousKind: undefined,
        tone: 'positive',
      },
      '76453': {
        cooldownDays: DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
        cooldownEndsAt: undefined,
        dedupeKey: '76453:new-best-price',
        detail: '€ 119,99 is € 5,00 below the previous tracked low.',
        evaluatedAt: '2026-04-20T10:00:00.000Z',
        isNewlyNotifiable: true,
        kind: 'new-best-price',
        label: 'New best reviewed price',
        notificationReason: 'first-signal',
        priority: 3,
        signalObservedAt: '2026-04-03T09:08:00.000Z',
        setId: '76453',
        supersedesPreviousKind: undefined,
        tone: 'positive',
      },
      '21348': undefined,
    });
  });

  test('marks a wishlist notification candidate as new when it appeared after the last viewed timestamp', () => {
    expect(
      isWishlistAlertNotificationCandidateNew({
        lastViewedAt: '2026-04-02T12:00:00.000Z',
        wishlistAlertNotificationCandidate:
          buildWishlistAlertNotificationCandidate({
            alert: {
              detail: '€ 246,43 is € 8,56 below the previous tracked low.',
              kind: 'new-best-price',
              label: 'New best reviewed price',
              tone: 'positive',
            },
            now: '2026-04-03T10:00:00.000Z',
            setId: '10354',
          }),
      }),
    ).toBe(true);
  });

  test('does not mark a wishlist notification candidate as new after the user already viewed it', () => {
    expect(
      isWishlistAlertNotificationCandidateNew({
        lastViewedAt: '2026-04-03T12:00:00.000Z',
        wishlistAlertNotificationCandidate:
          buildWishlistAlertNotificationCandidate({
            alert: {
              detail: '€ 246,43 is € 8,56 below the previous tracked low.',
              kind: 'new-best-price',
              label: 'New best reviewed price',
              tone: 'positive',
            },
            now: '2026-04-04T10:00:00.000Z',
            setId: '10354',
          }),
      }),
    ).toBe(false);
  });

  test('summarizes only the wishlist notification candidates that are new since last view', () => {
    expect(
      summarizeNewWishlistAlertCandidates({
        lastViewedAt: '2026-04-02T12:00:00.000Z',
        wishlistAlertNotificationCandidates: {
          '10316': {
            cooldownDays: 14,
            dedupeKey: '10316:price-improved-since-save',
            detail: '€ 469,99 is € 20,00 lower than when you saved it.',
            evaluatedAt: '2026-04-03T10:00:00.000Z',
            isNewlyNotifiable: true,
            kind: 'price-improved-since-save',
            label: 'Lower than when you saved it',
            priority: 2,
            signalObservedAt: '2026-03-31T09:00:00.000Z',
            setId: '10316',
            tone: 'positive',
          },
          '10354': {
            cooldownDays: 14,
            dedupeKey: '10354:new-best-price',
            detail: '€ 246,43 is € 8,56 below the previous tracked low.',
            evaluatedAt: '2026-04-03T10:00:00.000Z',
            isNewlyNotifiable: true,
            kind: 'new-best-price',
            label: 'New best reviewed price',
            priority: 3,
            signalObservedAt: '2026-04-03T09:24:00.000Z',
            setId: '10354',
            tone: 'positive',
          },
          '76453': {
            cooldownDays: 14,
            dedupeKey: '76453:strong-deal-now',
            detail: '€ 20,00 below reference · In stock',
            evaluatedAt: '2026-04-03T10:00:00.000Z',
            isNewlyNotifiable: false,
            kind: 'strong-deal-now',
            label: 'Strong deal right now',
            priority: 1,
            signalObservedAt: '2026-04-03T09:24:00.000Z',
            setId: '76453',
            suppressionReason: 'cooldown-active',
            tone: 'accent',
          },
        },
      }),
    ).toEqual({
      newCount: 1,
      newBestPriceCount: 1,
      priceImprovedSinceSaveCount: 0,
      strongDealCount: 0,
    });
  });

  test('builds a compact 30-day summary from history points and the current price', () => {
    expect(
      buildPriceHistorySummary({
        currentHeadlinePriceMinor: 48999,
        priceHistoryPoints: [
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 49499,
            observedAt: '2026-03-28T09:00:00.000Z',
            recordedOn: '2026-03-28',
          },
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 48999,
            observedAt: '2026-03-29T09:00:00.000Z',
            recordedOn: '2026-03-29',
          },
        ],
      }),
    ).toEqual({
      currencyCode: 'EUR',
      currentHeadlinePriceMinor: 48999,
      averagePriceMinor: 49249,
      deltaVsAverageMinor: -250,
      lowPriceMinor: 48999,
      highPriceMinor: 49499,
      pointCount: 2,
    });
  });

  test('returns no summary when too little price history exists', () => {
    expect(
      buildPriceHistorySummary({
        currentHeadlinePriceMinor: 48999,
        priceHistoryPoints: [
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 48999,
            observedAt: '2026-03-29T09:00:00.000Z',
            recordedOn: '2026-03-29',
          },
        ],
      }),
    ).toBeUndefined();
  });

  test('builds tracked price context from the full stored history slice', () => {
    expect(
      buildTrackedPriceSummary({
        currentHeadlinePriceMinor: 48999,
        priceHistoryPoints: [
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 50999,
            observedAt: '2026-03-20T09:00:00.000Z',
            recordedOn: '2026-03-20',
          },
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 49499,
            observedAt: '2026-03-28T09:00:00.000Z',
            recordedOn: '2026-03-28',
          },
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 48999,
            observedAt: '2026-03-29T09:00:00.000Z',
            recordedOn: '2026-03-29',
          },
        ],
      }),
    ).toEqual({
      currencyCode: 'EUR',
      currentHeadlinePriceMinor: 48999,
      deltaVsTrackedLowMinor: 0,
      deltaVsTrackedHighMinor: -2000,
      pointCount: 3,
      trackedHighPriceMinor: 50999,
      trackedLowPriceMinor: 48999,
      trackedSinceRecordedOn: '2026-03-20',
    });
  });

  test('derives the set summary from the current panel snapshot and history slice', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 50999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-03-20T09:00:00.000Z',
            recorded_on: '2026-03-20',
          },
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 49499,
            reference_price_minor: 49999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-03-28T09:00:00.000Z',
            recorded_on: '2026-03-28',
          },
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 48999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'bol',
            observed_at: '2026-03-29T09:00:00.000Z',
            recorded_on: '2026-03-29',
          },
        ],
        error: null,
      }),
    };

    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(true);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    await expect(getPriceHistorySummary('10316')).resolves.toEqual({
      currencyCode: 'EUR',
      currentHeadlinePriceMinor: 48246,
      averagePriceMinor: 49832,
      deltaVsAverageMinor: -1586,
      lowPriceMinor: 48999,
      highPriceMinor: 50999,
      pointCount: 3,
    });
  });

  test('returns both the 30-day summary and tracked price context for the panel', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 50999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-03-20T09:00:00.000Z',
            recorded_on: '2026-03-20',
          },
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 49499,
            reference_price_minor: 49999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-03-28T09:00:00.000Z',
            recorded_on: '2026-03-28',
          },
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 48999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'bol',
            observed_at: '2026-03-29T09:00:00.000Z',
            recorded_on: '2026-03-29',
          },
        ],
        error: null,
      }),
    };

    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(true);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    await expect(getPriceHistorySummaryState('10316')).resolves.toEqual({
      pointCount: 3,
      priceHistorySummary: {
        currencyCode: 'EUR',
        currentHeadlinePriceMinor: 48246,
        averagePriceMinor: 49832,
        deltaVsAverageMinor: -1586,
        lowPriceMinor: 48999,
        highPriceMinor: 50999,
        pointCount: 3,
      },
      trackedPriceSummary: {
        currencyCode: 'EUR',
        currentHeadlinePriceMinor: 48246,
        deltaVsTrackedHighMinor: -2753,
        deltaVsTrackedLowMinor: -753,
        pointCount: 3,
        trackedHighPriceMinor: 50999,
        trackedLowPriceMinor: 48999,
        trackedSinceRecordedOn: '2026-03-20',
      },
    });
  });

  test('returns point-count context even when one point is not enough for a summary yet', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            set_id: '10316',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 48999,
            reference_price_minor: 49999,
            lowest_merchant_id: 'bol',
            observed_at: '2026-03-29T09:00:00.000Z',
            recorded_on: '2026-03-29',
          },
        ],
        error: null,
      }),
    };

    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(true);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    await expect(getPriceHistorySummaryState('10316')).resolves.toEqual({
      pointCount: 1,
      priceHistorySummary: undefined,
      trackedPriceSummary: {
        currencyCode: 'EUR',
        currentHeadlinePriceMinor: 48246,
        deltaVsTrackedHighMinor: -753,
        deltaVsTrackedLowMinor: -753,
        pointCount: 1,
        trackedHighPriceMinor: 48999,
        trackedLowPriceMinor: 48999,
        trackedSinceRecordedOn: '2026-03-29',
      },
    });
  });

  test('returns an empty history slice when browser Supabase config is unavailable', async () => {
    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(false);

    await expect(listPriceHistory('10316')).resolves.toEqual([]);
    expect(getBrowserSupabaseClient).not.toHaveBeenCalled();
  });
});
