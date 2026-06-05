import {
  createCatalogSet,
  getLocalRebrickableSetMirrorMetadata,
  listCatalogDiscoveryCandidates,
  listCatalogDiscoveryCandidatesBySetIds,
  searchCatalogMissingSets,
  upsertCatalogDiscoveryCandidates,
  type CatalogDiscoveryCandidate,
  type CatalogDiscoveryCandidateConfidence,
  type CatalogDiscoveryCandidateInput,
  type CatalogDiscoveryCandidateStatus,
  type LocalRebrickableSetMirrorMetadata,
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
  getLocalRebrickableSetMirrorMetadataFn?: typeof getLocalRebrickableSetMirrorMetadata;
  listCatalogDiscoveryCandidatesBySetIdsFn?: typeof listCatalogDiscoveryCandidatesBySetIds;
  lookupBricksetSetMetadataFn?: typeof lookupBricksetSetMetadata;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
  upsertCatalogDiscoveryCandidatesFn?: typeof upsertCatalogDiscoveryCandidates;
}

export const CATALOG_DISCOVERY_DEFAULT_MAX_ENRICHMENT_LOOKUPS = 25;

export interface CatalogDiscoveryCandidatePipelineOptions {
  autoCreateHighConfidenceCatalogSets?: boolean;
  bricksetApiKey?: string;
  enrichMissingSets?: boolean;
  fetchFn?: typeof fetch;
  maxEnrichmentLookups?: number;
  onlyNewCandidates?: boolean;
  setIds?: readonly string[];
  skipExistingCandidates?: boolean;
}

export interface CatalogDiscoveryCandidatePipelineResult {
  autoCreateAttemptedCount: number;
  createdCatalogSetCount: number;
  enrichmentEnabled: boolean;
  enrichmentLookupCount: number;
  enrichmentSkippedExistingCount: number;
  existingCandidateHitCount: number;
  highConfidenceCount: number;
  persistedCandidateCount: number;
  rebrickable429Count: number;
  skippedAutoCreateCount: number;
  uniqueCandidateCount: number;
}

export interface RecomputeCatalogDiscoveryCandidateConfidenceResult {
  highCount: number;
  lowCount: number;
  mediumCount: number;
  modifiedCount: number;
  processedCount: number;
  skippedCount: number;
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

function isLikelyRebrickableRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('429') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('too many requests')
  );
}

async function lookupLocalRebrickableMirrorBestEffort({
  getLocalRebrickableSetMirrorMetadataFn,
  setNumberOrId,
}: {
  getLocalRebrickableSetMirrorMetadataFn: typeof getLocalRebrickableSetMirrorMetadata;
  setNumberOrId: string;
}): Promise<LocalRebrickableSetMirrorMetadata | undefined> {
  try {
    return await getLocalRebrickableSetMirrorMetadataFn({
      setNumberOrId,
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `[catalog-discovery] local_rebrickable_mirror_unavailable ${error.message}`
        : '[catalog-discovery] local_rebrickable_mirror_unavailable',
    );

    return undefined;
  }
}

function toCachedRebrickableResult(
  payload: Readonly<Record<string, unknown>> | undefined,
): CatalogExternalSetSearchResult | undefined {
  if (!payload) {
    return undefined;
  }

  const setId = typeof payload['setId'] === 'string' ? payload['setId'] : '';
  const sourceSetNumber =
    typeof payload['sourceSetNumber'] === 'string'
      ? payload['sourceSetNumber']
      : '';
  const name = typeof payload['name'] === 'string' ? payload['name'] : '';
  const slug = typeof payload['slug'] === 'string' ? payload['slug'] : '';
  const theme = typeof payload['theme'] === 'string' ? payload['theme'] : '';
  const pieces =
    typeof payload['pieces'] === 'number' ? Math.floor(payload['pieces']) : NaN;
  const releaseYear =
    typeof payload['releaseYear'] === 'number'
      ? Math.floor(payload['releaseYear'])
      : NaN;

  if (
    !setId ||
    !sourceSetNumber ||
    !name ||
    !slug ||
    !theme ||
    !Number.isInteger(pieces) ||
    !Number.isInteger(releaseYear)
  ) {
    return undefined;
  }

  return {
    ...(typeof payload['imageUrl'] === 'string'
      ? { imageUrl: payload['imageUrl'] }
      : {}),
    name,
    pieces,
    ...(typeof payload['releaseDate'] === 'string'
      ? { releaseDate: payload['releaseDate'] }
      : {}),
    releaseYear,
    setId,
    slug,
    source: 'rebrickable',
    sourceSetNumber,
    theme,
  };
}

function scoreCatalogDiscoveryCandidate({
  bricksetMatched,
  imageAvailable,
  localMirrorExact,
  priorityLaunchTheme,
  rebrickableExact,
  requiredFieldsPresent,
  titleMatchScore,
}: {
  bricksetMatched: boolean;
  imageAvailable: boolean;
  localMirrorExact: boolean;
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
      (localMirrorExact ? 45 : 0) +
      (bricksetMatched ? 15 : 0) +
      (requiredFieldsPresent ? 5 : 0) +
      (imageAvailable ? 5 : 0) +
      (priorityLaunchTheme ? 3 : 0) +
      titleMatchScore,
  );

  if (
    score >= 85 &&
    (rebrickableExact || localMirrorExact) &&
    requiredFieldsPresent &&
    imageAvailable &&
    titleMatchScore > 0
  ) {
    return {
      confidence: 'high',
      score,
    };
  }

  if (score >= 60 && (rebrickableExact || localMirrorExact)) {
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

const TRUSTED_RAKUTEN_LEGO_SOURCE = 'rakuten-lego-eu';
const LEGO_LIKE_SET_NUMBER_PATTERN = /^\d{5,6}(?:-\d+)?$/u;
const LIKELY_POWERED_UP_PART_PATTERN =
  /\b(afstandsbediening|remote control|remote|powered[\s-]?up|motor|hub|battery box|batterijbox|lichtsteen|light brick)\b/iu;
const LIKELY_ACCESSORY_PATTERN =
  /\b(zwaard|sword|sleutelhanger|keychain|peper[\s-]?en[\s-]?zout(?:set)?|salt|pepper|mok|mug|beker|rugzak|backpack|tas|bag|display case|vitrine|opberg|storage|accessoire|accessory|gear|kostuum|costume)\b/iu;
const BRICKLINK_DESIGNER_PROGRAM_PATTERN =
  /\b(bricklink|designer program|bdp|limited edition|limited case|crowdfunding|crowdfunded)\b/iu;

function hasValidLegoLikeSetNumber(value: string): boolean {
  return LEGO_LIKE_SET_NUMBER_PATTERN.test(value.trim());
}

function resolveOperatorConfidence({
  bricksetMatched,
  candidate,
  localMirrorExact,
  rebrickableExact,
  requiredFieldsPresent,
  titleMatchScore,
}: {
  bricksetMatched: boolean;
  candidate: CatalogDiscoverySourceCandidate;
  localMirrorExact: boolean;
  rebrickableExact: boolean;
  requiredFieldsPresent: boolean;
  titleMatchScore: number;
}): {
  confidence: CatalogDiscoveryCandidateConfidence;
  reasons: readonly string[];
} {
  const reasons: string[] = [];
  const title = candidate.productTitle?.trim() ?? '';
  const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);
  const sourceSetNumber = normalizeSourceSetNumber(candidate.setNumber);
  const trustedRakutenSource = candidate.source === TRUSTED_RAKUTEN_LEGO_SOURCE;
  const validSetNumber =
    hasValidLegoLikeSetNumber(normalizedSetId) ||
    hasValidLegoLikeSetNumber(sourceSetNumber);

  if (localMirrorExact) {
    reasons.push('local_rebrickable_mirror_match');
  }

  if (rebrickableExact || bricksetMatched) {
    reasons.push('exact_enriched_match');
  }

  if (!localMirrorExact && !rebrickableExact && !bricksetMatched) {
    reasons.push('missing_enrichment');
  }

  if (!title) {
    reasons.push('missing_title');
  }

  if (!validSetNumber) {
    reasons.push('ambiguous_set_number');
  }

  if (LIKELY_POWERED_UP_PART_PATTERN.test(title)) {
    reasons.push('likely_powered_up_part');
  } else if (LIKELY_ACCESSORY_PATTERN.test(title)) {
    reasons.push('likely_accessory');
  }

  if (BRICKLINK_DESIGNER_PROGRAM_PATTERN.test(title)) {
    reasons.push('bricklink_designer_program');
  }

  const hasLowReason = reasons.some((reason) =>
    [
      'ambiguous_set_number',
      'bricklink_designer_program',
      'likely_accessory',
      'likely_powered_up_part',
      'missing_title',
    ].includes(reason),
  );

  if (hasLowReason) {
    return {
      confidence: 'low',
      reasons,
    };
  }

  if (
    (localMirrorExact || rebrickableExact || bricksetMatched) &&
    requiredFieldsPresent &&
    titleMatchScore > 0
  ) {
    return {
      confidence: 'high',
      reasons,
    };
  }

  if (
    (localMirrorExact || rebrickableExact || bricksetMatched) &&
    requiredFieldsPresent
  ) {
    return {
      confidence: 'medium',
      reasons,
    };
  }

  if (trustedRakutenSource && validSetNumber && title) {
    return {
      confidence: 'medium',
      reasons: ['trusted_feed_valid_set_number', ...reasons],
    };
  }

  return {
    confidence: 'low',
    reasons: reasons.length > 0 ? reasons : ['weak_evidence'],
  };
}

function toCandidateInput({
  bricksetRecordBySetNumber,
  candidate,
  localMirrorMetadata,
  now,
  rebrickableResult,
}: {
  bricksetRecordBySetNumber: ReadonlyMap<
    string,
    BricksetSetMetadataLookupResult['metadataRecords'][number]
  >;
  candidate: CatalogDiscoverySourceCandidate;
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata;
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
    localMirrorExact: Boolean(localMirrorMetadata),
    priorityLaunchTheme: isPriorityLaunchTheme(rebrickableResult?.theme),
    rebrickableExact: Boolean(rebrickableResult),
    requiredFieldsPresent,
    titleMatchScore,
  });
  const operatorConfidence = resolveOperatorConfidence({
    bricksetMatched: Boolean(bricksetRecord),
    candidate,
    localMirrorExact: Boolean(localMirrorMetadata),
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
        ...(localMirrorMetadata
          ? {
              localRebrickableMirrorMatch: true,
              rebrickable_set_num: localMirrorMetadata.setNum,
              rebrickable_name: localMirrorMetadata.name,
              year: localMirrorMetadata.year,
              theme_id: localMirrorMetadata.themeId,
              num_parts: localMirrorMetadata.numParts,
              img_url:
                localMirrorMetadata.imgUrl ??
                localMirrorMetadata.setImgUrl ??
                null,
            }
          : { localRebrickableMirrorMatch: false }),
        operatorConfidence: operatorConfidence.confidence,
        operatorConfidenceReasons: operatorConfidence.reasons,
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

function buildRecomputedCandidateInput({
  candidate,
  localMirrorMetadata,
  now,
}: {
  candidate: CatalogDiscoveryCandidate;
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata;
  now: string;
}): CatalogDiscoveryCandidateInput {
  const rebrickableResult =
    localMirrorMetadata?.catalogSetInput ??
    toCachedRebrickableResult(candidate.rebrickablePayload);
  const requiredFieldsPresent = hasRequiredCatalogFields(rebrickableResult);
  const titleMatchScore = getTitleMatchScore({
    feedTitle: candidate.sourceProductTitle,
    rebrickableTitle: rebrickableResult?.name,
  });
  const hasMirrorMatch = Boolean(localMirrorMetadata);
  const existingReasons = new Set(candidate.operatorConfidenceReasons);

  if (hasMirrorMatch) {
    existingReasons.delete('missing_enrichment');
    existingReasons.add('local_rebrickable_mirror_match');
  } else if (!rebrickableResult) {
    existingReasons.add('missing_enrichment');
  }

  const operatorConfidence: CatalogDiscoveryCandidateConfidence = hasMirrorMatch
    ? titleMatchScore > 0 && requiredFieldsPresent
      ? 'high'
      : 'medium'
    : candidate.operatorConfidence;
  const strictConfidence: CatalogDiscoveryCandidateConfidence = hasMirrorMatch
    ? titleMatchScore > 0 && requiredFieldsPresent
      ? 'high'
      : 'medium'
    : candidate.confidence;
  const confidenceScore = hasMirrorMatch
    ? Math.max(candidate.confidenceScore, titleMatchScore > 0 ? 92 : 72)
    : candidate.confidenceScore;
  const evidence = {
    ...candidate.evidence,
    ...(hasMirrorMatch
      ? {
          localRebrickableMirrorMatch: true,
          rebrickable_set_num: localMirrorMetadata?.setNum,
          rebrickable_name: localMirrorMetadata?.name,
          year: localMirrorMetadata?.year,
          theme_id: localMirrorMetadata?.themeId,
          num_parts: localMirrorMetadata?.numParts,
          img_url:
            localMirrorMetadata?.imgUrl ??
            localMirrorMetadata?.setImgUrl ??
            null,
        }
      : { localRebrickableMirrorMatch: false }),
    operatorConfidence,
    operatorConfidenceReasons: [...existingReasons],
    titleMatchScore,
  };

  return {
    autoCreateEligible:
      strictConfidence === 'high' &&
      requiredFieldsPresent &&
      Boolean(rebrickableResult),
    ...(candidate.bricksetPayload
      ? { bricksetPayload: candidate.bricksetPayload }
      : {}),
    confidence: strictConfidence,
    confidenceScore,
    evidence,
    firstSeenAt: candidate.firstSeenAt,
    importError: candidate.importError ?? null,
    importedSetId: candidate.importedSetId ?? null,
    lastSeenAt: now,
    normalizedSetId: candidate.normalizedSetId,
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
    ...(candidate.sourceCurrencyCode
      ? { sourceCurrencyCode: candidate.sourceCurrencyCode }
      : {}),
    ...(candidate.sourceImageUrl
      ? { sourceImageUrl: candidate.sourceImageUrl }
      : {}),
    sourcePayload: candidate.sourcePayload,
    ...(candidate.sourcePriceMinor
      ? { sourcePriceMinor: candidate.sourcePriceMinor }
      : {}),
    ...(candidate.sourceProductTitle
      ? { sourceProductTitle: candidate.sourceProductTitle }
      : {}),
    sourceProductUrl: candidate.sourceProductUrl,
    sourceSetNumber: candidate.sourceSetNumber,
    status: candidate.status,
  };
}

function hasCandidateConfidenceChanged({
  candidate,
  input,
}: {
  candidate: CatalogDiscoveryCandidate;
  input: CatalogDiscoveryCandidateInput;
}): boolean {
  return (
    candidate.confidence !== input.confidence ||
    candidate.confidenceScore !== input.confidenceScore ||
    candidate.requiredFieldsPresent !== input.requiredFieldsPresent ||
    candidate.operatorConfidence !== input.evidence['operatorConfidence'] ||
    JSON.stringify(candidate.evidence) !== JSON.stringify(input.evidence) ||
    JSON.stringify(candidate.rebrickablePayload ?? null) !==
      JSON.stringify(input.rebrickablePayload ?? null)
  );
}

export async function recomputeCatalogDiscoveryCandidateConfidence({
  getLocalRebrickableSetMirrorMetadataFn = getLocalRebrickableSetMirrorMetadata,
  getNow = () => new Date(),
  limit = 500,
  statuses = ['new', 'failed'],
  listCatalogDiscoveryCandidatesFn = listCatalogDiscoveryCandidates,
  upsertCatalogDiscoveryCandidatesFn = upsertCatalogDiscoveryCandidates,
}: {
  getLocalRebrickableSetMirrorMetadataFn?: typeof getLocalRebrickableSetMirrorMetadata;
  getNow?: () => Date;
  limit?: number;
  listCatalogDiscoveryCandidatesFn?: typeof listCatalogDiscoveryCandidates;
  statuses?: readonly Extract<
    CatalogDiscoveryCandidateStatus,
    'failed' | 'new'
  >[];
  upsertCatalogDiscoveryCandidatesFn?: typeof upsertCatalogDiscoveryCandidates;
} = {}): Promise<RecomputeCatalogDiscoveryCandidateConfidenceResult> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const candidates = (
    await Promise.all(
      statuses.map((status) =>
        listCatalogDiscoveryCandidatesFn({
          limit: safeLimit,
          status,
        }),
      ),
    )
  ).flat();
  const now = getNow().toISOString();
  const inputs: CatalogDiscoveryCandidateInput[] = [];
  let skippedCount = 0;

  for (const candidate of candidates) {
    const localMirrorMetadata = await lookupLocalRebrickableMirrorBestEffort({
      getLocalRebrickableSetMirrorMetadataFn,
      setNumberOrId: candidate.sourceSetNumber || candidate.normalizedSetId,
    });
    const input = buildRecomputedCandidateInput({
      candidate,
      localMirrorMetadata,
      now,
    });

    if (!hasCandidateConfidenceChanged({ candidate, input })) {
      skippedCount += 1;
      continue;
    }

    inputs.push(input);
  }

  const recomputedCandidates = await upsertCatalogDiscoveryCandidatesFn({
    inputs,
  });

  return {
    highCount: recomputedCandidates.filter(
      (candidate) => candidate.operatorConfidence === 'high',
    ).length,
    lowCount: recomputedCandidates.filter(
      (candidate) => candidate.operatorConfidence === 'low',
    ).length,
    mediumCount: recomputedCandidates.filter(
      (candidate) => candidate.operatorConfidence === 'medium',
    ).length,
    modifiedCount: recomputedCandidates.length,
    processedCount: candidates.length,
    skippedCount,
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
    getLocalRebrickableSetMirrorMetadataFn = getLocalRebrickableSetMirrorMetadata,
    getNow = () => new Date(),
    listCatalogDiscoveryCandidatesBySetIdsFn = listCatalogDiscoveryCandidatesBySetIds,
    lookupBricksetSetMetadataFn = lookupBricksetSetMetadata,
    searchCatalogMissingSetsFn = searchCatalogMissingSets,
    upsertCatalogDiscoveryCandidatesFn = upsertCatalogDiscoveryCandidates,
  } = dependencies;
  const allowedSetIds = new Set(
    (options.setIds ?? []).map((setId) => getCanonicalCatalogSetId(setId)),
  );
  const candidateBySetId = new Map<string, CatalogDiscoverySourceCandidate>();

  for (const candidate of candidates) {
    const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);

    if (
      !normalizedSetId ||
      candidateBySetId.has(normalizedSetId) ||
      (allowedSetIds.size > 0 && !allowedSetIds.has(normalizedSetId))
    ) {
      continue;
    }

    candidateBySetId.set(normalizedSetId, candidate);
  }

  const uniqueCandidates = [...candidateBySetId.values()];
  const uniqueSetIds = uniqueCandidates.map((candidate) =>
    getCanonicalCatalogSetId(candidate.setNumber),
  );
  const existingCandidates = await listCatalogDiscoveryCandidatesBySetIdsFn({
    setIds: uniqueSetIds,
  });
  const existingCandidateBySetId = new Map(
    existingCandidates.map((candidate) => [
      candidate.normalizedSetId,
      candidate,
    ]),
  );
  const processableCandidates = uniqueCandidates.filter((candidate) => {
    const existingCandidate = existingCandidateBySetId.get(
      getCanonicalCatalogSetId(candidate.setNumber),
    );

    return !(
      existingCandidate &&
      (options.onlyNewCandidates || options.skipExistingCandidates)
    );
  });
  const enrichmentEnabled = Boolean(
    options.enrichMissingSets || options.autoCreateHighConfidenceCatalogSets,
  );
  const maxEnrichmentLookups = enrichmentEnabled
    ? Math.max(
        0,
        Math.floor(
          options.maxEnrichmentLookups ??
            CATALOG_DISCOVERY_DEFAULT_MAX_ENRICHMENT_LOOKUPS,
        ),
      )
    : 0;
  const sourceSetNumbers = uniqueCandidates.map((candidate) =>
    normalizeSourceSetNumber(candidate.setNumber),
  );
  const bricksetLookup =
    enrichmentEnabled && sourceSetNumbers.length > 0
      ? await lookupBricksetSetMetadataFn({
          ...(options.bricksetApiKey
            ? { bricksetApiKey: options.bricksetApiKey }
            : {}),
          ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
          includeAdditionalImages: false,
          setNumbers: sourceSetNumbers,
        })
      : {
          fetchedSetCount: 0,
          metadataRecords: [],
          unmatchedSetNumbers: sourceSetNumbers,
        };
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
  let enrichmentLookupCount = 0;
  let enrichmentSkippedExistingCount = 0;
  let rebrickable429Count = 0;

  for (const candidate of processableCandidates) {
    const normalizedSetId = getCanonicalCatalogSetId(candidate.setNumber);
    const sourceSetNumber = normalizeSourceSetNumber(candidate.setNumber);
    const existingCandidate = existingCandidateBySetId.get(normalizedSetId);
    let rebrickableResult = toCachedRebrickableResult(
      existingCandidate?.rebrickablePayload,
    );
    const localMirrorMetadata = await lookupLocalRebrickableMirrorBestEffort({
      getLocalRebrickableSetMirrorMetadataFn,
      setNumberOrId: sourceSetNumber,
    });

    if (rebrickableResult) {
      enrichmentSkippedExistingCount += 1;
    } else if (localMirrorMetadata) {
      rebrickableResult = localMirrorMetadata.catalogSetInput;
    } else if (
      enrichmentEnabled &&
      enrichmentLookupCount < maxEnrichmentLookups
    ) {
      try {
        enrichmentLookupCount += 1;
        rebrickableResult = findExactRebrickableResult({
          candidates: await searchCatalogMissingSetsFn({
            ...(options.fetchFn ? { fetchImpl: options.fetchFn } : {}),
            query: normalizedSetId,
          }),
          normalizedSetId,
          sourceSetNumber,
        });
      } catch (error) {
        if (isLikelyRebrickableRateLimitError(error)) {
          rebrickable429Count += 1;
        } else {
          throw error;
        }
      }
    }

    const candidateInput = toCandidateInput({
      bricksetRecordBySetNumber,
      candidate,
      localMirrorMetadata,
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
    enrichmentEnabled,
    enrichmentLookupCount,
    enrichmentSkippedExistingCount,
    existingCandidateHitCount: existingCandidates.length,
    highConfidenceCount: persistedCandidates.filter(
      (candidate: CatalogDiscoveryCandidate) => candidate.confidence === 'high',
    ).length,
    persistedCandidateCount: persistedCandidates.length,
    rebrickable429Count,
    skippedAutoCreateCount,
    uniqueCandidateCount: uniqueCandidates.length,
  };
}
