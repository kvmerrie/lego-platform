import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  createAdminPromoteRoutes,
  type AdminPromoteService,
} from '../app/routes/admin-promote';

async function createAdminPromoteServer({
  adminPromoteService,
  getExpectedAdminSecret,
}: {
  adminPromoteService?: AdminPromoteService;
  getExpectedAdminSecret?: () => string;
} = {}) {
  const nextAdminPromoteService: AdminPromoteService = adminPromoteService ?? {
    promoteCatalog: vi.fn(async () => ({
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

  test('returns structured promotion counts on a successful run', async () => {
    const { adminPromoteService, server } = await createAdminPromoteServer({
      getExpectedAdminSecret: () => 'promote-secret',
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
    expect(response.json()).toEqual({
      durationMs: 421,
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
});
