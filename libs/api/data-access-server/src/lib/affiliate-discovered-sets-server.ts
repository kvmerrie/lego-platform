import {
  createCatalogSet,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
  enrichCatalogSetMinifigSummariesBestEffort,
  type EnrichCatalogSetMinifigSummariesFn,
} from './catalog-minifig-onboarding-server';
import {
  bulkUpdateCommerceAffiliateDiscoveredSetReviewStates,
  bulkUpsertCommerceOfferLatestRecords,
  bulkUpsertCommerceOfferSeedsByCompositeKey,
  listCommerceAffiliateDiscoveredSets,
  upsertCommerceOfferLatestRecord,
  upsertCommerceOfferSeedByCompositeKey,
  updateCommerceAffiliateDiscoveredSetReviewState,
} from '@lego-platform/commerce/data-access-server';
import type {
  CatalogExternalSetSearchResult,
  CatalogSet,
} from '@lego-platform/catalog/util';
import type {
  CommerceAffiliateDiscoveredSet,
  CommerceAffiliateDiscoveredSetImportResult,
  CommerceAffiliateDiscoveredSetStatus,
  CommerceOfferLatestRecordInput,
  CommerceOfferSeed,
  CommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { revalidatePublicCatalogPaths } from './public-web-revalidation-server';

export interface ImportAffiliateDiscoveredSetsDependencies {
  bulkUpdateDiscoveredSetReviewStatesFn?: typeof bulkUpdateCommerceAffiliateDiscoveredSetReviewStates;
  bulkUpsertCommerceOfferLatestRecordsFn?: typeof bulkUpsertCommerceOfferLatestRecords;
  bulkUpsertCommerceOfferSeedsByCompositeKeyFn?: typeof bulkUpsertCommerceOfferSeedsByCompositeKey;
  createCatalogSetFn?: typeof createCatalogSet;
  enrichCatalogSetMinifigSummariesFn?: EnrichCatalogSetMinifigSummariesFn;
  getNow?: () => Date;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listDiscoveredSetsFn?: typeof listCommerceAffiliateDiscoveredSets;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
  sleepFn?: (durationMs: number) => Promise<void>;
  revalidatePublicCatalogPathsFn?: typeof revalidatePublicCatalogPaths;
  updateDiscoveredSetReviewStateFn?: typeof updateCommerceAffiliateDiscoveredSetReviewState;
  upsertCommerceOfferLatestRecordFn?: typeof upsertCommerceOfferLatestRecord;
  upsertCommerceOfferSeedByCompositeKeyFn?: typeof upsertCommerceOfferSeedByCompositeKey;
}

export const AFFILIATE_DISCOVERED_SET_ADMIN_IMPORT_MAX_BATCH_SIZE = 50;
const REBRICKABLE_LOOKUP_MAX_ATTEMPTS = 3;
const REBRICKABLE_LOOKUP_RETRY_BASE_DELAY_MS = 500;

type ResolvedCatalogSet = CatalogSet | { setId: string };

type AffiliateDiscoveredSetImportPhaseTimings = NonNullable<
  CommerceAffiliateDiscoveredSetImportResult['phaseTimingsMs']
>;

interface CatalogSetResolution {
  catalogSet?: ResolvedCatalogSet;
  created: boolean;
  error?: string;
}

interface PendingDiscoveredSetOfferImport {
  catalogSetId: string;
  discoveredSet: CommerceAffiliateDiscoveredSet;
  seedInput: CommerceOfferSeedInput;
}

interface DiscoveredSetStatusUpdate {
  discoveredSetIds: readonly string[];
  importAttemptedAt?: string;
  importError?: string | null;
  importedSetId?: string;
  status: CommerceAffiliateDiscoveredSetStatus;
}

export function resolveAffiliateFeedDiscoveryEnabled({
  argv = [],
  environment = process.env,
}: {
  argv?: readonly string[];
  environment?: Record<string, string | undefined>;
} = {}): boolean {
  if (argv.includes('--discover-missing-sets')) {
    return true;
  }

  return environment['DISCOVER_MISSING_SETS']?.trim().toLowerCase() === 'true';
}

function findExactSearchResult({
  candidates,
  setId,
}: {
  candidates: readonly CatalogExternalSetSearchResult[];
  setId: string;
}): CatalogExternalSetSearchResult | undefined {
  return candidates.find(
    (candidate) =>
      candidate.setId === setId || candidate.sourceSetNumber === `${setId}-1`,
  );
}

async function resolveCatalogSetForDiscoveredSet({
  catalogSetById,
  createCatalogSetFn,
  discoveredSet,
  searchCatalogMissingSetsFn,
  sleepFn,
}: {
  catalogSetById: Map<string, ResolvedCatalogSet>;
  createCatalogSetFn: typeof createCatalogSet;
  discoveredSet: CommerceAffiliateDiscoveredSet;
  searchCatalogMissingSetsFn: typeof searchCatalogMissingSets;
  sleepFn: (durationMs: number) => Promise<void>;
}): Promise<CatalogSetResolution> {
  const existingCatalogSet = catalogSetById.get(discoveredSet.normalizedSetId);

  if (existingCatalogSet) {
    return {
      catalogSet: existingCatalogSet,
      created: false,
    };
  }

  let exactSearchResult: CatalogExternalSetSearchResult | undefined;

  try {
    exactSearchResult = findExactSearchResult({
      candidates: await retryRebrickableLookup({
        lookup: () =>
          searchCatalogMissingSetsFn({
            query: discoveredSet.normalizedSetId,
          }),
        sleepFn,
      }),
      setId: discoveredSet.normalizedSetId,
    });
  } catch (error) {
    return {
      created: false,
      error: toImportErrorMessage(error),
    };
  }

  if (!exactSearchResult) {
    return {
      created: false,
      error: `No exact Rebrickable match found for ${discoveredSet.normalizedSetId}.`,
    };
  }

  try {
    const catalogSet = await createCatalogSetFn({
      input: exactSearchResult,
    });

    catalogSetById.set(catalogSet.setId, catalogSet);

    return {
      catalogSet,
      created: true,
    };
  } catch (error) {
    const racedCatalogSet = catalogSetById.get(discoveredSet.normalizedSetId);

    if (racedCatalogSet) {
      return {
        catalogSet: racedCatalogSet,
        created: false,
      };
    }

    return {
      created: false,
      error: toImportErrorMessage(error),
    };
  }
}

function toImportErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Affiliate discovered set import failed.';
}

function isLikelyRateLimitError(error: unknown): boolean {
  const message = toImportErrorMessage(error).toLowerCase();

  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

async function retryRebrickableLookup({
  lookup,
  sleepFn,
}: {
  lookup: () => Promise<CatalogExternalSetSearchResult[]>;
  sleepFn: (durationMs: number) => Promise<void>;
}): Promise<CatalogExternalSetSearchResult[]> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= REBRICKABLE_LOOKUP_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await lookup();
    } catch (error) {
      lastError = error;

      if (
        !isLikelyRateLimitError(error) ||
        attempt === REBRICKABLE_LOOKUP_MAX_ATTEMPTS
      ) {
        break;
      }

      await sleepFn(
        REBRICKABLE_LOOKUP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
      );
    }
  }

  throw lastError;
}

function groupDiscoveredSetsBySetId(
  discoveredSets: readonly CommerceAffiliateDiscoveredSet[],
): Map<string, CommerceAffiliateDiscoveredSet[]> {
  const discoveredSetsBySetId = new Map<
    string,
    CommerceAffiliateDiscoveredSet[]
  >();

  for (const discoveredSet of discoveredSets) {
    const existingRows =
      discoveredSetsBySetId.get(discoveredSet.normalizedSetId) ?? [];

    existingRows.push(discoveredSet);
    discoveredSetsBySetId.set(discoveredSet.normalizedSetId, existingRows);
  }

  return discoveredSetsBySetId;
}

function isCatalogSetWithPublicSurface(
  catalogSet: ResolvedCatalogSet,
): catalogSet is Pick<CatalogSet, 'setId' | 'slug' | 'theme'> {
  return (
    typeof catalogSet.setId === 'string' &&
    'slug' in catalogSet &&
    typeof catalogSet.slug === 'string' &&
    Boolean(catalogSet.slug.trim()) &&
    'theme' in catalogSet &&
    typeof catalogSet.theme === 'string' &&
    Boolean(catalogSet.theme.trim())
  );
}

function createEmptyAffiliateDiscoveredSetImportPhaseTimings(): AffiliateDiscoveredSetImportPhaseTimings {
  return {
    catalogLoad: 0,
    catalogResolve: 0,
    seedUpsert: 0,
    latestUpsert: 0,
    statusUpdate: 0,
    enrichment: 0,
    revalidation: 0,
    total: 0,
  };
}

async function timeAffiliateDiscoveredSetImportPhase<
  Phase extends keyof Omit<AffiliateDiscoveredSetImportPhaseTimings, 'total'>,
  Result,
>({
  callback,
  phase,
  phaseTimingsMs,
}: {
  callback: () => Promise<Result>;
  phase: Phase;
  phaseTimingsMs: AffiliateDiscoveredSetImportPhaseTimings;
}): Promise<Result> {
  const startedAt = Date.now();

  try {
    return await callback();
  } finally {
    phaseTimingsMs[phase] += Date.now() - startedAt;
  }
}

function getOfferSeedImportKey(
  input: Pick<CommerceOfferSeedInput, 'merchantId' | 'setId'>,
): string {
  return `${input.setId}:${input.merchantId}`;
}

async function upsertOfferSeedsForDiscoveredSetImports({
  bulkUpsertCommerceOfferSeedsByCompositeKeyFn,
  pendingOfferImports,
  upsertCommerceOfferSeedByCompositeKeyFn,
}: {
  bulkUpsertCommerceOfferSeedsByCompositeKeyFn?:
    | typeof bulkUpsertCommerceOfferSeedsByCompositeKey
    | undefined;
  pendingOfferImports: readonly PendingDiscoveredSetOfferImport[];
  upsertCommerceOfferSeedByCompositeKeyFn: typeof upsertCommerceOfferSeedByCompositeKey;
}): Promise<Map<string, CommerceOfferSeed>> {
  const seedByKey = new Map<string, CommerceOfferSeed>();

  if (bulkUpsertCommerceOfferSeedsByCompositeKeyFn) {
    const seedInputByKey = new Map<string, CommerceOfferSeedInput>();

    for (const pendingOfferImport of pendingOfferImports) {
      seedInputByKey.set(
        getOfferSeedImportKey(pendingOfferImport.seedInput),
        pendingOfferImport.seedInput,
      );
    }

    const upsertedSeeds = await bulkUpsertCommerceOfferSeedsByCompositeKeyFn({
      inputs: [...seedInputByKey.values()],
    });

    for (const upsertedSeed of upsertedSeeds) {
      seedByKey.set(getOfferSeedImportKey(upsertedSeed), upsertedSeed);
    }

    return seedByKey;
  }

  for (const pendingOfferImport of pendingOfferImports) {
    const upsertedSeed = await upsertCommerceOfferSeedByCompositeKeyFn({
      input: pendingOfferImport.seedInput,
    });

    seedByKey.set(
      getOfferSeedImportKey(pendingOfferImport.seedInput),
      upsertedSeed,
    );
  }

  return seedByKey;
}

async function upsertLatestOffersForDiscoveredSetImports({
  bulkUpsertCommerceOfferLatestRecordsFn,
  latestInputs,
  upsertCommerceOfferLatestRecordFn,
}: {
  bulkUpsertCommerceOfferLatestRecordsFn?:
    | typeof bulkUpsertCommerceOfferLatestRecords
    | undefined;
  latestInputs: readonly CommerceOfferLatestRecordInput[];
  upsertCommerceOfferLatestRecordFn: typeof upsertCommerceOfferLatestRecord;
}): Promise<void> {
  if (bulkUpsertCommerceOfferLatestRecordsFn) {
    const latestInputByOfferSeedId = new Map<
      string,
      CommerceOfferLatestRecordInput
    >();

    for (const latestInput of latestInputs) {
      latestInputByOfferSeedId.set(latestInput.offerSeedId, latestInput);
    }

    await bulkUpsertCommerceOfferLatestRecordsFn({
      inputs: [...latestInputByOfferSeedId.values()],
    });
    return;
  }

  for (const latestInput of latestInputs) {
    await upsertCommerceOfferLatestRecordFn({
      input: latestInput,
    });
  }
}

async function updateDiscoveredSetReviewStatesForImport({
  bulkUpdateDiscoveredSetReviewStatesFn,
  statusUpdates,
  updateDiscoveredSetReviewStateFn,
}: {
  bulkUpdateDiscoveredSetReviewStatesFn?:
    | typeof bulkUpdateCommerceAffiliateDiscoveredSetReviewStates
    | undefined;
  statusUpdates: readonly DiscoveredSetStatusUpdate[];
  updateDiscoveredSetReviewStateFn: typeof updateCommerceAffiliateDiscoveredSetReviewState;
}): Promise<void> {
  if (bulkUpdateDiscoveredSetReviewStatesFn) {
    await bulkUpdateDiscoveredSetReviewStatesFn({
      updates: statusUpdates,
    });
    return;
  }

  for (const statusUpdate of statusUpdates) {
    for (const discoveredSetId of statusUpdate.discoveredSetIds) {
      await updateDiscoveredSetReviewStateFn({
        discoveredSetId,
        importAttemptedAt: statusUpdate.importAttemptedAt,
        importError: statusUpdate.importError,
        importedSetId: statusUpdate.importedSetId,
        status: statusUpdate.status,
      });
    }
  }
}

export async function importAffiliateDiscoveredSets({
  dependencies = {},
  discoveredSetIds,
  highConfidenceOnly = false,
  maxBatchSize = AFFILIATE_DISCOVERED_SET_ADMIN_IMPORT_MAX_BATCH_SIZE,
}: {
  dependencies?: ImportAffiliateDiscoveredSetsDependencies;
  discoveredSetIds?: readonly string[];
  highConfidenceOnly?: boolean;
  maxBatchSize?: number;
} = {}): Promise<CommerceAffiliateDiscoveredSetImportResult> {
  const totalStartedAt = Date.now();
  const phaseTimingsMs = createEmptyAffiliateDiscoveredSetImportPhaseTimings();
  const {
    bulkUpdateDiscoveredSetReviewStatesFn,
    bulkUpsertCommerceOfferLatestRecordsFn,
    bulkUpsertCommerceOfferSeedsByCompositeKeyFn,
    createCatalogSetFn = createCatalogSet,
    enrichCatalogSetMinifigSummariesFn = enrichCatalogSetMinifigSummariesBestEffort,
    getNow = () => new Date(),
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listDiscoveredSetsFn = listCommerceAffiliateDiscoveredSets,
    searchCatalogMissingSetsFn = searchCatalogMissingSets,
    sleepFn = (durationMs) =>
      new Promise((resolve) => {
        setTimeout(resolve, durationMs);
      }),
    revalidatePublicCatalogPathsFn = revalidatePublicCatalogPaths,
    updateDiscoveredSetReviewStateFn = updateCommerceAffiliateDiscoveredSetReviewState,
    upsertCommerceOfferLatestRecordFn = upsertCommerceOfferLatestRecord,
    upsertCommerceOfferSeedByCompositeKeyFn = upsertCommerceOfferSeedByCompositeKey,
  } = dependencies;
  const activeBulkUpdateDiscoveredSetReviewStatesFn =
    bulkUpdateDiscoveredSetReviewStatesFn ??
    (dependencies.updateDiscoveredSetReviewStateFn
      ? undefined
      : bulkUpdateCommerceAffiliateDiscoveredSetReviewStates);
  const activeBulkUpsertCommerceOfferLatestRecordsFn =
    bulkUpsertCommerceOfferLatestRecordsFn ??
    (dependencies.upsertCommerceOfferLatestRecordFn
      ? undefined
      : bulkUpsertCommerceOfferLatestRecords);
  const activeBulkUpsertCommerceOfferSeedsByCompositeKeyFn =
    bulkUpsertCommerceOfferSeedsByCompositeKeyFn ??
    (dependencies.upsertCommerceOfferSeedByCompositeKeyFn
      ? undefined
      : bulkUpsertCommerceOfferSeedsByCompositeKey);
  const requestedIds = new Set(discoveredSetIds ?? []);
  const allRequestedDiscoveredSets = (
    await listDiscoveredSetsFn({
      status: 'new',
      ...(highConfidenceOnly ? { confidence: 'high' } : {}),
    })
  ).filter(
    (discoveredSet) =>
      requestedIds.size === 0 || requestedIds.has(discoveredSet.id),
  );
  const safeMaxBatchSize = Math.max(1, maxBatchSize);
  const discoveredSets = allRequestedDiscoveredSets.slice(0, safeMaxBatchSize);
  const observedAt = getNow().toISOString();
  const catalogSetById = await timeAffiliateDiscoveredSetImportPhase({
    callback: async () =>
      new Map(
        (await listCanonicalCatalogSetsFn()).map(
          (catalogSet) => [catalogSet.setId, catalogSet] as const,
        ),
      ),
    phase: 'catalogLoad',
    phaseTimingsMs,
  });
  let alreadyCatalogedCount = 0;
  let attachedOfferCount = 0;
  let createdCatalogSetCount = 0;
  let failedLookupCount = 0;
  let importedCount = 0;
  let skippedCount = allRequestedDiscoveredSets.length - discoveredSets.length;
  const importedStatusUpdates: DiscoveredSetStatusUpdate[] = [];
  const pendingOfferImports: PendingDiscoveredSetOfferImport[] = [];

  const discoveredSetsBySetId = groupDiscoveredSetsBySetId(
    discoveredSets.filter((discoveredSet) => {
      if (highConfidenceOnly && discoveredSet.confidence !== 'high') {
        skippedCount += 1;
        return false;
      }

      return true;
    }),
  );

  for (const setDiscoveredSets of discoveredSetsBySetId.values()) {
    const [representativeDiscoveredSet] = setDiscoveredSets;
    const catalogResolution = await timeAffiliateDiscoveredSetImportPhase({
      callback: () =>
        resolveCatalogSetForDiscoveredSet({
          catalogSetById,
          createCatalogSetFn,
          discoveredSet: representativeDiscoveredSet,
          searchCatalogMissingSetsFn,
          sleepFn,
        }),
      phase: 'catalogResolve',
      phaseTimingsMs,
    });

    if (!catalogResolution.catalogSet) {
      failedLookupCount += setDiscoveredSets.length;
      skippedCount += setDiscoveredSets.length;

      await timeAffiliateDiscoveredSetImportPhase({
        callback: () =>
          updateDiscoveredSetReviewStatesForImport({
            bulkUpdateDiscoveredSetReviewStatesFn:
              activeBulkUpdateDiscoveredSetReviewStatesFn,
            statusUpdates: [
              {
                discoveredSetIds: setDiscoveredSets.map(
                  (discoveredSet) => discoveredSet.id,
                ),
                importAttemptedAt: observedAt,
                importError:
                  catalogResolution.error ??
                  `Unable to resolve ${representativeDiscoveredSet.normalizedSetId} during import.`,
                status: 'new',
              },
            ],
            updateDiscoveredSetReviewStateFn,
          }),
        phase: 'statusUpdate',
        phaseTimingsMs,
      });
      continue;
    }

    if (catalogResolution.created) {
      createdCatalogSetCount += 1;

      try {
        const enrichment = await timeAffiliateDiscoveredSetImportPhase({
          callback: () =>
            enrichCatalogSetMinifigSummariesFn({
              setIds: [catalogResolution.catalogSet.setId],
            }),
          phase: 'enrichment',
          phaseTimingsMs,
        });

        const revalidationTarget = catalogResolution.catalogSet;

        if (
          enrichment.changedSetIds.length > 0 &&
          isCatalogSetWithPublicSurface(revalidationTarget)
        ) {
          await timeAffiliateDiscoveredSetImportPhase({
            callback: () =>
              revalidatePublicCatalogPathsFn({
                includeDeals: false,
                includeHome: false,
                includeThemeDirectory: false,
                reason: 'affiliate_discovered_set_minifig_enrichment',
                targets: [revalidationTarget],
              }),
            phase: 'revalidation',
            phaseTimingsMs,
          });
        }
      } catch (error) {
        console.warn(
          error instanceof Error
            ? error.message
            : 'Catalog minifig enrichment failed after affiliate discovered set import.',
        );
      }
    } else {
      alreadyCatalogedCount += 1;
    }

    for (const discoveredSet of setDiscoveredSets) {
      pendingOfferImports.push({
        catalogSetId: catalogResolution.catalogSet.setId,
        discoveredSet,
        seedInput: {
          setId: catalogResolution.catalogSet.setId,
          merchantId: discoveredSet.affiliate.id,
          productUrl: discoveredSet.productUrl,
          isActive: true,
          validationStatus: 'valid',
          lastVerifiedAt: observedAt,
          notes:
            'Imported from the affiliate discovered sets review queue. Raw feed payload remains on the discovered set row.',
        },
      });
    }

    importedStatusUpdates.push({
      discoveredSetIds: setDiscoveredSets.map(
        (discoveredSet) => discoveredSet.id,
      ),
      importAttemptedAt: observedAt,
      importError: null,
      importedSetId: catalogResolution.catalogSet.setId,
      status: 'imported',
    });
  }

  const seedByKey = await timeAffiliateDiscoveredSetImportPhase({
    callback: () =>
      upsertOfferSeedsForDiscoveredSetImports({
        bulkUpsertCommerceOfferSeedsByCompositeKeyFn:
          activeBulkUpsertCommerceOfferSeedsByCompositeKeyFn,
        pendingOfferImports,
        upsertCommerceOfferSeedByCompositeKeyFn,
      }),
    phase: 'seedUpsert',
    phaseTimingsMs,
  });
  const latestInputs: CommerceOfferLatestRecordInput[] = [];

  for (const pendingOfferImport of pendingOfferImports) {
    const offerSeed = seedByKey.get(
      getOfferSeedImportKey(pendingOfferImport.seedInput),
    );

    if (
      !offerSeed ||
      typeof pendingOfferImport.discoveredSet.priceMinor !== 'number' ||
      !pendingOfferImport.discoveredSet.currencyCode
    ) {
      continue;
    }

    latestInputs.push({
      offerSeedId: offerSeed.id,
      fetchStatus: 'success',
      priceMinor: pendingOfferImport.discoveredSet.priceMinor,
      currencyCode: pendingOfferImport.discoveredSet.currencyCode,
      availability: 'unknown',
      observedAt,
      fetchedAt: observedAt,
    });
  }

  await timeAffiliateDiscoveredSetImportPhase({
    callback: () =>
      upsertLatestOffersForDiscoveredSetImports({
        bulkUpsertCommerceOfferLatestRecordsFn:
          activeBulkUpsertCommerceOfferLatestRecordsFn,
        latestInputs,
        upsertCommerceOfferLatestRecordFn,
      }),
    phase: 'latestUpsert',
    phaseTimingsMs,
  });

  await timeAffiliateDiscoveredSetImportPhase({
    callback: () =>
      updateDiscoveredSetReviewStatesForImport({
        bulkUpdateDiscoveredSetReviewStatesFn:
          activeBulkUpdateDiscoveredSetReviewStatesFn,
        statusUpdates: importedStatusUpdates,
        updateDiscoveredSetReviewStateFn,
      }),
    phase: 'statusUpdate',
    phaseTimingsMs,
  });

  attachedOfferCount += pendingOfferImports.length;
  importedCount += pendingOfferImports.length;
  phaseTimingsMs.total = Date.now() - totalStartedAt;

  return {
    alreadyCatalogedCount,
    attachedOfferCount,
    createdCatalogSetCount,
    failedLookupCount,
    importedCount,
    phaseTimingsMs,
    requestedCount: allRequestedDiscoveredSets.length,
    skippedCount,
    uniqueSetCount: discoveredSetsBySetId.size,
  };
}

export async function updateAffiliateDiscoveredSetStatus({
  discoveredSetId,
  status,
}: {
  discoveredSetId: string;
  status: Exclude<CommerceAffiliateDiscoveredSetStatus, 'imported'>;
}): Promise<CommerceAffiliateDiscoveredSet> {
  return updateCommerceAffiliateDiscoveredSetReviewState({
    discoveredSetId,
    status,
  });
}
