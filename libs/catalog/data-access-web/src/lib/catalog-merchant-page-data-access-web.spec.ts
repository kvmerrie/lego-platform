import { describe, expect, test } from 'vitest';
import {
  getActiveCommerceMerchantsOverview,
  getMerchantDeals,
} from './catalog-merchant-page-data-access-web';

type InMemoryTables = Record<string, Record<string, unknown>[]>;

type InMemoryFilter = {
  column: string;
  type: 'eq';
  value: unknown;
};

function createInMemoryTableBuilder(rows: readonly Record<string, unknown>[]) {
  const filters: InMemoryFilter[] = [];
  const orders: Array<{ ascending: boolean; column: string }> = [];

  function readRows() {
    const filteredRows = filters.reduce<readonly Record<string, unknown>[]>(
      (resultRows, filter) =>
        resultRows.filter((row) => row[filter.column] === filter.value),
      rows,
    );

    return [...filteredRows].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.column];
        const rightValue = right[order.column];
        const comparison = String(leftValue ?? '').localeCompare(
          String(rightValue ?? ''),
          'nl-NL',
        );

        if (comparison !== 0) {
          return order.ascending ? comparison : -comparison;
        }
      }

      return 0;
    });
  }

  const builder = {
    eq(column: string, value: unknown) {
      filters.push({
        column,
        type: 'eq',
        value,
      });

      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      orders.push({
        ascending: options?.ascending ?? true,
        column,
      });

      return builder;
    },
    range(from: number, to: number) {
      return Promise.resolve({
        data: readRows().slice(from, to + 1),
        error: null,
      });
    },
    select() {
      return builder;
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
      return Promise.resolve({
        data: readRows(),
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createSupabaseClient(tables: InMemoryTables) {
  return {
    from(table: string) {
      return createInMemoryTableBuilder(tables[table] ?? []);
    },
  };
}

function merchantRow({
  active = true,
  id,
  name,
  slug,
}: {
  active?: boolean;
  id: string;
  name: string;
  slug: string;
}) {
  return {
    affiliate_network: 'awin',
    created_at: '2026-06-12T09:00:00.000Z',
    id,
    is_active: active,
    name,
    notes: '',
    slug,
    source_type: 'affiliate',
    updated_at: '2026-06-12T09:00:00.000Z',
  };
}

function setCard({ id = '10316', name = 'Rivendell' } = {}) {
  return {
    id,
    imageUrl: `https://images.example/${id}.jpg`,
    name,
    pieces: 6167,
    releaseYear: 2023,
    slug: `${name.toLowerCase().replaceAll(' ', '-')}-${id}`,
    theme: 'Icons',
  };
}

function snapshotDeal({
  merchantName = 'Goodbricks',
  merchantSlug = 'goodbricks',
  nextBestMerchantName = 'LEGO',
  nextBestMerchantSlug = 'lego',
  priceMinor = 9_000,
  savingsMinor = 1_000,
  savingsPercentage = 10,
  setId = '10316',
} = {}) {
  return {
    checkedAt: '2026-06-12T10:00:00.000Z',
    comparedMerchantCount: 2,
    currencyCode: 'EUR',
    latestOfferId: `seed-${merchantSlug}-${setId}`,
    merchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: `merchant-${merchantSlug}`,
      isActive: true,
      name: merchantName,
      notes: '',
      slug: merchantSlug,
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    nextBestMerchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: `merchant-${nextBestMerchantSlug}`,
      isActive: true,
      name: nextBestMerchantName,
      notes: '',
      slug: nextBestMerchantSlug,
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    nextBestPriceMinor: priceMinor + savingsMinor,
    offerSeedId: `seed-${merchantSlug}-${setId}`,
    priceMinor,
    productUrl: `https://${merchantSlug}.example/${setId}`,
    savingsMinor,
    savingsPercentage,
    set: setCard({ id: setId }),
  };
}

function merchantSnapshotRow({
  bestDeals = [snapshotDeal()],
  merchantName = 'Goodbricks',
  merchantSlug = 'goodbricks',
  onlyAtMerchantDeals = [],
}: {
  bestDeals?: unknown[];
  merchantName?: string;
  merchantSlug?: string;
  onlyAtMerchantDeals?: unknown[];
} = {}) {
  return {
    generated_at: '2026-06-12T10:15:00.000Z',
    merchant_id: `merchant-${merchantSlug}`,
    merchant_name: merchantName,
    merchant_slug: merchantSlug,
    snapshot: {
      bestDealCount: bestDeals.length,
      bestDeals,
      dealCount: bestDeals.length + onlyAtMerchantDeals.length,
      lastFetchedAt: '2026-06-12T10:00:00.000Z',
      merchant: {
        createdAt: '2026-06-12T09:00:00.000Z',
        id: `merchant-${merchantSlug}`,
        isActive: true,
        name: merchantName,
        notes: '',
        slug: merchantSlug,
        sourceType: 'affiliate',
        updatedAt: '2026-06-12T09:00:00.000Z',
      },
      offerCount: 8,
      onlyAtMerchantDealCount: onlyAtMerchantDeals.length,
      onlyAtMerchantDeals,
      version: 1,
    },
    source_version: 'merchant_page_snapshot_v1',
  };
}

function createMerchantSnapshotTables(
  overrides: Partial<InMemoryTables> = {},
): InMemoryTables {
  return {
    commerce_merchant_page_snapshots: [merchantSnapshotRow()],
    commerce_merchants: [
      merchantRow({
        id: 'merchant-goodbricks',
        name: 'Goodbricks',
        slug: 'goodbricks',
      }),
      merchantRow({
        id: 'merchant-bol',
        name: 'bol',
        slug: 'bol',
      }),
    ],
    ...overrides,
  };
}

describe('commerce merchant page snapshot reader', () => {
  test('reads merchant deals from precomputed snapshots', async () => {
    const result = await getMerchantDeals('goodbricks', {
      supabaseClient: createSupabaseClient(
        createMerchantSnapshotTables(),
      ) as never,
    });

    expect(result).toMatchObject({
      bestDealCount: 1,
      dealCount: 1,
      merchant: {
        slug: 'goodbricks',
      },
      offerCount: 8,
      snapshotMissing: false,
    });
    expect(result?.comparableDeals[0]).toMatchObject({
      nextBestPriceMinor: 10_000,
      priceMinor: 9_000,
      productUrl: 'https://goodbricks.example/10316',
      savingsMinor: 1_000,
    });
  });

  test('handles missing snapshots with a lightweight empty result', async () => {
    const result = await getMerchantDeals('bol', {
      supabaseClient: createSupabaseClient(
        createMerchantSnapshotTables({
          commerce_merchant_page_snapshots: [],
        }),
      ) as never,
    });

    expect(result).toMatchObject({
      bestDealCount: 0,
      comparableDeals: [],
      dealCount: 0,
      onlyAtMerchantDeals: [],
      snapshotMissing: true,
    });
  });

  test('excludes inactive merchants from overview and detail', async () => {
    const tables = createMerchantSnapshotTables({
      commerce_merchant_page_snapshots: [
        merchantSnapshotRow({
          merchantName: 'Inactive Shop',
          merchantSlug: 'inactive-shop',
        }),
      ],
      commerce_merchants: [
        merchantRow({
          active: false,
          id: 'merchant-inactive-shop',
          name: 'Inactive Shop',
          slug: 'inactive-shop',
        }),
        merchantRow({
          id: 'merchant-goodbricks',
          name: 'Goodbricks',
          slug: 'goodbricks',
        }),
      ],
    });

    const overview = await getActiveCommerceMerchantsOverview({
      supabaseClient: createSupabaseClient(tables) as never,
    });

    expect(overview.map((item) => item.merchant.slug)).toEqual(['goodbricks']);
    await expect(
      getMerchantDeals('inactive-shop', {
        supabaseClient: createSupabaseClient(tables) as never,
      }),
    ).resolves.toBeNull();
  });

  test('keeps rakuten LEGO visible and hides inactive legacy LEGO merchants', async () => {
    const tables = createMerchantSnapshotTables({
      commerce_merchant_page_snapshots: [
        merchantSnapshotRow({
          bestDeals: [
            snapshotDeal({
              merchantName: 'LEGO',
              merchantSlug: 'rakuten-lego-eu',
              nextBestMerchantName: 'Goodbricks',
              nextBestMerchantSlug: 'goodbricks',
            }),
          ],
          merchantName: 'LEGO',
          merchantSlug: 'rakuten-lego-eu',
        }),
        merchantSnapshotRow({
          merchantName: 'LEGO',
          merchantSlug: 'lego-nl',
        }),
        merchantSnapshotRow({
          merchantName: 'Top1Toys',
          merchantSlug: 'top1toys',
        }),
      ],
      commerce_merchants: [
        merchantRow({
          id: 'merchant-rakuten-lego-eu',
          name: 'LEGO',
          slug: 'rakuten-lego-eu',
        }),
        merchantRow({
          active: false,
          id: 'merchant-lego-nl',
          name: 'LEGO',
          slug: 'lego-nl',
        }),
        merchantRow({
          active: false,
          id: 'merchant-top1toys',
          name: 'Top1Toys',
          slug: 'top1toys',
        }),
      ],
    });

    const overview = await getActiveCommerceMerchantsOverview({
      supabaseClient: createSupabaseClient(tables) as never,
    });

    expect(overview.map((item) => item.merchant.slug)).toEqual([
      'rakuten-lego-eu',
    ]);
    await expect(
      getMerchantDeals('lego-nl', {
        supabaseClient: createSupabaseClient(tables) as never,
      }),
    ).resolves.toBeNull();
    await expect(
      getMerchantDeals('rakuten-lego-eu', {
        supabaseClient: createSupabaseClient(tables) as never,
      }),
    ).resolves.toMatchObject({
      merchant: {
        slug: 'rakuten-lego-eu',
      },
      snapshotMissing: false,
    });
  });

  test('builds overview from snapshot counts and preview deals', async () => {
    const onlyAtDeal = {
      ...snapshotDeal({
        merchantName: 'bol',
        merchantSlug: 'bol',
        priceMinor: 12_000,
        savingsMinor: 0,
        savingsPercentage: 0,
        setId: '75355',
      }),
      nextBestMerchant: undefined,
      nextBestPriceMinor: undefined,
      savingsMinor: undefined,
      savingsPercentage: undefined,
      set: setCard({
        id: '75355',
        name: 'X-wing Starfighter',
      }),
    };
    const tables = createMerchantSnapshotTables({
      commerce_merchant_page_snapshots: [
        merchantSnapshotRow(),
        merchantSnapshotRow({
          bestDeals: [],
          merchantName: 'bol',
          merchantSlug: 'bol',
          onlyAtMerchantDeals: [onlyAtDeal],
        }),
      ],
    });

    const overview = await getActiveCommerceMerchantsOverview({
      supabaseClient: createSupabaseClient(tables) as never,
    });

    expect(overview.map((item) => item.merchant.slug)).toEqual([
      'goodbricks',
      'bol',
    ]);
    expect(overview[0]).toMatchObject({
      bestSavingsMinor: 1_000,
      dealCount: 1,
      previewDeals: [expect.objectContaining({ priceMinor: 9_000 })],
    });
    expect(overview[1]).toMatchObject({
      dealCount: 1,
      onlyAtMerchantDealCount: 1,
      previewDeals: [expect.objectContaining({ priceMinor: 12_000 })],
    });
  });
});
