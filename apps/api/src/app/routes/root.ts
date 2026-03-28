import { platformConfig } from '@lego-platform/shared/config';
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async function () {
    return {
      name: platformConfig.productName,
      tagline: platformConfig.tagline,
      integrations: platformConfig.integrations,
      runtimes: platformConfig.runtimes,
    };
  });
}
