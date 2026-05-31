import { syncDealPageSnapshots } from '@lego-platform/api/data-access-server';

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

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const write = hasBooleanFlag({ argv, flag: '--write' });
  const pageSize = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--page-size',
  });

  console.log(
    `[deal-page-snapshot-sync] start mode=${write ? 'write' : 'dry-run'} page_size=${pageSize ?? 40}`,
  );

  const result = await syncDealPageSnapshots({
    dryRun: !write,
    pageSize,
  });

  for (const [sortKey, summary] of Object.entries(result.summaryBySortKey)) {
    console.log(
      `[deal-page-snapshot-sync] sort sort_key=${sortKey} total_count=${summary.totalCount} page_count=${summary.pageCount} items_built=${summary.itemsBuilt} generated_at=${result.generatedAt}`,
    );
  }

  console.log(
    [
      '[deal-page-snapshot-sync] debug',
      `snapshot_rows_read=${result.debugCounters.snapshotRowsRead}`,
      `latest_snapshot_observed_at=${result.debugCounters.latestSnapshotObservedAt ?? 'none'}`,
      `oldest_snapshot_observed_at=${result.debugCounters.oldestSnapshotObservedAt ?? 'none'}`,
      `rows_with_best_offer=${result.debugCounters.rowsWithBestOffer}`,
      `rows_with_in_stock_offer=${result.debugCounters.rowsWithInStockOffer}`,
      `rows_with_offer_count=${result.debugCounters.rowsWithOfferCount}`,
      `rows_with_offers_json=${result.debugCounters.rowsWithOffersJson}`,
      `rows_with_reference_price=${result.debugCounters.rowsWithReferencePrice}`,
      `rows_with_discount=${result.debugCounters.rowsWithDiscount}`,
      `rows_with_pieces=${result.debugCounters.rowsWithPieces}`,
      `rows_under_50=${result.debugCounters.rowsUnder50}`,
      `rows_rejected_by_reason=${JSON.stringify(result.debugCounters.rowsRejectedByReason)}`,
    ].join(' '),
  );

  console.log(
    `[deal-page-snapshot-sync] summary dry_run=${result.dryRun} snapshots_built=${result.snapshots.length} snapshots_upserted=${result.upsertedCount}`,
  );
  console.log(
    `[deal-page-snapshot-sync] end status=${write ? 'upserted' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error: unknown) => {
  console.error('[deal-page-snapshot-sync] failed', error);
  process.exit(1);
});
