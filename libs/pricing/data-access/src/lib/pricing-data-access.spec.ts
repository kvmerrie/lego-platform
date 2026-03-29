import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  getBrowserSupabaseClient: vi.fn(),
}));

vi.mock('@lego-platform/shared/config', () => ({
  hasBrowserSupabaseConfig: vi.fn(),
}));

import { getBrowserSupabaseClient } from '@lego-platform/shared/data-access-auth';
import { hasBrowserSupabaseConfig } from '@lego-platform/shared/config';
import {
  buildPriceHistorySummary,
  getPriceHistorySummary,
  getPriceHistorySummaryState,
  getPricePanelSnapshot,
  listPriceHistory,
  listPricingObservations,
} from './pricing-data-access';

describe('pricing data access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test('returns a set-aware Dutch price panel snapshot', () => {
    expect(getPricePanelSnapshot('10316')).toEqual({
      setId: '10316',
      regionCode: 'NL',
      currencyCode: 'EUR',
      condition: 'new',
      headlinePriceMinor: 48999,
      lowestAvailabilityLabel: 'In stock',
      lowestMerchantId: 'bol',
      lowestMerchantName: 'bol',
      merchantCount: 3,
      observedAt: '2026-03-29T09:00:00.000Z',
      referencePriceMinor: 49999,
      deltaMinor: -1000,
    });
  });

  test('lists pricing observations for a single set only', () => {
    expect(listPricingObservations('21348')).toHaveLength(3);
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

    await expect(getPriceHistorySummary('10316')).resolves.toEqual({
      currencyCode: 'EUR',
      currentHeadlinePriceMinor: 48999,
      averagePriceMinor: 49249,
      deltaVsAverageMinor: -250,
      lowPriceMinor: 48999,
      highPriceMinor: 49499,
      pointCount: 2,
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
    });
  });

  test('returns an empty history slice when browser Supabase config is unavailable', async () => {
    vi.mocked(hasBrowserSupabaseConfig).mockReturnValue(false);

    await expect(listPriceHistory('10316')).resolves.toEqual([]);
    expect(getBrowserSupabaseClient).not.toHaveBeenCalled();
  });
});
