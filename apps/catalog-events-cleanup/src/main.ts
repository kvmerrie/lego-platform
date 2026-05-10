import { createClient } from '@supabase/supabase-js';
import {
  getMissingServerSupabaseEnvKeys,
  getServerSupabaseConfig,
} from '@lego-platform/shared/config';
import {
  cleanupCatalogUserEvents,
  DEFAULT_CATALOG_USER_EVENT_RETENTION_DAYS,
} from './lib/catalog-events-cleanup';

function createCatalogEventsCleanupSupabaseClient() {
  const { serviceRoleKey, url } = getServerSupabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function main() {
  const missingServerSupabaseEnvKeys = getMissingServerSupabaseEnvKeys();

  if (missingServerSupabaseEnvKeys.length > 0) {
    throw new Error(
      `Catalog events cleanup requires Supabase server configuration. Missing: ${missingServerSupabaseEnvKeys.join(', ')}.`,
    );
  }

  const startedAt = Date.now();
  const retentionDays = DEFAULT_CATALOG_USER_EVENT_RETENTION_DAYS;

  console.log(`[catalog-events-cleanup] start retention_days=${retentionDays}`);

  const result = await cleanupCatalogUserEvents({
    retentionDays,
    supabaseClient: createCatalogEventsCleanupSupabaseClient(),
  });

  console.log(
    `[catalog-events-cleanup] end retention_days=${result.retentionDays} cutoff=${result.cutoffIso} deleted_rows=${result.deletedRowCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error('[catalog-events-cleanup] failed');

  if (error instanceof Error) {
    console.error(`[catalog-events-cleanup] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
