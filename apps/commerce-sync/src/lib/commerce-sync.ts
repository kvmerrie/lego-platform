import {
  buildAffiliateSyncArtifacts,
  checkAffiliateGeneratedArtifacts,
  writeAffiliateGeneratedArtifacts,
} from '@lego-platform/affiliate/data-access-server';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import {
  buildPricingSyncArtifacts,
  checkPricingGeneratedArtifacts,
  writePricingGeneratedArtifacts,
} from '@lego-platform/pricing/data-access-server';
import { curatedCommerceEnabledSetIds } from './commerce-sync-curation';

export interface CommerceGeneratedArtifactCheckResult {
  isClean: boolean;
  stalePaths: string[];
}

export interface CommerceSyncRunResult {
  affiliateArtifactCheck: CommerceGeneratedArtifactCheckResult;
  mode: 'check' | 'write';
  pricingArtifactCheck: CommerceGeneratedArtifactCheckResult;
}

function validateEnabledSetIds(enabledSetIds: readonly string[]) {
  const catalogSetIds = new Set(
    listCatalogSetSummaries().map((catalogSetSummary) => catalogSetSummary.id),
  );

  for (const enabledSetId of enabledSetIds) {
    if (!catalogSetIds.has(enabledSetId)) {
      throw new Error(
        `Commerce-enabled set ${enabledSetId} is missing from the current catalog snapshot.`,
      );
    }
  }
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
  validateEnabledSetIds(curatedCommerceEnabledSetIds);

  const pricingArtifacts = buildPricingSyncArtifacts({
    enabledSetIds: curatedCommerceEnabledSetIds,
    now,
  });
  const affiliateArtifacts = buildAffiliateSyncArtifacts({
    enabledSetIds: curatedCommerceEnabledSetIds,
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

  return {
    mode,
    pricingArtifactCheck,
    affiliateArtifactCheck,
  };
}
