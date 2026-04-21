vi.mock('@supabase/supabase-js', async () => {
  const actual = await vi.importActual<typeof import('@supabase/supabase-js')>(
    '@supabase/supabase-js',
  );

  return {
    ...actual,
    createClient: vi.fn(),
  };
});

import * as sharedConfig from '@lego-platform/shared/config';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import * as supabaseSdk from '@supabase/supabase-js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  type CatalogDiscoverySignal,
  getCatalogPrimaryOfferAvailabilityStateBySetId,
  type CatalogResolvedOffer,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  getCatalogCurrentOfferSummaryBySetId,
  getCatalogThemePageBySlug,
  listCanonicalCatalogSets,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSearchMatches,
  listCatalogSearchSuggestionSetCards,
  listCatalogSimilarSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
  listCatalogSetSummaries,
  listCatalogThemeDirectoryItems,
  listCatalogThemePageSlugs,
  listDiscoverBrowseThemeGroups,
  listDiscoverHighlightSetCards,
  listHomepageDealCandidateSetCards,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  rankCatalogComparisonDiscoverySetCards,
  rankCatalogSimilarSetCards,
  resetWebCatalogSupabaseClientsForTests,
  resolveCatalogCurrentOffers,
  resolveCatalogSetDetailOffers,
  summarizeCatalogCurrentOffers,
} from './catalog-effective-data-access-web';

function createCanonicalCatalogSet(
  overrides: Partial<{
    createdAt: string;
    imageUrl?: string;
    name: string;
    pieceCount: number;
    releaseYear: number;
    setId: string;
    slug: string;
    source: 'rebrickable';
    sourceSetNumber: string;
    status: 'active' | 'inactive';
    primaryTheme: string;
    secondaryLabels?: readonly string[];
    updatedAt: string;
  }> = {},
) {
  return {
    createdAt: '2026-04-17T08:00:00.000Z',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
    name: 'Mario Kart - Mario & Standard Kart',
    pieceCount: 1972,
    primaryTheme: 'Super Mario',
    releaseYear: 2025,
    secondaryLabels: [],
    setId: '72037',
    slug: 'mario-kart-mario-standard-kart-72037',
    source: 'rebrickable' as const,
    sourceSetNumber: '72037-1',
    status: 'active' as const,
    updatedAt: '2026-04-17T08:00:00.000Z',
    ...overrides,
  };
}

function createCatalogOffer(
  overrides: Partial<CatalogResolvedOffer> = {},
): CatalogResolvedOffer {
  return {
    availability: 'in_stock',
    checkedAt: '2026-04-18T08:30:00.000Z',
    condition: 'new',
    currency: 'EUR',
    market: 'NL',
    merchant: 'other',
    merchantName: 'Intertoys',
    priceCents: 7999,
    setId: '72037',
    url: 'https://www.intertoys.nl/mario-kart',
    ...overrides,
  };
}

function createCatalogDiscoverySignal(
  overrides: Partial<CatalogDiscoverySignal> = {},
): CatalogDiscoverySignal {
  return {
    bestPriceMinor: 29999,
    merchantCount: 4,
    nextBestPriceMinor: 32999,
    observedAt: '2026-04-20T08:30:00.000Z',
    priceSpreadMinor: 3000,
    referenceDeltaMinor: -2000,
    ...overrides,
  };
}

function createSupabaseTableBuilder<Row extends Record<string, unknown>>(
  rows: readonly Row[],
) {
  const filters: Array<
    | {
        type: 'eq';
        column: keyof Row & string;
        value: unknown;
      }
    | {
        type: 'in';
        column: keyof Row & string;
        values: readonly unknown[];
      }
    | {
        type: 'order';
        column: keyof Row & string;
        ascending: boolean;
      }
  > = [];

  const builder = {
    eq(column: keyof Row & string, value: unknown) {
      filters.push({
        column,
        type: 'eq',
        value,
      });

      return builder;
    },
    in(column: keyof Row & string, values: readonly unknown[]) {
      filters.push({
        column,
        type: 'in',
        values,
      });

      return builder;
    },
    order(column: keyof Row & string, options: { ascending: boolean }) {
      filters.push({
        ascending: options.ascending,
        column,
        type: 'order',
      });

      return builder;
    },
    select() {
      return builder;
    },
    then<TResult1 = { data: Row[]; error: null }>(
      onFulfilled?:
        | ((value: {
            data: Row[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      const filteredRows = filters.reduce<readonly Row[]>(
        (resultRows, filter) => {
          if (filter.type === 'eq') {
            return resultRows.filter(
              (row) => row[filter.column] === filter.value,
            );
          }

          if (filter.type === 'in') {
            return resultRows.filter((row) =>
              filter.values.includes(row[filter.column]),
            );
          }

          const sortedRows = [...resultRows].sort((left, right) => {
            const leftValue = left[filter.column];
            const rightValue = right[filter.column];

            if (leftValue === rightValue) {
              return 0;
            }

            if (leftValue == null) {
              return filter.ascending ? -1 : 1;
            }

            if (rightValue == null) {
              return filter.ascending ? 1 : -1;
            }

            return String(leftValue).localeCompare(String(rightValue));
          });

          return filter.ascending ? sortedRows : sortedRows.reverse();
        },
        rows,
      );

      return Promise.resolve({
        data: [...filteredRows],
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createCatalogSupabaseClientMock({
  catalogRows = [],
  primaryThemeRows = [],
  latestOfferRows,
  merchantRows,
  offerSeedRows,
  sourceThemeRows = [],
  themeMappingRows = [],
}: {
  catalogRows?: readonly Record<string, unknown>[];
  primaryThemeRows?: readonly Record<string, unknown>[];
  latestOfferRows: readonly Record<string, unknown>[];
  merchantRows: readonly Record<string, unknown>[];
  offerSeedRows: readonly Record<string, unknown>[];
  sourceThemeRows?: readonly Record<string, unknown>[];
  themeMappingRows?: readonly Record<string, unknown>[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'catalog_sets') {
        return createSupabaseTableBuilder(catalogRows);
      }

      if (table === 'catalog_source_themes') {
        return createSupabaseTableBuilder(sourceThemeRows);
      }

      if (table === 'catalog_themes') {
        return createSupabaseTableBuilder(primaryThemeRows);
      }

      if (table === 'catalog_theme_mappings') {
        return createSupabaseTableBuilder(themeMappingRows);
      }

      if (table === 'commerce_offer_seeds') {
        return createSupabaseTableBuilder(offerSeedRows);
      }

      if (table === 'commerce_merchants') {
        return createSupabaseTableBuilder(merchantRows);
      }

      if (table === 'commerce_offer_latest') {
        return createSupabaseTableBuilder(latestOfferRows);
      }

      throw new Error(`Unexpected table requested in test: ${table}`);
    }),
  };
}

describe('catalog effective data access web', () => {
  afterEach(() => {
    resetWebCatalogSupabaseClientsForTests();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test('prefers normalized theme joins for UCS-like canonical reads', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
          name: 'Millennium Falcon',
          piece_count: 7541,
          primary_theme_id: 'theme:star-wars',
          release_year: 2017,
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:592',
          source_set_number: '75192-1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:592',
          source_theme_name: 'Ultimate Collector Series',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:star-wars',
          source_theme_id: 'rebrickable:592',
        },
      ],
    });

    const canonicalCatalogSet = await listCanonicalCatalogSets({
      supabaseClient,
    });

    expect(
      canonicalCatalogSet.find((set) => set.setId === '75192'),
    ).toMatchObject({
      primaryTheme: 'Star Wars',
      secondaryLabels: ['Ultimate Collector Series'],
    });
  });

  test('uses direct normalized themes for clean canonical reads', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
          name: 'Mario Kart - Mario & Standard Kart',
          piece_count: 1972,
          primary_theme_id: 'theme:super-mario',
          release_year: 2025,
          set_id: '72037',
          slug: 'mario-kart-mario-standard-kart-72037',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:695',
          source_set_number: '72037-1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Super Mario',
          id: 'theme:super-mario',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:695',
          source_theme_name: 'Super Mario',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:super-mario',
          source_theme_id: 'rebrickable:695',
        },
      ],
    });

    const [canonicalCatalogSet] = await Promise.all([
      listCanonicalCatalogSets({
        supabaseClient,
      }),
    ]);

    expect(canonicalCatalogSet[0]).toMatchObject({
      primaryTheme: 'Super Mario',
      secondaryLabels: [],
    });
  });

  test('uses only canonical Supabase-backed sets for canonical lookups', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell (Supabase)',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '10316-1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:721',
          source_theme_name: 'Icons',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:icons',
          source_theme_id: 'rebrickable:721',
        },
      ],
    });

    const canonicalCatalogSets = await listCanonicalCatalogSets({
      supabaseClient,
    });

    expect(canonicalCatalogSets).toHaveLength(1);
    expect(canonicalCatalogSets[0]).toMatchObject({
      name: 'Rivendell (Supabase)',
      setId: '10316',
      slug: 'lord-of-the-rings-rivendell-10316',
      source: 'rebrickable',
    });
  });

  test('loads public catalog SSR reads through service-role Supabase config when available', async () => {
    const createClientSpy = vi.mocked(supabaseSdk.createClient).mockReturnValue(
      createCatalogSupabaseClientMock({
        latestOfferRows: [],
        merchantRows: [],
        offerSeedRows: [],
        catalogRows: [
          {
            created_at: '2026-04-17T08:00:00.000Z',
            image_url:
              'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
            name: 'Rivendell',
            piece_count: 6167,
            primary_theme_id: 'theme:icons',
            release_year: 2023,
            set_id: '10316',
            slug: 'lord-of-the-rings-rivendell-10316',
            source: 'rebrickable',
            source_theme_id: 'rebrickable:721',
            source_set_number: '10316-1',
            status: 'active',
            updated_at: '2026-04-17T08:00:00.000Z',
          },
        ],
        primaryThemeRows: [
          {
            display_name: 'Icons',
            id: 'theme:icons',
          },
        ],
        sourceThemeRows: [
          {
            id: 'rebrickable:721',
            source_theme_name: 'Icons',
          },
        ],
        themeMappingRows: [
          {
            primary_theme_id: 'theme:icons',
            source_theme_id: 'rebrickable:721',
          },
        ],
      }) as ReturnType<typeof supabaseSdk.createClient>,
    );

    vi.spyOn(sharedConfig, 'hasServerSupabaseConfig').mockReturnValue(true);
    vi.spyOn(sharedConfig, 'hasBrowserSupabaseConfig').mockReturnValue(false);
    vi.spyOn(sharedConfig, 'getServerSupabaseConfig').mockReturnValue({
      serviceRoleKey: 'service-role-key',
      url: 'https://example.supabase.co',
    });

    const result = await listCanonicalCatalogSets();

    expect(result).toHaveLength(1);
    expect(createClientSpy).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      }),
    );
  });

  test('falls back to browser-safe anon Supabase config for public catalog SSR reads', async () => {
    const createClientSpy = vi.mocked(supabaseSdk.createClient).mockReturnValue(
      createCatalogSupabaseClientMock({
        latestOfferRows: [],
        merchantRows: [],
        offerSeedRows: [],
        catalogRows: [
          {
            created_at: '2026-04-17T08:00:00.000Z',
            image_url:
              'https://cdn.rebrickable.com/media/sets/21061-1/1000.jpg',
            name: 'Notre-Dame de Paris',
            piece_count: 4383,
            primary_theme_id: 'theme:architecture',
            release_year: 2024,
            set_id: '21061',
            slug: 'notre-dame-de-paris-21061',
            source: 'rebrickable',
            source_theme_id: 'rebrickable:249',
            source_set_number: '21061-1',
            status: 'active',
            updated_at: '2026-04-17T08:00:00.000Z',
          },
        ],
        primaryThemeRows: [
          {
            display_name: 'Architecture',
            id: 'theme:architecture',
          },
        ],
        sourceThemeRows: [
          {
            id: 'rebrickable:249',
            source_theme_name: 'Architecture',
          },
        ],
        themeMappingRows: [
          {
            primary_theme_id: 'theme:architecture',
            source_theme_id: 'rebrickable:249',
          },
        ],
      }) as ReturnType<typeof supabaseSdk.createClient>,
    );

    vi.spyOn(sharedConfig, 'hasServerSupabaseConfig').mockReturnValue(false);
    vi.spyOn(sharedConfig, 'hasBrowserSupabaseConfig').mockReturnValue(true);
    vi.spyOn(sharedConfig, 'getBrowserSupabaseConfig').mockReturnValue({
      anonKey: 'anon-key',
      url: 'https://example.supabase.co',
    });

    const result = await listCanonicalCatalogSets();

    expect(result).toHaveLength(1);
    expect(createClientSpy).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      }),
    );
  });

  test('returns an empty safe fallback when no Supabase read config is available', async () => {
    const createClientSpy = vi.mocked(supabaseSdk.createClient);

    vi.spyOn(sharedConfig, 'hasServerSupabaseConfig').mockReturnValue(false);
    vi.spyOn(sharedConfig, 'hasBrowserSupabaseConfig').mockReturnValue(false);

    await expect(listCanonicalCatalogSets()).resolves.toEqual([]);
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  test('does not fall back to snapshot canonical identity when a set is absent', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      listCanonicalCatalogSetsFn: async () => [],
      setId: '21061',
    });

    expect(canonicalCatalogSet).toBeUndefined();
  });

  test('keeps slug lookups stable through the canonical catalog layer', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
      listCanonicalCatalogSetsFn: async () => [createCanonicalCatalogSet()],
      slug: 'mario-kart-mario-standard-kart-72037',
    });

    expect(canonicalCatalogSet).toMatchObject({
      name: 'Mario Kart - Mario & Standard Kart',
      primaryTheme: 'Super Mario',
      setId: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      source: 'rebrickable',
    });
  });

  test('builds summaries and slugs from canonical catalog sets only', async () => {
    const summaries = await listCatalogSetSummaries({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          imageUrl:
            'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
          name: 'Rivendell (Supabase)',
          setId: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          sourceSetNumber: '10316-1',
          primaryTheme: 'Icons',
        }),
      ],
    });
    const slugs = await listCatalogSetSlugs({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          setId: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          sourceSetNumber: '10316-1',
          primaryTheme: 'Icons',
        }),
      ],
    });

    expect(summaries).toMatchObject([
      {
        id: '10316',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
        name: 'Rivendell (Supabase)',
        slug: 'lord-of-the-rings-rivendell-10316',
        theme: 'Icons',
      },
    ]);
    expect(slugs).toEqual(['lord-of-the-rings-rivendell-10316']);
  });

  test('preserves requested order for canonical set card reads', async () => {
    const result = await listCatalogSetCardsByIds({
      canonicalIds: ['10316', '21061', '10316'],
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Rivendell (Supabase)',
          setId: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          sourceSetNumber: '10316-1',
          primaryTheme: 'Icons',
        }),
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/21061-1/140433.jpg',
          name: 'Notre-Dame de Paris',
          pieceCount: 4382,
          releaseYear: 2024,
          setId: '21061',
          slug: 'notre-dame-de-paris-21061',
          sourceSetNumber: '21061-1',
          primaryTheme: 'Architecture',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
      '21061',
      '10316',
    ]);
  });

  test('selects homepage comparison discovery cards from explicit coverage, spread, and freshness signals', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        name: 'Technic Hypercar',
        setId: '42143',
        slug: 'technic-hypercar-42143',
        sourceSetNumber: '42143-1',
        primaryTheme: 'Technic',
      }),
      createCanonicalCatalogSet({
        name: 'Marvel Tower',
        pieceCount: 5201,
        releaseYear: 2023,
        setId: '76269',
        slug: 'marvel-tower-76269',
        sourceSetNumber: '76269-1',
        primaryTheme: 'Marvel',
      }),
      createCanonicalCatalogSet({
        name: 'Botanical Bouquet',
        pieceCount: 822,
        releaseYear: 2024,
        setId: '10313',
        slug: 'botanical-bouquet-10313',
        sourceSetNumber: '10313-1',
        primaryTheme: 'Botanicals',
      }),
      createCanonicalCatalogSet({
        name: 'Thin Coverage Set',
        setId: '10314',
        slug: 'thin-coverage-set-10314',
        sourceSetNumber: '10314-1',
        primaryTheme: 'Botanicals',
      }),
      createCanonicalCatalogSet({
        name: 'Ideas Showcase',
        pieceCount: 2600,
        releaseYear: 2024,
        setId: '21355',
        slug: 'ideas-showcase-21355',
        sourceSetNumber: '21355-1',
        primaryTheme: 'Ideas',
      }),
      createCanonicalCatalogSet({
        name: 'Star Wars Transport',
        pieceCount: 1400,
        releaseYear: 2025,
        setId: '75412',
        slug: 'star-wars-transport-75412',
        sourceSetNumber: '75412-1',
        primaryTheme: 'Star Wars',
      }),
      createCanonicalCatalogSet({
        name: 'Castle Expansion',
        pieceCount: 3300,
        releaseYear: 2025,
        setId: '10352',
        slug: 'castle-expansion-10352',
        sourceSetNumber: '10352-1',
        primaryTheme: 'Icons',
      }),
    ];

    const result = await listHomepageDealCandidateSetCards({
      limit: 6,
      listCanonicalCatalogSetsFn,
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '42143') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 38999,
            merchantCount: 5,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 14000,
            referenceDeltaMinor: -9000,
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 40999,
            merchantCount: 4,
            observedAt: '2026-04-20T09:00:00.000Z',
            priceSpreadMinor: 8000,
            referenceDeltaMinor: -5000,
          });
        }

        if (setId === '10313') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 4499,
            merchantCount: 3,
            observedAt: '2026-04-20T11:00:00.000Z',
            priceSpreadMinor: 1800,
            referenceDeltaMinor: -500,
          });
        }

        if (setId === '10314') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 6799,
            merchantCount: 1,
            observedAt: '2026-04-20T11:30:00.000Z',
            priceSpreadMinor: 0,
          });
        }

        if (setId === '21355') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 21999,
            merchantCount: 3,
            observedAt: '2026-04-19T09:00:00.000Z',
            priceSpreadMinor: 3200,
            referenceDeltaMinor: -1200,
          });
        }

        if (setId === '75412') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 15999,
            merchantCount: 4,
            observedAt: '2026-04-18T11:00:00.000Z',
            priceSpreadMinor: 2100,
            referenceDeltaMinor: -800,
          });
        }

        if (setId === '10352') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 28999,
            merchantCount: 2,
            observedAt: '2026-04-20T07:00:00.000Z',
            priceSpreadMinor: 2600,
            referenceDeltaMinor: -600,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '42143',
      '76269',
      '75412',
      '21355',
      '10313',
      '10352',
    ]);
  });

  test('selects homepage premium discovery cards by price level, spread, and coverage', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        name: 'Technic Hypercar',
        setId: '42143',
        slug: 'technic-hypercar-42143',
        sourceSetNumber: '42143-1',
        primaryTheme: 'Technic',
      }),
      createCanonicalCatalogSet({
        name: 'Rivendell',
        pieceCount: 6167,
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
        primaryTheme: 'Icons',
      }),
      createCanonicalCatalogSet({
        name: 'Avengers Tower',
        pieceCount: 5201,
        releaseYear: 2023,
        setId: '76269',
        slug: 'avengers-tower-76269',
        sourceSetNumber: '76269-1',
        primaryTheme: 'Marvel',
      }),
      createCanonicalCatalogSet({
        name: 'Art Print',
        pieceCount: 1200,
        releaseYear: 2024,
        setId: '31208',
        slug: 'art-print-31208',
        sourceSetNumber: '31208-1',
        primaryTheme: 'Art',
      }),
      createCanonicalCatalogSet({
        name: 'Cheap Set',
        pieceCount: 900,
        releaseYear: 2024,
        setId: '10311',
        slug: 'cheap-set-10311',
        sourceSetNumber: '10311-1',
        primaryTheme: 'Botanicals',
      }),
    ];

    const result = await listHomepageSetCards({
      excludedSetIds: ['42143'],
      limit: 3,
      listCanonicalCatalogSetsFn,
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '42143') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 38999,
            merchantCount: 5,
            priceSpreadMinor: 14000,
          });
        }

        if (setId === '10316') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 48246,
            merchantCount: 4,
            priceSpreadMinor: 5000,
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 40999,
            merchantCount: 4,
            priceSpreadMinor: 12000,
          });
        }

        if (setId === '31208') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 8299,
            merchantCount: 5,
            priceSpreadMinor: 2200,
          });
        }

        if (setId === '10311') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 3799,
            merchantCount: 5,
            priceSpreadMinor: 1600,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76269',
      '10316',
    ]);
  });

  test('searches canonical set cards without snapshot fallback', async () => {
    const results = await listCatalogSearchMatches({
      limit: 6,
      listCanonicalCatalogSetsFn: async () => [createCanonicalCatalogSet()],
      query: '72037',
    });

    expect(results[0]?.setCard).toMatchObject({
      id: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      theme: 'Super Mario',
    });
  });

  test('returns canonical suggestion cards sorted by recency and name', async () => {
    const result = await listCatalogSearchSuggestionSetCards({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          setId: '72038',
          slug: 'mario-kart-luigi-standard-kart-72038',
          sourceSetNumber: '72038-1',
          name: 'Mario Kart - Luigi & Standard Kart',
          releaseYear: 2024,
        }),
        createCanonicalCatalogSet(),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '72037',
      '72038',
    ]);
  });

  test('builds theme directory and homepage theme rails from canonical themes', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
        name: 'Rivendell',
        primaryTheme: 'Icons',
      }),
      createCanonicalCatalogSet({
        setId: '76269',
        slug: 'avengers-tower-76269',
        sourceSetNumber: '76269-1',
        name: 'Avengers Tower',
        primaryTheme: 'Marvel',
      }),
      createCanonicalCatalogSet({
        setId: '21348',
        slug: 'red-dragons-tale-21348',
        sourceSetNumber: '21348-1',
        name: "Dungeons & Dragons: Red Dragon's Tale",
        primaryTheme: 'Ideas',
      }),
      createCanonicalCatalogSet({
        setId: '75313',
        slug: 'at-at-75313',
        sourceSetNumber: '75313-1',
        name: 'AT-AT',
        primaryTheme: 'Star Wars',
      }),
      createCanonicalCatalogSet({
        setId: '76419',
        slug: 'hogwarts-castle-and-grounds-76419',
        sourceSetNumber: '76419-1',
        name: 'Hogwarts Castle and Grounds',
        primaryTheme: 'Harry Potter',
      }),
      createCanonicalCatalogSet({
        setId: '42143',
        slug: 'ferrari-daytona-sp3-42143',
        sourceSetNumber: '42143-1',
        name: 'Ferrari Daytona SP3',
        primaryTheme: 'Technic',
      }),
      createCanonicalCatalogSet({
        setId: '10280',
        slug: 'flower-bouquet-10280',
        sourceSetNumber: '10280-1',
        name: 'Flower Bouquet',
        primaryTheme: 'Botanicals',
      }),
    ];

    const [directoryItems, homepageItems, spotlightItems] = await Promise.all([
      listCatalogThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
      }),
      listHomepageThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
      }),
      listHomepageThemeSpotlightItems({
        listCanonicalCatalogSetsFn,
      }),
    ]);

    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Icons',
      'Marvel',
      'Ideas',
      'Star Wars',
      'Harry Potter',
      'Technic',
      'Botanicals',
    ]);
    expect(homepageItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Icons',
      'Marvel',
      'Ideas',
      'Star Wars',
      'Harry Potter',
      'Technic',
    ]);
    expect(spotlightItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Botanicals',
    ]);
  });

  test('builds theme pages and theme slugs from canonical theme groups', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
        name: 'Rebel U-Wing Starfighter',
        pieceCount: 594,
        releaseYear: 2026,
        setId: '75399',
        slug: 'rebel-u-wing-starfighter-75399',
        sourceSetNumber: '75399-1',
        primaryTheme: 'Star Wars',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/1000.jpg',
        name: 'AT-AT',
        pieceCount: 6785,
        releaseYear: 2021,
        setId: '75313',
        slug: 'at-at-75313',
        sourceSetNumber: '75313-1',
        primaryTheme: 'Star Wars',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
        name: 'Rivendell',
        pieceCount: 6167,
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
        primaryTheme: 'Icons',
      }),
    ];

    const [themePageSlugs, themePage] = await Promise.all([
      listCatalogThemePageSlugs({
        listCanonicalCatalogSetsFn,
      }),
      getCatalogThemePageBySlug({
        listCanonicalCatalogSetsFn,
        slug: buildCatalogThemeSlug('Star Wars'),
      }),
    ]);

    expect(themePageSlugs).toEqual(['icons', 'star-wars']);
    expect(themePage).toBeDefined();
    expect(themePage?.themeSnapshot.name).toBe('Star Wars');
    expect(
      themePage?.setCards.map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['75313', '75399']);
  });

  test('ranks theme-local discovery rails with the same comparison scoring', () => {
    const result = rankCatalogComparisonDiscoverySetCards({
      limit: 6,
      setCards: [
        {
          ...createCanonicalCatalogSet({
            name: 'Technic Hypercar',
            setId: '42143',
            slug: 'technic-hypercar-42143',
            sourceSetNumber: '42143-1',
            primaryTheme: 'Technic',
          }),
        },
        {
          ...createCanonicalCatalogSet({
            name: 'Mercedes-AMG F1 W14',
            setId: '42171',
            slug: 'mercedes-amg-f1-w14-42171',
            sourceSetNumber: '42171-1',
            primaryTheme: 'Technic',
          }),
        },
        {
          ...createCanonicalCatalogSet({
            name: 'Backhoe Loader',
            setId: '42197',
            slug: 'backhoe-loader-42197',
            sourceSetNumber: '42197-1',
            primaryTheme: 'Technic',
          }),
        },
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        slug: canonicalCatalogSet.slug,
        name: canonicalCatalogSet.name,
        theme: canonicalCatalogSet.primaryTheme,
        releaseYear: canonicalCatalogSet.releaseYear,
        pieces: canonicalCatalogSet.pieceCount,
        imageUrl: canonicalCatalogSet.imageUrl,
      })),
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '42143') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 38999,
            merchantCount: 5,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 11000,
            referenceDeltaMinor: -8000,
          });
        }

        if (setId === '42171') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 17999,
            merchantCount: 4,
            observedAt: '2026-04-20T11:00:00.000Z',
            priceSpreadMinor: 5000,
            referenceDeltaMinor: -3000,
          });
        }

        if (setId === '42197') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 9499,
            merchantCount: 2,
            observedAt: '2026-04-10T11:00:00.000Z',
            priceSpreadMinor: 900,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '42143',
      '42171',
      '42197',
    ]);
  });

  test('keeps discovery ranking deterministic when signals tie', () => {
    const result = rankCatalogComparisonDiscoverySetCards({
      limit: 3,
      setCards: [
        {
          id: 'A',
          imageUrl: undefined,
          name: 'Alpha',
          pieces: 1200,
          releaseYear: 2024,
          slug: 'alpha',
          theme: 'Icons',
        },
        {
          id: 'B',
          imageUrl: undefined,
          name: 'Beta',
          pieces: 1600,
          releaseYear: 2024,
          slug: 'beta',
          theme: 'Icons',
        },
        {
          id: 'C',
          imageUrl: undefined,
          name: 'Gamma',
          pieces: 900,
          releaseYear: 2023,
          slug: 'gamma',
          theme: 'Icons',
        },
      ],
      getCatalogDiscoverySignalFn: () =>
        createCatalogDiscoverySignal({
          bestPriceMinor: 24999,
          merchantCount: 4,
          observedAt: '2026-04-20T10:00:00.000Z',
          priceSpreadMinor: 4000,
          referenceDeltaMinor: -1500,
        }),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });

  test('ranks similar sets within the same theme and excludes the current set', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '10330',
        name: 'McLaren MP4/4 & Ayrton Senna',
        pieces: 693,
        releaseYear: 2024,
        theme: 'Icons',
      },
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10331') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 3999,
            merchantCount: 4,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 900,
          });
        }

        if (setId === '31208') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 8299,
            merchantCount: 5,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 2200,
          });
        }

        if (setId === '10311') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 3799,
            merchantCount: 5,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 1200,
          });
        }

        return undefined;
      },
      limit: 6,
      referenceBestPriceMinor: 4799,
      setCards: [
        createCanonicalCatalogSet({
          name: 'McLaren MP4/4 & Ayrton Senna',
          pieceCount: 693,
          primaryTheme: 'Icons',
          setId: '10330',
          slug: 'mclaren-mp4-4-ayrton-senna-10330',
          sourceSetNumber: '10330-1',
        }),
        createCanonicalCatalogSet({
          name: 'Kingfisher Bird',
          pieceCount: 834,
          primaryTheme: 'Icons',
          setId: '10331',
          slug: 'kingfisher-bird-10331',
          sourceSetNumber: '10331-1',
        }),
        createCanonicalCatalogSet({
          name: 'Hokusai - The Great Wave',
          pieceCount: 1810,
          primaryTheme: 'Art',
          setId: '31208',
          slug: 'hokusai-the-great-wave-31208',
          sourceSetNumber: '31208-1',
        }),
        createCanonicalCatalogSet({
          name: 'Orchid',
          pieceCount: 608,
          primaryTheme: 'Botanicals',
          setId: '10311',
          slug: 'orchid-10311',
          sourceSetNumber: '10311-1',
        }),
        createCanonicalCatalogSet({
          name: 'Tiny Plants',
          pieceCount: 758,
          primaryTheme: 'Icons',
          setId: '10329',
          slug: 'tiny-plants-10329',
          sourceSetNumber: '10329-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10331',
      '10329',
    ]);
  });

  test('boosts franchise-adjacent sets above generic same-theme sets when the rest is roughly competitive', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '10333',
        name: 'The Lord of the Rings: Barad-dur',
        pieces: 5471,
        releaseYear: 2024,
        theme: 'Icons',
      },
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10316') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 42999,
            merchantCount: 5,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 5000,
          });
        }

        if (setId === '10354') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 31999,
            merchantCount: 4,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 2400,
          });
        }

        if (setId === '10331') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 38999,
            merchantCount: 4,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 2100,
          });
        }

        if (setId === '10335') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 34999,
            merchantCount: 4,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 2600,
          });
        }

        return undefined;
      },
      limit: 6,
      referenceBestPriceMinor: 45999,
      setCards: [
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Barad-dur',
          pieceCount: 5471,
          primaryTheme: 'Icons',
          releaseYear: 2024,
          setId: '10333',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          sourceSetNumber: '10333-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Rivendell',
          pieceCount: 6167,
          primaryTheme: 'Icons',
          releaseYear: 2023,
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
          sourceSetNumber: '10316-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: The Shire',
          pieceCount: 2017,
          primaryTheme: 'Icons',
          releaseYear: 2025,
          setId: '10354',
          slug: 'the-lord-of-the-rings-the-shire-10354',
          sourceSetNumber: '10354-1',
        }),
        createCanonicalCatalogSet({
          name: 'Kingfisher Bird',
          pieceCount: 834,
          primaryTheme: 'Icons',
          releaseYear: 2024,
          setId: '10331',
          slug: 'kingfisher-bird-10331',
          sourceSetNumber: '10331-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Endurance',
          pieceCount: 3011,
          primaryTheme: 'Icons',
          releaseYear: 2024,
          setId: '10335',
          slug: 'the-endurance-10335',
          sourceSetNumber: '10335-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Book Nook',
          pieceCount: 1200,
          primaryTheme: 'Books',
          releaseYear: 2025,
          setId: '40699',
          slug: 'the-lord-of-the-rings-book-nook-40699',
          sourceSetNumber: '40699-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
      '10354',
      '10331',
      '10335',
    ]);
  });

  test('returns up to six similar sets and stays deterministic when scores tie', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '42172',
        name: 'McLaren P1',
        pieces: 3893,
        releaseYear: 2024,
        theme: 'Technic',
      },
      limit: 6,
      referenceBestPriceMinor: 34999,
      setCards: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((setId, index) => ({
        id: setId,
        imageUrl: undefined,
        name: `Technic ${setId}`,
        pieces: 3893,
        releaseYear: 2024 - (index % 2),
        slug: `technic-${setId.toLowerCase()}`,
        theme: 'Technic',
      })),
    });

    expect(result).toHaveLength(6);
    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      'A',
      'C',
      'E',
      'G',
      'B',
      'D',
    ]);
  });

  test('falls back to the available same-theme set count when a theme is shallow', async () => {
    const result = await listCatalogSimilarSetCards({
      currentSetCard: {
        id: '10330',
        name: 'McLaren MP4/4 & Ayrton Senna',
        pieces: 693,
        releaseYear: 2024,
        theme: 'Icons',
      },
      limit: 6,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'McLaren MP4/4 & Ayrton Senna',
          pieceCount: 693,
          primaryTheme: 'Icons',
          setId: '10330',
          slug: 'mclaren-mp4-4-ayrton-senna-10330',
          sourceSetNumber: '10330-1',
        }),
        createCanonicalCatalogSet({
          name: 'Kingfisher Bird',
          pieceCount: 834,
          primaryTheme: 'Icons',
          setId: '10331',
          slug: 'kingfisher-bird-10331',
          sourceSetNumber: '10331-1',
        }),
        createCanonicalCatalogSet({
          name: 'Wildflower Bouquet',
          pieceCount: 939,
          primaryTheme: 'Botanicals',
          setId: '10313',
          slug: 'wildflower-bouquet-10313',
          sourceSetNumber: '10313-1',
        }),
      ],
      referenceBestPriceMinor: 4799,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10331',
    ]);
  });

  test('builds discover browse theme groups from canonical theme data', async () => {
    const result = await listDiscoverBrowseThemeGroups({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          setId: '10316',
          slug: 'rivendell-10316',
          sourceSetNumber: '10316-1',
          name: 'Rivendell',
          primaryTheme: 'Icons',
        }),
        createCanonicalCatalogSet({
          setId: '10333',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          sourceSetNumber: '10333-1',
          name: 'The Lord of the Rings: Barad-dur',
          primaryTheme: 'Icons',
        }),
        createCanonicalCatalogSet({
          setId: '76269',
          slug: 'avengers-tower-76269',
          sourceSetNumber: '76269-1',
          name: 'Avengers Tower',
          primaryTheme: 'Marvel',
        }),
      ],
      setLimit: 6,
      themeLimit: 6,
    });

    expect(result.map((themeGroup) => themeGroup.theme)).toEqual([
      'Icons',
      'Marvel',
    ]);
    expect(result[0]?.totalSetCount).toBe(2);
  });

  test('normalizes public theme presentation from raw source theme labels', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        setId: '76269',
        slug: 'avengers-tower-76269',
        sourceSetNumber: '76269-1',
        name: 'Avengers Tower',
        primaryTheme: 'Super Heroes Marvel',
      }),
      createCanonicalCatalogSet({
        setId: '77243',
        slug: 'oracle-red-bull-racing-rb20-f1-race-car-77243',
        sourceSetNumber: '77243-1',
        name: 'Oracle Red Bull Racing RB20 F1 Race Car',
        primaryTheme: 'Speed Champions',
      }),
    ];

    const [setSummaries, directoryItems, themePage] = await Promise.all([
      listCatalogSetSummaries({
        listCanonicalCatalogSetsFn,
      }),
      listCatalogThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
      }),
      getCatalogThemePageBySlug({
        listCanonicalCatalogSetsFn,
        slug: 'marvel',
      }),
    ]);

    expect(
      setSummaries.map((catalogSetSummary) => catalogSetSummary.theme),
    ).toEqual(['Marvel', 'Speed Champions']);
    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Marvel',
      'Speed Champions',
    ]);
    expect(directoryItems[1]?.visual).toEqual({
      backgroundColor: '#3c5f96',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
      textColor: '#ffffff',
    });
    expect(themePage?.themeSnapshot.name).toBe('Marvel');
    expect(themePage?.setCards[0]?.theme).toBe('Marvel');
  });

  test('keeps discover highlight cards on canonical discover order', async () => {
    const result = await listDiscoverHighlightSetCards({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          setId: '76178',
          slug: 'daily-bugle-76178',
          sourceSetNumber: '76178-1',
          name: 'Daily Bugle',
          releaseYear: 2021,
          primaryTheme: 'Marvel',
        }),
        createCanonicalCatalogSet({
          setId: '75313',
          slug: 'at-at-75313',
          sourceSetNumber: '75313-1',
          name: 'AT-AT',
          releaseYear: 2021,
          primaryTheme: 'Star Wars',
        }),
        createCanonicalCatalogSet({
          setId: '10316',
          slug: 'rivendell-10316',
          sourceSetNumber: '10316-1',
          name: 'Rivendell',
          releaseYear: 2023,
          primaryTheme: 'Icons',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
      '76178',
      '75313',
    ]);
  });

  test('loads live valid offers from Supabase-backed commerce state', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'limited',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T11:44:00.000Z',
          offer_seed_id: 'seed-1',
          price_minor: 16541,
          updated_at: '2026-04-18T11:44:05.000Z',
        },
        {
          availability: 'out_of_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T11:40:00.000Z',
          offer_seed_id: 'seed-2',
          price_minor: 17240,
          updated_at: '2026-04-18T11:40:05.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-1',
          is_active: true,
          name: 'Proshop',
          slug: 'proshop',
        },
        {
          id: 'merchant-2',
          is_active: true,
          name: 'Amazon',
          slug: 'amazon-nl',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-1',
          is_active: true,
          merchant_id: 'merchant-1',
          product_url: 'https://www.proshop.nl/lego/21061',
          set_id: '21061',
          validation_status: 'valid',
        },
        {
          id: 'seed-2',
          is_active: true,
          merchant_id: 'merchant-2',
          product_url: 'https://www.amazon.nl/dp/21061',
          set_id: '21061',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogSetLiveOffersBySetId({
      setId: '21061',
      supabaseClient,
    });

    expect(result).toMatchObject([
      {
        merchantName: 'Proshop',
        priceCents: 16541,
        availability: 'in_stock',
      },
      {
        merchantName: 'Amazon',
        priceCents: 17240,
        availability: 'out_of_stock',
      },
    ]);
  });

  test('set-detail offer resolution and current summary stay aligned on live offers', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-04-18T11:45:00.000Z',
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Top1Toys',
        merchantSlug: 'top1toys',
        priceCents: 23999,
        setId: '75398',
        url: 'https://top1toys.nl/lego/75398',
      },
    ];
    const generatedOffers = [
      createCatalogOffer({
        merchantName: 'Top1Toys',
        priceCents: 23999,
        setId: '75398',
        url: 'https://brickhunt.nl/out/top1toys/75398',
      }),
    ];

    const detailOffers = resolveCatalogSetDetailOffers({
      generatedOffers,
      liveOffers,
    });
    const summary = summarizeCatalogCurrentOffers({
      generatedOffers,
      liveOffers,
      setId: '75398',
    });

    expect(detailOffers[0]).toMatchObject({
      merchantName: 'Top1Toys',
      priceCents: 23999,
      url: 'https://brickhunt.nl/out/top1toys/75398',
    });
    expect(summary.bestOffer).toMatchObject({
      merchantName: 'Top1Toys',
      priceCents: 23999,
    });
  });

  test('does not produce a current live offer summary when no live offers exist', async () => {
    const summary = await getCatalogCurrentOfferSummaryBySetId({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify([]), {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        }),
      ),
      setId: '71411',
    });

    expect(summary.bestOffer).toBeUndefined();
    expect(summary.offers).toEqual([]);
  });

  test('uses ISR-friendly API fetch caching when a public catalog route passes revalidateSeconds', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    await getCatalogCurrentOfferSummaryBySetId({
      cacheOptions: {
        revalidateSeconds: 300,
      },
      fetchImpl,
      setId: '71411',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/sets/71411/live-offers',
      expect.objectContaining({
        headers: {
          accept: 'application/json',
        },
        next: {
          revalidate: 300,
        },
      }),
    );
  });

  test('keeps live-offer API reads dynamic by default when no cache options are provided', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    await getCatalogCurrentOfferSummaryBySetId({
      fetchImpl,
      setId: '71411',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/sets/71411/live-offers',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      }),
    );
  });

  test('reads runtime catalog discovery signals through the public API with ISR-friendly caching', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            setId: '42172',
            bestPriceMinor: 32999,
            merchantCount: 4,
            nextBestPriceMinor: 35999,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 4000,
            referenceDeltaMinor: -2000,
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    const result = await listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: 300,
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/discovery-signals',
      expect.objectContaining({
        headers: {
          accept: 'application/json',
        },
        next: {
          revalidate: 300,
        },
      }),
    );
    expect(result.get('42172')).toEqual({
      bestPriceMinor: 32999,
      merchantCount: 4,
      nextBestPriceMinor: 35999,
      observedAt: '2026-04-20T10:00:00.000Z',
      priceSpreadMinor: 4000,
      referenceDeltaMinor: -2000,
    });
  });

  test('keeps runtime discovery signal API reads dynamic by default when no cache options are provided', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    await listCatalogDiscoverySignalsBySetId({
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/discovery-signals',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      }),
    );
  });

  test('can rerank discovery rails from runtime signal inputs without artifact-backed helpers', async () => {
    const firstFetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            setId: '42172',
            bestPriceMinor: 32999,
            merchantCount: 4,
            nextBestPriceMinor: 35999,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 4000,
            referenceDeltaMinor: -2000,
          },
          {
            setId: '10330',
            bestPriceMinor: 74999,
            merchantCount: 5,
            nextBestPriceMinor: 75999,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 1000,
            referenceDeltaMinor: -500,
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );
    const secondFetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            setId: '42172',
            bestPriceMinor: 34999,
            merchantCount: 2,
            nextBestPriceMinor: 35999,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 1000,
            referenceDeltaMinor: 0,
          },
          {
            setId: '10330',
            bestPriceMinor: 71999,
            merchantCount: 5,
            nextBestPriceMinor: 78999,
            observedAt: '2026-04-20T10:00:00.000Z',
            priceSpreadMinor: 7000,
            referenceDeltaMinor: -3000,
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );
    const setCards = [
      {
        id: '42172',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/42172-1/1000.jpg',
        name: 'McLaren P1',
        pieces: 3893,
        releaseYear: 2024,
        slug: 'mclaren-p1-42172',
        theme: 'Technic',
      },
      {
        id: '10330',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10330-1/1000.jpg',
        name: 'McLaren MP4/4 & Ayrton Senna',
        pieces: 693,
        releaseYear: 2024,
        slug: 'mclaren-mp4-4-ayrton-senna-10330',
        theme: 'Icons',
      },
    ];
    const firstSignalMap = await listCatalogDiscoverySignalsBySetId({
      fetchImpl: firstFetchImpl,
    });
    const secondSignalMap = await listCatalogDiscoverySignalsBySetId({
      fetchImpl: secondFetchImpl,
    });

    const firstResult = rankCatalogComparisonDiscoverySetCards({
      getCatalogDiscoverySignalFn: (setId) => firstSignalMap.get(setId),
      limit: 2,
      setCards,
    });
    const secondResult = rankCatalogComparisonDiscoverySetCards({
      getCatalogDiscoverySignalFn: (setId) => secondSignalMap.get(setId),
      limit: 2,
      setCards,
    });

    expect(firstResult.map((setCard) => setCard.id)).toEqual([
      '42172',
      '10330',
    ]);
    expect(secondResult.map((setCard) => setCard.id)).toEqual([
      '10330',
      '42172',
    ]);
  });

  test('generated fallback pricing does not masquerade as a live current best deal when no live offers exist', () => {
    const result = resolveCatalogCurrentOffers({
      generatedOffers: [
        createCatalogOffer({
          merchantName: 'LEGO',
          priceCents: 24999,
          setId: '71411',
          url: 'https://www.lego.com/nl-nl/product/71411',
        }),
      ],
      liveOffers: [],
    });

    expect(result).toEqual([]);
  });

  test('derives primary-offer unavailable state from active primary seeds without in-stock offers', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'out_of_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T11:40:00.000Z',
          offer_seed_id: 'seed-lego',
          price_minor: 4999,
          updated_at: '2026-04-18T11:40:05.000Z',
        },
        {
          availability: 'unavailable',
          currency_code: 'EUR',
          fetch_status: 'unavailable',
          observed_at: '2026-04-18T11:42:00.000Z',
          offer_seed_id: 'seed-bol',
          price_minor: null,
          updated_at: '2026-04-18T11:42:05.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-lego',
          is_active: true,
          name: 'LEGO',
          slug: 'lego-nl',
        },
        {
          id: 'merchant-bol',
          is_active: true,
          name: 'bol',
          slug: 'bol',
        },
        {
          id: 'merchant-top1toys',
          is_active: true,
          name: 'Top1Toys',
          slug: 'top1toys',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-lego',
          is_active: true,
          merchant_id: 'merchant-lego',
          product_url: 'https://www.lego.com/nl-nl/product/21340',
          set_id: '21340',
          validation_status: 'valid',
        },
        {
          id: 'seed-bol',
          is_active: true,
          merchant_id: 'merchant-bol',
          product_url: 'https://www.bol.com/nl/nl/p/21340',
          set_id: '21340',
          validation_status: 'valid',
        },
        {
          id: 'seed-top1toys',
          is_active: true,
          merchant_id: 'merchant-top1toys',
          product_url: 'https://www.top1toys.nl/21340',
          set_id: '21340',
          validation_status: 'valid',
        },
      ],
    });

    const result = await getCatalogPrimaryOfferAvailabilityStateBySetId({
      setId: '21340',
      supabaseClient,
    });

    expect(result).toEqual({
      latestPrimaryOfferCheckedAt: '2026-04-18T11:42:00.000Z',
      primaryMerchantCount: 2,
      primarySeedCount: 2,
      validPrimaryOfferCount: 0,
    });
  });

  test('counts in-stock primary offers only when a primary merchant is actually available', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T11:44:00.000Z',
          offer_seed_id: 'seed-lego',
          price_minor: 16999,
          updated_at: '2026-04-18T11:44:05.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-lego',
          is_active: true,
          name: 'LEGO',
          slug: 'lego-nl',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-lego',
          is_active: true,
          merchant_id: 'merchant-lego',
          product_url: 'https://www.lego.com/nl-nl/product/72037',
          set_id: '72037',
          validation_status: 'valid',
        },
      ],
    });

    const result = await getCatalogPrimaryOfferAvailabilityStateBySetId({
      setId: '72037',
      supabaseClient,
    });

    expect(result.validPrimaryOfferCount).toBe(1);
    expect(result.primarySeedCount).toBe(1);
  });
});
