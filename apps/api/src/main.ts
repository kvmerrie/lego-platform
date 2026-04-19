import Fastify from 'fastify';
import {
  getMissingServerSupabaseEnvKeys,
  getServerSupabaseEnvIssues,
  getServerSupabaseProjectRef,
  getServerSupabaseUrlSource,
} from '@lego-platform/shared/config';
import { app } from './app/app';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const missingServerSupabaseEnvKeys = getMissingServerSupabaseEnvKeys();
const serverSupabaseEnvIssues = getServerSupabaseEnvIssues();

if (
  missingServerSupabaseEnvKeys.length > 0 ||
  serverSupabaseEnvIssues.length > 0
) {
  const errorParts: string[] = [];

  if (missingServerSupabaseEnvKeys.length > 0) {
    errorParts.push(`Missing: ${missingServerSupabaseEnvKeys.join(', ')}.`);
  }

  if (serverSupabaseEnvIssues.length > 0) {
    errorParts.push(`Issues: ${serverSupabaseEnvIssues.join(' ')}`);
  }

  throw new Error(
    `apps/api requires a consistent Supabase server configuration before startup. ${errorParts.join(' ')}`,
  );
}

const serverSupabaseProjectRef = getServerSupabaseProjectRef();
const serverSupabaseUrlSource = getServerSupabaseUrlSource();

const server = Fastify({
  logger: true,
});

server.register(app);

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    if (serverSupabaseProjectRef && serverSupabaseUrlSource) {
      console.log(
        `[ config ] apps/api Supabase writes -> ${serverSupabaseProjectRef} via ${serverSupabaseUrlSource}`,
      );
    }
    console.log(`[ ready ] http://${host}:${port}`);
  }
});
