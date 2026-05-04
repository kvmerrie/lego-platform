import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import {
  dedupeAdtractionGoodbricksRows,
  normalizeAdtractionGoodbricksProductToAffiliateFeedRow,
  parseAdtractionGoodbricksProductFeedXml,
  syncAdtractionGoodbricksFeed,
} from './adtraction-goodbricks-sync-server';

const sampleGoodbricksFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <item>
      <g:id>75446</g:id>
      <title>LEGO Star Wars 75446 Grogu</title>
      <description><![CDATA[LEGO® Star Wars displayset met Grogu.]]></description>
      <g:product_type>LEGO® Thema's &gt; Star Wars</g:product_type>
      <link>https://id.goodbricks.nl/t/t?a=1&amp;url=https://www.goodbricks.nl/lego-star-wars-75446-grogu.html</link>
      <g:image_link>https://www.goodbricks.nl/media/catalog/product/7/5/75446.jpg</g:image_link>
      <g:condition></g:condition>
      <g:availability>in_stock</g:availability>
      <g:sale_price>54,95 EUR</g:sale_price>
      <g:price>59.95 EUR</g:price>
      <g:gtin>5702010000000</g:gtin>
      <g:brand>LEGO®</g:brand>
      <g:mpn>75446</g:mpn>
      <g:item_group_id></g:item_group_id>
      <g:shipping>
        <g:country>NL</g:country>
        <g:price>5.95 EUR</g:price>
      </g:shipping>
    </item>
    <item>
      <g:id>goodbricks-product-1</g:id>
      <title>LEGO 75398 C-3PO</title>
      <description>LEGO droid displayset.</description>
      <g:product_type>LEGO® Thema's &gt; Star Wars</g:product_type>
      <link>https://id.goodbricks.nl/t/t?a=1&amp;url=https://www.goodbricks.nl/lego-75398-c-3po.html</link>
      <g:image_link>https://www.goodbricks.nl/media/catalog/product/7/5/75398.jpg</g:image_link>
      <g:availability>0</g:availability>
      <g:price>139,95 EUR</g:price>
      <g:gtin>5702017584500</g:gtin>
      <g:brand>Lego Star Wars</g:brand>
      <g:mpn></g:mpn>
    </item>
    <item>
      <g:id>9000000000012</g:id>
      <title>Houten trein 10316</title>
      <description>Geen LEGO product.</description>
      <g:product_type>Speelgoed</g:product_type>
      <link>https://id.goodbricks.nl/t/t?a=1&amp;url=https://www.goodbricks.nl/houten-trein-10316.html</link>
      <g:price>24.95 EUR</g:price>
      <g:gtin>5702016111859</g:gtin>
      <g:brand>BRIO</g:brand>
    </item>
  </channel>
</rss>`;

describe('Adtraction Goodbricks sync server', () => {
  test('parses Google Merchant RSS XML from the Adtraction feed', () => {
    const products = parseAdtractionGoodbricksProductFeedXml(
      sampleGoodbricksFeedXml,
    );

    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({
      availability: 'in_stock',
      brand: 'LEGO®',
      gtin: '5702010000000',
      id: '75446',
      mpn: '75446',
      price: '59.95 EUR',
      salePrice: '54,95 EUR',
      shippingCost: '5.95 EUR',
      title: 'LEGO Star Wars 75446 Grogu',
    });
  });

  test.each([
    ['LEGO Star Wars 75446 Grogu', '75446'],
    ['LEGO 75398 C-3PO', '75398'],
    ['LEGO® Icons 10316 Rivendell', '10316'],
  ])('extracts strict LEGO set number from title %s', (title, setNumber) => {
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        brand: 'LEGO',
        link: `https://www.goodbricks.nl/${setNumber}.html`,
        price: '99.95 EUR',
        title,
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: setNumber,
    });
  });

  test('normalizes Goodbricks products into the strict affiliate feed row shape', () => {
    const [product] = parseAdtractionGoodbricksProductFeedXml(
      sampleGoodbricksFeedXml,
    );

    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow(product),
    ).toEqual({
      affiliateDeeplink:
        'https://id.goodbricks.nl/t/t?a=1&url=https://www.goodbricks.nl/lego-star-wars-75446-grogu.html',
      availabilityText: 'In stock',
      brand: 'LEGO',
      category: "LEGO® Thema's > Star Wars",
      condition: undefined,
      currency: 'EUR',
      description: 'LEGO® Star Wars displayset met Grogu.',
      ean: '5702010000000',
      imageUrl: 'https://www.goodbricks.nl/media/catalog/product/7/5/75446.jpg',
      legoSetNumber: '75446',
      price: 54.95,
      productId: '75446',
      productTitle: 'LEGO Star Wars 75446 Grogu',
      shippingCost: 5.95,
    });
  });

  test('skips non-LEGO products by leaving their brand non-LEGO for the strict importer', () => {
    const products = parseAdtractionGoodbricksProductFeedXml(
      sampleGoodbricksFeedXml,
    );

    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow(products[2]),
    ).toMatchObject({
      brand: 'BRIO',
      legoSetNumber: undefined,
    });
  });

  test('does not use EAN or long Adtraction product ids as LEGO set numbers', () => {
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        brand: 'LEGO',
        gtin: '5702017581233',
        id: '9000000000012',
        link: 'https://www.goodbricks.nl/lego-displayset-zonder-nummer.html',
        price: '59.99 EUR',
        title: 'LEGO Architecture Trevifontein',
      }),
    ).toMatchObject({
      ean: '5702017581233',
      legoSetNumber: undefined,
      productId: '9000000000012',
    });
  });

  test('uses exact five-digit product id only when LEGO context is clear', () => {
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        brand: 'LEGO',
        id: '6247',
        price: '99.95 EUR',
        title: 'LEGO System Bounty Boat',
      }).legoSetNumber,
    ).toBeUndefined();
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        brand: 'LEGO',
        id: '10316',
        price: '399.95 EUR',
        title: 'LEGO Icons Rivendell',
      }).legoSetNumber,
    ).toBe('10316');
  });

  test('falls back to EUR, parses comma and dot prices, and maps availability', () => {
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        availability: 'true',
        brand: 'LEGO',
        mpn: '10316-1',
        price: '399,95',
        title: 'LEGO® Icons 10316 Rivendell',
      }),
    ).toMatchObject({
      availabilityText: 'In stock',
      currency: 'EUR',
      legoSetNumber: '10316',
      price: 399.95,
    });
    expect(
      normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
        availability: 'out_of_stock',
        brand: 'LEGO',
        mpn: '75398',
        price: '139.95 EUR',
        title: 'LEGO 75398 C-3PO',
      }),
    ).toMatchObject({
      availabilityText: 'Out of stock',
      price: 139.95,
    });
  });

  test('dedupes rows by product id, deeplink and set number before import', () => {
    const row = normalizeAdtractionGoodbricksProductToAffiliateFeedRow({
      brand: 'LEGO',
      id: '75446',
      link: 'https://id.goodbricks.nl/t/t?a=1&url=https://example/75446',
      mpn: '75446',
      price: '54.95 EUR',
      title: 'LEGO Star Wars 75446 Grogu',
    });

    expect(dedupeAdtractionGoodbricksRows([row, row])).toHaveLength(1);
  });

  test('unmatched LEGO sets are reported by the strict importer but not written', async () => {
    const upsertSeed = vi.fn();
    const upsertLatest = vi.fn();

    const result = await importAffiliateFeedRowsForMerchant({
      dependencies: {
        createCommerceMerchantFn: vi.fn(async () => ({
          affiliateNetwork: 'Adtraction',
          id: 'merchant-goodbricks',
          isActive: true,
          name: 'Goodbricks',
          notes: '',
          slug: 'goodbricks',
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
        affiliateNetwork: 'Adtraction',
        name: 'Goodbricks',
        notes: 'Feed-driven Goodbricks import.',
        slug: 'goodbricks',
      },
      options: {
        collectUnmatchedDebug: true,
        unmatchedSampleLimit: 10,
      },
      rows: [
        {
          affiliateDeeplink: 'https://id.goodbricks.nl/t/t?a=1',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.95,
          productId: '75446',
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

  test('downloads, normalizes, dedupes and reuses the strict affiliate importer', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => sampleGoodbricksFeedXml,
    } as Response);
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue({
      importedOfferCount: 2,
      matchedCatalogSetCount: 2,
      merchantCreated: false,
      merchantSlug: 'goodbricks',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 0,
      totalRowCount: 3,
      upsertedLatestCount: 2,
      upsertedSeedCount: 2,
    });

    const result = await syncAdtractionGoodbricksFeed({
      dependencies: {
        fetchFn,
        getAdtractionGoodbricksFeedConfigFn: () => ({
          feedUrl: 'https://adtraction.example/goodbricks.xml',
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 2,
        unmatchedSampleLimit: 20,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'Adtraction',
        name: 'Goodbricks',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Goodbricks Adtraction product feed.',
        slug: 'goodbricks',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: undefined,
        unmatchedSampleLimit: 20,
      },
      rows: expect.arrayContaining([
        expect.objectContaining({
          affiliateDeeplink:
            'https://id.goodbricks.nl/t/t?a=1&url=https://www.goodbricks.nl/lego-star-wars-75446-grogu.html',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '75446',
          price: 54.95,
        }),
      ]),
    });
    expect(result).toMatchObject({
      debugInfo: {
        rawProductCount: 3,
        sampleCount: 2,
      },
      fetchedProductCount: 3,
      merchantName: 'Goodbricks',
      merchantSlug: 'goodbricks',
      normalizedRowCount: 3,
      upsertedLatestCount: 2,
      upsertedSeedCount: 2,
    });
  });

  test('dry-run still delegates to the strict importer with dryRun enabled', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => sampleGoodbricksFeedXml,
    } as Response);
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue({
      importedOfferCount: 0,
      matchedCatalogSetCount: 2,
      merchantCreated: false,
      merchantSlug: 'goodbricks',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 1,
      totalRowCount: 3,
      unmatchedDebug: {
        byCategory: [],
        sampleRows: [],
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
        unmatchedSets: [],
      },
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });

    const result = await syncAdtractionGoodbricksFeed({
      dependencies: {
        fetchFn,
        getAdtractionGoodbricksFeedConfigFn: () => ({
          feedUrl: 'https://adtraction.example/goodbricks.xml',
          merchantName: 'Goodbricks',
          merchantSlug: 'goodbricks',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          collectUnmatchedDebug: true,
          dryRun: true,
          unmatchedSampleLimit: 5,
        },
      }),
    );
    expect(result).toMatchObject({
      importedOfferCount: 0,
      matchedCatalogSetCount: 2,
      skippedMissingSetNumberCount: 1,
      skippedUnmatchedSetCount: 1,
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });
  });
});
