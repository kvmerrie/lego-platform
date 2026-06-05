import {
  getLatestCatalogBulkOnboardingRun,
  previewCatalogPromotionFromStagingToProduction,
  type CatalogBulkOnboardingRunReadResult,
  type CatalogPromotionPreviewResult,
} from '@lego-platform/api/data-access-server';
import {
  listCatalogDiscoveryCandidates,
  type CatalogDiscoveryCandidate,
} from '@lego-platform/catalog/data-access-server';
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import { createAdminPreHandler } from '../lib/admin-authorization';
import { getLatestCommerceProductionSyncResult } from './admin-commerce';

export interface AdminOperationsSummary {
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
  errors: {
    check: string;
    message: string;
  }[];
  latestBulkOnboardingRun: CatalogBulkOnboardingRunReadResult | null;
  activeBulkOnboardingRun: CatalogBulkOnboardingRunReadResult | null;
  latestCompletedBulkOnboardingRun: CatalogBulkOnboardingRunReadResult | null;
  latestBulkOnboardingRunStale: boolean;
  latestProductionSync: ReturnType<
    typeof getLatestCommerceProductionSyncResult
  >;
  pendingPromoteCount: number | null;
  promotePreview: Pick<
    CatalogPromotionPreviewResult,
    | 'generatedAt'
    | 'skippedHeavyTables'
    | 'sourceEnvironment'
    | 'status'
    | 'targetEnvironment'
  > | null;
  rebrickableLiveCallCount: 0;
}

export interface AdminOperationsService {
  getLatestBulkOnboardingRun(): Promise<CatalogBulkOnboardingRunReadResult | null>;
  getPromotePreview(): Promise<CatalogPromotionPreviewResult>;
  listDiscoveryCandidates(): Promise<CatalogDiscoveryCandidate[]>;
}

type SummaryCheckName =
  | 'bulk_onboarding'
  | 'catalog_discovery'
  | 'promote_preview';

const SUMMARY_CHECK_TIMEOUT_MS = 1500;

function readRuntimeEnvironment(): string {
  return (
    process.env['BRICKHUNT_ENV'] ||
    process.env['APP_ENV'] ||
    process.env['VERCEL_ENV'] ||
    'development'
  );
}

function isProductionRuntime(): boolean {
  const runtimeEnvironment = readRuntimeEnvironment();

  return runtimeEnvironment === 'production';
}

function createAdminOperationsService(): AdminOperationsService {
  return {
    getLatestBulkOnboardingRun: async () => {
      const result = await getLatestCatalogBulkOnboardingRun({
        options: {
          workspaceRoot: process.cwd(),
        },
      });

      return result.run ? result : null;
    },
    getPromotePreview: () =>
      previewCatalogPromotionFromStagingToProduction({
        includeHeavy: false,
      }),
    listDiscoveryCandidates: () =>
      listCatalogDiscoveryCandidates({
        limit: 500,
        status: 'all',
      }),
  };
}

function isCompletedBulkOnboardingRun(
  runResult: CatalogBulkOnboardingRunReadResult | null,
): runResult is CatalogBulkOnboardingRunReadResult {
  return (
    runResult?.run.status === 'completed' ||
    runResult?.run.status === 'completed_with_errors' ||
    runResult?.run.status === 'failed'
  );
}

function isActiveBulkOnboardingRun(
  runResult: CatalogBulkOnboardingRunReadResult | null,
): runResult is CatalogBulkOnboardingRunReadResult {
  if (runResult?.run.status !== 'running') {
    return false;
  }

  const updatedAt = new Date(runResult.run.updatedAt).getTime();

  return Number.isFinite(updatedAt) && Date.now() - updatedAt < 30 * 60 * 1000;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Check failed.';
}

async function runSummaryCheck<TValue>({
  check,
  errors,
  fallbackValue,
  run,
  timeoutMs = SUMMARY_CHECK_TIMEOUT_MS,
}: {
  check: SummaryCheckName;
  errors: AdminOperationsSummary['errors'];
  fallbackValue: TValue;
  run: () => Promise<TValue>;
  timeoutMs?: number;
}): Promise<TValue> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      run(),
      new Promise<TValue>((resolve) => {
        timeoutId = setTimeout(() => {
          errors.push({
            check,
            message: `Timed out after ${timeoutMs}ms.`,
          });
          resolve(fallbackValue);
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    errors.push({
      check,
      message: toErrorMessage(error),
    });

    return fallbackValue;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function createAdminOperationsRoutes({
  adminPreHandler = createAdminPreHandler(),
  isProductionEnvironment = isProductionRuntime,
  operationsService = createAdminOperationsService(),
  readRuntimeEnvironmentFn = readRuntimeEnvironment,
}: {
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  isProductionEnvironment?: () => boolean;
  operationsService?: AdminOperationsService;
  readRuntimeEnvironmentFn?: () => string;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(
      apiPaths.adminOperationsSummary,
      {
        preHandler: adminPreHandler,
      },
      async function (): Promise<AdminOperationsSummary> {
        const errors: AdminOperationsSummary['errors'] = [];
        const [latestBulkOnboardingRun, promotePreview, discoveryCandidates] =
          await Promise.all([
            runSummaryCheck({
              check: 'bulk_onboarding',
              errors,
              fallbackValue: null,
              run: () => operationsService.getLatestBulkOnboardingRun(),
            }),
            runSummaryCheck({
              check: 'promote_preview',
              errors,
              fallbackValue: null,
              run: () => operationsService.getPromotePreview(),
            }),
            runSummaryCheck({
              check: 'catalog_discovery',
              errors,
              fallbackValue: [],
              run: () => operationsService.listDiscoveryCandidates(),
            }),
          ]);
        const newCount = discoveryCandidates.filter(
          (candidate) => candidate.status === 'new',
        ).length;
        const highCount = discoveryCandidates.filter(
          (candidate) => candidate.operatorConfidence === 'high',
        ).length;
        const mediumCount = discoveryCandidates.filter(
          (candidate) => candidate.operatorConfidence === 'medium',
        ).length;
        const lowCount = discoveryCandidates.filter(
          (candidate) => candidate.operatorConfidence === 'low',
        ).length;
        const suggestedSetCount = null;
        const catalogDiscoveryCandidateCount = discoveryCandidates.length;
        const productionReadOnly = isProductionEnvironment();
        const activeBulkOnboardingRun = isActiveBulkOnboardingRun(
          latestBulkOnboardingRun,
        )
          ? latestBulkOnboardingRun
          : null;
        const latestCompletedBulkOnboardingRun = isCompletedBulkOnboardingRun(
          latestBulkOnboardingRun,
        )
          ? latestBulkOnboardingRun
          : null;

        return {
          apiHealth: {
            checkedAt: new Date().toISOString(),
            status: 'ok',
          },
          discoveryCandidates: {
            highCount,
            lowCount,
            mediumCount,
            newCount,
            catalogDiscoveryCandidateCount,
            suggestedSetCount,
            totalCount: catalogDiscoveryCandidateCount,
          },
          environments: {
            currentRuntimeEnvironment: readRuntimeEnvironmentFn(),
            productionReadOnly,
            writableEnvironment: productionReadOnly
              ? 'production-read-only'
              : 'staging',
          },
          errors,
          activeBulkOnboardingRun,
          latestCompletedBulkOnboardingRun,
          latestBulkOnboardingRun,
          latestBulkOnboardingRunStale:
            latestBulkOnboardingRun?.run.status === 'running' &&
            !activeBulkOnboardingRun,
          latestProductionSync: getLatestCommerceProductionSyncResult(),
          pendingPromoteCount:
            promotePreview?.meaningfulPendingPromoteCount ?? null,
          promotePreview: promotePreview
            ? {
                generatedAt: promotePreview.generatedAt,
                skippedHeavyTables: promotePreview.skippedHeavyTables,
                sourceEnvironment: promotePreview.sourceEnvironment,
                status: promotePreview.status,
                targetEnvironment: promotePreview.targetEnvironment,
              }
            : null,
          rebrickableLiveCallCount: 0,
        };
      },
    );
  };
}

export default createAdminOperationsRoutes();
