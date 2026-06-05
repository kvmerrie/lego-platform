import { describe, expect, test, vi } from 'vitest';
import {
  backfillCatalogSetPieceCounts,
  enrichImportedCatalogSets,
} from './catalog-import-enrichment-server';

const catalogSet10341 = {
  setId: '10341',
  slug: 'nasa-artemis-space-launch-system-10341',
  sourceSetNumber: '10341-1',
};

const catalogSet21363 = {
  setId: '21363',
  slug: 'the-goonies-21363',
  sourceSetNumber: '21363-1',
};

describe('catalog import enrichment pipeline', () => {
  test('runs Brickset, minifig and theme enrichment for imported sets', async () => {
    const syncBricksetEnrichmentMetadataFn = vi.fn(async () => ({
      additionalImageMatches: 0,
      collectionPageSnapshotCount: 0,
      collectionPageSnapshotsUpsertedCount: 0,
      dryRun: false,
      fetchedSetCount: 1,
      imageReferenceCount: 0,
      matchedCatalogSetCount: 1,
      metadataRecords: [
        {
          catalogSetId: '10341',
          catalogSetName: 'NASA Artemis Space Launch System',
          metadataJson: {
            bricksetSetId: 123,
            imageRights: {
              attributionText: 'Image(s) courtesy of Brickset.com',
              officialLegoImagesRequireFairPlayCompliance: true,
              policy: 'render_publicly_with_attribution',
              renderPublicly: true,
            },
            images: [],
            sourceSeen: true,
          },
          setNumber: '10341-1',
        },
      ],
      missingOnly: false,
      offset: 0,
      selectedCandidateCount: 1,
      skippedMissingSetNumberCount: 0,
      sourceMetadataUpsertedCount: 1,
      summaryByCollectionSlug: {},
      unmatchedCatalogSets: [],
    }));
    const enrichCatalogSetMinifigSummariesFn = vi.fn(async () => ({
      changedSetIds: ['10341'],
      changedSetSlugs: ['nasa-artemis-space-launch-system-10341'],
      failedSetIds: [],
      failedSets: 0,
      processedSets: 1,
      summariesUpserted: 1,
    }));
    const applyBricksetPublicThemeMappingsFn = vi.fn(async () => ({
      updatedCount: 1,
    }));
    const backfillCatalogSetPieceCountsFn = vi.fn(async () => ({
      updatedCount: 1,
    }));

    const result = await enrichImportedCatalogSets({
      catalogSets: [catalogSet10341],
      dependencies: {
        applyBricksetPublicThemeMappingsFn,
        backfillCatalogSetPieceCountsFn,
        enrichCatalogSetMinifigSummariesFn,
        syncBricksetEnrichmentMetadataFn,
      },
    });

    expect(syncBricksetEnrichmentMetadataFn).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        setNumbers: ['10341-1'],
      }),
    );
    expect(enrichCatalogSetMinifigSummariesFn).toHaveBeenCalledWith({
      setIds: ['10341'],
    });
    expect(applyBricksetPublicThemeMappingsFn).toHaveBeenCalledWith({
      metadataRecords: expect.arrayContaining([
        expect.objectContaining({
          catalogSetId: '10341',
        }),
      ]),
    });
    expect(backfillCatalogSetPieceCountsFn).toHaveBeenCalledWith({
      catalogSets: [catalogSet10341],
      metadataRecords: expect.arrayContaining([
        expect.objectContaining({
          catalogSetId: '10341',
        }),
      ]),
    });
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        bricksetStatus: 'success',
        enrichmentStatus: 'complete',
        importedSetId: '10341',
        minifigStatus: 'success',
        themeStatus: 'success',
      }),
    );
  });

  test('keeps import result usable when Brickset enrichment fails', async () => {
    const result = await enrichImportedCatalogSets({
      catalogSets: [catalogSet10341],
      dependencies: {
        applyBricksetPublicThemeMappingsFn: vi.fn(),
        backfillCatalogSetPieceCountsFn: vi.fn(),
        enrichCatalogSetMinifigSummariesFn: vi.fn(async () => ({
          changedSetIds: [],
          changedSetSlugs: [],
          failedSetIds: [],
          failedSets: 0,
          processedSets: 1,
          summariesUpserted: 1,
        })),
        syncBricksetEnrichmentMetadataFn: vi.fn(async () => {
          throw new Error('Brickset unavailable');
        }),
      },
    });

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        bricksetStatus: 'failed',
        enrichmentStatus: 'partial',
        importedSetId: '10341',
        minifigStatus: 'success',
        themeStatus: 'failed',
      }),
    );
    expect(result.results[0]?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Brickset unavailable')]),
    );
  });

  test('keeps import result usable when minifig enrichment fails', async () => {
    const result = await enrichImportedCatalogSets({
      catalogSets: [catalogSet10341],
      dependencies: {
        applyBricksetPublicThemeMappingsFn: vi.fn(async () => ({
          updatedCount: 0,
        })),
        backfillCatalogSetPieceCountsFn: vi.fn(async () => ({
          updatedCount: 0,
        })),
        enrichCatalogSetMinifigSummariesFn: vi.fn(async () => {
          throw new Error('Minifig sync unavailable');
        }),
        syncBricksetEnrichmentMetadataFn: vi.fn(async () => ({
          additionalImageMatches: 0,
          collectionPageSnapshotCount: 0,
          collectionPageSnapshotsUpsertedCount: 0,
          dryRun: false,
          fetchedSetCount: 0,
          imageReferenceCount: 0,
          matchedCatalogSetCount: 0,
          metadataRecords: [],
          missingOnly: false,
          offset: 0,
          selectedCandidateCount: 1,
          skippedMissingSetNumberCount: 0,
          sourceMetadataUpsertedCount: 0,
          summaryByCollectionSlug: {},
          unmatchedCatalogSets: [],
        })),
      },
    });

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        enrichmentStatus: 'partial',
        importedSetId: '10341',
        minifigStatus: 'failed',
      }),
    );
    expect(result.results[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Minifig sync unavailable'),
      ]),
    );
  });

  test('enriches imported sets in batch without dropping later sets', async () => {
    const result = await enrichImportedCatalogSets({
      catalogSets: [catalogSet10341, catalogSet21363],
      dependencies: {
        applyBricksetPublicThemeMappingsFn: vi.fn(async () => ({
          updatedCount: 1,
        })),
        backfillCatalogSetPieceCountsFn: vi.fn(async () => ({
          updatedCount: 1,
        })),
        enrichCatalogSetMinifigSummariesFn: vi.fn(async () => ({
          changedSetIds: ['10341'],
          changedSetSlugs: ['nasa-artemis-space-launch-system-10341'],
          failedSetIds: ['21363'],
          failedSets: 1,
          processedSets: 2,
          summariesUpserted: 1,
        })),
        syncBricksetEnrichmentMetadataFn: vi.fn(async () => ({
          additionalImageMatches: 0,
          collectionPageSnapshotCount: 0,
          collectionPageSnapshotsUpsertedCount: 0,
          dryRun: false,
          fetchedSetCount: 1,
          imageReferenceCount: 0,
          matchedCatalogSetCount: 1,
          metadataRecords: [
            {
              catalogSetId: '10341',
              catalogSetName: 'NASA Artemis Space Launch System',
              metadataJson: {
                bricksetSetId: 123,
                imageRights: {
                  attributionText: 'Image(s) courtesy of Brickset.com',
                  officialLegoImagesRequireFairPlayCompliance: true,
                  policy: 'render_publicly_with_attribution',
                  renderPublicly: true,
                },
                images: [],
                sourceSeen: true,
              },
              setNumber: '10341-1',
            },
          ],
          missingOnly: false,
          offset: 0,
          selectedCandidateCount: 2,
          skippedMissingSetNumberCount: 0,
          sourceMetadataUpsertedCount: 1,
          summaryByCollectionSlug: {},
          unmatchedCatalogSets: [],
        })),
      },
    });

    expect(result.results).toHaveLength(2);
    expect(result.results.map((item) => item.importedSetId)).toEqual([
      '10341',
      '21363',
    ]);
    expect(
      result.results.find((item) => item.importedSetId === '21363'),
    ).toEqual(
      expect.objectContaining({
        enrichmentStatus: 'partial',
        minifigStatus: 'failed',
      }),
    );
  });

  test('backfills zero piece count from Brickset metadata', async () => {
    const updates: Array<{ setId: string; values: Record<string, unknown> }> =
      [];
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    piece_count: 0,
                    set_id: '42240',
                    source_set_number: '42240-1',
                  },
                ],
                error: null,
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => ({
              eq: vi.fn(async (_column: string, setId: string) => {
                updates.push({ setId, values });

                return { error: null };
              }),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [],
              error: null,
            })),
          })),
        };
      }),
    };

    const result = await backfillCatalogSetPieceCounts({
      catalogSets: [
        {
          setId: '42240',
          slug: 'aston-martin-aramco-amr25-f1-car-42240',
          sourceSetNumber: '42240-1',
        },
      ],
      metadataRecords: [
        {
          catalogSetId: '42240',
          catalogSetName: 'Aston Martin Aramco AMR25 F1 Car',
          metadataJson: {
            bricksetSetId: 42240,
            images: [],
            pieces: 1547,
            sourceSeen: true,
            theme: 'Technic',
          },
          setNumber: '42240-1',
        },
      ],
      supabaseClient: supabaseClient as never,
    });

    expect(result.updatedCount).toBe(1);
    expect(updates).toEqual([
      {
        setId: '42240',
        values: expect.objectContaining({
          piece_count: 1547,
        }),
      },
    ]);
  });

  test('falls back to local Rebrickable mirror for zero piece count', async () => {
    const updates: Array<{ setId: string; values: Record<string, unknown> }> =
      [];
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    piece_count: 0,
                    set_id: '72155',
                    source_set_number: '72155-1',
                  },
                ],
                error: null,
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => ({
              eq: vi.fn(async (_column: string, setId: string) => {
                updates.push({ setId, values });

                return { error: null };
              }),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  num_parts: 240,
                  set_num: '72155-1',
                },
              ],
              error: null,
            })),
          })),
        };
      }),
    };

    const result = await backfillCatalogSetPieceCounts({
      catalogSets: [
        {
          setId: '72155',
          slug: 'smart-play-berry-bash-with-bulbasaur-and-bidoof-72155',
          sourceSetNumber: '72155-1',
        },
      ],
      metadataRecords: [],
      supabaseClient: supabaseClient as never,
    });

    expect(result.updatedCount).toBe(1);
    expect(updates).toEqual([
      {
        setId: '72155',
        values: expect.objectContaining({
          piece_count: 240,
        }),
      },
    ]);
  });
});
