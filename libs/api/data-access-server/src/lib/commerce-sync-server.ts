import {
  buildAffiliateSyncArtifacts,
  checkAffiliateGeneratedArtifacts,
  writeAffiliateGeneratedArtifacts,
} from '@lego-platform/affiliate/data-access-server';
import { listCatalogSetSummariesWithOverlay } from '@lego-platform/catalog/data-access-server';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  probeCatalogCurrentOfferSnapshotHitRateBySetIds,
} from '@lego-platform/catalog/data-access-server';
import type { CatalogCurrentOfferSummaryRecord } from '@lego-platform/catalog/data-access-server';
import {
  catalogCollectionPageSnapshotSlugs,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
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
  buildCatalogSetDetailCacheTags,
  cacheTags,
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
import {
  buildCommerceCurrentOfferSnapshots,
  type CommerceCurrentOfferSnapshotParitySample,
  upsertCommerceCurrentOfferSnapshots,
} from './commerce-current-offer-snapshot-server';
import { syncCollectionPageSnapshots } from './collection-page-snapshot-server';
import { syncDealPageSnapshots } from './deal-page-snapshot-server';
import { syncSetDetailRelatedThemeSnapshots } from './set-detail-related-theme-snapshot-server';
import {
  revalidatePublicCatalogPaths,
  revalidatePublicWeb,
} from './public-web-revalidation-server';

export interface CommerceGeneratedArtifactCheckResult {
  isClean: boolean;
  stalePaths: string[];
}

export interface CommerceSyncRunResult {
  affiliateArtifactCheck: CommerceGeneratedArtifactCheckResult;
  affiliateOfferCount: number;
  currentOfferSnapshotCount: number;
  currentOfferSnapshotBestOfferMismatchSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  currentOfferSnapshotLiveSummaryCount: number;
  currentOfferSnapshotLiveSummaryMissingSnapshotCount: number;
  currentOfferSnapshotMissingBestOfferSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  currentOfferSnapshotMissingBestOfferCount: number;
  currentOfferSnapshotMissingLiveSummaryCount: number;
  currentOfferSnapshotMissingLiveSummaryReasonCounts: Record<string, number>;
  currentOfferSnapshotMissingLiveSummarySample: readonly CommerceCurrentOfferSnapshotParitySample[];
  currentOfferSnapshotMissingSnapshotSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  currentOfferSnapshotOfferCount: number;
  currentOfferSnapshotBestOfferMismatchCount: number;
  currentOfferSnapshotsUpsertedCount: number;
  dealPageSnapshotCount: number;
  dealPageSnapshotsUpsertedCount: number;
  setDetailRelatedThemeSnapshotCount: number;
  setDetailRelatedThemeSnapshotsUpsertedCount: number;
  collectionPageSnapshotCount: number;
  collectionPageSnapshotsUpsertedCount: number;
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
  listCatalogCurrentOfferSummariesBySetIdsFn?: typeof listCatalogCurrentOfferSummariesBySetIds;
  listCatalogSetSummariesFn?: typeof listCatalogSetSummariesWithOverlay;
  loadCommerceSyncInputsFn?: typeof loadCommerceSyncInputs;
  probeCatalogCurrentOfferSnapshotHitRateBySetIdsFn?: typeof probeCatalogCurrentOfferSnapshotHitRateBySetIds;
  revalidatePublicCatalogPathsFn?: typeof revalidatePublicCatalogPaths;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
  refreshCommerceOfferSeedsFn?: typeof refreshCommerceOfferSeeds;
  upsertCommerceCurrentOfferSnapshotsFn?: typeof upsertCommerceCurrentOfferSnapshots;
  syncCollectionPageSnapshotsFn?: typeof syncCollectionPageSnapshots;
  syncDealPageSnapshotsFn?: typeof syncDealPageSnapshots;
  syncSetDetailRelatedThemeSnapshotsFn?: typeof syncSetDetailRelatedThemeSnapshots;
  upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn?: typeof upsertDailyPriceHistoryPointsFromCommerceLatestOffers;
  writeAffiliateGeneratedArtifactsFn?: typeof writeAffiliateGeneratedArtifacts;
  writePricingGeneratedArtifactsFn?: typeof writePricingGeneratedArtifacts;
}

const commerceSyncCollectionSnapshotSlugs = catalogCollectionPageSnapshotSlugs;
const commerceSyncCollectionSnapshotPaths =
  commerceSyncCollectionSnapshotSlugs.map((collectionSlug) => {
    return `/${collectionSlug}`;
  });
const commerceSyncCollectionSnapshotTags =
  commerceSyncCollectionSnapshotSlugs.map((collectionSlug) => {
    return cacheTags.collection(collectionSlug);
  });

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

function buildSetDetailRelatedThemeSnapshotRevalidationTags({
  catalogSetSummaries,
  snapshotSetIds,
}: {
  catalogSetSummaries: readonly CatalogSetSummary[];
  snapshotSetIds: readonly string[];
}): string[] {
  const catalogSetSummaryById = new Map(
    catalogSetSummaries.map((catalogSetSummary) => [
      catalogSetSummary.id,
      catalogSetSummary,
    ]),
  );
  const tags = new Set<string>();

  for (const setId of snapshotSetIds) {
    const catalogSetSummary = catalogSetSummaryById.get(setId);

    for (const tag of buildCatalogSetDetailCacheTags({
      setId,
      slug: catalogSetSummary?.slug ?? setId,
    })) {
      tags.add(tag);
    }
  }

  return [...tags];
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
    `stale_or_error_merchant_counts=${JSON.stringify(summary.staleOrErrorMerchantCounts ?? {})}`,
    `stale_fetch_status_merchant_counts=${JSON.stringify(summary.staleFetchStatusMerchantCounts ?? {})}`,
    `stale_observed_at_too_old_merchant_counts=${JSON.stringify(summary.staleObservedAtTooOldMerchantCounts ?? {})}`,
    `stale_or_error_samples=${JSON.stringify(summary.staleOrErrorSamples ?? [])}`,
    `skipped_unit_mismatch=${summary.skipped.unitMismatch ?? 0}`,
    `skipped_untrusted_merchant=${summary.skipped.untrustedMerchant ?? 0}`,
    `skipped_inactive_seed_or_merchant=${summary.skipped.inactiveSeedOrMerchant}`,
    `skipped_invalid_seed=${summary.skipped.invalidSeed}`,
    `skipped_missing_latest=${summary.skipped.missingLatest ?? 0}`,
    `skipped_non_eur=${summary.skipped.nonEur}`,
    `skipped_missing_or_invalid_price=${summary.skipped.missingOrInvalidPrice}`,
    `skipped_unavailable_for_headline=${summary.skipped.unavailableForHeadline}`,
    `unavailable_for_headline_merchant_counts=${JSON.stringify(summary.unavailableForHeadlineMerchantCounts ?? {})}`,
    summary.dailyHistoryPointsBuilt === 0
      ? 'zero_points_reason=no_eligible_latest_offers'
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function formatCurrentOfferSnapshotSummaryLog({
  builtCount,
  bestOfferMismatchSample,
  liveSummaryMissingSnapshotCount,
  liveSummaryCount,
  missingBestOfferSample,
  missingBestOfferCount,
  missingLiveSummaryCount,
  missingLiveSummaryReasonCounts,
  missingLiveSummarySample,
  missingSnapshotSample,
  mode,
  offerCount,
  snapshotComputedAt,
  upsertedCount,
  bestOfferMismatchCount,
}: {
  bestOfferMismatchCount: number;
  bestOfferMismatchSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  builtCount: number;
  liveSummaryMissingSnapshotCount: number;
  liveSummaryCount: number;
  missingBestOfferSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  missingBestOfferCount: number;
  missingLiveSummaryCount: number;
  missingLiveSummaryReasonCounts: Record<string, number>;
  missingLiveSummarySample: readonly CommerceCurrentOfferSnapshotParitySample[];
  missingSnapshotSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  mode: 'check' | 'write';
  offerCount: number;
  snapshotComputedAt: string;
  upsertedCount: number;
}): string {
  return [
    '[commerce-sync] current_offer_snapshots',
    `mode=${mode}`,
    `snapshot_computed_at=${snapshotComputedAt}`,
    `current_offer_snapshots_built=${builtCount}`,
    `current_offer_snapshots_upserted=${upsertedCount}`,
    `snapshot_offer_count=${offerCount}`,
    `snapshot_missing_best_offer_count=${missingBestOfferCount}`,
    `live_summary_count=${liveSummaryCount}`,
    `snapshot_missing_live_summary_count=${missingLiveSummaryCount}`,
    `missing_live_summary_reason_counts=${JSON.stringify(missingLiveSummaryReasonCounts)}`,
    `live_summary_missing_snapshot_count=${liveSummaryMissingSnapshotCount}`,
    `snapshot_best_offer_mismatch_count=${bestOfferMismatchCount}`,
    missingLiveSummarySample.length
      ? `missing_live_summary_sample=${JSON.stringify(missingLiveSummarySample)}`
      : undefined,
    missingSnapshotSample.length
      ? `missing_snapshot_sample=${JSON.stringify(missingSnapshotSample)}`
      : undefined,
    bestOfferMismatchSample.length
      ? `best_offer_mismatch_sample=${JSON.stringify(bestOfferMismatchSample)}`
      : undefined,
    missingBestOfferSample.length
      ? `missing_best_offer_sample=${JSON.stringify(missingBestOfferSample)}`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

const CURRENT_OFFER_SNAPSHOT_PARITY_SET_ID_CHUNK_SIZE = 25;

async function loadCurrentOfferSnapshotParitySummaries({
  listCatalogCurrentOfferSummariesBySetIdsFn,
  setIds,
}: {
  listCatalogCurrentOfferSummariesBySetIdsFn: typeof listCatalogCurrentOfferSummariesBySetIds;
  setIds: readonly string[];
}) {
  const uniqueSetIds = [...new Set(setIds.map(normalizeCatalogSetId))].filter(
    Boolean,
  );

  if (!uniqueSetIds.length) {
    return [];
  }

  const liveSummaries: CatalogCurrentOfferSummaryRecord[] = [];

  for (
    let offset = 0;
    offset < uniqueSetIds.length;
    offset += CURRENT_OFFER_SNAPSHOT_PARITY_SET_ID_CHUNK_SIZE
  ) {
    const chunkSetIds = uniqueSetIds.slice(
      offset,
      offset + CURRENT_OFFER_SNAPSHOT_PARITY_SET_ID_CHUNK_SIZE,
    );

    try {
      liveSummaries.push(
        ...(await listCatalogCurrentOfferSummariesBySetIdsFn({
          preferSnapshots: false,
          setIds: chunkSetIds,
        })),
      );
    } catch (error) {
      console.warn(
        [
          '[commerce-sync] current_offer_snapshot_parity_load_failed',
          `set_id_count=${chunkSetIds.length}`,
          `sample_set_ids=${chunkSetIds.slice(0, 5).join(',')}`,
          `error=${error instanceof Error ? error.message : 'unknown'}`,
        ].join(' '),
      );
    }
  }

  return liveSummaries;
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
  dependencies,
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
  const dependenciesInjected = dependencies !== undefined;
  const skipInjectedCollectionPageSnapshotSync: typeof syncCollectionPageSnapshots =
    async ({ dryRun = true, now: snapshotNow = new Date() } = {}) => ({
      dryRun,
      generatedAt: snapshotNow.toISOString(),
      snapshots: [],
      summaryByCollectionSlug: {},
      upsertedCount: 0,
    });
  const skipInjectedDealPageSnapshotSync: typeof syncDealPageSnapshots =
    async ({ dryRun = true, now: snapshotNow = new Date() } = {}) => ({
      debugCounters: {
        snapshotRowsRead: 0,
        rowsRejectedByReason: {},
        rowsUnder50: 0,
        rowsWithBestOffer: 0,
        rowsWithDiscount: 0,
        rowsWithInStockOffer: 0,
        rowsWithOfferCount: 0,
        rowsWithOffersJson: 0,
        rowsWithPieces: 0,
        rowsWithReferencePrice: 0,
      },
      dryRun,
      generatedAt: snapshotNow.toISOString(),
      snapshots: [],
      summaryBySortKey: {},
      upsertedCount: 0,
    });
  const skipInjectedSetDetailRelatedThemeSnapshotSync: typeof syncSetDetailRelatedThemeSnapshots =
    async ({ dryRun = true, now: snapshotNow = new Date() } = {}) => ({
      dryRun,
      generatedAt: snapshotNow.toISOString(),
      snapshots: [],
      summary: {
        setCount: 0,
        snapshotCount: 0,
        snapshotWithItemsCount: 0,
      },
      upsertedCount: 0,
    });
  const {
    checkAffiliateGeneratedArtifactsFn = checkAffiliateGeneratedArtifacts,
    checkPricingGeneratedArtifactsFn = checkPricingGeneratedArtifacts,
    listCatalogCurrentOfferSummariesBySetIdsFn = listCatalogCurrentOfferSummariesBySetIds,
    listCatalogSetSummariesFn = listCatalogSetSummariesWithOverlay,
    loadCommerceSyncInputsFn = loadCommerceSyncInputs,
    probeCatalogCurrentOfferSnapshotHitRateBySetIdsFn = probeCatalogCurrentOfferSnapshotHitRateBySetIds,
    revalidatePublicCatalogPathsFn = revalidatePublicCatalogPaths,
    revalidatePublicWebFn = revalidatePublicWeb,
    refreshCommerceOfferSeedsFn = refreshCommerceOfferSeeds,
    syncCollectionPageSnapshotsFn = dependenciesInjected
      ? skipInjectedCollectionPageSnapshotSync
      : syncCollectionPageSnapshots,
    syncDealPageSnapshotsFn = dependenciesInjected
      ? skipInjectedDealPageSnapshotSync
      : syncDealPageSnapshots,
    syncSetDetailRelatedThemeSnapshotsFn = dependenciesInjected
      ? skipInjectedSetDetailRelatedThemeSnapshotSync
      : syncSetDetailRelatedThemeSnapshots,
    upsertCommerceCurrentOfferSnapshotsFn = upsertCommerceCurrentOfferSnapshots,
    upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn = upsertDailyPriceHistoryPointsFromCommerceLatestOffers,
    writeAffiliateGeneratedArtifactsFn = writeAffiliateGeneratedArtifacts,
    writePricingGeneratedArtifactsFn = writePricingGeneratedArtifacts,
  } = dependencies ?? {};
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
  const syncSeeds =
    'syncSeeds' in refreshedCommerceSyncInputs
      ? refreshedCommerceSyncInputs.syncSeeds
      : [];
  const dailyHistoryInputs =
    syncSeeds.length > 0
      ? buildDailyHistoryInputsFromCommerceSyncSeeds(syncSeeds)
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

  const currentOfferSnapshotSetIds = [
    ...new Set(syncSeeds.map((syncSeed) => syncSeed.offerSeed.setId)),
  ];
  const currentOfferSnapshotLiveSummaries =
    await loadCurrentOfferSnapshotParitySummaries({
      listCatalogCurrentOfferSummariesBySetIdsFn,
      setIds: currentOfferSnapshotSetIds,
    });
  const currentOfferSnapshotResult = buildCommerceCurrentOfferSnapshots({
    liveSummaries: currentOfferSnapshotLiveSummaries,
    now,
    publicSetIds: syncInputs.enabledSetIds,
    syncSeeds,
  });
  const currentOfferSnapshotUpsertResult =
    mode === 'write'
      ? await upsertCommerceCurrentOfferSnapshotsFn({
          snapshots: currentOfferSnapshotResult.snapshots.filter(
            (snapshot) => snapshot.offerCount > 0,
          ),
        })
      : { upsertedCount: 0 };
  const collectionPageSnapshotResult =
    mode === 'write'
      ? await syncCollectionPageSnapshotsFn({
          collectionSlugs: commerceSyncCollectionSnapshotSlugs,
          dryRun: false,
          pageSize: 40,
        })
      : {
          dryRun: true,
          generatedAt: now?.toISOString() ?? new Date().toISOString(),
          snapshots: [],
          summaryByCollectionSlug: {},
          upsertedCount: 0,
        };
  const dealPageSnapshotResult =
    mode === 'write' && currentOfferSnapshotUpsertResult.upsertedCount > 0
      ? await syncDealPageSnapshotsFn({
          dryRun: false,
          pageSize: 40,
        })
      : {
          dryRun: mode !== 'write',
          generatedAt: now?.toISOString() ?? new Date().toISOString(),
          snapshots: [],
          summaryBySortKey: {},
          upsertedCount: 0,
        };
  const setDetailRelatedThemeSnapshotStartedAt = Date.now();
  const setDetailRelatedThemeSnapshotResult =
    mode === 'write'
      ? await syncSetDetailRelatedThemeSnapshotsFn({
          dryRun: false,
          limit: 8,
        }).catch((error: unknown) => {
          console.error(
            '[commerce-sync] set_detail_related_theme_snapshots_failed',
            {
              duration_ms: Date.now() - setDetailRelatedThemeSnapshotStartedAt,
              event: 'set_detail_related_theme_snapshots_failed',
              error: error instanceof Error ? error.message : 'unknown',
            },
          );

          throw error;
        })
      : {
          dryRun: true,
          generatedAt: now?.toISOString() ?? new Date().toISOString(),
          snapshots: [],
          summary: {
            setCount: 0,
            snapshotCount: 0,
            snapshotWithItemsCount: 0,
          },
          upsertedCount: 0,
        };

  if (mode === 'write') {
    for (const collectionSlug of commerceSyncCollectionSnapshotSlugs) {
      const snapshotsBuilt = collectionPageSnapshotResult.snapshots.filter(
        (snapshot) => snapshot.collectionSlug === collectionSlug,
      ).length;

      console.info('[commerce-sync] collection_page_snapshots', {
        collection_slug: collectionSlug,
        snapshots_built: snapshotsBuilt,
        snapshots_upserted: snapshotsBuilt,
        summary:
          collectionPageSnapshotResult.summaryByCollectionSlug[collectionSlug],
      });
    }
    console.info('[commerce-sync] deal_page_snapshots', {
      snapshots_built: dealPageSnapshotResult.snapshots.length,
      snapshots_upserted: dealPageSnapshotResult.upsertedCount,
      summary_by_sort_key: dealPageSnapshotResult.summaryBySortKey,
    });
  }

  if (mode === 'write') {
    console.info('[commerce-sync] set_detail_related_theme_snapshots', {
      affected_set_count: new Set(
        setDetailRelatedThemeSnapshotResult.snapshots.map(
          (snapshot) => snapshot.setId,
        ),
      ).size,
      duration_ms: Date.now() - setDetailRelatedThemeSnapshotStartedAt,
      event: 'set_detail_related_theme_snapshots_built',
      snapshots_built: setDetailRelatedThemeSnapshotResult.snapshots.length,
      snapshots_upserted: setDetailRelatedThemeSnapshotResult.upsertedCount,
      summary: setDetailRelatedThemeSnapshotResult.summary,
    });
  }

  if (mode === 'write' && inputSource === 'supabase') {
    const probeSetIds = currentOfferSnapshotResult.snapshots
      .filter((snapshot) => snapshot.offerCount > 0)
      .slice(0, CURRENT_OFFER_SNAPSHOT_PARITY_SET_ID_CHUNK_SIZE)
      .map((snapshot) => snapshot.setId);
    const snapshotPostWriteProbe =
      await probeCatalogCurrentOfferSnapshotHitRateBySetIdsFn({
        setIds: probeSetIds,
      });

    console.info(
      [
        '[commerce-sync] current_offer_snapshot_post_write_probe',
        `snapshot_post_write_probe_requested=${snapshotPostWriteProbe.requestedCount}`,
        `snapshot_post_write_probe_hit_count=${snapshotPostWriteProbe.hitCount}`,
        `snapshot_post_write_probe_miss_count=${snapshotPostWriteProbe.missCount}`,
        snapshotPostWriteProbe.missingSample.length
          ? `snapshot_post_write_probe_missing_sample=${JSON.stringify(snapshotPostWriteProbe.missingSample)}`
          : undefined,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' '),
    );
  }

  console.info(
    formatCurrentOfferSnapshotSummaryLog({
      bestOfferMismatchCount:
        currentOfferSnapshotResult.summary.snapshotBestOfferMismatchCount,
      bestOfferMismatchSample:
        currentOfferSnapshotResult.summary.bestOfferMismatchSample,
      builtCount: currentOfferSnapshotResult.summary.currentOfferSnapshotsBuilt,
      liveSummaryMissingSnapshotCount:
        currentOfferSnapshotResult.summary.liveSummaryMissingSnapshotCount,
      liveSummaryCount: currentOfferSnapshotResult.summary.liveSummaryCount,
      missingBestOfferSample:
        currentOfferSnapshotResult.summary.snapshotMissingBestOfferSample,
      missingBestOfferCount:
        currentOfferSnapshotResult.summary.snapshotMissingBestOfferCount,
      missingLiveSummaryCount:
        currentOfferSnapshotResult.summary.snapshotMissingLiveSummaryCount,
      missingLiveSummaryReasonCounts:
        currentOfferSnapshotResult.summary.missingLiveSummaryReasonCounts,
      missingLiveSummarySample:
        currentOfferSnapshotResult.summary.missingLiveSummarySample,
      missingSnapshotSample:
        currentOfferSnapshotResult.summary.missingSnapshotSample,
      mode,
      offerCount: currentOfferSnapshotResult.summary.snapshotOfferCount,
      snapshotComputedAt:
        currentOfferSnapshotResult.snapshots[0]?.computedAt ??
        now?.toISOString() ??
        'not-built',
      upsertedCount: currentOfferSnapshotUpsertResult.upsertedCount,
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
        additionalPaths: [...commerceSyncCollectionSnapshotPaths, '/deals'],
        additionalTags: [
          cacheTags.collections(),
          ...commerceSyncCollectionSnapshotTags,
          cacheTags.deals(),
          cacheTags.prices(),
        ],
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
        additionalPaths: [...commerceSyncCollectionSnapshotPaths, '/deals'],
        additionalTags: [
          cacheTags.collections(),
          ...commerceSyncCollectionSnapshotTags,
          cacheTags.deals(),
          cacheTags.prices(),
        ],
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
  } else if (
    mode === 'write' &&
    (collectionPageSnapshotResult.upsertedCount > 0 ||
      dealPageSnapshotResult.upsertedCount > 0)
  ) {
    try {
      await revalidatePublicCatalogPathsFn({
        additionalPaths: [...commerceSyncCollectionSnapshotPaths, '/deals'],
        additionalTags: [
          cacheTags.collections(),
          ...commerceSyncCollectionSnapshotTags,
          cacheTags.deals(),
          cacheTags.prices(),
        ],
        includeDeals: false,
        includeHome: false,
        includeThemeDirectory: false,
        reason: 'commerce_sync_collection_snapshots',
        targets: [],
      });
    } catch (error) {
      handleCommerceSyncRevalidationFailure({
        error,
        fallbackMessage:
          'Collection snapshot revalidation failed after commerce sync.',
      });
    }
  }

  if (
    mode === 'write' &&
    setDetailRelatedThemeSnapshotResult.upsertedCount > 0
  ) {
    const affectedSetIds = [
      ...new Set(
        setDetailRelatedThemeSnapshotResult.snapshots.map(
          (snapshot) => snapshot.setId,
        ),
      ),
    ];
    const catalogSetSummaries = await listCatalogSetSummariesFn();
    const tags = buildSetDetailRelatedThemeSnapshotRevalidationTags({
      catalogSetSummaries,
      snapshotSetIds: affectedSetIds,
    });

    try {
      const revalidationResult = await revalidatePublicWebFn({
        paths: [],
        reason: 'commerce_sync_set_detail_related_theme_snapshots',
        tags,
      });

      console.info('[commerce-sync] set_detail_related_theme_revalidation', {
        affected_set_count: affectedSetIds.length,
        event: 'set_detail_related_theme_revalidation',
        revalidated_set_count: affectedSetIds.length,
        skipped: revalidationResult.skipped,
        tag_count: tags.length,
      });
    } catch (error) {
      handleCommerceSyncRevalidationFailure({
        error,
        fallbackMessage:
          'Set detail related-theme snapshot revalidation failed after commerce sync.',
      });
    }
  }

  return {
    affiliateArtifactCheck,
    affiliateOfferCount: affiliateArtifacts.affiliateOfferSnapshots.length,
    currentOfferSnapshotBestOfferMismatchSample:
      currentOfferSnapshotResult.summary.bestOfferMismatchSample,
    currentOfferSnapshotBestOfferMismatchCount:
      currentOfferSnapshotResult.summary.snapshotBestOfferMismatchCount,
    currentOfferSnapshotCount:
      currentOfferSnapshotResult.summary.currentOfferSnapshotsBuilt,
    currentOfferSnapshotLiveSummaryMissingSnapshotCount:
      currentOfferSnapshotResult.summary.liveSummaryMissingSnapshotCount,
    currentOfferSnapshotLiveSummaryCount:
      currentOfferSnapshotResult.summary.liveSummaryCount,
    currentOfferSnapshotMissingBestOfferSample:
      currentOfferSnapshotResult.summary.snapshotMissingBestOfferSample,
    currentOfferSnapshotMissingBestOfferCount:
      currentOfferSnapshotResult.summary.snapshotMissingBestOfferCount,
    currentOfferSnapshotMissingLiveSummaryCount:
      currentOfferSnapshotResult.summary.snapshotMissingLiveSummaryCount,
    currentOfferSnapshotMissingLiveSummaryReasonCounts:
      currentOfferSnapshotResult.summary.missingLiveSummaryReasonCounts,
    currentOfferSnapshotMissingLiveSummarySample:
      currentOfferSnapshotResult.summary.missingLiveSummarySample,
    currentOfferSnapshotMissingSnapshotSample:
      currentOfferSnapshotResult.summary.missingSnapshotSample,
    currentOfferSnapshotOfferCount:
      currentOfferSnapshotResult.summary.snapshotOfferCount,
    currentOfferSnapshotsUpsertedCount:
      currentOfferSnapshotUpsertResult.upsertedCount,
    dealPageSnapshotCount: dealPageSnapshotResult.snapshots.length,
    dealPageSnapshotsUpsertedCount: dealPageSnapshotResult.upsertedCount,
    setDetailRelatedThemeSnapshotCount:
      setDetailRelatedThemeSnapshotResult.snapshots.length,
    setDetailRelatedThemeSnapshotsUpsertedCount:
      setDetailRelatedThemeSnapshotResult.upsertedCount,
    collectionPageSnapshotCount: collectionPageSnapshotResult.snapshots.length,
    collectionPageSnapshotsUpsertedCount:
      collectionPageSnapshotResult.upsertedCount,
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
