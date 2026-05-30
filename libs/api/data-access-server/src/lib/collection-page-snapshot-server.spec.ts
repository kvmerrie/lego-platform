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
          best_price_minor: 4999,
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
