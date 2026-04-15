import { describe, expect, test } from 'vitest';
import {
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
  buildCommerceBenchmarkCoverageRows,
  buildCommerceCoverageSnapshot,
  normalizeCommerceSlug,
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
        merchantSlug: 'unknown-merchant',
        query: '21061 notre dame lego',
      }),
    ).toBeUndefined();
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
});
