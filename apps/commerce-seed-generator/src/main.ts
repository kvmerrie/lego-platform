import {
  generateCommerceOfferSeedCandidates,
  inspectCommerceGeneratedSeedCandidates,
  listCommercePrimaryCoverageGapAudit,
  listCommercePrimaryCoverageReport,
  validateGeneratedCommerceOfferSeedCandidates,
  type CommerceSeedGenerationFilters,
} from '@lego-platform/commerce/data-access-server';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';

type CommerceSeedGeneratorMode =
  | 'gap-audit'
  | 'generate'
  | 'inspect'
  | 'report'
  | 'validate';

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

function parseCsvFlagValue(value: string): string[] | undefined {
  const parsedValues = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsedValues.length > 0 ? parsedValues : undefined;
}

function parsePositiveIntegerFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): number | undefined {
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

function resolveMode(argv: readonly string[]): CommerceSeedGeneratorMode {
  const requestedGenerate = argv.includes('--generate');
  const requestedGapAudit = argv.includes('--gap-audit');
  const requestedInspect = argv.includes('--inspect');
  const requestedReport = argv.includes('--report');
  const requestedValidate = argv.includes('--validate');

  if (
    [
      requestedGenerate,
      requestedGapAudit,
      requestedInspect,
      requestedReport,
      requestedValidate,
    ].filter(Boolean).length !== 1
  ) {
    throw new Error(
      'Use exactly one of --generate, --gap-audit, --inspect, --report, or --validate.',
    );
  }

  if (requestedGenerate) {
    return 'generate';
  }

  if (requestedGapAudit) {
    return 'gap-audit';
  }

  if (requestedInspect) {
    return 'inspect';
  }

  return requestedReport ? 'report' : 'validate';
}

function buildFilters({
  argv,
  mode,
}: {
  argv: readonly string[];
  mode: CommerceSeedGeneratorMode;
}): CommerceSeedGenerationFilters {
  const parsedLimit = parsePositiveIntegerFlag({
    argv,
    flag: '--limit',
  });
  const parsedBatchSize = parsePositiveIntegerFlag({
    argv,
    flag: '--batch-size',
  });
  const parsedBatchIndex = parsePositiveIntegerFlag({
    argv,
    flag: '--batch-index',
  });

  if (parsedLimit === 0) {
    throw new Error('Use --limit with a positive number.');
  }

  if (parsedBatchSize === 0) {
    throw new Error('Use --batch-size with a positive number.');
  }

  if (parsedBatchIndex !== undefined && parsedBatchSize === undefined) {
    throw new Error('Use --batch-index together with --batch-size.');
  }

  const primaryCoverageStatus =
    getFlagValue({
      argv,
      flag: '--primary-coverage-status',
    }) || undefined;

  if (
    primaryCoverageStatus &&
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

  return {
    batchIndex: parsedBatchIndex,
    batchSize: parsedBatchSize,
    benchmarkOnly: argv.includes('--benchmark-only'),
    includeNonActive: argv.includes('--include-non-active'),
    limit: parsedLimit ? Math.floor(parsedLimit) : undefined,
    merchantSlugs: parseCsvFlagValue(
      getFlagValue({
        argv,
        flag: '--merchant-slugs',
      }),
    ),
    primaryCoverageStatus:
      (primaryCoverageStatus as CommerceSeedGenerationFilters['primaryCoverageStatus']) ??
      (mode === 'gap-audit' ? 'partial_primary_coverage' : 'all'),
    recheckGenerated: argv.includes('--recheck-generated'),
    setIds: parseCsvFlagValue(
      getFlagValue({
        argv,
        flag: '--set-ids',
      }),
    ),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = resolveMode(argv);
  const write = argv.includes('--write');
  const filters = buildFilters({
    argv,
    mode,
  });
  const startedAt = Date.now();

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for commerce seed generation.',
    );
  }

  console.log(
    `[commerce-seed-generator] start mode=${mode} write=${write} set_ids=${
      filters.setIds?.join(',') ?? 'all'
    } merchant_slugs=${filters.merchantSlugs?.join(',') ?? 'all'} benchmark_only=${
      filters.benchmarkOnly === true
    } include_non_active=${filters.includeNonActive === true} primary_coverage_status=${
      filters.primaryCoverageStatus ?? 'all'
    } batch_size=${
      filters.batchSize ?? 'none'
    } batch_index=${filters.batchIndex ?? 0} limit=${filters.limit ?? 'none'} recheck_generated=${filters.recheckGenerated === true}`,
  );

  if (mode === 'generate') {
    const summary = await generateCommerceOfferSeedCandidates({
      filters,
      write,
    });

    console.log(
      `[commerce-seed-generator] end mode=generate write=${write} candidate_count=${summary.candidateCount} inserted_count=${summary.insertedCount} updated_count=${summary.updatedCount} skipped_count=${summary.skippedCount} supported_merchants=${summary.supportedMerchantSlugs.join(',') || 'none'} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  if (mode === 'report') {
    const summary = await listCommercePrimaryCoverageReport({
      filters,
    });

    console.log(
      `[commerce-seed-generator] end mode=report total_set_count=${summary.totalSetCount} selected_set_count=${summary.selectedSetCount} no_primary_seeds_count=${summary.noPrimarySeedsCount} no_valid_primary_offers_count=${summary.noValidPrimaryOffersCount} partial_primary_coverage_count=${summary.partialPrimaryCoverageCount} full_primary_coverage_count=${summary.fullPrimaryCoverageCount} primary_merchants=${summary.primaryMerchantSlugs.join(',') || 'none'} duration_ms=${Date.now() - startedAt}`,
    );
    console.log(
      `[commerce-seed-generator] selected_set_ids=${
        summary.rows.map((row) => row.setId).join(',') || 'none'
      }`,
    );

    for (const row of summary.rows) {
      console.log(
        `[commerce-seed-generator] coverage set_id=${row.setId} set_name=${JSON.stringify(row.setName)} theme=${JSON.stringify(row.theme)} status=${row.status} primary_seed_count=${row.primarySeedCount}/${row.primaryMerchantTargetCount} valid_primary_offer_count=${row.validPrimaryOfferCount}/${row.primaryMerchantTargetCount} missing_primary_seed_merchants=${row.missingPrimarySeedMerchantSlugs.join(',') || 'none'} missing_valid_primary_offer_merchants=${row.missingValidPrimaryOfferMerchantSlugs.join(',') || 'none'}`,
      );
    }

    return;
  }

  if (mode === 'gap-audit') {
    const summary = await listCommercePrimaryCoverageGapAudit({
      filters,
    });

    console.log(
      `[commerce-seed-generator] end mode=gap-audit total_set_count=${summary.totalSetCount} selected_set_count=${summary.selectedSetCount} actionable_partial_set_count=${summary.summary.actionablePartialSetCount} sets_with_full_seed_but_missing_offer_count=${summary.summary.setsWithFullSeedButMissingOfferCount} sets_missing_seed_count=${summary.summary.setsMissingSeedCount} recover_now_count=${summary.summary.recoverNowCount} verify_first_count=${summary.summary.verifyFirstCount} parked_count=${summary.summary.parkedCount} primary_merchants=${summary.primaryMerchantSlugs.join(',') || 'none'} audited_merchants=${summary.auditedMerchantSlugs.join(',') || 'none'} duration_ms=${Date.now() - startedAt}`,
    );
    console.log(
      `[commerce-seed-generator] gap-audit selected_set_ids=${
        summary.rows.map((row) => row.setId).join(',') || 'none'
      }`,
    );
    console.log(
      `[commerce-seed-generator] gap-audit missing_valid_offer_counts_by_merchant=${
        summary.summary.missingValidOfferCountsByMerchant
          .map((row) => `${row.merchantSlug}:${row.missingValidOfferCount}`)
          .join(',') || 'none'
      }`,
    );
    console.log(
      `[commerce-seed-generator] gap-audit gap_counts_by_type=${
        summary.summary.gapCountsByType
          .map((row) => `${row.gapType}:${row.count}`)
          .join(',') || 'none'
      }`,
    );
    console.log(
      `[commerce-seed-generator] gap-audit counts_by_recovery_priority=${
        summary.summary.countsByRecoveryPriority
          .map((row) => `${row.recoveryPriority}:${row.count}`)
          .join(',') || 'none'
      }`,
    );

    for (const row of summary.rows) {
      console.log(
        `[commerce-seed-generator] gap-audit-row set_id=${row.setId} set_name=${JSON.stringify(row.setName)} theme=${JSON.stringify(row.theme)} status=${row.status} primary_seed_count=${row.primarySeedCount}/${row.primaryMerchantTargetCount} valid_primary_offer_count=${row.validPrimaryOfferCount}/${row.primaryMerchantTargetCount} missing_valid_primary_offer_merchants=${row.missingValidPrimaryOfferMerchantSlugs.join(',') || 'none'} audited_missing_valid_primary_offer_merchants=${row.merchantGaps.map((gap) => gap.merchantSlug).join(',') || 'none'}`,
      );

      for (const merchantGap of row.merchantGaps) {
        console.log(
          `[commerce-seed-generator] gap-audit-merchant set_id=${row.setId} merchant_slug=${merchantGap.merchantSlug} gap_type=${merchantGap.gapType} recovery_priority=${merchantGap.recoveryPriority} recovery_reason=${JSON.stringify(merchantGap.recoveryReason)} has_seed=${merchantGap.hasSeed} seed_validation_status=${merchantGap.seedValidationStatus ?? 'none'} seed_is_active=${merchantGap.seedIsActive ?? false} latest_refresh_status=${merchantGap.latestRefreshStatus ?? 'none'} latest_refresh_reason=${JSON.stringify(merchantGap.latestRefreshReason ?? '')}`,
        );
      }
    }

    return;
  }

  if (mode === 'inspect') {
    const results = await inspectCommerceGeneratedSeedCandidates({
      filters,
    });

    console.log(
      `[commerce-seed-generator] end mode=inspect result_count=${results.length} duration_ms=${Date.now() - startedAt}`,
    );

    for (const result of results) {
      console.log(
        `[commerce-seed-generator] inspect set_id=${result.setId} merchant_slug=${result.merchantSlug} decision=${result.decision} seed_url=${JSON.stringify(result.seedUrl)} search_page_status=${result.searchPageStatus} search_page_url=${JSON.stringify(result.searchPageUrl)} search_page_decision=${result.searchPageDecision} search_page_reason=${JSON.stringify(result.searchPageAssessmentReason)} fallback_decision=${result.fallbackDecision ?? 'none'}`,
      );

      for (const [index, candidate] of result.rankedCandidates.entries()) {
        console.log(
          `[commerce-seed-generator] inspect-candidate rank=${index + 1} merchant_slug=${result.merchantSlug} set_id=${result.setId} decision=${candidate.decision} score=${candidate.score} url=${JSON.stringify(candidate.url)} text=${JSON.stringify(candidate.text)} reason=${JSON.stringify(candidate.reason)} page_status=${candidate.pageStatus ?? 0} page_url=${JSON.stringify(candidate.pageUrl ?? '')} page_reason=${JSON.stringify(candidate.pageAssessmentReason ?? '')}`,
        );
      }
    }

    return;
  }

  const summary = await validateGeneratedCommerceOfferSeedCandidates({
    filters,
    write,
  });

  console.log(
    `[commerce-seed-generator] end mode=validate write=${write} processed_count=${summary.processedCount} valid_count=${summary.validCount} invalid_count=${summary.invalidCount} stale_count=${summary.staleCount} skipped_count=${summary.skippedCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const argv = process.argv.slice(2);
  const mode = argv.includes('--validate')
    ? 'validate'
    : argv.includes('--inspect')
      ? 'inspect'
      : argv.includes('--report')
        ? 'report'
        : 'generate';

  console.error(`[commerce-seed-generator] failed mode=${mode}`);

  if (error instanceof Error) {
    console.error(`[commerce-seed-generator] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
