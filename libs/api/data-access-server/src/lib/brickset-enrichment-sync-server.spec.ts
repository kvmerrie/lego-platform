import { describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import { syncBricksetEnrichmentMetadata } from './brickset-enrichment-sync-server';

function createCatalogSet(
  overrides: Partial<CatalogCanonicalSet>,
): CatalogCanonicalSet {
  return {
    createdAt: '2026-05-27T08:00:00.000Z',
    imageUrl: 'https://cdn.example.com/set.jpg',
    name: 'Flower Bouquet',
    pieceCount: 756,
    primaryTheme: 'Botanicals',
    releaseDatePrecision: 'year',
    releaseYear: 2021,
    secondaryLabels: [],
    setId: '10280',
    slug: 'flower-bouquet-10280',
    source: 'rebrickable',
    sourceSetNumber: '10280-1',
    status: 'active',
    updatedAt: '2026-05-27T08:00:00.000Z',
    ...overrides,
  };
}

function createBricksetFetchMock() {
  return vi.fn(async (url: string | URL) => {
    const normalizedUrl = String(url);

    if (normalizedUrl.endsWith('/getSets')) {
      return new Response(
        JSON.stringify({
          matches: 1,
          sets: [
            {
              LEGOCom: {
                DE: {
                  dateFirstAvailable: '2021-01-02T00:00:00Z',
                },
              },
              additionalImageCount: 2,
              availability: 'Retail',
              barcode: {
                EAN: '5702016913767',
              },
              bricksetURL: 'https://brickset.com/sets/10280-1',
              category: 'Normal',
              dimensions: {
                depth: 7.1,
                height: 38.2,
                width: 26.2,
              },
              exitDate: '2026-07-31T00:00:00Z',
              extendedData: {
                tags: ['18 Plus', 'Brick Built Plants'],
              },
              image: {
                imageURL: 'https://images.brickset.com/sets/images/10280-1.jpg',
                thumbnailURL:
                  'https://images.brickset.com/sets/small/10280-1.jpg',
              },
              launchDate: '2021-01-01T00:00:00Z',
              modelDimensions: {
                dimension1: 36,
              },
              name: 'Flower Bouquet',
              number: '10280',
              numberVariant: 1,
              pieces: 756,
              setID: 31025,
              subtheme: 'Botanical Collection',
              theme: 'Icons',
              themeGroup: 'Model making',
              year: 2021,
            },
          ],
          status: 'success',
        }),
      );
    }

    if (normalizedUrl.endsWith('/getAdditionalImages')) {
      return new Response(
        JSON.stringify({
          additionalImages: [
            {
              imageURL:
                'https://images.brickset.com/sets/AdditionalImages/10280-1/10280_alt1.jpg',
              thumbnailURL:
                'https://images.brickset.com/sets/AdditionalImages/10280-1/tn_10280_alt1_jpg.jpg',
            },
          ],
          matches: 1,
          status: 'success',
        }),
      );
    }

    return new Response(
      JSON.stringify({ message: 'unknown', status: 'error' }),
    );
  });
}

function createCatalogSets(count: number): CatalogCanonicalSet[] {
  return Array.from({ length: count }, (_, index) => {
    const setId = String(10_000 + index);

    return createCatalogSet({
      name: `Set ${setId}`,
      setId,
      slug: `set-${setId}`,
      sourceSetNumber: `${setId}-1`,
    });
  });
}

function createPagedBricksetFetchMock() {
  const requestedSetNumberBatches: string[][] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const normalizedUrl = String(url);

    if (normalizedUrl.endsWith('/getSets')) {
      const body = new URLSearchParams(init?.body as string);
      const params = JSON.parse(body.get('params') ?? '{}') as {
        setNumber?: string;
      };
      const requestedSetNumbers = (params.setNumber ?? '')
        .split(',')
        .map((setNumber) => setNumber.trim())
        .filter(Boolean);

      requestedSetNumberBatches.push(requestedSetNumbers);

      return new Response(
        JSON.stringify({
          matches: requestedSetNumbers.length,
          sets: requestedSetNumbers.map((setNumber) => {
            const [number, variant = '1'] = setNumber.split('-');

            return {
              bricksetURL: `https://brickset.com/sets/${setNumber}`,
              image: {
                imageURL: `https://images.brickset.com/sets/images/${setNumber}.jpg`,
              },
              name: `Set ${number}`,
              number,
              numberVariant: Number(variant),
              pieces: 100,
              setID: Number(number),
              theme: 'Icons',
              year: 2026,
            };
          }),
          status: 'success',
        }),
      );
    }

    if (normalizedUrl.endsWith('/getAdditionalImages')) {
      return new Response(
        JSON.stringify({
          additionalImages: [],
          matches: 0,
          status: 'success',
        }),
      );
    }

    return new Response(
      JSON.stringify({ message: 'unknown', status: 'error' }),
    );
  });

  return {
    fetchFn,
    requestedSetNumberBatches,
  };
}

describe('syncBricksetEnrichmentMetadata', () => {
  test('dry-run builds Brickset source metadata without writes', async () => {
    const fetchFn = createBricksetFetchMock();
    const upsertCatalogSetSourceMetadataFn = vi.fn();

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      fetchFn,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet({})]),
      upsertCatalogSetSourceMetadataFn,
    });

    expect(result.dryRun).toBe(true);
    expect(result.matchedCatalogSetCount).toBe(1);
    expect(result.sourceMetadataUpsertedCount).toBe(0);
    expect(upsertCatalogSetSourceMetadataFn).not.toHaveBeenCalled();
    expect(result.metadataRecords[0]?.metadataJson).toMatchObject({
      bricksetSetId: 31025,
      dateFirstAvailable: '2021-01-02',
      ean: '5702016913767',
      exitDate: '2026-07-31',
      imageRights: {
        attributionText: 'Image(s) courtesy of Brickset.com',
        policy: 'render_publicly_with_attribution',
        renderPublicly: true,
      },
      launchDate: '2021-01-01',
      pieces: 756,
      subtheme: 'Botanical Collection',
      theme: 'Icons',
    });
    expect(result.metadataRecords[0]?.metadataJson.images).toEqual([
      expect.objectContaining({
        attributionRequired: false,
        sourceField: 'image.imageURL',
        type: 'primary',
      }),
      expect.objectContaining({
        attributionRequired: true,
        sourceField: 'additionalImages',
        type: 'additional',
      }),
    ]);
  });

  test('write mode upserts only catalog source metadata', async () => {
    const upsertCatalogSetSourceMetadataFn = vi.fn().mockResolvedValue(1);

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      dryRun: false,
      fetchFn: createBricksetFetchMock(),
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet({})]),
      upsertCatalogSetSourceMetadataFn,
    });

    expect(result.sourceMetadataUpsertedCount).toBe(1);
    expect(upsertCatalogSetSourceMetadataFn).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          catalogSetId: '10280',
          locale: 'en-US',
          matchConfidence: 'exact_set_number',
          policy: 'render_publicly_with_attribution',
          setNumber: '10280',
          source: 'brickset',
        }),
      ],
    });
  });

  test('selects the first max-sets page by default', async () => {
    const { fetchFn, requestedSetNumberBatches } =
      createPagedBricksetFetchMock();

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      fetchFn,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue(createCatalogSets(4)),
      maxSets: 2,
      upsertCatalogSetSourceMetadataFn: vi.fn(),
    });

    expect(result.selectedCandidateCount).toBe(2);
    expect(result.maxSets).toBe(2);
    expect(result.offset).toBe(0);
    expect(result.missingOnly).toBe(false);
    expect(requestedSetNumberBatches[0]).toEqual(['10000-1', '10001-1']);
  });

  test('selects the second page when offset is provided', async () => {
    const { fetchFn, requestedSetNumberBatches } =
      createPagedBricksetFetchMock();

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      fetchFn,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue(createCatalogSets(5)),
      maxSets: 2,
      offset: 2,
      upsertCatalogSetSourceMetadataFn: vi.fn(),
    });

    expect(result.selectedCandidateCount).toBe(2);
    expect(result.offset).toBe(2);
    expect(requestedSetNumberBatches[0]).toEqual(['10002-1', '10003-1']);
  });

  test('missing-only excludes already enriched exact Brickset metadata rows', async () => {
    const { fetchFn, requestedSetNumberBatches } =
      createPagedBricksetFetchMock();
    const listCatalogSetSourceMetadataSetIdsFn = vi
      .fn()
      .mockResolvedValue(['10000', '10002']);

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      fetchFn,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue(createCatalogSets(4)),
      listCatalogSetSourceMetadataSetIdsFn,
      maxSets: 2,
      missingOnly: true,
      upsertCatalogSetSourceMetadataFn: vi.fn(),
    });

    expect(listCatalogSetSourceMetadataSetIdsFn).toHaveBeenCalledWith({
      locale: 'en-US',
      matchConfidence: 'exact_set_number',
      source: 'brickset',
    });
    expect(result.selectedCandidateCount).toBe(2);
    expect(result.sourceMetadataExistingCount).toBe(2);
    expect(requestedSetNumberBatches[0]).toEqual(['10001-1', '10003-1']);
  });

  test('missing-only excludes rows immediately after a successful write run', async () => {
    const existingSetIds = new Set<string>();
    const listCatalogSetSourceMetadataSetIdsFn = vi.fn(async () => [
      ...existingSetIds,
    ]);
    const upsertCatalogSetSourceMetadataFn = vi.fn(async ({ inputs }) => {
      for (const input of inputs) {
        existingSetIds.add(input.catalogSetId);
      }

      return inputs.length;
    });
    const catalogSets = createCatalogSets(3);
    const firstFetch = createPagedBricksetFetchMock();

    const firstResult = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      dryRun: false,
      fetchFn: firstFetch.fetchFn,
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue(catalogSets),
      listCatalogSetSourceMetadataSetIdsFn,
      missingOnly: true,
      upsertCatalogSetSourceMetadataFn,
    });

    const secondFetch = createPagedBricksetFetchMock();
    const secondResult = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      dryRun: false,
      fetchFn: secondFetch.fetchFn,
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue(catalogSets),
      listCatalogSetSourceMetadataSetIdsFn,
      missingOnly: true,
      upsertCatalogSetSourceMetadataFn,
    });

    expect(firstResult.selectedCandidateCount).toBe(3);
    expect(firstResult.sourceMetadataUpsertedCount).toBe(3);
    expect(firstFetch.requestedSetNumberBatches[0]).toEqual([
      '10000-1',
      '10001-1',
      '10002-1',
    ]);
    expect(secondResult.selectedCandidateCount).toBe(0);
    expect(secondResult.sourceMetadataExistingCount).toBe(3);
    expect(secondResult.sourceMetadataUpsertedCount).toBe(0);
    expect(secondFetch.requestedSetNumberBatches).toEqual([]);
    expect(upsertCatalogSetSourceMetadataFn).toHaveBeenCalledTimes(1);
  });

  test('missing-only retries unmatched candidates because no negative cache is written', async () => {
    const fetchFn = vi.fn(async (url: string | URL) => {
      if (String(url).endsWith('/getSets')) {
        return new Response(
          JSON.stringify({
            matches: 0,
            sets: [],
            status: 'success',
          }),
        );
      }

      return new Response(
        JSON.stringify({
          additionalImages: [],
          matches: 0,
          status: 'success',
        }),
      );
    });
    const upsertCatalogSetSourceMetadataFn = vi.fn();
    const catalogSets = [createCatalogSet({})];

    const firstResult = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      dryRun: false,
      fetchFn,
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue(catalogSets),
      listCatalogSetSourceMetadataSetIdsFn: vi.fn().mockResolvedValue([]),
      missingOnly: true,
      upsertCatalogSetSourceMetadataFn,
    });
    const secondResult = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      dryRun: false,
      fetchFn,
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue(catalogSets),
      listCatalogSetSourceMetadataSetIdsFn: vi.fn().mockResolvedValue([]),
      missingOnly: true,
      upsertCatalogSetSourceMetadataFn,
    });

    expect(firstResult.selectedCandidateCount).toBe(1);
    expect(firstResult.matchedCatalogSetCount).toBe(0);
    expect(firstResult.unmatchedCatalogSets).toHaveLength(1);
    expect(secondResult.selectedCandidateCount).toBe(1);
    expect(secondResult.unmatchedCatalogSets).toHaveLength(1);
    expect(upsertCatalogSetSourceMetadataFn).not.toHaveBeenCalled();
  });

  test('explicit set-numbers take precedence over offset and missing-only', async () => {
    const { fetchFn, requestedSetNumberBatches } =
      createPagedBricksetFetchMock();
    const listCatalogSetSourceMetadataSetIdsFn = vi.fn();

    const result = await syncBricksetEnrichmentMetadata({
      bricksetApiKey: 'brickset-test-key',
      fetchFn,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue(createCatalogSets(5)),
      listCatalogSetSourceMetadataSetIdsFn,
      maxSets: 2,
      missingOnly: true,
      offset: 2,
      setNumbers: ['10000-1', '10004-1'],
      upsertCatalogSetSourceMetadataFn: vi.fn(),
    });

    expect(listCatalogSetSourceMetadataSetIdsFn).not.toHaveBeenCalled();
    expect(result.selectedCandidateCount).toBe(2);
    expect(result.sourceMetadataExistingCount).toBeUndefined();
    expect(requestedSetNumberBatches[0]).toEqual(['10000-1', '10004-1']);
  });
});
