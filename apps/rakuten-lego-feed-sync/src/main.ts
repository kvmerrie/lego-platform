import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  auditRakutenLegoFeedDiscovery,
  auditRakutenLegoFeed,
  listRakutenLegoFeedFiles,
  logScheduledJobFailure,
  revalidatePublicCatalogPriceChanges,
  syncRakutenLegoFeed,
} from '@lego-platform/api/data-access-server';
import {
  getMissingRakutenLegoEnvKeys,
  getMissingServerSupabaseEnvKeys,
  hasRakutenLegoFeedConfig,
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

function parseOptionalNonNegativeIntegerFlag({
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
    throw new Error(`Use ${flag} <non-negative-integer>.`);
  }

  return parsedValue;
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const dryRun = hasBooleanFlag({
    argv,
    flag: '--dry-run',
  });
  const auditOnly = hasBooleanFlag({
    argv,
    flag: '--audit-only',
  });
  const auditDiscovery = hasBooleanFlag({
    argv,
    flag: '--audit-discovery',
  });
  const listFiles = hasBooleanFlag({
    argv,
    flag: '--list-files',
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
  const titleAuditReportPath = parseOptionalStringFlag({
    argv,
    flag: '--title-audit-report-path',
  });
  const auditReportPath = parseOptionalStringFlag({
    argv,
    flag: '--audit-report-path',
  });
  const auditTemplateFilename = parseOptionalStringFlag({
    argv,
    flag: '--audit-template-filename',
  });
  const auditFeedFilename = parseOptionalStringFlag({
    argv,
    flag: '--audit-feed-filename',
  });
  const auditRedirectSamples = parseOptionalNonNegativeIntegerFlag({
    argv,
    flag: '--audit-redirect-samples',
  });

  if (!hasRakutenLegoFeedConfig()) {
    throw new Error(
      `Rakuten LEGO feed sync requires SFTP credentials. Missing: ${getMissingRakutenLegoEnvKeys().join(', ')}.`,
    );
  }

  if (listFiles) {
    console.log(
      '[rakuten-lego-feed-sync] start source=rakuten merchant=rakuten-lego-eu mode=list-files',
    );
    const listing = await listRakutenLegoFeedFiles();
    const sampleEntries = listing.entries.slice(0, 120).map((entry) => ({
      listPath: entry.listPath,
      filename: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size,
      modifyTime: entry.modifyTime,
    }));

    console.log(
      `[rakuten-lego-feed-sync] sftp_connected pwd=${JSON.stringify(listing.pwd ?? '')} successful_paths=${JSON.stringify(listing.successfulPaths)} failed_paths=${listing.failures.length}`,
    );
    for (const failure of listing.failures) {
      console.warn(
        `[rakuten-lego-feed-sync] list_files_path_failed path=${JSON.stringify(failure.path)} error=${JSON.stringify(failure.message)}`,
      );
    }
    console.log(
      `[rakuten-lego-feed-sync] list_files count=${listing.entries.length} sample_count=${sampleEntries.length}`,
    );
    console.log(
      JSON.stringify(
        {
          files: sampleEntries,
        },
        null,
        2,
      ),
    );
    console.log(
      `[rakuten-lego-feed-sync] end status=list-files duration_ms=${Date.now() - startedAt}`,
    );

    return;
  }

  if (auditDiscovery) {
    console.log(
      `[rakuten-lego-feed-sync] start source=rakuten merchant=rakuten-lego-eu mode=audit-discovery max_products_per_file=${maxProducts ?? 50} redirect_samples=${auditRedirectSamples ?? 3}`,
    );

    const report = await auditRakutenLegoFeedDiscovery({
      options: {
        maxProductsPerFile: maxProducts,
        redirectSampleLimit: auditRedirectSamples,
        templateFilename: auditTemplateFilename,
      },
    });

    console.log(
      `[rakuten-lego-feed-sync] discovery files=${report.files.all.length} relevant_feed_files=${report.files.relevantFeedFiles.length} nl_feed_available=${report.conclusion.likelyNlFeedAvailable}`,
    );
    console.log(
      JSON.stringify(
        {
          report,
        },
        null,
        2,
      ),
    );

    if (auditReportPath) {
      await mkdir(dirname(auditReportPath), {
        recursive: true,
      });
      await writeFile(
        auditReportPath,
        JSON.stringify(
          {
            report,
          },
          null,
          2,
        ),
      );
      console.log(
        `[rakuten-lego-feed-sync] audit_report_written path=${JSON.stringify(auditReportPath)}`,
      );
    }

    console.log(
      `[rakuten-lego-feed-sync] end status=audit-discovery duration_ms=${Date.now() - startedAt}`,
    );

    return;
  }

  if (auditOnly) {
    console.log(
      `[rakuten-lego-feed-sync] start source=rakuten merchant=rakuten-lego-eu mode=audit-only max_products=${maxProducts ?? 500} report_path=${JSON.stringify(auditReportPath ?? '')}`,
    );

    const report = await auditRakutenLegoFeed({
      options: {
        feedFilename: auditFeedFilename,
        maxProducts,
        sampleLimit: debugSamples,
        templateFilename: auditTemplateFilename,
      },
    });

    console.log(
      `[rakuten-lego-feed-sync] audit parsed_products=${report.parsedProductsCount} lego_candidates=${report.setMatching.legoCandidateCount} detected_sets=${report.setMatching.detectedSetNumberCount} matched_catalog=${report.setMatching.matchedCatalogCount} non_sets=${report.setMatching.nonSetProductCount}`,
    );
    console.log(
      JSON.stringify(
        {
          report,
        },
        null,
        2,
      ),
    );

    if (auditReportPath) {
      await mkdir(dirname(auditReportPath), {
        recursive: true,
      });
      await writeFile(
        auditReportPath,
        JSON.stringify(
          {
            report,
          },
          null,
          2,
        ),
      );
      console.log(
        `[rakuten-lego-feed-sync] audit_report_written path=${JSON.stringify(auditReportPath)}`,
      );
    }

    console.log(
      `[rakuten-lego-feed-sync] end status=audit-only duration_ms=${Date.now() - startedAt}`,
    );

    return;
  }

  if (!hasServerSupabaseConfig() && !dryRun) {
    throw new Error(
      `Rakuten LEGO feed sync requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    `[rakuten-lego-feed-sync] start source=rakuten merchant=rakuten-lego-eu mode=${dryRun ? 'dry-run' : 'write'} debug_samples=${debugSamples ?? 0} debug_unmatched_samples=${debugUnmatchedSamples ?? 0} max_products=${maxProducts ?? 0} report_unmatched_path=${JSON.stringify(reportUnmatchedPath ?? '')}`,
  );

  const result = await syncRakutenLegoFeed({
    options: {
      collectUnmatchedDebug:
        Boolean(debugUnmatchedSamples) || Boolean(reportUnmatchedPath),
      debugSamples,
      dryRun,
      maxProducts,
      unmatchedSampleLimit: debugUnmatchedSamples,
    },
  });

  console.log(
    `[rakuten-lego-feed-sync] phase1_summary eligible_rows=${result.phaseOneImportSummary.eligibleImportRowCount} preflight_matched_catalog_sets=${result.phaseOneImportSummary.guard.matchedCatalogSetCount} preflight_match_rate=${result.phaseOneImportSummary.guard.matchRate.toFixed(3)} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} unmatched=${result.skippedUnmatchedSetCount} excluded=${Object.values(result.phaseOneImportSummary.excludedByReason).reduce((sum, count) => sum + count, 0)} excluded_reasons=${JSON.stringify(result.phaseOneImportSummary.excludedByReason)} duplicate_set_numbers=${result.phaseOneImportSummary.duplicateSetNumberCount} locale_counts=${JSON.stringify(result.phaseOneImportSummary.localeCounts)} availability_counts=${JSON.stringify(result.phaseOneImportSummary.availabilityCounts)} guard=${JSON.stringify(result.phaseOneImportSummary.guard)} sample_eligible_set_numbers=${result.phaseOneImportSummary.sampleEligibleSetNumbers.join(',') || 'none'}`,
  );
  console.log(
    `[rakuten-lego-feed-sync] title_audit matched_title_candidates=${result.titleAuditReport.summary.matchedTitleCandidateCount} different=${result.titleAuditReport.summary.differentCount} same_exact=${result.titleAuditReport.summary.exactSameCount} same_after_normalization=${result.titleAuditReport.summary.sameAfterNormalizationCount} same_without_lego_or_set_number=${result.titleAuditReport.summary.sameWithoutLegoOrSetNumberCount} policy=metadata_only_pending_policy`,
  );
  console.log(
    `[rakuten-lego-feed-sync] source_metadata upserted=${result.sourceMetadataUpsertedCount} locale=nl-NL policy=metadata_only_pending_audit`,
  );
  if (result.preflightImportSummary) {
    console.log(
      `[rakuten-lego-feed-sync] preflight passed matched_catalog_sets=${result.preflightImportSummary.matchedCatalogSetCount} match_rate=${result.preflightImportSummary.matchRate.toFixed(3)} unmatched=${result.preflightImportSummary.skippedUnmatchedSetCount}`,
    );
  }

  if (result.debugInfo) {
    console.log(
      `[rakuten-lego-feed-sync] debug_samples fetched_products=${result.debugInfo.fetchedProductCount} lego_candidates=${result.debugInfo.legoCandidateCount} sample_count=${result.debugInfo.sampleCount}`,
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
      `[rakuten-lego-feed-sync] debug_unmatched total_rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount} sample_count=${result.unmatchedDebug.sampleRows.length}`,
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
        `[rakuten-lego-feed-sync] unmatched_report_written path=${JSON.stringify(reportUnmatchedPath)} rows=${result.unmatchedDebug.totalUnmatchedRows} unique_sets=${result.unmatchedDebug.uniqueUnmatchedSetCount}`,
      );
    }
  }

  if (titleAuditReportPath) {
    await mkdir(dirname(titleAuditReportPath), {
      recursive: true,
    });
    await writeFile(
      titleAuditReportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          merchantSlug: result.merchantSlug,
          policy: {
            catalogIdentitySource: 'rebrickable',
            catalogTitleOverwrite: false,
            publicSeoTitleChanges: false,
            publicUse:
              'Do not use LEGO NL titles publicly until a separate title policy is approved.',
            slugChanges: false,
          },
          titleAuditReport: result.titleAuditReport,
        },
        null,
        2,
      ),
    );
    console.log(
      `[rakuten-lego-feed-sync] title_audit_report_written path=${JSON.stringify(titleAuditReportPath)} rows=${result.titleAuditReport.entries.length}`,
    );
  }

  if (!dryRun && result.changedSetIds.length > 0) {
    try {
      const revalidationResult = await revalidatePublicCatalogPriceChanges({
        changedSetIds: result.changedSetIds,
        changedSetSlugs: result.changedSetSlugs,
        reason: 'rakuten_lego_feed_sync',
      });
      console.log(
        `[rakuten-lego-feed-sync] revalidation attempted=${revalidationResult.attempted} skipped=${revalidationResult.skipped} changed_set_count=${result.changedSetIds.length} revalidated_set_path_count=${result.changedSetSlugs.length} path_count=${revalidationResult.pathCount} tag_count=${revalidationResult.tagCount}`,
      );
    } catch (error) {
      console.warn('[rakuten-lego-feed-sync] revalidation warning', {
        changed_set_count: result.changedSetIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    `[rakuten-lego-feed-sync] end status=${dryRun ? 'dry-run' : 'imported'} source=rakuten merchant=${result.merchantSlug} fetched_products=${result.fetchedProductCount} lego_candidates=${result.legoCandidateCount} parse_failures=${result.parseFailureCount} eligible_rows=${result.phaseOneImportSummary.eligibleImportRowCount} normalized_rows=${result.normalizedRowCount} matched_catalog_sets=${result.matchedCatalogSetCount} imported_offers=${result.importedOfferCount} source_metadata_upserted=${result.sourceMetadataUpsertedCount} upserted_seeds=${result.upsertedSeedCount} upserted_latest=${result.upsertedLatestCount} matched_offers_seen=${result.matchedOfferCount} latest_rows_seen=${result.latestRowsSeenCount} changed_latest_offers=${result.changedLatestOfferCount} unchanged_latest_timestamps_refreshed=${result.unchangedLatestTimestampRefreshedCount} unchanged_latest_refresh_skipped=${result.unchangedLatestRefreshSkippedCount} changed_sets=${result.changedSetIds.length} skipped_non_lego=${result.skippedNonLegoCount} skipped_invalid_currency=${result.skippedInvalidCurrencyCount} skipped_invalid_price=${result.skippedInvalidPriceCount} skipped_invalid_deeplink=${result.skippedInvalidDeeplinkCount} skipped_missing_set_number=${result.skippedMissingSetNumberCount} skipped_unmatched_set=${result.skippedUnmatchedSetCount} skipped_non_new=${result.skippedNonNewCount} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const classification = logScheduledJobFailure({
    context: 'source=rakuten merchant=rakuten-lego-eu',
    error,
    jobName: 'rakuten-lego-feed-sync',
  });

  if (!classification.recoverable) {
    process.exit(1);
  }
});
