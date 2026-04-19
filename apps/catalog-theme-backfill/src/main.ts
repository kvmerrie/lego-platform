import {
  backfillCatalogOverlayThemeIdentity,
  CATALOG_SETS_OVERLAY_TABLE,
} from '@lego-platform/catalog/data-access-server';
import {
  buildCatalogCleanBootstrapPayload,
  writeCatalogCleanBootstrapPayload,
} from '@lego-platform/catalog/data-access-sync';
import {
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

interface CatalogThemeBackfillCheckRow {
  primary_theme_id: string | null;
  set_id: string;
  source_theme_id: string | null;
}

function getMode(argv: readonly string[]): 'check' | 'write' {
  return argv.includes('--write') ? 'write' : 'check';
}

function getExportPath(argv: readonly string[]): string | undefined {
  const exportFlagIndex = argv.findIndex((argument) => argument === '--export');
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith('--export='),
  );

  if (equalsStyleFlag) {
    const exportPath = equalsStyleFlag.slice('--export='.length).trim();

    return exportPath || undefined;
  }

  if (exportFlagIndex < 0) {
    return undefined;
  }

  const exportPath = argv[exportFlagIndex + 1]?.trim();

  return exportPath || undefined;
}

async function listSetsMissingNormalizedThemeIds() {
  const supabaseClient = getServerSupabaseAdminClient();
  const { data, error } = await supabaseClient
    .from(CATALOG_SETS_OVERLAY_TABLE)
    .select('set_id, source_theme_id, primary_theme_id')
    .order('set_id', { ascending: true });

  if (error) {
    throw new Error('Unable to inspect catalog theme backfill state.');
  }

  return ((data as CatalogThemeBackfillCheckRow[] | null) ?? []).filter(
    (row) => !row.source_theme_id || !row.primary_theme_id,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = getMode(argv);
  const exportPath = getExportPath(argv);
  const startedAt = Date.now();

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog theme backfill.',
    );
  }

  if (!hasRebrickableApiConfig()) {
    throw new Error(
      'REBRICKABLE_API_KEY is required for catalog theme backfill.',
    );
  }

  const beforeRows = await listSetsMissingNormalizedThemeIds();

  console.log(
    `[catalog-theme-backfill] start mode=${mode} missing_before=${beforeRows.length}`,
  );

  if (mode === 'check') {
    console.log(
      `[catalog-theme-backfill] end mode=${mode} missing_after=${beforeRows.length} set_ids=${
        beforeRows.map((row) => row.set_id).join(',') || 'none'
      } duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  const result = await backfillCatalogOverlayThemeIdentity();
  const afterRows = await listSetsMissingNormalizedThemeIds();

  if (afterRows.length > 0) {
    throw new Error(
      `Catalog theme backfill completed but ${afterRows.length} set(s) still miss normalized theme ids: ${afterRows
        .map((row) => row.set_id)
        .join(', ')}`,
    );
  }

  if (exportPath) {
    const payload = await buildCatalogCleanBootstrapPayload();
    await writeCatalogCleanBootstrapPayload({
      outputPath: exportPath,
      payload,
    });
  }

  console.log(
    `[catalog-theme-backfill] end mode=${mode} processed=${result.processedCount} updated=${result.updatedCount} skipped=${result.skippedCount} missing_after=${afterRows.length} export_path=${exportPath ?? 'none'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const argv = process.argv.slice(2);

  console.error(
    `[catalog-theme-backfill] failed mode=${getMode(argv)} export_path=${getExportPath(argv) ?? 'none'}`,
  );

  if (error instanceof Error) {
    console.error(`[catalog-theme-backfill] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
