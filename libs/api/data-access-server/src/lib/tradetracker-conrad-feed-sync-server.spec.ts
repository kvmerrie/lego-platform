import { describe, expect, test, vi } from 'vitest';
import {
  normalizeTradeTrackerConradFeedProductToAffiliateFeedRow,
  parseTradeTrackerConradProductFeedXml,
  syncTradeTrackerConradFeed,
} from './tradetracker-conrad-feed-sync-server';

const sampleConradFeedXml = `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="conrad-60304">
    <campaignID>920</campaignID>
    <name>LEGO® CITY 60304 Wegplaten</name>
    <price currency="EUR">18.99</price>
    <URL>https://partner.conrad.nl/click?p=920&amp;id=60304</URL>
    <images>
      <image>https://asset.conrad.example/60304.jpg</image>
    </images>
    <description><![CDATA[LEGO City bouwset met wegplaten.]]></description>
    <categories>
      <category path="Speelgoed &gt; Lego &gt; Lego City">Lego City</category>
    </categories>
    <properties>
      <property name="Merk"><value>LEGO City</value></property>
      <property name="EAN"><value>5702016912280</value></property>
      <property name="SKU"><value>60304</value></property>
      <property name="MPN"><value>60304</value></property>
      <property name="stock"><value>1</value></property>
      <property name="deliveryTime"><value>Leverbaar in 1 - 2 werkdagen</value></property>
      <property name="deliveryCosts"><value>6.95</value></property>
      <property name="CategoryPath"><value>Speelgoed &gt; Lego &gt; Lego City</value></property>
    </properties>
  </product>
  <product ID="conrad-case">
    <name>LEGO 10316 acryl display case</name>
    <price currency="EUR">79.99</price>
    <URL>https://partner.conrad.nl/click?p=920&amp;id=case</URL>
    <description>Beschermende vitrine voor LEGO 10316.</description>
    <properties>
      <property name="Merk"><value>LEGO compatible</value></property>
      <property name="SKU"><value>10316</value></property>
      <property name="stock"><value>1</value></property>
    </properties>
  </product>
  <product ID="conrad-varta">
    <name>Varta batterij 60304</name>
    <price currency="EUR">9.99</price>
    <URL>https://partner.conrad.nl/click?p=920&amp;id=varta</URL>
    <properties>
      <property name="Merk"><value>Varta</value></property>
      <property name="stock"><value>1</value></property>
    </properties>
  </product>
</products>`;

function createImportResult(overrides = {}) {
  return {
    autoImportableMissingSetCount: 0,
    changedLatestOfferCount: 0,
    changedSetIds: [],
    changedSetSlugs: [],
    discoveredMissingSetCount: 0,
    ignoredOrNonSetMissingSetCount: 0,
    importedOfferCount: 1,
    latestRowsMarkedStaleCount: 0,
    latestRowsSeenCount: 1,
    matchedCatalogSetCount: 1,
    matchedOfferCount: 1,
    merchantCreated: false,
    merchantSlug: 'conrad',
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

describe('TradeTracker Conrad feed sync server', () => {
  test('parses TradeTracker XML v2 products and stops at max products', async () => {
    const parsed = await parseTradeTrackerConradProductFeedXml(
      sampleConradFeedXml,
      {
        maxProducts: 1,
      },
    );

    expect(parsed).toMatchObject({
      parseFailureCount: 0,
      products: [
        {
          id: 'conrad-60304',
          name: 'LEGO® CITY 60304 Wegplaten',
          price: 18.99,
          priceCurrency: 'EUR',
          productUrl: 'https://partner.conrad.nl/click?p=920&id=60304',
        },
      ],
    });
  });

  test('normalizes a valid Conrad LEGO construction set offer', async () => {
    const {
      products: [product],
    } = await parseTradeTrackerConradProductFeedXml(sampleConradFeedXml);

    expect(
      normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      affiliateDeeplink: 'https://partner.conrad.nl/click?p=920&id=60304',
      availabilityText: 'In stock',
      brand: 'LEGO',
      category: 'Speelgoed > Lego > Lego City',
      condition: 'new',
      currency: 'EUR',
      ean: '5702016912280',
      legoSetNumber: '60304',
      price: 18.99,
      productId: 'conrad-60304',
      productTitle: 'LEGO® CITY 60304 Wegplaten',
      shippingCost: '6.95',
    });
  });

  test.each([
    ['stock', '0', 'Out of stock'],
    ['deliveryTime', 'Tijdelijk niet leverbaar', 'Out of stock'],
    ['deliveryTime', 'Pre-order verwacht in juni', 'Preorder'],
    ['stock', '2', 'In stock'],
    ['availability', 'Nader te bepalen', undefined],
    ['stock', '', undefined],
  ])(
    'maps Conrad availability field %s=%s deterministically',
    async (fieldName, fieldValue, expectedAvailabilityText) => {
      const {
        products: [product],
      } =
        await parseTradeTrackerConradProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="conrad-10316">
    <name>LEGO Icons 10316 Rivendell</name>
    <price currency="EUR">399.99</price>
    <URL>https://partner.conrad.nl/click?p=920&amp;id=10316</URL>
    <properties>
      <property name="Merk"><value>LEGO</value></property>
      <property name="SKU"><value>10316</value></property>
      <property name="${fieldName}"><value>${fieldValue}</value></property>
    </properties>
  </product>
</products>`);

      expect(
        normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(product),
      ).toMatchObject({
        availabilityText: expectedAvailabilityText,
        legoSetNumber: '10316',
      });
    },
  );

  test('filters accessories and non-LEGO products before import', async () => {
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const result = await syncTradeTrackerConradFeed({
      dependencies: {
        fetchFn: vi.fn<typeof fetch>().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => sampleConradFeedXml,
        } as Response),
        getTradeTrackerConradFeedConfigFn: () => ({
          feedUrl: 'https://pf.tradetracker.net/conrad.xml',
          merchantName: 'Conrad',
          merchantSlug: 'conrad',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 3,
        dryRun: true,
        maxProducts: 20,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Conrad',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Conrad TradeTracker product feed.',
        slug: 'conrad',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 5,
      },
      rows: [
        expect.objectContaining({
          brand: 'LEGO',
          legoSetNumber: '60304',
          productId: 'conrad-60304',
        }),
      ],
    });
    expect(result).toMatchObject({
      availabilityRawCounts: {
        'Leverbaar in 1 - 2 werkdagen': 1,
      },
      debugInfo: {
        fetchedProductCount: 3,
        legoCandidateCount: 2,
        sampleCount: 2,
      },
      fetchedProductCount: 3,
      legoCandidateCount: 2,
      normalizedAvailabilityCounts: {
        'In stock': 1,
      },
      normalizedRowCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
      unknownAfterMappingCount: 0,
    });
  });

  test('reports malformed product entries without importing them as valid offers', async () => {
    const {
      products: [product],
    } =
      await parseTradeTrackerConradProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="conrad-empty">
    <name></name>
    <price currency="EUR"></price>
    <URL></URL>
    <properties>
      <property name="Merk"><value>LEGO</value></property>
    </properties>
  </product>
</products>`);

    expect(
      normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(product),
    ).toMatchObject({
      affiliateDeeplink: '',
      brand: 'LEGO',
      legoSetNumber: undefined,
      price: undefined,
      productId: 'conrad-empty',
    });
  });
});
