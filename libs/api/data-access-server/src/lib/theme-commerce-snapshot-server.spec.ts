import { describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import {
  buildThemeCommerceSnapshots,
  syncThemeCommerceSnapshots,
  upsertThemeCommerceSnapshots,
  type ThemeCommerceCurrentOfferSnapshotRow,
  type ThemeCommercePublicThemeRow,
} from './theme-commerce-snapshot-server';

function createCatalogSet({
  name,
  pieces = 1200,
  setId,
  slug,
  themeSlug = 'icons',
}: {
  name: string;
  pieces?: number;
  setId: string;
  slug: string;
  themeSlug?: string;
}): CatalogCanonicalSet {
  return {
    createdAt: '2026-06-01T08:00:00.000Z',
    name,
    pieceCount: pieces,
    primaryTheme: themeSlug === 'icons' ? 'Icons' : 'Star Wars',
    publicTheme: {
      name: themeSlug === 'icons' ? 'Icons' : 'Star Wars',
      slug: themeSlug,
    },
    releaseYear: 2024,
    secondaryLabels: [],
    setId,
    slug,
    source: 'snapshot',
    status: 'active',
    updatedAt: '2026-06-01T08:00:00.000Z',
    imageUrl: `https://img.example/${setId}.jpg`,
  };
}

function createOfferRow({
  comparableOfferCount = 2,
  priceMinor,
  priceSpreadMinor = 1_500,
  setId,
}: {
  comparableOfferCount?: number;
  priceMinor: number;
  priceSpreadMinor?: number;
  setId: string;
}): ThemeCommerceCurrentOfferSnapshotRow {
  return {
    best_availability: 'in_stock',
    best_checked_at: '2026-06-15T08:00:00.000Z',
    best_merchant_name: 'Brickshop',
    best_merchant_slug: 'brickshop',
    best_price_minor: priceMinor,
    best_product_url: `https://merchant.example/${setId}`,
    comparable_offer_count: comparableOfferCount,
    computed_at: '2026-06-15T08:00:00.000Z',
    next_best_price_minor: priceMinor + priceSpreadMinor,
    offer_count: comparableOfferCount,
    price_spread_minor: priceSpreadMinor,
    set_id: setId,
    trusted_offer_count: 1,
  };
}

const publicThemes: ThemeCommercePublicThemeRow[] = [
  {
    display_name: 'Icons',
    is_public: true,
    public_display_name: 'LEGO Icons',
    slug: 'icons',
    status: 'active',
  },
  {
    display_name: 'Hidden',
    is_public: false,
    public_display_name: null,
    slug: 'hidden',
    status: 'active',
  },
];

describe('theme commerce snapshot builder', () => {
  test('builds compact theme commerce snapshots for public themes', async () => {
    const result = await buildThemeCommerceSnapshots({
      catalogSets: [
        createCatalogSet({
          name: 'Botanical Garden',
          setId: '10315',
          slug: 'botanical-garden-10315',
        }),
        createCatalogSet({
          name: 'Rivendell',
          pieces: 6167,
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
        }),
        createCatalogSet({
          name: 'X-wing Starfighter',
          setId: '75355',
          slug: 'x-wing-starfighter-75355',
          themeSlug: 'star-wars',
        }),
      ],
      currentOfferRows: [
        createOfferRow({
          priceMinor: 12_999,
          setId: '10315',
        }),
        createOfferRow({
          priceMinor: 42_999,
          priceSpreadMinor: 5_000,
          setId: '10316',
        }),
        createOfferRow({
          priceMinor: 19_999,
          setId: '75355',
        }),
      ],
      featuredDealLimit: 10,
      now: new Date('2026-06-15T08:00:00.000Z'),
      publicThemeRows: publicThemes,
    });

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      themeSlug: 'icons',
      stats: {
        totalSetCount: 2,
        pricedSetCount: 2,
        featuredDealCount: 2,
      },
    });
    expect(result.snapshots[0].featuredDeals.map((card) => card.setId)).toEqual(
      ['10316', '10315'],
    );
    expect(result.snapshots[0].featuredDeals[0]).toMatchObject({
      currentPriceMinor: 42_999,
      merchantName: 'Brickshop',
      merchantSlug: 'brickshop',
      setId: '10316',
    });
    expect(
      result.snapshots[0].browsePriceContextBySetId['10315'],
    ).toMatchObject({
      priceLabel: 'Vanaf € 129,99',
      merchantName: 'Brickshop',
      merchantSlug: 'brickshop',
      ctaUrl: 'https://merchant.example/10315',
    });
    expect(JSON.stringify(result.snapshots[0])).not.toContain('offers');
  });

  test('limits featured deals to 20 unique cards by default', async () => {
    const catalogSets = Array.from({ length: 25 }, (_, index) => {
      const setNumber = 10_000 + index;

      return createCatalogSet({
        name: `Icons Deal ${String(index + 1).padStart(2, '0')}`,
        pieces: 1000 + index,
        setId: String(setNumber),
        slug: `icons-deal-${setNumber}`,
      });
    });
    const [firstCatalogSet] = catalogSets;
    if (!firstCatalogSet) {
      throw new Error('Expected at least one catalog set in the fixture.');
    }
    const duplicateSet = {
      ...firstCatalogSet,
      slug: `${firstCatalogSet.slug}-duplicate`,
    };
    const result = await buildThemeCommerceSnapshots({
      catalogSets: [...catalogSets, duplicateSet],
      currentOfferRows: catalogSets.map((catalogSet, index) =>
        createOfferRow({
          priceMinor: 10_000 + index,
          priceSpreadMinor: 2_000 + index,
          setId: catalogSet.setId,
        }),
      ),
      now: new Date('2026-06-15T08:00:00.000Z'),
      publicThemeRows: publicThemes,
    });

    const featuredDeals = result.snapshots[0].featuredDeals;
    const featuredDealSetIds = featuredDeals.map((card) => card.setId);

    expect(featuredDeals).toHaveLength(20);
    expect(new Set(featuredDealSetIds).size).toBe(featuredDealSetIds.length);
    expect(result.snapshots[0].stats.featuredDealCount).toBe(20);
    expect(JSON.stringify(result.snapshots[0])).not.toContain('offers');
  });

  test('writes snapshots with the theme-commerce collection key', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      from: vi.fn(() => ({
        upsert,
      })),
    };
    const buildResult = await buildThemeCommerceSnapshots({
      catalogSets: [
        createCatalogSet({
          name: 'Rivendell',
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
        }),
      ],
      currentOfferRows: [
        createOfferRow({
          priceMinor: 42_999,
          setId: '10316',
        }),
      ],
      now: new Date('2026-06-15T08:00:00.000Z'),
      publicThemeRows: publicThemes,
    });

    await expect(
      upsertThemeCommerceSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      }),
    ).resolves.toBe(1);
    expect(supabaseClient.from).toHaveBeenCalledWith(
      'collection_page_snapshots',
    );
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          collection_slug: 'theme-commerce:icons',
          page: 1,
          page_size: 1,
          sort_key: 'intent-v1',
        }),
      ],
      {
        onConflict: 'collection_slug,sort_key,page,page_size',
      },
    );
  });

  test('logs Supabase details when snapshot write fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabaseClient = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: {
            code: '23502',
            details: 'Null value in column',
            hint: 'Check payload shape',
            message: 'insert failed',
          },
        }),
      })),
    };
    const buildResult = await buildThemeCommerceSnapshots({
      catalogSets: [
        createCatalogSet({
          name: 'Rivendell',
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
        }),
      ],
      currentOfferRows: [
        createOfferRow({
          priceMinor: 42_999,
          setId: '10316',
        }),
      ],
      now: new Date('2026-06-15T08:00:00.000Z'),
      publicThemeRows: publicThemes,
    });

    await expect(
      upsertThemeCommerceSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      }),
    ).rejects.toThrow('Unable to upsert theme commerce snapshots.');
    expect(errorSpy).toHaveBeenCalledWith(
      '[theme-commerce-snapshot] upsert_failed',
      expect.objectContaining({
        error: {
          code: '23502',
          details: 'Null value in column',
          hint: 'Check payload shape',
          message: 'insert failed',
        },
        samplePayloadShape: expect.objectContaining({
          collection_slug: 'theme-commerce:icons',
        }),
        snapshotCount: 1,
      }),
    );

    errorSpy.mockRestore();
  });

  test('sync builds snapshots before writing them', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      from: vi.fn(() => ({
        upsert,
      })),
    };

    const result = await syncThemeCommerceSnapshots({
      catalogSets: [
        createCatalogSet({
          name: 'Rivendell',
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
        }),
      ],
      currentOfferRows: [
        createOfferRow({
          priceMinor: 42_999,
          setId: '10316',
        }),
      ],
      dryRun: false,
      now: new Date('2026-06-15T08:00:00.000Z'),
      publicThemeRows: publicThemes,
      supabaseClient,
    });

    expect(result.upsertedCount).toBe(1);
    expect(result.summary.themeCount).toBe(1);
    expect(result.summary.payloadBytes).toBeGreaterThan(0);
  });
});
