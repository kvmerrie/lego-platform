import { gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  decodeAwinCoolblueFeedBody,
  normalizeAwinCoolblueCsvRowToAffiliateFeedRow,
  parseAwinCoolblueProductFeedCsv,
  syncAwinCoolblueFeed,
} from './awin-coolblue-sync-server';

describe('Awin Coolblue sync server', () => {
  test('parses CSV rows safely, including quoted commas and escaped quotes', () => {
    const rows =
      parseAwinCoolblueProductFeedCsv(`product_name,description,mpn,search_price,currency,aw_deep_link
"LEGO City, Arctic Explorer Ship","Display set with ""quoted"" text",60368,114.99,EUR,https://awin.example/60368
`);

    expect(rows).toEqual([
      {
        product_name: 'LEGO City, Arctic Explorer Ship',
        description: 'Display set with "quoted" text',
        mpn: '60368',
        search_price: '114.99',
        currency: 'EUR',
        aw_deep_link: 'https://awin.example/60368',
      },
    ]);
  });

  test('decodes gzipped Awin feed payloads', () => {
    const payload = Buffer.from(
      'product_name,mpn,search_price,currency,aw_deep_link\nLEGO Set,60368,114.99,EUR,https://awin.example/60368\n',
      'utf8',
    );

    expect(decodeAwinCoolblueFeedBody(gzipSync(payload))).toBe(
      'product_name,mpn,search_price,currency,aw_deep_link\nLEGO Set,60368,114.99,EUR,https://awin.example/60368\n',
    );
  });

  test('normalizes Awin rows into the existing affiliate feed row shape with price fallback and availability', () => {
    expect(
      normalizeAwinCoolblueCsvRowToAffiliateFeedRow({
        aw_deep_link: 'https://awin.example/60368',
        aw_image_url: 'https://cdn.example/60368-aw.jpg',
        category_name: 'Bouwsets',
        currency: 'usd',
        delivery_cost: '0',
        description: 'LEGO City testset',
        in_stock: '1',
        merchant_category: '',
        merchant_image_url: '',
        mpn: '60368',
        product_name: 'LEGO City Arctic Explorer Ship',
        search_price: '',
        stock_status: '',
        store_price: '114.99',
      }),
    ).toEqual({
      affiliateDeeplink: 'https://awin.example/60368',
      availabilityText: 'In stock',
      brand: 'LEGO',
      category: 'Bouwsets',
      currency: 'USD',
      description: 'LEGO City testset',
      imageUrl: 'https://cdn.example/60368-aw.jpg',
      legoSetNumber: '60368',
      price: '114.99',
      productTitle: 'LEGO City Arctic Explorer Ship',
      shippingCost: '0',
    });
  });

  test('prefers stock_status when present for availability normalization', () => {
    expect(
      normalizeAwinCoolblueCsvRowToAffiliateFeedRow({
        aw_deep_link: 'https://awin.example/31213',
        currency: 'EUR',
        in_stock: '1',
        mpn: '31213',
        product_name: 'LEGO Art The Milky Way Galaxy',
        search_price: '79.99',
        stock_status: 'Tijdelijk uitverkocht',
      }),
    ).toMatchObject({
      availabilityText: 'Tijdelijk uitverkocht',
    });
  });

  test('downloads the Coolblue feed, normalizes rows, and reuses the strict affiliate importer', async () => {
    const csvBody = `aw_deep_link,product_name,merchant_image_url,description,merchant_category,search_price,currency,store_price,delivery_cost,mpn,in_stock,stock_status
https://awin.example/60368,LEGO City Arctic Explorer Ship,https://images.example/60368.jpg,LEGO City testset,City,114.99,EUR,119.99,0,60368,1,
https://awin.example/99999,Cool gadget,https://images.example/99999.jpg,Geen LEGO,Gadgets,49.99,EUR,49.99,0,99999,0,Uitverkocht
`;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => gzipSync(Buffer.from(csvBody, 'utf8')),
    } as Response);
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: true,
      merchantSlug: 'coolblue',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 0,
      totalRowCount: 2,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
      unmatchedDebug: {
        byCategory: [],
        sampleRows: [],
        totalUnmatchedRows: 0,
        uniqueUnmatchedSetCount: 0,
        unmatchedSets: [],
      },
    });

    const result = await syncAwinCoolblueFeed({
      dependencies: {
        fetchFn,
        getAwinCoolblueFeedConfigFn: () => ({
          feedUrl: 'https://feeds.awin.example/coolblue.csv.gz',
          merchantName: 'Coolblue',
          merchantSlug: 'coolblue',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 2,
        unmatchedSampleLimit: 5,
      },
    });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://feeds.awin.example/coolblue.csv.gz',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/csv'),
        }),
      }),
    );
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'Awin',
        name: 'Coolblue',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Coolblue Awin product feed.',
        slug: 'coolblue',
      },
      options: {
        collectUnmatchedDebug: true,
        unmatchedSampleLimit: 5,
      },
      rows: [
        {
          affiliateDeeplink: 'https://awin.example/60368',
          availabilityText: 'In stock',
          brand: 'LEGO',
          category: 'City',
          currency: 'EUR',
          description: 'LEGO City testset',
          imageUrl: 'https://images.example/60368.jpg',
          legoSetNumber: '60368',
          price: '114.99',
          productTitle: 'LEGO City Arctic Explorer Ship',
          shippingCost: '0',
        },
        {
          affiliateDeeplink: 'https://awin.example/99999',
          availabilityText: 'Uitverkocht',
          brand: undefined,
          category: 'Gadgets',
          currency: 'EUR',
          description: 'Geen LEGO',
          imageUrl: 'https://images.example/99999.jpg',
          legoSetNumber: '99999',
          price: '49.99',
          productTitle: 'Cool gadget',
          shippingCost: '0',
        },
      ],
    });
    expect(result).toMatchObject({
      debugInfo: {
        rowCount: 2,
        sampleCount: 2,
      },
      fetchedProductCount: 2,
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantName: 'Coolblue',
      merchantSlug: 'coolblue',
      normalizedRowCount: 2,
      skippedNonLegoCount: 1,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
    });
  });
});
