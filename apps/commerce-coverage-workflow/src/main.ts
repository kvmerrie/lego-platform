import { hasServerSupabaseConfig } from '@lego-platform/shared/config';
import type { CommerceSeedGenerationFilters } from '@lego-platform/commerce/data-access-server';

import { runCommerceCoverageWorkflow } from './lib/commerce-coverage-workflow';

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

function parsePositiveIntegerFlag({
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

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`Use ${flag} with a whole number of 0 or more.`);
  }

  return parsedValue;
}

function parsePrimaryCoverageStatus(argv: readonly string[]) {
  const primaryCoverageStatus =
    getFlagValue({
      argv,
      flag: '--primary-coverage-status',
    }) || 'partial_primary_coverage';

  if (
    ![
      'all',
      'full_primary_coverage',
      'no_primary_seeds',
      'no_valid_primary_offers',
      'partial_primary_coverage',
    ].includes(primaryCoverageStatus)
  ) {
    throw new Error(
      'Use --primary-coverage-status with one of: all, no_primary_seeds, no_valid_primary_offers, partial_primary_coverage, full_primary_coverage.',
    );
  }

  return primaryCoverageStatus as NonNullable<
    CommerceSeedGenerationFilters['primaryCoverageStatus']
  >;
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
  const batchSize = parsePositiveIntegerFlag({
    argv,
    flag: '--batch-size',
  });
  const batchIndex = parsePositiveIntegerFlag({
    argv,
    flag: '--batch-index',
  });

  if (batchSize === 0) {
    throw new Error('Use --batch-size with a positive number.');
  }

  if (batchIndex !== undefined && batchSize === undefined) {
    throw new Error('Use --batch-index together with --batch-size.');
  }

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the commerce coverage workflow.',
    );
  }

  const primaryCoverageStatus = parsePrimaryCoverageStatus(argv);
  const merchantSlugs = parseCsvFlag({
    argv,
    flag: '--merchant-slugs',
  });
  const includeNonActive = argv.includes('--include-non-active');
  const skipSyncWhenNoSeedWork = argv.includes('--skip-sync-when-no-seed-work');
  const forceSync = argv.includes('--force-sync');
  const startedAt = Date.now();

  console.log(
    `[commerce-coverage-workflow] start primary_coverage_status=${primaryCoverageStatus} include_non_active=${includeNonActive} batch_size=${batchSize ?? 'none'} batch_index=${batchIndex ?? 0} merchant_scoped=${merchantSlugs.length > 0} merchant_slugs=${merchantSlugs.join(',') || 'all'} skip_sync_when_no_seed_work=${skipSyncWhenNoSeedWork} force_sync=${forceSync}`,
  );

  const result = await runCommerceCoverageWorkflow({
    options: {
      batchIndex,
      batchSize,
      forceSync,
      includeNonActive,
      merchantSlugs,
      primaryCoverageStatus,
      skipSyncWhenNoSeedWork,
      workspaceRoot: process.cwd(),
    },
  });

  console.log(
    `[commerce-coverage-workflow] initial-report total_set_count=${result.initialReport.totalSetCount} selected_set_count=${result.initialReport.selectedSetCount} no_primary_seeds_count=${result.initialReport.noPrimarySeedsCount} no_valid_primary_offers_count=${result.initialReport.noValidPrimaryOffersCount} partial_primary_coverage_count=${result.initialReport.partialPrimaryCoverageCount} full_primary_coverage_count=${result.initialReport.fullPrimaryCoverageCount}`,
  );
  console.log(
    `[commerce-coverage-workflow] selected_set_ids=${result.selectedSetIds.join(',') || 'none'} merchant_slugs=${merchantSlugs.join(',') || 'all'}`,
  );

  if (result.skipped) {
    console.log(
      `[commerce-coverage-workflow] end status=${result.status} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  console.log(
    `[commerce-coverage-workflow] generate merchant_slugs=${merchantSlugs.join(',') || 'all'} candidate_count=${result.generateSummary?.candidateCount ?? 0} inserted_count=${result.generateSummary?.insertedCount ?? 0} updated_count=${result.generateSummary?.updatedCount ?? 0} skipped_count=${result.generateSummary?.skippedCount ?? 0}`,
  );
  console.log(
    `[commerce-coverage-workflow] validate merchant_slugs=${merchantSlugs.join(',') || 'all'} processed_count=${result.validateSummary?.processedCount ?? 0} valid_count=${result.validateSummary?.validCount ?? 0} invalid_count=${result.validateSummary?.invalidCount ?? 0} stale_count=${result.validateSummary?.staleCount ?? 0} skipped_count=${result.validateSummary?.skippedCount ?? 0}`,
  );
  if (result.noSeedWork) {
    console.log(
      `[commerce-coverage-workflow] no-seed-work status=${result.status} merchant_slugs=${merchantSlugs.join(',') || 'all'} inserted_count=${result.generateSummary?.insertedCount ?? 0} processed_count=${result.validateSummary?.processedCount ?? 0} sync_executed=${result.syncExecuted} message=${JSON.stringify(result.statusMessage)}`,
    );
  }
  if (result.syncExecuted && result.scopedSyncSummary) {
    console.log(
      `[commerce-coverage-workflow] sync scoped=${result.scopedSyncSummary.scoped === true} set_ids=${result.scopedSyncSummary.scopedSetIds.join(',') || 'none'} merchant_scoped=${result.scopedSyncSummary.scopedMerchantSlugs.length > 0} merchant_slugs=${result.scopedSyncSummary.scopedMerchantSlugs.join(',') || 'all'} enabled_sets=${result.scopedSyncSummary.enabledSetCount} price_panels=${result.scopedSyncSummary.pricePanelSnapshotCount} pricing_observations=${result.scopedSyncSummary.pricingObservationCount} affiliate_offers=${result.scopedSyncSummary.affiliateOfferCount} merchants=${result.scopedSyncSummary.merchantCount} history_points=${result.scopedSyncSummary.dailyHistoryPointCount} refresh_success=${result.scopedSyncSummary.refreshSuccessCount} refresh_unavailable=${result.scopedSyncSummary.refreshUnavailableCount} refresh_invalid=${result.scopedSyncSummary.refreshInvalidCount} refresh_stale=${result.scopedSyncSummary.refreshStaleCount}`,
    );
  } else {
    console.log(
      `[commerce-coverage-workflow] sync skipped=true reason=${result.status}`,
    );
  }

  if (result.finalReport) {
    console.log(
      `[commerce-coverage-workflow] final-report selected_set_count=${result.finalReport.selectedSetCount} no_primary_seeds_count=${result.finalReport.noPrimarySeedsCount} no_valid_primary_offers_count=${result.finalReport.noValidPrimaryOffersCount} partial_primary_coverage_count=${result.finalReport.partialPrimaryCoverageCount} full_primary_coverage_count=${result.finalReport.fullPrimaryCoverageCount}`,
    );

    for (const row of result.finalReport.rows) {
      console.log(
        `[commerce-coverage-workflow] coverage set_id=${row.setId} set_name=${JSON.stringify(row.setName)} theme=${JSON.stringify(row.theme)} status=${row.status} primary_seed_count=${row.primarySeedCount}/${row.primaryMerchantTargetCount} valid_primary_offer_count=${row.validPrimaryOfferCount}/${row.primaryMerchantTargetCount} missing_primary_seed_merchants=${row.missingPrimarySeedMerchantSlugs.join(',') || 'none'} missing_valid_primary_offer_merchants=${row.missingValidPrimaryOfferMerchantSlugs.join(',') || 'none'}`,
      );
    }
  }

  console.log(
    `[commerce-coverage-workflow] end status=${result.status} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error('[commerce-coverage-workflow] failed');

  if (error instanceof Error) {
    console.error(`[commerce-coverage-workflow] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
