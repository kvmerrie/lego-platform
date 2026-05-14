import { describe, expect, test, vi } from 'vitest';
import {
  copyCommerceDataFromProduction,
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  listActiveCommerceSyncSeeds,
  deleteCommerceBenchmarkSet,
  listCommerceAffiliateDiscoveredSets,
  listActiveCommerceRefreshSeeds,
  listCommerceBenchmarkSets,
  listCommerceOfferSeeds,
  markCommerceOfferLatestUnavailable,
  upsertCommerceAffiliateDiscoveredSet,
  upsertCommerceOfferSeedByCompositeKey,
  updateCommerceOfferSeedValidationState,
  upsertCommerceOfferLatestRecord,
} from './commerce-data-access-server';

type InMemorySupabaseTables = Record<string, Record<string, unknown>[]>;

function createCommerceSupabaseTableBuilder(
  rows: readonly Record<string, unknown>[],
) {
  const filters: Array<
    | {
        column: string;
        type: 'eq';
        value: unknown;
      }
    | {
        column: string;
        type: 'in';
        values: readonly unknown[];
      }
  > = [];
  const builder = {
    eq(column: string, value: unknown) {
      filters.push({
        column,
        type: 'eq',
        value,
      });

      return builder;
    },
    in(column: string, values: readonly unknown[]) {
      filters.push({
        column,
        type: 'in',
        values,
      });

      return builder;
    },
    maybeSingle() {
      return builder.then(({ data, error }) => ({
        data: data[0] ?? null,
        error,
      }));
    },
    order() {
      return builder;
    },
    select() {
      return builder;
    },
    single() {
      return builder.then(({ data, error }) => ({
        data: data[0] ?? null,
        error,
      }));
    },
    then<TResult1 = { data: Record<string, unknown>[]; error: null }>(
      onFulfilled?:
        | ((value: {
            data: Record<string, unknown>[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      const filteredRows = filters.reduce<readonly Record<string, unknown>[]>(
        (resultRows, filter) => {
          if (filter.type === 'eq') {
            return resultRows.filter(
              (row) => row[filter.column] === filter.value,
            );
          }

          return resultRows.filter((row) =>
            filter.values.includes(row[filter.column]),
          );
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

function createCommerceCopySupabaseClient(tables: InMemorySupabaseTables) {
  const operations: string[] = [];
  const selectedColumnsByTable = new Map<string, string[]>();

  return {
    operations,
    selectedColumnsByTable,
    supabaseClient: {
      from: vi.fn((table: string) => ({
        delete: vi.fn(() => ({
          not: vi.fn(async () => {
            const deletedCount = tables[table]?.length ?? 0;

            operations.push(`delete:${table}`);
            tables[table] = [];

            return {
              count: deletedCount,
              error: null,
            };
          }),
        })),
        insert: vi.fn(async (rows: Record<string, unknown>[]) => {
          operations.push(`insert:${table}:${rows.length}`);
          tables[table] = [...(tables[table] ?? []), ...rows];

          return {
            error: null,
          };
        }),
        select: vi.fn((columns: string) => {
          selectedColumnsByTable.set(table, [
            ...(selectedColumnsByTable.get(table) ?? []),
            columns,
          ]);

          return {
            range: vi.fn(async (from: number, to: number) => ({
              data: (tables[table] ?? []).slice(from, to + 1),
              error: null,
            })),
          };
        }),
      })),
    },
  };
}

describe('commerce data access server', () => {
  test('joins merchants and latest offers onto offer seeds', async () => {
    const order = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          is_active: true,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    const latestSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'latest-1',
          offer_seed_id: 'seed-1',
          price_minor: 49999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-04-14T08:00:00.000Z',
          fetched_at: '2026-04-14T08:00:00.000Z',
          error_message: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const seedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-1',
          set_id: '10316',
          merchant_id: 'merchant-1',
          product_url: 'https://www.lego.com/rivendell',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: '2026-04-14T08:00:00.000Z',
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const seedSelect = vi.fn(() => ({ order: seedOrder }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return { select };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      if (table === 'commerce_offer_seeds') {
        return { select: seedSelect };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listCommerceOfferSeeds({
      supabaseClient: { from } as never,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'seed-1',
        setId: '10316',
        merchant: expect.objectContaining({
          slug: 'lego-nl',
        }),
        latestOffer: expect.objectContaining({
          fetchStatus: 'success',
          priceMinor: 49999,
        }),
      }),
    ]);
  });

  test('paginates latest offers and offer seeds beyond the Supabase default page size', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-feed',
          slug: 'alternate',
          name: 'Alternate',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'TradeTracker',
          notes: null,
          created_at: '2026-05-10T08:00:00.000Z',
          updated_at: '2026-05-10T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestRows = Array.from({ length: 1001 }, (_, index) => ({
      id: `latest-${index}`,
      offer_seed_id: `seed-${index}`,
      price_minor: index === 1000 ? 1999 : null,
      currency_code: index === 1000 ? 'EUR' : null,
      availability: index === 1000 ? 'in_stock' : null,
      fetch_status: index === 1000 ? 'success' : 'error',
      observed_at: index === 1000 ? '2026-05-10T08:00:00.000Z' : null,
      fetched_at: '2026-05-10T08:00:00.000Z',
      error_message: index === 1000 ? null : 'old scraper error',
      created_at: '2026-05-10T08:00:00.000Z',
      updated_at: '2026-05-10T08:00:00.000Z',
    }));
    const seedRows = Array.from({ length: 1001 }, (_, index) => ({
      id: `seed-${index}`,
      set_id: `${10000 + index}`,
      merchant_id: 'merchant-feed',
      product_url: `https://example.com/${10000 + index}`,
      is_active: true,
      validation_status: 'valid',
      last_verified_at: '2026-05-10T08:00:00.000Z',
      notes: null,
      created_at: '2026-05-10T08:00:00.000Z',
      updated_at: '2026-05-10T08:00:00.000Z',
    }));
    const latestRange = vi.fn(async (from: number, to: number) => ({
      data: latestRows.slice(from, to + 1),
      error: null,
    }));
    const seedRange = vi.fn(async (from: number, to: number) => ({
      data: seedRows.slice(from, to + 1),
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: vi.fn(() => ({
            range: latestRange,
          })),
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: seedRange,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listActiveCommerceSyncSeeds({
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(1001);
    expect(
      result.find((refreshSeed) => refreshSeed.offerSeed.id === 'seed-1000')
        ?.offerSeed.latestOffer,
    ).toEqual(
      expect.objectContaining({
        fetchStatus: 'success',
        priceMinor: 1999,
      }),
    );
    expect(latestRange).toHaveBeenCalledTimes(2);
    expect(seedRange).toHaveBeenCalledTimes(2);
  });

  test('ignores latest offer rows that do not match an active seed', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-feed',
          slug: 'alternate',
          name: 'Alternate',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'TradeTracker',
          notes: null,
          created_at: '2026-05-10T08:00:00.000Z',
          updated_at: '2026-05-10T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestRange = vi.fn(async () => ({
      data: [
        {
          id: 'latest-orphan',
          offer_seed_id: 'seed-missing',
          price_minor: 1999,
          currency_code: 'EUR',
          availability: 'in_stock',
          fetch_status: 'success',
          observed_at: '2026-05-10T08:00:00.000Z',
          fetched_at: '2026-05-10T08:00:00.000Z',
          error_message: null,
          created_at: '2026-05-10T08:00:00.000Z',
          updated_at: '2026-05-10T08:00:00.000Z',
        },
      ],
      error: null,
    }));
    const seedRange = vi.fn(async () => ({
      data: [
        {
          id: 'seed-existing',
          set_id: '10316',
          merchant_id: 'merchant-feed',
          product_url: 'https://example.com/10316',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: '2026-05-10T08:00:00.000Z',
          notes: null,
          created_at: '2026-05-10T08:00:00.000Z',
          updated_at: '2026-05-10T08:00:00.000Z',
        },
      ],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: vi.fn(() => ({
            range: latestRange,
          })),
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: seedRange,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listActiveCommerceSyncSeeds({
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(1);
    expect(result[0].offerSeed.latestOffer).toBeUndefined();
  });

  test('handles exact-page and empty paginated commerce inputs', async () => {
    async function loadWithRowCount(rowCount: number) {
      const merchantOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'merchant-feed',
            slug: 'alternate',
            name: 'Alternate',
            is_active: true,
            source_type: 'affiliate',
            affiliate_network: 'TradeTracker',
            notes: null,
            created_at: '2026-05-10T08:00:00.000Z',
            updated_at: '2026-05-10T08:00:00.000Z',
          },
        ],
        error: null,
      });
      const latestRows = Array.from({ length: rowCount }, (_, index) => ({
        id: `latest-${index}`,
        offer_seed_id: `seed-${index}`,
        price_minor: 1999,
        currency_code: 'EUR',
        availability: 'in_stock',
        fetch_status: 'success',
        observed_at: '2026-05-10T08:00:00.000Z',
        fetched_at: '2026-05-10T08:00:00.000Z',
        error_message: null,
        created_at: '2026-05-10T08:00:00.000Z',
        updated_at: '2026-05-10T08:00:00.000Z',
      }));
      const seedRows = Array.from({ length: rowCount }, (_, index) => ({
        id: `seed-${index}`,
        set_id: `${10000 + index}`,
        merchant_id: 'merchant-feed',
        product_url: `https://example.com/${10000 + index}`,
        is_active: true,
        validation_status: 'valid',
        last_verified_at: '2026-05-10T08:00:00.000Z',
        notes: null,
        created_at: '2026-05-10T08:00:00.000Z',
        updated_at: '2026-05-10T08:00:00.000Z',
      }));
      const latestRange = vi.fn(async (from: number, to: number) => ({
        data: latestRows.slice(from, to + 1),
        error: null,
      }));
      const seedRange = vi.fn(async (from: number, to: number) => ({
        data: seedRows.slice(from, to + 1),
        error: null,
      }));
      const from = vi.fn((table: string) => {
        if (table === 'commerce_merchants') {
          return {
            select: vi.fn(() => ({
              order: merchantOrder,
            })),
          };
        }

        if (table === 'commerce_offer_latest') {
          return {
            select: vi.fn(() => ({
              range: latestRange,
            })),
          };
        }

        if (table === 'commerce_offer_seeds') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                range: seedRange,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      });

      const result = await listActiveCommerceSyncSeeds({
        supabaseClient: { from } as never,
      });

      return {
        latestRange,
        result,
        seedRange,
      };
    }

    const exactPage = await loadWithRowCount(1000);

    expect(exactPage.result).toHaveLength(1000);
    expect(exactPage.latestRange).toHaveBeenCalledTimes(2);
    expect(exactPage.seedRange).toHaveBeenCalledTimes(2);

    const emptyPage = await loadWithRowCount(0);

    expect(emptyPage.result).toHaveLength(0);
    expect(emptyPage.latestRange).toHaveBeenCalledTimes(1);
    expect(emptyPage.seedRange).toHaveBeenCalledTimes(1);
  });

  test('throws when a paginated latest-offer page fails', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const latestRange = vi.fn(async () => ({
      data: null,
      error: {
        message: 'timeout',
      },
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: vi.fn(() => ({
            range: latestRange,
          })),
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async () => ({
                data: [],
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      listActiveCommerceSyncSeeds({
        supabaseClient: { from } as never,
      }),
    ).rejects.toThrow('Unable to load commerce latest offers.');
  });

  test('uses deterministic ordering for paginated latest offers and offer seeds when supported', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const latestOrder = vi.fn(() => ({
      range: vi.fn(async () => ({
        data: [],
        error: null,
      })),
    }));
    const seedOrderById = vi.fn(() => ({
      range: vi.fn(async () => ({
        data: [],
        error: null,
      })),
    }));
    const seedOrderByUpdatedAt = vi.fn(() => ({
      order: seedOrderById,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: vi.fn(() => ({
            order: latestOrder,
          })),
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: seedOrderByUpdatedAt,
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await listActiveCommerceSyncSeeds({
      supabaseClient: { from } as never,
    });

    expect(latestOrder).toHaveBeenCalledWith('offer_seed_id', {
      ascending: true,
    });
    expect(seedOrderByUpdatedAt).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    });
    expect(seedOrderById).toHaveBeenCalledWith('id', {
      ascending: true,
    });
  });

  test('creates a merchant through the Supabase table', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-1',
        slug: 'lego-nl',
        name: 'LEGO',
        is_active: true,
        source_type: 'direct',
        affiliate_network: null,
        notes: null,
        created_at: '2026-04-14T08:00:00.000Z',
        updated_at: '2026-04-14T08:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    const merchant = await createCommerceMerchant({
      input: {
        slug: 'lego-nl',
        name: 'LEGO',
        isActive: true,
        sourceType: 'direct',
      },
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_merchants');
    expect(insert).toHaveBeenCalledWith({
      slug: 'lego-nl',
      name: 'LEGO',
      is_active: true,
      source_type: 'direct',
      affiliate_network: null,
      notes: '',
    });
    expect(merchant.slug).toBe('lego-nl');
  });

  test('lists benchmark sets from Supabase for the benchmark workflow', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          set_id: '10316',
          notes: 'Starter batch',
          created_at: '2026-04-15T08:00:00.000Z',
          updated_at: '2026-04-15T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));

    const benchmarkSets = await listCommerceBenchmarkSets({
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_benchmark_sets');
    expect(benchmarkSets).toEqual([
      {
        setId: '10316',
        notes: 'Starter batch',
        createdAt: '2026-04-15T08:00:00.000Z',
        updatedAt: '2026-04-15T08:00:00.000Z',
      },
    ]);
  });

  test('creates a benchmark set through the Supabase table', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        set_id: '10316',
        notes: '',
        created_at: '2026-04-15T08:00:00.000Z',
        updated_at: '2026-04-15T08:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    const benchmarkSet = await createCommerceBenchmarkSet({
      input: {
        setId: '10316-1',
      },
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_benchmark_sets');
    expect(insert).toHaveBeenCalledWith({
      set_id: '10316',
      notes: '',
    });
    expect(benchmarkSet.setId).toBe('10316');
  });

  test('does not include scraper-only merchants in the default refresh path', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          is_active: true,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
        {
          id: 'merchant-2',
          slug: 'top1toys',
          name: 'Top1Toys',
          is_active: true,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
        {
          id: 'merchant-3',
          slug: 'amazon-nl',
          name: 'Amazon',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'Amazon Associates',
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const seedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-1',
          set_id: '10316',
          merchant_id: 'merchant-1',
          product_url: 'https://www.lego.com/rivendell',
          is_active: true,
          validation_status: 'pending',
          last_verified_at: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
        {
          id: 'seed-2',
          set_id: '76269',
          merchant_id: 'merchant-1',
          product_url: 'https://www.lego.com/avengers-tower',
          is_active: false,
          validation_status: 'pending',
          last_verified_at: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
        {
          id: 'seed-3',
          set_id: '10316',
          merchant_id: 'merchant-2',
          product_url: 'https://www.top1toys.nl/rivendell',
          is_active: true,
          validation_status: 'pending',
          last_verified_at: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
        {
          id: 'seed-4',
          set_id: '10316',
          merchant_id: 'merchant-3',
          product_url: 'https://www.amazon.nl/rivendell',
          is_active: true,
          validation_status: 'pending',
          last_verified_at: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return { select: vi.fn(() => ({ order: merchantOrder })) };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      if (table === 'commerce_offer_seeds') {
        return { select: vi.fn(() => ({ order: seedOrder })) };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listActiveCommerceRefreshSeeds({
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(0);
  });

  test('can include blocked merchants when refresh consumers explicitly ask for the full set', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'amazon-nl',
          name: 'Amazon',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'Amazon Associates',
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const seedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-1',
          set_id: '10316',
          merchant_id: 'merchant-1',
          product_url: 'https://www.amazon.nl/rivendell',
          is_active: true,
          validation_status: 'pending',
          last_verified_at: null,
          notes: null,
          created_at: '2026-04-14T08:00:00.000Z',
          updated_at: '2026-04-14T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return { select: vi.fn(() => ({ order: merchantOrder })) };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      if (table === 'commerce_offer_seeds') {
        return { select: vi.fn(() => ({ order: seedOrder })) };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listActiveCommerceRefreshSeeds({
      includeBlockedMerchants: true,
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(1);
    expect(result[0].merchant.slug).toBe('amazon-nl');
  });

  test('includes non-default refresh merchants when they are explicitly requested', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'wehkamp',
          name: 'Wehkamp',
          is_active: true,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-20T09:00:00.000Z',
          updated_at: '2026-04-20T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const seedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-1',
          set_id: '21366',
          merchant_id: 'merchant-1',
          product_url:
            'https://www.wehkamp.nl/lego-ideas-drijvende-zeeotters-bouwpakket-voor-volwassenen-21366-17517964/',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: '2026-04-20T09:00:00.000Z',
          notes: null,
          created_at: '2026-04-20T09:00:00.000Z',
          updated_at: '2026-04-20T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return { select: vi.fn(() => ({ order: merchantOrder })) };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      if (table === 'commerce_offer_seeds') {
        return { select: vi.fn(() => ({ order: seedOrder })) };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      listActiveCommerceRefreshSeeds({
        supabaseClient: { from } as never,
      }),
    ).resolves.toHaveLength(0);

    const result = await listActiveCommerceRefreshSeeds({
      merchantSlugs: ['wehkamp'],
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(1);
    expect(result[0].merchant.slug).toBe('wehkamp');
    expect(result[0].offerSeed.setId).toBe('21366');
  });

  test('lists active sync seeds without default refresh gating', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'alternate',
          name: 'Alternate',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'TradeTracker',
          notes: null,
          created_at: '2026-04-22T09:00:00.000Z',
          updated_at: '2026-04-22T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const seedOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-1',
          set_id: '76784',
          merchant_id: 'merchant-1',
          product_url: 'https://clk.tradedoubler.test/alternate/76784',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: '2026-04-22T09:00:00.000Z',
          notes: null,
          created_at: '2026-04-22T09:00:00.000Z',
          updated_at: '2026-04-22T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return { select: vi.fn(() => ({ order: merchantOrder })) };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      if (table === 'commerce_offer_seeds') {
        return { select: vi.fn(() => ({ order: seedOrder })) };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await listActiveCommerceSyncSeeds({
      supabaseClient: { from } as never,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.merchant.slug).toBe('alternate');
    expect(result[0]?.offerSeed.setId).toBe('76784');
  });

  test('upserts latest offer records by offer seed id for future refresh jobs', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));

    await upsertCommerceOfferLatestRecord({
      input: {
        offerSeedId: 'seed-1',
        fetchStatus: 'success',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-14T08:00:00.000Z',
        fetchedAt: '2026-04-14T08:01:00.000Z',
      },
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_offer_latest');
    expect(upsert).toHaveBeenCalledWith(
      {
        offer_seed_id: 'seed-1',
        price_minor: 49999,
        currency_code: 'EUR',
        availability: 'in_stock',
        fetch_status: 'success',
        observed_at: '2026-04-14T08:00:00.000Z',
        fetched_at: '2026-04-14T08:01:00.000Z',
        error_message: null,
      },
      {
        onConflict: 'offer_seed_id',
      },
    );
  });

  test('marks unseen latest offer records unavailable without deleting prices', async () => {
    const inFilter = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ update }));

    const result = await markCommerceOfferLatestUnavailable({
      fetchedAt: '2026-05-14T09:15:00.000Z',
      observedAt: '2026-05-14T09:15:00.000Z',
      offerSeedIds: ['seed-1', 'seed-1', 'seed-2'],
      supabaseClient: { from } as never,
    });

    expect(result).toBe(2);
    expect(from).toHaveBeenCalledWith('commerce_offer_latest');
    expect(update).toHaveBeenCalledWith({
      availability: 'out_of_stock',
      fetch_status: 'unavailable',
      observed_at: '2026-05-14T09:15:00.000Z',
      fetched_at: '2026-05-14T09:15:00.000Z',
      error_message:
        'Offer was not present in the latest successful merchant feed run.',
    });
    expect(inFilter).toHaveBeenCalledWith('offer_seed_id', [
      'seed-1',
      'seed-2',
    ]);
  });

  test('upserts offer seeds by set and merchant for feed-driven merchants', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'alternate',
          name: 'Alternate',
          is_active: true,
          source_type: 'affiliate',
          affiliate_network: 'TradeTracker',
          notes: null,
          created_at: '2026-04-22T09:00:00.000Z',
          updated_at: '2026-04-22T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const latestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'seed-1',
        set_id: '76784',
        merchant_id: 'merchant-1',
        product_url: 'https://clk.tradedoubler.test/alternate/76784',
        is_active: true,
        validation_status: 'valid',
        last_verified_at: '2026-04-22T09:00:00.000Z',
        notes: 'Feed-driven Alternate import.',
        created_at: '2026-04-22T09:00:00.000Z',
        updated_at: '2026-04-22T09:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_offer_seeds') {
        return { upsert };
      }

      if (table === 'commerce_merchants') {
        return { select: vi.fn(() => ({ order: merchantOrder })) };
      }

      if (table === 'commerce_offer_latest') {
        return { select: latestSelect };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await upsertCommerceOfferSeedByCompositeKey({
      input: {
        setId: '76784-1',
        merchantId: 'merchant-1',
        productUrl: 'https://clk.tradedoubler.test/alternate/76784',
        isActive: true,
        validationStatus: 'valid',
        lastVerifiedAt: '2026-04-22T09:00:00.000Z',
        notes: 'Feed-driven Alternate import.',
      },
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_offer_seeds');
    expect(upsert).toHaveBeenCalledWith(
      {
        set_id: '76784',
        merchant_id: 'merchant-1',
        product_url: 'https://clk.tradedoubler.test/alternate/76784',
        is_active: true,
        validation_status: 'valid',
        last_verified_at: '2026-04-22T09:00:00.000Z',
        notes: 'Feed-driven Alternate import.',
      },
      {
        onConflict: 'set_id,merchant_id',
      },
    );
    expect(result.id).toBe('seed-1');
    expect(result.merchant?.slug).toBe('alternate');
  });

  test('updates validation status and verification timestamp for refreshed seeds', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    await updateCommerceOfferSeedValidationState({
      offerSeedId: 'seed-1',
      input: {
        validationStatus: 'valid',
        lastVerifiedAt: '2026-04-14T08:05:00.000Z',
      },
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_offer_seeds');
    expect(update).toHaveBeenCalledWith({
      validation_status: 'valid',
      last_verified_at: '2026-04-14T08:05:00.000Z',
    });
    expect(eq).toHaveBeenCalledWith('id', 'seed-1');
  });

  test('deletes benchmark sets by set id so the benchmark batch stays editable', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: remove }));

    await deleteCommerceBenchmarkSet({
      setId: '10316-1',
      supabaseClient: { from } as never,
    });

    expect(from).toHaveBeenCalledWith('commerce_benchmark_sets');
    expect(eq).toHaveBeenCalledWith('set_id', '10316');
  });

  test('dry-runs production commerce copy without touching target tables', async () => {
    const productionTables: InMemorySupabaseTables = {
      articles: [{ slug: 'untouched-production-article' }],
      commerce_benchmark_sets: [{ set_id: '10316' }],
      commerce_merchants: [{ id: 'merchant-production', slug: 'lego-nl' }],
      commerce_affiliate_discovered_sets: [{ id: 'discovered-production' }],
      commerce_offer_latest: [{ id: 'latest-production' }],
      commerce_offer_seeds: [{ id: 'seed-production' }],
      pricing_daily_set_history: [{ set_id: '10316' }],
    };
    const targetTables: InMemorySupabaseTables = {
      articles: [{ slug: 'untouched-target-article' }],
      commerce_benchmark_sets: [{ set_id: '75355' }],
      commerce_merchants: [{ id: 'merchant-target', slug: 'alternate' }],
      commerce_affiliate_discovered_sets: [{ id: 'discovered-target' }],
      commerce_offer_latest: [{ id: 'latest-target' }],
      commerce_offer_seeds: [{ id: 'seed-target' }],
      pricing_daily_set_history: [{ set_id: '75355' }],
    };
    const productionClient = createCommerceCopySupabaseClient(productionTables);
    const targetClient = createCommerceCopySupabaseClient(targetTables);

    const result = await copyCommerceDataFromProduction({
      createProductionSupabaseClient: () =>
        productionClient.supabaseClient as never,
      createTargetSupabaseClient: () => targetClient.supabaseClient as never,
      dryRun: true,
      now: () => new Date('2026-05-05T12:00:00.000Z'),
    });

    expect(result.dryRun).toBe(true);
    expect(result.tables.commerce_merchants).toEqual({
      deletedCount: 0,
      insertedCount: 0,
      sourceCount: 1,
      targetBeforeCount: 1,
    });
    expect(result.tables.pricing_daily_set_history.sourceCount).toBe(1);
    expect(targetTables.commerce_merchants).toEqual([
      { id: 'merchant-target', slug: 'alternate' },
    ]);
    expect(targetTables.articles).toEqual([
      { slug: 'untouched-target-article' },
    ]);
    expect(
      [...productionClient.selectedColumnsByTable.values()].flat(),
    ).not.toContain('*');
    expect(
      productionClient.selectedColumnsByTable.get('commerce_merchants'),
    ).toEqual([
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    ]);
    expect(
      productionClient.selectedColumnsByTable.get('pricing_daily_set_history'),
    ).toEqual([
      'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on, created_at, updated_at',
    ]);
    expect(targetClient.operations).toEqual([]);
  });

  test('copies only commerce tables from production into the target environment', async () => {
    const productionTables: InMemorySupabaseTables = {
      articles: [{ slug: 'production-article' }],
      commerce_affiliate_discovered_sets: [{ id: 'discovered-production' }],
      commerce_benchmark_sets: [{ set_id: '10316' }],
      commerce_merchants: [{ id: 'merchant-production', slug: 'lego-nl' }],
      commerce_offer_latest: [{ id: 'latest-production' }],
      commerce_offer_seeds: [{ id: 'seed-production' }],
      pricing_daily_set_history: [{ recorded_on: '2026-05-05' }],
    };
    const targetTables: InMemorySupabaseTables = {
      articles: [{ slug: 'target-article' }],
      commerce_affiliate_discovered_sets: [{ id: 'discovered-target' }],
      commerce_benchmark_sets: [{ set_id: '75355' }],
      commerce_merchants: [{ id: 'merchant-target', slug: 'alternate' }],
      commerce_offer_latest: [{ id: 'latest-target' }],
      commerce_offer_seeds: [{ id: 'seed-target' }],
      pricing_daily_set_history: [{ recorded_on: '2026-05-04' }],
    };
    const productionClient = createCommerceCopySupabaseClient(productionTables);
    const targetClient = createCommerceCopySupabaseClient(targetTables);

    const result = await copyCommerceDataFromProduction({
      allowDestructive: true,
      createProductionSupabaseClient: () =>
        productionClient.supabaseClient as never,
      createTargetSupabaseClient: () => targetClient.supabaseClient as never,
      dryRun: false,
      now: () => new Date('2026-05-05T12:00:00.000Z'),
    });

    expect(result.dryRun).toBe(false);
    expect(result.tables.commerce_offer_latest).toEqual({
      deletedCount: 1,
      insertedCount: 1,
      sourceCount: 1,
      targetBeforeCount: 1,
    });
    expect(targetTables.commerce_merchants).toEqual([
      { id: 'merchant-production', slug: 'lego-nl' },
    ]);
    expect(targetTables.commerce_offer_seeds).toEqual([
      { id: 'seed-production' },
    ]);
    expect(targetTables.pricing_daily_set_history).toEqual([
      { recorded_on: '2026-05-05' },
    ]);
    expect(targetTables.articles).toEqual([{ slug: 'target-article' }]);
    expect(targetClient.operations).toEqual([
      'delete:pricing_daily_set_history',
      'delete:commerce_affiliate_discovered_sets',
      'delete:commerce_offer_latest',
      'delete:commerce_offer_seeds',
      'delete:commerce_benchmark_sets',
      'delete:commerce_merchants',
      'insert:commerce_merchants:1',
      'insert:commerce_benchmark_sets:1',
      'insert:commerce_offer_seeds:1',
      'insert:commerce_offer_latest:1',
      'insert:commerce_affiliate_discovered_sets:1',
      'insert:pricing_daily_set_history:1',
    ]);
  });

  test('aborts production commerce copy when target rows exist without destructive approval', async () => {
    const productionTables: InMemorySupabaseTables = {
      commerce_merchants: [{ id: 'merchant-production', slug: 'lego-nl' }],
    };
    const targetTables: InMemorySupabaseTables = {
      commerce_merchants: [{ id: 'merchant-target', slug: 'alternate' }],
    };
    const productionClient = createCommerceCopySupabaseClient(productionTables);
    const targetClient = createCommerceCopySupabaseClient(targetTables);

    await expect(
      copyCommerceDataFromProduction({
        createProductionSupabaseClient: () =>
          productionClient.supabaseClient as never,
        createTargetSupabaseClient: () => targetClient.supabaseClient as never,
        dryRun: false,
        now: () => new Date('2026-05-05T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/allowDestructive=true/);

    expect(targetTables.commerce_merchants).toEqual([
      { id: 'merchant-target', slug: 'alternate' },
    ]);
    expect(targetClient.operations).toEqual([]);
  });

  test('marks affiliate discovered sets that already exist in catalog as ignored and linked', async () => {
    const maybeSingleExistingDiscovery = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const upsertPayloads: Record<string, unknown>[] = [];
    const persistedRow = {
      confidence: 'high',
      created_at: '2026-05-06T12:00:00.000Z',
      currency_code: 'EUR',
      first_seen_at: '2026-05-06T12:00:00.000Z',
      id: 'discovered-43020',
      image_url: 'https://cdn.example.test/43020.jpg',
      import_attempted_at: null,
      import_error:
        'Skipped discovery because this set already exists in catalog_sets.',
      imported_set_id: '43020',
      last_seen_at: '2026-05-06T12:00:00.000Z',
      merchant_id: 'merchant-alternate',
      normalized_set_id: '43020',
      price_minor: 7999,
      product_title: 'LEGO Nike Dunk x LEGO',
      product_url: 'https://shop.example.test/43020',
      raw_payload: {},
      source_set_number: '43020-1',
      status: 'ignored',
      updated_at: '2026-05-06T12:00:00.000Z',
    };
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets') {
          return createCommerceSupabaseTableBuilder([
            {
              set_id: '43020',
              source_set_number: '43020-1',
            },
          ]);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: maybeSingleExistingDiscovery,
              })),
            })),
          })),
          upsert: vi.fn((payload: Record<string, unknown>) => {
            upsertPayloads.push(payload);

            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: persistedRow,
                  error: null,
                })),
              })),
            };
          }),
        };
      }),
    };

    const result = await upsertCommerceAffiliateDiscoveredSet({
      input: {
        affiliateId: 'merchant-alternate',
        currencyCode: 'EUR',
        imageUrl: 'https://cdn.example.test/43020.jpg',
        observedAt: '2026-05-06T12:00:00.000Z',
        priceMinor: 7999,
        productTitle: 'LEGO Nike Dunk x LEGO',
        productUrl: 'https://shop.example.test/43020',
        rawPayload: {},
        setNumber: ' 43020-1 ',
      },
      supabaseClient: supabaseClient as never,
    });

    expect(upsertPayloads[0]).toMatchObject({
      imported_set_id: '43020',
      normalized_set_id: '43020',
      status: 'ignored',
    });
    expect(result?.status).toBe('ignored');
    expect(result?.importedSetId).toBe('43020');
  });

  test('filters existing catalog sets out of affiliate discovered review queues', async () => {
    const discoveredRows = [
      {
        commerce_merchants: {
          id: 'merchant-alternate',
          name: 'Alternate',
          slug: 'alternate',
        },
        confidence: 'high',
        created_at: '2026-05-06T12:00:00.000Z',
        currency_code: 'EUR',
        first_seen_at: '2026-05-06T12:00:00.000Z',
        id: 'discovered-existing',
        image_url: 'https://cdn.example.test/43020.jpg',
        import_attempted_at: null,
        import_error: null,
        imported_set_id: null,
        last_seen_at: '2026-05-06T12:00:00.000Z',
        merchant_id: 'merchant-alternate',
        normalized_set_id: '43020',
        price_minor: 7999,
        product_title: 'LEGO Nike Dunk x LEGO',
        product_url: 'https://shop.example.test/43020',
        raw_payload: {},
        source_set_number: '43020-1',
        status: 'new',
        updated_at: '2026-05-06T12:00:00.000Z',
      },
      {
        commerce_merchants: {
          id: 'merchant-alternate',
          name: 'Alternate',
          slug: 'alternate',
        },
        confidence: 'high',
        created_at: '2026-05-06T12:05:00.000Z',
        currency_code: 'EUR',
        first_seen_at: '2026-05-06T12:05:00.000Z',
        id: 'discovered-new',
        image_url: 'https://cdn.example.test/99999.jpg',
        import_attempted_at: null,
        import_error: null,
        imported_set_id: null,
        last_seen_at: '2026-05-06T12:05:00.000Z',
        merchant_id: 'merchant-alternate',
        normalized_set_id: '99999',
        price_minor: 9999,
        product_title: 'LEGO Unknown Set',
        product_url: 'https://shop.example.test/99999',
        raw_payload: {},
        source_set_number: '99999-1',
        status: 'new',
        updated_at: '2026-05-06T12:05:00.000Z',
      },
    ];
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets') {
          return createCommerceSupabaseTableBuilder([
            {
              set_id: '43020',
              source_set_number: '43020-1',
            },
          ]);
        }

        return createCommerceSupabaseTableBuilder(discoveredRows);
      }),
    };

    const results = await listCommerceAffiliateDiscoveredSets({
      status: 'new',
      supabaseClient: supabaseClient as never,
    });

    expect(results.map((result) => result.normalizedSetId)).toEqual(['99999']);
  });

  test('includes Supabase details and sanitized attempted fields when discovered set persistence fails', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const eqProductUrl = vi.fn(() => ({ maybeSingle }));
    const eqMerchantId = vi.fn(() => ({ eq: eqProductUrl }));
    const selectExisting = vi.fn(() => ({ eq: eqMerchantId }));
    const single = vi.fn(async () => ({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        details: 'Key (merchant_id, product_url) already exists.',
        hint: 'Use a different product URL.',
      },
    }));
    const selectPersisted = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: selectPersisted }));
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets') {
          return createCommerceSupabaseTableBuilder([]);
        }

        return {
          select: selectExisting,
          upsert,
        };
      }),
    };

    let errorMessage = '';

    try {
      await upsertCommerceAffiliateDiscoveredSet({
        input: {
          affiliateId: 'merchant-alternate',
          currencyCode: 'EUR',
          imageUrl: 'https://cdn.example.test/75313.jpg',
          observedAt: '2026-05-06T12:00:00.000Z',
          priceMinor: 64999,
          productTitle: 'LEGO Star Wars AT-AT',
          productUrl: 'https://shop.example.test/75313',
          rawPayload: {
            secretDebugBlob: 'do-not-include-me',
          },
          setNumber: 'LEGO 75313',
        },
        supabaseClient: supabaseClient as never,
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '';
    }

    expect(errorMessage).toBe(
      'Unable to persist the affiliate discovered set. message="duplicate key value violates unique constraint" code="23505" details="Key (merchant_id, product_url) already exists." hint="Use a different product URL." merchant_id="merchant-alternate" source="https://shop.example.test/75313" source_set_number="75313-1" normalized_set_number="75313" status="new" confidence="high"',
    );
    expect(errorMessage).not.toContain('do-not-include-me');
  });
});
