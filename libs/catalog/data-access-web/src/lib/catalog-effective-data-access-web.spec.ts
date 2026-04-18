import {
  getCatalogThemePageBySlug,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  listCatalogThemePageSlugs,
} from '@lego-platform/catalog/data-access';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { describe, expect, test, vi } from 'vitest';

import {
  type CatalogResolvedOffer,
  getCatalogThemePageBySlugWithOverlay,
  listHomepageThemeDirectoryItemsWithOverlay,
  listHomepageThemeSpotlightItemsWithOverlay,
  listCatalogSearchMatchesWithOverlay,
  listCatalogSetLiveOffersBySetId,
  listCatalogSearchSuggestionOverlaySetCards,
  listCatalogSetSlugsWithOverlay,
  listCatalogThemeDirectoryItemsWithOverlay,
  listCatalogThemePageSlugsWithOverlay,
  listDiscoverBrowseThemeGroupsWithOverlay,
  resolveCatalogSetDetailOffers,
} from './catalog-effective-data-access-web';

function createOverlaySet(
  overrides: Partial<{
    createdAt: string;
    imageUrl?: string;
    name: string;
    pieces: number;
    releaseYear: number;
    setId: string;
    slug: string;
    source: 'rebrickable';
    sourceSetNumber: string;
    status: 'active' | 'inactive';
    theme: string;
    updatedAt: string;
  }> = {},
) {
  return {
    createdAt: '2026-04-17T08:00:00.000Z',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
    name: 'Mario Kart - Mario & Standard Kart',
    pieces: 1972,
    releaseYear: 2025,
    setId: '72037',
    slug: 'mario-kart-mario-standard-kart-72037',
    source: 'rebrickable' as const,
    sourceSetNumber: '72037-1',
    status: 'active' as const,
    theme: 'Super Mario',
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
  latestOfferRows,
  merchantRows,
  offerSeedRows,
}: {
  latestOfferRows: readonly Record<string, unknown>[];
  merchantRows: readonly Record<string, unknown>[];
  offerSeedRows: readonly Record<string, unknown>[];
}) {
  return {
    from: vi.fn((table: string) => {
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
  test('includes active overlay sets in public search matches', async () => {
    const overlaySet = createOverlaySet();

    const results = await listCatalogSearchMatchesWithOverlay({
      limit: 6,
      listCatalogOverlaySetsFn: async () => [overlaySet],
      query: '72037',
    });

    expect(results[0]?.setCard).toMatchObject({
      id: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      theme: 'Super Mario',
    });
  });

  test('returns only active deduped overlay cards for shell search suggestions', async () => {
    const activeOverlaySet = createOverlaySet();
    const duplicateOverlaySet = createOverlaySet({
      createdAt: '2026-04-17T09:00:00.000Z',
      updatedAt: '2026-04-17T09:00:00.000Z',
    });
    const inactiveOverlaySet = createOverlaySet({
      name: 'Mario Kart - Luigi & Standard Kart',
      setId: '72038',
      slug: 'mario-kart-luigi-standard-kart-72038',
      sourceSetNumber: '72038-1',
      status: 'inactive',
    });

    const result = await listCatalogSearchSuggestionOverlaySetCards({
      listCatalogOverlaySetsFn: async () => [
        activeOverlaySet,
        duplicateOverlaySet,
        inactiveOverlaySet,
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
    });
  });

  test('merges overlay sets into existing theme pages', async () => {
    const snapshotThemePage = getCatalogThemePageBySlug('star-wars');

    expect(snapshotThemePage).toBeDefined();

    const result = await getCatalogThemePageBySlugWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
          name: 'Rebel U-Wing Starfighter',
          pieces: 594,
          releaseYear: 2026,
          setId: '75399',
          slug: 'rebel-u-wing-starfighter-75399',
          sourceSetNumber: '75399-1',
          theme: 'Star Wars',
        }),
      ],
      slug: 'star-wars',
    });

    expect(result).toBeDefined();
    expect(result?.setCards[0]).toMatchObject({
      id: '75399',
      theme: 'Star Wars',
    });
    expect(result?.themeSnapshot.setCount).toBe(
      (snapshotThemePage?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('routes overlay-backed UCS sets into the Star Wars theme page', async () => {
    const result = await getCatalogThemePageBySlugWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
          name: 'Millennium Falcon',
          pieces: 7541,
          releaseYear: 2017,
          setId: '75192',
          slug: 'millennium-falcon-75192',
          sourceSetNumber: '75192-1',
          theme: 'Ultimate Collector Series',
        }),
      ],
      slug: 'star-wars',
    });

    expect(result?.setCards.some((setCard) => setCard.id === '75192')).toBe(
      true,
    );
    expect(result?.themeSnapshot.name).toBe('Star Wars');
  });

  test('creates fallback theme directory and theme page entries for overlay-only themes', async () => {
    const overlaySet = createOverlaySet({
      name: 'Great Deku Tree 2-in-1',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });
    const overlayThemeSlug = buildCatalogThemeSlug(overlaySet.theme);

    const [themeDirectoryItems, themePageSlugs, themePage] = await Promise.all([
      listCatalogThemeDirectoryItemsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      listCatalogThemePageSlugsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      getCatalogThemePageBySlugWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
        slug: overlayThemeSlug,
      }),
    ]);

    expect(
      themeDirectoryItems.find(
        (themeDirectoryItem) =>
          themeDirectoryItem.themeSnapshot.slug === overlayThemeSlug,
      ),
    ).toMatchObject({
      themeSnapshot: {
        name: 'The Legend of Zelda',
        slug: overlayThemeSlug,
      },
    });
    expect(themePageSlugs).toContain(overlayThemeSlug);
    expect(themePage).toMatchObject({
      themeSnapshot: {
        name: 'The Legend of Zelda',
        slug: overlayThemeSlug,
      },
    });
    expect(themePage?.setCards[0]?.id).toBe('77092');
  });

  test('keeps the homepage theme rail lineup stable while merging overlay coverage into existing themes', async () => {
    const baselineHomepageThemeItems = listHomepageThemeDirectoryItems();
    const result = await listHomepageThemeDirectoryItemsWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10334-1/1000.jpg',
          name: 'Retro Radio',
          pieces: 906,
          releaseYear: 2026,
          setId: '10334',
          slug: 'retro-radio-10334',
          sourceSetNumber: '10334-1',
          theme: 'Icons',
        }),
      ],
    });

    expect(
      result.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    ).toEqual(
      baselineHomepageThemeItems.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    );
    expect(
      result.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Icons',
      )?.themeSnapshot.setCount,
    ).toBe(
      (baselineHomepageThemeItems.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Icons',
      )?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('keeps the homepage theme spotlight stable while merging overlay coverage into spotlight themes', async () => {
    const baselineHomepageThemeSpotlightItems =
      listHomepageThemeSpotlightItems();
    const result = await listHomepageThemeSpotlightItemsWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10342-1/1000.jpg',
          name: 'Pretty Pink Flower Bouquet',
          pieces: 749,
          releaseYear: 2026,
          setId: '10342',
          slug: 'pretty-pink-flower-bouquet-10342',
          sourceSetNumber: '10342-1',
          theme: 'Botanicals',
        }),
      ],
    });

    expect(
      result.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    ).toEqual(
      baselineHomepageThemeSpotlightItems.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    );
    expect(
      result.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Botanicals',
      )?.themeSnapshot.setCount,
    ).toBe(
      (baselineHomepageThemeSpotlightItems.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Botanicals',
      )?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('does not auto-promote overlay-only themes into the limited homepage theme rows', async () => {
    const overlayOnlyTheme = createOverlaySet({
      name: 'Great Deku Tree 2-in-1',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });
    const [homepageThemeItems, homepageThemeSpotlightItems] = await Promise.all(
      [
        listHomepageThemeDirectoryItemsWithOverlay({
          listCatalogOverlaySetsFn: async () => [overlayOnlyTheme],
        }),
        listHomepageThemeSpotlightItemsWithOverlay({
          listCatalogOverlaySetsFn: async () => [overlayOnlyTheme],
        }),
      ],
    );

    expect(
      homepageThemeItems.some(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name ===
          'The Legend of Zelda',
      ),
    ).toBe(false);
    expect(
      homepageThemeSpotlightItems.some(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name ===
          'The Legend of Zelda',
      ),
    ).toBe(false);
  });

  test('adds overlay sets to discover browse groups and set slugs', async () => {
    const overlaySet = createOverlaySet({
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
      name: 'Rebel U-Wing Starfighter',
      pieces: 594,
      releaseYear: 2026,
      setId: '75399',
      slug: 'rebel-u-wing-starfighter-75399',
      sourceSetNumber: '75399-1',
      theme: 'Star Wars',
    });
    const baselineThemeSlugs = new Set(listCatalogThemePageSlugs());

    const [setSlugs, discoverThemeGroups] = await Promise.all([
      listCatalogSetSlugsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      listDiscoverBrowseThemeGroupsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
        setLimit: 12,
        themeLimit: 12,
      }),
    ]);

    expect(setSlugs).toContain('rebel-u-wing-starfighter-75399');
    expect(
      discoverThemeGroups
        .find(
          (catalogThemeGroup) =>
            catalogThemeGroup.slug === buildCatalogThemeSlug('Star Wars'),
        )
        ?.setCards.some((setCard) => setCard.id === '75399'),
    ).toBe(true);
    expect(baselineThemeSlugs.has(buildCatalogThemeSlug('Star Wars'))).toBe(
      true,
    );
  });

  test('returns live catalog offers for valid active merchant seeds', async () => {
    const supabaseClient = createCatalogSupabaseClientMock({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T09:10:00.000Z',
          offer_seed_id: 'seed-intertoys',
          price_minor: 16999,
          updated_at: '2026-04-18T09:10:00.000Z',
        },
        {
          availability: 'limited',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T09:12:00.000Z',
          offer_seed_id: 'seed-misterbricks',
          price_minor: 16499,
          updated_at: '2026-04-18T09:12:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-18T09:14:00.000Z',
          offer_seed_id: 'seed-inactive',
          price_minor: 15999,
          updated_at: '2026-04-18T09:14:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-intertoys',
          is_active: true,
          name: 'Intertoys',
          slug: 'intertoys',
        },
        {
          id: 'merchant-misterbricks',
          is_active: true,
          name: 'MisterBricks',
          slug: 'misterbricks',
        },
        {
          id: 'merchant-inactive',
          is_active: false,
          name: 'Inactive Merchant',
          slug: 'inactive-merchant',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-intertoys',
          is_active: true,
          merchant_id: 'merchant-intertoys',
          product_url: 'https://www.intertoys.nl/mario-kart',
          set_id: '72037',
          validation_status: 'valid',
        },
        {
          id: 'seed-misterbricks',
          is_active: true,
          merchant_id: 'merchant-misterbricks',
          product_url: 'https://www.misterbricks.nl/mario-kart',
          set_id: '72037',
          validation_status: 'valid',
        },
        {
          id: 'seed-inactive',
          is_active: true,
          merchant_id: 'merchant-inactive',
          product_url: 'https://www.inactive-merchant.nl/mario-kart',
          set_id: '72037',
          validation_status: 'valid',
        },
        {
          id: 'seed-pending',
          is_active: true,
          merchant_id: 'merchant-intertoys',
          product_url: 'https://www.intertoys.nl/mario-kart-pending',
          set_id: '72037',
          validation_status: 'pending',
        },
      ],
    });

    const result = await listCatalogSetLiveOffersBySetId({
      setId: '72037',
      supabaseClient,
    });

    expect(result).toHaveLength(2);
    expect(result.map((catalogOffer) => catalogOffer.merchantName)).toEqual([
      'MisterBricks',
      'Intertoys',
    ]);
    expect(result[0]).toMatchObject({
      availability: 'in_stock',
      merchantSlug: 'misterbricks',
      priceCents: 16499,
      setId: '72037',
    });
  });

  test('loads live set-detail offers through the API when no Supabase client is injected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([
        {
          availability: 'in_stock',
          checkedAt: '2026-04-18T11:45:11.617Z',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          priceCents: 16541,
          setId: '21061',
          url: 'https://www.proshop.nl/LEGO/LEGO-Architecture-21061-Notre-Dame-van-Parijs/3259265',
        },
      ]),
      ok: true,
    });

    const result = await listCatalogSetLiveOffersBySetId({
      apiBaseUrl: 'https://api.example.test',
      fetchImpl,
      setId: '21061',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/catalog/sets/21061/live-offers',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchantName: 'Proshop',
      priceCents: 16541,
      setId: '21061',
    });
  });

  test('prefers live pricing data while preserving generated outbound urls for matching merchants', () => {
    const result = resolveCatalogSetDetailOffers({
      generatedOffers: [
        createCatalogOffer({
          merchant: 'other',
          merchantName: 'MisterBricks',
          priceCents: 18999,
          url: 'https://brickhunt.nl/out/misterbricks-72037',
        }),
      ],
      liveOffers: [
        {
          availability: 'in_stock',
          checkedAt: '2026-04-18T09:12:00.000Z',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          priceCents: 16499,
          setId: '72037',
          url: 'https://www.misterbricks.nl/mario-kart',
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchantName: 'MisterBricks',
      priceCents: 16499,
      url: 'https://brickhunt.nl/out/misterbricks-72037',
    });
  });

  test('a successful live refresh keeps the public pricing state out of no-deal mode', () => {
    const resolvedOffers = resolveCatalogSetDetailOffers({
      generatedOffers: [],
      liveOffers: [
        {
          availability: 'in_stock',
          checkedAt: '2026-04-18T09:12:00.000Z',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'Intertoys',
          merchantSlug: 'intertoys',
          priceCents: 16999,
          setId: '72037',
          url: 'https://www.intertoys.nl/mario-kart',
        },
        {
          availability: 'in_stock',
          checkedAt: '2026-04-18T09:15:00.000Z',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'Top1Toys',
          merchantSlug: 'top1toys',
          priceCents: 17499,
          setId: '72037',
          url: 'https://www.top1toys.nl/mario-kart',
        },
      ],
    });

    expect(resolvedOffers).toHaveLength(2);
    expect(resolvedOffers[0]).toMatchObject({
      merchantName: 'Intertoys',
      priceCents: 16999,
    });
  });
});
