import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import type {
  CommercePrimaryCoverageGapAuditReport,
  CommercePrimaryCoverageReport,
} from '@lego-platform/commerce/data-access-server';
import type { CommerceSyncRunResult } from './commerce-sync-server';
import {
  getCatalogBulkOnboardingRun,
  getLatestCatalogBulkOnboardingRun,
  runCatalogBulkOnboarding,
  startCatalogBulkOnboardingRun,
} from './catalog-bulk-onboarding-server';

const createdTempDirectories: string[] = [];

async function createTempDirectory() {
  const tempDirectory = await mkdtemp(
    join(tmpdir(), 'brickhunt-bulk-onboarding-'),
  );
  createdTempDirectories.push(tempDirectory);

  return tempDirectory;
}

afterEach(async () => {
  await Promise.all(
    createdTempDirectories.splice(0).map((directoryPath) =>
      rm(directoryPath, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

function createCatalogSet(input: {
  name: string;
  setId: string;
  sourceSetNumber: string;
}): CatalogCanonicalSet {
  return {
    createdAt: '2026-04-19T08:00:00.000Z',
    imageUrl: `https://cdn.example.com/${input.setId}.jpg`,
    name: input.name,
    pieceCount: 1000,
    primaryTheme: 'Icons',
    releaseYear: 2026,
    secondaryLabels: [],
    setId: input.setId,
    slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${input.setId}`,
    source: 'rebrickable',
    sourceSetNumber: input.sourceSetNumber,
    status: 'active',
    updatedAt: '2026-04-19T08:00:00.000Z',
  };
}

function createCoverageReport({
  rows,
}: {
  rows: Array<{
    missingValidPrimaryOfferMerchantSlugs?: readonly string[];
    primarySeedCount: number;
    setId: string;
    setName: string;
    status:
      | 'full_primary_coverage'
      | 'no_primary_seeds'
      | 'no_valid_primary_offers'
      | 'partial_primary_coverage';
    theme?: string;
    validPrimaryOfferCount: number;
  }>;
}): CommercePrimaryCoverageReport {
  return {
    fullPrimaryCoverageCount: rows.filter(
      (row) => row.status === 'full_primary_coverage',
    ).length,
    noPrimarySeedsCount: rows.filter((row) => row.status === 'no_primary_seeds')
      .length,
    noValidPrimaryOffersCount: rows.filter(
      (row) => row.status === 'no_valid_primary_offers',
    ).length,
    partialPrimaryCoverageCount: rows.filter(
      (row) => row.status === 'partial_primary_coverage',
    ).length,
    primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
    rows: rows.map((row) => ({
      missingPrimarySeedMerchantNames: [],
      missingPrimarySeedMerchantSlugs: [],
      missingValidPrimaryOfferMerchantNames:
        row.missingValidPrimaryOfferMerchantSlugs ?? [],
      missingValidPrimaryOfferMerchantSlugs:
        row.missingValidPrimaryOfferMerchantSlugs ?? [],
      primaryMerchantTargetCount: 4,
      primarySeedCount: row.primarySeedCount,
      setId: row.setId,
      setName: row.setName,
      status: row.status,
      theme: row.theme ?? 'Icons',
      validPrimaryOfferCount: row.validPrimaryOfferCount,
    })),
    selectedSetCount: rows.length,
    totalSetCount: rows.length,
  };
}

function createGapAudit({
  rows,
}: {
  rows: Array<{
    gapType: string;
    merchantSlug: string;
    recoveryPriority: string;
    setId: string;
    setName: string;
  }>;
}): CommercePrimaryCoverageGapAuditReport {
  return {
    auditedMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
    primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
    rows: rows.map((row) => ({
      merchantGaps: [
        {
          gapType: row.gapType as
            | 'missing_seed'
            | 'no_latest_refresh'
            | 'refresh_error'
            | 'refresh_pending'
            | 'refresh_unavailable'
            | 'seed_invalid'
            | 'seed_pending'
            | 'seed_stale',
          hasSeed: row.gapType !== 'missing_seed',
          merchantId: `merchant-${row.merchantSlug}`,
          merchantName: row.merchantSlug,
          merchantSlug: row.merchantSlug,
          recoveryPriority: row.recoveryPriority as
            | 'parked'
            | 'recover_now'
            | 'verify_first',
          recoveryReason: 'test reason',
          seedIsActive: row.gapType !== 'missing_seed',
          seedValidationStatus:
            row.gapType === 'seed_invalid'
              ? 'invalid'
              : row.gapType === 'seed_stale'
                ? 'stale'
                : row.gapType === 'missing_seed'
                  ? undefined
                  : 'valid',
        },
      ],
      missingValidPrimaryOfferMerchantNames: [row.merchantSlug],
      missingValidPrimaryOfferMerchantSlugs: [row.merchantSlug],
      primaryMerchantTargetCount: 4,
      primarySeedCount: row.gapType === 'missing_seed' ? 3 : 4,
      setId: row.setId,
      setName: row.setName,
      status: 'partial_primary_coverage',
      theme: 'Icons',
      validPrimaryOfferCount: 3,
    })),
    selectedSetCount: rows.length,
    summary: {
      actionablePartialSetCount: rows.length,
      countsByRecoveryPriority: [
        {
          count: rows.filter((row) => row.recoveryPriority === 'recover_now')
            .length,
          recoveryPriority: 'recover_now',
        },
        {
          count: rows.filter((row) => row.recoveryPriority === 'verify_first')
            .length,
          recoveryPriority: 'verify_first',
        },
        {
          count: rows.filter((row) => row.recoveryPriority === 'parked').length,
          recoveryPriority: 'parked',
        },
      ].filter((row) => row.count > 0),
      gapCountsByType: [],
      missingValidOfferCountsByMerchant: [],
      parkedCount: rows.filter((row) => row.recoveryPriority === 'parked')
        .length,
      recoverNowCount: rows.filter(
        (row) => row.recoveryPriority === 'recover_now',
      ).length,
      setsMissingSeedCount: rows.filter((row) => row.gapType === 'missing_seed')
        .length,
      setsWithFullSeedButMissingOfferCount: rows.length,
      verifyFirstCount: rows.filter(
        (row) => row.recoveryPriority === 'verify_first',
      ).length,
    },
    totalSetCount: rows.length,
  };
}

function createSyncSummary(setIds: readonly string[]): CommerceSyncRunResult {
  return {
    affiliateArtifactCheck: {
      isClean: true,
      stalePaths: [],
    },
    affiliateOfferCount: setIds.length * 2,
    dailyHistoryPointCount: setIds.length,
    enabledSetCount: setIds.length,
    merchantCount: 4,
    mode: 'write',
    pricePanelSnapshotCount: setIds.length,
    pricingArtifactCheck: {
      isClean: true,
      stalePaths: [],
    },
    pricingObservationCount: setIds.length * 2,
    refreshInvalidCount: 0,
    refreshStaleCount: 0,
    refreshSuccessCount: setIds.length,
    refreshUnavailableCount: 0,
    scoped: true,
    scopedMerchantSlugs: [],
    scopedSetIds: setIds,
  };
}

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}

describe('catalog bulk onboarding server', () => {
  test('imports a set list, persists per-set progress, and bootstraps generate/validate/scoped sync', async () => {
    const workspaceRoot = await createTempDirectory();
    const stateFilePath = join(workspaceRoot, 'state', 'bulk.json');
    const existingCatalogSet = createCatalogSet({
      name: 'Notre-Dame de Paris',
      setId: '21061',
      sourceSetNumber: '21061-1',
    });
    const createdCatalogSet = createCatalogSet({
      name: 'Rivendell',
      setId: '10316',
      sourceSetNumber: '10316-1',
    });
    const listCanonicalCatalogSetsFn = vi
      .fn()
      .mockResolvedValue([existingCatalogSet]);
    const searchCatalogMissingSetsFn = vi.fn().mockResolvedValue([
      {
        imageUrl: createdCatalogSet.imageUrl,
        name: createdCatalogSet.name,
        pieces: createdCatalogSet.pieceCount,
        releaseYear: createdCatalogSet.releaseYear,
        setId: createdCatalogSet.setId,
        slug: createdCatalogSet.slug,
        source: 'rebrickable',
        sourceSetNumber: createdCatalogSet.sourceSetNumber,
        theme: createdCatalogSet.primaryTheme,
      },
    ]);
    const createCatalogSetFn = vi.fn().mockResolvedValue(createdCatalogSet);
    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 8,
      insertedCount: 4,
      skippedCount: 4,
      supportedMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        invalidCount: 1,
        processedCount: 4,
        skippedCount: 0,
        staleCount: 1,
        validCount: 2,
      });
    const runCommerceSyncFn = vi
      .fn()
      .mockResolvedValue(createSyncSummary(['10316', '21061']));
    const listCommercePrimaryCoverageReportFn = vi.fn().mockResolvedValue(
      createCoverageReport({
        rows: [
          {
            primarySeedCount: 4,
            setId: '10316',
            setName: 'Rivendell',
            status: 'full_primary_coverage',
            validPrimaryOfferCount: 4,
          },
          {
            missingValidPrimaryOfferMerchantSlugs: ['misterbricks'],
            primarySeedCount: 4,
            setId: '21061',
            setName: 'Notre-Dame de Paris',
            status: 'partial_primary_coverage',
            validPrimaryOfferCount: 3,
          },
        ],
      }),
    );
    const listCommercePrimaryCoverageGapAuditFn = vi.fn().mockResolvedValue(
      createGapAudit({
        rows: [
          {
            gapType: 'refresh_unavailable',
            merchantSlug: 'misterbricks',
            recoveryPriority: 'verify_first',
            setId: '21061',
            setName: 'Notre-Dame de Paris',
          },
        ],
      }),
    );

    const result = await runCatalogBulkOnboarding({
      dependencies: {
        createCatalogSetFn,
        generateCommerceOfferSeedCandidatesFn,
        listCanonicalCatalogSetsFn,
        listCommercePrimaryCoverageGapAuditFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        searchCatalogMissingSetsFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        setIds: ['21061', '10316'],
        stateFilePath,
        workspaceRoot,
      },
    });

    expect(createCatalogSetFn).toHaveBeenCalledTimes(1);
    expect(generateCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith({
      filters: {
        setIds: ['10316', '21061'],
      },
      write: true,
    });
    expect(validateGeneratedCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith(
      {
        filters: {
          recheckGenerated: true,
          setIds: ['10316', '21061'],
        },
        write: true,
      },
    );
    expect(runCommerceSyncFn).toHaveBeenCalledWith({
      mode: 'write',
      setIds: ['10316', '21061'],
      workspaceRoot,
    });
    expect(result.run.status).toBe('completed');
    expect(result.run.setProgressById['10316']).toEqual(
      expect.objectContaining({
        catalogSetId: '10316',
        importStatus: 'created',
        processingState: 'commerce_sync_completed',
      }),
    );
    expect(result.run.setProgressById['21061']).toEqual(
      expect.objectContaining({
        catalogSetId: '21061',
        importStatus: 'already_present',
        processingState: 'commerce_sync_completed',
      }),
    );

    const persistedState = JSON.parse(
      await readFile(stateFilePath, 'utf8'),
    ) as {
      runsById: Record<string, { requestedSetIds: string[]; status: string }>;
    };
    const persistedRun = Object.values(persistedState.runsById)[0];

    expect(persistedRun).toEqual(
      expect.objectContaining({
        requestedSetIds: ['10316', '21061'],
        status: 'completed',
      }),
    );
  });

  test('starts a run for application code and makes the running state readable before completion', async () => {
    const workspaceRoot = await createTempDirectory();
    const stateFilePath = join(workspaceRoot, 'state', 'bulk.json');
    const generatedSeedGate = createDeferredPromise<{
      candidateCount: number;
      insertedCount: number;
      skippedCount: number;
      supportedMerchantSlugs: readonly string[];
      updatedCount: number;
    }>();
    const catalogSet = createCatalogSet({
      name: 'Rivendell',
      setId: '10316',
      sourceSetNumber: '10316-1',
    });
    const startedRun = await startCatalogBulkOnboardingRun({
      dependencies: {
        createCatalogSetFn: vi.fn().mockResolvedValue(catalogSet),
        generateCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockImplementation(async () => generatedSeedGate.promise),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([]),
        listCommercePrimaryCoverageGapAuditFn: vi.fn().mockResolvedValue(
          createGapAudit({
            rows: [],
          }),
        ),
        listCommercePrimaryCoverageReportFn: vi.fn().mockResolvedValue(
          createCoverageReport({
            rows: [
              {
                primarySeedCount: 4,
                setId: '10316',
                setName: 'Rivendell',
                status: 'full_primary_coverage',
                validPrimaryOfferCount: 4,
              },
            ],
          }),
        ),
        runCommerceSyncFn: vi
          .fn()
          .mockResolvedValue(createSyncSummary(['10316'])),
        searchCatalogMissingSetsFn: vi.fn().mockResolvedValue([
          {
            imageUrl: catalogSet.imageUrl,
            name: catalogSet.name,
            pieces: catalogSet.pieceCount,
            releaseYear: catalogSet.releaseYear,
            setId: catalogSet.setId,
            slug: catalogSet.slug,
            source: 'rebrickable',
            sourceSetNumber: catalogSet.sourceSetNumber,
            theme: catalogSet.primaryTheme,
          },
        ]),
        validateGeneratedCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockResolvedValue({
            invalidCount: 0,
            processedCount: 4,
            skippedCount: 0,
            staleCount: 0,
            validCount: 4,
          }),
      },
      options: {
        setIds: ['10316'],
        stateFilePath,
        workspaceRoot,
      },
    });

    expect(startedRun.alreadyRunning).toBe(false);
    expect(startedRun.run.status).toBe('running');

    const latestRun = await getLatestCatalogBulkOnboardingRun({
      options: {
        stateFilePath,
        workspaceRoot,
      },
    });
    const directRun = await getCatalogBulkOnboardingRun({
      options: {
        stateFilePath,
        workspaceRoot,
      },
      runId: startedRun.runId,
    });

    expect(latestRun.run).toEqual(
      expect.objectContaining({
        runId: startedRun.runId,
        status: 'running',
      }),
    );
    expect(directRun.run).toEqual(
      expect.objectContaining({
        runId: startedRun.runId,
        status: 'running',
      }),
    );

    generatedSeedGate.resolve({
      candidateCount: 4,
      insertedCount: 4,
      skippedCount: 0,
      supportedMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      updatedCount: 0,
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const completedRun = await getCatalogBulkOnboardingRun({
        options: {
          stateFilePath,
          workspaceRoot,
        },
        runId: startedRun.runId,
      });

      if (completedRun.run?.status === 'completed') {
        expect(completedRun.run.setProgressById['10316']).toEqual(
          expect.objectContaining({
            processingState: 'commerce_sync_completed',
          }),
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    throw new Error('Expected the started bulk onboarding run to complete.');
  });

  test('rerunning a completed onboarding reuses persisted progress and skips completed write stages', async () => {
    const workspaceRoot = await createTempDirectory();
    const stateFilePath = join(workspaceRoot, 'state', 'bulk.json');
    const existingCatalogSets = [
      createCatalogSet({
        name: 'Rivendell',
        setId: '10316',
        sourceSetNumber: '10316-1',
      }),
      createCatalogSet({
        name: 'Notre-Dame de Paris',
        setId: '21061',
        sourceSetNumber: '21061-1',
      }),
    ];
    const report = createCoverageReport({
      rows: [
        {
          primarySeedCount: 4,
          setId: '10316',
          setName: 'Rivendell',
          status: 'full_primary_coverage',
          validPrimaryOfferCount: 4,
        },
        {
          primarySeedCount: 4,
          setId: '21061',
          setName: 'Notre-Dame de Paris',
          status: 'full_primary_coverage',
          validPrimaryOfferCount: 4,
        },
      ],
    });
    const gapAudit = createGapAudit({
      rows: [],
    });

    await runCatalogBulkOnboarding({
      dependencies: {
        createCatalogSetFn: vi.fn(),
        generateCommerceOfferSeedCandidatesFn: vi.fn().mockResolvedValue({
          candidateCount: 8,
          insertedCount: 4,
          skippedCount: 4,
          supportedMerchantSlugs: [
            'bol',
            'intertoys',
            'lego-nl',
            'misterbricks',
          ],
          updatedCount: 0,
        }),
        listCanonicalCatalogSetsFn: vi
          .fn()
          .mockResolvedValue(existingCatalogSets),
        listCommercePrimaryCoverageGapAuditFn: vi
          .fn()
          .mockResolvedValue(gapAudit),
        listCommercePrimaryCoverageReportFn: vi.fn().mockResolvedValue(report),
        runCommerceSyncFn: vi
          .fn()
          .mockResolvedValue(createSyncSummary(['10316', '21061'])),
        searchCatalogMissingSetsFn: vi.fn().mockResolvedValue([]),
        validateGeneratedCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockResolvedValue({
            invalidCount: 0,
            processedCount: 4,
            skippedCount: 0,
            staleCount: 0,
            validCount: 4,
          }),
      },
      options: {
        setIds: ['10316', '21061'],
        stateFilePath,
        workspaceRoot,
      },
    });

    const generateCommerceOfferSeedCandidatesFn = vi.fn();
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi.fn();
    const runCommerceSyncFn = vi.fn();
    const listCommercePrimaryCoverageReportFn = vi
      .fn()
      .mockResolvedValue(report);
    const listCommercePrimaryCoverageGapAuditFn = vi
      .fn()
      .mockResolvedValue(gapAudit);

    const result = await runCatalogBulkOnboarding({
      dependencies: {
        createCatalogSetFn: vi.fn(),
        generateCommerceOfferSeedCandidatesFn,
        listCanonicalCatalogSetsFn: vi
          .fn()
          .mockResolvedValue(existingCatalogSets),
        listCommercePrimaryCoverageGapAuditFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        searchCatalogMissingSetsFn: vi.fn().mockResolvedValue([]),
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        setIds: ['10316', '21061'],
        stateFilePath,
        workspaceRoot,
      },
    });

    expect(result.stageExecutions.import.executed).toBe(false);
    expect(result.stageExecutions.generate.executed).toBe(false);
    expect(result.stageExecutions.validate.executed).toBe(false);
    expect(result.stageExecutions.sync.executed).toBe(false);
    expect(result.stageExecutions.snapshot.executed).toBe(true);
    expect(generateCommerceOfferSeedCandidatesFn).not.toHaveBeenCalled();
    expect(
      validateGeneratedCommerceOfferSeedCandidatesFn,
    ).not.toHaveBeenCalled();
    expect(runCommerceSyncFn).not.toHaveBeenCalled();
    expect(listCommercePrimaryCoverageReportFn).toHaveBeenCalledTimes(1);
    expect(listCommercePrimaryCoverageGapAuditFn).toHaveBeenCalledTimes(1);
  });

  test('retries failed imports and reruns downstream stages when new ready sets appear on resume', async () => {
    const workspaceRoot = await createTempDirectory();
    const stateFilePath = join(workspaceRoot, 'state', 'bulk.json');
    const createdFirstCatalogSet = createCatalogSet({
      name: 'Rivendell',
      setId: '10316',
      sourceSetNumber: '10316-1',
    });
    const createdSecondCatalogSet = createCatalogSet({
      name: 'The Burrow – Collectors’ Edition',
      setId: '76437',
      sourceSetNumber: '76437-1',
    });

    await runCatalogBulkOnboarding({
      dependencies: {
        createCatalogSetFn: vi.fn().mockResolvedValue(createdFirstCatalogSet),
        generateCommerceOfferSeedCandidatesFn: vi.fn().mockResolvedValue({
          candidateCount: 4,
          insertedCount: 2,
          skippedCount: 2,
          supportedMerchantSlugs: [
            'bol',
            'intertoys',
            'lego-nl',
            'misterbricks',
          ],
          updatedCount: 0,
        }),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([]),
        listCommercePrimaryCoverageGapAuditFn: vi.fn().mockResolvedValue(
          createGapAudit({
            rows: [
              {
                gapType: 'missing_seed',
                merchantSlug: 'intertoys',
                recoveryPriority: 'recover_now',
                setId: '10316',
                setName: 'Rivendell',
              },
            ],
          }),
        ),
        listCommercePrimaryCoverageReportFn: vi.fn().mockResolvedValue(
          createCoverageReport({
            rows: [
              {
                missingValidPrimaryOfferMerchantSlugs: ['intertoys'],
                primarySeedCount: 3,
                setId: '10316',
                setName: 'Rivendell',
                status: 'partial_primary_coverage',
                validPrimaryOfferCount: 3,
              },
            ],
          }),
        ),
        runCommerceSyncFn: vi
          .fn()
          .mockResolvedValue(createSyncSummary(['10316'])),
        searchCatalogMissingSetsFn: vi
          .fn()
          .mockImplementation(async ({ query }: { query: string }) =>
            query === '10316-1'
              ? [
                  {
                    imageUrl: createdFirstCatalogSet.imageUrl,
                    name: createdFirstCatalogSet.name,
                    pieces: createdFirstCatalogSet.pieceCount,
                    releaseYear: createdFirstCatalogSet.releaseYear,
                    setId: createdFirstCatalogSet.setId,
                    slug: createdFirstCatalogSet.slug,
                    source: 'rebrickable',
                    sourceSetNumber: createdFirstCatalogSet.sourceSetNumber,
                    theme: createdFirstCatalogSet.primaryTheme,
                  },
                ]
              : [],
          ),
        validateGeneratedCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockResolvedValue({
            invalidCount: 0,
            processedCount: 2,
            skippedCount: 0,
            staleCount: 0,
            validCount: 2,
          }),
      },
      options: {
        setIds: ['10316', '76437'],
        stateFilePath,
        workspaceRoot,
      },
    });

    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 8,
      insertedCount: 4,
      skippedCount: 4,
      supportedMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        invalidCount: 0,
        processedCount: 4,
        skippedCount: 0,
        staleCount: 0,
        validCount: 4,
      });
    const runCommerceSyncFn = vi
      .fn()
      .mockResolvedValue(createSyncSummary(['10316', '76437']));

    const result = await runCatalogBulkOnboarding({
      dependencies: {
        createCatalogSetFn: vi.fn().mockResolvedValue(createdSecondCatalogSet),
        generateCommerceOfferSeedCandidatesFn,
        listCanonicalCatalogSetsFn: vi
          .fn()
          .mockResolvedValue([createdFirstCatalogSet]),
        listCommercePrimaryCoverageGapAuditFn: vi.fn().mockResolvedValue(
          createGapAudit({
            rows: [],
          }),
        ),
        listCommercePrimaryCoverageReportFn: vi.fn().mockResolvedValue(
          createCoverageReport({
            rows: [
              {
                primarySeedCount: 4,
                setId: '10316',
                setName: 'Rivendell',
                status: 'full_primary_coverage',
                validPrimaryOfferCount: 4,
              },
              {
                primarySeedCount: 4,
                setId: '76437',
                setName: 'The Burrow – Collectors’ Edition',
                status: 'full_primary_coverage',
                validPrimaryOfferCount: 4,
              },
            ],
          }),
        ),
        runCommerceSyncFn,
        searchCatalogMissingSetsFn: vi
          .fn()
          .mockImplementation(async ({ query }: { query: string }) =>
            query === '76437-1'
              ? [
                  {
                    imageUrl: createdSecondCatalogSet.imageUrl,
                    name: createdSecondCatalogSet.name,
                    pieces: createdSecondCatalogSet.pieceCount,
                    releaseYear: createdSecondCatalogSet.releaseYear,
                    setId: createdSecondCatalogSet.setId,
                    slug: createdSecondCatalogSet.slug,
                    source: 'rebrickable',
                    sourceSetNumber: createdSecondCatalogSet.sourceSetNumber,
                    theme: createdSecondCatalogSet.primaryTheme,
                  },
                ]
              : [],
          ),
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        setIds: ['10316', '76437'],
        stateFilePath,
        workspaceRoot,
      },
    });

    expect(result.run.status).toBe('completed');
    expect(result.run.setProgressById['76437']).toEqual(
      expect.objectContaining({
        importStatus: 'created',
        processingState: 'commerce_sync_completed',
      }),
    );
    expect(generateCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith({
      filters: {
        setIds: ['10316', '76437'],
      },
      write: true,
    });
    expect(validateGeneratedCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith(
      {
        filters: {
          recheckGenerated: true,
          setIds: ['10316', '76437'],
        },
        write: true,
      },
    );
    expect(runCommerceSyncFn).toHaveBeenCalledWith({
      mode: 'write',
      setIds: ['10316', '76437'],
      workspaceRoot,
    });
  });
});
