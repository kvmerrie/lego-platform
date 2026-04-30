import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { syncTradeTrackerLidlFeed } from '@lego-platform/api/data-access-server';
import {
  getMissingServerSupabaseEnvKeys,
  getMissingTradeTrackerLidlEnvKeys,
  hasServerSupabaseConfig,
  hasTradeTrackerLidlFeedConfig,
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
  const debugSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-samples',
  });
  const debugUnmatchedSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-unmatched-samples',
  });
  const reportUnmatchedPath = parseOptionalStringFlag({
    argv,
    flag: '--report-unmatched-path',
  });

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Lidl feed sync requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasTradeTrackerLidlFeedConfig()) {
    throw new Error(
      `Lidl feed sync requires a TradeTracker Lidl feed URL. Missing: ${getMissingTradeTrackerLidlEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    `[lidl-feed-sync] start source=tradetracker merchant=lidl mode=write debug_samples=${debugSamples ?? 0} debug_unmatched_samples=${debugUnmatchedSamples ?? 0} report_unmatched_path=${JSON.stringify(reportUnmatchedPath ?? '')}`,
  );

  const result = await syncTradeTrackerLidlFeed({
    options: {
      collectUnmatchedDebug:
        Boolean(debugUnmatchedSamples) || Boolean(reportUnmatchedPath),
      debugSamples,
      unmatchedSampleLimit: debugUnmatchedSamples,
    },
  });

  if (result.debugInfo) {
    console.log(
      `[lidl-feed-sync] debug_samples raw_rows=${result.debugInfo.rawRowCount} aggregated_products=${result.debugInfo.aggregatedProductCount} sample_count=${result.debugInfo.sampleCount}`,
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
      `[lidl-feed-sync] debug_unmatched total_rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount} sample_count=${result.unmatchedDebug.sampleRows.length}`,
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
        `[lidl-feed-sync] unmatched_report_written path=${JSON.stringify(reportUnmatchedPath)} rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount}`,
      );
    }
  }

  console.log(
    `[lidl-feed-sync] end status=imported source=tradetracker merchant=${result.merchantSlug} fetched_products=${result.fetchedProductCount} normalized_rows=${result.normalizedRowCount} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} upserted_seeds=${result.upsertedSeedCount} upserted_latest=${result.upsertedLatestCount} skipped_non_lego=${result.skippedNonLegoCount} skipped_invalid_currency=${result.skippedInvalidCurrencyCount} skipped_invalid_price=${result.skippedInvalidPriceCount} skipped_invalid_deeplink=${result.skippedInvalidDeeplinkCount} skipped_missing_set_number=${result.skippedMissingSetNumberCount} skipped_unmatched_set=${result.skippedUnmatchedSetCount} skipped_non_new=${result.skippedNonNewCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error(
    '[lidl-feed-sync] failed source=tradetracker merchant=lidl mode=write',
  );

  if (error instanceof Error) {
    console.error(`[lidl-feed-sync] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
