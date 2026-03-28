import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

describe('request principal plugin', () => {
  test('decorates the request with the resolved principal', async () => {
    const resolveRequestPrincipal = vi.fn(
      async (): Promise<RequestPrincipal> => ({
        state: 'authenticated',
        userId: 'user-123',
        email: 'alex@example.test',
      }),
    );
    const server = Fastify();

    await server.register(
      createRequestPrincipalPlugin({
        resolveRequestPrincipal,
      }),
    );

    server.get('/principal', async function (request) {
      return request.requestPrincipal;
    });

    const response = await server.inject({
      method: 'GET',
      url: '/principal',
      headers: {
        authorization: 'Bearer token-123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(resolveRequestPrincipal).toHaveBeenCalledWith('Bearer token-123');
    expect(response.json()).toEqual({
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    });

    await server.close();
  });

  test('falls back to an anonymous principal when resolution fails', async () => {
    const resolveRequestPrincipal = vi.fn(async () => {
      throw new Error('Invalid access token.');
    });
    const server = Fastify();

    await server.register(
      createRequestPrincipalPlugin({
        resolveRequestPrincipal,
      }),
    );

    server.get('/principal', async function (request) {
      return request.requestPrincipal;
    });

    const response = await server.inject({
      method: 'GET',
      url: '/principal',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: 'anonymous',
    });

    await server.close();
  });
});
