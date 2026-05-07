import {
  createCatalogSet,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
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
} from '@lego-platform/commerce/util';

export interface ImportAffiliateDiscoveredSetsDependencies {
  createCatalogSetFn?: typeof createCatalogSet;
  getNow?: () => Date;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listDiscoveredSetsFn?: typeof listCommerceAffiliateDiscoveredSets;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
  sleepFn?: (durationMs: number) => Promise<void>;
  updateDiscoveredSetReviewStateFn?: typeof updateCommerceAffiliateDiscoveredSetReviewState;
  upsertCommerceOfferLatestRecordFn?: typeof upsertCommerceOfferLatestRecord;
  upsertCommerceOfferSeedByCompositeKeyFn?: typeof upsertCommerceOfferSeedByCompositeKey;
}

export const AFFILIATE_DISCOVERED_SET_ADMIN_IMPORT_MAX_BATCH_SIZE = 50;
const REBRICKABLE_LOOKUP_MAX_ATTEMPTS = 3;
const REBRICKABLE_LOOKUP_RETRY_BASE_DELAY_MS = 500;

type ResolvedCatalogSet = CatalogSet | { setId: string };

interface CatalogSetResolution {
  catalogSet?: ResolvedCatalogSet;
  created: boolean;
  error?: string;
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
  const {
    createCatalogSetFn = createCatalogSet,
    getNow = () => new Date(),
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listDiscoveredSetsFn = listCommerceAffiliateDiscoveredSets,
    searchCatalogMissingSetsFn = searchCatalogMissingSets,
    sleepFn = (durationMs) =>
      new Promise((resolve) => {
        setTimeout(resolve, durationMs);
      }),
    updateDiscoveredSetReviewStateFn = updateCommerceAffiliateDiscoveredSetReviewState,
    upsertCommerceOfferLatestRecordFn = upsertCommerceOfferLatestRecord,
    upsertCommerceOfferSeedByCompositeKeyFn = upsertCommerceOfferSeedByCompositeKey,
  } = dependencies;
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
  const catalogSetById = new Map(
    (await listCanonicalCatalogSetsFn()).map(
      (catalogSet) => [catalogSet.setId, catalogSet] as const,
    ),
  );
  let alreadyCatalogedCount = 0;
  let attachedOfferCount = 0;
  let createdCatalogSetCount = 0;
  let failedLookupCount = 0;
  let importedCount = 0;
  let skippedCount = allRequestedDiscoveredSets.length - discoveredSets.length;

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
    const catalogResolution = await resolveCatalogSetForDiscoveredSet({
      catalogSetById,
      createCatalogSetFn,
      discoveredSet: representativeDiscoveredSet,
      searchCatalogMissingSetsFn,
      sleepFn,
    });

    if (!catalogResolution.catalogSet) {
      failedLookupCount += setDiscoveredSets.length;
      skippedCount += setDiscoveredSets.length;

      await Promise.all(
        setDiscoveredSets.map((discoveredSet) =>
          updateDiscoveredSetReviewStateFn({
            discoveredSetId: discoveredSet.id,
            importAttemptedAt: observedAt,
            importError:
              catalogResolution.error ??
              `Unable to resolve ${discoveredSet.normalizedSetId} during import.`,
            status: 'new',
          }),
        ),
      );
      continue;
    }

    if (catalogResolution.created) {
      createdCatalogSetCount += 1;
    } else {
      alreadyCatalogedCount += 1;
    }

    for (const discoveredSet of setDiscoveredSets) {
      const offerSeed = await upsertCommerceOfferSeedByCompositeKeyFn({
        input: {
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

      if (
        typeof discoveredSet.priceMinor === 'number' &&
        discoveredSet.currencyCode
      ) {
        await upsertCommerceOfferLatestRecordFn({
          input: {
            offerSeedId: offerSeed.id,
            fetchStatus: 'success',
            priceMinor: discoveredSet.priceMinor,
            currencyCode: discoveredSet.currencyCode,
            availability: 'unknown',
            observedAt,
            fetchedAt: observedAt,
          },
        });
      }

      await updateDiscoveredSetReviewStateFn({
        discoveredSetId: discoveredSet.id,
        importAttemptedAt: observedAt,
        importError: null,
        importedSetId: catalogResolution.catalogSet.setId,
        status: 'imported',
      });

      attachedOfferCount += 1;
      importedCount += 1;
    }
  }

  return {
    alreadyCatalogedCount,
    attachedOfferCount,
    createdCatalogSetCount,
    failedLookupCount,
    importedCount,
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
