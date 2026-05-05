import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import type {
  CommerceBenchmarkSet,
  CommerceCoverageQueueRow,
  CommerceMerchant,
  CommerceOfferSeed,
} from '@lego-platform/commerce/util';
const catalogLookupMocks = vi.hoisted(() => ({
  findCatalogSetSummaryByIdWithOverlay: vi.fn(
    async ({ setId }: { setId: string }) =>
      setId === '10316'
        ? {
            id: '10316',
            slug: 'lord-of-the-rings-rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
          }
        : undefined,
  ),
}));

vi.mock('@lego-platform/catalog/data-access-server', () => ({
  findCatalogSetSummaryByIdWithOverlay:
    catalogLookupMocks.findCatalogSetSummaryByIdWithOverlay,
  listCanonicalCatalogSets: vi.fn(async () => []),
}));

import {
  createAdminCommerceRoutes,
  type AdminCommerceService,
} from '../app/routes/admin-commerce';

async function createAdminCommerceServer({
  commerceService,
  getExpectedAdminSecret,
  isProductionEnvironment,
}: {
  commerceService?: AdminCommerceService;
  getExpectedAdminSecret?: () => string;
  isProductionEnvironment?: () => boolean;
} = {}) {
  const nextCommerceService: AdminCommerceService = commerceService ?? {
    importAlternateFeed: vi.fn(async () => ({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: true,
      merchantSlug: 'alternate',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 0,
      totalRowCount: 1,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
    })),
    copyProductionCommerce: vi.fn(async ({ dryRun }: { dryRun: boolean }) => ({
      dryRun,
      durationMs: 12,
      startedAt: '2026-05-05T12:00:00.000Z',
      status: 'ok' as const,
      tables: {
        commerce_merchants: {
          deletedCount: 0,
          insertedCount: 0,
          sourceCount: 2,
          targetBeforeCount: 1,
        },
        commerce_benchmark_sets: {
          deletedCount: 0,
          insertedCount: 0,
          sourceCount: 3,
          targetBeforeCount: 1,
        },
        commerce_offer_seeds: {
          deletedCount: 0,
          insertedCount: 0,
          sourceCount: 5,
          targetBeforeCount: 2,
        },
        commerce_offer_latest: {
          deletedCount: 0,
          insertedCount: 0,
          sourceCount: 5,
          targetBeforeCount: 2,
        },
        pricing_daily_set_history: {
          deletedCount: 0,
          insertedCount: 0,
          sourceCount: 8,
          targetBeforeCount: 4,
        },
      },
    })),
    listBenchmarkSets: vi.fn(async () => []),
    createBenchmarkSet: vi.fn(
      async () =>
        ({
          setId: '10316',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceBenchmarkSet,
    ),
    deleteBenchmarkSet: vi.fn(async () => undefined),
    listCoverageQueue: vi.fn(
      async () =>
        [
          {
            setId: '10316',
            setName: 'Rivendell',
            theme: 'Icons',
            source: 'snapshot',
            isBenchmark: true,
            validMerchantCount: 2,
            activeSeedCount: 2,
            merchantsCheckedCount: 2,
            missingMerchantIds: ['merchant-2'],
            missingMerchantNames: ['LEGO'],
            missingMerchantSlugs: ['lego-nl'],
            needsReviewCount: 0,
            notAvailableConfirmedMerchantCount: 0,
            notAvailableConfirmedMerchantNames: [],
            staleMerchantCount: 0,
            unavailableMerchantCount: 0,
            merchantStatuses: [],
            statusSummary: '2 geldige merchants',
            recommendedNextAction: 'add_seed_manually',
            recommendedMerchantId: 'merchant-2',
            recommendedMerchantName: 'LEGO',
          },
        ] satisfies CommerceCoverageQueueRow[],
    ),
    refreshSet: vi.fn(async (setId: string) => ({
      setId,
      totalCount: 2,
      successCount: 1,
      unavailableCount: 1,
      staleCount: 0,
      invalidCount: 0,
    })),
    listMerchants: vi.fn(async () => []),
    createMerchant: vi.fn(
      async () =>
        ({
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceMerchant,
    ),
    updateMerchant: vi.fn(
      async () =>
        ({
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceMerchant,
    ),
    listOfferSeeds: vi.fn(async () => []),
    createOfferSeed: vi.fn(
      async () =>
        ({
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceOfferSeed,
    ),
    updateOfferSeed: vi.fn(
      async () =>
        ({
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceOfferSeed,
    ),
  };
  const server = Fastify();

  await server.register(
    createAdminCommerceRoutes({
      commerceService: nextCommerceService,
      getExpectedAdminSecret,
      isProductionEnvironment,
    }),
  );

  return {
    commerceService: nextCommerceService,
    server,
  };
}

describe('admin commerce routes', () => {
  test('lists merchants for the admin backoffice', async () => {
    const merchants: CommerceMerchant[] = [
      {
        id: 'merchant-1',
        slug: 'lego-nl',
        name: 'LEGO',
        isActive: true,
        sourceType: 'direct',
        notes: '',
        createdAt: '2026-04-14T08:00:00.000Z',
        updatedAt: '2026-04-14T08:00:00.000Z',
      },
    ];
    const { commerceService, server } = await createAdminCommerceServer({
      commerceService: {
        listBenchmarkSets: vi.fn(async () => []),
        importAlternateFeed: vi.fn(),
        copyProductionCommerce: vi.fn(),
        createBenchmarkSet: vi.fn(),
        deleteBenchmarkSet: vi.fn(),
        listCoverageQueue: vi.fn(async () => []),
        refreshSet: vi.fn(),
        listMerchants: vi.fn(async () => merchants),
        createMerchant: vi.fn(),
        updateMerchant: vi.fn(),
        listOfferSeeds: vi.fn(async () => []),
        createOfferSeed: vi.fn(),
        updateOfferSeed: vi.fn(),
      } as never,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/commerce/merchants',
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.listMerchants).toHaveBeenCalled();
    expect(response.json()).toEqual(merchants);

    await server.close();
  });

  test('lists coverage queue rows for the operator work queue', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/commerce/coverage-queue',
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.listCoverageQueue).toHaveBeenCalled();
    expect(response.json()).toEqual([
      expect.objectContaining({
        setId: '10316',
        recommendedNextAction: 'add_seed_manually',
      }),
    ]);

    await server.close();
  });

  test('imports Alternate feed rows through the admin route', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/alternate-feed/import',
      payload: {
        rows: [
          {
            affiliateDeeplink:
              'https://clk.tradetracker.example/alternate/76784',
            availabilityText: 'Op voorraad',
            brand: 'LEGO',
            currency: 'EUR',
            legoSetNumber: '76784',
            price: '159,99',
            productTitle: 'LEGO Wednesday Nevermore Academy',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.importAlternateFeed).toHaveBeenCalledWith([
      expect.objectContaining({
        affiliateDeeplink: 'https://clk.tradetracker.example/alternate/76784',
        brand: 'LEGO',
        legoSetNumber: '76784',
      }),
    ]);
    expect(response.json()).toEqual(
      expect.objectContaining({
        importedOfferCount: 1,
        merchantSlug: 'alternate',
      }),
    );

    await server.close();
  });

  test('refreshes all active seeds for a set through the admin route', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/set-refreshes',
      payload: {
        setId: '10316',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.refreshSet).toHaveBeenCalledWith('10316');
    expect(response.json()).toEqual({
      setId: '10316',
      totalCount: 2,
      successCount: 1,
      unavailableCount: 1,
      staleCount: 0,
      invalidCount: 0,
    });

    await server.close();
  });

  test('dry-runs production commerce sync with summary counts', async () => {
    const { commerceService, server } = await createAdminCommerceServer({
      getExpectedAdminSecret: () => 'sync-secret',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/production-sync',
      headers: {
        'x-admin-secret': 'sync-secret',
      },
      payload: {
        dryRun: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.copyProductionCommerce).toHaveBeenCalledWith({
      dryRun: true,
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        dryRun: true,
        tables: expect.objectContaining({
          commerce_offer_latest: expect.objectContaining({
            sourceCount: 5,
            targetBeforeCount: 2,
          }),
        }),
      }),
    );

    await server.close();
  });

  test('runs production commerce sync only with a valid admin secret', async () => {
    const { commerceService, server } = await createAdminCommerceServer({
      getExpectedAdminSecret: () => 'sync-secret',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/production-sync',
      headers: {
        'x-admin-secret': 'wrong-secret',
      },
      payload: {
        dryRun: false,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(commerceService.copyProductionCommerce).not.toHaveBeenCalled();

    await server.close();
  });

  test('runs production commerce sync in write mode after explicit request', async () => {
    const { commerceService, server } = await createAdminCommerceServer({
      getExpectedAdminSecret: () => 'sync-secret',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/production-sync',
      headers: {
        'x-admin-secret': 'sync-secret',
      },
      payload: {
        dryRun: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.copyProductionCommerce).toHaveBeenCalledWith({
      dryRun: false,
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        dryRun: false,
      }),
    );

    await server.close();
  });

  test('refuses production commerce sync in production', async () => {
    const { commerceService, server } = await createAdminCommerceServer({
      getExpectedAdminSecret: () => 'sync-secret',
      isProductionEnvironment: () => true,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/production-sync',
      headers: {
        'x-admin-secret': 'sync-secret',
      },
      payload: {
        dryRun: false,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(commerceService.copyProductionCommerce).not.toHaveBeenCalled();

    await server.close();
  });

  test('creates an offer seed through the admin route', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/offer-seeds',
      payload: {
        setId: '10316',
        merchantId: 'merchant-1',
        productUrl: 'https://misterbricks.nl/rivendell-10316.html',
        isActive: true,
        validationStatus: 'valid',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createOfferSeed).toHaveBeenCalledWith({
      setId: '10316',
      merchantId: 'merchant-1',
      productUrl: 'https://misterbricks.nl/rivendell-10316.html',
      isActive: true,
      validationStatus: 'valid',
      notes: '',
    });

    await server.close();
  });
});
