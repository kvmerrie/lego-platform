import {
  buildAffiliateSyncArtifacts,
  checkAffiliateGeneratedArtifacts,
  writeAffiliateGeneratedArtifacts,
} from '@lego-platform/affiliate/data-access-server';
import { listCatalogSetSummariesWithOverlay } from '@lego-platform/catalog/data-access-server';
import type { CatalogSetSummary } from '@lego-platform/catalog/util';
import {
  loadCommerceSyncInputs,
  refreshCommerceOfferSeeds,
} from './commerce-refresh';
import {
  buildPricingSyncArtifacts,
  checkPricingGeneratedArtifacts,
  upsertDailyPriceHistoryPoints,
  writePricingGeneratedArtifacts,
} from '@lego-platform/pricing/data-access-server';

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
  pricingObservationCount: number;
  pricingArtifactCheck: CommerceGeneratedArtifactCheckResult;
  refreshInvalidCount: number;
  refreshStaleCount: number;
  refreshSuccessCount: number;
  refreshUnavailableCount: number;
}

export async function resolveCommerceCatalogSetSummaries({
  setIds,
  listCatalogSetSummariesWithOverlayFn = listCatalogSetSummariesWithOverlay,
}: {
  setIds: readonly string[];
  listCatalogSetSummariesWithOverlayFn?: typeof listCatalogSetSummariesWithOverlay;
}): Promise<CatalogSetSummary[]> {
  const catalogSetSummaries = await listCatalogSetSummariesWithOverlayFn();
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
  mode = 'write',
  now,
  workspaceRoot,
}: {
  mode?: 'check' | 'write';
  now?: Date;
  workspaceRoot: string;
}): Promise<CommerceSyncRunResult> {
  const initialCommerceSyncInputs = await loadCommerceSyncInputs();

  await resolveCommerceCatalogSetSummaries({
    setIds: initialCommerceSyncInputs.refreshSeeds.map(
      (refreshSeed) => refreshSeed.offerSeed.setId,
    ),
  });

  const refreshSummary =
    mode === 'write'
      ? await refreshCommerceOfferSeeds({
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
  const { syncInputs } = await loadCommerceSyncInputs();
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

  const pricingArtifactCheck =
    mode === 'check'
      ? await checkPricingGeneratedArtifacts({
          pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
          pricingObservations: pricingArtifacts.pricingObservations,
          pricingSyncManifest: pricingArtifacts.pricingSyncManifest,
          workspaceRoot,
        })
      : await writePricingGeneratedArtifacts({
          pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
          pricingObservations: pricingArtifacts.pricingObservations,
          pricingSyncManifest: pricingArtifacts.pricingSyncManifest,
          workspaceRoot,
        });
  const affiliateArtifactCheck =
    mode === 'check'
      ? await checkAffiliateGeneratedArtifacts({
          affiliateOfferSnapshots: affiliateArtifacts.affiliateOfferSnapshots,
          affiliateSyncManifest: affiliateArtifacts.affiliateSyncManifest,
          workspaceRoot,
        })
      : await writeAffiliateGeneratedArtifacts({
          affiliateOfferSnapshots: affiliateArtifacts.affiliateOfferSnapshots,
          affiliateSyncManifest: affiliateArtifacts.affiliateSyncManifest,
          workspaceRoot,
        });

  const dailyPriceHistoryPoints =
    mode === 'write'
      ? await upsertDailyPriceHistoryPoints({
          now,
          pricePanelSnapshots: pricingArtifacts.pricePanelSnapshots,
        })
      : [];

  return {
    mode,
    pricingArtifactCheck,
    affiliateArtifactCheck,
    enabledSetCount: syncInputs.enabledSetIds.length,
    pricingObservationCount: pricingArtifacts.pricingObservations.length,
    pricePanelSnapshotCount: pricingArtifacts.pricePanelSnapshots.length,
    affiliateOfferCount: affiliateArtifacts.affiliateOfferSnapshots.length,
    merchantCount: syncInputs.activeMerchantCount,
    dailyHistoryPointCount:
      mode === 'write'
        ? dailyPriceHistoryPoints.length
        : pricingArtifacts.pricePanelSnapshots.length,
    refreshSuccessCount: refreshSummary.successCount,
    refreshUnavailableCount: refreshSummary.unavailableCount,
    refreshInvalidCount: refreshSummary.invalidCount,
    refreshStaleCount: refreshSummary.staleCount,
  };
}
