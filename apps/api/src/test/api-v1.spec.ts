import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  buildCatalogDiscoverySignalsApiPath,
  buildCatalogSetLiveOffersApiPath,
} from '@lego-platform/shared/config';
import {
  createAnonymousUserSession,
  type UserSession,
} from '@lego-platform/user/util';
import {
  CollectorHandleConflictError,
  type UserProfileRepository,
  type UserSessionService,
  type UserSetStatusRepository,
} from '@lego-platform/user/data-access-server';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';
import {
  createApiV1Routes,
  type ApiV1RouteDependencies,
} from '../app/routes/api-v1';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';

async function createApiServer({
  listCatalogDiscoverySignals = vi.fn().mockResolvedValue([]) as NonNullable<
    ApiV1RouteDependencies['listCatalogDiscoverySignals']
  >,
  requestPrincipal = {
    state: 'anonymous',
  } satisfies RequestPrincipal,
  listCatalogSetLiveOffersBySetId = vi
    .fn()
    .mockResolvedValue([]) as NonNullable<
    ApiV1RouteDependencies['listCatalogSetLiveOffersBySetId']
  >,
  userProfileRepository,
  userSession = createAnonymousUserSession(),
}: {
  listCatalogDiscoverySignals?: NonNullable<
    ApiV1RouteDependencies['listCatalogDiscoverySignals']
  >;
  listCatalogSetLiveOffersBySetId?: NonNullable<
    ApiV1RouteDependencies['listCatalogSetLiveOffersBySetId']
  >;
  requestPrincipal?: RequestPrincipal;
  userProfileRepository?: UserProfileRepository;
  userSession?: UserSession;
} = {}) {
  const resolveRequestPrincipal = vi.fn(
    async (): Promise<RequestPrincipal> => requestPrincipal,
  );
  const nextUserProfileRepository: UserProfileRepository =
    userProfileRepository ?? {
      ensureProfile: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
        wishlistDealAlerts: true,
        wishlistAlertsLastViewedAt: undefined,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      }),
      getByUserId: vi.fn().mockResolvedValue(null),
      markWishlistAlertsViewed: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
        wishlistDealAlerts: true,
        wishlistAlertsLastViewedAt: '2026-04-03T21:30:00.000Z',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-04-03T21:30:00.000Z',
      }),
      updateProfile: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
        wishlistDealAlerts: true,
        wishlistAlertsLastViewedAt: undefined,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      }),
    };
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
      listCatalogDiscoverySignals,
      listCatalogSetLiveOffersBySetId,
      userProfileRepository: nextUserProfileRepository,
      userSessionService,
      userSetStatusRepository,
    }),
  );

  return {
    listCatalogDiscoverySignals,
    server,
    resolveRequestPrincipal,
    listCatalogSetLiveOffersBySetId,
    userProfileRepository: nextUserProfileRepository,
    userSessionService,
    userSetStatusRepository,
  };
}

describe('api v1 auth and set-status routes', () => {
  test('returns public catalog discovery signals', async () => {
    const discoverySignals = [
      {
        setId: '42172',
        bestPriceMinor: 32999,
        merchantCount: 4,
        nextBestPriceMinor: 35999,
        observedAt: '2026-04-20T10:00:00.000Z',
        priceSpreadMinor: 4000,
        recentReferencePriceChangeMinor: -1200,
        recentReferencePriceChangedAt: '2026-04-20',
        referenceDeltaMinor: -2000,
      },
    ];
    const { listCatalogDiscoverySignals, server } = await createApiServer({
      listCatalogDiscoverySignals: vi.fn().mockResolvedValue(discoverySignals),
    });

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogDiscoverySignalsApiPath(),
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogDiscoverySignals).toHaveBeenCalledWith();
    expect(response.json()).toEqual(discoverySignals);

    await server.close();
  });

  test('returns public live catalog offers for a set', async () => {
    const liveOffers = [
      {
        availability: 'in_stock',
        checkedAt: '2026-04-18T11:45:11.617Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'other',
        merchantName: 'Proshop',
        merchantSlug: 'proshop',
        priceCents: 16541,
        setId: '21061',
        url: 'https://www.proshop.nl/LEGO/LEGO-Architecture-21061-Notre-Dame-van-Parijs/3259265',
      },
    ];
    const { listCatalogSetLiveOffersBySetId, server } = await createApiServer({
      listCatalogSetLiveOffersBySetId: vi.fn().mockResolvedValue(liveOffers),
    });

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogSetLiveOffersApiPath('21061'),
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogSetLiveOffersBySetId).toHaveBeenCalledWith('21061');
    expect(response.json()).toEqual(liveOffers);

    await server.close();
  });

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
      setStates: [],
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
      notificationPreferences: {
        wishlistDealAlerts: true,
      },
      ownedSetIds: ['10316'],
      setStates: [
        {
          setId: '10316',
          state: 'owned',
        },
        {
          setId: '21348',
          state: 'wishlist',
        },
      ],
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

  test('returns 401 for profile reads when no valid user is present', async () => {
    const { server, userProfileRepository } = await createApiServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/me/profile',
    });

    expect(response.statusCode).toBe(401);
    expect(userProfileRepository.ensureProfile).not.toHaveBeenCalled();

    await server.close();
  });

  test('returns the current collector profile for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const { server, userProfileRepository } = await createApiServer({
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/me/profile',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userProfileRepository.ensureProfile).toHaveBeenCalledWith({
      email: 'alex@example.test',
      userId: 'user-123',
    });
    expect(response.json()).toEqual({
      displayName: 'Alex Rivera',
      collectorHandle: 'alex-rivera',
      location: 'Amsterdam',
      collectionFocus: 'Premium display sets and licensed flagships',
      tier: 'Founding Collector',
      email: 'alex@example.test',
      wishlistDealAlerts: true,
    });

    await server.close();
  });

  test('updates the current collector profile for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const userProfileRepository: UserProfileRepository = {
      ensureProfile: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
        wishlistDealAlerts: true,
        wishlistAlertsLastViewedAt: undefined,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      }),
      getByUserId: vi.fn().mockResolvedValue(null),
      markWishlistAlertsViewed: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
        wishlistDealAlerts: false,
        wishlistAlertsLastViewedAt: undefined,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:05:00.000Z',
      }),
    };
    const { server } = await createApiServer({
      requestPrincipal,
      userProfileRepository,
    });

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/me/profile',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        displayName: 'Alex Rivera',
        collectorHandle: ' Alex Rivera ',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
        wishlistDealAlerts: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userProfileRepository.updateProfile).toHaveBeenCalledWith({
      userId: 'user-123',
      updateCollectorProfileInput: {
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
        wishlistDealAlerts: false,
      },
    });
    expect(response.json()).toEqual({
      displayName: 'Alex Rivera',
      collectorHandle: 'alex-rivera',
      location: 'Rotterdam',
      collectionFocus: 'Castle icons and Ideas cabins',
      tier: 'Founding Collector',
      email: 'alex@example.test',
      wishlistDealAlerts: false,
    });

    await server.close();
  });

  test('returns 409 when the collector handle is already taken', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const userProfileRepository: UserProfileRepository = {
      ensureProfile: vi.fn().mockResolvedValue({
        userId: 'user-123',
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
        wishlistDealAlerts: true,
        wishlistAlertsLastViewedAt: undefined,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      }),
      getByUserId: vi.fn().mockResolvedValue(null),
      markWishlistAlertsViewed: vi.fn(),
      updateProfile: vi
        .fn()
        .mockRejectedValue(new CollectorHandleConflictError()),
    };
    const { server } = await createApiServer({
      requestPrincipal,
      userProfileRepository,
    });

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/me/profile',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
        wishlistDealAlerts: true,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Collector handle is already in use.',
    });

    await server.close();
  });

  test('marks wishlist alerts as viewed for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const { server, userProfileRepository } = await createApiServer({
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/me/profile/wishlist-alerts/viewed',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userProfileRepository.markWishlistAlertsViewed).toHaveBeenCalledWith(
      {
        userId: 'user-123',
      },
    );
    expect(response.json()).toEqual({
      wishlistAlertsLastViewedAt: '2026-04-03T21:30:00.000Z',
    });

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
