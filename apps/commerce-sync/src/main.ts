import { runCommerceSync } from '@lego-platform/api/data-access-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  }).map(normalizeCatalogSetId);
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

function hasBooleanFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function parseDotenvLine(line: string): [string, string] | undefined {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return undefined;
  }

  const separatorIndex = trimmedLine.indexOf('=');

  if (separatorIndex <= 0) {
    return undefined;
  }

  const key = trimmedLine.slice(0, separatorIndex).trim();
  const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return key ? [key, value] : undefined;
}

function loadLocalEnvFileIfPresent({
  environment = process.env,
  workspaceRoot,
}: {
  environment?: NodeJS.ProcessEnv;
  workspaceRoot: string;
}): void {
  const envPath = join(workspaceRoot, '.env.local');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
    const entry = parseDotenvLine(line);

    if (!entry) {
      continue;
    }

    const [key, value] = entry;

    environment[key] ??= value;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const workspaceRoot = process.cwd();

  loadLocalEnvFileIfPresent({
    workspaceRoot,
  });

  const mode = getSyncMode(argv);
  const requestedMerchantRefresh =
    hasBooleanFlag({
      argv,
      flag: '--refresh-merchants',
    }) ||
    hasBooleanFlag({
      argv,
      flag: '--legacy-scrape',
    });
  const refreshMerchants = mode === 'write' && requestedMerchantRefresh;
  const setIds = parseSetIds(argv);
  const merchantSlugs = parseCsvFlag({
    argv,
    flag: '--merchant-slugs',
  });

  if (requestedMerchantRefresh && merchantSlugs.length === 0) {
    throw new Error(
      'Legacy merchant refresh requires an explicit --merchant-slugs scope.',
    );
  }

  const startedAt = Date.now();
  const scoped = setIds.length > 0 || merchantSlugs.length > 0;

  console.log(
    `[commerce-sync] start mode=${mode} scope=supabase-commerce-aggregate aggregate_mode=${refreshMerchants ? 'legacy-refresh' : 'aggregate-only'} refresh_merchants=${refreshMerchants} scoped=${scoped} set_ids=${setIds.join(',') || 'all'} merchant_scoped=${merchantSlugs.length > 0} merchant_slugs=${merchantSlugs.join(',') || 'all'}`,
  );
  const result = await runCommerceSync({
    merchantSlugs,
    mode,
    refreshMerchants,
    setIds,
    workspaceRoot,
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
      `[commerce-sync] end mode=check status=clean aggregate_mode=${result.refreshMerchants ? 'legacy-refresh' : 'aggregate-only'} refresh_merchants=${result.refreshMerchants} scoped=${result.scoped} set_ids=${result.scopedSetIds.join(',') || 'all'} merchant_scoped=${result.scopedMerchantSlugs.length > 0} merchant_slugs=${result.scopedMerchantSlugs.join(',') || 'all'} enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} refresh_success=${result.refreshSuccessCount} refresh_unavailable=${result.refreshUnavailableCount} refresh_invalid=${result.refreshInvalidCount} refresh_stale=${result.refreshStaleCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[commerce-sync] end mode=write status=${stalePaths.length === 0 ? 'verified' : 'updated'} aggregate_mode=${result.refreshMerchants ? 'legacy-refresh' : 'aggregate-only'} refresh_merchants=${result.refreshMerchants} scoped=${result.scoped} set_ids=${result.scopedSetIds.join(',') || 'all'} merchant_scoped=${result.scopedMerchantSlugs.length > 0} merchant_slugs=${result.scopedMerchantSlugs.join(',') || 'all'} enabled_sets=${result.enabledSetCount} price_panels=${result.pricePanelSnapshotCount} pricing_observations=${result.pricingObservationCount} affiliate_offers=${result.affiliateOfferCount} merchants=${result.merchantCount} history_points=${result.dailyHistoryPointCount} refresh_success=${result.refreshSuccessCount} refresh_unavailable=${result.refreshUnavailableCount} refresh_invalid=${result.refreshInvalidCount} refresh_stale=${result.refreshStaleCount} stale_paths=${stalePaths.length} duration_ms=${Date.now() - startedAt}`,
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
    `[commerce-sync] failed mode=${mode} scope=supabase-commerce-aggregate scoped=${setIds.length > 0 || merchantSlugs.length > 0} set_ids=${setIds.join(',') || 'all'} merchant_scoped=${merchantSlugs.length > 0} merchant_slugs=${merchantSlugs.join(',') || 'all'}`,
  );
  if (error instanceof Error) {
    console.error(`[commerce-sync] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
