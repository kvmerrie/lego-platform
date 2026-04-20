import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  createCatalogSet,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import type {
  CatalogCanonicalSet,
  CatalogSet,
} from '@lego-platform/catalog/util';
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
import {
  runCommerceSync,
  type CommerceSyncRunResult,
} from './commerce-sync-server';

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
}

export interface CatalogBulkOnboardingImportSummary {
  alreadyPresentCount: number;
  attemptedSetCount: number;
  createdCount: number;
  failedCount: number;
  results: readonly CatalogBulkOnboardingImportSetResult[];
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
  createCatalogSetFn?: typeof createCatalogSet;
  generateCommerceOfferSeedCandidatesFn?: typeof generateCommerceOfferSeedCandidates;
  getNow?: () => Date;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommercePrimaryCoverageGapAuditFn?: typeof listCommercePrimaryCoverageGapAudit;
  listCommercePrimaryCoverageReportFn?: typeof listCommercePrimaryCoverageReport;
  runCommerceSyncFn?: typeof runCommerceSync;
  searchCatalogMissingSetsFn?: typeof searchCatalogMissingSets;
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

async function ensureCatalogSetPresent({
  createCatalogSetFn,
  existingCatalogSetsBySourceSetNumber,
  listCanonicalCatalogSetsFn,
  searchCatalogMissingSetsFn,
  setId,
}: {
  createCatalogSetFn: typeof createCatalogSet;
  existingCatalogSetsBySourceSetNumber: Map<
    string,
    CatalogBulkOnboardingCatalogSetIdentity
  >;
  listCanonicalCatalogSetsFn: typeof listCanonicalCatalogSets;
  searchCatalogMissingSetsFn: typeof searchCatalogMissingSets;
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

  const searchResults = await searchCatalogMissingSetsFn({
    query: sourceSetNumber,
  });
  const matchingSearchResult = searchResults.find(
    (searchResult) => searchResult.sourceSetNumber === sourceSetNumber,
  );

  if (!matchingSearchResult) {
    return {
      error: `Catalog set ${sourceSetNumber} was not found in the current Rebrickable-backed add-set source.`,
      setId,
      sourceSetNumber,
      status: 'failed',
    };
  }

  try {
    const createdCatalogSet = await createCatalogSetFn({
      input: matchingSearchResult,
    });

    existingCatalogSetsBySourceSetNumber.set(
      sourceSetNumber,
      createdCatalogSet,
    );

    return {
      catalogSetId: createdCatalogSet.setId,
      catalogSetName: createdCatalogSet.name,
      catalogSetSlug: createdCatalogSet.slug,
      catalogSetTheme: createdCatalogSet.theme,
      setId,
      sourceSetNumber,
      status: 'created',
    };
  } catch (error) {
    const refreshedCatalogSets = await listCanonicalCatalogSetsFn({
      includeInactive: true,
    });
    const refreshedCatalogSet = refreshedCatalogSets.find(
      (catalogSet) => catalogSet.sourceSetNumber === sourceSetNumber,
    );

    if (refreshedCatalogSet) {
      existingCatalogSetsBySourceSetNumber.set(sourceSetNumber, {
        name: refreshedCatalogSet.name,
        setId: refreshedCatalogSet.setId,
        slug: refreshedCatalogSet.slug,
        sourceSetNumber,
        theme: refreshedCatalogSet.primaryTheme,
      });

      return {
        catalogSetId: refreshedCatalogSet.setId,
        catalogSetName: refreshedCatalogSet.name,
        catalogSetSlug: refreshedCatalogSet.slug,
        catalogSetTheme: refreshedCatalogSet.primaryTheme,
        setId,
        sourceSetNumber,
        status: 'already_present',
      };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to import the catalog set.',
      setId,
      sourceSetNumber,
      status: 'failed',
    };
  }
}

export async function runCatalogBulkOnboarding({
  dependencies = {},
  options,
}: {
  dependencies?: CatalogBulkOnboardingDependencies;
  options: CatalogBulkOnboardingOptions;
}): Promise<CatalogBulkOnboardingRunResult> {
  const {
    createCatalogSetFn = createCatalogSet,
    generateCommerceOfferSeedCandidatesFn = generateCommerceOfferSeedCandidates,
    getNow = () => new Date(),
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listCommercePrimaryCoverageGapAuditFn = listCommercePrimaryCoverageGapAudit,
    listCommercePrimaryCoverageReportFn = listCommercePrimaryCoverageReport,
    runCommerceSyncFn = runCommerceSync,
    searchCatalogMissingSetsFn = searchCatalogMissingSets,
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
          createCatalogSetFn,
          existingCatalogSetsBySourceSetNumber,
          listCanonicalCatalogSetsFn,
          searchCatalogMissingSetsFn,
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
