import { describe, expect, test } from 'vitest';
import {
  buildCommerceBenchmarkCoverageRows,
  buildCommerceCoverageQueueRows,
  buildCommerceCoverageSnapshot,
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
  filterCommerceCoverageQueueRows,
  normalizeCommerceSlug,
  supportsCommerceMerchantManualSeed,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from './commerce-util';

describe('commerce util', () => {
  test('normalizes merchant slugs for boring operator-safe ids', () => {
    expect(normalizeCommerceSlug('  Amazon NL  ')).toBe('amazon-nl');
  });

  test('validates merchant input and keeps notes optional', () => {
    expect(
      validateCommerceMerchantInput({
        slug: 'Amazon NL',
        name: 'Amazon',
        isActive: true,
        sourceType: 'affiliate',
      }),
    ).toEqual({
      slug: 'amazon-nl',
      name: 'Amazon',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: undefined,
      notes: '',
    });
  });

  test('rejects invalid product urls in offer seed input', () => {
    expect(() =>
      validateCommerceOfferSeedInput({
        setId: '10316',
        merchantId: 'merchant-1',
        productUrl: 'not-a-url',
        isActive: true,
        validationStatus: 'pending',
      }),
    ).toThrow('Commerce offer seed input must include a valid productUrl.');
  });

  test('validates benchmark set input and keeps notes optional', () => {
    expect(
      validateCommerceBenchmarkSetInput({
        setId: '10316',
      }),
    ).toEqual({
      setId: '10316',
      notes: '',
    });
  });

  test('builds merchant-friendly search queries and urls', () => {
    expect(
      buildCommerceMerchantSearchQuery({
        setId: '21061',
      }),
    ).toBe('21061');
    expect(
      buildCommerceMerchantSearchUrl({
        merchantSlug: 'intertoys',
        query: '21061 notre dame lego',
      }),
    ).toBe(
      'https://www.intertoys.nl/search?searchTerm=21061%20notre%20dame%20lego',
    );
    expect(
      buildCommerceMerchantSearchUrl({
        merchantSlug: 'unknown-merchant',
        query: '21061',
      }),
    ).toBeUndefined();
  });

  test('treats any normalized merchant slug as manual-seed capable', () => {
    expect(supportsCommerceMerchantManualSeed('intertoys')).toBe(true);
    expect(supportsCommerceMerchantManualSeed(' top1toys ')).toBe(true);
  });

  test('builds coverage for uncovered, broken, and stale commerce work', () => {
    const coverage = buildCommerceCoverageSnapshot({
      now: new Date('2026-04-14T12:00:00.000Z'),
      catalogSets: [
        { id: '10316', name: 'Rivendell', theme: 'Icons' },
        { id: '76269', name: 'Avengers Tower', theme: 'Marvel' },
      ],
      merchants: [
        {
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'merchant-2',
          slug: 'amazon-nl',
          name: 'Amazon',
          isActive: true,
          sourceType: 'affiliate',
          affiliateNetwork: 'Amazon Associates',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
      offerSeeds: [
        {
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          lastVerifiedAt: '2026-03-29T08:00:00.000Z',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'seed-2',
          setId: '10316',
          merchantId: 'merchant-2',
          productUrl: 'https://www.amazon.nl/rivendell',
          isActive: true,
          validationStatus: 'invalid',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
    });

    expect(coverage.uncoveredSets.map((catalogSet) => catalogSet.id)).toEqual([
      '76269',
    ]);
    expect(
      coverage.merchantsWithoutActiveSeeds.map((merchant) => merchant.slug),
    ).toEqual([]);
    expect(coverage.brokenSeeds.map((offerSeed) => offerSeed.id)).toEqual([
      'seed-2',
    ]);
    expect(coverage.staleSeeds.map((offerSeed) => offerSeed.id)).toEqual([
      'seed-1',
    ]);
  });

  test('builds benchmark merchant coverage with covered, review, and missing merchants', () => {
    const benchmarkCoverage = buildCommerceBenchmarkCoverageRows({
      benchmarkSets: [
        {
          setId: '10316',
          notes: 'Starter batch',
          createdAt: '2026-04-15T08:00:00.000Z',
          updatedAt: '2026-04-15T08:00:00.000Z',
        },
      ],
      catalogSets: [{ id: '10316', name: 'Rivendell', theme: 'Icons' }],
      merchants: [
        {
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'merchant-2',
          slug: 'amazon-nl',
          name: 'Amazon',
          isActive: true,
          sourceType: 'affiliate',
          affiliateNetwork: 'Amazon Associates',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'merchant-3',
          slug: 'intertoys',
          name: 'Intertoys',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
      offerSeeds: [
        {
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          lastVerifiedAt: '2026-04-14T08:00:00.000Z',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
          merchant: {
            id: 'merchant-1',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-1',
            offerSeedId: 'seed-1',
            setId: '10316',
            merchantId: 'merchant-1',
            productUrl: 'https://www.lego.com/rivendell',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 49999,
            observedAt: '2026-04-14T08:00:00.000Z',
            fetchedAt: '2026-04-14T08:00:00.000Z',
            createdAt: '2026-04-14T08:00:00.000Z',
            updatedAt: '2026-04-14T08:00:00.000Z',
          },
        },
        {
          id: 'seed-2',
          setId: '10316',
          merchantId: 'merchant-2',
          productUrl: 'https://www.amazon.nl/rivendell',
          isActive: true,
          validationStatus: 'stale',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
          merchant: {
            id: 'merchant-2',
            slug: 'amazon-nl',
            name: 'Amazon',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'Amazon Associates',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-2',
            offerSeedId: 'seed-2',
            setId: '10316',
            merchantId: 'merchant-2',
            productUrl: 'https://www.amazon.nl/rivendell',
            fetchStatus: 'error',
            errorMessage: 'Timed out',
            observedAt: '2026-04-14T08:00:00.000Z',
            fetchedAt: '2026-04-14T08:00:00.000Z',
            createdAt: '2026-04-14T08:00:00.000Z',
            updatedAt: '2026-04-14T08:00:00.000Z',
          },
        },
      ],
    });

    expect(benchmarkCoverage).toHaveLength(1);
    expect(benchmarkCoverage[0]).toEqual(
      expect.objectContaining({
        setId: '10316',
        activeMerchantTargetCount: 3,
        activeSeedCount: 2,
        latestValidMerchantCount: 1,
        missingMerchantNames: ['Intertoys'],
        pendingMerchantNames: [],
        reviewMerchantNames: ['Amazon'],
      }),
    );
  });

  test('builds a seed-first coverage queue without discovery actions', () => {
    const coverageQueue = buildCommerceCoverageQueueRows({
      now: new Date('2026-04-17T12:00:00.000Z'),
      benchmarkSets: [
        {
          setId: '10316',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
      catalogSets: [
        {
          id: '10316',
          name: 'Rivendell',
          theme: 'Icons',
          slug: 'rivendell-10316',
          source: 'snapshot',
        },
        {
          id: '77092',
          name: 'Great Deku Tree 2-in-1',
          theme: 'The Legend of Zelda',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'overlay',
          createdAt: '2026-04-17T09:00:00.000Z',
        },
        {
          id: '71411',
          name: 'The Mighty Bowser',
          theme: 'Super Mario',
          slug: 'the-mighty-bowser-71411',
          source: 'snapshot',
        },
      ],
      merchants: [
        {
          id: 'merchant-misterbricks',
          slug: 'misterbricks',
          name: 'MisterBricks',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'merchant-lego',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
        {
          id: 'merchant-intertoys',
          slug: 'intertoys',
          name: 'Intertoys',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
      offerSeeds: [
        {
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-misterbricks',
          productUrl: 'https://misterbricks.nl/rivendell',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-17T08:00:00.000Z',
          merchant: {
            id: 'merchant-misterbricks',
            slug: 'misterbricks',
            name: 'MisterBricks',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-1',
            offerSeedId: 'seed-1',
            setId: '10316',
            merchantId: 'merchant-misterbricks',
            productUrl: 'https://misterbricks.nl/rivendell',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 39999,
            observedAt: '2026-04-17T08:00:00.000Z',
            fetchedAt: '2026-04-17T08:00:00.000Z',
            createdAt: '2026-04-17T08:00:00.000Z',
            updatedAt: '2026-04-17T08:00:00.000Z',
          },
        },
        {
          id: 'seed-2',
          setId: '10316',
          merchantId: 'merchant-lego',
          productUrl: 'https://lego.com/rivendell',
          isActive: true,
          validationStatus: 'stale',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-10T08:00:00.000Z',
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-2',
            offerSeedId: 'seed-2',
            setId: '10316',
            merchantId: 'merchant-lego',
            productUrl: 'https://lego.com/rivendell',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 49999,
            observedAt: '2026-04-10T08:00:00.000Z',
            fetchedAt: '2026-04-10T08:00:00.000Z',
            createdAt: '2026-04-10T08:00:00.000Z',
            updatedAt: '2026-04-10T08:00:00.000Z',
          },
        },
        {
          id: 'seed-3',
          setId: '71411',
          merchantId: 'merchant-misterbricks',
          productUrl: 'https://misterbricks.nl/bowser',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-17T08:00:00.000Z',
          merchant: {
            id: 'merchant-misterbricks',
            slug: 'misterbricks',
            name: 'MisterBricks',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-3',
            offerSeedId: 'seed-3',
            setId: '71411',
            merchantId: 'merchant-misterbricks',
            productUrl: 'https://misterbricks.nl/bowser',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 22999,
            observedAt: '2026-04-17T08:00:00.000Z',
            fetchedAt: '2026-04-17T08:00:00.000Z',
            createdAt: '2026-04-17T08:00:00.000Z',
            updatedAt: '2026-04-17T08:00:00.000Z',
          },
        },
        {
          id: 'seed-4',
          setId: '71411',
          merchantId: 'merchant-lego',
          productUrl: 'https://lego.com/bowser',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-17T08:00:00.000Z',
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-4',
            offerSeedId: 'seed-4',
            setId: '71411',
            merchantId: 'merchant-lego',
            productUrl: 'https://lego.com/bowser',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 26999,
            observedAt: '2026-04-17T08:00:00.000Z',
            fetchedAt: '2026-04-17T08:00:00.000Z',
            createdAt: '2026-04-17T08:00:00.000Z',
            updatedAt: '2026-04-17T08:00:00.000Z',
          },
        },
        {
          id: 'seed-5',
          setId: '71411',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://intertoys.nl/bowser',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-17T08:00:00.000Z',
          merchant: {
            id: 'merchant-intertoys',
            slug: 'intertoys',
            name: 'Intertoys',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-5',
            offerSeedId: 'seed-5',
            setId: '71411',
            merchantId: 'merchant-intertoys',
            productUrl: 'https://intertoys.nl/bowser',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            priceMinor: 23999,
            observedAt: '2026-04-17T08:00:00.000Z',
            fetchedAt: '2026-04-17T08:00:00.000Z',
            createdAt: '2026-04-17T08:00:00.000Z',
            updatedAt: '2026-04-17T08:00:00.000Z',
          },
        },
      ],
    });

    expect(coverageQueue.map((row) => row.setId)).toEqual([
      '10316',
      '77092',
      '71411',
    ]);
    expect(coverageQueue[0]).toEqual(
      expect.objectContaining({
        setId: '10316',
        isBenchmark: true,
        validMerchantCount: 1,
        staleMerchantCount: 1,
        needsReviewCount: 0,
        recommendedNextAction: 'edit_seed',
        recommendedMerchantId: 'merchant-lego',
        statusSummary: 'Stale offers aanwezig',
      }),
    );
    expect(coverageQueue[1]).toEqual(
      expect.objectContaining({
        setId: '77092',
        source: 'overlay',
        validMerchantCount: 0,
        activeSeedCount: 0,
        recommendedNextAction: 'add_seed_manually',
        recommendedMerchantId: 'merchant-intertoys',
        statusSummary: 'Seed nodig',
      }),
    );
    expect(coverageQueue[2]).toEqual(
      expect.objectContaining({
        setId: '71411',
        validMerchantCount: 3,
        recommendedNextAction: 'no_action_needed',
        statusSummary: 'Goed gedekt',
      }),
    );
  });

  test('treats recent unavailable coverage as recheck later instead of immediate reseeding', () => {
    const [row] = buildCommerceCoverageQueueRows({
      now: new Date('2026-04-18T12:00:00.000Z'),
      benchmarkSets: [],
      catalogSets: [
        {
          id: '10317',
          name: 'Land Rover Classic Defender 90',
          theme: 'Icons',
          slug: 'land-rover-classic-defender-90-10317',
          source: 'snapshot',
        },
      ],
      merchants: [
        {
          id: 'merchant-intertoys',
          slug: 'intertoys',
          name: 'Intertoys',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
      offerSeeds: [
        {
          id: 'seed-10317-intertoys',
          setId: '10317',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://www.intertoys.nl/10317',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-16T09:00:00.000Z',
          updatedAt: '2026-04-16T09:03:00.000Z',
          merchant: {
            id: 'merchant-intertoys',
            slug: 'intertoys',
            name: 'Intertoys',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-01T08:00:00.000Z',
            updatedAt: '2026-04-01T08:00:00.000Z',
          },
          latestOffer: {
            id: 'latest-10317-intertoys',
            offerSeedId: 'seed-10317-intertoys',
            setId: '10317',
            merchantId: 'merchant-intertoys',
            productUrl: 'https://www.intertoys.nl/10317',
            fetchStatus: 'unavailable',
            observedAt: '2026-04-16T09:03:00.000Z',
            fetchedAt: '2026-04-16T09:03:00.000Z',
            createdAt: '2026-04-16T09:03:00.000Z',
            updatedAt: '2026-04-16T09:03:00.000Z',
          },
        },
      ],
    });

    expect(row.notAvailableConfirmedMerchantCount).toBe(1);
    expect(row.recommendedNextAction).toBe('recheck_later');
  });

  test('filters coverage queue rows on health and source', () => {
    const filtered = filterCommerceCoverageQueueRows({
      rows: [
        {
          setId: '10316',
          setName: 'Rivendell',
          theme: 'Icons',
          source: 'overlay',
          isBenchmark: true,
          validMerchantCount: 0,
          activeSeedCount: 0,
          merchantsCheckedCount: 0,
          missingMerchantIds: ['merchant-1'],
          missingMerchantNames: ['LEGO'],
          missingMerchantSlugs: ['lego-nl'],
          needsReviewCount: 0,
          notAvailableConfirmedMerchantCount: 0,
          notAvailableConfirmedMerchantNames: [],
          staleMerchantCount: 0,
          unavailableMerchantCount: 0,
          merchantStatuses: [],
          statusSummary: 'Seed nodig',
          recommendedNextAction: 'add_seed_manually',
        },
        {
          setId: '71411',
          setName: 'The Mighty Bowser',
          theme: 'Super Mario',
          source: 'snapshot',
          isBenchmark: false,
          validMerchantCount: 3,
          activeSeedCount: 3,
          merchantsCheckedCount: 3,
          missingMerchantIds: [],
          missingMerchantNames: [],
          missingMerchantSlugs: [],
          needsReviewCount: 0,
          notAvailableConfirmedMerchantCount: 0,
          notAvailableConfirmedMerchantNames: [],
          staleMerchantCount: 0,
          unavailableMerchantCount: 0,
          merchantStatuses: [],
          statusSummary: 'Goed gedekt',
          recommendedNextAction: 'no_action_needed',
        },
      ],
      healthFilter: 'zero_valid',
      sourceFilter: 'overlay',
    });

    expect(filtered.map((row) => row.setId)).toEqual(['10316']);
  });
});
