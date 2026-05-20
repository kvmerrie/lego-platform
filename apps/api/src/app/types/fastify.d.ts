import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

declare module 'fastify' {
  interface FastifyRequest {
    requestPrincipal: RequestPrincipal | null;
    requestPrincipalTiming?: {
      auth_header_present: boolean;
      parse_cookies_ms: number;
      supabase_auth_ms: number;
      total_ms: number;
    };
  }
}
