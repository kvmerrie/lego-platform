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
  rpcResult = { data: null, error: null },
  rowsByTable,
}: {
  rpcResult?: {
    data: unknown;
    error: { message: string } | null;
  };
  rowsByTable: Record<string, readonly Record<string, unknown>[]>;
}) {
  const upsertByTable = new Map<string, ReturnType<typeof vi.fn>>();
  const rpc = vi.fn().mockResolvedValue(rpcResult);
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
    rpc,
    upsertByTable,
  };
}

describe('catalog promotion server', () => {
  test('upserts merchants by slug and offer seeds by set plus merchant without overwriting production ids', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Keep promotion diagnostics out of the test output.
    });
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
        catalog_set_minifig_summaries: [
          {
            created_at: '2026-05-14T10:00:00.000Z',
            minifig_count: 15,
            set_id: '10316',
            source_minifig_count: 15,
            source_system: 'rebrickable',
            synced_at: '2026-05-14T10:00:00.000Z',
            updated_at: '2026-05-14T10:00:00.000Z',
          },
        ],
        catalog_set_source_metadata: [
          {
            catalog_set_id: '10316',
            last_seen_at: '2026-05-26T08:00:00.000Z',
            locale: 'nl-NL',
            match_confidence: 'exact_set_number',
            metadata_json: {
              description: 'Bouw Rivendell met de Council of Elrond.',
              gtin: '5702017417835',
              imageUrl: 'https://www.lego.com/cdn/10316.png',
              priceSourceSeen: true,
              title: 'Rivendel',
            },
            policy: 'metadata_only_pending_audit',
            set_number: '10316',
            source: 'rakuten-lego-eu',
          },
          {
            catalog_set_id: '10316',
            last_seen_at: '2026-05-27T08:00:00.000Z',
            locale: 'en-US',
            match_confidence: 'exact_set_number',
            metadata_json: {
              bricksetSetId: 12345,
              imageRightsPolicy: 'render_publicly_with_attribution',
              images: [
                {
                  attributionRequired: true,
                  imageUrl:
                    'https://images.brickset.com/sets/images/10316-1.jpg',
                  type: 'primary',
                },
              ],
              pieces: 6167,
              theme: 'Icons',
            },
            policy: 'render_publicly_with_attribution',
            set_number: '10316',
            source: 'brickset',
          },
          {
            catalog_set_id: '10316',
            last_seen_at: '2026-05-27T08:00:00.000Z',
            locale: 'en-US',
            match_confidence: 'exact_set_number',
            metadata_json: {
              title: 'Should not promote',
            },
            policy: 'metadata_only_pending_audit',
            set_number: '10316',
            source: 'other-source',
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
    expect(result.tables.catalog_set_minifig_summaries).toEqual({
      insertedCount: 1,
      readCount: 1,
      updatedCount: 0,
      upsertedCount: 1,
    });
    expect(result.tables.catalog_set_source_metadata).toEqual({
      insertedCount: 2,
      readCount: 2,
      updatedCount: 0,
      upsertedCount: 2,
    });
    expect(result.brickset_source_metadata_promoted_count).toBe(1);
    expect(result.bricksetSourceMetadataPromotedCount).toBe(1);
    expect(result.rakuten_source_metadata_promoted_count).toBe(1);
    expect(result.rakutenSourceMetadataPromotedCount).toBe(1);
    expect(result.source_metadata_eligible_count).toBe(2);
    expect(result.sourceMetadataEligibleCount).toBe(2);
    expect(result.source_metadata_read_count).toBe(3);
    expect(result.sourceMetadataReadCount).toBe(3);
    expect(result.skipped_source_metadata_count).toBe(1);
    expect(result.skippedSourceMetadataCount).toBe(1);
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
    expect(productionClient.rpc).toHaveBeenCalledTimes(1);
    expect(productionClient.rpc).toHaveBeenCalledWith(
      'refresh_catalog_theme_summaries',
    );
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
      productionClient.upsertByTable.get('catalog_set_minifig_summaries'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-05-14T10:00:00.000Z',
          minifig_count: 15,
          set_id: '10316',
          source_minifig_count: 15,
          source_system: 'rebrickable',
          synced_at: '2026-05-14T10:00:00.000Z',
          updated_at: '2026-05-14T10:00:00.000Z',
        },
      ],
      {
        onConflict: 'set_id',
      },
    );
    expect(
      productionClient.upsertByTable.get('catalog_set_source_metadata'),
    ).toHaveBeenCalledWith(
      [
        {
          catalog_set_id: '10316',
          last_seen_at: '2026-05-26T08:00:00.000Z',
          locale: 'nl-NL',
          match_confidence: 'exact_set_number',
          metadata_json: {
            description: 'Bouw Rivendell met de Council of Elrond.',
            gtin: '5702017417835',
            imageUrl: 'https://www.lego.com/cdn/10316.png',
            priceSourceSeen: true,
            title: 'Rivendel',
          },
          policy: 'metadata_only_pending_audit',
          set_number: '10316',
          source: 'rakuten-lego-eu',
        },
        {
          catalog_set_id: '10316',
          last_seen_at: '2026-05-27T08:00:00.000Z',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            bricksetSetId: 12345,
            imageRightsPolicy: 'render_publicly_with_attribution',
            images: [
              {
                attributionRequired: true,
                imageUrl: 'https://images.brickset.com/sets/images/10316-1.jpg',
                type: 'primary',
              },
            ],
            pieces: 6167,
            theme: 'Icons',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '10316',
          source: 'brickset',
        },
      ],
      {
        onConflict: 'catalog_set_id,source,locale',
      },
    );
    expect(
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'production-seed-bol-rivendell',
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
          set_id: '10316',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[catalog-promotion] promote_metadata_rows_copied',
      expect.objectContaining({
        brickset_source_metadata_promoted_count: 1,
        promote_metadata_rows_copied: 2,
        rakuten_source_metadata_promoted_count: 1,
        source_metadata_eligible_count: 2,
        source_metadata_read_count: 3,
        skipped_source_metadata_count: 1,
        table: 'catalog_set_source_metadata',
      }),
    );
    consoleInfoSpy.mockRestore();
  });

  test('refreshes catalog theme summaries once after successful catalog promotion writes', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Technic',
            id: 'technic',
            is_public: true,
            public_accent_color: null,
            public_description: null,
            public_display_name: null,
            public_image_url: null,
            public_logo_url: null,
            public_order: 1,
            slug: 'technic',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: 'https://cdn.example.com/42177.jpg',
            name: 'Mercedes-Benz G 500 Professional Line',
            piece_count: 2891,
            primary_theme_id: 'technic',
            release_year: 2024,
            set_id: '42177',
            slug: 'mercedes-benz-g-500-professional-line-42177',
            source: 'rebrickable',
            source_set_number: '42177-1',
            source_theme_id: 'rebrickable-theme-technic',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
    });

    await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
    });

    expect(productionClient.rpc).toHaveBeenCalledTimes(1);
    expect(productionClient.rpc).toHaveBeenCalledWith(
      'refresh_catalog_theme_summaries',
    );
  });

  test('promotes paginated Brickset source metadata beyond the first Supabase page', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Keep promotion diagnostics out of the test output.
    });
    const bricksetMetadataRows = Array.from({ length: 1001 }, (_, index) => {
      const setId = String(30_000 + index);

      return {
        catalog_set_id: setId,
        last_seen_at: '2026-05-27T08:00:00.000Z',
        locale: 'en-US',
        match_confidence: 'exact_set_number',
        metadata_json: {
          bricksetSetId: 100_000 + index,
          sourceSeen: true,
        },
        policy: 'render_publicly_with_attribution',
        set_number: setId,
        source: 'brickset',
      };
    });
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_set_source_metadata: bricksetMetadataRows,
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
    });

    const result = await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
    });

    expect(result.tables.catalog_set_source_metadata).toEqual({
      insertedCount: 1001,
      readCount: 1001,
      updatedCount: 0,
      upsertedCount: 1001,
    });
    expect(result.brickset_source_metadata_promoted_count).toBe(1001);
    expect(result.bricksetSourceMetadataPromotedCount).toBe(1001);
    expect(result.rakuten_source_metadata_promoted_count).toBe(0);
    expect(result.rakutenSourceMetadataPromotedCount).toBe(0);
    expect(result.source_metadata_eligible_count).toBe(1001);
    expect(result.sourceMetadataEligibleCount).toBe(1001);
    expect(result.source_metadata_read_count).toBe(1001);
    expect(result.sourceMetadataReadCount).toBe(1001);
    expect(result.skipped_source_metadata_count).toBe(0);
    expect(result.skippedSourceMetadataCount).toBe(0);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[catalog-promotion] promote_metadata_rows_copied',
      expect.objectContaining({
        brickset_source_metadata_promoted_count: 1001,
        rakuten_source_metadata_promoted_count: 0,
        source_metadata_eligible_count: 1001,
        source_metadata_read_count: 1001,
      }),
    );
    consoleInfoSpy.mockRestore();
  });

  test('defaults null catalog source theme timestamps before production upsert', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Keep promotion diagnostics out of the test output.
    });
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [
          {
            created_at: null,
            id: 'rebrickable:1',
            parent_source_theme_id: null,
            source_system: 'rebrickable',
            source_theme_name: 'Technic',
            updated_at: null,
          },
          {
            created_at: '2026-04-21T08:00:00.000Z',
            id: 'rebrickable:2',
            parent_source_theme_id: null,
            source_system: 'rebrickable',
            source_theme_name: 'Space',
            updated_at: '2026-04-21T08:05:00.000Z',
          },
        ],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
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
      productionClient.upsertByTable.get('catalog_source_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-22T09:00:00.000Z',
          id: 'rebrickable:1',
          parent_source_theme_id: null,
          source_system: 'rebrickable',
          source_theme_name: 'Technic',
          updated_at: '2026-04-22T09:00:00.000Z',
        },
        {
          created_at: '2026-04-21T08:00:00.000Z',
          id: 'rebrickable:2',
          parent_source_theme_id: null,
          source_system: 'rebrickable',
          source_theme_name: 'Space',
          updated_at: '2026-04-21T08:05:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[catalog-promotion] timestamp upsert payload sanitized',
      expect.objectContaining({
        inputRows: 2,
        nullCreatedAtAfterSanitize: 0,
        nullCreatedAtBeforeSanitize: 0,
        nullUpdatedAtAfterSanitize: 0,
        nullUpdatedAtBeforeSanitize: 0,
        table: 'catalog_source_themes',
      }),
    );

    consoleInfoSpy.mockRestore();
  });

  test('does not send explicit null timestamps for other promoted timestamped tables', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [
          {
            created_at: null,
            primary_theme_id: 'technic',
            source_theme_id: 'rebrickable:1',
            updated_at: null,
          },
        ],
        catalog_sets: [
          {
            created_at: null,
            image_url: null,
            name: 'Mercedes-Benz G 500 Professional Line',
            piece_count: 2891,
            primary_theme_id: 'technic',
            release_year: 2024,
            set_id: '42177',
            slug: 'mercedes-benz-g-500-professional-line-42177',
            source: 'rebrickable',
            source_set_number: '42177-1',
            source_theme_id: 'rebrickable:1',
            status: 'active',
            updated_at: null,
          },
        ],
        commerce_merchants: [
          {
            affiliate_network: null,
            created_at: null,
            id: 'merchant-goodbricks',
            is_active: true,
            name: 'Goodbricks',
            notes: '',
            slug: 'goodbricks',
            source_type: 'affiliate_feed',
            updated_at: null,
          },
        ],
        commerce_benchmark_sets: [
          {
            created_at: null,
            notes: '',
            set_id: '42177',
            updated_at: null,
          },
        ],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
    });

    await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });

    for (const table of [
      'catalog_theme_mappings',
      'catalog_sets',
      'commerce_merchants',
      'commerce_benchmark_sets',
    ]) {
      const payload = productionClient.upsertByTable.get(table)?.mock
        .calls[0]?.[0] as Array<{
        created_at?: unknown;
        updated_at?: unknown;
      }>;

      expect(payload).toEqual([
        expect.objectContaining({
          created_at: '2026-04-22T09:00:00.000Z',
          updated_at: '2026-04-22T09:00:00.000Z',
        }),
      ]);
    }
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
        expect.objectContaining({
          id: 'production-seed-bol-rivendell',
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
          set_id: '10316',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('promotes new offer seeds with valid staging ids', async () => {
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
            id: 'staging-seed-bol-millennium-falcon',
            is_active: true,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: '',
            product_url:
              'https://www.bol.com/nl/nl/p/lego-millennium-falcon/9300000145678',
            set_id: '75192',
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
        commerce_offer_seeds: [],
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
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'staging-seed-bol-millennium-falcon',
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-millennium-falcon/9300000145678',
          set_id: '75192',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('preserves production offer seed ids when staging ids are missing', async () => {
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
            id: null,
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

    await promoteCatalogFromStagingToProduction({
      createProductionSupabaseClient: () => productionClient as never,
      createStagingSupabaseClient: () => stagingClient as never,
      now: vi
        .fn()
        .mockReturnValueOnce(new Date('2026-04-22T09:00:00.000Z'))
        .mockReturnValue(new Date('2026-04-22T09:00:01.250Z')),
    });

    expect(
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'production-seed-bol-rivendell',
          merchant_id: 'production-merchant-bol',
          product_url:
            'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
          set_id: '10316',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('preserves production offer seed required fields when staging values are null', async () => {
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
            created_at: null,
            id: null,
            is_active: null,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: null,
            product_url:
              'https://www.bol.com/nl/nl/p/lego-rivendell/9300000141234',
            set_id: '10316',
            updated_at: null,
            validation_status: null,
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
            created_at: '2026-04-20T08:00:00.000Z',
            id: 'production-seed-bol-rivendell',
            is_active: false,
            merchant_id: 'production-merchant-bol',
            notes: 'Keep production note',
            set_id: '10316',
            updated_at: '2026-04-20T09:00:00.000Z',
            validation_status: 'stale',
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
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          created_at: '2026-04-20T08:00:00.000Z',
          id: 'production-seed-bol-rivendell',
          is_active: false,
          merchant_id: 'production-merchant-bol',
          notes: 'Keep production note',
          set_id: '10316',
          updated_at: '2026-04-20T09:00:00.000Z',
          validation_status: 'stale',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('derives schema defaults for new offer seed required fields when staging values are null', async () => {
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
            created_at: null,
            id: 'staging-seed-bol-millennium-falcon',
            is_active: null,
            last_verified_at: null,
            merchant_id: 'staging-merchant-bol',
            notes: null,
            product_url:
              'https://www.bol.com/nl/nl/p/lego-millennium-falcon/9300000145678',
            set_id: '75192',
            updated_at: null,
            validation_status: null,
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
        commerce_offer_seeds: [],
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
      productionClient.upsertByTable.get('commerce_offer_seeds'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          created_at: '2026-04-22T09:00:00.000Z',
          id: 'staging-seed-bol-millennium-falcon',
          is_active: true,
          merchant_id: 'production-merchant-bol',
          notes: '',
          set_id: '75192',
          updated_at: '2026-04-22T09:00:00.000Z',
          validation_status: 'pending',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });

  test('rejects new offer seeds without ids before any promotion writes', async () => {
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
            id: null,
            is_active: true,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: '',
            product_url:
              'https://www.bol.com/nl/nl/p/lego-millennium-falcon/9300000145678',
            set_id: '75192',
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
        commerce_offer_seeds: [],
      },
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
      'Unable to promote commerce_offer_seeds. Required column id is missing for new row set_id=75192, merchant_id=production-merchant-bol.',
    );
    expect(
      Array.from(productionClient.upsertByTable.values()).some(
        (upsert) => upsert.mock.calls.length > 0,
      ),
    ).toBe(false);
  });

  test('does not partially write catalog tables when offer seed validation fails', async () => {
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
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            id: null,
            is_active: true,
            last_verified_at: '2026-04-21T08:00:00.000Z',
            merchant_id: 'staging-merchant-bol',
            notes: '',
            product_url:
              'https://www.bol.com/nl/nl/p/lego-millennium-falcon/9300000145678',
            set_id: '75192',
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
        commerce_offer_seeds: [],
      },
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
    ).rejects.toThrow('Unable to promote commerce_offer_seeds');
    expect(
      Array.from(productionClient.upsertByTable.values()).some(
        (upsert) => upsert.mock.calls.length > 0,
      ),
    ).toBe(false);
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
      {
        onConflict: 'set_id',
      },
    );
  });

  test('derives missing catalog set slugs before promotion writes', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: 'https://cdn.example.com/at-at.jpg',
            name: 'AT-AT',
            piece_count: 1555,
            primary_theme_id: 'star-wars',
            release_year: 2025,
            set_id: '75440',
            slug: null,
            source: 'rebrickable',
            source_set_number: '75440-1',
            source_theme_id: 'rebrickable-theme-star-wars',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
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
        expect.objectContaining({
          name: 'AT-AT',
          set_id: '75440',
          slug: 'at-at-75440',
          source_set_number: '75440-1',
          status: 'active',
        }),
      ],
      {
        onConflict: 'set_id',
      },
    );
  });

  test('preserves catalog set status and normalizes null or missing status to active', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Keep promotion diagnostics out of the test output.
    });
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: null,
            name: 'Active Set',
            piece_count: 100,
            primary_theme_id: 'icons',
            release_year: 2026,
            set_id: '10000',
            slug: 'active-set-10000',
            source: 'rebrickable',
            source_set_number: '10000-1',
            source_theme_id: 'rebrickable-theme-icons',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
          {
            created_at: '2026-04-21T08:01:00.000Z',
            image_url: null,
            name: 'Inactive Set',
            piece_count: 101,
            primary_theme_id: 'icons',
            release_year: 2026,
            set_id: '10001',
            slug: 'inactive-set-10001',
            source: 'rebrickable',
            source_set_number: '10001-1',
            source_theme_id: 'rebrickable-theme-icons',
            status: 'inactive',
            updated_at: '2026-04-21T08:01:00.000Z',
          },
          {
            created_at: '2026-04-21T08:02:00.000Z',
            image_url: null,
            name: 'Null Status Set',
            piece_count: 102,
            primary_theme_id: 'icons',
            release_year: 2026,
            set_id: '10002',
            slug: 'null-status-set-10002',
            source: 'rebrickable',
            source_set_number: '10002-1',
            source_theme_id: 'rebrickable-theme-icons',
            status: null,
            updated_at: '2026-04-21T08:02:00.000Z',
          },
          {
            created_at: '2026-04-21T08:03:00.000Z',
            image_url: null,
            name: 'Missing Status Set',
            piece_count: 103,
            primary_theme_id: 'icons',
            release_year: 2026,
            set_id: '10003',
            slug: 'missing-status-set-10003',
            source: 'rebrickable',
            source_set_number: '10003-1',
            source_theme_id: 'rebrickable-theme-icons',
            updated_at: '2026-04-21T08:03:00.000Z',
          },
        ],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {},
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
        expect.objectContaining({
          set_id: '10000',
          status: 'active',
        }),
        expect.objectContaining({
          set_id: '10001',
          status: 'inactive',
        }),
        expect.objectContaining({
          set_id: '10002',
          status: 'active',
        }),
        expect.objectContaining({
          set_id: '10003',
          status: 'active',
        }),
      ],
      {
        onConflict: 'set_id',
      },
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[catalog-promotion] catalog set status payload normalized',
      expect.objectContaining({
        inputRows: 4,
        nullOrMissingStatusAfterNormalize: 0,
        nullOrMissingStatusBeforeNormalize: 2,
        table: 'catalog_sets',
      }),
    );

    consoleInfoSpy.mockRestore();
  });

  test('normalizes catalog set timestamps in existing-row upsert payloads', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: null,
            image_url: null,
            name: 'Mercedes-AMG F1 W14 E Performance',
            piece_count: 1642,
            primary_theme_id: 'speed-champions',
            release_year: 2024,
            set_id: '42171',
            slug: 'mercedes-amg-f1-w14-e-performance-42171',
            source: 'rebrickable',
            source_set_number: '42171-1',
            source_theme_id: 'rebrickable-theme-technic',
            status: 'active',
            updated_at: null,
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
            set_id: '42171',
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
        expect.objectContaining({
          created_at: '2026-04-22T09:00:00.000Z',
          set_id: '42171',
          updated_at: '2026-04-22T09:00:00.000Z',
        }),
      ],
      {
        onConflict: 'set_id',
      },
    );
  });

  test('keeps catalog set update payload slugs non-null for existing production rows', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: 'https://cdn.example.com/at-at.jpg',
            name: 'AT-AT',
            piece_count: 1555,
            primary_theme_id: 'star-wars',
            release_year: 2025,
            set_id: '75440',
            slug: null,
            source: 'rebrickable',
            source_set_number: '75440-1',
            source_theme_id: 'rebrickable-theme-star-wars',
            status: 'active',
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
            set_id: '75440',
            slug: 'legacy-at-at-75440',
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
        expect.objectContaining({
          set_id: '75440',
          slug: 'at-at-75440',
        }),
      ],
      {
        onConflict: 'set_id',
      },
    );
  });

  test('validates catalog set required fields before any promotion writes', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [],
        catalog_theme_mappings: [],
        catalog_sets: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            image_url: 'https://cdn.example.com/at-at.jpg',
            name: '',
            piece_count: 1555,
            primary_theme_id: 'star-wars',
            release_year: 2025,
            set_id: '75440',
            slug: null,
            source: 'rebrickable',
            source_set_number: '75440-1',
            source_theme_id: 'rebrickable-theme-star-wars',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
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
      'Unable to promote catalog_sets. Required column name is missing',
    );
    expect(
      Array.from(productionClient.upsertByTable.values()).some(
        (upsert) => upsert.mock.calls.length > 0,
      ),
    ).toBe(false);
  });

  test('includes catalog theme slug when promoting existing theme rows', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Advent',
            id: 'theme:advent',
            is_public: false,
            public_order: null,
            slug: 'advent',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            created_at: '2026-04-20T08:00:00.000Z',
            id: 'theme:advent',
            slug: 'advent',
            updated_at: '2026-04-20T09:00:00.000Z',
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-20T08:00:00.000Z',
          display_name: 'Advent',
          id: 'theme:advent',
          is_public: false,
          slug: 'advent',
          status: 'active',
          updated_at: '2026-04-20T09:00:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
  });

  test('derives missing catalog theme slugs before promotion writes', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: null,
            id: 'theme:advent',
            is_public: false,
            public_order: 10,
            slug: null,
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            display_name: null,
            id: 'theme:advent',
            is_public: null,
            slug: null,
            status: null,
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-21T08:00:00.000Z',
          display_name: 'Advent',
          id: 'theme:advent',
          is_public: false,
          slug: 'advent',
          status: 'active',
          updated_at: '2026-04-21T08:00:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
  });

  test('derives missing catalog theme display names and slugs for new theme rows', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: null,
            id: 'theme:advent',
            is_public: false,
            public_order: null,
            slug: null,
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [],
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          display_name: 'Advent',
          id: 'theme:advent',
          is_public: false,
          slug: 'advent',
          status: 'active',
        }),
      ],
      {
        onConflict: 'id',
      },
    );
  });

  test('preserves existing catalog theme presentation fields during promotion', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Icons',
            id: 'theme:icons',
            is_public: false,
            public_accent_color: '#000000',
            public_description: 'Staging copy should not replace production.',
            public_display_name: 'Staging Icons',
            public_hero_text_color: '#000000',
            public_homepage_order: 99,
            public_image_url: 'https://cdn.example.com/staging-icons.jpg',
            public_logo_url: 'https://cdn.example.com/staging-icons.svg',
            public_order: 99,
            public_surface_color: '#000000',
            public_surface_text_color: '#000000',
            slug: 'icons',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'City',
            id: 'theme:city',
            is_public: true,
            public_accent_color: '#2f7fc0',
            public_description: 'Stadssets met politie, treinen en trucks.',
            public_display_name: 'City',
            public_hero_text_color: '#ffffff',
            public_homepage_order: 50,
            public_image_url: 'https://cdn.example.com/city.jpg',
            public_logo_url: 'https://cdn.example.com/city.svg',
            public_order: 60,
            public_surface_color: '#2f7fc0',
            public_surface_text_color: '#ffffff',
            slug: 'city',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            id: 'theme:icons',
            is_public: true,
            public_accent_color: '#f0c63b',
            public_description: 'Production curated copy.',
            public_display_name: 'LEGO® Icons',
            public_hero_text_color: '#171a22',
            public_homepage_order: 40,
            public_image_url: 'https://cdn.example.com/production-icons.jpg',
            public_logo_url: 'https://cdn.example.com/production-icons.svg',
            public_order: 4,
            public_surface_color: '#f0c63b',
            public_surface_text_color: '#171a22',
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-21T08:00:00.000Z',
          display_name: 'Icons',
          id: 'theme:icons',
          is_public: true,
          slug: 'icons',
          status: 'active',
          updated_at: '2026-04-21T08:00:00.000Z',
        },
        {
          created_at: '2026-04-21T08:00:00.000Z',
          display_name: 'City',
          id: 'theme:city',
          is_public: true,
          public_accent_color: '#2f7fc0',
          public_description: 'Stadssets met politie, treinen en trucks.',
          public_display_name: 'City',
          public_hero_text_color: '#ffffff',
          public_homepage_order: 50,
          public_image_url: 'https://cdn.example.com/city.jpg',
          public_logo_url: 'https://cdn.example.com/city.svg',
          public_order: 60,
          public_surface_color: '#2f7fc0',
          public_surface_text_color: '#ffffff',
          slug: 'city',
          status: 'active',
          updated_at: '2026-04-21T08:00:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
  });

  test('preserves production Super Mario style presentation over staging defaults', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Super Mario',
            id: 'theme:super-mario',
            is_public: true,
            public_accent_color: '#31a047',
            public_description: 'Staging default copy.',
            public_display_name: 'Super Mario',
            public_hero_text_color: '#10241f',
            public_homepage_order: 70,
            public_image_url: 'https://cdn.example.com/luigi-default.jpg',
            public_logo_url: null,
            public_order: 20,
            public_surface_color: '#31a047',
            public_surface_text_color: '#10241f',
            slug: 'super-mario',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            primary_theme_id: 'theme:super-mario',
            source_theme_id: 'rebrickable:690',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            created_at: '2026-04-20T08:00:00.000Z',
            display_name: 'Super Mario',
            id: 'theme:super-mario',
            is_public: true,
            public_accent_color: '#e52521',
            public_description: 'Production curated Mario presentation.',
            public_display_name: 'LEGO Super Mario',
            public_hero_text_color: '#ffffff',
            public_homepage_order: 35,
            public_image_url: 'https://cdn.example.com/mario-curated.jpg',
            public_logo_url: null,
            public_order: 5,
            public_surface_color: '#d85a50',
            public_surface_text_color: '#ffffff',
            slug: 'super-mario',
            status: 'active',
            updated_at: '2026-04-20T09:00:00.000Z',
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-20T08:00:00.000Z',
          display_name: 'Super Mario',
          id: 'theme:super-mario',
          is_public: true,
          slug: 'super-mario',
          status: 'active',
          updated_at: '2026-04-20T09:00:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
    expect(
      productionClient.upsertByTable.get('catalog_theme_mappings'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-21T08:00:00.000Z',
          primary_theme_id: 'theme:super-mario',
          source_theme_id: 'rebrickable:690',
          updated_at: '2026-04-21T08:00:00.000Z',
        },
      ],
      {
        onConflict: 'source_theme_id',
      },
    );
  });

  test('does not revalidate existing theme slugs when production presentation is preserved', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Icons',
            id: 'theme:icons',
            is_public: true,
            public_accent_color: '#f0c63b',
            public_description: 'Displaysets die direct opvallen.',
            public_display_name: 'LEGO® Icons',
            public_image_url: 'https://cdn.example.com/icons.jpg',
            public_logo_url: null,
            public_order: 10,
            slug: 'icons',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            id: 'theme:icons',
            is_public: true,
            public_accent_color: null,
            public_description: 'Displaysets die direct opvallen.',
            public_display_name: 'LEGO® Icons',
            public_image_url: null,
            public_logo_url: null,
            public_order: 10,
            slug: 'icons',
            status: 'active',
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

    expect(result.changedThemeSlugs).toEqual([]);
  });

  test('does not return unchanged theme slugs for detail revalidation', async () => {
    const themeRow = {
      created_at: '2026-04-21T08:00:00.000Z',
      display_name: 'Icons',
      id: 'theme:icons',
      is_public: true,
      public_accent_color: '#f0c63b',
      public_description: 'Displaysets die direct opvallen.',
      public_display_name: 'LEGO® Icons',
      public_image_url: 'https://cdn.example.com/icons.jpg',
      public_logo_url: null,
      public_order: 10,
      slug: 'icons',
      status: 'active',
      updated_at: '2026-04-21T08:00:00.000Z',
    };
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [themeRow],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [themeRow],
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

    expect(result.changedThemeSlugs).toEqual([]);
  });

  test('ignores changed private themes for detail revalidation', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Retired Theme',
            id: 'theme:retired',
            is_public: false,
            public_accent_color: '#f0c63b',
            public_description: 'Private staging copy.',
            public_display_name: 'Retired Theme',
            public_image_url: 'https://cdn.example.com/private.jpg',
            public_logo_url: null,
            public_order: 99,
            slug: 'retired',
            status: 'inactive',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            id: 'theme:retired',
            is_public: false,
            public_accent_color: null,
            public_description: 'Private production copy.',
            public_display_name: 'Retired Theme',
            public_image_url: null,
            public_logo_url: null,
            public_order: 99,
            slug: 'retired',
            status: 'inactive',
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

    expect(result.changedThemeSlugs).toEqual([]);
  });

  test('defaults missing catalog theme status before promotion writes', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Advent',
            id: 'theme:advent',
            is_public: false,
            public_order: null,
            slug: 'advent',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
          {
            created_at: '2026-04-21T08:05:00.000Z',
            display_name: 'City',
            id: 'theme:city',
            is_public: true,
            public_order: 20,
            slug: 'city',
            status: null,
            updated_at: '2026-04-21T08:05:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            id: 'theme:advent',
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        {
          created_at: '2026-04-21T08:00:00.000Z',
          display_name: 'Advent',
          id: 'theme:advent',
          is_public: false,
          slug: 'advent',
          status: 'active',
          updated_at: '2026-04-21T08:00:00.000Z',
        },
        {
          created_at: '2026-04-21T08:05:00.000Z',
          display_name: 'City',
          id: 'theme:city',
          is_public: true,
          public_homepage_order: null,
          public_order: 20,
          slug: 'city',
          status: 'active',
          updated_at: '2026-04-21T08:05:00.000Z',
        },
      ],
      {
        onConflict: 'id',
      },
    );
  });

  test('preserves production catalog theme visibility and normalizes new theme visibility', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Keep promotion diagnostics out of the test output.
    });
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: '2026-04-21T08:00:00.000Z',
            display_name: 'Public Theme',
            id: 'theme:public',
            is_public: true,
            public_order: null,
            slug: 'public-theme',
            status: 'active',
            updated_at: '2026-04-21T08:00:00.000Z',
          },
          {
            created_at: '2026-04-21T08:05:00.000Z',
            display_name: 'Private Theme',
            id: 'theme:private',
            is_public: false,
            public_order: null,
            slug: 'private-theme',
            status: 'active',
            updated_at: '2026-04-21T08:05:00.000Z',
          },
          {
            created_at: '2026-04-21T08:10:00.000Z',
            display_name: 'Null Visibility Theme',
            id: 'theme:null-visibility',
            is_public: null,
            public_order: null,
            slug: 'null-visibility-theme',
            status: 'active',
            updated_at: '2026-04-21T08:10:00.000Z',
          },
          {
            created_at: '2026-04-21T08:15:00.000Z',
            display_name: 'Missing Visibility Theme',
            id: 'theme:missing-visibility',
            public_order: null,
            slug: 'missing-visibility-theme',
            status: 'active',
            updated_at: '2026-04-21T08:15:00.000Z',
          },
          {
            created_at: '2026-04-21T08:20:00.000Z',
            display_name: 'New Theme',
            id: 'theme:new',
            is_public: null,
            public_order: null,
            slug: 'new-theme',
            status: 'active',
            updated_at: '2026-04-21T08:20:00.000Z',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            id: 'theme:public',
            is_public: false,
          },
          {
            id: 'theme:private',
            is_public: true,
          },
          {
            id: 'theme:null-visibility',
            is_public: true,
          },
          {
            id: 'theme:missing-visibility',
            is_public: true,
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

    const payload = productionClient.upsertByTable.get('catalog_themes')?.mock
      .calls[0]?.[0] as Record<string, unknown>[];

    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'theme:public',
          is_public: false,
        }),
        expect.objectContaining({
          id: 'theme:private',
          is_public: true,
        }),
        expect.objectContaining({
          id: 'theme:null-visibility',
          is_public: true,
        }),
        expect.objectContaining({
          id: 'theme:missing-visibility',
          is_public: true,
        }),
        expect.objectContaining({
          id: 'theme:new',
          is_public: false,
        }),
      ]),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[catalog-promotion] catalog theme boolean payload normalized',
      expect.objectContaining({
        inputRows: 5,
        nullOrMissingIsPublicAfterNormalize: 0,
        nullOrMissingIsPublicBeforeNormalize: 3,
        table: 'catalog_themes',
      }),
    );
    consoleInfoSpy.mockRestore();
  });

  test('defaults required catalog theme timestamps in the actual upsert payload', async () => {
    const stagingClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_source_themes: [],
        catalog_themes: [
          {
            created_at: null,
            display_name: 'Existing Theme',
            id: 'theme:existing',
            is_public: false,
            public_order: null,
            slug: 'existing-theme',
            status: null,
            updated_at: null,
          },
          {
            display_name: 'Missing Timestamp Theme',
            id: 'theme:missing-timestamp',
            is_public: false,
            public_order: null,
            slug: 'missing-timestamp-theme',
          },
          {
            created_at: '   ',
            display_name: 'Blank Timestamp Theme',
            id: 'theme:blank-timestamp',
            is_public: false,
            public_order: null,
            slug: 'blank-timestamp-theme',
            status: '',
            updated_at: '',
          },
        ],
        catalog_theme_mappings: [],
        catalog_sets: [],
        commerce_merchants: [],
        commerce_benchmark_sets: [],
        commerce_offer_seeds: [],
      },
    });
    const productionClient = createPromotionSupabaseClient({
      rowsByTable: {
        catalog_themes: [
          {
            created_at: '2026-04-20T07:00:00.000Z',
            id: 'theme:existing',
            slug: 'existing-theme',
            updated_at: '2026-04-20T08:00:00.000Z',
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
      productionClient.upsertByTable.get('catalog_themes'),
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          created_at: '2026-04-20T07:00:00.000Z',
          id: 'theme:existing',
          updated_at: '2026-04-20T08:00:00.000Z',
        }),
        expect.objectContaining({
          created_at: '2026-04-22T09:00:00.000Z',
          id: 'theme:missing-timestamp',
          status: 'active',
          updated_at: '2026-04-22T09:00:00.000Z',
        }),
        expect.objectContaining({
          created_at: '2026-04-22T09:00:00.000Z',
          id: 'theme:blank-timestamp',
          status: 'active',
          updated_at: '2026-04-22T09:00:00.000Z',
        }),
      ],
      {
        onConflict: 'id',
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
