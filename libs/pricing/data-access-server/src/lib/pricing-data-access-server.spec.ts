import { describe, expect, test, vi } from 'vitest';
import {
  buildPricingSyncArtifacts,
  buildDailyPriceHistoryPoints,
  buildDailyPriceHistoryPointsFromCommerceLatestOffers,
  upsertDailyPriceHistoryPoints,
} from './pricing-data-access-server';

const expandedCommerceEnabledSetIds = [
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
  '76178',
  '75367',
  '21350',
  '10317',
  '75355',
  '75397',
  '76429',
  '76435',
  '76294',
  '10335',
  '10327',
  '42171',
  '42172',
  '10328',
  '75398',
  '76453',
  '76313',
  '10354',
  '42177',
  '10342',
] as const;

function buildLatestOfferInput(
  overrides: Partial<
    Parameters<
      typeof buildDailyPriceHistoryPointsFromCommerceLatestOffers
    >[0]['latestOffers'][number]
  > = {},
): Parameters<
  typeof buildDailyPriceHistoryPointsFromCommerceLatestOffers
>[0]['latestOffers'][number] {
  return {
    merchant: {
      isActive: true,
      slug: 'alternate',
      ...overrides.merchant,
    },
    offerSeed: {
      isActive: true,
      setId: '10316',
      validationStatus: 'valid',
      ...overrides.offerSeed,
    },
    latestOffer: {
      availability: 'in_stock',
      currencyCode: 'EUR',
      fetchStatus: 'success',
      observedAt: '2026-05-11T10:00:00.000Z',
      priceMinor: 46999,
      ...overrides.latestOffer,
    },
  };
}

describe('pricing data access server', () => {
  test('builds Dutch pricing artifacts for the curated commerce-enabled sets', () => {
    const result = buildPricingSyncArtifacts({
      enabledSetIds: expandedCommerceEnabledSetIds,
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
        { merchantId: 'amazon-nl', displayName: 'Amazon' },
      ],
    });

    expect(result.pricingObservations).toHaveLength(45);
    expect(result.pricePanelSnapshots).toHaveLength(30);
    expect(result.pricePanelSnapshots[0]).toMatchObject({
      lowestMerchantName: 'Amazon',
      lowestAvailabilityLabel: 'In stock',
    });
    expect(result.pricingSyncManifest.generatedAt).toBe(
      '2026-04-03T09:44:00.000Z',
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
      enabledSetIds: expandedCommerceEnabledSetIds,
      merchantSummaries: [
        { merchantId: 'lego-nl', displayName: 'LEGO' },
        { merchantId: 'bol', displayName: 'bol' },
        { merchantId: 'intertoys', displayName: 'Intertoys' },
        { merchantId: 'amazon-nl', displayName: 'Amazon' },
      ],
    });

    const historyPoints = buildDailyPriceHistoryPoints({
      now: new Date('2026-04-03T10:45:00.000Z'),
      pricePanelSnapshots: result.pricePanelSnapshots,
    });

    expect(historyPoints).toHaveLength(30);
    expect(historyPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          setId: '10316',
          headlinePriceMinor: 48246,
          referencePriceMinor: 49999,
          lowestMerchantId: 'amazon-nl',
          observedAt: '2026-03-31T09:00:00.000Z',
          recordedOn: '2026-04-03',
        }),
        expect.objectContaining({
          setId: '10305',
          headlinePriceMinor: 38999,
          referencePriceMinor: 39999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T09:40:00.000Z',
          recordedOn: '2026-04-03',
        }),
        expect.objectContaining({
          setId: '10294',
          headlinePriceMinor: 65999,
          referencePriceMinor: 67999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T10:32:00.000Z',
          recordedOn: '2026-04-03',
        }),
        expect.objectContaining({
          setId: '76178',
          headlinePriceMinor: 33999,
          referencePriceMinor: 33999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T10:48:00.000Z',
          recordedOn: '2026-04-03',
        }),
        expect.objectContaining({
          setId: '75397',
          headlinePriceMinor: 49999,
          referencePriceMinor: 49999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-03-31T11:20:00.000Z',
          recordedOn: '2026-04-03',
        }),
        expect.objectContaining({
          setId: '10354',
          headlinePriceMinor: 26999,
          referencePriceMinor: 26999,
          lowestMerchantId: 'lego-nl',
          observedAt: '2026-04-03T09:28:00.000Z',
          recordedOn: '2026-04-03',
        }),
      ]),
    );
  });

  test('builds daily price-history from valid EUR in-stock latest offers', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [buildLatestOfferInput()],
      now: new Date('2026-05-11T12:00:00.000Z'),
      pricingReferenceValues: [
        {
          setId: '10316',
          referencePriceMinor: 49999,
        },
      ],
    });

    expect(result.points).toEqual([
      {
        setId: '10316',
        regionCode: 'NL',
        currencyCode: 'EUR',
        condition: 'new',
        headlinePriceMinor: 46999,
        referencePriceMinor: 49999,
        lowestMerchantId: 'alternate',
        observedAt: '2026-05-11T10:00:00.000Z',
        recordedOn: '2026-05-11',
      },
    ]);
    expect(result.summary).toMatchObject({
      latestOfferRowsSeen: 1,
      eligibleLatestOfferRows: 1,
      dailyHistoryPointsBuilt: 1,
      newestObservedAt: '2026-05-11T10:00:00.000Z',
    });
  });

  test('excludes latest offers that should not become headline history', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          latestOffer: { availability: 'unknown' },
        }),
        buildLatestOfferInput({
          latestOffer: { fetchStatus: 'error' },
        }),
        buildLatestOfferInput({
          merchant: { isActive: false, slug: 'alternate' },
        }),
        buildLatestOfferInput({
          offerSeed: {
            isActive: true,
            setId: '10317',
            validationStatus: 'stale',
          },
        }),
        buildLatestOfferInput({
          latestOffer: { currencyCode: 'GBP' },
        }),
        buildLatestOfferInput({
          latestOffer: { priceMinor: 0 },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([]);
    expect(result.summary).toMatchObject({
      latestOfferRowsSeen: 6,
      eligibleLatestOfferRows: 0,
      dailyHistoryPointsBuilt: 0,
      skipped: {
        inactiveSeedOrMerchant: 1,
        invalidSeed: 1,
        missingOrInvalidPrice: 1,
        nonEur: 1,
        staleOrError: 1,
        unavailableForHeadline: 1,
      },
    });
  });

  test('excludes old success latest offers from today headline history', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          latestOffer: {
            observedAt: '2026-05-08T11:59:59.000Z',
          },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'coolblue' },
          latestOffer: {
            observedAt: '2026-05-09T12:00:00.000Z',
            priceMinor: 45999,
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        setId: '10316',
        headlinePriceMinor: 45999,
        lowestMerchantId: 'coolblue',
      }),
    ]);
    expect(result.summary).toMatchObject({
      eligibleLatestOfferRows: 1,
      maxObservedAgeHours: 48,
      skipped: {
        staleOrError: 1,
      },
    });
  });

  test('keeps one best-price history point per set and day', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'alternate' },
          latestOffer: {
            observedAt: '2026-05-11T09:00:00.000Z',
            priceMinor: 46999,
          },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'coolblue' },
          latestOffer: {
            observedAt: '2026-05-11T11:00:00.000Z',
            priceMinor: 45999,
          },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'goodbricks' },
          offerSeed: {
            isActive: true,
            setId: '10317',
            validationStatus: 'valid',
          },
          latestOffer: {
            observedAt: '2026-05-11T08:00:00.000Z',
            priceMinor: 22999,
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toHaveLength(2);
    expect(result.points).toEqual([
      expect.objectContaining({
        setId: '10316',
        headlinePriceMinor: 45999,
        lowestMerchantId: 'coolblue',
        recordedOn: '2026-05-11',
      }),
      expect.objectContaining({
        setId: '10317',
        headlinePriceMinor: 22999,
        lowestMerchantId: 'goodbricks',
        recordedOn: '2026-05-11',
      }),
    ]);
  });

  test('upserts daily price-history points by the daily composite key', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const deleteRows = vi.fn();
    const from = vi.fn(() => ({
      delete: deleteRows,
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
    expect(deleteRows).not.toHaveBeenCalled();
  });
});
