import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  logScheduledJobFailure,
  resolveAffiliateFeedDiscoveryEnabled,
  syncTradeTrackerCoppenswarenhuisFeed,
} from '@lego-platform/api/data-access-server';
import {
  getMissingServerSupabaseEnvKeys,
  getMissingTradeTrackerCoppenswarenhuisEnvKeys,
  hasServerSupabaseConfig,
  hasTradeTrackerCoppenswarenhuisFeedConfig,
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
  const discoveryEnabled = resolveAffiliateFeedDiscoveryEnabled({
    argv,
  });

  if (!hasServerSupabaseConfig() && !dryRun) {
    throw new Error(
      `Coppenswarenhuis feed sync requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasTradeTrackerCoppenswarenhuisFeedConfig()) {
    throw new Error(
      `Coppenswarenhuis feed sync requires a TradeTracker feed URL. Missing: ${getMissingTradeTrackerCoppenswarenhuisEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    `[coppenswarenhuis-feed-sync] start source=tradetracker merchant=coppenswarenhuis mode=${dryRun ? 'dry-run' : 'write'} discovery_enabled=${discoveryEnabled} debug_samples=${debugSamples ?? 0} debug_unmatched_samples=${debugUnmatchedSamples ?? 0} max_products=${maxProducts ?? 0} report_unmatched_path=${JSON.stringify(reportUnmatchedPath ?? '')}`,
  );

  const result = await syncTradeTrackerCoppenswarenhuisFeed({
    options: {
      collectUnmatchedDebug:
        Boolean(debugUnmatchedSamples) || Boolean(reportUnmatchedPath),
      debugSamples,
      dryRun,
      maxProducts,
      persistDiscoveredSets: discoveryEnabled,
      unmatchedSampleLimit: debugUnmatchedSamples,
    },
  });

  if (result.debugInfo) {
    console.log(
      `[coppenswarenhuis-feed-sync] debug_samples fetched_products=${result.debugInfo.fetchedProductCount} lego_candidates=${result.debugInfo.legoCandidateCount} sample_count=${result.debugInfo.sampleCount}`,
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
      `[coppenswarenhuis-feed-sync] debug_unmatched total_rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount} sample_count=${result.unmatchedDebug.sampleRows.length}`,
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
        `[coppenswarenhuis-feed-sync] unmatched_report_written path=${JSON.stringify(reportUnmatchedPath)} rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount}`,
      );
    }
  }

  console.log(
    `[coppenswarenhuis-feed-sync] end status=imported source=tradetracker merchant=${result.merchantSlug} fetched_products=${result.fetchedProductCount} lego_candidates=${result.legoCandidateCount} normalized_rows=${result.normalizedRowCount} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} upserted_seeds=${result.upsertedSeedCount} upserted_latest=${result.upsertedLatestCount} matched_offers_seen=${result.matchedOfferCount} changed_latest_offers=${result.changedLatestOfferCount} unchanged_latest_timestamps_refreshed=${result.unchangedLatestTimestampRefreshedCount} unchanged_latest_refresh_skipped=${result.unchangedLatestRefreshSkippedCount} changed_sets=${result.changedSetIds.length} availability_raw_counts=${JSON.stringify(result.availabilityRawCounts)} normalized_availability_counts=${JSON.stringify(result.normalizedAvailabilityCounts)} unknown_after_mapping_count=${result.unknownAfterMappingCount} skipped_non_lego=${result.skippedNonLegoCount} skipped_invalid_currency=${result.skippedInvalidCurrencyCount} skipped_invalid_price=${result.skippedInvalidPriceCount} skipped_invalid_deeplink=${result.skippedInvalidDeeplinkCount} skipped_missing_set_number=${result.skippedMissingSetNumberCount} skipped_unmatched_set=${result.skippedUnmatchedSetCount} skipped_non_new=${result.skippedNonNewCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const classification = logScheduledJobFailure({
    context: 'source=tradetracker merchant=coppenswarenhuis',
    error,
    jobName: 'coppenswarenhuis-feed-sync',
  });

  if (!classification.recoverable) {
    process.exit(1);
  }
});
