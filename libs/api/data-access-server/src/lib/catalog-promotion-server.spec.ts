import { describe, expect, test, vi } from 'vitest';
import { promoteCatalogFromStagingToProduction } from './catalog-promotion-server';

function createSelectBuilder(rows: readonly Record<string, unknown>[]) {
  const builder = {
    order: vi.fn(() =>
      Promise.resolve({
        data: [...rows],
        error: null,
      }),
    ),
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
        data: [...rows],
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
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
        expect.objectContaining({
          id: 'production-merchant-bol',
          slug: 'bol',
        }),
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
          set_id: '10316',
        }),
      ],
      {
        onConflict: 'set_id,merchant_id',
      },
    );
  });
});
