import { runCommerceSync } from './lib/commerce-sync';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use either --check or --write, not both.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function main() {
  const mode = getSyncMode(process.argv.slice(2));
  const startedAt = Date.now();

  console.log(`[commerce-sync] start mode=${mode} scope=dutch-curated-set-detail`);
  const result = await runCommerceSync({
    mode,
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
      `[commerce-sync] end mode=check status=clean enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[commerce-sync] end mode=write status=${stalePaths.length === 0 ? 'verified' : 'updated'} enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const mode = getSyncMode(process.argv.slice(2));

  console.error(
    `[commerce-sync] failed mode=${mode} scope=dutch-curated-set-detail`,
  );
  if (error instanceof Error) {
    console.error(`[commerce-sync] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
