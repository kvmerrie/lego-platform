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
  buildWishlistPriceAlert,
  buildPriceHistorySummary,
  buildTrackedPriceSummary,
  getFeaturedSetPriceContext,
  getReviewedPriceSummary,
  listDealSpotlightPriceContexts,
  listWishlistPriceAlerts,
  listReviewedPriceSetIds,
  getPriceHistorySummary,
  getPriceHistorySummaryState,
  getPricePanelSnapshot,
  listPriceHistory,
  listPricingObservations,
  summarizeWishlistPriceAlerts,
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
      headlinePriceMinor: 46999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'bol',
      lowestMerchantName: 'bol',
      merchantCount: 2,
      observedAt: '2026-03-31T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -3000,
    });
  });

  test('returns a set-aware snapshot for newly enabled curated commerce coverage', () => {
    expect(getPricePanelSnapshot('10333')).toEqual({
      setId: '10333',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 43999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'bol',
      lowestMerchantName: 'bol',
      merchantCount: 2,
      observedAt: '2026-03-31T09:56:00.000Z',
      referencePriceMinor: 45999,
      deltaMinor: -2000,
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
      headlinePriceMinor: 24643,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'bol',
      lowestMerchantName: 'bol',
      merchantCount: 2,
      observedAt: '2026-04-03T09:24:00.000Z',
      referencePriceMinor: 26999,
      deltaMinor: -2356,
    });
  });

  test('builds a compact featured-set price context from the current snapshot', () => {
    expect(getFeaturedSetPriceContext('10316')).toEqual({
      setId: '10316',
      currencyCode: 'EUR',
      headlinePriceMinor: 46999,
      availabilityLabel: 'In stock',
      merchantName: 'bol',
      merchantCount: 2,
      observedAt: '2026-03-31T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -3000,
    });
  });

  test('builds a formatted reviewed price summary for collector list surfaces', () => {
    expect(getReviewedPriceSummary('10354')).toEqual({
      availabilityLabel: 'In stock',
      coverageLabel: 'In stock · 2 reviewed offers',
      coverageNote: 'Only 2 reviewed offers so far',
      currentPrice: '€ 246,43',
      dealLabel: 'Best current deal',
      merchantLabel: 'Lowest reviewed price at bol',
      pricePositionLabel: '€ 23,56 below reference',
      reviewedLabel: 'Checked 3 apr',
    });
  });

  test('prefers a new tracked low when building a wishlist alert', () => {
    expect(
      buildWishlistPriceAlert({
        priceHistoryPoints: [
          {
            setId: '10354',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 25999,
            referencePriceMinor: 26999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-04-01T09:00:00.000Z',
            recordedOn: '2026-04-01',
          },
          {
            setId: '10354',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 25499,
            referencePriceMinor: 26999,
            lowestMerchantId: 'bol',
            observedAt: '2026-04-02T09:00:00.000Z',
            recordedOn: '2026-04-02',
          },
        ],
        savedAt: '2026-04-01T12:00:00.000Z',
        setId: '10354',
      }),
    ).toEqual({
      detail: '€ 246,43 is € 8,56 below the previous tracked low.',
      kind: 'new-best-price',
      label: 'New best reviewed price',
      tone: 'positive',
    });
  });

  test('falls back to a strong-deal alert when no saved baseline is available', () => {
    expect(
      buildWishlistPriceAlert({
        setId: '10354',
      }),
    ).toEqual({
      detail: '€ 23,56 below reference · In stock',
      kind: 'strong-deal-now',
      label: 'Strong deal right now',
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
      detail: '€ 469,99 is € 20,00 lower than when you saved it.',
      kind: 'price-improved-since-save',
      label: 'Lower than when you saved it',
      tone: 'positive',
    });
  });

  test('surfaces deal spotlights by strongest reviewed price gap first', () => {
    expect(
      listDealSpotlightPriceContexts({
        candidateSetIds: ['21348', '10316', '76269', '10333'],
        limit: 3,
      }).map((priceContext) => priceContext.setId),
    ).toEqual(['76269', '10316', '21348']);
  });

  test('uses candidate ordering to break ties between similar deal signals', () => {
    expect(
      listDealSpotlightPriceContexts({
        candidateSetIds: ['10333', '21333'],
        limit: 2,
      }).map((priceContext) => priceContext.setId),
    ).toEqual(['10333', '21333']);
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
    expect(listPricingObservations('21348')).toHaveLength(2);
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
            set_id: '10354',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 25999,
            reference_price_minor: 26999,
            lowest_merchant_id: 'lego-nl',
            observed_at: '2026-04-01T09:00:00.000Z',
            recorded_on: '2026-04-01',
          },
          {
            set_id: '10354',
            region_code: 'NL',
            currency_code: 'EUR',
            condition: 'new',
            headline_price_minor: 25499,
            reference_price_minor: 26999,
            lowest_merchant_id: 'bol',
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
          '10354': '2026-04-01T12:00:00.000Z',
        },
        setIds: ['10354'],
      }),
    ).resolves.toEqual({
      '10354': {
        detail: '€ 246,43 is € 8,56 below the previous tracked low.',
        kind: 'new-best-price',
        label: 'New best reviewed price',
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
      currentHeadlinePriceMinor: 46999,
      averagePriceMinor: 49832,
      deltaVsAverageMinor: -2833,
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
        currentHeadlinePriceMinor: 46999,
        averagePriceMinor: 49832,
        deltaVsAverageMinor: -2833,
        lowPriceMinor: 48999,
        highPriceMinor: 50999,
        pointCount: 3,
      },
      trackedPriceSummary: {
        currencyCode: 'EUR',
        currentHeadlinePriceMinor: 46999,
        deltaVsTrackedHighMinor: -4000,
        deltaVsTrackedLowMinor: -2000,
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
        currentHeadlinePriceMinor: 46999,
        deltaVsTrackedHighMinor: -2000,
        deltaVsTrackedLowMinor: -2000,
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
