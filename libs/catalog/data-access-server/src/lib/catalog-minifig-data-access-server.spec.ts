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
      upsertCatalogSetMinifigSummariesFn,
    });

    expect(result.changedSetIds).toEqual(['10316']);
    expect(result.changedSetSlugs).toEqual([
      'the-lord-of-the-rings-rivendell-10316',
    ]);
  });
});
