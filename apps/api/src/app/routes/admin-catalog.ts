import {
  createCatalogSet,
  createCatalogSetFromDiscoveryCandidate,
  getCatalogDiscoveryCandidate,
  listAdminCatalogCollectionPresentations,
  listAdminCatalogThemePresentations,
  listAdminHomepageSections,
  listCatalogDiscoveryCandidates,
  listCatalogSuggestedMissingSets,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
  saveAdminHomepageSection,
  updateAdminCatalogCollectionPresentation,
  updateAdminCatalogThemePresentation,
  type AdminCatalogCollectionPresentation,
  type AdminCatalogCollectionPresentationInput,
  type AdminCatalogThemePresentation,
  type AdminCatalogThemePresentationInput,
  type AdminHomepageSectionSaveInput,
  updateCatalogDiscoveryCandidateReviewStatus,
  type CatalogDiscoveryCandidate,
  type CatalogDiscoveryCandidateStatus,
} from '@lego-platform/catalog/data-access-server';
import {
  type CatalogBulkOnboardingRunReadResult,
  type CatalogBulkOnboardingStartResult,
  enrichCatalogSetMinifigSummariesBestEffort,
  enrichImportedCatalogSet,
  reEnrichImportedCatalogSets,
  type CatalogImportPipelineResult,
  getCatalogBulkOnboardingRun,
  getLatestCatalogBulkOnboardingRun,
  recomputeCatalogDiscoveryCandidateConfidence,
  revalidatePublicWeb,
  startCatalogBulkOnboardingRun,
} from '@lego-platform/api/data-access-server';
import {
  buildCatalogThemeSlug,
  getCatalogCollectionLandingPageConfig,
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSet,
  type CatalogSet,
  type PublicPageSection,
  type PublicPageSectionItemReferenceType,
} from '@lego-platform/catalog/util';
import {
  apiPaths,
  buildCatalogSetRevalidationTags,
  buildSetDetailPath,
  buildThemePath,
  buildWebPath,
  cacheTags,
  webPathnames,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import { createAdminPreHandler } from '../lib/admin-authorization';

export interface AdminCatalogSetSummary {
  collectorAngle?: string;
  createdAt: string;
  id: string;
  imageUrl?: string;
  name: string;
  pieces: number;
  releaseYear: number;
  slug: string;
  theme: string;
  updatedAt: string;
}

export interface AdminCatalogService {
  importDiscoveryCandidate(input: {
    candidateId: string;
  }): Promise<CatalogDiscoveryCandidate>;
  bulkImportDiscoveryCandidates(input: {
    allowLowConfidence?: boolean;
    candidateIds: readonly string[];
    concurrency?: number;
  }): Promise<AdminCatalogDiscoveryCandidateBulkImportResult>;
  reEnrichCatalogSet(input: {
    setId: string;
  }): Promise<CatalogImportPipelineResult>;
  listDiscoveryCandidates(input?: {
    status?: CatalogDiscoveryCandidateStatus | 'all';
  }): Promise<CatalogDiscoveryCandidate[]>;
  recomputeDiscoveryCandidateConfidence(): Promise<{
    highCount: number;
    lowCount: number;
    mediumCount: number;
    modifiedCount: number;
    processedCount: number;
    skippedCount: number;
  }>;
  getBulkOnboardingRun(
    runId: string,
  ): Promise<CatalogBulkOnboardingRunReadResult>;
  getLatestBulkOnboardingRun(): Promise<CatalogBulkOnboardingRunReadResult>;
  startBulkOnboarding(input: {
    setIds: readonly string[];
  }): Promise<CatalogBulkOnboardingStartResult>;
  createSet(input: CatalogExternalSetSearchResult): Promise<CatalogSet>;
  updateDiscoveryCandidateStatus(input: {
    candidateId: string;
    status: Extract<
      CatalogDiscoveryCandidateStatus,
      'ignored' | 'new' | 'non_set' | 'reviewed'
    >;
  }): Promise<CatalogDiscoveryCandidate>;
  listCatalogSets(): Promise<AdminCatalogSetSummary[]>;
  listSuggestedSets(): Promise<CatalogSuggestedSet[]>;
  searchMissingSets(query: string): Promise<CatalogExternalSetSearchResult[]>;
  listThemePresentations(input?: {
    query?: string;
  }): Promise<AdminCatalogThemePresentation[]>;
  listCollectionPresentations(input?: {
    query?: string;
  }): Promise<AdminCatalogCollectionPresentation[]>;
  updateThemePresentation(input: {
    input: AdminCatalogThemePresentationInput;
    slug: string;
  }): Promise<AdminCatalogThemePresentation>;
  updateCollectionPresentation(input: {
    input: AdminCatalogCollectionPresentationInput;
    slug: string;
  }): Promise<AdminCatalogCollectionPresentation>;
  listHomepageSections(): Promise<PublicPageSection[]>;
  saveHomepageSection(
    input: AdminHomepageSectionSaveInput,
  ): Promise<PublicPageSection>;
}

export function buildCatalogDiscoveryCandidateStatusUpdate({
  candidate,
  now = () => new Date(),
  restoredBy = 'admin',
  status,
}: {
  candidate: CatalogDiscoveryCandidate;
  now?: () => Date;
  restoredBy?: string;
  status: Extract<
    CatalogDiscoveryCandidateStatus,
    'ignored' | 'new' | 'non_set' | 'reviewed'
  >;
}): {
  evidence: Readonly<Record<string, unknown>>;
  status: Extract<
    CatalogDiscoveryCandidateStatus,
    'ignored' | 'new' | 'non_set' | 'reviewed'
  >;
} {
  if (candidate.status === 'imported') {
    throw new Error('Geimporteerde discovery candidates zijn immutable.');
  }

  if (
    status === 'new' &&
    candidate.status !== 'ignored' &&
    candidate.status !== 'non_set'
  ) {
    throw new Error(
      'Alleen ignored of non-set discovery candidates kunnen worden hersteld.',
    );
  }

  if (status !== 'new' && candidate.status !== 'new') {
    throw new Error(
      'Alleen nieuwe discovery candidates kunnen worden beoordeeld.',
    );
  }

  const restoredAt = now().toISOString();

  return {
    evidence: {
      ...candidate.evidence,
      ...(status === 'non_set' ? { reviewReason: 'non_set' } : {}),
      ...(status === 'new'
        ? {
            previousStatus: candidate.status,
            previous_status: candidate.status,
            restoredAt,
            restoredBy,
            restored_at: restoredAt,
            restored_by: restoredBy,
          }
        : {}),
    },
    status,
  };
}

export type AdminCatalogDiscoveryCandidateBulkImportItemStatus =
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'warning';

export interface AdminCatalogDiscoveryCandidateBulkImportItemResult {
  candidateId: string;
  enrichmentStatus?: CatalogImportPipelineResult['enrichmentStatus'];
  error?: string;
  importedSetId?: string;
  importedSlug?: string;
  setId?: string;
  status: AdminCatalogDiscoveryCandidateBulkImportItemStatus;
  title?: string;
  warnings: readonly string[];
}

export interface AdminCatalogDiscoveryCandidateBulkImportResult {
  completedCount: number;
  concurrency: number;
  failedCount: number;
  processedCount: number;
  requestedCount: number;
  results: readonly AdminCatalogDiscoveryCandidateBulkImportItemResult[];
  skippedCount: number;
  warningCount: number;
}

function createAdminCatalogService(): AdminCatalogService {
  const importDiscoveryCandidate = async ({
    candidateId,
  }: {
    candidateId: string;
  }) => {
    const startedAt = Date.now();
    const candidate = await getCatalogDiscoveryCandidate({
      id: candidateId,
    });

    if (!candidate) {
      throw new Error('Discovery candidate niet gevonden.');
    }

    try {
      const candidateCreateResult =
        await createCatalogSetFromDiscoveryCandidate({
          candidate,
        });
      const catalogSet = candidateCreateResult.catalogSet;
      const metadataIncomplete = candidateCreateResult.metadataIncomplete;

      const importResult = await enrichImportedCatalogSet({
        catalogSet,
      });

      return updateCatalogDiscoveryCandidateReviewStatus({
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
    } catch (error) {
      await updateCatalogDiscoveryCandidateReviewStatus({
        evidence: {
          ...candidate.evidence,
          importMode: 'discovery_candidate_evidence',
        },
        id: candidate.id,
        importError:
          error instanceof Error
            ? error.message
            : 'Discovery candidate import failed.',
        status: 'failed',
      });

      throw error;
    }
  };

  return {
    importDiscoveryCandidate,
    bulkImportDiscoveryCandidates: async (input) =>
      runDiscoveryCandidateBulkImport({
        allowLowConfidence: input.allowLowConfidence ?? false,
        candidateIds: input.candidateIds,
        concurrency: input.concurrency ?? 1,
        importDiscoveryCandidate,
      }),
    reEnrichCatalogSet: async ({ setId }) => {
      const result = await reEnrichImportedCatalogSets({
        setIds: [setId],
      });
      const setResult = result.results[0];

      if (!setResult || setResult.importedSlug === '') {
        throw new Error('Catalog set niet gevonden.');
      }

      return setResult;
    },
    listDiscoveryCandidates: async (input) =>
      reconcileDiscoveryCandidates(
        await listCatalogDiscoveryCandidates({
          limit: 250,
          status: input?.status ?? 'all',
        }),
      ),
    recomputeDiscoveryCandidateConfidence: () =>
      recomputeCatalogDiscoveryCandidateConfidence(),
    getBulkOnboardingRun: async (runId) =>
      getCatalogBulkOnboardingRun({
        options: {
          workspaceRoot: process.cwd(),
        },
        runId,
      }),
    getLatestBulkOnboardingRun: async () =>
      getLatestCatalogBulkOnboardingRun({
        options: {
          workspaceRoot: process.cwd(),
        },
      }),
    startBulkOnboarding: async (input) =>
      startCatalogBulkOnboardingRun({
        options: {
          setIds: input.setIds,
          workspaceRoot: process.cwd(),
        },
      }),
    createSet: async (input) => {
      const catalogSet = await createCatalogSet({ input });

      await enrichCatalogSetMinifigSummariesBestEffort({
        logPrefix: '[admin-catalog]',
        setIds: [catalogSet.setId],
      });

      return catalogSet;
    },
    updateDiscoveryCandidateStatus: async ({ candidateId, status }) => {
      const candidate = await getCatalogDiscoveryCandidate({
        id: candidateId,
      });

      if (!candidate) {
        throw new Error('Discovery candidate niet gevonden.');
      }

      const statusUpdate = buildCatalogDiscoveryCandidateStatusUpdate({
        candidate,
        status,
      });

      return updateCatalogDiscoveryCandidateReviewStatus({
        evidence: statusUpdate.evidence,
        id: candidateId,
        status: statusUpdate.status,
      });
    },
    listCatalogSets: async () =>
      (await listCanonicalCatalogSets()).map((catalogSet) => ({
        createdAt: catalogSet.createdAt,
        id: catalogSet.setId,
        imageUrl: catalogSet.imageUrl,
        name: catalogSet.name,
        pieces: catalogSet.pieceCount,
        releaseYear: catalogSet.releaseYear,
        slug: catalogSet.slug,
        theme: catalogSet.primaryTheme,
        updatedAt: catalogSet.updatedAt,
      })),
    listSuggestedSets: () => listCatalogSuggestedMissingSets(),
    searchMissingSets: (query) => searchCatalogMissingSets({ query }),
    listThemePresentations: (input) =>
      listAdminCatalogThemePresentations({ query: input?.query }),
    listCollectionPresentations: (input) =>
      listAdminCatalogCollectionPresentations({ query: input?.query }),
    updateThemePresentation: (input) =>
      updateAdminCatalogThemePresentation(input),
    updateCollectionPresentation: (input) =>
      updateAdminCatalogCollectionPresentation(input),
    listHomepageSections: () => listAdminHomepageSections(),
    saveHomepageSection: (input) => saveAdminHomepageSection({ input }),
  };
}

function toBadRequestMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function readCatalogExternalSetFromCandidate(
  candidate: CatalogDiscoveryCandidate,
): CatalogExternalSetSearchResult {
  const payload = candidate.rebrickablePayload;

  if (!payload) {
    throw new Error(
      'Deze discovery candidate heeft nog geen cached Rebrickable-verrijking en kan niet zonder live lookup worden geimporteerd.',
    );
  }

  const readString = (key: string) => {
    const value = payload[key];

    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Discovery candidate mist cached ${key}.`);
    }

    return value.trim();
  };
  const readInteger = (key: string, minValue: number) => {
    const value = payload[key];

    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < minValue
    ) {
      throw new Error(`Discovery candidate mist cached ${key}.`);
    }

    return value;
  };
  const imageUrl = payload['imageUrl'];

  return {
    ...(typeof imageUrl === 'string' && imageUrl.trim()
      ? { imageUrl: imageUrl.trim() }
      : {}),
    name: readString('name'),
    pieces: readInteger('pieces', 0),
    releaseYear: readInteger('releaseYear', 1),
    setId: readString('setId'),
    slug: readString('slug'),
    source: 'rebrickable',
    sourceSetNumber: readString('sourceSetNumber'),
    theme: readString('theme'),
  };
}

function readBulkOnboardingRunIdFromCandidate(
  candidate: CatalogDiscoveryCandidate,
): string | null {
  const value = candidate.evidence['bulkOnboardingRunId'];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isDiscoveryCandidateProcessing(
  candidate: CatalogDiscoveryCandidate,
): boolean {
  return (
    candidate.status === 'processing' ||
    candidate.status === 'onboarding_started'
  );
}

async function reconcileDiscoveryCandidates(
  candidates: readonly CatalogDiscoveryCandidate[],
): Promise<CatalogDiscoveryCandidate[]> {
  const processingCandidates = candidates.filter(
    isDiscoveryCandidateProcessing,
  );

  if (processingCandidates.length === 0) {
    return [...candidates];
  }

  const catalogSetIds = new Set(
    (await listCanonicalCatalogSets()).map((catalogSet) => catalogSet.setId),
  );
  const reconciledById = new Map<string, CatalogDiscoveryCandidate>();

  for (const candidate of processingCandidates) {
    const runId = readBulkOnboardingRunIdFromCandidate(candidate);

    if (!runId) {
      continue;
    }

    const runResult = await getCatalogBulkOnboardingRun({
      options: {
        workspaceRoot: process.cwd(),
      },
      runId,
    });
    const run = runResult.run;

    if (!run) {
      reconciledById.set(
        candidate.id,
        await updateCatalogDiscoveryCandidateReviewStatus({
          evidence: candidate.evidence,
          id: candidate.id,
          importError: `Bulk onboarding run ${runId} niet gevonden.`,
          status: 'failed',
        }),
      );
      continue;
    }

    if (run.status === 'failed') {
      reconciledById.set(
        candidate.id,
        await updateCatalogDiscoveryCandidateReviewStatus({
          evidence: candidate.evidence,
          id: candidate.id,
          importError: `Bulk onboarding run ${runId} is gefaald.`,
          status: 'failed',
        }),
      );
      continue;
    }

    if (
      (run.status === 'completed' || run.status === 'completed_with_errors') &&
      catalogSetIds.has(candidate.normalizedSetId)
    ) {
      reconciledById.set(
        candidate.id,
        await updateCatalogDiscoveryCandidateReviewStatus({
          evidence: candidate.evidence,
          id: candidate.id,
          importError: null,
          importedSetId: candidate.normalizedSetId,
          status: 'imported',
        }),
      );
      continue;
    }

    if (run.status === 'completed' || run.status === 'completed_with_errors') {
      reconciledById.set(
        candidate.id,
        await updateCatalogDiscoveryCandidateReviewStatus({
          evidence: candidate.evidence,
          id: candidate.id,
          importError: `Bulk onboarding run ${runId} is klaar, maar set ${candidate.normalizedSetId} staat niet in de staging catalogus.`,
          status: 'failed',
        }),
      );
    }
  }

  return candidates.map(
    (candidate) => reconciledById.get(candidate.id) ?? candidate,
  );
}

function readImportResultFromCandidate(
  candidate: CatalogDiscoveryCandidate,
): CatalogImportPipelineResult | null {
  const importResult = candidate.evidence['importResult'];

  return typeof importResult === 'object' && importResult
    ? (importResult as CatalogImportPipelineResult)
    : null;
}

function readDiscoveryCandidateTitle(
  candidate: CatalogDiscoveryCandidate,
): string {
  if (candidate.sourceProductTitle?.trim()) {
    return candidate.sourceProductTitle.trim();
  }

  const payloadName = candidate.rebrickablePayload?.['name'];

  return typeof payloadName === 'string' && payloadName.trim()
    ? payloadName.trim()
    : candidate.normalizedSetId;
}

function getDiscoveryCandidateBulkImportSkipReason(
  candidate: CatalogDiscoveryCandidate,
  input: {
    allowLowConfidence: boolean;
  },
): string | null {
  if (candidate.status !== 'new' && candidate.status !== 'failed') {
    return `status is ${candidate.status}`;
  }

  if (!/^\d{5,6}$/.test(candidate.normalizedSetId)) {
    return 'set number is invalid or missing';
  }

  if (
    candidate.operatorConfidence === 'low' &&
    input.allowLowConfidence !== true
  ) {
    return 'low confidence requires explicit confirmation';
  }

  return null;
}

async function runDiscoveryCandidateBulkImport(input: {
  allowLowConfidence: boolean;
  candidateIds: readonly string[];
  concurrency: number;
  importDiscoveryCandidate: (input: {
    candidateId: string;
  }) => Promise<CatalogDiscoveryCandidate>;
}): Promise<AdminCatalogDiscoveryCandidateBulkImportResult> {
  const concurrency = Math.min(2, Math.max(1, Math.floor(input.concurrency)));
  const candidateIds = [...new Set(input.candidateIds)];
  const results: AdminCatalogDiscoveryCandidateBulkImportItemResult[] = [];
  let nextIndex = 0;

  const processCandidate = async (candidateId: string) => {
    try {
      const candidate = await getCatalogDiscoveryCandidate({
        id: candidateId,
      });

      if (!candidate) {
        results.push({
          candidateId,
          error: 'Discovery candidate niet gevonden.',
          status: 'failed',
          warnings: [],
        });
        return;
      }

      const title = readDiscoveryCandidateTitle(candidate);
      const skipReason = getDiscoveryCandidateBulkImportSkipReason(candidate, {
        allowLowConfidence: input.allowLowConfidence,
      });

      if (skipReason) {
        results.push({
          candidateId,
          error: skipReason,
          setId: candidate.normalizedSetId,
          status: 'skipped',
          title,
          warnings: [skipReason],
        });
        return;
      }

      const importedCandidate = await input.importDiscoveryCandidate({
        candidateId,
      });
      const importResult = readImportResultFromCandidate(importedCandidate);
      const warnings = importResult?.warnings ?? [];
      const status =
        warnings.length > 0 || importResult?.enrichmentStatus === 'partial'
          ? 'warning'
          : 'completed';

      results.push({
        candidateId,
        enrichmentStatus: importResult?.enrichmentStatus,
        importedSetId:
          importResult?.importedSetId ??
          importedCandidate.importedSetId ??
          undefined,
        importedSlug: importResult?.importedSlug,
        setId: importedCandidate.normalizedSetId,
        status,
        title: readDiscoveryCandidateTitle(importedCandidate),
        warnings,
      });
    } catch (error) {
      results.push({
        candidateId,
        error: toBadRequestMessage(error, 'Discovery candidate import failed.'),
        status: 'failed',
        warnings: [],
      });
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, candidateIds.length) },
    async () => {
      while (nextIndex < candidateIds.length) {
        const candidateId = candidateIds[nextIndex];
        nextIndex += 1;
        await processCandidate(candidateId);
      }
    },
  );

  await Promise.all(workers);

  return {
    completedCount: results.filter((result) => result.status === 'completed')
      .length,
    concurrency,
    failedCount: results.filter((result) => result.status === 'failed').length,
    processedCount: results.length,
    requestedCount: candidateIds.length,
    results,
    skippedCount: results.filter((result) => result.status === 'skipped')
      .length,
    warningCount: results.filter((result) => result.status === 'warning')
      .length,
  };
}

async function revalidateCatalogSetSurfaces(
  catalogSet: Pick<CatalogSet, 'setId' | 'slug' | 'theme'>,
  revalidatePublicWebFn = revalidatePublicWeb,
): Promise<void> {
  try {
    const themeSlug = buildCatalogThemeSlug(catalogSet.theme);

    await revalidatePublicWebFn({
      paths: [buildSetDetailPath(catalogSet.slug), buildThemePath(themeSlug)],
      reason: 'admin_catalog_set_mutation',
      tags: buildCatalogSetRevalidationTags({
        affectsHomepage: true,
        affectsSearchIndex: true,
        affectsSitemap: true,
        setNumberOrSlug: catalogSet.setId,
        setSlug: catalogSet.slug,
        themeSlug,
      }),
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? error.message
        : 'Public web catalog set revalidation failed.',
    );
  }
}

async function revalidateHomepageCmsSurfaces(
  revalidatePublicWebFn = revalidatePublicWeb,
): Promise<void> {
  await revalidatePublicWebFn({
    paths: [buildWebPath(webPathnames.home)],
    reason: 'admin_homepage_cms_mutation',
    tags: [cacheTags.homepage()],
  });
}

async function revalidateThemePresentationSurfaces(
  slug: string,
  revalidatePublicWebFn = revalidatePublicWeb,
): Promise<void> {
  await revalidatePublicWebFn({
    paths: [
      buildWebPath(webPathnames.home),
      buildWebPath(webPathnames.themes),
      buildThemePath(slug),
    ],
    reason: 'admin_theme_presentation_mutation',
    tags: [cacheTags.homepage(), cacheTags.themes(), cacheTags.theme(slug)],
  });
}

async function revalidateCollectionPresentationSurfaces(
  slug: string,
  revalidatePublicWebFn = revalidatePublicWeb,
): Promise<void> {
  const collectionPath =
    getCatalogCollectionLandingPageConfig(slug)?.canonicalPath ?? `/${slug}`;
  const collectionPaths = [...new Set([collectionPath, `/${slug}`])].sort(
    (left, right) => left.localeCompare(right),
  );

  await revalidatePublicWebFn({
    paths: [buildWebPath(webPathnames.home), ...collectionPaths],
    reason: 'admin_collection_presentation_mutation',
    tags: [
      cacheTags.homepage(),
      cacheTags.catalog(),
      cacheTags.sets(),
      cacheTags.collections(),
      cacheTags.collection(slug),
    ],
  });
}

function readSearchQuery(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Zoekquery ontbreekt.');
  }

  const query = (value as { query?: unknown }).query;

  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('Zoekquery ontbreekt.');
  }

  return query.trim();
}

function readBulkOnboardingInput(value: unknown): { setIds: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Bulk onboarding input ontbreekt.');
  }

  const setIds = (value as { setIds?: unknown }).setIds;

  if (!Array.isArray(setIds)) {
    throw new Error('Bulk onboarding input mist een setIds-lijst.');
  }

  const normalizedSetIds = setIds
    .map((setId) => (typeof setId === 'string' ? setId.trim() : ''))
    .filter(Boolean);

  if (normalizedSetIds.length === 0) {
    throw new Error('Bulk onboarding input mist geldige setIds.');
  }

  return {
    setIds: normalizedSetIds,
  };
}

function readDiscoveryCandidateBulkImportInput(value: unknown): {
  allowLowConfidence?: boolean;
  candidateIds: string[];
  concurrency?: number;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Bulk discovery import input ontbreekt.');
  }

  const record = value as {
    allowLowConfidence?: unknown;
    candidateIds?: unknown;
    concurrency?: unknown;
  };

  if (!Array.isArray(record.candidateIds)) {
    throw new Error('Bulk discovery import mist een candidateIds-lijst.');
  }

  const candidateIds = [
    ...new Set(
      record.candidateIds
        .map((candidateId) =>
          typeof candidateId === 'string' ? candidateId.trim() : '',
        )
        .filter(Boolean),
    ),
  ];

  if (candidateIds.length === 0) {
    throw new Error('Bulk discovery import mist geldige candidateIds.');
  }

  const concurrency =
    typeof record.concurrency === 'number' &&
    Number.isFinite(record.concurrency)
      ? Math.min(2, Math.max(1, Math.floor(record.concurrency)))
      : undefined;

  return {
    ...(typeof record.allowLowConfidence === 'boolean'
      ? { allowLowConfidence: record.allowLowConfidence }
      : {}),
    candidateIds,
    ...(concurrency ? { concurrency } : {}),
  };
}

function readRunId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Run id ontbreekt.');
  }

  const runId = (value as { runId?: unknown }).runId;

  if (typeof runId !== 'string' || !runId.trim()) {
    throw new Error('Run id ontbreekt.');
  }

  return runId.trim();
}

function readCatalogSetInput(value: unknown): CatalogExternalSetSearchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Set-input ontbreekt.');
  }

  const record = value as Record<string, unknown>;
  const readString = (key: string) => {
    const fieldValue = record[key];

    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      throw new Error(`Set-input mist een geldige ${key}.`);
    }

    return fieldValue.trim();
  };
  const readPositiveInteger = (key: string) => {
    const fieldValue = record[key];

    if (
      typeof fieldValue !== 'number' ||
      !Number.isInteger(fieldValue) ||
      fieldValue <= 0
    ) {
      throw new Error(`Set-input mist een geldige ${key}.`);
    }

    return fieldValue;
  };
  const readNonNegativeInteger = (key: string) => {
    const fieldValue = record[key];

    if (
      typeof fieldValue !== 'number' ||
      !Number.isInteger(fieldValue) ||
      fieldValue < 0
    ) {
      throw new Error(`Set-input mist een geldige ${key}.`);
    }

    return fieldValue;
  };
  const imageUrl = record['imageUrl'];

  return {
    ...(typeof imageUrl === 'string' && imageUrl.trim()
      ? {
          imageUrl: imageUrl.trim(),
        }
      : {}),
    name: readString('name'),
    pieces: readNonNegativeInteger('pieces'),
    releaseYear: readPositiveInteger('releaseYear'),
    setId: readString('setId'),
    slug: readString('slug'),
    source:
      readString('source') === 'rebrickable' ? 'rebrickable' : 'rebrickable',
    sourceSetNumber: readString('sourceSetNumber'),
    theme: readString('theme'),
  };
}

function readDiscoveryCandidateStatusInput(value: unknown): {
  status: Extract<
    CatalogDiscoveryCandidateStatus,
    'ignored' | 'new' | 'non_set' | 'reviewed'
  >;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Discovery status ontbreekt.');
  }

  const status = (value as { status?: unknown }).status;

  if (
    status !== 'ignored' &&
    status !== 'new' &&
    status !== 'non_set' &&
    status !== 'reviewed'
  ) {
    throw new Error('Discovery status is ongeldig.');
  }

  return { status };
}

function readOptionalStringInput(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalNumberInput(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readMetadataInput(
  value: unknown,
): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : undefined;
}

function readThemePresentationInput(
  value: unknown,
): AdminCatalogThemePresentationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Theme presentation input ontbreekt.');
  }

  const record = value as Record<string, unknown>;

  return {
    isPublic: record['isPublic'] !== false,
    publicAccentColor: readOptionalStringInput(record['publicAccentColor']),
    publicDescription: readOptionalStringInput(record['publicDescription']),
    publicDisplayName: readOptionalStringInput(record['publicDisplayName']),
    publicHeroTextColor: readOptionalStringInput(record['publicHeroTextColor']),
    publicHomepageOrder: readOptionalNumberInput(record['publicHomepageOrder']),
    publicImageUrl: readOptionalStringInput(record['publicImageUrl']),
    publicLogoUrl: readOptionalStringInput(record['publicLogoUrl']),
    publicOrder: readOptionalNumberInput(record['publicOrder']),
    publicSurfaceColor: readOptionalStringInput(record['publicSurfaceColor']),
    publicSurfaceTextColor: readOptionalStringInput(
      record['publicSurfaceTextColor'],
    ),
    publicTileImageUrl: readOptionalStringInput(record['publicTileImageUrl']),
    status: record['status'] === 'inactive' ? 'inactive' : 'active',
  };
}

function readCollectionPresentationInput(
  value: unknown,
): AdminCatalogCollectionPresentationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Collection presentation input ontbreekt.');
  }

  const record = value as Record<string, unknown>;

  return {
    isPublic: record['isPublic'] !== false,
    publicAccentColor: readOptionalStringInput(record['publicAccentColor']),
    publicDescription: readOptionalStringInput(record['publicDescription']),
    publicDisplayName: readOptionalStringInput(record['publicDisplayName']),
    publicHeroTextColor: readOptionalStringInput(record['publicHeroTextColor']),
    publicHomepageOrder: readOptionalNumberInput(record['publicHomepageOrder']),
    publicImageUrl: readOptionalStringInput(record['publicImageUrl']),
    publicLogoUrl: readOptionalStringInput(record['publicLogoUrl']),
    publicOrder: readOptionalNumberInput(record['publicOrder']),
    publicSurfaceColor: readOptionalStringInput(record['publicSurfaceColor']),
    publicSurfaceTextColor: readOptionalStringInput(
      record['publicSurfaceTextColor'],
    ),
    publicTileImageUrl: readOptionalStringInput(record['publicTileImageUrl']),
    status: record['status'] === 'inactive' ? 'inactive' : 'active',
  };
}

function readHomepageSectionInput(
  value: unknown,
): AdminHomepageSectionSaveInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Homepage section input ontbreekt.');
  }

  const record = value as Record<string, unknown>;
  const sectionKey = readOptionalStringInput(record['sectionKey']);
  const title = readOptionalStringInput(record['title']);

  if (!sectionKey || !title) {
    throw new Error('Homepage section mist sectionKey of title.');
  }

  const items = Array.isArray(record['items'])
    ? record['items'].map((item, index) => {
        const itemRecord =
          item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : {};
        const referenceType = itemRecord['referenceType'];

        const normalizedReferenceType: PublicPageSectionItemReferenceType =
          referenceType === 'theme' ||
          referenceType === 'set' ||
          referenceType === 'collection' ||
          referenceType === 'custom'
            ? referenceType
            : 'custom';

        return {
          altOverride:
            readOptionalStringInput(itemRecord['altOverride']) ?? undefined,
          ctaLabel:
            readOptionalStringInput(itemRecord['ctaLabel']) ?? undefined,
          ctaUrl: readOptionalStringInput(itemRecord['ctaUrl']) ?? undefined,
          enabled: itemRecord['enabled'] !== false,
          imageSetId:
            readOptionalStringInput(itemRecord['imageSetId']) ?? undefined,
          imageUrl:
            readOptionalStringInput(itemRecord['imageUrl']) ?? undefined,
          metadata: readMetadataInput(itemRecord['metadata']),
          referenceId:
            readOptionalStringInput(itemRecord['referenceId']) ?? undefined,
          referenceType: normalizedReferenceType,
          sortOrder:
            readOptionalNumberInput(itemRecord['sortOrder']) ??
            (index + 1) * 10,
          titleOverride:
            readOptionalStringInput(itemRecord['titleOverride']) ?? undefined,
          useCustomImage: itemRecord['useCustomImage'] === true,
        };
      })
    : [];

  return {
    enabled: record['enabled'] !== false,
    items,
    layout: readOptionalStringInput(record['layout']) ?? undefined,
    metadata: readMetadataInput(record['metadata']),
    pageKey: 'homepage',
    sectionKey,
    sortOrder: readOptionalNumberInput(record['sortOrder']) ?? 10,
    subtitle: readOptionalStringInput(record['subtitle']) ?? undefined,
    title,
  };
}

function isDefaultProductionEnvironment(): boolean {
  return (
    process.env['BRICKHUNT_ENV'] === 'production' ||
    process.env['APP_ENV'] === 'production' ||
    process.env['VERCEL_ENV'] === 'production'
  );
}

export function createAdminCatalogRoutes({
  adminPreHandler = createAdminPreHandler(),
  catalogService = createAdminCatalogService(),
  isProductionEnvironment = isDefaultProductionEnvironment,
  revalidatePublicWebFn = revalidatePublicWeb,
}: {
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  catalogService?: AdminCatalogService;
  isProductionEnvironment?: () => boolean;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.addHook('preHandler', adminPreHandler);
    const rejectProductionMutation = (reply: {
      status: (statusCode: number) => {
        send: (payload: unknown) => unknown;
      };
    }) =>
      reply.status(403).send({
        message:
          'Production is read-only in the Operations Console. Use the explicit promote action for production changes.',
        status: 'error',
      });

    fastify.get(apiPaths.adminCatalogSets, async function () {
      return catalogService.listCatalogSets();
    });

    fastify.get<{ Querystring: { query?: string } }>(
      apiPaths.adminCatalogThemes,
      async function (request) {
        return catalogService.listThemePresentations({
          query: request.query.query,
        });
      },
    );

    fastify.get<{ Querystring: { query?: string } }>(
      apiPaths.adminCatalogCollections,
      async function (request) {
        return catalogService.listCollectionPresentations({
          query: request.query.query,
        });
      },
    );

    fastify.get(apiPaths.adminHomepageSections, async function () {
      return catalogService.listHomepageSections();
    });

    fastify.get(apiPaths.adminCatalogSuggestedSets, async function () {
      return catalogService.listSuggestedSets();
    });

    fastify.get<{ Querystring: { status?: string } }>(
      apiPaths.adminCatalogDiscoveryCandidates,
      async function (request, reply) {
        const status = request.query.status;

        if (
          status &&
          ![
            'all',
            'failed',
            'ignored',
            'imported',
            'new',
            'non_set',
            'onboarding_started',
            'processing',
            'rejected',
            'reviewed',
          ].includes(status)
        ) {
          return reply.status(400).send({
            message: 'Discovery status filter is ongeldig.',
          });
        }

        return catalogService.listDiscoveryCandidates({
          status: (status as CatalogDiscoveryCandidateStatus | 'all') ?? 'all',
        });
      },
    );

    fastify.get<{ Querystring: { query?: string } }>(
      apiPaths.adminCatalogSetSearch,
      async function (request, reply) {
        try {
          const query = readSearchQuery(request.query);

          return catalogService.searchMissingSets(query);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Catalog search input is invalid.',
            ),
          });
        }
      },
    );

    fastify.get(
      `${apiPaths.adminCatalogBulkOnboardingRuns}/latest`,
      async function (_request, reply) {
        const latestRunResult =
          await catalogService.getLatestBulkOnboardingRun();

        if (!latestRunResult.run) {
          return reply.status(404).send({
            message: 'Er is nog geen bulk onboarding run gestart.',
          });
        }

        return latestRunResult;
      },
    );

    fastify.get<{ Params: { runId?: string } }>(
      `${apiPaths.adminCatalogBulkOnboardingRuns}/:runId`,
      async function (request, reply) {
        try {
          const runId = readRunId(request.params);
          const runResult = await catalogService.getBulkOnboardingRun(runId);

          if (!runResult.run) {
            return reply.status(404).send({
              message: 'Bulk onboarding run niet gevonden.',
            });
          }

          return runResult;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Bulk onboarding run input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCatalogSets,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = readCatalogSetInput(request.body);
          const catalogSet = await catalogService.createSet(input);
          await revalidateCatalogSetSurfaces(catalogSet, revalidatePublicWebFn);

          return reply.status(201).send(catalogSet);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Catalog set input is invalid.',
            ),
          });
        }
      },
    );

    fastify.put<{ Body: unknown; Params: { slug: string } }>(
      `${apiPaths.adminCatalogThemes}/:slug`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = readThemePresentationInput(request.body);
          const themePresentation =
            await catalogService.updateThemePresentation({
              input,
              slug: request.params.slug,
            });

          await revalidateThemePresentationSurfaces(
            themePresentation.slug,
            revalidatePublicWebFn,
          );

          return themePresentation;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Theme presentation input is invalid.',
            ),
          });
        }
      },
    );

    fastify.put<{ Body: unknown; Params: { slug: string } }>(
      `${apiPaths.adminCatalogCollections}/:slug`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = readCollectionPresentationInput(request.body);
          const collectionPresentation =
            await catalogService.updateCollectionPresentation({
              input,
              slug: request.params.slug,
            });

          await revalidateCollectionPresentationSurfaces(
            collectionPresentation.collectionSlug,
            revalidatePublicWebFn,
          );

          return collectionPresentation;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Collection presentation input is invalid.',
            ),
          });
        }
      },
    );

    fastify.put<{ Body: unknown; Params: { sectionKey: string } }>(
      `${apiPaths.adminHomepageSections}/:sectionKey`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = {
            ...readHomepageSectionInput(request.body),
            sectionKey: request.params.sectionKey,
          };
          const section = await catalogService.saveHomepageSection(input);

          await revalidateHomepageCmsSurfaces(revalidatePublicWebFn);

          return section;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Homepage section input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      `${apiPaths.adminCatalogDiscoveryCandidates}/bulk-import`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = readDiscoveryCandidateBulkImportInput(request.body);

          return catalogService.bulkImportDiscoveryCandidates(input);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Bulk discovery import input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Params: { candidateId: string } }>(
      `${apiPaths.adminCatalogDiscoveryCandidates}/:candidateId/import`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          return await catalogService.importDiscoveryCandidate({
            candidateId: request.params.candidateId,
          });
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Discovery candidate kon niet worden geimporteerd.',
            ),
          });
        }
      },
    );

    fastify.post<{ Params: { setId: string } }>(
      `${apiPaths.adminCatalogSets}/:setId/re-enrich`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          return await catalogService.reEnrichCatalogSet({
            setId: request.params.setId,
          });
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Catalog set kon niet opnieuw worden verrijkt.',
            ),
          });
        }
      },
    );

    fastify.post(
      `${apiPaths.adminCatalogDiscoveryCandidates}/recompute-confidence`,
      async function (_request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          return await catalogService.recomputeDiscoveryCandidateConfidence();
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Discovery confidence kon niet worden herberekend.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown; Params: { candidateId: string } }>(
      `${apiPaths.adminCatalogDiscoveryCandidates}/:candidateId/status`,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const { status } = readDiscoveryCandidateStatusInput(request.body);

          return await catalogService.updateDiscoveryCandidateStatus({
            candidateId: request.params.candidateId,
            status,
          });
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Discovery candidate status is ongeldig.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCatalogBulkOnboardingRuns,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return rejectProductionMutation(reply);
        }

        try {
          const input = readBulkOnboardingInput(request.body);
          const result = await catalogService.startBulkOnboarding(input);

          return reply.status(202).send(result);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Bulk onboarding input is invalid.',
            ),
          });
        }
      },
    );
  };
}

export default createAdminCatalogRoutes();
