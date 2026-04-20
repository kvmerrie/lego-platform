import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import type {
  CatalogBulkOnboardingRunReadResult,
  CatalogBulkOnboardingRunState,
  CatalogBulkOnboardingStartResult,
} from '@lego-platform/api/data-access-server';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSet,
  type CatalogSet,
} from '@lego-platform/catalog/util';
import {
  type AdminCatalogSetSummary,
  createAdminCatalogRoutes,
  type AdminCatalogService,
} from '../app/routes/admin-catalog';

function createBulkOnboardingRunState(): CatalogBulkOnboardingRunState {
  return {
    createdAt: '2026-04-19T08:00:00.000Z',
    generateStep: {
      appliedSetIds: [],
      status: 'pending',
    },
    importStep: {
      appliedSetIds: [],
      status: 'pending',
    },
    requestedSetIds: ['10316', '21061'],
    runId: 'bulk-10316-21061',
    setProgressById: {
      '10316': {
        importStatus: 'pending',
        lastUpdatedAt: '2026-04-19T08:00:00.000Z',
        processingState: 'pending_import',
        setId: '10316',
        sourceSetNumber: '10316-1',
      },
      '21061': {
        importStatus: 'pending',
        lastUpdatedAt: '2026-04-19T08:00:00.000Z',
        processingState: 'pending_import',
        setId: '21061',
        sourceSetNumber: '21061-1',
      },
    },
    snapshotStep: {
      appliedSetIds: [],
      status: 'pending',
    },
    status: 'running',
    syncStep: {
      appliedSetIds: [],
      status: 'pending',
    },
    updatedAt: '2026-04-19T08:00:00.000Z',
    validateStep: {
      appliedSetIds: [],
      status: 'pending',
    },
  };
}

function createBulkOnboardingRunReadResult(): CatalogBulkOnboardingRunReadResult {
  return {
    run: createBulkOnboardingRunState(),
    stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
  };
}

function createBulkOnboardingStartResult(): CatalogBulkOnboardingStartResult {
  return {
    alreadyRunning: false,
    run: createBulkOnboardingRunState(),
    runCreated: true,
    runId: 'bulk-10316-21061',
    stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
  };
}

function createSuggestedSet(
  overrides: Partial<CatalogSuggestedSet> = {},
): CatalogSuggestedSet {
  return {
    imageUrl: 'https://cdn.rebrickable.com/media/sets/10312-1/1000.jpg',
    name: 'Jazz Club',
    pieces: 2899,
    releaseYear: 2023,
    score: 112,
    setId: '10312',
    slug: 'jazz-club-10312',
    source: 'rebrickable',
    sourceSetNumber: '10312-1',
    theme: 'Icons',
    ...overrides,
  };
}

async function createAdminCatalogServer({
  catalogService,
}: {
  catalogService?: AdminCatalogService;
} = {}) {
  const nextCatalogService: AdminCatalogService = catalogService ?? {
    getBulkOnboardingRun: vi.fn(async () =>
      createBulkOnboardingRunReadResult(),
    ),
    getLatestBulkOnboardingRun: vi.fn(async () =>
      createBulkOnboardingRunReadResult(),
    ),
    startBulkOnboarding: vi.fn(async () => createBulkOnboardingStartResult()),
    createSet: vi.fn(
      async () =>
        ({
          createdAt: '2026-04-17T08:00:00.000Z',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77072-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          status: 'active',
          theme: 'The Legend of Zelda',
          updatedAt: '2026-04-17T08:00:00.000Z',
        }) satisfies CatalogSet,
    ),
    listCatalogSets: vi.fn(
      async () =>
        [
          {
            createdAt: '2026-04-17T08:00:00.000Z',
            id: '10316',
            name: 'Rivendell',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'lord-of-the-rings-rivendell-10316',
            theme: 'Icons',
            updatedAt: '2026-04-17T08:00:00.000Z',
          },
        ] satisfies AdminCatalogSetSummary[],
    ),
    listSuggestedSets: vi.fn(async () => [createSuggestedSet()]),
    searchMissingSets: vi.fn(
      async () =>
        [
          {
            imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
            name: 'Great Deku Tree 2-in-1',
            pieces: 2500,
            releaseYear: 2024,
            setId: '77092',
            slug: 'great-deku-tree-2-in-1-77092',
            source: 'rebrickable',
            sourceSetNumber: '77092-1',
            theme: 'The Legend of Zelda',
          },
        ] satisfies CatalogExternalSetSearchResult[],
    ),
  };
  const server = Fastify();

  await server.register(
    createAdminCatalogRoutes({
      catalogService: nextCatalogService,
    }),
  );

  return {
    catalogService: nextCatalogService,
    server,
  };
}

describe('admin catalog routes', () => {
  test('lists merged catalog sets for the admin app', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/sets',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.listCatalogSets).toHaveBeenCalled();
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: '10316',
      }),
    ]);

    await server.close();
  });

  test('searches Rebrickable for missing sets', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/search?query=deku',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.searchMissingSets).toHaveBeenCalledWith('deku');
    expect(response.json()).toEqual([
      expect.objectContaining({
        setId: '77092',
      }),
    ]);

    await server.close();
  });

  test('lists suggested missing sets for bulk onboarding discovery', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/suggested-sets',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.listSuggestedSets).toHaveBeenCalled();
    expect(response.json()).toEqual([
      expect.objectContaining({
        score: 112,
        setId: '10312',
      }),
    ]);

    await server.close();
  });

  test('creates a catalog set from a search result', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/sets',
      payload: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
        name: 'Great Deku Tree 2-in-1',
        pieces: 2500,
        releaseYear: 2024,
        setId: '77092',
        slug: 'great-deku-tree-2-in-1-77092',
        source: 'rebrickable',
        sourceSetNumber: '77092-1',
        theme: 'The Legend of Zelda',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(catalogService.createSet).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
      name: 'Great Deku Tree 2-in-1',
      pieces: 2500,
      releaseYear: 2024,
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      source: 'rebrickable',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });

    await server.close();
  });

  test('starts a bulk onboarding run', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        setIds: ['10316', '21061'],
      },
      url: '/api/v1/admin/catalog/bulk-onboarding/runs',
    });

    expect(response.statusCode).toBe(202);
    expect(catalogService.startBulkOnboarding).toHaveBeenCalledWith({
      setIds: ['10316', '21061'],
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        runId: 'bulk-10316-21061',
      }),
    );

    await server.close();
  });

  test('returns the latest bulk onboarding run when present', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/bulk-onboarding/runs/latest',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.getLatestBulkOnboardingRun).toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        run: expect.objectContaining({
          runId: 'bulk-10316-21061',
        }),
        stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
      }),
    );

    await server.close();
  });

  test('returns a bulk onboarding run by id', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/bulk-onboarding/runs/bulk-10316-21061',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.getBulkOnboardingRun).toHaveBeenCalledWith(
      'bulk-10316-21061',
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        run: expect.objectContaining({
          runId: 'bulk-10316-21061',
        }),
        stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
      }),
    );

    await server.close();
  });
});
