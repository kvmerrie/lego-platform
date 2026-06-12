import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  normalizeAwinProshopCsvRowToAffiliateFeedRow,
  parseAwinProshopProductFeedCsv,
  syncAwinProshopFeed,
} from './awin-proshop-feed-sync-server';

describe('Awin Proshop feed sync server', () => {
  test('parses Proshop feed rows with the standard Awin columns', async () => {
    const rows = await parseAwinProshopProductFeedCsv(
      'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,mpn,in_stock,stock_status\nhttps://awin.example/31170,LEGO Creator 3-in-1 31170 Wild Animals Pink Flamingo,aw-31170,sku-31170,https://images.example/31170.jpg,Build the flamingo,LEGO,24.99,Proshop,12345,Building Sets,987,https://images.example/31170-aw.jpg,EUR,29.99,4.95,https://proshop.example/31170,nl,2026-06-12,"EUR 24,99",feed-1,,1,\n',
    );

    expect(rows).toEqual([
      {
        aw_deep_link: 'https://awin.example/31170',
        product_name: 'LEGO Creator 3-in-1 31170 Wild Animals Pink Flamingo',
        aw_product_id: 'aw-31170',
        merchant_product_id: 'sku-31170',
        merchant_image_url: 'https://images.example/31170.jpg',
        description: 'Build the flamingo',
        merchant_category: 'LEGO',
        search_price: '24.99',
        merchant_name: 'Proshop',
        merchant_id: '12345',
        category_name: 'Building Sets',
        category_id: '987',
        aw_image_url: 'https://images.example/31170-aw.jpg',
        currency: 'EUR',
        store_price: '29.99',
        delivery_cost: '4.95',
        merchant_deep_link: 'https://proshop.example/31170',
        language: 'nl',
        last_updated: '2026-06-12',
        display_price: 'EUR 24,99',
        data_feed_id: 'feed-1',
        mpn: '',
        in_stock: '1',
        stock_status: '',
      },
    ]);
  });

  test('normalizes Proshop rows with title set-number fallback when mpn is missing', () => {
    expect(
      normalizeAwinProshopCsvRowToAffiliateFeedRow({
        aw_deep_link: 'https://awin.example/31170',
        aw_image_url: 'https://images.example/31170-aw.jpg',
        category_name: 'Building Sets',
        currency: 'eur',
        delivery_cost: '4.95',
        description: '<p>Build the flamingo</p>',
        in_stock: '0',
        merchant_category: 'LEGO',
        merchant_image_url: '',
        mpn: '',
        product_name: 'LEGO Creator 3-in-1 31170 Wild Animals Pink Flamingo',
        search_price: '',
        stock_status: '',
        store_price: '24.99',
      }),
    ).toEqual({
      affiliateDeeplink: 'https://awin.example/31170',
      availabilityText: 'Out of stock',
      brand: 'LEGO',
      category: 'LEGO',
      currency: 'EUR',
      description: 'Build the flamingo',
      imageUrl: 'https://images.example/31170-aw.jpg',
      legoSetNumber: '31170',
      price: '24.99',
      productId: undefined,
      productTitle: 'LEGO Creator 3-in-1 31170 Wild Animals Pink Flamingo',
      shippingCost: '4.95',
    });
  });

  test('downloads the Proshop feed and uses the generic Awin affiliate importer', async () => {
    const csvBody = `aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,currency,store_price,delivery_cost,mpn,in_stock,stock_status
https://awin.example/10316,LEGO Icons 10316 Rivendell,aw-1,sku-1,https://images.example/10316.jpg,Build Rivendell,LEGO,399.99,EUR,429.99,4.95,,1,
https://awin.example/75355,LEGO Star Wars X-wing Starfighter,aw-2,sku-2,https://images.example/75355.jpg,Build the X-wing,LEGO,239.99,EUR,249.99,0,75355,0,Uitverkocht
`;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      body: Readable.toWeb(Readable.from([gzipSync(Buffer.from(csvBody))])),
      headers: new Headers({
        'content-encoding': 'gzip',
      }),
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue({
      autoImportableMissingSetCount: 0,
      changedLatestOfferCount: 1,
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
      merchantCreated: true,
      merchantSlug: 'proshop',
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
    });

    const result = await syncAwinProshopFeed({
      dependencies: {
        fetchFn,
        getAwinProshopFeedConfigFn: () => ({
          feedUrl: 'https://feeds.awin.example/proshop.csv.gz',
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        debugSamples: 1,
        dryRun: true,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'Awin',
        name: 'Proshop',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Proshop Awin product feed.',
        slug: 'proshop',
      },
      options: {
        dryRun: true,
        persistDiscoveredSets: false,
      },
      rows: [
        {
          affiliateDeeplink: 'https://awin.example/10316',
          availabilityText: 'In stock',
          brand: 'LEGO',
          category: 'LEGO',
          currency: 'EUR',
          description: 'Build Rivendell',
          imageUrl: 'https://images.example/10316.jpg',
          legoSetNumber: '10316',
          price: '399.99',
          productId: 'aw-1',
          productTitle: 'LEGO Icons 10316 Rivendell',
          shippingCost: '4.95',
        },
        {
          affiliateDeeplink: 'https://awin.example/75355',
          availabilityText: 'Uitverkocht',
          brand: 'LEGO',
          category: 'LEGO',
          currency: 'EUR',
          description: 'Build the X-wing',
          imageUrl: 'https://images.example/75355.jpg',
          legoSetNumber: '75355',
          price: '239.99',
          productId: 'aw-2',
          productTitle: 'LEGO Star Wars X-wing Starfighter',
          shippingCost: '0',
        },
      ],
    });
    expect(result).toMatchObject({
      fetchedProductCount: 2,
      importedOfferCount: 2,
      legoCandidateCount: 2,
      merchantName: 'Proshop',
      merchantSlug: 'proshop',
      normalizedRowCount: 2,
      upsertedLatestCount: 2,
      upsertedSeedCount: 2,
    });
  });
});
