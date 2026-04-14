import type { FastifyInstance } from 'fastify';
import requestPrincipalPlugin from './plugins/request-principal';
import sensiblePlugin from './plugins/sensible';
import adminCommerceRoutes from './routes/admin-commerce';
import apiV1Routes from './routes/api-v1';
import healthRoutes from './routes/health';
import rootRoutes from './routes/root';

export type AppOptions = Record<string, never>;

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  await fastify.register(sensiblePlugin, { ...opts });
  await fastify.register(requestPrincipalPlugin, { ...opts });

  await fastify.register(rootRoutes, { ...opts });
  await fastify.register(healthRoutes, { ...opts });
  await fastify.register(apiV1Routes, { ...opts });
  await fastify.register(adminCommerceRoutes, { ...opts });
}
