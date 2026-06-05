import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  createCatalogSet,
  createCatalogSetFromDiscoveryCandidate,
  createCatalogSetFromLocalRebrickableMirror,
  listCatalogDiscoveryCandidates,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
  type CatalogDiscoveryCandidate,
} from '@lego-platform/catalog/data-access-server';
import type {
  CatalogCanonicalSet,
  CatalogSet,
} from '@lego-platform/catalog/util';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import {
  generateCommerceOfferSeedCandidates,
  listCommercePrimaryCoverageGapAudit,
  listCommercePrimaryCoverageReport,
  validateGeneratedCommerceOfferSeedCandidates,
  type CommercePrimaryCoverageGapAuditReport,
  type CommercePrimaryCoverageReport,
  type CommerceSeedGenerationSummary,
  type CommerceSeedValidationSummary,
} from '@lego-platform/commerce/data-access-server';
import { cacheTags } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  syncBricksetEnrichmentMetadata,
  type BricksetEnrichmentRecord,
} from './brickset-enrichment-sync-server';
import {
  enrichCatalogSetMinifigSummariesBestEffort,
  type EnrichCatalogSetMinifigSummariesFn,
} from './catalog-minifig-onboarding-server';
import {
  runCommerceSync,
  type CommerceSyncRunResult,
} from './commerce-sync-server';
import { revalidatePublicCatalogPaths } from './public-web-revalidation-server';

const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';

export const catalogBulkOnboardingRunStatuses = [
  'running',
  'completed',
  'completed_with_errors',
  'failed',
] as const;

export const catalogBulkOnboardingStageStatuses = [
  'pending',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'skipped',
] as const;

export const catalogBulkOnboardingSetProcessingStates = [
  'pending_import',
  'catalog_ready',
  'seed_generation_completed',
  'seed_validation_completed',
  'commerce_sync_completed',
] as const;

export const catalogBulkOnboardingImportStatuses = [
  'pending',
  'already_present',
  'created',
  'failed',
] as const;

export type CatalogBulkOnboardingRunStatus =
  (typeof catalogBulkOnboardingRunStatuses)[number];

export type CatalogBulkOnboardingStageStatus =
  (typeof catalogBulkOnboardingStageStatuses)[number];

export type CatalogBulkOnboardingSetProcessingState =
  (typeof catalogBulkOnboardingSetProcessingStates)[number];

export type CatalogBulkOnboardingImportStatus =
  (typeof catalogBulkOnboardingImportStatuses)[number];

export interface CatalogBulkOnboardingImportSetResult {
  catalogSetId?: string;
  catalogSetName?: string;
  catalogSetSlug?: string;
  catalogSetTheme?: string;
  error?: string;
  setId: string;
  sourceSetNumber: string;
  status: Extract<
    CatalogBulkOnboardingImportStatus,
    'already_present' | 'created' | 'failed'
  >;
  warning?: string;
}

export interface CatalogBulkOnboardingImportSummary {
  alreadyPresentCount: number;
  attemptedSetCount: number;
  bricksetEnrichmentAttempted?: boolean;
  bricksetEnrichmentMatchedCount?: number;
  bricksetEnrichmentMetadataUpsertedCount?: number;
  collectionSnapshotsRebuiltBySlug?: Record<string, number>;
  createdCount: number;
  failedCount: number;
  results: readonly CatalogBulkOnboardingImportSetResult[];
  themeMappingsUpdatedCount?: number;
}

export interface CatalogBulkOnboardingSnapshotSetSummary {
  coverageStatus?: string;
  gapMerchants: readonly {
    gapType: string;
    merchantSlug: string;
    recoveryPriority: string;
  }[];
  missingValidPrimaryOfferMerchantSlugs: readonly string[];
  primarySeedCount?: number;
  primaryMerchantTargetCount?: number;
  setId: string;
  setName: string;
  theme: string;
  validPrimaryOfferCount?: number;
}

export interface CatalogBulkOnboardingSnapshotSummary {
  actionablePartialSetCount: number;
  fullPrimaryCoverageCount: number;
  gapAuditedSetCount: number;
  gapRows: readonly CatalogBulkOnboardingSnapshotSetSummary[];
  noPrimarySeedsCount: number;
  noValidPrimaryOffersCount: number;
  parkedCount: number;
  partialPrimaryCoverageCount: number;
  recoverNowCount: number;
  reportedSetCount: number;
  setsMissingSeedCount: number;
  setsWithFullSeedButMissingOfferCount: number;
  verifyFirstCount: number;
}

export interface CatalogBulkOnboardingStageCheckpoint<TSummary> {
  appliedSetIds: readonly string[];
  completedAt?: string;
  error?: string;
  startedAt?: string;
  status: CatalogBulkOnboardingStageStatus;
  summary?: TSummary;
}

export interface CatalogBulkOnboardingSetProgress {
  catalogSetId?: string;
  catalogSetName?: string;
  catalogSetSlug?: string;
  catalogSetTheme?: string;
  importError?: string;
  importStatus: CatalogBulkOnboardingImportStatus;
  lastUpdatedAt: string;
  processingState: CatalogBulkOnboardingSetProcessingState;
  snapshot?: CatalogBulkOnboardingSnapshotSetSummary;
  sourceSetNumber: string;
  setId: string;
}

export interface CatalogBulkOnboardingRunState {
  createdAt: string;
  generateStep: CatalogBulkOnboardingStageCheckpoint<CommerceSeedGenerationSummary>;
  importStep: CatalogBulkOnboardingStageCheckpoint<CatalogBulkOnboardingImportSummary>;
  requestedSetIds: readonly string[];
  runId: string;
  setProgressById: Record<string, CatalogBulkOnboardingSetProgress>;
  snapshotStep: CatalogBulkOnboardingStageCheckpoint<CatalogBulkOnboardingSnapshotSummary>;
  status: CatalogBulkOnboardingRunStatus;
  syncStep: CatalogBulkOnboardingStageCheckpoint<CommerceSyncRunResult>;
  updatedAt: string;
  validateStep: CatalogBulkOnboardingStageCheckpoint<CommerceSeedValidationSummary>;
}

export interface CatalogBulkOnboardingStateFile {
  runsById: Record<string, CatalogBulkOnboardingRunState>;
  version: 1;
}

export interface CatalogBulkOnboardingStageExecution {
  executed: boolean;
  status: CatalogBulkOnboardingStageStatus;
}

export interface CatalogBulkOnboardingRunResult {
  run: CatalogBulkOnboardingRunState;
  runCreated: boolean;
  stageExecutions: {
    generate: CatalogBulkOnboardingStageExecution;
    import: CatalogBulkOnboardingStageExecution;
    snapshot: CatalogBulkOnboardingStageExecution;
    sync: CatalogBulkOnboardingStageExecution;
    validate: CatalogBulkOnboardingStageExecution;
  };
  stateFilePath: string;
}

export interface CatalogBulkOnboardingStartResult {
  alreadyRunning: boolean;
  run: CatalogBulkOnboardingRunState;
  runCreated: boolean;
  runId: string;
  stateFilePath: string;
}

export interface CatalogBulkOnboardingRunReadResult {
  run?: CatalogBulkOnboardingRunState;
  stateFilePath: string;
}

export interface CatalogBulkOnboardingDependencies {
  applyBricksetPublicThemeMappingsFn?: typeof applyBricksetPublicThemeMappings;
  createCatalogSetFromDiscoveryCandidateFn?: typeof createCatalogSetFromDiscoveryCandidate;
  createCatalogSetFromLocalRebrickableMirrorFn?: typeof createCatalogSetFromLocalRebrickableMirror;
  createCatalogSetFn?: typeof createCatalogSet;
  enrichCatalogSetMinifigSummariesFn?: EnrichCatalogSetMinifigSummariesFn;
  generateCommerceOfferSeedCandidatesFn?: typeof generateCommerceOfferSeedCandidates;
  getNow?: () => Date;
  listCatalogDiscoveryCandidatesFn?: typeof listCatalogDiscoveryCandidates;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommercePrimaryCoverageGapAuditFn?: typeof listCommercePrimaryCoverageGapAudit;
  listCommercePrimaryCoverageReportFn?: typeof listCommercePrimaryCoverageReport;
  revalidatePublicCatalogPathsFn?: typeof revalidatePublicCatalogPaths;
  runCommerceSyncFn?: typeof runCommerceSync;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
  syncBricksetEnrichmentMetadataFn?: typeof syncBricksetEnrichmentMetadata;
  validateGeneratedCommerceOfferSeedCandidatesFn?: typeof validateGeneratedCommerceOfferSeedCandidates;
}

export interface CatalogBulkOnboardingOptions {
  setIds: readonly string[];
  stateFilePath?: string;
  workspaceRoot: string;
}

const INITIAL_STATE_FILE: CatalogBulkOnboardingStateFile = {
  version: 1,
  runsById: {},
};

const activeCatalogBulkOnboardingRuns = new Map<string, Promise<void>>();

const stageProgressionOrder: Record<
  CatalogBulkOnboardingSetProcessingState,
  number
> = {
  pending_import: 0,
  catalog_ready: 1,
  seed_generation_completed: 2,
  seed_validation_completed: 3,
  commerce_sync_completed: 4,
};

const bricksetBackedCollectionSlugs = [
  'nieuwe-lego-sets',
  'lego-voor-volwassenen',
  'retiring-lego-sets',
] as const;
const catalogSetPublicThemeOverridesBySetId = new Map([
  ['21065', 'Architecture'],
  ['43017', 'Editions'],
  ['43023', 'Editions'],
  ['11377', 'Lord of the Rings'],
]);

function isGenericSourceCategoryThemeName(themeName?: string): boolean {
  const normalizedThemeName = themeName?.trim().toLowerCase();

  return (
    normalizedThemeName === 'other' ||
    normalizedThemeName === 'toys & games' ||
    normalizedThemeName === 'toys and games' ||
    normalizedThemeName === 'unknown'
  );
}

function readBricksetMetadataText(metadataJson: unknown): string {
  if (!metadataJson || typeof metadataJson !== 'object') {
    return '';
  }

  const metadata = metadataJson as Record<string, unknown>;
  const textParts = [
    metadata['theme'],
    metadata['subtheme'],
    metadata['themeGroup'],
    metadata['category'],
    ...(Array.isArray(metadata['tags']) ? metadata['tags'] : []),
  ].filter((value): value is string => typeof value === 'string');

  return textParts.join(' ').toLowerCase();
}

function readBricksetMetadataString(
  metadataJson: unknown,
  key: string,
): string | undefined {
  if (!metadataJson || typeof metadataJson !== 'object') {
    return undefined;
  }

  const value = (metadataJson as Record<string, unknown>)[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveBricksetPublicThemeNames(metadataJson: unknown): string[] {
  const metadataText = readBricksetMetadataText(metadataJson);
  const explicitTheme = readBricksetMetadataString(metadataJson, 'theme');
  const normalizedExplicitTheme = explicitTheme?.toLowerCase().trim();

  if (!metadataText) {
    return [];
  }

  if (
    metadataText.includes('lord of the rings') ||
    metadataText.includes('lotr')
  ) {
    return ['Lord of the Rings'];
  }

  if (metadataText.includes('star trek')) {
    return ['Star Trek'];
  }

  if (metadataText.includes('stranger things')) {
    return ['Stranger Things'];
  }

  if (
    metadataText.includes('botanical collection') ||
    metadataText.includes('botanicals') ||
    metadataText.includes('botanical')
  ) {
    return ['Botanicals'];
  }

  const themeNames =
    explicitTheme && !isGenericSourceCategoryThemeName(explicitTheme)
      ? [explicitTheme]
      : [];

  if (
    metadataText.includes('formula 1') ||
    metadataText.includes('f1 the movie') ||
    /\bf1\b/u.test(metadataText)
  ) {
    if (
      normalizedExplicitTheme !== 'technic' &&
      normalizedExplicitTheme !== 'editions'
    ) {
      themeNames.push('Formula 1', 'Speed Champions');
    }
  }

  return [...new Set(themeNames)];
}

function resolveBricksetPublicThemeNamesForSet({
  metadataJson,
  setId,
}: {
  metadataJson: unknown;
  setId: string;
}): string[] {
  const overrideTheme = catalogSetPublicThemeOverridesBySetId.get(setId);

  return overrideTheme
    ? [overrideTheme]
    : resolveBricksetPublicThemeNames(metadataJson);
}

function buildPublicThemeLookupIds(themeName: string): string[] {
  const themeSlug = buildCatalogThemeSlug(themeName);

  return [`theme:${themeSlug}`, themeSlug];
}

function isEligiblePublicThemeRow(themeRow: {
  is_public?: boolean | null;
  status?: string | null;
}): boolean {
  return themeRow.is_public === true && themeRow.status === 'active';
}

export async function applyBricksetPublicThemeMappings({
  metadataRecords,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  metadataRecords: readonly BricksetEnrichmentRecord[];
  supabaseClient?: ReturnType<typeof getServerSupabaseAdminClient>;
}): Promise<{ updatedCount: number }> {
  const setIds = [
    ...new Set(metadataRecords.map((record) => record.catalogSetId)),
  ];
  const { data: catalogSetRows, error: catalogSetError } = setIds.length
    ? await supabaseClient
        .from('catalog_sets')
        .select('set_id, source_theme_id, primary_theme_id')
        .in('set_id', setIds)
    : { data: [], error: null };

  if (catalogSetError) {
    throw new Error('Unable to load catalog sets for Brickset mapping.');
  }

  const catalogSetById = new Map(
    (
      (catalogSetRows as Array<{
        primary_theme_id?: string | null;
        set_id: string;
        source_theme_id?: string | null;
      }> | null) ?? []
    ).map((row) => [row.set_id, row]),
  );
  const sourceThemeIds = [
    ...new Set(
      [...catalogSetById.values()]
        .map((row) => row.source_theme_id)
        .filter((themeId): themeId is string => Boolean(themeId)),
    ),
  ];
  const { data: sourceThemeMappingRows, error: sourceThemeMappingError } =
    sourceThemeIds.length
      ? await supabaseClient
          .from('catalog_theme_mappings')
          .select('source_theme_id, primary_theme_id')
          .in('source_theme_id', sourceThemeIds)
      : { data: [], error: null };

  if (sourceThemeMappingError) {
    throw new Error(
      'Unable to load source theme mappings for Brickset mapping.',
    );
  }

  const primaryThemeIdBySourceThemeId = new Map(
    (
      (sourceThemeMappingRows as Array<{
        primary_theme_id: string;
        source_theme_id: string;
      }> | null) ?? []
    ).map((row) => [row.source_theme_id, row.primary_theme_id]),
  );
  const mappings = metadataRecords.flatMap((record) => {
    const publicThemeNames = resolveBricksetPublicThemeNamesForSet({
      metadataJson: record.metadataJson,
      setId: record.catalogSetId,
    });

    return {
      setId: record.catalogSetId,
      themeLookupIds: publicThemeNames.flatMap(buildPublicThemeLookupIds),
    };
  });

  if (!mappings.length) {
    return { updatedCount: 0 };
  }

  const themeIds = [
    ...new Set(mappings.flatMap((mapping) => mapping.themeLookupIds)),
  ];
  const { data: publicThemeRows, error: publicThemeError } =
    await supabaseClient
      .from('catalog_themes')
      .select('id, is_public, status')
      .in('id', themeIds);

  if (publicThemeError) {
    throw new Error(
      'Unable to load public catalog themes for Brickset mapping.',
    );
  }

  const eligibleThemeIds = new Set(
    (
      (publicThemeRows as Array<{
        id: string;
        is_public?: boolean | null;
        status?: string | null;
      }> | null) ?? []
    )
      .filter(isEligiblePublicThemeRow)
      .map((themeRow) => themeRow.id),
  );
  const eligibleMappings = mappings.flatMap((mapping) => {
    const themeId = mapping.themeLookupIds.find((lookupId) =>
      eligibleThemeIds.has(lookupId),
    );
    const catalogSetRow = catalogSetById.get(mapping.setId);
    const sourceMappedThemeId = catalogSetRow?.source_theme_id
      ? primaryThemeIdBySourceThemeId.get(catalogSetRow.source_theme_id)
      : undefined;

    if (!themeId && sourceMappedThemeId) {
      return sourceMappedThemeId === catalogSetRow?.primary_theme_id
        ? []
        : [{ setId: mapping.setId, themeId: sourceMappedThemeId }];
    }

    return themeId ? [{ setId: mapping.setId, themeId }] : [];
  });

  if (!eligibleMappings.length) {
    return { updatedCount: 0 };
  }

  let updatedCount = 0;

  for (const mapping of eligibleMappings) {
    const { error } = await supabaseClient
      .from('catalog_sets')
      .update({
        primary_theme_id: mapping.themeId,
        updated_at: new Date().toISOString(),
      })
      .eq('set_id', mapping.setId);

    if (error) {
      throw new Error(
        `Unable to apply Brickset public theme mapping for ${mapping.setId}.`,
      );
    }

    updatedCount += 1;
  }

  return { updatedCount };
}

interface BricksetThemeBackfillSetRow {
  name: string;
  primary_theme_id: string | null;
  set_id: string;
  slug: string;
  source_theme_id: string | null;
}

interface BricksetThemeBackfillMetadataRow {
  catalog_set_id: string;
  metadata_json: unknown;
}

interface BricksetThemeBackfillThemeRow {
  display_name: string | null;
  id: string;
  is_public: boolean | null;
  slug: string | null;
  status: string | null;
}

export interface BricksetPublicThemeMappingBackfillDetail {
  action: 'remapped' | 'skipped';
  afterThemeSlug?: string;
  beforeThemeSlug?: string;
  reason?: string;
  setId: string;
  setName: string;
  setSlug: string;
}

export interface BricksetPublicThemeMappingBackfillResult {
  details: readonly BricksetPublicThemeMappingBackfillDetail[];
  dryRun: boolean;
  inspectedCount: number;
  remappedCount: number;
  revalidation?: Awaited<ReturnType<typeof revalidatePublicCatalogPaths>>;
  skippedCount: number;
}

function resolveThemeSlugFromRow(
  themeRow: BricksetThemeBackfillThemeRow | undefined,
  themeId: string | null,
): string | undefined {
  if (themeRow?.slug) {
    return themeRow.slug;
  }

  if (!themeId) {
    return undefined;
  }

  return themeId.startsWith('theme:')
    ? themeId.slice('theme:'.length)
    : themeId;
}

export async function backfillBricksetPublicThemeMappings({
  dryRun = true,
  revalidate = true,
  revalidatePublicCatalogPathsFn = revalidatePublicCatalogPaths,
  setIds,
  source = 'brickset',
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  dryRun?: boolean;
  revalidate?: boolean;
  revalidatePublicCatalogPathsFn?: typeof revalidatePublicCatalogPaths;
  setIds?: readonly string[];
  source?: string;
  supabaseClient?: ReturnType<typeof getServerSupabaseAdminClient>;
} = {}): Promise<BricksetPublicThemeMappingBackfillResult> {
  if (source !== 'brickset') {
    throw new Error('Only source=brickset is supported for this backfill.');
  }

  const setQuery = supabaseClient
    .from('catalog_sets')
    .select('set_id, slug, name, source_theme_id, primary_theme_id');
  const scopedSetQuery =
    setIds && setIds.length
      ? setQuery.in('set_id', [...new Set(setIds)])
      : setQuery;
  const { data: setRowsData, error: setRowsError } = await scopedSetQuery.order(
    'set_id',
    { ascending: true },
  );

  if (setRowsError) {
    throw new Error('Unable to load catalog sets for Brickset theme backfill.');
  }

  const setRows = (setRowsData as BricksetThemeBackfillSetRow[] | null) ?? [];

  if (!setRows.length) {
    return {
      details: [],
      dryRun,
      inspectedCount: 0,
      remappedCount: 0,
      skippedCount: 0,
    };
  }

  const catalogSetIds = setRows.map((setRow) => setRow.set_id);
  const { data: metadataRowsData, error: metadataRowsError } =
    await supabaseClient
      .from(CATALOG_SET_SOURCE_METADATA_TABLE)
      .select('catalog_set_id, metadata_json')
      .eq('source', 'brickset')
      .eq('locale', 'en-US')
      .eq('match_confidence', 'exact_set_number')
      .in('catalog_set_id', catalogSetIds);

  if (metadataRowsError) {
    throw new Error(
      'Unable to load Brickset source metadata for theme backfill.',
    );
  }

  const metadataBySetId = new Map(
    ((metadataRowsData as BricksetThemeBackfillMetadataRow[] | null) ?? []).map(
      (metadataRow) => [metadataRow.catalog_set_id, metadataRow.metadata_json],
    ),
  );
  const candidateThemeIds = new Set<string>();

  for (const [setId, metadataJson] of metadataBySetId.entries()) {
    for (const themeName of resolveBricksetPublicThemeNamesForSet({
      metadataJson,
      setId,
    })) {
      for (const themeId of buildPublicThemeLookupIds(themeName)) {
        candidateThemeIds.add(themeId);
      }
    }
  }

  const currentThemeIds = setRows
    .map((setRow) => setRow.primary_theme_id)
    .filter((themeId): themeId is string => Boolean(themeId));
  const themeIds = [...new Set([...currentThemeIds, ...candidateThemeIds])];
  const { data: themeRowsData, error: themeRowsError } = themeIds.length
    ? await supabaseClient
        .from('catalog_themes')
        .select('id, slug, display_name, is_public, status')
        .in('id', themeIds)
    : { data: [], error: null };

  if (themeRowsError) {
    throw new Error('Unable to load catalog themes for Brickset backfill.');
  }

  const themeById = new Map(
    ((themeRowsData as BricksetThemeBackfillThemeRow[] | null) ?? []).map(
      (themeRow) => [themeRow.id, themeRow],
    ),
  );
  const details: BricksetPublicThemeMappingBackfillDetail[] = [];
  const remapDetails: BricksetPublicThemeMappingBackfillDetail[] = [];

  for (const setRow of setRows) {
    const beforeThemeSlug = resolveThemeSlugFromRow(
      setRow.primary_theme_id
        ? themeById.get(setRow.primary_theme_id)
        : undefined,
      setRow.primary_theme_id,
    );
    const metadataJson = metadataBySetId.get(setRow.set_id);

    if (!metadataJson) {
      details.push({
        action: 'skipped',
        beforeThemeSlug,
        reason: 'missing_brickset_metadata',
        setId: setRow.set_id,
        setName: setRow.name,
        setSlug: setRow.slug,
      });
      continue;
    }

    const targetThemeId = resolveBricksetPublicThemeNamesForSet({
      metadataJson,
      setId: setRow.set_id,
    })
      .flatMap(buildPublicThemeLookupIds)
      .find((themeId) => {
        const themeRow = themeById.get(themeId);

        return themeRow ? isEligiblePublicThemeRow(themeRow) : false;
      });

    if (!targetThemeId) {
      details.push({
        action: 'skipped',
        beforeThemeSlug,
        reason: 'no_supported_public_theme_mapping',
        setId: setRow.set_id,
        setName: setRow.name,
        setSlug: setRow.slug,
      });
      continue;
    }

    const afterThemeSlug = resolveThemeSlugFromRow(
      themeById.get(targetThemeId),
      targetThemeId,
    );

    if (targetThemeId === setRow.primary_theme_id) {
      details.push({
        action: 'skipped',
        afterThemeSlug,
        beforeThemeSlug,
        reason: 'already_mapped',
        setId: setRow.set_id,
        setName: setRow.name,
        setSlug: setRow.slug,
      });
      continue;
    }

    const remapDetail: BricksetPublicThemeMappingBackfillDetail = {
      action: 'remapped',
      afterThemeSlug,
      beforeThemeSlug,
      setId: setRow.set_id,
      setName: setRow.name,
      setSlug: setRow.slug,
    };

    details.push(remapDetail);
    remapDetails.push(remapDetail);

    if (!dryRun) {
      const { error: updateError } = await supabaseClient
        .from('catalog_sets')
        .update({
          primary_theme_id: targetThemeId,
          updated_at: new Date().toISOString(),
        })
        .eq('set_id', setRow.set_id);

      if (updateError) {
        throw new Error(
          `Unable to backfill Brickset public theme mapping for ${setRow.set_id}.`,
        );
      }
    }
  }

  if (!dryRun && remapDetails.length) {
    const { error: refreshError } = await supabaseClient.rpc(
      'refresh_catalog_theme_summaries',
    );

    if (refreshError) {
      throw new Error(
        `Unable to refresh catalog theme summaries after Brickset theme backfill: ${refreshError.message}`,
      );
    }
  }

  const revalidation =
    !dryRun && revalidate && remapDetails.length
      ? await revalidatePublicCatalogPathsFn({
          additionalPaths: [
            ...remapDetails.map((detail) => `/sets/${detail.setSlug}`),
            ...remapDetails.flatMap((detail) =>
              [detail.beforeThemeSlug, detail.afterThemeSlug]
                .filter((slug): slug is string => Boolean(slug))
                .map((themeSlug) => `/themes/${themeSlug}`),
            ),
          ],
          additionalTags: [
            cacheTags.catalog(),
            cacheTags.sets(),
            cacheTags.themes(),
            ...remapDetails.flatMap((detail) => [
              cacheTags.set(detail.setId),
              ...(detail.beforeThemeSlug
                ? [cacheTags.theme(detail.beforeThemeSlug)]
                : []),
              ...(detail.afterThemeSlug
                ? [cacheTags.theme(detail.afterThemeSlug)]
                : []),
            ]),
          ],
          includeDeals: false,
          includeHome: false,
          includeThemeDirectory: true,
          reason: 'brickset_public_theme_mapping_backfill',
          targets: [],
        })
      : undefined;

  return {
    details,
    dryRun,
    inspectedCount: setRows.length,
    remappedCount: remapDetails.length,
    ...(revalidation ? { revalidation } : {}),
    skippedCount: details.length - remapDetails.length,
  };
}

type CatalogBulkOnboardingCatalogSetIdentity = Pick<
  CatalogSet,
  'name' | 'setId' | 'slug'
> & {
  sourceSetNumber: string;
  theme: string;
};

function normalizeRequestedSetIds(setIds: readonly string[]) {
  return [...new Set(setIds.map((setId) => setId.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function toSourceSetNumber(setId: string) {
  return /^\d+$/.test(setId) ? `${setId}-1` : setId;
}

function createRunId(setIds: readonly string[]) {
  return createHash('sha1').update(setIds.join(',')).digest('hex').slice(0, 12);
}

function resolveStateFilePath({
  requestedStateFilePath,
  workspaceRoot,
}: {
  requestedStateFilePath?: string;
  workspaceRoot: string;
}) {
  return resolve(
    workspaceRoot,
    requestedStateFilePath?.trim() || 'tmp/catalog-bulk-onboarding-state.json',
  );
}

async function readCatalogBulkOnboardingStateFile(
  stateFilePath: string,
): Promise<CatalogBulkOnboardingStateFile> {
  try {
    const rawValue = await readFile(stateFilePath, 'utf8');
    const parsedValue = JSON.parse(rawValue) as CatalogBulkOnboardingStateFile;

    if (
      parsedValue &&
      parsedValue.version === 1 &&
      parsedValue.runsById &&
      typeof parsedValue.runsById === 'object'
    ) {
      return parsedValue;
    }

    throw new Error('Invalid bulk onboarding state file format.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return INITIAL_STATE_FILE;
    }

    throw error;
  }
}

async function writeCatalogBulkOnboardingStateFile({
  stateFile,
  stateFilePath,
}: {
  stateFile: CatalogBulkOnboardingStateFile;
  stateFilePath: string;
}) {
  const temporaryStateFilePath = `${stateFilePath}.tmp`;

  await mkdir(dirname(stateFilePath), {
    recursive: true,
  });
  await writeFile(
    temporaryStateFilePath,
    `${JSON.stringify(stateFile, null, 2)}\n`,
    'utf8',
  );
  await rename(temporaryStateFilePath, stateFilePath);
}

function createPendingStageCheckpoint<
  TSummary,
>(): CatalogBulkOnboardingStageCheckpoint<TSummary> {
  return {
    appliedSetIds: [],
    status: 'pending',
  };
}

function createInitialRunState({
  nowIso,
  requestedSetIds,
  runId,
}: {
  nowIso: string;
  requestedSetIds: readonly string[];
  runId: string;
}): CatalogBulkOnboardingRunState {
  return {
    createdAt: nowIso,
    generateStep: createPendingStageCheckpoint<CommerceSeedGenerationSummary>(),
    importStep:
      createPendingStageCheckpoint<CatalogBulkOnboardingImportSummary>(),
    requestedSetIds,
    runId,
    setProgressById: Object.fromEntries(
      requestedSetIds.map((setId) => [
        setId,
        {
          importStatus: 'pending',
          lastUpdatedAt: nowIso,
          processingState: 'pending_import',
          sourceSetNumber: toSourceSetNumber(setId),
          setId,
        } satisfies CatalogBulkOnboardingSetProgress,
      ]),
    ),
    snapshotStep:
      createPendingStageCheckpoint<CatalogBulkOnboardingSnapshotSummary>(),
    status: 'running',
    syncStep: createPendingStageCheckpoint<CommerceSyncRunResult>(),
    updatedAt: nowIso,
    validateStep: createPendingStageCheckpoint<CommerceSeedValidationSummary>(),
  };
}

function ensureRunContainsRequestedSetIds({
  nowIso,
  requestedSetIds,
  run,
}: {
  nowIso: string;
  requestedSetIds: readonly string[];
  run: CatalogBulkOnboardingRunState;
}) {
  run.requestedSetIds = requestedSetIds;

  for (const setId of requestedSetIds) {
    if (run.setProgressById[setId]) {
      continue;
    }

    run.setProgressById[setId] = {
      importStatus: 'pending',
      lastUpdatedAt: nowIso,
      processingState: 'pending_import',
      sourceSetNumber: toSourceSetNumber(setId),
      setId,
    };
  }
}

function cloneRunState(
  run: CatalogBulkOnboardingRunState,
): CatalogBulkOnboardingRunState {
  return JSON.parse(JSON.stringify(run)) as CatalogBulkOnboardingRunState;
}

function sortCatalogBulkOnboardingRunsByRecency(
  left: CatalogBulkOnboardingRunState,
  right: CatalogBulkOnboardingRunState,
) {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.runId.localeCompare(left.runId)
  );
}

async function saveRunState({
  run,
  stateFilePath,
}: {
  run: CatalogBulkOnboardingRunState;
  stateFilePath: string;
}) {
  const currentStateFile =
    await readCatalogBulkOnboardingStateFile(stateFilePath);

  await writeCatalogBulkOnboardingStateFile({
    stateFile: {
      ...currentStateFile,
      runsById: {
        ...currentStateFile.runsById,
        [run.runId]: run,
      },
    },
    stateFilePath,
  });
}

async function prepareCatalogBulkOnboardingRun({
  getNow,
  options,
}: {
  getNow: () => Date;
  options: CatalogBulkOnboardingOptions;
}) {
  const requestedSetIds = normalizeRequestedSetIds(options.setIds);

  if (requestedSetIds.length === 0) {
    throw new Error('Use --set-ids with at least one set id.');
  }

  const stateFilePath = resolveStateFilePath({
    requestedStateFilePath: options.stateFilePath,
    workspaceRoot: options.workspaceRoot,
  });
  const nowIso = getNow().toISOString();
  const stateFile = await readCatalogBulkOnboardingStateFile(stateFilePath);
  const runId = createRunId(requestedSetIds);
  const existingRun = stateFile.runsById[runId];
  const run = cloneRunState(
    existingRun ??
      createInitialRunState({
        nowIso,
        requestedSetIds,
        runId,
      }),
  );
  const runCreated = !existingRun;

  ensureRunContainsRequestedSetIds({
    nowIso,
    requestedSetIds,
    run,
  });
  run.status = 'running';
  run.updatedAt = nowIso;
  await saveRunState({
    run,
    stateFilePath,
  });

  return {
    requestedSetIds,
    run,
    runCreated,
    stateFilePath,
  };
}

function setStageRunning<TSummary>({
  appliedSetIds,
  nowIso,
  stage,
}: {
  appliedSetIds: readonly string[];
  nowIso: string;
  stage: CatalogBulkOnboardingStageCheckpoint<TSummary>;
}) {
  stage.appliedSetIds = [...appliedSetIds];
  stage.completedAt = undefined;
  stage.error = undefined;
  stage.startedAt = nowIso;
  stage.status = 'running';
}

function completeStage<TSummary>({
  appliedSetIds,
  nowIso,
  stage,
  status,
  summary,
}: {
  appliedSetIds: readonly string[];
  nowIso: string;
  stage: CatalogBulkOnboardingStageCheckpoint<TSummary>;
  status: Extract<
    CatalogBulkOnboardingStageStatus,
    'completed' | 'completed_with_errors' | 'skipped'
  >;
  summary?: TSummary;
}) {
  stage.appliedSetIds = [...appliedSetIds];
  stage.completedAt = nowIso;
  stage.error = undefined;
  stage.status = status;
  stage.summary = summary;
}

function failStage<TSummary>({
  appliedSetIds,
  errorMessage,
  nowIso,
  stage,
}: {
  appliedSetIds: readonly string[];
  errorMessage: string;
  nowIso: string;
  stage: CatalogBulkOnboardingStageCheckpoint<TSummary>;
}) {
  stage.appliedSetIds = [...appliedSetIds];
  stage.completedAt = nowIso;
  stage.error = errorMessage;
  stage.status = 'failed';
}

function shouldSkipCompletedStage({
  requestedSetIds,
  stage,
}: {
  requestedSetIds: readonly string[];
  stage: CatalogBulkOnboardingStageCheckpoint<unknown>;
}) {
  return (
    stage.status === 'completed' &&
    requestedSetIds.every((setId) => stage.appliedSetIds.includes(setId))
  );
}

function advanceProcessingState({
  nextState,
  progress,
}: {
  nextState: CatalogBulkOnboardingSetProcessingState;
  progress: CatalogBulkOnboardingSetProgress;
}) {
  if (
    stageProgressionOrder[nextState] >
    stageProgressionOrder[progress.processingState]
  ) {
    progress.processingState = nextState;
  }
}

function getCatalogReadySetIds(run: CatalogBulkOnboardingRunState) {
  return run.requestedSetIds.filter((setId) => {
    const setProgress = run.setProgressById[setId];

    return (
      setProgress?.importStatus === 'already_present' ||
      setProgress?.importStatus === 'created'
    );
  });
}

function buildCatalogBulkOnboardingSnapshotSummary({
  gapAudit,
  report,
}: {
  gapAudit: CommercePrimaryCoverageGapAuditReport;
  report: CommercePrimaryCoverageReport;
}): CatalogBulkOnboardingSnapshotSummary {
  const gapAuditRowBySetId = new Map(
    gapAudit.rows.map((row) => [row.setId, row] as const),
  );

  return {
    actionablePartialSetCount: gapAudit.summary.actionablePartialSetCount,
    fullPrimaryCoverageCount: report.fullPrimaryCoverageCount,
    gapAuditedSetCount: gapAudit.selectedSetCount,
    gapRows: report.rows.map((row) => {
      const gapAuditRow = gapAuditRowBySetId.get(row.setId);

      return {
        coverageStatus: row.status,
        gapMerchants:
          gapAuditRow?.merchantGaps.map((merchantGap) => ({
            gapType: merchantGap.gapType,
            merchantSlug: merchantGap.merchantSlug,
            recoveryPriority: merchantGap.recoveryPriority,
          })) ?? [],
        missingValidPrimaryOfferMerchantSlugs:
          row.missingValidPrimaryOfferMerchantSlugs,
        primaryMerchantTargetCount: row.primaryMerchantTargetCount,
        primarySeedCount: row.primarySeedCount,
        setId: row.setId,
        setName: row.setName,
        theme: row.theme,
        validPrimaryOfferCount: row.validPrimaryOfferCount,
      };
    }),
    noPrimarySeedsCount: report.noPrimarySeedsCount,
    noValidPrimaryOffersCount: report.noValidPrimaryOffersCount,
    parkedCount: gapAudit.summary.parkedCount,
    partialPrimaryCoverageCount: report.partialPrimaryCoverageCount,
    recoverNowCount: gapAudit.summary.recoverNowCount,
    reportedSetCount: report.selectedSetCount,
    setsMissingSeedCount: gapAudit.summary.setsMissingSeedCount,
    setsWithFullSeedButMissingOfferCount:
      gapAudit.summary.setsWithFullSeedButMissingOfferCount,
    verifyFirstCount: gapAudit.summary.verifyFirstCount,
  };
}

function updateSnapshotStateForSet({
  run,
  snapshotSummary,
  updatedAtIso,
}: {
  run: CatalogBulkOnboardingRunState;
  snapshotSummary: CatalogBulkOnboardingSnapshotSummary;
  updatedAtIso: string;
}) {
  const snapshotBySetId = new Map(
    snapshotSummary.gapRows.map((row) => [row.setId, row] as const),
  );

  for (const setId of run.requestedSetIds) {
    const setProgress = run.setProgressById[setId];

    if (!setProgress) {
      continue;
    }

    setProgress.lastUpdatedAt = updatedAtIso;
    setProgress.snapshot = snapshotBySetId.get(setId);
  }
}

function buildBulkOnboardingRevalidationTargets(
  run: CatalogBulkOnboardingRunState,
): Array<{
  setId: string;
  slug: string;
  theme: string;
}> {
  return run.requestedSetIds.flatMap((setId) => {
    const setProgress = run.setProgressById[setId];

    if (!setProgress?.catalogSetSlug || !setProgress.catalogSetTheme) {
      return [];
    }

    return [
      {
        setId,
        slug: setProgress.catalogSetSlug,
        theme: setProgress.catalogSetTheme,
      },
    ];
  });
}

async function ensureCatalogSetPresent({
  createCatalogSetFromDiscoveryCandidateFn,
  createCatalogSetFromLocalRebrickableMirrorFn,
  discoveryCandidate,
  existingCatalogSetsBySourceSetNumber,
  setId,
}: {
  createCatalogSetFromDiscoveryCandidateFn: typeof createCatalogSetFromDiscoveryCandidate;
  createCatalogSetFromLocalRebrickableMirrorFn: typeof createCatalogSetFromLocalRebrickableMirror;
  discoveryCandidate?: CatalogDiscoveryCandidate;
  existingCatalogSetsBySourceSetNumber: Map<
    string,
    CatalogBulkOnboardingCatalogSetIdentity
  >;
  setId: string;
}): Promise<CatalogBulkOnboardingImportSetResult> {
  const sourceSetNumber = toSourceSetNumber(setId);
  const existingCatalogSet =
    existingCatalogSetsBySourceSetNumber.get(sourceSetNumber);

  if (existingCatalogSet) {
    return {
      catalogSetId: existingCatalogSet.setId,
      catalogSetName: existingCatalogSet.name,
      catalogSetSlug: existingCatalogSet.slug,
      catalogSetTheme: existingCatalogSet.theme,
      setId,
      sourceSetNumber,
      status: 'already_present',
    };
  }

  try {
    const localMirrorCatalogSet =
      await createCatalogSetFromLocalRebrickableMirrorFn({
        setNumberOrId: sourceSetNumber,
      });

    if (localMirrorCatalogSet) {
      existingCatalogSetsBySourceSetNumber.set(
        sourceSetNumber,
        localMirrorCatalogSet,
      );

      return {
        catalogSetId: localMirrorCatalogSet.setId,
        catalogSetName: localMirrorCatalogSet.name,
        catalogSetSlug: localMirrorCatalogSet.slug,
        catalogSetTheme: localMirrorCatalogSet.theme,
        setId,
        sourceSetNumber,
        status: 'created',
      };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to import the catalog set from the local Rebrickable mirror.',
      setId,
      sourceSetNumber,
      status: 'failed',
    };
  }

  if (discoveryCandidate) {
    try {
      const { catalogSet, metadataIncomplete } =
        await createCatalogSetFromDiscoveryCandidateFn({
          candidate: discoveryCandidate,
        });

      existingCatalogSetsBySourceSetNumber.set(sourceSetNumber, catalogSet);

      return {
        catalogSetId: catalogSet.setId,
        catalogSetName: catalogSet.name,
        catalogSetSlug: catalogSet.slug,
        catalogSetTheme: catalogSet.theme,
        setId,
        sourceSetNumber,
        status: 'created',
        ...(metadataIncomplete
          ? {
              warning:
                'Catalog set created from source evidence; metadata needs enrichment.',
            }
          : {}),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to import the catalog set from discovery evidence.',
        setId,
        sourceSetNumber,
        status: 'failed',
      };
    }
  }

  return {
    error: `Catalog set ${sourceSetNumber} was not found in the existing catalog, local Rebrickable mirror, or persisted discovery candidates.`,
    setId,
    sourceSetNumber,
    status: 'failed',
  };
}

export async function runCatalogBulkOnboarding({
  dependencies = {},
  options,
}: {
  dependencies?: CatalogBulkOnboardingDependencies;
  options: CatalogBulkOnboardingOptions;
}): Promise<CatalogBulkOnboardingRunResult> {
  const {
    applyBricksetPublicThemeMappingsFn = applyBricksetPublicThemeMappings,
    createCatalogSetFromDiscoveryCandidateFn = createCatalogSetFromDiscoveryCandidate,
    createCatalogSetFromLocalRebrickableMirrorFn = createCatalogSetFromLocalRebrickableMirror,
    enrichCatalogSetMinifigSummariesFn = enrichCatalogSetMinifigSummariesBestEffort,
    generateCommerceOfferSeedCandidatesFn = generateCommerceOfferSeedCandidates,
    getNow = () => new Date(),
    listCatalogDiscoveryCandidatesFn = listCatalogDiscoveryCandidates,
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listCommercePrimaryCoverageGapAuditFn = listCommercePrimaryCoverageGapAudit,
    listCommercePrimaryCoverageReportFn = listCommercePrimaryCoverageReport,
    revalidatePublicCatalogPathsFn = revalidatePublicCatalogPaths,
    runCommerceSyncFn = runCommerceSync,
    syncBricksetEnrichmentMetadataFn = syncBricksetEnrichmentMetadata,
    validateGeneratedCommerceOfferSeedCandidatesFn = validateGeneratedCommerceOfferSeedCandidates,
  } = dependencies;
  const { requestedSetIds, run, runCreated, stateFilePath } =
    await prepareCatalogBulkOnboardingRun({
      getNow,
      options,
    });
  const stageExecutions: CatalogBulkOnboardingRunResult['stageExecutions'] = {
    generate: {
      executed: false,
      status: run.generateStep.status,
    },
    import: {
      executed: false,
      status: run.importStep.status,
    },
    snapshot: {
      executed: false,
      status: run.snapshotStep.status,
    },
    sync: {
      executed: false,
      status: run.syncStep.status,
    },
    validate: {
      executed: false,
      status: run.validateStep.status,
    },
  };

  const updateRun = async () => {
    run.updatedAt = getNow().toISOString();
    await saveRunState({
      run,
      stateFilePath,
    });
  };

  try {
    const existingCatalogSets = await listCanonicalCatalogSetsFn({
      includeInactive: true,
    });
    const existingCatalogSetsBySourceSetNumber = new Map(
      existingCatalogSets
        .filter(
          (
            catalogSet,
          ): catalogSet is CatalogCanonicalSet & { sourceSetNumber: string } =>
            Boolean(catalogSet.sourceSetNumber),
        )
        .map(
          (catalogSet) =>
            [
              catalogSet.sourceSetNumber,
              {
                name: catalogSet.name,
                setId: catalogSet.setId,
                slug: catalogSet.slug,
                sourceSetNumber: catalogSet.sourceSetNumber,
                theme: catalogSet.primaryTheme,
              } satisfies CatalogBulkOnboardingCatalogSetIdentity,
            ] as const,
        ),
    );
    const setIdsNeedingImport = requestedSetIds.filter((setId) => {
      const setProgress = run.setProgressById[setId];

      return (
        setProgress &&
        setProgress.importStatus !== 'already_present' &&
        setProgress.importStatus !== 'created'
      );
    });
    const discoveryCandidatesBySetId =
      setIdsNeedingImport.length > 0
        ? new Map(
            (
              await listCatalogDiscoveryCandidatesFn({
                limit: 500,
                status: 'all',
              })
            )
              .filter((candidate) =>
                setIdsNeedingImport.includes(candidate.normalizedSetId),
              )
              .map((candidate) => [candidate.normalizedSetId, candidate]),
          )
        : new Map<string, CatalogDiscoveryCandidate>();

    if (setIdsNeedingImport.length > 0) {
      const startedAtIso = getNow().toISOString();
      setStageRunning({
        appliedSetIds: setIdsNeedingImport,
        nowIso: startedAtIso,
        stage: run.importStep,
      });
      stageExecutions.import.executed = true;
      await updateRun();

      const importResults: CatalogBulkOnboardingImportSetResult[] = [];

      for (const setId of setIdsNeedingImport) {
        const importResult = await ensureCatalogSetPresent({
          createCatalogSetFromDiscoveryCandidateFn,
          createCatalogSetFromLocalRebrickableMirrorFn,
          discoveryCandidate: discoveryCandidatesBySetId.get(setId),
          existingCatalogSetsBySourceSetNumber,
          setId,
        });
        const setProgress = run.setProgressById[setId];

        if (!setProgress) {
          continue;
        }

        setProgress.catalogSetId = importResult.catalogSetId;
        setProgress.catalogSetName = importResult.catalogSetName;
        setProgress.catalogSetSlug = importResult.catalogSetSlug;
        setProgress.catalogSetTheme = importResult.catalogSetTheme;
        setProgress.importError = importResult.error;
        setProgress.importStatus = importResult.status;
        setProgress.lastUpdatedAt = getNow().toISOString();

        if (
          importResult.status === 'already_present' ||
          importResult.status === 'created'
        ) {
          advanceProcessingState({
            nextState: 'catalog_ready',
            progress: setProgress,
          });
        }

        importResults.push(importResult);
      }

      const importSummary: CatalogBulkOnboardingImportSummary = {
        alreadyPresentCount: importResults.filter(
          (result) => result.status === 'already_present',
        ).length,
        attemptedSetCount: importResults.length,
        createdCount: importResults.filter(
          (result) => result.status === 'created',
        ).length,
        failedCount: importResults.filter(
          (result) => result.status === 'failed',
        ).length,
        results: importResults,
      };
      const createdSetIds = importResults.flatMap((result) =>
        result.status === 'created' && result.catalogSetId
          ? [result.catalogSetId]
          : [],
      );
      const createdSourceSetNumbers = importResults.flatMap((result) =>
        result.status === 'created' && result.sourceSetNumber
          ? [result.sourceSetNumber]
          : [],
      );

      if (createdSetIds.length > 0) {
        try {
          await enrichCatalogSetMinifigSummariesFn({
            setIds: createdSetIds,
          });
        } catch (error) {
          console.warn(
            error instanceof Error
              ? error.message
              : 'Catalog minifig enrichment failed after bulk onboarding import.',
          );
        }

        if (!createdSourceSetNumbers.length) {
          importSummary.bricksetEnrichmentAttempted = false;
        } else {
          try {
            const bricksetResult = await syncBricksetEnrichmentMetadataFn({
              dryRun: false,
              setNumbers: createdSourceSetNumbers,
            });
            const themeMappingResult = await applyBricksetPublicThemeMappingsFn(
              {
                metadataRecords: bricksetResult.metadataRecords,
              },
            );

            importSummary.bricksetEnrichmentAttempted = true;
            importSummary.bricksetEnrichmentMatchedCount =
              bricksetResult.matchedCatalogSetCount;
            importSummary.bricksetEnrichmentMetadataUpsertedCount =
              bricksetResult.sourceMetadataUpsertedCount;
            importSummary.collectionSnapshotsRebuiltBySlug = Object.fromEntries(
              Object.entries(bricksetResult.summaryByCollectionSlug).map(
                ([collectionSlug, summary]) => [
                  collectionSlug,
                  summary.pageCount,
                ],
              ),
            );
            importSummary.themeMappingsUpdatedCount =
              themeMappingResult.updatedCount;

            console.info('[catalog-bulk-onboarding] brickset_enrichment', {
              attempted: true,
              collectionSnapshotsRebuiltBySlug:
                importSummary.collectionSnapshotsRebuiltBySlug,
              matchedCount: importSummary.bricksetEnrichmentMatchedCount,
              metadataUpsertedCount:
                importSummary.bricksetEnrichmentMetadataUpsertedCount,
              setNumbers: createdSourceSetNumbers,
              themeMappingsUpdatedCount:
                importSummary.themeMappingsUpdatedCount,
            });
          } catch (error) {
            importSummary.bricksetEnrichmentAttempted = true;
            importSummary.bricksetEnrichmentMatchedCount = 0;
            importSummary.bricksetEnrichmentMetadataUpsertedCount = 0;
            importSummary.collectionSnapshotsRebuiltBySlug = {};
            importSummary.themeMappingsUpdatedCount = 0;

            console.warn(
              error instanceof Error
                ? error.message
                : 'Brickset enrichment failed after bulk onboarding import.',
            );
          }
        }
      } else {
        importSummary.bricksetEnrichmentAttempted = false;
      }

      completeStage({
        appliedSetIds: setIdsNeedingImport,
        nowIso: getNow().toISOString(),
        stage: run.importStep,
        status:
          importSummary.failedCount > 0 ? 'completed_with_errors' : 'completed',
        summary: importSummary,
      });
      stageExecutions.import.status = run.importStep.status;
      await updateRun();
    }

    const catalogReadySetIds = getCatalogReadySetIds(run);

    if (catalogReadySetIds.length === 0) {
      const skippedAtIso = getNow().toISOString();

      completeStage({
        appliedSetIds: [],
        nowIso: skippedAtIso,
        stage: run.generateStep,
        status: 'skipped',
      });
      completeStage({
        appliedSetIds: [],
        nowIso: skippedAtIso,
        stage: run.validateStep,
        status: 'skipped',
      });
      completeStage({
        appliedSetIds: [],
        nowIso: skippedAtIso,
        stage: run.syncStep,
        status: 'skipped',
      });
      completeStage({
        appliedSetIds: [],
        nowIso: skippedAtIso,
        stage: run.snapshotStep,
        status: 'skipped',
      });
      stageExecutions.generate.status = run.generateStep.status;
      stageExecutions.validate.status = run.validateStep.status;
      stageExecutions.sync.status = run.syncStep.status;
      stageExecutions.snapshot.status = run.snapshotStep.status;
      run.status =
        run.importStep.status === 'completed_with_errors'
          ? 'completed_with_errors'
          : 'completed';
      await updateRun();

      return {
        run,
        runCreated,
        stageExecutions,
        stateFilePath,
      };
    }

    if (
      !shouldSkipCompletedStage({
        requestedSetIds: catalogReadySetIds,
        stage: run.generateStep,
      })
    ) {
      const startedAtIso = getNow().toISOString();
      setStageRunning({
        appliedSetIds: catalogReadySetIds,
        nowIso: startedAtIso,
        stage: run.generateStep,
      });
      stageExecutions.generate.executed = true;
      await updateRun();

      const generateSummary = await generateCommerceOfferSeedCandidatesFn({
        filters: {
          setIds: catalogReadySetIds,
        },
        write: true,
      });

      for (const setId of catalogReadySetIds) {
        const setProgress = run.setProgressById[setId];

        if (!setProgress) {
          continue;
        }

        setProgress.lastUpdatedAt = getNow().toISOString();
        advanceProcessingState({
          nextState: 'seed_generation_completed',
          progress: setProgress,
        });
      }

      completeStage({
        appliedSetIds: catalogReadySetIds,
        nowIso: getNow().toISOString(),
        stage: run.generateStep,
        status: 'completed',
        summary: generateSummary,
      });
      stageExecutions.generate.status = run.generateStep.status;
      await updateRun();
    }

    if (
      !shouldSkipCompletedStage({
        requestedSetIds: catalogReadySetIds,
        stage: run.validateStep,
      })
    ) {
      const startedAtIso = getNow().toISOString();
      setStageRunning({
        appliedSetIds: catalogReadySetIds,
        nowIso: startedAtIso,
        stage: run.validateStep,
      });
      stageExecutions.validate.executed = true;
      await updateRun();

      const validateSummary =
        await validateGeneratedCommerceOfferSeedCandidatesFn({
          filters: {
            recheckGenerated: true,
            setIds: catalogReadySetIds,
          },
          write: true,
        });

      for (const setId of catalogReadySetIds) {
        const setProgress = run.setProgressById[setId];

        if (!setProgress) {
          continue;
        }

        setProgress.lastUpdatedAt = getNow().toISOString();
        advanceProcessingState({
          nextState: 'seed_validation_completed',
          progress: setProgress,
        });
      }

      completeStage({
        appliedSetIds: catalogReadySetIds,
        nowIso: getNow().toISOString(),
        stage: run.validateStep,
        status: 'completed',
        summary: validateSummary,
      });
      stageExecutions.validate.status = run.validateStep.status;
      await updateRun();
    }

    if (
      !shouldSkipCompletedStage({
        requestedSetIds: catalogReadySetIds,
        stage: run.syncStep,
      })
    ) {
      const startedAtIso = getNow().toISOString();
      setStageRunning({
        appliedSetIds: catalogReadySetIds,
        nowIso: startedAtIso,
        stage: run.syncStep,
      });
      stageExecutions.sync.executed = true;
      await updateRun();

      const syncSummary = await runCommerceSyncFn({
        mode: 'write',
        setIds: catalogReadySetIds,
        workspaceRoot: options.workspaceRoot,
      });

      for (const setId of catalogReadySetIds) {
        const setProgress = run.setProgressById[setId];

        if (!setProgress) {
          continue;
        }

        setProgress.lastUpdatedAt = getNow().toISOString();
        advanceProcessingState({
          nextState: 'commerce_sync_completed',
          progress: setProgress,
        });
      }

      completeStage({
        appliedSetIds: catalogReadySetIds,
        nowIso: getNow().toISOString(),
        stage: run.syncStep,
        status: 'completed',
        summary: syncSummary,
      });
      stageExecutions.sync.status = run.syncStep.status;
      await updateRun();
    }

    {
      const startedAtIso = getNow().toISOString();
      setStageRunning({
        appliedSetIds: catalogReadySetIds,
        nowIso: startedAtIso,
        stage: run.snapshotStep,
      });
      stageExecutions.snapshot.executed = true;
      await updateRun();

      const [report, gapAudit] = await Promise.all([
        listCommercePrimaryCoverageReportFn({
          filters: {
            setIds: catalogReadySetIds,
          },
        }),
        listCommercePrimaryCoverageGapAuditFn({
          filters: {
            setIds: catalogReadySetIds,
          },
        }),
      ]);
      const snapshotSummary = buildCatalogBulkOnboardingSnapshotSummary({
        gapAudit,
        report,
      });

      updateSnapshotStateForSet({
        run,
        snapshotSummary,
        updatedAtIso: getNow().toISOString(),
      });
      completeStage({
        appliedSetIds: catalogReadySetIds,
        nowIso: getNow().toISOString(),
        stage: run.snapshotStep,
        status: 'completed',
        summary: snapshotSummary,
      });
      stageExecutions.snapshot.status = run.snapshotStep.status;
      await updateRun();
    }

    run.status =
      run.importStep.status === 'completed_with_errors'
        ? 'completed_with_errors'
        : 'completed';
    await updateRun();

    const revalidationTargets = buildBulkOnboardingRevalidationTargets(run);

    if (revalidationTargets.length > 0) {
      try {
        await revalidatePublicCatalogPathsFn({
          additionalTags: [
            cacheTags.collections(),
            ...bricksetBackedCollectionSlugs.map((collectionSlug) =>
              cacheTags.collection(collectionSlug),
            ),
          ],
          reason: 'catalog_bulk_onboarding',
          targets: revalidationTargets,
        });
      } catch (error) {
        console.warn(
          error instanceof Error
            ? error.message
            : 'Public web revalidation failed after bulk onboarding.',
        );
      }
    }

    return {
      run,
      runCreated,
      stageExecutions,
      stateFilePath,
    };
  } catch (error) {
    const nowIsoOnError = getNow().toISOString();
    const errorMessage =
      error instanceof Error ? error.message : 'Bulk onboarding failed.';

    const stageToFail =
      run.syncStep.status === 'running'
        ? run.syncStep
        : run.validateStep.status === 'running'
          ? run.validateStep
          : run.generateStep.status === 'running'
            ? run.generateStep
            : run.snapshotStep.status === 'running'
              ? run.snapshotStep
              : run.importStep;

    failStage<unknown>({
      appliedSetIds: stageToFail.appliedSetIds,
      errorMessage,
      nowIso: nowIsoOnError,
      stage: stageToFail,
    });
    run.status = 'failed';
    run.updatedAt = nowIsoOnError;
    await saveRunState({
      run,
      stateFilePath,
    });
    throw error;
  }
}

export async function getCatalogBulkOnboardingRun({
  options,
  runId,
}: {
  options: Pick<
    CatalogBulkOnboardingOptions,
    'stateFilePath' | 'workspaceRoot'
  >;
  runId: string;
}): Promise<CatalogBulkOnboardingRunReadResult> {
  const stateFilePath = resolveStateFilePath({
    requestedStateFilePath: options.stateFilePath,
    workspaceRoot: options.workspaceRoot,
  });
  const stateFile = await readCatalogBulkOnboardingStateFile(stateFilePath);
  const run = stateFile.runsById[runId.trim()];

  return {
    ...(run
      ? {
          run: cloneRunState(run),
        }
      : {}),
    stateFilePath,
  };
}

export async function getLatestCatalogBulkOnboardingRun({
  options,
}: {
  options: Pick<
    CatalogBulkOnboardingOptions,
    'stateFilePath' | 'workspaceRoot'
  >;
}): Promise<CatalogBulkOnboardingRunReadResult> {
  const stateFilePath = resolveStateFilePath({
    requestedStateFilePath: options.stateFilePath,
    workspaceRoot: options.workspaceRoot,
  });
  const stateFile = await readCatalogBulkOnboardingStateFile(stateFilePath);
  const latestRun = Object.values(stateFile.runsById).sort(
    sortCatalogBulkOnboardingRunsByRecency,
  )[0];

  return {
    ...(latestRun
      ? {
          run: cloneRunState(latestRun),
        }
      : {}),
    stateFilePath,
  };
}

export async function startCatalogBulkOnboardingRun({
  dependencies = {},
  options,
}: {
  dependencies?: CatalogBulkOnboardingDependencies;
  options: CatalogBulkOnboardingOptions;
}): Promise<CatalogBulkOnboardingStartResult> {
  const getNow = dependencies.getNow ?? (() => new Date());
  const preparedRun = await prepareCatalogBulkOnboardingRun({
    getNow,
    options,
  });
  const alreadyRunning = activeCatalogBulkOnboardingRuns.has(
    preparedRun.run.runId,
  );

  if (!alreadyRunning) {
    const activeRunPromise = runCatalogBulkOnboarding({
      dependencies: {
        ...dependencies,
        getNow,
      },
      options,
    })
      .then(() => undefined)
      .finally(() => {
        activeCatalogBulkOnboardingRuns.delete(preparedRun.run.runId);
      });

    activeCatalogBulkOnboardingRuns.set(
      preparedRun.run.runId,
      activeRunPromise,
    );
  }

  return {
    alreadyRunning,
    run: preparedRun.run,
    runCreated: preparedRun.runCreated,
    runId: preparedRun.run.runId,
    stateFilePath: preparedRun.stateFilePath,
  };
}
