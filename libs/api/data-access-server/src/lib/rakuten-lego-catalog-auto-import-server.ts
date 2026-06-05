import {
  createCatalogSetFromDiscoveryCandidate,
  getLocalRebrickableSetMirrorMetadata,
  listCanonicalCatalogSets,
  listCatalogDiscoveryCandidates,
  syncLocalRebrickableMirror,
  updateCatalogDiscoveryCandidateReviewStatus,
  type CatalogDiscoveryCandidate,
  type CatalogDiscoveryCandidateConfidence,
} from '@lego-platform/catalog/data-access-server';
import {
  getCanonicalCatalogSetId,
  type CatalogSet,
} from '@lego-platform/catalog/util';
import {
  cacheTags,
  getProductionSupabaseConfig,
  getStagingSupabaseConfig,
  webPathnames,
  buildSetDetailPath,
  buildThemePath,
} from '@lego-platform/shared/config';
import {
  discoverRakutenLegoMissingSets,
  type RakutenLegoMissingSetDiscoveryReport,
} from './rakuten-lego-feed-sync-server';
import {
  recomputeCatalogDiscoveryCandidateConfidence,
  type RecomputeCatalogDiscoveryCandidateConfidenceResult,
} from './catalog-discovery-candidates-server';
import {
  enrichImportedCatalogSet,
  reEnrichCatalogSetsMissing,
  type CatalogImportPipelineResult,
  type ReEnrichCatalogSetsMissingResult,
} from './catalog-import-enrichment-server';
import {
  previewCatalogPromotionFromStagingToProduction,
  promoteCatalogFromStagingToProduction,
  type CatalogPromotionPreviewResult,
  type CatalogPromotionResult,
} from './catalog-promotion-server';
import {
  revalidatePublicWeb,
  type PublicWebRevalidationResult,
} from './public-web-revalidation-server';

const RAKUTEN_LEGO_SOURCE = 'rakuten-lego-eu';
const COMMERCE_TABLES_EXCLUDED_BY_DEFAULT = [
  'commerce_merchants',
  'commerce_benchmark_sets',
  'commerce_offer_seeds',
] as const;
const MAX_THEME_DETAIL_REVALIDATION_PATHS = 50;
const MAX_PROMOTED_METADATA_SET_REVALIDATION_PATHS = 50;

export interface RakutenLegoCatalogAutoImportOptions {
  allowAccessories?: boolean;
  autoPromote?: boolean;
  concurrency?: number;
  confidence?: readonly CatalogDiscoveryCandidateConfidence[];
  dryRun?: boolean;
  limit?: number;
  reportPath?: string;
  source?: string;
}

export interface RakutenLegoCatalogAutoImportCandidateReport {
  candidateId: string;
  hasLocalRebrickableMirrorMatch: boolean;
  operatorConfidence: CatalogDiscoveryCandidateConfidence;
  reason: string;
  setId: string;
  source: string;
  status: CatalogDiscoveryCandidate['status'];
  title?: string;
}

export interface RakutenLegoCatalogAutoImportResult {
  autoPromote: boolean;
  candidatesImported: readonly RakutenLegoCatalogAutoImportCandidateReport[];
  candidatesSkipped: readonly RakutenLegoCatalogAutoImportCandidateReport[];
  confidenceFilter: readonly CatalogDiscoveryCandidateConfidence[];
  discovery: RakutenLegoMissingSetDiscoveryReport;
  dryRun: boolean;
  durationMs: number;
  existingCandidateHits: number;
  existingCatalogMatches: number;
  feedProductsScanned: number;
  generatedAt: string;
  importedSetIds: readonly string[];
  importFailures: readonly RakutenLegoCatalogAutoImportCandidateReport[];
  importResults: readonly CatalogImportPipelineResult[];
  missingCandidatesFound: number;
  missingEnrichmentAudit:
    | ReEnrichCatalogSetsMissingResult
    | { dryRun: true; skipped: true };
  recomputeConfidence:
    | RecomputeCatalogDiscoveryCandidateConfidenceResult
    | { dryRun: true; skipped: true };
  promotePreview?: CatalogPromotionPreviewResult;
  promoteResult?: CatalogPromotionResult & {
    revalidation?: PublicWebRevalidationResult;
    revalidationWarning?: string;
  };
  promoted: boolean;
  reportPath?: string;
  source: string;
  startedAt: string;
  warnings: readonly string[];
}

export interface RakutenLegoCatalogAutoImportDependencies {
  createCatalogSetFromDiscoveryCandidateFn?: typeof createCatalogSetFromDiscoveryCandidate;
  discoverRakutenLegoMissingSetsFn?: typeof discoverRakutenLegoMissingSets;
  enrichImportedCatalogSetFn?: typeof enrichImportedCatalogSet;
  getLocalRebrickableSetMirrorMetadataFn?: typeof getLocalRebrickableSetMirrorMetadata;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCatalogDiscoveryCandidatesFn?: typeof listCatalogDiscoveryCandidates;
  now?: () => Date;
  previewCatalogPromotionFromStagingToProductionFn?: typeof previewCatalogPromotionFromStagingToProduction;
  promoteCatalogFromStagingToProductionFn?: typeof promoteCatalogFromStagingToProduction;
  recomputeCatalogDiscoveryCandidateConfidenceFn?: typeof recomputeCatalogDiscoveryCandidateConfidence;
  reEnrichCatalogSetsMissingFn?: typeof reEnrichCatalogSetsMissing;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
  syncLocalRebrickableMirrorFn?: typeof syncLocalRebrickableMirror;
  updateCatalogDiscoveryCandidateReviewStatusFn?: typeof updateCatalogDiscoveryCandidateReviewStatus;
  writeReportFn?: (input: {
    path: string;
    report: RakutenLegoCatalogAutoImportResult;
    stage: 'before_promote' | 'final';
  }) => Promise<void>;
}

function isValidRakutenSetNumber(setNumber: string): boolean {
  return /^\d{4,7}$/.test(getCanonicalCatalogSetId(setNumber));
}

function hasStrongRakutenEvidence(
  candidate: CatalogDiscoveryCandidate,
): boolean {
  return Boolean(
    candidate.source === RAKUTEN_LEGO_SOURCE &&
      isValidRakutenSetNumber(candidate.normalizedSetId) &&
      candidate.sourceProductTitle?.trim() &&
      candidate.sourceProductUrl?.trim(),
  );
}

function candidateTitle(
  candidate: CatalogDiscoveryCandidate,
): string | undefined {
  const payloadName = candidate.rebrickablePayload?.['name'];

  return (
    candidate.sourceProductTitle ??
    (typeof payloadName === 'string' && payloadName.trim()
      ? payloadName
      : undefined)
  );
}

function includesConfidence({
  candidate,
  confidence,
}: {
  candidate: CatalogDiscoveryCandidate;
  confidence: readonly CatalogDiscoveryCandidateConfidence[];
}): boolean {
  return (
    confidence.length === 0 || confidence.includes(candidate.operatorConfidence)
  );
}

function candidateHasAccessorySignal(
  candidate: CatalogDiscoveryCandidate,
): boolean {
  return candidate.operatorConfidenceReasons.some((reason) =>
    ['likely_accessory', 'likely_powered_up_part'].includes(reason),
  );
}

function toCandidateReport({
  candidate,
  hasLocalRebrickableMirrorMatch,
  reason,
}: {
  candidate: CatalogDiscoveryCandidate;
  hasLocalRebrickableMirrorMatch: boolean;
  reason: string;
}): RakutenLegoCatalogAutoImportCandidateReport {
  return {
    candidateId: candidate.id,
    hasLocalRebrickableMirrorMatch,
    operatorConfidence: candidate.operatorConfidence,
    reason,
    setId: candidate.normalizedSetId,
    source: candidate.source,
    status: candidate.status,
    ...(candidateTitle(candidate) ? { title: candidateTitle(candidate) } : {}),
  };
}

function summarizePromotionResult(
  result: CatalogPromotionResult,
  revalidation?: PublicWebRevalidationResult,
  revalidationWarning?: string,
): RakutenLegoCatalogAutoImportResult['promoteResult'] {
  return {
    ...result,
    ...(revalidation ? { revalidation } : {}),
    ...(revalidationWarning ? { revalidationWarning } : {}),
  };
}

function assertWritableStagingRuntime({ dryRun }: { dryRun: boolean }) {
  if (dryRun) {
    return;
  }

  const runtimeEnvironment = (
    process.env['BRICKHUNT_ENV'] ??
    process.env['APP_ENV'] ??
    process.env['VERCEL_ENV'] ??
    process.env['NODE_ENV'] ??
    'development'
  )
    .trim()
    .toLowerCase();

  if (runtimeEnvironment === 'production' || runtimeEnvironment === 'prod') {
    throw new Error(
      'Refusing to auto-import Rakuten catalog sets in production runtime.',
    );
  }
}

function assertPromotionTargetsAreDistinct() {
  const stagingConfig = getStagingSupabaseConfig();
  const productionConfig = getProductionSupabaseConfig();

  if (stagingConfig.url === productionConfig.url) {
    throw new Error('refusing to compare/promote identical Supabase targets');
  }
}

function assertCatalogOnlyPromotionPreview({
  importFailures,
  preview,
}: {
  importFailures: readonly RakutenLegoCatalogAutoImportCandidateReport[];
  preview: CatalogPromotionPreviewResult;
}) {
  if (importFailures.length > 0) {
    throw new Error('Auto-promote blocked because one or more imports failed.');
  }

  for (const table of COMMERCE_TABLES_EXCLUDED_BY_DEFAULT) {
    if (!preview.excludedTables.includes(table)) {
      throw new Error(
        `Auto-promote blocked because ${table} is not excluded from catalog promote.`,
      );
    }
  }

  if (preview.meaningfulPendingPromoteCount <= 0) {
    throw new Error(
      'Auto-promote blocked because there are no meaningful pending catalog changes.',
    );
  }
}

function buildCatalogPromoteRevalidationPaths(
  changedThemeSlugs: readonly string[],
): string[] {
  const basePaths = [webPathnames.home, webPathnames.themes];
  const uniqueChangedThemeSlugs = [...new Set(changedThemeSlugs)].sort(
    (left, right) => left.localeCompare(right),
  );

  if (uniqueChangedThemeSlugs.length > MAX_THEME_DETAIL_REVALIDATION_PATHS) {
    return basePaths;
  }

  return [
    ...basePaths,
    ...uniqueChangedThemeSlugs.map((slug) => buildThemePath(slug)),
  ];
}

async function revalidateCatalogPromotionResult({
  result,
  revalidatePublicWebFn,
}: {
  result: CatalogPromotionResult;
  revalidatePublicWebFn: typeof revalidatePublicWeb;
}): Promise<{
  revalidation?: PublicWebRevalidationResult;
  revalidationWarning?: string;
}> {
  const promotedMetadataSetSlugs = result.promotedMetadataSetSlugs ?? [];
  const promotedMetadataSetIds = result.promotedMetadataSetIds ?? [];
  const promotedMetadataSetPathFallback =
    promotedMetadataSetSlugs.length >
    MAX_PROMOTED_METADATA_SET_REVALIDATION_PATHS;
  const promotedMetadataSetPaths = promotedMetadataSetPathFallback
    ? []
    : promotedMetadataSetSlugs.map((slug) => buildSetDetailPath(slug));
  const revalidationPaths = [
    ...buildCatalogPromoteRevalidationPaths(result.changedThemeSlugs),
    '/nieuwe-lego-sets',
    '/retiring-lego-sets',
    '/lego-voor-volwassenen',
    ...promotedMetadataSetPaths,
  ];
  const revalidationTags = [
    cacheTags.homepage(),
    cacheTags.themes(),
    cacheTags.collections(),
    cacheTags.collection('nieuwe-lego-sets'),
    cacheTags.collection('retiring-lego-sets'),
    cacheTags.collection('lego-voor-volwassenen'),
    cacheTags.catalog(),
    cacheTags.sets(),
    ...promotedMetadataSetIds.map((setId) => cacheTags.set(setId)),
  ];

  try {
    return {
      revalidation: await revalidatePublicWebFn({
        paths: revalidationPaths,
        reason: 'catalog_promote',
        tags: revalidationTags,
      }),
    };
  } catch (error) {
    return {
      revalidationWarning:
        error instanceof Error
          ? error.message
          : 'Public web revalidation failed.',
    };
  }
}

async function importCatalogDiscoveryCandidate({
  candidate,
  createCatalogSetFromDiscoveryCandidateFn,
  enrichImportedCatalogSetFn,
  updateCatalogDiscoveryCandidateReviewStatusFn,
}: {
  candidate: CatalogDiscoveryCandidate;
  createCatalogSetFromDiscoveryCandidateFn: typeof createCatalogSetFromDiscoveryCandidate;
  enrichImportedCatalogSetFn: typeof enrichImportedCatalogSet;
  updateCatalogDiscoveryCandidateReviewStatusFn: typeof updateCatalogDiscoveryCandidateReviewStatus;
}): Promise<{
  catalogSet: CatalogSet;
  importResult: CatalogImportPipelineResult;
  metadataIncomplete: boolean;
}> {
  const startedAt = Date.now();
  const candidateCreateResult = await createCatalogSetFromDiscoveryCandidateFn({
    candidate,
  });
  const { catalogSet, metadataIncomplete } = candidateCreateResult;
  const importResult = await enrichImportedCatalogSetFn({
    catalogSet,
  });

  await updateCatalogDiscoveryCandidateReviewStatusFn({
    evidence: {
      ...candidate.evidence,
      enrichmentStatus: importResult.enrichmentStatus,
      importMode: metadataIncomplete
        ? 'discovery_candidate_evidence'
        : 'local_rebrickable_mirror',
      importResult: {
        ...importResult,
        durationMs: Date.now() - startedAt,
        importedSetId: catalogSet.setId,
        importedSlug: catalogSet.slug,
      },
      ...(metadataIncomplete
        ? {
            importWarning: 'needs_enrichment',
            metadataQuality: 'needs_enrichment',
          }
        : {}),
      importedSlug: catalogSet.slug,
    },
    id: candidate.id,
    importError: null,
    importedSetId: catalogSet.setId,
    status: 'imported',
  });

  return {
    catalogSet,
    importResult,
    metadataIncomplete,
  };
}

export async function autoImportRakutenLegoCatalog({
  dependencies = {},
  options = {},
}: {
  dependencies?: RakutenLegoCatalogAutoImportDependencies;
  options?: RakutenLegoCatalogAutoImportOptions;
} = {}): Promise<RakutenLegoCatalogAutoImportResult> {
  const {
    createCatalogSetFromDiscoveryCandidateFn = createCatalogSetFromDiscoveryCandidate,
    discoverRakutenLegoMissingSetsFn = discoverRakutenLegoMissingSets,
    enrichImportedCatalogSetFn = enrichImportedCatalogSet,
    getLocalRebrickableSetMirrorMetadataFn = getLocalRebrickableSetMirrorMetadata,
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listCatalogDiscoveryCandidatesFn = listCatalogDiscoveryCandidates,
    now = () => new Date(),
    previewCatalogPromotionFromStagingToProductionFn = previewCatalogPromotionFromStagingToProduction,
    promoteCatalogFromStagingToProductionFn = promoteCatalogFromStagingToProduction,
    recomputeCatalogDiscoveryCandidateConfidenceFn = recomputeCatalogDiscoveryCandidateConfidence,
    reEnrichCatalogSetsMissingFn = reEnrichCatalogSetsMissing,
    revalidatePublicWebFn = revalidatePublicWeb,
    syncLocalRebrickableMirrorFn = syncLocalRebrickableMirror,
    updateCatalogDiscoveryCandidateReviewStatusFn = updateCatalogDiscoveryCandidateReviewStatus,
    writeReportFn,
  } = dependencies;
  const dryRun = options.dryRun === true;
  const autoPromote = options.autoPromote === true;
  const allowAccessories = options.allowAccessories !== false;
  const source = options.source ?? RAKUTEN_LEGO_SOURCE;
  const confidence = options.confidence ?? [];
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const warnings: string[] = [];
  const candidatesImported: RakutenLegoCatalogAutoImportCandidateReport[] = [];
  const candidatesSkipped: RakutenLegoCatalogAutoImportCandidateReport[] = [];
  const importFailures: RakutenLegoCatalogAutoImportCandidateReport[] = [];
  const importResults: CatalogImportPipelineResult[] = [];
  const importedSetIds: string[] = [];

  assertWritableStagingRuntime({ dryRun });

  await syncLocalRebrickableMirrorFn({
    dryRun,
    limit: options.limit,
  });

  const discovery = await discoverRakutenLegoMissingSetsFn({
    options: {
      autoCreateHighConfidenceCatalogSets: false,
      enrichMissingSets: false,
      maxEnrichmentLookups: 0,
      maxProducts: options.limit,
      onlyNewCandidates: false,
      persistCatalogDiscoveryCandidates: !dryRun,
      persistDiscoveredSets: false,
      skipExistingCandidates: false,
    },
  });

  const recomputeConfidence = dryRun
    ? ({ dryRun: true, skipped: true } as const)
    : await recomputeCatalogDiscoveryCandidateConfidenceFn({
        limit: options.limit,
      });

  const [catalogSets, candidates] = await Promise.all([
    listCanonicalCatalogSetsFn({ includeInactive: true }),
    listCatalogDiscoveryCandidatesFn({
      limit: Math.min(500, Math.max(1, options.limit ?? 500)),
      status: 'new',
    }),
  ]);
  const existingCatalogSetIds = new Set(
    catalogSets.map((catalogSet) => getCanonicalCatalogSetId(catalogSet.setId)),
  );
  const importableCandidates = candidates.filter(
    (candidate) => candidate.source === source,
  );
  const candidateLimit = options.limit ?? importableCandidates.length;

  for (const candidate of importableCandidates.slice(0, candidateLimit)) {
    const hasLocalRebrickableMirrorMatch = Boolean(
      await getLocalRebrickableSetMirrorMetadataFn({
        setNumberOrId: candidate.sourceSetNumber || candidate.normalizedSetId,
      }),
    );
    const strongRakutenEvidence = hasStrongRakutenEvidence(candidate);
    const baseReportInput = {
      candidate,
      hasLocalRebrickableMirrorMatch,
    };

    if (!isValidRakutenSetNumber(candidate.normalizedSetId)) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'invalid_set_number',
        }),
      );
      continue;
    }

    if (
      existingCatalogSetIds.has(
        getCanonicalCatalogSetId(candidate.normalizedSetId),
      )
    ) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'already_in_catalog_sets',
        }),
      );
      continue;
    }

    if (!includesConfidence({ candidate, confidence })) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'confidence_filter',
        }),
      );
      continue;
    }

    if (!allowAccessories && candidateHasAccessorySignal(candidate)) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'accessory_filtered',
        }),
      );
      continue;
    }

    if (!hasLocalRebrickableMirrorMatch && !strongRakutenEvidence) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'missing_mirror_match_or_strong_rakuten_evidence',
        }),
      );
      continue;
    }

    if (dryRun) {
      candidatesSkipped.push(
        toCandidateReport({
          ...baseReportInput,
          reason: 'dry_run_would_import',
        }),
      );
      continue;
    }

    try {
      const { catalogSet, importResult } =
        await importCatalogDiscoveryCandidate({
          candidate,
          createCatalogSetFromDiscoveryCandidateFn,
          enrichImportedCatalogSetFn,
          updateCatalogDiscoveryCandidateReviewStatusFn,
        });

      existingCatalogSetIds.add(getCanonicalCatalogSetId(catalogSet.setId));
      importedSetIds.push(catalogSet.setId);
      importResults.push(importResult);
      candidatesImported.push(
        toCandidateReport({
          ...baseReportInput,
          reason:
            importResult.warnings.length > 0
              ? 'imported_with_warnings'
              : 'imported',
        }),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Discovery import failed.';

      await updateCatalogDiscoveryCandidateReviewStatusFn({
        evidence: {
          ...candidate.evidence,
          importMode: 'rakuten_auto_import',
        },
        id: candidate.id,
        importError: errorMessage,
        status: 'failed',
      });
      importFailures.push(
        toCandidateReport({
          ...baseReportInput,
          reason: errorMessage,
        }),
      );
    }
  }

  const missingEnrichmentAudit = dryRun
    ? ({ dryRun: true, skipped: true } as const)
    : await reEnrichCatalogSetsMissingFn({
        batchSize: 25,
        dryRun: false,
        setIds: importedSetIds,
      });
  let promotePreview: CatalogPromotionPreviewResult | undefined;
  let promoteResult:
    | (CatalogPromotionResult & {
        revalidation?: PublicWebRevalidationResult;
        revalidationWarning?: string;
      })
    | undefined;
  let promoted = false;

  const buildReport = (): RakutenLegoCatalogAutoImportResult => ({
    autoPromote,
    candidatesImported,
    candidatesSkipped,
    confidenceFilter: confidence,
    discovery,
    dryRun,
    durationMs: Math.max(0, now().getTime() - startedAtDate.getTime()),
    existingCandidateHits: discovery.existingCandidateHitCount,
    existingCatalogMatches: discovery.existingCatalogMatchCount,
    feedProductsScanned: discovery.feedProductsScanned,
    generatedAt: now().toISOString(),
    importedSetIds,
    importFailures,
    importResults,
    missingCandidatesFound: discovery.candidateCount,
    missingEnrichmentAudit,
    recomputeConfidence,
    ...(promotePreview ? { promotePreview } : {}),
    ...(promoteResult ? { promoteResult } : {}),
    promoted,
    ...(options.reportPath ? { reportPath: options.reportPath } : {}),
    source,
    startedAt,
    warnings,
  });

  if (autoPromote) {
    assertPromotionTargetsAreDistinct();
    promotePreview = await previewCatalogPromotionFromStagingToProductionFn({
      includeCommerceSeeds: false,
      includeHeavy: false,
    });
    assertCatalogOnlyPromotionPreview({
      importFailures,
      preview: promotePreview,
    });

    if (options.reportPath && writeReportFn) {
      await writeReportFn({
        path: options.reportPath,
        report: buildReport(),
        stage: 'before_promote',
      });
    }

    if (!dryRun) {
      const rawPromoteResult = await promoteCatalogFromStagingToProductionFn({
        includeCommerceSeeds: false,
      });
      const revalidationResult = await revalidateCatalogPromotionResult({
        result: rawPromoteResult,
        revalidatePublicWebFn,
      });

      promoteResult = summarizePromotionResult(
        rawPromoteResult,
        revalidationResult.revalidation,
        revalidationResult.revalidationWarning,
      );
      promoted = true;
    }
  }

  const finalReport = buildReport();

  if (options.reportPath && writeReportFn) {
    await writeReportFn({
      path: options.reportPath,
      report: finalReport,
      stage: 'final',
    });
  }

  return finalReport;
}
