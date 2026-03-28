import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

declare module 'fastify' {
  interface FastifyRequest {
    requestPrincipal: RequestPrincipal | null;
  }
}
