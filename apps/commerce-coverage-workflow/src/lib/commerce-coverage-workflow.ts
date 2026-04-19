import {
  runCommerceSync,
  type CommerceSyncRunResult,
} from '@lego-platform/api/data-access-server';
import {
  generateCommerceOfferSeedCandidates,
  listCommercePrimaryCoverageReport,
  validateGeneratedCommerceOfferSeedCandidates,
  type CommercePrimaryCoverageReport,
  type CommerceSeedGenerationFilters,
  type CommerceSeedGenerationSummary,
  type CommerceSeedValidationSummary,
} from '@lego-platform/commerce/data-access-server';

export interface CommerceCoverageWorkflowDependencies {
  generateCommerceOfferSeedCandidatesFn?: typeof generateCommerceOfferSeedCandidates;
  listCommercePrimaryCoverageReportFn?: typeof listCommercePrimaryCoverageReport;
  runCommerceSyncFn?: typeof runCommerceSync;
  validateGeneratedCommerceOfferSeedCandidatesFn?: typeof validateGeneratedCommerceOfferSeedCandidates;
}

export interface CommerceCoverageWorkflowOptions {
  batchIndex?: number;
  batchSize?: number;
  forceSync?: boolean;
  includeNonActive?: boolean;
  merchantSlugs?: readonly string[];
  primaryCoverageStatus?: CommerceSeedGenerationFilters['primaryCoverageStatus'];
  skipSyncWhenNoSeedWork?: boolean;
  workspaceRoot: string;
}

export type CommerceCoverageWorkflowStatus =
  | 'completed'
  | 'empty_batch'
  | 'no_seed_work';

export interface CommerceCoverageWorkflowRunResult {
  finalReport?: CommercePrimaryCoverageReport;
  generateSummary?: CommerceSeedGenerationSummary;
  initialReport: CommercePrimaryCoverageReport;
  noSeedWork: boolean;
  scopedSyncSummary?: CommerceSyncRunResult;
  selectedSetIds: readonly string[];
  skipped: boolean;
  status: CommerceCoverageWorkflowStatus;
  statusMessage: string;
  syncExecuted: boolean;
  validateSummary?: CommerceSeedValidationSummary;
}

export async function runCommerceCoverageWorkflow({
  dependencies = {},
  options,
}: {
  dependencies?: CommerceCoverageWorkflowDependencies;
  options: CommerceCoverageWorkflowOptions;
}): Promise<CommerceCoverageWorkflowRunResult> {
  const {
    generateCommerceOfferSeedCandidatesFn = generateCommerceOfferSeedCandidates,
    listCommercePrimaryCoverageReportFn = listCommercePrimaryCoverageReport,
    runCommerceSyncFn = runCommerceSync,
    validateGeneratedCommerceOfferSeedCandidatesFn = validateGeneratedCommerceOfferSeedCandidates,
  } = dependencies;
  const batchSelectionFilters: CommerceSeedGenerationFilters = {
    batchIndex: options.batchIndex,
    batchSize: options.batchSize,
    includeNonActive: options.includeNonActive,
    primaryCoverageStatus:
      options.primaryCoverageStatus ?? 'partial_primary_coverage',
  };
  const initialReport = await listCommercePrimaryCoverageReportFn({
    filters: batchSelectionFilters,
  });
  const selectedSetIds = initialReport.rows.map((row) => row.setId);

  if (selectedSetIds.length === 0) {
    return {
      initialReport,
      noSeedWork: false,
      selectedSetIds,
      skipped: true,
      status: 'empty_batch',
      statusMessage: 'De geselecteerde batch is leeg.',
      syncExecuted: false,
    };
  }

  const reportFilters: CommerceSeedGenerationFilters = {
    setIds: selectedSetIds,
  };
  const actionFilters: CommerceSeedGenerationFilters = {
    merchantSlugs: options.merchantSlugs,
    setIds: selectedSetIds,
  };
  const generateSummary = await generateCommerceOfferSeedCandidatesFn({
    filters: actionFilters,
    write: true,
  });
  const validateSummary = await validateGeneratedCommerceOfferSeedCandidatesFn({
    filters: actionFilters,
    write: true,
  });
  const noSeedWork =
    generateSummary.insertedCount === 0 && validateSummary.processedCount === 0;
  const shouldSkipSync =
    noSeedWork &&
    options.skipSyncWhenNoSeedWork === true &&
    options.forceSync !== true;
  const scopedSyncSummary = shouldSkipSync
    ? undefined
    : await runCommerceSyncFn({
        merchantSlugs: options.merchantSlugs,
        mode: 'write',
        setIds: selectedSetIds,
        workspaceRoot: options.workspaceRoot,
      });
  const finalReport = shouldSkipSync
    ? initialReport
    : await listCommercePrimaryCoverageReportFn({
        filters: reportFilters,
      });
  const status: CommerceCoverageWorkflowStatus = noSeedWork
    ? 'no_seed_work'
    : 'completed';
  const statusMessage = noSeedWork
    ? shouldSkipSync
      ? 'Geen nieuwe candidates geschreven en niets gevalideerd; scoped sync is overgeslagen voor deze merchant-scope batch.'
      : 'Geen nieuwe candidates geschreven en niets gevalideerd; scoped sync draaide toch door voor deze merchant-scope batch.'
    : 'Batch verwerkt met nieuw of bestaand seed-werk.';

  return {
    finalReport,
    generateSummary,
    initialReport,
    noSeedWork,
    scopedSyncSummary,
    selectedSetIds,
    skipped: false,
    status,
    statusMessage,
    syncExecuted: !shouldSkipSync,
    validateSummary,
  };
}
