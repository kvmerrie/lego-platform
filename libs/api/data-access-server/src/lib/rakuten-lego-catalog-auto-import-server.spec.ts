import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CatalogDiscoveryCandidate } from '@lego-platform/catalog/data-access-server';
import type { CatalogSet } from '@lego-platform/catalog/util';
import {
  autoImportRakutenLegoCatalog,
  type RakutenLegoCatalogAutoImportDependencies,
} from './rakuten-lego-catalog-auto-import-server';
import type { RakutenLegoMissingSetDiscoveryReport } from './rakuten-lego-feed-sync-server';
import type {
  CatalogImportPipelineResult,
  ReEnrichCatalogSetsMissingResult,
} from './catalog-import-enrichment-server';
import type {
  CatalogPromotionPreviewResult,
  CatalogPromotionResult,
} from './catalog-promotion-server';

function createCandidate(
  overrides: Partial<CatalogDiscoveryCandidate> = {},
): CatalogDiscoveryCandidate {
  return {
    autoCreateEligible: false,
    confidence: 'low',
    confidenceScore: 70,
    evidence: {
      operatorConfidence: 'low',
      operatorConfidenceReasons: ['trusted_feed_valid_set_number'],
    },
    firstSeenAt: '2026-06-05T08:00:00.000Z',
    id: 'candidate-40519',
    lastSeenAt: '2026-06-05T08:00:00.000Z',
    normalizedSetId: '40519',
    operatorConfidence: 'low',
    operatorConfidenceReasons: ['trusted_feed_valid_set_number'],
    requiredFieldsPresent: false,
    source: 'rakuten-lego-eu',
    sourcePayload: {},
    sourceProductTitle: 'Ansichtkaart van New York',
    sourceProductUrl:
      'https://www.lego.com/nl-nl/product/new-york-postcard-40519',
    sourceSetNumber: '40519-1',
    status: 'new',
    ...overrides,
  };
}

function createCatalogSet(overrides: Partial<CatalogSet> = {}): CatalogSet {
  return {
    createdAt: '2026-06-05T08:00:00.000Z',
    imageUrl: 'https://images.example.test/40519.jpg',
    name: 'New York Postcard',
    pieces: 253,
    releaseYear: 2022,
    setId: '40519',
    slug: 'new-york-postcard-40519',
    source: 'rebrickable',
    sourceSetNumber: '40519-1',
    status: 'active',
    theme: 'Other',
    updatedAt: '2026-06-05T08:00:00.000Z',
    ...overrides,
  };
}

function createDiscoveryReport(
  overrides: Partial<RakutenLegoMissingSetDiscoveryReport> = {},
): RakutenLegoMissingSetDiscoveryReport {
  return {
    candidateCount: 1,
    catalogSetCount: 1000,
    enrichmentEnabled: false,
    enrichmentLookupCount: 0,
    enrichmentSkippedExistingCount: 0,
    existingCandidateHitCount: 0,
    existingCatalogMatchCount: 0,
    feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
    fetchedProductCount: 5,
    feedProductsScanned: 5,
    missingCandidates: [],
    parseFailureCount: 0,
    persistedDiscoveredSetCount: 0,
    persistedDiscoveryCandidateCount: 1,
    rebrickable429Count: 0,
    source: 'rakuten-lego-eu',
    uniqueCandidateSetNumberCount: 1,
    uniqueMissingSetCount: 1,
    ...overrides,
  };
}

function createImportResult(
  overrides: Partial<CatalogImportPipelineResult> = {},
): CatalogImportPipelineResult {
  return {
    bricksetStatus: 'success',
    durationMs: 100,
    enrichmentStatus: 'complete',
    importedSetId: '40519',
    importedSlug: 'new-york-postcard-40519',
    minifigStatus: 'success',
    stages: {
      brickset: { status: 'success' },
      minifig: { status: 'success' },
      theme: { status: 'success' },
    },
    themeStatus: 'success',
    warnings: [],
    ...overrides,
  };
}

function createMissingAudit(
  overrides: Partial<ReEnrichCatalogSetsMissingResult> = {},
): ReEnrichCatalogSetsMissingResult {
  return {
    dryRun: false,
    failedCount: 0,
    results: [],
    selectedCount: 0,
    selection: {
      consideredCount: 1,
      reasonsBySetId: {},
      selectedCount: 0,
      setIds: [],
      skippedCount: 1,
    },
    setIds: [],
    skippedCount: 1,
    successCount: 0,
    warningCount: 0,
    warnings: [],
    ...overrides,
  };
}

function createPreview(
  overrides: Partial<CatalogPromotionPreviewResult> = {},
): CatalogPromotionPreviewResult {
  return {
    excludedTables: [
      'commerce_merchants',
      'commerce_benchmark_sets',
      'commerce_offer_seeds',
    ],
    generatedAt: '2026-06-05T08:00:00.000Z',
    meaningfulPendingPromoteCount: 1,
    operatorSummary: {
      mappings: {
        insertedCount: 0,
        readCount: 0,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 0,
      },
      sets: {
        insertedCount: 1,
        readCount: 1,
        skipped: false,
        strategy: 'sample_diff',
        updatedCount: 0,
      },
      sourceMetadata: {
        insertedCount: 1,
        readCount: 1,
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
    pendingPromoteCount: 2,
    samples: [],
    skippedHeavyTables: ['collection_page_snapshots'],
    sourceEnvironment: 'staging',
    status: 'ok',
    tables: {},
    targetEnvironment: 'production',
    ...overrides,
  };
}

function createPromotionResult(
  overrides: Partial<CatalogPromotionResult> = {},
): CatalogPromotionResult {
  return {
    changedThemeSlugs: ['other'],
    collectionPageSnapshotsBySlug: {},
    collectionPageSnapshotsReadCount: 0,
    collectionPageSnapshotsUpsertedCount: 0,
    durationMs: 100,
    excludedTables: [
      'commerce_merchants',
      'commerce_benchmark_sets',
      'commerce_offer_seeds',
    ],
    promotedMetadataSetIds: ['40519'],
    promotedMetadataSetSlugs: ['new-york-postcard-40519'],
    skippedSourceMetadataCount: 0,
    startedAt: '2026-06-05T08:00:00.000Z',
    status: 'ok',
    tables: {
      catalog_set_minifig_summaries: {
        insertedCount: 1,
        readCount: 1,
        upsertedCount: 1,
        updatedCount: 0,
      },
      catalog_set_source_metadata: {
        insertedCount: 1,
        readCount: 1,
        upsertedCount: 1,
        updatedCount: 0,
      },
      catalog_sets: {
        insertedCount: 1,
        readCount: 1,
        upsertedCount: 1,
        updatedCount: 0,
      },
      catalog_source_themes: {
        insertedCount: 0,
        readCount: 0,
        upsertedCount: 0,
        updatedCount: 0,
      },
      catalog_theme_mappings: {
        insertedCount: 0,
        readCount: 0,
        upsertedCount: 0,
        updatedCount: 0,
      },
      catalog_themes: {
        insertedCount: 0,
        readCount: 0,
        upsertedCount: 0,
        updatedCount: 0,
      },
      collection_page_snapshots: {
        insertedCount: 0,
        readCount: 0,
        upsertedCount: 0,
        updatedCount: 0,
      },
    },
    ...overrides,
  };
}

function createDependencies({
  candidates = [createCandidate()],
  createCatalogSetError,
}: {
  candidates?: readonly CatalogDiscoveryCandidate[];
  createCatalogSetError?: Error;
} = {}): Required<RakutenLegoCatalogAutoImportDependencies> {
  return {
    createCatalogSetFromDiscoveryCandidateFn: vi.fn(async () => {
      if (createCatalogSetError) {
        throw createCatalogSetError;
      }

      return {
        catalogSet: createCatalogSet(),
        metadataIncomplete: false,
      };
    }),
    discoverRakutenLegoMissingSetsFn: vi.fn(async () =>
      createDiscoveryReport(),
    ),
    enrichImportedCatalogSetFn: vi.fn(async () => createImportResult()),
    getLocalRebrickableSetMirrorMetadataFn: vi.fn(async () => ({
      catalogSetInput: {
        imageUrl: 'https://images.example.test/40519.jpg',
        name: 'New York Postcard',
        pieces: 253,
        releaseYear: 2022,
        setId: '40519',
        slug: 'new-york-postcard-40519',
        source: 'rebrickable',
        sourceSetNumber: '40519-1',
        theme: 'Other',
      },
      name: 'New York Postcard',
      setNum: '40519-1',
      themeId: 999,
      themeName: 'Other',
    })),
    listCanonicalCatalogSetsFn: vi.fn(async () => []),
    listCatalogDiscoveryCandidatesFn: vi.fn(async () => candidates),
    now: vi.fn(() => new Date('2026-06-05T08:00:00.000Z')),
    previewCatalogPromotionFromStagingToProductionFn: vi.fn(async () =>
      createPreview(),
    ),
    promoteCatalogFromStagingToProductionFn: vi.fn(async () =>
      createPromotionResult(),
    ),
    reEnrichCatalogSetsMissingFn: vi.fn(async () => createMissingAudit()),
    recomputeCatalogDiscoveryCandidateConfidenceFn: vi.fn(async () => ({
      highCount: 0,
      lowCount: 1,
      mediumCount: 0,
      modifiedCount: 1,
      processedCount: 1,
      skippedCount: 0,
    })),
    revalidatePublicWebFn: vi.fn(async ({ paths, tags }) => ({
      attempted: true,
      pathCount: paths.length,
      paths,
      skipped: false,
      tagCount: tags.length,
      tags,
    })),
    syncLocalRebrickableMirrorFn: vi.fn(async () => ({
      dryRun: false,
      durationMs: 1,
    })),
    updateCatalogDiscoveryCandidateReviewStatusFn: vi.fn(async () =>
      createCandidate({ status: 'imported' }),
    ),
    writeReportFn: vi.fn(async () => undefined),
  };
}

describe('Rakuten LEGO catalog auto import', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['APP_ENV'] = 'staging';
    process.env['SUPABASE_URL_STAGING'] = 'https://staging.supabase.test';
    process.env['SUPABASE_SERVICE_ROLE_KEY_STAGING'] = 'staging-key';
    process.env['SUPABASE_URL_PRODUCTION'] = 'https://production.supabase.test';
    process.env['SUPABASE_SERVICE_ROLE_KEY_PRODUCTION'] = 'production-key';
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  test('dry-run imports nothing and does not recompute or promote', async () => {
    const dependencies = createDependencies();

    const report = await autoImportRakutenLegoCatalog({
      dependencies,
      options: {
        dryRun: true,
        limit: 1,
      },
    });

    expect(report.candidatesImported).toHaveLength(0);
    expect(report.candidatesSkipped[0]?.reason).toBe('dry_run_would_import');
    expect(
      dependencies.createCatalogSetFromDiscoveryCandidateFn,
    ).not.toHaveBeenCalled();
    expect(
      dependencies.recomputeCatalogDiscoveryCandidateConfidenceFn,
    ).not.toHaveBeenCalled();
    expect(
      dependencies.promoteCatalogFromStagingToProductionFn,
    ).not.toHaveBeenCalled();
  });

  test('imports a new Rakuten candidate and allows accessories by default', async () => {
    const dependencies = createDependencies({
      candidates: [
        createCandidate({
          normalizedSetId: '854261',
          operatorConfidenceReasons: ['likely_accessory'],
          sourceProductTitle: 'Imperium zwaard',
          sourceSetNumber: '854261-1',
        }),
      ],
    });

    const report = await autoImportRakutenLegoCatalog({
      dependencies,
      options: {
        limit: 1,
      },
    });

    expect(report.candidatesImported).toHaveLength(1);
    expect(report.candidatesImported[0]).toMatchObject({
      reason: 'imported',
      setId: '854261',
    });
    expect(dependencies.enrichImportedCatalogSetFn).toHaveBeenCalledTimes(1);
    expect(dependencies.reEnrichCatalogSetsMissingFn).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        setIds: ['40519'],
      }),
    );
  });

  test('does not enable live Rebrickable enrichment during discovery', async () => {
    const dependencies = createDependencies();

    await autoImportRakutenLegoCatalog({
      dependencies,
      options: {
        limit: 5,
      },
    });

    expect(dependencies.discoverRakutenLegoMissingSetsFn).toHaveBeenCalledWith({
      options: expect.objectContaining({
        enrichMissingSets: false,
        maxEnrichmentLookups: 0,
      }),
    });
  });

  test('one import failure prevents auto-promote', async () => {
    const dependencies = createDependencies({
      createCatalogSetError: new Error('create failed'),
    });

    await expect(
      autoImportRakutenLegoCatalog({
        dependencies,
        options: {
          autoPromote: true,
          limit: 1,
        },
      }),
    ).rejects.toThrow(
      'Auto-promote blocked because one or more imports failed.',
    );

    expect(
      dependencies.promoteCatalogFromStagingToProductionFn,
    ).not.toHaveBeenCalled();
  });

  test('auto-promote uses catalog-only scope and reports revalidation', async () => {
    const dependencies = createDependencies();

    const report = await autoImportRakutenLegoCatalog({
      dependencies,
      options: {
        autoPromote: true,
        limit: 1,
        reportPath: 'tmp/report.json',
      },
    });

    expect(
      dependencies.previewCatalogPromotionFromStagingToProductionFn,
    ).toHaveBeenCalledWith({
      includeCommerceSeeds: false,
      includeHeavy: false,
    });
    expect(
      dependencies.promoteCatalogFromStagingToProductionFn,
    ).toHaveBeenCalledWith({
      includeCommerceSeeds: false,
    });
    expect(report.promoted).toBe(true);
    expect(report.promotePreview?.excludedTables).toEqual(
      expect.arrayContaining([
        'commerce_merchants',
        'commerce_benchmark_sets',
        'commerce_offer_seeds',
      ]),
    );
    expect(report.promoteResult?.revalidation?.paths).toEqual(
      expect.arrayContaining([
        '/',
        '/themes',
        '/themes/other',
        '/sets/new-york-postcard-40519',
      ]),
    );
    expect(dependencies.writeReportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'before_promote',
      }),
    );
    expect(dependencies.writeReportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'final',
      }),
    );
  });
});
