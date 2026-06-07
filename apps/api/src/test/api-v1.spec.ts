import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  apiPaths,
  buildCatalogCurrentOfferSummariesApiPath,
  buildCatalogDiscoverySignalsApiPath,
  buildCatalogSetLiveOffersApiPath,
} from '@lego-platform/shared/config';
import type { UserThemeFavoriteRepository } from '@lego-platform/catalog/data-access-server';
import {
  createAnonymousUserSession,
  type UserSession,
} from '@lego-platform/user/util';
import {
  CollectorHandleConflictError,
  type RecentlyViewedSetRepository,
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
  listCatalogCurrentOfferSummariesBySetIds = vi
    .fn()
    .mockResolvedValue([]) as NonNullable<
    ApiV1RouteDependencies['listCatalogCurrentOfferSummariesBySetIds']
  >,
  listCatalogDiscoverySignals = vi.fn().mockResolvedValue([]) as NonNullable<
    ApiV1RouteDependencies['listCatalogDiscoverySignals']
  >,
  publicRateLimit,
  recentlyViewedSetRepository,
  requestPrincipal = {
    state: 'anonymous',
  } satisfies RequestPrincipal,
  userThemeFavoriteRepository,
  listCatalogSetLiveOffersBySetId = vi
    .fn()
    .mockResolvedValue([]) as NonNullable<
    ApiV1RouteDependencies['listCatalogSetLiveOffersBySetId']
  >,
  userProfileRepository,
  userSession = createAnonymousUserSession(),
}: {
  listCatalogCurrentOfferSummariesBySetIds?: NonNullable<
    ApiV1RouteDependencies['listCatalogCurrentOfferSummariesBySetIds']
  >;
  listCatalogDiscoverySignals?: NonNullable<
    ApiV1RouteDependencies['listCatalogDiscoverySignals']
  >;
  listCatalogSetLiveOffersBySetId?: NonNullable<
    ApiV1RouteDependencies['listCatalogSetLiveOffersBySetId']
  >;
  publicRateLimit?: ApiV1RouteDependencies['publicRateLimit'];
  recentlyViewedSetRepository?: RecentlyViewedSetRepository;
  requestPrincipal?: RequestPrincipal;
  userThemeFavoriteRepository?: UserThemeFavoriteRepository;
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
  const nextRecentlyViewedSetRepository: RecentlyViewedSetRepository =
    recentlyViewedSetRepository ?? {
      listByUserId: vi.fn().mockResolvedValue([]),
      mergeViewedSets: vi.fn().mockResolvedValue([]),
      upsertViewedSet: vi.fn().mockResolvedValue({
        userId: 'user-123',
        setId: '10316',
        viewedAt: '2026-06-03T08:00:00.000Z',
        createdAt: '2026-06-03T08:00:00.000Z',
      }),
    };
  const nextUserThemeFavoriteRepository: UserThemeFavoriteRepository =
    userThemeFavoriteRepository ?? {
      addFavorite: vi.fn().mockResolvedValue({
        isFavorited: true,
        themeId: 'theme-icons',
      }),
      getFavoriteState: vi.fn().mockResolvedValue({
        isFavorited: false,
        themeId: 'theme-icons',
      }),
      listFavoriteThemeIds: vi.fn().mockResolvedValue([]),
      listFavoriteThemes: vi.fn().mockResolvedValue([]),
      removeFavorite: vi.fn().mockResolvedValue({
        isFavorited: false,
        themeId: 'theme-icons',
      }),
    };
  const server = Fastify();

  await server.register(
    createRequestPrincipalPlugin({
      resolveRequestPrincipal,
    }),
  );
  await server.register(
    createApiV1Routes({
      listCatalogCurrentOfferSummariesBySetIds,
      listCatalogDiscoverySignals,
      listCatalogSetLiveOffersBySetId,
      publicRateLimit,
      recentlyViewedSetRepository: nextRecentlyViewedSetRepository,
      userProfileRepository: nextUserProfileRepository,
      userSessionService,
      userSetStatusRepository,
      userThemeFavoriteRepository: nextUserThemeFavoriteRepository,
    }),
  );

  return {
    listCatalogCurrentOfferSummariesBySetIds,
    listCatalogDiscoverySignals,
    server,
    resolveRequestPrincipal,
    listCatalogSetLiveOffersBySetId,
    recentlyViewedSetRepository: nextRecentlyViewedSetRepository,
    userProfileRepository: nextUserProfileRepository,
    userSessionService,
    userSetStatusRepository,
    userThemeFavoriteRepository: nextUserThemeFavoriteRepository,
  };
}

describe('api v1 auth and set-status routes', () => {
  test('creates own-row RLS policies for user theme favorites', () => {
    const migrationSql = readFileSync(
      new URL(
        '../../../../supabase/migrations/20260606190000_user_theme_favorites.sql',
        import.meta.url,
      ),
      'utf-8',
    );

    expect(migrationSql).toContain(
      'alter table public.user_theme_favorites enable row level security;',
    );
    expect(migrationSql).toContain(
      'create policy "user_theme_favorites_select_own"',
    );
    expect(migrationSql).toContain(
      'create policy "user_theme_favorites_insert_own"',
    );
    expect(migrationSql).toContain(
      'create policy "user_theme_favorites_delete_own"',
    );
    expect(migrationSql).toContain('using (auth.uid() = user_id)');
    expect(migrationSql).toContain('with check (auth.uid() = user_id)');
  });

  test('returns public current offer summaries for many sets', async () => {
    const currentOfferSummaries = [
      {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-04-20T10:00:00.000Z',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'bol',
          merchantName: 'bol',
          merchantSlug: 'bol',
          priceCents: 32999,
          setId: '42172',
          url: 'https://www.bol.com/nl/nl/p/technic',
        },
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-04-20T10:00:00.000Z',
            condition: 'new',
            currency: 'EUR',
            market: 'NL',
            merchant: 'bol',
            merchantName: 'bol',
            merchantSlug: 'bol',
            priceCents: 32999,
            setId: '42172',
            url: 'https://www.bol.com/nl/nl/p/technic',
          },
        ],
        setId: '42172',
      },
      {
        offers: [],
        setId: '75398',
      },
    ];
    const { listCatalogCurrentOfferSummariesBySetIds, server } =
      await createApiServer({
        listCatalogCurrentOfferSummariesBySetIds: vi
          .fn()
          .mockResolvedValue(currentOfferSummaries),
      });

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogCurrentOfferSummariesApiPath(['42172', '75398']),
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogCurrentOfferSummariesBySetIds).toHaveBeenCalledWith([
      '42172',
      '75398',
    ]);
    expect(response.json()).toEqual(currentOfferSummaries);

    await server.close();
  });

  test('rejects oversized GET current offer summary batches', async () => {
    const { listCatalogCurrentOfferSummariesBySetIds, server } =
      await createApiServer();
    const setIds = Array.from(
      {
        length: 101,
      },
      (_, index) => String(10_000 + index),
    );

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogCurrentOfferSummariesApiPath(setIds),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      maxSetIds: 100,
    });
    expect(listCatalogCurrentOfferSummariesBySetIds).not.toHaveBeenCalled();

    await server.close();
  });

  test('accepts POST current offer summary batches without query strings', async () => {
    const { listCatalogCurrentOfferSummariesBySetIds, server } =
      await createApiServer({
        listCatalogCurrentOfferSummariesBySetIds: vi.fn().mockResolvedValue([]),
      });

    const response = await server.inject({
      method: 'POST',
      url: buildCatalogCurrentOfferSummariesApiPath(),
      payload: {
        setIds: ['42172', '75398', '42172'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogCurrentOfferSummariesBySetIds).toHaveBeenCalledWith([
      '42172',
      '75398',
    ]);

    await server.close();
  });

  test('rejects oversized POST current offer summary batches before lookup work', async () => {
    const { listCatalogCurrentOfferSummariesBySetIds, server } =
      await createApiServer();
    const setIds = Array.from(
      {
        length: 101,
      },
      (_, index) => String(20_000 + index),
    );

    const response = await server.inject({
      method: 'POST',
      url: buildCatalogCurrentOfferSummariesApiPath(),
      payload: {
        setIds,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      maxSetIds: 100,
      message:
        'Too many setIds for POST current-offer-summaries; chunk requests to 100 setIds or fewer.',
    });
    expect(listCatalogCurrentOfferSummariesBySetIds).not.toHaveBeenCalled();

    await server.close();
  });

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
      url: buildCatalogDiscoverySignalsApiPath(['42172-1', '42172']),
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogDiscoverySignals).toHaveBeenCalledWith(['42172']);
    expect(response.json()).toEqual(discoverySignals);

    await server.close();
  });

  test('rejects oversized GET catalog discovery signal batches', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer();
    const setIds = Array.from(
      {
        length: 101,
      },
      (_, index) => String(30_000 + index),
    );

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogDiscoverySignalsApiPath(setIds),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      maxSetIds: 100,
    });
    expect(listCatalogDiscoverySignals).not.toHaveBeenCalled();

    await server.close();
  });

  test('accepts POST catalog discovery signal batches without query strings', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer({
      listCatalogDiscoverySignals: vi.fn().mockResolvedValue([]),
    });

    const response = await server.inject({
      method: 'POST',
      url: buildCatalogDiscoverySignalsApiPath(),
      payload: {
        setIds: ['42172', '75398', '42172'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(listCatalogDiscoverySignals).toHaveBeenCalledWith([
      '42172',
      '75398',
    ]);

    await server.close();
  });

  test('rejects oversized POST catalog discovery signal batches before lookup work', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer();
    const setIds = Array.from(
      {
        length: 101,
      },
      (_, index) => String(40_000 + index),
    );

    const response = await server.inject({
      method: 'POST',
      url: buildCatalogDiscoverySignalsApiPath(),
      payload: {
        setIds,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      maxSetIds: 100,
      message:
        'Too many setIds for POST discovery-signals; chunk requests to 100 setIds or fewer.',
    });
    expect(listCatalogDiscoverySignals).not.toHaveBeenCalled();

    await server.close();
  });

  test('rejects oversized public catalog JSON bodies', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer();

    const response = await server.inject({
      method: 'POST',
      url: buildCatalogDiscoverySignalsApiPath(),
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        setIds: ['42172'],
        padding: 'x'.repeat(20 * 1024),
      }),
    });

    expect(response.statusCode).toBe(413);
    expect(listCatalogDiscoverySignals).not.toHaveBeenCalled();

    await server.close();
  });

  test('rate limits expensive public catalog lookup endpoints by IP', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer({
      publicRateLimit: {
        maxRequests: 2,
        windowMs: 60_000,
      },
    });

    const firstResponse = await server.inject({
      method: 'GET',
      remoteAddress: '203.0.113.10',
      url: buildCatalogDiscoverySignalsApiPath(['42172']),
    });
    const secondResponse = await server.inject({
      method: 'GET',
      remoteAddress: '203.0.113.10',
      url: buildCatalogDiscoverySignalsApiPath(['75398']),
    });
    const rateLimitedResponse = await server.inject({
      method: 'GET',
      remoteAddress: '203.0.113.10',
      url: buildCatalogDiscoverySignalsApiPath(['21061']),
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(rateLimitedResponse.statusCode).toBe(429);
    expect(rateLimitedResponse.json()).toEqual({
      message: 'Too many public catalog lookup requests. Please retry later.',
    });
    expect(listCatalogDiscoverySignals).toHaveBeenCalledTimes(2);

    await server.close();
  });

  test('rejects unscoped public catalog discovery signal reads', async () => {
    const { listCatalogDiscoverySignals, server } = await createApiServer();

    const response = await server.inject({
      method: 'GET',
      url: buildCatalogDiscoverySignalsApiPath(),
    });

    expect(response.statusCode).toBe(400);
    expect(listCatalogDiscoverySignals).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      message: 'catalog discovery signals require setIds.',
    });

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
    expect(userSessionService.getUserSession).toHaveBeenCalledWith(
      {
        state: 'anonymous',
      },
      expect.objectContaining({
        onTiming: expect.any(Function),
      }),
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
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
      expect.objectContaining({
        onTiming: expect.any(Function),
      }),
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

  test('returns 401 for recently viewed routes when no valid user is present', async () => {
    const { server, recentlyViewedSetRepository } = await createApiServer();

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/recently-viewed-sets/10316',
    });

    expect(response.statusCode).toBe(401);
    expect(recentlyViewedSetRepository.upsertViewedSet).not.toHaveBeenCalled();

    await server.close();
  });

  test('upserts recently viewed sets for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const recentlyViewedSetRepository: RecentlyViewedSetRepository = {
      listByUserId: vi.fn().mockResolvedValue([]),
      mergeViewedSets: vi.fn().mockResolvedValue([]),
      upsertViewedSet: vi.fn().mockResolvedValue({
        userId: 'user-123',
        setId: '42177',
        viewedAt: '2026-06-03T08:00:00.000Z',
        createdAt: '2026-06-03T08:00:00.000Z',
      }),
    };
    const { server } = await createApiServer({
      recentlyViewedSetRepository,
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/recently-viewed-sets/42177-1',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(recentlyViewedSetRepository.upsertViewedSet).toHaveBeenCalledWith({
      userId: 'user-123',
      setId: '42177',
    });
    expect(response.json()).toEqual({
      setId: '42177',
      viewedAt: '2026-06-03T08:00:00.000Z',
    });

    await server.close();
  });

  test('lists recently viewed sets newest first through the repository route', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const recentlyViewedSetRepository: RecentlyViewedSetRepository = {
      listByUserId: vi.fn().mockResolvedValue([
        {
          userId: 'user-123',
          setId: '10316',
          viewedAt: '2026-06-03T08:00:00.000Z',
          createdAt: '2026-06-03T08:00:00.000Z',
        },
        {
          userId: 'user-123',
          setId: '75355',
          viewedAt: '2026-06-02T08:00:00.000Z',
          createdAt: '2026-06-02T08:00:00.000Z',
        },
      ]),
      mergeViewedSets: vi.fn().mockResolvedValue([]),
      upsertViewedSet: vi.fn().mockResolvedValue({
        userId: 'user-123',
        setId: '10316',
        viewedAt: '2026-06-03T08:00:00.000Z',
        createdAt: '2026-06-03T08:00:00.000Z',
      }),
    };
    const { server } = await createApiServer({
      recentlyViewedSetRepository,
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/me/recently-viewed-sets',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(recentlyViewedSetRepository.listByUserId).toHaveBeenCalledWith(
      'user-123',
    );
    expect(response.json()).toEqual({
      setIds: ['10316', '75355'],
    });

    await server.close();
  });

  test('returns 401 for theme favorite mutations when no valid user is present', async () => {
    const { server, userThemeFavoriteRepository } = await createApiServer();

    const response = await server.inject({
      method: 'PUT',
      url: `${apiPaths.themeFavorites}/theme-icons`,
    });

    expect(response.statusCode).toBe(401);
    expect(userThemeFavoriteRepository.addFavorite).not.toHaveBeenCalled();

    await server.close();
  });

  test('lists favorite themes for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const userThemeFavoriteRepository: UserThemeFavoriteRepository = {
      addFavorite: vi.fn(),
      getFavoriteState: vi.fn(),
      listFavoriteThemeIds: vi.fn(),
      listFavoriteThemes: vi.fn().mockResolvedValue([
        {
          favoritedAt: '2026-06-06T18:00:00.000Z',
          themeSnapshot: {
            id: 'theme-icons',
            name: 'Icons',
            slug: 'icons',
            setCount: 38,
            momentum: 'Displaymodellen die gebouwd zijn om te blijven staan.',
            signatureSet: 'Icons',
          },
        },
      ]),
      removeFavorite: vi.fn(),
    };
    const { server } = await createApiServer({
      requestPrincipal,
      userThemeFavoriteRepository,
    });

    const response = await server.inject({
      method: 'GET',
      url: apiPaths.themeFavorites,
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userThemeFavoriteRepository.listFavoriteThemes).toHaveBeenCalledWith(
      'user-123',
    );
    expect(response.json()).toEqual({
      themeIds: ['theme-icons'],
      themes: [
        {
          favoritedAt: '2026-06-06T18:00:00.000Z',
          themeSnapshot: {
            id: 'theme-icons',
            name: 'Icons',
            slug: 'icons',
            setCount: 38,
            momentum: 'Displaymodellen die gebouwd zijn om te blijven staan.',
            signatureSet: 'Icons',
          },
        },
      ],
    });

    await server.close();
  });

  test('adds and removes theme favorites for authenticated users', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const userThemeFavoriteRepository: UserThemeFavoriteRepository = {
      addFavorite: vi.fn().mockResolvedValue({
        isFavorited: true,
        themeId: 'theme-icons',
      }),
      getFavoriteState: vi.fn(),
      listFavoriteThemeIds: vi.fn(),
      listFavoriteThemes: vi.fn(),
      removeFavorite: vi.fn().mockResolvedValue({
        isFavorited: false,
        themeId: 'theme-icons',
      }),
    };
    const { server } = await createApiServer({
      requestPrincipal,
      userThemeFavoriteRepository,
    });

    const addResponse = await server.inject({
      method: 'PUT',
      url: `${apiPaths.themeFavorites}/theme-icons`,
      headers: {
        authorization: 'Bearer valid-token',
      },
    });
    const removeResponse = await server.inject({
      method: 'DELETE',
      url: `${apiPaths.themeFavorites}/theme-icons`,
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(addResponse.statusCode).toBe(200);
    expect(removeResponse.statusCode).toBe(200);
    expect(userThemeFavoriteRepository.addFavorite).toHaveBeenCalledWith({
      themeId: 'theme-icons',
      userId: 'user-123',
    });
    expect(userThemeFavoriteRepository.removeFavorite).toHaveBeenCalledWith({
      themeId: 'theme-icons',
      userId: 'user-123',
    });
    expect(addResponse.json()).toEqual({
      isFavorited: true,
      themeId: 'theme-icons',
    });
    expect(removeResponse.json()).toEqual({
      isFavorited: false,
      themeId: 'theme-icons',
    });

    await server.close();
  });

  test('merges local recently viewed sets into remote history after login', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const recentlyViewedSetRepository: RecentlyViewedSetRepository = {
      listByUserId: vi.fn().mockResolvedValue([]),
      mergeViewedSets: vi.fn().mockResolvedValue([
        {
          userId: 'user-123',
          setId: '10316',
          viewedAt: '2026-06-03T08:00:00.000Z',
          createdAt: '2026-06-03T08:00:00.000Z',
        },
      ]),
      upsertViewedSet: vi.fn().mockResolvedValue({
        userId: 'user-123',
        setId: '10316',
        viewedAt: '2026-06-03T08:00:00.000Z',
        createdAt: '2026-06-03T08:00:00.000Z',
      }),
    };
    const { server } = await createApiServer({
      recentlyViewedSetRepository,
      requestPrincipal,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/me/recently-viewed-sets/merge',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        setIds: ['10316', '10316', '75355-1'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(recentlyViewedSetRepository.mergeViewedSets).toHaveBeenCalledWith({
      userId: 'user-123',
      setIds: ['10316', '10316', '75355-1'],
    });
    expect(response.json()).toEqual({
      setIds: ['10316'],
    });

    await server.close();
  });

  test('normalizes route set ids before owned and wanted persistence', async () => {
    const requestPrincipal: RequestPrincipal = {
      state: 'authenticated',
      userId: 'user-123',
      email: 'alex@example.test',
    };
    const { server, userSetStatusRepository } = await createApiServer({
      requestPrincipal,
    });

    const ownedResponse = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/owned-sets/42177-1',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });
    const wantedResponse = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/wanted-sets/42177-1',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(ownedResponse.statusCode).toBe(200);
    expect(wantedResponse.statusCode).toBe(200);
    expect(userSetStatusRepository.setOwnedState).toHaveBeenCalledWith({
      userId: 'user-123',
      setId: '42177',
      isOwned: true,
    });
    expect(userSetStatusRepository.setWantedState).toHaveBeenCalledWith({
      userId: 'user-123',
      setId: '42177',
      isWanted: true,
    });
    expect(ownedResponse.json()).toEqual({
      setId: '42177',
      isOwned: true,
    });
    expect(wantedResponse.json()).toEqual({
      setId: '42177',
      isWanted: true,
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
