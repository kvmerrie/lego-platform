import { describe, expect, test, vi } from 'vitest';
import { runCommerceSync } from './commerce-sync-server';

describe('commerce sync server', () => {
  function buildCommerceSyncInputMock({
    refreshSeeds = [],
    syncSeeds = refreshSeeds,
  }: {
    refreshSeeds?: unknown[];
    syncSeeds?: unknown[];
  } = {}) {
    return {
      refreshSeeds,
      syncSeeds,
      syncInputs: {
        activeMerchantCount: 0,
        affiliateMerchantConfigs: [],
        enabledSetIds: [],
        merchantSummaries: [],
        pricingObservationSeeds: [],
      },
    };
  }

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
      syncSeeds: [refreshSeed],
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
        upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn: vi
          .fn()
          .mockResolvedValue({
            points: [],
            summary: {
              latestOfferRowsSeen: 1,
              eligibleLatestOfferRows: 0,
              dailyHistoryPointsBuilt: 0,
              maxObservedAgeHours: 48,
              skipped: {
                inactiveSeedOrMerchant: 0,
                invalidSeed: 0,
                missingLatest: 0,
                missingOrInvalidPrice: 0,
                nonEur: 0,
                staleOrError: 0,
                untrustedMerchant: 0,
                unavailableForHeadline: 1,
              },
            },
          }),
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
      refreshMerchants: true,
      setIds: ['10316-1'],
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
    expect(result.refreshMerchants).toBe(true);
    expect(result.scoped).toBe(true);
    expect(result.scopedSetIds).toEqual(['10316']);
  });

  test('defaults write mode to aggregate-only and does not refresh merchant pages', async () => {
    const refreshCommerceOfferSeedsFn = vi.fn();
    const revalidatePublicCatalogPathsFn = vi.fn();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
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
          loadCommerceSyncInputsFn: vi.fn().mockResolvedValue(
            buildCommerceSyncInputMock({
              refreshSeeds: [
                {
                  offerSeed: {
                    setId: '10316',
                  },
                },
              ],
              syncSeeds: [],
            }),
          ),
          refreshCommerceOfferSeedsFn,
          revalidatePublicCatalogPathsFn,
          upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn: vi
            .fn()
            .mockResolvedValue({
              points: [],
              summary: {
                latestOfferRowsSeen: 0,
                eligibleLatestOfferRows: 0,
                dailyHistoryPointsBuilt: 0,
                maxObservedAgeHours: 48,
                skipped: {
                  inactiveSeedOrMerchant: 0,
                  invalidSeed: 0,
                  missingLatest: 0,
                  missingOrInvalidPrice: 0,
                  nonEur: 0,
                  staleOrError: 0,
                  untrustedMerchant: 0,
                  unavailableForHeadline: 0,
                },
              },
            }),
          writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
          writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
        },
        mode: 'write',
        workspaceRoot: '/tmp/brickhunt-workspace',
      });

      expect(result.refreshMerchants).toBe(false);
      expect(result.refreshSuccessCount).toBe(0);
      expect(refreshCommerceOfferSeedsFn).not.toHaveBeenCalled();
      expect(revalidatePublicCatalogPathsFn).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(
        '[commerce-sync] aggregate mode=aggregate-only refresh_merchants=false',
      );
    } finally {
      info.mockRestore();
    }
  });

  test('revalidates homepage and deals after aggregate artifacts change', async () => {
    const revalidatePublicCatalogPathsFn = vi.fn().mockResolvedValue({
      attempted: true,
      pathCount: 2,
      paths: ['/', '/deals'],
      skipped: false,
      tagCount: 2,
      tags: ['homepage', 'deals'],
    });

    await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi
          .fn()
          .mockResolvedValue(buildCommerceSyncInputMock()),
        revalidatePublicCatalogPathsFn,
        upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn: vi
          .fn()
          .mockResolvedValue({
            points: [],
            summary: {
              latestOfferRowsSeen: 0,
              eligibleLatestOfferRows: 0,
              dailyHistoryPointsBuilt: 0,
              maxObservedAgeHours: 48,
              skipped: {
                inactiveSeedOrMerchant: 0,
                invalidSeed: 0,
                missingLatest: 0,
                missingOrInvalidPrice: 0,
                nonEur: 0,
                staleOrError: 0,
                untrustedMerchant: 0,
                unavailableForHeadline: 0,
              },
            },
          }),
        writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: false,
          stalePaths: [
            '/tmp/brickhunt-workspace/libs/pricing/data-access/src/lib/pricing-observations.generated.ts',
          ],
        }),
      },
      mode: 'write',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(revalidatePublicCatalogPathsFn).toHaveBeenCalledWith({
      includeThemeDirectory: false,
      reason: 'commerce_sync_aggregate',
      targets: [],
    });
  });

  test('rejects broad legacy merchant refresh without an explicit merchant scope', async () => {
    const loadCommerceSyncInputsFn = vi.fn();

    await expect(
      runCommerceSync({
        dependencies: {
          loadCommerceSyncInputsFn,
        },
        mode: 'write',
        refreshMerchants: true,
        workspaceRoot: '/tmp/brickhunt-workspace',
      }),
    ).rejects.toThrow(
      'Legacy merchant refresh requires an explicit --merchant-slugs scope.',
    );
    expect(loadCommerceSyncInputsFn).not.toHaveBeenCalled();
  });

  test('does not revalidate catalog paths during check mode', async () => {
    const revalidatePublicCatalogPathsFn = vi.fn();

    await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi
          .fn()
          .mockResolvedValue(buildCommerceSyncInputMock()),
        revalidatePublicCatalogPathsFn,
      },
      mode: 'check',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(revalidatePublicCatalogPathsFn).not.toHaveBeenCalled();
  });

  test('does not write daily history during check mode', async () => {
    const upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn = vi.fn();

    await runCommerceSync({
      dependencies: {
        checkAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        checkPricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi
          .fn()
          .mockResolvedValue(buildCommerceSyncInputMock()),
        upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn,
      },
      mode: 'check',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(
      upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn,
    ).not.toHaveBeenCalled();
  });

  test('lifts latest offer data from sync seeds for daily history input', async () => {
    const syncSeeds = [
      {
        merchant: {
          id: 'merchant-lego',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'affiliate' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-lego-10316',
          setId: '10316',
          merchantId: 'merchant-lego',
          productUrl: 'https://www.lego.com/10316',
          isActive: true,
          validationStatus: 'valid' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
          latestOffer: {
            id: 'latest-lego-10316',
            offerSeedId: 'seed-lego-10316',
            setId: '10316',
            merchantId: 'merchant-lego',
            productUrl: 'https://www.lego.com/10316',
            fetchStatus: 'success' as const,
            availability: 'in_stock' as const,
            currencyCode: 'EUR',
            fetchedAt: '2026-05-11T10:00:00.000Z',
            observedAt: '2026-05-11T10:00:00.000Z',
            priceMinor: 1999,
            createdAt: '2026-05-11T10:00:00.000Z',
            updatedAt: '2026-05-11T10:00:00.000Z',
          },
        },
      },
      {
        merchant: {
          id: 'merchant-alternate',
          slug: 'alternate',
          name: 'Alternate',
          isActive: true,
          sourceType: 'affiliate' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-alternate-10316',
          setId: '10316',
          merchantId: 'merchant-alternate',
          productUrl: 'https://alternate.example/10316',
          isActive: true,
          validationStatus: 'valid' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
          latestOffer: {
            id: 'latest-alternate-10316',
            offerSeedId: 'seed-alternate-10316',
            setId: '10316',
            merchantId: 'merchant-alternate',
            productUrl: 'https://alternate.example/10316',
            fetchStatus: 'error' as const,
            availability: 'unknown' as const,
            currencyCode: 'EUR',
            fetchedAt: '2026-05-11T10:00:00.000Z',
            observedAt: '2026-05-11T10:00:00.000Z',
            priceMinor: 2099,
            createdAt: '2026-05-11T10:00:00.000Z',
            updatedAt: '2026-05-11T10:00:00.000Z',
          },
        },
      },
      {
        merchant: {
          id: 'merchant-coppens',
          slug: 'coppenswarenhuis',
          name: 'Coppenswarenhuis',
          isActive: true,
          sourceType: 'affiliate' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-coppens-10316',
          setId: '10316',
          merchantId: 'merchant-coppens',
          productUrl: 'https://coppens.example/10316',
          isActive: true,
          validationStatus: 'valid' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
      },
    ];
    const upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn = vi
      .fn()
      .mockResolvedValue({
        points: [],
        summary: {
          seedRowsLoaded: 3,
          latestOfferRowsSeen: 2,
          missingLatestCount: 1,
          eligibleLatestOfferRows: 1,
          dailyHistoryPointsBuilt: 1,
          maxObservedAgeHours: 48,
          skipped: {
            inactiveSeedOrMerchant: 0,
            invalidSeed: 0,
            missingLatest: 1,
            missingOrInvalidPrice: 0,
            nonEur: 0,
            staleOrError: 1,
            untrustedMerchant: 0,
            unavailableForHeadline: 0,
          },
        },
      });

    await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue({
          refreshSeeds: [],
          syncSeeds,
          syncInputs: {
            activeMerchantCount: 3,
            affiliateMerchantConfigs: [
              {
                merchantId: 'lego-nl',
                displayName: 'LEGO',
                regionCode: 'NL',
                currencyCode: 'EUR',
                enabled: true,
                displayRank: 1,
                urlHost: 'www.lego.com',
                disclosureCopy: 'Direct merchant link.',
                ctaLabel: 'Bekijk bij LEGO',
                perks: 'Directe LEGO-winkel',
              },
            ],
            enabledSetIds: ['10316'],
            merchantSummaries: [],
            pricingObservationSeeds: [
              {
                setId: '10316',
                merchantId: 'lego-nl',
                merchantProductUrl: 'https://www.lego.com/10316',
                totalPriceMinor: 1999,
                availability: 'in_stock',
                observedAt: '2026-05-11T10:00:00.000Z',
                regionCode: 'NL',
                currencyCode: 'EUR',
                condition: 'new',
              },
            ],
          },
        }),
        upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn,
        writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
      },
      mode: 'write',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(
      upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn,
    ).toHaveBeenCalledWith({
      latestOffers: [
        expect.objectContaining({
          latestOffer: expect.objectContaining({
            fetchStatus: 'success',
            priceMinor: 1999,
          }),
          merchant: {
            isActive: true,
            reliabilityTier: 'strategic_manual',
            slug: 'lego-nl',
            trustedForHistory: false,
          },
          offerSeed: expect.objectContaining({
            isActive: true,
            setId: '10316',
            validationStatus: 'valid',
          }),
        }),
        expect.objectContaining({
          latestOffer: expect.objectContaining({
            fetchStatus: 'error',
          }),
        }),
        expect.objectContaining({
          latestOffer: undefined,
          merchant: expect.objectContaining({
            reliabilityTier: 'strategic_manual',
            slug: 'coppenswarenhuis',
            trustedForHistory: false,
          }),
        }),
      ],
      now: undefined,
    });
  });

  test('fails write mode when feed-latest daily history upsert fails', async () => {
    await expect(
      runCommerceSync({
        dependencies: {
          listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
          loadCommerceSyncInputsFn: vi
            .fn()
            .mockResolvedValue(buildCommerceSyncInputMock()),
          refreshCommerceOfferSeedsFn: vi.fn().mockResolvedValue({
            totalCount: 0,
            successCount: 0,
            unavailableCount: 0,
            invalidCount: 0,
            staleCount: 0,
          }),
          upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn: vi
            .fn()
            .mockRejectedValue(new Error('history write failed')),
          writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
          writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
        },
        mode: 'write',
        workspaceRoot: '/tmp/brickhunt-workspace',
      }),
    ).rejects.toThrow('history write failed');
  });

  test('logs feed-latest daily history summary counts in write mode', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      await runCommerceSync({
        dependencies: {
          listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
          loadCommerceSyncInputsFn: vi
            .fn()
            .mockResolvedValue(buildCommerceSyncInputMock()),
          refreshCommerceOfferSeedsFn: vi.fn().mockResolvedValue({
            totalCount: 0,
            successCount: 0,
            unavailableCount: 0,
            invalidCount: 0,
            staleCount: 0,
          }),
          upsertDailyPriceHistoryPointsFromCommerceLatestOffersFn: vi
            .fn()
            .mockResolvedValue({
              points: [
                {
                  setId: '10316',
                  regionCode: 'NL',
                  currencyCode: 'EUR',
                  condition: 'new',
                  headlinePriceMinor: 46999,
                  referencePriceMinor: 49999,
                  lowestMerchantId: 'alternate',
                  observedAt: '2026-05-11T10:00:00.000Z',
                  recordedOn: '2026-05-11',
                },
              ],
              summary: {
                latestOfferRowsSeen: 6,
                eligibleLatestOfferRows: 2,
                dailyHistoryPointsBuilt: 1,
                maxObservedAgeHours: 48,
                newestObservedAt: '2026-05-11T10:00:00.000Z',
                skipped: {
                  inactiveSeedOrMerchant: 1,
                  invalidSeed: 1,
                  missingLatest: 0,
                  missingOrInvalidPrice: 1,
                  nonEur: 1,
                  staleOrError: 1,
                  untrustedMerchant: 0,
                  unavailableForHeadline: 1,
                },
              },
            }),
          writeAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
          writePricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
            isClean: true,
            stalePaths: [],
          }),
        },
        mode: 'write',
        workspaceRoot: '/tmp/brickhunt-workspace',
      });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining(
          'latest_rows_loaded=6 joined_rows=6 missing_latest_count=0',
        ),
      );
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining(
          'eligible_latest_offer_rows=2 daily_history_points_built=1',
        ),
      );
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining(
          'history_points_from_trusted=1 ignored_for_confidence_count=0 daily_history_points_upserted=1',
        ),
      );
    } finally {
      info.mockRestore();
    }
  });
});
