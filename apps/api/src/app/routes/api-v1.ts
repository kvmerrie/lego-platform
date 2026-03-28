import { apiPaths } from '@lego-platform/shared/config';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';
import {
  createUserProfileRepository,
  createUserSessionService,
  createUserSetStatusRepository,
  type UserSessionService,
  type UserSetStatusRepository,
} from '@lego-platform/user/data-access-server';
import type { FastifyInstance } from 'fastify';

export interface ApiV1RouteDependencies {
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

export function createApiV1Routes({
  userSessionService = createUserSessionService({
    userProfileRepository: createUserProfileRepository(),
    userSetStatusRepository: createUserSetStatusRepository(),
  }),
  userSetStatusRepository = createUserSetStatusRepository(),
}: ApiV1RouteDependencies = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(apiPaths.session, async function (request) {
      return userSessionService.getUserSession(
        getRequestPrincipal(request.requestPrincipal),
      );
    });

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
