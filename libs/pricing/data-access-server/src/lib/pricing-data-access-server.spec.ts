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
  const hasLatestOfferOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'latestOffer',
  );
  const latestOffer = hasLatestOfferOverride
    ? overrides.latestOffer
      ? {
          availability: 'in_stock',
          currencyCode: 'EUR',
          fetchStatus: 'success',
          observedAt: '2026-05-11T10:00:00.000Z',
          priceMinor: 46999,
          ...overrides.latestOffer,
        }
      : undefined
    : {
        availability: 'in_stock',
        currencyCode: 'EUR',
        fetchStatus: 'success',
        observedAt: '2026-05-11T10:00:00.000Z',
        priceMinor: 46999,
      };

  return {
    merchant: {
      isActive: true,
      reliabilityTier: 'production_feed',
      slug: 'alternate',
      trustedForHistory: true,
      ...overrides.merchant,
    },
    offerSeed: {
      commercialUnitType: 'full_set',
      isActive: true,
      setId: '10316',
      validationStatus: 'valid',
      ...overrides.offerSeed,
    },
    latestOffer,
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

  test('allows production-feed merchants to write daily headline history', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: {
            isActive: true,
            reliabilityTier: 'production_feed',
            slug: 'goodbricks',
            trustedForHistory: true,
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        headlinePriceMinor: 46999,
        lowestMerchantId: 'goodbricks',
      }),
    ]);
    expect(result.summary).toMatchObject({
      trustedOfferCount: 1,
      strategicManualOfferCount: 0,
      historyPointsFromTrusted: 1,
      ignoredForConfidenceCount: 0,
    });
  });

  test('excludes strategic-manual merchants from headline history', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: {
            isActive: true,
            reliabilityTier: 'strategic_manual',
            slug: 'coppenswarenhuis',
            trustedForHistory: false,
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([]);
    expect(result.summary).toMatchObject({
      eligibleLatestOfferRows: 0,
      trustedOfferCount: 0,
      strategicManualOfferCount: 1,
      historyPointsFromTrusted: 0,
      ignoredForConfidenceCount: 1,
      skipped: {
        untrustedMerchant: 1,
      },
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
        buildLatestOfferInput({
          latestOffer: undefined,
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([]);
    expect(result.summary).toMatchObject({
      latestOfferRowsSeen: 6,
      seedRowsLoaded: 7,
      missingLatestCount: 1,
      eligibleLatestOfferRows: 0,
      dailyHistoryPointsBuilt: 0,
      fetchStatusCounts: {
        success: 5,
        error: 1,
      },
      availabilityCounts: {
        unknown: 1,
        in_stock: 5,
      },
      skipped: {
        inactiveSeedOrMerchant: 1,
        invalidSeed: 1,
        missingLatest: 1,
        missingOrInvalidPrice: 1,
        nonEur: 1,
        staleOrError: 1,
        unavailableForHeadline: 1,
      },
    });
  });

  test('counts seeds without latest separately from stale or error latest rows', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          latestOffer: undefined,
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'alternate' },
          latestOffer: {
            fetchedAt: '2026-05-11T11:55:00.000Z',
            fetchStatus: 'error',
          },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'goodbricks' },
          latestOffer: {
            availability: 'in_stock',
            currencyCode: 'EUR',
            fetchStatus: 'success',
            observedAt: '2026-05-11T10:00:00.000Z',
            priceMinor: 1999,
          },
          offerSeed: {
            isActive: true,
            setId: '10316',
            validationStatus: 'valid',
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        headlinePriceMinor: 1999,
        lowestMerchantId: 'goodbricks',
      }),
    ]);
    expect(result.summary).toMatchObject({
      seedRowsLoaded: 3,
      latestOfferRowsSeen: 2,
      missingLatestCount: 1,
      eligibleLatestOfferRows: 1,
      fetchStatusCounts: {
        error: 1,
        success: 1,
      },
      availabilityCounts: {
        in_stock: 2,
      },
      skipped: {
        missingLatest: 1,
        staleOrError: 1,
      },
      staleFetchStatusMerchantCounts: {
        alternate: 1,
      },
      staleObservedAtTooOldMerchantCounts: {},
      staleOrErrorMerchantCounts: {
        alternate: 1,
      },
      staleOrErrorSamples: [
        {
          fetchedAt: '2026-05-11T11:55:00.000Z',
          fetchStatus: 'error',
          merchantSlug: 'alternate',
          observedAt: '2026-05-11T10:00:00.000Z',
          reason: 'fetch_status',
          setId: '10316',
        },
      ],
    });
  });

  test('excludes old success latest offers from today headline history', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'goodbricks' },
          latestOffer: {
            fetchedAt: '2026-05-08T11:59:59.000Z',
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
      staleFetchStatusMerchantCounts: {},
      staleObservedAtTooOldMerchantCounts: {
        goodbricks: 1,
      },
      staleOrErrorMerchantCounts: {
        goodbricks: 1,
      },
      staleOrErrorSamples: [
        {
          fetchedAt: '2026-05-08T11:59:59.000Z',
          fetchStatus: 'success',
          merchantSlug: 'goodbricks',
          observedAt: '2026-05-08T11:59:59.000Z',
          reason: 'observed_at_too_old',
          setId: '10316',
        },
      ],
    });
  });

  test('counts unavailable headline skips by merchant for freshness diagnostics', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'coppenswarenhuis' },
          latestOffer: {
            availability: 'unknown',
            observedAt: '2026-05-11T10:00:00.000Z',
            priceMinor: 1999,
          },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'coppenswarenhuis' },
          latestOffer: {
            availability: 'out_of_stock',
            observedAt: '2026-05-11T10:00:00.000Z',
            priceMinor: 2999,
          },
          offerSeed: {
            isActive: true,
            setId: '10316',
            validationStatus: 'valid',
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([]);
    expect(result.summary).toMatchObject({
      skipped: {
        unavailableForHeadline: 2,
      },
      unavailableForHeadlineMerchantCounts: {
        coppenswarenhuis: 2,
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

  test('excludes blind-bag offers from display-box headline history comparisons', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: {
            isActive: true,
            reliabilityTier: 'production_feed',
            slug: 'goodbricks',
            trustedForHistory: true,
          },
          offerSeed: {
            commercialUnitType: 'display_box',
            isActive: true,
            setId: '71050',
            validationStatus: 'valid',
          },
          latestOffer: {
            priceMinor: 5995,
          },
        }),
        buildLatestOfferInput({
          merchant: {
            isActive: true,
            reliabilityTier: 'production_feed',
            slug: 'misterbricks',
            trustedForHistory: true,
          },
          offerSeed: {
            commercialUnitType: 'blind_bag',
            isActive: true,
            setId: '71050',
            validationStatus: 'valid',
          },
          latestOffer: {
            priceMinor: 359,
          },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
      pricingReferenceValues: [
        {
          setId: '71050',
          referencePriceMinor: 5995,
        },
      ],
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        setId: '71050',
        headlinePriceMinor: 5995,
        lowestMerchantId: 'goodbricks',
        referencePriceMinor: 5995,
      }),
    ]);
    expect(result.summary).toMatchObject({
      excludedUnitMismatchCount: 1,
      unitTypeCounts: {
        blind_bag: 1,
        display_box: 1,
      },
      skipped: {
        unitMismatch: 1,
      },
    });
  });

  test('keeps same commercial unit types comparable by price', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'goodbricks' },
          offerSeed: {
            commercialUnitType: 'display_box',
            isActive: true,
            setId: '71050',
            validationStatus: 'valid',
          },
          latestOffer: { priceMinor: 5995 },
        }),
        buildLatestOfferInput({
          merchant: { isActive: true, slug: 'alternate' },
          offerSeed: {
            commercialUnitType: 'display_box',
            isActive: true,
            setId: '71050',
            validationStatus: 'valid',
          },
          latestOffer: { priceMinor: 5795 },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        headlinePriceMinor: 5795,
        lowestMerchantId: 'alternate',
      }),
    ]);
    expect(result.summary.excludedUnitMismatchCount).toBe(0);
  });

  test('does not create reference discount confidence for unknown commercial units', () => {
    const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
      latestOffers: [
        buildLatestOfferInput({
          offerSeed: {
            commercialUnitType: 'unknown',
            isActive: true,
            setId: '71050',
            validationStatus: 'valid',
          },
          latestOffer: { priceMinor: 359 },
        }),
      ],
      now: new Date('2026-05-11T12:00:00.000Z'),
      pricingReferenceValues: [
        {
          setId: '71050',
          referencePriceMinor: 5995,
        },
      ],
    });

    expect(result.points).toEqual([
      expect.objectContaining({
        headlinePriceMinor: 359,
        referencePriceMinor: undefined,
      }),
    ]);
    expect(result.summary.unitTypeCounts).toMatchObject({
      unknown: 1,
    });
  });

  test('builds price-panel snapshots from comparable commercial units only', () => {
    const result = buildPricingSyncArtifacts({
      enabledSetIds: ['71050'],
      merchantSummaries: [
        { merchantId: 'goodbricks', displayName: 'Goodbricks' },
        { merchantId: 'coppenswarenhuis', displayName: 'Coppenswarenhuis' },
      ],
      pricingObservationSeeds: [
        {
          availability: 'in_stock',
          commercialUnitType: 'display_box',
          condition: 'new',
          currencyCode: 'EUR',
          merchantId: 'goodbricks',
          merchantProductUrl: 'https://goodbricks.example/71050-box',
          observedAt: '2026-05-11T10:00:00.000Z',
          regionCode: 'NL',
          setId: '71050',
          totalPriceMinor: 5995,
        },
        {
          availability: 'in_stock',
          commercialUnitType: 'blind_bag',
          condition: 'new',
          currencyCode: 'EUR',
          merchantId: 'coppenswarenhuis',
          merchantProductUrl: 'https://coppens.example/71050-blind-bag',
          observedAt: '2026-05-11T10:01:00.000Z',
          regionCode: 'NL',
          setId: '71050',
          totalPriceMinor: 359,
        },
      ],
      pricingReferenceValues: [
        {
          setId: '71050',
          referencePriceMinor: 5995,
        },
      ],
    });

    expect(result.pricePanelSnapshots).toEqual([
      expect.objectContaining({
        headlinePriceMinor: 5995,
        lowestMerchantId: 'goodbricks',
        merchantCount: 1,
        referencePriceMinor: 5995,
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
