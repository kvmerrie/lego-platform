import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { describe, expect, test, vi } from 'vitest';

import {
  type CatalogResolvedOffer,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  getCatalogCurrentOfferSummaryBySetId,
  getCatalogSetBySlug,
  getCatalogThemePageBySlug,
  listCanonicalCatalogSets,
  listCatalogSearchMatches,
  listCatalogSearchSuggestionSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
  listCatalogSetSummaries,
  listCatalogThemeDirectoryItems,
  listCatalogThemePageSlugs,
  listDiscoverBrowseThemeGroups,
  listDiscoverHighlightSetCards,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
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

  test('does not fall back to snapshot canonical identity when a set is absent', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetById({
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

  test('keeps homepage featured cards on the curated id order when canonical sets exist', async () => {
    const result = await listHomepageSetCards({
      listCanonicalCatalogSetsFn: async () => [
        createCanonicalCatalogSet({
          name: 'Rivendell',
          setId: '10316',
          slug: 'rivendell-10316',
          sourceSetNumber: '10316-1',
          primaryTheme: 'Icons',
        }),
        createCanonicalCatalogSet({
          name: 'The Lord of the Rings: Barad-dur',
          setId: '10333',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          sourceSetNumber: '10333-1',
          primaryTheme: 'Icons',
        }),
        createCanonicalCatalogSet({
          name: 'Vincent van Gogh - The Starry Night',
          pieceCount: 2316,
          releaseYear: 2022,
          setId: '21333',
          slug: 'vincent-van-gogh-the-starry-night-21333',
          sourceSetNumber: '21333-1',
          primaryTheme: 'Ideas',
        }),
      ],
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
      '10333',
      '21333',
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
});
