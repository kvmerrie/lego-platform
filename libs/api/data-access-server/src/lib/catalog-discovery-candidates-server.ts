import {
  createCatalogSet,
  searchCatalogMissingSets,
  upsertCatalogDiscoveryCandidates,
  type CatalogDiscoveryCandidate,
  type CatalogDiscoveryCandidateConfidence,
  type CatalogDiscoveryCandidateInput,
} from '@lego-platform/catalog/data-access-server';
import {
  getCanonicalCatalogSetId,
  type CatalogExternalSetSearchResult,
} from '@lego-platform/catalog/util';
import {
  lookupBricksetSetMetadata,
  type BricksetSetMetadataLookupResult,
} from './brickset-enrichment-sync-server';

export interface CatalogDiscoverySourceCandidate {
  availability?: string;
  category?: string;
  confidence: string;
  currency?: string;
  feedFilename: string;
  imageUrl?: string;
  price?: string;
  productId?: string;
  productTitle?: string;
  productUrl: string;
  reason: string;
  setNumber: string;
  source: string;
}

export interface CatalogDiscoveryCandidatePipelineDependencies {
  createCatalogSetFn?: typeof createCatalogSet;
  getNow?: () => Date;
  lookupBricksetSetMetadataFn?: typeof lookupBricksetSetMetadata;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
  upsertCatalogDiscoveryCandidatesFn?: typeof upsertCatalogDiscoveryCandidates;
}

export interface CatalogDiscoveryCandidatePipelineOptions {
  autoCreateHighConfidenceCatalogSets?: boolean;
  bricksetApiKey?: string;
  fetchFn?: typeof fetch;
}

export interface CatalogDiscoveryCandidatePipelineResult {
  autoCreateAttemptedCount: number;
  createdCatalogSetCount: number;
  highConfidenceCount: number;
  persistedCandidateCount: number;
  skippedAutoCreateCount: number;
  uniqueCandidateCount: number;
}

function normalizeSourceSetNumber(setNumber: string): string {
  const trimmedSetNumber = setNumber.trim();

  if (!trimmedSetNumber) {
    return '';
  }

  return /-\d+$/u.test(trimmedSetNumber)
    ? trimmedSetNumber
    : `${trimmedSetNumber}-1`;
}

function findExactRebrickableResult({
  candidates,
  normalizedSetId,
  sourceSetNumber,
}: {
  candidates: readonly CatalogExternalSetSearchResult[];
  normalizedSetId: string;
  sourceSetNumber: string;
}): CatalogExternalSetSearchResult | undefined {
  return candidates.find(
    (candidate) =>
      candidate.setId === normalizedSetId ||
      candidate.sourceSetNumber === sourceSetNumber,
  );
}

function hasRequiredCatalogFields(
  rebrickableResult: CatalogExternalSetSearchResult | undefined,
): rebrickableResult is CatalogExternalSetSearchResult {
  return Boolean(
    rebrickableResult?.setId &&
      rebrickableResult.sourceSetNumber &&
      rebrickableResult.name.trim() &&
      rebrickableResult.slug.trim() &&
      rebrickableResult.theme.trim() &&
      Boolean(rebrickableResult.imageUrl?.trim()) &&
      Number.isInteger(rebrickableResult.releaseYear) &&
      rebrickableResult.releaseYear > 0 &&
      Number.isInteger(rebrickableResult.pieces) &&
      rebrickableResult.pieces >= 0,
  );
}

function normalizeTitleForComparison(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\blego\b/gu, ' ')
    .replace(/\b\d{4,6}(?:-\d+)?\b/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function getTitleMatchScore({
  feedTitle,
  rebrickableTitle,
}: {
  feedTitle?: string;
  rebrickableTitle?: string;
}): number {
  const normalizedFeedTitle = normalizeTitleForComparison(feedTitle);
  const normalizedRebrickableTitle =
    normalizeTitleForComparison(rebrickableTitle);

  if (!normalizedFeedTitle || !normalizedRebrickableTitle) {
    return 0;
  }

  if (
    normalizedFeedTitle.includes(normalizedRebrickableTitle) ||
    normalizedRebrickableTitle.includes(normalizedFeedTitle)
  ) {
    return 12;
  }

  const feedTokens = new Set(normalizedFeedTitle.split(' '));
  const rebrickableTokens = normalizedRebrickableTitle
    .split(' ')
    .filter((token) => token.length > 2);
  const matchedTokenCount = rebrickableTokens.filter((token) =>
    feedTokens.has(token),
  ).length;

  return rebrickableTokens.length > 0 &&
    matchedTokenCount / rebrickableTokens.length >= 0.6
    ? 8
    : 0;
}

function isPriorityLaunchTheme(theme: string | undefined): boolean {
  return /^(icons|star wars|pok[eé]mon|seasonal)$/iu.test(theme?.trim() ?? '');
}

function parsePriceMinor(price: string | undefined): number | undefined {
  if (!price) {
    return undefined;
  }

  const normalizedPrice = Number(price.replace(',', '.'));

  return Number.isFinite(normalizedPrice) && normalizedPrice > 0
    ? Math.round(normalizedPrice * 100)
    : undefined;
}

function scoreCatalogDiscoveryCandidate({
  bricksetMatched,
  imageAvailable,
  priorityLaunchTheme,
  rebrickableExact,
  requiredFieldsPresent,
  titleMatchScore,
}: {
  bricksetMatched: boolean;
  imageAvailable: boolean;
  priorityLaunchTheme: boolean;
  rebrickableExact: boolean;
  requiredFieldsPresent: boolean;
  titleMatchScore: number;
}): {
  confidence: CatalogDiscoveryCandidateConfidence;
  score: number;
} {
  const score = Math.min(
    100,
    35 +
      (rebrickableExact ? 45 : 0) +
      (bricksetMatched ? 15 : 0) +
      (requiredFieldsPresent ? 5 : 0) +
      (imageAvailable ? 5 : 0) +
      (priorityLaunchTheme ? 3 : 0) +
      titleMatchScore,
  );

  if (
    score >= 85 &&
    rebrickableExact &&
    requiredFieldsPresent &&
    imageAvailable &&
    titleMatchScore > 0
  ) {
    return {
      confidence: 'high',
      score,
    };
  }

  if (score >= 60 && rebrickableExact) {
    return {
      confidence: 'medium',
      score,
    };
  }

  return {
    confidence: 'low',
    score,
  };
}

function toCandidateInput({
  bricksetRecordBySetNumber,
  candidate,
  now,
  rebrickableResult,
}: {
  bricksetRecordBySetNumber: ReadonlyMap<
    string,
    BricksetSetMetadataLookupResult['metadataRecords'][number]
  >;
  candidate: CatalogDiscoverySourceCandidate;
  now: string;
  rebrickableResult?: CatalogExternalSetSearchResult;
}): {
  input: CatalogDiscoveryCandidateInput;
  rebrickableResult?: CatalogExternalSetSearchResult;
} {
  const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);
  const sourceSetNumber = normalizeSourceSetNumber(candidate.setNumber);
  const bricksetRecord = bricksetRecordBySetNumber.get(sourceSetNumber);
  const sourcePriceMinor = parsePriceMinor(candidate.price);
  const requiredFieldsPresent = hasRequiredCatalogFields(rebrickableResult);
  const titleMatchScore = getTitleMatchScore({
    feedTitle: candidate.productTitle,
    rebrickableTitle: rebrickableResult?.name,
  });
  const scored = scoreCatalogDiscoveryCandidate({
    bricksetMatched: Boolean(bricksetRecord),
    imageAvailable: Boolean(rebrickableResult?.imageUrl?.trim()),
    priorityLaunchTheme: isPriorityLaunchTheme(rebrickableResult?.theme),
    rebrickableExact: Boolean(rebrickableResult),
    requiredFieldsPresent,
    titleMatchScore,
  });

  return {
    input: {
      autoCreateEligible: scored.confidence === 'high' && requiredFieldsPresent,
      ...(bricksetRecord
        ? { bricksetPayload: bricksetRecord.metadataJson }
        : {}),
      confidence: scored.confidence,
      confidenceScore: scored.score,
      evidence: {
        bricksetExactMatch: Boolean(bricksetRecord),
        imageAvailable: Boolean(rebrickableResult?.imageUrl?.trim()),
        priorityLaunchTheme: isPriorityLaunchTheme(rebrickableResult?.theme),
        rakutenStrictCandidate: true,
        rebrickableExactMatch: Boolean(rebrickableResult),
        titleMatchScore,
      },
      firstSeenAt: now,
      lastSeenAt: now,
      normalizedSetId,
      ...(rebrickableResult
        ? {
            rebrickablePayload: {
              imageUrl: rebrickableResult.imageUrl,
              name: rebrickableResult.name,
              pieces: rebrickableResult.pieces,
              releaseDate: rebrickableResult.releaseDate,
              releaseDatePrecision: rebrickableResult.releaseDatePrecision,
              releaseYear: rebrickableResult.releaseYear,
              setId: rebrickableResult.setId,
              slug: rebrickableResult.slug,
              source: rebrickableResult.source,
              sourceSetNumber: rebrickableResult.sourceSetNumber,
              theme: rebrickableResult.theme,
            },
          }
        : {}),
      requiredFieldsPresent,
      source: candidate.source,
      ...(candidate.currency ? { sourceCurrencyCode: candidate.currency } : {}),
      ...(candidate.imageUrl ? { sourceImageUrl: candidate.imageUrl } : {}),
      sourcePayload: {
        availability: candidate.availability,
        category: candidate.category,
        confidence: candidate.confidence,
        feedFilename: candidate.feedFilename,
        productId: candidate.productId,
        reason: candidate.reason,
      },
      ...(sourcePriceMinor ? { sourcePriceMinor } : {}),
      ...(candidate.productTitle
        ? { sourceProductTitle: candidate.productTitle }
        : {}),
      sourceProductUrl: candidate.productUrl,
      sourceSetNumber,
      status: 'new',
    },
    ...(rebrickableResult ? { rebrickableResult } : {}),
  };
}

export async function buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
  candidates,
  dependencies = {},
  options = {},
}: {
  candidates: readonly CatalogDiscoverySourceCandidate[];
  dependencies?: CatalogDiscoveryCandidatePipelineDependencies;
  options?: CatalogDiscoveryCandidatePipelineOptions;
}): Promise<CatalogDiscoveryCandidatePipelineResult> {
  const {
    createCatalogSetFn = createCatalogSet,
    getNow = () => new Date(),
    lookupBricksetSetMetadataFn = lookupBricksetSetMetadata,
    searchCatalogMissingSetsFn = searchCatalogMissingSets,
    upsertCatalogDiscoveryCandidatesFn = upsertCatalogDiscoveryCandidates,
  } = dependencies;
  const candidateBySetId = new Map<string, CatalogDiscoverySourceCandidate>();

  for (const candidate of candidates) {
    const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);

    if (!normalizedSetId || candidateBySetId.has(normalizedSetId)) {
      continue;
    }

    candidateBySetId.set(normalizedSetId, candidate);
  }

  const uniqueCandidates = [...candidateBySetId.values()];
  const sourceSetNumbers = uniqueCandidates.map((candidate) =>
    normalizeSourceSetNumber(candidate.setNumber),
  );
  const bricksetLookup = await lookupBricksetSetMetadataFn({
    ...(options.bricksetApiKey
      ? { bricksetApiKey: options.bricksetApiKey }
      : {}),
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    includeAdditionalImages: false,
    setNumbers: sourceSetNumbers,
  });
  const bricksetRecordBySetNumber = new Map(
    bricksetLookup.metadataRecords.map((record) => [
      normalizeSourceSetNumber(record.setNumber),
      record,
    ]),
  );
  const now = getNow().toISOString();
  const inputs: CatalogDiscoveryCandidateInput[] = [];
  const inputBySetId = new Map<string, CatalogDiscoveryCandidateInput>();
  const rebrickableResultBySetId = new Map<
    string,
    CatalogExternalSetSearchResult
  >();

  for (const candidate of uniqueCandidates) {
    const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);
    const sourceSetNumber = normalizeSourceSetNumber(candidate.setNumber);
    const rebrickableResult = findExactRebrickableResult({
      candidates: await searchCatalogMissingSetsFn({
        ...(options.fetchFn ? { fetchImpl: options.fetchFn } : {}),
        query: normalizedSetId,
      }),
      normalizedSetId,
      sourceSetNumber,
    });
    const candidateInput = toCandidateInput({
      bricksetRecordBySetNumber,
      candidate,
      now,
      rebrickableResult,
    });

    inputs.push(candidateInput.input);
    inputBySetId.set(
      candidateInput.input.normalizedSetId,
      candidateInput.input,
    );

    if (candidateInput.rebrickableResult) {
      rebrickableResultBySetId.set(
        candidateInput.input.normalizedSetId,
        candidateInput.rebrickableResult,
      );
    }
  }

  const persistedCandidates = await upsertCatalogDiscoveryCandidatesFn({
    inputs,
  });
  let autoCreateAttemptedCount = 0;
  let createdCatalogSetCount = 0;
  let skippedAutoCreateCount = 0;

  if (options.autoCreateHighConfidenceCatalogSets) {
    for (const persistedCandidate of persistedCandidates) {
      const rebrickableResult = rebrickableResultBySetId.get(
        persistedCandidate.normalizedSetId,
      );

      if (
        persistedCandidate.confidence !== 'high' ||
        !persistedCandidate.requiredFieldsPresent ||
        !rebrickableResult
      ) {
        skippedAutoCreateCount += 1;
        continue;
      }

      autoCreateAttemptedCount += 1;

      try {
        const catalogSet = await createCatalogSetFn({
          ...(options.fetchFn ? { fetchImpl: options.fetchFn } : {}),
          input: rebrickableResult,
        });
        const originalInput = inputBySetId.get(
          persistedCandidate.normalizedSetId,
        );

        if (originalInput) {
          await upsertCatalogDiscoveryCandidatesFn({
            inputs: [
              {
                ...originalInput,
                importedSetId: catalogSet.setId,
                importError: null,
                status: 'imported',
              },
            ],
          });
        }

        createdCatalogSetCount += 1;
      } catch (error) {
        const originalInput = inputBySetId.get(
          persistedCandidate.normalizedSetId,
        );

        if (originalInput) {
          await upsertCatalogDiscoveryCandidatesFn({
            inputs: [
              {
                ...originalInput,
                importError:
                  error instanceof Error
                    ? error.message
                    : 'Catalog discovery candidate auto-create failed.',
                status: 'new',
              },
            ],
          });
        }

        skippedAutoCreateCount += 1;
      }
    }
  } else {
    skippedAutoCreateCount = persistedCandidates.length;
  }

  return {
    autoCreateAttemptedCount,
    createdCatalogSetCount,
    highConfidenceCount: persistedCandidates.filter(
      (candidate: CatalogDiscoveryCandidate) => candidate.confidence === 'high',
    ).length,
    persistedCandidateCount: persistedCandidates.length,
    skippedAutoCreateCount,
    uniqueCandidateCount: uniqueCandidates.length,
  };
}
