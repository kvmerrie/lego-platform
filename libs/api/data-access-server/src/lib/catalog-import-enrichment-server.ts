import {
  CATALOG_SET_SOURCE_METADATA_TABLE,
  CATALOG_SETS_TABLE,
  createCatalogSetFromDiscoveryCandidate,
  listCatalogDiscoveryCandidatesBySetIds,
  listCanonicalCatalogSets,
  type CatalogDiscoveryCandidate,
} from '@lego-platform/catalog/data-access-server';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  syncBricksetEnrichmentMetadata,
  type BricksetEnrichmentRecord,
  type BricksetEnrichmentSyncResult,
} from './brickset-enrichment-sync-server';
import { applyBricksetPublicThemeMappings } from './catalog-bulk-onboarding-server';
import {
  enrichCatalogSetMinifigSummaries,
  type CatalogMinifigOnboardingEnrichmentResult,
} from './catalog-minifig-onboarding-server';
import { refreshSetDetailRelatedThemeSnapshotsForSetIds } from './set-detail-related-theme-snapshot-server';

export type CatalogImportEnrichmentStageStatus =
  | 'failed'
  | 'skipped'
  | 'success';

export interface CatalogImportEnrichmentStageResult {
  detail?: Readonly<Record<string, unknown>>;
  status: CatalogImportEnrichmentStageStatus;
  warning?: string;
}

export interface CatalogImportPipelineResult {
  bricksetStatus: CatalogImportEnrichmentStageStatus;
  durationMs: number;
  enrichmentStatus: 'complete' | 'partial' | 'skipped';
  importedSetId: string;
  importedSlug: string;
  minifigStatus: CatalogImportEnrichmentStageStatus;
  stages: {
    brickset: CatalogImportEnrichmentStageResult;
    minifig: CatalogImportEnrichmentStageResult;
    relatedThemeSnapshot?: CatalogImportEnrichmentStageResult;
    sourceMetadata?: CatalogImportEnrichmentStageResult;
    theme: CatalogImportEnrichmentStageResult;
  };
  sourceMetadataStatus?: CatalogImportEnrichmentStageStatus;
  themeStatus: CatalogImportEnrichmentStageStatus;
  warnings: readonly string[];
}

export interface EnrichImportedCatalogSetsDependencies {
  applyBricksetPublicThemeMappingsFn?: typeof applyBricksetPublicThemeMappings;
  backfillCatalogSetPieceCountsFn?: typeof backfillCatalogSetPieceCounts;
  enrichCatalogSetMinifigSummariesFn?: typeof enrichCatalogSetMinifigSummaries;
  getNow?: () => Date;
  refreshSetDetailRelatedThemeSnapshotsForSetIdsFn?: typeof refreshSetDetailRelatedThemeSnapshotsForSetIds;
  syncBricksetEnrichmentMetadataFn?: typeof syncBricksetEnrichmentMetadata;
}

export interface ImportedCatalogSetIdentity {
  setId: string;
  slug: string;
  sourceSetNumber?: string;
}

export interface EnrichImportedCatalogSetsResult {
  durationMs: number;
  results: readonly CatalogImportPipelineResult[];
  warnings: readonly string[];
}

export interface ReEnrichImportedCatalogSetsResult {
  dryRun: boolean;
  results: readonly CatalogImportPipelineResult[];
  setIds: readonly string[];
  warnings: readonly string[];
}

export type CatalogSetMissingEnrichmentScope =
  | 'brickset'
  | 'minifigs'
  | 'source-metadata'
  | 'theme';

export interface CatalogSetMissingEnrichmentSelection {
  consideredCount: number;
  reasonsBySetId: Readonly<
    Record<string, readonly CatalogSetMissingEnrichmentScope[]>
  >;
  selectedCount: number;
  setIds: readonly string[];
  skippedCount: number;
}

export interface ReEnrichCatalogSetsMissingOptions {
  batchSize?: number;
  dryRun?: boolean;
  limit?: number;
  missing?: readonly CatalogSetMissingEnrichmentScope[];
  setIds?: readonly string[];
}

export interface ReEnrichCatalogSetsMissingResult
  extends ReEnrichImportedCatalogSetsResult {
  failedCount: number;
  selectedCount: number;
  selection: CatalogSetMissingEnrichmentSelection;
  skippedCount: number;
  successCount: number;
  warningCount: number;
}

interface CatalogSetThemeIdentityRow {
  primary_theme_id: string | null;
  set_id: string;
  source_theme_id: string | null;
}

interface CatalogSetSourceMetadataIdentityRow {
  catalog_set_id: string;
  locale: string | null;
  source: string;
}

interface CatalogSetMinifigSummaryIdentityRow {
  set_id: string;
}

interface CatalogSetPieceCountRow {
  piece_count: number | null;
  set_id: string;
  source_set_number: string | null;
}

interface RebrickableSetPieceCountRow {
  num_parts: number | null;
  set_num: string;
}

const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const REBRICKABLE_SETS_TABLE = 'rebrickable_sets';
const DEFAULT_MISSING_ENRICHMENT_SCOPES: readonly CatalogSetMissingEnrichmentScope[] =
  ['brickset', 'minifigs', 'source-metadata', 'theme'];

function toWarningMessage(stage: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error.';

  return `${stage}: ${message}`;
}

function getPipelineStatus({
  bricksetStatus,
  minifigStatus,
  themeStatus,
}: {
  bricksetStatus: CatalogImportEnrichmentStageStatus;
  minifigStatus: CatalogImportEnrichmentStageStatus;
  themeStatus: CatalogImportEnrichmentStageStatus;
}): CatalogImportPipelineResult['enrichmentStatus'] {
  if (
    bricksetStatus === 'success' &&
    minifigStatus === 'success' &&
    themeStatus === 'success'
  ) {
    return 'complete';
  }

  if (
    bricksetStatus === 'skipped' &&
    minifigStatus === 'skipped' &&
    themeStatus === 'skipped'
  ) {
    return 'skipped';
  }

  return 'partial';
}

function readPositivePieceCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function getCatalogSetNumberCandidates({
  setId,
  sourceSetNumber,
}: {
  setId: string;
  sourceSetNumber?: string | null;
}): string[] {
  return [
    ...new Set(
      [
        sourceSetNumber?.trim(),
        setId,
        /^\d+$/u.test(setId) ? `${setId}-1` : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
}

export async function backfillCatalogSetPieceCounts({
  catalogSets,
  metadataRecords,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  catalogSets: readonly ImportedCatalogSetIdentity[];
  metadataRecords: readonly BricksetEnrichmentRecord[];
  supabaseClient?: ReturnType<typeof getServerSupabaseAdminClient>;
}): Promise<{ updatedCount: number }> {
  const setIds = [
    ...new Set(catalogSets.map((catalogSet) => catalogSet.setId)),
  ];

  if (!setIds.length) {
    return { updatedCount: 0 };
  }

  const bricksetPieceCountBySetId = new Map(
    metadataRecords.flatMap((record) => {
      const pieceCount = readPositivePieceCount(record.metadataJson.pieces);

      return pieceCount ? [[record.catalogSetId, pieceCount] as const] : [];
    }),
  );
  const { data: catalogSetRowsData, error: catalogSetRowsError } =
    await supabaseClient
      .from(CATALOG_SETS_TABLE)
      .select('set_id, source_set_number, piece_count')
      .in('set_id', setIds);

  if (catalogSetRowsError) {
    throw new Error('Unable to load catalog sets for piece-count backfill.');
  }

  const zeroPieceRows = (
    (catalogSetRowsData as CatalogSetPieceCountRow[] | null) ?? []
  ).filter((row) => !readPositivePieceCount(row.piece_count));

  if (!zeroPieceRows.length) {
    return { updatedCount: 0 };
  }

  const rebrickableSetNumbers = [
    ...new Set(
      zeroPieceRows.flatMap((row) =>
        getCatalogSetNumberCandidates({
          setId: row.set_id,
          sourceSetNumber: row.source_set_number,
        }),
      ),
    ),
  ];
  const { data: rebrickableRowsData, error: rebrickableRowsError } =
    rebrickableSetNumbers.length
      ? await supabaseClient
          .from(REBRICKABLE_SETS_TABLE)
          .select('set_num, num_parts')
          .in('set_num', rebrickableSetNumbers)
      : { data: [], error: null };

  if (rebrickableRowsError) {
    throw new Error(
      'Unable to load local Rebrickable sets for piece-count backfill.',
    );
  }

  const rebrickablePieceCountBySetNumber = new Map(
    (
      (rebrickableRowsData as RebrickableSetPieceCountRow[] | null) ?? []
    ).flatMap((row) => {
      const pieceCount = readPositivePieceCount(row.num_parts);

      return pieceCount ? [[row.set_num, pieceCount] as const] : [];
    }),
  );
  let updatedCount = 0;

  for (const row of zeroPieceRows) {
    const rebrickablePieceCount = getCatalogSetNumberCandidates({
      setId: row.set_id,
      sourceSetNumber: row.source_set_number,
    })
      .map((setNumber) => rebrickablePieceCountBySetNumber.get(setNumber))
      .find((pieceCount): pieceCount is number => Boolean(pieceCount));
    const pieceCount =
      bricksetPieceCountBySetId.get(row.set_id) ?? rebrickablePieceCount;

    if (!pieceCount) {
      continue;
    }

    const { error } = await supabaseClient
      .from(CATALOG_SETS_TABLE)
      .update({
        piece_count: pieceCount,
        updated_at: new Date().toISOString(),
      })
      .eq('set_id', row.set_id);

    if (error) {
      throw new Error(`Unable to backfill piece count for ${row.set_id}.`);
    }

    updatedCount += 1;
  }

  return { updatedCount };
}

function buildInitialPipelineResults(
  catalogSets: readonly ImportedCatalogSetIdentity[],
): Map<string, CatalogImportPipelineResult> {
  return new Map(
    catalogSets.map((catalogSet) => [
      catalogSet.setId,
      {
        bricksetStatus: 'skipped',
        durationMs: 0,
        enrichmentStatus: 'skipped',
        importedSetId: catalogSet.setId,
        importedSlug: catalogSet.slug,
        minifigStatus: 'skipped',
        stages: {
          brickset: {
            status: 'skipped',
          },
          minifig: {
            status: 'skipped',
          },
          sourceMetadata: {
            status: 'skipped',
          },
          theme: {
            status: 'skipped',
          },
        },
        sourceMetadataStatus: 'skipped',
        themeStatus: 'skipped',
        warnings: [],
      } satisfies CatalogImportPipelineResult,
    ]),
  );
}

function setStageWarning({
  result,
  stage,
  warning,
}: {
  result: CatalogImportPipelineResult;
  stage: keyof CatalogImportPipelineResult['stages'];
  warning: string;
}) {
  result.stages[stage] = {
    status: 'failed',
    warning,
  };
}

function applyBricksetResult({
  bricksetResult,
  resultsBySetId,
}: {
  bricksetResult: BricksetEnrichmentSyncResult;
  resultsBySetId: Map<string, CatalogImportPipelineResult>;
}) {
  const recordsBySetId = new Map(
    bricksetResult.metadataRecords.map(
      (record) => [record.catalogSetId, record] as const,
    ),
  );

  for (const result of resultsBySetId.values()) {
    const record = recordsBySetId.get(result.importedSetId);

    result.stages.brickset = {
      detail: {
        fetchedSetCount: bricksetResult.fetchedSetCount,
        matchedCatalogSetCount: bricksetResult.matchedCatalogSetCount,
        sourceMetadataUpsertedCount: bricksetResult.sourceMetadataUpsertedCount,
        unmatched: !record,
      },
      status: record ? 'success' : 'skipped',
      ...(record ? {} : { warning: 'Brickset metadata not found.' }),
    };
  }
}

function applyThemeResult({
  metadataRecords,
  resultsBySetId,
  updatedCount,
}: {
  metadataRecords: readonly BricksetEnrichmentRecord[];
  resultsBySetId: Map<string, CatalogImportPipelineResult>;
  updatedCount: number;
}) {
  const bricksetMatchedSetIds = new Set(
    metadataRecords.map((record) => record.catalogSetId),
  );

  for (const result of resultsBySetId.values()) {
    result.stages.theme = {
      detail: {
        updatedCount,
      },
      status: bricksetMatchedSetIds.has(result.importedSetId)
        ? 'success'
        : 'skipped',
      ...(bricksetMatchedSetIds.has(result.importedSetId)
        ? {}
        : { warning: 'Theme mapping skipped because Brickset did not match.' }),
    };
  }
}

function applyMinifigResult({
  minifigResult,
  resultsBySetId,
}: {
  minifigResult: CatalogMinifigOnboardingEnrichmentResult;
  resultsBySetId: Map<string, CatalogImportPipelineResult>;
}) {
  const failedSetIds = new Set(minifigResult.failedSetIds);

  for (const result of resultsBySetId.values()) {
    result.stages.minifig = {
      detail: {
        processedSets: minifigResult.processedSets,
        summariesUpserted: minifigResult.summariesUpserted,
      },
      status: failedSetIds.has(result.importedSetId) ? 'failed' : 'success',
      ...(failedSetIds.has(result.importedSetId)
        ? { warning: 'Minifig enrichment failed for this set.' }
        : {}),
    };
  }
}

function finalizePipelineResults({
  getNow,
  resultsBySetId,
  stageStartedAt,
}: {
  getNow: () => Date;
  resultsBySetId: Map<string, CatalogImportPipelineResult>;
  stageStartedAt: Date;
}) {
  const durationMs = Math.max(0, getNow().getTime() - stageStartedAt.getTime());

  for (const result of resultsBySetId.values()) {
    const warnings = Object.values(result.stages)
      .map((stage) => stage.warning)
      .filter((warning): warning is string => Boolean(warning));

    result.bricksetStatus = result.stages.brickset.status;
    result.durationMs = durationMs;
    result.enrichmentStatus = getPipelineStatus({
      bricksetStatus: result.stages.brickset.status,
      minifigStatus: result.stages.minifig.status,
      themeStatus: result.stages.theme.status,
    });
    result.minifigStatus = result.stages.minifig.status;
    result.sourceMetadataStatus = result.stages.sourceMetadata?.status;
    result.themeStatus = result.stages.theme.status;
    result.warnings = warnings;
  }
}

function getCandidateLookupKeys(
  candidate: CatalogDiscoveryCandidate,
): readonly string[] {
  return [
    candidate.importedSetId,
    candidate.normalizedSetId,
    candidate.sourceSetNumber,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function getCatalogSetLookupKeys(
  catalogSet: ImportedCatalogSetIdentity,
): readonly string[] {
  return [catalogSet.setId, catalogSet.sourceSetNumber].filter(
    (value): value is string => Boolean(value?.trim()),
  );
}

function findMatchingDiscoveryCandidate({
  candidates,
  catalogSet,
}: {
  candidates: readonly CatalogDiscoveryCandidate[];
  catalogSet: ImportedCatalogSetIdentity;
}): CatalogDiscoveryCandidate | undefined {
  const catalogSetKeys = new Set(getCatalogSetLookupKeys(catalogSet));

  return candidates.find((candidate) =>
    getCandidateLookupKeys(candidate).some((key) => catalogSetKeys.has(key)),
  );
}

function toDryRunResult({
  catalogSet,
  candidateFound,
}: {
  catalogSet: ImportedCatalogSetIdentity;
  candidateFound: boolean;
}): CatalogImportPipelineResult {
  const sourceMetadataWarning = candidateFound
    ? 'dry run: source metadata backfill was not written.'
    : 'dry run: no matching discovery candidate source metadata found.';

  return {
    bricksetStatus: 'skipped',
    durationMs: 0,
    enrichmentStatus: 'skipped',
    importedSetId: catalogSet.setId,
    importedSlug: catalogSet.slug,
    minifigStatus: 'skipped',
    sourceMetadataStatus: 'skipped',
    stages: {
      brickset: {
        status: 'skipped',
        warning: 'dry run: Brickset enrichment was not run.',
      },
      minifig: {
        status: 'skipped',
        warning: 'dry run: minifig enrichment was not run.',
      },
      sourceMetadata: {
        status: 'skipped',
        warning: sourceMetadataWarning,
      },
      theme: {
        status: 'skipped',
        warning: 'dry run: theme mapping was not run.',
      },
    },
    themeStatus: 'skipped',
    warnings: ['dry run: no writes performed.', sourceMetadataWarning],
  };
}

function toMissingCatalogSetResult(setId: string): CatalogImportPipelineResult {
  return {
    bricksetStatus: 'failed',
    durationMs: 0,
    enrichmentStatus: 'partial',
    importedSetId: setId,
    importedSlug: '',
    minifigStatus: 'failed',
    sourceMetadataStatus: 'failed',
    stages: {
      brickset: {
        status: 'failed',
        warning: 'catalog set not found.',
      },
      minifig: {
        status: 'failed',
        warning: 'catalog set not found.',
      },
      sourceMetadata: {
        status: 'failed',
        warning: 'catalog set not found.',
      },
      theme: {
        status: 'failed',
        warning: 'catalog set not found.',
      },
    },
    themeStatus: 'failed',
    warnings: ['catalog set not found.'],
  };
}

function chunkValues<T>(values: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizePositiveInteger({
  fallback,
  maximum,
  minimum = 1,
  value,
}: {
  fallback: number;
  maximum?: number;
  minimum?: number;
  value?: number;
}): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const flooredValue = Math.floor(value ?? fallback);
  const boundedMinimum = Math.max(minimum, flooredValue);

  return maximum ? Math.min(maximum, boundedMinimum) : boundedMinimum;
}

function normalizeMissingEnrichmentScopes(
  scopes?: readonly CatalogSetMissingEnrichmentScope[],
): readonly CatalogSetMissingEnrichmentScope[] {
  const requestedScopes = scopes?.length
    ? scopes
    : DEFAULT_MISSING_ENRICHMENT_SCOPES;

  return [...new Set(requestedScopes)];
}

async function loadCatalogSetSourceMetadataRows(
  setIds: readonly string[],
): Promise<readonly CatalogSetSourceMetadataIdentityRow[]> {
  if (!setIds.length) {
    return [];
  }

  const supabaseClient = getServerSupabaseAdminClient();
  const rows: CatalogSetSourceMetadataIdentityRow[] = [];

  for (const setIdChunk of chunkValues(setIds, 500)) {
    const { data, error } = await supabaseClient
      .from(CATALOG_SET_SOURCE_METADATA_TABLE)
      .select('catalog_set_id, source, locale')
      .in('catalog_set_id', setIdChunk);

    if (error) {
      throw new Error(
        `Unable to load catalog set source metadata: ${error.message}`,
      );
    }

    rows.push(
      ...((data as CatalogSetSourceMetadataIdentityRow[] | null) ?? []),
    );
  }

  return rows;
}

async function loadCatalogSetMinifigSummaryRows(
  setIds: readonly string[],
): Promise<readonly CatalogSetMinifigSummaryIdentityRow[]> {
  if (!setIds.length) {
    return [];
  }

  const supabaseClient = getServerSupabaseAdminClient();
  const rows: CatalogSetMinifigSummaryIdentityRow[] = [];

  for (const setIdChunk of chunkValues(setIds, 500)) {
    const { data, error } = await supabaseClient
      .from(CATALOG_SET_MINIFIG_SUMMARIES_TABLE)
      .select('set_id')
      .in('set_id', setIdChunk);

    if (error) {
      throw new Error(
        `Unable to load catalog set minifig summaries: ${error.message}`,
      );
    }

    rows.push(
      ...((data as CatalogSetMinifigSummaryIdentityRow[] | null) ?? []),
    );
  }

  return rows;
}

async function loadCatalogSetThemeRows(
  setIds: readonly string[],
): Promise<readonly CatalogSetThemeIdentityRow[]> {
  if (!setIds.length) {
    return [];
  }

  const supabaseClient = getServerSupabaseAdminClient();
  const rows: CatalogSetThemeIdentityRow[] = [];

  for (const setIdChunk of chunkValues(setIds, 500)) {
    const { data, error } = await supabaseClient
      .from(CATALOG_SETS_TABLE)
      .select('set_id, source_theme_id, primary_theme_id')
      .in('set_id', setIdChunk);

    if (error) {
      throw new Error(
        `Unable to load catalog set theme identity: ${error.message}`,
      );
    }

    rows.push(...((data as CatalogSetThemeIdentityRow[] | null) ?? []));
  }

  return rows;
}

function getSourceMetadataKey({
  locale,
  setId,
  source,
}: {
  locale?: string | null;
  setId: string;
  source: string;
}): string {
  return `${setId}:${source}:${locale ?? ''}`;
}

function candidateHasSourceMetadata({
  candidate,
  catalogSet,
  sourceMetadataKeys,
}: {
  candidate: CatalogDiscoveryCandidate;
  catalogSet: ImportedCatalogSetIdentity;
  sourceMetadataKeys: ReadonlySet<string>;
}): boolean {
  return sourceMetadataKeys.has(
    getSourceMetadataKey({
      locale: 'nl-NL',
      setId: catalogSet.setId,
      source: candidate.source,
    }),
  );
}

function countReEnrichmentResults({
  results,
}: {
  results: readonly CatalogImportPipelineResult[];
}): {
  failedCount: number;
  successCount: number;
  warningCount: number;
} {
  let failedCount = 0;
  let successCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const hasFailedStage = Object.values(result.stages).some(
      (stage) => stage.status === 'failed',
    );
    const hasWarnings = result.warnings.length > 0;

    if (hasFailedStage) {
      failedCount += 1;
    } else if (hasWarnings) {
      warningCount += 1;
    } else {
      successCount += 1;
    }
  }

  return {
    failedCount,
    successCount,
    warningCount,
  };
}

export async function enrichImportedCatalogSets({
  catalogSets,
  dependencies = {},
}: {
  catalogSets: readonly ImportedCatalogSetIdentity[];
  dependencies?: EnrichImportedCatalogSetsDependencies;
}): Promise<EnrichImportedCatalogSetsResult> {
  const {
    applyBricksetPublicThemeMappingsFn = applyBricksetPublicThemeMappings,
    backfillCatalogSetPieceCountsFn = backfillCatalogSetPieceCounts,
    enrichCatalogSetMinifigSummariesFn = enrichCatalogSetMinifigSummaries,
    getNow = () => new Date(),
    refreshSetDetailRelatedThemeSnapshotsForSetIdsFn = refreshSetDetailRelatedThemeSnapshotsForSetIds,
    syncBricksetEnrichmentMetadataFn = syncBricksetEnrichmentMetadata,
  } = dependencies;
  const uniqueCatalogSets = [
    ...new Map(
      catalogSets.map((catalogSet) => [catalogSet.setId, catalogSet]),
    ).values(),
  ];
  const startedAt = getNow();
  const resultsBySetId = buildInitialPipelineResults(uniqueCatalogSets);
  const sourceSetNumbers = uniqueCatalogSets
    .map((catalogSet) => catalogSet.sourceSetNumber)
    .filter((sourceSetNumber): sourceSetNumber is string =>
      Boolean(sourceSetNumber?.trim()),
    );

  if (uniqueCatalogSets.length === 0) {
    return {
      durationMs: 0,
      results: [],
      warnings: [],
    };
  }

  try {
    const bricksetResult = await syncBricksetEnrichmentMetadataFn({
      dryRun: false,
      setNumbers: sourceSetNumbers,
      syncCollectionPageSnapshotsFn: async ({ dryRun }) => ({
        dryRun,
        generatedAt: new Date().toISOString(),
        snapshots: [],
        summaryByCollectionSlug: {},
        upsertedCount: 0,
      }),
    });

    applyBricksetResult({
      bricksetResult,
      resultsBySetId,
    });

    try {
      await backfillCatalogSetPieceCountsFn({
        catalogSets: uniqueCatalogSets,
        metadataRecords: bricksetResult.metadataRecords,
      });
    } catch (error) {
      const warning = toWarningMessage('piece count', error);

      for (const result of resultsBySetId.values()) {
        setStageWarning({
          result,
          stage: 'brickset',
          warning,
        });
      }
    }

    try {
      const themeResult = await applyBricksetPublicThemeMappingsFn({
        metadataRecords: bricksetResult.metadataRecords,
      });

      applyThemeResult({
        metadataRecords: bricksetResult.metadataRecords,
        resultsBySetId,
        updatedCount: themeResult.updatedCount,
      });
    } catch (error) {
      const warning = toWarningMessage('theme', error);

      for (const result of resultsBySetId.values()) {
        setStageWarning({
          result,
          stage: 'theme',
          warning,
        });
      }
    }
  } catch (error) {
    const warning = toWarningMessage('brickset', error);

    for (const result of resultsBySetId.values()) {
      setStageWarning({
        result,
        stage: 'brickset',
        warning,
      });
      setStageWarning({
        result,
        stage: 'theme',
        warning: 'theme: skipped because Brickset enrichment failed.',
      });
    }
  }

  try {
    const minifigResult = await enrichCatalogSetMinifigSummariesFn({
      setIds: uniqueCatalogSets.map((catalogSet) => catalogSet.setId),
    });

    applyMinifigResult({
      minifigResult,
      resultsBySetId,
    });
  } catch (error) {
    const warning = toWarningMessage('minifig', error);

    for (const result of resultsBySetId.values()) {
      setStageWarning({
        result,
        stage: 'minifig',
        warning,
      });
    }
  }

  try {
    const relatedThemeSnapshotResult =
      await refreshSetDetailRelatedThemeSnapshotsForSetIdsFn({
        setIds: uniqueCatalogSets.map((catalogSet) => catalogSet.setId),
      });

    for (const result of resultsBySetId.values()) {
      result.stages.relatedThemeSnapshot = {
        detail: {
          affectedSetCount: relatedThemeSnapshotResult.affectedSetIds.length,
          affectedThemeSlugs: relatedThemeSnapshotResult.affectedThemeSlugs,
          snapshotCount: relatedThemeSnapshotResult.snapshotCount,
          upsertedCount: relatedThemeSnapshotResult.upsertedCount,
        },
        status: 'success',
      };
    }
  } catch (error) {
    const warning = toWarningMessage('related theme snapshot', error);

    for (const result of resultsBySetId.values()) {
      result.stages.relatedThemeSnapshot = {
        status: 'failed',
        warning,
      };
    }
  }

  finalizePipelineResults({
    getNow,
    resultsBySetId,
    stageStartedAt: startedAt,
  });

  const results = [...resultsBySetId.values()];

  return {
    durationMs: Math.max(0, getNow().getTime() - startedAt.getTime()),
    results,
    warnings: results.flatMap((result) => result.warnings),
  };
}

export async function enrichImportedCatalogSet({
  catalogSet,
  dependencies,
}: {
  catalogSet: ImportedCatalogSetIdentity;
  dependencies?: EnrichImportedCatalogSetsDependencies;
}): Promise<CatalogImportPipelineResult> {
  const result = await enrichImportedCatalogSets({
    catalogSets: [catalogSet],
    dependencies,
  });

  return (
    result.results[0] ?? {
      bricksetStatus: 'skipped',
      durationMs: result.durationMs,
      enrichmentStatus: 'skipped',
      importedSetId: catalogSet.setId,
      importedSlug: catalogSet.slug,
      minifigStatus: 'skipped',
      stages: {
        brickset: { status: 'skipped' },
        minifig: { status: 'skipped' },
        theme: { status: 'skipped' },
      },
      themeStatus: 'skipped',
      warnings: [],
    }
  );
}

export async function selectCatalogSetsMissingEnrichment({
  limit,
  missing,
  setIds,
}: {
  limit?: number;
  missing?: readonly CatalogSetMissingEnrichmentScope[];
  setIds?: readonly string[];
} = {}): Promise<CatalogSetMissingEnrichmentSelection> {
  const scopes = normalizeMissingEnrichmentScopes(missing);
  const requestedSetIds = setIds?.length
    ? [...new Set(setIds.map((setId) => setId.trim()).filter(Boolean))]
    : undefined;
  const requestedSetIdSet = requestedSetIds
    ? new Set(requestedSetIds)
    : undefined;
  const catalogSets = (
    await listCanonicalCatalogSets({
      includeInactive: true,
    })
  ).filter((catalogSet) =>
    requestedSetIdSet ? requestedSetIdSet.has(catalogSet.setId) : true,
  );
  const catalogSetIdentities = catalogSets.map(
    (catalogSet) =>
      ({
        setId: catalogSet.setId,
        slug: catalogSet.slug,
        sourceSetNumber: catalogSet.sourceSetNumber,
      }) satisfies ImportedCatalogSetIdentity,
  );
  const catalogSetIds = catalogSetIdentities.map(
    (catalogSet) => catalogSet.setId,
  );
  const [sourceMetadataRows, minifigRows, themeRows, candidates] =
    await Promise.all([
      scopes.includes('brickset') || scopes.includes('source-metadata')
        ? loadCatalogSetSourceMetadataRows(catalogSetIds)
        : Promise.resolve([]),
      scopes.includes('minifigs')
        ? loadCatalogSetMinifigSummaryRows(catalogSetIds)
        : Promise.resolve([]),
      scopes.includes('theme')
        ? loadCatalogSetThemeRows(catalogSetIds)
        : Promise.resolve([]),
      scopes.includes('source-metadata') && catalogSetIdentities.length > 0
        ? listCatalogDiscoveryCandidatesBySetIds({
            setIds: catalogSetIdentities.flatMap((catalogSet) =>
              getCatalogSetLookupKeys(catalogSet),
            ),
          })
        : Promise.resolve([]),
    ]);
  const sourceMetadataKeys = new Set(
    sourceMetadataRows.map((row) =>
      getSourceMetadataKey({
        locale: row.locale,
        setId: row.catalog_set_id,
        source: row.source,
      }),
    ),
  );
  const minifigSetIds = new Set(minifigRows.map((row) => row.set_id));
  const themeRowsBySetId = new Map(
    themeRows.map((row) => [row.set_id, row] as const),
  );
  const reasonsBySetId = new Map<string, CatalogSetMissingEnrichmentScope[]>();

  for (const catalogSet of catalogSetIdentities) {
    const reasons: CatalogSetMissingEnrichmentScope[] = [];

    if (
      scopes.includes('brickset') &&
      !sourceMetadataKeys.has(
        getSourceMetadataKey({
          locale: 'en-US',
          setId: catalogSet.setId,
          source: 'brickset',
        }),
      )
    ) {
      reasons.push('brickset');
    }

    if (scopes.includes('minifigs') && !minifigSetIds.has(catalogSet.setId)) {
      reasons.push('minifigs');
    }

    if (scopes.includes('theme')) {
      const themeRow = themeRowsBySetId.get(catalogSet.setId);

      if (!themeRow?.source_theme_id || !themeRow.primary_theme_id) {
        reasons.push('theme');
      }
    }

    if (scopes.includes('source-metadata')) {
      const candidate = findMatchingDiscoveryCandidate({
        candidates,
        catalogSet,
      });

      if (
        candidate &&
        !candidateHasSourceMetadata({
          candidate,
          catalogSet,
          sourceMetadataKeys,
        })
      ) {
        reasons.push('source-metadata');
      }
    }

    if (reasons.length > 0) {
      reasonsBySetId.set(catalogSet.setId, reasons);
    }
  }

  const selectedSetIds = [...reasonsBySetId.keys()];
  const safeLimit = limit
    ? normalizePositiveInteger({
        fallback: selectedSetIds.length,
        minimum: 1,
        value: limit,
      })
    : selectedSetIds.length;
  const limitedSetIds = selectedSetIds.slice(0, safeLimit);
  const limitedSetIdSet = new Set(limitedSetIds);

  return {
    consideredCount: catalogSetIdentities.length,
    reasonsBySetId: Object.fromEntries(
      [...reasonsBySetId.entries()].filter(([setId]) =>
        limitedSetIdSet.has(setId),
      ),
    ),
    selectedCount: limitedSetIds.length,
    setIds: limitedSetIds,
    skippedCount: Math.max(
      0,
      catalogSetIdentities.length - limitedSetIds.length,
    ),
  };
}

export async function reEnrichImportedCatalogSets({
  dryRun = false,
  setIds,
}: {
  dryRun?: boolean;
  setIds: readonly string[];
}): Promise<ReEnrichImportedCatalogSetsResult> {
  const requestedSetIds = [
    ...new Set(setIds.map((setId) => setId.trim()).filter(Boolean)),
  ];

  if (!requestedSetIds.length) {
    return {
      dryRun,
      results: [],
      setIds: [],
      warnings: ['No set ids requested.'],
    };
  }

  const catalogSets = await listCanonicalCatalogSets({
    includeInactive: true,
  });
  const catalogSetsById = new Map(
    catalogSets.map((catalogSet) => [catalogSet.setId, catalogSet]),
  );
  const selectedCatalogSets = requestedSetIds.flatMap((setId) => {
    const catalogSet = catalogSetsById.get(setId);

    return catalogSet
      ? [
          {
            setId: catalogSet.setId,
            slug: catalogSet.slug,
            sourceSetNumber: catalogSet.sourceSetNumber,
          } satisfies ImportedCatalogSetIdentity,
        ]
      : [];
  });
  const missingResults = requestedSetIds
    .filter((setId) => !catalogSetsById.has(setId))
    .map(toMissingCatalogSetResult);
  const candidates =
    selectedCatalogSets.length > 0
      ? await listCatalogDiscoveryCandidatesBySetIds({
          setIds: selectedCatalogSets.flatMap((catalogSet) =>
            getCatalogSetLookupKeys(catalogSet),
          ),
        })
      : [];

  if (dryRun) {
    const dryRunResults = selectedCatalogSets.map((catalogSet) =>
      toDryRunResult({
        candidateFound: Boolean(
          findMatchingDiscoveryCandidate({
            candidates,
            catalogSet,
          }),
        ),
        catalogSet,
      }),
    );
    const results = [...dryRunResults, ...missingResults];

    return {
      dryRun,
      results,
      setIds: requestedSetIds,
      warnings: results.flatMap((result) => result.warnings),
    };
  }

  const sourceMetadataStatusBySetId = new Map<
    string,
    CatalogImportEnrichmentStageResult
  >();
  const catalogSetsForEnrichment: ImportedCatalogSetIdentity[] = [];

  for (const catalogSet of selectedCatalogSets) {
    const candidate = findMatchingDiscoveryCandidate({
      candidates,
      catalogSet,
    });

    if (!candidate) {
      sourceMetadataStatusBySetId.set(catalogSet.setId, {
        status: 'skipped',
        warning: 'No matching discovery candidate source metadata found.',
      });
      catalogSetsForEnrichment.push(catalogSet);
      continue;
    }

    try {
      const candidateCreateResult =
        await createCatalogSetFromDiscoveryCandidate({
          candidate,
        });

      sourceMetadataStatusBySetId.set(catalogSet.setId, {
        status: 'success',
      });
      catalogSetsForEnrichment.push({
        setId: candidateCreateResult.catalogSet.setId,
        slug: candidateCreateResult.catalogSet.slug,
        sourceSetNumber: candidateCreateResult.catalogSet.sourceSetNumber,
      });
    } catch (error) {
      sourceMetadataStatusBySetId.set(catalogSet.setId, {
        status: 'failed',
        warning: toWarningMessage('source metadata', error),
      });
      catalogSetsForEnrichment.push(catalogSet);
    }
  }

  const enrichmentResult = await enrichImportedCatalogSets({
    catalogSets: catalogSetsForEnrichment,
  });
  const enrichedResults = enrichmentResult.results.map((result) => {
    const sourceMetadataStage =
      sourceMetadataStatusBySetId.get(result.importedSetId) ??
      ({
        status: 'skipped',
        warning: 'No matching discovery candidate source metadata found.',
      } satisfies CatalogImportEnrichmentStageResult);
    const warnings = [
      ...result.warnings,
      ...(sourceMetadataStage.warning ? [sourceMetadataStage.warning] : []),
    ];

    return {
      ...result,
      enrichmentStatus:
        sourceMetadataStage.status === 'failed'
          ? 'partial'
          : result.enrichmentStatus,
      sourceMetadataStatus: sourceMetadataStage.status,
      stages: {
        ...result.stages,
        sourceMetadata: sourceMetadataStage,
      },
      warnings,
    } satisfies CatalogImportPipelineResult;
  });
  const results = [...enrichedResults, ...missingResults];

  return {
    dryRun,
    results,
    setIds: requestedSetIds,
    warnings: results.flatMap((result) => result.warnings),
  };
}

export async function reEnrichCatalogSetsMissing({
  batchSize,
  dryRun = false,
  limit,
  missing,
  setIds,
}: ReEnrichCatalogSetsMissingOptions): Promise<ReEnrichCatalogSetsMissingResult> {
  const selection = await selectCatalogSetsMissingEnrichment({
    limit,
    missing,
    setIds,
  });
  const safeBatchSize = normalizePositiveInteger({
    fallback: 25,
    maximum: 100,
    minimum: 1,
    value: batchSize,
  });
  const results: CatalogImportPipelineResult[] = [];

  for (const setIdBatch of chunkValues(selection.setIds, safeBatchSize)) {
    const batchResult = await reEnrichImportedCatalogSets({
      dryRun,
      setIds: setIdBatch,
    });

    results.push(...batchResult.results);
  }

  const counts = countReEnrichmentResults({
    results,
  });

  return {
    ...counts,
    dryRun,
    results,
    selectedCount: selection.selectedCount,
    selection,
    setIds: selection.setIds,
    skippedCount: selection.skippedCount,
    warnings: results.flatMap((result) => result.warnings),
  };
}
