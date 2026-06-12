import { buildCommerceMerchantPageSnapshots } from '@lego-platform/api/data-access-server';

function hasBooleanFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const write = hasBooleanFlag({ argv, flag: '--write' });
  const skipRevalidate = hasBooleanFlag({ argv, flag: '--skip-revalidate' });

  console.log(
    [
      '[merchant-page-snapshot-sync] start',
      `mode=${write ? 'write' : 'dry-run'}`,
      `revalidate=${write && !skipRevalidate}`,
    ].join(' '),
  );

  const result = await buildCommerceMerchantPageSnapshots({
    dryRun: !write,
    revalidate: !skipRevalidate,
  });

  const merchantWithDealsCount = result.snapshots.filter(
    (snapshot) => snapshot.snapshot.dealCount > 0,
  ).length;
  const bestDealCount = result.snapshots.reduce(
    (total, snapshot) => total + snapshot.snapshot.bestDealCount,
    0,
  );
  const onlyAtMerchantDealCount = result.snapshots.reduce(
    (total, snapshot) => total + snapshot.snapshot.onlyAtMerchantDealCount,
    0,
  );

  console.log(
    [
      '[merchant-page-snapshot-sync] summary',
      `dry_run=${result.dryRun}`,
      `snapshots_built=${result.snapshots.length}`,
      `snapshots_upserted=${result.upsertedCount}`,
      `merchants_with_deals=${merchantWithDealsCount}`,
      `best_deals=${bestDealCount}`,
      `only_at_merchant_deals=${onlyAtMerchantDealCount}`,
      `changed_merchants=${result.changedMerchantSlugs.length}`,
      `phase_timings=${JSON.stringify(result.phaseTimings)}`,
    ].join(' '),
  );

  if (result.revalidation) {
    console.log(
      [
        '[merchant-page-snapshot-sync] revalidation',
        `attempted=${result.revalidation.attempted}`,
        `skipped=${result.revalidation.skipped}`,
        `path_count=${result.revalidation.pathCount}`,
        `tag_count=${result.revalidation.tagCount}`,
      ].join(' '),
    );
  }

  console.log(
    `[merchant-page-snapshot-sync] end status=${write ? 'upserted' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error: unknown) => {
  console.error('[merchant-page-snapshot-sync] failed', error);
  process.exit(1);
});
