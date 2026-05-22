import { Readable } from 'node:stream';
import { createGunzip, gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  extractRakutenLegoSetNumberFromHumanFields,
  isStrictRakutenLegoSetCandidate,
  listRakutenLegoFeedFiles,
  normalizeRakutenLegoProductToAffiliateFeedRow,
  parseRakutenLegoProductFeedXmlStream,
  syncRakutenLegoFeed,
} from './rakuten-lego-feed-sync-server';

function createGzippedXmlStream(xml: string): Readable {
  return Readable.from([gzipSync(Buffer.from(xml, 'utf8'))]).pipe(
    createGunzip(),
  );
}

function createImportResult(overrides = {}) {
  return {
    autoImportableMissingSetCount: 0,
    changedLatestOfferCount: 0,
    changedSetIds: [],
    changedSetSlugs: [],
    discoveredMissingSetCount: 0,
    existingStaleSuccessLatestCount: 0,
    existingStaleSuccessLatestSample: [],
    ignoredOrNonSetMissingSetCount: 0,
    importedOfferCount: 0,
    latestRowsMarkedStaleCount: 0,
    latestRowsSeenCount: 0,
    matchedCatalogSetCount: 0,
    matchedOfferCount: 0,
    merchantCreated: false,
    merchantSlug: 'lego-eu',
    reviewNeededMissingSetCount: 0,
    skippedInvalidCurrencyCount: 0,
    skippedInvalidDeeplinkCount: 0,
    skippedInvalidPriceCount: 0,
    skippedMissingSetNumberCount: 0,
    skippedNonLegoCount: 0,
    skippedNonNewCount: 0,
    skippedUnmatchedSetCount: 0,
    totalRowCount: 0,
    unchangedLatestRefreshSkippedCount: 0,
    unchangedLatestTimestampRefreshedCount: 0,
    upsertedLatestCount: 0,
    upsertedSeedCount: 0,
    ...overrides,
  };
}

function createMockSftpClient({
  failListPaths = [],
  files = [],
  pathFiles,
  pwd = '/incoming',
  xml = '<products />',
}: {
  failListPaths?: readonly string[];
  files?: readonly {
    name: string;
    size?: number;
    type?: string;
  }[];
  pathFiles?: Readonly<
    Record<
      string,
      readonly {
        name: string;
        size?: number;
        type?: string;
      }[]
    >
  >;
  pwd?: string;
  xml?: string;
}) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    createReadStream: vi.fn(() =>
      Readable.from([gzipSync(Buffer.from(xml, 'utf8'))]),
    ),
    end: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(gzipSync(Buffer.from(xml, 'utf8'))),
    list: vi.fn().mockImplementation((path: string) => {
      if (failListPaths.includes(path)) {
        return Promise.reject(new Error(`list failed for ${path}`));
      }

      if (pathFiles?.[path]) {
        return Promise.resolve(pathFiles[path]);
      }

      if (path === '.') {
        return Promise.resolve(files);
      }

      return Promise.reject(new Error(`list failed for ${path}`));
    }),
    pwd: vi.fn().mockResolvedValue(pwd),
  };
}

const rakutenConfig = {
  host: 'aftp.linksynergy.com',
  port: 22,
  username: 'rakuten-user',
  password: 'rakuten-password',
  sid: '4682248',
  mid: '123',
  merchantSlug: 'lego-eu',
  merchantName: 'LEGO',
};

describe('Rakuten LEGO feed sync server', () => {
  test('lists SFTP root and merchant directories without importing rows', async () => {
    const sftpClient = createMockSftpClient({
      files: [
        { name: '123_4682248_mp.xml.gz', size: 42, type: '-' },
        { name: 'merchant', type: 'd' },
      ],
      pathFiles: {
        '/': [{ name: '123_4682248_mp.xml.gz', size: 43, type: '-' }],
        '123': [{ name: '123_4682248_mp.xml.gz', size: 1234, type: '-' }],
      },
    });

    const listing = await listRakutenLegoFeedFiles({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
      },
    });

    expect(sftpClient.connect).toHaveBeenCalledWith({
      host: 'aftp.linksynergy.com',
      port: 22,
      username: 'rakuten-user',
      password: 'rakuten-password',
      readyTimeout: 30_000,
    });
    expect(sftpClient.list).toHaveBeenCalledWith('.');
    expect(sftpClient.list).toHaveBeenCalledWith('/');
    expect(sftpClient.list).toHaveBeenCalledWith('123');
    expect(listing.pwd).toBe('/incoming');
    expect(listing.successfulPaths).toEqual(['.', '/', '123']);
    expect(listing.entries.map((file) => file.path)).toEqual([
      '/123_4682248_mp.xml.gz',
      '123_4682248_mp.xml.gz',
      '123/123_4682248_mp.xml.gz',
      'merchant',
    ]);
  });

  test('continues after failed root listing and reports successful MID directory listing', async () => {
    const sftpClient = createMockSftpClient({
      failListPaths: ['.', '/'],
      pathFiles: {
        '123': [
          {
            name: '123_4682248_mp.xml.gz',
            size: 1234,
            type: '-',
          },
        ],
      },
    });

    const listing = await listRakutenLegoFeedFiles({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
      },
    });

    expect(sftpClient.list).toHaveBeenCalledWith('.');
    expect(sftpClient.list).toHaveBeenCalledWith('/');
    expect(sftpClient.list).toHaveBeenCalledWith('123');
    expect(listing.failures).toEqual([
      {
        path: '.',
        message: 'list failed for .',
      },
      {
        path: '/',
        message: 'list failed for /',
      },
    ]);
    expect(listing.successfulPaths).toEqual(['123']);
    expect(listing.entries).toEqual([
      {
        listPath: '123',
        name: '123_4682248_mp.xml.gz',
        path: '123/123_4682248_mp.xml.gz',
        size: 1234,
        type: '-',
      },
    ]);
  });

  test('parses gzipped Rakuten XML products as a stream', async () => {
    const products = [];

    for await (const product of parseRakutenLegoProductFeedXmlStream(
      createGzippedXmlStream(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product>
    <productname>LEGO Icons 10316 The Lord of the Rings Rivendell</productname>
    <price currency="EUR">399.99</price>
  </product>
</products>`),
    )) {
      products.push(product);
    }

    expect(products).toEqual([
      {
        productname: 'LEGO Icons 10316 The Lord of the Rings Rivendell',
        price: '399.99',
        price_currency: 'EUR',
      },
    ]);
  });

  test('extracts LEGO set numbers only from human title fields', () => {
    expect(
      extractRakutenLegoSetNumberFromHumanFields({
        productname: 'LEGO Star Wars 75355 X-wing Starfighter',
        sku: 'ignore-me',
      }),
    ).toBe('75355');
  });

  test('does not use EAN, SKU or product ids as LEGO set numbers', () => {
    expect(
      normalizeRakutenLegoProductToAffiliateFeedRow({
        ean: '5702017419725',
        productid: '10316',
        productname: 'LEGO Icons Rivendell',
        sku: '75355',
      }),
    ).toMatchObject({
      brand: undefined,
      legoSetNumber: undefined,
    });
  });

  test('filters games, software and merchandise before matching', () => {
    expect(
      isStrictRakutenLegoSetCandidate({
        productname: 'LEGO Star Wars 75355 Nintendo Switch game',
        description: 'Software voor Nintendo Switch',
      }),
    ).toBe(false);
    expect(
      isStrictRakutenLegoSetCandidate({
        productname: 'LEGO Star Wars 75355 sleutelhanger',
        description: 'Merchandise accessory',
      }),
    ).toBe(false);
  });

  test('normalizes a valid LEGO set to the affiliate offer row shape', () => {
    expect(
      normalizeRakutenLegoProductToAffiliateFeedRow({
        productname: 'LEGO Icons 10316 The Lord of the Rings Rivendell',
        description: 'Bouw Rivendell',
        category: 'LEGO bouwsets',
        price: '399.99',
        currency: 'EUR',
        availability: 'available',
        linkurl: 'https://click.linksynergy.com/deeplink?id=abc',
        imageurl: 'https://images.example/10316.jpg',
        productid: 'rakuten-1',
      }),
    ).toEqual({
      affiliateDeeplink: 'https://click.linksynergy.com/deeplink?id=abc',
      availabilityText: 'In stock',
      brand: 'LEGO',
      category: 'LEGO bouwsets',
      condition: undefined,
      currency: 'EUR',
      description: 'Bouw Rivendell',
      ean: undefined,
      imageUrl: 'https://images.example/10316.jpg',
      legoSetNumber: '10316',
      price: '399.99',
      productId: 'rakuten-1',
      productTitle: 'LEGO Icons 10316 The Lord of the Rings Rivendell',
      shippingCost: undefined,
    });
  });

  test('uses MID plus SID filename when no explicit filename is configured', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.example/10316</linkurl>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult({ totalRowCount: 1 }));

    await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(sftpClient.createReadStream).toHaveBeenCalledWith(
      '123_4682248_mp.xml.gz',
    );
  });

  test('uses explicit filename override when configured', async () => {
    const sftpClient = createMockSftpClient({});
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          filename: 'override.xml.gz',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(sftpClient.createReadStream).toHaveBeenCalledWith('override.xml.gz');
  });

  test('uses configured remote directory for derived download paths', async () => {
    const sftpClient = createMockSftpClient({});
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          remoteDir: '123',
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(sftpClient.createReadStream).toHaveBeenCalledWith(
      '123/123_4682248_mp.xml.gz',
    );
  });

  test('passes dry-run and unmatched reporting options to the shared importer', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.example/10316</linkurl>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi.fn().mockResolvedValue(
      createImportResult({
        totalRowCount: 1,
        unmatchedDebug: {
          byCategory: [],
          sampleRows: [{ count: 1, legoSetNumber: '10316' }],
          totalUnmatchedRows: 1,
          uniqueUnmatchedSetCount: 1,
          unmatchedSets: [{ count: 1, legoSetNumber: '10316' }],
        },
      }),
    );

    const result = await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        collectUnmatchedDebug: true,
        debugSamples: 1,
        dryRun: true,
        unmatchedSampleLimit: 30,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        affiliateNetwork: 'Rakuten',
        name: 'LEGO',
        notes:
          'Feed-driven merchant. Current offer state is imported from the LEGO Rakuten Product Catalog feed.',
        slug: 'lego-eu',
        sourceType: 'affiliate',
      },
      options: {
        collectUnmatchedDebug: true,
        dryRun: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 30,
      },
      rows: [
        {
          affiliateDeeplink: 'https://click.example/10316',
          availabilityText: 'In stock',
          brand: 'LEGO',
          category: undefined,
          condition: undefined,
          currency: 'EUR',
          description: undefined,
          ean: undefined,
          imageUrl: undefined,
          legoSetNumber: '10316',
          price: '399.99',
          productId: undefined,
          productTitle: 'LEGO Icons 10316 Rivendell',
          shippingCost: undefined,
        },
      ],
    });
    expect(result).toMatchObject({
      fetchedProductCount: 1,
      legoCandidateCount: 1,
      merchantName: 'LEGO',
      merchantSlug: 'lego-eu',
      normalizedRowCount: 1,
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
    });
  });
});
