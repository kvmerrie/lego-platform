import { describe, expect, test, vi } from 'vitest';
import {
  aggregateTradeTrackerLidlFeedProducts,
  normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow,
  parseTradeTrackerLidlProductFeedXml,
  syncTradeTrackerLidlFeed,
} from './tradetracker-lidl-feed-sync-server';

const sampleLidlFeedXml = `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="100396777">
    <campaignID>24118</campaignID>
    <name>LEGO Architecture 21062 Trevifontein</name>
    <price currency="EUR">59.99</price>
    <URL>https://tc.tradetracker.net/?u=https%3A%2F%2Fwww.lidl.nl%2Fp%2Flego-architecture-21062-trevifontein%2Fp100396777</URL>
    <images>
      <image>https://images.example/21062.jpg</image>
    </images>
    <description><![CDATA[LEGO® Architecture set met de Trevifontein 21062 en display details.]]></description>
    <categories>
      <category path="Speelgoed &gt; Bouwsets">Speelgoed &gt; Bouwsets</category>
    </categories>
    <properties>
      <property name="Brand">
        <value>Lego architecture</value>
      </property>
      <property name="EAN">
        <value>5702017581233</value>
      </property>
    </properties>
  </product>
  <product ID="100396777">
    <campaignID>24118</campaignID>
    <name>LEGO Architecture 21062 Trevifontein</name>
    <price currency="EUR">59.99</price>
    <URL>https://tc.tradetracker.net/?u=https%3A%2F%2Fwww.lidl.nl%2Fp%2Flego-architecture-21062-trevifontein%2Fp100396777</URL>
    <images>
      <image>https://images.example/21062.jpg</image>
    </images>
    <description><![CDATA[LEGO® Architecture set met de Trevifontein 21062 en display details.]]></description>
    <categories>
      <category path="Speelgoed &gt; Bouwsets">Speelgoed &gt; Bouwsets</category>
    </categories>
    <properties>
      <property name="LowestPrice">
        <value>54.99</value>
      </property>
      <property name="ShippingCost">
        <value>5.00</value>
      </property>
      <property name="stock">
        <value>7</value>
      </property>
    </properties>
  </product>
  <product ID="100312130001">
    <campaignID>24118</campaignID>
    <name>LEGO Art De Melkweg</name>
    <price currency="EUR">79.99</price>
    <URL>https://tc.tradetracker.net/example/31213</URL>
    <images>
      <image>https://images.example/31213.jpg</image>
    </images>
    <description><![CDATA[LEGO Art voorbeeldset]]></description>
    <categories>
      <category>Speelgoed</category>
    </categories>
    <properties>
      <property name="MPN">
        <value>31213</value>
      </property>
      <property name="ShippingCost">
        <value>0.00</value>
      </property>
    </properties>
  </product>
</products>`;

describe('TradeTracker Lidl feed sync server', () => {
  test('aggregates repeated Lidl product rows by product id and merges case-insensitive properties', () => {
    const aggregatedProducts = aggregateTradeTrackerLidlFeedProducts(
      parseTradeTrackerLidlProductFeedXml(sampleLidlFeedXml),
    );

    expect(aggregatedProducts).toHaveLength(2);
    expect(aggregatedProducts[0]).toMatchObject({
      id: '100396777',
      additional: {
        brand: 'Lego architecture',
        ean: '5702017581233',
        lowestprice: '54.99',
        shippingcost: '5.00',
        stock: '7',
      },
    });
  });

  test('extracts a LEGO set number from a clear Lidl title fallback', () => {
    const [product] = aggregateTradeTrackerLidlFeedProducts(
      parseTradeTrackerLidlProductFeedXml(sampleLidlFeedXml),
    );

    expect(
      normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: '21062',
      productId: '100396777',
      productTitle: 'LEGO Architecture 21062 Trevifontein',
    });
  });

  test('extracts a LEGO set number from the Lidl URL slug when explicit identifiers are absent', () => {
    const [product] =
      parseTradeTrackerLidlProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="100500001">
    <name>LEGO Architecture Trevifontein</name>
    <price currency="EUR">59.99</price>
    <URL>https://tc.tradetracker.net/?u=https%3A%2F%2Fwww.lidl.nl%2Fp%2Flego-architecture-21062-trevifontein%2Fp100500001</URL>
    <description><![CDATA[LEGO set zonder expliciet mpn-veld.]]></description>
    <properties>
      <property name="Brand"><value>LEGO</value></property>
    </properties>
  </product>
</products>`);

    expect(
      normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      legoSetNumber: '21062',
    });
  });

  test('does not use Lidl product ids or EAN values as LEGO set numbers', () => {
    const [product] =
      parseTradeTrackerLidlProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="100396777">
    <name>LEGO Architecture Trevifontein</name>
    <price currency="EUR">59.99</price>
    <URL>https://tc.tradetracker.net/example/no-set-number</URL>
    <description><![CDATA[LEGO displayset zonder nummer in titel of URL.]]></description>
    <properties>
      <property name="Brand"><value>Lego®</value></property>
      <property name="EAN"><value>5702017581233</value></property>
    </properties>
  </product>
</products>`);

    expect(
      normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
      productId: '100396777',
    });
  });

  test('prefers LowestPrice over the main Lidl price and maps stock > 0 to in stock', () => {
    const [product] = aggregateTradeTrackerLidlFeedProducts(
      parseTradeTrackerLidlProductFeedXml(sampleLidlFeedXml),
    );

    expect(
      normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      availabilityText: 'In stock',
      price: 54.99,
      shippingCost: '5.00',
    });
  });

  test('still reuses the strict importer with exact catalog set ids only', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => sampleLidlFeedXml,
    } as Response);
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: true,
      merchantSlug: 'lidl',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 1,
      totalRowCount: 2,
      unmatchedDebug: {
        byCategory: [
          {
            category: 'Speelgoed > Bouwsets',
            count: 1,
          },
        ],
        sampleRows: [
          {
            brand: 'LEGO',
            category: 'Speelgoed > Bouwsets',
            count: 1,
            currency: 'EUR',
            legoSetNumber: '21062',
            productId: '100396777',
            productTitle: 'LEGO Architecture 21062 Trevifontein',
          },
        ],
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
        unmatchedSets: [
          {
            brand: 'LEGO',
            category: 'Speelgoed > Bouwsets',
            count: 1,
            currency: 'EUR',
            legoSetNumber: '21062',
            productId: '100396777',
            productTitle: 'LEGO Architecture 21062 Trevifontein',
          },
        ],
      },
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
    });

    const result = await syncTradeTrackerLidlFeed({
      dependencies: {
        fetchFn,
        getTradeTrackerLidlFeedConfigFn: () => ({
          feedUrl: 'https://pf.tradetracker.net/example/lidl.xml',
          merchantName: 'Lidl',
          merchantSlug: 'lidl',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 2,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Lidl',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Lidl TradeTracker product feed.',
        slug: 'lidl',
      },
      options: {
        collectUnmatchedDebug: true,
        unmatchedSampleLimit: 5,
      },
      rows: [
        {
          affiliateDeeplink:
            'https://tc.tradetracker.net/?u=https%3A%2F%2Fwww.lidl.nl%2Fp%2Flego-architecture-21062-trevifontein%2Fp100396777',
          availabilityText: 'In stock',
          brand: 'LEGO',
          category: 'Speelgoed > Bouwsets',
          condition: undefined,
          currency: 'EUR',
          description:
            'LEGO® Architecture set met de Trevifontein 21062 en display details.',
          ean: '5702017581233',
          imageUrl: 'https://images.example/21062.jpg',
          legoSetNumber: '21062',
          price: 54.99,
          productId: '100396777',
          productTitle: 'LEGO Architecture 21062 Trevifontein',
          shippingCost: '5.00',
        },
        {
          affiliateDeeplink: 'https://tc.tradetracker.net/example/31213',
          availabilityText: undefined,
          brand: 'LEGO',
          category: 'Speelgoed',
          condition: undefined,
          currency: 'EUR',
          description: 'LEGO Art voorbeeldset',
          ean: undefined,
          imageUrl: 'https://images.example/31213.jpg',
          legoSetNumber: '31213',
          price: 79.99,
          productId: '100312130001',
          productTitle: 'LEGO Art De Melkweg',
          shippingCost: '0.00',
        },
      ],
    });
    expect(result).toMatchObject({
      aggregatedProductCount: 2,
      debugInfo: {
        aggregatedProductCount: 2,
        rawRowCount: 3,
        sampleCount: 2,
      },
      fetchedProductCount: 3,
      normalizedRowCount: 2,
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
    });
    expect(result.debugInfo?.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: '100396777',
          selectedLegoSetNumber: '21062',
          titleNumberCandidates: ['21062'],
        }),
      ]),
    );
  });
});
