import {
  catalogSnapshotScopeSetNumbers,
  runLocalCatalogSyncCheck,
  runCatalogSync,
} from '@lego-platform/catalog/data-access-sync';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';

function getSyncMode(
  argv: readonly string[],
): 'check' | 'local-check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasLocalCheckFlag = argv.includes('--local-check');
  const hasWriteFlag = argv.includes('--write');

  const selectedModeCount = [
    hasCheckFlag,
    hasLocalCheckFlag,
    hasWriteFlag,
  ].filter(Boolean).length;

  if (selectedModeCount > 1) {
    throw new Error('Use exactly one of --check, --local-check, or --write.');
  }

  if (hasLocalCheckFlag) {
    return 'local-check';
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function main() {
  const mode = getSyncMode(process.argv.slice(2));
  const startedAt = Date.now();
  const workspaceRoot = process.cwd();
  const scopedSetCount = catalogSnapshotScopeSetNumbers.length;

  console.log(
    `[catalog-sync] start mode=${mode} scoped_set_numbers=${scopedSetCount}`,
  );

  if (mode === 'local-check') {
    const artifacts = await runLocalCatalogSyncCheck({
      workspaceRoot,
    });

    if (!artifacts.artifactCheck.isClean) {
      throw new Error(
        `Generated catalog artifacts are stale:\n${artifacts.artifactCheck.stalePaths
          .map((artifactPath) => `- ${artifactPath}`)
          .join('\n')}`,
      );
    }

    console.log(
      `[catalog-sync] end mode=${mode} status=clean scoped_set_numbers=${scopedSetCount} snapshot_records=${artifacts.catalogSnapshot.setRecords.length} homepage_featured=${artifacts.catalogSyncManifest.homepageFeaturedSetIds.length} stale_paths=${artifacts.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the live catalog sync.',
    );
  }

  const artifacts = await runCatalogSync({
    mode,
    workspaceRoot,
  });

  if (mode === 'check') {
    if (!artifacts.artifactCheck.isClean) {
      throw new Error(
        `Generated catalog artifacts are stale:\n${artifacts.artifactCheck.stalePaths
          .map((artifactPath) => `- ${artifactPath}`)
          .join('\n')}`,
      );
    }

    console.log(
      `[catalog-sync] end mode=${mode} status=clean scoped_set_numbers=${scopedSetCount} snapshot_records=${artifacts.catalogSnapshot.setRecords.length} homepage_featured=${artifacts.catalogSyncManifest.homepageFeaturedSetIds.length} stale_paths=${artifacts.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[catalog-sync] end mode=write status=${artifacts.artifactCheck.isClean ? 'verified' : 'updated'} scoped_set_numbers=${scopedSetCount} snapshot_records=${artifacts.catalogSnapshot.setRecords.length} homepage_featured=${artifacts.catalogSyncManifest.homepageFeaturedSetIds.length} stale_paths=${artifacts.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const mode = getSyncMode(process.argv.slice(2));

  console.error(
    `[catalog-sync] failed mode=${mode} scoped_set_numbers=${catalogSnapshotScopeSetNumbers.length}`,
  );
  if (error instanceof Error) {
    console.error(`[catalog-sync] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
