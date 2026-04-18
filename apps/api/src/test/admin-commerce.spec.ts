import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  type CommerceDiscoveryApprovalResult,
  type CommerceDiscoveryCandidate,
  type CommerceDiscoveryRun,
  type CommerceBenchmarkSet,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceOfferSeed,
} from '@lego-platform/commerce/util';
import {
  createAdminCommerceRoutes,
  type AdminCommerceService,
} from '../app/routes/admin-commerce';

async function createAdminCommerceServer({
  commerceService,
}: {
  commerceService?: AdminCommerceService;
} = {}) {
  const nextCommerceService: AdminCommerceService = commerceService ?? {
    listDiscoveryRuns: vi.fn(async () => []),
    listDiscoveryCandidates: vi.fn(async () => []),
    runDiscovery: vi.fn(
      async () =>
        ({
          run: {
            id: 'run-1',
            setId: '10316',
            merchantId: 'merchant-1',
            searchQuery: '10316',
            searchUrl: 'https://misterbricks.nl/catalogsearch/result/?q=10316',
            status: 'success',
            candidateCount: 1,
            createdAt: '2026-04-16T08:00:00.000Z',
            updatedAt: '2026-04-16T08:00:00.000Z',
          } satisfies CommerceDiscoveryRun,
          candidates: [],
        }) as {
          run: CommerceDiscoveryRun;
          candidates: CommerceDiscoveryCandidate[];
        },
    ),
    approveDiscoveryCandidate: vi.fn(
      async () =>
        ({
          candidate: {
            id: 'candidate-1',
            discoveryRunId: 'run-1',
            setId: '10316',
            merchantId: 'merchant-1',
            candidateTitle: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
            candidateUrl:
              'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
            canonicalUrl:
              'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
            confidenceScore: 100,
            status: 'auto_approved',
            matchReasons: ['Exact setnummer 10316 staat in de titel.'],
            sourceRank: 1,
            reviewStatus: 'approved',
            offerSeedId: 'seed-1',
            createdAt: '2026-04-16T08:00:00.000Z',
            updatedAt: '2026-04-16T08:00:00.000Z',
          },
          message: 'Offer seed aangemaakt en discovery-kandidaat gekoppeld.',
          outcome: 'created_seed',
        }) satisfies CommerceDiscoveryApprovalResult,
    ),
    rejectDiscoveryCandidate: vi.fn(
      async () =>
        ({
          id: 'candidate-1',
          discoveryRunId: 'run-1',
          setId: '10316',
          merchantId: 'merchant-1',
          candidateTitle: 'LEGO bundle 10316 light kit',
          candidateUrl:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          canonicalUrl:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          confidenceScore: 12,
          status: 'rejected',
          matchReasons: [
            'Titel of URL lijkt op een accessoire of bundel (light kit).',
          ],
          sourceRank: 1,
          reviewStatus: 'rejected',
          createdAt: '2026-04-16T08:00:00.000Z',
          updatedAt: '2026-04-16T08:00:00.000Z',
        }) satisfies CommerceDiscoveryCandidate,
    ),
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
            recommendedNextAction: 'run_discovery',
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
        listDiscoveryRuns: vi.fn(async () => []),
        listDiscoveryCandidates: vi.fn(async () => []),
        runDiscovery: vi.fn(),
        approveDiscoveryCandidate: vi.fn(),
        rejectDiscoveryCandidate: vi.fn(),
        listBenchmarkSets: vi.fn(async () => []),
        createBenchmarkSet: vi.fn(),
        deleteBenchmarkSet: vi.fn(),
        listCoverageQueue: vi.fn(async () => []),
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

  test('runs merchant discovery for a synced catalog set', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/discovery-runs',
      payload: {
        setId: '10316',
        merchantId: 'merchant-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.runDiscovery).toHaveBeenCalledWith({
      setId: '10316',
      merchantId: 'merchant-1',
    });

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
        recommendedNextAction: 'run_discovery',
      }),
    ]);

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

  test('approves a discovery candidate through the admin route', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/discovery-candidates/candidate-1/approve',
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.approveDiscoveryCandidate).toHaveBeenCalledWith(
      'candidate-1',
    );

    await server.close();
  });

  test('forwards an optional discovery candidate id when creating an offer seed', async () => {
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
        discoveryCandidateId: 'candidate-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createOfferSeed).toHaveBeenCalledWith({
      discoveryCandidateId: 'candidate-1',
      input: {
        setId: '10316',
        merchantId: 'merchant-1',
        productUrl: 'https://misterbricks.nl/rivendell-10316.html',
        isActive: true,
        validationStatus: 'valid',
        notes: '',
      },
    });

    await server.close();
  });

  test('rejects a discovery candidate through the admin route', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/discovery-candidates/candidate-1/reject',
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.rejectDiscoveryCandidate).toHaveBeenCalledWith(
      'candidate-1',
    );

    await server.close();
  });

  test('creates a benchmark set when the set exists in the synced catalog', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/benchmark-sets',
      payload: {
        setId: '10316',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createBenchmarkSet).toHaveBeenCalledWith({
      setId: '10316',
      notes: '',
    });

    await server.close();
  });

  test('rejects benchmark sets for sets outside the synced catalog', async () => {
    const { server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/benchmark-sets',
      payload: {
        setId: '99999',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message:
        'Set 99999 is not part of the Brickhunt catalog, so it cannot receive commerce seeds yet.',
    });

    await server.close();
  });

  test('creates a merchant when the operator input is valid', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/merchants',
      payload: {
        slug: 'Amazon NL',
        name: 'Amazon',
        isActive: true,
        sourceType: 'affiliate',
        affiliateNetwork: 'Amazon Associates',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createMerchant).toHaveBeenCalledWith({
      slug: 'amazon-nl',
      name: 'Amazon',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: 'Amazon Associates',
      notes: '',
    });

    await server.close();
  });

  test('rejects offer seeds for sets outside the synced catalog', async () => {
    const { server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/offer-seeds',
      payload: {
        setId: '99999',
        merchantId: 'merchant-1',
        productUrl: 'https://example.test/set',
        isActive: true,
        validationStatus: 'pending',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message:
        'Set 99999 is not part of the Brickhunt catalog, so it cannot receive commerce seeds yet.',
    });

    await server.close();
  });
});
