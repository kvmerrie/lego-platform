import { runCommerceSync } from '@lego-platform/api/data-access-server';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use either --check or --write, not both.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

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

function parseSetIds(argv: readonly string[]) {
  return parseCsvFlag({
    argv,
    flag: '--set-ids',
  });
}

function parseCsvFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}) {
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = getSyncMode(argv);
  const setIds = parseSetIds(argv);
  const merchantSlugs = parseCsvFlag({
    argv,
    flag: '--merchant-slugs',
  });
  const startedAt = Date.now();
  const scoped = setIds.length > 0 || merchantSlugs.length > 0;

  console.log(
    `[commerce-sync] start mode=${mode} scope=supabase-commerce-refresh scoped=${scoped} set_ids=${setIds.join(',') || 'all'} merchant_scoped=${merchantSlugs.length > 0} merchant_slugs=${merchantSlugs.join(',') || 'all'}`,
  );
  const result = await runCommerceSync({
    merchantSlugs,
    mode,
    setIds,
    workspaceRoot: process.cwd(),
  });
  const stalePaths = [
    ...result.pricingArtifactCheck.stalePaths,
    ...result.affiliateArtifactCheck.stalePaths,
  ];

  if (mode === 'check') {
    if (stalePaths.length > 0) {
      throw new Error(
        `Generated commerce artifacts are stale:\n${stalePaths
          .map((stalePath) => `- ${stalePath}`)
          .join('\n')}`,
      );
    }

    console.log('[commerce-sync] check passed for the Dutch set-detail slice.');
    console.log(
      `[commerce-sync] end mode=check status=clean scoped=${result.scoped} set_ids=${result.scopedSetIds.join(',') || 'all'} merchant_scoped=${result.scopedMerchantSlugs.length > 0} merchant_slugs=${result.scopedMerchantSlugs.join(',') || 'all'} enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} refresh_success=${result.refreshSuccessCount} refresh_unavailable=${result.refreshUnavailableCount} refresh_invalid=${result.refreshInvalidCount} refresh_stale=${result.refreshStaleCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[commerce-sync] end mode=write status=${stalePaths.length === 0 ? 'verified' : 'updated'} scoped=${result.scoped} set_ids=${result.scopedSetIds.join(',') || 'all'} merchant_scoped=${result.scopedMerchantSlugs.length > 0} merchant_slugs=${result.scopedMerchantSlugs.join(',') || 'all'} enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} refresh_success=${result.refreshSuccessCount} refresh_unavailable=${result.refreshUnavailableCount} refresh_invalid=${result.refreshInvalidCount} refresh_stale=${result.refreshStaleCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const argv = process.argv.slice(2);
  const mode = getSyncMode(argv);
  const setIds = parseSetIds(argv);
  const merchantSlugs = parseCsvFlag({
    argv,
    flag: '--merchant-slugs',
  });

  console.error(
    `[commerce-sync] failed mode=${mode} scope=supabase-commerce-refresh scoped=${setIds.length > 0 || merchantSlugs.length > 0} set_ids=${setIds.join(',') || 'all'} merchant_scoped=${merchantSlugs.length > 0} merchant_slugs=${merchantSlugs.join(',') || 'all'}`,
  );
  if (error instanceof Error) {
    console.error(`[commerce-sync] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
