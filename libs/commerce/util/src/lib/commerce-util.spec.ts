import { describe, expect, test } from 'vitest';
import {
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
  buildCommerceBenchmarkCoverageRows,
  buildCommerceCoverageQueueRows,
  buildCommerceCoverageSnapshot,
  filterCommerceCoverageQueueRows,
  normalizeCommerceSlug,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from './commerce-util';
import {
  buildCommerceDiscoveryCandidateAssessment,
  normalizeCommerceProductUrl,
  validateCommerceDiscoveryRunInput,
} from './commerce-discovery-util';

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

  test('builds a merchant-friendly search query from only the set id', () => {
    expect(
      buildCommerceMerchantSearchQuery({
        setId: '21061',
      }),
    ).toBe('21061');
  });

  test('builds merchant-specific search urls with encoded query values', () => {
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
        merchantSlug: 'misterbricks',
        query: '10316',
      }),
    ).toBe('https://misterbricks.nl/catalogsearch/result/?q=10316');
    expect(
      buildCommerceMerchantSearchUrl({
        merchantSlug: 'proshop',
        query: '10316',
      }),
    ).toBe('https://www.proshop.nl/?s=10316');
    expect(
      buildCommerceMerchantSearchUrl({
        merchantSlug: 'smyths-toys',
        query: '10316',
      }),
    ).toBe('https://www.smythstoys.com/nl/nl-nl/search?text=10316');
    expect(
      buildCommerceMerchantSearchUrl({
        merchantSlug: 'unknown-merchant',
        query: '21061 notre dame lego',
      }),
    ).toBeUndefined();
  });

  test('normalizes product urls so duplicate checks ignore tracking noise', () => {
    expect(
      normalizeCommerceProductUrl({
        merchantSlug: 'amazon-nl',
        url: 'https://www.amazon.nl/LEGO-Icons-Rivendell/dp/B0BVMZ5NT5?tag=brickhunt09-21&ref_=abc',
      }),
    ).toBe('https://amazon.nl/dp/B0BVMZ5NT5');
    expect(
      normalizeCommerceProductUrl({
        merchantSlug: 'misterbricks',
        url: 'https://www.misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?foo=bar#reviews',
      }),
    ).toBe(
      'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
    );
  });

  test('scores exact set matches high enough for auto-approval', () => {
    const assessment = buildCommerceDiscoveryCandidateAssessment({
      setId: '10316',
      setName: 'The Lord of the Rings: Rivendell',
      candidateTitle: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
      candidateUrl:
        'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
      detectedSetId: '10316',
    });

    expect(assessment.status).toBe('auto_approved');
    expect(assessment.confidenceScore).toBeGreaterThanOrEqual(95);
  });

  test('heavily penalizes accessory or bundle candidates', () => {
    expect(
      buildCommerceDiscoveryCandidateAssessment({
        setId: '10316',
        setName: 'The Lord of the Rings: Rivendell',
        candidateTitle: 'LEGO 10316 light kit bundle',
        candidateUrl: 'https://example.test/10316-light-kit-bundle',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
      }),
    );
  });

  test('validates discovery run input', () => {
    expect(
      validateCommerceDiscoveryRunInput({
        setId: '10316',
        merchantId: 'merchant-1',
      }),
    ).toEqual({
      setId: '10316',
      merchantId: 'merchant-1',
    });
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

  test('builds a coverage queue with action-first sorting and next-step hints', () => {
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
      discoveryRuns: [
        {
          id: 'run-1',
          setId: '10316',
          merchantId: 'merchant-intertoys',
          searchQuery: '10316',
          searchUrl: 'https://www.intertoys.nl/search?searchTerm=10316',
          status: 'success',
          candidateCount: 1,
          createdAt: '2026-04-17T09:15:00.000Z',
          updatedAt: '2026-04-17T09:15:00.000Z',
          finishedAt: '2026-04-17T09:16:00.000Z',
        },
      ],
      discoveryCandidates: [
        {
          id: 'candidate-1',
          discoveryRunId: 'run-1',
          setId: '10316',
          merchantId: 'merchant-intertoys',
          candidateTitle: 'LEGO Icons Rivendell 10316',
          candidateUrl: 'https://www.intertoys.nl/rivendell-10316',
          canonicalUrl: 'https://www.intertoys.nl/rivendell-10316',
          confidenceScore: 92,
          status: 'needs_review',
          reviewStatus: 'pending',
          matchReasons: ['Exact setnummer 10316 staat in de titel.'],
          sourceRank: 1,
          createdAt: '2026-04-17T09:16:00.000Z',
          updatedAt: '2026-04-17T09:16:00.000Z',
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
        needsReviewCount: 1,
        recommendedNextAction: 'review_candidates',
        recommendedMerchantId: 'merchant-intertoys',
        statusSummary: 'Review nodig',
      }),
    );
    expect(coverageQueue[1]).toEqual(
      expect.objectContaining({
        setId: '77092',
        source: 'overlay',
        validMerchantCount: 0,
        activeSeedCount: 0,
        recommendedNextAction: 'run_discovery',
        recommendedMerchantId: 'merchant-misterbricks',
        statusSummary: 'Discovery nodig',
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

  test('filters coverage queue rows by health, source, priority, merchant gap, and search', () => {
    const rows = [
      {
        setId: '10316',
        setName: 'Rivendell',
        theme: 'Icons',
        source: 'snapshot',
        isBenchmark: true,
        validMerchantCount: 1,
        activeSeedCount: 2,
        merchantsCheckedCount: 2,
        missingMerchantIds: ['merchant-lego'],
        missingMerchantNames: ['LEGO'],
        missingMerchantSlugs: ['lego-nl'],
        needsReviewCount: 1,
        staleMerchantCount: 0,
        unavailableMerchantCount: 0,
        merchantStatuses: [],
        statusSummary: 'Review nodig',
        recommendedNextAction: 'review_candidates',
      },
      {
        setId: '77092',
        setName: 'Great Deku Tree 2-in-1',
        theme: 'The Legend of Zelda',
        source: 'overlay',
        sourceCreatedAt: '2026-04-17T09:00:00.000Z',
        isBenchmark: false,
        validMerchantCount: 0,
        activeSeedCount: 0,
        merchantsCheckedCount: 0,
        missingMerchantIds: ['merchant-lego', 'merchant-misterbricks'],
        missingMerchantNames: ['LEGO', 'MisterBricks'],
        missingMerchantSlugs: ['lego-nl', 'misterbricks'],
        needsReviewCount: 0,
        staleMerchantCount: 0,
        unavailableMerchantCount: 0,
        merchantStatuses: [],
        statusSummary: 'Discovery nodig',
        recommendedNextAction: 'run_discovery',
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
        staleMerchantCount: 0,
        unavailableMerchantCount: 0,
        merchantStatuses: [],
        statusSummary: 'Goed gedekt',
        recommendedNextAction: 'no_action_needed',
      },
    ];

    expect(
      filterCommerceCoverageQueueRows({
        rows,
        healthFilter: 'under_covered',
      }).map((row) => row.setId),
    ).toEqual(['10316', '77092']);
    expect(
      filterCommerceCoverageQueueRows({
        rows,
        healthFilter: 'fully_covered',
      }).map((row) => row.setId),
    ).toEqual(['71411']);
    expect(
      filterCommerceCoverageQueueRows({
        rows,
        sourceFilter: 'overlay',
      }).map((row) => row.setId),
    ).toEqual(['77092']);
    expect(
      filterCommerceCoverageQueueRows({
        rows,
        priorityFilter: 'benchmark_only',
      }).map((row) => row.setId),
    ).toEqual(['10316']);
    expect(
      filterCommerceCoverageQueueRows({
        rows,
        merchantGapMerchantId: 'merchant-misterbricks',
      }).map((row) => row.setId),
    ).toEqual(['77092']);
    expect(
      filterCommerceCoverageQueueRows({
        rows,
        search: 'deku',
      }).map((row) => row.setId),
    ).toEqual(['77092']);
  });
});
