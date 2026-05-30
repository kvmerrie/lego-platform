import { syncCollectionPageSnapshots } from '@lego-platform/api/data-access-server';

function getFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string {
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    return equalsStyleFlag.slice(flag.length + 1).trim();
  }

  const flagIndex = argv.findIndex((argument) => argument === flag);

  return flagIndex >= 0 ? (argv[flagIndex + 1]?.trim() ?? '') : '';
}

function hasBooleanFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function parseOptionalPositiveIntegerFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): number | undefined {
  const rawValue = getFlagValue({ argv, flag });

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Use ${flag} <positive-integer>.`);
  }

  return parsedValue;
}

function parseOptionalCsvFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string[] | undefined {
  const rawValue = getFlagValue({ argv, flag });
  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? values : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const write = hasBooleanFlag({ argv, flag: '--write' });
  const collectionSlugs = parseOptionalCsvFlag({
    argv,
    flag: '--collection-slugs',
  });
  const pageSize = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--page-size',
  });

  console.log(
    `[collection-page-snapshot-sync] start mode=${write ? 'write' : 'dry-run'} collection_slugs=${collectionSlugs?.join(',') ?? 'phase1'} page_size=${pageSize ?? 40}`,
  );

  const result = await syncCollectionPageSnapshots({
    collectionSlugs,
    dryRun: !write,
    pageSize,
  });

  for (const [collectionSlug, summary] of Object.entries(
    result.summaryByCollectionSlug,
  )) {
    console.log(
      `[collection-page-snapshot-sync] collection collection_slug=${collectionSlug} total_count=${summary.totalCount} page_count=${summary.pageCount} items_built=${summary.itemsBuilt} generated_at=${result.generatedAt} missing_price_snapshot_count=${summary.missingPriceSnapshotCount} brickset_metadata_used_count=${summary.bricksetMetadataUsedCount}`,
    );
  }

  console.log(
    `[collection-page-snapshot-sync] summary dry_run=${result.dryRun} snapshots_built=${result.snapshots.length} snapshots_upserted=${result.upsertedCount}`,
  );
  console.log(
    `[collection-page-snapshot-sync] end status=${write ? 'upserted' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error: unknown) => {
  console.error('[collection-page-snapshot-sync] failed', error);
  process.exit(1);
});
