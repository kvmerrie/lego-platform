import { describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import {
  buildCollectionPageSnapshots,
  syncCollectionPageSnapshots,
} from './collection-page-snapshot-server';

const { listCanonicalCatalogSetsMock } = vi.hoisted(() => ({
  listCanonicalCatalogSetsMock: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-server', () => ({
  listCanonicalCatalogSets: listCanonicalCatalogSetsMock,
}));

function createCatalogSet(
  overrides: Partial<CatalogCanonicalSet> = {},
): CatalogCanonicalSet {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    imageUrl: 'https://example.com/set.jpg',
    name: 'Catalog Set',
    pieceCount: 100,
    primaryTheme: 'Icons',
    publicTheme: {
      accentColor: '#1f8ad1',
      name: 'Icons',
      slug: 'icons',
      surfaceColor: '#e8f4ff',
    },
    releaseDate: '2026-05-01',
    releaseDatePrecision: 'day',
    releaseYear: 2026,
    secondaryLabels: [],
    setId: '10000-1',
    slug: 'catalog-set-10000',
    source: 'rebrickable',
    sourceSetNumber: '10000',
    status: 'active',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createSupabaseClient({
  commerceSnapshots = [],
  sourceMetadata = [],
}: {
  commerceSnapshots?: readonly Record<string, unknown>[];
  sourceMetadata?: readonly Record<string, unknown>[];
}) {
  const upserts: Record<string, unknown>[][] = [];

  return {
    client: {
      from(table: string) {
        const state = {
          table,
        };

        return {
          eq() {
            return this;
          },
          in() {
            return this;
          },
          range() {
            return Promise.resolve({
              data:
                state.table === 'catalog_set_source_metadata'
                  ? sourceMetadata
                  : commerceSnapshots,
              error: null,
            });
          },
          select() {
            return this;
          },
          upsert(rows: Record<string, unknown>[]) {
            upserts.push(rows);

            return Promise.resolve({
              error: null,
            });
          },
        };
      },
      rpc: vi.fn(),
    },
    upserts,
  };
}

describe('collection page snapshots', () => {
  test('builds phase 1 collection pages with Brickset release and pieces fallback', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        pieceCount: 0,
        releaseDate: undefined,
        releaseDatePrecision: 'year',
        releaseYear: 2026,
        setId: '11380-1',
        slug: 'future-set-11380',
        sourceSetNumber: '11380',
      }),
    ]);
    const { client } = createSupabaseClient({
      sourceMetadata: [
        {
          catalog_set_id: '11380-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            launchDate: '2026-06-10',
            pieces: 123,
          },
          policy: 'render_publicly_with_attribution',
          set_number: '11380',
          source: 'brickset',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['nieuwe-lego-sets'],
      now: new Date('2026-05-30T00:00:00.000Z'),
      supabaseClient: client,
    });

    expect(result.summaryByCollectionSlug['nieuwe-lego-sets']?.totalCount).toBe(
      1,
    );
    expect(result.snapshots[0]?.items[0]?.pieces).toBe(123);
    expect(result.snapshots[0]?.items[0]?.publicTheme).toEqual(
      expect.objectContaining({
        slug: 'icons',
        surfaceColor: '#e8f4ff',
      }),
    );
  });

  test('keeps retiring snapshots released, near-term, and signal-backed', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '20000-1',
        slug: 'retiring-set-20000',
        sourceSetNumber: '20000',
      }),
      createCatalogSet({
        releaseDate: '2026-09-01',
        setId: '20001-1',
        slug: 'future-retiring-placeholder-20001',
        sourceSetNumber: '20001',
      }),
      createCatalogSet({
        releaseDate: '2025-01-01',
        setId: '20002-1',
        slug: 'far-future-retiring-set-20002',
        sourceSetNumber: '20002',
      }),
      createCatalogSet({
        pieceCount: 0,
        releaseDate: '2025-01-01',
        setId: '20003-1',
        slug: 'zero-piece-retiring-set-20003',
        sourceSetNumber: '20003',
      }),
      createCatalogSet({
        pieceCount: 0,
        releaseDate: '2025-01-01',
        setId: '20004-1',
        slug: 'brickset-pieces-retiring-set-20004',
        sourceSetNumber: '20004',
      }),
      createCatalogSet({
        releaseDate: undefined,
        releaseDatePrecision: 'year',
        releaseYear: 2026,
        setId: '20005-1',
        slug: 'year-only-retiring-placeholder-20005',
        sourceSetNumber: '20005',
      }),
      createCatalogSet({
        releaseDate: '2023-10-01',
        setId: '75355',
        slug: 'ucs-x-wing-starfighter-75355',
        sourceSetNumber: '75355',
      }),
    ]);
    const { client } = createSupabaseClient({
      sourceMetadata: [
        {
          catalog_set_id: '20000-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2026-09-01',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20000',
          source: 'brickset',
        },
        {
          catalog_set_id: '20001-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2027-01-01',
            launchDate: '2026-09-01',
            pieces: 120,
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20001',
          source: 'brickset',
        },
        {
          catalog_set_id: '20002-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2028-01-01',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20002',
          source: 'brickset',
        },
        {
          catalog_set_id: '20003-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2026-08-01',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20003',
          source: 'brickset',
        },
        {
          catalog_set_id: '20004-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2026-07-01',
            pieces: 500,
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20004',
          source: 'brickset',
        },
        {
          catalog_set_id: '20005-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            exitDate: '2026-10-01',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '20005',
          source: 'brickset',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['retiring-lego-sets'],
      now: new Date('2026-05-30T00:00:00.000Z'),
      supabaseClient: client,
    });

    expect(
      result.summaryByCollectionSlug['retiring-lego-sets']?.totalCount,
    ).toBe(3);
    expect(result.snapshots[0]?.items.map((item) => item.id)).toEqual([
      '20004-1',
      '20000-1',
      '75355',
    ]);
  });

  test('uses commerce current offer snapshots for under 50 euro', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '30000-1',
        slug: 'budget-set-30000',
        sourceSetNumber: '30000',
      }),
    ]);
    const { client } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_merchant_slug: 'brickfever',
          best_price_minor: 4999,
          best_product_url: 'https://example.com/brickfever/30000',
          comparable_offer_count: 2,
          offer_count: 3,
          price_spread_minor: 1200,
          set_id: '30000-1',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['lego-sets-onder-50-euro'],
      supabaseClient: client,
    });

    expect(
      result.summaryByCollectionSlug['lego-sets-onder-50-euro']?.totalCount,
    ).toBe(1);
    expect(result.snapshots[0]?.items[0]?.priceContext?.currentPrice).toBe(
      'Vanaf € 49,99',
    );
    expect(result.snapshots[0]?.items[0]?.commerce).toEqual({
      setId: '30000-1',
      slug: 'budget-set-30000',
      currentPriceMinor: 4999,
      merchantName: 'Brickfever',
      merchantSlug: 'brickfever',
      dealLabel: 'Beste marktprijs',
      confidenceLabel: '3 vergeleken winkels',
      primaryActionHref: 'https://example.com/brickfever/30000',
      commerceIntent: 'merchant',
    });
    expect(result.snapshots[0]?.items[0]?.priceContext).toMatchObject({
      commerceIntent: 'merchant',
      confidenceLabel: '3 vergeleken winkels',
      currentPriceMinor: 4999,
      dealLabel: 'Beste marktprijs',
      merchantName: 'Brickfever',
      merchantSlug: 'brickfever',
      primaryActionHref: 'https://example.com/brickfever/30000',
    });
    expect(JSON.stringify(result.snapshots[0]?.items[0])).not.toContain(
      '"offers"',
    );
    expect(JSON.stringify(result.snapshots[0]?.items[0])).not.toContain(
      '"rankedOffers"',
    );
  });

  test('uses commerce current offer snapshots for under 100 euro', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '30000-1',
        slug: 'budget-set-30000',
        sourceSetNumber: '30000',
      }),
      createCatalogSet({
        setId: '30001-1',
        slug: 'too-expensive-set-30001',
        sourceSetNumber: '30001',
      }),
    ]);
    const { client } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_merchant_slug: 'brickfever',
          best_price_minor: 9999,
          best_product_url: 'https://example.com/brickfever/30000',
          set_id: '30000-1',
        },
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_price_minor: 10001,
          set_id: '30001-1',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['lego-sets-onder-100-euro'],
      supabaseClient: client,
    });

    expect(
      result.summaryByCollectionSlug['lego-sets-onder-100-euro']?.totalCount,
    ).toBe(1);
    expect(result.snapshots[0]?.collectionSlug).toBe(
      'lego-sets-onder-100-euro',
    );
    expect(result.snapshots[0]?.items[0]?.id).toBe('30000-1');
    expect(result.snapshots[0]?.items[0]?.priceContext?.currentPrice).toBe(
      'Vanaf € 99,99',
    );
    expect(result.snapshots[0]?.items[0]?.commerce?.commerceIntent).toBe(
      'merchant',
    );
  });

  test('stores setdetail commerce intent for discovery-first collection snapshots', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '31000-1',
        slug: 'new-set-31000',
        sourceSetNumber: '31000',
      }),
    ]);
    const { client } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_merchant_slug: 'brickfever',
          best_price_minor: 5999,
          best_product_url: 'https://example.com/brickfever/31000',
          set_id: '31000-1',
        },
      ],
      sourceMetadata: [
        {
          catalog_set_id: '31000-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            launchDate: '2026-06-10',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '31000',
          source: 'brickset',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['nieuwe-lego-sets'],
      now: new Date('2026-05-30T00:00:00.000Z'),
      supabaseClient: client,
    });

    expect(result.snapshots[0]?.items[0]?.commerce).toEqual(
      expect.objectContaining({
        commerceIntent: 'setdetail',
        currentPriceMinor: 5999,
        merchantName: 'Brickfever',
        primaryActionHref: 'https://example.com/brickfever/31000',
      }),
    );
  });

  test('stores follow commerce intent when a priced collection card has no merchant click route', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '32000-1',
        slug: 'follow-set-32000',
        sourceSetNumber: '32000',
      }),
    ]);
    const { client } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_merchant_slug: 'brickfever',
          best_price_minor: 3999,
          best_product_url: null,
          set_id: '32000-1',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['lego-sets-onder-50-euro'],
      supabaseClient: client,
    });

    expect(result.snapshots[0]?.items[0]?.commerce).toEqual(
      expect.objectContaining({
        commerceIntent: 'follow',
        currentPriceMinor: 3999,
        followRecommended: true,
      }),
    );
    expect(result.snapshots[0]?.items[0]?.commerce).not.toHaveProperty(
      'primaryActionHref',
    );
  });

  test('builds adult collector snapshots from Brickset adult signals', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        name: 'Icons Display Set',
        pieceCount: 1800,
        primaryTheme: 'Icons',
        releaseDate: '2025-01-01',
        releaseYear: 2025,
        setId: '40000-1',
        slug: 'icons-display-set-40000',
        sourceSetNumber: '40000',
      }),
      createCatalogSet({
        name: 'Architecture Landmark',
        pieceCount: 900,
        primaryTheme: 'Architecture',
        releaseDate: '2024-01-01',
        releaseYear: 2024,
        setId: '40001-1',
        slug: 'architecture-landmark-40001',
        sourceSetNumber: '40001',
      }),
      createCatalogSet({
        name: 'Duplo Preschool Vehicle',
        pieceCount: 2500,
        primaryTheme: 'DUPLO',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40002-1',
        slug: 'duplo-preschool-vehicle-40002',
        sourceSetNumber: '40002',
      }),
      createCatalogSet({
        name: 'Large Generic Playset',
        pieceCount: 2200,
        primaryTheme: 'City',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40003-1',
        slug: 'large-generic-playset-40003',
        sourceSetNumber: '40003',
      }),
      createCatalogSet({
        name: 'Birthday Bear',
        pieceCount: 150,
        primaryTheme: 'Seasonal',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40004-1',
        slug: 'birthday-bear-40004',
        sourceSetNumber: '40004',
      }),
      createCatalogSet({
        name: 'Cute Animal Birthday Party',
        pieceCount: 280,
        primaryTheme: 'Creator 3-in-1',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40005-1',
        slug: 'cute-animal-birthday-party-40005',
        sourceSetNumber: '40005',
      }),
      createCatalogSet({
        name: 'Cataclaws Snow Adventure',
        pieceCount: 300,
        primaryTheme: 'Seasonal',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40006-1',
        slug: 'cataclaws-snow-adventure-40006',
        sourceSetNumber: '40006',
      }),
      createCatalogSet({
        name: 'Cute Easter Bunny',
        pieceCount: 326,
        primaryTheme: 'Creator 3-in-1',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40007-1',
        slug: 'cute-easter-bunny-40007',
        sourceSetNumber: '40007',
      }),
      createCatalogSet({
        name: 'Tiny Botanical Display',
        pieceCount: 180,
        primaryTheme: 'Botanicals',
        releaseDate: '2024-01-01',
        releaseYear: 2024,
        setId: '40008-1',
        slug: 'tiny-botanical-display-40008',
        sourceSetNumber: '40008',
      }),
      createCatalogSet({
        name: 'Low Price Display Trinket',
        pieceCount: 320,
        primaryTheme: 'City',
        releaseDate: '2026-01-01',
        releaseYear: 2026,
        setId: '40009-1',
        slug: 'low-price-display-trinket-40009',
        sourceSetNumber: '40009',
      }),
    ]);
    const { client } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_price_minor: 1_999,
          set_id: '40009-1',
        },
      ],
      sourceMetadata: [
        {
          catalog_set_id: '40000-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['18 Plus', 'D2C'],
            theme: 'Icons',
            themeGroup: 'Model making',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40000',
          source: 'brickset',
        },
        {
          catalog_set_id: '40001-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Landmarks'],
            theme: 'Architecture',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40001',
          source: 'brickset',
        },
        {
          catalog_set_id: '40002-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Architecture', 'Vehicle', 'Art'],
            theme: 'DUPLO',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40002',
          source: 'brickset',
        },
        {
          catalog_set_id: '40004-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Vehicle'],
            theme: 'Seasonal',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40004',
          source: 'brickset',
        },
        {
          catalog_set_id: '40005-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Art', 'Vehicle', 'Display Stand'],
            theme: 'Creator 3-in-1',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40005',
          source: 'brickset',
        },
        {
          catalog_set_id: '40006-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Display Stand'],
            theme: 'Seasonal',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40006',
          source: 'brickset',
        },
        {
          catalog_set_id: '40007-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['Art', 'Architecture', 'Vehicle'],
            theme: 'Creator 3-in-1',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40007',
          source: 'brickset',
        },
        {
          catalog_set_id: '40008-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            subtheme: 'Botanical Collection',
            tags: ['Botanical'],
            theme: 'Botanicals',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40008',
          source: 'brickset',
        },
        {
          catalog_set_id: '40009-1',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            tags: ['D2C', 'Display Stand', 'Landmarks', 'Architecture', 'Art'],
            theme: 'City',
          },
          policy: 'render_publicly_with_attribution',
          set_number: '40009',
          source: 'brickset',
        },
      ],
    });

    const result = await buildCollectionPageSnapshots({
      collectionSlugs: ['lego-voor-volwassenen'],
      supabaseClient: client,
    });

    expect(
      result.summaryByCollectionSlug['lego-voor-volwassenen']?.totalCount,
    ).toBe(3);
    expect(result.snapshots[0]?.items.map((item) => item.id)).toEqual([
      '40000-1',
      '40001-1',
      '40008-1',
    ]);
    expect(result.snapshots[0]?.items[0]).toEqual(
      expect.objectContaining({
        adultCollectorScore: expect.any(Number),
      }),
    );
  });

  test('dry-run does not upsert and write-run upserts snapshot rows', async () => {
    listCanonicalCatalogSetsMock.mockResolvedValue([
      createCatalogSet({
        setId: '30000-1',
        slug: 'budget-set-30000',
        sourceSetNumber: '30000',
      }),
    ]);
    const { client, upserts } = createSupabaseClient({
      commerceSnapshots: [
        {
          best_availability: 'in_stock',
          best_merchant_name: 'Brickfever',
          best_price_minor: 4999,
          set_id: '30000-1',
        },
      ],
    });

    await syncCollectionPageSnapshots({
      collectionSlugs: ['lego-sets-onder-50-euro'],
      dryRun: true,
      supabaseClient: client,
    });

    expect(upserts).toHaveLength(0);

    await syncCollectionPageSnapshots({
      collectionSlugs: ['lego-sets-onder-50-euro'],
      dryRun: false,
      supabaseClient: client,
    });

    expect(upserts.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection_slug: 'lego-sets-onder-50-euro',
          page: 1,
          page_size: 40,
        }),
      ]),
    );
  });
});
