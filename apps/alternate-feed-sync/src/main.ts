import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  buildTradeTrackerAlternateOnboardingQueue,
  syncAlternateTradeTrackerFeed,
} from '@lego-platform/api/data-access-server';
import {
  getMissingServerSupabaseEnvKeys,
  getMissingTradeTrackerEnvKeys,
  hasServerSupabaseConfig,
  hasTradeTrackerAffiliateConfig,
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
  const debugLegoSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-lego-samples',
  });
  const debugUnmatchedSamples = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--debug-unmatched-samples',
  });
  const reportUnmatchedPath = parseOptionalStringFlag({
    argv,
    flag: '--report-unmatched-path',
  });
  const onboardingBatchSize =
    parseOptionalPositiveIntegerFlag({
      argv,
      flag: '--onboarding-batch-size',
    }) ?? 25;

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Alternate feed sync requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasTradeTrackerAffiliateConfig()) {
    throw new Error(
      `Alternate feed sync requires TradeTracker credentials. Missing: ${getMissingTradeTrackerEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    `[alternate-feed-sync] start source=tradetracker merchant=alternate mode=write debug_lego_samples=${debugLegoSamples ?? 0} debug_unmatched_samples=${debugUnmatchedSamples ?? 0} onboarding_batch_size=${onboardingBatchSize} report_unmatched_path=${JSON.stringify(reportUnmatchedPath ?? '')}`,
  );

  const result = await syncAlternateTradeTrackerFeed({
    options: {
      collectUnmatchedDebug:
        Boolean(debugUnmatchedSamples) || Boolean(reportUnmatchedPath),
      debugLegoSamples,
      unmatchedSampleLimit: debugUnmatchedSamples,
    },
  });

  if (result.setNumberDebug) {
    console.log(
      `[alternate-feed-sync] debug_set_number lego_products=${result.setNumberDebug.legoProductCount} sample_count=${result.setNumberDebug.sampleCount}`,
    );
    console.log(
      JSON.stringify(
        {
          setNumberDebug: result.setNumberDebug,
        },
        null,
        2,
      ),
    );
  }

  if (result.unmatchedDebug) {
    const onboardingQueue = buildTradeTrackerAlternateOnboardingQueue({
      batchSize: onboardingBatchSize,
      unmatchedSets: result.unmatchedDebug.unmatchedSets,
    });

    console.log(
      `[alternate-feed-sync] debug_unmatched total_rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount} sample_count=${result.unmatchedDebug.sampleRows.length}`,
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
          onboardingQueue: {
            batchSize: onboardingQueue.batchSize,
            topBatch: onboardingQueue.topBatch,
            totalCandidateCount: onboardingQueue.totalCandidateCount,
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
            affiliateSiteId: result.affiliateSiteId,
            affiliateSiteName: result.affiliateSiteName,
            campaignId: result.campaignId,
            campaignName: result.campaignName,
            feedId: result.feedId,
            feedName: result.feedName,
            onboardingQueue,
            unmatchedDebug: result.unmatchedDebug,
          },
          null,
          2,
        ),
      );
      console.log(
        `[alternate-feed-sync] unmatched_report_written path=${JSON.stringify(reportUnmatchedPath)} rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount}`,
      );
    }
  }

  console.log(
    `[alternate-feed-sync] end status=imported source=tradetracker merchant=alternate affiliate_site_id=${result.affiliateSiteId} affiliate_site_name=${JSON.stringify(result.affiliateSiteName)} feed_id=${result.feedId} feed_name=${JSON.stringify(result.feedName)} campaign_id=${result.campaignId} campaign_name=${JSON.stringify(result.campaignName)} selection=${result.selectionStrategy} fetched_products=${result.fetchedProductCount} normalized_rows=${result.normalizedRowCount} pages=${result.pageCount} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} upserted_seeds=${result.upsertedSeedCount} upserted_latest=${result.upsertedLatestCount} skipped_non_lego=${result.skippedNonLegoCount} skipped_invalid_currency=${result.skippedInvalidCurrencyCount} skipped_invalid_price=${result.skippedInvalidPriceCount} skipped_invalid_deeplink=${result.skippedInvalidDeeplinkCount} skipped_missing_set_number=${result.skippedMissingSetNumberCount} skipped_unmatched_set=${result.skippedUnmatchedSetCount} skipped_non_new=${result.skippedNonNewCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error(
    '[alternate-feed-sync] failed source=tradetracker merchant=alternate mode=write',
  );

  if (error instanceof Error) {
    console.error(`[alternate-feed-sync] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
