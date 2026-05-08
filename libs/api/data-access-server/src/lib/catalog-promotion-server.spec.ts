import { describe, expect, test, vi } from 'vitest';
import { promoteCatalogFromStagingToProduction } from './catalog-promotion-server';

function createSelectBuilder(rows: readonly Record<string, unknown>[]) {
  let rangeStart = 0;
  let rangeEnd = 999;
  const builder = {
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeStart = from;
      rangeEnd = to;

      return builder;
    }),
    select: vi.fn(() => builder),
    then<TResult1 = { data: Record<string, unknown>[]; error: null }>(
      onFulfilled?:
        | ((value: {
            data: Record<string, unknown>[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      return Promise.resolve({
        data: rows.slice(rangeStart, rangeEnd + 1),
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createProductionMerchantRowsWithTargetAtRow1001() {
  return [
    ...Array.from({ length: 1000 }, (_, index) => ({
      id: `production-merchant-${index}`,
      slug: `merchant-${index}`,
    })),
    {
      id: 'production-merchant-bol',
      slug: 'bol',
    },
  ];
}

function createProductionOfferSeedRowsWithTargetAtRow1001() {
  return [
    ...Array.from({ length: 1000 }, (_, index) => ({
      id: `production-seed-${index}`,
      merchant_id: `production-merchant-${index}`,
      set_id: String(30_000 + index),
    })),
    {
      id: 'production-seed-bol-rivendell',
      merchant_id: 'production-merchant-bol',
      set_id: '10316',
    },
  ];
}

function createCatalogSetRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const setNumber = String(30_000 + index);

    return {
      created_at: '2026-04-21T08:00:00.000Z',
      image_url: null,
      name: `Catalog Set ${setNumber}`,
      piece_count: 100 + index,
      primary_theme_id: 'icons',
      release_year: 2026,
      set_id: setNumber,
      slug: `catalog-set-${setNumber}`,
      source: 'rebrickable',
      source_set_number: `${setNumber}-1`,
      source_theme_id: 'rebrickable-theme-icons',
      status: 'active',
      updated_at: '2026-04-21T08:00:00.000Z',
    };
  });
}

function createOfferSeedRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const setNumber = String(30_000 + index);

    return {
      created_at: '2026-04-21T08:00:00.000Z',
      id: `staging-seed-${setNumber}`,
      is_active: true,
      last_verified_at: '2026-04-21T08:00:00.000Z',
      merchant_id: 'staging-merchant-bol',
      notes: '',
      product_url: `https://www.bol.com/nl/nl/p/lego-${setNumber}`,
      set_id: setNumber,
      updated_at: '2026-04-21T08:00:00.000Z',
      validation_status: 'valid',
    };
  });
}

function createPromotionSupabaseClient({
  rowsByTable,
}: {
  rowsByTable: Record<string, readonly Record<string, unknown>[]>;
}) {
  const upsertByTable = new Map<string, ReturnType<typeof vi.fn>>();
  const from = vi.fn((table: string) => {
    const rows = rowsByTable[table] ?? [];
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });

    upsertByTable.set(table, upsert);

    return {
      select: vi.fn(() => createSelectBuilder(rows)),
      upsert,
    };
  });

  return {
    from,
    upsertByTable,
  };
}

describe('catalog promotion server', () => {
  test('upserts merchants by slug and offer seeds by set plus merchant without overwriting production ids', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'rebrickable-theme-icons',
            parent_source_theme_id: null,
            source_system: 'rebrickable',
            source_theme_name: 'Icons',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Icons',
            id: 'icons',
            slug: 'icons',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            primary_theme_id: 'icons',
            source_theme_id: 'rebrickable-theme-icons',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: null,
            name: 'Rivendell',
            piece_count: 6167,
            primary_theme_id: 'icons',
            release_year: 2023,
            set_id: '10316',
            slug: 'lord-of-the-rings-rivendell-10316',
            source: 'rebrickable',
            source_set_number: '10316-1',
            source_theme_id: 'rebrickable-theme-icons',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_merchants: [
          {
            affiliate_network: null,
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'staging-merchant-bol',
            is_active: true,
            name: 'bol',
            notes: '',
            slug: 'bol',
            source_type: 'direct',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_benchmark_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            notes: '',
            set_id: '10316',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_offer_seeds: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'staging-seed-bol-rivendell',
            is_active: true,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: '',
            product_url:
              'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
            set_id: '10316',
            updated_at: '2026-04-21T08:00:00.000Z',
            validation_status: 'valid',
          },
        ],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        commerce_merchants: [
          {
            id: 'production-merchant-bol',
            slug: 'bol',
          },
        ],
        commerce_offer_seeds: [
          {
            id: 'production-seed-bol-rivendell',
            merchant_id: 'production-merchant-bol',
            set_id: '10316',
          },
        ],
      },
    });

    const result = await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });

    expect(result.status).toBe('ok');
    expect(result.tables.catalog_sets).toEqual({
      insertedCount: 1,
      readCount: 1,
      updatedCount: 0,
      upsertedCount: 1,
    });
    expect(result.tables.commerce_merchants).toEqual({
      insertedCount: 0,
      readCount: 1,
      updatedCount: 1,
      upsertedCount: 1,
    });
    expect(result.tables.commerce_offer_seeds).toEqual({
      insertedCount: 0,
      readCount: 1,
      updatedCount: 1,
      upsertedCount: 1,
    });
    expect(
      productionClient.upsertByTable.get('commerce_merchants'),
    ).toHaveBeenCalledWith(
      [
        {
          affiliate_network: null,
          name: 'bol',
          slug: 'bol',
          source_type: 'direct',
        },
      ],
      {
        onConflict: 'slug',
      },
    );
    expect(
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        {
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
          set_id: '10316',
        },
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('paginates production merchant and offer seed mapping lookups beyond row 1000', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [
          {
            affiliate_network: null,
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'staging-merchant-bol',
            is_active: true,
            name: 'bol',
            notes: '',
            slug: 'bol',
            source_type: 'direct',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'staging-seed-bol-rivendell',
            is_active: true,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: '',
            product_url:
              'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
            set_id: '10316',
            updated_at: '2026-04-21T08:00:00.000Z',
            validation_status: 'valid',
          },
        ],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        commerce_merchants: createProductionMerchantRowsWithTargetAtRow1001(),
        commerce_offer_seeds:
          createProductionOfferSeedRowsWithTargetAtRow1001(),
      },
    });

    const result = await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });

    expect(result.tables.commerce_merchants.updatedCount).toBe(1);
    expect(result.tables.commerce_offer_seeds.updatedCount).toBe(1);
    expect(
      productionClient.upsertByTable.get('commerce_merchants'),
    ).toHaveBeenCalledWith(
      [
        {
          affiliate_network: null,
          name: 'bol',
          slug: 'bol',
          source_type: 'direct',
        },
      ],
      {
        onConflict: 'slug',
      },
    );
    expect(
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        {
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
          set_id: '10316',
        },
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('does not overwrite protected catalog set fields during promotion updates', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: 'https://cdn.example.com/staging.jpg',
            name: 'Rivendell staging',
            piece_count: 6167,
            primary_theme_id: 'icons',
            release_year: 2023,
            set_id: '10316',
            slug: 'staging-rivendell-10316',
            source: 'rebrickable',
            source_set_number: '10316-1',
            source_theme_id: 'rebrickable-theme-icons',
            status: 'inactive',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_sets: [
          {
            set_id: '10316',
          },
        ],
      },
    });

    await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });

    expect(
      productionClient.upsertByTable.get('catalog_sets'),
    ).toHaveBeenCalledWith(
      [
        {
          image_url: 'https://cdn.example.com/staging.jpg',
          name: 'Rivendell staging',
          piece_count: 6167,
          primary_theme_id: 'icons',
          release_year: 2023,
          set_id: '10316',
          source: 'rebrickable',
          source_set_number: '10316-1',
          source_theme_id: 'rebrickable-theme-icons',
        },
      ],
      {
        onConflict: 'set_id',
      },
    );
  });

  test('paginates staging catalog set and offer seed reads beyond row 1000', async () => {
    const stagingCatalogSets = createCatalogSetRows(1001);
    const stagingOfferSeeds = createOfferSeedRows(1001);
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: stagingCatalogSets,
        commerce_merchants: [
          {
            affiliate_network: null,
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'staging-merchant-bol',
            is_active: true,
            name: 'bol',
            notes: '',
            slug: 'bol',
            source_type: 'direct',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: stagingOfferSeeds,
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        commerce_merchants: [
          {
            id: 'production-merchant-bol',
            slug: 'bol',
          },
        ],
      },
    });

    const result = await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });
    const catalogSetUpserts =
      productionClient.upsertByTable.get('catalog_sets')?.mock.calls ?? [];
    const offerSeedUpserts =
      productionClient.upsertByTable.get('commerce_offer_seeds')?.mock.calls ??
      [];
    const promotedCatalogSets = catalogSetUpserts.flatMap(
      ([rows]) => rows as Array<Record<string, unknown>>,
    );
    const promotedOfferSeeds = offerSeedUpserts.flatMap(
      ([rows]) => rows as Array<Record<string, unknown>>,
    );

    expect(result.tables.catalog_sets.readCount).toBe(1001);
    expect(result.tables.commerce_offer_seeds.readCount).toBe(1001);
    expect(promotedCatalogSets).toContainEqual(
      expect.objectContaining({
        set_id: '31000',
        source_set_number: '31000-1',
      }),
    );
    expect(promotedOfferSeeds).toContainEqual(
      expect.objectContaining({
        id: 'staging-seed-31000',
        merchant_id: 'production-merchant-bol',
        set_id: '31000',
      }),
    );
  });

  test('aborts when default-cap-sized staging reads would make promotion ambiguous', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: createCatalogSetRows(1000),
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
    });

    await expect(
      promoteCatalogFromStagingToProduction({
        createProductionSupabaseClient: () => productionClient as never,
        createStagingSupabaseClient: () => stagingClient as never,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
          .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
      }),
    ).rejects.toThrow(
      "Catalog promotion read for catalog_sets returned exactly 1000 rows. This table is expected to exceed Supabase's default cap",
    );
  });
});
