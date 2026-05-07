import { describe, expect, test, vi } from 'vitest';
import {
  copyCommerceDataFromProduction,
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  listActiveCommerceSyncSeeds,
  deleteCommerceBenchmarkSet,
  listActiveCommerceRefreshSeeds,
  listCommerceBenchmarkSets,
  listCommerceOfferSeeds,
  upsertCommerceAffiliateDiscoveredSet,
  upsertCommerceOfferSeedByCompositeKey,
  updateCommerceOfferSeedValidationState,
  upsertCommerceOfferLatestRecord,
} from './commerce-data-access-server';

type InMemorySupabaseTables = Record<string, Record<string, unknown>[]>;

function createCommerceCopySupabaseClient(tables: InMemorySupabaseTables) {
  const operations: string[] = [];

  return {
    operations,
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
        select: vi.fn(() => ({
          range: vi.fn(async (from: number, to: number) => ({
            data: (tables[table] ?? []).slice(from, to + 1),
            error: null,
          })),
        })),
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
        setId: '10316',
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

  test('lists active refresh seeds for cron consumers without exposing inactive rows', async () => {
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

    expect(result).toHaveLength(1);
    expect(result[0].offerSeed.id).toBe('seed-3');
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
        setId: '76784',
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
      setId: '10316',
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
      from: vi.fn(() => ({
        select: selectExisting,
        upsert,
      })),
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
