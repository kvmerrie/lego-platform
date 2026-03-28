import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import { createAnonymousUserSession, type UserSession } from '@lego-platform/user/util';
import {
  type UserSessionService,
  type UserSetStatusRepository,
} from '@lego-platform/user/data-access-server';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';
import { createApiV1Routes } from '../app/routes/api-v1';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';

async function createApiServer({
  requestPrincipal = {
    state: 'anonymous',
  } satisfies RequestPrincipal,
  userSession = createAnonymousUserSession(),
}: {
  requestPrincipal?: RequestPrincipal;
  userSession?: UserSession;
} = {}) {
  const resolveRequestPrincipal = vi.fn(
    async (): Promise<RequestPrincipal> => requestPrincipal,
  );
  const userSessionService: UserSessionService = {
    getUserSession: vi.fn().mockResolvedValue(userSession),
  };
  const userSetStatusRepository: UserSetStatusRepository = {
    getByUserIdAndSetId: vi.fn().mockResolvedValue(null),
    listByUserId: vi.fn().mockResolvedValue([]),
    setOwnedState: vi.fn().mockResolvedValue(null),
    setWantedState: vi.fn().mockResolvedValue(null),
  };
  const server = Fastify();

  await server.register(
    createRequestPrincipalPlugin({
      resolveRequestPrincipal,
    }),
  );
  await server.register(
    createApiV1Routes({
      userSessionService,
      userSetStatusRepository,
    }),
  );

  return {
    server,
    resolveRequestPrincipal,
    userSessionService,
    userSetStatusRepository,
  };
}

describe('api v1 auth and set-status routes', () => {
  test('returns an anonymous session when no valid user is present', async () => {
    const { server, userSessionService } = await createApiServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(response.statusCode).toBe(200);
    expect(userSessionService.getUserSession).toHaveBeenCalledWith({
      state: 'anonymous',
    });
    expect(response.json()).toEqual({
      state: 'anonymous',
      ownedSetIds: [],
      wantedSetIds: [],
    });

    await server.close();
  });

  test('returns the assembled authenticated session when the bearer token resolves', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const authenticatedSession: UserSession = {
      state: 'authenticated',
      account: {
        userId: 'user-123',
        email: 'alex@example.test',
      },
      collector: {
        id: 'alex-rivera',
        name: 'Alex Rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
      },
      ownedSetIds: ['10316'],
      wantedSetIds: ['21348'],
    };
    const { server, userSessionService } = await createApiServer({
      requestPrincipal,
      userSession: authenticatedSession,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userSessionService.getUserSession).toHaveBeenCalledWith(
      requestPrincipal,
    );
    expect(response.json()).toEqual(authenticatedSession);

    await server.close();
  });

  test('returns 401 for owned-set mutations when no valid user is present', async () => {
    const { server, userSetStatusRepository } = await createApiServer();

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/owned-sets/10316',
    });

    expect(response.statusCode).toBe(401);
    expect(userSetStatusRepository.setOwnedState).not.toHaveBeenCalled();

    await server.close();
  });

  test('persists owned-set mutations through the repository-backed route', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const { server, userSetStatusRepository } = await createApiServer({
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/owned-sets/10316',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userSetStatusRepository.setOwnedState).toHaveBeenCalledWith({
      userId: 'user-123',
      setId: '10316',
      isOwned: true,
    });
    expect(response.json()).toEqual({
      setId: '10316',
      isOwned: true,
    });

    await server.close();
  });

  test('persists wanted-set mutations through the repository-backed route', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const { server, userSetStatusRepository } = await createApiServer({
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/me/wanted-sets/21348',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userSetStatusRepository.setWantedState).toHaveBeenCalledWith({
      userId: 'user-123',
      setId: '21348',
      isWanted: false,
    });
    expect(response.json()).toEqual({
      setId: '21348',
      isWanted: false,
    });

    await server.close();
  });
});
