import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSet,
  type CatalogSet,
} from '@lego-platform/catalog/util';
import {
  type CommerceBenchmarkSet,
  type CommerceAffiliateDiscoveredSet,
  type CommerceAffiliateDiscoveredSetConfidence,
  type CommerceAffiliateDiscoveredSetImportResult,
  type CommerceAffiliateDiscoveredSetStatus,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
} from '@lego-platform/commerce/util';
import { firstValueFrom } from 'rxjs';

export interface CommerceAdminCatalogSetSummary {
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

export type CommerceAdminCatalogDiscoveryCandidateConfidence =
  | 'high'
  | 'low'
  | 'medium';

export type CommerceAdminCatalogDiscoveryCandidateStatus =
  | 'failed'
  | 'ignored'
  | 'imported'
  | 'new'
  | 'non_set'
  | 'onboarding_started'
  | 'processing'
  | 'rejected'
  | 'reviewed';

export interface CommerceAdminCatalogDiscoveryCandidate {
  autoCreateEligible: boolean;
  bricksetPayload?: Readonly<Record<string, unknown>>;
  confidence: CommerceAdminCatalogDiscoveryCandidateConfidence;
  confidenceScore: number;
  evidence: Readonly<Record<string, unknown>>;
  firstSeenAt: string;
  id: string;
  importError?: string | null;
  importedSetId?: string | null;
  lastSeenAt: string;
  normalizedSetId: string;
  operatorConfidence: CommerceAdminCatalogDiscoveryCandidateConfidence;
  operatorConfidenceReasons: readonly string[];
  rebrickablePayload?: Readonly<Record<string, unknown>>;
  requiredFieldsPresent: boolean;
  source: string;
  sourceCurrencyCode?: string;
  sourceImageUrl?: string;
  sourcePayload: Readonly<Record<string, unknown>>;
  sourcePriceMinor?: number;
  sourceProductTitle?: string;
  sourceProductUrl: string;
  sourceSetNumber: string;
  status: CommerceAdminCatalogDiscoveryCandidateStatus;
}

export type CommerceAdminCatalogImportStageStatus =
  | 'failed'
  | 'skipped'
  | 'success';

export interface CommerceAdminCatalogImportResult {
  bricksetStatus?: CommerceAdminCatalogImportStageStatus;
  durationMs?: number;
  enrichmentStatus?: 'complete' | 'partial' | 'skipped';
  importedSetId?: string;
  importedSlug?: string;
  minifigStatus?: CommerceAdminCatalogImportStageStatus;
  stages?: Readonly<
    Record<
      'brickset' | 'minifig' | 'theme',
      {
        status?: CommerceAdminCatalogImportStageStatus;
        warning?: string;
      }
    >
  >;
  themeStatus?: CommerceAdminCatalogImportStageStatus;
  warnings?: readonly string[];
}

export type CommerceAdminCatalogDiscoveryBulkImportItemStatus =
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'warning';

export interface CommerceAdminCatalogDiscoveryBulkImportItemResult {
  candidateId: string;
  enrichmentStatus?: CommerceAdminCatalogImportResult['enrichmentStatus'];
  error?: string;
  importedSetId?: string;
  importedSlug?: string;
  setId?: string;
  status: CommerceAdminCatalogDiscoveryBulkImportItemStatus;
  title?: string;
  warnings: readonly string[];
}

export interface CommerceAdminCatalogDiscoveryBulkImportResult {
  completedCount: number;
  concurrency: number;
  failedCount: number;
  processedCount: number;
  requestedCount: number;
  results: readonly CommerceAdminCatalogDiscoveryBulkImportItemResult[];
  skippedCount: number;
  warningCount: number;
}

export interface CommerceAdminBulkOnboardingSnapshotSetSummary {
  coverageStatus?: string;
  gapMerchants: readonly {
    gapType: string;
    merchantSlug: string;
    recoveryPriority: string;
  }[];
  missingValidPrimaryOfferMerchantSlugs: readonly string[];
  primaryMerchantTargetCount?: number;
  primarySeedCount?: number;
  setId: string;
  setName: string;
  theme: string;
  validPrimaryOfferCount?: number;
}

export interface CommerceAdminBulkOnboardingStageCheckpoint<TSummary> {
  appliedSetIds: readonly string[];
  completedAt?: string;
  error?: string;
  startedAt?: string;
  status:
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped';
  summary?: TSummary;
}

export interface CommerceAdminBulkOnboardingImportSummary {
  alreadyPresentCount: number;
  attemptedSetCount: number;
  createdCount: number;
  failedCount: number;
}

export interface CommerceAdminBulkOnboardingGenerateSummary {
  candidateCount: number;
  insertedCount: number;
  skippedCount: number;
  supportedMerchantSlugs: readonly string[];
  updatedCount: number;
}

export interface CommerceAdminBulkOnboardingValidateSummary {
  invalidCount: number;
  processedCount: number;
  skippedCount: number;
  staleCount: number;
  validCount: number;
}

export interface CommerceAdminBulkOnboardingSyncSummary {
  enabledSetCount: number;
  refreshInvalidCount: number;
  refreshStaleCount: number;
  refreshSuccessCount: number;
  refreshUnavailableCount: number;
  scopedSetIds: readonly string[];
}

export interface CommerceAdminBulkOnboardingSnapshotSummary {
  actionablePartialSetCount: number;
  fullPrimaryCoverageCount: number;
  gapAuditedSetCount: number;
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

export interface CommerceAdminBulkOnboardingSetProgress {
  catalogSetId?: string;
  catalogSetName?: string;
  catalogSetSlug?: string;
  catalogSetTheme?: string;
  importError?: string;
  importStatus: 'already_present' | 'created' | 'failed' | 'pending';
  lastUpdatedAt: string;
  processingState:
    | 'catalog_ready'
    | 'commerce_sync_completed'
    | 'pending_import'
    | 'seed_generation_completed'
    | 'seed_validation_completed';
  snapshot?: CommerceAdminBulkOnboardingSnapshotSetSummary;
  sourceSetNumber: string;
  setId: string;
}

export interface CommerceAdminBulkOnboardingRun {
  createdAt: string;
  generateStep: CommerceAdminBulkOnboardingStageCheckpoint<CommerceAdminBulkOnboardingGenerateSummary>;
  importStep: CommerceAdminBulkOnboardingStageCheckpoint<CommerceAdminBulkOnboardingImportSummary>;
  requestedSetIds: readonly string[];
  runId: string;
  setProgressById: Record<string, CommerceAdminBulkOnboardingSetProgress>;
  snapshotStep: CommerceAdminBulkOnboardingStageCheckpoint<CommerceAdminBulkOnboardingSnapshotSummary>;
  status: 'completed' | 'completed_with_errors' | 'failed' | 'running';
  syncStep: CommerceAdminBulkOnboardingStageCheckpoint<CommerceAdminBulkOnboardingSyncSummary>;
  updatedAt: string;
  validateStep: CommerceAdminBulkOnboardingStageCheckpoint<CommerceAdminBulkOnboardingValidateSummary>;
}

export interface CommerceAdminBulkOnboardingRunReadResult {
  run: CommerceAdminBulkOnboardingRun;
  stateFilePath: string;
}

export interface CommerceAdminBulkOnboardingStartResult {
  alreadyRunning: boolean;
  run: CommerceAdminBulkOnboardingRun;
  runCreated: boolean;
  runId: string;
  stateFilePath: string;
}

export interface CommerceAdminProductionSyncTableSummary {
  deletedCount: number;
  insertedCount: number;
  sourceCount: number;
  targetBeforeCount: number;
}

export interface CommerceAdminProductionSyncResult {
  dryRun: boolean;
  durationMs: number;
  startedAt: string;
  status: 'ok';
  tables: Record<string, CommerceAdminProductionSyncTableSummary>;
}

export interface CommerceAdminPromotionPreviewTableSummary {
  insertedCount: number;
  readCount: number;
  skipped: boolean;
  strategy: 'excluded' | 'heavy_skipped' | 'sample_diff';
  updatedCount: number;
  warning?: string;
}

export interface CommerceAdminPromotionPreviewSample {
  changeType: 'insert' | 'update';
  changedFields: readonly string[];
  key: string;
  table: string;
}

export interface CommerceAdminPromotionPreviewResult {
  generatedAt: string;
  meaningfulPendingPromoteCount: number;
  operatorSummary: {
    mappings: CommerceAdminPromotionPreviewTableSummary;
    sets: CommerceAdminPromotionPreviewTableSummary;
    themes: CommerceAdminPromotionPreviewTableSummary;
  };
  pendingPromoteCount: number;
  excludedTables?: readonly string[];
  samples: readonly CommerceAdminPromotionPreviewSample[];
  skippedHeavyTables: readonly string[];
  sourceEnvironment: 'staging';
  status: 'ok';
  tables: Record<string, CommerceAdminPromotionPreviewTableSummary>;
  targetEnvironment: 'production';
}

export interface CommerceAdminPromotionTableSummary {
  insertedCount: number;
  readCount: number;
  updatedCount: number;
  upsertedCount: number;
}

export interface CommerceAdminPromotionResult {
  affectedThemeCount?: number;
  affectedThemeSlugs?: readonly string[];
  brickset_source_metadata_promoted_count?: number;
  bricksetSourceMetadataPromotedCount?: number;
  changedThemeSlugs: readonly string[];
  collection_page_snapshots_read_count?: number;
  collection_page_snapshots_upserted_count?: number;
  collectionPageSnapshotsReadCount?: number;
  collectionPageSnapshotsUpsertedCount?: number;
  durationMs: number;
  pendingPromoteCount?: number;
  rakuten_source_metadata_promoted_count?: number;
  rakutenSourceMetadataPromotedCount?: number;
  revalidation?: {
    attempted: boolean;
    pathCount: number;
    paths: readonly string[];
    promotedMetadataSetPathFallback?: boolean;
    skipped: boolean;
    tagCount: number;
    tags: readonly string[];
    themeDetailFallback?: boolean;
    warning?: string;
  };
  revalidationWarning?: string;
  source_metadata_eligible_count?: number;
  source_metadata_read_count?: number;
  sourceMetadataEligibleCount?: number;
  sourceMetadataReadCount?: number;
  startedAt: string;
  status: 'ok';
  themeSummaryRefresh?: {
    affectedThemeCount: number;
    affectedThemeSlugs: readonly string[];
    attempted: boolean;
    status: 'skipped' | 'success';
  };
  tables: Record<string, CommerceAdminPromotionTableSummary>;
}

export interface CommerceAdminOperationsSummary {
  apiHealth: {
    checkedAt: string;
    status: 'ok';
  };
  discoveryCandidates: {
    highCount: number;
    lowCount: number;
    mediumCount: number;
    newCount: number;
    catalogDiscoveryCandidateCount: number;
    suggestedSetCount: number | null;
    totalCount: number;
  };
  environments: {
    currentRuntimeEnvironment: string;
    productionReadOnly: boolean;
    writableEnvironment: 'production-read-only' | 'staging';
  };
  errors: readonly {
    check: string;
    message: string;
  }[];
  activeBulkOnboardingRun: CommerceAdminBulkOnboardingRunReadResult | null;
  latestBulkOnboardingRun: CommerceAdminBulkOnboardingRunReadResult | null;
  latestBulkOnboardingRunStale: boolean;
  latestCompletedBulkOnboardingRun: CommerceAdminBulkOnboardingRunReadResult | null;
  latestProductionSync: CommerceAdminProductionSyncResult | null;
  pendingPromoteCount: number | null;
  promotePreview: {
    generatedAt: string;
    skippedHeavyTables: readonly string[];
    sourceEnvironment: 'staging';
    status: 'ok';
    targetEnvironment: 'production';
  } | null;
  rebrickableLiveCallCount: 0;
}

export interface CommerceAdminRuntimeConfig {
  articlePreviewEnabled: boolean;
  hasAdminPromotionSecret: boolean;
}

export interface CommerceAdminCacheRevalidationBatchResult {
  batchIndex: number;
  pathCount: number;
  paths: readonly string[];
  responseBody?: unknown;
  status: number;
  success: boolean;
  tagCount: number;
  tags: readonly string[];
  warning?: string;
}

export interface CommerceAdminCacheRevalidationResult {
  durationMs: number;
  pathCount: number;
  paths: readonly string[];
  reason: string;
  results: readonly CommerceAdminCacheRevalidationBatchResult[];
  status: 'partial_failure' | 'success';
  tagCount: number;
  tags: readonly string[];
  warnings: readonly string[];
}

export interface CommerceAdminAffiliateDiscoveredSetFilters {
  affiliateId?: string;
  confidence?: CommerceAffiliateDiscoveredSetConfidence | 'all';
  status?: CommerceAffiliateDiscoveredSetStatus | 'all';
}

export interface CommerceAdminDiscoveryConfidenceRecomputeResult {
  highCount: number;
  lowCount: number;
  mediumCount: number;
  modifiedCount: number;
  processedCount: number;
  skippedCount: number;
}

const adminApiPaths = {
  adminCacheRevalidation: '/api/admin/cache/revalidate',
  adminCatalogBulkOnboardingRuns: '/api/v1/admin/catalog/bulk-onboarding/runs',
  adminCatalogDiscoveryCandidates: '/api/v1/admin/catalog/discovery-candidates',
  adminCatalogPromotion: '/api/admin/promote/catalog',
  adminCatalogPromotionPreview: '/api/v1/admin/promote/catalog/preview',
  adminCatalogSetSearch: '/api/v1/admin/catalog/search',
  adminCatalogSets: '/api/v1/admin/catalog/sets',
  adminCatalogSuggestedSets: '/api/v1/admin/catalog/suggested-sets',
  adminCommerceAffiliateDiscoveredSets:
    '/api/v1/admin/commerce/affiliate-discovered-sets',
  adminCommerceBenchmarkSets: '/api/v1/admin/commerce/benchmark-sets',
  adminCommerceCoverageQueue: '/api/v1/admin/commerce/coverage-queue',
  adminCommerceMerchants: '/api/v1/admin/commerce/merchants',
  adminCommerceOfferSeeds: '/api/v1/admin/commerce/offer-seeds',
  adminCommerceProductionSync: '/api/v1/admin/commerce/production-sync',
  adminCommerceSetRefreshes: '/api/v1/admin/commerce/set-refreshes',
  adminRuntimeConfig: '/api/v1/admin/runtime-config',
  adminOperationsSummary: '/api/v1/admin/operations/summary',
} as const;

@Injectable({ providedIn: 'root' })
export class CommerceAdminApiService {
  private readonly http = inject(HttpClient);

  async listCatalogSets(): Promise<CommerceAdminCatalogSetSummary[]> {
    return firstValueFrom(
      this.http.get<CommerceAdminCatalogSetSummary[]>(
        adminApiPaths.adminCatalogSets,
      ),
    );
  }

  async searchCatalogMissingSets(
    query: string,
  ): Promise<CatalogExternalSetSearchResult[]> {
    return firstValueFrom(
      this.http.get<CatalogExternalSetSearchResult[]>(
        adminApiPaths.adminCatalogSetSearch,
        {
          params: {
            query,
          },
        },
      ),
    );
  }

  async listCatalogSuggestedSets(): Promise<CatalogSuggestedSet[]> {
    return firstValueFrom(
      this.http.get<CatalogSuggestedSet[]>(
        adminApiPaths.adminCatalogSuggestedSets,
      ),
    );
  }

  async listCatalogDiscoveryCandidates(
    input: {
      status?: CommerceAdminCatalogDiscoveryCandidateStatus | 'all';
    } = {},
  ): Promise<CommerceAdminCatalogDiscoveryCandidate[]> {
    return firstValueFrom(
      this.http.get<CommerceAdminCatalogDiscoveryCandidate[]>(
        adminApiPaths.adminCatalogDiscoveryCandidates,
        {
          params: input.status ? { status: input.status } : {},
        },
      ),
    );
  }

  async importCatalogDiscoveryCandidate(
    candidateId: string,
  ): Promise<CommerceAdminCatalogDiscoveryCandidate> {
    return firstValueFrom(
      this.http.post<CommerceAdminCatalogDiscoveryCandidate>(
        `${adminApiPaths.adminCatalogDiscoveryCandidates}/${candidateId}/import`,
        {},
      ),
    );
  }

  async bulkImportCatalogDiscoveryCandidates(input: {
    allowLowConfidence?: boolean;
    candidateIds: readonly string[];
    concurrency?: number;
  }): Promise<CommerceAdminCatalogDiscoveryBulkImportResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminCatalogDiscoveryBulkImportResult>(
        `${adminApiPaths.adminCatalogDiscoveryCandidates}/bulk-import`,
        input,
      ),
    );
  }

  async reEnrichCatalogSet(
    setId: string,
  ): Promise<CommerceAdminCatalogImportResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminCatalogImportResult>(
        `${adminApiPaths.adminCatalogSets}/${setId}/re-enrich`,
        {},
      ),
    );
  }

  async updateCatalogDiscoveryCandidateStatus(input: {
    candidateId: string;
    status: Extract<
      CommerceAdminCatalogDiscoveryCandidateStatus,
      'ignored' | 'non_set' | 'reviewed'
    >;
  }): Promise<CommerceAdminCatalogDiscoveryCandidate> {
    return firstValueFrom(
      this.http.post<CommerceAdminCatalogDiscoveryCandidate>(
        `${adminApiPaths.adminCatalogDiscoveryCandidates}/${input.candidateId}/status`,
        {
          status: input.status,
        },
      ),
    );
  }

  async recomputeCatalogDiscoveryCandidateConfidence(): Promise<CommerceAdminDiscoveryConfidenceRecomputeResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminDiscoveryConfidenceRecomputeResult>(
        `${adminApiPaths.adminCatalogDiscoveryCandidates}/recompute-confidence`,
        {},
      ),
    );
  }

  async createCatalogSet(
    input: CatalogExternalSetSearchResult,
  ): Promise<CatalogSet> {
    return firstValueFrom(
      this.http.post<CatalogSet>(adminApiPaths.adminCatalogSets, input),
    );
  }

  async startCatalogBulkOnboarding(
    setIds: readonly string[],
  ): Promise<CommerceAdminBulkOnboardingStartResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminBulkOnboardingStartResult>(
        adminApiPaths.adminCatalogBulkOnboardingRuns,
        {
          setIds,
        },
      ),
    );
  }

  async getLatestCatalogBulkOnboardingRun(): Promise<CommerceAdminBulkOnboardingRunReadResult | null> {
    try {
      return await firstValueFrom(
        this.http.get<CommerceAdminBulkOnboardingRunReadResult>(
          `${adminApiPaths.adminCatalogBulkOnboardingRuns}/latest`,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async getCatalogBulkOnboardingRun(
    runId: string,
  ): Promise<CommerceAdminBulkOnboardingRunReadResult | null> {
    try {
      return await firstValueFrom(
        this.http.get<CommerceAdminBulkOnboardingRunReadResult>(
          `${adminApiPaths.adminCatalogBulkOnboardingRuns}/${encodeURIComponent(
            runId,
          )}`,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async listBenchmarkSets(): Promise<CommerceBenchmarkSet[]> {
    return firstValueFrom(
      this.http.get<CommerceBenchmarkSet[]>(
        adminApiPaths.adminCommerceBenchmarkSets,
      ),
    );
  }

  async listCoverageQueue(): Promise<CommerceCoverageQueueRow[]> {
    return firstValueFrom(
      this.http.get<CommerceCoverageQueueRow[]>(
        adminApiPaths.adminCommerceCoverageQueue,
      ),
    );
  }

  async listAffiliateDiscoveredSets(
    filters: CommerceAdminAffiliateDiscoveredSetFilters = {},
  ): Promise<CommerceAffiliateDiscoveredSet[]> {
    const params: Record<string, string> = {};

    if (filters.affiliateId) {
      params['affiliateId'] = filters.affiliateId;
    }

    if (filters.confidence && filters.confidence !== 'all') {
      params['confidence'] = filters.confidence;
    }

    if (filters.status && filters.status !== 'all') {
      params['status'] = filters.status;
    }

    return firstValueFrom(
      this.http.get<CommerceAffiliateDiscoveredSet[]>(
        adminApiPaths.adminCommerceAffiliateDiscoveredSets,
        {
          params,
        },
      ),
    );
  }

  async importAffiliateDiscoveredSets(input: {
    discoveredSetIds?: readonly string[];
    highConfidenceOnly?: boolean;
    maxBatchSize?: number;
  }): Promise<CommerceAffiliateDiscoveredSetImportResult> {
    return firstValueFrom(
      this.http.post<CommerceAffiliateDiscoveredSetImportResult>(
        `${adminApiPaths.adminCommerceAffiliateDiscoveredSets}/import`,
        input,
      ),
    );
  }

  async updateAffiliateDiscoveredSetStatus(input: {
    discoveredSetId: string;
    status: Exclude<CommerceAffiliateDiscoveredSetStatus, 'imported'>;
  }): Promise<CommerceAffiliateDiscoveredSet> {
    return firstValueFrom(
      this.http.post<CommerceAffiliateDiscoveredSet>(
        `${adminApiPaths.adminCommerceAffiliateDiscoveredSets}/${input.discoveredSetId}/status`,
        {
          status: input.status,
        },
      ),
    );
  }

  async refreshSet(setId: string): Promise<CommerceSetRefreshResult> {
    return firstValueFrom(
      this.http.post<CommerceSetRefreshResult>(
        adminApiPaths.adminCommerceSetRefreshes,
        { setId },
      ),
    );
  }

  async syncCommerceFromProduction(input: {
    adminSecret: string;
    allowDestructive?: boolean;
    dryRun: boolean;
  }): Promise<CommerceAdminProductionSyncResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminProductionSyncResult>(
        adminApiPaths.adminCommerceProductionSync,
        {
          allowDestructive: input.allowDestructive === true,
          dryRun: input.dryRun,
        },
        {
          headers: {
            'x-admin-secret': input.adminSecret,
          },
        },
      ),
    );
  }

  async getOperationsSummary(): Promise<CommerceAdminOperationsSummary> {
    return firstValueFrom(
      this.http.get<CommerceAdminOperationsSummary>(
        adminApiPaths.adminOperationsSummary,
      ),
    );
  }

  async getAdminRuntimeConfig(): Promise<CommerceAdminRuntimeConfig> {
    return firstValueFrom(
      this.http.get<CommerceAdminRuntimeConfig>(
        adminApiPaths.adminRuntimeConfig,
      ),
    );
  }

  async getCatalogPromotionPreview(
    input: {
      includeHeavy?: boolean;
    } = {},
  ): Promise<CommerceAdminPromotionPreviewResult> {
    return firstValueFrom(
      this.http.get<CommerceAdminPromotionPreviewResult>(
        adminApiPaths.adminCatalogPromotionPreview,
        {
          params: input.includeHeavy ? { includeHeavy: 'true' } : {},
        },
      ),
    );
  }

  async promoteCatalog(input: {
    adminSecret?: string;
    confirmationPhrase?: string;
  }): Promise<CommerceAdminPromotionResult> {
    const options: {
      headers?: Record<string, string>;
    } = input.adminSecret
      ? {
          headers: {
            'x-admin-secret': input.adminSecret,
          },
        }
      : {};

    return firstValueFrom(
      this.http.post<CommerceAdminPromotionResult>(
        adminApiPaths.adminCatalogPromotion,
        {
          ...(input.confirmationPhrase
            ? { confirmationPhrase: input.confirmationPhrase }
            : {}),
        },
        options,
      ),
    );
  }

  async revalidatePublicWebCache(input: {
    paths?: readonly string[];
    reason: string;
    tags?: readonly string[];
  }): Promise<CommerceAdminCacheRevalidationResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminCacheRevalidationResult>(
        adminApiPaths.adminCacheRevalidation,
        input,
      ),
    );
  }

  async createBenchmarkSet(input: {
    notes?: string;
    setId: string;
  }): Promise<CommerceBenchmarkSet> {
    return firstValueFrom(
      this.http.post<CommerceBenchmarkSet>(
        adminApiPaths.adminCommerceBenchmarkSets,
        input,
      ),
    );
  }

  async deleteBenchmarkSet(setId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        `${adminApiPaths.adminCommerceBenchmarkSets}/${setId}`,
      ),
    );
  }

  async listMerchants(): Promise<CommerceMerchant[]> {
    return firstValueFrom(
      this.http.get<CommerceMerchant[]>(adminApiPaths.adminCommerceMerchants),
    );
  }

  async createMerchant(
    input: CommerceMerchantInput,
  ): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.post<CommerceMerchant>(
        adminApiPaths.adminCommerceMerchants,
        input,
      ),
    );
  }

  async updateMerchant(input: {
    input: CommerceMerchantInput;
    merchantId: string;
  }): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.put<CommerceMerchant>(
        `${adminApiPaths.adminCommerceMerchants}/${input.merchantId}`,
        input.input,
      ),
    );
  }

  async listOfferSeeds(): Promise<CommerceOfferSeed[]> {
    return firstValueFrom(
      this.http.get<CommerceOfferSeed[]>(adminApiPaths.adminCommerceOfferSeeds),
    );
  }

  async createOfferSeed(
    input: CommerceOfferSeedInput,
  ): Promise<CommerceOfferSeed> {
    return firstValueFrom(
      this.http.post<CommerceOfferSeed>(
        adminApiPaths.adminCommerceOfferSeeds,
        input,
      ),
    );
  }

  async updateOfferSeed(input: {
    input: CommerceOfferSeedInput;
    offerSeedId: string;
  }): Promise<CommerceOfferSeed> {
    return firstValueFrom(
      this.http.put<CommerceOfferSeed>(
        `${adminApiPaths.adminCommerceOfferSeeds}/${input.offerSeedId}`,
        input.input,
      ),
    );
  }
}
