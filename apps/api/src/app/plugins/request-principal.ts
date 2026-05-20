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

function nowMs(): number {
  return performance.now();
}

export function createRequestPrincipalPlugin({
  resolveRequestPrincipal = resolveRequestPrincipalFromAuthHeader,
}: RequestPrincipalPluginOptions = {}) {
  return fp(
    async function (fastify: FastifyInstance) {
      fastify.decorateRequest('requestPrincipal', null);
      fastify.decorateRequest('requestPrincipalTiming', undefined);

      fastify.addHook('onRequest', async (request) => {
        const startedAt = nowMs();
        const authorizationHeader = readAuthorizationHeader(
          request.headers.authorization,
        );

        if (!authorizationHeader) {
          request.requestPrincipal = {
            state: 'anonymous',
          };
          request.requestPrincipalTiming = {
            auth_header_present: false,
            parse_cookies_ms: 0,
            supabase_auth_ms: 0,
            total_ms: Math.round(nowMs() - startedAt),
          };
          return;
        }

        const authStartedAt = nowMs();

        try {
          request.requestPrincipal =
            await resolveRequestPrincipal(authorizationHeader);
        } catch {
          request.requestPrincipal = {
            state: 'anonymous',
          };
        } finally {
          request.requestPrincipalTiming = {
            auth_header_present: true,
            parse_cookies_ms: 0,
            supabase_auth_ms: Math.round(nowMs() - authStartedAt),
            total_ms: Math.round(nowMs() - startedAt),
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
