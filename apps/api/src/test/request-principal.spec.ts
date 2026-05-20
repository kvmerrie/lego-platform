import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

describe('request principal plugin', () => {
  test('uses an anonymous fast path when no authorization header is present', async () => {
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
      return {
        principal: request.requestPrincipal,
        timing: request.requestPrincipalTiming,
      };
    });

    const response = await server.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toBe(200);
    expect(resolveRequestPrincipal).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({
      principal: {
        state: 'anonymous',
      },
      timing: {
        auth_header_present: false,
        parse_cookies_ms: 0,
        supabase_auth_ms: 0,
      },
    });

    await server.close();
  });

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
