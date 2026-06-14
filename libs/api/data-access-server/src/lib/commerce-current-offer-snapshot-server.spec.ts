import type { CatalogCurrentOfferSummaryRecord } from '@lego-platform/catalog/data-access-server';
import type { CommerceRefreshSeed } from '@lego-platform/commerce/data-access-server';
import { describe, expect, test, vi } from 'vitest';
import {
  buildCommerceCurrentOfferSnapshots,
  COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE,
  upsertCommerceCurrentOfferSnapshots,
} from './commerce-current-offer-snapshot-server';

const now = new Date('2026-05-19T09:00:00.000Z');

function buildSeed({
  availability = 'in_stock',
  fetchStatus = 'success',
  isActive = true,
  merchantId = 'merchant-goodbricks',
  merchantName = 'Goodbricks',
  merchantSlug = 'goodbricks',
  notes = '',
  observedAt = '2026-05-19T08:00:00.000Z',
  priceMinor = 19995,
  productUrl = 'https://example.com/lego-43300',
  seedId = 'seed-goodbricks-43300',
  setId = '43300',
  validationStatus = 'valid',
}: {
  availability?: string;
  fetchStatus?: CommerceRefreshSeed['offerSeed']['latestOffer']['fetchStatus'];
  isActive?: boolean;
  merchantId?: string;
  merchantName?: string;
  merchantSlug?: string;
  notes?: string;
  observedAt?: string;
  priceMinor?: number;
  productUrl?: string;
  seedId?: string;
  setId?: string;
  validationStatus?: CommerceRefreshSeed['offerSeed']['validationStatus'];
} = {}): CommerceRefreshSeed {
  return {
    merchant: {
      createdAt: '2026-05-01T00:00:00.000Z',
      id: merchantId,
      isActive: isActive,
      name: merchantName,
      notes: '',
      slug: merchantSlug,
      sourceType: 'affiliate',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    offerSeed: {
      createdAt: '2026-05-01T00:00:00.000Z',
      id: seedId,
      isActive,
      latestOffer: {
        availability,
        createdAt: '2026-05-01T00:00:00.000Z',
        currencyCode: 'EUR',
        fetchedAt: observedAt,
        fetchStatus,
        id: `latest-${seedId}`,
        merchantId,
        observedAt,
        offerSeedId: seedId,
        priceMinor,
        productUrl,
        setId,
        updatedAt: observedAt,
      },
      merchantId,
      notes,
      productUrl,
      setId,
      updatedAt: '2026-05-01T00:00:00.000Z',
      validationStatus,
    },
  };
}

describe('commerce current-offer snapshots', () => {
  test('builds one snapshot per set and selects the same best offer as cards/detail', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Coppenswarenhuis',
          merchantSlug: 'coppenswarenhuis',
          priceMinor: 22499,
          seedId: 'seed-coppens-76454',
          setId: '76454',
        }),
        buildSeed({
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          priceMinor: 20900,
          seedId: 'seed-misterbricks-76454',
          setId: '76454',
        }),
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceMinor: 19995,
          seedId: 'seed-goodbricks-76454',
          setId: '76454',
        }),
      ],
    });

    expect(result.summary).toMatchObject({
      currentOfferSnapshotsBuilt: 1,
      snapshotMissingBestOfferCount: 0,
      snapshotOfferCount: 3,
    });
    expect(result.snapshots[0]).toMatchObject({
      bestMerchantSlug: 'goodbricks',
      bestPriceMinor: 19995,
      nextBestPriceMinor: 20900,
      offerCount: 3,
      priceSpreadMinor: 2504,
      setId: '76454',
      strategicManualOfferCount: 1,
      trustedOfferCount: 2,
    });
  });

  test('lets a lower current price beat trusted snapshot ranking', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Coppenswarenhuis',
          merchantSlug: 'coppenswarenhuis',
          priceMinor: 19895,
          seedId: 'seed-coppens-43300',
        }),
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceMinor: 19995,
          seedId: 'seed-goodbricks-43300',
        }),
      ],
    });

    expect(result.snapshots[0]?.bestMerchantSlug).toBe('coppenswarenhuis');
    expect(result.snapshots[0]?.bestPriceMinor).toBe(19895);
  });

  test('allows an extreme strategic manual price advantage to surface', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Coppenswarenhuis',
          merchantSlug: 'coppenswarenhuis',
          priceMinor: 14995,
          seedId: 'seed-coppens-43300',
        }),
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceMinor: 19995,
          seedId: 'seed-goodbricks-43300',
        }),
      ],
    });

    expect(result.snapshots[0]?.bestMerchantSlug).toBe('coppenswarenhuis');
    expect(result.snapshots[0]?.bestPriceMinor).toBe(14995);
  });

  test('excludes stale error and unavailable latest rows from snapshot offers', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          fetchStatus: 'error',
          merchantSlug: 'goodbricks',
          seedId: 'seed-error',
          setId: '43300',
        }),
        buildSeed({
          fetchStatus: 'unavailable',
          merchantSlug: 'misterbricks',
          seedId: 'seed-unavailable',
          setId: '43300',
        }),
        buildSeed({
          isActive: false,
          merchantSlug: 'alternate',
          seedId: 'seed-inactive',
          setId: '43300',
        }),
      ],
    });

    expect(result.snapshots[0]).toMatchObject({
      offerCount: 0,
      setId: '43300',
    });
    expect(result.snapshots[0]).not.toHaveProperty('bestPriceMinor');
    expect(result.summary.snapshotMissingBestOfferCount).toBe(1);
  });

  test('keeps unavailable success rows visible but does not select them as best offer', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          availability: 'out_of_stock',
          priceMinor: 9995,
          seedId: 'seed-out-of-stock',
        }),
      ],
    });

    expect(result.snapshots[0]).toMatchObject({
      offerCount: 1,
    });
    expect(result.snapshots[0]).not.toHaveProperty('bestPriceMinor');
    expect(result.snapshots[0]?.offers[0]).toMatchObject({
      availability: 'out_of_stock',
      priceMinor: 9995,
    });
  });

  test('does not use blind-bag offers to create display-box price spreads', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Coppenswarenhuis',
          merchantSlug: 'coppenswarenhuis',
          notes: 'LEGO Minifigures single blind bag',
          priceMinor: 359,
          productUrl: 'https://example.com/lego-71050-blind-bag',
          seedId: 'seed-coppens-71050',
          setId: '71050',
        }),
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          notes: 'LEGO Minifigures random box complete set display',
          priceMinor: 5995,
          productUrl: 'https://example.com/lego-71050-random-box',
          seedId: 'seed-goodbricks-71050',
          setId: '71050',
        }),
      ],
    });

    expect(result.snapshots[0]).toMatchObject({
      bestMerchantSlug: 'goodbricks',
      bestPriceMinor: 5995,
      comparableOfferCount: 1,
      hasAnomalousSpread: true,
      nextBestPriceMinor: undefined,
      priceSpreadMinor: 0,
    });
  });

  test('reports best-offer parity mismatches against live summaries', () => {
    const liveSummaries: CatalogCurrentOfferSummaryRecord[] = [
      {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-05-19T08:00:00.000Z',
          commercialUnitType: 'full_set',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          priceCents: 20900,
          setId: '76454',
          url: 'https://example.com/lego-76454-misterbricks',
        },
        offers: [],
        setId: '76454',
      },
    ];

    const result = buildCommerceCurrentOfferSnapshots({
      liveSummaries,
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceMinor: 19995,
          productUrl: 'https://example.com/lego-76454-goodbricks',
          seedId: 'seed-goodbricks-76454',
          setId: '76454',
        }),
      ],
    });

    expect(result.summary.liveSummaryCount).toBe(1);
    expect(result.summary.snapshotBestOfferMismatchCount).toBe(1);
    expect(result.summary.bestOfferMismatchSample).toEqual([
      expect.objectContaining({
        liveMerchantSlug: 'misterbricks',
        reason: 'best_offer_mismatch',
        setId: '76454',
        snapshotMerchantSlug: 'goodbricks',
      }),
    ]);
  });

  test('does not count missing live summaries or missing snapshot best offers as best-offer mismatches', () => {
    const liveSummaries: CatalogCurrentOfferSummaryRecord[] = [
      {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-05-19T08:00:00.000Z',
          commercialUnitType: 'full_set',
          condition: 'new',
          currency: 'EUR',
          market: 'NL',
          merchant: 'other',
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceCents: 19995,
          setId: '76455',
          url: 'https://example.com/lego-76455-goodbricks',
        },
        offers: [],
        setId: '76455',
      },
    ];

    const result = buildCommerceCurrentOfferSnapshots({
      liveSummaries,
      now,
      syncSeeds: [
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          priceMinor: 19995,
          productUrl: 'https://example.com/lego-76454-goodbricks',
          seedId: 'seed-goodbricks-76454',
          setId: '76454',
        }),
        buildSeed({
          availability: 'out_of_stock',
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          priceMinor: 20900,
          productUrl: 'https://example.com/lego-76455-misterbricks',
          seedId: 'seed-misterbricks-76455',
          setId: '76455',
        }),
      ],
    });

    expect(result.summary.snapshotBestOfferMismatchCount).toBe(0);
    expect(result.summary.snapshotMissingLiveSummaryCount).toBe(1);
    expect(result.summary.missingLiveSummarySample).toEqual([
      expect.objectContaining({
        reason: 'missing_live_due_to_unknown',
        setId: '76454',
        snapshotMerchantSlug: 'goodbricks',
      }),
    ]);
    expect(result.summary.missingLiveSummaryReasonCounts).toEqual({
      missing_live_due_to_unknown: 1,
    });
    expect(result.summary.snapshotMissingBestOfferCount).toBe(1);
    expect(result.summary.snapshotMissingBestOfferSample).toEqual([
      expect.objectContaining({
        liveMerchantSlug: 'goodbricks',
        reason: 'snapshot_missing_best_offer_but_live_has_best',
        setId: '76455',
      }),
    ]);
  });

  test('labels missing live summaries by likely scope reason', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      liveSummaries: [],
      now,
      publicSetIds: ['76454'],
      syncSeeds: [
        buildSeed({
          merchantName: 'Top1Toys',
          merchantSlug: 'top1toys',
          priceMinor: 19995,
          productUrl: 'https://example.com/lego-10280-top1toys',
          seedId: 'seed-top1toys-10280',
          setId: '10280',
        }),
        buildSeed({
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
          notes: 'LEGO Minifigures single blind bag',
          priceMinor: 359,
          productUrl: 'https://example.com/lego-76454-blind-bag',
          seedId: 'seed-goodbricks-76454',
          setId: '76454',
        }),
        buildSeed({
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          observedAt: '2026-04-01T08:00:00.000Z',
          priceMinor: 20900,
          productUrl: 'https://example.com/lego-76455-misterbricks',
          seedId: 'seed-misterbricks-76455',
          setId: '76455',
        }),
      ],
    });

    expect(result.summary.snapshotMissingLiveSummaryCount).toBe(3);
    expect(result.summary.missingLiveSummaryReasonCounts).toEqual({
      missing_live_due_to_set_scope: 2,
      missing_live_due_to_unit: 1,
    });
    expect(result.summary.missingLiveSummarySample).toEqual([
      expect.objectContaining({
        reason: 'missing_live_due_to_set_scope',
        setId: '10280',
      }),
      expect.objectContaining({
        reason: 'missing_live_due_to_unit',
        setId: '76454',
      }),
      expect.objectContaining({
        reason: 'missing_live_due_to_set_scope',
        setId: '76455',
      }),
    ]);
  });

  test('upserts snapshots using the composite snapshot key', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [buildSeed()],
    });

    await expect(
      upsertCommerceCurrentOfferSnapshots({
        snapshots: result.snapshots,
        supabaseClient: { from } as never,
      }),
    ).resolves.toEqual({
      upsertedCount: 1,
    });

    expect(from).toHaveBeenCalledWith(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE);
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          best_merchant_slug: 'goodbricks',
          best_price_minor: 19995,
          condition: 'new',
          currency_code: 'EUR',
          region_code: 'NL',
          set_id: '43300',
        }),
      ],
      {
        onConflict: 'set_id,region_code,currency_code,condition',
      },
    );
  });
});
