import { describe, expect, test, vi } from 'vitest';
import {
  buildDealPageSnapshots,
  syncDealPageSnapshots,
} from './deal-page-snapshot-server';

function createCatalogSet(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-05-01T00:00:00.000Z',
    name: 'Eiffeltoren',
    pieceCount: 1001,
    primaryTheme: 'Icons',
    releaseYear: 2022,
    secondaryLabels: [],
    setId: '10307',
    slug: 'eiffel-tower-10307',
    source: 'rebrickable',
    sourceSetNumber: '10307-1',
    status: 'active',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function createCommerceSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    best_availability: 'in_stock',
    best_checked_at: '2026-05-30T10:00:00.000Z',
    best_merchant_name: 'MediaMarkt',
    best_merchant_slug: 'mediamarkt',
    best_price_minor: 10_000,
    best_product_url: 'https://example.com/10307',
    comparable_offer_count: 2,
    computed_at: '2026-05-30T10:00:00.000Z',
    next_best_price_minor: 12_000,
    offer_count: 2,
    offers: [
      {
        availability: 'in_stock',
        merchantSlug: 'rakuten-lego-eu',
        priceMinor: 15_000,
      },
    ],
    price_spread_minor: 2_000,
    set_id: '10307',
    trusted_offer_count: 2,
    ...overrides,
  };
}

function createSupabaseClient(rows: readonly Record<string, unknown>[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'commerce_current_offer_snapshots') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  range: vi.fn().mockResolvedValue({
                    data: rows,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'collection_page_snapshots') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('deal page snapshot server', () => {
  test('excludes stale offers from deal snapshots', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet()]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_checked_at: '2026-05-20T10:00:00.000Z',
        }),
      ]) as never,
    });

    expect(result.summaryBySortKey.recommended?.totalCount).toBe(0);
  });

  test('sorts price-per-brick deals by best price divided by pieces', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Expensive Small Set',
          pieceCount: 100,
          setId: '10000',
          slug: 'expensive-small-set-10000',
        }),
        createCatalogSet({
          name: 'Efficient Big Set',
          pieceCount: 1000,
          setId: '20000',
          slug: 'efficient-big-set-20000',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 5_000,
          set_id: '10000',
        }),
        createCommerceSnapshot({
          best_price_minor: 10_000,
          set_id: '20000',
        }),
      ]) as never,
    });
    const pricePerBrickSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'price-per-brick',
    );

    expect(pricePerBrickSnapshot?.items.map((item) => item.id)).toEqual([
      '20000',
      '10000',
    ]);
  });

  test('keeps useful recommended deals without a LEGO reference price', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: '10308', slug: 'set-10308' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          next_best_price_minor: null,
          offers: [],
          price_spread_minor: null,
          set_id: '10308',
          trusted_offer_count: 0,
        }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      '10308',
    ]);
    expect(recommendedSnapshot?.items[0]?.savingsVsLegoMinor).toBeUndefined();
    expect(
      recommendedSnapshot?.items[0]?.priceContext.discountMetric,
    ).toBeUndefined();
    expect(recommendedSnapshot?.items[0]?.priceContext.decisionLabel).toBe(
      'Beste prijs',
    );
  });

  test('keeps price-per-brick and under-50 deals without a reference discount', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: '10308', slug: 'set-10308' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 4_999,
          next_best_price_minor: null,
          offers: [],
          price_spread_minor: null,
          set_id: '10308',
        }),
      ]) as never,
    });
    const pricePerBrickSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'price-per-brick',
    );
    const under50Snapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'under-50',
    );

    expect(pricePerBrickSnapshot?.items.map((item) => item.id)).toEqual([
      '10308',
    ]);
    expect(pricePerBrickSnapshot?.items[0]?.priceContext.decisionLabel).toBe(
      'Prijs per steen',
    );
    expect(under50Snapshot?.items.map((item) => item.id)).toEqual(['10308']);
    expect(under50Snapshot?.items[0]?.priceContext.decisionLabel).toBe(
      'Onder €50',
    );
  });

  test('discount sort only includes deals with a reliable LEGO reference baseline', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: '10307' }),
          createCatalogSet({ setId: '10308', slug: 'other-10308' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({ set_id: '10307' }),
        createCommerceSnapshot({
          offers: [],
          set_id: '10308',
        }),
      ]) as never,
    });
    const discountSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'discount-desc',
    );

    expect(discountSnapshot?.items.map((item) => item.id)).toEqual(['10307']);
  });

  test('under-50 snapshots include only deal candidates below 50 euro', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: 'cheap', slug: 'cheap' }),
          createCatalogSet({ setId: 'expensive', slug: 'expensive' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 4_999,
          set_id: 'cheap',
        }),
        createCommerceSnapshot({
          best_price_minor: 5_000,
          set_id: 'expensive',
        }),
      ]) as never,
    });
    const under50Snapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'under-50',
    );

    expect(under50Snapshot?.items.map((item) => item.id)).toEqual(['cheap']);
  });

  test('paginates deal snapshots', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: 'a', slug: 'a' }),
          createCatalogSet({ setId: 'b', slug: 'b' }),
          createCatalogSet({ setId: 'c', slug: 'c' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      pageSize: 2,
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({ set_id: 'a' }),
        createCommerceSnapshot({ set_id: 'b' }),
        createCommerceSnapshot({ set_id: 'c' }),
      ]) as never,
    });

    expect(result.summaryBySortKey.recommended?.pageCount).toBe(2);
    expect(
      result.snapshots.filter((snapshot) => snapshot.sortKey === 'recommended'),
    ).toHaveLength(2);
  });

  test('dry-run does not write snapshots', async () => {
    const supabaseClient = createSupabaseClient([
      createCommerceSnapshot({ set_id: '10307' }),
    ]);
    const result = await syncDealPageSnapshots({
      dryRun: true,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet()]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: supabaseClient as never,
    });

    expect(result.upsertedCount).toBe(0);
    expect(supabaseClient.from).not.toHaveBeenCalledWith(
      'collection_page_snapshots',
    );
  });

  test('reports debug counters and rejection reasons for dry-run diagnosis', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: 'fresh', slug: 'fresh' }),
          createCatalogSet({ setId: 'stale', slug: 'stale' }),
          createCatalogSet({ setId: 'missing', slug: 'missing' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({ best_price_minor: 4_999, set_id: 'fresh' }),
        createCommerceSnapshot({
          best_checked_at: '2026-05-20T10:00:00.000Z',
          set_id: 'stale',
        }),
      ]) as never,
    });

    expect(result.debugCounters.snapshotRowsRead).toBe(2);
    expect(result.debugCounters.rowsWithBestOffer).toBe(2);
    expect(result.debugCounters.rowsWithInStockOffer).toBe(2);
    expect(result.debugCounters.rowsWithReferencePrice).toBe(2);
    expect(result.debugCounters.rowsWithDiscount).toBe(2);
    expect(result.debugCounters.rowsUnder50).toBe(1);
    expect(result.debugCounters.rowsWithPieces).toBe(3);
    expect(result.debugCounters.rowsRejectedByReason).toMatchObject({
      missing_snapshot: 1,
      stale_snapshot: 1,
    });
  });
});
