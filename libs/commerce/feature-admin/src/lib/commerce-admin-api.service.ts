import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSet,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
import {
  type CommerceBenchmarkSet,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
} from '@lego-platform/commerce/util';
import { apiPaths } from '@lego-platform/shared/config';
import { firstValueFrom } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class CommerceAdminApiService {
  private readonly http = inject(HttpClient);

  async listCatalogSets(): Promise<CatalogSetSummary[]> {
    return firstValueFrom(
      this.http.get<CatalogSetSummary[]>(apiPaths.adminCatalogSets),
    );
  }

  async searchCatalogMissingSets(
    query: string,
  ): Promise<CatalogExternalSetSearchResult[]> {
    return firstValueFrom(
      this.http.get<CatalogExternalSetSearchResult[]>(
        apiPaths.adminCatalogSetSearch,
        {
          params: {
            query,
          },
        },
      ),
    );
  }

  async createCatalogSet(
    input: CatalogExternalSetSearchResult,
  ): Promise<CatalogSet> {
    return firstValueFrom(
      this.http.post<CatalogSet>(apiPaths.adminCatalogSets, input),
    );
  }

  async startCatalogBulkOnboarding(
    setIds: readonly string[],
  ): Promise<CommerceAdminBulkOnboardingStartResult> {
    return firstValueFrom(
      this.http.post<CommerceAdminBulkOnboardingStartResult>(
        apiPaths.adminCatalogBulkOnboardingRuns,
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
          `${apiPaths.adminCatalogBulkOnboardingRuns}/latest`,
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
          `${apiPaths.adminCatalogBulkOnboardingRuns}/${encodeURIComponent(
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
        apiPaths.adminCommerceBenchmarkSets,
      ),
    );
  }

  async listCoverageQueue(): Promise<CommerceCoverageQueueRow[]> {
    return firstValueFrom(
      this.http.get<CommerceCoverageQueueRow[]>(
        apiPaths.adminCommerceCoverageQueue,
      ),
    );
  }

  async refreshSet(setId: string): Promise<CommerceSetRefreshResult> {
    return firstValueFrom(
      this.http.post<CommerceSetRefreshResult>(
        apiPaths.adminCommerceSetRefreshes,
        { setId },
      ),
    );
  }

  async createBenchmarkSet(input: {
    notes?: string;
    setId: string;
  }): Promise<CommerceBenchmarkSet> {
    return firstValueFrom(
      this.http.post<CommerceBenchmarkSet>(
        apiPaths.adminCommerceBenchmarkSets,
        input,
      ),
    );
  }

  async deleteBenchmarkSet(setId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${apiPaths.adminCommerceBenchmarkSets}/${setId}`),
    );
  }

  async listMerchants(): Promise<CommerceMerchant[]> {
    return firstValueFrom(
      this.http.get<CommerceMerchant[]>(apiPaths.adminCommerceMerchants),
    );
  }

  async createMerchant(
    input: CommerceMerchantInput,
  ): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.post<CommerceMerchant>(apiPaths.adminCommerceMerchants, input),
    );
  }

  async updateMerchant(input: {
    input: CommerceMerchantInput;
    merchantId: string;
  }): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.put<CommerceMerchant>(
        `${apiPaths.adminCommerceMerchants}/${input.merchantId}`,
        input.input,
      ),
    );
  }

  async listOfferSeeds(): Promise<CommerceOfferSeed[]> {
    return firstValueFrom(
      this.http.get<CommerceOfferSeed[]>(apiPaths.adminCommerceOfferSeeds),
    );
  }

  async createOfferSeed(
    input: CommerceOfferSeedInput,
  ): Promise<CommerceOfferSeed> {
    return firstValueFrom(
      this.http.post<CommerceOfferSeed>(
        apiPaths.adminCommerceOfferSeeds,
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
        `${apiPaths.adminCommerceOfferSeeds}/${input.offerSeedId}`,
        input.input,
      ),
    );
  }
}
