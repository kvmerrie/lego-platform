import { Readable } from 'node:stream';
import { createGunzip, gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import {
  dedupeTradeDoublerMediaMarktRows,
  normalizeMediaMarktAvailability,
  normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow,
  parseTradeDoublerMediaMarktProductFeedXmlStream,
  syncTradeDoublerMediaMarktFeed,
} from './tradedoubler-mediamarkt-sync-server';

const sampleMediaMarktFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product id="td-75446">
    <name>LEGO Star Wars 75446 Grogu</name>
    <shortDescription>LEGO® displayset met Grogu.</shortDescription>
    <description><![CDATA[LEGO Star Wars bouwset voor verzamelaars.]]></description>
    <brand>LEGO</brand>
    <categoryPath>Speelgoed &gt; LEGO &gt; Star Wars</categoryPath>
    <productUrl>https://clk.tradedoubler.example/mediamarkt/75446</productUrl>
    <imageUrl>https://images.mediamarkt.example/75446.jpg</imageUrl>
    <priceHistory>
      <price currency="EUR">54,99</price>
    </priceHistory>
    <availability>in stock</availability>
    <inStock>4</inStock>
    <ean>5702010000000</ean>
    <sku>3000123456789</sku>
    <sourceProductId>mm-75446-row</sourceProductId>
  </product>
  <product id="td-75398">
    <name>LEGO 75398 C-3PO</name>
    <field name="manufacturer">LEGO®</field>
    <field name="category">Speelgoed / LEGO</field>
    <trackingUrl>https://clk.tradedoubler.example/mediamarkt/75398</trackingUrl>
    <currentPrice>139.95 EUR</currentPrice>
    <availability>niet op voorraad</availability>
  </product>
  <product id="td-brio">
    <name>Houten trein 10316</name>
    <brand>BRIO</brand>
    <categoryPath>Speelgoed</categoryPath>
    <productUrl>https://clk.tradedoubler.example/mediamarkt/brio-10316</productUrl>
    <price currency="EUR">24.95</price>
    <ean>5702016111859</ean>
    <sku>10316</sku>
  </product>
</products>`;

function gzipXmlStream(xml: string) {
  return Readable.from([gzipSync(xml)]).pipe(createGunzip());
}

function createImportResult(overrides = {}) {
  return {
    autoImportableMissingSetCount: 0,
    changedLatestOfferCount: 2,
    changedSetIds: [],
    changedSetSlugs: [],
    discoveredMissingSetCount: 0,
    existingStaleSuccessLatestCount: 0,
    existingStaleSuccessLatestSample: [],
    ignoredOrNonSetMissingSetCount: 0,
    importedOfferCount: 2,
    latestRowsMarkedStaleCount: 0,
    latestRowsSeenCount: 2,
    matchedCatalogSetCount: 2,
    matchedOfferCount: 2,
    merchantCreated: false,
    merchantSlug: 'mediamarkt',
    reviewNeededMissingSetCount: 0,
    skippedInvalidCurrencyCount: 0,
    skippedInvalidDeeplinkCount: 0,
    skippedInvalidPriceCount: 0,
    skippedMissingSetNumberCount: 0,
    skippedNonLegoCount: 0,
    skippedNonNewCount: 0,
    skippedUnmatchedSetCount: 0,
    totalRowCount: 2,
    unchangedLatestRefreshSkippedCount: 0,
    unchangedLatestTimestampRefreshedCount: 0,
    upsertedLatestCount: 2,
    upsertedSeedCount: 2,
    ...overrides,
  };
}

function createMediaMarktFetchResponse({
  body,
  headers,
}: {
  body: Buffer | string;
  headers?: HeadersInit;
}) {
  return new Response(
    Readable.toWeb(Readable.from([body])) as BodyInit | null,
    {
      headers: {
        'content-type': 'application/xml',
        ...headers,
      },
      status: 200,
    },
  );
}

describe('TradeDoubler MediaMarkt sync server', () => {
  test('parses gzipped TradeDoubler XML stream product-by-product', async () => {
    const products = await parseTradeDoublerMediaMarktProductFeedXmlStream(
      gzipXmlStream(sampleMediaMarktFeedXml),
    );

    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({
      availability: 'in stock',
      brand: 'LEGO',
      category: 'Speelgoed > LEGO > Star Wars',
      currency: 'EUR',
      ean: '5702010000000',
      imageUrl: 'https://images.mediamarkt.example/75446.jpg',
      inStock: '4',
      name: 'LEGO Star Wars 75446 Grogu',
      price: '54,99',
      productUrl: 'https://clk.tradedoubler.example/mediamarkt/75446',
      sku: '3000123456789',
      sourceProductId: 'mm-75446-row',
    });
    expect(products[1]).toMatchObject({
      brand: 'LEGO®',
      category: 'Speelgoed / LEGO',
      price: '139.95 EUR',
      productUrl: 'https://clk.tradedoubler.example/mediamarkt/75398',
    });
  });

  test.each([
    ['LEGO Star Wars 75446 Grogu', '75446'],
    ['LEGO 75398 C-3PO', '75398'],
    ['LEGO® Icons 10316 Rivendell', '10316'],
  ])('extracts strict LEGO set number from title %s', (name, setNumber) => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'LEGO',
        name,
        price: '99.95 EUR',
        productUrl: `https://clk.tradedoubler.example/mediamarkt/${setNumber}`,
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: setNumber,
    });
  });

  test('detects LEGO products through title, brand and category text', () => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        category: 'Speelgoed / LEGO',
        name: 'Star Wars 75446 Grogu',
        price: '54.99 EUR',
        productUrl: 'https://clk.tradedoubler.example/mediamarkt/75446',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: '75446',
    });
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'LEGO®',
        name: 'C-3PO 75398',
        price: '139.95 EUR',
        productUrl: 'https://clk.tradedoubler.example/mediamarkt/75398',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: '75398',
    });
  });

  test('leaves non-LEGO products non-LEGO for strict import filtering', () => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'BRIO',
        ean: '5702016111859',
        name: 'Houten trein 10316',
        price: '24.95 EUR',
        productUrl: 'https://clk.tradedoubler.example/mediamarkt/brio',
        sku: '10316',
      }),
    ).toMatchObject({
      brand: 'BRIO',
      legoSetNumber: undefined,
    });
  });

  test('does not use EAN, SKU or TradeDoubler product id as set number', () => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'LEGO',
        ean: '5702017581233',
        name: 'LEGO Architecture Trevifontein',
        price: '59.99 EUR',
        productUrl:
          'https://clk.tradedoubler.example/mediamarkt/displayset-zonder-nummer',
        sku: '10316',
        sourceProductId: '75446',
      }),
    ).toMatchObject({
      legoSetNumber: undefined,
      productId: '75446',
    });
  });

  test('does not extract the TradeDoubler feed id from affiliate product urls', () => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'LEGO',
        name: 'LEGO Star Wars Grogu bouwset',
        price: '54.99 EUR',
        productUrl:
          'https://clk.tradedoubler.example/click?p=123&a=456&url=product(23056-1676678)',
      }),
    ).toMatchObject({
      legoSetNumber: undefined,
    });
  });

  test('skips LEGO branded videogames as construction set offers', () => {
    expect(
      normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
        brand: 'Warner Bros Games',
        category: 'Gaming / Nintendo Switch',
        name: 'LEGO Star Wars The Skywalker Saga Nintendo Switch',
        price: '29.99 EUR',
        productUrl:
          'https://clk.tradedoubler.example/mediamarkt/lego-star-wars-game',
      }),
    ).toMatchObject({
      brand: 'Warner Bros Games',
      legoSetNumber: undefined,
    });
  });

  test('skips invalid price, currency and url rows through the strict importer', async () => {
    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75446',
            sourceSetNumber: '75446-1',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => [
          {
            affiliateNetwork: 'TradeDoubler',
            createdAt: '',
            id: 'merchant-mediamarkt',
            isActive: true,
            name: 'MediaMarkt',
            notes: '',
            slug: 'mediamarkt',
            sourceType: 'affiliate',
            updatedAt: '',
          },
        ]),
        updateCommerceMerchantFn: vi.fn(async ({ input, merchantId }) => ({
          affiliateNetwork: input.affiliateNetwork,
          createdAt: '',
          id: merchantId,
          isActive: input.isActive,
          name: input.name,
          notes: input.notes ?? '',
          slug: input.slug,
          sourceType: input.sourceType,
          updatedAt: '',
        })),
        upsertCommerceOfferLatestRecordFn: vi.fn(),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(),
      },
      merchant: {
        affiliateNetwork: 'TradeDoubler',
        name: 'MediaMarkt',
        notes: 'Feed-driven MediaMarkt import.',
        slug: 'mediamarkt',
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradedoubler.example/75446',
          brand: 'LEGO',
          currency: 'USD',
          legoSetNumber: '75446',
          price: 54.99,
        },
        {
          affiliateDeeplink: 'https://clk.tradedoubler.example/75446',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: undefined,
        },
        {
          affiliateDeeplink: 'not-a-url',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.99,
        },
      ],
    });

    expect(result).toMatchObject({
      importedOfferCount: 0,
      skippedInvalidCurrencyCount: 1,
      skippedInvalidDeeplinkCount: 1,
      skippedInvalidPriceCount: 1,
    });
  });

  test('maps in-stock availability conservatively', () => {
    expect(
      normalizeMediaMarktAvailability({
        availability: 'in stock',
      }),
    ).toBe('In stock');
    expect(
      normalizeMediaMarktAvailability({
        inStock: '2',
      }),
    ).toBe('In stock');
    expect(
      normalizeMediaMarktAvailability({
        availability: 'out of stock',
      }),
    ).toBe('Out of stock');
  });

  test('unmatched LEGO sets are reported by the strict importer but not written', async () => {
    const upsertSeed = vi.fn();
    const upsertLatest = vi.fn();

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(async () => ({
          affiliateNetwork: 'TradeDoubler',
          id: 'merchant-mediamarkt',
          isActive: true,
          name: 'MediaMarkt',
          notes: '',
          slug: 'mediamarkt',
          sourceType: 'affiliate',
        })),
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75398',
            sourceSetNumber: '75398-1',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => []),
        updateCommerceMerchantFn: vi.fn(),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        affiliateNetwork: 'TradeDoubler',
        name: 'MediaMarkt',
        notes: 'Feed-driven MediaMarkt import.',
        slug: 'mediamarkt',
      },
      options: {
        collectUnmatchedDebug: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 10,
      },
      rows: [
        {
          affiliateDeeplink:
            'https://clk.tradedoubler.example/mediamarkt/75446',
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
      skippedUnmatchedSetCount: 1,
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
    });
    expect(upsertSeed).not.toHaveBeenCalled();
    expect(upsertLatest).not.toHaveBeenCalled();
  });

  test('dedupes rows by product id, deeplink and set number', () => {
    const row = normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow({
      brand: 'LEGO',
      name: 'LEGO Star Wars 75446 Grogu',
      price: '54.99 EUR',
      productUrl: 'https://clk.tradedoubler.example/mediamarkt/75446',
      sourceProductId: 'mm-75446',
    });

    expect(dedupeTradeDoublerMediaMarktRows([row, row])).toHaveLength(1);
  });

  test('downloads, streams, normalizes and reuses the strict affiliate importer', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createMediaMarktFetchResponse({
        body: gzipSync(sampleMediaMarktFeedXml),
        headers: {
          'content-encoding': 'gzip',
        },
      }),
    );
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    const result = await syncTradeDoublerMediaMarktFeed({
      dependencies: {
        fetchFn,
        getTradeDoublerMediaMarktFeedConfigFn: () => ({
          feedUrl: 'https://api.tradedoubler.example/products.xml;compress=gz',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectStaleLatestDiagnostics: true,
        collectUnmatchedDebug: true,
        debugSamples: 2,
        unmatchedSampleLimit: 20,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'TradeDoubler',
        name: 'MediaMarkt',
        notes:
          'Feed-driven merchant. Current offer state is imported from the MediaMarkt TradeDoubler product feed.',
        slug: 'mediamarkt',
      },
      options: {
        collectStaleLatestDiagnostics: true,
        collectUnmatchedDebug: true,
        dryRun: undefined,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 20,
      },
      rows: expect.arrayContaining([
        expect.objectContaining({
          affiliateDeeplink:
            'https://clk.tradedoubler.example/mediamarkt/75446',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.99,
        }),
      ]),
    });
    expect(result).toMatchObject({
      debugInfo: {
        fetchedProductCount: 3,
        legoCandidateCount: 2,
        sampleCount: 2,
      },
      fetchedProductCount: 3,
      legoCandidateCount: 2,
      merchantName: 'MediaMarkt',
      merchantSlug: 'mediamarkt',
      normalizedRowCount: 2,
      skippedNonLegoCount: 1,
      upsertedLatestCount: 2,
      upsertedSeedCount: 2,
    });
  });

  test('counts LEGO construction products without a human-text set number as missing set numbers', async () => {
    const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product id="td-affiliate-url-only">
    <name>LEGO Star Wars Grogu bouwset</name>
    <brand>LEGO</brand>
    <categoryPath>Speelgoed &gt; LEGO &gt; Star Wars</categoryPath>
    <productUrl>https://clk.tradedoubler.example/product(23056-1676678)</productUrl>
    <price currency="EUR">54.99</price>
  </product>
</products>`;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createMediaMarktFetchResponse({
        body: feedXml,
      }),
    );
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue(
      createImportResult({
        importedOfferCount: 0,
        matchedCatalogSetCount: 0,
        totalRowCount: 0,
        upsertedLatestCount: 0,
        upsertedSeedCount: 0,
      }),
    );

    const result = await syncTradeDoublerMediaMarktFeed({
      dependencies: {
        fetchFn,
        getTradeDoublerMediaMarktFeedConfigFn: () => ({
          feedUrl: 'https://api.tradedoubler.example/products.xml;compress=gz',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
      }),
    );
    expect(result).toMatchObject({
      fetchedProductCount: 1,
      legoCandidateCount: 1,
      normalizedRowCount: 0,
      skippedMissingSetNumberCount: 1,
    });
  });

  test('counts LEGO videogames separately from non-LEGO products and does not normalize them', async () => {
    const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product id="td-game">
    <name>LEGO Star Wars The Skywalker Saga Nintendo Switch</name>
    <brand>Warner Bros Games</brand>
    <categoryPath>Gaming &gt; Nintendo Switch</categoryPath>
    <productUrl>https://clk.tradedoubler.example/mediamarkt/lego-star-wars-game</productUrl>
    <price currency="EUR">29.99</price>
  </product>
</products>`;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createMediaMarktFetchResponse({
        body: feedXml,
      }),
    );
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue(
      createImportResult({
        importedOfferCount: 0,
        matchedCatalogSetCount: 0,
        totalRowCount: 0,
        upsertedLatestCount: 0,
        upsertedSeedCount: 0,
      }),
    );

    const result = await syncTradeDoublerMediaMarktFeed({
      dependencies: {
        fetchFn,
        getTradeDoublerMediaMarktFeedConfigFn: () => ({
          feedUrl: 'https://api.tradedoubler.example/products.xml',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
      }),
    );
    expect(result).toMatchObject({
      fetchedProductCount: 1,
      legoCandidateCount: 1,
      normalizedRowCount: 0,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 1,
    });
  });

  test('detects gzipped XML by magic bytes when content-encoding is missing', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createMediaMarktFetchResponse({
        body: gzipSync(sampleMediaMarktFeedXml),
        headers: {
          'content-type': 'application/octet-stream',
        },
      }),
    );
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    const result = await syncTradeDoublerMediaMarktFeed({
      dependencies: {
        fetchFn,
        getTradeDoublerMediaMarktFeedConfigFn: () => ({
          feedUrl: 'https://api.tradedoubler.example/products.xml',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
    });

    expect(result.fetchedProductCount).toBe(3);
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({
            legoSetNumber: '75446',
          }),
        ]),
      }),
    );
  });

  test('parses plain XML when compress URL is misleading and no gzip header is present', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createMediaMarktFetchResponse({
        body: sampleMediaMarktFeedXml,
      }),
    );
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    const result = await syncTradeDoublerMediaMarktFeed({
      dependencies: {
        fetchFn,
        getTradeDoublerMediaMarktFeedConfigFn: () => ({
          feedUrl: 'https://api.tradedoubler.example/products.xml;compress=gz',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
    });

    expect(result.fetchedProductCount).toBe(3);
    expect(result.normalizedRowCount).toBe(2);
  });
});
