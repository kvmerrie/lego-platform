import { runCatalogBulkOnboarding } from '@lego-platform/api/data-access-server';
import {
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

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
  const setIds = parseCsvFlag({
    argv,
    flag: '--set-ids',
  });
  const stateFilePath =
    getFlagValue({
      argv,
      flag: '--state-file',
    }) || undefined;
  const startedAt = Date.now();

  if (setIds.length === 0) {
    throw new Error('Use --set-ids with a comma-separated list of set ids.');
  }

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for bulk onboarding.',
    );
  }

  if (!hasRebrickableApiConfig()) {
    throw new Error('REBRICKABLE_API_KEY is required for bulk onboarding.');
  }

  console.log(
    `[catalog-bulk-onboarding] start set_ids=${setIds.join(',')} state_file=${
      stateFilePath ?? 'tmp/catalog-bulk-onboarding-state.json'
    }`,
  );

  const result = await runCatalogBulkOnboarding({
    options: {
      setIds,
      stateFilePath,
      workspaceRoot: process.cwd(),
    },
  });

  console.log(
    `[catalog-bulk-onboarding] run run_id=${result.run.runId} run_created=${result.runCreated} state_file=${result.stateFilePath} status=${result.run.status}`,
  );

  if (result.run.importStep.summary) {
    console.log(
      `[catalog-bulk-onboarding] import executed=${result.stageExecutions.import.executed} status=${result.run.importStep.status} attempted_set_count=${result.run.importStep.summary.attemptedSetCount} created_count=${result.run.importStep.summary.createdCount} already_present_count=${result.run.importStep.summary.alreadyPresentCount} failed_count=${result.run.importStep.summary.failedCount}`,
    );
  } else {
    console.log(
      `[catalog-bulk-onboarding] import executed=${result.stageExecutions.import.executed} status=${result.run.importStep.status}`,
    );
  }

  if (result.run.generateStep.summary) {
    console.log(
      `[catalog-bulk-onboarding] generate executed=${result.stageExecutions.generate.executed} status=${result.run.generateStep.status} applied_set_ids=${result.run.generateStep.appliedSetIds.join(',') || 'none'} candidate_count=${result.run.generateStep.summary.candidateCount} inserted_count=${result.run.generateStep.summary.insertedCount} updated_count=${result.run.generateStep.summary.updatedCount} skipped_count=${result.run.generateStep.summary.skippedCount}`,
    );
  } else {
    console.log(
      `[catalog-bulk-onboarding] generate executed=${result.stageExecutions.generate.executed} status=${result.run.generateStep.status} applied_set_ids=${result.run.generateStep.appliedSetIds.join(',') || 'none'}`,
    );
  }

  if (result.run.validateStep.summary) {
    console.log(
      `[catalog-bulk-onboarding] validate executed=${result.stageExecutions.validate.executed} status=${result.run.validateStep.status} applied_set_ids=${result.run.validateStep.appliedSetIds.join(',') || 'none'} processed_count=${result.run.validateStep.summary.processedCount} valid_count=${result.run.validateStep.summary.validCount} invalid_count=${result.run.validateStep.summary.invalidCount} stale_count=${result.run.validateStep.summary.staleCount} skipped_count=${result.run.validateStep.summary.skippedCount}`,
    );
  } else {
    console.log(
      `[catalog-bulk-onboarding] validate executed=${result.stageExecutions.validate.executed} status=${result.run.validateStep.status} applied_set_ids=${result.run.validateStep.appliedSetIds.join(',') || 'none'}`,
    );
  }

  if (result.run.syncStep.summary) {
    console.log(
      `[catalog-bulk-onboarding] sync executed=${result.stageExecutions.sync.executed} status=${result.run.syncStep.status} applied_set_ids=${result.run.syncStep.appliedSetIds.join(',') || 'none'} enabled_sets=${result.run.syncStep.summary.enabledSetCount} refresh_success=${result.run.syncStep.summary.refreshSuccessCount} refresh_unavailable=${result.run.syncStep.summary.refreshUnavailableCount} refresh_invalid=${result.run.syncStep.summary.refreshInvalidCount} refresh_stale=${result.run.syncStep.summary.refreshStaleCount}`,
    );
  } else {
    console.log(
      `[catalog-bulk-onboarding] sync executed=${result.stageExecutions.sync.executed} status=${result.run.syncStep.status} applied_set_ids=${result.run.syncStep.appliedSetIds.join(',') || 'none'}`,
    );
  }

  if (result.run.snapshotStep.summary) {
    console.log(
      `[catalog-bulk-onboarding] snapshot executed=${result.stageExecutions.snapshot.executed} status=${result.run.snapshotStep.status} reported_set_count=${result.run.snapshotStep.summary.reportedSetCount} gap_audited_set_count=${result.run.snapshotStep.summary.gapAuditedSetCount} no_primary_seeds_count=${result.run.snapshotStep.summary.noPrimarySeedsCount} no_valid_primary_offers_count=${result.run.snapshotStep.summary.noValidPrimaryOffersCount} partial_primary_coverage_count=${result.run.snapshotStep.summary.partialPrimaryCoverageCount} full_primary_coverage_count=${result.run.snapshotStep.summary.fullPrimaryCoverageCount} recover_now_count=${result.run.snapshotStep.summary.recoverNowCount} verify_first_count=${result.run.snapshotStep.summary.verifyFirstCount} parked_count=${result.run.snapshotStep.summary.parkedCount}`,
    );
  } else {
    console.log(
      `[catalog-bulk-onboarding] snapshot executed=${result.stageExecutions.snapshot.executed} status=${result.run.snapshotStep.status}`,
    );
  }

  for (const setId of result.run.requestedSetIds) {
    const setProgress = result.run.setProgressById[setId];

    if (!setProgress) {
      continue;
    }

    console.log(
      `[catalog-bulk-onboarding] set set_id=${setProgress.setId} source_set_number=${setProgress.sourceSetNumber} processing_state=${setProgress.processingState} import_status=${setProgress.importStatus} catalog_set_id=${setProgress.catalogSetId ?? 'none'} catalog_set_slug=${setProgress.catalogSetSlug ?? 'none'} coverage_status=${setProgress.snapshot?.coverageStatus ?? 'none'} valid_primary_offer_count=${setProgress.snapshot?.validPrimaryOfferCount ?? 'none'} primary_seed_count=${setProgress.snapshot?.primarySeedCount ?? 'none'} missing_valid_primary_offer_merchants=${setProgress.snapshot?.missingValidPrimaryOfferMerchantSlugs.join(',') || 'none'} import_error=${JSON.stringify(setProgress.importError ?? '')}`,
    );
  }

  console.log(
    `[catalog-bulk-onboarding] end status=${result.run.status} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error('[catalog-bulk-onboarding] failed');

  if (error instanceof Error) {
    console.error(`[catalog-bulk-onboarding] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
