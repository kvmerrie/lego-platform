import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import {
  addOwnedSet,
  addWantedSet,
  getPhaseOneUserSession,
  removeOwnedSet,
  removeWantedSet,
} from '../lib/phase-one-user-store';

export default async function (fastify: FastifyInstance) {
  fastify.get(apiPaths.session, async function () {
    return getPhaseOneUserSession();
  });

  fastify.put<{ Params: { setId: string } }>(
    `${apiPaths.ownedSets}/:setId`,
    async function (request) {
      return addOwnedSet(request.params.setId);
    },
  );

  fastify.delete<{ Params: { setId: string } }>(
    `${apiPaths.ownedSets}/:setId`,
    async function (request) {
      return removeOwnedSet(request.params.setId);
    },
  );

  fastify.put<{ Params: { setId: string } }>(
    `${apiPaths.wantedSets}/:setId`,
    async function (request) {
      return addWantedSet(request.params.setId);
    },
  );

  fastify.delete<{ Params: { setId: string } }>(
    `${apiPaths.wantedSets}/:setId`,
    async function (request) {
      return removeWantedSet(request.params.setId);
    },
  );
}
