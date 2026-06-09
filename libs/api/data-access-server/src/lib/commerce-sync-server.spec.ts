import { describe, expect, test, vi } from 'vitest';
import {
  assertCommerceCheckInputSourceReady,
  runCommerceSync,
} from './commerce-sync-server';
import { buildCommerceSyncInputs } from './commerce-refresh-server';

describe('commerce sync server', () => {
  const expectedCollectionSnapshotSlugs = [
    'nieuwe-lego-sets',
    'retiring-lego-sets',
    'lego-sets-onder-50-euro',
    'lego-sets-onder-100-euro',
    'lego-voor-volwassenen',
  ];
  const expectedCollectionSnapshotPaths = expectedCollectionSnapshotSlugs.map(
    (collectionSlug) => `/${collectionSlug}`,
  );
  const expectedCollectionSnapshotTags = expectedCollectionSnapshotSlugs.map(
    (collectionSlug) => `collection:${collectionSlug}`,
  );

  test('derives fallback affiliate merchant hosts from TradeTracker destination URLs', () => {
    const syncInputs = buildCommerceSyncInputs({
      refreshSeeds: [
        {
          merchant: {
            id: 'merchant-coppens',
            slug: 'coppenswarenhuis',
            name: 'Coppenswarenhuis',
            isActive: true,
            sourceType: 'affiliate',
            notes: '',
            createdAt: '2026-05-20T08:00:00.000Z',
            updatedAt: '2026-05-20T08:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10280-coppens',
            setId: '10280',
            merchantId: 'merchant-coppens',
            productUrl:
              'https://tc.tradetracker.net/?c=21626&m=1768113&a=508318&r=&u=https%3A%2F%2Fwww.coppenswarenhuis.nl%2Flego-lego-10280-creator-expert-459128%2F%3Fvariant%3D459129',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-05-20T08:00:00.000Z',
            updatedAt: '2026-05-20T08:00:00.000Z',
            latestOffer: {
              id: 'latest-10280-coppens',
              offerSeedId: 'seed-10280-coppens',
              setId: '10280',
              merchantId: 'merchant-coppens',
              productUrl:
                'https://tc.tradetracker.net/?c=21626&m=1768113&a=508318&r=&u=https%3A%2F%2Fwww.coppenswarenhuis.nl%2Flego-lego-10280-creator-expert-459128%2F%3Fvariant%3D459129',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-05-20T08:00:00.000Z',
              observedAt: '2026-05-20T08:00:00.000Z',
              priceMinor: 4999,
              createdAt: '2026-05-20T08:00:00.000Z',
              updatedAt: '2026-05-20T08:00:00.000Z',
            },
          },
        },
        {
          merchant: {
            id: 'merchant-coppens',
            slug: 'coppenswarenhuis',
            name: 'Coppenswarenhuis',
            isActive: true,
            sourceType: 'affiliate',
            notes: '',
            createdAt: '2026-05-20T08:00:00.000Z',
            updatedAt: '2026-05-20T08:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10280-coppens-old',
            setId: '10280',
            merchantId: 'merchant-coppens',
            productUrl: 'https://partner.conrad.nl/click?p=920&id=10280',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-05-20T08:00:00.000Z',
            updatedAt: '2026-05-20T08:00:00.000Z',
            latestOffer: {
              id: 'latest-10281-coppens-old',
              offerSeedId: 'seed-10280-coppens-old',
              setId: '10281',
              merchantId: 'merchant-coppens',
              productUrl: 'https://partner.conrad.nl/click?p=920&id=10281',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-05-20T08:00:00.000Z',
              observedAt: '2026-05-20T08:00:00.000Z',
              priceMinor: 5999,
              createdAt: '2026-05-20T08:00:00.000Z',
              updatedAt: '2026-05-20T08:00:00.000Z',
            },
          },
        },
      ],
    });

    expect(
      syncInputs.affiliateMerchantConfigs.find(
        (merchantConfig) => merchantConfig.merchantId === 'coppenswarenhuis',
      )?.urlHost,
    ).toBe('www.coppenswarenhuis.nl');
    expect(syncInputs.pricingObservationSeeds).toHaveLength(1);
    expect(syncInputs.pricingObservationSeeds[0]).toMatchObject({
      merchantId: 'coppenswarenhuis',
      merchantProductUrl:
        'https://tc.tradetracker.net/?c=21626&m=1768113&a=508318&r=&u=https%3A%2F%2Fwww.coppenswarenhuis.nl%2Flego-lego-10280-creator-expert-459128%2F%3Fvariant%3D459129',
      setId: '10280',
    });
  });

  function buildCommerceSyncInputMock({
    refreshSeeds = [
      {
        merchant: {
          id: 'merchant-goodbricks',
          slug: 'goodbricks',
          name: 'Goodbricks',
          isActive: true,
          sourceType: 'affiliate' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-10316-goodbricks',
          setId: '10316',
          merchantId: 'merchant-goodbricks',
          productUrl: 'https://goodbricks.example/lego-10316',
          isActive: true,
          validationStatus: 'valid' as const,
          notes: '',
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
      },
    ],
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

  function buildEligibleCommerceSeed({
    merchantSlug = 'goodbricks',
    priceMinor = 19995,
    setId = '10316',
  }: {
    merchantSlug?: string;
    priceMinor?: number;
    setId?: string;
  } = {}) {
    return {
      merchant: {
        id: `merchant-${merchantSlug}`,
        slug: merchantSlug,
        name: 'Goodbricks',
        isActive: true,
        sourceType: 'affiliate' as const,
        notes: '',
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
      },
      offerSeed: {
        id: `seed-${setId}-${merchantSlug}`,
        setId,
        merchantId: `merchant-${merchantSlug}`,
        productUrl: `https://goodbricks.example/lego-${setId}`,
        isActive: true,
        validationStatus: 'valid' as const,
        notes: '',
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
        latestOffer: {
          id: `latest-${setId}-${merchantSlug}`,
          offerSeedId: `seed-${setId}-${merchantSlug}`,
          setId,
          merchantId: `merchant-${merchantSlug}`,
          productUrl: `https://goodbricks.example/lego-${setId}`,
          fetchStatus: 'success' as const,
          availability: 'in_stock' as const,
          currencyCode: 'EUR',
          fetchedAt: '2026-05-11T10:00:00.000Z',
          observedAt: '2026-05-11T10:00:00.000Z',
          priceMinor,
          createdAt: '2026-05-11T10:00:00.000Z',
          updatedAt: '2026-05-11T10:00:00.000Z',
        },
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
    const syncCollectionPageSnapshotsFn = vi.fn().mockResolvedValue({
      dryRun: false,
      generatedAt: '2026-04-21T10:00:00.000Z',
      snapshots: [{ collectionSlug: 'lego-sets-onder-50-euro' }],
      summaryByCollectionSlug: {
        'lego-sets-onder-50-euro': {
          itemsBuilt: 40,
          pageCount: 1,
          totalCount: 40,
        },
      },
      upsertedCount: 1,
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
        syncCollectionPageSnapshotsFn,
        upsertCommerceCurrentOfferSnapshotsFn: vi
          .fn()
          .mockResolvedValue({ upsertedCount: 1 }),
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
      additionalPaths: [...expectedCollectionSnapshotPaths, '/deals'],
      additionalTags: [
        'collections',
        ...expectedCollectionSnapshotTags,
        'deals',
        'prices',
      ],
      reason: 'commerce_sync_scoped',
      targets: [
        {
          setId: '10316',
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
      ],
    });
    expect(syncCollectionPageSnapshotsFn).toHaveBeenCalledWith({
      collectionSlugs: expectedCollectionSnapshotSlugs,
      dryRun: false,
      pageSize: 40,
    });
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalPaths,
    ).toContain('/nieuwe-lego-sets');
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalPaths,
    ).toContain('/lego-voor-volwassenen');
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalTags,
    ).toContain('collection:nieuwe-lego-sets');
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalTags,
    ).toContain('collection:lego-voor-volwassenen');
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalPaths,
    ).toContain('/lego-sets-onder-100-euro');
    expect(
      revalidatePublicCatalogPathsFn.mock.calls[0]?.[0].additionalTags,
    ).toContain('collection:lego-sets-onder-100-euro');
    expect(result.collectionPageSnapshotCount).toBe(1);
    expect(result.collectionPageSnapshotsUpsertedCount).toBe(1);
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
      additionalPaths: [...expectedCollectionSnapshotPaths, '/deals'],
      additionalTags: [
        'collections',
        ...expectedCollectionSnapshotTags,
        'deals',
        'prices',
      ],
      includeThemeDirectory: false,
      reason: 'commerce_sync_aggregate',
      targets: [],
    });
  });

  test('fails production write mode when aggregate revalidation fails', async () => {
    const originalEnv = { ...process.env };
    process.env = {
      ...process.env,
      BRICKHUNT_DEPLOY_ENV: 'production',
    };
    const revalidationError = new TypeError('fetch failed');

    try {
      await expect(
        runCommerceSync({
          dependencies: {
            listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
            loadCommerceSyncInputsFn: vi
              .fn()
              .mockResolvedValue(buildCommerceSyncInputMock()),
            revalidatePublicCatalogPathsFn: vi
              .fn()
              .mockRejectedValue(revalidationError),
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
        }),
      ).rejects.toThrow('fetch failed');
    } finally {
      process.env = originalEnv;
    }
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

  test('fails check mode before loading Supabase when required env is missing', async () => {
    await expect(
      runCommerceSync({
        environment: {},
        mode: 'check',
        workspaceRoot: '/tmp/brickhunt-workspace',
      }),
    ).rejects.toThrow(
      'Missing Supabase env for commerce check: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    );
  });

  test('fails check mode before stale artifact comparison when loaded rows are empty', () => {
    expect(() =>
      assertCommerceCheckInputSourceReady({
        environment: {
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
          SUPABASE_URL: 'https://example.supabase.co',
        },
        latestRowsLoaded: 0,
        seedRowsLoaded: 0,
        source: 'supabase',
      }),
    ).toThrow(
      'Commerce check loaded 0 seeds/latest rows; refusing to compare empty artifacts.',
    );
  });

  test('allows normal check input so artifact drift checks can run', () => {
    expect(() =>
      assertCommerceCheckInputSourceReady({
        environment: {
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
          SUPABASE_URL: 'https://example.supabase.co',
        },
        latestRowsLoaded: 1,
        seedRowsLoaded: 3,
        source: 'supabase',
      }),
    ).not.toThrow();
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

  test('writes current-offer snapshots only during write mode', async () => {
    const syncSeed = buildEligibleCommerceSeed();
    const upsertCommerceCurrentOfferSnapshotsFn = vi
      .fn()
      .mockResolvedValue({ upsertedCount: 1 });
    const syncCollectionPageSnapshotsFn = vi.fn().mockResolvedValue({
      dryRun: false,
      generatedAt: '2026-05-11T10:00:00.000Z',
      snapshots: [],
      summaryByCollectionSlug: {},
      upsertedCount: 0,
    });

    const result = await runCommerceSync({
      dependencies: {
        listCatalogCurrentOfferSummariesBySetIdsFn: vi.fn().mockResolvedValue([
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-11T10:00:00.000Z',
              commercialUnitType: 'full_set',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'other',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceCents: 19995,
              setId: '10316',
              url: 'https://goodbricks.example/lego-10316',
            },
            offers: [],
            setId: '10316',
          },
        ]),
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue(
          buildCommerceSyncInputMock({
            refreshSeeds: [],
            syncSeeds: [syncSeed],
          }),
        ),
        syncCollectionPageSnapshotsFn,
        upsertCommerceCurrentOfferSnapshotsFn,
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

    expect(upsertCommerceCurrentOfferSnapshotsFn).toHaveBeenCalledWith({
      snapshots: [
        expect.objectContaining({
          bestMerchantSlug: 'goodbricks',
          bestPriceMinor: 19995,
          setId: '10316',
        }),
      ],
    });
    expect(result.currentOfferSnapshotsUpsertedCount).toBe(1);
    expect(syncCollectionPageSnapshotsFn).toHaveBeenCalledWith({
      collectionSlugs: expectedCollectionSnapshotSlugs,
      dryRun: false,
      pageSize: 40,
    });
    expect(result.currentOfferSnapshotBestOfferMismatchCount).toBe(0);
  });

  test('revalidates only affected set-detail tags after related-theme snapshot upserts', async () => {
    const syncSeed = buildEligibleCommerceSeed();
    const revalidatePublicCatalogPathsFn = vi.fn();
    const revalidatePublicWebFn = vi.fn().mockResolvedValue({
      attempted: true,
      pathCount: 0,
      paths: [],
      skipped: false,
      tagCount: 4,
      tags: [
        'set:10316',
        'set:rivendell-10316',
        'set:75355',
        'set:x-wing-starfighter-75355',
      ],
    });
    const syncSetDetailRelatedThemeSnapshotsFn = vi.fn().mockResolvedValue({
      dryRun: false,
      generatedAt: '2026-05-11T10:00:00.000Z',
      snapshots: [
        {
          generatedAt: '2026-05-11T10:00:00.000Z',
          items: [],
          page: 1,
          pageSize: 20,
          setId: '10316',
          snapshotSlug: 'set-detail-related-theme:10316',
          totalCount: 0,
        },
        {
          generatedAt: '2026-05-11T10:00:00.000Z',
          items: [],
          page: 1,
          pageSize: 20,
          setId: '75355',
          snapshotSlug: 'set-detail-related-theme:75355',
          totalCount: 0,
        },
      ],
      summary: {
        setCount: 2,
        snapshotCount: 2,
        snapshotWithItemsCount: 0,
      },
      upsertedCount: 2,
    });

    const result = await runCommerceSync({
      dependencies: {
        listCatalogCurrentOfferSummariesBySetIdsFn: vi.fn().mockResolvedValue([
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-11T10:00:00.000Z',
              commercialUnitType: 'full_set',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'other',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceCents: 19995,
              setId: '10316',
              url: 'https://goodbricks.example/lego-10316',
            },
            offers: [],
            setId: '10316',
          },
        ]),
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([
          {
            id: '10316',
            name: 'Rivendell',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'rivendell-10316',
            theme: 'Icons',
          },
          {
            id: '75355',
            name: 'X-wing Starfighter',
            pieces: 1949,
            releaseYear: 2023,
            slug: 'x-wing-starfighter-75355',
            theme: 'Star Wars',
          },
          {
            id: '99999',
            name: 'Unrelated Set',
            pieces: 100,
            releaseYear: 2026,
            slug: 'unrelated-set-99999',
            theme: 'City',
          },
        ]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue(
          buildCommerceSyncInputMock({
            refreshSeeds: [],
            syncSeeds: [syncSeed],
          }),
        ),
        revalidatePublicCatalogPathsFn,
        revalidatePublicWebFn,
        syncCollectionPageSnapshotsFn: vi.fn().mockResolvedValue({
          dryRun: false,
          generatedAt: '2026-05-11T10:00:00.000Z',
          snapshots: [],
          summaryByCollectionSlug: {},
          upsertedCount: 0,
        }),
        syncDealPageSnapshotsFn: vi.fn().mockResolvedValue({
          debugCounters: {
            snapshotRowsRead: 0,
            rowsRejectedByReason: {},
            rowsUnder50: 0,
            rowsWithBestOffer: 0,
            rowsWithDiscount: 0,
            rowsWithInStockOffer: 0,
            rowsWithOfferCount: 0,
            rowsWithOffersJson: 0,
            rowsWithPieces: 0,
            rowsWithReferencePrice: 0,
          },
          dryRun: false,
          generatedAt: '2026-05-11T10:00:00.000Z',
          snapshots: [],
          summaryBySortKey: {},
          upsertedCount: 0,
        }),
        syncSetDetailRelatedThemeSnapshotsFn,
        upsertCommerceCurrentOfferSnapshotsFn: vi
          .fn()
          .mockResolvedValue({ upsertedCount: 1 }),
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

    expect(syncSetDetailRelatedThemeSnapshotsFn).toHaveBeenCalledWith({
      dryRun: false,
      limit: 8,
    });
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [],
      reason: 'commerce_sync_set_detail_related_theme_snapshots',
      tags: [
        'sets',
        'set:10316',
        'set:rivendell-10316',
        'set:75355',
        'set:x-wing-starfighter-75355',
      ],
    });
    expect(revalidatePublicCatalogPathsFn).not.toHaveBeenCalled();
    expect(revalidatePublicWebFn.mock.calls[0]?.[0].tags).not.toContain(
      'homepage',
    );
    expect(revalidatePublicWebFn.mock.calls[0]?.[0].tags).not.toContain(
      'deals',
    );
    expect(revalidatePublicWebFn.mock.calls[0]?.[0].tags).not.toContain(
      'catalog',
    );
    expect(revalidatePublicWebFn.mock.calls[0]?.[0].tags).not.toContain(
      'prices',
    );
    expect(revalidatePublicWebFn.mock.calls[0]?.[0].tags).not.toContain(
      'set:unrelated-set-99999',
    );
    expect(result.setDetailRelatedThemeSnapshotCount).toBe(2);
    expect(result.setDetailRelatedThemeSnapshotsUpsertedCount).toBe(2);
  });

  test('rebuilds related-theme snapshots during write mode without current-offer upserts', async () => {
    const revalidatePublicWebFn = vi.fn().mockResolvedValue({
      attempted: true,
      pathCount: 0,
      paths: [],
      skipped: false,
      tagCount: 3,
      tags: ['sets', 'set:10316', 'set:rivendell-10316'],
    });
    const syncSetDetailRelatedThemeSnapshotsFn = vi.fn().mockResolvedValue({
      dryRun: false,
      generatedAt: '2026-05-11T10:00:00.000Z',
      snapshots: [
        {
          generatedAt: '2026-05-11T10:00:00.000Z',
          items: [],
          page: 1,
          pageSize: 20,
          setId: '10316',
          snapshotSlug: 'set-detail-related-theme:10316',
          totalCount: 0,
        },
      ],
      summary: {
        setCount: 1,
        snapshotCount: 1,
        snapshotWithItemsCount: 0,
      },
      upsertedCount: 1,
    });

    await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([
          {
            id: '10316',
            name: 'Rivendell',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'rivendell-10316',
            theme: 'Icons',
          },
        ]),
        loadCommerceSyncInputsFn: vi
          .fn()
          .mockResolvedValue(buildCommerceSyncInputMock({ syncSeeds: [] })),
        revalidatePublicWebFn,
        syncSetDetailRelatedThemeSnapshotsFn,
        upsertCommerceCurrentOfferSnapshotsFn: vi
          .fn()
          .mockResolvedValue({ upsertedCount: 0 }),
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

    expect(syncSetDetailRelatedThemeSnapshotsFn).toHaveBeenCalledWith({
      dryRun: false,
      limit: 8,
    });
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: [],
      reason: 'commerce_sync_set_detail_related_theme_snapshots',
      tags: ['sets', 'set:10316', 'set:rivendell-10316'],
    });
  });

  test('keeps current-offer snapshot check mode read-only', async () => {
    const upsertCommerceCurrentOfferSnapshotsFn = vi.fn();

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
        listCatalogCurrentOfferSummariesBySetIdsFn: vi
          .fn()
          .mockResolvedValue([]),
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue(
          buildCommerceSyncInputMock({
            refreshSeeds: [],
            syncSeeds: [buildEligibleCommerceSeed()],
          }),
        ),
        upsertCommerceCurrentOfferSnapshotsFn,
      },
      mode: 'check',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(upsertCommerceCurrentOfferSnapshotsFn).not.toHaveBeenCalled();
  });

  test('loads current-offer snapshot parity summaries in chunks and reports missing live separately', async () => {
    const syncSeeds = Array.from({ length: 101 }, (_, index) =>
      buildEligibleCommerceSeed({
        setId: String(10_000 + index),
      }),
    );
    const listCatalogCurrentOfferSummariesBySetIdsFn = vi
      .fn()
      .mockImplementation(({ setIds }: { setIds: string[] }) =>
        Promise.resolve(
          setIds.slice(0, 1).map((setId) => ({
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-11T10:00:00.000Z',
              commercialUnitType: 'full_set',
              condition: 'new',
              currency: 'EUR',
              market: 'NL',
              merchant: 'other',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceCents: 19995,
              setId,
              url: `https://goodbricks.example/lego-${setId}`,
            },
            offers: [],
            setId,
          })),
        ),
      );

    const result = await runCommerceSync({
      dependencies: {
        checkAffiliateGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        checkPricingGeneratedArtifactsFn: vi.fn().mockResolvedValue({
          isClean: true,
          stalePaths: [],
        }),
        listCatalogCurrentOfferSummariesBySetIdsFn,
        listCatalogSetSummariesFn: vi.fn().mockResolvedValue([]),
        loadCommerceSyncInputsFn: vi.fn().mockResolvedValue(
          buildCommerceSyncInputMock({
            refreshSeeds: [],
            syncSeeds,
          }),
        ),
      },
      mode: 'check',
      workspaceRoot: '/tmp/brickhunt-workspace',
    });

    expect(listCatalogCurrentOfferSummariesBySetIdsFn).toHaveBeenCalledTimes(5);
    expect(
      listCatalogCurrentOfferSummariesBySetIdsFn.mock.calls[0]?.[0].setIds,
    ).toHaveLength(25);
    expect(
      listCatalogCurrentOfferSummariesBySetIdsFn.mock.calls[0]?.[0]
        .preferSnapshots,
    ).toBe(false);
    expect(
      listCatalogCurrentOfferSummariesBySetIdsFn.mock.calls[1]?.[0].setIds,
    ).toHaveLength(25);
    expect(
      listCatalogCurrentOfferSummariesBySetIdsFn.mock.calls[4]?.[0].setIds,
    ).toHaveLength(1);
    expect(result.currentOfferSnapshotLiveSummaryCount).toBe(5);
    expect(result.currentOfferSnapshotMissingLiveSummaryCount).toBe(96);
    expect(result.currentOfferSnapshotBestOfferMismatchCount).toBe(0);
    expect(result.currentOfferSnapshotMissingLiveSummarySample[0]).toEqual(
      expect.objectContaining({
        reason: 'missing_live_due_to_set_scope',
      }),
    );
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
        upsertCommerceCurrentOfferSnapshotsFn: vi
          .fn()
          .mockResolvedValue({ upsertedCount: 1 }),
        syncCollectionPageSnapshotsFn: vi.fn().mockResolvedValue({
          dryRun: false,
          generatedAt: '2026-05-11T10:00:00.000Z',
          snapshots: [],
          summaryByCollectionSlug: {},
          upsertedCount: 0,
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
