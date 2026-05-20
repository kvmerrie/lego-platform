import { Readable } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import {
  normalizeMisterBricksFeedProductToFeedRow,
  parseMisterBricksProductFeedXmlStream,
  resolveMisterBricksSetNumber,
  syncMisterBricksFeed,
} from './misterbricks-feed-sync-server';

const sampleMisterBricksFeedXml = `<?xml version='1.0' encoding='utf-8'?>
<items>
  <item>
    <availability>in stock</availability>
    <ean>5702015357197</ean>
    <link>https://misterbricks.nl/lego-star-wars-75446-grogu.html</link>
    <price>54.95</price>
    <shipping>4.95</shipping>
    <sku>75446</sku>
    <title>LEGO Star Wars 75446 Grogu bouwset</title>
  </item>
  <item>
    <availability>in stock</availability>
    <ean>5702011111111</ean>
    <link>https://misterbricks.nl/lego-harry-potter-game.html</link>
    <price>24.95</price>
    <sku>99999</sku>
    <title>LEGO Harry Potter Collection Nintendo Switch</title>
  </item>
  <item>
    <availability>in stock</availability>
    <ean>8711111111111</ean>
    <link>https://misterbricks.nl/brio-trein-10316.html</link>
    <price>19.95</price>
    <sku>10316</sku>
    <title>BRIO Houten trein 10316</title>
  </item>
</items>`;

function createImportResult(overrides = {}) {
  return {
    autoImportableMissingSetCount: 0,
    changedLatestOfferCount: 1,
    changedSetIds: [],
    changedSetSlugs: [],
    discoveredMissingSetCount: 0,
    existingStaleSuccessLatestCount: 0,
    existingStaleSuccessLatestSample: [],
    ignoredOrNonSetMissingSetCount: 0,
    importedOfferCount: 1,
    latestRowsMarkedStaleCount: 0,
    latestRowsSeenCount: 1,
    matchedCatalogSetCount: 1,
    matchedOfferCount: 1,
    merchantCreated: false,
    merchantSlug: 'misterbricks',
    reviewNeededMissingSetCount: 0,
    skippedInvalidCurrencyCount: 0,
    skippedInvalidDeeplinkCount: 0,
    skippedInvalidPriceCount: 0,
    skippedMissingSetNumberCount: 0,
    skippedNonLegoCount: 0,
    skippedNonNewCount: 0,
    skippedUnmatchedSetCount: 0,
    totalRowCount: 1,
    unchangedLatestRefreshSkippedCount: 0,
    unchangedLatestTimestampRefreshedCount: 0,
    upsertedLatestCount: 1,
    upsertedSeedCount: 1,
    ...overrides,
  };
}

describe('MisterBricks feed sync server', () => {
  test('parses the Channable XML stream and normalizes a valid LEGO set', async () => {
    const [product] = await parseMisterBricksProductFeedXmlStream({
      stream: Readable.from([sampleMisterBricksFeedXml]),
    });

    expect(normalizeMisterBricksFeedProductToFeedRow(product)).toMatchObject({
      affiliateDeeplink:
        'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
      availabilityText: 'In stock',
      brand: 'LEGO',
      condition: 'new',
      currency: 'EUR',
      ean: '5702015357197',
      legoSetNumber: '75446',
      price: '54.95',
      productId: '75446',
      productTitle: 'LEGO Star Wars 75446 Grogu bouwset',
      shippingCost: '4.95',
    });
  });

  test('does not use EAN, SKU, product id or URL ids as set numbers', () => {
    expect(
      resolveMisterBricksSetNumber({
        ean: '5702017581233',
        link: 'https://misterbricks.nl/lego-displayset-10316.html',
        price: '49.95',
        sku: '75446',
        title: 'LEGO displayset zonder nummer in de titel',
      }),
    ).toBeUndefined();
  });

  test('leaves non-LEGO products non-LEGO for strict import filtering', () => {
    expect(
      normalizeMisterBricksFeedProductToFeedRow({
        link: 'https://misterbricks.nl/brio-trein-10316.html',
        price: '19.95',
        sku: '10316',
        title: 'BRIO Houten trein 10316',
      }),
    ).toMatchObject({
      brand: undefined,
      legoSetNumber: undefined,
    });
  });

  test('skips LEGO videogames and software as construction set offers', () => {
    expect(
      normalizeMisterBricksFeedProductToFeedRow({
        link: 'https://misterbricks.nl/lego-harry-potter-game.html',
        price: '24.95',
        sku: '99999',
        title: 'LEGO Harry Potter Collection Nintendo Switch',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
    });
  });

  test('passes non-affiliate merchant rows through the strict importer', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const result = await syncMisterBricksFeed({
      dependencies: {
        fetchFn: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(sampleMisterBricksFeedXml)),
        getMisterBricksFeedConfigFn: () => ({
          feedUrl: 'https://files.channable.com/misterbricks.xml',
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
        }),
        importFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 3,
        dryRun: true,
        maxProducts: 10,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        name: 'MisterBricks',
        notes:
          'Feed-driven non-affiliate merchant. Current offer state is imported from the MisterBricks product feed.',
        slug: 'misterbricks',
        sourceType: 'direct',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 5,
      },
      rows: [
        expect.objectContaining({
          affiliateDeeplink:
            'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
          brand: 'LEGO',
          legoSetNumber: '75446',
          productId: '75446',
        }),
      ],
    });
    expect(result).toMatchObject({
      debugInfo: {
        fetchedProductCount: 3,
        legoCandidateCount: 2,
        sampleCount: 2,
      },
      fetchedProductCount: 3,
      legoCandidateCount: 2,
      normalizedRowCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
    });
  });

  test('non-affiliate merchant gets no affiliate network and dry-run writes nothing', async () => {
    const createMerchant = vi.fn();
    const upsertSeed = vi.fn();
    const upsertLatest = vi.fn();
    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: createMerchant,
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75446',
            sourceSetNumber: '75446-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => []),
        updateCommerceMerchantFn: vi.fn(),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        name: 'MisterBricks',
        notes: 'Feed-driven MisterBricks import.',
        slug: 'misterbricks',
        sourceType: 'direct',
      },
      options: {
        dryRun: true,
      },
      rows: [
        {
          affiliateDeeplink:
            'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.99,
          productTitle: 'LEGO Star Wars 75446 Grogu',
        },
      ],
    });

    expect(result).toMatchObject({
      importedOfferCount: 0,
      matchedCatalogSetCount: 1,
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });
    expect(createMerchant).not.toHaveBeenCalled();
    expect(upsertSeed).not.toHaveBeenCalled();
    expect(upsertLatest).not.toHaveBeenCalled();
  });

  test('write mode stores MisterBricks as direct merchant without affiliate network', async () => {
    const createMerchant = vi.fn(async ({ input }) => ({
      affiliateNetwork: input.affiliateNetwork,
      createdAt: '',
      id: 'merchant-misterbricks',
      isActive: input.isActive,
      name: input.name,
      notes: input.notes ?? '',
      slug: input.slug,
      sourceType: input.sourceType,
      updatedAt: '',
    }));
    const upsertSeed = vi.fn(async ({ input }) => ({
      createdAt: '',
      id: 'seed-misterbricks-75446',
      lastVerifiedAt: input.lastVerifiedAt,
      merchantId: input.merchantId,
      notes: input.notes ?? '',
      productUrl: input.productUrl,
      setId: input.setId,
      updatedAt: '',
      validationStatus: input.validationStatus,
      isActive: input.isActive,
    }));
    const upsertLatest = vi.fn(async ({ input }) => ({
      ...input,
      createdAt: '',
      id: 'latest-misterbricks-75446',
      merchantId: 'merchant-misterbricks',
      productUrl: 'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
      setId: '75446',
      updatedAt: '',
    }));

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: createMerchant,
        getNow: () => new Date('2026-05-06T10:00:00.000Z'),
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75446',
            sourceSetNumber: '75446-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => []),
        updateCommerceMerchantFn: vi.fn(),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        name: 'MisterBricks',
        notes: 'Feed-driven MisterBricks import.',
        slug: 'misterbricks',
        sourceType: 'direct',
      },
      rows: [
        {
          affiliateDeeplink:
            'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
          availabilityText: 'In stock',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.99,
          productTitle: 'LEGO Star Wars 75446 Grogu',
        },
      ],
    });

    expect(createMerchant).toHaveBeenCalledWith({
      input: {
        affiliateNetwork: undefined,
        isActive: true,
        name: 'MisterBricks',
        notes: 'Feed-driven MisterBricks import.',
        slug: 'misterbricks',
        sourceType: 'direct',
      },
    });
    expect(upsertSeed).toHaveBeenCalledWith({
      input: expect.objectContaining({
        merchantId: 'merchant-misterbricks',
        notes:
          'Feed-driven MisterBricks import. Exact matched by LEGO set number. Product title: LEGO Star Wars 75446 Grogu.',
        productUrl: 'https://misterbricks.nl/lego-star-wars-75446-grogu.html',
        setId: '75446',
      }),
    });
    expect(result).toMatchObject({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
    });
  });
});
