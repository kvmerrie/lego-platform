import {
  buildAffiliateSyncArtifacts,
  checkAffiliateGeneratedArtifacts,
  writeAffiliateGeneratedArtifacts,
} from '@lego-platform/affiliate/data-access-server';
import { listCatalogSetSummariesWithOverlay } from '@lego-platform/catalog/data-access-server';
import type { CatalogSetSummary } from '@lego-platform/catalog/util';
import {
  buildPricingSyncArtifacts,
  checkPricingGeneratedArtifacts,
  type CommerceLatestOfferHistorySummary,
  upsertDailyPriceHistoryPointsFromCommerceLatestOffers,
  writePricingGeneratedArtifacts,
} from '@lego-platform/pricing/data-access-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import {
  loadCommerceSyncInputs,
  refreshCommerceOfferSeeds,
  type CommerceSyncInputs,
} from './commerce-refresh-server';
import { revalidatePublicCatalogPaths } from './public-web-revalidation-server';

export interface CommerceGeneratedArtifactCheckResult {
  isClean: boolean;
  stalePaths: string[];
}

export interface CommerceSyncRunResult {
  affiliateArtifactCheck: CommerceGeneratedArtifactCheckResult;
  affiliateOfferCount: number;
  dailyHistorySummary: CommerceLatestOfferHistorySummary;
  dailyHistoryPointCount: number;
  enabledSetCount: number;
  merchantCount: number;
  mode: 'check' | 'write';
  pricePanelSnapshotCount: number;
  pricingArtifactCheck: CommerceGeneratedArtifactCheckResult;
  pricingObservationCount: number;
  refreshMerchants: boolean;
  refreshInvalidCount: number;
  refreshStaleCount: number;
  refreshSuccessCount: number;
  refreshUnavailableCount: number;
  scoped: boolean;
  scopedMerchantSlugs: readonly string[];
  scopedSetIds: readonly string[];
}

export interface CommerceSyncDependencies {
  checkAffiliateGeneratedArtifactsFn?: typeof checkAffiliateGeneratedArtifacts;
  checkPricingGeneratedArtifactsFn?: typeof checkPricingGeneratedArtifacts;
  listCatalogSetSummariesFn?: typeof listCatalogSetSummariesWithOverlay;
  loadCommerceSyncInputsFn?: typeof loadCommerceSyncInputs;
  revalidatePublicCatalogPathsFn?: typeof revalidatePublicCatalogPaths;
  refreshCommerceOfferSeedsFn?: typeof refreshCommerceOfferSeeds;
  upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn?: typeof upsertDailyPriceHistoryPointsFromCommerceLatestOffers;
  writeAffiliateGeneratedArtifactsFn?: typeof writeAffiliateGeneratedArtifacts;
  writePricingGeneratedArtifactsFn?: typeof writePricingGeneratedArtifacts;
}

function normalizeRequestedSetIds(setIds?: readonly string[]) {
  return [
    ...new Set(
      (setIds ?? [])
        .map((setId) => normalizeCatalogSetId(setId))
        .filter(Boolean),
    ),
  ];
}

function normalizeRequestedMerchantSlugs(merchantSlugs?: readonly string[]) {
  return [
    ...new Set(
      (merchantSlugs ?? [])
        .map((merchantSlug) => merchantSlug.trim())
        .filter(Boolean),
    ),
  ];
}

function createCleanArtifactCheck(): CommerceGeneratedArtifactCheckResult {
  return {
    isClean: true,
    stalePaths: [],
  };
}

function buildCommerceSyncArtifacts({
  now,
  syncInputs,
}: {
  now?: Date;
  syncInputs: CommerceSyncInputs;
}) {
  const pricingArtifacts = buildPricingSyncArtifacts({
    enabledSetIds: syncInputs.enabledSetIds,
    manifestNotes:
      'Generated from Supabase-managed commerce seeds and the latest verified merchant refresh state.',
    manifestSource: 'supabase-commerce-refresh',
    merchantSummaries: syncInputs.merchantSummaries,
    now,
    pricingObservationSeeds: syncInputs.pricingObservationSeeds,
  });
  const affiliateArtifacts = buildAffiliateSyncArtifacts({
    affiliateMerchantConfigs: syncInputs.affiliateMerchantConfigs,
    enabledSetIds: syncInputs.enabledSetIds,
    manifestNotes:
      'Generated from Supabase-managed commerce seeds and the latest verified merchant refresh state.',
    manifestSource: 'supabase-commerce-refresh',
    now,
    offerCandidateInputs: pricingArtifacts.validatedOfferInputs.map(
      (validatedOfferInput) => ({
        setId: validatedOfferInput.setId,
        merchantId: validatedOfferInput.merchantId,
        merchantProductUrl: validatedOfferInput.merchantProductUrl,
        totalPriceMinor: validatedOfferInput.totalPriceMinor,
        availability: validatedOfferInput.availability,
        observedAt: validatedOfferInput.observedAt,
        regionCode: validatedOfferInput.regionCode,
        currencyCode: validatedOfferInput.currencyCode,
        condition: validatedOfferInput.condition,
      }),
    ),
  });

  return {
    affiliateArtifacts,
    pricingArtifacts,
  };
}

function createEmptyDailyHistorySummary(): CommerceLatestOfferHistorySummary {
  return {
    dailyHistoryPointsBuilt: 0,
    eligibleLatestOfferRows: 0,
    latestOfferRowsSeen: 0,
    maxObservedAgeHours: 0,
    skipped: {
      inactiveSeedOrMerchant: 0,
      invalidSeed: 0,
      missingOrInvalidPrice: 0,
      nonEur: 0,
      staleOrError: 0,
      unavailableForHeadline: 0,
    },
  };
}

function formatDailyHistorySummaryLog({
  mode,
  summary,
  upsertedCount,
}: {
  mode: 'check' | 'write';
  summary: CommerceLatestOfferHistorySummary;
  upsertedCount: number;
}): string {
  return [
    '[commerce-sync] daily_history',
    `mode=${mode}`,
    `latest_offer_rows_seen=${summary.latestOfferRowsSeen}`,
    `eligible_latest_offer_rows=${summary.eligibleLatestOfferRows}`,
    `daily_history_points_built=${summary.dailyHistoryPointsBuilt}`,
    `daily_history_points_upserted=${upsertedCount}`,
    `max_observed_age_hours=${summary.maxObservedAgeHours}`,
    `newest_observed_at=${summary.newestObservedAt ?? 'none'}`,
    `skipped_stale_or_error=${summary.skipped.staleOrError}`,
    `skipped_inactive_seed_or_merchant=${summary.skipped.inactiveSeedOrMerchant}`,
    `skipped_invalid_seed=${summary.skipped.invalidSeed}`,
    `skipped_non_eur=${summary.skipped.nonEur}`,
    `skipped_missing_or_invalid_price=${summary.skipped.missingOrInvalidPrice}`,
    `skipped_unavailable_for_headline=${summary.skipped.unavailableForHeadline}`,
    summary.dailyHistoryPointsBuilt === 0
      ? 'zero_points_reason=no_eligible_latest_offers'
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

export async function resolveCommerceCatalogSetSummaries({
  listCatalogSetSummariesFn = listCatalogSetSummariesWithOverlay,
  setIds,
}: {
  listCatalogSetSummariesFn?: typeof listCatalogSetSummariesWithOverlay;
  setIds: readonly string[];
}): Promise<CatalogSetSummary[]> {
  const catalogSetSummaries = await listCatalogSetSummariesFn();
  const catalogSetSummaryById = new Map(
    catalogSetSummaries.map((catalogSetSummary) => [
      catalogSetSummary.id,
      catalogSetSummary,
    ]),
  );
  const uniqueSetIds = [...new Set(setIds.map(normalizeCatalogSetId))];

  return uniqueSetIds.map((setId) => {
    const catalogSetSummary = catalogSetSummaryById.get(setId);

    if (!catalogSetSummary) {
      throw new Error(
        `Commerce-enabled set ${setId} is missing from the current canonical catalog.`,
      );
    }

    return catalogSetSummary;
  });
}

export async function runCommerceSync({
  dependencies = {},
  merchantSlugs,
  mode = 'write',
  now,
  refreshMerchants = false,
  setIds,
  workspaceRoot,
}: {
  dependencies?: CommerceSyncDependencies;
  merchantSlugs?: readonly string[];
  mode?: 'check' | 'write';
  now?: Date;
  refreshMerchants?: boolean;
  setIds?: readonly string[];
  workspaceRoot: string;
}): Promise<CommerceSyncRunResult> {
  const {
    checkAffiliateGeneratedArtifactsFn = checkAffiliateGeneratedArtifacts,
    checkPricingGeneratedArtifactsFn = checkPricingGeneratedArtifacts,
    listCatalogSetSummariesFn = listCatalogSetSummariesWithOverlay,
    loadCommerceSyncInputsFn = loadCommerceSyncInputs,
    revalidatePublicCatalogPathsFn = revalidatePublicCatalogPaths,
    refreshCommerceOfferSeedsFn = refreshCommerceOfferSeeds,
    upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn = upsertDailyPriceHistoryPointsFromCommerceLatestOffers,
    writeAffiliateGeneratedArtifactsFn = writeAffiliateGeneratedArtifacts,
    writePricingGeneratedArtifactsFn = writePricingGeneratedArtifacts,
  } = dependencies;
  const scopedSetIds = normalizeRequestedSetIds(setIds);
  const scopedMerchantSlugs = normalizeRequestedMerchantSlugs(merchantSlugs);
  const requestedMerchantSlugs =
    scopedMerchantSlugs.length > 0 ? scopedMerchantSlugs : undefined;
  const scoped = scopedSetIds.length > 0 || scopedMerchantSlugs.length > 0;
  const shouldRefreshMerchants = mode === 'write' && refreshMerchants;

  if (shouldRefreshMerchants && scopedMerchantSlugs.length === 0) {
    throw new Error(
      'Legacy merchant refresh requires an explicit --merchant-slugs scope. Default commerce-sync is aggregate-only.',
    );
  }

  const initialCommerceSyncInputs = await loadCommerceSyncInputsFn({
    merchantSlugs: requestedMerchantSlugs,
    setIds: scopedSetIds,
  });
  const merchantRefreshSeeds = shouldRefreshMerchants
    ? initialCommerceSyncInputs.refreshSeeds
    : [];
  const refreshSeedSetIds = [
    ...new Set(
      merchantRefreshSeeds.map((refreshSeed) => refreshSeed.offerSeed.setId),
    ),
  ];
  const revalidationSetIds =
    scopedSetIds.length > 0 ? scopedSetIds : refreshSeedSetIds;
  const revalidationCatalogSetSummaries =
    revalidationSetIds.length > 0
      ? await resolveCommerceCatalogSetSummaries({
          listCatalogSetSummariesFn,
          setIds: revalidationSetIds,
        })
      : [];

  await resolveCommerceCatalogSetSummaries({
    listCatalogSetSummariesFn,
    setIds: refreshSeedSetIds,
  });

  console.info(
    `[commerce-sync] aggregate mode=${shouldRefreshMerchants ? 'legacy-refresh' : 'aggregate-only'} refresh_merchants=${shouldRefreshMerchants}`,
  );

  const refreshSummary = shouldRefreshMerchants
    ? await refreshCommerceOfferSeedsFn({
        now,
        refreshSeeds: merchantRefreshSeeds,
      })
    : {
        totalCount: merchantRefreshSeeds.length,
        successCount: 0,
        unavailableCount: 0,
        invalidCount: 0,
        staleCount: 0,
      };

  const refreshedCommerceSyncInputs = await loadCommerceSyncInputsFn({
    merchantSlugs: requestedMerchantSlugs,
    setIds: scopedSetIds,
  });
  const { syncInputs } = refreshedCommerceSyncInputs;
  const { affiliateArtifacts, pricingArtifacts } = buildCommerceSyncArtifacts({
    now,
    syncInputs,
  });

  const pricingArtifactCheck =
    scoped && mode === 'check'
      ? createCleanArtifactCheck()
      : mode === 'check'
        ? await checkPricingGeneratedArtifactsFn({
            pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
            pricingObservations: pricingArtifacts.pricingObservations,
            pricingSyncManifest: pricingArtifacts.pricingSyncManifest,
            workspaceRoot,
          })
        : scoped
          ? createCleanArtifactCheck()
          : await writePricingGeneratedArtifactsFn({
              pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
              pricingObservations: pricingArtifacts.pricingObservations,
              pricingSyncManifest: pricingArtifacts.pricingSyncManifest,
              workspaceRoot,
            });
  const affiliateArtifactCheck =
    scoped && mode === 'check'
      ? createCleanArtifactCheck()
      : mode === 'check'
        ? await checkAffiliateGeneratedArtifactsFn({
            affiliateOfferSnapshots: affiliateArtifacts.affiliateOfferSnapshots,
            affiliateSyncManifest: affiliateArtifacts.affiliateSyncManifest,
            workspaceRoot,
          })
        : scoped
          ? createCleanArtifactCheck()
          : await writeAffiliateGeneratedArtifactsFn({
              affiliateOfferSnapshots:
                affiliateArtifacts.affiliateOfferSnapshots,
              affiliateSyncManifest: affiliateArtifacts.affiliateSyncManifest,
              workspaceRoot,
            });

  const dailyPriceHistoryResult =
    mode === 'write'
      ? await upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn({
          latestOffers:
            'syncSeeds' in refreshedCommerceSyncInputs
              ? refreshedCommerceSyncInputs.syncSeeds
              : [],
          now,
        })
      : {
          points: [],
          summary: createEmptyDailyHistorySummary(),
        };

  console.info(
    formatDailyHistorySummaryLog({
      mode,
      summary: dailyPriceHistoryResult.summary,
      upsertedCount:
        mode === 'write' ? dailyPriceHistoryResult.points.length : 0,
    }),
  );

  if (scoped && mode === 'write') {
    const { syncInputs: fullSyncInputs } = await loadCommerceSyncInputsFn();
    const {
      affiliateArtifacts: fullAffiliateArtifacts,
      pricingArtifacts: fullPricingArtifacts,
    } = buildCommerceSyncArtifacts({
      now,
      syncInputs: fullSyncInputs,
    });

    await writePricingGeneratedArtifactsFn({
      pricePanelSnapshots: fullPricingArtifacts.pricePanelSnapshots,
      pricingObservations: fullPricingArtifacts.pricingObservations,
      pricingSyncManifest: fullPricingArtifacts.pricingSyncManifest,
      workspaceRoot,
    });
    await writeAffiliateGeneratedArtifactsFn({
      affiliateOfferSnapshots: fullAffiliateArtifacts.affiliateOfferSnapshots,
      affiliateSyncManifest: fullAffiliateArtifacts.affiliateSyncManifest,
      workspaceRoot,
    });
  }

  if (mode === 'write' && revalidationCatalogSetSummaries.length > 0) {
    try {
      await revalidatePublicCatalogPathsFn({
        reason: scoped ? 'commerce_sync_scoped' : 'commerce_sync',
        targets: revalidationCatalogSetSummaries.map((catalogSetSummary) => ({
          setId: catalogSetSummary.id,
          slug: catalogSetSummary.slug,
          theme: catalogSetSummary.theme,
        })),
      });
    } catch (error) {
      console.warn(
        error instanceof Error
          ? error.message
          : 'Public web revalidation failed after commerce sync.',
      );
    }
  }

  return {
    affiliateArtifactCheck,
    affiliateOfferCount: affiliateArtifacts.affiliateOfferSnapshots.length,
    dailyHistoryPointCount:
      mode === 'write'
        ? dailyPriceHistoryResult.points.length
        : pricingArtifacts.pricePanelSnapshots.length,
    dailyHistorySummary: dailyPriceHistoryResult.summary,
    enabledSetCount: syncInputs.enabledSetIds.length,
    merchantCount: syncInputs.activeMerchantCount,
    mode,
    pricePanelSnapshotCount: pricingArtifacts.pricePanelSnapshots.length,
    pricingArtifactCheck,
    pricingObservationCount: pricingArtifacts.pricingObservations.length,
    refreshMerchants: shouldRefreshMerchants,
    refreshInvalidCount: refreshSummary.invalidCount,
    refreshStaleCount: refreshSummary.staleCount,
    refreshSuccessCount: refreshSummary.successCount,
    refreshUnavailableCount: refreshSummary.unavailableCount,
    scoped,
    scopedMerchantSlugs,
    scopedSetIds,
  };
}
