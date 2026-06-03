import { describe, expect, test, vi } from 'vitest';
import { buildCatalogDiscoveryCandidatesFromRakutenMissingSets } from './catalog-discovery-candidates-server';

function createSourceCandidate(
  setNumber: string,
  title = `LEGO Set ${setNumber}`,
) {
  return {
    confidence: 'strict_rakuten_lego_candidate',
    feedFilename: '/GLOBAL/NL-NL_EUR/feed.xml.gz',
    productTitle: title,
    productUrl: `https://lego.example/${setNumber}`,
    reason: 'missing_from_catalog_sets',
    setNumber,
    source: 'rakuten-lego-eu',
  };
}

function createExistingCandidate(
  overrides: Partial<{
    normalizedSetId: string;
    rebrickablePayload: Record<string, unknown>;
  }> = {},
) {
  return {
    autoCreateEligible: true,
    confidence: 'high',
    confidenceScore: 97,
    evidence: {},
    firstSeenAt: '2026-06-03T09:00:00.000Z',
    id: 'candidate-existing',
    lastSeenAt: '2026-06-03T09:00:00.000Z',
    normalizedSetId: '75401',
    rebrickablePayload: {
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
    requiredFieldsPresent: true,
    source: 'rakuten-lego-eu',
    sourcePayload: {},
    sourceProductUrl: 'https://lego.example/75401',
    sourceSetNumber: '75401-1',
    status: 'new',
    ...overrides,
  } as const;
}

describe('catalog discovery candidate pipeline', () => {
  test('discovery without enrichment makes zero Rebrickable calls and dedupes duplicate feed products', async () => {
    const lookupBricksetSetMetadataFn = vi.fn();
    const searchCatalogMissingSetsFn = vi.fn();
    const upsertCatalogDiscoveryCandidatesFn = vi.fn(async ({ inputs }) =>
      inputs.map((input, index) => ({
        ...input,
        id: `candidate-${index}`,
      })),
    );

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        createSourceCandidate(
          '75401',
          'LEGO Star Wars Ahsoka Jedi Interceptor 75401',
        ),
        createSourceCandidate(
          '75401-1',
          'LEGO Star Wars Ahsoka Jedi Interceptor 75401',
        ),
      ],
      dependencies: {
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
        lookupBricksetSetMetadataFn,
        searchCatalogMissingSetsFn,
        upsertCatalogDiscoveryCandidatesFn,
      },
    });

    expect(lookupBricksetSetMetadataFn).not.toHaveBeenCalled();
    expect(searchCatalogMissingSetsFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      enrichmentEnabled: false,
      enrichmentLookupCount: 0,
      persistedCandidateCount: 1,
      uniqueCandidateCount: 1,
    });
    expect(upsertCatalogDiscoveryCandidatesFn).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          confidence: 'low',
          normalizedSetId: '75401',
        }),
      ],
    });
  });

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
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
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
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
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

  test('reuses existing candidate Rebrickable enrichment before live lookup', async () => {
    const searchCatalogMissingSetsFn = vi.fn();
    const upsertCatalogDiscoveryCandidatesFn = vi.fn(async ({ inputs }) =>
      inputs.map((input, index) => ({
        ...input,
        id: `candidate-${index}`,
      })),
    );

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        createSourceCandidate(
          '75401',
          'LEGO Star Wars Ahsoka Jedi Interceptor 75401',
        ),
      ],
      dependencies: {
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => [
          createExistingCandidate(),
        ]),
        lookupBricksetSetMetadataFn: vi.fn(async () => ({
          fetchedSetCount: 0,
          metadataRecords: [],
          unmatchedSetNumbers: ['75401-1'],
        })),
        searchCatalogMissingSetsFn,
        upsertCatalogDiscoveryCandidatesFn,
      },
      options: {
        enrichMissingSets: true,
      },
    });

    expect(searchCatalogMissingSetsFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      enrichmentLookupCount: 0,
      enrichmentSkippedExistingCount: 1,
      existingCandidateHitCount: 1,
      highConfidenceCount: 1,
    });
  });

  test('set-ids filter limits candidate work', async () => {
    const upsertCatalogDiscoveryCandidatesFn = vi.fn(async ({ inputs }) =>
      inputs.map((input, index) => ({
        ...input,
        id: `candidate-${index}`,
      })),
    );

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        createSourceCandidate('72155'),
        createSourceCandidate('72156'),
      ],
      dependencies: {
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
        lookupBricksetSetMetadataFn: vi.fn(),
        searchCatalogMissingSetsFn: vi.fn(),
        upsertCatalogDiscoveryCandidatesFn,
      },
      options: {
        setIds: ['72155'],
      },
    });

    expect(result.uniqueCandidateCount).toBe(1);
    expect(upsertCatalogDiscoveryCandidatesFn).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          normalizedSetId: '72155',
        }),
      ],
    });
  });

  test('max-enrichment-lookups is respected', async () => {
    const searchCatalogMissingSetsFn = vi.fn(async () => []);

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        createSourceCandidate('72155'),
        createSourceCandidate('72156'),
      ],
      dependencies: {
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
        lookupBricksetSetMetadataFn: vi.fn(async () => ({
          fetchedSetCount: 0,
          metadataRecords: [],
          unmatchedSetNumbers: ['72155-1', '72156-1'],
        })),
        searchCatalogMissingSetsFn,
        upsertCatalogDiscoveryCandidatesFn: vi.fn(async ({ inputs }) =>
          inputs.map((input, index) => ({
            ...input,
            id: `candidate-${index}`,
          })),
        ),
      },
      options: {
        enrichMissingSets: true,
        maxEnrichmentLookups: 1,
      },
    });

    expect(searchCatalogMissingSetsFn).toHaveBeenCalledTimes(1);
    expect(result.enrichmentLookupCount).toBe(1);
    expect(result.persistedCandidateCount).toBe(2);
  });

  test('auto-create implies enrichment but respects explicit lookup limit', async () => {
    const createCatalogSetFn = vi.fn();
    const searchCatalogMissingSetsFn = vi.fn();

    const result = await buildCatalogDiscoveryCandidatesFromRakutenMissingSets({
      candidates: [
        createSourceCandidate(
          '75401',
          'LEGO Star Wars Ahsoka Jedi Interceptor 75401',
        ),
      ],
      dependencies: {
        createCatalogSetFn,
        listCatalogDiscoveryCandidatesBySetIdsFn: vi.fn(async () => []),
        lookupBricksetSetMetadataFn: vi.fn(async () => ({
          fetchedSetCount: 0,
          metadataRecords: [],
          unmatchedSetNumbers: ['75401-1'],
        })),
        searchCatalogMissingSetsFn,
        upsertCatalogDiscoveryCandidatesFn: vi.fn(async ({ inputs }) =>
          inputs.map((input, index) => ({
            ...input,
            id: `candidate-${index}`,
          })),
        ),
      },
      options: {
        autoCreateHighConfidenceCatalogSets: true,
        maxEnrichmentLookups: 0,
      },
    });

    expect(result.enrichmentEnabled).toBe(true);
    expect(result.enrichmentLookupCount).toBe(0);
    expect(searchCatalogMissingSetsFn).not.toHaveBeenCalled();
    expect(createCatalogSetFn).not.toHaveBeenCalled();
  });
});
