import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import {
  normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow,
  parseTradeTrackerCoppenswarenhuisProductFeedXml,
  syncTradeTrackerCoppenswarenhuisFeed,
} from './tradetracker-coppenswarenhuis-feed-sync-server';

const sampleCoppensFeedXml = `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="cw-75446">
    <name>LEGO Star Wars 75446 Grogu bouwset</name>
    <price currency="EUR">54,99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=campaign-99999</URL>
    <images>
      <image>https://images.example/75446.jpg</image>
    </images>
    <description><![CDATA[LEGO® Star Wars bouwset met displayfiguur.]]></description>
    <categories>
      <category path="Speelgoed &gt; Bouwsets">Speelgoed &gt; Bouwsets</category>
    </categories>
    <properties>
      <property name="Brand"><value>LEGO</value></property>
      <property name="EAN"><value>5702010000000</value></property>
      <property name="SKU"><value>99999</value></property>
      <property name="stock"><value>3</value></property>
      <property name="ShippingCost"><value>4.95</value></property>
    </properties>
  </product>
  <product ID="cw-game">
    <name>LEGO Harry Potter Collection Nintendo Switch</name>
    <price currency="EUR">24.99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=game</URL>
    <description>LEGO videogame voor Nintendo Switch.</description>
    <categories>
      <category>Gaming &gt; Nintendo Switch</category>
    </categories>
    <properties>
      <property name="Brand"><value>Warner Bros Games</value></property>
    </properties>
  </product>
  <product ID="cw-brio">
    <name>Houten trein 10316</name>
    <price currency="EUR">19.99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=brio</URL>
    <properties>
      <property name="Brand"><value>BRIO</value></property>
    </properties>
  </product>
</products>`;

function createImportResult(overrides = {}) {
  return {
    importedOfferCount: 1,
    matchedCatalogSetCount: 1,
    merchantCreated: false,
    merchantSlug: 'coppenswarenhuis',
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
    ...overrides,
  };
}

describe('TradeTracker Coppenswarenhuis feed sync server', () => {
  test('normalizes a valid Coppenswarenhuis LEGO title with set number', () => {
    const [product] =
      parseTradeTrackerCoppenswarenhuisProductFeedXml(sampleCoppensFeedXml);

    expect(
      normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
        product,
      ),
    ).toMatchObject({
      affiliateDeeplink:
        'https://tc.tradetracker.net/click?p=123&id=campaign-99999',
      availabilityText: 'In stock',
      brand: 'LEGO',
      category: 'Speelgoed > Bouwsets',
      condition: 'new',
      currency: 'EUR',
      ean: '5702010000000',
      legoSetNumber: '75446',
      price: 54.99,
      productId: 'cw-75446',
      productTitle: 'LEGO Star Wars 75446 Grogu bouwset',
      shippingCost: '4.95',
    });
  });

  test.each([
    ['availability', 'Op voorraad', 'In stock'],
    ['stockStatus', 'Direct leverbaar', 'In stock'],
    ['availabilityText', 'Tijdelijk niet leverbaar', 'Out of stock'],
    ['availability', 'Uitverkocht', 'Out of stock'],
    ['levertijd', 'Pre-order verwacht in juni', 'Preorder'],
    ['availability', 'Nader te bepalen', undefined],
    ['stock', '', undefined],
  ])(
    'maps Coppens availability field %s=%s deterministically',
    (fieldName, fieldValue, expectedAvailabilityText) => {
      const [product] =
        parseTradeTrackerCoppenswarenhuisProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="cw-10316">
    <name>LEGO Icons 10316 Rivendell</name>
    <price currency="EUR">399.99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=10316</URL>
    <properties>
      <property name="Brand"><value>LEGO</value></property>
      <property name="fromPrice"><value>399.99</value></property>
      <property name="${fieldName}"><value>${fieldValue}</value></property>
    </properties>
  </product>
</products>`);

      expect(
        normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
          product,
        ),
      ).toMatchObject({
        availabilityText: expectedAvailabilityText,
        legoSetNumber: '10316',
      });
    },
  );

  test('uses complete Coppens TradeTracker offer presence as the fallback stock signal', () => {
    const [product] =
      parseTradeTrackerCoppenswarenhuisProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="cw-10316">
    <name>LEGO Icons 10316 Rivendell</name>
    <price currency="EUR">399.99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=10316</URL>
    <properties>
      <property name="Brand"><value>LEGO</value></property>
      <property name="fromPrice"><value>399.99</value></property>
    </properties>
  </product>
</products>`);

    expect(
      normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
        product,
      ),
    ).toMatchObject({
      availabilityText: 'In stock',
      legoSetNumber: '10316',
    });
  });

  test('does not use EAN, SKU, product id or deeplink ids as set numbers', () => {
    const [product] =
      parseTradeTrackerCoppenswarenhuisProductFeedXml(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product ID="75446">
    <name>LEGO Star Wars Grogu bouwset</name>
    <price currency="EUR">54.99</price>
    <URL>https://tc.tradetracker.net/click?p=123&amp;id=23056-1676678</URL>
    <description>LEGO bouwset zonder setnummer in tekst.</description>
    <properties>
      <property name="Brand"><value>LEGO</value></property>
      <property name="EAN"><value>5702017581233</value></property>
      <property name="SKU"><value>10316</value></property>
    </properties>
  </product>
</products>`);

    expect(
      normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
        product,
      ),
    ).toMatchObject({
      legoSetNumber: undefined,
      productId: '75446',
    });
  });

  test('skips LEGO videogames and software as construction set offers', () => {
    const [, gameProduct] =
      parseTradeTrackerCoppenswarenhuisProductFeedXml(sampleCoppensFeedXml);

    expect(
      normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
        gameProduct,
      ),
    ).toMatchObject({
      brand: 'Warner Bros Games',
      legoSetNumber: undefined,
    });
  });

  test('passes only construction-set rows to the strict importer and keeps candidate counts clear', async () => {
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const result = await syncTradeTrackerCoppenswarenhuisFeed({
      dependencies: {
        fetchFn: vi.fn<typeof fetch>().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => sampleCoppensFeedXml,
        } as Response),
        getTradeTrackerCoppenswarenhuisFeedConfigFn: () => ({
          feedUrl: 'https://pf.tradetracker.net/example/coppens.xml',
          merchantName: 'Coppenswarenhuis',
          merchantSlug: 'coppenswarenhuis',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 3,
        dryRun: true,
        maxProducts: 10,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Coppenswarenhuis',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Coppenswarenhuis TradeTracker product feed.',
        slug: 'coppenswarenhuis',
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
          legoSetNumber: '75446',
          productId: 'cw-75446',
        }),
      ],
    });
    expect(result).toMatchObject({
      availabilityRawCounts: {
        '3': 1,
      },
      debugInfo: {
        availabilityRawCounts: {
          '3': 1,
        },
        fetchedProductCount: 3,
        legoCandidateCount: 2,
        normalizedAvailabilityCounts: {
          'In stock': 1,
        },
        sampleCount: 2,
        unknownAfterMappingCount: 0,
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

  test('reports unmatched catalog sets but does not write them', async () => {
    const upsertSeed = vi.fn();
    const upsertLatest = vi.fn();

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75446',
            sourceSetNumber: '75446-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => [
          {
            affiliateNetwork: 'TradeTracker',
            createdAt: '',
            id: 'merchant-coppens',
            isActive: true,
            name: 'Coppenswarenhuis',
            notes: '',
            slug: 'coppenswarenhuis',
            sourceType: 'affiliate',
            updatedAt: '',
          },
        ]),
        updateCommerceMerchantFn: vi.fn(async ({ input }) => ({
          affiliateNetwork: input.affiliateNetwork ?? 'TradeTracker',
          createdAt: '',
          id: 'merchant-coppens',
          isActive: true,
          name: input.name ?? 'Coppenswarenhuis',
          notes: input.notes ?? '',
          slug: input.slug,
          sourceType: 'affiliate',
          updatedAt: '',
        })),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Coppenswarenhuis',
        notes: 'Feed-driven Coppenswarenhuis import.',
        slug: 'coppenswarenhuis',
      },
      options: {
        collectUnmatchedDebug: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 5,
      },
      rows: [
        {
          affiliateDeeplink: 'https://tc.tradetracker.net/click/99999',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '99999',
          price: 49.99,
          productTitle: 'LEGO onbekende set 99999',
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

  test('dry-run performs strict matching and writes nothing', async () => {
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
        affiliateNetwork: 'TradeTracker',
        name: 'Coppenswarenhuis',
        notes: 'Feed-driven Coppenswarenhuis import.',
        slug: 'coppenswarenhuis',
      },
      options: {
        dryRun: true,
      },
      rows: [
        {
          affiliateDeeplink: 'https://tc.tradetracker.net/click/75446',
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

  test('invalid price, currency and deeplink rows are skipped by the strict importer', async () => {
    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '75446',
            sourceSetNumber: '75446-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => [
          {
            affiliateNetwork: 'TradeTracker',
            createdAt: '',
            id: 'merchant-coppens',
            isActive: true,
            name: 'Coppenswarenhuis',
            notes: '',
            slug: 'coppenswarenhuis',
            sourceType: 'affiliate',
            updatedAt: '',
          },
        ]),
        updateCommerceMerchantFn: vi.fn(async ({ input }) => ({
          affiliateNetwork: input.affiliateNetwork ?? 'TradeTracker',
          createdAt: '',
          id: 'merchant-coppens',
          isActive: true,
          name: input.name ?? 'Coppenswarenhuis',
          notes: input.notes ?? '',
          slug: input.slug,
          sourceType: 'affiliate',
          updatedAt: '',
        })),
        upsertCommerceOfferLatestRecordFn: vi.fn(),
        upsertCommerceOfferSeedByCompositeKeyFn: vi.fn(),
      },
      merchant: {
        affiliateNetwork: 'TradeTracker',
        name: 'Coppenswarenhuis',
        notes: 'Feed-driven Coppenswarenhuis import.',
        slug: 'coppenswarenhuis',
      },
      rows: [
        {
          affiliateDeeplink: 'https://tc.tradetracker.net/click/75446',
          brand: 'LEGO',
          currency: 'USD',
          legoSetNumber: '75446',
          price: 54.99,
          productTitle: 'LEGO Star Wars 75446 Grogu',
        },
        {
          affiliateDeeplink: 'https://tc.tradetracker.net/click/75446',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: undefined,
          productTitle: 'LEGO Star Wars 75446 Grogu',
        },
        {
          affiliateDeeplink: 'not-a-url',
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
      skippedInvalidCurrencyCount: 1,
      skippedInvalidDeeplinkCount: 1,
      skippedInvalidPriceCount: 1,
    });
  });
});
