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
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPrimaryOfferAvailabilityStateBySetId,
  getCatalogPartnerOfferRailDiagnostics,
  type CatalogResolvedOffer,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  listCatalogCurrentOfferSummaries,
  getCatalogCurrentOfferSummaryBySetId,
  getCatalogThemePageBySlug,
  getCatalogSetBySlug,
  listCanonicalCatalogSets,
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSearchMatches,
  listCatalogThemeSearchMatches,
  listCatalogSearchSuggestionSetCards,
  listCatalogSetCards,
  listCatalogSimilarSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
  listCatalogSetSummaries,
  listCatalogThemeDirectoryItems,
  listCatalogThemePageSlugs,
  listDiscoverBestDealSetCards,
  listDiscoverBrowseThemeGroups,
  listDiscoverForYouInterestingSetCards,
  listDiscoverNewInReleaseYearSetCards,
  listDiscoverHighlightSetCards,
  listDiscoverNewOnBrickhuntSetCards,
  listDiscoverNowInterestingSetCards,
  listDiscoverRecentPriceChangeSetCards,
  listDiscoverRecentlyReleasedSetCards,
  listHomepageDealCandidateSetCards,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  rankCatalogBestDealSetCards,
  rankCatalogComparisonDiscoverySetCards,
  rankCatalogPartnerOfferSetCards,
  rankCatalogNewInReleaseYearSetCards,
  rankCatalogNowInterestingSetCards,
  rankCatalogRecentPriceChangeSetCards,
  rankCatalogRecentlyReleasedSetCards,
  rankCatalogSimilarSetCards,
  resetWebCatalogSupabaseClientsForTests,
  resolveCatalogCurrentOffers,
  resolveHomepageFollowRailDiagnostics,
  selectCatalogFirstCommerceRailSetCards,
  selectCatalogThemeOfWeekRail,
  resolveCatalogSetDetailOffers,
  summarizeCatalogCurrentOffers,
} from './catalog-effective-data-access-web';

function createCanonicalCatalogSet(
  overrides: Partial<{
    createdAt: string;
    imageUrl?: string;
    name: string;
    pieceCount: number;
    releaseDate?: string;
    releaseDatePrecision?: 'day' | 'month' | 'year' | 'unknown';
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
    releaseDatePrecision: 'year' as const,
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
  options: {
    onSelect?: (args: unknown[]) => void;
  } = {},
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
    | {
        type: 'limit';
        count: number;
      }
    | {
        type: 'or';
        query: string;
      }
    | {
        type: 'range';
        from: number;
        to: number;
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
    limit(count: number) {
      filters.push({
        count,
        type: 'limit',
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
    or(query: string) {
      filters.push({
        query,
        type: 'or',
      });

      return builder;
    },
    range(from: number, to: number) {
      filters.push({
        from,
        to,
        type: 'range',
      });

      return builder;
    },
    select(...args: unknown[]) {
      options.onSelect?.(args);

      return builder;
    },
    maybeSingle() {
      return builder.then(({ data, error }) => ({
        data: data[0] ?? null,
        error,
      }));
    },
    then<TResult1 = { count: number; data: Row[]; error: null }>(
      onFulfilled?:
        | ((value: {
            count: number;
            data: Row[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      const countRows = filters.reduce<readonly Row[]>((resultRows, filter) => {
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

        return resultRows;
      }, rows);
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

          if (filter.type === 'limit') {
            return resultRows.slice(0, filter.count);
          }

          if (filter.type === 'or') {
            const clauses = filter.query.split(',').flatMap((clause) => {
              const [column, operator, pattern] = clause.split('.');

              return column && operator === 'ilike' && pattern
                ? [
                    {
                      column: column as keyof Row & string,
                      pattern: pattern.replace(/^%|%$/gu, '').toLowerCase(),
                    },
                  ]
                : [];
            });

            return resultRows.filter((row) =>
              clauses.some(({ column, pattern }) =>
                String(row[column] ?? '')
                  .toLowerCase()
                  .includes(pattern),
              ),
            );
          }

          if (filter.type === 'range') {
            return resultRows.slice(filter.from, filter.to + 1);
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
        count: countRows.length,
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
  onSelect,
  sourceThemeRows = [],
  themeMappingRows = [],
  themeSummaryRows = [],
}: {
  catalogRows?: readonly Record<string, unknown>[];
  primaryThemeRows?: readonly Record<string, unknown>[];
  latestOfferRows: readonly Record<string, unknown>[];
  merchantRows: readonly Record<string, unknown>[];
  offerSeedRows: readonly Record<string, unknown>[];
  onSelect?: (table: string, args: unknown[]) => void;
  sourceThemeRows?: readonly Record<string, unknown>[];
  themeMappingRows?: readonly Record<string, unknown>[];
  themeSummaryRows?: readonly Record<string, unknown>[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'catalog_sets') {
        return createSupabaseTableBuilder(catalogRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_source_themes') {
        return createSupabaseTableBuilder(sourceThemeRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_themes') {
        return createSupabaseTableBuilder(
          primaryThemeRows.map((primaryThemeRow) => ({
            is_public: true,
            status: 'active',
            ...primaryThemeRow,
          })),
          {
            onSelect: (args) => onSelect?.(table, args),
          },
        );
      }

      if (table === 'catalog_theme_mappings') {
        return createSupabaseTableBuilder(themeMappingRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_theme_summaries') {
        return createSupabaseTableBuilder(themeSummaryRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_offer_seeds') {
        return createSupabaseTableBuilder(offerSeedRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_merchants') {
        return createSupabaseTableBuilder(merchantRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_offer_latest') {
        return createSupabaseTableBuilder(latestOfferRows, {
          onSelect: (args) => onSelect?.(table, args),
        });
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
          slug: 'super-mario',
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
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '21061',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toBeUndefined();
  });

  test('normalizes source-style ids before canonical catalog set id reads', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/42177-1/1000.jpg',
          name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
          piece_count: 2891,
          primary_theme_id: 'theme:technic',
          release_date_precision: 'year',
          release_year: 2024,
          set_id: '42177',
          slug: 'mercedes-benz-g-500-professional-line-42177',
          source: 'rebrickable',
          source_set_number: '42177-1',
          source_theme_id: 'rebrickable:1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Technic',
          id: 'theme:technic',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:1',
          source_theme_name: 'Technic',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:technic',
          source_theme_id: 'rebrickable:1',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '42177-1',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      setId: '42177',
      sourceSetNumber: '42177-1',
    });
  });

  test('keeps slug lookups stable through the canonical catalog layer', async () => {
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
          release_date_precision: 'year',
          release_year: 2025,
          set_id: '72037',
          slug: 'mario-kart-mario-standard-kart-72037',
          source: 'rebrickable',
          source_set_number: '72037-1',
          source_theme_id: 'rebrickable:690',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Super Mario',
          id: 'theme:super-mario',
          slug: 'super-mario',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:690',
          source_theme_name: 'Super Mario',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:super-mario',
          source_theme_id: 'rebrickable:690',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
      slug: 'mario-kart-mario-standard-kart-72037',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      name: 'Mario Kart - Mario & Standard Kart',
      primaryTheme: 'Super Mario',
      publicTheme: {
        name: 'Super Mario',
        slug: 'super-mario',
      },
      setId: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      source: 'rebrickable',
    });
  });

  test('prefers a public mapped parent theme for set detail links when primary theme is hidden', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.example.com/43020.jpg',
          name: 'Nike Dunk x LEGO',
          piece_count: 1180,
          primary_theme_id: 'theme:other',
          release_date_precision: 'year',
          release_year: 2026,
          set_id: '43020',
          slug: 'nike-dunk-x-lego-43020',
          source: 'rebrickable',
          source_set_number: '43020-1',
          source_theme_id: 'rebrickable:editions',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Other',
          id: 'theme:other',
          is_public: false,
          slug: 'other',
          status: 'active',
        },
        {
          display_name: 'Editions',
          id: 'theme:editions',
          is_public: true,
          public_display_name: 'LEGO® Editions',
          slug: 'editions',
          status: 'active',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:editions',
          source_theme_name: 'Nike x LEGO® collectie',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:editions',
          source_theme_id: 'rebrickable:editions',
        },
      ],
    });

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'nike-dunk-x-lego-43020',
      supabaseClient,
    });

    expect(catalogSetDetail).toMatchObject({
      publicTheme: {
        name: 'LEGO® Editions',
        slug: 'editions',
      },
      subtheme: 'Nike x LEGO® collectie',
      theme: 'LEGO® Editions',
    });
  });

  test('does not expose a public theme link target for hidden primary themes', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.example.com/99999.jpg',
          name: 'Internal test set',
          piece_count: 100,
          primary_theme_id: 'theme:other',
          release_date_precision: 'year',
          release_year: 2026,
          set_id: '99999',
          slug: 'internal-test-set-99999',
          source: 'rebrickable',
          source_set_number: '99999-1',
          source_theme_id: 'rebrickable:other',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Other',
          id: 'theme:other',
          is_public: false,
          slug: 'other',
          status: 'active',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:other',
          source_theme_name: 'Other',
        },
      ],
      themeMappingRows: [],
    });

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'internal-test-set-99999',
      supabaseClient,
    });

    expect(catalogSetDetail).toMatchObject({
      theme: 'Other',
    });
    expect(catalogSetDetail?.publicTheme).toBeUndefined();
  });

  test('paginates public catalog set card reads from Supabase', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
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
          source_set_number: '72037-1',
          source_theme_id: 'rebrickable:690',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
        },
        {
          display_name: 'Super Mario',
          id: 'theme:super-mario',
        },
      ],
    });

    await expect(
      listCatalogSetCards({
        limit: 1,
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '10316',
      }),
    ]);
  });

  test('builds public theme directory from paginated Supabase catalog cards', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75313-1/1000.jpg',
          name: 'AT-AT',
          piece_count: 6785,
          primary_theme_id: 'theme:star-wars',
          release_year: 2021,
          set_id: '75313',
          slug: 'at-at-75313',
          source: 'rebrickable',
          source_set_number: '75313-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          slug: 'icons',
          status: 'active',
        },
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          slug: 'star-wars',
          status: 'active',
        },
      ],
    });

    await expect(
      listCatalogThemeDirectoryItems({
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        themeSnapshot: expect.objectContaining({
          name: 'LEGO® Icons',
        }),
      }),
      expect.objectContaining({
        themeSnapshot: expect.objectContaining({
          name: 'Star Wars™',
        }),
      }),
    ]);
    expect(supabaseClient.from).toHaveBeenCalledWith('catalog_sets');
  });

  test('deduplicates repeated logical theme rows from the public theme directory', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10317-1/1000.jpg',
          name: 'Land Rover Classic Defender 90',
          piece_count: 2336,
          primary_theme_id: 'theme:icons-duplicate',
          release_year: 2023,
          set_id: '10317',
          slug: 'land-rover-classic-defender-90-10317',
          source: 'rebrickable',
          source_set_number: '10317-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          slug: 'icons',
          status: 'active',
        },
        {
          display_name: 'Icons',
          id: 'theme:icons-duplicate',
          slug: 'icons-duplicate',
          status: 'active',
        },
      ],
    });

    const directoryItems = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(
      directoryItems.filter(
        (directoryItem) => directoryItem.themeSnapshot.name === 'LEGO® Icons',
      ),
    ).toHaveLength(1);
  });

  test('builds public theme directory from theme rows beyond the catalog set page', async () => {
    const catalogRows = Array.from({ length: 241 }, (_, index) => ({
      created_at: `2026-04-${String(Math.max(1, 28 - (index % 20))).padStart(
        2,
        '0',
      )}T08:00:00.000Z`,
      image_url: `https://cdn.example.com/city-${index}.jpg`,
      name: `City Set ${index}`,
      piece_count: 100 + index,
      primary_theme_id: 'theme:city',
      release_year: 2025,
      set_id: `60${String(index).padStart(3, '0')}`,
      slug: `city-set-${index}`,
      source: 'rebrickable',
      source_set_number: `60${String(index).padStart(3, '0')}-1`,
      source_theme_id: 'rebrickable:52',
      status: 'active',
      updated_at: '2026-04-18T08:00:00.000Z',
    }));
    catalogRows.push({
      created_at: '2025-01-01T08:00:00.000Z',
      image_url: 'https://cdn.rebrickable.com/media/sets/75313-1/1000.jpg',
      name: 'AT-AT',
      piece_count: 6785,
      primary_theme_id: 'theme:star-wars',
      release_year: 2021,
      set_id: '75313',
      slug: 'at-at-75313',
      source: 'rebrickable',
      source_set_number: '75313-1',
      source_theme_id: 'rebrickable:158',
      status: 'active',
      updated_at: '2025-01-01T08:00:00.000Z',
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows,
      primaryThemeRows: [
        {
          display_name: 'City',
          id: 'theme:city',
          slug: 'city',
          status: 'active',
        },
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          slug: 'star-wars',
          status: 'active',
        },
      ],
    });

    const directoryItems = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(
      directoryItems.map((directoryItem) => directoryItem.themeSnapshot.name),
    ).toEqual(expect.arrayContaining(['City', 'Star Wars™']));
    expect(
      directoryItems.find(
        (directoryItem) => directoryItem.themeSnapshot.name === 'City',
      )?.themeSnapshot.setCount,
    ).toBe(241);
  });

  test('hides non-public source subthemes from the public theme directory while keeping mapped sets under the public parent', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/71039-1/1000.jpg',
          name: 'Marvel Series 2 Minifigure',
          piece_count: 8,
          primary_theme_id: 'theme:marvel',
          release_year: 2023,
          set_id: '71039',
          slug: 'marvel-series-2-minifigure-71039',
          source: 'rebrickable',
          source_set_number: '71039-1',
          source_theme_id: 'rebrickable:71039',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Marvel',
          id: 'theme:marvel',
          is_public: true,
          public_order: 1,
          slug: 'marvel',
          status: 'active',
        },
        {
          display_name: 'Marvel Series 2',
          id: 'theme:marvel-series-2',
          is_public: false,
          public_order: null,
          slug: 'marvel-series-2',
          status: 'active',
        },
        {
          display_name: 'Advent',
          id: 'theme:advent',
          is_public: false,
          public_order: null,
          slug: 'advent',
          status: 'active',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:71039',
          source_theme_name: 'Marvel Series 2',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:marvel',
          source_theme_id: 'rebrickable:71039',
        },
      ],
    });

    const [directoryItems, themePageSlugs, hiddenThemePage] = await Promise.all(
      [
        listCatalogThemeDirectoryItems({
          supabaseClient,
        }),
        listCatalogThemePageSlugs({
          supabaseClient,
        }),
        getCatalogThemePageBySlug({
          slug: 'marvel-series-2',
          supabaseClient,
        }),
      ],
    );

    expect(
      directoryItems.map((directoryItem) => directoryItem.themeSnapshot.slug),
    ).toEqual(['marvel']);
    expect(directoryItems[0]?.themeSnapshot.setCount).toBe(1);
    expect(directoryItems[0]?.themeSnapshot.name).toBe('Marvel');
    expect(themePageSlugs).toEqual(['marvel']);
    expect(hiddenThemePage).toBeUndefined();
  });

  test('uses public theme presentation metadata while keeping image fallback behavior', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/icons-representative.jpg',
          name: 'Natural History Museum',
          piece_count: 4014,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10326',
          slug: 'natural-history-museum-10326',
          source: 'rebrickable',
          source_set_number: '10326-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/city-representative.jpg',
          name: 'Snackbartruck',
          piece_count: 406,
          primary_theme_id: 'theme:city',
          release_year: 2025,
          set_id: '60488',
          slug: 'snackbartruck-60488',
          source: 'rebrickable',
          source_set_number: '60488-1',
          source_theme_id: 'rebrickable:52',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          public_accent_color: '#123abc',
          public_description: 'Grote blikvangers voor op de plank.',
          public_display_name: 'Custom Icons',
          public_image_url: 'https://cdn.example.com/custom-icons.jpg',
          public_logo_url: 'https://cdn.example.com/icons-logo.svg',
          public_order: 1,
          slug: 'icons',
          status: 'active',
        },
        {
          display_name: 'City',
          id: 'theme:city',
          is_public: true,
          public_accent_color: 'javascript:alert(1)',
          public_description: null,
          public_display_name: null,
          public_image_url: null,
          public_logo_url: null,
          public_order: 2,
          slug: 'city',
          status: 'active',
        },
      ],
    });

    const [iconsItem, cityItem] = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(iconsItem?.themeSnapshot).toMatchObject({
      momentum: 'Grote blikvangers voor op de plank.',
      name: 'Custom Icons',
      slug: 'icons',
    });
    expect(iconsItem?.imageUrl).toBe(
      'https://cdn.example.com/custom-icons.jpg',
    );
    expect(iconsItem?.visual).toMatchObject({
      backgroundColor: '#123abc',
      imageUrl: 'https://cdn.example.com/custom-icons.jpg',
    });
    expect(cityItem?.themeSnapshot.name).toBe('City');
    expect(cityItem?.imageUrl).toBe(
      'https://cdn.example.com/city-representative.jpg',
    );
    expect(cityItem?.visual?.backgroundColor).toBe('#2f7fc0');
    expect(cityItem?.visual?.imageUrl).toBe(
      'https://cdn.example.com/city-representative.jpg',
    );
  });

  test('returns server-paginated theme pages with the total theme set count', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75313-1/1000.jpg',
          name: 'AT-AT',
          piece_count: 6785,
          primary_theme_id: 'theme:star-wars',
          release_year: 2021,
          set_id: '75313',
          slug: 'at-at-75313',
          source: 'rebrickable',
          source_set_number: '75313-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
          name: 'Rebel U-Wing Starfighter',
          piece_count: 594,
          primary_theme_id: 'theme:star-wars',
          release_year: 2021,
          set_id: '75399',
          slug: 'rebel-u-wing-starfighter-75399',
          source: 'rebrickable',
          source_set_number: '75399-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          slug: 'star-wars',
          status: 'active',
        },
      ],
    });

    const themePage = await getCatalogThemePageBySlug({
      limit: 1,
      offset: 1,
      slug: 'star-wars',
      supabaseClient,
    });

    expect(themePage?.themeSnapshot.setCount).toBe(2);
    expect(themePage?.setCards.map((setCard) => setCard.id)).toEqual(['75399']);
  });

  test('fetches only the requested page for large theme detail pages', async () => {
    const catalogRows = Array.from({ length: 1001 }, (_, index) => {
      const setNumber = String(70_000 + index);

      return {
        created_at: '2026-04-18T08:00:00.000Z',
        image_url: `https://cdn.example.com/star-wars-${setNumber}.jpg`,
        name: `Star Wars Set ${String(index).padStart(4, '0')}`,
        piece_count: 100 + index,
        primary_theme_id: 'theme:star-wars',
        release_year: 2026,
        set_id: setNumber,
        slug: `star-wars-set-${setNumber}`,
        source: 'rebrickable',
        source_set_number: `${setNumber}-1`,
        source_theme_id: 'rebrickable:158',
        status: 'active',
        updated_at: '2026-04-18T08:00:00.000Z',
      };
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows,
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          public_order: 1,
          slug: 'star-wars',
          status: 'active',
        },
      ],
    });

    const themePage = await getCatalogThemePageBySlug({
      limit: 20,
      offset: 20,
      slug: 'star-wars',
      supabaseClient,
    });

    expect(themePage?.themeSnapshot.setCount).toBe(1001);
    expect(themePage?.setCards).toHaveLength(20);
    expect(themePage?.setCards[0]?.id).toBe('70020');
    expect(themePage?.setCards.at(-1)?.id).toBe('70039');
  });

  test('uses cached theme summaries for theme detail pagination without exact counts', async () => {
    const catalogSetSelects: unknown[][] = [];
    const catalogRows = Array.from({ length: 12 }, (_, index) => {
      const setNumber = String(75_300 + index);

      return {
        created_at: '2026-04-18T08:00:00.000Z',
        image_url: `https://cdn.example.com/star-wars-${setNumber}.jpg`,
        name: `Star Wars Set ${String(index).padStart(2, '0')}`,
        piece_count: 100 + index,
        primary_theme_id: 'theme:star-wars',
        release_year: 2026,
        set_id: setNumber,
        slug: `star-wars-set-${setNumber}`,
        source: 'rebrickable',
        source_set_number: `${setNumber}-1`,
        source_theme_id: 'rebrickable:158',
        status: 'active',
        updated_at: '2026-04-18T08:00:00.000Z',
      };
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows,
      onSelect: (table, args) => {
        if (table === 'catalog_sets') {
          catalogSetSelects.push(args);
        }
      },
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          slug: 'star-wars',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 1001,
          representative_image_url: 'https://cdn.example.com/star-wars.jpg',
          representative_set_id: '75300',
          theme_id: 'theme:star-wars',
        },
      ],
    });

    const themePage = await getCatalogThemePageBySlug({
      limit: 6,
      offset: 6,
      slug: 'star-wars',
      supabaseClient,
    });

    expect(themePage?.themeSnapshot.setCount).toBe(1001);
    expect(themePage?.setCards).toHaveLength(6);
    expect(
      catalogSetSelects.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'object' &&
            arg !== null &&
            (arg as { count?: unknown }).count === 'exact',
        ),
      ),
    ).toBe(false);
  });

  test('uses cached theme summaries for the theme directory without per-theme exact counts', async () => {
    const catalogSetSelects: unknown[][] = [];
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [],
      onSelect: (table, args) => {
        if (table === 'catalog_sets') {
          catalogSetSelects.push(args);
        }
      },
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          public_order: 1,
          slug: 'star-wars',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 1166,
          representative_image_url: 'https://cdn.example.com/star-wars.jpg',
          representative_set_id: '75355',
          theme_id: 'theme:star-wars',
        },
      ],
    });

    const [directoryItem] = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(directoryItem?.themeSnapshot.setCount).toBe(1166);
    expect(directoryItem?.imageUrl).toBe(
      'https://cdn.example.com/star-wars.jpg',
    );
    expect(catalogSetSelects).toHaveLength(0);
  });

  test('renders public curated Editions in the theme directory using representative summary image fallback', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [],
      primaryThemeRows: [
        {
          display_name: 'Zeta Theme',
          id: 'theme:zeta',
          is_public: true,
          public_order: 1,
          slug: 'zeta-theme',
          status: 'active',
        },
        {
          display_name: 'Editions',
          id: 'theme:editions',
          is_public: true,
          public_accent_color: '#e0b84f',
          public_image_url: null,
          public_order: 325,
          slug: 'editions',
          status: 'active',
        },
        {
          display_name: 'Alpha Theme',
          id: 'theme:alpha',
          is_public: true,
          public_order: 400,
          slug: 'alpha-theme',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 3,
          representative_image_url: 'https://cdn.example.com/zeta.jpg',
          representative_set_id: '10001',
          theme_id: 'theme:zeta',
        },
        {
          active_set_count: 14,
          representative_image_url: 'https://cdn.example.com/editions.jpg',
          representative_set_id: '50001',
          theme_id: 'theme:editions',
        },
        {
          active_set_count: 2,
          representative_image_url: 'https://cdn.example.com/alpha.jpg',
          representative_set_id: '90001',
          theme_id: 'theme:alpha',
        },
      ],
    });

    const directoryItems = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });
    const editionsItem = directoryItems.find(
      (directoryItem) => directoryItem.themeSnapshot.slug === 'editions',
    );

    expect(directoryItems.map((item) => item.themeSnapshot.slug)).toEqual([
      'zeta-theme',
      'editions',
      'alpha-theme',
    ]);
    expect(editionsItem?.themeSnapshot).toMatchObject({
      name: 'Editions',
      setCount: 14,
      signatureSet: 'Editions',
      slug: 'editions',
    });
    expect(editionsItem?.imageUrl).toBe('https://cdn.example.com/editions.jpg');
    expect(editionsItem?.visual?.backgroundColor).toBe('#e0b84f');
    expect(editionsItem?.visual?.textColor).toBe('#171a22');
    expect(editionsItem?.visual?.imageUrl).toBe(
      'https://cdn.example.com/editions.jpg',
    );
  });

  test('passes curated public theme visual metadata to theme detail pages', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/editions-set.jpg',
          name: 'Nike Dunk x LEGO Set',
          piece_count: 1180,
          primary_theme_id: 'theme:editions',
          release_year: 2026,
          set_id: '43020',
          slug: 'nike-dunk-x-lego-set-43020',
          source: 'rebrickable',
          source_set_number: '43020-1',
          source_theme_id: 'rebrickable:editions',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Editions',
          id: 'theme:editions',
          is_public: true,
          public_accent_color: '#e0b84f',
          public_image_url: 'https://cdn.example.com/editions-public.jpg',
          public_order: 325,
          slug: 'editions',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 14,
          representative_image_url:
            'https://cdn.example.com/editions-summary.jpg',
          representative_set_id: '43020',
          theme_id: 'theme:editions',
        },
      ],
    });

    const themePage = await getCatalogThemePageBySlug({
      slug: 'editions',
      supabaseClient,
    });

    expect(themePage?.themeSnapshot).toMatchObject({
      name: 'Editions',
      setCount: 14,
      slug: 'editions',
    });
    expect(themePage?.visual).toEqual({
      backgroundColor: '#e0b84f',
      imageUrl: 'https://cdn.example.com/editions-public.jpg',
      textColor: '#171a22',
    });
  });

  test('uses curated Animal Crossing visuals for public directory and detail pages', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/animal-crossing-set.jpg',
          name: "Kapp'n's Island Boat Tour",
          piece_count: 233,
          primary_theme_id: 'theme:animal-crossing',
          release_year: 2024,
          set_id: '77048',
          slug: 'kappns-island-boat-tour-77048',
          source: 'rebrickable',
          source_set_number: '77048-1',
          source_theme_id: 'rebrickable:animal-crossing',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Animal Crossing',
          id: 'theme:animal-crossing',
          is_public: true,
          public_accent_color: null,
          public_display_name: 'LEGO® Animal Crossing™',
          public_image_url: null,
          public_order: 10,
          slug: 'animal-crossing',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 9,
          representative_image_url:
            'https://cdn.example.com/animal-crossing-summary.jpg',
          representative_set_id: '77048',
          theme_id: 'theme:animal-crossing',
        },
      ],
    });

    const [directoryItem, themePage] = await Promise.all([
      listCatalogThemeDirectoryItems({
        supabaseClient,
      }).then((items) =>
        items.find((item) => item.themeSnapshot.slug === 'animal-crossing'),
      ),
      getCatalogThemePageBySlug({
        slug: 'animal-crossing',
        supabaseClient,
      }),
    ]);

    expect(directoryItem?.imageUrl).toBe(
      'https://cdn.example.com/animal-crossing-summary.jpg',
    );
    expect(directoryItem?.visual).toEqual({
      backgroundColor: '#6bbf59',
      imageUrl: 'https://cdn.example.com/animal-crossing-summary.jpg',
      textColor: '#10241f',
    });
    expect(themePage?.themeSnapshot.name).toBe('LEGO® Animal Crossing™');
    expect(themePage?.visual).toEqual({
      backgroundColor: '#6bbf59',
      imageUrl: 'https://cdn.example.com/animal-crossing-summary.jpg',
      textColor: '#10241f',
    });
  });

  test('loads catalog cards by id without a full catalog read', async () => {
    const listCanonicalCatalogSetsFn = vi.fn(async () => []);
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
        },
      ],
    });

    await expect(
      listCatalogSetCardsByIds({
        canonicalIds: ['10316'],
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '10316',
      }),
    ]);
    expect(listCanonicalCatalogSetsFn).not.toHaveBeenCalled();
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
        theme: 'Lord of the Rings™',
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

  test('selects homepage follow discovery cards by set interest, signals, and rotation', async () => {
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
      '10316',
      '76269',
      '31208',
    ]);
  });

  test('rotates homepage follow discovery cards when scores tie', async () => {
    const ids = ['42143', '76269', '10316', '21355'];
    const listCanonicalCatalogSetsFn = async () =>
      ids.map((setId) =>
        createCanonicalCatalogSet({
          name: `Display Set ${setId}`,
          pieceCount: 2000,
          releaseYear: 2024,
          setId,
          slug: `display-set-${setId}`,
          sourceSetNumber: `${setId}-1`,
          primaryTheme: 'Icons',
        }),
      );
    const getCatalogDiscoverySignalFn = () =>
      createCatalogDiscoverySignal({
        bestPriceMinor: 19999,
        merchantCount: 3,
        priceSpreadMinor: 3000,
      });

    const firstSeedResult = await listHomepageSetCards({
      getCatalogDiscoverySignalFn,
      limit: 2,
      listCanonicalCatalogSetsFn,
      rotationSeed: 1,
    });
    const secondSeedResult = await listHomepageSetCards({
      getCatalogDiscoverySignalFn,
      limit: 2,
      listCanonicalCatalogSetsFn,
      rotationSeed: 2,
    });

    expect(
      firstSeedResult.map((catalogSetCard) => catalogSetCard.id),
    ).not.toEqual(secondSeedResult.map((catalogSetCard) => catalogSetCard.id));
  });

  test('expands homepage follow discovery to aspirational upcoming and iconic sets', async () => {
    const aspirationalSets = Array.from({ length: 24 }, (_, index) => {
      const setNumber = (75_400 + index).toString();
      const theme =
        index % 3 === 0
          ? 'Star Wars'
          : index % 3 === 1
            ? 'Icons'
            : 'Architecture';

      return createCanonicalCatalogSet({
        imageUrl: `https://images.example/${setNumber}.jpg`,
        name:
          theme === 'Architecture'
            ? `Architecture Skyline Display ${setNumber}`
            : `Display Ship ${setNumber}`,
        pieceCount: 900 + index * 80,
        primaryTheme: theme,
        releaseDate: `2026-0${(index % 3) + 6}-01`,
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: setNumber,
        slug: `display-set-${setNumber}`,
        sourceSetNumber: `${setNumber}-1`,
      });
    });
    const fillerSet = createCanonicalCatalogSet({
      imageUrl: 'https://images.example/30701.jpg',
      name: 'Small Polybag',
      pieceCount: 48,
      primaryTheme: 'City',
      releaseYear: 2026,
      setId: '30701',
      slug: 'small-polybag-30701',
      sourceSetNumber: '30701-1',
    });
    const listCanonicalCatalogSetsFn = async () => [
      ...aspirationalSets,
      fillerSet,
    ];
    const getCatalogDiscoverySignalFn = (setId: string) =>
      setId === '30701'
        ? createCatalogDiscoverySignal({
            bestPriceMinor: 399,
            merchantCount: 1,
            priceSpreadMinor: 0,
          })
        : undefined;

    const result = await listHomepageSetCards({
      excludedSetIds: ['75400'],
      getCatalogDiscoverySignalFn,
      limit: 20,
      listCanonicalCatalogSetsFn,
      rotationSeed: 7,
    });

    expect(result).toHaveLength(20);
    expect(result.map((catalogSetCard) => catalogSetCard.id)).not.toContain(
      '75400',
    );
    expect(result.map((catalogSetCard) => catalogSetCard.id)).not.toContain(
      '30701',
    );
    expect(
      result.some((catalogSetCard) => catalogSetCard.releaseYear === 2026),
    ).toBe(true);
    expect(
      result.every((catalogSetCard) =>
        ['architecture', 'icons', 'star-wars'].includes(
          buildCatalogThemeSlug(catalogSetCard.theme),
        ),
      ),
    ).toBe(true);
  });

  test('uses dynamic homepage follow selector even without discovery signals', async () => {
    const dynamicSets = Array.from({ length: 22 }, (_, index) => {
      const setNumber = (76_000 + index).toString();
      const primaryTheme =
        index % 4 === 0
          ? 'Star Wars'
          : index % 4 === 1
            ? 'Architecture'
            : index % 4 === 2
              ? 'Icons'
              : 'Harry Potter';

      return createCanonicalCatalogSet({
        imageUrl: `https://images.example/${setNumber}.jpg`,
        name:
          primaryTheme === 'Star Wars'
            ? `Imperial Display Ship ${setNumber}`
            : primaryTheme === 'Architecture'
              ? `Architecture Landmark Skyline ${setNumber}`
              : `Large Display Model ${setNumber}`,
        pieceCount: 900 + index * 75,
        primaryTheme,
        releaseDate: `2026-0${(index % 4) + 5}-01`,
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: setNumber,
        slug: `dynamic-follow-set-${setNumber}`,
        sourceSetNumber: `${setNumber}-1`,
      });
    });
    const staticFallbackSets = [
      createCanonicalCatalogSet({
        name: 'Rivendell',
        pieceCount: 6167,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
      }),
      createCanonicalCatalogSet({
        name: 'Barad-dûr',
        pieceCount: 5471,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2024,
        setId: '10333',
        slug: 'barad-dur-10333',
        sourceSetNumber: '10333-1',
      }),
      createCanonicalCatalogSet({
        name: 'The Starry Night',
        pieceCount: 2316,
        primaryTheme: 'Ideas',
        releaseYear: 2022,
        setId: '21333',
        slug: 'the-starry-night-21333',
        sourceSetNumber: '21333-1',
      }),
    ];

    const result = await listHomepageSetCards({
      limit: 20,
      listCanonicalCatalogSetsFn: async () => [
        ...staticFallbackSets,
        ...dynamicSets,
      ],
      rotationSeed: 9,
    });

    expect(result).toHaveLength(20);
    expect(result.map((catalogSetCard) => catalogSetCard.id)).not.toEqual([
      '10316',
      '10333',
      '21333',
    ]);
    expect(
      result.some((catalogSetCard) => catalogSetCard.releaseYear === 2026),
    ).toBe(true);
  });

  test('prioritizes iconic visually impressive follow candidates without signals', async () => {
    const iconicSets = [
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/rivendell.jpg',
        name: 'Rivendell',
        pieceCount: 6167,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/barad-dur.jpg',
        name: 'Barad-dûr',
        pieceCount: 5471,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2024,
        setId: '10333',
        slug: 'barad-dur-10333',
        sourceSetNumber: '10333-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/starry-night.jpg',
        name: 'The Starry Night',
        pieceCount: 2316,
        primaryTheme: 'Ideas',
        releaseYear: 2022,
        setId: '21333',
        slug: 'the-starry-night-21333',
        sourceSetNumber: '21333-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/atat.jpg',
        name: 'UCS AT-AT',
        pieceCount: 6785,
        primaryTheme: 'Star Wars',
        releaseYear: 2021,
        setId: '75313',
        slug: 'ucs-at-at-75313',
        sourceSetNumber: '75313-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/hogwarts.jpg',
        name: 'Hogwarts Castle Display',
        pieceCount: 2660,
        primaryTheme: 'Harry Potter',
        releaseYear: 2026,
        setId: '76499',
        slug: 'hogwarts-castle-display-76499',
        sourceSetNumber: '76499-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/nyc.jpg',
        name: 'Architecture New York City Skyline',
        pieceCount: 1465,
        primaryTheme: 'Architecture',
        releaseYear: 2026,
        setId: '21066',
        slug: 'architecture-new-york-city-skyline-21066',
        sourceSetNumber: '21066-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/ferrari.jpg',
        name: 'Technic Ferrari F1 Flagship Vehicle',
        pieceCount: 1361,
        primaryTheme: 'Technic',
        releaseYear: 2026,
        setId: '42207',
        slug: 'technic-ferrari-f1-flagship-vehicle-42207',
        sourceSetNumber: '42207-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/orchid.jpg',
        name: 'Botanicals Orchid Display',
        pieceCount: 608,
        primaryTheme: 'Botanicals',
        releaseYear: 2026,
        setId: '10311',
        slug: 'botanicals-orchid-display-10311',
        sourceSetNumber: '10311-1',
      }),
    ];
    const fillerSets = Array.from({ length: 16 }, (_, index) => {
      const setNumber = (30_700 + index).toString();

      return createCanonicalCatalogSet({
        imageUrl: `https://images.example/${setNumber}.jpg`,
        name: `Small City Starter Set ${setNumber}`,
        pieceCount: 180,
        primaryTheme: 'City',
        releaseDate: '2026-06-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: setNumber,
        slug: `small-city-starter-set-${setNumber}`,
        sourceSetNumber: `${setNumber}-1`,
      });
    });

    const result = await listHomepageSetCards({
      limit: 20,
      listCanonicalCatalogSetsFn: async () => [...fillerSets, ...iconicSets],
      rotationSeed: 6,
    });
    const resultIds = result.map((catalogSetCard) => catalogSetCard.id);

    expect(resultIds).toEqual(
      expect.arrayContaining([
        '10316',
        '10333',
        '21333',
        '75313',
        '76499',
        '21066',
        '42207',
        '10311',
      ]),
    );
    expect(
      result.every((catalogSetCard) => !catalogSetCard.id.startsWith('307')),
    ).toBe(true);
    expect(
      new Set(
        result.map((catalogSetCard) =>
          buildCatalogThemeSlug(catalogSetCard.theme),
        ),
      ).size,
    ).toBeGreaterThanOrEqual(6);
  });

  test('uses static homepage follow fallback only when dynamic candidates are empty', async () => {
    const fallbackOnlySets = ['10316', '10333', '21333'].map(
      (setNumber, index) =>
        createCanonicalCatalogSet({
          imageUrl: undefined,
          name: `Small Fallback Set ${setNumber}`,
          pieceCount: 40 + index,
          primaryTheme: 'City',
          releaseYear: 2019,
          setId: setNumber,
          slug: `small-fallback-set-${setNumber}`,
          sourceSetNumber: `${setNumber}-1`,
        }),
    );
    const result = await listHomepageSetCards({
      limit: 20,
      listCanonicalCatalogSetsFn: async () => fallbackOnlySets,
      rotationSeed: 4,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
      '10333',
      '21333',
    ]);
  });

  test('reports homepage follow diagnostics for selected dynamic ids', async () => {
    const dynamicSets = Array.from({ length: 20 }, (_, index) => {
      const setNumber = (77_000 + index).toString();

      return createCanonicalCatalogSet({
        imageUrl: `https://images.example/${setNumber}.jpg`,
        name: `Star Wars Display Ship ${setNumber}`,
        pieceCount: 1000 + index * 60,
        primaryTheme: index % 2 === 0 ? 'Star Wars' : 'Icons',
        releaseDate: '2026-06-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: setNumber,
        slug: `diagnostic-follow-set-${setNumber}`,
        sourceSetNumber: `${setNumber}-1`,
      });
    });

    const diagnostics = await resolveHomepageFollowRailDiagnostics({
      excludedSetIds: ['77000'],
      limit: 20,
      listCanonicalCatalogSetsFn: async () => dynamicSets,
      rotationSeed: 12,
    });

    expect(diagnostics).toMatchObject({
      excludedSetIds: ['77000'],
      rawCandidateCount: 20,
      selectedCount: 19,
      source: 'dynamic',
    });
    expect(diagnostics.selectedSetIds).not.toContain('77000');
    expect(diagnostics.selectedSetIds.length).toBe(19);
  });

  test('balances legendary display sets with fresh picks across themes', async () => {
    const canonicalSets = [
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/rivendell.jpg',
        name: 'Rivendell',
        pieceCount: 6167,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/barad-dur.jpg',
        name: 'Barad-dûr',
        pieceCount: 5471,
        primaryTheme: 'Lord of the Rings',
        releaseYear: 2024,
        setId: '10333',
        slug: 'barad-dur-10333',
        sourceSetNumber: '10333-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/starry-night.jpg',
        name: 'The Starry Night',
        pieceCount: 2316,
        primaryTheme: 'Ideas',
        releaseYear: 2022,
        setId: '21333',
        slug: 'the-starry-night-21333',
        sourceSetNumber: '21333-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/shuttle.jpg',
        name: 'Imperial Lambda-Class Shuttle',
        pieceCount: 1234,
        primaryTheme: 'Star Wars',
        releaseDate: '2026-07-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: '75459',
        slug: 'imperial-lambda-class-shuttle-75459',
        sourceSetNumber: '75459-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/nyc.jpg',
        name: 'New York City Skyline Display',
        pieceCount: 1465,
        primaryTheme: 'Architecture',
        releaseDate: '2026-06-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
        setId: '21066',
        slug: 'new-york-city-skyline-21066',
        sourceSetNumber: '21066-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/hogwarts.jpg',
        name: 'Hogwarts Castle Display',
        pieceCount: 2660,
        primaryTheme: 'Harry Potter',
        releaseYear: 2026,
        setId: '76499',
        slug: 'hogwarts-castle-display-76499',
        sourceSetNumber: '76499-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://images.example/polybag.jpg',
        name: 'Tiny City Polybag',
        pieceCount: 45,
        primaryTheme: 'City',
        releaseYear: 2026,
        setId: '30699',
        slug: 'tiny-city-polybag-30699',
        sourceSetNumber: '30699-1',
      }),
    ];
    const getCatalogDiscoverySignalFn = () =>
      createCatalogDiscoverySignal({
        bestPriceMinor: 19999,
        merchantCount: 3,
        priceSpreadMinor: 3000,
      });

    const result = await listHomepageSetCards({
      getCatalogDiscoverySignalFn,
      limit: 5,
      listCanonicalCatalogSetsFn: async () => canonicalSets,
      rotationSeed: 11,
    });
    const resultThemeSlugs = new Set(
      result.map((catalogSetCard) =>
        buildCatalogThemeSlug(catalogSetCard.theme),
      ),
    );

    expect(result).toHaveLength(5);
    expect(resultThemeSlugs.size).toBeGreaterThanOrEqual(4);
    expect(
      result.filter(
        (catalogSetCard) =>
          buildCatalogThemeSlug(catalogSetCard.theme) === 'lord-of-the-rings',
      ),
    ).toHaveLength(1);
    expect(result.map((catalogSetCard) => catalogSetCard.id)).toContain(
      '75459',
    );
    expect(result.map((catalogSetCard) => catalogSetCard.id)).not.toContain(
      '30699',
    );
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
      theme: 'LEGO® Super Mario™',
    });
  });

  test('searches Supabase catalog sets directly by set number', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/42177.jpg',
          name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
          piece_count: 2891,
          primary_theme_id: 'theme:technic',
          release_date: null,
          release_date_precision: null,
          release_year: 2024,
          set_id: '42177',
          slug: 'mercedes-benz-g-500-professional-line-42177',
          source: 'rebrickable',
          source_set_number: '42177-1',
          source_theme_id: 'rebrickable:1',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/75398.jpg',
          name: 'C-3PO',
          piece_count: 1138,
          primary_theme_id: 'theme:star-wars',
          release_date: null,
          release_date_precision: null,
          release_year: 2024,
          set_id: '75398',
          slug: 'c-3po-75398',
          source: 'rebrickable',
          source_set_number: '75398-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/75440.jpg',
          name: 'AT-AT',
          piece_count: 1555,
          primary_theme_id: 'theme:star-wars',
          release_date: null,
          release_date_precision: null,
          release_year: 2025,
          set_id: '75440',
          slug: 'at-at-75440',
          source: 'rebrickable',
          source_set_number: '75440-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Technic',
          id: 'theme:technic',
        },
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
    });

    await expect(
      listCatalogSearchMatches({
        query: '42177',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '42177',
          name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: '75398',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75398',
          name: 'C-3PO',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: '75440',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75440',
          name: 'AT-AT',
        }),
      }),
    ]);
  });

  test('searches Supabase catalog sets directly by name and slug', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/42177.jpg',
          name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
          piece_count: 2891,
          primary_theme_id: 'theme:technic',
          release_date: null,
          release_date_precision: null,
          release_year: 2024,
          set_id: '42177',
          slug: 'mercedes-benz-g-500-professional-line-42177',
          source: 'rebrickable',
          source_set_number: '42177-1',
          source_theme_id: 'rebrickable:1',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/75398.jpg',
          name: 'C-3PO',
          piece_count: 1138,
          primary_theme_id: 'theme:star-wars',
          release_date: null,
          release_date_precision: null,
          release_year: 2024,
          set_id: '75398',
          slug: 'c-3po-75398',
          source: 'rebrickable',
          source_set_number: '75398-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/75440.jpg',
          name: 'AT-AT',
          piece_count: 1555,
          primary_theme_id: 'theme:star-wars',
          release_date: null,
          release_date_precision: null,
          release_year: 2025,
          set_id: '75440',
          slug: 'at-at-75440',
          source: 'rebrickable',
          source_set_number: '75440-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Technic',
          id: 'theme:technic',
        },
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
    });

    await expect(
      listCatalogSearchMatches({
        query: 'Mercedes-Benz G 500',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '42177',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'C-3PO',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75398',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'AT-AT',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75440',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'mercedes-benz-g-500-professional-line-42177',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '42177',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'c-3po-75398',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75398',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'at-at-75440',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '75440',
        }),
      }),
    ]);
  });

  test('searches theme directory items with prefix ranking', async () => {
    const results = await listCatalogThemeSearchMatches({
      limit: 6,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'AT-AT',
          primaryTheme: 'Star Wars',
          setId: '75313',
          slug: 'at-at-75313',
          sourceSetNumber: '75313-1',
        }),
        createCanonicalCatalogSet({
          name: 'Hogwarts Castle and Grounds',
          primaryTheme: 'Harry Potter',
          setId: '76419',
          slug: 'hogwarts-castle-and-grounds-76419',
          sourceSetNumber: '76419-1',
        }),
      ],
      query: 'Star War',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.theme.themeSnapshot).toMatchObject({
      name: 'Star Wars™',
      slug: 'star-wars',
      setCount: 1,
    });
    expect(results[0]?.score).toBe(1);
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
      'Botanicals',
      'Harry Potter™',
      'Ideas',
      'LEGO® Icons',
      'Marvel',
      'Star Wars™',
      'Technic',
    ]);
    expect(homepageItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Star Wars™',
      'Marvel',
      'Harry Potter™',
      'LEGO® Icons',
      'Botanicals',
      'Ideas',
    ]);
    expect(spotlightItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Technic',
    ]);
  });

  test('gives directory items explicit visuals for canonical themes that previously fell back', async () => {
    const [cityItem, zeldaItem] = await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          setId: '60488',
          slug: 'snackbartruck-60488',
          sourceSetNumber: '60488-1',
          name: 'Snackbartruck',
          primaryTheme: 'City',
        }),
        createCanonicalCatalogSet({
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          sourceSetNumber: '77092-1',
          name: 'Great Deku Tree 2-in-1',
          primaryTheme: 'The Legend of Zelda',
        }),
      ],
    });

    expect(cityItem?.themeSnapshot.name).toBe('City');
    expect(cityItem?.visual).toMatchObject({
      backgroundColor: '#2f7fc0',
      textColor: '#ffffff',
    });
    expect(zeldaItem?.themeSnapshot.name).toBe('LEGO® The Legend of Zelda™');
    expect(zeldaItem?.visual).toMatchObject({
      backgroundColor: '#4d8b72',
      textColor: '#ffffff',
    });
  });

  test('uses registry image set overrides for theme directory tiles', async () => {
    const [starWarsItem] = await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/75399.jpg',
          name: 'Rebel U-Wing Starfighter',
          primaryTheme: 'Star Wars',
          setId: '75399',
          slug: 'rebel-u-wing-starfighter-75399',
          sourceSetNumber: '75399-1',
        }),
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/75313.jpg',
          name: 'AT-AT',
          primaryTheme: 'Star Wars',
          setId: '75313',
          slug: 'at-at-75313',
          sourceSetNumber: '75313-1',
        }),
      ],
    });

    expect(starWarsItem?.themeSnapshot.name).toBe('Star Wars™');
    expect(starWarsItem?.imageUrl).toBe('https://cdn.example.com/75313.jpg');
  });

  test('shows catalog product-line themes automatically and hides utility themes', async () => {
    const directoryItems = await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Barad-dur',
          primaryTheme: 'Lord of the Rings',
          setId: '10333',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          sourceSetNumber: '10333-1',
        }),
        createCanonicalCatalogSet({
          name: 'LEGO Gear Backpack',
          primaryTheme: 'Gear',
          setId: '5009999',
          slug: 'lego-gear-backpack-5009999',
          sourceSetNumber: '5009999-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Book Nook',
          primaryTheme: 'Books',
          setId: '40699',
          slug: 'the-lord-of-the-rings-book-nook-40699',
          sourceSetNumber: '40699-1',
        }),
      ],
    });

    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Lord of the Rings™',
    ]);
    expect(directoryItems[0]?.themeSnapshot.setCount).toBe(1);
  });

  test('groups realistic Icons-backed Lord of the Rings catalog sets by context', async () => {
    const directoryItems = await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/10316.jpg',
          name: 'Rivendell',
          primaryTheme: 'Icons',
          setId: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          sourceSetNumber: '10316-1',
        }),
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/10333.jpg',
          name: 'The Lord of the Rings: Barad-dur',
          primaryTheme: 'Icons',
          setId: '10333',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          sourceSetNumber: '10333-1',
        }),
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/10354.jpg',
          name: 'The Lord of the Rings: The Shire',
          primaryTheme: 'Icons',
          setId: '10354',
          slug: 'the-lord-of-the-rings-the-shire-10354',
          sourceSetNumber: '10354-1',
        }),
        createCanonicalCatalogSet({
          imageUrl: 'https://cdn.example.com/10326.jpg',
          name: 'Natural History Museum',
          primaryTheme: 'Icons',
          setId: '10326',
          slug: 'natural-history-museum-10326',
          sourceSetNumber: '10326-1',
        }),
      ],
    });

    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'LEGO® Icons',
      'Lord of the Rings™',
    ]);
    expect(
      directoryItems.find(
        (item) => item.themeSnapshot.slug === 'lord-of-the-rings',
      )?.themeSnapshot.setCount,
    ).toBe(3);
    expect(
      directoryItems.find((item) => item.themeSnapshot.slug === 'icons')
        ?.themeSnapshot.setCount,
    ).toBe(1);
    expect(
      directoryItems.find((item) => item.themeSnapshot.slug === 'icons')
        ?.imageUrl,
    ).toBe('https://cdn.example.com/10326.jpg');
    expect(
      directoryItems.find(
        (item) => item.themeSnapshot.slug === 'lord-of-the-rings',
      )?.imageUrl,
    ).toBe('https://cdn.example.com/10333.jpg');
    expect(
      directoryItems.find((item) => item.themeSnapshot.slug === 'icons')
        ?.imageUrl,
    ).not.toBe(
      directoryItems.find(
        (item) => item.themeSnapshot.slug === 'lord-of-the-rings',
      )?.imageUrl,
    );
  });

  test('folds Skylines sets into Architecture theme directory items', async () => {
    const directoryItems = await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'London',
          primaryTheme: 'Skylines',
          releaseYear: 2017,
          setId: '21034',
          slug: 'london-21034',
          sourceSetNumber: '21034-1',
        }),
        createCanonicalCatalogSet({
          name: 'Trevifontein',
          primaryTheme: 'Architecture',
          setId: '21062',
          slug: 'trevifontein-21062',
          sourceSetNumber: '21062-1',
        }),
      ],
    });

    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Architecture',
    ]);
    expect(directoryItems[0]?.themeSnapshot.setCount).toBe(2);
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
    expect(themePage?.themeSnapshot.name).toBe('Star Wars™');
    expect(
      themePage?.setCards.map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['75313', '75399']);
  });

  test('folds legacy derived primary themes into canonical browse groups and hides parked themes', async () => {
    const listCanonicalCatalogSetsFn = async () => [
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10326-1/1000.jpg',
        name: 'Natural History Museum',
        pieceCount: 4014,
        primaryTheme: 'Modular Buildings',
        releaseYear: 2023,
        secondaryLabels: ['Modular Buildings'],
        setId: '10326',
        slug: 'natural-history-museum-10326',
        sourceSetNumber: '10326-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
        name: 'Rivendell',
        pieceCount: 6167,
        primaryTheme: 'Icons',
        releaseYear: 2023,
        setId: '10316',
        slug: 'rivendell-10316',
        sourceSetNumber: '10316-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/40634-1/1000.jpg',
        name: 'Official FIFA World Cup Trophy',
        pieceCount: 605,
        primaryTheme: 'Other',
        releaseYear: 2022,
        secondaryLabels: ['Editions'],
        setId: '40634',
        slug: 'official-fifa-world-cup-trophy-40634',
        sourceSetNumber: '40634-1',
      }),
      createCanonicalCatalogSet({
        imageUrl: 'https://cdn.rebrickable.com/media/sets/42244-1/1000.jpg',
        name: 'Lewis Hamilton Helmet',
        pieceCount: 650,
        primaryTheme: 'Other',
        releaseYear: 2026,
        setId: '42244',
        slug: 'lewis-hamilton-helmet-42244',
        sourceSetNumber: '42244-1',
      }),
    ];

    const [directoryItems, themePageSlugs, iconsThemePage] = await Promise.all([
      listCatalogThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
      }),
      listCatalogThemePageSlugs({
        listCanonicalCatalogSetsFn,
      }),
      getCatalogThemePageBySlug({
        listCanonicalCatalogSetsFn,
        slug: 'icons',
      }),
    ]);

    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual(
      expect.arrayContaining(['LEGO® Icons', 'Speed Champions']),
    );
    expect(directoryItems.map((item) => item.themeSnapshot.name)).not.toContain(
      'Other',
    );
    expect(themePageSlugs).toEqual(
      expect.arrayContaining(['icons', 'speed-champions']),
    );
    expect(themePageSlugs).not.toContain('other');
    expect(
      iconsThemePage?.setCards.map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['10316', '10326']);
    expect(iconsThemePage?.setCards[1]?.theme).toBe('LEGO® Icons');
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

  test('ranks recent price-change rails from runtime history movement and comparison context', () => {
    const result = rankCatalogRecentPriceChangeSetCards({
      limit: 6,
      setCards: [
        {
          id: '10316',
          imageUrl: undefined,
          name: 'Rivendell',
          pieces: 6167,
          releaseYear: 2023,
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
        {
          id: '10333',
          imageUrl: undefined,
          name: 'The Lord of the Rings: Barad-dur',
          pieces: 5471,
          releaseYear: 2024,
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          theme: 'Icons',
        },
        {
          id: '42172',
          imageUrl: undefined,
          name: 'McLaren P1',
          pieces: 3893,
          releaseYear: 2024,
          slug: 'mclaren-p1-42172',
          theme: 'Technic',
        },
        {
          id: '31208',
          imageUrl: undefined,
          name: 'Hokusai - The Great Wave',
          pieces: 1810,
          releaseYear: 2023,
          slug: 'hokusai-the-great-wave-31208',
          theme: 'Art',
        },
      ],
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10316') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 7000,
            recentReferencePriceChangeMinor: -2800,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 8 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '10333') {
          return createCatalogDiscoverySignal({
            merchantCount: 5,
            priceSpreadMinor: 9000,
            recentReferencePriceChangeMinor: -2400,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '42172') {
          return createCatalogDiscoverySignal({
            merchantCount: 3,
            priceSpreadMinor: 6000,
            recentReferencePriceChangeMinor: 0,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '31208') {
          return createCatalogDiscoverySignal({
            merchantCount: 1,
            priceSpreadMinor: 2000,
            recentReferencePriceChangeMinor: -2500,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10333',
      '10316',
    ]);
  });

  test('ranks best deals only when a set is below its recent reference', () => {
    const result = rankCatalogBestDealSetCards({
      limit: 6,
      rotationSeed: 1,
      setCards: [
        {
          id: '42143',
          imageUrl: undefined,
          name: 'Ferrari Daytona SP3',
          pieces: 3778,
          releaseYear: 2022,
          slug: 'ferrari-daytona-sp3-42143',
          theme: 'Technic',
        },
        {
          id: '76269',
          imageUrl: undefined,
          name: 'Avengers Tower',
          pieces: 5201,
          releaseYear: 2023,
          slug: 'avengers-tower-76269',
          theme: 'Marvel',
        },
        {
          id: '10316',
          imageUrl: undefined,
          name: 'Rivendell',
          pieces: 6167,
          releaseYear: 2023,
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
      ],
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '42143') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 9000,
            referenceDeltaMinor: -9000,
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            merchantCount: 3,
            priceSpreadMinor: 6000,
            referenceDeltaMinor: 0,
          });
        }

        if (setId === '10316') {
          return createCatalogDiscoverySignal({
            merchantCount: 3,
            priceSpreadMinor: 5000,
            referenceDeltaMinor: 2500,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '42143',
    ]);
  });

  test('rotates tied commerce rails by refresh bucket', () => {
    const setCards = [
      {
        id: '10316',
        imageUrl: undefined,
        name: 'Rivendell',
        pieces: 6167,
        releaseYear: 2023,
        slug: 'rivendell-10316',
        theme: 'Icons',
      },
      {
        id: '76269',
        imageUrl: undefined,
        name: 'Avengers Tower',
        pieces: 5201,
        releaseYear: 2023,
        slug: 'avengers-tower-76269',
        theme: 'Marvel',
      },
      {
        id: '42172',
        imageUrl: undefined,
        name: 'McLaren P1',
        pieces: 3893,
        releaseYear: 2024,
        slug: 'mclaren-p1-42172',
        theme: 'Technic',
      },
    ];
    const getCatalogDiscoverySignalFn = () =>
      createCatalogDiscoverySignal({
        merchantCount: 4,
        priceSpreadMinor: 5000,
        referenceDeltaMinor: -2000,
      });

    const firstRefresh = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn,
      limit: 3,
      rotationSeed: 1,
      setCards,
    }).map((catalogSetCard) => catalogSetCard.id);
    const secondRefresh = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn,
      limit: 3,
      rotationSeed: 2,
      setCards,
    }).map((catalogSetCard) => catalogSetCard.id);

    expect(firstRefresh).not.toEqual(secondRefresh);
  });

  test('treats a recent price drop as a best-deal signal without requiring reference discount', () => {
    const result = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        setId === '43247'
          ? createCatalogDiscoverySignal({
              merchantCount: 2,
              priceSpreadMinor: 1200,
              recentReferencePriceChangeMinor: -900,
              recentReferencePriceChangedAt: new Date(
                Date.now() - 3 * 60 * 60 * 1000,
              ).toISOString(),
              referenceDeltaMinor: undefined,
            })
          : undefined,
      limit: 6,
      setCards: [
        {
          id: '43247',
          imageUrl: undefined,
          name: 'Young Simba the Lion King',
          pieces: 1445,
          releaseYear: 2024,
          slug: 'young-simba-the-lion-king-43247',
          theme: 'Disney',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '43247',
    ]);
  });

  test('ranks partner offer rails from valid priced affiliate offers', () => {
    const setCards = [
      {
        id: '10316',
        imageUrl: undefined,
        name: 'Rivendell',
        pieces: 6167,
        releaseYear: 2023,
        slug: 'rivendell-10316',
        theme: 'Icons',
      },
      {
        id: '76269',
        imageUrl: undefined,
        name: 'Avengers Tower',
        pieces: 5201,
        releaseYear: 2023,
        slug: 'avengers-tower-76269',
        theme: 'Marvel',
      },
      {
        id: '42172',
        imageUrl: undefined,
        name: 'McLaren P1',
        pieces: 3893,
        releaseYear: 2024,
        slug: 'mclaren-p1-42172',
        theme: 'Technic',
      },
      {
        id: '31208',
        imageUrl: undefined,
        name: 'Hokusai - The Great Wave',
        pieces: 1810,
        releaseYear: 2023,
        slug: 'hokusai-the-great-wave-31208',
        theme: 'Art',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '10316',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 42999,
            setId: '10316',
            url: 'https://partner.example/rivendell',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              priceCents: 42999,
              setId: '10316',
              url: 'https://partner.example/rivendell',
            }),
          ],
          setId: '10316',
        },
      ],
      [
        '76269',
        {
          bestOffer: createCatalogOffer({
            availability: 'out_of_stock',
            priceCents: 47999,
            setId: '76269',
            url: 'https://partner.example/avengers',
          }),
          offers: [],
          setId: '76269',
        },
      ],
      [
        '42172',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 0,
            setId: '42172',
            url: 'https://partner.example/mclaren',
          }),
          offers: [],
          setId: '42172',
        },
      ],
      [
        '31208',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 6999,
            setId: '31208',
            url: '',
          }),
          offers: [],
          setId: '31208',
        },
      ],
    ]);

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map([
        [
          '10316',
          createCatalogDiscoverySignal({
            priceSpreadMinor: 8000,
            referenceDeltaMinor: -5000,
          }),
        ],
      ]),
      currentOfferSummaryBySetId,
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
    ]);
  });

  test('excludes already rendered sets from the broader partner offer rail', () => {
    const setCards = [
      {
        id: '10316',
        imageUrl: undefined,
        name: 'Rivendell',
        pieces: 6167,
        releaseYear: 2023,
        slug: 'rivendell-10316',
        theme: 'Icons',
      },
      {
        id: '76269',
        imageUrl: undefined,
        name: 'Avengers Tower',
        pieces: 5201,
        releaseYear: 2023,
        slug: 'avengers-tower-76269',
        theme: 'Marvel',
      },
    ];
    const currentOfferSummaryBySetId = new Map(
      setCards.map((setCard) => [
        setCard.id,
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 9999,
            setId: setCard.id,
            url: `https://partner.example/${setCard.id}`,
          }),
          offers: [],
          setId: setCard.id,
        },
      ]),
    );

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map(),
      currentOfferSummaryBySetId,
      excludedSetIds: ['10316'],
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76269',
    ]);
  });

  test('includes buyable sets in the good-priced commerce rail without requiring a discount', () => {
    const setCards = [
      {
        id: '43247',
        imageUrl: undefined,
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
      {
        id: '10316',
        imageUrl: undefined,
        name: 'Rivendell',
        pieces: 6167,
        releaseYear: 2023,
        slug: 'rivendell-10316',
        theme: 'Icons',
      },
      {
        id: '75355',
        imageUrl: undefined,
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '43247',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 9999,
            setId: '43247',
            url: 'https://partner.example/simba',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'Goodbricks',
              priceCents: 9999,
              setId: '43247',
              url: 'https://partner.example/simba',
            }),
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'MediaMarkt',
              priceCents: 10999,
              setId: '43247',
              url: 'https://partner.example/simba-mediamarkt',
            }),
          ],
          setId: '43247',
        },
      ],
      [
        '10316',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 46999,
            setId: '10316',
            url: 'https://partner.example/rivendell',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              priceCents: 46999,
              setId: '10316',
              url: 'https://partner.example/rivendell',
            }),
          ],
          setId: '10316',
        },
      ],
      [
        '75355',
        {
          bestOffer: createCatalogOffer({
            availability: 'out_of_stock',
            priceCents: 19999,
            setId: '75355',
            url: 'https://partner.example/x-wing',
          }),
          offers: [],
          setId: '75355',
        },
      ],
    ]);

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map(),
      currentOfferSummaryBySetId,
      limit: 6,
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toContain(
      '43247',
    );
    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '43247',
      '10316',
    ]);
  });

  test('keeps homepage commerce rails non-empty with production-like offer data', () => {
    const setCards = [
      {
        id: '43247',
        imageUrl: undefined,
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
      {
        id: '10311',
        imageUrl: undefined,
        name: 'Orchid',
        pieces: 608,
        releaseYear: 2022,
        slug: 'orchid-10311',
        theme: 'Botanicals',
      },
      {
        id: '75446',
        imageUrl: undefined,
        name: 'Grogu with Hover Pram',
        pieces: 1048,
        releaseYear: 2026,
        slug: 'grogu-with-hover-pram-75446',
        theme: 'Star Wars',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '43247',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            merchantName: 'Goodbricks',
            priceCents: 9999,
            setId: '43247',
            url: 'https://id.goodbricks.nl/t/t?a=1849540612&url=43247',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'Goodbricks',
              priceCents: 9999,
              setId: '43247',
              url: 'https://id.goodbricks.nl/t/t?a=1849540612&url=43247',
            }),
          ],
          setId: '43247',
        },
      ],
      [
        '10311',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            merchantName: 'MediaMarkt',
            priceCents: 4299,
            setId: '10311',
            url: 'https://pdt.tradedoubler.com/click?a(1)product(23056-1881383)',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'MediaMarkt',
              priceCents: 4299,
              setId: '10311',
              url: 'https://pdt.tradedoubler.com/click?a(1)product(23056-1881383)',
            }),
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'Top1Toys',
              priceCents: 4799,
              setId: '10311',
              url: 'https://www.top1toys.nl/lego-icons-10311-orchidee',
            }),
          ],
          setId: '10311',
        },
      ],
      [
        '75446',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            merchantName: 'Coppenswarenhuis',
            priceCents: 8499,
            setId: '75446',
            url: 'https://tc.tradetracker.net/?u=75446',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              merchantName: 'Coppenswarenhuis',
              priceCents: 8499,
              setId: '75446',
              url: 'https://tc.tradetracker.net/?u=75446',
            }),
          ],
          setId: '75446',
        },
      ],
    ]);
    const discoverySignalBySetId = new Map([
      [
        '75446',
        createCatalogDiscoverySignal({
          merchantCount: 1,
          priceSpreadMinor: 0,
          recentReferencePriceChangeMinor: -600,
          recentReferencePriceChangedAt: new Date(
            Date.now() - 4 * 60 * 60 * 1000,
          ).toISOString(),
          referenceDeltaMinor: undefined,
        }),
      ],
    ]);

    const bestDeals = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn: (setId) => discoverySignalBySetId.get(setId),
      limit: 6,
      setCards,
    });
    const goodPriced = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: discoverySignalBySetId,
      currentOfferSummaryBySetId,
      excludedSetIds: bestDeals.map((catalogSetCard) => catalogSetCard.id),
      limit: 8,
      setCards,
    });

    expect(bestDeals.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '75446',
    ]);
    expect(goodPriced.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10311',
      '43247',
    ]);
  });

  test('can rank commerce candidates outside the initial homepage set list', () => {
    const initialHomepageSetCards = [
      {
        id: '75446',
        imageUrl: undefined,
        name: 'Grogu with Hover Pram',
        pieces: 1048,
        releaseYear: 2026,
        slug: 'grogu-with-hover-pram-75446',
        theme: 'Star Wars',
      },
    ];
    const commerceCandidateSetCards = [
      {
        id: '43247',
        imageUrl: undefined,
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '43247',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 9999,
            setId: '43247',
            url: 'https://partner.example/simba',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              priceCents: 9999,
              setId: '43247',
              url: 'https://partner.example/simba',
            }),
          ],
          setId: '43247',
        },
      ],
    ]);

    const homepageScopedResult = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map(),
      currentOfferSummaryBySetId,
      setCards: initialHomepageSetCards,
    });
    const commerceScopedResult = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map(),
      currentOfferSummaryBySetId,
      setCards: commerceCandidateSetCards,
    });

    expect(homepageScopedResult).toEqual([]);
    expect(
      commerceScopedResult.map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['43247']);
  });

  test('fills the first homepage commerce rail to twenty scored candidates', () => {
    const scoredCommerceCandidateSetCards = Array.from(
      { length: 20 },
      (_, index) => ({
        id: String(43_000 + index),
        imageUrl: undefined,
        name: `Buyable set ${index + 1}`,
        pieces: 1000 + index,
        releaseYear: 2024,
        slug: `buyable-set-${43_000 + index}`,
        theme: 'Disney',
      }),
    );
    const strictDealSetCards = scoredCommerceCandidateSetCards.slice(0, 8);

    const selectedSetCards = selectCatalogFirstCommerceRailSetCards({
      limit: 20,
      scoredCommerceCandidateSetCards,
      strictDealSetCards,
    });

    expect(selectedSetCards).toHaveLength(20);
    expect(selectedSetCards.map((setCard) => setCard.id)).toEqual(
      scoredCommerceCandidateSetCards.map((setCard) => setCard.id),
    );
  });

  test('does not duplicate strict deal cards when filling the first commerce rail', () => {
    const scoredCommerceCandidateSetCards = Array.from(
      { length: 20 },
      (_, index) => ({
        id: String(43_000 + index),
        imageUrl: undefined,
        name: `Buyable set ${index + 1}`,
        pieces: 1000 + index,
        releaseYear: 2024,
        slug: `buyable-set-${43_000 + index}`,
        theme: 'Disney',
      }),
    );

    const selectedSetCards = selectCatalogFirstCommerceRailSetCards({
      limit: 20,
      scoredCommerceCandidateSetCards,
      strictDealSetCards: [
        ...scoredCommerceCandidateSetCards.slice(3, 4),
        ...scoredCommerceCandidateSetCards.slice(6, 7),
      ],
    });

    expect(selectedSetCards).toHaveLength(20);
    expect(new Set(selectedSetCards.map((setCard) => setCard.id)).size).toBe(
      20,
    );
    expect(selectedSetCards.slice(0, 2).map((setCard) => setCard.id)).toEqual([
      '43003',
      '43006',
    ]);
  });

  test('explains homepage partner offer rail exclusions with scoring inputs', () => {
    const setCards = [
      {
        id: '43247',
        imageUrl: undefined,
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
      {
        id: '10311',
        imageUrl: undefined,
        name: 'Orchid',
        pieces: 608,
        releaseYear: 2022,
        slug: 'orchid-10311',
        theme: 'Botanicals',
      },
      {
        id: '75355',
        imageUrl: undefined,
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '43247',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 9999,
            setId: '43247',
            url: 'https://partner.example/simba',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              priceCents: 9999,
              setId: '43247',
              url: 'https://partner.example/simba',
            }),
            createCatalogOffer({
              availability: 'in_stock',
              priceCents: 10999,
              setId: '43247',
              url: 'https://partner.example/simba-other',
            }),
          ],
          setId: '43247',
        },
      ],
      [
        '10311',
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            priceCents: 0,
            setId: '10311',
            url: 'https://partner.example/orchid',
          }),
          offers: [],
          setId: '10311',
        },
      ],
      [
        '75355',
        {
          bestOffer: createCatalogOffer({
            availability: 'out_of_stock',
            priceCents: 19999,
            setId: '75355',
            url: 'https://partner.example/x-wing',
          }),
          offers: [],
          setId: '75355',
        },
      ],
    ]);

    const diagnostics = getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId: new Map([
        [
          '43247',
          createCatalogDiscoverySignal({
            priceSpreadMinor: 1000,
            referenceDeltaMinor: -1500,
          }),
        ],
      ]),
      currentOfferSummaryBySetId,
      limit: 10,
      rotationSeed: 1,
      setCards,
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        discountScore: 10,
        excludedReason: 'included',
        finalScore: expect.any(Number),
        hasDeeplink: true,
        hasPrice: true,
        inStock: true,
        priceSpread: 1000,
        setId: '43247',
      }),
      expect.objectContaining({
        excludedReason: 'missing_price',
        hasDeeplink: true,
        hasPrice: false,
        setId: '10311',
      }),
      expect.objectContaining({
        excludedReason: 'out_of_stock',
        hasDeeplink: true,
        hasPrice: true,
        inStock: false,
        setId: '75355',
      }),
    ]);
  });

  test('ranks the now-interesting rail from fresh movement, coverage and spread', () => {
    const result = rankCatalogNowInterestingSetCards({
      limit: 6,
      setCards: [
        {
          id: '10333',
          imageUrl: undefined,
          name: 'The Lord of the Rings: Barad-dur',
          pieces: 5471,
          releaseYear: 2024,
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          theme: 'Icons',
        },
        {
          id: '76269',
          imageUrl: undefined,
          name: 'Avengers Tower',
          pieces: 5201,
          releaseYear: 2023,
          slug: 'avengers-tower-76269',
          theme: 'Marvel',
        },
        {
          id: '10354',
          imageUrl: undefined,
          name: 'The Lord of the Rings: The Shire',
          pieces: 2017,
          releaseYear: 2026,
          slug: 'the-lord-of-the-rings-the-shire-10354',
          theme: 'Icons',
        },
      ],
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10333') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 6500,
            recentReferencePriceChangeMinor: -1800,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 6 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            merchantCount: 5,
            priceSpreadMinor: 7000,
            recentReferencePriceChangeMinor: -400,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 20 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '10354') {
          return createCatalogDiscoverySignal({
            merchantCount: 2,
            priceSpreadMinor: 1200,
            referenceDeltaMinor: undefined,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10333',
      '76269',
    ]);
  });

  test('builds the now-interesting rail through the shared discover helper', async () => {
    const result = await listDiscoverNowInterestingSetCards({
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10333') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 6500,
            recentReferencePriceChangeMinor: -1800,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 6 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            merchantCount: 5,
            priceSpreadMinor: 7000,
            recentReferencePriceChangeMinor: -400,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 20 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        return undefined;
      },
      setCards: [
        {
          id: '10333',
          imageUrl: undefined,
          name: 'The Lord of the Rings: Barad-dur',
          pieces: 5471,
          releaseYear: 2024,
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          theme: 'Icons',
        },
        {
          id: '76269',
          imageUrl: undefined,
          name: 'Avengers Tower',
          pieces: 5201,
          releaseYear: 2023,
          slug: 'avengers-tower-76269',
          theme: 'Marvel',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10333',
      '76269',
    ]);
  });

  test('ranks newly released rails from actual release timing first and then comparison readiness', () => {
    const result = rankCatalogRecentlyReleasedSetCards({
      limit: 6,
      now: new Date('2026-05-10T12:00:00.000Z'),
      setCards: [
        {
          id: '10354',
          imageUrl: undefined,
          name: 'The Lord of the Rings: The Shire',
          pieces: 2017,
          releaseDate: '2026-06-01',
          releaseDatePrecision: 'month',
          releaseYear: 2026,
          slug: 'the-lord-of-the-rings-the-shire-10354',
          theme: 'Icons',
        },
        {
          id: '75403',
          imageUrl: undefined,
          name: 'Grogu met zweefkinderwagen',
          pieces: 1048,
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          slug: 'grogu-met-zweefkinderwagen-75403',
          theme: 'Star Wars',
        },
        {
          id: '43257',
          imageUrl: undefined,
          name: 'Angel',
          pieces: 784,
          releaseDate: '2026-05-15',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          slug: 'angel-43257',
          theme: 'Disney',
        },
        {
          id: '10313',
          imageUrl: undefined,
          name: 'Wildflower Bouquet',
          pieces: 939,
          releaseDate: '2026-04-01',
          releaseDatePrecision: 'month',
          releaseYear: 2026,
          slug: 'wildflower-bouquet-10313',
          theme: 'Botanicals',
        },
        {
          id: '30677',
          imageUrl: undefined,
          name: 'Mini Polybag',
          pieces: 65,
          releaseYear: 2026,
          slug: 'mini-polybag-30677',
          theme: 'City',
        },
        {
          id: '10458',
          imageUrl: undefined,
          name: 'Peppa Pig Garden Trip',
          pieces: 38,
          releaseYear: 2026,
          slug: 'peppa-pig-garden-trip-10458',
          theme: 'Duplo',
        },
        {
          id: '31208',
          imageUrl: undefined,
          name: 'Hokusai - The Great Wave',
          pieces: 1810,
          releaseYear: 2023,
          slug: 'hokusai-the-great-wave-31208',
          theme: 'Art',
        },
      ],
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10354') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 4000,
          });
        }

        if (setId === '75403') {
          return createCatalogDiscoverySignal({
            merchantCount: 2,
            priceSpreadMinor: 1500,
          });
        }

        if (setId === '10313') {
          return createCatalogDiscoverySignal({
            merchantCount: 5,
            priceSpreadMinor: 1200,
          });
        }

        if (setId === '43257') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 6499,
            merchantCount: 3,
            priceSpreadMinor: 2200,
          });
        }

        if (setId === '30677') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 499,
            merchantCount: 2,
            priceSpreadMinor: 300,
          });
        }

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10354',
      '43257',
      '75403',
      '10313',
    ]);
  });

  test('returns fewer newly released sets when the eligible pool is small', async () => {
    const result = await listDiscoverRecentlyReleasedSetCards({
      limit: 6,
      now: new Date('2026-05-10T12:00:00.000Z'),
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: The Shire',
          pieceCount: 2017,
          primaryTheme: 'Icons',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '10354',
          slug: 'the-lord-of-the-rings-the-shire-10354',
          sourceSetNumber: '10354-1',
        }),
        createCanonicalCatalogSet({
          name: 'Hokusai - The Great Wave',
          pieceCount: 1810,
          primaryTheme: 'Art',
          releaseYear: 2023,
          setId: '31208',
          slug: 'hokusai-the-great-wave-31208',
          sourceSetNumber: '31208-1',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10354',
    ]);
  });

  test('keeps actual release timing ahead of Brickhunt import timing in nieuwe releases', () => {
    const result = rankCatalogRecentlyReleasedSetCards({
      now: new Date('2026-05-10T12:00:00.000Z'),
      setCards: [
        {
          createdAt: '2026-04-30T09:00:00.000Z',
          id: '60368',
          imageUrl: undefined,
          name: 'Arctic Explorer Ship',
          pieces: 815,
          releaseYear: 2026,
          slug: 'arctic-explorer-ship-60368',
          theme: 'City',
        },
        {
          createdAt: '2026-01-10T09:00:00.000Z',
          id: '75417',
          imageUrl: undefined,
          name: 'AT-ST Walker',
          pieces: 1513,
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          slug: 'at-st-walker-75417',
          theme: 'Star Wars',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '75417',
    ]);
  });

  test('includes only day or month precision releases inside the recent or upcoming window', () => {
    const result = rankCatalogRecentlyReleasedSetCards({
      now: new Date('2026-05-10T12:00:00.000Z'),
      setCards: [
        {
          id: '75417',
          imageUrl: undefined,
          name: 'AT-ST Walker',
          pieces: 1513,
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          slug: 'at-st-walker-75417',
          theme: 'Star Wars',
        },
        {
          id: '10354',
          imageUrl: undefined,
          name: 'The Lord of the Rings: The Shire',
          pieces: 2017,
          releaseDate: '2026-06-01',
          releaseDatePrecision: 'month',
          releaseYear: 2026,
          slug: 'the-lord-of-the-rings-the-shire-10354',
          theme: 'Icons',
        },
        {
          id: '60368',
          imageUrl: undefined,
          name: 'Arctic Explorer Ship',
          pieces: 815,
          releaseYear: 2026,
          slug: 'arctic-explorer-ship-60368',
          theme: 'City',
        },
        {
          id: '10326',
          imageUrl: undefined,
          name: 'Natural History Museum',
          pieces: 4014,
          releaseDate: '2025-12-01',
          releaseDatePrecision: 'month',
          releaseYear: 2025,
          slug: 'natural-history-museum-10326',
          theme: 'Icons',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10354',
      '75417',
    ]);
  });

  test('can surface year-only release rows separately as nieuw in het releasejaar', () => {
    const result = rankCatalogNewInReleaseYearSetCards({
      currentYear: 2026,
      setCards: [
        {
          createdAt: '2026-04-30T09:00:00.000Z',
          id: '60368',
          imageUrl: undefined,
          name: 'Arctic Explorer Ship',
          pieces: 815,
          releaseYear: 2026,
          slug: 'arctic-explorer-ship-60368',
          theme: 'City',
        },
        {
          id: '75417',
          imageUrl: undefined,
          name: 'AT-ST Walker',
          pieces: 1513,
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          slug: 'at-st-walker-75417',
          theme: 'Star Wars',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '60368',
    ]);
  });

  test('lists year-only release rows separately as nieuw in het releasejaar', async () => {
    const result = await listDiscoverNewInReleaseYearSetCards({
      currentYear: 2026,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Arctic Explorer Ship',
          pieceCount: 815,
          primaryTheme: 'City',
          releaseYear: 2026,
          setId: '60368',
          slug: 'arctic-explorer-ship-60368',
          sourceSetNumber: '60368-1',
        }),
        createCanonicalCatalogSet({
          name: 'AT-ST Walker',
          pieceCount: 1513,
          primaryTheme: 'Star Wars',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '75417',
          slug: 'at-st-walker-75417',
          sourceSetNumber: '75417-1',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '60368',
    ]);
  });

  test('can surface newly imported sets separately as nieuw op Brickhunt', async () => {
    const result = await listDiscoverNewOnBrickhuntSetCards({
      currentYear: 2026,
      now: new Date('2026-04-30T12:00:00.000Z'),
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          createdAt: '2026-04-30T09:00:00.000Z',
          name: 'Arctic Explorer Ship',
          pieceCount: 815,
          primaryTheme: 'City',
          releaseYear: 2026,
          setId: '60368',
          slug: 'arctic-explorer-ship-60368',
          sourceSetNumber: '60368-1',
        }),
        createCanonicalCatalogSet({
          createdAt: '2026-01-10T09:00:00.000Z',
          name: 'AT-ST Walker',
          pieceCount: 1513,
          primaryTheme: 'Star Wars',
          releaseDate: '2026-01-01',
          releaseDatePrecision: 'month',
          releaseYear: 2026,
          setId: '75417',
          slug: 'at-st-walker-75417',
          sourceSetNumber: '75417-1',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '60368',
      '75417',
    ]);
  });

  test('does not treat an older release imported today as a nieuwe release', () => {
    const result = rankCatalogRecentlyReleasedSetCards({
      now: new Date('2026-05-10T12:00:00.000Z'),
      setCards: [
        {
          createdAt: '2026-05-10T09:00:00.000Z',
          id: '76218',
          imageUrl: undefined,
          name: 'Sanctum Sanctorum',
          pieces: 2708,
          releaseYear: 2024,
          slug: 'sanctum-sanctorum-76218',
          theme: 'Marvel',
        },
      ],
    });

    expect(result).toEqual([]);
  });

  test('reuses comparison discovery logic for the discover best-deals rail', async () => {
    const result = await listDiscoverBestDealSetCards({
      limit: 3,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Technic Hypercar',
          primaryTheme: 'Technic',
          setId: '42143',
          slug: 'technic-hypercar-42143',
          sourceSetNumber: '42143-1',
        }),
        createCanonicalCatalogSet({
          name: 'Avengers Tower',
          pieceCount: 5201,
          primaryTheme: 'Marvel',
          releaseYear: 2023,
          setId: '76269',
          slug: 'avengers-tower-76269',
          sourceSetNumber: '76269-1',
        }),
        createCanonicalCatalogSet({
          name: 'Botanical Bouquet',
          pieceCount: 822,
          primaryTheme: 'Botanicals',
          releaseYear: 2024,
          setId: '10313',
          slug: 'botanical-bouquet-10313',
          sourceSetNumber: '10313-1',
        }),
      ],
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

        return undefined;
      },
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '42143',
      '76269',
      '10313',
    ]);
  });

  test('selects a theme of the week from current activity and enough depth', () => {
    const result = selectCatalogThemeOfWeekRail({
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId.startsWith('hp-')) {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 5000,
            recentReferencePriceChangeMinor: -1200,
            recentReferencePriceChangedAt: new Date(
              Date.now() - 8 * 60 * 60 * 1000,
            ).toISOString(),
          });
        }

        if (setId.startsWith('icons-')) {
          return createCatalogDiscoverySignal({
            merchantCount: 2,
            priceSpreadMinor: 1200,
          });
        }

        return undefined;
      },
      setCards: [
        {
          id: 'hp-1',
          imageUrl: undefined,
          name: 'Hogwarts Castle and Grounds',
          pieces: 2660,
          releaseYear: 2023,
          slug: 'hogwarts-castle-and-grounds-76419',
          theme: 'Harry Potter',
        },
        {
          id: 'hp-2',
          imageUrl: undefined,
          name: 'The Burrow - Collectors Edition',
          pieces: 2405,
          releaseYear: 2024,
          slug: 'the-burrow-collectors-edition',
          theme: 'Harry Potter',
        },
        {
          id: 'hp-3',
          imageUrl: undefined,
          name: "Gringotts Wizarding Bank – Collectors' Edition",
          pieces: 4803,
          releaseYear: 2023,
          slug: 'gringotts-wizarding-bank',
          theme: 'Harry Potter',
        },
        {
          id: 'hp-4',
          imageUrl: undefined,
          name: 'Hogwarts Icons',
          pieces: 3010,
          releaseYear: 2022,
          slug: 'hogwarts-icons',
          theme: 'Harry Potter',
        },
        {
          id: 'icons-1',
          imageUrl: undefined,
          name: 'Natural History Museum',
          pieces: 4014,
          releaseYear: 2023,
          slug: 'natural-history-museum-10326',
          theme: 'Icons',
        },
        {
          id: 'icons-2',
          imageUrl: undefined,
          name: 'Concorde',
          pieces: 2083,
          releaseYear: 2023,
          slug: 'concorde-10318',
          theme: 'Icons',
        },
        {
          id: 'icons-3',
          imageUrl: undefined,
          name: 'The Endurance',
          pieces: 3011,
          releaseYear: 2024,
          slug: 'the-endurance-10335',
          theme: 'Icons',
        },
        {
          id: 'icons-4',
          imageUrl: undefined,
          name: 'The Lord of the Rings: Barad-dur',
          pieces: 5471,
          releaseYear: 2024,
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          theme: 'Icons',
        },
      ],
    });

    expect(result?.theme).toBe('Harry Potter');
    expect(result?.setCards).toHaveLength(4);
  });

  test('builds a lightweight for-you rail from deals, movement and stronger themes', async () => {
    const result = await listDiscoverForYouInterestingSetCards({
      excludedSetIds: ['10333'],
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            merchantCount: 5,
            priceSpreadMinor: 7000,
            referenceDeltaMinor: -2500,
          });
        }

        if (setId === '76419') {
          return createCatalogDiscoverySignal({
            merchantCount: 4,
            priceSpreadMinor: 4200,
            recentReferencePriceChangeMinor: -1400,
            recentReferencePriceChangedAt: '2026-04-22T08:00:00.000Z',
          });
        }

        if (setId === '43222') {
          return createCatalogDiscoverySignal({
            merchantCount: 3,
            priceSpreadMinor: 1800,
          });
        }

        return undefined;
      },
      setCards: [
        {
          id: '10333',
          imageUrl: undefined,
          name: 'The Lord of the Rings: Barad-dur',
          pieces: 5471,
          releaseYear: 2024,
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          theme: 'Icons',
        },
        {
          id: '76269',
          imageUrl: undefined,
          name: 'Avengers Tower',
          pieces: 5201,
          releaseYear: 2023,
          slug: 'avengers-tower-76269',
          theme: 'Marvel',
        },
        {
          id: '76419',
          imageUrl: undefined,
          name: 'Hogwarts Castle and Grounds',
          pieces: 2660,
          releaseYear: 2023,
          slug: 'hogwarts-castle-and-grounds-76419',
          theme: 'Harry Potter',
        },
        {
          id: '43222',
          imageUrl: undefined,
          name: 'Disney Castle',
          pieces: 4837,
          releaseYear: 2023,
          slug: 'disney-castle-43222',
          theme: 'Disney',
        },
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76269',
      '76419',
      '43222',
    ]);
  });

  test('reuses a shared set-card dataset across discover rail loaders', async () => {
    const sharedSetCards = await listCatalogSetCards({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Technic Hypercar',
          pieceCount: 3778,
          primaryTheme: 'Technic',
          releaseYear: 2022,
          setId: '42143',
          slug: 'technic-hypercar-42143',
          sourceSetNumber: '42143-1',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: The Shire',
          pieceCount: 2017,
          primaryTheme: 'Icons',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '10354',
          slug: 'the-lord-of-the-rings-the-shire-10354',
          sourceSetNumber: '10354-1',
        }),
        createCanonicalCatalogSet({
          name: 'Botanical Bouquet',
          pieceCount: 749,
          primaryTheme: 'Botanicals',
          releaseYear: 2024,
          setId: '10313',
          slug: 'botanical-bouquet-10313',
          sourceSetNumber: '10313-1',
        }),
      ],
    });
    const listCanonicalCatalogSetsFn = vi
      .fn<typeof listCanonicalCatalogSets>()
      .mockRejectedValue(
        new Error('Discover should reuse the shared set cards.'),
      );
    const getCatalogDiscoverySignalFn = (setId: string) => {
      if (setId === '42143') {
        return createCatalogDiscoverySignal({
          bestPriceMinor: 38999,
          merchantCount: 5,
          observedAt: '2026-04-20T10:00:00.000Z',
          priceSpreadMinor: 14000,
          recentReferencePriceChangeMinor: -3000,
          recentReferencePriceChangedAt: new Date(
            Date.now() - 4 * 60 * 60 * 1000,
          ).toISOString(),
          referenceDeltaMinor: -9000,
        });
      }

      if (setId === '10354') {
        return createCatalogDiscoverySignal({
          bestPriceMinor: 22999,
          merchantCount: 4,
          observedAt: '2026-04-20T11:00:00.000Z',
          priceSpreadMinor: 5000,
          referenceDeltaMinor: undefined,
        });
      }

      if (setId === '10313') {
        return createCatalogDiscoverySignal({
          bestPriceMinor: 4499,
          merchantCount: 3,
          observedAt: '2026-04-20T12:00:00.000Z',
          priceSpreadMinor: 1800,
          recentReferencePriceChangeMinor: -500,
          recentReferencePriceChangedAt: new Date(
            Date.now() - 10 * 60 * 60 * 1000,
          ).toISOString(),
          referenceDeltaMinor: -500,
        });
      }

      return undefined;
    };

    const [recentPriceChanges, bestDeals, recentlyReleased] = await Promise.all(
      [
        listDiscoverRecentPriceChangeSetCards({
          getCatalogDiscoverySignalFn,
          listCanonicalCatalogSetsFn,
          setCards: sharedSetCards,
        }),
        listDiscoverBestDealSetCards({
          getCatalogDiscoverySignalFn,
          listCanonicalCatalogSetsFn,
          setCards: sharedSetCards,
        }),
        listDiscoverRecentlyReleasedSetCards({
          getCatalogDiscoverySignalFn,
          listCanonicalCatalogSetsFn,
          now: new Date('2026-05-10T12:00:00.000Z'),
          setCards: sharedSetCards,
        }),
      ],
    );

    expect(listCanonicalCatalogSetsFn).not.toHaveBeenCalled();
    expect(
      recentPriceChanges.map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['42143', '10313']);
    expect(bestDeals.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '42143',
      '10313',
    ]);
    expect(recentlyReleased.map((catalogSetCard) => catalogSetCard.id)).toEqual(
      ['10354'],
    );
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

  test('boosts shared secondary themes above broader canonical theme matches', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '10326',
        name: 'Natural History Museum',
        pieces: 4014,
        releaseYear: 2023,
        secondaryLabels: ['Modular Buildings'],
        theme: 'Icons',
      },
      limit: 6,
      setCards: [
        createCanonicalCatalogSet({
          name: 'Natural History Museum',
          pieceCount: 4014,
          primaryTheme: 'Icons',
          releaseYear: 2023,
          secondaryLabels: ['Modular Buildings'],
          setId: '10326',
          slug: 'natural-history-museum-10326',
          sourceSetNumber: '10326-1',
        }),
        createCanonicalCatalogSet({
          name: 'Shopping Street',
          pieceCount: 2012,
          primaryTheme: 'Icons',
          releaseYear: 2025,
          secondaryLabels: ['Modular Buildings'],
          setId: '11371',
          slug: 'shopping-street-11371',
          sourceSetNumber: '11371-1',
        }),
        createCanonicalCatalogSet({
          name: "Lion Knights' Castle",
          pieceCount: 4514,
          primaryTheme: 'Icons',
          releaseYear: 2022,
          setId: '10305',
          slug: 'lion-knights-castle-10305',
          sourceSetNumber: '10305-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        secondaryLabels: canonicalCatalogSet.secondaryLabels,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '11371',
      '10305',
    ]);
  });

  test('prefers shared Marvel subtheme adjacency before broader Marvel matches', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '76178',
        name: 'Daily Bugle',
        pieces: 3772,
        releaseYear: 2021,
        secondaryLabels: ['Spider-Man'],
        theme: 'Marvel',
      },
      limit: 6,
      setCards: [
        createCanonicalCatalogSet({
          name: 'Daily Bugle',
          pieceCount: 3772,
          primaryTheme: 'Marvel',
          releaseYear: 2021,
          secondaryLabels: ['Spider-Man'],
          setId: '76178',
          slug: 'daily-bugle-76178',
          sourceSetNumber: '76178-1',
        }),
        createCanonicalCatalogSet({
          name: "Captain America's Shield",
          pieceCount: 3128,
          primaryTheme: 'Marvel',
          releaseYear: 2023,
          secondaryLabels: ['The Infinity Saga'],
          setId: '76262',
          slug: 'captain-americas-shield-76262',
          sourceSetNumber: '76262-1',
        }),
        createCanonicalCatalogSet({
          name: 'Spider-Man Final Battle',
          pieceCount: 900,
          primaryTheme: 'Marvel',
          releaseYear: 2022,
          secondaryLabels: ['Spider-Man'],
          setId: '76261',
          slug: 'spider-man-final-battle-76261',
          sourceSetNumber: '76261-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        secondaryLabels: canonicalCatalogSet.secondaryLabels,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76261',
      '76262',
    ]);
  });

  test('prefers Batman-adjacent DC sets before broader DC matches', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '76330',
        name: 'Batman Logo',
        pieces: 1822,
        releaseYear: 2025,
        secondaryLabels: ['Batman'],
        theme: 'DC',
      },
      limit: 6,
      setCards: [
        createCanonicalCatalogSet({
          name: 'Batman Logo',
          pieceCount: 1822,
          primaryTheme: 'DC',
          releaseYear: 2025,
          secondaryLabels: ['Batman'],
          setId: '76330',
          slug: 'batman-logo-76330',
          sourceSetNumber: '76330-1',
        }),
        createCanonicalCatalogSet({
          name: 'Batman Cowl',
          pieceCount: 410,
          primaryTheme: 'DC',
          releaseYear: 2021,
          secondaryLabels: ['Batman'],
          setId: '76182',
          slug: 'batman-cowl-76182',
          sourceSetNumber: '76182-1',
        }),
        createCanonicalCatalogSet({
          name: 'Hall of Justice',
          pieceCount: 547,
          primaryTheme: 'DC',
          releaseYear: 2026,
          setId: '76297',
          slug: 'hall-of-justice-76297',
          sourceSetNumber: '76297-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        secondaryLabels: canonicalCatalogSet.secondaryLabels,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76182',
      '76297',
    ]);
  });

  test('keeps premium UCS-style Star Wars sets ahead of generic Star Wars matches', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '75192',
        name: 'Millennium Falcon',
        pieces: 7541,
        releaseYear: 2017,
        secondaryLabels: ['Ultimate Collector Series'],
        theme: 'Star Wars',
      },
      limit: 6,
      setCards: [
        createCanonicalCatalogSet({
          name: 'Millennium Falcon',
          pieceCount: 7541,
          primaryTheme: 'Star Wars',
          releaseYear: 2017,
          secondaryLabels: ['Ultimate Collector Series'],
          setId: '75192',
          slug: 'millennium-falcon-75192',
          sourceSetNumber: '75192-1',
        }),
        createCanonicalCatalogSet({
          name: 'Millennium Falcon',
          pieceCount: 921,
          primaryTheme: 'Star Wars',
          releaseYear: 2024,
          setId: '75375',
          slug: 'millennium-falcon-75375',
          sourceSetNumber: '75375-1',
        }),
        createCanonicalCatalogSet({
          name: 'AT-AT',
          pieceCount: 6785,
          primaryTheme: 'Star Wars',
          releaseYear: 2021,
          secondaryLabels: ['Ultimate Collector Series'],
          setId: '75313',
          slug: 'at-at-75313',
          sourceSetNumber: '75313-1',
        }),
      ].map((canonicalCatalogSet) => ({
        id: canonicalCatalogSet.setId,
        imageUrl: canonicalCatalogSet.imageUrl,
        name: canonicalCatalogSet.name,
        pieces: canonicalCatalogSet.pieceCount,
        releaseYear: canonicalCatalogSet.releaseYear,
        secondaryLabels: canonicalCatalogSet.secondaryLabels,
        slug: canonicalCatalogSet.slug,
        theme: canonicalCatalogSet.primaryTheme,
      })),
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '75313',
      '75375',
    ]);
  });

  test('returns up to twenty similar sets and stays deterministic when scores tie', () => {
    const result = rankCatalogSimilarSetCards({
      currentSetCard: {
        id: '42172',
        name: 'McLaren P1',
        pieces: 3893,
        releaseYear: 2024,
        theme: 'Technic',
      },
      referenceBestPriceMinor: 34999,
      setCards: [
        ...Array.from({ length: 22 }, (_, index) => {
          const setId = `${String(index + 1).padStart(2, '0')}`;

          return {
            id: setId,
            imageUrl: undefined,
            name: `Technic ${setId}`,
            pieces: 3893,
            releaseYear: 2024 - (index % 2),
            slug: `technic-${setId}`,
            theme: 'Technic',
          };
        }),
        {
          id: '01',
          imageUrl: undefined,
          name: 'Technic 01 duplicate',
          pieces: 3893,
          releaseYear: 2024,
          slug: 'technic-01-duplicate',
          theme: 'Technic',
        },
        {
          id: '31208',
          imageUrl: undefined,
          name: 'Hokusai - The Great Wave',
          pieces: 1810,
          releaseYear: 2024,
          slug: 'hokusai-the-great-wave-31208',
          theme: 'Art',
        },
      ],
    });

    expect(result).toHaveLength(20);
    expect(
      new Set(result.map((catalogSetCard) => catalogSetCard.id)).size,
    ).toBe(20);
    expect(result.map((catalogSetCard) => catalogSetCard.id)).not.toContain(
      '31208',
    );
    expect(
      result.map((catalogSetCard) => catalogSetCard.id).slice(0, 4),
    ).toEqual(['01', '03', '05', '07']);
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

  test('reuses canonical secondary labels for the current set when the caller omits them', async () => {
    const result = await listCatalogSimilarSetCards({
      currentSetCard: {
        id: '10326',
        name: 'Natural History Museum',
        pieces: 4014,
        releaseYear: 2023,
        theme: 'Icons',
      },
      limit: 6,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Natural History Museum',
          pieceCount: 4014,
          primaryTheme: 'Icons',
          releaseYear: 2023,
          secondaryLabels: ['Modular Buildings'],
          setId: '10326',
          slug: 'natural-history-museum-10326',
          sourceSetNumber: '10326-1',
        }),
        createCanonicalCatalogSet({
          name: 'Shopping Street',
          pieceCount: 2012,
          primaryTheme: 'Icons',
          releaseYear: 2025,
          secondaryLabels: ['Modular Buildings'],
          setId: '11371',
          slug: 'shopping-street-11371',
          sourceSetNumber: '11371-1',
        }),
        createCanonicalCatalogSet({
          name: "Lion Knights' Castle",
          pieceCount: 4514,
          primaryTheme: 'Icons',
          releaseYear: 2022,
          setId: '10305',
          slug: 'lion-knights-castle-10305',
          sourceSetNumber: '10305-1',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '11371',
      '10305',
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
        createCanonicalCatalogSet({
          setId: '40634',
          slug: 'official-fifa-world-cup-trophy-40634',
          sourceSetNumber: '40634-1',
          name: 'Official FIFA World Cup Trophy',
          primaryTheme: 'Other',
        }),
      ],
      setLimit: 6,
      themeLimit: 6,
    });

    expect(result.map((themeGroup) => themeGroup.theme)).toEqual([
      'LEGO® Icons',
      'Marvel',
      'Lord of the Rings™',
    ]);
    expect(result[0]?.totalSetCount).toBe(1);
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

  test('batches current offer summary API reads into one request', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-04-20T10:00:00.000Z',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'bol',
              merchantName: 'bol',
              merchantSlug: 'bol',
              priceCents: 32999,
              setId: '42172',
              url: 'https://www.bol.com/nl/nl/p/technic',
            },
            offers: [
              {
                availability: 'in_stock',
                checkedAt: '2026-04-20T10:00:00.000Z',
                condition: 'new',
                currency: 'EUR',
                market: 'NL',
                merchant: 'bol',
                merchantName: 'bol',
                merchantSlug: 'bol',
                priceCents: 32999,
                setId: '42172',
                url: 'https://www.bol.com/nl/nl/p/technic',
              },
            ],
            setId: '42172',
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

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds: ['42172', '75398', '42172'],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/current-offer-summaries?setIds=42172%2C75398',
      expect.objectContaining({
        headers: {
          accept: 'application/json',
        },
        next: {
          revalidate: 21_600,
          tags: ['prices', 'set:42172', 'set:75398'],
        },
      }),
    );
    expect(summaries.get('42172')).toMatchObject({
      bestOffer: {
        merchantName: 'bol',
        priceCents: 32999,
      },
      setId: '42172',
    });
    expect(summaries.has('75398')).toBe(false);
  });

  test('normalizes real-shaped current offer summary fields from the public API', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            best_offer: {
              availability: 'in stock',
              currencyCode: 'EUR',
              merchant_name: 'Goodbricks',
              merchant_slug: 'goodbricks',
              observed_at: '2026-05-05T12:25:54.539Z',
              priceMinor: 9999,
              productUrl: 'https://id.goodbricks.nl/t/t?a=1849540612',
              setNumber: '43247',
            },
            offers: [
              {
                affiliateDeeplink: 'https://id.goodbricks.nl/t/t?a=1849540612',
                availability: 'in stock',
                currencyCode: 'EUR',
                merchant_name: 'Goodbricks',
                merchant_slug: 'goodbricks',
                observed_at: '2026-05-05T12:25:54.539Z',
                price_minor: 9999,
                set_id: '43247',
              },
            ],
            setNumber: '43247',
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

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds: ['43247'],
    });

    expect(summaries.get('43247')).toMatchObject({
      bestOffer: {
        availability: 'in_stock',
        checkedAt: '2026-05-05T12:25:54.539Z',
        currency: 'EUR',
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 9999,
        setId: '43247',
        url: 'https://id.goodbricks.nl/t/t?a=1849540612',
      },
      setId: '43247',
    });
    expect(summaries.get('43247')?.offers).toHaveLength(1);
  });

  test('matches current offer summaries with canonical set ids', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-05T12:25:54.539Z',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'other',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceCents: 9999,
              setId: '75459-1',
              url: 'https://id.goodbricks.nl/t/t?a=1849540612',
            },
            offers: [],
            setId: '75459-1',
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

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds: ['75459'],
    });

    expect(summaries.get('75459')).toMatchObject({
      bestOffer: {
        priceCents: 9999,
        setId: '75459',
      },
      setId: '75459',
    });
    expect(summaries.has('75459-1')).toBe(false);
  });

  test('does not count empty placeholder summaries as current offers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            offers: [],
            setId: '75459',
          },
          {
            offers: [],
            setId: '75458',
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

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds: ['75459', '75458'],
    });

    expect(summaries.size).toBe(0);
  });

  test('loads current offer summaries independently from requested homepage set ids', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/43247-1/1000.jpg',
          name: 'Young Simba the Lion King',
          piece_count: 1445,
          primary_theme_id: 'theme:disney',
          release_year: 2024,
          set_id: '43247',
          slug: 'young-simba-the-lion-king-43247',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:608',
          source_set_number: '43247-1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:25:54.539Z',
          offer_seed_id: 'seed-simba',
          price_minor: 9999,
          updated_at: '2026-05-05T12:25:54.539Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:20:54.539Z',
          offer_seed_id: 'seed-non-catalog',
          price_minor: 4999,
          updated_at: '2026-05-05T12:20:54.539Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-simba',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/simba',
          set_id: '43247-1',
          validation_status: 'valid',
        },
        {
          id: 'seed-non-catalog',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/non-catalog',
          set_id: '99999',
          validation_status: 'valid',
        },
      ],
    });

    const summaries = await listCatalogCurrentOfferSummaries({
      supabaseClient,
    });
    const commerceCandidateSetCards = await listCatalogSetCardsByIds({
      canonicalIds: [...summaries.keys()],
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Young Simba the Lion King',
          primaryTheme: 'Disney',
          setId: '43247',
          slug: 'young-simba-the-lion-king-43247',
          sourceSetNumber: '43247-1',
        }),
      ],
    });

    expect(summaries.get('43247')).toMatchObject({
      bestOffer: {
        priceCents: 9999,
        setId: '43247',
        url: 'https://partner.example/simba',
      },
      setId: '43247',
    });
    expect(summaries.get('99999')).toBeDefined();
    expect(commerceCandidateSetCards.map((setCard) => setCard.id)).toEqual([
      '43247',
    ]);
  });

  test('returns clear commerce rail diagnostics when runtime Supabase config is missing', async () => {
    const diagnostics = await getCatalogCommerceRailRuntimeDiagnostics({
      environment: {},
    });

    expect(diagnostics).toMatchObject({
      activeMerchantCount: 0,
      activeSeedCount: 0,
      currentOfferRowCount: 0,
      hasBrowserSupabaseConfig: false,
      hasServerSupabaseConfig: false,
      rowsAfterMerchantJoinCount: 0,
      rowsAfterPriceDeeplinkInStockFiltersCount: 0,
      rowsAfterSeedJoinCount: 0,
      summaryCount: 0,
    });
    expect(diagnostics.missingBrowserSupabaseEnvKeys).toEqual([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]);
    expect(diagnostics.missingServerSupabaseEnvKeys).toEqual([
      'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });

  test('reports production-shaped commerce join and filter counts', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:25:54.539Z',
          offer_seed_id: 'seed-valid',
          price_minor: 9999,
          updated_at: '2026-05-05T12:25:54.539Z',
        },
        {
          availability: 'out_of_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:24:54.539Z',
          offer_seed_id: 'seed-out-of-stock',
          price_minor: 8999,
          updated_at: '2026-05-05T12:24:54.539Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:23:54.539Z',
          offer_seed_id: 'seed-zero-price',
          price_minor: 0,
          updated_at: '2026-05-05T12:23:54.539Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:22:54.539Z',
          offer_seed_id: 'seed-inactive-seed',
          price_minor: 4999,
          updated_at: '2026-05-05T12:22:54.539Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-05T12:21:54.539Z',
          offer_seed_id: 'seed-inactive-merchant',
          price_minor: 5999,
          updated_at: '2026-05-05T12:21:54.539Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
        {
          id: 'merchant-inactive',
          is_active: false,
          name: 'Inactive Shop',
          slug: 'inactive',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-valid',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/simba',
          set_id: '43247-1',
          validation_status: 'valid',
        },
        {
          id: 'seed-out-of-stock',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/c3po',
          set_id: '75398',
          validation_status: 'valid',
        },
        {
          id: 'seed-zero-price',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/zero',
          set_id: '10316',
          validation_status: 'valid',
        },
        {
          id: 'seed-inactive-seed',
          is_active: false,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://partner.example/inactive-seed',
          set_id: '10333',
          validation_status: 'valid',
        },
        {
          id: 'seed-inactive-merchant',
          is_active: true,
          merchant_id: 'merchant-inactive',
          product_url: 'https://partner.example/inactive-merchant',
          set_id: '10354',
          validation_status: 'valid',
        },
      ],
    });

    const diagnostics = await getCatalogCommerceRailRuntimeDiagnostics({
      environment: {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_URL: 'https://example.supabase.co',
      },
      supabaseClient,
    });

    expect(diagnostics).toMatchObject({
      activeMerchantCount: 1,
      activeSeedCount: 4,
      currentOfferRowCount: 5,
      currentOfferRowsWithValidPriceCount: 4,
      hasBrowserSupabaseConfig: true,
      hasServerSupabaseConfig: true,
      rowsAfterMerchantJoinCount: 2,
      rowsAfterPriceDeeplinkInStockFiltersCount: 1,
      rowsAfterSeedJoinCount: 3,
      serverSupabaseUrlSource: 'SUPABASE_URL',
      summaryCount: 2,
    });
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

  test('keeps live-offer API reads ISR-friendly by default when no cache options are provided', async () => {
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
        headers: {
          accept: 'application/json',
        },
        next: {
          revalidate: 21_600,
          tags: ['prices', 'set:71411'],
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
            recentReferencePriceChangeMinor: -1200,
            recentReferencePriceChangedAt: '2026-04-20',
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
      setIds: ['42172-1', '42172'],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/discovery-signals?setIds=42172',
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
      recentReferencePriceChangeMinor: -1200,
      recentReferencePriceChangedAt: '2026-04-20',
      referenceDeltaMinor: -2000,
    });
  });

  test('skips runtime discovery signal API reads when no set ids are provided', async () => {
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

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('keeps scoped runtime discovery signal API reads ISR-friendly by default when no cache options are provided', async () => {
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
      setIds: ['75355'],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/discovery-signals?setIds=75355',
      expect.objectContaining({
        headers: {
          accept: 'application/json',
        },
        next: {
          revalidate: 21_600,
          tags: ['prices'],
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
      setIds: ['42172', '10330'],
    });
    const secondSignalMap = await listCatalogDiscoverySignalsBySetId({
      fetchImpl: secondFetchImpl,
      setIds: ['42172', '10330'],
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
