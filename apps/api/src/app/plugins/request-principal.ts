import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  resolveRequestPrincipalFromAuthHeader,
  type RequestPrincipal,
} from '@lego-platform/shared/data-access-auth-server';

export interface RequestPrincipalPluginOptions {
  resolveRequestPrincipal?: (
    authorizationHeader?: string,
  ) => Promise<RequestPrincipal>;
}

function readAuthorizationHeader(
  authorizationHeader?: string | string[],
): string | undefined {
  if (Array.isArray(authorizationHeader)) {
    return authorizationHeader[0];
  }

  return authorizationHeader;
}

export function createRequestPrincipalPlugin({
  resolveRequestPrincipal = resolveRequestPrincipalFromAuthHeader,
}: RequestPrincipalPluginOptions = {}) {
  return fp(
    async function (fastify: FastifyInstance) {
      fastify.decorateRequest('requestPrincipal', null);

      fastify.addHook('onRequest', async (request) => {
        try {
          request.requestPrincipal = await resolveRequestPrincipal(
            readAuthorizationHeader(request.headers.authorization),
          );
        } catch {
          request.requestPrincipal = {
            state: 'anonymous',
          };
        }
      });
    },
    {
      name: 'request-principal',
    },
  );
}

export default createRequestPrincipalPlugin();
