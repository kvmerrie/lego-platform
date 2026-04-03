import { apiPaths } from '@lego-platform/shared/config';
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
import type { FastifyInstance } from 'fastify';

export interface ApiV1RouteDependencies {
  userProfileRepository?: UserProfileRepository;
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

export function createApiV1Routes({
  userProfileRepository = createUserProfileRepository(),
  userSetStatusRepository = createUserSetStatusRepository(),
  userSessionService = createUserSessionService({
    userProfileRepository,
    userSetStatusRepository,
  }),
}: ApiV1RouteDependencies = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(apiPaths.session, async function (request) {
      return userSessionService.getUserSession(
        getRequestPrincipal(request.requestPrincipal),
      );
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
          setId: request.params.setId,
          isOwned: true,
        });

        return {
          setId: request.params.setId,
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
          setId: request.params.setId,
          isOwned: false,
        });

        return {
          setId: request.params.setId,
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
          setId: request.params.setId,
          isWanted: true,
        });

        return {
          setId: request.params.setId,
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
          setId: request.params.setId,
          isWanted: false,
        });

        return {
          setId: request.params.setId,
          isWanted: false,
        };
      },
    );
  };
}

export default createApiV1Routes();
