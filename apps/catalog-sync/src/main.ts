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

  if (!apiKey) {
    throw new Error(
      'REBRICKABLE_API_KEY is required to run the catalog sync.',
    );
  }

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
      `[catalog-sync] check passed for ${artifacts.catalogSnapshot.setRecords.length} catalog records.`,
    );
    return;
  }

  console.log(
    `[catalog-sync] ${artifacts.artifactCheck.isClean ? 'verified' : 'updated'} ${artifacts.catalogSnapshot.setRecords.length} catalog records for ${curatedCatalogSyncSetNumbers.length} curated set numbers.`,
  );
}

main().catch((error) => {
  console.error('[catalog-sync] failed');
  console.error(error);
  process.exit(1);
});
