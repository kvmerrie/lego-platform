import { Readable } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import {
  normalizeBrickfeverFeedProductToFeedRow,
  parseBrickfeverProductFeedXmlStream,
  resolveBrickfeverSetNumber,
  syncBrickfeverFeed,
} from './brickfever-feed-sync-server';

const sampleBrickfeverFeedXml = `<?xml version="1.0"?>
<root>
  <feed_info>
    <title>BrickWatch Feed</title>
  </feed_info>
  <all_products>
    <product>
      <lego_set_id>10280</lego_set_id>
      <title>LEGO Icons - Bloemenboeket - 10280</title>
      <price>47.99</price>
      <url>https://brickfever.nl/products/lego-icons-bloemenboeket-10280/</url>
      <stock_quantity>3</stock_quantity>
      <stock_status>Op voorraad</stock_status>
      <ean>5702016913767</ean>
    </product>
    <product>
      <lego_set_id>99999</lego_set_id>
      <title>LEGO Harry Potter Collection Nintendo Switch</title>
      <price>24.95</price>
      <url>https://brickfever.nl/products/lego-harry-potter-game/</url>
      <stock_quantity>2</stock_quantity>
      <stock_status>Op voorraad</stock_status>
      <ean>8711111111111</ean>
    </product>
    <product>
      <title>LEGO Star Wars Grogu 75446</title>
      <price>54.95</price>
      <url>https://brickfever.nl/products/lego-star-wars-grogu-75446/</url>
      <stock_quantity>1</stock_quantity>
      <stock_status>Op voorraad</stock_status>
      <ean>5702015357197</ean>
    </product>
    <product>
      <lego_set_id>10316</lego_set_id>
      <title>BRIO Houten trein</title>
      <price>19.95</price>
      <url>https://brickfever.nl/products/brio-houten-trein/</url>
      <stock_quantity>0</stock_quantity>
      <stock_status>Niet op voorraad</stock_status>
      <ean>5702017581233</ean>
    </product>
  </all_products>
</root>`;

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
    merchantSlug: 'brickfever',
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

describe('Brickfever feed sync server', () => {
  test('parses the Brickfever XML stream and normalizes a valid LEGO set', async () => {
    const [product] = await parseBrickfeverProductFeedXmlStream({
      stream: Readable.from([sampleBrickfeverFeedXml]),
    });

    expect(normalizeBrickfeverFeedProductToFeedRow(product)).toMatchObject({
      affiliateDeeplink:
        'https://brickfever.nl/products/lego-icons-bloemenboeket-10280/',
      availabilityText: 'In stock',
      brand: 'LEGO',
      condition: 'new',
      currency: 'EUR',
      ean: '5702016913767',
      legoSetNumber: '10280',
      price: '47.99',
      productTitle: 'LEGO Icons - Bloemenboeket - 10280',
      sourceMetadata: {
        source: 'brickfever-direct-feed',
        stockQuantity: 3,
        stockStatus: 'Op voorraad',
      },
    });
  });

  test('uses only the explicit lego_set_id as set number', () => {
    expect(
      resolveBrickfeverSetNumber({
        ean: '5702015357197',
        title: 'LEGO Star Wars Grogu 75446',
        url: 'https://brickfever.nl/products/lego-star-wars-grogu-75446/',
      }),
    ).toBeUndefined();

    expect(
      resolveBrickfeverSetNumber({
        legoSetId: '75446-1',
        title: 'LEGO Star Wars Grogu',
      }),
    ).toBe('75446');
  });

  test('filters LEGO software and accessories as non-construction offers', () => {
    expect(
      normalizeBrickfeverFeedProductToFeedRow({
        legoSetId: '99999',
        price: '24.95',
        title: 'LEGO Harry Potter Collection Nintendo Switch',
        url: 'https://brickfever.nl/products/lego-harry-potter-game/',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
    });
  });

  test('passes direct merchant rows through the strict importer', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const result = await syncBrickfeverFeed({
      dependencies: {
        fetchFn: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(sampleBrickfeverFeedXml)),
        getBrickfeverFeedConfigFn: () => ({
          feedUrl: 'https://bfautomation.nl/bf-create-bwfeed/brickwatch.xml',
          merchantName: 'Brickfever',
          merchantSlug: 'brickfever',
        }),
        importFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 4,
        dryRun: true,
        maxProducts: 10,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        name: 'Brickfever',
        notes:
          'Feed-driven non-affiliate merchant. Current offer state is imported from the Brickfever product feed.',
        slug: 'brickfever',
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
            'https://brickfever.nl/products/lego-icons-bloemenboeket-10280/',
          brand: 'LEGO',
          legoSetNumber: '10280',
          productTitle: 'LEGO Icons - Bloemenboeket - 10280',
        }),
      ],
    });
    expect(result).toMatchObject({
      availabilityDistribution: {
        'In stock': 3,
        'Out of stock': 1,
      },
      debugInfo: {
        fetchedProductCount: 4,
        legoCandidateCount: 3,
        parseFailureCount: 0,
        sampleCount: 3,
      },
      excludedReasonCounts: {
        missing_or_invalid_lego_set_id: 1,
        non_lego: 1,
        non_construction_lego: 1,
      },
      fetchedProductCount: 4,
      legoCandidateCount: 3,
      normalizedRowCount: 1,
      parseFailureCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
    });
  });

  test('direct merchant metadata has no affiliate network and dry-run writes nothing', async () => {
    const createMerchant = vi.fn();
    const upsertSeed = vi.fn();
    const upsertLatest = vi.fn();
    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: createMerchant,
        listCanonicalCatalogSetsFn: vi.fn(async () => [
          {
            setId: '10280',
            sourceSetNumber: '10280-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => []),
        updateCommerceMerchantFn: vi.fn(),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        name: 'Brickfever',
        notes: 'Feed-driven Brickfever import.',
        slug: 'brickfever',
        sourceType: 'direct',
      },
      options: {
        dryRun: true,
      },
      rows: [
        {
          affiliateDeeplink:
            'https://brickfever.nl/products/lego-icons-bloemenboeket-10280/',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '10280',
          price: 47.99,
          productTitle: 'LEGO Icons - Bloemenboeket - 10280',
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
});
