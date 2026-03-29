import Fastify from 'fastify';
import { getMissingServerSupabaseEnvKeys } from '@lego-platform/shared/config';
import { app } from './app/app';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const missingServerSupabaseEnvKeys = getMissingServerSupabaseEnvKeys();

if (missingServerSupabaseEnvKeys.length > 0) {
  throw new Error(
    `apps/api requires Supabase server configuration before startup. Missing: ${missingServerSupabaseEnvKeys.join(', ')}.`,
  );
}

const server = Fastify({
  logger: true,
});

server.register(app);

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    console.log(`[ ready ] http://${host}:${port}`);
  }
});
