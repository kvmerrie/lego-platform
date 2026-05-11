import { describe, expect, test, vi } from 'vitest';
import {
  importAffiliateFeedRowsForMerchant,
  importAlternateAffiliateFeedRows,
} from './alternate-affiliate-feed-server';

describe('alternate affiliate feed server', () => {
  test('imports exact LEGO set matches into commerce seeds and latest offer state', async () => {
    const createCommerceMerchantFn = vi.fn().mockResolvedValue({
      id: 'merchant-alternate',
      slug: 'alternate',
      name: 'Alternate',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: 'TradeTracker',
      notes: '',
      createdAt: '2026-04-22T09:00:00.000Z',
      updatedAt: '2026-04-22T09:00:00.000Z',
    });
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn().mockResolvedValue({
      id: 'seed-76784-alternate',
      setId: '76784',
      merchantId: 'merchant-alternate',
    });
    const upsertCommerceOfferLatestRecordFn = vi
      .fn()
      .mockResolvedValue(undefined);

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        createCommerceMerchantFn,
        getNow: () => new Date('2026-04-22T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '76784',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([]),
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
        updateCommerceMerchantFn: vi.fn(),
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/76784',
          availabilityText: 'Op voorraad',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '76784',
          price: '159,99',
          productTitle: 'LEGO Wednesday Nevermore Academy',
        },
      ],
    });

    expect(createCommerceMerchantFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        affiliateNetwork: 'TradeTracker',
        isActive: true,
        name: 'Alternate',
        slug: 'alternate',
        sourceType: 'affiliate',
      }),
    });
    expect(upsertCommerceOfferSeedByCompositeKeyFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        setId: '76784',
        merchantId: 'merchant-alternate',
        productUrl: 'https://clk.tradetracker.example/alternate/76784',
        validationStatus: 'valid',
      }),
    });
    expect(upsertCommerceOfferLatestRecordFn).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-76784-alternate',
        fetchStatus: 'success',
        priceMinor: 15999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-22T09:15:00.000Z',
        fetchedAt: '2026-04-22T09:15:00.000Z',
      },
    });
    expect(result).toMatchObject({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: true,
      merchantSlug: 'alternate',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 0,
      totalRowCount: 1,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
      discoveredMissingSetCount: 0,
      autoImportableMissingSetCount: 0,
      reviewNeededMissingSetCount: 0,
      ignoredOrNonSetMissingSetCount: 0,
    });
  });

  test('does not report changed sets or write latest offers when feed content is unchanged', async () => {
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn();
    const upsertCommerceOfferLatestRecordFn = vi.fn();

    const existingMerchant = {
      id: 'merchant-alternate',
      slug: 'alternate',
      name: 'Alternate',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: 'TradeTracker',
      notes:
        'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
      createdAt: '2026-04-22T09:00:00.000Z',
      updatedAt: '2026-04-22T09:00:00.000Z',
    } as const;
    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        getNow: () => new Date('2026-04-24T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '10316',
            slug: 'rivendell-10316',
            sourceSetNumber: '10316-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([existingMerchant]),
        listCommerceOfferSeedsFn: vi.fn().mockResolvedValue([
          {
            id: 'seed-10316-alternate',
            setId: '10316',
            merchantId: 'merchant-alternate',
            productUrl: 'https://clk.tradetracker.example/alternate/10316',
            isActive: true,
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-24T08:00:00.000Z',
            notes:
              'Feed-driven Alternate import via TradeTracker. Exact matched by LEGO set number. Product title: LEGO Icons Rivendell.',
            createdAt: '2026-04-22T09:00:00.000Z',
            updatedAt: '2026-04-22T09:00:00.000Z',
            latestOffer: {
              id: 'latest-10316-alternate',
              offerSeedId: 'seed-10316-alternate',
              setId: '10316',
              merchantId: 'merchant-alternate',
              productUrl: 'https://clk.tradetracker.example/alternate/10316',
              fetchStatus: 'success',
              priceMinor: 29999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              fetchedAt: '2026-04-24T08:00:00.000Z',
              observedAt: '2026-04-24T08:00:00.000Z',
              createdAt: '2026-04-22T09:00:00.000Z',
              updatedAt: '2026-04-22T09:00:00.000Z',
            },
          },
        ]),
        updateCommerceMerchantFn: vi.fn().mockResolvedValue(existingMerchant),
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
      },
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Alternate',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
        sourceType: 'affiliate',
        slug: 'alternate',
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/10316',
          availabilityText: 'Op voorraad',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '10316',
          price: '299,99',
          productTitle: 'LEGO Icons Rivendell',
        },
      ],
    });

    expect(upsertCommerceOfferSeedByCompositeKeyFn).not.toHaveBeenCalled();
    expect(upsertCommerceOfferLatestRecordFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      changedSetIds: [],
      changedSetSlugs: [],
      importedOfferCount: 0,
      matchedCatalogSetCount: 1,
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });
  });

  test('matches plain feed set numbers against active catalog rows that also carry source-style numbers', async () => {
    const upsertCommerceOfferSeedByCompositeKeyFn = vi
      .fn()
      .mockImplementation(async ({ input }) => ({
        id: `seed-${input.setId}-alternate`,
        setId: input.setId,
        merchantId: input.merchantId,
      }));

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        getNow: () => new Date('2026-04-22T11:00:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '60368',
            sourceSetNumber: '60368-1',
            status: 'active',
          },
          {
            setId: '31213',
            sourceSetNumber: '31213-1',
            status: 'active',
          },
          {
            setId: '21586',
            sourceSetNumber: '21586-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '2026-04-22T09:00:00.000Z',
            updatedAt: '2026-04-22T09:00:00.000Z',
          },
        ]),
        upsertCommerceOfferLatestRecordFn: vi.fn(),
        upsertCommerceOfferSeedByCompositeKeyFn,
        updateCommerceMerchantFn: vi.fn(),
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/60368',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '60368',
          price: '114,90',
          productTitle: 'LEGO City - Poolonderzoeksschip',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31213',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '31213',
          price: '49,99',
          productTitle: 'LEGO Art voorbeeldset',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/21586',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '21586',
          price: '29,99',
          productTitle: 'LEGO voorbeeldset',
        },
      ],
    });

    expect(
      upsertCommerceOfferSeedByCompositeKeyFn.mock.calls.map(
        ([payload]) => payload.input.setId,
      ),
    ).toEqual(['60368', '31213', '21586']);
    expect(result).toMatchObject({
      importedOfferCount: 3,
      matchedCatalogSetCount: 3,
      skippedUnmatchedSetCount: 0,
      upsertedSeedCount: 3,
    });
  });

  test('matches source-style feed set numbers back to canonical Brickhunt set ids', async () => {
    const upsertCommerceOfferSeedByCompositeKeyFn = vi
      .fn()
      .mockImplementation(async ({ input }) => ({
        id: `seed-${input.setId}-alternate`,
        setId: input.setId,
        merchantId: input.merchantId,
      }));

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        getNow: () => new Date('2026-04-22T11:05:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '31213',
            sourceSetNumber: '31213-1',
            status: 'active',
          },
          {
            setId: '21586',
            sourceSetNumber: '21586-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '2026-04-22T09:00:00.000Z',
            updatedAt: '2026-04-22T09:00:00.000Z',
          },
        ]),
        upsertCommerceOfferLatestRecordFn: vi.fn(),
        upsertCommerceOfferSeedByCompositeKeyFn,
        updateCommerceMerchantFn: vi.fn(),
      },
      rows: [
        {
          affiliateDeeplink:
            'https://clk.tradetracker.example/alternate/31213-1',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '31213-1',
          price: '49,99',
          productTitle: 'LEGO Art voorbeeldset',
        },
        {
          affiliateDeeplink:
            'https://clk.tradetracker.example/alternate/21586-1',
          brand: 'LEGO',
          condition: 'new',
          currency: 'EUR',
          legoSetNumber: '21586-1',
          price: '29,99',
          productTitle: 'LEGO voorbeeldset',
        },
      ],
    });

    expect(
      upsertCommerceOfferSeedByCompositeKeyFn.mock.calls.map(
        ([payload]) => payload.input.setId,
      ),
    ).toEqual(['31213', '21586']);
    expect(result).toMatchObject({
      importedOfferCount: 2,
      matchedCatalogSetCount: 2,
      skippedUnmatchedSetCount: 0,
      upsertedSeedCount: 2,
    });
  });

  test('skips non-LEGO, unmatched, and invalid rows without writing offer state', async () => {
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn();
    const upsertCommerceOfferLatestRecordFn = vi.fn();

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '31214',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '2026-04-22T09:00:00.000Z',
            updatedAt: '2026-04-22T09:00:00.000Z',
          },
        ]),
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
        updateCommerceMerchantFn: vi.fn(),
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'LEGO',
          currency: 'USD',
          legoSetNumber: '31214',
          price: '149.99',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'Mega',
          currency: 'EUR',
          legoSetNumber: '31214',
          price: '149.99',
        },
        {
          affiliateDeeplink: 'not-a-url',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '99999',
          price: '149.99',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'LEGO',
          condition: 'used',
          currency: 'EUR',
          legoSetNumber: '31214',
          price: '149.99',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '',
          price: '149.99',
        },
      ],
    });

    expect(upsertCommerceOfferSeedByCompositeKeyFn).not.toHaveBeenCalled();
    expect(upsertCommerceOfferLatestRecordFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      importedOfferCount: 0,
      matchedCatalogSetCount: 0,
      merchantCreated: false,
      merchantSlug: 'alternate',
      skippedInvalidCurrencyCount: 1,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
      skippedUnmatchedSetCount: 1,
      totalRowCount: 5,
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
      discoveredMissingSetCount: 0,
      autoImportableMissingSetCount: 0,
      reviewNeededMissingSetCount: 0,
      ignoredOrNonSetMissingSetCount: 0,
    });
  });

  test('collects actionable unmatched set summaries when debug is enabled', async () => {
    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '10316',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '2026-04-22T09:00:00.000Z',
            updatedAt: '2026-04-22T09:00:00.000Z',
          },
        ]),
        upsertCommerceOfferLatestRecordFn: vi.fn(),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(),
        updateCommerceMerchantFn: vi.fn(),
      },
      options: {
        collectUnmatchedDebug: true,
        unmatchedSampleLimit: 2,
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/42656',
          brand: 'LEGO',
          category: 'Friends',
          currency: 'EUR',
          legoSetNumber: '42656',
          price: '12,99',
          productTitle: 'LEGO Friends Heartlake vliegveld',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/42656',
          brand: 'LEGO',
          category: 'Friends',
          currency: 'EUR',
          legoSetNumber: '42656',
          price: '13,49',
          productTitle: 'LEGO Friends Heartlake vliegveld',
        },
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/60499',
          brand: 'LEGO',
          category: 'City',
          currency: 'EUR',
          legoSetNumber: '60499',
          price: '19,99',
          productTitle: 'LEGO City testset',
        },
      ],
    });

    expect(result.unmatchedDebug).toEqual({
      byCategory: [
        {
          category: 'Friends',
          count: 2,
        },
        {
          category: 'City',
          count: 1,
        },
      ],
      sampleRows: [
        {
          brand: 'LEGO',
          category: 'Friends',
          count: 2,
          currency: 'EUR',
          highestPriceMinor: 1349,
          legoSetNumber: '42656',
          lowestPriceMinor: 1299,
          productTitle: 'LEGO Friends Heartlake vliegveld',
        },
        {
          brand: 'LEGO',
          category: 'City',
          count: 1,
          currency: 'EUR',
          highestPriceMinor: 1999,
          legoSetNumber: '60499',
          lowestPriceMinor: 1999,
          productTitle: 'LEGO City testset',
        },
      ],
      totalUnmatchedRows: 3,
      uniqueUnmatchedSetCount: 2,
      unmatchedSets: [
        {
          brand: 'LEGO',
          category: 'Friends',
          count: 2,
          currency: 'EUR',
          highestPriceMinor: 1349,
          legoSetNumber: '42656',
          lowestPriceMinor: 1299,
          productTitle: 'LEGO Friends Heartlake vliegveld',
        },
        {
          brand: 'LEGO',
          category: 'City',
          count: 1,
          currency: 'EUR',
          highestPriceMinor: 1999,
          legoSetNumber: '60499',
          lowestPriceMinor: 1999,
          productTitle: 'LEGO City testset',
        },
      ],
    });
  });

  test('does not persist unmatched LEGO set rows by default', async () => {
    const upsertDiscoveredAffiliateSetFn = vi.fn();

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        getNow: () => new Date('2026-04-22T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listCommerceMerchantsFn: vi.fn(async () => [
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '',
            updatedAt: '',
          },
        ]),
        upsertDiscoveredAffiliateSetFn,
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: 'LEGO 31214',
          price: '149,99',
          productTitle: 'LEGO Art Love 31214',
        },
      ],
    });

    expect(upsertDiscoveredAffiliateSetFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      discoveredMissingSetCount: 0,
      skippedUnmatchedSetCount: 1,
    });
  });

  test('persists unmatched LEGO set rows for admin review when discovery is enabled', async () => {
    const upsertDiscoveredAffiliateSetFn = vi.fn(async () => ({
      id: 'discovered-31214',
      affiliate: {
        id: 'merchant-alternate',
        name: 'Alternate',
        slug: 'alternate',
      },
      confidence: 'high' as const,
      createdAt: '2026-04-22T09:15:00.000Z',
      currencyCode: 'EUR',
      firstSeenAt: '2026-04-22T09:15:00.000Z',
      imageUrl: 'https://cdn.example.test/31214.jpg',
      lastSeenAt: '2026-04-22T09:15:00.000Z',
      normalizedSetId: '31214',
      priceMinor: 14999,
      productTitle: 'LEGO Art Love 31214',
      productUrl: 'https://clk.tradetracker.example/alternate/31214',
      rawPayload: {},
      sourceSetNumber: '31214-1',
      status: 'new' as const,
      updatedAt: '2026-04-22T09:15:00.000Z',
    }));

    const result = await importAlternateAffiliateFeedRows({
      dependencies: {
        getNow: () => new Date('2026-04-22T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn(async () => []),
        listCommerceMerchantsFn: vi.fn(async () => [
          {
            id: 'merchant-alternate',
            slug: 'alternate',
            name: 'Alternate',
            isActive: true,
            sourceType: 'affiliate',
            affiliateNetwork: 'TradeTracker',
            notes:
              'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
            createdAt: '',
            updatedAt: '',
          },
        ]),
        upsertDiscoveredAffiliateSetFn,
      },
      options: {
        persistDiscoveredSets: true,
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/31214',
          brand: 'LEGO',
          currency: 'EUR',
          imageUrl: 'https://cdn.example.test/31214.jpg',
          legoSetNumber: 'LEGO 31214',
          price: '149,99',
          productTitle: 'LEGO Art Love 31214',
        },
      ],
    });

    expect(upsertDiscoveredAffiliateSetFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        affiliateId: 'merchant-alternate',
        productUrl: 'https://clk.tradetracker.example/alternate/31214',
        setNumber: 'LEGO 31214',
      }),
    });
    expect(result).toMatchObject({
      discoveredMissingSetCount: 1,
      autoImportableMissingSetCount: 1,
      reviewNeededMissingSetCount: 0,
      ignoredOrNonSetMissingSetCount: 0,
    });
  });

  test('dry-run performs strict matching and reporting without DB writes', async () => {
    const createCommerceMerchantFn = vi.fn();
    const updateCommerceMerchantFn = vi.fn();
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn();
    const upsertCommerceOfferLatestRecordFn = vi.fn();

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn,
        getNow: () => new Date('2026-04-24T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '75398',
            sourceSetNumber: '75398-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([]),
        updateCommerceMerchantFn,
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
      },
      merchant: {
        affiliateNetwork: 'Adtraction',
        name: 'Goodbricks',
        notes: 'Feed-driven Goodbricks import.',
        slug: 'goodbricks',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        unmatchedSampleLimit: 5,
      },
      rows: [
        {
          affiliateDeeplink: 'https://id.goodbricks.nl/t/t?a=1&sku=75398',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75398',
          price: '139,95',
          productTitle: 'LEGO 75398 C-3PO',
        },
        {
          affiliateDeeplink: 'https://id.goodbricks.nl/t/t?a=1&sku=75446',
          brand: 'LEGO',
          category: 'Star Wars',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: '54,95',
          productTitle: 'LEGO Star Wars 75446 Grogu',
        },
        {
          affiliateDeeplink: 'https://id.goodbricks.nl/t/t?a=1&sku=missing',
          brand: 'LEGO',
          currency: 'EUR',
          price: '24,95',
          productTitle: 'LEGO zonder setnummer',
        },
      ],
    });

    expect(createCommerceMerchantFn).not.toHaveBeenCalled();
    expect(updateCommerceMerchantFn).not.toHaveBeenCalled();
    expect(upsertCommerceOfferSeedByCompositeKeyFn).not.toHaveBeenCalled();
    expect(upsertCommerceOfferLatestRecordFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      importedOfferCount: 0,
      matchedCatalogSetCount: 1,
      merchantCreated: false,
      merchantSlug: 'goodbricks',
      skippedMissingSetNumberCount: 1,
      skippedUnmatchedSetCount: 1,
      totalRowCount: 3,
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });
  });

  test('supports other affiliate feed merchants like Coolblue with the same strict importer flow', async () => {
    const createCommerceMerchantFn = vi.fn().mockResolvedValue({
      id: 'merchant-coolblue',
      slug: 'coolblue',
      name: 'Coolblue',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: 'Awin',
      notes: 'Feed-driven merchant. Current offer state is imported from Awin.',
      createdAt: '2026-04-24T09:00:00.000Z',
      updatedAt: '2026-04-24T09:00:00.000Z',
    });
    const upsertCommerceOfferSeedByCompositeKeyFn = vi.fn().mockResolvedValue({
      id: 'seed-60368-coolblue',
      setId: '60368',
      merchantId: 'merchant-coolblue',
    });
    const upsertCommerceOfferLatestRecordFn = vi
      .fn()
      .mockResolvedValue(undefined);

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn,
        getNow: () => new Date('2026-04-24T09:15:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn().mockResolvedValue([
          {
            setId: '60368',
            sourceSetNumber: '60368-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn().mockResolvedValue([]),
        upsertCommerceOfferLatestRecordFn,
        upsertCommerceOfferSeedByCompositeKeyFn,
        updateCommerceMerchantFn: vi.fn(),
      },
      merchant: {
        affiliateNetwork: 'Awin',
        name: 'Coolblue',
        notes:
          'Feed-driven merchant. Current offer state is imported from Awin.',
        slug: 'coolblue',
      },
      rows: [
        {
          affiliateDeeplink:
            'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Fwww.coolblue.nl%2Fproduct%2F60368',
          availabilityText: 'Op voorraad',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '60368',
          price: '114.99',
          productTitle: 'LEGO City Arctic Explorer Ship',
        },
      ],
    });

    expect(createCommerceMerchantFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        affiliateNetwork: 'Awin',
        isActive: true,
        name: 'Coolblue',
        slug: 'coolblue',
        sourceType: 'affiliate',
      }),
    });
    expect(upsertCommerceOfferSeedByCompositeKeyFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        merchantId: 'merchant-coolblue',
        productUrl:
          'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Fwww.coolblue.nl%2Fproduct%2F60368',
        setId: '60368',
      }),
    });
    expect(upsertCommerceOfferLatestRecordFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        availability: 'in_stock',
        currencyCode: 'EUR',
        offerSeedId: 'seed-60368-coolblue',
        priceMinor: 11499,
      }),
    });
    expect(result).toMatchObject({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: true,
      merchantSlug: 'coolblue',
      skippedUnmatchedSetCount: 0,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
    });
  });
});
