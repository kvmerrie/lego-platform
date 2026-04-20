import { describe, expect, test, vi } from 'vitest';
import {
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  deleteCommerceBenchmarkSet,
  listActiveCommerceRefreshSeeds,
  listCommerceBenchmarkSets,
  listCommerceOfferSeeds,
  updateCommerceOfferSeedValidationState,
  upsertCommerceOfferLatestRecord,
} from './commerce-data-access-server';

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

    expect(result).toHaveLength(2);
    expect(result[0].offerSeed.id).toBe('seed-1');
    expect(result[1].offerSeed.id).toBe('seed-3');
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
});
