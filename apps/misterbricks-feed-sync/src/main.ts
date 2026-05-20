import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  logScheduledJobFailure,
  revalidatePublicCatalogPriceChanges,
  resolveAffiliateFeedDiscoveryEnabled,
  syncMisterBricksFeed,
} from '@lego-platform/api/data-access-server';
import {
  getMissingMisterBricksEnvKeys,
  getMissingServerSupabaseEnvKeys,
  hasMisterBricksFeedConfig,
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
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Use ${flag} <positive-integer>.`);
  }

  return parsedValue;
}

function parseOptionalStringFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string | undefined {
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  return rawValue ? rawValue : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const dryRun = hasBooleanFlag({
    argv,
    flag: '--dry-run',
  });
  const debugSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-samples',
  });
  const debugUnmatchedSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-unmatched-samples',
  });
  const maxProducts = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--max-products',
  });
  const reportUnmatchedPath = parseOptionalStringFlag({
    argv,
    flag: '--report-unmatched-path',
  });
  const reportStaleLatestPath = parseOptionalStringFlag({
    argv,
    flag: '--report-stale-latest-path',
  });
  const discoveryEnabled = resolveAffiliateFeedDiscoveryEnabled({
    argv,
  });

  if (!hasServerSupabaseConfig() && !dryRun) {
    throw new Error(
      `MisterBricks feed sync requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasServerSupabaseConfig() && reportStaleLatestPath) {
    throw new Error(
      `MisterBricks stale latest report requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasMisterBricksFeedConfig()) {
    throw new Error(
      `MisterBricks feed sync requires a product feed URL. Missing: ${getMissingMisterBricksEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    `[misterbricks-feed-sync] start source=channable merchant=misterbricks mode=${dryRun ? 'dry-run' : 'write'} discovery_enabled=${discoveryEnabled} debug_samples=${debugSamples ?? 0} debug_unmatched_samples=${debugUnmatchedSamples ?? 0} max_products=${maxProducts ?? 0} report_unmatched_path=${JSON.stringify(reportUnmatchedPath ?? '')} report_stale_latest_path=${JSON.stringify(reportStaleLatestPath ?? '')}`,
  );

  const result = await syncMisterBricksFeed({
    options: {
      collectUnmatchedDebug:
        Boolean(debugUnmatchedSamples) || Boolean(reportUnmatchedPath),
      collectStaleLatestDiagnostics: Boolean(reportStaleLatestPath),
      debugSamples,
      dryRun,
      maxProducts,
      persistDiscoveredSets: discoveryEnabled,
      unmatchedSampleLimit: debugUnmatchedSamples,
    },
  });

  if (result.debugInfo) {
    console.log(
      `[misterbricks-feed-sync] debug_samples fetched_products=${result.debugInfo.fetchedProductCount} lego_candidates=${result.debugInfo.legoCandidateCount} sample_count=${result.debugInfo.sampleCount}`,
    );
    console.log(
      JSON.stringify(
        {
          debugInfo: result.debugInfo,
        },
        null,
        2,
      ),
    );
  }

  if (result.unmatchedDebug) {
    console.log(
      `[misterbricks-feed-sync] debug_unmatched total_rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount} sample_count=${result.unmatchedDebug.sampleRows.length}`,
    );
    console.log(
      JSON.stringify(
        {
          unmatchedDebug: {
            byCategory: result.unmatchedDebug.byCategory,
            sampleRows: result.unmatchedDebug.sampleRows,
            totalUnmatchedRows: result.unmatchedDebug.totalUnmatchedRows,
            uniqueUnmatchedSetCount:
              result.unmatchedDebug.uniqueUnmatchedSetCount,
          },
        },
        null,
        2,
      ),
    );

    if (reportUnmatchedPath) {
      await mkdir(dirname(reportUnmatchedPath), {
        recursive: true,
      });
      await writeFile(
        reportUnmatchedPath,
        JSON.stringify(
          {
            fetchedProductCount: result.fetchedProductCount,
            legoCandidateCount: result.legoCandidateCount,
            merchantName: result.merchantName,
            merchantSlug: result.merchantSlug,
            normalizedRowCount: result.normalizedRowCount,
            unmatchedDebug: result.unmatchedDebug,
          },
          null,
          2,
        ),
      );
      console.log(
        `[misterbricks-feed-sync] unmatched_report_written path=${JSON.stringify(reportUnmatchedPath)} rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount}`,
      );
    }
  }

  if (reportStaleLatestPath) {
    await mkdir(dirname(reportStaleLatestPath), {
      recursive: true,
    });
    await writeFile(
      reportStaleLatestPath,
      JSON.stringify(
        {
          ageBuckets: result.existingStaleSuccessLatestByAgeBucket,
          duplicateSeedCount:
            result.existingStaleSuccessLatestDuplicateSeedCount,
          missingFromFeedCount:
            result.existingStaleSuccessLatestMissingFromFeedCount,
          remainingStaleSuccessLatestCount:
            result.existingStaleSuccessLatestCount,
          rows: result.existingStaleSuccessLatestReportRows ?? [],
          merchantName: result.merchantName,
          merchantSlug: result.merchantSlug,
        },
        null,
        2,
      ),
    );
    console.log(
      `[misterbricks-feed-sync] stale_latest_report_written path=${JSON.stringify(reportStaleLatestPath)} rows=${result.existingStaleSuccessLatestCount} duplicate_seed_count=${result.existingStaleSuccessLatestDuplicateSeedCount ?? 0} missing_from_feed_count=${result.existingStaleSuccessLatestMissingFromFeedCount ?? 0}`,
    );
  }

  if (!dryRun && result.changedSetIds.length > 0) {
    try {
      const revalidationResult = await revalidatePublicCatalogPriceChanges({
        changedSetIds: result.changedSetIds,
        changedSetSlugs: result.changedSetSlugs,
        reason: 'misterbricks_feed_sync',
      });
      console.log(
        `[misterbricks-feed-sync] revalidation attempted=${revalidationResult.attempted} skipped=${revalidationResult.skipped} changed_set_count=${result.changedSetIds.length} revalidated_set_path_count=${result.changedSetSlugs.length} path_count=${revalidationResult.pathCount} tag_count=${revalidationResult.tagCount}`,
      );
    } catch (error) {
      console.warn('[misterbricks-feed-sync] revalidation warning', {
        changed_set_count: result.changedSetIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    `[misterbricks-feed-sync] end status=imported source=channable merchant=${result.merchantSlug} fetched_products=${result.fetchedProductCount} lego_candidates=${result.legoCandidateCount} normalized_rows=${result.normalizedRowCount} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} upserted_seeds=${result.upsertedSeedCount} upserted_latest=${result.upsertedLatestCount} matched_offers_seen=${result.matchedOfferCount} latest_rows_seen=${result.latestRowsSeenCount} changed_latest_offers=${result.changedLatestOfferCount} unchanged_latest_timestamps_refreshed=${result.unchangedLatestTimestampRefreshedCount} unchanged_latest_refresh_skipped=${result.unchangedLatestRefreshSkippedCount} latest_rows_marked_stale=${result.latestRowsMarkedStaleCount} stale_mark_skipped_reason=${result.staleMarkSkippedReason ?? 'none'} remaining_stale_success_latest=${result.existingStaleSuccessLatestCount} remaining_stale_success_by_age_bucket=${JSON.stringify(result.existingStaleSuccessLatestByAgeBucket ?? {})} remaining_stale_success_duplicate_seed_count=${result.existingStaleSuccessLatestDuplicateSeedCount ?? 0} remaining_stale_success_missing_from_feed_count=${result.existingStaleSuccessLatestMissingFromFeedCount ?? 0} remaining_stale_success_sample=${JSON.stringify(result.existingStaleSuccessLatestSample)} changed_sets=${result.changedSetIds.length} skipped_non_lego=${result.skippedNonLegoCount} skipped_invalid_currency=${result.skippedInvalidCurrencyCount} skipped_invalid_price=${result.skippedInvalidPriceCount} skipped_invalid_deeplink=${result.skippedInvalidDeeplinkCount} skipped_missing_set_number=${result.skippedMissingSetNumberCount} skipped_unmatched_set=${result.skippedUnmatchedSetCount} skipped_non_new=${result.skippedNonNewCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const classification = logScheduledJobFailure({
    context: 'source=channable merchant=misterbricks',
    error,
    jobName: 'misterbricks-feed-sync',
  });

  if (!classification.recoverable) {
    process.exit(1);
  }
});
