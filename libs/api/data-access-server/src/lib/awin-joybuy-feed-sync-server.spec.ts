import { Readable } from 'node:stream';
import { createGunzip, gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  extractAwinJoybuySetNumberFromHumanFields,
  isStrictAwinJoybuyLegoCandidate,
  normalizeAwinJoybuyCsvRowToAffiliateFeedRow,
  syncAwinJoybuyFeed,
} from './awin-joybuy-feed-sync-server';
import { parseAwinProductFeedCsvStream } from './awin-feed-sync-server';

function createGzippedCsvStream(csv: string): Readable {
  return Readable.from([gzipSync(Buffer.from(csv, 'utf8'))]).pipe(
    createGunzip(),
  );
}

describe('Awin Joybuy feed sync server', () => {
  test('parses gzipped Awin CSV rows as a stream', async () => {
    const rows = [];

    for await (const row of parseAwinProductFeedCsvStream(
      createGzippedCsvStream(
        'product_name,description,search_price,currency\n"LEGO City, Truck","Set with ""quotes""",12.99,EUR\n',
      ),
    )) {
      rows.push(row);
    }

    expect(rows).toEqual([
      {
        product_name: 'LEGO City, Truck',
        description: 'Set with "quotes"',
        search_price: '12.99',
        currency: 'EUR',
      },
    ]);
  });

  test('keeps strict LEGO set candidates', () => {
    expect(
      isStrictAwinJoybuyLegoCandidate({
        product_name: 'LEGO Star Wars 75355 X-wing Starfighter',
      }),
    ).toBe(true);
  });

  test('filters videogames and software before set matching', () => {
    const row = normalizeAwinJoybuyCsvRowToAffiliateFeedRow({
      product_name: 'LEGO Star Wars 75355 Nintendo Switch game',
      description: 'Software',
      search_price: '39.99',
      currency: 'EUR',
    });

    expect(row.brand).toBeUndefined();
    expect(row.legoSetNumber).toBeUndefined();
  });

  test('extracts set numbers only from human fields', () => {
    expect(
      extractAwinJoybuySetNumberFromHumanFields({
        product_name: 'LEGO Icons 10316 The Lord of the Rings Rivendell',
        description: '',
        merchant_category: 'Bouwsets',
        category_name: 'LEGO',
      }),
    ).toBe('10316');
  });

  test('does not extract set numbers from aw_product_id', () => {
    expect(
      normalizeAwinJoybuyCsvRowToAffiliateFeedRow({
        aw_product_id: '10316',
        product_name: 'LEGO Icons Rivendell',
        description: 'LEGO bouwset zonder nummer',
        merchant_category: 'Bouwsets',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
    });
  });

  test('does not extract set numbers from merchant_product_id', () => {
    expect(
      normalizeAwinJoybuyCsvRowToAffiliateFeedRow({
        merchant_product_id: '75355',
        product_name: 'LEGO Star Wars X-wing Starfighter',
        description: 'LEGO bouwset zonder nummer',
        category_name: 'LEGO',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
    });
  });

  test('reports unmatched rows and maps Joybuy rows through the strict importer', async () => {
    const csvBody = `aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,category_name,search_price,currency,store_price,delivery_cost,in_stock,stock_status
https://awin.example/10316,LEGO Icons 10316 Rivendell,aw-1,sku-1,https://images.example/10316.jpg,Build Rivendell,Bouwsets,LEGO,399.99,EUR,429.99,4.95,1,
https://awin.example/75355,LEGO Star Wars 75355 X-wing Starfighter,aw-2,sku-2,https://images.example/75355.jpg,Build the X-wing,Bouwsets,LEGO,239.99,EUR,249.99,0,0,Uitverkocht
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
      importedOfferCount: 1,
      latestRowsMarkedStaleCount: 0,
      latestRowsSeenCount: 1,
      matchedCatalogSetCount: 1,
      matchedOfferCount: 1,
      merchantCreated: false,
      merchantSlug: 'joybuy',
      reviewNeededMissingSetCount: 0,
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 0,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 1,
      totalRowCount: 2,
      unchangedLatestRefreshSkippedCount: 0,
      unchangedLatestTimestampRefreshedCount: 0,
      upsertedLatestCount: 1,
      upsertedSeedCount: 1,
      unmatchedDebug: {
        byCategory: [{ category: 'Bouwsets', count: 1 }],
        sampleRows: [{ count: 1, legoSetNumber: '75355' }],
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
        unmatchedSets: [{ count: 1, legoSetNumber: '75355' }],
      },
    });

    const result = await syncAwinJoybuyFeed({
      dependencies: {
        fetchFn,
        getAwinJoybuyFeedConfigFn: () => ({
          feedUrl: 'https://feeds.awin.example/joybuy.csv.gz',
          merchantName: 'Joybuy',
          merchantSlug: 'joybuy',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 1,
        dryRun: true,
        unmatchedSampleLimit: 5,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'Awin',
        name: 'Joybuy',
        notes:
          'Feed-driven merchant. Current offer state is imported from the Joybuy Awin product feed.',
        slug: 'joybuy',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 5,
      },
      rows: [
        {
          affiliateDeeplink: 'https://awin.example/10316',
          availabilityText: 'In stock',
          brand: 'LEGO',
          category: 'Bouwsets',
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
          category: 'Bouwsets',
          currency: 'EUR',
          description: 'Build the X-wing',
          imageUrl: 'https://images.example/75355.jpg',
          legoSetNumber: '75355',
          price: '239.99',
          productId: 'aw-2',
          productTitle: 'LEGO Star Wars 75355 X-wing Starfighter',
          shippingCost: '0',
        },
      ],
    });
    expect(result).toMatchObject({
      fetchedProductCount: 2,
      legoCandidateCount: 2,
      merchantName: 'Joybuy',
      merchantSlug: 'joybuy',
      normalizedRowCount: 2,
      skippedUnmatchedSetCount: 1,
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
    });
  });
});
