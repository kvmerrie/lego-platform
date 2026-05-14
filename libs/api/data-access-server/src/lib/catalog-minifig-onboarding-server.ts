import {
  runCatalogMinifigSync,
  type CatalogMinifigSyncResult,
} from '@lego-platform/catalog/data-access-server';

export interface CatalogMinifigOnboardingEnrichmentResult {
  changedSetIds: readonly string[];
  changedSetSlugs: readonly string[];
  failedSetIds: readonly string[];
  failedSets: number;
  processedSets: number;
  summariesUpserted: number;
}

export type EnrichCatalogSetMinifigSummariesFn =
  typeof enrichCatalogSetMinifigSummaries;

export async function enrichCatalogSetMinifigSummaries({
  setIds,
}: {
  setIds: readonly string[];
}): Promise<CatalogMinifigOnboardingEnrichmentResult> {
  const selectedSetIds = [
    ...new Set(setIds.map((setId) => setId.trim()).filter(Boolean)),
  ];

  if (selectedSetIds.length === 0) {
    return {
      changedSetIds: [],
      changedSetSlugs: [],
      failedSetIds: [],
      failedSets: 0,
      processedSets: 0,
      summariesUpserted: 0,
    };
  }

  const result = await runCatalogMinifigSync({
    limit: null,
    mode: 'write',
    requestDelayMs: 0,
    selectedSetIds,
  });

  return toOnboardingEnrichmentResult(result);
}

export async function enrichCatalogSetMinifigSummariesBestEffort({
  logPrefix = '[catalog-minifig-onboarding]',
  setIds,
}: {
  logPrefix?: string;
  setIds: readonly string[];
}): Promise<CatalogMinifigOnboardingEnrichmentResult> {
  try {
    return await enrichCatalogSetMinifigSummaries({ setIds });
  } catch (error) {
    console.warn(
      `${logPrefix} minifig enrichment skipped after catalog set import.`,
      {
        error: error instanceof Error ? error.message : 'Unknown error.',
        setIds,
      },
    );

    return {
      changedSetIds: [],
      changedSetSlugs: [],
      failedSetIds: setIds,
      failedSets: setIds.length,
      processedSets: 0,
      summariesUpserted: 0,
    };
  }
}

function toOnboardingEnrichmentResult(
  result: CatalogMinifigSyncResult,
): CatalogMinifigOnboardingEnrichmentResult {
  return {
    changedSetIds: result.changedSetIds,
    changedSetSlugs: result.changedSetSlugs,
    failedSetIds: result.failedSetIds,
    failedSets: result.failedSets,
    processedSets: result.processedSets,
    summariesUpserted: result.summariesUpserted,
  };
}
