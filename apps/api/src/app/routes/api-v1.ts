import {
  listCatalogCurrentOfferSummariesBySetIds as listCatalogCurrentOfferSummariesBySetIdsServer,
  listCatalogDiscoverySignals as listCatalogDiscoverySignalsServer,
  listCatalogSetLiveOffersBySetId as listCatalogSetLiveOffersBySetIdServer,
} from '@lego-platform/catalog/data-access-server';
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
} from '@lego-platform/content/data-access';
import {
  apiPaths,
  buildCatalogCurrentOfferSummariesApiPath,
  buildCatalogDiscoverySignalsApiPath,
} from '@lego-platform/shared/config';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';
import {
  CollectorHandleConflictError,
  createUserProfileRepository,
  createUserSessionService,
  createUserSetStatusRepository,
  type UserProfileRepository,
  type UserSessionService,
  type UserSetStatusRepository,
} from '@lego-platform/user/data-access-server';
import {
  type CollectorProfile,
  validateUpdateCollectorProfileInput,
} from '@lego-platform/user/util';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT = 100;
const PUBLIC_CATALOG_POST_BODY_LIMIT_BYTES = 16 * 1024;
const PUBLIC_CATALOG_RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLIC_CATALOG_RATE_LIMIT_MAX_REQUESTS = 120;

export interface ApiV1PublicRateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

export interface ApiV1RouteDependencies {
  listCatalogCurrentOfferSummariesBySetIds?: (
    setIds: readonly string[],
  ) => Promise<
    Awaited<ReturnType<typeof listCatalogCurrentOfferSummariesBySetIdsServer>>
  >;
  listCatalogDiscoverySignals?: (
    setIds: readonly string[],
  ) => Promise<Awaited<ReturnType<typeof listCatalogDiscoverySignalsServer>>>;
  getPublishedArticleBySlug?: (
    slug: string,
  ) => Promise<Awaited<ReturnType<typeof getPublishedArticleBySlug>>>;
  listPublishedArticles?: () => Promise<
    Awaited<ReturnType<typeof listPublishedArticles>>
  >;
  listCatalogSetLiveOffersBySetId?: (
    setId: string,
  ) => Promise<
    Awaited<ReturnType<typeof listCatalogSetLiveOffersBySetIdServer>>
  >;
  userProfileRepository?: UserProfileRepository;
  publicRateLimit?: ApiV1PublicRateLimitOptions;
  userSessionService?: UserSessionService;
  userSetStatusRepository?: UserSetStatusRepository;
}

function createUnauthorizedResponse() {
  return {
    message: 'Authentication required.',
  };
}

function getRequestPrincipal(
  requestPrincipal: RequestPrincipal | null,
): RequestPrincipal {
  return (
    requestPrincipal ?? {
      state: 'anonymous',
    }
  );
}

function toCollectorProfile({
  email,
  userProfileRepositoryRecord,
}: {
  email: string | null;
  userProfileRepositoryRecord: Awaited<
    ReturnType<UserProfileRepository['ensureProfile']>
  >;
}): CollectorProfile {
  return {
    displayName: userProfileRepositoryRecord.displayName,
    collectorHandle: userProfileRepositoryRecord.collectorHandle,
    location: userProfileRepositoryRecord.location,
    collectionFocus: userProfileRepositoryRecord.collectionFocus,
    tier: userProfileRepositoryRecord.tier,
    email,
    wishlistDealAlerts: userProfileRepositoryRecord.wishlistDealAlerts,
  };
}

function isSessionPerfDebugEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env['DEBUG_SESSION_PERF'] === 'true'
  );
}

function nowMs(): number {
  return performance.now();
}

export function createApiV1Routes({
  listCatalogCurrentOfferSummariesBySetIds:
    listCatalogCurrentOfferSummariesBySetIdsDependency = (setIds) =>
      listCatalogCurrentOfferSummariesBySetIdsServer({ setIds }),
  listCatalogDiscoverySignals: listCatalogDiscoverySignalsDependency = (
    setIds,
  ) => listCatalogDiscoverySignalsServer({ setIds }),
  getPublishedArticleBySlug: getPublishedArticleBySlugDependency = (slug) =>
    getPublishedArticleBySlug(slug),
  listPublishedArticles: listPublishedArticlesDependency = () =>
    listPublishedArticles({ limit: 100 }),
  listCatalogSetLiveOffersBySetId: listCatalogSetLiveOffersBySetIdDependency = (
    setId,
  ) => listCatalogSetLiveOffersBySetIdServer({ setId }),
  publicRateLimit,
  userProfileRepository = createUserProfileRepository(),
  userSetStatusRepository = createUserSetStatusRepository(),
  userSessionService = createUserSessionService({
    userProfileRepository,
    userSetStatusRepository,
  }),
}: ApiV1RouteDependencies = {}) {
  const publicLookupRateLimitState = new Map<string, number[]>();
  const publicLookupRateLimitWindowMs =
    publicRateLimit?.windowMs ?? PUBLIC_CATALOG_RATE_LIMIT_WINDOW_MS;
  const publicLookupRateLimitMaxRequests =
    publicRateLimit?.maxRequests ?? PUBLIC_CATALOG_RATE_LIMIT_MAX_REQUESTS;

  function parseCatalogSetIds(value?: string): {
    submittedSetIdCount: number;
    setIds: string[];
  } {
    if (!value) {
      return {
        submittedSetIdCount: 0,
        setIds: [],
      };
    }

    const submittedSetIds = value
      .split(',')
      .map((setId) => normalizeCatalogSetId(setId))
      .filter((setId) => setId.length > 0);

    return {
      submittedSetIdCount: submittedSetIds.length,
      setIds: [...new Set(submittedSetIds)],
    };
  }

  function normalizeRouteSetId(setId: string): string {
    return normalizeCatalogSetId(setId);
  }

  function createSetIdLimitResponse(routeLabel: string) {
    return {
      message: `Too many setIds for ${routeLabel}; chunk requests to ${PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT} setIds or fewer.`,
      maxSetIds: PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT,
    };
  }

  function checkPublicLookupRateLimit(requestIp: string): boolean {
    if (publicLookupRateLimitMaxRequests <= 0) {
      return true;
    }

    const now = Date.now();
    const windowStart = now - publicLookupRateLimitWindowMs;
    const recentRequests = (
      publicLookupRateLimitState.get(requestIp) ?? []
    ).filter((timestamp) => timestamp > windowStart);

    if (recentRequests.length >= publicLookupRateLimitMaxRequests) {
      publicLookupRateLimitState.set(requestIp, recentRequests);

      return false;
    }

    recentRequests.push(now);
    publicLookupRateLimitState.set(requestIp, recentRequests);

    return true;
  }

  async function validatePublicLookupRateLimit(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (checkPublicLookupRateLimit(request.ip)) {
      return;
    }

    reply.status(429).send({
      message: 'Too many public catalog lookup requests. Please retry later.',
    });
  }

  return async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: { setIds?: string } }>(
      buildCatalogDiscoverySignalsApiPath(),
      {
        preHandler: validatePublicLookupRateLimit,
      },
      async function (request, reply) {
        const { setIds, submittedSetIdCount } = parseCatalogSetIds(
          request.query.setIds,
        );

        if (!setIds.length) {
          return reply.status(400).send({
            message: 'catalog discovery signals require setIds.',
          });
        }

        if (submittedSetIdCount > PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT) {
          return reply
            .status(400)
            .send(createSetIdLimitResponse('GET discovery-signals'));
        }

        return listCatalogDiscoverySignalsDependency(setIds);
      },
    );

    fastify.post<{ Body: { setIds?: readonly string[] | string } }>(
      buildCatalogDiscoverySignalsApiPath(),
      {
        bodyLimit: PUBLIC_CATALOG_POST_BODY_LIMIT_BYTES,
        preHandler: validatePublicLookupRateLimit,
      },
      async function (request, reply) {
        const rawBodySetIds = request.body?.setIds;
        const rawSetIds =
          typeof rawBodySetIds === 'string'
            ? rawBodySetIds
            : Array.isArray(rawBodySetIds)
              ? rawBodySetIds.join(',')
              : undefined;
        const { setIds, submittedSetIdCount } = parseCatalogSetIds(rawSetIds);

        if (!setIds.length) {
          return reply.status(400).send({
            message: 'catalog discovery signals require setIds.',
          });
        }

        if (submittedSetIdCount > PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT) {
          return reply
            .status(400)
            .send(createSetIdLimitResponse('POST discovery-signals'));
        }

        return listCatalogDiscoverySignalsDependency(setIds);
      },
    );

    fastify.get(apiPaths.articles, async function () {
      return listPublishedArticlesDependency();
    });

    fastify.get<{ Params: { slug: string } }>(
      `${apiPaths.articles}/:slug`,
      async function (request, reply) {
        const article = await getPublishedArticleBySlugDependency(
          request.params.slug,
        );

        if (!article) {
          return reply.status(404).send({
            message: 'Article not found.',
          });
        }

        return article;
      },
    );

    fastify.get<{ Querystring: { setIds?: string } }>(
      buildCatalogCurrentOfferSummariesApiPath(),
      {
        preHandler: validatePublicLookupRateLimit,
      },
      async function (request, reply) {
        const { setIds, submittedSetIdCount } = parseCatalogSetIds(
          request.query.setIds,
        );

        if (submittedSetIdCount > PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT) {
          return reply
            .status(400)
            .send(createSetIdLimitResponse('GET current-offer-summaries'));
        }

        return listCatalogCurrentOfferSummariesBySetIdsDependency(setIds);
      },
    );

    fastify.post<{ Body: { setIds?: readonly string[] | string } }>(
      buildCatalogCurrentOfferSummariesApiPath(),
      {
        bodyLimit: PUBLIC_CATALOG_POST_BODY_LIMIT_BYTES,
        preHandler: validatePublicLookupRateLimit,
      },
      async function (request, reply) {
        const rawBodySetIds = request.body?.setIds;
        const rawSetIds =
          typeof rawBodySetIds === 'string'
            ? rawBodySetIds
            : Array.isArray(rawBodySetIds)
              ? rawBodySetIds.join(',')
              : undefined;
        const { setIds, submittedSetIdCount } = parseCatalogSetIds(rawSetIds);

        if (!setIds.length) {
          return reply.status(400).send({
            message: 'current offer summaries require setIds.',
          });
        }

        if (submittedSetIdCount > PUBLIC_CATALOG_LOOKUP_SET_ID_LIMIT) {
          return reply
            .status(400)
            .send(createSetIdLimitResponse('POST current-offer-summaries'));
        }

        return listCatalogCurrentOfferSummariesBySetIdsDependency(setIds);
      },
    );

    fastify.get<{ Params: { setId: string } }>(
      `${apiPaths.catalogSets}/:setId/live-offers`,
      {
        preHandler: validatePublicLookupRateLimit,
      },
      async function (request) {
        return listCatalogSetLiveOffersBySetIdDependency(
          normalizeRouteSetId(request.params.setId),
        );
      },
    );

    fastify.get(apiPaths.session, async function (request, reply) {
      const startedAt = nowMs();
      let sessionServiceTiming: {
        profile_lookup_ms?: number;
        response_build_ms: number;
        set_status_lookup_ms?: number;
      } = {
        response_build_ms: 0,
      };
      const session = await userSessionService.getUserSession(
        getRequestPrincipal(request.requestPrincipal),
        {
          onTiming: (timing) => {
            sessionServiceTiming = timing;
          },
        },
      );
      const totalMs = Math.round(nowMs() - startedAt);

      reply.header('cache-control', 'private, no-store');

      if (isSessionPerfDebugEnabled()) {
        console.info('[api-session-perf]', {
          auth_header_present:
            request.requestPrincipalTiming?.auth_header_present ?? false,
          parse_cookies_ms:
            request.requestPrincipalTiming?.parse_cookies_ms ?? 0,
          profile_lookup_ms: sessionServiceTiming.profile_lookup_ms ?? 0,
          response_build_ms: sessionServiceTiming.response_build_ms,
          set_status_lookup_ms: sessionServiceTiming.set_status_lookup_ms ?? 0,
          state: session.state,
          supabase_auth_ms:
            request.requestPrincipalTiming?.supabase_auth_ms ?? 0,
          total_ms: totalMs + (request.requestPrincipalTiming?.total_ms ?? 0),
        });
      }

      return session;
    });

    fastify.get(apiPaths.profile, async function (request, reply) {
      if (request.requestPrincipal?.state !== 'authenticated') {
        return reply.status(401).send(createUnauthorizedResponse());
      }

      const userProfileRepositoryRecord =
        await userProfileRepository.ensureProfile({
          email: request.requestPrincipal.email,
          userId: request.requestPrincipal.userId,
        });

      return toCollectorProfile({
        email: request.requestPrincipal.email,
        userProfileRepositoryRecord,
      });
    });

    fastify.patch<{ Body: unknown }>(
      apiPaths.profile,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        let updateCollectorProfileInput;

        try {
          updateCollectorProfileInput = validateUpdateCollectorProfileInput(
            request.body,
          );
        } catch (error) {
          return reply.status(400).send({
            message:
              error instanceof Error
                ? error.message
                : 'Collector profile input is invalid.',
          });
        }

        await userProfileRepository.ensureProfile({
          email: request.requestPrincipal.email,
          userId: request.requestPrincipal.userId,
        });

        try {
          const updatedUserProfileRecord =
            await userProfileRepository.updateProfile({
              userId: request.requestPrincipal.userId,
              updateCollectorProfileInput,
            });

          return toCollectorProfile({
            email: request.requestPrincipal.email,
            userProfileRepositoryRecord: updatedUserProfileRecord,
          });
        } catch (error) {
          if (error instanceof CollectorHandleConflictError) {
            return reply.status(409).send({
              message: error.message,
            });
          }

          throw error;
        }
      },
    );

    fastify.post(
      apiPaths.wishlistAlertsViewed,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        await userProfileRepository.ensureProfile({
          email: request.requestPrincipal.email,
          userId: request.requestPrincipal.userId,
        });

        const updatedUserProfileRecord =
          await userProfileRepository.markWishlistAlertsViewed({
            userId: request.requestPrincipal.userId,
          });

        return {
          wishlistAlertsLastViewedAt:
            updatedUserProfileRecord.wishlistAlertsLastViewedAt,
        };
      },
    );

    fastify.put<{ Params: { setId: string } }>(
      `${apiPaths.ownedSets}/:setId`,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        await userSetStatusRepository.setOwnedState({
          userId: request.requestPrincipal.userId,
          setId: normalizeRouteSetId(request.params.setId),
          isOwned: true,
        });

        return {
          setId: normalizeRouteSetId(request.params.setId),
          isOwned: true,
        };
      },
    );

    fastify.delete<{ Params: { setId: string } }>(
      `${apiPaths.ownedSets}/:setId`,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        await userSetStatusRepository.setOwnedState({
          userId: request.requestPrincipal.userId,
          setId: normalizeRouteSetId(request.params.setId),
          isOwned: false,
        });

        return {
          setId: normalizeRouteSetId(request.params.setId),
          isOwned: false,
        };
      },
    );

    fastify.put<{ Params: { setId: string } }>(
      `${apiPaths.wantedSets}/:setId`,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        await userSetStatusRepository.setWantedState({
          userId: request.requestPrincipal.userId,
          setId: normalizeRouteSetId(request.params.setId),
          isWanted: true,
        });

        return {
          setId: normalizeRouteSetId(request.params.setId),
          isWanted: true,
        };
      },
    );

    fastify.delete<{ Params: { setId: string } }>(
      `${apiPaths.wantedSets}/:setId`,
      async function (request, reply) {
        if (request.requestPrincipal?.state !== 'authenticated') {
          return reply.status(401).send(createUnauthorizedResponse());
        }

        await userSetStatusRepository.setWantedState({
          userId: request.requestPrincipal.userId,
          setId: normalizeRouteSetId(request.params.setId),
          isWanted: false,
        });

        return {
          setId: normalizeRouteSetId(request.params.setId),
          isWanted: false,
        };
      },
    );
  };
}

export default createApiV1Routes();
