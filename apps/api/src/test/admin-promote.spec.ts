import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  createAdminPromoteRoutes,
  type AdminPromoteService,
} from '../app/routes/admin-promote';

type AdminPromoteRouteOptions = NonNullable<
  Parameters<typeof createAdminPromoteRoutes>[0]
>;

function createPromotionPreview() {
  return {
    generatedAt: '2026-04-22T08:59:00.000Z',
    meaningfulPendingPromoteCount: 2,
    operatorSummary: {
      mappings: {
        insertedCount: 0,
        readCount: 0,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 0,
      },
      sets: {
        insertedCount: 1,
        readCount: 10,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 1,
      },
      themes: {
        insertedCount: 0,
        readCount: 0,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 0,
      },
    },
    pendingPromoteCount: 2,
    samples: [
      {
        changeType: 'insert',
        changedFields: ['set_id'],
        key: 'set_id:10316',
        table: 'catalog_sets',
      },
    ],
    sourceEnvironment: 'staging',
    status: 'ok',
    tables: {
      catalog_sets: {
        insertedCount: 1,
        readCount: 10,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 1,
      },
      collection_page_snapshots: {
        insertedCount: 0,
        readCount: 0,
        skipped: true,
        strategy: 'heavy_skipped',
        updatedCount: 0,
        warning: 'Skipped in lightweight preview.',
      },
    },
    skippedHeavyTables: ['collection_page_snapshots'],
    targetEnvironment: 'production',
  } satisfies Awaited<ReturnType<AdminPromoteService['previewCatalog']>>;
}

function createPromotionTableSummary() {
  return {
    insertedCount: 0,
    readCount: 0,
    updatedCount: 0,
    upsertedCount: 0,
  };
}

function createPromotionResult() {
  return {
    changedThemeSlugs: [],
    durationMs: 10,
    startedAt: '2026-04-22T09:00:00.000Z',
    status: 'ok' as const,
    tables: {
      catalog_set_minifig_summaries: createPromotionTableSummary(),
      catalog_set_source_metadata: createPromotionTableSummary(),
      catalog_sets: createPromotionTableSummary(),
      catalog_source_themes: createPromotionTableSummary(),
      catalog_theme_mappings: createPromotionTableSummary(),
      catalog_themes: createPromotionTableSummary(),
      collection_page_snapshots: createPromotionTableSummary(),
      commerce_benchmark_sets: createPromotionTableSummary(),
      commerce_merchants: createPromotionTableSummary(),
      commerce_offer_seeds: createPromotionTableSummary(),
    },
  } satisfies Awaited<ReturnType<AdminPromoteService['promoteCatalog']>>;
}

async function createAdminPromoteServer({
  adminPromoteService,
  getExpectedAdminSecret,
  revalidatePublicWebFn,
}: {
  adminPromoteService?: AdminPromoteService;
  getExpectedAdminSecret?: () => string;
  revalidatePublicWebFn?: AdminPromoteRouteOptions['revalidatePublicWebFn'];
} = {}) {
  const nextAdminPromoteService: AdminPromoteService = adminPromoteService ?? {
    previewCatalog: vi.fn(async () => createPromotionPreview()),
    promoteCatalog: vi.fn(async () => ({
      changedThemeSlugs: [],
      durationMs: 421,
      startedAt: '2026-04-22T09:00:00.000Z',
      status: 'ok' as const,
      tables: {
        catalog_source_themes: {
          insertedCount: 2,
          readCount: 2,
          updatedCount: 0,
          upsertedCount: 2,
        },
        catalog_themes: {
          insertedCount: 1,
          readCount: 1,
          updatedCount: 0,
          upsertedCount: 1,
        },
        catalog_theme_mappings: {
          insertedCount: 1,
          readCount: 1,
          updatedCount: 0,
          upsertedCount: 1,
        },
        catalog_sets: {
          insertedCount: 3,
          readCount: 3,
          updatedCount: 0,
          upsertedCount: 3,
        },
        catalog_set_minifig_summaries: {
          insertedCount: 0,
          readCount: 0,
          updatedCount: 0,
          upsertedCount: 0,
        },
        commerce_merchants: {
          insertedCount: 2,
          readCount: 2,
          updatedCount: 0,
          upsertedCount: 2,
        },
        commerce_benchmark_sets: {
          insertedCount: 1,
          readCount: 1,
          updatedCount: 0,
          upsertedCount: 1,
        },
        commerce_offer_seeds: {
          insertedCount: 5,
          readCount: 5,
          updatedCount: 0,
          upsertedCount: 5,
        },
      },
    })),
  };
  const server = Fastify();

  await server.register(
    createAdminPromoteRoutes({
      adminPreHandler: async () => undefined,
      adminPromoteService: nextAdminPromoteService,
      getExpectedAdminSecret,
      revalidatePublicWebFn,
    }),
  );

  return {
    adminPromoteService: nextAdminPromoteService,
    revalidatePublicWebFn,
    server,
  };
}

async function createAuthenticatedAdminPromoteServer({
  adminPromoteService,
  getExpectedAdminSecret,
}: {
  adminPromoteService?: AdminPromoteService;
  getExpectedAdminSecret?: () => string;
} = {}) {
  const nextAdminPromoteService: AdminPromoteService = adminPromoteService ?? {
    previewCatalog: vi.fn(async () => createPromotionPreview()),
    promoteCatalog: vi.fn(async () => createPromotionResult()),
  };
  const server = Fastify();

  server.addHook('preHandler', async (request) => {
    request.requestPrincipal = {
      appMetadata: {
        role: 'admin',
      },
      email: 'admin@example.test',
      role: 'admin',
      state: 'authenticated',
      userId: 'admin-user',
    };
  });

  await server.register(
    createAdminPromoteRoutes({
      adminPreHandler: async () => undefined,
      adminPromoteService: nextAdminPromoteService,
      getExpectedAdminSecret,
    }),
  );

  return {
    adminPromoteService: nextAdminPromoteService,
    server,
  };
}

describe('admin promote routes', () => {
  test('returns a read-only catalog promotion preview', async () => {
    const { adminPromoteService, server } = await createAdminPromoteServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/promote/catalog/preview',
    });

    expect(response.statusCode).toBe(200);
    expect(adminPromoteService.previewCatalog).toHaveBeenCalled();
    expect(adminPromoteService.promoteCatalog).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        pendingPromoteCount: 2,
        skippedHeavyTables: ['collection_page_snapshots'],
        sourceEnvironment: 'staging',
        targetEnvironment: 'production',
      }),
    );

    await server.close();
  });

  test('requires the admin promotion secret header', async () => {
    const { adminPromoteService, server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => 'promote-secret',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
    });

    expect(response.statusCode).toBe(401);
    expect(adminPromoteService.promoteCatalog).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      message: 'Admin promotion secret is missing or invalid.',
      status: 'error',
    });

    await server.close();
  });

  test('promotes catalog changes for authenticated admins with confirmation phrase', async () => {
    const { adminPromoteService, server } =
      await createAuthenticatedAdminPromoteServer({
        getExpectedAdminSecret: () => 'promote-secret',
      });

    const response = await server.inject({
      method: 'POST',
      payload: {
        confirmationPhrase: 'PROMOTE CATALOG',
      },
      url: '/api/admin/promote/catalog',
    });

    expect(response.statusCode).toBe(200);
    expect(adminPromoteService.promoteCatalog).toHaveBeenCalled();

    await server.close();
  });

  test('requires confirmation phrase for authenticated admin catalog promotion', async () => {
    const { adminPromoteService, server } =
      await createAuthenticatedAdminPromoteServer({
        getExpectedAdminSecret: () => 'promote-secret',
      });

    const response = await server.inject({
      method: 'POST',
      payload: {
        confirmationPhrase: 'WRONG',
      },
      url: '/api/admin/promote/catalog',
    });

    expect(response.statusCode).toBe(400);
    expect(adminPromoteService.promoteCatalog).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      message: 'Catalog promotion confirmation phrase is missing.',
      status: 'error',
    });

    await server.close();
  });

  test('returns structured promotion counts on a successful run', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      pathCount: 5,
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      skipped: false,
      tagCount: 8,
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    }));
    const { adminPromoteService, server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(adminPromoteService.promoteCatalog).toHaveBeenCalled();
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      reason: 'catalog_promote',
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    });
    expect(response.json()).toEqual({
      changedThemeSlugs: [],
      durationMs: 421,
      revalidation: {
        attempted: true,
        pathCount: 5,
        paths: [
          '/',
          '/themes',
          '/nieuwe-lego-sets',
          '/retiring-lego-sets',
          '/lego-voor-volwassenen',
        ],
        skipped: false,
        tagCount: 8,
        tags: [
          'homepage',
          'themes',
          'collections',
          'collection:nieuwe-lego-sets',
          'collection:retiring-lego-sets',
          'collection:lego-voor-volwassenen',
          'catalog',
          'sets',
        ],
      },
      startedAt: '2026-04-22T09:00:00.000Z',
      status: 'ok',
      tables: expect.objectContaining({
        catalog_sets: expect.objectContaining({
          readCount: 3,
          upsertedCount: 3,
        }),
        commerce_offer_seeds: expect.objectContaining({
          readCount: 5,
          upsertedCount: 5,
        }),
      }),
    });

    await server.close();
  });

  test('revalidates changed public theme detail paths after promotion', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      pathCount: 6,
      paths: [
        '/',
        '/themes',
        '/themes/icons',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      skipped: false,
      tagCount: 8,
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    }));
    const adminPromoteService: AdminPromoteService = {
      previewCatalog: vi.fn(async () => createPromotionPreview()),
      promoteCatalog: vi.fn(async () => ({
        changedThemeSlugs: ['icons'],
        durationMs: 421,
        startedAt: '2026-04-22T09:00:00.000Z',
        status: 'ok' as const,
        tables: {
          catalog_source_themes: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_themes: {
            insertedCount: 0,
            readCount: 1,
            updatedCount: 1,
            upsertedCount: 1,
          },
          catalog_theme_mappings: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_sets: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_set_minifig_summaries: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_merchants: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_benchmark_sets: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_offer_seeds: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
        },
      })),
    };
    const { server } = await createAdminPromoteServer({
      adminPromoteService,
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [
        '/',
        '/themes',
        '/themes/icons',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      reason: 'catalog_promote',
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    });

    await server.close();
  });

  test('skips targeted theme detail revalidation when too many themes changed', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      pathCount: 5,
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      skipped: false,
      tagCount: 8,
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    }));
    const adminPromoteService: AdminPromoteService = {
      previewCatalog: vi.fn(async () => createPromotionPreview()),
      promoteCatalog: vi.fn(async () => ({
        changedThemeSlugs: Array.from(
          { length: 51 },
          (_, index) => `theme-${index}`,
        ),
        durationMs: 421,
        startedAt: '2026-04-22T09:00:00.000Z',
        status: 'ok' as const,
        tables: {
          catalog_source_themes: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_themes: {
            insertedCount: 0,
            readCount: 51,
            updatedCount: 51,
            upsertedCount: 51,
          },
          catalog_theme_mappings: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_sets: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          catalog_set_minifig_summaries: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_merchants: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_benchmark_sets: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
          commerce_offer_seeds: {
            insertedCount: 0,
            readCount: 0,
            updatedCount: 0,
            upsertedCount: 0,
          },
        },
      })),
    };
    const { server } = await createAdminPromoteServer({
      adminPromoteService,
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      reason: 'catalog_promote',
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    });

    await server.close();
  });

  test('returns a warning when catalog promotion succeeds but revalidation fails', async () => {
    const revalidatePublicWebFn = vi.fn(async () => {
      throw new Error('Public web revalidation failed with status 401.');
    });
    const { adminPromoteService, server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(adminPromoteService.promoteCatalog).toHaveBeenCalled();
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      reason: 'catalog_promote',
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        revalidationWarning: 'Public web revalidation failed with status 401.',
        status: 'ok',
      }),
    );

    await server.close();
  });

  test('keeps successful catalog promotion when revalidation is skipped as unconfigured', async () => {
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: false,
      pathCount: 5,
      paths: [
        '/',
        '/themes',
        '/nieuwe-lego-sets',
        '/retiring-lego-sets',
        '/lego-voor-volwassenen',
      ],
      skipped: true,
      tagCount: 8,
      tags: [
        'homepage',
        'themes',
        'collections',
        'collection:nieuwe-lego-sets',
        'collection:retiring-lego-sets',
        'collection:lego-voor-volwassenen',
        'catalog',
        'sets',
      ],
    }));
    const { server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        revalidation: {
          attempted: false,
          pathCount: 5,
          paths: [
            '/',
            '/themes',
            '/nieuwe-lego-sets',
            '/retiring-lego-sets',
            '/lego-voor-volwassenen',
          ],
          skipped: true,
          tagCount: 8,
          tags: [
            'homepage',
            'themes',
            'collections',
            'collection:nieuwe-lego-sets',
            'collection:retiring-lego-sets',
            'collection:lego-voor-volwassenen',
            'catalog',
            'sets',
          ],
        },
        status: 'ok',
      }),
    );

    await server.close();
  });

  test('returns 503 when promotion config is missing on the server', async () => {
    const { adminPromoteService, server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => {
        throw new Error(
          'Missing required environment variable: ADMIN_PROMOTE_SECRET.',
        );
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(adminPromoteService.promoteCatalog).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      message: 'Catalog promotion is not configured.',
      status: 'error',
    });

    await server.close();
  });

  test('does not revalidate when catalog promotion fails', async () => {
    const revalidatePublicWebFn = vi.fn();
    const adminPromoteService: AdminPromoteService = {
      previewCatalog: vi.fn(async () => createPromotionPreview()),
      promoteCatalog: vi.fn(async () => {
        throw new Error('Promotion failed.');
      }),
    };
    const { server } = await createAdminPromoteServer({
      adminPromoteService,
      getExpectedAdminSecret: () => 'promote-secret',
      revalidatePublicWebFn,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/promote/catalog',
      headers: {
        'x-admin-secret': 'promote-secret',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(revalidatePublicWebFn).not.toHaveBeenCalled();

    await server.close();
  });
});
