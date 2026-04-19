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
  upsertDailyPriceHistoryPoints,
  writePricingGeneratedArtifacts,
} from '@lego-platform/pricing/data-access-server';
import {
  loadCommerceSyncInputs,
  refreshCommerceOfferSeeds,
  type CommerceSyncInputs,
} from './commerce-refresh-server';

export interface CommerceGeneratedArtifactCheckResult {
  isClean: boolean;
  stalePaths: string[];
}

export interface CommerceSyncRunResult {
  affiliateArtifactCheck: CommerceGeneratedArtifactCheckResult;
  affiliateOfferCount: number;
  dailyHistoryPointCount: number;
  enabledSetCount: number;
  merchantCount: number;
  mode: 'check' | 'write';
  pricePanelSnapshotCount: number;
  pricingArtifactCheck: CommerceGeneratedArtifactCheckResult;
  pricingObservationCount: number;
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
  refreshCommerceOfferSeedsFn?: typeof refreshCommerceOfferSeeds;
  upsertDailyPriceHistoryPointsFn?: typeof upsertDailyPriceHistoryPoints;
  writeAffiliateGeneratedArtifactsFn?: typeof writeAffiliateGeneratedArtifacts;
  writePricingGeneratedArtifactsFn?: typeof writePricingGeneratedArtifacts;
}

function normalizeRequestedSetIds(setIds?: readonly string[]) {
  return [
    ...new Set((setIds ?? []).map((setId) => setId.trim()).filter(Boolean)),
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
  const uniqueSetIds = [...new Set(setIds)];

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
  setIds,
  workspaceRoot,
}: {
  dependencies?: CommerceSyncDependencies;
  merchantSlugs?: readonly string[];
  mode?: 'check' | 'write';
  now?: Date;
  setIds?: readonly string[];
  workspaceRoot: string;
}): Promise<CommerceSyncRunResult> {
  const {
    checkAffiliateGeneratedArtifactsFn = checkAffiliateGeneratedArtifacts,
    checkPricingGeneratedArtifactsFn = checkPricingGeneratedArtifacts,
    listCatalogSetSummariesFn = listCatalogSetSummariesWithOverlay,
    loadCommerceSyncInputsFn = loadCommerceSyncInputs,
    refreshCommerceOfferSeedsFn = refreshCommerceOfferSeeds,
    upsertDailyPriceHistoryPointsFn = upsertDailyPriceHistoryPoints,
    writeAffiliateGeneratedArtifactsFn = writeAffiliateGeneratedArtifacts,
    writePricingGeneratedArtifactsFn = writePricingGeneratedArtifacts,
  } = dependencies;
  const scopedSetIds = normalizeRequestedSetIds(setIds);
  const scopedMerchantSlugs = normalizeRequestedMerchantSlugs(merchantSlugs);
  const requestedMerchantSlugs =
    scopedMerchantSlugs.length > 0 ? scopedMerchantSlugs : undefined;
  const scoped = scopedSetIds.length > 0 || scopedMerchantSlugs.length > 0;
  const initialCommerceSyncInputs = await loadCommerceSyncInputsFn({
    merchantSlugs: requestedMerchantSlugs,
    setIds: scopedSetIds,
  });

  await resolveCommerceCatalogSetSummaries({
    listCatalogSetSummariesFn,
    setIds: initialCommerceSyncInputs.refreshSeeds.map(
      (refreshSeed) => refreshSeed.offerSeed.setId,
    ),
  });

  const refreshSummary =
    mode === 'write'
      ? await refreshCommerceOfferSeedsFn({
          now,
          refreshSeeds: initialCommerceSyncInputs.refreshSeeds,
        })
      : {
          totalCount: initialCommerceSyncInputs.refreshSeeds.length,
          successCount: 0,
          unavailableCount: 0,
          invalidCount: 0,
          staleCount: 0,
        };

  const { syncInputs } = await loadCommerceSyncInputsFn({
    merchantSlugs: requestedMerchantSlugs,
    setIds: scopedSetIds,
  });
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

  const dailyPriceHistoryPoints =
    mode === 'write'
      ? await upsertDailyPriceHistoryPointsFn({
          now,
          pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
        })
      : [];

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

  return {
    affiliateArtifactCheck,
    affiliateOfferCount: affiliateArtifacts.affiliateOfferSnapshots.length,
    dailyHistoryPointCount:
      mode === 'write'
        ? dailyPriceHistoryPoints.length
        : pricingArtifacts.pricePanelSnapshots.length,
    enabledSetCount: syncInputs.enabledSetIds.length,
    merchantCount: syncInputs.activeMerchantCount,
    mode,
    pricePanelSnapshotCount: pricingArtifacts.pricePanelSnapshots.length,
    pricingArtifactCheck,
    pricingObservationCount: pricingArtifacts.pricingObservations.length,
    refreshInvalidCount: refreshSummary.invalidCount,
    refreshStaleCount: refreshSummary.staleCount,
    refreshSuccessCount: refreshSummary.successCount,
    refreshUnavailableCount: refreshSummary.unavailableCount,
    scoped,
    scopedMerchantSlugs,
    scopedSetIds,
  };
}
