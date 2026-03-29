import { describe, expect, test, vi } from 'vitest';
import {
  buildPricingSyncArtifacts,
  buildDailyPriceHistoryPoints,
  upsertDailyPriceHistoryPoints,
} from './pricing-data-access-server';

describe('pricing data access server', () => {
  test('builds Dutch pricing artifacts for the curated commerce-enabled sets', () => {
    const result = buildPricingSyncArtifacts({
      enabledSetIds: ['10316', '21348', '76269'],
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO NL' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
      ],
    });

    expect(result.pricingObservations).toHaveLength(9);
    expect(result.pricePanelSnapshots).toHaveLength(3);
    expect(result.pricePanelSnapshots[0]).toMatchObject({
      lowestMerchantName: 'bol',
      lowestAvailabilityLabel: 'In stock',
    });
    expect(result.pricingSyncManifest.generatedAt).toBe(
      '2026-03-29T09:40:00.000Z',
    );
  });

  test('rejects duplicate pricing observations for one set and merchant pair', () => {
    expect(() =>
      buildPricingSyncArtifacts({
        enabledSetIds: ['10316'],
        pricingObservationSeeds: [
          {
            setId: '10316',
            merchantId: 'lego-nl',
            merchantProductUrl: 'https://www.lego.com/nl-nl/product/10316',
            totalPriceMinor: 49999,
            availability: 'in_stock',
            observedAt: '2026-03-29T09:10:00.000Z',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
          },
          {
            setId: '10316',
            merchantId: 'lego-nl',
            merchantProductUrl: 'https://www.lego.com/nl-nl/product/10316',
            totalPriceMinor: 49999,
            availability: 'limited',
            observedAt: '2026-03-29T09:11:00.000Z',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
          },
        ],
      }),
    ).toThrow('Duplicate pricing observation for 10316:lego-nl.');
  });

  test('rejects pricing observations outside the Dutch EUR new-condition slice', () => {
    expect(() =>
      buildPricingSyncArtifacts({
        enabledSetIds: ['10316'],
        pricingObservationSeeds: [
          {
            setId: '10316',
            merchantId: 'lego-nl',
            merchantProductUrl: 'https://www.lego.com/nl-nl/product/10316',
            totalPriceMinor: 49999,
            availability: 'in_stock',
            observedAt: '2026-03-29T09:10:00.000Z',
            regionCode: 'BE' as never,
            currencyCode: 'EUR',
            condition: 'new',
          },
        ],
      }),
    ).toThrow('must use the Dutch market region code.');
  });

  test('builds one daily price-history point per set from the headline pricing snapshots', () => {
    const result = buildPricingSyncArtifacts({
      enabledSetIds: ['10316', '21348', '76269'],
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO NL' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
      ],
    });

    expect(
      buildDailyPriceHistoryPoints({
        now: new Date('2026-03-30T10:00:00.000Z'),
        pricePanelSnapshots: result.pricePanelSnapshots,
      }),
    ).toEqual([
      {
        setId: '10316',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 48999,
        referencePriceMinor: 49999,
        lowestMerchantId: 'bol',
        observedAt: '2026-03-29T09:00:00.000Z',
        recordedOn: '2026-03-30',
      },
      {
        setId: '21348',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 34999,
        referencePriceMinor: 35999,
        lowestMerchantId: 'bol',
        observedAt: '2026-03-29T09:15:00.000Z',
        recordedOn: '2026-03-30',
      },
      {
        setId: '76269',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 47999,
        referencePriceMinor: 49999,
        lowestMerchantId: 'bol',
        observedAt: '2026-03-29T09:30:00.000Z',
        recordedOn: '2026-03-30',
      },
    ]);
  });

  test('upserts daily price-history points by the daily composite key', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({
      upsert,
    }));

    const result = buildPricingSyncArtifacts({
      enabledSetIds: ['10316'],
      merchantSummaries: [{ merchantId: 'bol', displayName: 'bol' }],
      pricingObservationSeeds: [
        {
          setId: '10316',
          merchantId: 'bol',
          merchantProductUrl: 'https://www.bol.com/nl/nl/p/lego-10316',
          totalPriceMinor: 48999,
          availability: 'in_stock',
          observedAt: '2026-03-29T09:00:00.000Z',
          regionCode: 'NL',
          currencyCode: 'EUR',
          condition: 'new',
        },
      ],
      pricingReferenceValues: [
        {
          setId: '10316',
          referencePriceMinor: 49999,
        },
      ],
    });

    await upsertDailyPriceHistoryPoints({
      now: new Date('2026-03-30T10:00:00.000Z'),
      pricePanelSnapshots: result.pricePanelSnapshots,
      supabaseClient: {
        from,
      } as never,
    });

    expect(from).toHaveBeenCalledWith('pricing_daily_set_history');
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          set_id: '10316',
          region_code: 'NL',
          currency_code: 'EUR',
          condition: 'new',
          headline_price_minor: 48999,
          reference_price_minor: 49999,
          lowest_merchant_id: 'bol',
          observed_at: '2026-03-29T09:00:00.000Z',
          recorded_on: '2026-03-30',
        },
      ],
      {
        onConflict: 'set_id,region_code,currency_code,condition,recorded_on',
      },
    );
  });
});
