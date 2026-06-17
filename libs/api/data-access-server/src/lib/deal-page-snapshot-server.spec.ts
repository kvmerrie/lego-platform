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

function createSupabaseClient(
  rows: readonly Record<string, unknown>[],
  presentationTitleRows: readonly Record<string, unknown>[] = [],
) {
  const upsertSnapshots = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === 'catalog_set_source_metadata') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    in: vi.fn().mockResolvedValue({
                      data: presentationTitleRows,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        };
      }

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
          upsert: upsertSnapshots,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    upsertSnapshots,
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
          pieceCount: 300,
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

  test('uses the shared Dutch Rakuten presentation title for deal cards', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'The Lord of the Rings: Rivendell',
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient(
        [
          createCommerceSnapshot({
            set_id: '10316',
          }),
        ],
        [
          {
            catalog_set_id: '10316',
            metadata_json: {
              title: 'In de ban van de ringen: Rivendel',
            },
          },
        ],
      ) as never,
    });

    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.items[0]).toMatchObject({
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      id: '10316',
      name: 'In de ban van de ringen: Rivendel',
      slug: 'the-lord-of-the-rings-rivendell-10316',
    });
  });

  test('builds the phase 2 deal categories from snapshot data', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Tiny Deal',
          pieceCount: 220,
          setId: 'under20',
          slug: 'tiny-deal',
        }),
        createCatalogSet({
          name: 'Premium Deal',
          pieceCount: 2200,
          primaryTheme: 'Icons',
          setId: 'premium',
          slug: 'premium-deal',
        }),
        createCatalogSet({
          name: 'Fresh Deal',
          pieceCount: 800,
          primaryTheme: 'Star Wars',
          setId: 'fresh',
          slug: 'fresh-deal',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 1_999,
          set_id: 'under20',
        }),
        createCommerceSnapshot({
          best_price_minor: 14_000,
          set_id: 'premium',
        }),
        createCommerceSnapshot({
          best_checked_at: '2026-05-31T09:00:00.000Z',
          best_price_minor: 6_000,
          set_id: 'fresh',
        }),
      ]) as never,
    });

    expect(result.summaryBySortKey['best-price-per-brick']?.totalCount).toBe(3);
    expect(result.summaryBySortKey['largest-discount']?.totalCount).toBe(3);
    expect(result.summaryBySortKey['under-20']?.totalCount).toBe(1);
    expect(result.summaryBySortKey['under-50']?.totalCount).toBe(1);
    expect(result.summaryBySortKey['premium-deals']?.totalCount).toBe(1);
    expect(result.summaryBySortKey['new-deals']?.totalCount).toBe(3);
  });

  test('largest-discount snapshots sort by discount percentage before savings', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([
          createCatalogSet({ setId: 'bigger-savings', slug: 'bigger-savings' }),
          createCatalogSet({ setId: 'higher-percent', slug: 'higher-percent' }),
        ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 15_000,
          offers: [
            {
              availability: 'in_stock',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 30_000,
            },
          ],
          set_id: 'bigger-savings',
        }),
        createCommerceSnapshot({
          best_price_minor: 4_000,
          offers: [
            {
              availability: 'in_stock',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 10_000,
            },
          ],
          set_id: 'higher-percent',
        }),
      ]) as never,
    });
    const largestDiscountSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'largest-discount',
    );

    expect(largestDiscountSnapshot?.items.map((item) => item.id)).toEqual([
      'higher-percent',
      'bigger-savings',
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
    expect(recommendedSnapshot?.items[0]?.recommendedDealScore).toEqual(
      expect.any(Number),
    );
    expect(recommendedSnapshot?.items[0]?.savingsVsLegoMinor).toBeUndefined();
    expect(
      recommendedSnapshot?.items[0]?.priceContext.discountMetric,
    ).toBeUndefined();
    expect(recommendedSnapshot?.items[0]?.priceContext.decisionLabel).toBe(
      'Beste prijs',
    );
  });

  test('excludes zero-piece sets from recommended deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Unknown Piece Count Deal',
          pieceCount: 0,
          setId: 'zero',
          slug: 'zero',
        }),
        createCatalogSet({
          name: 'Known Piece Count Deal',
          pieceCount: 1000,
          setId: 'known',
          slug: 'known',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({ set_id: 'zero' }),
        createCommerceSnapshot({ set_id: 'known' }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      'known',
    ]);
  });

  test('excludes sub-10-euro sets from recommended deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Cheap But Too Small',
          pieceCount: 200,
          setId: 'cheap',
          slug: 'cheap',
        }),
        createCatalogSet({
          name: 'Useful Deal',
          pieceCount: 400,
          setId: 'useful',
          slug: 'useful',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 995,
          set_id: 'cheap',
        }),
        createCommerceSnapshot({
          best_price_minor: 2_000,
          set_id: 'useful',
        }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      'useful',
    ]);
  });

  test('excludes polybags from price-per-brick deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'White Seaplane',
          pieceCount: 220,
          setId: '30736',
          slug: 'white-seaplane',
          sourceSetNumber: '30736-1',
        }),
        createCatalogSet({
          name: 'Real Boxed Value Set',
          pieceCount: 420,
          setId: 'boxed',
          slug: 'boxed',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 1_500,
          set_id: '30736',
        }),
        createCommerceSnapshot({
          best_price_minor: 2_000,
          set_id: 'boxed',
        }),
      ]) as never,
    });
    const pricePerBrickSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'price-per-brick',
    );

    expect(pricePerBrickSnapshot?.items.map((item) => item.id)).toEqual([
      'boxed',
    ]);
  });

  test('excludes promotional sets from recommended and price-per-brick deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Promotional Gift',
          pieceCount: 300,
          setId: '40524',
          slug: 'promotional-gift',
          sourceSetNumber: '40524-1',
        }),
        createCatalogSet({
          name: 'Regular Display Deal',
          pieceCount: 900,
          setId: 'regular',
          slug: 'regular',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 2_000,
          set_id: '40524',
        }),
        createCommerceSnapshot({
          best_price_minor: 4_000,
          set_id: 'regular',
        }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );
    const pricePerBrickSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'price-per-brick',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      'regular',
    ]);
    expect(pricePerBrickSnapshot?.items.map((item) => item.id)).toEqual([
      'regular',
    ]);
  });

  test('excludes football highlight sets from recommended deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Cristiano Ronaldo - Football Highlights',
          pieceCount: 490,
          primaryTheme: 'Other',
          setId: '43012',
          slug: 'cristiano-football-highlights',
        }),
        createCatalogSet({
          name: 'Porsche 911 GT3 RS Super Car',
          pieceCount: 355,
          primaryTheme: 'Speed Champions',
          setId: 'speed',
          slug: 'speed',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 2_000,
          set_id: '43012',
        }),
        createCommerceSnapshot({
          best_price_minor: 2_000,
          set_id: 'speed',
        }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      'speed',
    ]);
  });

  test('keeps premium display sets in recommended and premium deals', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Neuschwanstein Castle',
          pieceCount: 3455,
          primaryTheme: 'Architecture',
          setId: '21063',
          slug: 'neuschwanstein-castle',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 21_899,
          offers: [
            {
              availability: 'in_stock',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 26_999,
            },
          ],
          set_id: '21063',
        }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );
    const premiumSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'premium-deals',
    );

    expect(recommendedSnapshot?.items.map((item) => item.id)).toEqual([
      '21063',
    ]);
    expect(premiumSnapshot?.items.map((item) => item.id)).toEqual(['21063']);
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

  test('under-20 snapshots require enough pieces and a strong value signal', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
        createCatalogSet({
          name: 'Tiny Duplo Deal',
          pieceCount: 22,
          setId: 'tiny',
          slug: 'tiny',
        }),
        createCatalogSet({
          name: 'No Value Signal',
          pieceCount: 100,
          setId: 'weak',
          slug: 'weak',
        }),
        createCatalogSet({
          name: 'Good Under Twenty Deal',
          pieceCount: 220,
          setId: 'good',
          slug: 'good',
        }),
      ]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({
          best_price_minor: 1_895,
          set_id: 'tiny',
        }),
        createCommerceSnapshot({
          best_price_minor: 1_895,
          offers: [],
          set_id: 'weak',
        }),
        createCommerceSnapshot({
          best_price_minor: 1_895,
          set_id: 'good',
        }),
      ]) as never,
    });
    const under20Snapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'under-20',
    );

    expect(under20Snapshot?.items.map((item) => item.id)).toEqual(['good']);
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

  test('adds snapshot-level stats to each deal page snapshot', async () => {
    const result = await buildDealPageSnapshots({
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet({ setId: '10307' })]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: createSupabaseClient([
        createCommerceSnapshot({ set_id: '10307' }),
      ]) as never,
    });
    const recommendedSnapshot = result.snapshots.find(
      (snapshot) => snapshot.sortKey === 'recommended',
    );

    expect(recommendedSnapshot?.stats).toMatchObject({
      activeDealCount: 1,
      averageDiscountPercent: 33,
      highestDiscountPercent: 33,
      lowestPricePerBrickMinor: 10,
    });
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

  test('persists deal snapshots with items and stats in items_json', async () => {
    const supabaseClient = createSupabaseClient([
      createCommerceSnapshot({ set_id: '10307' }),
    ]);
    const result = await syncDealPageSnapshots({
      dryRun: false,
      listCanonicalCatalogSetsFn: vi
        .fn()
        .mockResolvedValue([createCatalogSet()]),
      now: new Date('2026-05-31T10:00:00.000Z'),
      supabaseClient: supabaseClient as never,
    });

    expect(result.upsertedCount).toBeGreaterThan(0);
    expect(supabaseClient.upsertSnapshots).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          items_json: expect.objectContaining({
            items: expect.any(Array),
            stats: expect.objectContaining({ activeDealCount: 1 }),
          }),
        }),
      ]),
      expect.any(Object),
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
