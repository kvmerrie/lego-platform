import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    process.env.ADMIN_CACHE_REVALIDATE_SECRET = 'cache-admin-secret';
    const { fetchImpl, server } = await createServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/cache/revalidate',
      payload: {
        paths: ['/'],
        reason: 'manual_homepage_fix',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();

    await server.close();
  });

  test('accepts a valid bearer admin session', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    const { auditLogger, fetchImpl, server } = await createServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/cache/revalidate',
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
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          authKind: 'bearer_session',
        }),
        operationType: 'cache_revalidation',
        paths: ['/', '/deals'],
        reason: 'homepage_hotfix',
        success: true,
        tags: ['homepage', 'deals'],
      }),
    });

    await server.close();
  });

  test('accepts a valid x-admin-secret without a bearer session', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    process.env.ADMIN_CACHE_REVALIDATE_SECRET = 'cache-admin-secret';
    const { auditLogger, fetchImpl, server } = await createServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/cache/revalidate',
      headers: {
        'x-admin-secret': 'cache-admin-secret',
      },
      payload: {
        paths: ['/themes'],
        reason: 'manual_theme_fix',
        tags: ['themes'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.brickhunt.nl/api/revalidate',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-revalidate-secret': 'server-secret',
        }),
      }),
    );
    expect(JSON.stringify(response.json())).not.toContain('server-secret');
    expect(auditLogger).toHaveBeenCalledWith({
      input: expect.objectContaining({
        actorEmail: null,
        actorId: 'admin-secret',
        metadata: expect.objectContaining({
          authKind: 'admin_secret',
        }),
        operationType: 'cache_revalidation',
        paths: ['/themes'],
        reason: 'manual_theme_fix',
        success: true,
        tags: ['themes'],
      }),
    });

    await server.close();
  });

  test('falls back to ADMIN_PROMOTE_SECRET for x-admin-secret auth', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    delete process.env.ADMIN_CACHE_REVALIDATE_SECRET;
    process.env.ADMIN_PROMOTE_SECRET = 'promote-admin-secret';
    const { server } = await createServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/cache/revalidate',
      headers: {
        'x-admin-secret': 'promote-admin-secret',
      },
      payload: {
        paths: ['/'],
        reason: 'manual_homepage_fix',
      },
    });

    expect(response.statusCode).toBe(200);

    await server.close();
  });

  test('rejects an invalid x-admin-secret', async () => {
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    process.env.WEB_REVALIDATE_SECRET = 'server-secret';
    process.env.ADMIN_CACHE_REVALIDATE_SECRET = 'cache-admin-secret';
    const { fetchImpl, server } = await createServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/admin/cache/revalidate',
      headers: {
        'x-admin-secret': 'wrong-secret',
      },
      payload: {
        paths: ['/'],
        reason: 'manual_homepage_fix',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      message: 'Admin authentication is required.',
      status: 'error',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

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
      url: '/api/admin/cache/revalidate',
      headers: {
        authorization: 'Bearer admin-token',
      },
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
      url: '/api/admin/cache/revalidate',
      headers: {
        authorization: 'Bearer admin-token',
      },
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

describe('admin cache revalidation browser import safety', () => {
  const workspaceRoot = join(process.cwd(), '../..');
  const browserFiles = [
    'libs/commerce/feature-admin/src/lib/commerce-admin-api.service.ts',
    'libs/commerce/feature-admin/src/lib/commerce-admin-cache-revalidation-page.ts',
    'libs/commerce/feature-admin/src/lib/commerce-admin-store.service.ts',
    'libs/commerce/feature-admin/src/index.ts',
    'libs/commerce/util/src/lib/commerce-util.ts',
    'libs/content/feature-admin/src/lib/content-admin-editorial-agent-api.service.ts',
    'libs/content/feature-admin/src/lib/content-admin-editorial-agent-page.ts',
    'libs/catalog/util/src/lib/catalog-util.ts',
    'libs/shared/design-tokens/src/lib/shared-design-tokens.ts',
    'libs/shell/admin/src/lib/shell-admin/shell-admin.ts',
    'apps/admin/src/app/app.routes.ts',
  ];
  const forbiddenPatterns = [
    /@lego-platform\/shared\/config/,
    /@lego-platform\/shared\/data-access-auth['"]/,
    /public-web-revalidation/,
    /process\.env/,
    /\bWEB_BASE_URL\b/,
    /\bWEB_REVALIDATE_SECRET\b/,
  ];

  test('keeps the admin cache revalidation browser path free of server config imports', () => {
    for (const browserFile of browserFiles) {
      const source = readFileSync(join(workspaceRoot, browserFile), 'utf8');

      for (const forbiddenPattern of forbiddenPatterns) {
        expect(
          source,
          `${browserFile} imports ${forbiddenPattern}`,
        ).not.toMatch(forbiddenPattern);
      }
    }
  });
});
