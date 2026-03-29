import { curatedCatalogSyncSetNumbers, runCatalogSync } from '@lego-platform/catalog/data-access-sync';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use either --check or --write, not both.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function main() {
  const apiKey = process.env['REBRICKABLE_API_KEY'];
  const baseUrl = process.env['REBRICKABLE_BASE_URL'];
  const mode = getSyncMode(process.argv.slice(2));
  const startedAt = Date.now();

  if (!apiKey) {
    throw new Error(
      'REBRICKABLE_API_KEY is required to run the catalog sync.',
    );
  }

  console.log(
    `[catalog-sync] start mode=${mode} curated_set_numbers=${curatedCatalogSyncSetNumbers.length}`,
  );

  const artifacts = await runCatalogSync({
    apiKey,
    baseUrl,
    mode,
    workspaceRoot: process.cwd(),
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
      `[catalog-sync] end mode=check status=clean curated_set_numbers=${curatedCatalogSyncSetNumbers.length} snapshot_records=${artifacts.catalogSnapshot.setRecords.length} homepage_featured=${artifacts.catalogSyncManifest.homepageFeaturedSetIds.length} stale_paths=${artifacts.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[catalog-sync] end mode=write status=${artifacts.artifactCheck.isClean ? 'verified' : 'updated'} curated_set_numbers=${curatedCatalogSyncSetNumbers.length} snapshot_records=${artifacts.catalogSnapshot.setRecords.length} homepage_featured=${artifacts.catalogSyncManifest.homepageFeaturedSetIds.length} stale_paths=${artifacts.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const mode = getSyncMode(process.argv.slice(2));

  console.error(
    `[catalog-sync] failed mode=${mode} curated_set_numbers=${curatedCatalogSyncSetNumbers.length}`,
  );
  if (error instanceof Error) {
    console.error(`[catalog-sync] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
