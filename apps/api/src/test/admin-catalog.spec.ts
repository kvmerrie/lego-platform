import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import type {
  CatalogBulkOnboardingRunReadResult,
  CatalogBulkOnboardingRunState,
  CatalogBulkOnboardingStartResult,
  CatalogImportPipelineResult,
} from '@lego-platform/api/data-access-server';
import type { CatalogDiscoveryCandidate } from '@lego-platform/catalog/data-access-server';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSet,
  type CatalogSet,
} from '@lego-platform/catalog/util';
import {
  type AdminCatalogDiscoveryCandidateBulkImportResult,
  type AdminCatalogSetSummary,
  buildCatalogDiscoveryCandidateStatusUpdate,
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
    confidence: 'high',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/10312-1/1000.jpg',
    isRetailFriendlyTheme: true,
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

function createDiscoveryCandidate(
  overrides: Partial<CatalogDiscoveryCandidate> = {},
): CatalogDiscoveryCandidate {
  return {
    autoCreateEligible: true,
    confidence: 'high',
    confidenceScore: 96,
    evidence: {},
    firstSeenAt: '2026-05-06T10:00:00.000Z',
    id: 'candidate-75313',
    lastSeenAt: '2026-05-06T10:00:00.000Z',
    normalizedSetId: '75313',
    operatorConfidence: 'high',
    operatorConfidenceReasons: ['exact_enriched_match'],
    rebrickablePayload: {
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/1000.jpg',
      name: 'AT-AT',
      pieces: 6785,
      releaseYear: 2021,
      setId: '75313',
      slug: 'at-at-75313',
      source: 'rebrickable',
      sourceSetNumber: '75313-1',
      theme: 'Star Wars',
    },
    requiredFieldsPresent: true,
    source: 'alternate_feed',
    sourcePayload: {},
    sourceProductTitle: 'LEGO Star Wars AT-AT 75313',
    sourceProductUrl: 'https://shop.example.test/75313',
    sourceSetNumber: '75313-1',
    status: 'new',
    ...overrides,
  };
}

function createCatalogImportPipelineResult(
  overrides: Partial<CatalogImportPipelineResult> = {},
): CatalogImportPipelineResult {
  return {
    bricksetStatus: 'success',
    durationMs: 100,
    enrichmentStatus: 'complete',
    importedSetId: '75313',
    importedSlug: 'at-at-75313',
    minifigStatus: 'success',
    stages: {
      brickset: { status: 'success' },
      minifig: { status: 'success' },
      theme: { status: 'success' },
    },
    themeStatus: 'success',
    warnings: [],
    ...overrides,
  };
}

async function createAdminCatalogServer({
  catalogService,
}: {
  catalogService?: AdminCatalogService;
} = {}) {
  const nextCatalogService: AdminCatalogService = catalogService ?? {
    importDiscoveryCandidate: vi.fn(async () =>
      createDiscoveryCandidate({
        evidence: {
          importResult: {
            bricksetStatus: 'success',
            durationMs: 123,
            enrichmentStatus: 'complete',
            importedSetId: '75313',
            importedSlug: 'at-at-75313',
            minifigStatus: 'success',
            themeStatus: 'success',
            warnings: [],
          },
        },
        importedSetId: '75313',
        status: 'imported',
      }),
    ),
    bulkImportDiscoveryCandidates: vi.fn(
      async () =>
        ({
          completedCount: 1,
          concurrency: 1,
          failedCount: 0,
          processedCount: 1,
          requestedCount: 1,
          results: [
            {
              candidateId: 'candidate-75313',
              enrichmentStatus: 'complete',
              importedSetId: '75313',
              importedSlug: 'at-at-75313',
              setId: '75313',
              status: 'completed',
              title: 'LEGO Star Wars AT-AT 75313',
              warnings: [],
            },
          ],
          skippedCount: 0,
          warningCount: 0,
        }) satisfies AdminCatalogDiscoveryCandidateBulkImportResult,
    ),
    reEnrichCatalogSet: vi.fn(async () => createCatalogImportPipelineResult()),
    listDiscoveryCandidates: vi.fn(async () => [createDiscoveryCandidate()]),
    recomputeDiscoveryCandidateConfidence: vi.fn(async () => ({
      highCount: 1,
      lowCount: 0,
      mediumCount: 2,
      modifiedCount: 3,
      processedCount: 4,
      skippedCount: 1,
    })),
    updateDiscoveryCandidateStatus: vi.fn(async ({ status }) =>
      createDiscoveryCandidate({
        status,
      }),
    ),
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
    listThemePresentations: vi.fn(async () => [
      {
        displayName: 'Star Wars',
        id: 'theme:star-wars',
        isPublic: true,
        slug: 'star-wars',
        status: 'active',
      },
    ]),
    listCollectionPresentations: vi.fn(async () => [
      {
        collectionSlug: 'lego-voor-volwassenen',
        isPublic: true,
        publicDisplayName: 'LEGO voor volwassenen',
        status: 'active',
      },
    ]),
    updateThemePresentation: vi.fn(async ({ input, slug }) => ({
      displayName: 'Star Wars',
      id: 'theme:star-wars',
      isPublic: input.isPublic,
      publicDisplayName: input.publicDisplayName,
      slug,
      status: input.status,
    })),
    updateCollectionPresentation: vi.fn(async ({ input, slug }) => ({
      collectionSlug: slug,
      isPublic: input.isPublic,
      publicDisplayName: input.publicDisplayName,
      status: input.status,
    })),
    listHomepageSections: vi.fn(async () => [
      {
        enabled: true,
        items: [],
        pageKey: 'homepage',
        sectionKey: 'theme_rail',
        sortOrder: 20,
        title: 'Fantasy, Star Wars of strak design?',
      },
    ]),
    saveHomepageSection: vi.fn(async (section) => section),
  };
  const server = Fastify();

  await server.register(
    createAdminCatalogRoutes({
      adminPreHandler: async () => undefined,
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

  test('lists Admin CMS homepage sections, theme presentations, and collection presentations', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const [sectionsResponse, themesResponse, collectionsResponse] =
      await Promise.all([
        server.inject({
          method: 'GET',
          url: '/api/v1/admin/cms/homepage/sections',
        }),
        server.inject({
          method: 'GET',
          url: '/api/v1/admin/catalog/themes?query=star',
        }),
        server.inject({
          method: 'GET',
          url: '/api/v1/admin/catalog/collections?query=volwassenen',
        }),
      ]);

    expect(sectionsResponse.statusCode).toBe(200);
    expect(themesResponse.statusCode).toBe(200);
    expect(collectionsResponse.statusCode).toBe(200);
    expect(catalogService.listHomepageSections).toHaveBeenCalled();
    expect(catalogService.listThemePresentations).toHaveBeenCalledWith({
      query: 'star',
    });
    expect(catalogService.listCollectionPresentations).toHaveBeenCalledWith({
      query: 'volwassenen',
    });

    await server.close();
  });

  test('saves homepage section and revalidates the homepage', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      skipped: false,
      pathCount: 1,
      paths: ['/'],
      tagCount: 1,
      tags: ['homepage'],
    }));
    const { catalogService, server } = await createAdminCatalogServer();

    await server.close();
    const nextServer = Fastify();
    await nextServer.register(
      createAdminCatalogRoutes({
        adminPreHandler: async () => undefined,
        catalogService,
        revalidatePublicWebFn,
      }),
    );

    const response = await nextServer.inject({
      method: 'PUT',
      url: '/api/v1/admin/cms/homepage/sections/theme_rail',
      payload: {
        enabled: true,
        items: [
          {
            enabled: true,
            imageSetId: '75419',
            imageUrl: 'https://example.test/death-star.jpg',
            referenceId: 'star-wars',
            referenceType: 'theme',
            sortOrder: 10,
            titleOverride: 'Death Star',
            useCustomImage: true,
          },
        ],
        sectionKey: 'theme_rail',
        sortOrder: 20,
        title: 'Fantasy, Star Wars of strak design?',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.saveHomepageSection).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            useCustomImage: true,
          }),
        ],
        sectionKey: 'theme_rail',
      }),
    );
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/'],
      reason: 'admin_homepage_cms_mutation',
      tags: ['homepage'],
    });

    await nextServer.close();
  });

  test('saves theme presentation and revalidates affected public surfaces', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      skipped: false,
      pathCount: 3,
      paths: ['/', '/themes', '/themes/star-wars'],
      tagCount: 3,
      tags: ['homepage', 'themes', 'theme:star-wars'],
    }));
    const { catalogService, server } = await createAdminCatalogServer();

    await server.close();
    const nextServer = Fastify();
    await nextServer.register(
      createAdminCatalogRoutes({
        adminPreHandler: async () => undefined,
        catalogService,
        revalidatePublicWebFn,
      }),
    );

    const response = await nextServer.inject({
      method: 'PUT',
      url: '/api/v1/admin/catalog/themes/star-wars',
      payload: {
        isPublic: true,
        publicDisplayName: 'Star Wars',
        publicTileImageUrl: 'https://example.test/star-wars-tile.jpg',
        status: 'active',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.updateThemePresentation).toHaveBeenCalledWith({
      input: expect.objectContaining({
        publicDisplayName: 'Star Wars',
        publicTileImageUrl: 'https://example.test/star-wars-tile.jpg',
      }),
      slug: 'star-wars',
    });
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/', '/themes', '/themes/star-wars'],
      reason: 'admin_theme_presentation_mutation',
      tags: ['homepage', 'themes', 'theme:star-wars'],
    });

    await nextServer.close();
  });

  test('saves collection presentation and revalidates affected public surfaces', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      skipped: false,
      pathCount: 2,
      paths: ['/', '/lego-voor-volwassenen'],
      tagCount: 5,
      tags: [
        'homepage',
        'catalog',
        'sets',
        'collections',
        'collection:lego-voor-volwassenen',
      ],
    }));
    const { catalogService, server } = await createAdminCatalogServer();

    await server.close();
    const nextServer = Fastify();
    await nextServer.register(
      createAdminCatalogRoutes({
        adminPreHandler: async () => undefined,
        catalogService,
        revalidatePublicWebFn,
      }),
    );

    const response = await nextServer.inject({
      method: 'PUT',
      url: '/api/v1/admin/catalog/collections/lego-voor-volwassenen',
      payload: {
        isPublic: true,
        publicDisplayName: 'Displaysets voor volwassenen',
        publicTileImageUrl: 'https://example.test/adult-tile.jpg',
        status: 'active',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.updateCollectionPresentation).toHaveBeenCalledWith({
      input: expect.objectContaining({
        publicDisplayName: 'Displaysets voor volwassenen',
        publicTileImageUrl: 'https://example.test/adult-tile.jpg',
      }),
      slug: 'lego-voor-volwassenen',
    });
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/', '/lego-voor-volwassenen'],
      reason: 'admin_collection_presentation_mutation',
      tags: [
        'homepage',
        'catalog',
        'sets',
        'collections',
        'collection:lego-voor-volwassenen',
      ],
    });

    await nextServer.close();
  });

  test('revalidates the canonical Dutch path for retiring collection presentation updates', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      skipped: false,
      pathCount: 2,
      paths: ['/', '/laatste-kans-lego-sets', '/retiring-lego-sets'],
      tagCount: 5,
      tags: [
        'homepage',
        'catalog',
        'sets',
        'collections',
        'collection:retiring-lego-sets',
      ],
    }));
    const { catalogService, server } = await createAdminCatalogServer();

    await server.close();
    const nextServer = Fastify();
    await nextServer.register(
      createAdminCatalogRoutes({
        adminPreHandler: async () => undefined,
        catalogService,
        revalidatePublicWebFn,
      }),
    );

    const response = await nextServer.inject({
      method: 'PUT',
      url: '/api/v1/admin/catalog/collections/retiring-lego-sets',
      payload: {
        isPublic: true,
        publicDisplayName: 'Laatste Kans LEGO Sets',
        publicTileImageUrl: 'https://example.test/last-chance-tile.jpg',
        status: 'active',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/', '/laatste-kans-lego-sets', '/retiring-lego-sets'],
      reason: 'admin_collection_presentation_mutation',
      tags: [
        'homepage',
        'catalog',
        'sets',
        'collections',
        'collection:retiring-lego-sets',
      ],
    });

    await nextServer.close();
  });

  test('does not expose a LEGO image candidates route', async () => {
    const { server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/sets/77984/lego-images',
    });

    expect(response.statusCode).toBe(404);

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

  test('creates a catalog set when Rebrickable still reports an unknown piece count', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/sets',
      payload: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76339-1/171736.jpg',
        name: 'The Fantastic Four H.E.R.B.I.E.',
        pieces: 0,
        releaseYear: 2027,
        setId: '76339',
        slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
        source: 'rebrickable',
        sourceSetNumber: '76339-1',
        theme: 'Marvel',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(catalogService.createSet).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76339-1/171736.jpg',
      name: 'The Fantastic Four H.E.R.B.I.E.',
      pieces: 0,
      releaseYear: 2027,
      setId: '76339',
      slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
      source: 'rebrickable',
      sourceSetNumber: '76339-1',
      theme: 'Marvel',
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

  test('blocks bulk onboarding writes in production runtime', async () => {
    const catalogService: AdminCatalogService = {
      getBulkOnboardingRun: vi.fn(async () =>
        createBulkOnboardingRunReadResult(),
      ),
      getLatestBulkOnboardingRun: vi.fn(async () =>
        createBulkOnboardingRunReadResult(),
      ),
      startBulkOnboarding: vi.fn(async () => createBulkOnboardingStartResult()),
      importDiscoveryCandidate: vi.fn(async () => createDiscoveryCandidate()),
      bulkImportDiscoveryCandidates: vi.fn(async () => ({
        completedCount: 0,
        concurrency: 1,
        failedCount: 0,
        processedCount: 0,
        requestedCount: 0,
        results: [],
        skippedCount: 0,
        warningCount: 0,
      })),
      reEnrichCatalogSet: vi.fn(async () =>
        createCatalogImportPipelineResult({
          bricksetStatus: 'skipped',
          enrichmentStatus: 'skipped',
          minifigStatus: 'skipped',
          stages: {
            brickset: { status: 'skipped' },
            minifig: { status: 'skipped' },
            theme: { status: 'skipped' },
          },
          themeStatus: 'skipped',
        }),
      ),
      listDiscoveryCandidates: vi.fn(async () => []),
      recomputeDiscoveryCandidateConfidence: vi.fn(async () => ({
        highCount: 0,
        lowCount: 0,
        mediumCount: 0,
        modifiedCount: 0,
        processedCount: 0,
        skippedCount: 0,
      })),
      updateDiscoveryCandidateStatus: vi.fn(async () =>
        createDiscoveryCandidate({
          status: 'ignored',
        }),
      ),
      createSet: vi.fn(async () => {
        throw new Error('not used');
      }),
      listCatalogSets: vi.fn(async () => []),
      listSuggestedSets: vi.fn(async () => []),
      searchMissingSets: vi.fn(async () => []),
      listThemePresentations: vi.fn(async () => []),
      listCollectionPresentations: vi.fn(async () => []),
      updateThemePresentation: vi.fn(async ({ input, slug }) => ({
        displayName: 'Star Wars',
        id: 'theme:star-wars',
        isPublic: input.isPublic,
        slug,
        status: input.status,
      })),
      updateCollectionPresentation: vi.fn(async ({ input, slug }) => ({
        collectionSlug: slug,
        isPublic: input.isPublic,
        status: input.status,
      })),
      listHomepageSections: vi.fn(async () => []),
      saveHomepageSection: vi.fn(async (section) => section),
    };
    const server = Fastify();

    await server.register(
      createAdminCatalogRoutes({
        adminPreHandler: async () => undefined,
        catalogService,
        isProductionEnvironment: () => true,
      }),
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/bulk-onboarding/runs',
      payload: {
        setIds: ['10316'],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(catalogService.startBulkOnboarding).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      message:
        'Production is read-only in the Operations Console. Use the explicit promote action for production changes.',
      status: 'error',
    });

    const reEnrichResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/sets/75313/re-enrich',
    });

    expect(reEnrichResponse.statusCode).toBe(403);
    expect(catalogService.reEnrichCatalogSet).not.toHaveBeenCalled();

    const bulkImportResponse = await server.inject({
      method: 'POST',
      payload: {
        candidateIds: ['candidate-75313'],
      },
      url: '/api/v1/admin/catalog/discovery-candidates/bulk-import',
    });

    expect(bulkImportResponse.statusCode).toBe(403);
    expect(catalogService.bulkImportDiscoveryCandidates).not.toHaveBeenCalled();

    await server.close();
  });

  test('lists persisted discovery candidates for review', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/discovery-candidates?status=new',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.listDiscoveryCandidates).toHaveBeenCalledWith({
      status: 'new',
    });
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: 'candidate-75313',
        normalizedSetId: '75313',
        status: 'new',
      }),
    ]);

    await server.close();
  });

  test('updates discovery candidate review status', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        status: 'ignored',
      },
      url: '/api/v1/admin/catalog/discovery-candidates/candidate-75313/status',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.updateDiscoveryCandidateStatus).toHaveBeenCalledWith({
      candidateId: 'candidate-75313',
      status: 'ignored',
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: 'ignored',
      }),
    );

    await server.close();
  });

  test('accepts restoring a discovery candidate to new status', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        status: 'new',
      },
      url: '/api/v1/admin/catalog/discovery-candidates/candidate-75313/status',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.updateDiscoveryCandidateStatus).toHaveBeenCalledWith({
      candidateId: 'candidate-75313',
      status: 'new',
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: 'new',
      }),
    );

    await server.close();
  });

  test('builds ignored restore audit evidence without deleting existing evidence', () => {
    const candidate = createDiscoveryCandidate({
      evidence: {
        importResult: { importedSetId: '75313' },
        operatorConfidence: 'medium',
        operatorConfidenceReasons: ['local_rebrickable_mirror_match'],
        reviewReason: 'manual_ignore',
      },
      status: 'ignored',
    });

    const update = buildCatalogDiscoveryCandidateStatusUpdate({
      candidate,
      now: () => new Date('2026-06-05T10:00:00.000Z'),
      restoredBy: 'operator@example.test',
      status: 'new',
    });

    expect(update.status).toBe('new');
    expect(update.evidence).toEqual({
      importResult: { importedSetId: '75313' },
      operatorConfidence: 'medium',
      operatorConfidenceReasons: ['local_rebrickable_mirror_match'],
      previousStatus: 'ignored',
      previous_status: 'ignored',
      restoredAt: '2026-06-05T10:00:00.000Z',
      restoredBy: 'operator@example.test',
      restored_at: '2026-06-05T10:00:00.000Z',
      restored_by: 'operator@example.test',
      reviewReason: 'manual_ignore',
    });
  });

  test('builds non-set restore audit evidence', () => {
    const update = buildCatalogDiscoveryCandidateStatusUpdate({
      candidate: createDiscoveryCandidate({
        evidence: { reviewReason: 'non_set' },
        status: 'non_set',
      }),
      now: () => new Date('2026-06-05T11:00:00.000Z'),
      status: 'new',
    });

    expect(update.evidence).toEqual(
      expect.objectContaining({
        previousStatus: 'non_set',
        restoredAt: '2026-06-05T11:00:00.000Z',
        restoredBy: 'admin',
        reviewReason: 'non_set',
      }),
    );
  });

  test('does not allow imported candidates to be restored', () => {
    expect(() =>
      buildCatalogDiscoveryCandidateStatusUpdate({
        candidate: createDiscoveryCandidate({ status: 'imported' }),
        status: 'new',
      }),
    ).toThrow('Geimporteerde discovery candidates zijn immutable.');
  });

  test('imports a persisted discovery candidate when cached enrichment exists', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/discovery-candidates/candidate-75313/import',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.importDiscoveryCandidate).toHaveBeenCalledWith({
      candidateId: 'candidate-75313',
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        importedSetId: '75313',
        status: 'imported',
      }),
    );

    await server.close();
  });

  test('bulk imports persisted discovery candidates', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        allowLowConfidence: true,
        candidateIds: ['candidate-75313', 'candidate-10341'],
        concurrency: 2,
      },
      url: '/api/v1/admin/catalog/discovery-candidates/bulk-import',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.bulkImportDiscoveryCandidates).toHaveBeenCalledWith({
      allowLowConfidence: true,
      candidateIds: ['candidate-75313', 'candidate-10341'],
      concurrency: 2,
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        completedCount: 1,
        concurrency: 1,
        requestedCount: 1,
      }),
    );

    await server.close();
  });

  test('re-enriches an existing catalog set', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/sets/75313/re-enrich',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.reEnrichCatalogSet).toHaveBeenCalledWith({
      setId: '75313',
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        enrichmentStatus: 'complete',
        importedSetId: '75313',
      }),
    );

    await server.close();
  });

  test('recomputes discovery candidate confidence', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/discovery-candidates/recompute-confidence',
    });

    expect(response.statusCode).toBe(200);
    expect(
      catalogService.recomputeDiscoveryCandidateConfidence,
    ).toHaveBeenCalled();
    expect(response.json()).toEqual({
      highCount: 1,
      lowCount: 0,
      mediumCount: 2,
      modifiedCount: 3,
      processedCount: 4,
      skippedCount: 1,
    });

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
