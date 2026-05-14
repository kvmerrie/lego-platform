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

const adminApiPaths = {
  adminCacheRevalidation: '/api/admin/cache/revalidate',
  adminCatalogBulkOnboardingRuns: '/api/v1/admin/catalog/bulk-onboarding/runs',
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
} as const;

function readStoredSupabaseAccessToken(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) {
        continue;
      }

      const rawValue = window.localStorage.getItem(key);

      if (!rawValue) {
        continue;
      }

      const parsedValue = JSON.parse(rawValue) as {
        access_token?: unknown;
        currentSession?: { access_token?: unknown };
      };
      const accessToken =
        typeof parsedValue.access_token === 'string'
          ? parsedValue.access_token
          : typeof parsedValue.currentSession?.access_token === 'string'
            ? parsedValue.currentSession.access_token
            : undefined;

      if (accessToken?.trim()) {
        return accessToken.trim();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function buildBrowserAuthorizationHeaders(): Record<string, string> {
  const accessToken = readStoredSupabaseAccessToken();

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {};
}

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

  async revalidatePublicWebCache(input: {
    paths?: readonly string[];
    reason: string;
    tags?: readonly string[];
  }): Promise<CommerceAdminCacheRevalidationResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminCacheRevalidationResult>(
        adminApiPaths.adminCacheRevalidation,
        input,
        {
          headers: buildBrowserAuthorizationHeaders(),
        },
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
