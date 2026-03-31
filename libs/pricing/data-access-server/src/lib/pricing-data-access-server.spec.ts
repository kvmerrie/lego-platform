import { describe, expect, test, vi } from 'vitest';
import {
  buildPricingSyncArtifacts,
  buildDailyPriceHistoryPoints,
  upsertDailyPriceHistoryPoints,
} from './pricing-data-access-server';

describe('pricing data access server', () => {
  test('builds Dutch pricing artifacts for the curated commerce-enabled sets', () => {
    const result = buildPricingSyncArtifacts({
      enabledSetIds: [
        '10316',
        '21348',
        '76269',
        '10305',
        '10332',
        '10333',
        '10294',
        '21061',
        '21333',
        '21349',
      ],
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
      ],
    });

    expect(result.pricingObservations).toHaveLength(18);
    expect(result.pricePanelSnapshots).toHaveLength(10);
    expect(result.pricePanelSnapshots[0]).toMatchObject({
      lowestMerchantName: 'bol',
      lowestAvailabilityLabel: 'In stock',
    });
    expect(result.pricingSyncManifest.generatedAt).toBe(
      '2026-03-31T10:36:00.000Z',
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
            merchantProductUrl:
              'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
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
            merchantProductUrl:
              'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
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
            merchantProductUrl:
              'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
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
      enabledSetIds: [
        '10316',
        '21348',
        '76269',
        '10305',
        '10332',
        '10333',
        '10294',
        '21061',
        '21333',
        '21349',
      ],
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
      ],
    });

    const historyPoints = buildDailyPriceHistoryPoints({
      now: new Date('2026-03-31T10:45:00.000Z'),
      pricePanelSnapshots: result.pricePanelSnapshots,
    });

    expect(historyPoints).toHaveLength(10);
    expect(historyPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          setId: '10316',
          headlinePriceMinor: 46999,
          referencePriceMinor: 49999,
          lowestMerchantId: 'bol',
          observedAt: '2026-03-31T09:00:00.000Z',
          recordedOn: '2026-03-31',
        }),
        expect.objectContaining({
          setId: '10305',
          headlinePriceMinor: 38999,
          referencePriceMinor: 39999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T09:40:00.000Z',
          recordedOn: '2026-03-31',
        }),
        expect.objectContaining({
          setId: '10294',
          headlinePriceMinor: 65999,
          referencePriceMinor: 67999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T10:32:00.000Z',
          recordedOn: '2026-03-31',
        }),
      ]),
    );
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
          merchantProductUrl:
            'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
          totalPriceMinor: 46999,
          availability: 'in_stock',
          observedAt: '2026-03-31T09:00:00.000Z',
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
          headline_price_minor: 46999,
          reference_price_minor: 49999,
          lowest_merchant_id: 'bol',
          observed_at: '2026-03-31T09:00:00.000Z',
          recorded_on: '2026-03-30',
        },
      ],
      {
        onConflict: 'set_id,region_code,currency_code,condition,recorded_on',
      },
    );
  });
});
