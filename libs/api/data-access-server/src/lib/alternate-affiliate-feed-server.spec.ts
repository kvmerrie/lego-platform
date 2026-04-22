import { describe, expect, test, vi } from 'vitest';
import { importAlternateAffiliateFeedRows } from './alternate-affiliate-feed-server';

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
    expect(result).toEqual({
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
    expect(result).toEqual({
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
});
