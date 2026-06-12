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
import {
  buildCatalogThemeSlug,
  type CatalogCollectionLandingPageConfig,
} from '@lego-platform/catalog/util';
import * as supabaseSdk from '@supabase/supabase-js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  type CatalogDiscoverySignal,
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogCollectionLandingPage,
  getCatalogCollectionLandingPageConfigWithPresentation,
  getCatalogHomepageDealQualityDiagnostics,
  getCatalogPrimaryOfferAvailabilityStateBySetId,
  getCatalogPartnerOfferRailDiagnostics,
  getCatalogSetDetailRelatedThemeSnapshot,
  type CatalogResolvedOffer,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  listCatalogAllCurrentOfferSummaries,
  listCatalogCurrentOfferSummaries,
  getCatalogCurrentOfferSummaryBySetId,
  getCatalogThemePageBySlug,
  getHomepageEditorialConfig,
  getCatalogSetBySlug,
  listCanonicalCatalogSets,
  listCatalogCurrentOfferCandidateSetIds,
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
  listHomepageDiscoveryTiles,
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
  scoreCatalogPublicDealMerchandisingCandidate,
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
    commercialUnitType: 'full_set',
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
    maxInFilterValues?: number;
    onSelect?: (args: unknown[]) => void;
    selectError?: (
      args: unknown[],
    ) => { code?: string; message: string } | null;
  } = {},
) {
  let selectArgs: unknown[] = [];
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
        type: 'gt';
        column: keyof Row & string;
        value: number;
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
    gt(column: keyof Row & string, value: number) {
      filters.push({
        column,
        type: 'gt',
        value,
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
      selectArgs = args;
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
            error: { message: string } | null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      const oversizedInFilter = filters.find(
        (filter) =>
          filter.type === 'in' &&
          typeof options.maxInFilterValues === 'number' &&
          filter.values.length > options.maxInFilterValues,
      );

      if (oversizedInFilter) {
        return Promise.resolve({
          count: 0,
          data: [],
          error: {
            message: `IN filter for ${oversizedInFilter.column} exceeded ${options.maxInFilterValues} values.`,
          },
        }).then(onFulfilled, onRejected ?? undefined);
      }

      const selectError = options.selectError?.(selectArgs);

      if (selectError) {
        return Promise.resolve({
          count: 0,
          data: [],
          error: selectError,
        }).then(onFulfilled, onRejected ?? undefined);
      }

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

        if (filter.type === 'gt') {
          return resultRows.filter((row) => {
            const rowValue = row[filter.column];

            return typeof rowValue === 'number' && rowValue > filter.value;
          });
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

          if (filter.type === 'gt') {
            return resultRows.filter((row) => {
              const rowValue = row[filter.column];

              return typeof rowValue === 'number' && rowValue > filter.value;
            });
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
  collectionPresentationRows = [],
  collectionSetRows = [],
  collectionSnapshotRows = [],
  maxInFilterValues,
  primaryThemeRows = [],
  latestOfferRows,
  merchantRows,
  minifigSummaryRows = [],
  offerSeedRows,
  priceHistoryRows = [],
  publicPageSectionRows = [],
  publicPageSectionItemRows = [],
  setImageRows = [],
  snapshotRows = [],
  sourceMetadataRows = [],
  onSelect,
  rpcHandlers = {},
  selectErrors = {},
  sourceThemeRows = [],
  themeMappingRows = [],
  themeSummaryRows = [],
}: {
  catalogRows?: readonly Record<string, unknown>[];
  collectionPresentationRows?: readonly Record<string, unknown>[];
  collectionSetRows?: readonly Record<string, unknown>[];
  collectionSnapshotRows?: readonly Record<string, unknown>[];
  maxInFilterValues?: number;
  primaryThemeRows?: readonly Record<string, unknown>[];
  latestOfferRows: readonly Record<string, unknown>[];
  merchantRows: readonly Record<string, unknown>[];
  minifigSummaryRows?: readonly Record<string, unknown>[];
  offerSeedRows: readonly Record<string, unknown>[];
  priceHistoryRows?: readonly Record<string, unknown>[];
  publicPageSectionRows?: readonly Record<string, unknown>[];
  publicPageSectionItemRows?: readonly Record<string, unknown>[];
  setImageRows?: readonly Record<string, unknown>[];
  snapshotRows?: readonly Record<string, unknown>[];
  sourceMetadataRows?: readonly Record<string, unknown>[];
  onSelect?: (table: string, args: unknown[]) => void;
  rpcHandlers?: Record<
    string,
    (args?: Record<string, unknown>) => {
      data: unknown;
      error: { message?: string } | null;
    }
  >;
  selectErrors?: Record<
    string,
    (args: unknown[]) => { code?: string; message: string } | null
  >;
  sourceThemeRows?: readonly Record<string, unknown>[];
  themeMappingRows?: readonly Record<string, unknown>[];
  themeSummaryRows?: readonly Record<string, unknown>[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'catalog_sets') {
        return createSupabaseTableBuilder(catalogRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_source_themes') {
        return createSupabaseTableBuilder(sourceThemeRows, {
          maxInFilterValues,
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
            maxInFilterValues,
            onSelect: (args) => onSelect?.(table, args),
            selectError: selectErrors[table],
          },
        );
      }

      if (table === 'catalog_theme_mappings') {
        return createSupabaseTableBuilder(themeMappingRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_theme_summaries') {
        return createSupabaseTableBuilder(themeSummaryRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
          selectError: selectErrors[table],
        });
      }

      if (table === 'catalog_set_minifig_summaries') {
        return createSupabaseTableBuilder(minifigSummaryRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_set_source_metadata') {
        return createSupabaseTableBuilder(sourceMetadataRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_set_images') {
        return createSupabaseTableBuilder(setImageRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
          selectError: selectErrors[table],
        });
      }

      if (table === 'collection_page_snapshots') {
        return createSupabaseTableBuilder(collectionSnapshotRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_collection_presentations') {
        return createSupabaseTableBuilder(collectionPresentationRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'catalog_set_collections') {
        return createSupabaseTableBuilder(collectionSetRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_offer_seeds') {
        return createSupabaseTableBuilder(offerSeedRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_merchants') {
        return createSupabaseTableBuilder(merchantRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_offer_latest') {
        return createSupabaseTableBuilder(latestOfferRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'commerce_current_offer_snapshots') {
        return createSupabaseTableBuilder(snapshotRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'pricing_daily_set_history') {
        return createSupabaseTableBuilder(priceHistoryRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'public_page_sections') {
        return createSupabaseTableBuilder(publicPageSectionRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      if (table === 'public_page_section_items') {
        return createSupabaseTableBuilder(publicPageSectionItemRows, {
          maxInFilterValues,
          onSelect: (args) => onSelect?.(table, args),
        });
      }

      throw new Error(`Unexpected table requested in test: ${table}`);
    }),
    rpc: vi.fn((fn: string, args?: Record<string, unknown>) => {
      const handler = rpcHandlers[fn];

      if (!handler) {
        return Promise.resolve({
          data: null,
          error: {
            message: `Unexpected RPC requested in test: ${fn}`,
          },
        });
      }

      return Promise.resolve(handler(args));
    }),
  };
}

describe('catalog effective data access web', () => {
  afterEach(() => {
    resetWebCatalogSupabaseClientsForTests();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test('reads set detail related-theme rail snapshots by set id', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionSnapshotRows: [
        {
          collection_slug: 'set-detail-related-theme:75355',
          generated_at: '2026-06-02T10:00:00.000Z',
          items_json: [
            {
              id: '75446',
              slug: 'grogu-mandalorian-apprentice-75446',
              name: 'Grogu with Hover Pram',
              theme: 'Star Wars',
              releaseYear: 2026,
              pieces: 1048,
            },
          ],
          page: 1,
          page_size: 20,
          sort_key: 'same-theme',
          total_count: 1,
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
    });

    const result = await getCatalogSetDetailRelatedThemeSnapshot({
      setId: '75355',
      supabaseClient,
    });
    const missingResult = await getCatalogSetDetailRelatedThemeSnapshot({
      setId: '10316',
      supabaseClient,
    });

    expect(result).toEqual({
      snapshotGeneratedAt: '2026-06-02T10:00:00.000Z',
      setCards: [
        {
          id: '75446',
          slug: 'grogu-mandalorian-apprentice-75446',
          name: 'Grogu with Hover Pram',
          theme: 'Star Wars',
          releaseYear: 2026,
          pieces: 1048,
        },
      ],
      totalSetCount: 1,
    });
    expect(missingResult).toBeUndefined();
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

  test('prefers stored catalog set images over external catalog images', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'rivendell-10316',
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
      setImageRows: [
        {
          content_type: 'image/webp',
          height: 900,
          image_type: 'hero',
          public_url:
            'https://storage.example.com/catalog-set-images/sets/10316/hero.webp',
          set_id: '10316',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10316/hero.webp',
          width: 1200,
        },
        {
          content_type: 'image/jpeg',
          height: 630,
          image_type: 'social',
          public_url: 'https://www.brickhunt.nl/images/sets/10316/social.jpg',
          set_id: '10316',
          sha256: 'abcdef1234567890abcdef1234567890',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10316/social.jpg',
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 480,
          image_type: 'card',
          public_url: '/images/sets/10316/card.webp',
          set_id: '10316',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10316/card.webp',
          width: 640,
        },
        {
          content_type: 'image/webp',
          height: 900,
          image_type: 'gallery',
          public_url: '/images/sets/10316/gallery/1.webp',
          set_id: '10316',
          sort_order: 1,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10316/gallery/1.webp',
          width: 1200,
        },
      ],
    });

    const [catalogSet] = await listCanonicalCatalogSets({
      supabaseClient,
    });

    expect(catalogSet?.imageUrl).toBe('/images/sets/10316/hero.webp');
    expect(catalogSet?.images).toEqual([
      {
        height: 630,
        order: -100,
        sha256: 'abcdef1234567890abcdef1234567890',
        type: 'social',
        url: '/images/sets/10316/social.jpg',
        width: 1200,
      },
      {
        height: 900,
        order: 201,
        type: 'detail',
        url: '/images/sets/10316/gallery/1.webp',
        width: 1200,
      },
    ]);

    const [setCard] = await listCatalogSetCards({
      supabaseClient,
    });

    expect(setCard?.imageUrl).toBe('/images/sets/10316/card.webp');
    expect(setCard?.primaryImage).toBe('/images/sets/10316/hero.webp');
  });

  test('keeps stored set detail gallery ahead of Brickset gallery fallback', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10309-1.jpg',
          name: 'Succulents',
          piece_count: 771,
          primary_theme_id: 'theme:botanicals',
          release_year: 2022,
          set_id: '10309',
          slug: 'succulents-10309',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '10309-1',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Botanicals',
          id: 'theme:botanicals',
        },
      ],
      setImageRows: [
        {
          content_type: 'image/webp',
          height: 900,
          image_type: 'hero',
          public_url:
            'https://www.brickhunt.nl/images/sets/10309/hero.webp?legacy=1',
          set_id: '10309',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: null,
          width: 1200,
        },
        {
          content_type: 'image/jpeg',
          height: 630,
          image_type: 'social',
          public_url: '/images/sets/10309/social.jpg',
          set_id: '10309',
          sha256: '1234567890abcdef1234567890abcdef',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/social.jpg',
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 480,
          image_type: 'card',
          public_url: '/images/sets/10309/card.webp',
          set_id: '10309',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/card.webp',
          width: 640,
        },
        {
          content_type: 'image/webp',
          height: 240,
          image_type: 'thumbnail',
          public_url: '/images/sets/10309/thumbs/0.webp',
          set_id: '10309',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/thumbs/0.webp',
          width: 320,
        },
        {
          content_type: 'image/webp',
          height: 1493,
          image_type: 'large',
          public_url: '/images/sets/10309/large/0.webp',
          set_id: '10309',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/large/0.webp',
          width: 1920,
        },
        {
          content_type: 'image/webp',
          height: 900,
          image_type: 'gallery',
          metadata_json: {
            galleryRank: 3,
            galleryRoleRank: 8,
            gallerySuppressed: true,
            gallerySuppressionReason:
              'model image in the first 2 gallery positions is too similar to hero',
          },
          public_url: '/images/sets/10309/gallery/1.webp',
          set_id: '10309',
          sort_order: 1,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/gallery/1.webp',
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 900,
          image_role: 'box_front',
          image_type: 'gallery',
          metadata_json: {
            galleryRank: 1,
            galleryRoleRank: 0,
            gallerySuppressed: false,
          },
          public_url: '/images/sets/10309/gallery/2.webp',
          set_id: '10309',
          sort_order: 2,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/gallery/2.webp',
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 1493,
          image_type: 'large',
          public_url: '/images/sets/10309/large/2.webp',
          set_id: '10309',
          sort_order: 2,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/large/2.webp',
          width: 1920,
        },
        {
          content_type: 'image/webp',
          height: 900,
          image_role: 'model_secondary',
          image_type: 'gallery',
          metadata_json: {
            galleryRank: 2,
            galleryRoleRank: 2,
            gallerySuppressed: false,
          },
          public_url:
            'https://www.brickhunt.nl/images/sets/10309/gallery/3.webp',
          set_id: '10309',
          sort_order: 3,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: null,
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 1493,
          image_type: 'large',
          public_url: 'https://www.brickhunt.nl/images/sets/10309/large/3.webp',
          set_id: '10309',
          sort_order: 3,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: null,
          width: 1920,
        },
        {
          content_type: 'image/jpeg',
          duplicate_distance: 0,
          duplicate_reason: 'sha256',
          height: 900,
          image_type: 'gallery',
          image_role: 'model_secondary',
          perceptual_hash: '0000000000000000',
          public_url: '/images/sets/10309/gallery/2-duplicate.webp',
          set_id: '10309',
          sort_order: 4,
          status: 'duplicate',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/gallery/2-duplicate.webp',
          width: 1200,
        },
        {
          content_type: 'image/webp',
          height: 240,
          image_type: 'thumbnail',
          public_url: '/images/sets/10309/thumbs/1.webp',
          set_id: '10309',
          sort_order: 1,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/thumbs/1.webp',
          width: 320,
        },
        {
          content_type: 'image/webp',
          height: 240,
          image_type: 'thumbnail',
          public_url: '/images/sets/10309/thumbs/2.webp',
          set_id: '10309',
          sort_order: 2,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10309/thumbs/2.webp',
          width: 320,
        },
        {
          content_type: 'image/webp',
          height: 240,
          image_type: 'thumbnail',
          public_url:
            'https://ggqystcenwpbrjlkcmnt.supabase.co/storage/v1/object/public/catalog-set-images/sets/10309/thumbs/3.webp?download=1',
          set_id: '10309',
          sort_order: 3,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: null,
          width: 320,
        },
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '10309',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10309-1/10309_alt1.jpg',
                sourceField: 'additionalImage',
                type: 'additional',
              },
            ],
          },
          policy: 'render_publicly_with_attribution',
          source: 'brickset',
        },
      ],
    });

    const catalogSet = await getCatalogSetBySlug({
      slug: 'succulents-10309',
      supabaseClient,
    });

    expect(catalogSet?.imageUrl).toBe('/images/sets/10309/hero.webp');
    expect(catalogSet?.primaryImage).toBe('/images/sets/10309/hero.webp');
    expect(catalogSet?.images).toEqual([
      {
        largeUrl: '/images/sets/10309/large/0.webp',
        order: 0,
        thumbnailUrl: '/images/sets/10309/thumbs/0.webp',
        type: 'hero',
        url: '/images/sets/10309/hero.webp',
      },
      {
        height: 630,
        order: -100,
        sha256: '1234567890abcdef1234567890abcdef',
        type: 'social',
        url: '/images/sets/10309/social.jpg',
        width: 1200,
      },
      {
        height: 900,
        imageRole: 'box_front',
        largeUrl: '/images/sets/10309/large/2.webp',
        order: 201,
        thumbnailUrl: '/images/sets/10309/thumbs/2.webp',
        type: 'detail',
        url: '/images/sets/10309/gallery/2.webp',
        width: 1200,
      },
      {
        height: 900,
        imageRole: 'model_secondary',
        largeUrl: '/images/sets/10309/large/3.webp',
        order: 202,
        thumbnailUrl: '/images/sets/10309/thumbs/3.webp',
        type: 'detail',
        url: '/images/sets/10309/gallery/3.webp',
        width: 1200,
      },
    ]);
    expect(catalogSet?.images?.[2]?.url).toBe(
      '/images/sets/10309/gallery/2.webp',
    );
    expect(
      catalogSet?.images?.some((image) =>
        image.url.includes('images.brickset.com'),
      ),
    ).toBe(false);
    expect(
      catalogSet?.images?.some((image) =>
        image.url.includes('cdn.rebrickable.com'),
      ),
    ).toBe(false);
    expect(
      catalogSet?.images?.some((image) =>
        image.url.includes('2-duplicate.webp'),
      ),
    ).toBe(false);
    expect(
      catalogSet?.images?.some((image) => image.url.includes('gallery/1.webp')),
    ).toBe(false);
    expect(
      catalogSet?.images?.some((image) => image.url.includes('card.webp')),
    ).toBe(false);
    expect(
      catalogSet?.images?.some((image) => image.url.includes('/large/')),
    ).toBe(false);
  });

  test('falls back to external catalog images when stored images are unavailable', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:icons',
          release_year: 2023,
          set_id: '10316',
          slug: 'rivendell-10316',
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
      selectErrors: {
        catalog_set_images: () => ({
          message: 'relation "catalog_set_images" does not exist',
        }),
      },
    });

    const [catalogSet] = await listCanonicalCatalogSets({
      supabaseClient,
    });

    expect(catalogSet?.imageUrl).toBe(
      'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
    );
    expect(catalogSet?.images).toBeUndefined();
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

  test('uses audited LEGO NL source metadata as public display title', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10280-1/1000.jpg',
          name: 'Flower Bouquet',
          piece_count: 756,
          primary_theme_id: 'theme:icons',
          release_year: 2021,
          set_id: '10280',
          slug: 'flower-bouquet-10280',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '10280-1',
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
      sourceMetadataRows: [
        {
          catalog_set_id: '10280',
          locale: 'nl-NL',
          match_confidence: 'exact_set_number',
          metadata_json: {
            description:
              '<p onclick="alert(1)">Geef je huis een <strong>kleurrijke</strong> blikvanger.<br><b>Voor op tafel.</b></p><script>alert("x")</script><ul><li>Rozen</li><li><em>Margrieten</em></li></ul>',
            features: [
              {
                body: 'Zet rozen, leeuwenbekjes en lavendel in je vaas.',
                title: 'Bloemen om zelf te schikken',
              },
              {
                body: '<script>alert(1)</script>Blijft mooi op tafel.',
                title: '<span onclick="x">Displayklaar</span>',
              },
            ],
            title: 'Bloemenboeket',
          },
          policy: 'metadata_only_pending_audit',
          source: 'rakuten-lego-eu',
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

    const [catalogSetDetail] = await Promise.all([
      getCatalogSetBySlug({
        slug: 'flower-bouquet-10280',
        supabaseClient,
      }),
    ]);
    const [setCard] = await listCatalogSetCards({
      listCanonicalCatalogSetsFn: async () =>
        listCanonicalCatalogSets({ supabaseClient }),
    });

    expect(catalogSetDetail).toMatchObject({
      catalogName: 'Flower Bouquet',
      displayTitle: 'Bloemenboeket',
      displayTitleSource: 'rakuten-lego-eu',
      legoProductDescription:
        '<p>Geef je huis een <strong>kleurrijke</strong> blikvanger.<br><strong>Voor op tafel.</strong></p><ul><li>Rozen</li><li><em>Margrieten</em></li></ul>',
      legoProductFeatures: [
        {
          body: 'Zet rozen, leeuwenbekjes en lavendel in je vaas.',
          title: 'Bloemen om zelf te schikken',
        },
        {
          body: 'Blijft mooi op tafel.',
          title: 'Displayklaar',
        },
      ],
      name: 'Bloemenboeket',
      slug: 'flower-bouquet-10280',
    });
    expect(catalogSetDetail?.legoProductDescription).not.toContain('script');
    expect(catalogSetDetail?.legoProductDescription).not.toContain('alert');
    expect(catalogSetDetail?.legoProductDescription).not.toContain('onclick');
    expect(catalogSetDetail?.legoProductDescription).toContain('<br>');
    expect(catalogSetDetail?.legoProductDescription).toContain('<ul><li>');
    expect(setCard).toMatchObject({
      catalogName: 'Flower Bouquet',
      displayTitle: 'Bloemenboeket',
      name: 'Bloemenboeket',
      slug: 'flower-bouquet-10280',
    });
  });

  test('renders attributed Brickset additional images for 10307 only when render mode opts in', async () => {
    vi.spyOn(sharedConfig, 'getBricksetGalleryRenderMode').mockReturnValue(
      'attribution_required',
    );

    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url:
            'https://cdn.rebrickable.com/media/sets/10307-1/112417.jpg',
          name: 'Eiffel Tower',
          piece_count: 10001,
          primary_theme_id: 'theme:icons',
          release_year: 2022,
          set_id: '10307',
          slug: 'eiffel-tower-10307',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '10307-1',
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
      sourceMetadataRows: [
        {
          catalog_set_id: '10307',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            imageRights: {
              policy: 'render_publicly_with_attribution',
            },
            images: [
              {
                attributionRequired: false,
                imageUrl: 'https://images.brickset.com/sets/images/10307-1.jpg',
                rightsPolicy: 'render_publicly_with_attribution',
                sourceField: 'image.imageURL',
                type: 'primary',
              },
              {
                attributionRequired: true,
                imageUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_Lifestyle_alt1.jpg',
                rightsPolicy: 'render_publicly_with_attribution',
                sourceField: 'additionalImages',
                thumbnailUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_Lifestyle_alt1_jpg.jpg',
                type: 'additional',
              },
              {
                attributionRequired: true,
                imageUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_Box_prod.jpg',
                rightsPolicy: 'render_publicly_with_attribution',
                sourceField: 'additionalImages',
                thumbnailUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_Box_prod_jpg.jpg',
                type: 'additional',
              },
              {
                attributionRequired: true,
                imageUrl:
                  'https://images.brickset.com/minifigs/BrickLink/10307-minifig.jpg',
                rightsPolicy: 'render_publicly_with_attribution',
                sourceField: 'brickLinkMinifigImage',
                type: 'minifig',
              },
            ],
          },
          policy: 'render_publicly_with_attribution',
          source: 'brickset',
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

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'eiffel-tower-10307',
      supabaseClient,
    });

    expect(catalogSetDetail?.primaryImage).toBe(
      'https://cdn.rebrickable.com/media/sets/10307-1/112417.jpg',
    );
    expect(catalogSetDetail?.images).toEqual([
      {
        order: 0,
        type: 'hero',
        url: 'https://cdn.rebrickable.com/media/sets/10307-1/112417.jpg',
      },
      {
        attributionText: 'Image(s) courtesy of Brickset.com',
        order: 101,
        thumbnailUrl:
          'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_Box_prod_jpg.jpg',
        type: 'detail',
        url: 'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_Box_prod.jpg',
      },
      {
        attributionText: 'Image(s) courtesy of Brickset.com',
        order: 103,
        thumbnailUrl:
          'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_Lifestyle_alt1_jpg.jpg',
        type: 'detail',
        url: 'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_Lifestyle_alt1.jpg',
      },
    ]);
  });

  test('keeps Brickset gallery disabled by default', async () => {
    vi.spyOn(sharedConfig, 'getBricksetGalleryRenderMode').mockReturnValue(
      'disabled',
    );

    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10280-1/1000.jpg',
          name: 'Flower Bouquet',
          piece_count: 756,
          primary_theme_id: 'theme:icons',
          release_year: 2021,
          set_id: '10280',
          slug: 'flower-bouquet-10280',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '10280-1',
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
      sourceMetadataRows: [
        {
          catalog_set_id: '10280',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            imageRights: {
              policy: 'render_publicly_with_attribution',
            },
            images: [
              {
                attributionRequired: true,
                imageUrl:
                  'https://images.brickset.com/sets/AdditionalImages/10280-1/10280_alt1.jpg',
                rightsPolicy: 'render_publicly_with_attribution',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          policy: 'render_publicly_with_attribution',
          source: 'brickset',
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

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'flower-bouquet-10280',
      supabaseClient,
    });

    expect(catalogSetDetail?.images).toEqual([
      {
        order: 0,
        type: 'hero',
        url: 'https://cdn.rebrickable.com/media/sets/10280-1/1000.jpg',
      },
    ]);
  });

  test('uses Brickset piece count as display fallback when catalog pieces are zero', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-05-27T08:00:00.000Z',
          image_url: 'https://cdn.example.com/11380.jpg',
          name: 'Future Display Set',
          piece_count: 0,
          primary_theme_id: 'theme:icons',
          release_year: 2026,
          set_id: '11380',
          slug: 'future-display-set-11380',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '11380-1',
          status: 'active',
          updated_at: '2026-05-27T08:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
        },
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '11380',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            bricksetSetId: 11380,
            pieces: 2194,
          },
          policy: 'metadata_only_pending_rights_review',
          source: 'brickset',
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

    const [setCard, catalogSetDetail] = await Promise.all([
      listCatalogSetCards({
        limit: 1,
        supabaseClient,
      }).then((setCards) => setCards[0]),
      getCatalogSetBySlug({
        slug: 'future-display-set-11380',
        supabaseClient,
      }),
    ]);

    expect(setCard?.pieces).toBe(2194);
    expect(catalogSetDetail?.pieces).toBe(2194);
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
          public_logo_url: '/themes/logos/editions_logo.png',
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
        logoUrl: '/themes/logos/editions_logo.png',
        name: 'LEGO® Editions',
        slug: 'editions',
      },
      subtheme: 'Nike x LEGO® collectie',
      theme: 'LEGO® Editions',
    });
  });

  test('resolves custom public theme slugs and logos for set detail breadcrumbs', async () => {
    const themeCases = [
      {
        displayName: 'Creator',
        expectedLogoUrl: '/themes/logos/creator-3-in-1_logo.png',
        expectedName: 'Creator 3in1',
        expectedSlug: 'creator-3in1',
        primaryThemeId: 'theme:creator-3in1',
        publicDisplayName: 'Creator 3in1',
        setId: '31168',
        setName: 'Medieval Horse Knight Castle',
        setSlug: 'medieval-horse-knight-castle-31168',
        sourceThemeId: 'rebrickable:creator-3in1',
        sourceThemeName: 'Creator 3-in-1',
      },
      {
        displayName: "Gabby's Dollhouse",
        expectedLogoUrl: '/themes/logos/gabbys-dollhouse_logo.png',
        expectedName: 'LEGO® Gabby’s Dollhouse',
        expectedSlug: 'gabby-s-poppenhuis',
        primaryThemeId: 'theme:gabby-s-poppenhuis',
        publicDisplayName: 'LEGO® Gabby’s Dollhouse',
        setId: '11204',
        setName: "Mermaid Gabby's Aquarium Adventure",
        setSlug: 'mermaid-gabbys-aquarium-adventure-11204',
        sourceThemeId: 'rebrickable:gabby',
        sourceThemeName: "Gabby's Dollhouse",
      },
      {
        displayName: 'Lord of the Rings',
        expectedLogoUrl: '/themes/logos/lord-of-the-rings_logo.png',
        expectedName: 'Lord of the Rings™',
        expectedSlug: 'lord-of-the-rings',
        primaryThemeId: 'lord-of-the-rings',
        publicDisplayName: 'Lord of the Rings™',
        setId: '10354',
        setName: 'The Lord of the Rings: The Shire',
        setSlug: 'the-lord-of-the-rings-the-shire-10354',
        sourceThemeId: 'rebrickable:721',
        sourceThemeName: 'The Lord of the Rings',
        staleMappedThemeId: 'theme:icons',
      },
      {
        displayName: 'Collectible Minifigures',
        expectedLogoUrl: '/themes/logos/minifigures_logo.png',
        expectedName: 'Minifigures',
        expectedSlug: 'collectible-minifigures',
        primaryThemeId: 'theme:collectible-minifigures',
        publicDisplayName: 'Minifigures',
        setId: '71046',
        setName: 'Series 26 Random Box',
        setSlug: 'series-26-random-box-71046',
        sourceThemeId: 'rebrickable:minifigures',
        sourceThemeName: 'Collectible Minifigures',
      },
      {
        displayName: 'Star Wars',
        expectedLogoUrl: '/themes/logos/star-wars_logo.png',
        expectedName: 'Star Wars™',
        expectedSlug: 'star-wars',
        primaryThemeId: 'theme:star-wars',
        publicDisplayName: 'Star Wars™',
        setId: '75422',
        setName: "Yoda's Hut and Jedi Training",
        setSlug: 'yodas-hut-and-jedi-training-75422',
        sourceThemeId: 'rebrickable:star-wars',
        sourceThemeName: 'Star Wars',
      },
      {
        displayName: 'The Legend of Zelda',
        expectedLogoUrl: '/themes/logos/zelda_logo.png',
        expectedName: 'LEGO® The Legend of Zelda™',
        expectedSlug: 'the-legend-of-zelda',
        primaryThemeId: 'theme:the-legend-of-zelda',
        publicDisplayName: 'LEGO® The Legend of Zelda™',
        setId: '77092',
        setName: 'Great Deku Tree 2-in-1',
        setSlug: 'great-deku-tree-2-in-1-77092',
        sourceThemeId: 'rebrickable:zelda',
        sourceThemeName: 'The Legend of Zelda',
      },
    ] as const;

    for (const themeCase of themeCases) {
      const supabaseClient = createCatalogSupabaseClientMock({
        latestOfferRows: [],
        merchantRows: [],
        offerSeedRows: [],
        catalogRows: [
          {
            created_at: '2026-04-17T08:00:00.000Z',
            image_url: `https://cdn.example.com/${themeCase.setId}.jpg`,
            name: themeCase.setName,
            piece_count: 1200,
            primary_theme_id: themeCase.primaryThemeId,
            release_date_precision: 'year',
            release_year: 2026,
            set_id: themeCase.setId,
            slug: themeCase.setSlug,
            source: 'rebrickable',
            source_set_number: `${themeCase.setId}-1`,
            source_theme_id: themeCase.sourceThemeId,
            status: 'active',
            updated_at: '2026-04-17T08:00:00.000Z',
          },
        ],
        primaryThemeRows: [
          {
            display_name: themeCase.displayName,
            id: themeCase.primaryThemeId,
            is_public: true,
            public_display_name: themeCase.publicDisplayName,
            public_logo_url: themeCase.expectedLogoUrl,
            slug: themeCase.expectedSlug,
            status: 'active',
          },
          {
            display_name: 'Icons',
            id: 'theme:icons',
            is_public: true,
            public_display_name: 'LEGO® Icons',
            public_logo_url: '/themes/logos/icons_logo.png',
            slug: 'icons',
            status: 'active',
          },
        ],
        sourceThemeRows: [
          {
            id: themeCase.sourceThemeId,
            source_theme_name: themeCase.sourceThemeName,
          },
        ],
        themeMappingRows: [
          {
            primary_theme_id:
              'staleMappedThemeId' in themeCase
                ? themeCase.staleMappedThemeId
                : themeCase.primaryThemeId,
            source_theme_id: themeCase.sourceThemeId,
          },
        ],
      });

      const catalogSetDetail = await getCatalogSetBySlug({
        slug: themeCase.setSlug,
        supabaseClient,
      });

      expect(catalogSetDetail, themeCase.setName).toMatchObject({
        publicTheme: {
          logoUrl: themeCase.expectedLogoUrl,
          name: themeCase.expectedName,
          slug: themeCase.expectedSlug,
        },
        theme: themeCase.expectedName,
      });
    }
  });

  test('maps curated set-detail overlay attributes such as minifigures', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'lord-of-the-rings',
          release_date_precision: 'year',
          release_year: 2023,
          set_id: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Lord of the Rings',
          id: 'lord-of-the-rings',
          is_public: true,
          public_display_name: 'Lord of the Rings™',
          public_logo_url: '/themes/logos/lord-of-the-rings_logo.png',
          slug: 'lord-of-the-rings',
          status: 'active',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:721',
          source_theme_name: 'The Lord of the Rings',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'lord-of-the-rings',
          source_theme_id: 'rebrickable:721',
        },
      ],
    });

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'the-lord-of-the-rings-rivendell-10316',
      supabaseClient,
    });

    expect(catalogSetDetail).toMatchObject({
      id: '10316',
      minifigureCount: 15,
      recommendedAge: 18,
    });
    expect(catalogSetDetail?.minifigureCount).toBeGreaterThan(0);
  });

  test('loads set-detail minifigure count from Supabase enrichment summaries', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      minifigSummaryRows: [
        {
          minifig_count: 4,
          set_id: '43300',
        },
      ],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-05-14T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/43300-1/1000.jpg',
          name: 'Winnie the Pooh',
          piece_count: 1265,
          primary_theme_id: 'disney',
          release_date_precision: 'year',
          release_year: 2025,
          set_id: '43300',
          slug: 'winnie-the-pooh-43300',
          source: 'rebrickable',
          source_set_number: '43300-1',
          source_theme_id: 'rebrickable:608',
          status: 'active',
          updated_at: '2026-05-14T08:00:00.000Z',
        },
      ],
    });

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'winnie-the-pooh-43300',
      supabaseClient,
    });

    expect(catalogSetDetail).toMatchObject({
      id: '43300',
      minifigureCount: 4,
    });
  });

  test('treats explicit zero minifigure summary as no visible count', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      minifigSummaryRows: [
        {
          minifig_count: 0,
          set_id: '10316',
        },
      ],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'lord-of-the-rings',
          release_date_precision: 'year',
          release_year: 2023,
          set_id: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
    });

    const catalogSetDetail = await getCatalogSetBySlug({
      slug: 'the-lord-of-the-rings-rivendell-10316',
      supabaseClient,
    });

    expect(catalogSetDetail?.minifigureCount).toBe(0);
  });

  test('resolves known set detail public themes and logo urls from source theme hierarchy', async () => {
    const subthemeCases = [
      {
        expectedLogoUrl: '/themes/logos/star-wars_logo.png',
        expectedName: 'Star Wars™',
        expectedSlug: 'star-wars',
        parentSourceThemeId: null,
        parentSourceThemeName: undefined,
        publicThemeId: 'theme:star-wars',
        publicThemeName: 'Star Wars',
        setId: '75446',
        setName: 'Grogu (Mandalorian Apprentice)',
        setSlug: 'grogu-mandalorian-apprentice-75446',
        sourceThemeId: 'rebrickable:158',
        sourceThemeName: 'Star Wars',
      },
      {
        expectedLogoUrl: '/themes/logos/star-wars_logo.png',
        expectedName: 'Star Wars™',
        expectedSlug: 'star-wars',
        parentSourceThemeId: null,
        parentSourceThemeName: undefined,
        publicThemeId: 'theme:star-wars',
        publicThemeName: 'Star Wars',
        setId: '75448',
        setName: 'Clone Shock Trooper Mech',
        setSlug: 'clone-shock-trooper-mech-75448',
        sourceThemeId: 'rebrickable:158',
        sourceThemeName: 'Star Wars',
      },
      {
        expectedLogoUrl: '/themes/logos/gabbys-dollhouse_logo.png',
        expectedName: 'LEGO® Gabby’s Dollhouse',
        expectedSlug: 'gabby-s-poppenhuis',
        parentSourceThemeId: null,
        parentSourceThemeName: undefined,
        publicThemeId: 'theme:gabby-s-poppenhuis',
        publicThemeName: "Gabby's Dollhouse",
        setId: '10788',
        setName: "Gabby's Dollhouse",
        setSlug: 'gabbys-dollhouse-10788',
        sourceThemeId: 'rebrickable:748',
        sourceThemeName: "Gabby's Dollhouse",
      },
      {
        expectedLogoUrl: '/themes/logos/disney_logo.png',
        expectedName: 'Disney',
        expectedSlug: 'disney',
        parentSourceThemeId: 'rebrickable:754',
        parentSourceThemeName: 'Disney',
        publicThemeId: 'theme:disney',
        publicThemeName: 'Disney',
        setId: '10465',
        setName: 'Mickey Mouse Clubhouse with Minnie & Pluto',
        setSlug: 'mickey-mouse-clubhouse-with-minnie-and-pluto-10465',
        sourceThemeId: 'rebrickable:641',
        sourceThemeName: 'Mickey & Friends',
      },
    ] as const;

    for (const subthemeCase of subthemeCases) {
      const supabaseClient = createCatalogSupabaseClientMock({
        latestOfferRows: [],
        merchantRows: [],
        offerSeedRows: [],
        catalogRows: [
          {
            created_at: '2026-04-17T08:00:00.000Z',
            image_url: `https://cdn.example.com/${subthemeCase.setId}.jpg`,
            name: subthemeCase.setName,
            piece_count: 1200,
            primary_theme_id:
              subthemeCase.parentSourceThemeId === null
                ? subthemeCase.publicThemeId
                : 'theme:icons',
            release_date_precision: 'year',
            release_year: 2026,
            set_id: subthemeCase.setId,
            slug: subthemeCase.setSlug,
            source: 'rebrickable',
            source_set_number: `${subthemeCase.setId}-1`,
            source_theme_id: subthemeCase.sourceThemeId,
            status: 'active',
            updated_at: '2026-04-17T08:00:00.000Z',
          },
        ],
        primaryThemeRows: [
          {
            display_name: 'Icons',
            id: 'theme:icons',
            is_public: true,
            public_display_name: 'LEGO® Icons',
            public_logo_url: '/themes/logos/icons_logo.png',
            slug: 'icons',
            status: 'active',
          },
          {
            display_name: subthemeCase.publicThemeName,
            id: subthemeCase.publicThemeId,
            is_public: true,
            public_display_name: subthemeCase.expectedName,
            public_logo_url: subthemeCase.expectedLogoUrl,
            slug: subthemeCase.expectedSlug,
            status: 'active',
          },
        ],
        sourceThemeRows: [
          {
            id: subthemeCase.sourceThemeId,
            parent_source_theme_id: subthemeCase.parentSourceThemeId,
            source_theme_name: subthemeCase.sourceThemeName,
          },
          ...(subthemeCase.parentSourceThemeId &&
          subthemeCase.parentSourceThemeName
            ? [
                {
                  id: subthemeCase.parentSourceThemeId,
                  parent_source_theme_id: null,
                  source_theme_name: subthemeCase.parentSourceThemeName,
                },
              ]
            : []),
        ],
        themeMappingRows: [
          {
            primary_theme_id: subthemeCase.publicThemeId,
            source_theme_id:
              subthemeCase.parentSourceThemeId ?? subthemeCase.sourceThemeId,
          },
        ],
      });

      const catalogSetDetail = await getCatalogSetBySlug({
        slug: subthemeCase.setSlug,
        supabaseClient,
      });

      expect(catalogSetDetail, subthemeCase.setId).toMatchObject({
        id: subthemeCase.setId,
        publicTheme: {
          logoUrl: subthemeCase.expectedLogoUrl,
          name: subthemeCase.expectedName,
          slug: subthemeCase.expectedSlug,
        },
        theme: subthemeCase.expectedName,
      });
    }
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

  test('uses local set-status overlays for collection landing status filters', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75331-1/1000.jpg',
          name: 'The Razor Crest',
          piece_count: 6187,
          primary_theme_id: 'theme:star-wars',
          release_year: 2022,
          set_id: '75331',
          slug: 'the-razor-crest-75331',
          source: 'rebrickable',
          source_set_number: '75331-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75355-1/1000.jpg',
          name: 'X-wing Starfighter',
          piece_count: 1949,
          primary_theme_id: 'theme:star-wars',
          release_year: 2023,
          set_id: '75355',
          slug: 'x-wing-starfighter-75355',
          source: 'rebrickable',
          source_set_number: '75355-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
    });
    const config = {
      browseDescription: 'Sets die bijna verdwijnen.',
      browseEyebrow: 'Niet laten liggen',
      browseTitle: 'Sets om nu te checken',
      canonicalPath: '/laatste-kans-lego-sets',
      description: 'Retiring LEGO sets.',
      filters: {
        setStatuses: ['retiring_soon'],
      },
      h1: 'Retiring LEGO sets',
      intro: 'Kijk naar sets die je niet te lang wilt laten liggen.',
      links: {},
      metaDescription: 'Bekijk retiring LEGO sets.',
      metaTitle: 'Retiring LEGO sets | Brickhunt',
      signalLabel: 'retiring sets',
      slug: 'retiring-lego-sets',
      sort: {
        default: 'recommended',
        options: ['recommended'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      sortKey: 'recommended',
      supabaseClient,
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual([
      '75331',
      '75355',
    ]);
    expect(result.totalSetCount).toBe(2);
  });

  test('selects adult collection sets using explicit age and conservative display criteria', async () => {
    const config = {
      browseDescription: 'Displaysets.',
      browseEyebrow: 'Voor op de plank',
      browseTitle: 'Sets die blijven staan',
      canonicalPath: '/lego-voor-volwassenen',
      description: 'LEGO voor volwassenen.',
      filters: {
        adultCollector: true,
      },
      h1: 'LEGO voor volwassenen',
      intro: 'Kijk naar displaysets en grote bouwprojecten.',
      links: {},
      metaDescription: 'Bekijk LEGO voor volwassenen.',
      metaTitle: 'LEGO voor volwassenen | Brickhunt',
      signalLabel: 'collector sets',
      slug: 'lego-voor-volwassenen',
      sort: {
        default: 'pieces-desc',
        options: ['pieces-desc'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Architecture Display',
          pieceCount: 650,
          primaryTheme: 'Architecture',
          setId: '21099',
          slug: 'architecture-display-21099',
        }),
        createCanonicalCatalogSet({
          name: 'Star Wars Display Ship',
          pieceCount: 1_900,
          primaryTheme: 'Star Wars',
          setId: '75499',
          slug: 'star-wars-display-ship-75499',
        }),
        createCanonicalCatalogSet({
          name: 'Large Kids Playset',
          pieceCount: 3_000,
          primaryTheme: 'DUPLO',
          setId: '10999',
          slug: 'large-kids-playset-10999',
        }),
        createCanonicalCatalogSet({
          name: 'Small Botanicals',
          pieceCount: 300,
          primaryTheme: 'Botanicals',
          setId: '10399',
          slug: 'small-botanicals-10399',
        }),
      ],
      sortKey: 'pieces-desc',
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual([
      '75499',
      '21099',
    ]);
    expect(result.totalSetCount).toBe(2);
  });

  test('uses collectible-minifigures as the secondary minifigure membership slug', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/99999-1/1000.jpg',
          name: 'Darth Vader Desk Display',
          piece_count: 120,
          primary_theme_id: 'theme:star-wars',
          release_year: 2026,
          set_id: '99999',
          slug: 'darth-vader-desk-display-99999',
          source: 'rebrickable',
          source_set_number: '99999-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
          name: 'Rivendell',
          piece_count: 6167,
          primary_theme_id: 'theme:lord-of-the-rings',
          release_year: 2023,
          set_id: '10316',
          slug: 'rivendell-10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable:566',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      collectionSetRows: [
        {
          collection_slug: 'collectible-minifigures',
          enabled: true,
          set_id: '99999',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          slug: 'star-wars',
        },
        {
          display_name: 'The Lord of the Rings',
          id: 'theme:lord-of-the-rings',
          slug: 'the-lord-of-the-rings',
        },
      ],
    });
    const config = {
      browseDescription: 'Minifiguren.',
      browseEyebrow: 'Figuren verzamelen',
      browseTitle: 'Minifiguren die het middelpunt zijn',
      canonicalPath: '/themes/collectible-minifigures',
      description: 'LEGO minifiguren.',
      filters: {
        collectionSlug: 'collectible-minifigures',
      },
      h1: 'LEGO minifiguren',
      intro: 'Kijk naar figuren die zelf het punt zijn.',
      links: {},
      metaDescription: 'Bekijk LEGO minifiguren.',
      metaTitle: 'LEGO minifiguren | Brickhunt',
      signalLabel: 'minifiguur-items',
      slug: 'collectible-minifigures',
      sort: {
        default: 'recommended',
        options: ['recommended'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      sortKey: 'recommended',
      supabaseClient,
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual(['99999']);
    expect(result.totalSetCount).toBe(1);
  });

  test('enriches Collectible Minifigures theme pages with secondary memberships while preserving primary theme identity', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75461-1/1000.jpg',
          name: 'Grote minifiguur van Darth Vader',
          piece_count: 592,
          primary_theme_id: 'theme:star-wars',
          release_year: 2026,
          set_id: '75461',
          slug: 'grote-minifiguur-van-darth-vader-75461',
          source: 'rebrickable',
          source_set_number: '75461-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/71045-1/1000.jpg',
          name: 'Collectible Minifigures Series 25',
          piece_count: 8,
          primary_theme_id: 'theme:collectible-minifigures',
          release_year: 2024,
          set_id: '71045',
          slug: 'collectible-minifigures-series-25-71045',
          source: 'rebrickable',
          source_set_number: '71045-1',
          source_theme_id: 'rebrickable:535',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      collectionSetRows: [
        {
          collection_slug: 'collectible-minifigures',
          enabled: true,
          set_id: '75461',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          slug: 'star-wars',
        },
        {
          display_name: 'Collectible Minifigures',
          id: 'theme:collectible-minifigures',
          public_display_name: 'Collectible Minifigures',
          slug: 'collectible-minifigures',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 1,
          representative_image_url:
            'https://cdn.rebrickable.com/media/sets/71045-1/1000.jpg',
          representative_set_id: '71045',
          theme_id: 'theme:collectible-minifigures',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
    });

    const starWarsPage = await getCatalogThemePageBySlug({
      slug: 'star-wars',
      supabaseClient,
    });
    const minifiguresThemePage = await getCatalogThemePageBySlug({
      slug: 'collectible-minifigures',
      supabaseClient,
    });

    expect(starWarsPage?.setCards.map((setCard) => setCard.id)).toEqual([
      '75461',
    ]);
    expect(minifiguresThemePage?.setCards.map((setCard) => setCard.id)).toEqual(
      ['75461', '71045'],
    );
    expect(minifiguresThemePage?.themeSnapshot.setCount).toBe(2);
    expect(
      minifiguresThemePage?.setCards.find((setCard) => setCard.id === '75461'),
    ).toEqual(
      expect.objectContaining({
        publicTheme: expect.objectContaining({
          slug: 'star-wars',
        }),
        theme: 'Star Wars',
      }),
    );
  });

  test('includes secondary minifigure memberships in the Collectible Minifigures directory count', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/75461-1/1000.jpg',
          name: 'Grote minifiguur van Darth Vader',
          piece_count: 592,
          primary_theme_id: 'theme:star-wars',
          release_year: 2026,
          set_id: '75461',
          slug: 'grote-minifiguur-van-darth-vader-75461',
          source: 'rebrickable',
          source_set_number: '75461-1',
          source_theme_id: 'rebrickable:158',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      collectionSetRows: [
        {
          collection_slug: 'collectible-minifigures',
          enabled: true,
          set_id: '75461',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Collectible Minifigures',
          id: 'theme:collectible-minifigures',
          public_display_name: 'Collectible Minifigures',
          slug: 'collectible-minifigures',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 1,
          representative_image_url:
            'https://cdn.rebrickable.com/media/sets/71045-1/1000.jpg',
          representative_set_id: '71045',
          theme_id: 'theme:collectible-minifigures',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
    });

    const directoryItems = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(
      directoryItems.find(
        (directoryItem) =>
          directoryItem.themeSnapshot.slug === 'collectible-minifigures',
      )?.themeSnapshot.setCount,
    ).toBe(2);
  });

  test('prioritizes precise release metadata for new collection pages before narrow year-only fallbacks', async () => {
    const config = {
      browseDescription: 'Nieuwe sets.',
      browseEyebrow: 'Net uit',
      browseTitle: 'Nieuwe dozen',
      canonicalPath: '/nieuwe-lego-sets',
      description: 'Nieuwe LEGO sets.',
      filters: {
        recentRelease: true,
      },
      h1: 'Nieuwe LEGO sets',
      intro: 'Kijk naar sets die net uit zijn of eraan komen.',
      links: {},
      metaDescription: 'Bekijk nieuwe LEGO sets.',
      metaTitle: 'Nieuwe LEGO sets | Brickhunt',
      signalLabel: 'nieuwe sets',
      slug: 'nieuwe-lego-sets',
      sort: {
        default: 'newest',
        options: ['newest'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'AT-ST Walker',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '75417',
          slug: 'at-st-walker-75417',
        }),
        createCanonicalCatalogSet({
          name: 'The Shire',
          releaseDate: '2026-07-01',
          releaseDatePrecision: 'month',
          releaseYear: 2026,
          setId: '10354',
          slug: 'the-shire-10354',
        }),
        createCanonicalCatalogSet({
          name: 'Year Only Current Release',
          releaseYear: 2026,
          setId: '60499',
          slug: 'year-only-current-release-60499',
        }),
        createCanonicalCatalogSet({
          name: 'Older Precise Release',
          releaseDate: '2025-01-01',
          releaseDatePrecision: 'month',
          releaseYear: 2025,
          setId: '10399',
          slug: 'older-precise-release-10399',
        }),
      ],
      now: new Date('2026-05-25T12:00:00.000Z'),
      sortKey: 'newest',
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual([
      '75417',
      '10354',
      '60499',
    ]);
    expect(result.totalSetCount).toBe(3);
  });

  test('keeps zero-piece future placeholders out of new collection pages', async () => {
    const config = {
      browseDescription: 'Nieuwe sets.',
      browseEyebrow: 'Net uit',
      browseTitle: 'Nieuwe dozen',
      canonicalPath: '/nieuwe-lego-sets',
      description: 'Nieuwe LEGO sets.',
      filters: {
        recentRelease: true,
      },
      h1: 'Nieuwe LEGO sets',
      intro: 'Kijk naar sets die net uit zijn of eraan komen.',
      links: {},
      metaDescription: 'Bekijk nieuwe LEGO sets.',
      metaTitle: 'Nieuwe LEGO sets | Brickhunt',
      signalLabel: 'nieuwe sets',
      slug: 'nieuwe-lego-sets',
      sort: {
        default: 'newest',
        options: ['newest'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Advent Calendar Placeholder',
          pieceCount: 0,
          primaryTheme: 'Star Wars',
          releaseDate: '2026-06-15',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '75499',
          slug: 'advent-calendar-placeholder-75499',
        }),
        createCanonicalCatalogSet({
          name: 'Toy Story Slinky Dog Bookends',
          pieceCount: 1311,
          primaryTheme: 'Disney',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          setId: '43301',
          slug: 'toy-story-slinky-dog-bookends-43301',
        }),
        createCanonicalCatalogSet({
          name: 'Far Future Year Only Placeholder',
          pieceCount: 300,
          primaryTheme: 'City',
          releaseYear: 2027,
          setId: '60499',
          slug: 'far-future-year-only-placeholder-60499',
        }),
      ],
      now: new Date('2026-05-27T12:00:00.000Z'),
      sortKey: 'newest',
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual(['43301']);
    expect(result.totalSetCount).toBe(1);
  });

  test('includes announced new sets when Brickset supplies release metadata and pieces', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-05-20T08:00:00.000Z',
          image_url: 'https://cdn.example.com/11380.jpg',
          name: 'Future Announced Set',
          piece_count: 0,
          primary_theme_id: 'theme:icons',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2026,
          set_id: '11380',
          slug: 'future-announced-set-11380',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '11380-1',
          status: 'active',
          updated_at: '2026-05-26T08:00:00.000Z',
        },
        {
          created_at: '2026-05-20T08:00:00.000Z',
          image_url: 'https://cdn.example.com/11381.jpg',
          name: 'Placeholder Without Pieces',
          piece_count: 0,
          primary_theme_id: 'theme:icons',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2026,
          set_id: '11381',
          slug: 'placeholder-without-pieces-11381',
          source: 'rebrickable',
          source_theme_id: 'rebrickable:721',
          source_set_number: '11381-1',
          status: 'active',
          updated_at: '2026-05-26T08:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          slug: 'icons',
        },
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '11380',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            bricksetSetId: 11380,
            launchDate: '2026-06-20',
            pieces: 2194,
          },
          policy: 'metadata_only_pending_rights_review',
          source: 'brickset',
        },
        {
          catalog_set_id: '11381',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            bricksetSetId: 11381,
            launchDate: '2026-06-20',
          },
          policy: 'metadata_only_pending_rights_review',
          source: 'brickset',
        },
      ],
    });
    const config = {
      browseDescription: 'Nieuwe sets.',
      browseEyebrow: 'Net uit',
      browseTitle: 'Nieuwe dozen',
      canonicalPath: '/nieuwe-lego-sets',
      description: 'Nieuwe LEGO sets.',
      filters: {
        recentRelease: true,
      },
      h1: 'Nieuwe LEGO sets',
      intro: 'Kijk naar sets die net uit zijn of eraan komen.',
      links: {},
      metaDescription: 'Bekijk nieuwe LEGO sets.',
      metaTitle: 'Nieuwe LEGO sets | Brickhunt',
      signalLabel: 'nieuwe sets',
      slug: 'nieuwe-lego-sets',
      sort: {
        default: 'newest',
        options: ['newest'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      now: new Date('2026-05-27T12:00:00.000Z'),
      sortKey: 'newest',
      supabaseClient,
    });

    expect(result.setCards).toEqual([
      expect.objectContaining({
        id: '11380',
        pieces: 2194,
        releaseDate: '2026-06-20',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
      }),
    ]);
    expect(result.totalSetCount).toBe(1);
  });

  test('finds new releases beyond the default created-at catalog window', async () => {
    const olderCatalogRows = Array.from({ length: 1_000 }, (_, index) => {
      const setId = String(20_000 + index);

      return {
        created_at: `2026-05-${String((index % 20) + 1).padStart(2, '0')}T08:00:00.000Z`,
        image_url: `https://cdn.example.com/${setId}.jpg`,
        name: `Older Catalog Window Set ${setId}`,
        piece_count: 100 + index,
        primary_theme_id: 'theme:city',
        release_date: '2024-01-01',
        release_date_precision: 'year',
        release_year: 2024,
        set_id: setId,
        slug: `older-catalog-window-set-${setId}`,
        source: 'rebrickable',
        source_set_number: `${setId}-1`,
        status: 'active',
        updated_at: '2026-05-26T08:00:00.000Z',
      };
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        ...olderCatalogRows,
        {
          created_at: '2024-01-01T08:00:00.000Z',
          image_url:
            'https://cdn.rebrickable.com/media/sets/43301-1/170847.jpg',
          name: 'Toy Story Slinky Dog Bookends',
          piece_count: 1297,
          primary_theme_id: 'theme:disney',
          release_date: '2026-06-01',
          release_date_precision: 'month',
          release_year: 2026,
          set_id: '43301',
          slug: 'toy-story-slinky-dog-bookends-43301',
          source: 'rebrickable',
          source_set_number: '43301-1',
          status: 'active',
          updated_at: '2026-05-26T08:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'City',
          id: 'theme:city',
          slug: 'city',
        },
        {
          display_name: 'Disney',
          id: 'theme:disney',
          slug: 'disney',
        },
      ],
    });
    const config = {
      browseDescription: 'Nieuwe sets.',
      browseEyebrow: 'Net uit',
      browseTitle: 'Nieuwe dozen',
      canonicalPath: '/nieuwe-lego-sets',
      description: 'Nieuwe LEGO sets.',
      filters: {
        recentRelease: true,
      },
      h1: 'Nieuwe LEGO sets',
      intro: 'Kijk naar sets die net uit zijn of eraan komen.',
      links: {},
      metaDescription: 'Bekijk nieuwe LEGO sets.',
      metaTitle: 'Nieuwe LEGO sets | Brickhunt',
      signalLabel: 'nieuwe sets',
      slug: 'nieuwe-lego-sets',
      sort: {
        default: 'newest',
        options: ['newest'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      now: new Date('2026-05-27T12:00:00.000Z'),
      sortKey: 'newest',
      supabaseClient,
    });

    expect(result.setCards.map((setCard) => setCard.id)).toContain('43301');
  });

  test('uses Brickset launch dates for recent release collection matching when metadata exists', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2025-01-01T08:00:00.000Z',
          image_url: 'https://cdn.example.com/10280.jpg',
          name: 'Flower Bouquet',
          piece_count: 756,
          primary_theme_id: 'theme:botanicals',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2025,
          set_id: '10280',
          slug: 'flower-bouquet-10280',
          source: 'rebrickable',
          source_set_number: '10280-1',
          status: 'active',
          updated_at: '2026-05-26T08:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Botanicals',
          id: 'theme:botanicals',
          slug: 'botanicals',
        },
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '10280',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            bricksetSetId: 31025,
            launchDate: '2026-05-15',
          },
          policy: 'metadata_only_pending_rights_review',
          source: 'brickset',
        },
      ],
    });
    const config = {
      browseDescription: 'Nieuwe sets.',
      browseEyebrow: 'Net uit',
      browseTitle: 'Nieuwe dozen',
      canonicalPath: '/nieuwe-lego-sets',
      description: 'Nieuwe LEGO sets.',
      filters: {
        recentRelease: true,
      },
      h1: 'Nieuwe LEGO sets',
      intro: 'Kijk naar sets die net uit zijn of eraan komen.',
      links: {},
      metaDescription: 'Bekijk nieuwe LEGO sets.',
      metaTitle: 'Nieuwe LEGO sets | Brickhunt',
      signalLabel: 'nieuwe sets',
      slug: 'nieuwe-lego-sets',
      sort: {
        default: 'newest',
        options: ['newest'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      now: new Date('2026-05-27T12:00:00.000Z'),
      sortKey: 'newest',
      supabaseClient,
    });

    expect(result.setCards).toEqual([
      expect.objectContaining({
        id: '10280',
        releaseDate: '2026-05-15',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
      }),
    ]);
  });

  test('uses current-offer snapshots for price-filtered collection pages', async () => {
    const selectedTables: string[] = [];
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/10307.jpg',
          name: 'Eiffel Tower',
          piece_count: 10001,
          primary_theme_id: 'theme:icons',
          release_year: 2022,
          set_id: '10307',
          slug: 'eiffel-tower-10307',
          source: 'rebrickable',
          source_set_number: '10307-1',
          source_theme_id: 'rebrickable:721',
          status: 'active',
          updated_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      onSelect: (table) => {
        selectedTables.push(table);
      },
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          slug: 'icons',
        },
      ],
      rpcHandlers: {
        list_catalog_current_offer_candidate_set_ids: () => ({
          data: [
            {
              set_id: '10307',
            },
          ],
          error: null,
        }),
      },
      snapshotRows: [
        {
          best_availability: 'in_stock',
          best_checked_at: '2026-05-26T08:00:00.000Z',
          best_commercial_unit_type: 'single_item',
          best_merchant_name: 'LEGO EU',
          best_merchant_slug: 'rakuten-lego-eu',
          best_price_minor: 4999,
          best_product_url:
            'https://www.lego.com/nl-nl/product/eiffel-tower-10307',
          computed_at: new Date().toISOString(),
          condition: 'new',
          currency_code: 'EUR',
          offer_count: 1,
          offers: [
            {
              availability: 'in_stock',
              checkedAt: '2026-05-26T08:00:00.000Z',
              commercialUnitType: 'single_item',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchantName: 'LEGO EU',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 4999,
              setId: '10307',
              url: 'https://www.lego.com/nl-nl/product/eiffel-tower-10307',
            },
          ],
          region_code: 'NL',
          set_id: '10307',
        },
      ],
    });
    const config = {
      browseDescription: 'Budget sets.',
      browseEyebrow: 'Onder budget',
      browseTitle: 'Sets onder budget',
      canonicalPath: '/lego-sets-onder-50-euro',
      description: 'LEGO sets onder 50 euro.',
      filters: {
        maxBestPriceMinor: 5_000,
      },
      h1: 'LEGO sets onder 50 euro',
      intro: 'Kijk naar sets onder budget.',
      links: {},
      metaDescription: 'Bekijk LEGO sets onder 50 euro.',
      metaTitle: 'LEGO sets onder 50 euro | Brickhunt',
      signalLabel: 'sets onder 50 euro',
      slug: 'lego-sets-onder-50-euro',
      sort: {
        default: 'price-asc',
        options: ['price-asc'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      sortKey: 'price-asc',
      supabaseClient,
    });

    expect(result.setCards.map((setCard) => setCard.id)).toEqual(['10307']);
    expect(result.bestPriceMinorBySetId.get('10307')).toBe(4999);
    expect(supabaseClient.from).toHaveBeenCalledWith(
      'commerce_current_offer_snapshots',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_seeds',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_latest',
    );
    expect(selectedTables).toContain('commerce_current_offer_snapshots');
  });

  test('uses stale snapshot prices for large price-filtered collection pages without live reconstruction', async () => {
    const selectedTables: string[] = [];
    const catalogRows = Array.from({ length: 500 }, (_, index) => {
      const setId = String(10_000 + index);

      return {
        created_at: '2026-04-18T08:00:00.000Z',
        image_url: `https://cdn.example.com/${setId}.jpg`,
        name: `Budget Set ${setId}`,
        piece_count: 100 + index,
        primary_theme_id: 'theme:city',
        release_year: 2026,
        set_id: setId,
        slug: `budget-set-${setId}`,
        source: 'rebrickable',
        source_set_number: `${setId}-1`,
        status: 'active',
        updated_at: '2026-04-18T08:00:00.000Z',
      };
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows,
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-26T08:00:00.000Z',
          offer_seed_id: 'seed-10000',
          price_minor: 4999,
          updated_at: '2026-05-26T08:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-lego',
          is_active: true,
          name: 'LEGO EU',
          slug: 'rakuten-lego-eu',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-10000',
          is_active: true,
          merchant_id: 'merchant-lego',
          product_url: 'https://www.lego.com/nl-nl/product/budget-set-10000',
          set_id: '10000',
          validation_status: 'valid',
        },
      ],
      onSelect: (table) => {
        selectedTables.push(table);
      },
      primaryThemeRows: [
        {
          display_name: 'City',
          id: 'theme:city',
          slug: 'city',
        },
      ],
      rpcHandlers: {
        list_catalog_current_offer_candidate_set_ids: () => ({
          data: catalogRows.map((row) => ({
            set_id: row.set_id,
          })),
          error: null,
        }),
      },
      snapshotRows: catalogRows.map((row) => ({
        best_availability: 'in_stock',
        best_checked_at: '2026-05-22T08:00:00.000Z',
        best_commercial_unit_type: 'single_item',
        best_merchant_name: 'LEGO EU',
        best_merchant_slug: 'rakuten-lego-eu',
        best_price_minor: 4999,
        best_product_url: `https://www.lego.com/nl-nl/product/${row.slug}`,
        computed_at: '2026-05-22T08:00:00.000Z',
        condition: 'new',
        currency_code: 'EUR',
        offer_count: 1,
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-22T08:00:00.000Z',
            commercialUnitType: 'single_item',
            condition: 'new',
            currency: 'EUR',
            market: 'NL',
            merchantName: 'LEGO EU',
            merchantSlug: 'rakuten-lego-eu',
            priceMinor: 4999,
            setId: row.set_id,
            url: `https://www.lego.com/nl-nl/product/${row.slug}`,
          },
        ],
        region_code: 'NL',
        set_id: row.set_id,
      })),
    });
    const config = {
      browseDescription: 'Budget sets.',
      browseEyebrow: 'Onder budget',
      browseTitle: 'Sets onder budget',
      canonicalPath: '/lego-sets-onder-50-euro',
      description: 'LEGO sets onder 50 euro.',
      filters: {
        maxBestPriceMinor: 5_000,
      },
      h1: 'LEGO sets onder 50 euro',
      intro: 'Kijk naar sets onder budget.',
      links: {},
      metaDescription: 'Bekijk LEGO sets onder 50 euro.',
      metaTitle: 'LEGO sets onder 50 euro | Brickhunt',
      signalLabel: 'sets onder 50 euro',
      slug: 'lego-sets-onder-50-euro',
      sort: {
        default: 'price-asc',
        options: ['price-asc'],
      },
    } satisfies CatalogCollectionLandingPageConfig;

    const result = await getCatalogCollectionLandingPage({
      config,
      now: new Date('2026-05-26T12:00:00.000Z'),
      sortKey: 'price-asc',
      supabaseClient,
    });

    expect(result.setCards).toHaveLength(40);
    expect(result.bestPriceMinorBySetId.size).toBe(500);
    expect(result.bestPriceMinorBySetId.get('10000')).toBe(4999);
    expect(supabaseClient.from).toHaveBeenCalledWith(
      'commerce_current_offer_snapshots',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_seeds',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_latest',
    );
    expect(selectedTables).toContain('commerce_current_offer_snapshots');
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
          name: 'Icons',
        }),
      }),
      expect.objectContaining({
        themeSnapshot: expect.objectContaining({
          name: 'Star Wars',
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
        (directoryItem) => directoryItem.themeSnapshot.name === 'Icons',
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
    ).toEqual(expect.arrayContaining(['City', 'Star Wars']));
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
          public_hero_text_color: '#ffffff',
          public_image_url: 'https://cdn.example.com/custom-icons.jpg',
          public_logo_url: 'https://cdn.example.com/icons-logo.svg',
          public_order: 1,
          public_surface_color: '#234bcd',
          public_surface_text_color: '#ffffff',
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
      introSupport: undefined,
      momentum: 'Grote blikvangers voor op de plank.',
      name: 'Custom Icons',
      slug: 'icons',
    });
    expect(iconsItem?.imageUrl).toBe(
      'https://cdn.example.com/custom-icons.jpg',
    );
    expect(iconsItem?.visual).toMatchObject({
      backgroundColor: '#234bcd',
      imageUrl: 'https://cdn.example.com/custom-icons.jpg',
      textColor: '#ffffff',
    });
    expect(cityItem?.themeSnapshot.name).toBe('City');
    expect(cityItem?.themeSnapshot.introSupport).toContain(
      'Begin met Snackbartruck',
    );
    expect(cityItem?.imageUrl).toBe(
      'https://cdn.example.com/city-representative.jpg',
    );
    expect(cityItem?.visual?.backgroundColor).toBeUndefined();
    expect(cityItem?.visual?.imageUrl).toBeUndefined();
  });

  test('renders theme directory when optional tile image column is missing locally', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/icons-set.jpg',
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
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          public_display_name: 'LEGO Icons',
          public_image_url: 'https://cdn.example.com/icons-hero.jpg',
          public_order: 1,
          slug: 'icons',
          status: 'active',
        },
      ],
      selectErrors: {
        catalog_themes: (args) =>
          String(args[0] ?? '').includes('public_tile_image_url')
            ? {
                code: 'PGRST204',
                message:
                  "Could not find the 'public_tile_image_url' column of 'catalog_themes' in the schema cache",
              }
            : null,
      },
      themeSummaryRows: [
        {
          active_set_count: 56,
          representative_image_url: 'https://cdn.example.com/icons-summary.jpg',
          representative_set_id: '10326',
          theme_id: 'theme:icons',
          updated_at: '2026-06-06T00:00:00.000Z',
        },
      ],
    });

    const [iconsItem] = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(iconsItem?.themeSnapshot).toMatchObject({
      name: 'LEGO Icons',
      setCount: 56,
      slug: 'icons',
    });
    expect(iconsItem?.imageUrl).toBe('https://cdn.example.com/icons-hero.jpg');
  });

  test('renders theme page when optional tile image column is missing locally', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/icons-set.jpg',
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
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          public_display_name: 'LEGO Icons',
          public_image_url: 'https://cdn.example.com/icons-hero.jpg',
          public_order: 1,
          slug: 'icons',
          status: 'active',
        },
      ],
      selectErrors: {
        catalog_themes: (args) =>
          String(args[0] ?? '').includes('public_tile_image_url')
            ? {
                code: 'PGRST204',
                message:
                  "Could not find the 'public_tile_image_url' column of 'catalog_themes' in the schema cache",
              }
            : null,
      },
      themeSummaryRows: [
        {
          active_set_count: 56,
          representative_image_url: 'https://cdn.example.com/icons-summary.jpg',
          representative_set_id: '10326',
          theme_id: 'theme:icons',
          updated_at: '2026-06-06T00:00:00.000Z',
        },
      ],
    });

    const themePage = await getCatalogThemePageBySlug({
      slug: 'icons',
      supabaseClient,
    });

    expect(themePage?.themeSnapshot).toMatchObject({
      name: 'LEGO Icons',
      setCount: 56,
      slug: 'icons',
    });
    expect(themePage?.setCards.map((setCard) => setCard.id)).toEqual(['10326']);
  });

  test('renders theme directory with live set fallbacks when summaries fail', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/icons-set.jpg',
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
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          public_order: 1,
          slug: 'icons',
          status: 'active',
        },
      ],
      selectErrors: {
        catalog_theme_summaries: () => ({
          code: '42P01',
          message: 'relation "catalog_theme_summaries" does not exist',
        }),
      },
    });

    const [iconsItem] = await listCatalogThemeDirectoryItems({
      supabaseClient,
    });

    expect(iconsItem?.themeSnapshot).toMatchObject({
      name: 'Icons',
      setCount: 1,
      slug: 'icons',
    });
    expect(iconsItem?.imageUrl).toBe('https://cdn.example.com/icons-set.jpg');
  });

  test('keeps homepage theme rail curated while directory remains data-driven', async () => {
    const createCatalogRow = ({
      imageUrl,
      name,
      primaryThemeId,
      setId,
      slug,
    }: {
      imageUrl: string;
      name: string;
      primaryThemeId: string;
      setId: string;
      slug: string;
    }) => ({
      created_at: '2026-06-01T00:00:00.000Z',
      image_url: imageUrl,
      name,
      piece_count: 1000,
      primary_theme_id: primaryThemeId,
      release_date: null,
      release_date_precision: 'year',
      release_year: 2026,
      set_id: setId,
      slug,
      source: 'rebrickable',
      source_set_number: `${setId}-1`,
      source_theme_id: null,
      status: 'active',
      updated_at: '2026-06-01T00:00:00.000Z',
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/75419.jpg',
          name: 'Death Star',
          primaryThemeId: 'theme:star-wars',
          setId: '75419',
          slug: 'death-star-75419',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/76269.jpg',
          name: 'Avengers Tower',
          primaryThemeId: 'theme:marvel',
          setId: '76269',
          slug: 'avengers-tower-76269',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/76417.jpg',
          name: 'Gringotts Wizarding Bank - Collectors Edition',
          primaryThemeId: 'theme:harry-potter',
          setId: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/11384.jpg',
          name: 'Golden Retriever Puppy',
          primaryThemeId: 'theme:icons',
          setId: '11384',
          slug: 'golden-retriever-puppy-11384',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/43222.jpg',
          name: 'Disney Castle',
          primaryThemeId: 'theme:disney',
          setId: '43222',
          slug: 'disney-castle-43222',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/42172.jpg',
          name: 'McLaren P1',
          primaryThemeId: 'theme:technic',
          setId: '42172',
          slug: 'mclaren-p1-42172',
        }),
      ],
      primaryThemeRows: [
        {
          display_name: 'Architecture',
          id: 'theme:architecture',
          is_public: true,
          public_homepage_order: 1,
          public_order: 1,
          slug: 'architecture',
          status: 'active',
        },
        {
          display_name: 'Botanicals',
          id: 'theme:botanicals',
          is_public: true,
          public_homepage_order: 2,
          public_order: 2,
          slug: 'botanicals',
          status: 'active',
        },
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          public_display_name: 'Star Wars™',
          public_homepage_order: 80,
          public_order: 80,
          public_surface_color: '#14213d',
          public_surface_text_color: '#ffffff',
          slug: 'star-wars',
          status: 'active',
        },
        {
          display_name: 'Marvel',
          id: 'theme:marvel',
          is_public: true,
          public_display_name: 'Marvel',
          public_homepage_order: 90,
          public_order: 90,
          slug: 'marvel',
          status: 'active',
        },
        {
          display_name: 'Harry Potter',
          id: 'theme:harry-potter',
          is_public: true,
          public_display_name: 'Harry Potter™',
          public_homepage_order: 100,
          public_order: 100,
          slug: 'harry-potter',
          status: 'active',
        },
        {
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          public_display_name: 'LEGO® Icons',
          public_homepage_order: 110,
          public_order: 110,
          slug: 'icons',
          status: 'active',
        },
        {
          display_name: 'Disney',
          id: 'theme:disney',
          is_public: true,
          public_display_name: 'Disney',
          public_homepage_order: 120,
          public_order: 120,
          slug: 'disney',
          status: 'active',
        },
        {
          display_name: 'Technic',
          id: 'theme:technic',
          is_public: true,
          public_display_name: 'Technic',
          public_homepage_order: 130,
          public_order: 130,
          slug: 'technic',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 4,
          representative_image_url: 'https://cdn.example.com/architecture.jpg',
          representative_set_id: '21065',
          theme_id: 'theme:architecture',
        },
        {
          active_set_count: 8,
          representative_image_url: 'https://cdn.example.com/botanicals.jpg',
          representative_set_id: '10329',
          theme_id: 'theme:botanicals',
        },
        {
          active_set_count: 129,
          representative_image_url:
            'https://cdn.example.com/random-star-wars.jpg',
          representative_set_id: '75313',
          theme_id: 'theme:star-wars',
        },
        {
          active_set_count: 65,
          representative_image_url: 'https://cdn.example.com/random-marvel.jpg',
          representative_set_id: '76313',
          theme_id: 'theme:marvel',
        },
        {
          active_set_count: 72,
          representative_image_url:
            'https://cdn.example.com/random-harry-potter.jpg',
          representative_set_id: '76419',
          theme_id: 'theme:harry-potter',
        },
        {
          active_set_count: 54,
          representative_image_url: 'https://cdn.example.com/random-icons.jpg',
          representative_set_id: '10316',
          theme_id: 'theme:icons',
        },
        {
          active_set_count: 31,
          representative_image_url: 'https://cdn.example.com/random-disney.jpg',
          representative_set_id: '43295',
          theme_id: 'theme:disney',
        },
        {
          active_set_count: 44,
          representative_image_url:
            'https://cdn.example.com/random-technic.jpg',
          representative_set_id: '42240',
          theme_id: 'theme:technic',
        },
      ],
    });

    const [homepageItems, directoryItems] = await Promise.all([
      listHomepageThemeDirectoryItems({
        supabaseClient,
      }),
      listCatalogThemeDirectoryItems({
        limit: 3,
        supabaseClient,
      }),
    ]);

    expect(homepageItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Star Wars™',
      'Marvel',
      'Harry Potter™',
      'LEGO® Icons',
      'Disney',
      'Technic',
    ]);
    expect(homepageItems.map((item) => item.themeSnapshot.setCount)).toEqual([
      129, 65, 72, 54, 31, 44,
    ]);
    expect(
      homepageItems.map((item) => item.themeSnapshot.signatureSet),
    ).toEqual([
      'Death Star',
      'Avengers toren',
      'Goudgrijp Tovenaarsbank - Verzameleditie',
      'Golden retriever puppy',
      'Disney Castle',
      'McLaren P1',
    ]);
    expect(homepageItems.map((item) => item.imageUrl)).toEqual([
      'https://cdn.example.com/75419.jpg',
      'https://cdn.example.com/76269.jpg',
      'https://cdn.example.com/76417.jpg',
      'https://cdn.example.com/11384.jpg',
      'https://cdn.example.com/43222.jpg',
      'https://cdn.example.com/42172.jpg',
    ]);
    expect(homepageItems[0]?.visual).toMatchObject({
      backgroundColor: '#14213d',
      imageUrl: 'https://cdn.example.com/75419.jpg',
      textColor: '#ffffff',
    });
    expect(directoryItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Architecture',
      'Botanicals',
      'Disney',
    ]);
  });

  test('uses CMS homepage theme rail order and representative set images while keeping dynamic counts', async () => {
    const createCatalogRow = ({
      imageUrl,
      name,
      primaryThemeId,
      setId,
      slug,
    }: {
      imageUrl: string;
      name: string;
      primaryThemeId: string;
      setId: string;
      slug: string;
    }) => ({
      created_at: '2026-06-01T00:00:00.000Z',
      image_url: imageUrl,
      name,
      piece_count: 1000,
      primary_theme_id: primaryThemeId,
      release_date: null,
      release_date_precision: 'year',
      release_year: 2026,
      set_id: setId,
      slug,
      source: 'rebrickable',
      source_set_number: `${setId}-1`,
      source_theme_id: null,
      status: 'active',
      updated_at: '2026-06-01T00:00:00.000Z',
    });
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/76269.jpg',
          name: 'Avengers Tower',
          primaryThemeId: 'theme:marvel',
          setId: '76269',
          slug: 'avengers-tower-76269',
        }),
        createCatalogRow({
          imageUrl: 'https://cdn.example.com/43222.jpg',
          name: 'Disney Castle',
          primaryThemeId: 'theme:disney',
          setId: '43222',
          slug: 'disney-castle-43222',
        }),
      ],
      primaryThemeRows: [
        {
          display_name: 'Marvel',
          id: 'theme:marvel',
          is_public: true,
          public_display_name: 'Marvel',
          public_homepage_order: 90,
          public_order: 90,
          slug: 'marvel',
          status: 'active',
        },
        {
          display_name: 'Disney',
          id: 'theme:disney',
          is_public: true,
          public_display_name: 'Disney',
          public_homepage_order: 120,
          public_order: 120,
          slug: 'disney',
          status: 'active',
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-theme-rail',
          layout: 'theme_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'theme_rail',
          sort_order: 20,
          subtitle: null,
          title: 'Kies je wereld',
        },
      ],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-disney',
          image_set_id: '43222',
          image_url: null,
          metadata_json: {},
          reference_id: 'disney',
          reference_type: 'theme',
          section_id: 'section-theme-rail',
          sort_order: 10,
          title_override: 'Disney Castle',
        },
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-marvel',
          image_set_id: '76269',
          image_url: null,
          metadata_json: {},
          reference_id: 'marvel',
          reference_type: 'theme',
          section_id: 'section-theme-rail',
          sort_order: 20,
          title_override: 'Avengers toren',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 31,
          representative_image_url: 'https://cdn.example.com/random-disney.jpg',
          representative_set_id: '43295',
          theme_id: 'theme:disney',
        },
        {
          active_set_count: 65,
          representative_image_url: 'https://cdn.example.com/random-marvel.jpg',
          representative_set_id: '76313',
          theme_id: 'theme:marvel',
        },
      ],
    });

    const config = await getHomepageEditorialConfig({ supabaseClient });
    const homepageItems = await listHomepageThemeDirectoryItems({
      homepageEditorialConfig: config,
      supabaseClient,
    });

    expect(
      config.sections.find((section) => section.sectionKey === 'theme_rail')
        ?.title,
    ).toBe('Kies je wereld');
    expect(homepageItems.map((item) => item.themeSnapshot.name)).toEqual([
      'Disney',
      'Marvel',
    ]);
    expect(homepageItems.map((item) => item.themeSnapshot.setCount)).toEqual([
      31, 65,
    ]);
    expect(homepageItems.map((item) => item.imageUrl)).toEqual([
      'https://cdn.example.com/43222.jpg',
      'https://cdn.example.com/76269.jpg',
    ]);
    expect(
      homepageItems.map((item) => item.themeSnapshot.signatureSet),
    ).toEqual(['Disney Castle', 'Avengers toren']);
  });

  test('prefers migrated representative card images for homepage theme portrait cards', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-06-01T00:00:00.000Z',
          image_url:
            'https://cdn.rebrickable.com/media/sets/42172-1/142568.jpg',
          name: 'McLaren P1',
          piece_count: 3893,
          primary_theme_id: 'theme:technic',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2024,
          set_id: '42172',
          slug: 'mclaren-p1-42172',
          source: 'rebrickable',
          source_set_number: '42172-1',
          source_theme_id: null,
          status: 'active',
          updated_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Technic',
          id: 'theme:technic',
          is_public: true,
          public_display_name: 'Technic',
          public_homepage_order: 10,
          public_order: 10,
          public_tile_image_url:
            'https://cdn.rebrickable.com/media/sets/42172-1/stale-theme.jpg',
          slug: 'technic',
          status: 'active',
        },
      ],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-technic',
          image_set_id: '42172',
          image_url: null,
          metadata_json: {},
          reference_id: 'technic',
          reference_type: 'theme',
          section_id: 'section-theme-rail',
          sort_order: 10,
          title_override: 'McLaren P1',
          use_custom_image: false,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-theme-rail',
          layout: 'theme_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'theme_rail',
          sort_order: 20,
          subtitle: null,
          title: 'Kies je wereld',
        },
      ],
      setImageRows: [
        {
          content_type: 'image/webp',
          height: 480,
          image_type: 'card',
          public_url: '/images/sets/42172/card.webp',
          set_id: '42172',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/42172/card.webp',
          width: 640,
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 44,
          representative_image_url:
            'https://cdn.rebrickable.com/media/sets/42172-1/stale-summary.jpg',
          representative_set_id: '42172',
          theme_id: 'theme:technic',
        },
      ],
    });

    const [homepageItem] = await listHomepageThemeDirectoryItems({
      supabaseClient,
    });

    expect(homepageItem?.imageUrl).toBe('/images/sets/42172/card.webp');
    expect(homepageItem?.visual?.imageUrl).toBe('/images/sets/42172/card.webp');
  });

  test('keeps Rebrickable representative images as homepage theme portrait fallback', async () => {
    const rebrickableImageUrl =
      'https://cdn.rebrickable.com/media/sets/42172-1/142568.jpg';
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-06-01T00:00:00.000Z',
          image_url: rebrickableImageUrl,
          name: 'McLaren P1',
          piece_count: 3893,
          primary_theme_id: 'theme:technic',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2024,
          set_id: '42172',
          slug: 'mclaren-p1-42172',
          source: 'rebrickable',
          source_set_number: '42172-1',
          source_theme_id: null,
          status: 'active',
          updated_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Technic',
          id: 'theme:technic',
          is_public: true,
          public_display_name: 'Technic',
          public_homepage_order: 10,
          public_order: 10,
          public_tile_image_url:
            'https://cdn.rebrickable.com/media/sets/42172-1/stale-theme.jpg',
          slug: 'technic',
          status: 'active',
        },
      ],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-technic',
          image_set_id: '42172',
          image_url: null,
          metadata_json: {},
          reference_id: 'technic',
          reference_type: 'theme',
          section_id: 'section-theme-rail',
          sort_order: 10,
          title_override: 'McLaren P1',
          use_custom_image: false,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-theme-rail',
          layout: 'theme_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'theme_rail',
          sort_order: 20,
          subtitle: null,
          title: 'Kies je wereld',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 44,
          representative_image_url:
            'https://cdn.rebrickable.com/media/sets/42172-1/stale-summary.jpg',
          representative_set_id: '42172',
          theme_id: 'theme:technic',
        },
      ],
    });

    const [homepageItem] = await listHomepageThemeDirectoryItems({
      supabaseClient,
    });

    expect(homepageItem?.imageUrl).toBe(rebrickableImageUrl);
    expect(homepageItem?.visual?.imageUrl).toBe(rebrickableImageUrl);
  });

  test('passes migrated Star Wars and Super Mario surface colors from Supabase', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
          is_public: true,
          public_display_name: 'Star Wars',
          public_order: 1,
          public_surface_color: '#5573b5',
          public_surface_text_color: '#ffffff',
          slug: 'star-wars',
          status: 'active',
        },
        {
          display_name: 'Super Mario',
          id: 'theme:super-mario',
          is_public: true,
          public_display_name: 'Super Mario',
          public_order: 2,
          public_surface_color: '#d85a50',
          public_surface_text_color: '#ffffff',
          slug: 'super-mario',
          status: 'active',
        },
      ],
      themeSummaryRows: [
        {
          active_set_count: 24,
          representative_image_url: 'https://cdn.example.com/star-wars.jpg',
          representative_set_id: '75313',
          theme_id: 'theme:star-wars',
        },
        {
          active_set_count: 8,
          representative_image_url: 'https://cdn.example.com/super-mario.jpg',
          representative_set_id: '71411',
          theme_id: 'theme:super-mario',
        },
      ],
    });

    const [starWarsItem, superMarioItem] = await listCatalogThemeDirectoryItems(
      {
        supabaseClient,
      },
    );

    expect(starWarsItem?.visual).toMatchObject({
      backgroundColor: '#5573b5',
      textColor: '#ffffff',
    });
    expect(superMarioItem?.visual).toMatchObject({
      backgroundColor: '#d85a50',
      textColor: '#ffffff',
    });
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
          public_hero_text_color: '#171a22',
          public_image_url: null,
          public_order: 325,
          public_surface_color: '#e0b84f',
          public_surface_text_color: '#171a22',
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
    expect(editionsItem?.visual?.imageUrl).toBeUndefined();
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
          public_description:
            'Bijzondere releases die niet netjes in een grotere themalijn vallen.',
          public_hero_text_color: '#171a22',
          public_image_url: 'https://cdn.example.com/editions-public.jpg',
          public_order: 325,
          public_surface_color: '#e0b84f',
          public_surface_text_color: '#171a22',
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
      introSupport: undefined,
      momentum:
        'Bijzondere releases die niet netjes in een grotere themalijn vallen.',
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
          public_hero_text_color: '#10241f',
          public_image_url: null,
          public_order: 10,
          public_surface_color: '#6bbf59',
          public_surface_text_color: '#10241f',
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-10T12:00:00.000Z'));

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

    vi.useRealTimers();
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
      rotationSeed: 0,
    });
    const secondSeedResult = await listHomepageSetCards({
      getCatalogDiscoverySignalFn,
      limit: 2,
      listCanonicalCatalogSetsFn,
      rotationSeed: 1,
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

  test('searches Supabase catalog sets by LEGO NL display title while keeping catalog title searchable', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        {
          created_at: '2026-04-18T08:00:00.000Z',
          image_url: 'https://cdn.example.com/10307.jpg',
          name: 'Eiffel Tower',
          piece_count: 10001,
          primary_theme_id: 'theme:icons',
          release_date: null,
          release_date_precision: null,
          release_year: 2022,
          set_id: '10307',
          slug: 'eiffel-tower-10307',
          source: 'rebrickable',
          source_set_number: '10307-1',
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
      sourceMetadataRows: [
        {
          catalog_set_id: '10307',
          locale: 'nl-NL',
          match_confidence: 'exact_set_number',
          metadata_json: {
            title: 'Eiffeltoren',
          },
          policy: 'metadata_only_pending_audit',
          source: 'rakuten-lego-eu',
        },
      ],
    });

    await expect(
      listCatalogSearchMatches({
        query: 'Eiffeltoren',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        score: 1,
        setCard: expect.objectContaining({
          catalogName: 'Eiffel Tower',
          id: '10307',
          name: 'Eiffeltoren',
          slug: 'eiffel-tower-10307',
        }),
      }),
    ]);
    await expect(
      listCatalogSearchMatches({
        query: 'Eiffel Tower',
        supabaseClient,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        setCard: expect.objectContaining({
          id: '10307',
          name: 'Eiffeltoren',
          slug: 'eiffel-tower-10307',
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
      'Technic',
    ]);
    expect(spotlightItems.map((item) => item.title)).toEqual([
      'Botanicals',
      'Ideas',
    ]);
  });

  test('renders discovery route CMS collection items with presentation overrides', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionPresentationRows: [
        {
          collection_slug: 'lego-voor-volwassenen',
          is_public: true,
          metadata_json: {},
          public_accent_color: '#08636f',
          public_description: 'Displaysets voor Rivendell en Technic.',
          public_display_name: 'Displaysets voor volwassenen',
          public_hero_text_color: '#ffffff',
          public_homepage_order: 10,
          public_image_url: 'https://example.test/collection.jpg',
          public_logo_url: 'https://example.test/collection-logo.svg',
          public_order: 10,
          public_surface_color: '#08636f',
          public_surface_text_color: '#ffffff',
          public_tile_image_url: 'https://example.test/collection-tile.jpg',
          status: 'active',
          updated_at: '2026-06-06T10:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: 'Rivendell op een plank',
          cta_label: 'Bekijk collectie',
          cta_url: null,
          enabled: true,
          id: 'item-adult',
          image_set_id: null,
          image_url: 'https://example.test/item-override.jpg',
          metadata_json: {
            description: 'Kies display boven speelfuncties.',
            surfaceColor: '#ff0000',
            surfaceTextColor: '#000000',
          },
          reference_id: 'lego-voor-volwassenen',
          reference_type: 'collection',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: null,
          use_custom_image: false,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const [tile] = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tile).toMatchObject({
      alt: 'Rivendell op een plank',
      ctaLabel: 'Bekijk collectie',
      href: '/lego-voor-volwassenen',
      id: 'item-adult',
      imageUrl: 'https://example.test/collection-tile.jpg',
      referenceId: 'lego-voor-volwassenen',
      referenceType: 'collection',
      title: 'Displaysets voor volwassenen',
      visual: {
        backgroundColor: '#08636f',
        imageUrl: 'https://example.test/collection-tile.jpg',
        tileImageUrl: 'https://example.test/collection-tile.jpg',
        textColor: '#ffffff',
      },
    });
  });

  test('uses explicit homepage image overrides only when enabled', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionPresentationRows: [
        {
          collection_slug: 'nieuwe-lego-sets',
          is_public: true,
          metadata_json: {},
          public_accent_color: '#3aaee8',
          public_description: 'Nieuwe dozen.',
          public_display_name: 'Nieuwe sets',
          public_hero_text_color: '#08243a',
          public_homepage_order: 10,
          public_image_url: 'https://example.test/new-sets-hero.jpg',
          public_logo_url: 'https://example.test/new-sets-logo.svg',
          public_order: 10,
          public_surface_color: '#3aaee8',
          public_surface_text_color: '#08243a',
          public_tile_image_url: 'https://example.test/new-sets-tile.jpg',
          status: 'active',
          updated_at: '2026-06-06T10:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-default',
          image_set_id: null,
          image_url: 'https://example.test/disabled-override.jpg',
          metadata_json: {},
          reference_id: 'nieuwe-lego-sets',
          reference_type: 'collection',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: null,
          use_custom_image: false,
        },
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-custom',
          image_set_id: null,
          image_url: 'https://example.test/enabled-override.jpg',
          metadata_json: {},
          reference_id: 'nieuwe-lego-sets',
          reference_type: 'collection',
          section_id: 'section-discovery',
          sort_order: 20,
          title_override: 'Nieuwe sets override',
          use_custom_image: true,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const tiles = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tiles.map((tile) => tile.imageUrl)).toEqual([
      'https://example.test/new-sets-tile.jpg',
      'https://example.test/enabled-override.jpg',
    ]);
    expect(tiles[0]?.imageUrl).not.toBe(
      'https://example.test/new-sets-logo.svg',
    );
  });

  test('renders custom discovery deals tile colors from CMS metadata', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: '/deals',
          enabled: true,
          id: 'item-deals',
          image_set_id: null,
          image_url: 'https://example.test/deals.jpg',
          metadata_json: {
            surfaceColor: '#00a99d',
            surfaceTextColor: '#062927',
          },
          reference_id: 'deals',
          reference_type: 'custom',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: 'Interessante deals',
          use_custom_image: true,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const [tile] = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tile).toMatchObject({
      href: '/deals',
      imageUrl: 'https://example.test/deals.jpg',
      referenceId: 'deals',
      referenceType: 'custom',
      title: 'Interessante deals',
      visual: {
        backgroundColor: '#00a99d',
        imageUrl: 'https://example.test/deals.jpg',
        textColor: '#062927',
      },
    });
  });

  test('renders custom popular themes tile colors from CMS metadata', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: '/themes',
          enabled: true,
          id: 'item-themes',
          image_set_id: null,
          image_url: 'https://example.test/themes.jpg',
          metadata_json: {
            surfaceColor: '#8758d8',
            surfaceTextColor: '#ffffff',
          },
          reference_id: 'themes',
          reference_type: 'custom',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: "Populaire thema's",
          use_custom_image: true,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const [tile] = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tile).toMatchObject({
      href: '/themes',
      imageUrl: 'https://example.test/themes.jpg',
      referenceId: 'themes',
      referenceType: 'custom',
      title: "Populaire thema's",
      visual: {
        backgroundColor: '#8758d8',
        imageUrl: 'https://example.test/themes.jpg',
        textColor: '#ffffff',
      },
    });
  });

  test('falls back safely when custom discovery tile colors are missing', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: '/deals',
          enabled: true,
          id: 'item-deals',
          image_set_id: null,
          image_url: 'https://example.test/deals.jpg',
          metadata_json: {},
          reference_id: 'deals',
          reference_type: 'custom',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: 'Interessante deals',
          use_custom_image: true,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const [tile] = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tile?.visual?.backgroundColor).toBeUndefined();
    expect(tile?.visual?.textColor).toBeUndefined();
    expect(tile?.imageUrl).toBe('https://example.test/deals.jpg');
  });

  test('renders theme spotlight CMS collection and theme items', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [
        {
          created_at: '2026-01-01T00:00:00.000Z',
          image_url: 'https://example.test/hogwarts.jpg',
          name: 'Hogwarts Castle',
          piece_count: 2660,
          primary_theme_id: 'theme-harry-potter',
          release_date: null,
          release_date_precision: 'year',
          release_year: 2024,
          set_id: '76419',
          slug: 'hogwarts-castle-and-grounds-76419',
          source: 'rebrickable',
          source_set_number: '76419-1',
          source_theme_id: 'source-harry-potter',
          status: 'active',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      collectionPresentationRows: [
        {
          collection_slug: 'lego-sets-onder-100-euro',
          is_public: true,
          metadata_json: {},
          public_accent_color: '#00a99d',
          public_description: 'Herkenbare sets tot 100 euro.',
          public_display_name: 'Tot 100 euro',
          public_hero_text_color: '#062927',
          public_homepage_order: 20,
          public_image_url: 'https://example.test/under-100.jpg',
          public_logo_url: null,
          public_order: 20,
          public_surface_color: '#00a99d',
          public_surface_text_color: '#062927',
          public_tile_image_url: 'https://example.test/under-100-tile.jpg',
          status: 'active',
          updated_at: '2026-06-06T10:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: [
        {
          display_name: 'Harry Potter',
          id: 'theme-harry-potter',
          is_public: true,
          public_description: 'Hogwarts, Goudgrijp en minifiguren.',
          public_display_name: 'Harry Potter',
          public_tile_image_url: 'https://example.test/harry-potter-tile.jpg',
          public_image_url: null,
          slug: 'harry-potter',
          status: 'active',
        },
      ],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-theme',
          image_set_id: '76419',
          image_url: null,
          metadata_json: { description: 'Begin bij Hogwarts.' },
          reference_id: 'harry-potter',
          reference_type: 'theme',
          section_id: 'section-spotlight',
          sort_order: 10,
          title_override: 'Hogwarts en Goudgrijp',
          use_custom_image: false,
        },
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-collection',
          image_set_id: null,
          image_url: null,
          metadata_json: {},
          reference_id: 'lego-sets-onder-100-euro',
          reference_type: 'collection',
          section_id: 'section-spotlight',
          sort_order: 20,
          title_override: null,
          use_custom_image: false,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-spotlight',
          layout: 'theme_spotlight',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'theme_spotlight',
          sort_order: 60,
          subtitle: null,
          title: 'Meer werelden',
        },
      ],
      setImageRows: [
        {
          content_type: 'image/webp',
          height: 480,
          image_type: 'card',
          public_url: '/images/sets/76419/card.webp',
          set_id: '76419',
          sort_order: 0,
          status: 'active',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/76419/card.webp',
          width: 640,
        },
      ],
    });

    const items = await listHomepageThemeSpotlightItems({ supabaseClient });

    expect(items).toEqual([
      expect.objectContaining({
        description: 'Begin bij Hogwarts.',
        href: '/themes/harry-potter',
        id: 'item-theme',
        imageUrl: '/images/sets/76419/card.webp',
        referenceType: 'theme',
        title: 'Hogwarts en Goudgrijp',
      }),
      expect.objectContaining({
        description: 'Herkenbare sets tot 100 euro.',
        href: '/lego-sets-onder-100-euro',
        id: 'item-collection',
        imageUrl: 'https://example.test/under-100-tile.jpg',
        referenceType: 'collection',
        title: 'Tot 100 euro',
      }),
    ]);
  });

  test('renders all configured theme spotlight CMS items beyond the fallback limit', async () => {
    const spotlightThemes = [
      ['botanicals', 'theme-botanicals', 'Botanicals'],
      ['art', 'theme-art', 'Art'],
      ['creator-3in1', 'theme-creator-3in1', 'Creator 3-in-1'],
      ['architecture', 'theme-architecture', 'Architecture'],
      ['icons', 'theme-icons', 'Icons'],
    ] as const;
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionPresentationRows: [],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      primaryThemeRows: spotlightThemes.map(
        ([slug, id, displayName], index) => ({
          display_name: displayName,
          id,
          is_public: true,
          public_description: `${displayName} om in je kast te laten spreken.`,
          public_display_name: displayName,
          public_homepage_order: (index + 1) * 10,
          public_image_url: null,
          public_order: (index + 1) * 10,
          public_tile_image_url: `https://example.test/${slug}.jpg`,
          slug,
          status: 'active',
        }),
      ),
      publicPageSectionItemRows: spotlightThemes.map(([slug], index) => ({
        alt_override: null,
        cta_label: null,
        cta_url: null,
        enabled: true,
        id: `item-${slug}`,
        image_set_id: null,
        image_url: null,
        metadata_json: {},
        reference_id: slug,
        reference_type: 'theme',
        section_id: 'section-spotlight',
        sort_order: (index + 1) * 10,
        title_override: null,
        use_custom_image: false,
      })),
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-spotlight',
          layout: 'theme_spotlight',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'theme_spotlight',
          sort_order: 60,
          subtitle: null,
          title: 'Meer werelden',
        },
      ],
      themeSummaryRows: spotlightThemes.map(([, id], index) => ({
        active_set_count: index + 1,
        representative_image_url: null,
        representative_set_id: null,
        theme_id: id,
        updated_at: '2026-06-06T10:00:00.000Z',
      })),
    });

    const items = await listHomepageThemeSpotlightItems({ supabaseClient });

    expect(items.map((item) => item.referenceId)).toEqual([
      'botanicals',
      'art',
      'creator-3in1',
      'architecture',
      'icons',
    ]);
    expect(items).toHaveLength(5);
    expect(items.at(-1)).toEqual(
      expect.objectContaining({
        href: '/themes/icons',
        id: 'item-icons',
        imageUrl: 'https://example.test/icons.jpg',
        referenceType: 'theme',
        title: 'Icons',
      }),
    );
  });

  test('applies collection presentation to collection page config', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionPresentationRows: [
        {
          collection_slug: 'nieuwe-lego-sets',
          is_public: true,
          metadata_json: {},
          public_accent_color: '#3aaee8',
          public_description: 'Nieuw binnen: speeders, kastelen en bloemen.',
          public_display_name: 'Net binnen bij Brickhunt',
          public_hero_text_color: '#08243a',
          public_homepage_order: 10,
          public_image_url: 'https://example.test/new-sets.jpg',
          public_logo_url: null,
          public_order: 10,
          public_surface_color: '#3aaee8',
          public_surface_text_color: '#08243a',
          public_tile_image_url: 'https://example.test/new-sets-tile.jpg',
          status: 'active',
          updated_at: '2026-06-06T10:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
    });
    const config = await getCatalogCollectionLandingPageConfigWithPresentation({
      config: {
        browseDescription: 'Fallback browse',
        browseEyebrow: 'Fallback',
        browseTitle: 'Fallback title',
        canonicalPath: '/nieuwe-lego-sets',
        description: 'Fallback description',
        filters: {},
        h1: 'Nieuwe LEGO sets',
        intro: 'Fallback intro',
        links: {},
        metaDescription: 'Fallback meta',
        metaTitle: 'Fallback meta title',
        signalLabel: 'sets',
        slug: 'nieuwe-lego-sets',
        sort: {
          default: 'recommended',
          options: ['recommended'],
        },
      },
      supabaseClient,
    });

    expect(config).toMatchObject({
      browseDescription: 'Nieuw binnen: speeders, kastelen en bloemen.',
      browseTitle: 'Net binnen bij Brickhunt',
      description: 'Nieuw binnen: speeders, kastelen en bloemen.',
      h1: 'Net binnen bij Brickhunt',
      intro: 'Nieuw binnen: speeders, kastelen en bloemen.',
      visual: {
        backgroundColor: '#3aaee8',
        imageUrl: 'https://example.test/new-sets.jpg',
        textColor: '#08243a',
      },
    });
  });

  test('falls back from malformed collection tile image to hero image', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      collectionPresentationRows: [
        {
          collection_slug: 'retiring-lego-sets',
          is_public: true,
          metadata_json: {},
          public_accent_color: '#f28c28',
          public_description: 'Niet laten liggen.',
          public_display_name: 'Binnenkort weg',
          public_hero_text_color: '#281400',
          public_homepage_order: 10,
          public_image_url: 'https://example.test/retiring-hero.jpg',
          public_logo_url: null,
          public_order: 10,
          public_surface_color: '#f28c28',
          public_surface_text_color: '#281400',
          public_tile_image_url: 'not-a-url',
          status: 'active',
          updated_at: '2026-06-06T10:00:00.000Z',
        },
      ],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      publicPageSectionItemRows: [
        {
          alt_override: null,
          cta_label: null,
          cta_url: null,
          enabled: true,
          id: 'item-retiring',
          image_set_id: null,
          image_url: null,
          metadata_json: {},
          reference_id: 'retiring-lego-sets',
          reference_type: 'collection',
          section_id: 'section-discovery',
          sort_order: 10,
          title_override: null,
          use_custom_image: false,
        },
      ],
      publicPageSectionRows: [
        {
          enabled: true,
          id: 'section-discovery',
          layout: 'visual_tile_rail',
          metadata_json: {},
          page_key: 'homepage',
          section_key: 'discovery_routes',
          sort_order: 10,
          subtitle: null,
          title: 'Ontdek LEGO op jouw manier',
        },
      ],
    });

    const [tile] = await listHomepageDiscoveryTiles({ supabaseClient });

    expect(tile?.imageUrl).toBe('https://example.test/retiring-hero.jpg');
  });

  test('does not synthesize hardcoded visuals for fallback directory themes', async () => {
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
    expect(cityItem?.visual?.backgroundColor).toBeUndefined();
    expect(cityItem?.visual?.textColor).toBeUndefined();
    expect(zeldaItem?.themeSnapshot.name).toBe('LEGO® The Legend of Zelda™');
    expect(zeldaItem?.visual?.backgroundColor).toBeUndefined();
    expect(zeldaItem?.visual?.textColor).toBeUndefined();
  });

  test('uses representative set images for fallback theme directory tiles', async () => {
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
    ).toBe('https://cdn.example.com/10316.jpg');
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
        referenceDeltaMinor: -5000,
      });

    const firstRefresh = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn,
      limit: 3,
      rotationSeed: 0,
      setCards,
    }).map((catalogSetCard) => catalogSetCard.id);
    const secondRefresh = rankCatalogBestDealSetCards({
      getCatalogDiscoverySignalFn,
      limit: 3,
      rotationSeed: 1,
      setCards,
    }).map((catalogSetCard) => catalogSetCard.id);

    expect(firstRefresh).not.toEqual(secondRefresh);
  });

  test('does not treat a recent price drop as a primary best-deal signal without reliable reference discount', () => {
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

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([]);
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

  test('limits repeated themes in public commerce rails before relaxing diversity', () => {
    const setCards = [
      {
        id: '75355',
        imageUrl: undefined,
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
      {
        id: '75367',
        imageUrl: undefined,
        name: 'Venator-Class Republic Attack Cruiser',
        pieces: 5374,
        releaseYear: 2023,
        slug: 'venator-class-republic-attack-cruiser-75367',
        theme: 'Star Wars',
      },
      {
        id: '75397',
        imageUrl: undefined,
        name: 'Jabba’s Sail Barge',
        pieces: 3942,
        releaseYear: 2024,
        slug: 'jabbas-sail-barge-75397',
        theme: 'Star Wars',
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
    ];
    const currentOfferSummaryBySetId = new Map(
      setCards.map((setCard) => [
        setCard.id,
        {
          bestOffer: createCatalogOffer({
            availability: 'in_stock',
            merchantName: 'Goodbricks',
            priceCents: 9999,
            setId: setCard.id,
            url: `https://partner.example/${setCard.id}`,
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'Goodbricks',
              priceCents: 9999,
              setId: setCard.id,
              url: `https://partner.example/${setCard.id}`,
            }),
            createCatalogOffer({
              merchantName: 'Brickfever',
              priceCents: 10999,
              setId: setCard.id,
              url: `https://brickfever.example/${setCard.id}`,
            }),
          ],
          setId: setCard.id,
        },
      ]),
    );
    const catalogDiscoverySignalBySetId = new Map(
      setCards.map((setCard) => [
        setCard.id,
        createCatalogDiscoverySignal({
          bestPriceMinor: 9999,
          merchantCount: 2,
          priceSpreadMinor: 1000,
          referenceDeltaMinor: setCard.theme === 'Star Wars' ? -4000 : -1500,
        }),
      ]),
    );

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      limit: 3,
      maxPerTheme: 2,
      rotationSeed: 4,
      setCards,
    });

    expect(result).toHaveLength(3);
    expect(
      result.filter((setCard) => setCard.theme === 'Star Wars'),
    ).toHaveLength(2);
    expect(result.map((setCard) => setCard.id)).toContain('10316');
  });

  test('excludes recently featured sets from public commerce rail selection', () => {
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
            merchantName: 'Goodbricks',
            priceCents: 9999,
            setId: setCard.id,
            url: `https://partner.example/${setCard.id}`,
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'Goodbricks',
              priceCents: 9999,
              setId: setCard.id,
              url: `https://partner.example/${setCard.id}`,
            }),
          ],
          setId: setCard.id,
        },
      ]),
    );

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map(),
      currentOfferSummaryBySetId,
      limit: 2,
      recentlyFeaturedSetIds: ['10316'],
      setCards,
    });

    expect(result.map((setCard) => setCard.id)).toEqual(['76269']);
  });

  test('boosts offers that are clearly cheaper than official LEGO pricing', () => {
    const setCard = {
      id: '10316',
      imageUrl: undefined,
      name: 'Rivendell',
      pieces: 6167,
      releaseYear: 2023,
      slug: 'rivendell-10316',
      theme: 'Icons',
    };
    const baseSummary = {
      bestOffer: createCatalogOffer({
        merchantName: 'Goodbricks',
        priceCents: 39999,
        setId: '10316',
      }),
      offers: [
        createCatalogOffer({
          merchantName: 'Goodbricks',
          priceCents: 39999,
          setId: '10316',
        }),
      ],
      setId: '10316',
    };
    const withLegoSummary = {
      ...baseSummary,
      offers: [
        ...baseSummary.offers,
        {
          ...createCatalogOffer({
            merchant: 'lego',
            merchantName: 'LEGO EU',
            priceCents: 49999,
            setId: '10316',
          }),
          merchantSlug: 'rakuten-lego-eu',
        },
      ],
    };

    const withoutLego = scoreCatalogPublicDealMerchandisingCandidate({
      currentOfferSummary: baseSummary,
      rotationSeed: 0,
      setCard,
    });
    const withLego = scoreCatalogPublicDealMerchandisingCandidate({
      currentOfferSummary: withLegoSummary,
      rotationSeed: 0,
      setCard,
    });

    expect(withLego.legoComparisonScore).toBeGreaterThan(0);
    expect(withLego.total).toBeGreaterThan(withoutLego.total);
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
    expect(result.map((catalogSetCard) => catalogSetCard.id).sort()).toEqual([
      '10316',
      '43247',
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
            commercialUnitType: 'full_set',
            merchantName: 'Goodbricks',
            priceCents: 9999,
            setId: '43247',
            url: 'https://id.goodbricks.nl/t/t?a=1849540612&url=43247',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              commercialUnitType: 'full_set',
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
            commercialUnitType: 'full_set',
            merchantName: 'MediaMarkt',
            priceCents: 4299,
            setId: '10311',
            url: 'https://pdt.tradedoubler.com/click?a(1)product(23056-1881383)',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              commercialUnitType: 'full_set',
              merchantName: 'MediaMarkt',
              priceCents: 4299,
              setId: '10311',
              url: 'https://pdt.tradedoubler.com/click?a(1)product(23056-1881383)',
            }),
            createCatalogOffer({
              availability: 'in_stock',
              commercialUnitType: 'full_set',
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
            commercialUnitType: 'full_set',
            merchantName: 'Coppenswarenhuis',
            priceCents: 8499,
            setId: '75446',
            url: 'https://tc.tradetracker.net/?u=75446',
          }),
          offers: [
            createCatalogOffer({
              availability: 'in_stock',
              commercialUnitType: 'full_set',
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

    expect(bestDeals.map((catalogSetCard) => catalogSetCard.id)).toEqual([]);
    expect(
      goodPriced.map((catalogSetCard) => catalogSetCard.id).sort(),
    ).toEqual(['10311', '43247', '75446']);
  });

  test('excludes 71050-like unknown unit and unknown verdict cards from primary deal quality rails', () => {
    const setCards = [
      {
        id: '71050',
        imageUrl: undefined,
        name: 'Minifigures Random Box',
        pieces: 1,
        releaseYear: 2026,
        slug: 'minifigures-random-box-71050',
        theme: 'Minifigures',
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
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '71050',
        {
          bestOffer: createCatalogOffer({
            commercialUnitType: 'unknown',
            merchantName: 'Coppenswarenhuis',
            priceCents: 359,
            setId: '71050',
          }),
          offers: [
            createCatalogOffer({
              commercialUnitType: 'unknown',
              merchantName: 'Coppenswarenhuis',
              priceCents: 359,
              setId: '71050',
            }),
            createCatalogOffer({
              commercialUnitType: 'unknown',
              merchantName: 'MisterBricks',
              priceCents: 11900,
              setId: '71050',
            }),
          ],
          setId: '71050',
        },
      ],
      [
        '10316',
        {
          bestOffer: createCatalogOffer({
            commercialUnitType: 'full_set',
            merchantName: 'Goodbricks',
            priceCents: 39999,
            setId: '10316',
          }),
          offers: [
            createCatalogOffer({
              commercialUnitType: 'full_set',
              merchantName: 'Goodbricks',
              priceCents: 39999,
              setId: '10316',
            }),
            createCatalogOffer({
              commercialUnitType: 'full_set',
              merchantName: 'MediaMarkt',
              priceCents: 42999,
              setId: '10316',
            }),
          ],
          setId: '10316',
        },
      ],
    ]);
    const catalogDiscoverySignalBySetId = new Map([
      [
        '71050',
        createCatalogDiscoverySignal({
          bestPriceMinor: 359,
          merchantCount: 2,
          nextBestPriceMinor: 11900,
          priceSpreadMinor: 11541,
          referenceDeltaMinor: undefined,
        }),
      ],
      [
        '10316',
        createCatalogDiscoverySignal({
          bestPriceMinor: 39999,
          merchantCount: 2,
          nextBestPriceMinor: 42999,
          priceSpreadMinor: 3000,
          referenceDeltaMinor: -6000,
        }),
      ],
    ]);

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      requirePrimaryDealQuality: true,
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
    ]);
    expect(
      getCatalogHomepageDealQualityDiagnostics({
        catalogDiscoverySignalBySetId,
        currentOfferSummaryBySetId,
        selectedSetCards: result,
        setCards,
      }),
    ).toEqual({
      excluded_missing_reference_discount_count: 1,
      excluded_unit_mismatch_count: 0,
      excluded_untrusted_merchant_count: 1,
      excluded_unknown_unit_count: 1,
      excluded_unknown_verdict_count: 1,
      soft_deal_accepted: 0,
      soft_deal_candidates: 1,
      strong_deal_accepted: 1,
      strong_deal_candidates: 1,
    });
    expect(currentOfferSummaryBySetId.get('71050')?.offers).toHaveLength(2);
  });

  test('does not accept Shire-like weak LEGO savings as primary deal quality', () => {
    const setCards = [
      {
        id: '10354',
        imageUrl: undefined,
        name: 'The Shire',
        pieces: 2017,
        releaseYear: 2025,
        slug: 'the-shire-10354',
        theme: 'Icons',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '10354',
        {
          bestOffer: createCatalogOffer({
            merchantName: 'Top1Toys',
            priceCents: 25_999,
            setId: '10354',
            url: 'https://top1toys.example/10354',
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'Top1Toys',
              priceCents: 25_999,
              setId: '10354',
              url: 'https://top1toys.example/10354',
            }),
            {
              ...createCatalogOffer({
                merchant: 'lego',
                merchantName: 'LEGO EU',
                priceCents: 26_999,
                setId: '10354',
                url: 'https://lego.example/10354',
              }),
              merchantSlug: 'rakuten-lego-eu',
            },
          ],
          setId: '10354',
        },
      ],
    ]);

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map([
        [
          '10354',
          createCatalogDiscoverySignal({
            bestPriceMinor: 25_999,
            merchantCount: 2,
            nextBestPriceMinor: 26_999,
            priceSpreadMinor: 1_000,
            referenceDeltaMinor: -1_000,
          }),
        ],
      ]),
      currentOfferSummaryBySetId,
      requirePrimaryDealQuality: true,
      setCards,
    });

    expect(result).toHaveLength(0);
  });

  test('accepts Trevi-like LEGO savings as primary deal quality', () => {
    const setCards = [
      {
        id: '21062',
        imageUrl: undefined,
        name: 'Trevi Fountain',
        pieces: 1880,
        releaseYear: 2025,
        slug: 'trevi-fountain-21062',
        theme: 'Architecture',
      },
    ];
    const currentOfferSummaryBySetId = new Map([
      [
        '21062',
        {
          bestOffer: createCatalogOffer({
            merchantName: 'MediaMarkt',
            priceCents: 10_900,
            setId: '21062',
            url: 'https://mediamarkt.example/21062',
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'MediaMarkt',
              priceCents: 10_900,
              setId: '21062',
              url: 'https://mediamarkt.example/21062',
            }),
            {
              ...createCatalogOffer({
                merchant: 'lego',
                merchantName: 'LEGO EU',
                priceCents: 15_999,
                setId: '21062',
                url: 'https://lego.example/21062',
              }),
              merchantSlug: 'rakuten-lego-eu',
            },
          ],
          setId: '21062',
        },
      ],
    ]);

    const result = rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId: new Map([
        [
          '21062',
          createCatalogDiscoverySignal({
            bestPriceMinor: 10_900,
            merchantCount: 2,
            nextBestPriceMinor: 15_999,
            priceSpreadMinor: 5_099,
            referenceDeltaMinor: undefined,
          }),
        ],
      ]),
      currentOfferSummaryBySetId,
      requirePrimaryDealQuality: true,
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '21062',
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

  test('uses trusted current offers for soft homepage price opportunities', () => {
    const setCards = [
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
        id: '71050',
        imageUrl: undefined,
        name: 'Spider-Man: Across the Spider-Verse',
        pieces: 9,
        releaseYear: 2026,
        slug: 'spider-man-across-the-spider-verse-71050',
        theme: 'Minifigures',
      },
    ];
    const now = new Date().toISOString();
    const currentOfferSummaryBySetId = new Map([
      [
        '10333',
        {
          bestOffer: createCatalogOffer({
            merchantName: 'Goodbricks',
            priceCents: 39999,
            setId: '10333',
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'Goodbricks',
              priceCents: 39999,
              setId: '10333',
            }),
          ],
          setId: '10333',
        },
      ],
      [
        '76269',
        {
          bestOffer: createCatalogOffer({
            merchantName: 'Coppenswarenhuis',
            priceCents: 26999,
            setId: '76269',
          }),
          offers: [
            createCatalogOffer({
              merchantName: 'Coppenswarenhuis',
              priceCents: 26999,
              setId: '76269',
            }),
          ],
          setId: '76269',
        },
      ],
      [
        '71050',
        {
          bestOffer: createCatalogOffer({
            commercialUnitType: 'blind_bag',
            merchantName: 'Goodbricks',
            priceCents: 359,
            setId: '71050',
          }),
          offers: [
            createCatalogOffer({
              commercialUnitType: 'blind_bag',
              merchantName: 'Goodbricks',
              priceCents: 359,
              setId: '71050',
            }),
            createCatalogOffer({
              commercialUnitType: 'display_box',
              merchantName: 'Misterbricks',
              priceCents: 5995,
              setId: '71050',
            }),
          ],
          setId: '71050',
        },
      ],
    ]);

    const result = rankCatalogNowInterestingSetCards({
      currentOfferSummaryBySetId,
      getCatalogDiscoverySignalFn: (setId) => {
        if (setId === '10333') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 39999,
            merchantCount: 1,
            priceSpreadMinor: 0,
            recentReferencePriceChangeMinor: -900,
            recentReferencePriceChangedAt: now,
            referenceDeltaMinor: undefined,
          });
        }

        if (setId === '76269') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 26999,
            merchantCount: 1,
            priceSpreadMinor: 0,
            recentReferencePriceChangeMinor: -1200,
            recentReferencePriceChangedAt: now,
            referenceDeltaMinor: undefined,
          });
        }

        if (setId === '71050') {
          return createCatalogDiscoverySignal({
            bestPriceMinor: 359,
            merchantCount: 2,
            nextBestPriceMinor: 5995,
            priceSpreadMinor: 5636,
            recentReferencePriceChangeMinor: -1200,
            recentReferencePriceChangedAt: now,
            referenceDeltaMinor: undefined,
          });
        }

        return undefined;
      },
      setCards,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10333',
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

    expect(result.map((catalogSetCard) => catalogSetCard.id).sort()).toEqual([
      '42143',
      '76269',
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

  test('loads similar candidates from the current Supabase theme instead of a global catalog slice', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      catalogRows: [
        ...Array.from({ length: 240 }, (_, index) => ({
          created_at: `2026-05-${String(20 - (index % 20)).padStart(2, '0')}T08:00:00.000Z`,
          image_url: `https://cdn.example.com/icons-${index}.jpg`,
          name: `Icons filler ${index}`,
          piece_count: 500 + index,
          primary_theme_id: 'theme:icons',
          release_year: 2026,
          set_id: `icons-${index}`,
          slug: `icons-filler-${index}`,
          source: 'rebrickable',
          source_set_number: `icons-${index}-1`,
          source_theme_id: 'rebrickable:icons',
          status: 'active',
          updated_at: '2026-05-20T08:00:00.000Z',
        })),
        {
          created_at: '2026-01-01T08:00:00.000Z',
          image_url: 'https://cdn.example.com/77244.jpg',
          name: 'Mercedes-AMG F1 W15 Race Car',
          piece_count: 267,
          primary_theme_id: 'theme:speed-champions',
          release_year: 2025,
          set_id: '77244',
          slug: 'mercedes-amg-f1-w15-race-car-77244',
          source: 'rebrickable',
          source_set_number: '77244-1',
          source_theme_id: 'rebrickable:speed-champions',
          status: 'active',
          updated_at: '2026-01-01T08:00:00.000Z',
        },
        {
          created_at: '2026-01-01T08:00:00.000Z',
          image_url: 'https://cdn.example.com/76924.jpg',
          name: 'Mercedes-AMG G 63 and Mercedes-AMG SL 63',
          piece_count: 806,
          primary_theme_id: 'theme:speed-champions',
          release_year: 2024,
          set_id: '76924',
          slug: 'mercedes-amg-g-63-mercedes-amg-sl-63-76924',
          source: 'rebrickable',
          source_set_number: '76924-1',
          source_theme_id: 'rebrickable:speed-champions',
          status: 'active',
          updated_at: '2026-01-01T08:00:00.000Z',
        },
        {
          created_at: '2026-01-01T08:00:00.000Z',
          image_url: 'https://cdn.example.com/76919.jpg',
          name: 'McLaren Formula 1 Race Car',
          piece_count: 245,
          primary_theme_id: 'theme:speed-champions',
          release_year: 2023,
          set_id: '76919',
          slug: 'mclaren-formula-1-race-car-76919',
          source: 'rebrickable',
          source_set_number: '76919-1',
          source_theme_id: 'rebrickable:speed-champions',
          status: 'active',
          updated_at: '2026-01-01T08:00:00.000Z',
        },
      ],
      primaryThemeRows: [
        {
          display_name: 'Icons',
          id: 'theme:icons',
          slug: 'icons',
        },
        {
          display_name: 'Speed Champions',
          id: 'theme:speed-champions',
          slug: 'speed-champions',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:icons',
          source_theme_name: 'Icons',
        },
        {
          id: 'rebrickable:speed-champions',
          source_theme_name: 'Speed Champions',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:icons',
          source_theme_id: 'rebrickable:icons',
        },
        {
          primary_theme_id: 'theme:speed-champions',
          source_theme_id: 'rebrickable:speed-champions',
        },
      ],
    });

    const result = await listCatalogSimilarSetCards({
      currentSetCard: {
        id: '77244',
        name: 'Mercedes-AMG F1 W15 Race Car',
        pieces: 267,
        releaseYear: 2025,
        theme: 'Speed Champions',
      },
      limit: 6,
      supabaseClient,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '76919',
      '76924',
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
      'Lord of the Rings™',
      'Marvel',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
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
          fetched_at: '2026-04-18T12:15:00.000Z',
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
        checkedAt: '2026-04-18T11:44:00.000Z',
      },
      {
        merchantName: 'Amazon',
        priceCents: 17240,
        availability: 'out_of_stock',
        checkedAt: '2026-04-18T11:40:00.000Z',
      },
    ]);
  });

  test('uses the public LEGO registered display name for Rakuten LEGO offers', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetched_at: '2026-05-25T10:00:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-05-25T09:55:00.000Z',
          offer_seed_id: 'seed-rakuten-lego',
          price_minor: 19999,
          updated_at: '2026-05-25T10:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-rakuten-lego',
          is_active: true,
          name: 'LEGO EU',
          slug: 'rakuten-lego-eu',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-rakuten-lego',
          is_active: true,
          merchant_id: 'merchant-rakuten-lego',
          product_url:
            'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Fback-to-the-future-time-machine-10300',
          set_id: '10300',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogSetLiveOffersBySetId({
      setId: '10300',
      supabaseClient,
    });

    expect(result).toMatchObject([
      {
        merchant: 'lego',
        merchantName: 'LEGO®',
        merchantSlug: 'rakuten-lego-eu',
      },
    ]);
  });

  test('preserves merchant-specific observed timestamps for live offer cards', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetched_at: '2026-05-14T09:21:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-05-14T07:05:00.000Z',
          offer_seed_id: 'seed-coolblue',
          price_minor: 6499,
          updated_at: '2026-05-14T09:21:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetched_at: '2026-05-14T09:21:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-05-14T08:45:00.000Z',
          offer_seed_id: 'seed-alternate',
          price_minor: 6999,
          updated_at: '2026-05-14T09:21:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-coolblue',
          is_active: true,
          name: 'Coolblue',
          slug: 'coolblue',
        },
        {
          id: 'merchant-alternate',
          is_active: true,
          name: 'Alternate',
          slug: 'alternate',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-coolblue',
          is_active: true,
          merchant_id: 'merchant-coolblue',
          product_url: 'https://coolblue.example/43300',
          set_id: '43300',
          validation_status: 'valid',
        },
        {
          id: 'seed-alternate',
          is_active: true,
          merchant_id: 'merchant-alternate',
          product_url: 'https://alternate.example/43300',
          set_id: '43300',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogSetLiveOffersBySetId({
      setId: '43300',
      supabaseClient,
    });

    expect(
      result.map((offer) => [offer.merchantSlug, offer.checkedAt]),
    ).toEqual([
      ['coolblue', '2026-05-14T07:05:00.000Z'],
      ['alternate', '2026-05-14T08:45:00.000Z'],
    ]);
  });

  test('falls back to fetched timestamp when an offer has no observed timestamp', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetched_at: '2026-05-14T09:21:00.000Z',
          fetch_status: 'success',
          observed_at: null,
          offer_seed_id: 'seed-coolblue',
          price_minor: 6499,
          updated_at: '2026-05-14T09:19:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-coolblue',
          is_active: true,
          name: 'Coolblue',
          slug: 'coolblue',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-coolblue',
          is_active: true,
          merchant_id: 'merchant-coolblue',
          product_url: 'https://coolblue.example/43300',
          set_id: '43300',
          validation_status: 'valid',
        },
      ],
    });

    await expect(
      listCatalogSetLiveOffersBySetId({
        setId: '43300',
        supabaseClient,
      }),
    ).resolves.toMatchObject([
      {
        checkedAt: '2026-05-14T09:21:00.000Z',
        merchantSlug: 'coolblue',
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

  test('selects the same lowest eligible in-stock offer for cards and detail comparison', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-18T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Coppenswarenhuis',
        merchantSlug: 'coppenswarenhuis',
        priceCents: 22499,
        setId: '76419',
        url: 'https://coppens.example/hogwarts-main-tower',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-18T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'MisterBricks',
        merchantSlug: 'misterbricks',
        priceCents: 20900,
        setId: '76419',
        url: 'https://misterbricks.example/hogwarts-main-tower',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-18T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 19995,
        setId: '76419',
        url: 'https://goodbricks.example/hogwarts-main-tower',
      },
    ];

    const detailOffers = resolveCatalogSetDetailOffers({
      generatedOffers: [],
      liveOffers,
    });
    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '76419',
    });

    expect(detailOffers[0]).toMatchObject({
      merchantSlug: 'goodbricks',
      priceCents: 19995,
    });
    expect(summary.bestOffer).toMatchObject({
      merchantSlug: 'goodbricks',
      priceCents: 19995,
    });
  });

  test('dedupes public LEGO offers and prefers the Rakuten feed source', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-24T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'LEGO®',
        merchantSlug: 'lego-eu',
        priceCents: 5599,
        setId: '10280',
        url: 'https://lego.example/legacy/10280',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-25T10:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'lego' as const,
        merchantName: 'LEGO EU',
        merchantSlug: 'rakuten-lego-eu',
        priceCents: 5999,
        setId: '10280',
        url: 'https://click.linksynergy.com/lego/10280',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-25T08:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Top1Toys',
        merchantSlug: 'top1toys',
        priceCents: 4999,
        setId: '10280',
        url: 'https://top1toys.example/10280',
      },
    ];

    const detailOffers = resolveCatalogSetDetailOffers({
      generatedOffers: [],
      liveOffers,
    });
    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '10280',
    });

    expect(
      detailOffers.filter((offer) => offer.merchantName === 'LEGO®'),
    ).toHaveLength(1);
    expect(
      detailOffers.find((offer) => offer.merchantName === 'LEGO®'),
    ).toMatchObject({
      merchantSlug: 'rakuten-lego-eu',
      priceCents: 5999,
    });
    expect(summary.offers.map((offer) => offer.merchantName)).toEqual([
      'Top1Toys',
      'LEGO®',
    ]);
    expect(summary.bestOffer).toMatchObject({
      merchantSlug: 'top1toys',
      priceCents: 4999,
    });
  });

  test('does not let stale or unavailable current offers win card summaries', () => {
    const liveOffers = [
      {
        availability: 'out_of_stock' as const,
        checkedAt: '2026-05-18T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Coppenswarenhuis',
        merchantSlug: 'coppenswarenhuis',
        priceCents: 17995,
        setId: '76419',
        url: 'https://coppens.example/hogwarts-main-tower',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-18T09:00:00.000Z',
        commercialUnitType: 'full_set' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 19995,
        setId: '76419',
        url: 'https://goodbricks.example/hogwarts-main-tower',
      },
    ];

    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '76419',
    });

    expect(summary.bestOffer).toMatchObject({
      availability: 'in_stock',
      merchantSlug: 'goodbricks',
      priceCents: 19995,
    });
  });

  test('prefers trusted production-feed offers when strategic manual prices are near-equal', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'bol' as const,
        merchantName: 'bol',
        merchantSlug: 'bol',
        priceCents: 19999,
        setId: '42177',
        url: 'https://bol.example/42177',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 20999,
        setId: '42177',
        url: 'https://goodbricks.example/42177',
      },
    ];

    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '42177',
    });

    expect(summary.bestOffer).toMatchObject({
      merchantSlug: 'goodbricks',
      priceCents: 20999,
    });
    expect(summary.offers.map((offer) => offer.merchantSlug)).toEqual([
      'goodbricks',
      'bol',
    ]);
  });

  test('lets strategic manual offers surface when the price advantage is large', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'bol' as const,
        merchantName: 'bol',
        merchantSlug: 'bol',
        priceCents: 14999,
        setId: '42177',
        url: 'https://bol.example/42177',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 19999,
        setId: '42177',
        url: 'https://goodbricks.example/42177',
      },
    ];

    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '42177',
    });

    expect(summary.bestOffer).toMatchObject({
      merchantSlug: 'bol',
      priceCents: 14999,
    });
    expect(summary.offers).toHaveLength(2);
  });

  test('keeps blind-bag offers visible but away from display-box best deal comparison', () => {
    const liveOffers = [
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        commercialUnitType: 'blind_bag' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Coppenswarenhuis',
        merchantSlug: 'coppenswarenhuis',
        priceCents: 359,
        setId: '71050',
        url: 'https://coppens.example/71050-blind-bag',
      },
      {
        availability: 'in_stock' as const,
        checkedAt: '2026-05-11T10:00:00.000Z',
        commercialUnitType: 'display_box' as const,
        condition: 'new' as const,
        currency: 'EUR' as const,
        market: 'NL' as const,
        merchant: 'other' as const,
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 5995,
        setId: '71050',
        url: 'https://goodbricks.example/71050-random-box',
      },
    ];

    const summary = summarizeCatalogCurrentOffers({
      generatedOffers: [],
      liveOffers,
      setId: '71050',
    });

    expect(summary.bestOffer).toMatchObject({
      commercialUnitType: 'display_box',
      merchantSlug: 'goodbricks',
      priceCents: 5995,
    });
    expect(summary.offers.map((offer) => offer.merchantSlug)).toEqual([
      'goodbricks',
      'coppenswarenhuis',
    ]);
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

  test('passes abort signals to targeted current offer summary API reads', async () => {
    const abortController = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify([]), {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        }),
    );

    await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds: ['42172'],
      signal: abortController.signal,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/current-offer-summaries?setIds=42172',
      expect.objectContaining({
        signal: abortController.signal,
      }),
    );
  });

  test('chunks targeted current offer summary API reads to avoid huge query strings', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify([]), {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        }),
    );
    const setIds = Array.from(
      {
        length: 125,
      },
      (_, index) => String(10_000 + index),
    );

    await listCatalogCurrentOfferSummariesBySetIds({
      fetchImpl,
      setIds,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      `setIds=${setIds.slice(0, 50).join('%2C')}`,
    );
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain(
      `setIds=${setIds.slice(50, 100).join('%2C')}`,
    );
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain(
      `setIds=${setIds.slice(100).join('%2C')}`,
    );
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

  test('recomputes API summary best offer from the normalized offer list', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T09:00:00.000Z',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'other',
              merchantName: 'Coppenswarenhuis',
              merchantSlug: 'coppenswarenhuis',
              priceCents: 22499,
              setId: '76419',
              url: 'https://coppens.example/hogwarts-main-tower',
            },
            offers: [
              {
                availability: 'in_stock',
                checkedAt: '2026-05-18T09:00:00.000Z',
                condition: 'new',
                currency: 'EUR',
                market: 'NL',
                merchant: 'other',
                merchantName: 'Goodbricks',
                merchantSlug: 'goodbricks',
                priceCents: 19995,
                setId: '76419',
                url: 'https://goodbricks.example/hogwarts-main-tower',
              },
              {
                availability: 'in_stock',
                checkedAt: '2026-05-18T09:00:00.000Z',
                condition: 'new',
                currency: 'EUR',
                market: 'NL',
                merchant: 'other',
                merchantName: 'MisterBricks',
                merchantSlug: 'misterbricks',
                priceCents: 20900,
                setId: '76419',
                url: 'https://misterbricks.example/hogwarts-main-tower',
              },
              {
                availability: 'in_stock',
                checkedAt: '2026-05-18T09:00:00.000Z',
                condition: 'new',
                currency: 'EUR',
                market: 'NL',
                merchant: 'other',
                merchantName: 'Coppenswarenhuis',
                merchantSlug: 'coppenswarenhuis',
                priceCents: 22499,
                setId: '76419',
                url: 'https://coppens.example/hogwarts-main-tower',
              },
            ],
            setId: '76419',
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
      setIds: ['76419'],
    });

    expect(summaries.get('76419')?.bestOffer).toMatchObject({
      merchantSlug: 'goodbricks',
      priceCents: 19995,
    });
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

  test('targeted current offer summaries chunk Supabase lookups for merchandising candidates', async () => {
    const setIds = Array.from({ length: 150 }, (_, index) =>
      String(70000 + index),
    );
    const latestOfferRows = setIds.map((setId, index) => ({
      availability: 'in_stock',
      currency_code: 'EUR',
      fetch_status: 'success',
      observed_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
      offer_seed_id: `seed-${setId}`,
      price_minor: 10000 + index,
      updated_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    const offerSeedRows = setIds.map((setId) => ({
      id: `seed-${setId}`,
      is_active: true,
      merchant_id: 'merchant-goodbricks',
      product_url: `https://goodbricks.example/${setId}`,
      set_id: setId,
      validation_status: 'valid',
    }));
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows,
      maxInFilterValues: 100,
      merchantRows: [
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows,
    });

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      setIds,
      supabaseClient,
    });

    expect(summaries.size).toBe(150);
    expect(summaries.get('70149')).toMatchObject({
      bestOffer: {
        merchantSlug: 'goodbricks',
        priceCents: 10149,
      },
      setId: '70149',
    });
  });

  test('uses current-offer snapshots for targeted Supabase summary reads before live fallback', async () => {
    const selectedTables: string[] = [];
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      onSelect: (table) => {
        selectedTables.push(table);
      },
      snapshotRows: [
        {
          best_availability: 'in_stock',
          best_checked_at: '2026-05-26T08:00:00.000Z',
          best_commercial_unit_type: 'single_item',
          best_merchant_name: 'LEGO EU',
          best_merchant_slug: 'rakuten-lego-eu',
          best_price_minor: 2699,
          best_product_url: 'https://www.lego.com/nl-nl/product/77244',
          computed_at: new Date().toISOString(),
          condition: 'new',
          currency_code: 'EUR',
          offer_count: 1,
          offers: [
            {
              availability: 'in_stock',
              checkedAt: '2026-05-26T08:00:00.000Z',
              commercialUnitType: 'single_item',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchantName: 'LEGO EU',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 2699,
              setId: '77244',
              url: 'https://www.lego.com/nl-nl/product/77244',
            },
          ],
          region_code: 'NL',
          set_id: '77244',
        },
      ],
    });

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['77244'],
      supabaseClient,
    });

    expect(supabaseClient.from).toHaveBeenCalledWith(
      'commerce_current_offer_snapshots',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_seeds',
    );
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'commerce_offer_latest',
    );
    expect(selectedTables).toContain('commerce_current_offer_snapshots');
    expect(summaries.get('77244')).toMatchObject({
      bestOffer: {
        merchantName: 'LEGO®',
        merchantSlug: 'rakuten-lego-eu',
        priceCents: 2699,
      },
      setId: '77244',
    });
  });

  test('falls back to live current offers when targeted Supabase snapshots are missing', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-26T08:00:00.000Z',
          offer_seed_id: 'seed-10307',
          price_minor: 62999,
          updated_at: '2026-05-26T08:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-lego',
          is_active: true,
          name: 'LEGO EU',
          slug: 'rakuten-lego-eu',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-10307',
          is_active: true,
          merchant_id: 'merchant-lego',
          product_url: 'https://www.lego.com/nl-nl/product/eiffel-tower-10307',
          set_id: '10307',
          validation_status: 'valid',
        },
      ],
      snapshotRows: [],
    });

    const summaries = await listCatalogCurrentOfferSummariesBySetIds({
      liveFallbackSetIdLimit: 50,
      setIds: ['10307'],
      supabaseClient,
    });

    expect(supabaseClient.from).toHaveBeenCalledWith(
      'commerce_current_offer_snapshots',
    );
    expect(supabaseClient.from).toHaveBeenCalledWith('commerce_offer_seeds');
    expect(summaries.get('10307')).toMatchObject({
      bestOffer: {
        merchantName: 'LEGO®',
        merchantSlug: 'rakuten-lego-eu',
        priceCents: 62999,
      },
      setId: '10307',
    });
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

  test('global current-offer summaries reload the complete offer universe for candidate sets', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:02:00.000Z',
          offer_seed_id: 'seed-coppens',
          price_minor: 22499,
          updated_at: '2026-05-18T09:02:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:01:00.000Z',
          offer_seed_id: 'seed-misterbricks',
          price_minor: 20900,
          updated_at: '2026-05-18T09:01:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:00:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 19995,
          updated_at: '2026-05-18T09:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-coppens',
          is_active: true,
          name: 'Coppenswarenhuis',
          slug: 'coppenswarenhuis',
        },
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
        {
          id: 'merchant-misterbricks',
          is_active: true,
          name: 'MisterBricks',
          slug: 'misterbricks',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-coppens',
          is_active: true,
          merchant_id: 'merchant-coppens',
          product_url: 'https://coppens.example/hogwarts-main-tower',
          set_id: '76419',
          validation_status: 'valid',
        },
        {
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://goodbricks.example/hogwarts-main-tower',
          set_id: '76419',
          validation_status: 'valid',
        },
        {
          id: 'seed-misterbricks',
          is_active: true,
          merchant_id: 'merchant-misterbricks',
          product_url: 'https://misterbricks.example/hogwarts-main-tower',
          set_id: '76419',
          validation_status: 'valid',
        },
      ],
    });

    const summaries = await listCatalogCurrentOfferSummaries({
      limit: 1,
      supabaseClient,
    });

    expect(summaries.get('76419')).toMatchObject({
      bestOffer: {
        merchantSlug: 'goodbricks',
        priceCents: 19995,
      },
      offers: [
        {
          merchantSlug: 'goodbricks',
          priceCents: 19995,
        },
        {
          merchantSlug: 'misterbricks',
          priceCents: 20900,
        },
        {
          merchantSlug: 'coppenswarenhuis',
          priceCents: 22499,
        },
      ],
    });
  });

  test('all current-offer summaries paginate beyond the first latest-offer page', async () => {
    const latestOfferRows = Array.from({ length: 1001 }, (_, index) => ({
      availability: 'in_stock',
      currency_code: 'EUR',
      fetch_status: 'success',
      observed_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
      offer_seed_id: `seed-${index}`,
      price_minor: 10000 + index,
      updated_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    const offerSeedRows = latestOfferRows.map((latestOfferRow, index) => ({
      id: latestOfferRow.offer_seed_id,
      is_active: true,
      merchant_id: 'merchant-goodbricks',
      product_url: `https://goodbricks.example/${index}`,
      set_id: index === 1000 ? '42177' : `9${index}`,
      validation_status: 'valid',
    }));
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows,
      maxInFilterValues: 100,
      merchantRows: [
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows,
    });

    const summaries = await listCatalogAllCurrentOfferSummaries({
      supabaseClient,
    });

    expect(summaries.get('42177')).toMatchObject({
      bestOffer: {
        priceCents: 11000,
        setId: '42177',
      },
      setId: '42177',
    });
  });

  test('current-offer candidate ids return a compact capped list for render paths', async () => {
    const latestOfferRows = Array.from({ length: 250 }, (_, index) => ({
      availability: 'in_stock',
      currency_code: 'EUR',
      fetch_status: 'success',
      observed_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
      offer_seed_id: `seed-${index}`,
      price_minor: 10000 + index,
      updated_at: `2026-05-18T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    const offerSeedRows = latestOfferRows.map((latestOfferRow, index) => ({
      id: latestOfferRow.offer_seed_id,
      is_active: true,
      merchant_id: 'merchant-goodbricks',
      product_url: `https://goodbricks.example/${index}`,
      set_id: String(70000 + index),
      validation_status: 'valid',
    }));
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows,
      maxInFilterValues: 100,
      merchantRows: [
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows,
    });

    const candidateSetIds = await listCatalogCurrentOfferCandidateSetIds({
      limit: 20,
      supabaseClient,
    });

    expect(candidateSetIds).toHaveLength(20);
    expect(candidateSetIds.every((setId) => /^\d+$/u.test(setId))).toBe(true);
  });

  test('current-offer candidate ids prefer compact database RPC over all-offer scan', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      catalogRows: [],
      latestOfferRows: [],
      merchantRows: [],
      offerSeedRows: [],
      rpcHandlers: {
        list_catalog_current_offer_candidate_set_ids: () => ({
          data: [
            { set_id: '77244' },
            { set_id: '77245-1' },
            { set_id: '77244' },
          ],
          error: null,
        }),
      },
    });

    const candidateSetIds = await listCatalogCurrentOfferCandidateSetIds({
      limit: 20,
      supabaseClient,
    });

    expect(candidateSetIds).toEqual(['77244', '77245']);
    expect(supabaseClient.rpc).toHaveBeenCalledWith(
      'list_catalog_current_offer_candidate_set_ids',
      {
        candidate_limit: 20,
      },
    );
    expect(supabaseClient.from).not.toHaveBeenCalled();
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

  test('supports event-driven API fetch caching when a public route disables time TTL', async () => {
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
        revalidateSeconds: false,
        tags: ['prices', 'set:71411'],
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
          revalidate: false,
          tags: ['prices', 'set:71411'],
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

  test('reads runtime catalog discovery signals directly from Supabase when no API override is provided', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-20T10:00:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 19995,
          updated_at: '2026-04-20T10:00:05.000Z',
        },
        {
          availability: 'limited',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-20T09:30:00.000Z',
          offer_seed_id: 'seed-misterbricks',
          price_minor: 20900,
          updated_at: '2026-04-20T09:30:05.000Z',
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
          id: 'merchant-misterbricks',
          is_active: true,
          name: 'MisterBricks',
          slug: 'misterbricks',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          notes: 'full set',
          product_url: 'https://goodbricks.nl/lego-76454',
          set_id: '76454',
          validation_status: 'valid',
        },
        {
          id: 'seed-misterbricks',
          is_active: true,
          merchant_id: 'merchant-misterbricks',
          notes: 'full set',
          product_url: 'https://misterbricks.nl/lego-76454',
          set_id: '76454',
          validation_status: 'valid',
        },
      ],
      priceHistoryRows: [
        {
          condition: 'new',
          currency_code: 'EUR',
          recorded_on: '2026-04-20',
          reference_price_minor: 22995,
          region_code: 'NL',
          set_id: '76454',
        },
      ],
    });
    vi.spyOn(sharedConfig, 'hasServerSupabaseConfig').mockReturnValue(true);
    vi.spyOn(sharedConfig, 'hasBrowserSupabaseConfig').mockReturnValue(false);
    vi.spyOn(sharedConfig, 'getServerSupabaseConfig').mockReturnValue({
      serviceRoleKey: 'service-role',
      url: 'https://brickhunt.supabase.test',
    });
    vi.mocked(supabaseSdk.createClient).mockReturnValue(
      supabaseClient as never,
    );

    const result = await listCatalogDiscoverySignalsBySetId({
      setIds: ['76454'],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(supabaseClient.from).toHaveBeenCalledWith('commerce_offer_seeds');
    expect(result.get('76454')).toEqual({
      bestPriceMinor: 19995,
      merchantCount: 2,
      nextBestPriceMinor: 20900,
      observedAt: '2026-04-20T10:00:00.000Z',
      priceSpreadMinor: 905,
      referenceDeltaMinor: -3000,
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

  test('chunks runtime discovery signal API reads to avoid huge query strings', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify([]), {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        }),
    );
    const setIds = Array.from(
      {
        length: 125,
      },
      (_, index) => String(20_000 + index),
    );

    await listCatalogDiscoverySignalsBySetId({
      fetchImpl,
      setIds,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      `setIds=${setIds.slice(0, 50).join('%2C')}`,
    );
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain(
      `setIds=${setIds.slice(50, 100).join('%2C')}`,
    );
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain(
      `setIds=${setIds.slice(100).join('%2C')}`,
    );
  });

  test('returns an empty discovery signal map when direct Supabase reads fail softly', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [],
      maxInFilterValues: 1,
      merchantRows: [],
      offerSeedRows: [],
    });
    vi.spyOn(sharedConfig, 'hasServerSupabaseConfig').mockReturnValue(true);
    vi.spyOn(sharedConfig, 'hasBrowserSupabaseConfig').mockReturnValue(false);
    vi.spyOn(sharedConfig, 'getServerSupabaseConfig').mockReturnValue({
      serviceRoleKey: 'service-role',
      url: 'https://brickhunt.supabase.test',
    });
    vi.mocked(supabaseSdk.createClient).mockReturnValue(
      supabaseClient as never,
    );

    const result = await listCatalogDiscoverySignalsBySetId({
      setIds: ['42172', '75398'],
    });

    expect(result.size).toBe(0);
  });

  test('passes abort signals to runtime discovery signal API reads', async () => {
    const abortController = new AbortController();
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
      signal: abortController.signal,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/catalog/discovery-signals?setIds=75355',
      expect.objectContaining({
        signal: abortController.signal,
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
          fetched_at: '2026-04-18T12:05:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-04-18T11:40:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 4999,
          updated_at: '2026-04-18T11:40:05.000Z',
        },
        {
          availability: 'unavailable',
          currency_code: 'EUR',
          fetch_status: 'unavailable',
          observed_at: '2026-04-18T11:42:00.000Z',
          offer_seed_id: 'seed-alternate',
          price_minor: null,
          updated_at: '2026-04-18T11:42:05.000Z',
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
          id: 'merchant-alternate',
          is_active: true,
          name: 'Alternate',
          slug: 'alternate',
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
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://goodbricks.example/21340',
          set_id: '21340',
          validation_status: 'valid',
        },
        {
          id: 'seed-alternate',
          is_active: true,
          merchant_id: 'merchant-alternate',
          product_url: 'https://alternate.example/21340',
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
      latestPrimaryOfferCheckedAt: '2026-04-18T12:05:00.000Z',
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
          offer_seed_id: 'seed-goodbricks',
          price_minor: 16999,
          updated_at: '2026-04-18T11:44:05.000Z',
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
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://goodbricks.example/72037',
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
