import { describe, expect, test, vi } from 'vitest';
import {
  runCatalogMinifigSync,
  summarizeRebrickableSetMinifigPayloads,
  type CatalogSetMinifigSummary,
} from './catalog-minifig-data-access-server';

const catalogSets = [
  {
    setId: '10316',
    slug: 'the-lord-of-the-rings-rivendell-10316',
    sourceSetNumber: '10316-1',
  },
  {
    setId: '21326',
    slug: 'winnie-the-pooh-21326',
    sourceSetNumber: '21326-1',
  },
];
const extendedCatalogSets = [
  ...catalogSets,
  {
    setId: '75355',
    slug: 'x-wing-starfighter-75355',
    sourceSetNumber: '75355-1',
  },
  {
    setId: '76419',
    slug: 'hogwarts-castle-and-grounds-76419',
    sourceSetNumber: '76419-1',
  },
];

function toExistingSummary(
  summaries: readonly CatalogSetMinifigSummary[],
): Map<string, CatalogSetMinifigSummary> {
  return new Map(summaries.map((summary) => [summary.setId, summary]));
}

describe('catalog minifig enrichment sync', () => {
  test('calculates total minifigure quantity from Rebrickable payloads', () => {
    expect(
      summarizeRebrickableSetMinifigPayloads([
        {
          count: 2,
          results: [
            {
              quantity: 1,
              set_num: 'fig-000001',
            },
            {
              quantity: 2,
              set_num: 'fig-000002',
            },
          ],
        },
      ]),
    ).toEqual({
      minifigCount: 3,
      sourceMinifigCount: 2,
    });
  });

  test('writes zero-minifigure summaries without treating them as failures', async () => {
    const upsertCatalogSetMinifigSummariesFn = vi.fn(
      async (rows) => rows.length,
    );

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => ({
        minifigCount: 0,
        sourceMinifigCount: 0,
      }),
      listCatalogSetsForMinifigSyncFn: async () => [catalogSets[0]],
      loadExistingMinifigSummariesFn: async () => toExistingSummary([]),
      mode: 'write',
      nowImpl: () => new Date('2026-05-14T10:00:00.000Z'),
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result).toMatchObject({
      failedSets: 0,
      summariesUpserted: 1,
      zeroMinifigSets: 1,
    });
    expect(upsertCatalogSetMinifigSummariesFn).toHaveBeenCalledWith([
      expect.objectContaining({
        minifig_count: 0,
        set_id: '10316',
        source_minifig_count: 0,
      }),
    ]);
  });

  test('does not erase existing summaries when the Rebrickable request fails', async () => {
    const upsertCatalogSetMinifigSummariesFn = vi.fn(
      async (rows) => rows.length,
    );

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => {
        throw new Error('Rebrickable request failed (500).');
      },
      listCatalogSetsForMinifigSyncFn: async () => [catalogSets[0]],
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 15,
            setId: '10316',
            sourceMinifigCount: 15,
          },
        ]),
      mode: 'write',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result).toMatchObject({
      failedSetIds: ['10316'],
      failedSets: 1,
      summariesUpserted: 0,
    });
    expect(upsertCatalogSetMinifigSummariesFn).not.toHaveBeenCalled();
  });

  test('check mode reports drift without writing', async () => {
    const upsertCatalogSetMinifigSummariesFn = vi.fn(
      async (rows) => rows.length,
    );

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => ({
        minifigCount: 15,
        sourceMinifigCount: 15,
      }),
      listCatalogSetsForMinifigSyncFn: async () => [catalogSets[0]],
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 14,
            setId: '10316',
            sourceMinifigCount: 14,
          },
        ]),
      mode: 'check',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result).toMatchObject({
      driftCount: 1,
      summariesUpserted: 0,
    });
    expect(upsertCatalogSetMinifigSummariesFn).not.toHaveBeenCalled();
  });

  test('write mode is idempotent when summaries already match', async () => {
    const upsertCatalogSetMinifigSummariesFn = vi.fn(
      async (rows) => rows.length,
    );

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => ({
        minifigCount: 15,
        sourceMinifigCount: 15,
      }),
      listCatalogSetsForMinifigSyncFn: async () => [catalogSets[0]],
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 15,
            setId: '10316',
            sourceMinifigCount: 15,
          },
        ]),
      mode: 'write',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result).toMatchObject({
      driftCount: 0,
      summariesUpserted: 0,
    });
    expect(upsertCatalogSetMinifigSummariesFn).not.toHaveBeenCalled();
  });

  test('tracks changed set ids and slugs for targeted revalidation', async () => {
    const upsertCatalogSetMinifigSummariesFn = vi.fn(
      async (rows) => rows.length,
    );

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async (sourceSetNumber) => ({
        minifigCount: sourceSetNumber === '10316-1' ? 15 : 5,
        sourceMinifigCount: sourceSetNumber === '10316-1' ? 15 : 5,
      }),
      listCatalogSetsForMinifigSyncFn: async () => catalogSets,
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 5,
            setId: '21326',
            sourceMinifigCount: 5,
          },
        ]),
      mode: 'write',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result.changedSetIds).toEqual(['10316']);
    expect(result.changedSetSlugs).toEqual([
      'the-lord-of-the-rings-rivendell-10316',
    ]);
  });

  test('limit processes only the requested number of sets and reports a cursor', async () => {
    const fetchedSetNumbers: string[] = [];

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async (sourceSetNumber) => {
        fetchedSetNumbers.push(sourceSetNumber);

        return {
          minifigCount: 1,
          sourceMinifigCount: 1,
        };
      },
      limit: 2,
      listCatalogSetsForMinifigSyncFn: async () => extendedCatalogSets,
      loadExistingMinifigSummariesFn: async () => toExistingSummary([]),
      mode: 'check',
      requestDelayMs: 0,
    });

    expect(fetchedSetNumbers).toEqual(['10316-1', '21326-1']);
    expect(result).toMatchObject({
      isPartial: true,
      lastProcessedSetId: '21326',
      nextAfterSetId: '21326',
      processedSets: 2,
      selectedSetCount: 2,
    });
  });

  test('after-set-id resumes after the cursor', async () => {
    const fetchedSetNumbers: string[] = [];

    const result = await runCatalogMinifigSync({
      afterSetId: '21326',
      fetchRebrickableSetMinifigSummaryFn: async (sourceSetNumber) => {
        fetchedSetNumbers.push(sourceSetNumber);

        return {
          minifigCount: 1,
          sourceMinifigCount: 1,
        };
      },
      limit: 1,
      listCatalogSetsForMinifigSyncFn: async () => extendedCatalogSets,
      loadExistingMinifigSummariesFn: async () => toExistingSummary([]),
      mode: 'check',
      requestDelayMs: 0,
    });

    expect(fetchedSetNumbers).toEqual(['75355-1']);
    expect(result).toMatchObject({
      lastProcessedSetId: '75355',
      nextAfterSetId: '75355',
      processedSets: 1,
    });
  });

  test('only-missing skips sets with existing summaries before applying limit', async () => {
    const fetchedSetNumbers: string[] = [];

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async (sourceSetNumber) => {
        fetchedSetNumbers.push(sourceSetNumber);

        return {
          minifigCount: 1,
          sourceMinifigCount: 1,
        };
      },
      limit: 2,
      listCatalogSetsForMinifigSyncFn: async () => extendedCatalogSets,
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 15,
            setId: '10316',
            sourceMinifigCount: 15,
          },
        ]),
      mode: 'write',
      onlyMissing: true,
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn: async (rows) => rows.length,
    });

    expect(fetchedSetNumbers).toEqual(['21326-1', '75355-1']);
    expect(result.processedSets).toBe(2);
    expect(result.nextAfterSetId).toBe('75355');
  });

  test('set-id selection fetches only explicit sets without a resume cursor', async () => {
    const fetchedSetNumbers: string[] = [];

    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async (sourceSetNumber) => {
        fetchedSetNumbers.push(sourceSetNumber);

        return {
          minifigCount: 1,
          sourceMinifigCount: 1,
        };
      },
      listCatalogSetsForMinifigSyncFn: async () => extendedCatalogSets,
      loadExistingMinifigSummariesFn: async () => toExistingSummary([]),
      mode: 'check',
      requestDelayMs: 0,
      selectedSetIds: ['76419', '10316'],
    });

    expect(fetchedSetNumbers).toEqual(['10316-1', '76419-1']);
    expect(result.nextAfterSetId).toBeUndefined();
  });

  test('rate-limit failures are counted without erasing existing summaries', async () => {
    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => {
        throw new Error(
          'Rebrickable request failed (429) for /lego/sets/10316-1/minifigs/ after 5 attempts.',
        );
      },
      listCatalogSetsForMinifigSyncFn: async () => [catalogSets[0]],
      loadExistingMinifigSummariesFn: async () =>
        toExistingSummary([
          {
            minifigCount: 15,
            setId: '10316',
            sourceMinifigCount: 15,
          },
        ]),
      mode: 'write',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn: async (rows) => rows.length,
    });

    expect(result).toMatchObject({
      failedSetIds: ['10316'],
      failedSets: 1,
      rateLimitCount: 1,
      summariesUpserted: 0,
    });
  });

  test('write mode outputs next cursor for resumable backfills', async () => {
    const result = await runCatalogMinifigSync({
      fetchRebrickableSetMinifigSummaryFn: async () => ({
        minifigCount: 1,
        sourceMinifigCount: 1,
      }),
      limit: 2,
      listCatalogSetsForMinifigSyncFn: async () => extendedCatalogSets,
      loadExistingMinifigSummariesFn: async () => toExistingSummary([]),
      mode: 'write',
      requestDelayMs: 0,
      upsertCatalogSetMinifigSummariesFn: async (rows) => rows.length,
    });

    expect(result).toMatchObject({
      isPartial: true,
      nextAfterSetId: '21326',
      processedSets: 2,
      summariesUpserted: 2,
    });
  });
});
