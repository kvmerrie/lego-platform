import { describe, expect, test, vi } from 'vitest';
import { runCommerceSync } from './commerce-sync-server';

describe('commerce sync server', () => {
  test('revalidates explicit catalog set and theme paths after a scoped write run', async () => {
    const refreshSeed = {
      merchant: {
        id: 'merchant-lego',
        slug: 'lego-nl',
        name: 'LEGO',
        isActive: true,
        sourceType: 'direct' as const,
        notes: '',
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
      offerSeed: {
        id: 'seed-10316-lego',
        setId: '10316',
        merchantId: 'merchant-lego',
        productUrl:
          'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
        isActive: true,
        validationStatus: 'valid' as const,
        notes: '',
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
        latestOffer: {
          id: 'offer-10316-lego',
          offerSeedId: 'seed-10316-lego',
          setId: '10316',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
          fetchStatus: 'success' as const,
          availability: 'in_stock' as const,
          currencyCode: 'EUR',
          fetchedAt: '2026-04-21T10:00:00.000Z',
          observedAt: '2026-04-21T10:00:00.000Z',
          priceMinor: 49999,
          createdAt: '2026-04-21T10:00:00.000Z',
          updatedAt: '2026-04-21T10:00:00.000Z',
        },
      },
    };
    const loadCommerceSyncInputsFn = vi.fn().mockResolvedValue({
      refreshSeeds: [refreshSeed],
      syncInputs: {
        activeMerchantCount: 1,
        affiliateMerchantConfigs: [],
        enabledSetIds: [],
        merchantSummaries: [],
        pricingObservationSeeds: [],
      },
    });
    const revalidatePublicCatalogPathsFn = vi.fn().mockResolvedValue({
      attempted: true,
      pathCount: 3,
      paths: ['/themes', '/sets/rivendell-10316', '/themes/icons'],
      skipped: false,
    });

    const result = await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([
          {
            id: '10316',
            slug: 'rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6167,
          },
        ]),
        loadCommerceSyncInputsFn,
        refreshCommerceOfferSeedsFn: vi.fn().mockResolvedValue({
          totalCount: 1,
          successCount: 1,
          unavailableCount: 0,
          invalidCount: 0,
          staleCount: 0,
        }),
        revalidatePublicCatalogPathsFn,
        upsertDailyPriceHistoryPointsFn: vi.fn().mockResolvedValue([]),
        writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
      },
      merchantSlugs: ['lego-nl'],
      mode: 'write',
      setIds: ['10316'],
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(loadCommerceSyncInputsFn).toHaveBeenCalledWith({
      merchantSlugs: ['lego-nl'],
      setIds: ['10316'],
    });
    expect(revalidatePublicCatalogPathsFn).toHaveBeenCalledWith({
      reason: 'commerce_sync_scoped',
      targets: [
        {
          setId: '10316',
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
      ],
    });
    expect(result.refreshSuccessCount).toBe(1);
    expect(result.scoped).toBe(true);
  });

  test('does not revalidate catalog paths during check mode', async () => {
    const revalidatePublicCatalogPathsFn = vi.fn();

    await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue({
          refreshSeeds: [],
          syncInputs: {
            activeMerchantCount: 0,
            affiliateMerchantConfigs: [],
            enabledSetIds: [],
            merchantSummaries: [],
            pricingObservationSeeds: [],
          },
        }),
        revalidatePublicCatalogPathsFn,
      },
      mode: 'check',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(revalidatePublicCatalogPathsFn).not.toHaveBeenCalled();
  });
});
