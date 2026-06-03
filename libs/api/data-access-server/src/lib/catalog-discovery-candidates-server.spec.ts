import { describe, expect, test, vi } from 'vitest';
import { buildCatalogDiscoveryCandidatesFromRakutenMissingSets } from './catalog-discovery-candidates-server';

describe('catalog discovery candidate pipeline', () => {
  test('auto-creates only high-confidence candidates with complete Rebrickable metadata', async () => {
    const createCatalogSetFn = vi.fn().mockResolvedValue({
      setId: '75401',
    });
    const upsertCatalogDiscoveryCandidatesFn = vi.fn(async ({ inputs }) =>
      inputs.map((input, index) => ({
        ...input,
        id: `candidate-${index}`,
      })),
    );

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        {
          confidence: 'strict_rakuten_lego_candidate',
          feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
          productTitle: 'LEGO Star Wars Ahsoka Jedi Interceptor 75401',
          productUrl: 'https://lego.example/75401',
          reason: 'missing_from_catalog_sets',
          setNumber: '75401',
          source: 'rakuten-lego-eu',
        },
      ],
      dependencies: {
        createCatalogSetFn,
        getNow: () => new Date('2026-06-03T10:00:00.000Z'),
        lookupBricksetSetMetadataFn: vi.fn(async () => ({
          fetchedSetCount: 1,
          metadataRecords: [
            {
              catalogSetId: '75401',
              catalogSetName: 'Ahsoka Jedi Interceptor',
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
              setNumber: '75401-1',
            },
          ],
          unmatchedSetNumbers: [],
        })),
        searchCatalogMissingSetsFn: vi.fn(async () => [
          {
            imageUrl: 'https://cdn.rebrickable.com/media/sets/75401-1/1000.jpg',
            name: 'Ahsoka Jedi Interceptor',
            pieces: 290,
            releaseYear: 2026,
            setId: '75401',
            slug: 'ahsoka-jedi-interceptor-75401',
            source: 'rebrickable',
            sourceSetNumber: '75401-1',
            theme: 'Star Wars',
          },
        ]),
        upsertCatalogDiscoveryCandidatesFn,
      },
      options: {
        autoCreateHighConfidenceCatalogSets: true,
      },
    });

    expect(result).toMatchObject({
      autoCreateAttemptedCount: 1,
      createdCatalogSetCount: 1,
      highConfidenceCount: 1,
      persistedCandidateCount: 1,
    });
    expect(createCatalogSetFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        setId: '75401',
      }),
    });
    expect(upsertCatalogDiscoveryCandidatesFn).toHaveBeenNthCalledWith(1, {
      inputs: [
        expect.objectContaining({
          autoCreateEligible: true,
          confidence: 'high',
          requiredFieldsPresent: true,
        }),
      ],
    });
    expect(upsertCatalogDiscoveryCandidatesFn).toHaveBeenNthCalledWith(2, {
      inputs: [
        expect.objectContaining({
          importedSetId: '75401',
          importError: null,
          status: 'imported',
        }),
      ],
    });
  });

  test('keeps exact Rebrickable matches in review when feed title does not match', async () => {
    const createCatalogSetFn = vi.fn();
    const upsertCatalogDiscoveryCandidatesFn = vi.fn(async ({ inputs }) =>
      inputs.map((input, index) => ({
        ...input,
        id: `candidate-${index}`,
      })),
    );

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        {
          confidence: 'strict_rakuten_lego_candidate',
          feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
          productTitle: 'LEGO Star Wars Completely Different Ship 75402',
          productUrl: 'https://lego.example/75402',
          reason: 'missing_from_catalog_sets',
          setNumber: '75402',
          source: 'rakuten-lego-eu',
        },
      ],
      dependencies: {
        createCatalogSetFn,
        lookupBricksetSetMetadataFn: vi.fn(async () => ({
          fetchedSetCount: 0,
          metadataRecords: [],
          unmatchedSetNumbers: ['75402-1'],
        })),
        searchCatalogMissingSetsFn: vi.fn(async () => [
          {
            imageUrl: 'https://cdn.rebrickable.com/media/sets/75402-1/1000.jpg',
            name: 'Grogu with Hover Pram',
            pieces: 1048,
            releaseYear: 2026,
            setId: '75402',
            slug: 'grogu-with-hover-pram-75402',
            source: 'rebrickable',
            sourceSetNumber: '75402-1',
            theme: 'Star Wars',
          },
        ]),
        upsertCatalogDiscoveryCandidatesFn,
      },
      options: {
        autoCreateHighConfidenceCatalogSets: true,
      },
    });

    expect(result).toMatchObject({
      autoCreateAttemptedCount: 0,
      createdCatalogSetCount: 0,
      highConfidenceCount: 0,
      persistedCandidateCount: 1,
      skippedAutoCreateCount: 1,
    });
    expect(createCatalogSetFn).not.toHaveBeenCalled();
    expect(upsertCatalogDiscoveryCandidatesFn).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          autoCreateEligible: false,
          confidence: 'medium',
          requiredFieldsPresent: true,
        }),
      ],
    });
  });
});
