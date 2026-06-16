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

function buildSnapshotSeeds(count: number): CommerceRefreshSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const setId = String(10000 + index);

    return buildSeed({
      productUrl: `https://example.com/lego-${setId}`,
      seedId: `seed-goodbricks-${setId}`,
      setId,
    });
  });
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

  test('keeps a stale lower snapshot offer from becoming the card/detail best offer', () => {
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: [
        buildSeed({
          merchantId: 'merchant-mediamarkt',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          observedAt: '2026-05-01T05:01:00.862Z',
          priceMinor: 17500,
          productUrl: 'https://example.com/lego-21061-mediamarkt',
          seedId: 'seed-mediamarkt-21061',
          setId: '21061',
        }),
        buildSeed({
          merchantId: 'merchant-proshop',
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          observedAt: '2026-05-19T06:06:05.983Z',
          priceMinor: 17667,
          productUrl: 'https://example.com/lego-21061-proshop',
          seedId: 'seed-proshop-21061',
          setId: '21061',
        }),
      ],
    });

    expect(result.snapshots[0]).toMatchObject({
      bestMerchantSlug: 'proshop',
      bestPriceMinor: 17667,
      offerCount: 2,
      setId: '21061',
    });
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

    expect(result.summary.snapshotMissingLiveSummaryCount).toBe(2);
    expect(result.summary.missingLiveSummaryReasonCounts).toEqual({
      missing_live_due_to_set_scope: 1,
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
          best_availability: 'in_stock',
          best_checked_at: '2026-05-19T08:00:00.000Z',
          best_commercial_unit_type: 'full_set',
          best_merchant_slug: 'goodbricks',
          best_offer_seed_id: 'seed-goodbricks-43300',
          best_price_minor: 19995,
          comparable_offer_count: 1,
          condition: 'new',
          currency_code: 'EUR',
          has_anomalous_spread: false,
          next_best_price_minor: null,
          offer_count: 1,
          price_spread_minor: 0,
          region_code: 'NL',
          set_id: '43300',
          strategic_manual_offer_count: 0,
          trusted_offer_count: 1,
        }),
      ],
      {
        onConflict: 'set_id,region_code,currency_code,condition',
      },
    );
  });

  test('upserts 1383 snapshots in chunks using the composite snapshot key', async () => {
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: buildSnapshotSeeds(1383),
    });

    await expect(
      upsertCommerceCurrentOfferSnapshots({
        snapshots: result.snapshots,
        supabaseClient: { from } as never,
      }),
    ).resolves.toEqual({
      upsertedCount: 1383,
    });

    expect(upsert).toHaveBeenCalledTimes(14);
    expect(upsert.mock.calls[0]?.[0]).toHaveLength(100);
    expect(upsert.mock.calls[13]?.[0]).toHaveLength(83);
    for (const call of upsert.mock.calls) {
      expect(call[1]).toEqual({
        onConflict: 'set_id,region_code,currency_code,condition',
      });
    }
    expect(infoSpy).toHaveBeenCalledWith(
      '[commerce-current-offer-snapshots] upsert_progress',
      expect.objectContaining({
        chunkCount: 14,
        chunkIndex: 0,
        chunkSize: 100,
        upsertedSoFar: 100,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[commerce-current-offer-snapshots] upsert_complete',
      expect.objectContaining({
        chunkCount: 14,
        snapshotCount: 1383,
      }),
    );

    infoSpy.mockRestore();
  });

  test('fails with chunk diagnostics when a snapshot chunk upsert fails', async () => {
    const upsertError = {
      code: '57014',
      details: 'statement timeout',
      hint: 'Try a smaller batch.',
      message: 'canceling statement due to statement timeout',
    };
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: upsertError });
    const from = vi.fn().mockReturnValue({ upsert });
    const result = buildCommerceCurrentOfferSnapshots({
      now,
      syncSeeds: buildSnapshotSeeds(250),
    });

    await expect(
      upsertCommerceCurrentOfferSnapshots({
        snapshots: result.snapshots,
        supabaseClient: { from } as never,
      }),
    ).rejects.toThrow(/"chunkIndex":1/u);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      '[commerce-current-offer-snapshots] upsert_failed',
      expect.objectContaining({
        chunkCount: 3,
        chunkIndex: 1,
        chunkSize: 100,
        code: '57014',
        details: 'statement timeout',
        event: 'commerce_current_offer_snapshot_upsert_failed',
        hint: 'Try a smaller batch.',
        message: 'canceling statement due to statement timeout',
        sampleSnapshotKeys: [
          expect.objectContaining({
            setId: '10100',
          }),
          expect.objectContaining({
            setId: '10101',
          }),
          expect.objectContaining({
            setId: '10102',
          }),
        ],
        snapshotCount: 250,
      }),
    );

    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  test('logs Supabase details when snapshot upsert fails', async () => {
    const upsertError = {
      code: '42703',
      details: 'Column best_commercial_unit_type does not exist.',
      hint: 'Check the commerce_current_offer_snapshots table schema.',
      message: 'Could not find the column best_commercial_unit_type',
    };
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const upsert = vi.fn().mockResolvedValue({ error: upsertError });
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
    ).rejects.toThrow(/best_commercial_unit_type/u);

    expect(errorSpy).toHaveBeenCalledWith(
      '[commerce-current-offer-snapshots] upsert_failed',
      expect.objectContaining({
        code: '42703',
        details: 'Column best_commercial_unit_type does not exist.',
        event: 'commerce_current_offer_snapshot_upsert_failed',
        hint: 'Check the commerce_current_offer_snapshots table schema.',
        message: 'Could not find the column best_commercial_unit_type',
        samplePayloadShape: [
          expect.objectContaining({
            offersLength: 1,
            setId: '43300',
          }),
        ],
        sampleSnapshotKeys: [
          {
            condition: 'new',
            currencyCode: 'EUR',
            regionCode: 'NL',
            setId: '43300',
          },
        ],
        snapshotCount: 1,
      }),
    );

    errorSpy.mockRestore();
  });
});
