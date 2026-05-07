import { describe, expect, test, vi } from 'vitest';
import {
  importAffiliateDiscoveredSets,
  resolveAffiliateFeedDiscoveryEnabled,
} from './affiliate-discovered-sets-server';
import type {
  CommerceAffiliateDiscoveredSet,
  CommerceOfferSeed,
} from '@lego-platform/commerce/util';

function createDiscoveredSet(
  input: Partial<CommerceAffiliateDiscoveredSet> = {},
): CommerceAffiliateDiscoveredSet {
  return {
    id: 'discovered-75313',
    affiliate: {
      id: 'merchant-1',
      name: 'Alternate',
      slug: 'alternate',
    },
    confidence: 'high',
    createdAt: '2026-05-06T10:00:00.000Z',
    currencyCode: 'EUR',
    firstSeenAt: '2026-05-06T10:00:00.000Z',
    imageUrl: 'https://cdn.example.test/75313.jpg',
    lastSeenAt: '2026-05-06T10:00:00.000Z',
    normalizedSetId: '75313',
    priceMinor: 64999,
    productTitle: 'LEGO Star Wars AT-AT 75313',
    productUrl: 'https://shop.example.test/75313',
    rawPayload: {},
    sourceSetNumber: '75313-1',
    status: 'new',
    updatedAt: '2026-05-06T10:00:00.000Z',
    ...input,
  };
}

function createOfferSeed(): CommerceOfferSeed {
  return {
    id: 'seed-1',
    setId: '75313',
    merchantId: 'merchant-1',
    productUrl: 'https://shop.example.test/75313',
    isActive: true,
    validationStatus: 'valid',
    lastVerifiedAt: '2026-05-06T12:00:00.000Z',
    notes: '',
    createdAt: '2026-05-06T12:00:00.000Z',
    updatedAt: '2026-05-06T12:00:00.000Z',
  };
}

describe('affiliate discovered sets import', () => {
  test('resolves feed discovery as disabled by default for cron entrypoints', () => {
    expect(
      resolveAffiliateFeedDiscoveryEnabled({
        argv: [],
        environment: {},
      }),
    ).toBe(false);
  });

  test('allows manual feed discovery through CLI flag or env fallback', () => {
    expect(
      resolveAffiliateFeedDiscoveryEnabled({
        argv: ['--discover-missing-sets'],
        environment: {},
      }),
    ).toBe(true);
    expect(
      resolveAffiliateFeedDiscoveryEnabled({
        argv: [],
        environment: {
          DISCOVER_MISSING_SETS: 'true',
        },
      }),
    ).toBe(true);
  });

  test('creates a missing catalog set and attaches the affiliate offer', async () => {
    const createCatalogSetFn = vi.fn(async () => ({
      setId: '75313',
      sourceSetNumber: '75313-1',
      slug: 'at-at-75313',
      name: 'AT-AT',
      theme: 'Star Wars',
      pieces: 6785,
      releaseYear: 2021,
      source: 'rebrickable' as const,
      status: 'active' as const,
      createdAt: '2026-05-06T12:00:00.000Z',
      updatedAt: '2026-05-06T12:00:00.000Z',
    }));
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn(async () =>
      createOfferSeed(),
    );
    const upsertCommerceOfferLatestRecordFn = vi.fn(async () => undefined);
    const updateDiscoveredSetReviewStateFn = vi.fn(async () =>
      createDiscoveredSet({ status: 'imported', importedSetId: '75313' }),
    );

    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        createCatalogSetFn,
        getNow: () => new Date('2026-05-06T12:00:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listDiscoveredSetsFn: vi.fn(async () => [createDiscoveredSet()]),
        searchCatalogMissingSetsFn: vi.fn(async () => [
          {
            setId: '75313',
            sourceSetNumber: '75313-1',
            slug: 'at-at-75313',
            name: 'AT-AT',
            theme: 'Star Wars',
            pieces: 6785,
            releaseYear: 2021,
            source: 'rebrickable',
          },
        ]),
        updateDiscoveredSetReviewStateFn,
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
      },
      highConfidenceOnly: true,
    });

    expect(result).toEqual({
      alreadyCatalogedCount: 0,
      attachedOfferCount: 1,
      createdCatalogSetCount: 1,
      failedLookupCount: 0,
      importedCount: 1,
      requestedCount: 1,
      skippedCount: 0,
      uniqueSetCount: 1,
    });
    expect(upsertCommerceOfferSeedByCompositeKeyFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        merchantId: 'merchant-1',
        productUrl: 'https://shop.example.test/75313',
        setId: '75313',
      }),
    });
    expect(upsertCommerceOfferLatestRecordFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        offerSeedId: 'seed-1',
        priceMinor: 64999,
      }),
    });
    expect(updateDiscoveredSetReviewStateFn).toHaveBeenCalledWith({
      discoveredSetId: 'discovered-75313',
      importAttemptedAt: '2026-05-06T12:00:00.000Z',
      importError: null,
      importedSetId: '75313',
      status: 'imported',
    });
  });

  test('prevents duplicate catalog creation when the set already exists', async () => {
    const createCatalogSetFn = vi.fn();

    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        createCatalogSetFn,
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75313',
            sourceSetNumber: '75313-1',
            slug: 'at-at-75313',
            name: 'AT-AT',
            primaryTheme: 'Star Wars',
            pieceCount: 6785,
            releaseYear: 2021,
            status: 'active',
            source: 'overlay',
            createdAt: '2026-05-06T12:00:00.000Z',
            updatedAt: '2026-05-06T12:00:00.000Z',
          },
        ]),
        listDiscoveredSetsFn: vi.fn(async () => [createDiscoveredSet()]),
        updateDiscoveredSetReviewStateFn: vi.fn(async () =>
          createDiscoveredSet({ status: 'imported' }),
        ),
        upsertCommerceOfferLatestRecordFn: vi.fn(async () => undefined),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(async () =>
          createOfferSeed(),
        ),
      },
      highConfidenceOnly: true,
    });

    expect(result.alreadyCatalogedCount).toBe(1);
    expect(result.createdCatalogSetCount).toBe(0);
    expect(createCatalogSetFn).not.toHaveBeenCalled();
  });

  test('deduplicates Rebrickable lookups by set number and attaches every related offer', async () => {
    const searchCatalogMissingSetsFn = vi.fn(async () => [
      {
        setId: '75313',
        sourceSetNumber: '75313-1',
        slug: 'at-at-75313',
        name: 'AT-AT',
        theme: 'Star Wars',
        pieces: 6785,
        releaseYear: 2021,
        source: 'rebrickable' as const,
      },
    ]);
    const createCatalogSetFn = vi.fn(async () => ({
      setId: '75313',
      sourceSetNumber: '75313-1',
      slug: 'at-at-75313',
      name: 'AT-AT',
      theme: 'Star Wars',
      pieces: 6785,
      releaseYear: 2021,
      source: 'rebrickable' as const,
      status: 'active' as const,
      createdAt: '2026-05-06T12:00:00.000Z',
      updatedAt: '2026-05-06T12:00:00.000Z',
    }));
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn(
      async ({ input }) => ({
        ...createOfferSeed(),
        id: `seed-${input.merchantId}`,
        merchantId: input.merchantId,
        productUrl: input.productUrl,
      }),
    );

    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        createCatalogSetFn,
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listDiscoveredSetsFn: vi.fn(async () => [
          createDiscoveredSet({ id: 'discovered-a' }),
          createDiscoveredSet({
            id: 'discovered-b',
            affiliate: {
              id: 'merchant-2',
              name: 'Goodbricks',
              slug: 'goodbricks',
            },
            productUrl: 'https://shop.example.test/75313-goodbricks',
          }),
        ]),
        searchCatalogMissingSetsFn,
        updateDiscoveredSetReviewStateFn: vi.fn(async () =>
          createDiscoveredSet({ status: 'imported' }),
        ),
        upsertCommerceOfferLatestRecordFn: vi.fn(async () => undefined),
        upsertCommerceOfferSeedByCompositeKeyFn,
      },
      highConfidenceOnly: true,
    });

    expect(searchCatalogMissingSetsFn).toHaveBeenCalledTimes(1);
    expect(createCatalogSetFn).toHaveBeenCalledTimes(1);
    expect(upsertCommerceOfferSeedByCompositeKeyFn).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      attachedOfferCount: 2,
      createdCatalogSetCount: 1,
      importedCount: 2,
      uniqueSetCount: 1,
    });
  });

  test('stores lookup errors and keeps failed rows reviewable', async () => {
    const updateDiscoveredSetReviewStateFn = vi.fn(async () =>
      createDiscoveredSet({
        importAttemptedAt: '2026-05-06T12:00:00.000Z',
        importError: 'No exact Rebrickable match found for 75313.',
        status: 'new',
      }),
    );

    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        getNow: () => new Date('2026-05-06T12:00:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listDiscoveredSetsFn: vi.fn(async () => [createDiscoveredSet()]),
        searchCatalogMissingSetsFn: vi.fn(async () => []),
        updateDiscoveredSetReviewStateFn,
        upsertCommerceOfferLatestRecordFn: vi.fn(async () => undefined),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(async () =>
          createOfferSeed(),
        ),
      },
      highConfidenceOnly: true,
    });

    expect(result).toMatchObject({
      failedLookupCount: 1,
      importedCount: 0,
      skippedCount: 1,
    });
    expect(updateDiscoveredSetReviewStateFn).toHaveBeenCalledWith({
      discoveredSetId: 'discovered-75313',
      importAttemptedAt: '2026-05-06T12:00:00.000Z',
      importError: 'No exact Rebrickable match found for 75313.',
      status: 'new',
    });
  });

  test('backs off and retries Rebrickable rate limits without failing the whole import', async () => {
    const searchCatalogMissingSetsFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce([
        {
          setId: '75313',
          sourceSetNumber: '75313-1',
          slug: 'at-at-75313',
          name: 'AT-AT',
          theme: 'Star Wars',
          pieces: 6785,
          releaseYear: 2021,
          source: 'rebrickable',
        },
      ]);
    const sleepFn = vi.fn(async () => undefined);

    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        createCatalogSetFn: vi.fn(async () => ({
          setId: '75313',
          sourceSetNumber: '75313-1',
          slug: 'at-at-75313',
          name: 'AT-AT',
          theme: 'Star Wars',
          pieces: 6785,
          releaseYear: 2021,
          source: 'rebrickable' as const,
          status: 'active' as const,
          createdAt: '2026-05-06T12:00:00.000Z',
          updatedAt: '2026-05-06T12:00:00.000Z',
        })),
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listDiscoveredSetsFn: vi.fn(async () => [createDiscoveredSet()]),
        searchCatalogMissingSetsFn,
        sleepFn,
        updateDiscoveredSetReviewStateFn: vi.fn(async () =>
          createDiscoveredSet({ status: 'imported' }),
        ),
        upsertCommerceOfferLatestRecordFn: vi.fn(async () => undefined),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(async () =>
          createOfferSeed(),
        ),
      },
      highConfidenceOnly: true,
    });

    expect(searchCatalogMissingSetsFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(500);
    expect(result.importedCount).toBe(1);
  });

  test('caps admin imports at the configured max batch size', async () => {
    const result = await importAffiliateDiscoveredSets({
      dependencies: {
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75313',
            sourceSetNumber: '75313-1',
            slug: 'at-at-75313',
            name: 'AT-AT',
            primaryTheme: 'Star Wars',
            pieceCount: 6785,
            releaseYear: 2021,
            status: 'active',
            source: 'overlay',
            createdAt: '2026-05-06T12:00:00.000Z',
            updatedAt: '2026-05-06T12:00:00.000Z',
          },
        ]),
        listDiscoveredSetsFn: vi.fn(async () => [
          createDiscoveredSet({ id: 'discovered-a' }),
          createDiscoveredSet({ id: 'discovered-b' }),
        ]),
        updateDiscoveredSetReviewStateFn: vi.fn(async () =>
          createDiscoveredSet({ status: 'imported' }),
        ),
        upsertCommerceOfferLatestRecordFn: vi.fn(async () => undefined),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(async () =>
          createOfferSeed(),
        ),
      },
      highConfidenceOnly: true,
      maxBatchSize: 1,
    });

    expect(result).toMatchObject({
      importedCount: 1,
      requestedCount: 2,
      skippedCount: 1,
    });
  });
});
