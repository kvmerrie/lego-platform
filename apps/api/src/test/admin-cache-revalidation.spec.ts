import Fastify from 'fastify';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';
import { createAdminCacheRevalidationRoutes } from '../app/routes/admin-cache-revalidation';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

type AdminCacheRevalidationRouteOptions = NonNullable<
  Parameters<typeof createAdminCacheRevalidationRoutes>[0]
>;

async function createServer({
  auditLogger = vi.fn(async () => undefined),
  fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ revalidated: true }), {
        status: 200,
      }),
  ),
  principal = {
    email: 'admin@example.test',
    state: 'authenticated',
    userId: 'admin-1',
  } satisfies RequestPrincipal,
}: {
  auditLogger?: AdminCacheRevalidationRouteOptions['auditLogger'];
  fetchImpl?: typeof fetch;
  principal?: RequestPrincipal;
} = {}) {
  const server = Fastify();

  await server.register(
    createRequestPrincipalPlugin({
      resolveRequestPrincipal: async () => principal,
    }),
  );
  await server.register(
    createAdminCacheRevalidationRoutes({
      auditLogger,
      fetchImpl,
    }),
  );

  return {
    auditLogger,
    fetchImpl,
    server,
  };
}

describe('admin cache revalidation routes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test('requires authenticated admin access', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    const { fetchImpl, server } = await createServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/admin/cache/revalidate',
      payload: {
        paths: ['/'],
        reason: 'manual_homepage_fix',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();

    await server.close();
  });

  test('forwards the revalidation secret server-side only', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    const { auditLogger, fetchImpl, server } = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/admin/cache/revalidate',
      headers: {
        authorization: 'Bearer browser-token',
      },
      payload: {
        paths: ['/', '/deals'],
        reason: 'homepage_hotfix',
        tags: ['homepage', 'deals'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.brickhunt.nl/api/revalidate',
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-revalidate-secret': 'server-secret',
        }),
      }),
    );
    expect(JSON.stringify(response.json())).not.toContain('server-secret');
    expect(auditLogger).toHaveBeenCalledWith({
      input: expect.objectContaining({
        actorEmail: 'admin@example.test',
        operationType: 'cache_revalidation',
        paths: ['/', '/deals'],
        reason: 'homepage_hotfix',
        success: true,
        tags: ['homepage', 'deals'],
      }),
    });

    await server.close();
  });

  test('batches payloads and aggregates partial failures', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revalidated: true }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Too many paths' }), {
          status: 400,
        }),
      );
    const { server } = await createServer({
      fetchImpl,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/admin/cache/revalidate',
      payload: {
        paths: Array.from({ length: 26 }, (_, index) => `/sets/${index}`),
        reason: 'manual_batch_fix',
      },
    });
    const payload = response.json();

    expect(response.statusCode).toBe(207);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(payload.status).toBe('partial_failure');
    expect(payload.results).toHaveLength(2);
    expect(payload.results[0].pathCount).toBe(25);
    expect(payload.results[1].pathCount).toBe(1);
    expect(payload.warnings).toEqual([
      'Public web revalidation batch 2 failed with status 400.',
    ]);

    await server.close();
  });

  test('rejects invalid paths before forwarding', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    const { fetchImpl, server } = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/admin/cache/revalidate',
      payload: {
        paths: ['https://www.brickhunt.nl/deals'],
        reason: 'manual_fix',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      invalidPaths: ['https://www.brickhunt.nl/deals'],
      invalidTags: [],
      message: 'Invalid cache revalidation targets.',
      status: 'error',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    await server.close();
  });
});
