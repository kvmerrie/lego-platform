import { describe, expect, test, vi } from 'vitest';
import {
  backfillCatalogOverlayThemeIdentity,
  createCatalogSet,
  listCatalogCurrentOfferSummariesBySetIds,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  getCatalogSetBySlugWithOverlay,
  listCatalogDiscoverySignals,
  listCatalogSuggestedMissingSets,
  listCanonicalCatalogSets,
  listCatalogSetSummariesWithOverlay,
  refreshZeroPieceSets,
  searchCatalogMissingSets,
} from './catalog-data-access-server';

function createCatalogOverlayRow(
  overrides: Partial<{
    created_at: string;
    image_url: string | null;
    name: string;
    piece_count: number;
    primary_theme_id?: string | null;
    release_year: number;
    set_id: string;
    slug: string;
    source: string;
    source_theme_id?: string | null;
    source_set_number: string;
    status: string;
    theme: string;
    updated_at: string;
  }> = {},
) {
  return {
    created_at: '2026-04-17T08:00:00.000Z',
    image_url: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
    name: 'Great Deku Tree 2-in-1',
    piece_count: 2500,
    release_year: 2024,
    set_id: '77092',
    slug: 'great-deku-tree-2-in-1-77092',
    source: 'rebrickable',
    source_set_number: '77092-1',
    status: 'active',
    theme: 'The Legend of Zelda',
    updated_at: '2026-04-17T08:00:00.000Z',
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
    | {
        type: 'limit';
        count: number;
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
    maybeSingle() {
      return builder.then((result) => ({
        data: result.data[0] ?? null,
        error: result.error,
      }));
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

          if (filter.type === 'limit') {
            return resultRows.slice(0, filter.count);
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

function createSupabaseUpdateBuilder() {
  const builder = {
    eq: vi.fn(() => builder),
    then<TResult1 = { data: null; error: null }>(
      onFulfilled?:
        | ((value: {
            data: null;
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      return Promise.resolve({
        data: null,
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createCatalogOverlaySupabaseClient({
  canonicalInsertResult,
  insertResult,
  canonicalRows,
  latestOfferRows = [],
  merchantRows = [],
  minifigSummaryRows = [],
  overlayRows = [],
  offerSeedRows = [],
  priceHistoryRows = [],
  primaryThemeRows = [],
  sourceThemeRows = [],
  themeMappingRows = [],
}: {
  canonicalInsertResult?: {
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  };
  insertResult?: {
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  };
  canonicalRows?: Record<string, unknown>[];
  latestOfferRows?: Record<string, unknown>[];
  merchantRows?: Record<string, unknown>[];
  minifigSummaryRows?: Record<string, unknown>[];
  overlayRows?: Record<string, unknown>[];
  offerSeedRows?: Record<string, unknown>[];
  priceHistoryRows?: Record<string, unknown>[];
  primaryThemeRows?: Record<string, unknown>[];
  sourceThemeRows?: Record<string, unknown>[];
  themeMappingRows?: Record<string, unknown>[];
} = {}) {
  const sourceThemeUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const primaryThemeUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const themeMappingUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const canonicalUpdateBuilder = createSupabaseUpdateBuilder();
  const updateCanonicalEq = canonicalUpdateBuilder.eq;
  const updateCanonical = vi.fn(() => canonicalUpdateBuilder);
  const updateBuilder = createSupabaseUpdateBuilder();
  const updateEq = updateBuilder.eq;
  const update = vi.fn(() => updateBuilder);
  const canonicalInsertSingle = vi.fn().mockResolvedValue(
    canonicalInsertResult ?? {
      data: createCatalogOverlayRow({
        theme: undefined,
      }),
      error: null,
    },
  );
  const canonicalInsertSelect = vi.fn(() => ({
    single: canonicalInsertSingle,
  }));
  const canonicalInsert = vi.fn(() => ({
    select: canonicalInsertSelect,
  }));
  const insertSingle = vi.fn().mockResolvedValue(
    insertResult ?? {
      data: createCatalogOverlayRow(),
      error: null,
    },
  );
  const insertSelect = vi.fn(() => ({
    single: insertSingle,
  }));
  const insert = vi.fn(() => ({
    select: insertSelect,
  }));
  const activeCanonicalRows = canonicalRows ?? overlayRows;
  const rpc = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const from = vi.fn((table: string) => {
    if (table === 'catalog_sets') {
      const builder = createSupabaseTableBuilder(activeCanonicalRows);
      return {
        insert: canonicalInsert,
        select: builder.select,
        update: updateCanonical,
      };
    }

    if (table === 'catalog_source_themes') {
      const builder = createSupabaseTableBuilder(sourceThemeRows);
      return {
        select: builder.select,
        upsert: sourceThemeUpsert,
      };
    }

    if (table === 'catalog_themes') {
      const builder = createSupabaseTableBuilder(primaryThemeRows);
      return {
        select: builder.select,
        upsert: primaryThemeUpsert,
      };
    }

    if (table === 'catalog_theme_mappings') {
      const builder = createSupabaseTableBuilder(themeMappingRows);
      return {
        select: builder.select,
        upsert: themeMappingUpsert,
      };
    }

    if (table === 'catalog_set_minifig_summaries') {
      return createSupabaseTableBuilder(minifigSummaryRows);
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

    if (table === 'pricing_daily_set_history') {
      return createSupabaseTableBuilder(priceHistoryRows);
    }

    throw new Error(`Unexpected table requested in test: ${table}`);
  });

  return {
    from,
    canonicalInsert,
    canonicalInsertSingle,
    insert,
    insertSingle,
    primaryThemeUpsert,
    sourceThemeUpsert,
    rpc,
    supabaseClient: { from, rpc } as never,
    themeMappingUpsert,
    updateCanonical,
    updateCanonicalEq,
    update,
    updateEq,
  };
}

function createRebrickableFetchMock({
  listPayloads = {},
  setPayloads,
  themePayloads,
}: {
  listPayloads?: Record<string, Record<string, unknown>>;
  setPayloads: Record<string, Record<string, unknown>>;
  themePayloads: Record<string, Record<string, unknown>>;
}) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);

    if (url.includes('/lego/sets/?')) {
      for (const [urlFragment, payload] of Object.entries(listPayloads)) {
        if (url.includes(urlFragment)) {
          return {
            ok: true,
            json: async () => payload,
          } as Response;
        }
      }

      throw new Error(`Unexpected search fetch ${url}`);
    }

    for (const [setNumber, payload] of Object.entries(setPayloads)) {
      if (url.endsWith(`/lego/sets/${setNumber}/`)) {
        return {
          ok: true,
          json: async () => payload,
        } as Response;
      }
    }

    for (const [themeId, payload] of Object.entries(themePayloads)) {
      if (url.endsWith(`/lego/themes/${themeId}/`)) {
        return {
          ok: true,
          json: async () => payload,
        } as Response;
      }
    }

    throw new Error(`Unexpected fetch ${url}`);
  }) as typeof fetch;
}

describe('catalog data access server', () => {
  test('builds current discovery signals from active validated merchant offers', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          offer_seed_id: 'seed-2',
          price_minor: 32999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetched_at: '2026-04-20T10:15:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-04-20T09:30:00.000Z',
          updated_at: '2026-04-20T09:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-1',
          price_minor: 34999,
          currency_code: 'EUR',
          availability: 'limited',
          fetch_status: 'success',
          observed_at: '2026-04-20T08:30:00.000Z',
          updated_at: '2026-04-20T08:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-3',
          price_minor: 49999,
          currency_code: 'EUR',
          availability: 'out_of_stock',
          fetch_status: 'success',
          observed_at: '2026-04-20T10:30:00.000Z',
          updated_at: '2026-04-20T10:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-4',
          price_minor: 31999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'error',
          observed_at: '2026-04-20T11:30:00.000Z',
          updated_at: '2026-04-20T11:35:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-bol',
          is_active: true,
          name: 'bol',
          slug: 'bol',
        },
        {
          id: 'merchant-intertoys',
          is_active: true,
          name: 'Intertoys',
          slug: 'intertoys',
        },
        {
          id: 'merchant-blocked',
          is_active: false,
          name: 'Dormant Merchant',
          slug: 'dormant',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-1',
          is_active: true,
          merchant_id: 'merchant-intertoys',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://www.intertoys.nl/technic',
          set_id: '42172',
          validation_status: 'valid',
        },
        {
          id: 'seed-2',
          is_active: true,
          merchant_id: 'merchant-bol',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://www.bol.com/nl/nl/p/technic',
          set_id: '42172',
          validation_status: 'valid',
        },
        {
          id: 'seed-3',
          is_active: true,
          merchant_id: 'merchant-blocked',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://example.test/dormant',
          set_id: '42172',
          validation_status: 'valid',
        },
        {
          id: 'seed-4',
          is_active: true,
          merchant_id: 'merchant-bol',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://www.bol.com/nl/nl/p/technic-duplicate',
          set_id: '42171',
          validation_status: 'valid',
        },
      ],
      priceHistoryRows: [
        {
          condition: 'new',
          currency_code: 'EUR',
          recorded_on: '2026-04-20',
          reference_price_minor: 44999,
          region_code: 'NL',
          set_id: '42172',
        },
        {
          condition: 'new',
          currency_code: 'EUR',
          recorded_on: '2026-04-19',
          reference_price_minor: 45999,
          region_code: 'NL',
          set_id: '42172',
        },
      ],
    });

    const result = await listCatalogDiscoverySignals({
      supabaseClient,
    });

    expect(result).toEqual([
      {
        setId: '42172',
        bestPriceMinor: 32999,
        merchantCount: 2,
        nextBestPriceMinor: 34999,
        observedAt: '2026-04-20T09:30:00.000Z',
        priceSpreadMinor: 2000,
        recentReferencePriceChangeMinor: -1000,
        recentReferencePriceChangedAt: '2026-04-20',
        referenceDeltaMinor: -12000,
      },
    ]);
  });

  test('treats normal LEGO set offers with set numbers as comparable full sets', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          offer_seed_id: 'seed-coolblue',
          price_minor: 18900,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:30:00.000Z',
          updated_at: '2026-05-11T09:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-mediamarkt',
          price_minor: 19999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:31:00.000Z',
          updated_at: '2026-05-11T09:36:00.000Z',
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
          id: 'merchant-mediamarkt',
          is_active: true,
          name: 'MediaMarkt',
          slug: 'mediamarkt',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-coolblue',
          is_active: true,
          merchant_id: 'merchant-coolblue',
          notes:
            'Product title: LEGO Technic Mercedes-AMG F1 W14 E Performance.',
          product_url:
            'https://www.coolblue.nl/product/42177/lego-technic-mercedes-amg-f1-w14-e-performance.html',
          set_id: '42177',
          validation_status: 'valid',
        },
        {
          id: 'seed-mediamarkt',
          is_active: true,
          merchant_id: 'merchant-mediamarkt',
          notes:
            'Product title: LEGO Technic Mercedes-AMG F1 W14 E Performance.',
          product_url:
            'https://www.mediamarkt.nl/nl/product/_lego-42177-technic-mercedes-amg-f1-w14-e-performance-1792500.html',
          set_id: '42177',
          validation_status: 'valid',
        },
      ],
      priceHistoryRows: [
        {
          condition: 'new',
          currency_code: 'EUR',
          recorded_on: '2026-05-11',
          reference_price_minor: 24999,
          region_code: 'NL',
          set_id: '42177',
        },
      ],
    });

    const result = await listCatalogDiscoverySignals({
      supabaseClient,
    });

    expect(result).toEqual([
      expect.objectContaining({
        setId: '42177',
        bestPriceMinor: 18900,
        merchantCount: 2,
        nextBestPriceMinor: 19999,
        referenceDeltaMinor: -6099,
      }),
    ]);
  });

  test('builds discovery signals from comparable commercial units only', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          offer_seed_id: 'seed-display',
          price_minor: 5995,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:30:00.000Z',
          updated_at: '2026-05-11T09:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-blind-bag',
          price_minor: 359,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:31:00.000Z',
          updated_at: '2026-05-11T09:36:00.000Z',
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
          id: 'merchant-coppens',
          is_active: true,
          name: 'Coppenswarenhuis',
          slug: 'coppenswarenhuis',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-display',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          notes: 'Product title: LEGO 71050 random box complete serie.',
          product_url: 'https://goodbricks.example/71050-random-box',
          set_id: '71050',
          validation_status: 'valid',
        },
        {
          id: 'seed-blind-bag',
          is_active: true,
          merchant_id: 'merchant-coppens',
          notes: 'Product title: LEGO 71050 blind bag single pack.',
          product_url: 'https://coppens.example/71050-blind-bag',
          set_id: '71050',
          validation_status: 'valid',
        },
      ],
      priceHistoryRows: [
        {
          condition: 'new',
          currency_code: 'EUR',
          recorded_on: '2026-05-11',
          reference_price_minor: 5995,
          region_code: 'NL',
          set_id: '71050',
        },
      ],
    });

    const result = await listCatalogDiscoverySignals({
      supabaseClient,
    });

    expect(result).toEqual([
      expect.objectContaining({
        setId: '71050',
        bestPriceMinor: 5995,
        merchantCount: 1,
        priceSpreadMinor: 0,
        referenceDeltaMinor: 0,
      }),
    ]);
  });

  test('does not let unknown commercial units create discovery deal spreads', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:30:00.000Z',
          offer_seed_id: 'seed-coppens',
          price_minor: 359,
          updated_at: '2026-05-11T09:35:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T09:31:00.000Z',
          offer_seed_id: 'seed-misterbricks',
          price_minor: 11900,
          updated_at: '2026-05-11T09:36:00.000Z',
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
          notes: '',
          product_url: 'https://coppens.example/71050',
          set_id: '71050',
          validation_status: 'valid',
        },
        {
          id: 'seed-misterbricks',
          is_active: true,
          merchant_id: 'merchant-misterbricks',
          notes: '',
          product_url: 'https://misterbricks.example/71050',
          set_id: '71050',
          validation_status: 'valid',
        },
      ],
    });

    await expect(
      listCatalogDiscoverySignals({
        supabaseClient,
      }),
    ).resolves.toEqual([]);
  });

  test('builds current offer summaries for many set ids in one batch selector', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          offer_seed_id: 'seed-2',
          price_minor: 32999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetched_at: '2026-04-20T10:15:00.000Z',
          fetch_status: 'success',
          observed_at: '2026-04-20T09:30:00.000Z',
          updated_at: '2026-04-20T09:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-1',
          price_minor: 34999,
          currency_code: 'EUR',
          availability: 'limited',
          fetch_status: 'success',
          observed_at: '2026-04-20T08:30:00.000Z',
          updated_at: '2026-04-20T08:35:00.000Z',
        },
        {
          offer_seed_id: 'seed-3',
          price_minor: 19999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-04-20T07:30:00.000Z',
          updated_at: '2026-04-20T07:35:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-bol',
          is_active: true,
          name: 'bol',
          slug: 'bol',
        },
        {
          id: 'merchant-intertoys',
          is_active: true,
          name: 'Intertoys',
          slug: 'intertoys',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-1',
          is_active: true,
          merchant_id: 'merchant-intertoys',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://www.intertoys.nl/technic',
          set_id: '42172',
          validation_status: 'valid',
        },
        {
          id: 'seed-2',
          is_active: true,
          merchant_id: 'merchant-bol',
          notes: 'Product title: LEGO Technic full set bouwset.',
          product_url: 'https://www.bol.com/nl/nl/p/technic',
          set_id: '42172',
          validation_status: 'valid',
        },
        {
          id: 'seed-3',
          is_active: true,
          merchant_id: 'merchant-bol',
          notes: 'Product title: LEGO Star Wars full set bouwset.',
          product_url: 'https://www.bol.com/nl/nl/p/star-wars',
          set_id: '75398',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['42172', '75398', '71411'],
      supabaseClient,
    });

    expect(result).toEqual([
      {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-04-20T09:30:00.000Z',
          condition: 'new',
          commercialUnitType: 'full_set',
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
            checkedAt: '2026-04-20T09:30:00.000Z',
            condition: 'new',
            commercialUnitType: 'full_set',
            currency: 'EUR',
            market: 'NL',
            merchant: 'bol',
            merchantName: 'bol',
            merchantSlug: 'bol',
            priceCents: 32999,
            setId: '42172',
            url: 'https://www.bol.com/nl/nl/p/technic',
          },
          {
            availability: 'unknown',
            checkedAt: '2026-04-20T08:30:00.000Z',
            condition: 'new',
            commercialUnitType: 'full_set',
            currency: 'EUR',
            market: 'NL',
            merchant: 'other',
            merchantName: 'Intertoys',
            merchantSlug: 'intertoys',
            priceCents: 34999,
            setId: '42172',
            url: 'https://www.intertoys.nl/technic',
          },
        ],
        setId: '42172',
      },
      {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-04-20T07:30:00.000Z',
          condition: 'new',
          commercialUnitType: 'full_set',
          currency: 'EUR',
          market: 'NL',
          merchant: 'bol',
          merchantName: 'bol',
          merchantSlug: 'bol',
          priceCents: 19999,
          setId: '75398',
          url: 'https://www.bol.com/nl/nl/p/star-wars',
        },
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-04-20T07:30:00.000Z',
            condition: 'new',
            commercialUnitType: 'full_set',
            currency: 'EUR',
            market: 'NL',
            merchant: 'bol',
            merchantName: 'bol',
            merchantSlug: 'bol',
            priceCents: 19999,
            setId: '75398',
            url: 'https://www.bol.com/nl/nl/p/star-wars',
          },
        ],
        setId: '75398',
      },
    ]);
  });

  test('normalizes current offer summaries to canonical set ids', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-04-20T09:30:00.000Z',
          offer_seed_id: 'seed-1',
          price_minor: 9999,
          updated_at: '2026-04-20T09:30:00.000Z',
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
          id: 'seed-1',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://id.goodbricks.nl/t/t?a=1849540612',
          set_id: '75459-1',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['75459-1', '71411'],
      supabaseClient,
    });

    expect(result).toEqual([
      {
        bestOffer: expect.objectContaining({
          priceCents: 9999,
          setId: '75459',
        }),
        offers: [
          expect.objectContaining({
            priceCents: 9999,
            setId: '75459',
          }),
        ],
        setId: '75459',
      },
    ]);
  });

  test('prefers trusted production-feed current offers over near-equal strategic manual offers', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T10:00:00.000Z',
          offer_seed_id: 'seed-bol',
          price_minor: 19999,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T10:00:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 20999,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-bol',
          is_active: true,
          name: 'bol',
          slug: 'bol',
        },
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-bol',
          is_active: true,
          merchant_id: 'merchant-bol',
          product_url: 'https://bol.example/42177',
          set_id: '42177',
          validation_status: 'valid',
        },
        {
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://goodbricks.example/42177',
          set_id: '42177',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['42177'],
      supabaseClient,
    });

    expect(result[0]).toMatchObject({
      bestOffer: {
        merchantSlug: 'goodbricks',
        priceCents: 20999,
      },
      offers: [
        {
          merchantSlug: 'goodbricks',
          priceCents: 20999,
        },
        {
          merchantSlug: 'bol',
          priceCents: 19999,
        },
      ],
    });
  });

  test('selects Goodbricks as the card/API best offer when multiple in-stock merchants exist', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:00:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 19995,
          updated_at: '2026-05-18T09:00:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:00:00.000Z',
          offer_seed_id: 'seed-misterbricks',
          price_minor: 20900,
          updated_at: '2026-05-18T09:00:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:00:00.000Z',
          offer_seed_id: 'seed-coppens',
          price_minor: 22499,
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

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['76419'],
      supabaseClient,
    });

    expect(result[0]).toMatchObject({
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

  test('does not select unavailable live offers as current summary best offer', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'out_of_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-18T09:00:00.000Z',
          offer_seed_id: 'seed-coppens',
          price_minor: 17995,
          updated_at: '2026-05-18T09:00:00.000Z',
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
      ],
    });

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['76419'],
      supabaseClient,
    });

    expect(result[0]?.bestOffer).toMatchObject({
      availability: 'in_stock',
      merchantSlug: 'goodbricks',
      priceCents: 19995,
    });
  });

  test('lets strategic manual current offers win on a large price advantage', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      latestOfferRows: [
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T10:00:00.000Z',
          offer_seed_id: 'seed-bol',
          price_minor: 14999,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
        {
          availability: 'in_stock',
          currency_code: 'EUR',
          fetch_status: 'success',
          observed_at: '2026-05-11T10:00:00.000Z',
          offer_seed_id: 'seed-goodbricks',
          price_minor: 19999,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
      ],
      merchantRows: [
        {
          id: 'merchant-bol',
          is_active: true,
          name: 'bol',
          slug: 'bol',
        },
        {
          id: 'merchant-goodbricks',
          is_active: true,
          name: 'Goodbricks',
          slug: 'goodbricks',
        },
      ],
      offerSeedRows: [
        {
          id: 'seed-bol',
          is_active: true,
          merchant_id: 'merchant-bol',
          product_url: 'https://bol.example/42177',
          set_id: '42177',
          validation_status: 'valid',
        },
        {
          id: 'seed-goodbricks',
          is_active: true,
          merchant_id: 'merchant-goodbricks',
          product_url: 'https://goodbricks.example/42177',
          set_id: '42177',
          validation_status: 'valid',
        },
      ],
    });

    const result = await listCatalogCurrentOfferSummariesBySetIds({
      setIds: ['42177'],
      supabaseClient,
    });

    expect(result[0]?.bestOffer).toMatchObject({
      merchantSlug: 'bol',
      priceCents: 14999,
    });
  });

  test('reads canonical catalog sets from the clean catalog_sets table when available', async () => {
    const { from, supabaseClient } = createCatalogOverlaySupabaseClient({
      canonicalRows: [
        createCatalogOverlayRow({
          primary_theme_id: 'theme:star-wars',
          set_id: '75367',
          slug: 'venator-class-republic-attack-cruiser-75367',
          source_theme_id: 'rebrickable:171',
          source_set_number: '75367-1',
          theme: undefined,
        }),
      ],
      overlayRows: [],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:171',
          source_theme_name: 'Star Wars',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:star-wars',
          source_theme_id: 'rebrickable:171',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '75367',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Star Wars',
      setId: '75367',
    });
    expect(from).toHaveBeenCalledWith('catalog_sets');
  });

  test('prefers normalized theme joins for UCS-like canonical reads', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          primary_theme_id: 'theme:star-wars',
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source_theme_id: 'rebrickable:592',
          source_set_number: '75192-1',
          theme: 'Star Wars',
        }),
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

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '75192',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Star Wars',
      secondaryLabels: ['Ultimate Collector Series'],
    });
  });

  test('normalizes persisted derived primary themes like Modular Buildings back onto canonical browse themes', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Natural History Museum',
          primary_theme_id: 'theme:modular-buildings',
          set_id: '10326',
          slug: 'natural-history-museum-10326',
          source_theme_id: 'rebrickable:155',
          source_set_number: '10326-1',
          theme: 'Modular Buildings',
        }),
      ],
      primaryThemeRows: [
        {
          display_name: 'Modular Buildings',
          id: 'theme:modular-buildings',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:155',
          source_theme_name: 'Modular Buildings',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:modular-buildings',
          source_theme_id: 'rebrickable:155',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '10326',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Icons',
      secondaryLabels: ['Modular Buildings'],
    });
  });

  test('parks low-signal persisted theme joins out of the primary browse lane', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Official FIFA World Cup Trophy',
          primary_theme_id: 'theme:editions',
          set_id: '40634',
          slug: 'official-fifa-world-cup-trophy-40634',
          source_theme_id: 'rebrickable:787',
          source_set_number: '40634-1',
          theme: 'Editions',
        }),
      ],
      primaryThemeRows: [
        {
          display_name: 'Editions',
          id: 'theme:editions',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:787',
          source_theme_name: 'Editions',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:editions',
          source_theme_id: 'rebrickable:787',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '40634',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Other',
      secondaryLabels: ['Editions'],
    });
  });

  test('falls back to the legacy theme string when normalized theme ids are absent', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Mario Kart - Mario & Standard Kart',
          primary_theme_id: null,
          set_id: '72037',
          slug: 'mario-kart-mario-standard-kart-72037',
          source_theme_id: null,
          source_set_number: '72037-1',
          theme: 'Super Mario',
        }),
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '72037',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Super Mario',
      secondaryLabels: [],
    });
  });

  test('prefers a Supabase-backed canonical catalog set over snapshot fallback', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Rivendell (Supabase)',
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source_set_number: '10316-1',
          theme: 'Icons',
        }),
      ],
    });

    const canonicalCatalogSets = await listCanonicalCatalogSets({
      supabaseClient,
    });
    const rivendellCatalogSet = canonicalCatalogSets.find(
      (canonicalCatalogSet) => canonicalCatalogSet.setId === '10316',
    );

    expect(rivendellCatalogSet).toMatchObject({
      name: 'Rivendell (Supabase)',
      setId: '10316',
      slug: 'lord-of-the-rings-rivendell-10316',
      source: 'rebrickable',
      sourceSetNumber: '10316-1',
    });
    expect(
      canonicalCatalogSets.filter(
        (canonicalCatalogSet) => canonicalCatalogSet.setId === '10316',
      ),
    ).toHaveLength(1);
  });

  test('returns no canonical set when no Supabase-backed set exists', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '21061',
      supabaseClient: createCatalogOverlaySupabaseClient({
        overlayRows: [],
      }).supabaseClient,
    });

    expect(canonicalCatalogSet).toBeUndefined();
  });

  test('keeps slug lookups stable through the canonical catalog layer', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
      slug: 'great-deku-tree-2-in-1-77092',
      supabaseClient: createCatalogOverlaySupabaseClient({
        overlayRows: [createCatalogOverlayRow()],
      }).supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      name: 'Great Deku Tree 2-in-1',
      primaryTheme: 'The Legend of Zelda',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      source: 'rebrickable',
    });
  });

  test('merges active overlay sets into the admin catalog set list', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          piece_count: 2500,
          release_year: 2024,
          set_id: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          source_set_number: '77092-1',
          status: 'active',
          theme: 'The Legend of Zelda',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));

    const summaries = await listCatalogSetSummariesWithOverlay({
      supabaseClient: { from } as never,
    });

    expect(summaries.some((summary) => summary.id === '77092')).toBe(true);
    expect(summaries.find((summary) => summary.id === '77092')).toMatchObject({
      id: '77092',
      name: 'Great Deku Tree 2-in-1',
      theme: 'The Legend of Zelda',
    });
  });

  test('filters out sets that already exist when searching Rebrickable', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '10316-1',
                name: 'The Lord of the Rings: Rivendell',
                year: 2023,
                num_parts: 6167,
                theme_id: 171,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
              },
              {
                set_num: '77092-1',
                name: 'Great Deku Tree 2-in-1',
                year: 2024,
                num_parts: 2500,
                theme_id: 999,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/171/')) {
        return {
          ok: true,
          json: async () => ({
            id: 171,
            name: 'Icons',
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/999/')) {
        return {
          ok: true,
          json: async () => ({
            id: 999,
            name: 'The Legend of Zelda',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: 'deku',
      supabaseClient: { from } as never,
    });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          setId: '10316',
          theme: 'Icons',
        }),
        expect.objectContaining({
          setId: '77092',
          theme: 'The Legend of Zelda',
        }),
      ]),
    );
  });

  test('filters out sets that already exist in Supabase-backed catalog identity when searching Rebrickable', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [createCatalogOverlayRow()],
    });
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '77092-1',
                name: 'Great Deku Tree 2-in-1',
                year: 2024,
                num_parts: 2500,
                theme_id: 999,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/999/')) {
        return {
          ok: true,
          json: async () => ({
            id: 999,
            name: 'The Legend of Zelda',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: 'deku',
      supabaseClient,
    });

    expect(results).toEqual([]);
  });

  test('falls back to exact Rebrickable set lookup for set-number searches', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/sets/76339-1/')) {
        return {
          ok: true,
          json: async () => ({
            set_num: '76339-1',
            name: 'The Fantastic Four H.E.R.B.I.E.',
            year: 2026,
            num_parts: 0,
            theme_id: 999,
            set_img_url:
              'https://cdn.rebrickable.com/media/sets/76339-1/154089.jpg',
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/999/')) {
        return {
          ok: true,
          json: async () => ({
            id: 999,
            name: 'Marvel',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: '76339-1',
      supabaseClient: { from } as never,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: 'The Fantastic Four H.E.R.B.I.E.',
        setId: '76339',
        sourceSetNumber: '76339-1',
        theme: 'Marvel',
      }),
    ]);
  });

  test('uses the parent theme as the primary theme for search results', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '75192-1',
                name: 'Millennium Falcon',
                year: 2017,
                num_parts: 7541,
                theme_id: 592,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/592/')) {
        return {
          ok: true,
          json: async () => ({
            id: 592,
            name: 'Ultimate Collector Series',
            parent_id: 158,
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/158/')) {
        return {
          ok: true,
          json: async () => ({
            id: 158,
            name: 'Star Wars',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const [result] = await searchCatalogMissingSets({
      fetchImpl,
      query: 'millennium falcon',
      supabaseClient: { from } as never,
    });

    expect(result).toMatchObject({
      setId: '75192',
      theme: 'Star Wars',
    });
  });

  test('skips invalid Rebrickable search rows while normalizing botanical search hits onto Botanicals', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: 'bad-1',
                name: 'Broken search hit',
                year: 2026,
                num_parts: -1,
                theme_id: 171,
              },
              {
                set_num: '10342-1',
                name: 'Pretty Pink Flower Bouquet',
                year: 2025,
                num_parts: 749,
                theme_id: 610,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/10342-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/610/')) {
        return {
          ok: true,
          json: async () => ({
            id: 610,
            name: 'Botanical Collection',
            parent_id: 171,
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/171/')) {
        return {
          ok: true,
          json: async () => ({
            id: 171,
            name: 'Icons',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: '10342-1',
      supabaseClient: { from } as never,
    });

    expect(results).toEqual([
      expect.objectContaining({
        setId: '10342',
        sourceSetNumber: '10342-1',
        theme: 'Botanicals',
      }),
    ]);
  });

  test('lists suggested missing sets with retail-weighted ranking and excludes weak themes', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Downtown Jazz Club',
          piece_count: 2899,
          release_year: 2025,
          set_id: '10350',
          slug: 'downtown-jazz-club-10350',
          source_set_number: '10350-1',
          theme: 'Icons',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      listPayloads: {
        'min_year=2024&ordering=-year%2C-num_parts&page=1&page_size=100': {
          results: [
            {
              set_num: '10350-1',
              name: 'Downtown Jazz Club',
              year: 2025,
              num_parts: 2899,
              theme_id: 171,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/10350-1/1000.jpg',
            },
            {
              set_num: '31162-1',
              name: 'Cute Bunny',
              year: 2026,
              num_parts: 326,
              theme_id: 1,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/31162-1/1000.jpg',
            },
            {
              set_num: '42174-1',
              name: 'Volvo FMX Truck & EC230 Electric Excavator',
              year: 2025,
              num_parts: 2274,
              theme_id: 2,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/42174-1/1000.jpg',
            },
            {
              set_num: '43263-1',
              name: 'Beauty and the Beast Castle',
              year: 2025,
              num_parts: 2916,
              theme_id: 3,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/43263-1/1000.jpg',
            },
            {
              set_num: '50001-1',
              name: 'Pokemon Center',
              year: 2026,
              num_parts: 1200,
              theme_id: 4,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/50001-1/1000.jpg',
            },
          ],
        },
      },
      setPayloads: {},
      themePayloads: {
        '1': {
          id: 1,
          name: 'Creator',
        },
        '2': {
          id: 2,
          name: 'Technic',
        },
        '3': {
          id: 3,
          name: 'Disney',
        },
        '171': {
          id: 171,
          name: 'Icons',
        },
        '4': {
          id: 4,
          name: 'Pokémon',
        },
      },
    });

    const results = await listCatalogSuggestedMissingSets({
      fetchImpl,
      limit: 3,
      nowImpl: () => new Date('2026-04-20T08:00:00.000Z').getTime(),
      supabaseClient,
    });

    expect(results.map((result) => result.setId)).toEqual([
      '42174',
      '43263',
      '31162',
    ]);
    expect(results[0]).toMatchObject({
      confidence: 'high',
      isRetailFriendlyTheme: true,
      score: expect.any(Number),
      setId: '42174',
      theme: 'Technic',
    });
    expect(results[1]).toMatchObject({
      confidence: 'high',
      isRetailFriendlyTheme: true,
      setId: '43263',
      theme: 'Disney',
    });
    expect(results[2]).toMatchObject({
      confidence: 'experimental',
      isRetailFriendlyTheme: false,
      setId: '31162',
      theme: 'Creator',
    });
    expect(results.some((result) => result.theme === 'Pokémon')).toBe(false);
  });

  test('excludes suggested missing sets that already exist by normalized set id or source set number', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Nike Dunk x LEGO',
          set_id: '43020',
          slug: 'nike-dunk-x-lego-43020',
          source_set_number: '43020-1',
        }),
        createCatalogOverlayRow({
          name: 'Known Source Number',
          set_id: '42177',
          slug: 'known-source-number-42177',
          source_set_number: '42177-1',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      listPayloads: {
        'min_year=2024&ordering=-year%2C-num_parts&page=1&page_size=100': {
          results: [
            {
              set_num: '43020-1',
              name: 'Nike Dunk x LEGO',
              year: 2026,
              num_parts: 1180,
              theme_id: 2,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/43020-1/1000.jpg',
            },
            {
              set_num: '42177-1',
              name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
              year: 2024,
              num_parts: 2891,
              theme_id: 2,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/42177-1/1000.jpg',
            },
            {
              set_num: '60488-1',
              name: 'New Unknown City Set',
              year: 2026,
              num_parts: 999,
              theme_id: 52,
              set_img_url:
                'https://cdn.rebrickable.com/media/sets/60488-1/1000.jpg',
            },
          ],
        },
      },
      setPayloads: {},
      themePayloads: {
        '2': {
          id: 2,
          name: 'Technic',
        },
        '52': {
          id: 52,
          name: 'City',
        },
      },
    });

    const results = await listCatalogSuggestedMissingSets({
      fetchImpl,
      limit: 10,
      nowImpl: () => new Date('2026-04-20T08:00:00.000Z').getTime(),
      supabaseClient,
    });

    expect(results.map((result) => result.setId)).toEqual(['60488']);
  });

  test('creates a canonical catalog record with normalized set data', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { canonicalInsert, insert, supabaseClient } =
      createCatalogOverlaySupabaseClient();
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '77092-1': {
          set_num: '77092-1',
          theme_id: 999,
        },
      },
      themePayloads: {
        '999': {
          id: 999,
          name: 'The Legend of Zelda',
        },
      },
    });

    const result = await createCatalogSet({
      fetchImpl,
      input: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
        name: 'Great Deku Tree 2-in-1',
        pieces: 2500,
        releaseYear: 2024,
        setId: '77092',
        slug: 'wrong-slug-will-be-normalized',
        source: 'rebrickable',
        sourceSetNumber: '77092-1',
        theme: 'The Legend of Zelda',
      },
      supabaseClient,
    });

    expect(result.slug).toBe('great-deku-tree-2-in-1-77092');
    expect(canonicalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_theme_id: 'theme:the-legend-of-zelda',
        source_theme_id: 'rebrickable:999',
        slug: 'great-deku-tree-2-in-1-77092',
      }),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  test('creates a catalog set when Rebrickable still reports an unknown piece count', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { canonicalInsert, supabaseClient } =
      createCatalogOverlaySupabaseClient({
        canonicalInsertResult: {
          data: createCatalogOverlayRow({
            image_url:
              'https://cdn.rebrickable.com/media/sets/76339-1/171736.jpg',
            name: 'The Fantastic Four H.E.R.B.I.E.',
            piece_count: 0,
            release_year: 2027,
            set_id: '76339',
            slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
            source_set_number: '76339-1',
            theme: undefined,
          }),
          error: null,
        },
      });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '76339-1': {
          set_num: '76339-1',
          theme_id: 706,
        },
      },
      themePayloads: {
        '706': {
          id: 706,
          name: 'Marvel',
        },
      },
    });

    const result = await createCatalogSet({
      fetchImpl,
      input: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76339-1/171736.jpg',
        name: 'The Fantastic Four H.E.R.B.I.E.',
        pieces: 0,
        releaseYear: 2027,
        setId: '76339',
        slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
        source: 'rebrickable',
        sourceSetNumber: '76339-1',
        theme: 'Marvel',
      },
      supabaseClient,
    });

    expect(result.pieces).toBe(0);
    expect(canonicalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        piece_count: 0,
      }),
    );
  });

  test('updates an existing zero-piece catalog set when an import now has a positive count', async () => {
    const existingCatalogSet = createCatalogOverlayRow({
      piece_count: 0,
      set_id: '76339',
      slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
      source_set_number: '76339-1',
      theme: 'Marvel',
    });
    const { insert, supabaseClient, updateCanonical, updateCanonicalEq } =
      createCatalogOverlaySupabaseClient({
        overlayRows: [existingCatalogSet],
      });

    const result = await createCatalogSet({
      input: {
        imageUrl: existingCatalogSet.image_url ?? undefined,
        name: existingCatalogSet.name,
        pieces: 359,
        releaseYear: existingCatalogSet.release_year,
        setId: existingCatalogSet.set_id,
        slug: existingCatalogSet.slug,
        source: 'rebrickable',
        sourceSetNumber: existingCatalogSet.source_set_number,
        theme: existingCatalogSet.theme,
      },
      supabaseClient,
    });

    expect(result.pieces).toBe(359);
    expect(updateCanonical).toHaveBeenCalledWith(
      expect.objectContaining({
        piece_count: 359,
      }),
    );
    expect(updateCanonicalEq).toHaveBeenCalledWith('set_id', '76339');
    expect(insert).not.toHaveBeenCalled();
  });

  test('does not overwrite an existing positive piece count with zero during import', async () => {
    const existingCatalogSet = createCatalogOverlayRow({
      piece_count: 359,
      set_id: '76339',
      slug: 'the-fantastic-four-h-e-r-b-i-e-76339',
      source_set_number: '76339-1',
      theme: 'Marvel',
    });
    const { insert, supabaseClient, updateCanonical } =
      createCatalogOverlaySupabaseClient({
        overlayRows: [existingCatalogSet],
      });

    await expect(
      createCatalogSet({
        input: {
          imageUrl: existingCatalogSet.image_url ?? undefined,
          name: existingCatalogSet.name,
          pieces: 0,
          releaseYear: existingCatalogSet.release_year,
          setId: existingCatalogSet.set_id,
          slug: existingCatalogSet.slug,
          source: 'rebrickable',
          sourceSetNumber: existingCatalogSet.source_set_number,
          theme: existingCatalogSet.theme,
        },
        supabaseClient,
      }),
    ).rejects.toThrow(/Brickhunt-catalogus/);

    expect(updateCanonical).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  test('refreshes zero-piece catalog sets only when Rebrickable has a positive count', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { supabaseClient, updateCanonical } =
      createCatalogOverlaySupabaseClient({
        overlayRows: [
          createCatalogOverlayRow({
            piece_count: 0,
            set_id: '76339',
            source_set_number: '76339-1',
          }),
          createCatalogOverlayRow({
            piece_count: 0,
            set_id: '11208',
            source_set_number: '11208-1',
          }),
          createCatalogOverlayRow({
            piece_count: 359,
            set_id: '30707',
            source_set_number: '30707-1',
          }),
        ],
      });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '76339-1': {
          set_num: '76339-1',
          name: 'The Fantastic Four H.E.R.B.I.E.',
          year: 2027,
          num_parts: 359,
          theme_id: 706,
          set_img_url:
            'https://cdn.rebrickable.com/media/sets/76339-1/171736.jpg',
        },
        '11208-1': {
          set_num: '11208-1',
          name: 'Team Spidey Pirate Ship',
          year: 2026,
          num_parts: 0,
          theme_id: 755,
          set_img_url:
            'https://cdn.rebrickable.com/media/sets/11208-1/171736.jpg',
        },
      },
      themePayloads: {},
    });

    const result = await refreshZeroPieceSets({
      fetchImpl,
      supabaseClient,
    });

    expect(result).toEqual({
      checkedCount: 2,
      failedCount: 0,
      stillUnknownCount: 1,
      updatedCount: 1,
      updatedSetIds: ['76339'],
    });
    expect(updateCanonical).toHaveBeenCalledWith(
      expect.objectContaining({
        piece_count: 359,
      }),
    );
    expect(updateCanonical).toHaveBeenCalledWith(
      expect.not.objectContaining({
        piece_count: expect.any(Number),
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining('/lego/sets/30707-1/'),
      expect.anything(),
    );
  });

  test('normalizes raw external subthemes to the expected primary theme when creating a canonical catalog set', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { canonicalInsert, supabaseClient } =
      createCatalogOverlaySupabaseClient({
        canonicalInsertResult: {
          data: createCatalogOverlayRow({
            image_url:
              'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
            name: 'Millennium Falcon',
            piece_count: 7541,
            release_year: 2017,
            set_id: '75192',
            slug: 'millennium-falcon-75192',
            source_set_number: '75192-1',
            theme: undefined,
          }),
          error: null,
        },
      });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '75192-1': {
          set_num: '75192-1',
          theme_id: 592,
        },
      },
      themePayloads: {
        '592': {
          id: 592,
          name: 'Ultimate Collector Series',
          parent_id: 158,
        },
        '158': {
          id: 158,
          name: 'Star Wars',
        },
      },
    });

    const result = await createCatalogSet({
      fetchImpl,
      input: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
        name: 'Millennium Falcon',
        pieces: 7541,
        releaseYear: 2017,
        setId: '75192',
        slug: 'millennium-falcon-75192',
        source: 'rebrickable',
        sourceSetNumber: '75192-1',
        theme: 'Ultimate Collector Series',
      },
      supabaseClient,
    });

    expect(result.theme).toBe('Star Wars');
    expect(canonicalInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_theme_id: 'theme:star-wars',
        source_theme_id: 'rebrickable:592',
      }),
    );
  });

  test('backfills a UCS-like source theme to Star Wars while keeping the legacy theme column intact', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const {
      primaryThemeUpsert,
      sourceThemeUpsert,
      supabaseClient,
      themeMappingUpsert,
      update,
      updateCanonical,
      updateCanonicalEq,
    } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source_set_number: '75192-1',
          theme: 'Star Wars',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '75192-1': {
          set_num: '75192-1',
          theme_id: 592,
        },
      },
      themePayloads: {
        '592': {
          id: 592,
          name: 'Ultimate Collector Series',
          parent_id: 158,
        },
        '158': {
          id: 158,
          name: 'Star Wars',
        },
      },
    });

    const result = await backfillCatalogOverlayThemeIdentity({
      fetchImpl,
      supabaseClient,
    });

    expect(result).toEqual({
      processedCount: 1,
      skippedCount: 0,
      updatedCount: 1,
    });
    expect(sourceThemeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rebrickable:592',
        parent_source_theme_id: 'rebrickable:158',
        source_system: 'rebrickable',
        source_theme_name: 'Ultimate Collector Series',
      }),
      {
        onConflict: 'id',
      },
    );
    expect(primaryThemeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Star Wars',
        id: 'theme:star-wars',
        slug: 'star-wars',
      }),
      {
        onConflict: 'id',
      },
    );
    expect(themeMappingUpsert).toHaveBeenCalledWith(
      {
        primary_theme_id: 'theme:star-wars',
        source_theme_id: 'rebrickable:592',
      },
      {
        onConflict: 'source_theme_id',
      },
    );
    expect(updateCanonical).toHaveBeenCalledWith({
      primary_theme_id: 'theme:star-wars',
      source_theme_id: 'rebrickable:592',
    });
    expect(updateCanonicalEq).toHaveBeenCalledWith('set_id', '75192');
    expect(update).not.toHaveBeenCalled();
  });

  test('backfills direct source themes without changing the legacy theme string', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { supabaseClient, update, updateCanonical } =
      createCatalogOverlaySupabaseClient({
        overlayRows: [
          createCatalogOverlayRow({
            set_id: '72037',
            slug: 'mario-kart-mario-standard-kart-72037',
            source_set_number: '72037-1',
            theme: 'Super Mario',
          }),
        ],
      });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '72037-1': {
          set_num: '72037-1',
          theme_id: 696,
        },
      },
      themePayloads: {
        '696': {
          id: 696,
          name: 'Super Mario',
        },
      },
    });

    await backfillCatalogOverlayThemeIdentity({
      fetchImpl,
      supabaseClient,
    });

    expect(updateCanonical).toHaveBeenCalledWith({
      primary_theme_id: 'theme:super-mario',
      source_theme_id: 'rebrickable:696',
    });
    expect(update).not.toHaveBeenCalled();
    expect(updateCanonical).not.toHaveBeenCalledWith(
      expect.objectContaining({
        theme: expect.anything(),
      }),
    );
  });

  test('reprocesses explicitly scoped rows so a legacy Spider-Man primary theme row is corrected to Marvel', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const {
      primaryThemeUpsert,
      supabaseClient,
      themeMappingUpsert,
      update,
      updateCanonical,
      updateCanonicalEq,
    } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Team Spidey Pirate Ship',
          primary_theme_id: 'theme:marvel',
          set_id: '11208',
          slug: 'team-spidey-pirate-ship-11208',
          source_theme_id: 'rebrickable:755',
          source_set_number: '11208-1',
          theme: 'Spider-Man',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '11208-1': {
          set_num: '11208-1',
          theme_id: 755,
        },
      },
      themePayloads: {
        '755': {
          id: 755,
          name: 'Spidey and His Amazing Friends',
          parent_id: 706,
        },
        '706': {
          id: 706,
          name: 'Spider-Man',
        },
      },
    });

    const result = await backfillCatalogOverlayThemeIdentity({
      fetchImpl,
      setIds: ['11208'],
      supabaseClient,
    });

    expect(result).toEqual({
      processedCount: 1,
      skippedCount: 0,
      updatedCount: 1,
    });
    expect(primaryThemeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Marvel',
        id: 'theme:marvel',
        slug: 'marvel',
      }),
      {
        onConflict: 'id',
      },
    );
    expect(themeMappingUpsert).toHaveBeenCalledWith(
      {
        primary_theme_id: 'theme:marvel',
        source_theme_id: 'rebrickable:755',
      },
      {
        onConflict: 'source_theme_id',
      },
    );
    expect(updateCanonical).toHaveBeenCalledWith({
      primary_theme_id: 'theme:marvel',
      source_theme_id: 'rebrickable:755',
    });
    expect(updateCanonicalEq).toHaveBeenCalledWith('set_id', '11208');
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects adding a set when the set_id already exists in the canonical catalog', async () => {
    const existingCatalogSet = createCatalogOverlayRow({
      name: 'Rivendell',
      set_id: '10316',
      slug: 'rivendell-10316',
      source_set_number: '10316-1',
      theme: 'Icons',
    });
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [existingCatalogSet],
    });

    await expect(
      createCatalogSet({
        input: {
          imageUrl: existingCatalogSet.image_url ?? undefined,
          name: existingCatalogSet.name,
          pieces: existingCatalogSet.piece_count,
          releaseYear: existingCatalogSet.release_year,
          setId: existingCatalogSet.set_id,
          slug: existingCatalogSet.slug,
          source: 'rebrickable',
          sourceSetNumber: existingCatalogSet.source_set_number,
          theme: existingCatalogSet.theme,
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      new RegExp(
        `Set ${existingCatalogSet.set_id} staat al in de Brickhunt-catalogus`,
      ),
    );

    expect(insert).not.toHaveBeenCalled();
  });

  test('rejects adding a set when the set_id already exists in the current canonical catalog state', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [createCatalogOverlayRow()],
    });

    await expect(
      createCatalogSet({
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(/Brickhunt-catalogus/);

    expect(insert).not.toHaveBeenCalled();
  });

  test('rejects adding a set when the generated slug already exists in the current canonical catalog state', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Andere Deku Tree',
          set_id: '88000',
          source_set_number: '88000-1',
          slug: 'great-deku-tree-2-in-1-77092',
        }),
      ],
    });

    await expect(
      createCatalogSet({
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      /slug "great-deku-tree-2-in-1-77092" al gebruikt wordt door Andere Deku Tree \(88000\)/,
    );

    expect(insert).not.toHaveBeenCalled();
  });

  test('translates database slug conflicts into an operator-friendly error message', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      canonicalInsertResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "catalog_sets_slug_key"',
        },
      },
    });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '77092-1': {
          set_num: '77092-1',
          theme_id: 999,
        },
      },
      themePayloads: {
        '999': {
          id: 999,
          name: 'The Legend of Zelda',
        },
      },
    });

    await expect(
      createCatalogSet({
        fetchImpl,
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      /slug "great-deku-tree-2-in-1-77092" al in Brickhunt gebruikt wordt/,
    );
  });

  test('resolves an active overlay set by slug for the public set page', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          slug: 'great-deku-tree-2-in-1-77092',
        }),
      ],
    });

    const result = await getCatalogSetBySlugWithOverlay({
      slug: 'great-deku-tree-2-in-1-77092',
      supabaseClient,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: '77092',
        name: 'Great Deku Tree 2-in-1',
        theme: 'The Legend of Zelda',
      }),
    );
  });
});
