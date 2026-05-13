import {
  buildAffiliateSyncArtifacts,
  checkAffiliateGeneratedArtifacts,
  writeAffiliateGeneratedArtifacts,
} from '@lego-platform/affiliate/data-access-server';
import { listCatalogSetSummariesWithOverlay } from '@lego-platform/catalog/data-access-server';
import type { CatalogSetSummary } from '@lego-platform/catalog/util';
import {
  buildDailyPriceHistoryPointsFromCommerceLatestOffers,
  buildPricingSyncArtifacts,
  checkPricingGeneratedArtifacts,
  type CommerceLatestOfferHistoryInput,
  type CommerceLatestOfferHistorySummary,
  upsertDailyPriceHistoryPointsFromCommerceLatestOffers,
  writePricingGeneratedArtifacts,
} from '@lego-platform/pricing/data-access-server';
import {
  classifyCommerceCommercialUnitType,
  getCommerceMerchantReliabilityTier,
  isCommerceMerchantProductionFeed,
  supabaseEnvKeys,
} from '@lego-platform/shared/config';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import type { CommerceRefreshSeed } from '@lego-platform/commerce/data-access-server';
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

export interface CommerceCheckInputGuardContext {
  environment?: Record<string, string | undefined>;
  latestRowsLoaded: number;
  seedRowsLoaded: number;
  source: 'injected' | 'supabase';
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

function hasRequiredCommerceCheckSupabaseEnv(
  environment: Record<string, string | undefined>,
): boolean {
  return Boolean(
    environment[supabaseEnvKeys.serverUrl]?.trim() &&
      environment[supabaseEnvKeys.serverServiceRoleKey]?.trim(),
  );
}

export function assertCommerceCheckInputSourceReady({
  environment = process.env,
  latestRowsLoaded,
  seedRowsLoaded,
  source,
}: CommerceCheckInputGuardContext): void {
  if (
    source === 'supabase' &&
    !hasRequiredCommerceCheckSupabaseEnv(environment)
  ) {
    throw new Error(
      `Missing Supabase env for commerce check: ${supabaseEnvKeys.serverUrl}, ${supabaseEnvKeys.serverServiceRoleKey}`,
    );
  }

  if (seedRowsLoaded === 0 && latestRowsLoaded === 0) {
    throw new Error(
      `Commerce check loaded 0 seeds/latest rows; refusing to compare empty artifacts. source=${source} has_${supabaseEnvKeys.serverUrl.toLowerCase()}=${Boolean(
        environment[supabaseEnvKeys.serverUrl]?.trim(),
      )} has_${supabaseEnvKeys.serverServiceRoleKey.toLowerCase()}=${Boolean(
        environment[supabaseEnvKeys.serverServiceRoleKey]?.trim(),
      )}`,
    );
  }
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

function shouldFailCommerceSyncOnRevalidationFailure(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const deploymentEnvironment = (
    environment['BRICKHUNT_DEPLOY_ENV'] ??
    environment['VERCEL_ENV'] ??
    environment['NODE_ENV']
  )
    ?.trim()
    .toLowerCase();

  return (
    deploymentEnvironment === 'production' || deploymentEnvironment === 'prod'
  );
}

function handleCommerceSyncRevalidationFailure({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}): void {
  if (shouldFailCommerceSyncOnRevalidationFailure()) {
    throw error;
  }

  console.warn(error instanceof Error ? error.message : fallbackMessage);
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

function buildDailyHistoryInputsFromCommerceSyncSeeds(
  syncSeeds: readonly CommerceRefreshSeed[],
): CommerceLatestOfferHistoryInput[] {
  return syncSeeds.map((syncSeed) => ({
    latestOffer: syncSeed.offerSeed.latestOffer
      ? {
          availability: syncSeed.offerSeed.latestOffer.availability,
          currencyCode: syncSeed.offerSeed.latestOffer.currencyCode,
          fetchedAt: syncSeed.offerSeed.latestOffer.fetchedAt,
          fetchStatus: syncSeed.offerSeed.latestOffer.fetchStatus,
          observedAt: syncSeed.offerSeed.latestOffer.observedAt,
          priceMinor: syncSeed.offerSeed.latestOffer.priceMinor,
        }
      : undefined,
    merchant: {
      isActive: syncSeed.merchant.isActive,
      reliabilityTier: getCommerceMerchantReliabilityTier(
        syncSeed.merchant.slug,
      ),
      slug: syncSeed.merchant.slug,
      trustedForHistory: isCommerceMerchantProductionFeed(
        syncSeed.merchant.slug,
      ),
    },
    offerSeed: {
      commercialUnitType: classifyCommerceCommercialUnitType({
        notes: syncSeed.offerSeed.notes,
        productUrl: syncSeed.offerSeed.productUrl,
        setId: syncSeed.offerSeed.setId,
      }),
      isActive: syncSeed.offerSeed.isActive,
      notes: syncSeed.offerSeed.notes,
      productUrl: syncSeed.offerSeed.productUrl,
      setId: syncSeed.offerSeed.setId,
      validationStatus: syncSeed.offerSeed.validationStatus,
    },
  }));
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
    `seed_rows_loaded=${summary.seedRowsLoaded ?? summary.latestOfferRowsSeen}`,
    `latest_rows_loaded=${summary.latestOfferRowsSeen}`,
    `joined_rows=${summary.latestOfferRowsSeen}`,
    `missing_latest_count=${summary.missingLatestCount ?? summary.skipped.missingLatest ?? 0}`,
    `unit_type_counts=${JSON.stringify(summary.unitTypeCounts ?? {})}`,
    `trusted_offer_count=${summary.trustedOfferCount ?? 0}`,
    `strategic_manual_offer_count=${summary.strategicManualOfferCount ?? 0}`,
    `eligible_latest_offer_rows=${summary.eligibleLatestOfferRows}`,
    `daily_history_points_built=${summary.dailyHistoryPointsBuilt}`,
    `excluded_unit_mismatch_count=${summary.excludedUnitMismatchCount ?? 0}`,
    `history_points_from_trusted=${summary.historyPointsFromTrusted ?? summary.dailyHistoryPointsBuilt}`,
    `ignored_for_confidence_count=${summary.ignoredForConfidenceCount ?? 0}`,
    `daily_history_points_upserted=${upsertedCount}`,
    `max_observed_age_hours=${summary.maxObservedAgeHours}`,
    `oldest_observed_at=${summary.oldestObservedAt ?? 'none'}`,
    `newest_observed_at=${summary.newestObservedAt ?? 'none'}`,
    `fetch_status_counts=${JSON.stringify(summary.fetchStatusCounts ?? {})}`,
    `validation_status_counts=${JSON.stringify(summary.validationStatusCounts ?? {})}`,
    `availability_counts=${JSON.stringify(summary.availabilityCounts ?? {})}`,
    `merchant_slug_counts=${JSON.stringify(summary.merchantSlugCounts ?? {})}`,
    `skipped_stale_or_error=${summary.skipped.staleOrError}`,
    `stale_or_error_samples=${JSON.stringify(summary.staleOrErrorSamples ?? [])}`,
    `skipped_unit_mismatch=${summary.skipped.unitMismatch ?? 0}`,
    `skipped_untrusted_merchant=${summary.skipped.untrustedMerchant ?? 0}`,
    `skipped_inactive_seed_or_merchant=${summary.skipped.inactiveSeedOrMerchant}`,
    `skipped_invalid_seed=${summary.skipped.invalidSeed}`,
    `skipped_missing_latest=${summary.skipped.missingLatest ?? 0}`,
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
  environment = process.env,
  merchantSlugs,
  mode = 'write',
  now,
  refreshMerchants = false,
  setIds,
  workspaceRoot,
}: {
  dependencies?: CommerceSyncDependencies;
  environment?: Record<string, string | undefined>;
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
  const inputSource =
    loadCommerceSyncInputsFn === loadCommerceSyncInputs
      ? 'supabase'
      : 'injected';

  if (shouldRefreshMerchants && scopedMerchantSlugs.length === 0) {
    throw new Error(
      'Legacy merchant refresh requires an explicit --merchant-slugs scope. Default commerce-sync is aggregate-only.',
    );
  }

  if (!scoped && mode === 'check' && inputSource === 'supabase') {
    assertCommerceCheckInputSourceReady({
      environment,
      latestRowsLoaded: 1,
      seedRowsLoaded: 1,
      source: inputSource,
    });
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
  const dailyHistoryInputs =
    'syncSeeds' in refreshedCommerceSyncInputs
      ? buildDailyHistoryInputsFromCommerceSyncSeeds(
          refreshedCommerceSyncInputs.syncSeeds,
        )
      : [];

  if (!scoped && mode === 'check') {
    const seedRowsLoaded = dailyHistoryInputs.length;
    const latestRowsLoaded = dailyHistoryInputs.filter((dailyHistoryInput) =>
      Boolean(dailyHistoryInput.latestOffer),
    ).length;

    assertCommerceCheckInputSourceReady({
      environment,
      latestRowsLoaded,
      seedRowsLoaded,
      source: inputSource,
    });
  }

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
          latestOffers: dailyHistoryInputs,
          now,
        })
      : buildDailyPriceHistoryPointsFromCommerceLatestOffers({
          latestOffers: dailyHistoryInputs,
          now,
        });

  console.info(
    formatDailyHistorySummaryLog({
      mode,
      summary: dailyPriceHistoryResult.summary,
      upsertedCount:
        mode === 'write' ? dailyPriceHistoryResult.points.length : 0,
    }),
  );

  const aggregateArtifactsChanged =
    !scoped &&
    mode === 'write' &&
    (!pricingArtifactCheck.isClean || !affiliateArtifactCheck.isClean);

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
      handleCommerceSyncRevalidationFailure({
        error,
        fallbackMessage: 'Public web revalidation failed after commerce sync.',
      });
    }
  } else if (aggregateArtifactsChanged) {
    try {
      await revalidatePublicCatalogPathsFn({
        includeThemeDirectory: false,
        reason: 'commerce_sync_aggregate',
        targets: [],
      });
    } catch (error) {
      handleCommerceSyncRevalidationFailure({
        error,
        fallbackMessage:
          'Public web aggregate revalidation failed after commerce sync.',
      });
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
