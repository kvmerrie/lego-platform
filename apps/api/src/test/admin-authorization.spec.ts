import Fastify from 'fastify';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAdminPreHandler } from '../app/lib/admin-authorization';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

async function createGuardedServer({
  allowMachineSecret = false,
  principal,
}: {
  allowMachineSecret?: boolean;
  principal: RequestPrincipal;
}) {
  const server = Fastify();

  await server.register(
    createRequestPrincipalPlugin({
      resolveRequestPrincipal: vi.fn(async () => principal),
    }),
  );

  server.get(
    '/admin-only',
    {
      preHandler: createAdminPreHandler({
        allowMachineSecret,
        getAllowedEmails: () => ['admin@example.test'],
        getExpectedMachineSecret: () => 'machine-secret',
      }),
    },
    async () => ({
      ok: true,
    }),
  );

  return server;
}

describe('admin authorization guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('rejects anonymous admin requests', async () => {
    const server = await createGuardedServer({
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/admin-only',
    });

    expect(response.statusCode).toBe(401);

    await server.close();
  });

  test('rejects normal authenticated users', async () => {
    const server = await createGuardedServer({
      principal: {
        email: 'collector@example.test',
        state: 'authenticated',
        userId: 'user-1',
      },
    });

    const response = await server.inject({
      headers: {
        authorization: 'Bearer collector-token',
      },
      method: 'GET',
      url: '/admin-only',
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('allows explicit admin emails', async () => {
    const server = await createGuardedServer({
      principal: {
        email: 'admin@example.test',
        state: 'authenticated',
        userId: 'admin-1',
      },
    });

    const response = await server.inject({
      headers: {
        authorization: 'Bearer admin-token',
      },
      method: 'GET',
      url: '/admin-only',
    });

    expect(response.statusCode).toBe(200);

    await server.close();
  });

  test('allows server-derived admin role claims', async () => {
    const server = await createGuardedServer({
      principal: {
        appMetadata: {
          role: 'admin',
        },
        email: 'collector@example.test',
        state: 'authenticated',
        userId: 'admin-2',
      },
    });

    const response = await server.inject({
      headers: {
        authorization: 'Bearer role-token',
      },
      method: 'GET',
      url: '/admin-only',
    });

    expect(response.statusCode).toBe(200);

    await server.close();
  });

  test('allows scoped machine-secret access when enabled', async () => {
    const server = await createGuardedServer({
      allowMachineSecret: true,
      principal: {
        state: 'anonymous',
      },
    });

    const response = await server.inject({
      headers: {
        'x-admin-secret': 'machine-secret',
      },
      method: 'GET',
      url: '/admin-only',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).not.toContain('machine-secret');

    await server.close();
  });

  test('uses ADMIN_EMAIL_ALLOWLIST for admin API access', async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = 'kvmerrie@gmail.com';
    const server = Fastify();

    await server.register(
      createRequestPrincipalPlugin({
        resolveRequestPrincipal: vi.fn(
          async (authorizationHeader): Promise<RequestPrincipal> =>
            authorizationHeader === 'Bearer kvmerrie-token'
              ? {
                  email: 'kvmerrie@gmail.com',
                  state: 'authenticated',
                  userId: 'admin-kvmerrie',
                }
              : {
                  email: 'collector@example.test',
                  state: 'authenticated',
                  userId: 'collector-1',
                },
        ),
      }),
    );

    server.get(
      '/admin-only',
      {
        preHandler: createAdminPreHandler(),
      },
      async () => ({
        ok: true,
      }),
    );

    const anonymousResponse = await server.inject({
      method: 'GET',
      url: '/admin-only',
    });
    const normalUserResponse = await server.inject({
      headers: {
        authorization: 'Bearer normal-token',
      },
      method: 'GET',
      url: '/admin-only',
    });
    const adminResponse = await server.inject({
      headers: {
        authorization: 'Bearer kvmerrie-token',
      },
      method: 'GET',
      url: '/admin-only',
    });

    expect(anonymousResponse.statusCode).toBe(401);
    expect(normalUserResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(200);

    await server.close();
  });
});
