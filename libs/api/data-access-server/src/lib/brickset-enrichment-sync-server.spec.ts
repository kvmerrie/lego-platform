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
});
