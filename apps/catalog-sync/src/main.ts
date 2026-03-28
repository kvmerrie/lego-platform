import { curatedCatalogSyncSetNumbers, runCatalogSync } from '@lego-platform/catalog/data-access-sync';

async function main() {
  const apiKey = process.env['REBRICKABLE_API_KEY'];
  const baseUrl = process.env['REBRICKABLE_BASE_URL'];

  if (!apiKey) {
    throw new Error(
      'REBRICKABLE_API_KEY is required to run the catalog sync.',
    );
  }

  const artifacts = await runCatalogSync({
    apiKey,
    baseUrl,
    workspaceRoot: process.cwd(),
  });

  console.log(
    `[catalog-sync] wrote ${artifacts.catalogSnapshot.setRecords.length} catalog records for ${curatedCatalogSyncSetNumbers.length} curated set numbers.`,
  );
}

main().catch((error) => {
  console.error('[catalog-sync] failed');
  console.error(error);
  process.exit(1);
});
