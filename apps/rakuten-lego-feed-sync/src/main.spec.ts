import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const rakutenCliMocks = vi.hoisted(() => ({
  discoverRakutenLegoMissingSets: vi.fn(),
  logScheduledJobFailure: vi.fn(({ error }: { error: unknown }) => ({
    recoverable: false,
    error,
  })),
}));

vi.mock('@lego-platform/api/data-access-server', () => ({
  auditRakutenLegoFeed: vi.fn(),
  auditRakutenLegoFeedDiscovery: vi.fn(),
  discoverRakutenLegoMissingSets:
    rakutenCliMocks.discoverRakutenLegoMissingSets,
  listRakutenLegoFeedFiles: vi.fn(),
  logScheduledJobFailure: rakutenCliMocks.logScheduledJobFailure,
  revalidatePublicCatalogPriceChanges: vi.fn(),
  syncRakutenLegoFeed: vi.fn(),
}));

vi.mock('@lego-platform/shared/config', () => ({
  getMissingRakutenLegoEnvKeys: () => [],
  getMissingServerSupabaseEnvKeys: () => [],
  hasRakutenLegoFeedConfig: () => true,
  hasServerSupabaseConfig: () => true,
}));

describe('Rakuten LEGO feed sync CLI', () => {
  let temporaryDirectory: string | undefined;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    rakutenCliMocks.discoverRakutenLegoMissingSets.mockResolvedValue({
      candidateCount: 1,
      catalogSetCount: 1,
      feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
      fetchedProductCount: 2,
      missingCandidates: [
        {
          availability: 'In stock',
          confidence: 'strict_rakuten_lego_candidate',
          currency: 'EUR',
          feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
          price: '129.99',
          productTitle: 'LEGO Icons 99999 Missing Castle',
          productUrl:
            'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Fmissing-castle-99999',
          reason: 'missing_from_catalog_sets',
          setNumber: '99999',
          source: 'rakuten-lego-eu',
        },
      ],
      parseFailureCount: 0,
      enrichmentEnabled: false,
      enrichmentLookupCount: 0,
      enrichmentSkippedExistingCount: 0,
      existingCandidateHitCount: 0,
      existingCatalogMatchCount: 0,
      feedProductsScanned: 2,
      persistedDiscoveredSetCount: 0,
      persistedDiscoveryCandidateCount: 1,
      rebrickable429Count: 0,
      source: 'rakuten-lego-eu',
      uniqueCandidateSetNumberCount: 1,
      uniqueMissingSetCount: 1,
    });
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();

    if (temporaryDirectory) {
      await rm(temporaryDirectory, {
        force: true,
        recursive: true,
      });
      temporaryDirectory = undefined;
    }
  });

  test('parses missing-set discovery flags as read-only by default', async () => {
    const { parseRakutenLegoFeedSyncCliOptions } = await import('./main');

    expect(
      parseRakutenLegoFeedSyncCliOptions([
        '--discover-missing-sets',
        '--debug-unmatched-samples',
        '25',
        '--report-missing-sets-path',
        'tmp/rakuten-lego-missing-sets.json',
      ]),
    ).toMatchObject({
      autoCreateHighConfidenceCatalogSets: false,
      debugUnmatchedSamples: 25,
      discoverMissingSets: true,
      enrichMissingSets: false,
      persistCatalogDiscoveryCandidates: true,
      persistDiscoveredSets: false,
      reportMissingSetsPath: 'tmp/rakuten-lego-missing-sets.json',
    });
  });

  test('passes explicit persistence through only for discovery mode', async () => {
    const { parseRakutenLegoFeedSyncCliOptions } = await import('./main');

    expect(
      parseRakutenLegoFeedSyncCliOptions([
        '--discover-missing-sets',
        '--persist-discovered-sets',
      ]),
    ).toMatchObject({
      discoverMissingSets: true,
      persistDiscoveredSets: true,
    });
    expect(
      parseRakutenLegoFeedSyncCliOptions(['--persist-discovered-sets']),
    ).toMatchObject({
      discoverMissingSets: false,
      persistDiscoveredSets: false,
    });
  });

  test('writes missing-set discovery report JSON', async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'rakuten-lego-discovery-'),
    );
    const reportPath = join(temporaryDirectory, 'missing-sets.json');
    const { main } = await import('./main');

    await main([
      '--discover-missing-sets',
      '--debug-unmatched-samples',
      '10',
      '--report-missing-sets-path',
      reportPath,
    ]);

    expect(rakutenCliMocks.discoverRakutenLegoMissingSets).toHaveBeenCalledWith(
      {
        options: {
          autoCreateHighConfidenceCatalogSets: false,
          enrichMissingSets: false,
          maxProducts: undefined,
          maxEnrichmentLookups: undefined,
          onlyNewCandidates: false,
          persistCatalogDiscoveryCandidates: true,
          persistDiscoveredSets: false,
          sampleLimit: 10,
          setIds: undefined,
          skipExistingCandidates: false,
        },
      },
    );
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
      report: {
        missingCandidates: readonly { setNumber: string }[];
      };
    };

    expect(report.report.missingCandidates).toEqual([
      expect.objectContaining({
        setNumber: '99999',
      }),
    ]);
  });

  test('passes explicit discovered-set persistence to discovery runner', async () => {
    const { main } = await import('./main');

    await main(['--discover-missing-sets', '--persist-discovered-sets']);

    expect(rakutenCliMocks.discoverRakutenLegoMissingSets).toHaveBeenCalledWith(
      {
        options: {
          autoCreateHighConfidenceCatalogSets: false,
          enrichMissingSets: false,
          maxProducts: undefined,
          maxEnrichmentLookups: undefined,
          onlyNewCandidates: false,
          persistCatalogDiscoveryCandidates: true,
          persistDiscoveredSets: true,
          sampleLimit: undefined,
          setIds: undefined,
          skipExistingCandidates: false,
        },
      },
    );
  });

  test('keeps catalog set auto-create explicit for discovery mode', async () => {
    const { parseRakutenLegoFeedSyncCliOptions } = await import('./main');

    expect(
      parseRakutenLegoFeedSyncCliOptions([
        '--discover-missing-sets',
        '--auto-create-high-confidence-catalog-sets',
      ]),
    ).toMatchObject({
      autoCreateHighConfidenceCatalogSets: true,
      enrichMissingSets: true,
      persistCatalogDiscoveryCandidates: true,
    });
    expect(
      parseRakutenLegoFeedSyncCliOptions([
        '--discover-missing-sets',
        '--skip-catalog-discovery-candidates',
      ]),
    ).toMatchObject({
      autoCreateHighConfidenceCatalogSets: false,
      persistCatalogDiscoveryCandidates: false,
    });
  });

  test('parses targeted enrichment flags for urgent launch flows', async () => {
    const { parseRakutenLegoFeedSyncCliOptions } = await import('./main');

    expect(
      parseRakutenLegoFeedSyncCliOptions([
        '--discover-missing-sets',
        '--set-ids',
        '72155,72156,72157',
        '--enrich-missing-sets',
        '--max-enrichment-lookups',
        '20',
        '--skip-existing-candidates',
        '--only-new-candidates',
      ]),
    ).toMatchObject({
      discoverMissingSets: true,
      enrichMissingSets: true,
      maxEnrichmentLookups: 20,
      onlyNewCandidates: true,
      setIds: ['72155', '72156', '72157'],
      skipExistingCandidates: true,
    });
  });
});
