import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  createAdminOperationsRoutes,
  type AdminOperationsService,
} from '../app/routes/admin-operations';
import type { CatalogDiscoveryCandidate } from '@lego-platform/catalog/data-access-server';

type LatestBulkRunResult = Awaited<
  ReturnType<AdminOperationsService['getLatestBulkOnboardingRun']>
>;
type PromotePreviewResult = Awaited<
  ReturnType<AdminOperationsService['getPromotePreview']>
>;
type DiscoveryCandidateRows = Awaited<
  ReturnType<AdminOperationsService['listDiscoveryCandidates']>
>;

function createDiscoveryCandidate(
  overrides: Partial<CatalogDiscoveryCandidate> = {},
): CatalogDiscoveryCandidate {
  return {
    autoCreateEligible: true,
    confidence: 'high',
    confidenceScore: 92,
    evidence: {},
    firstSeenAt: '2026-05-06T10:00:00.000Z',
    id: 'candidate-75313',
    lastSeenAt: '2026-05-06T10:00:00.000Z',
    normalizedSetId: '75313',
    operatorConfidence: 'high',
    operatorConfidenceReasons: ['trusted_feed_valid_set_number'],
    requiredFieldsPresent: true,
    source: 'alternate_feed',
    sourcePayload: {},
    sourceProductTitle: 'LEGO Star Wars AT-AT 75313',
    sourceProductUrl: 'https://shop.example.test/75313',
    sourceSetNumber: '75313-1',
    status: 'new',
    ...overrides,
  };
}

async function createAdminOperationsServer({
  isProductionEnvironment,
  operationsService,
  readRuntimeEnvironmentFn,
}: {
  isProductionEnvironment?: () => boolean;
  operationsService?: AdminOperationsService;
  readRuntimeEnvironmentFn?: () => string;
} = {}) {
  const nextOperationsService: AdminOperationsService = operationsService ?? {
    getLatestBulkOnboardingRun: vi.fn(
      async () =>
        ({
          run: {
            createdAt: '2026-04-19T08:00:00.000Z',
            generateStep: { appliedSetIds: [], status: 'completed' },
            importStep: { appliedSetIds: [], status: 'completed' },
            requestedSetIds: ['10316'],
            runId: 'bulk-10316',
            setProgressById: {},
            snapshotStep: { appliedSetIds: [], status: 'completed' },
            status: 'completed',
            syncStep: { appliedSetIds: [], status: 'completed' },
            updatedAt: '2026-04-19T08:05:00.000Z',
            validateStep: { appliedSetIds: [], status: 'completed' },
          },
          stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
        }) satisfies LatestBulkRunResult,
    ),
    getPromotePreview: vi.fn(
      async () =>
        ({
          generatedAt: '2026-04-19T08:06:00.000Z',
          meaningfulPendingPromoteCount: 3,
          operatorSummary: {
            mappings: {
              insertedCount: 0,
              readCount: 0,
              skipped: false,
              strategy: 'sample_diff',
              updatedCount: 0,
            },
            sets: {
              insertedCount: 2,
              readCount: 10,
              skipped: false,
              strategy: 'sample_diff',
              updatedCount: 1,
            },
            themes: {
              insertedCount: 0,
              readCount: 0,
              skipped: false,
              strategy: 'sample_diff',
              updatedCount: 0,
            },
          },
          pendingPromoteCount: 3,
          samples: [],
          sourceEnvironment: 'staging',
          status: 'ok',
          tables: {
            catalog_sets: {
              insertedCount: 2,
              readCount: 10,
              skipped: false,
              strategy: 'sample_diff',
              updatedCount: 1,
            },
            collection_page_snapshots: {
              insertedCount: 0,
              readCount: 0,
              skipped: true,
              strategy: 'heavy_skipped',
              updatedCount: 0,
              warning: 'Skipped in lightweight preview.',
            },
          },
          skippedHeavyTables: ['collection_page_snapshots'],
          targetEnvironment: 'production',
        }) satisfies PromotePreviewResult,
    ),
    listDiscoveryCandidates: vi.fn(
      async () =>
        [
          createDiscoveryCandidate(),
          createDiscoveryCandidate({
            confidence: 'medium',
            id: 'candidate-10316',
            normalizedSetId: '10316',
            operatorConfidence: 'medium',
            operatorConfidenceReasons: ['trusted_feed_valid_set_number'],
            sourceSetNumber: '10316-1',
            status: 'reviewed',
          }),
          createDiscoveryCandidate({
            confidence: 'low',
            id: 'candidate-21061',
            normalizedSetId: '21061',
            operatorConfidence: 'low',
            operatorConfidenceReasons: ['likely_accessory'],
            sourceSetNumber: '21061-1',
            status: 'ignored',
          }),
        ] satisfies DiscoveryCandidateRows,
    ),
  };
  const server = Fastify();

  await server.register(
    createAdminOperationsRoutes({
      adminPreHandler: async () => undefined,
      isProductionEnvironment,
      operationsService: nextOperationsService,
      readRuntimeEnvironmentFn,
    }),
  );

  return {
    operationsService: nextOperationsService,
    server,
  };
}

describe('admin operations routes', () => {
  test('returns the Operations Console summary', async () => {
    const { operationsService, server } = await createAdminOperationsServer({
      isProductionEnvironment: () => false,
      readRuntimeEnvironmentFn: () => 'staging',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/operations/summary',
    });

    expect(response.statusCode).toBe(200);
    expect(operationsService.getPromotePreview).toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        discoveryCandidates: expect.objectContaining({
          highCount: 1,
          lowCount: 1,
          mediumCount: 1,
          newCount: 1,
          suggestedSetCount: null,
          totalCount: 3,
        }),
        environments: {
          currentRuntimeEnvironment: 'staging',
          productionReadOnly: false,
          writableEnvironment: 'staging',
        },
        pendingPromoteCount: 3,
        rebrickableLiveCallCount: 0,
      }),
    );
    expect('listSuggestedSets' in operationsService).toBe(false);
    expect(operationsService.listDiscoveryCandidates).toHaveBeenCalled();

    await server.close();
  });

  test('marks production runtime as read-only for normal writes', async () => {
    const { server } = await createAdminOperationsServer({
      isProductionEnvironment: () => true,
      readRuntimeEnvironmentFn: () => 'production',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/operations/summary',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().environments).toEqual({
      currentRuntimeEnvironment: 'production',
      productionReadOnly: true,
      writableEnvironment: 'production-read-only',
    });

    await server.close();
  });

  test('does not report stale running bulk onboarding state as active', async () => {
    const { server } = await createAdminOperationsServer({
      operationsService: {
        getLatestBulkOnboardingRun: vi.fn(
          async () =>
            ({
              run: {
                createdAt: '2026-04-19T08:00:00.000Z',
                generateStep: { appliedSetIds: [], status: 'running' },
                importStep: { appliedSetIds: [], status: 'completed' },
                requestedSetIds: ['10316'],
                runId: 'bulk-stale',
                setProgressById: {},
                snapshotStep: { appliedSetIds: [], status: 'pending' },
                status: 'running',
                syncStep: { appliedSetIds: [], status: 'pending' },
                updatedAt: '2026-04-19T08:05:00.000Z',
                validateStep: { appliedSetIds: [], status: 'pending' },
              },
              stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
            }) satisfies LatestBulkRunResult,
        ),
        getPromotePreview: vi.fn(
          async () =>
            ({
              generatedAt: '2026-04-19T08:06:00.000Z',
              meaningfulPendingPromoteCount: 0,
              operatorSummary: {
                mappings: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
                sets: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
                themes: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
              },
              pendingPromoteCount: 0,
              samples: [],
              skippedHeavyTables: [],
              sourceEnvironment: 'staging',
              status: 'ok',
              tables: {},
              targetEnvironment: 'production',
            }) satisfies PromotePreviewResult,
        ),
        listDiscoveryCandidates: vi.fn(async () => []),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/operations/summary',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        activeBulkOnboardingRun: null,
        latestBulkOnboardingRunStale: true,
        latestCompletedBulkOnboardingRun: null,
      }),
    );

    await server.close();
  });

  test('returns partial summary when promote preview fails', async () => {
    const { server } = await createAdminOperationsServer({
      operationsService: {
        getLatestBulkOnboardingRun: vi.fn(async () => null),
        getPromotePreview: vi.fn(async () => {
          throw new Error('collection_page_snapshots timed out');
        }),
        listDiscoveryCandidates: vi.fn(async () => []),
      },
      readRuntimeEnvironmentFn: () => 'staging',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/operations/summary',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        errors: [
          {
            check: 'promote_preview',
            message: 'collection_page_snapshots timed out',
          },
        ],
        pendingPromoteCount: null,
        promotePreview: null,
        rebrickableLiveCallCount: 0,
      }),
    );

    await server.close();
  });
});
