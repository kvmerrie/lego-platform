import { Readable } from 'node:stream';
import { createGunzip, gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  auditRakutenLegoFeedDiscovery,
  auditRakutenLegoFeed,
  extractRakutenLegoSetNumberFromHumanFields,
  extractRakutenLegoSetNumberFromProductFields,
  isStrictRakutenLegoSetCandidate,
  listRakutenLegoFeedFiles,
  normalizeRakutenLegoProductToAffiliateFeedRow,
  parseRakutenLegoProductFeedXmlStream,
  parseRakutenLegoProductFeedStream,
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
    merchantSlug: 'rakuten-lego-eu',
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
  enablePhaseOneImport: false,
  filename: '/GLOBAL/NL-NL_EUR/50641_4682248_mp_NL-NL_EUR.xml.gz',
  host: 'aftp.linksynergy.com',
  port: 22,
  username: 'rakuten-user',
  password: 'rakuten-password',
  sid: '4682248',
  mid: '123',
  merchantSlug: 'rakuten-lego-eu',
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
    expect(listing.failures).toEqual(
      expect.arrayContaining([
        {
          path: '.',
          message: 'list failed for .',
        },
        {
          path: '/',
          message: 'list failed for /',
        },
      ]),
    );
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

  test('parses nested Rakuten XML URL, price and shipping fields', async () => {
    const products = [];

    for await (const product of parseRakutenLegoProductFeedStream(
      Readable.from(`<?xml version="1.0" encoding="utf-8"?>
<products>
  <product>
    <product_id>5064110316</product_id>
    <name>LEGO Icons Rivendell</name>
    <brand>LEGO</brand>
    <part_number>10316</part_number>
    <URL>
      <product>https://click.linksynergy.com/link?id=test&amp;offerid=5064110316&amp;type=15&amp;murl=https%3A%2F%2Fwww.lego.com%2Ffr-fr%2Fproduct%2Frivendell-10316</product>
      <productImage>https://www.lego.com/cdn/cs/set/assets/10316.png</productImage>
    </URL>
    <price currency="EUR">
      <retail>399.99</retail>
    </price>
    <shipping>
      <availability>in-stock</availability>
    </shipping>
  </product>
</products>`),
    )) {
      products.push(product);
    }

    expect(products).toEqual([
      expect.objectContaining({
        part_number: '10316',
        price_currency: 'EUR',
        price_retail: '399.99',
        shipping_availability: 'in-stock',
        url_product: expect.stringContaining('click.linksynergy.com'),
        url_product_image: 'https://www.lego.com/cdn/cs/set/assets/10316.png',
      }),
    ]);
    expect(normalizeRakutenLegoProductToAffiliateFeedRow(products[0])).toEqual(
      expect.objectContaining({
        affiliateDeeplink: expect.stringContaining('click.linksynergy.com'),
        availabilityText: 'In stock',
        currency: 'EUR',
        imageUrl: 'https://www.lego.com/cdn/cs/set/assets/10316.png',
        legoSetNumber: '10316',
        price: '399.99',
      }),
    );
  });

  test('parses pipe-delimited Rakuten product catalog rows', async () => {
    const products = [];

    for await (const product of parseRakutenLegoProductFeedStream(
      Readable.from([
        [
          'HDR|50641|Lego EU|24/05/2026 18:02:27',
          '506416102211|La boîte de briques créatives LEGO|6102211|Toys & Games|Toys~~Building Toys|https://click.linksynergy.com/link?id=test&offerid=506416102211&type=15&murl=https%3A%2F%2Fwww.lego.com%2Ffr-fr%2Fproduct%2Flego-medium-creative-brick-box-10696|https://www.lego.com/cdn/cs/set/assets/10696.png|||Classic bricks||||24.99|||LEGO|5.95||10696|LEGO|FR:::5.95 EUR|in-stock|05702014521285|80|EUR|5100|https://ad.linksynergy.com/fs-bin/show?id=test|2020-01-01/00:00:00|kids||Classic',
        ].join('\n'),
      ]),
    )) {
      products.push(product);
    }

    expect(products).toEqual([
      expect.objectContaining({
        availability: 'in-stock',
        currency: 'EUR',
        imageurl: 'https://www.lego.com/cdn/cs/set/assets/10696.png',
        linkurl: expect.stringContaining('click.linksynergy.com'),
        part_number: '10696',
        price: '24.99',
        product_name: 'La boîte de briques créatives LEGO',
      }),
    ]);
    expect(extractRakutenLegoSetNumberFromProductFields(products[0])).toBe(
      '10696',
    );
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

  test('accepts trusted LEGO part numbers without treating Toys & Games as non-set', () => {
    expect(
      isStrictRakutenLegoSetCandidate({
        brand: 'LEGO',
        category_primary: 'Toys & Games',
        category_secondary: 'Toys~~Building Toys',
        currency: 'EUR',
        linkurl: 'https://click.linksynergy.com/link?id=test',
        name: 'La boîte de briques créatives LEGO',
        part_number: '10696',
        price: '24.99',
      }),
    ).toBe(true);
  });

  test('prefers trusted part number over incidental numbers in descriptions', () => {
    expect(
      extractRakutenLegoSetNumberFromProductFields({
        brand: 'LEGO',
        description_long: 'Depuis son voyage inaugural en 1912.',
        name: 'LEGO Le Titanic',
        part_number: '10294',
      }),
    ).toBe('10294');
  });

  test('normalizes trusted LEGO part numbers for catalog source-set matching', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product>
    <productid>lego-75192</productid>
    <productname>Millennium Falcon</productname>
    <brand>LEGO</brand>
    <part_number>75192</part_number>
    <price currency="EUR">849.99</price>
    <availability>in stock</availability>
    <linkurl>https://click.linksynergy.com/deeplink?id=abc&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Fmillennium-falcon-75192</linkurl>
  </product>
</products>`,
    });

    const report = await auditRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          filename: '/50641_4682248_mp.xml.gz',
        }),
        importAffiliateFeedRowsForMerchantFn: vi.fn(),
        listCanonicalCatalogSetsFn: async () => [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            name: 'Millennium Falcon',
            pieceCount: 7541,
            primaryTheme: 'Star Wars',
            releaseYear: 2017,
            secondaryLabels: [],
            setId: '75192',
            slug: 'millennium-falcon-75192',
            source: 'rebrickable',
            sourceSetNumber: '75192-1',
            status: 'active',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      options: {
        maxProducts: 1,
      },
    });

    expect(report.setMatching.detectedSetNumberCount).toBe(1);
    expect(report.setMatching.matchedCatalogCount).toBe(1);
    expect(report.phaseOneReadiness.dryRunMappedOfferCount).toBe(1);
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
    expect(
      isStrictRakutenLegoSetCandidate({
        brand: 'LEGO',
        name: 'Porte-clés Brique rouge LEGO',
        part_number: '850154',
      }),
    ).toBe(false);
  });

  test('audits Rakuten LEGO feed samples without invoking import writes', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product>
    <productid>lego-10316</productid>
    <productname>LEGO Icons 10316 The Lord of the Rings Rivendell</productname>
    <brand>LEGO</brand>
    <part_number>10316</part_number>
    <price currency="EUR">399.99</price>
    <availability>in stock</availability>
    <linkurl>https://click.linksynergy.com/deeplink?id=abc&amp;mid=50641&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <imageurl>https://www.lego.com/cdn/product-assets/10316.png</imageurl>
    <category>Icons</category>
    <description>Rivendell display set</description>
    <ean>5702017419725</ean>
    <age>18+</age>
    <pieces>6167</pieces>
  </product>
  <product>
    <productid>lego-keychain</productid>
    <productname>LEGO Star Wars 75355 sleutelhanger</productname>
    <brand>LEGO</brand>
    <price currency="EUR">5.99</price>
  </product>
</products>`,
    });
    const importSpy = vi.fn();

    const report = await auditRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          filename: '/50641_4682248_mp.xml.gz',
        }),
        importAffiliateFeedRowsForMerchantFn: importSpy,
        listCanonicalCatalogSetsFn: async () => [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            name: 'Rivendell',
            pieceCount: 6167,
            primaryTheme: 'Icons',
            releaseYear: 2023,
            secondaryLabels: [],
            setId: '10316',
            slug: 'rivendell-10316',
            source: 'rebrickable',
            sourceSetNumber: '10316-1',
            status: 'active',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      options: {
        maxProducts: 20,
      },
    });

    expect(importSpy).not.toHaveBeenCalled();
    expect(report.parsedProductsCount).toBe(2);
    expect(report.setMatching.legoCandidateCount).toBe(1);
    expect(report.setMatching.detectedSetNumberCount).toBe(1);
    expect(report.setMatching.matchedCatalogCount).toBe(1);
    expect(report.setMatching.nonSetProductCount).toBe(1);
    expect(report.setMatching.excludedByReason.accessory_or_merchandise).toBe(
      1,
    );
    expect(report.phaseOneReadiness.dryRunMappedOfferCount).toBe(1);
    expect(report.offerQuality.currencyCounts.EUR).toBe(2);
    expect(report.deeplink.affiliateReadyCount).toBe(1);
    expect(report.deeplink.localeCounts['nl-nl']).toBe(1);
    expect(report.assetMetadata.ageFieldCount).toBe(1);
    expect(report.assetMetadata.piecesFieldCount).toBe(1);
  });

  test('discovers visible feed files and summarizes locale distribution without writes', async () => {
    const sftpClient = createMockSftpClient({
      files: [
        {
          name: '50641_4682248_mp.xml.gz',
          size: 1000,
          type: '-',
        },
        {
          name: '50641_4682248_mp_delta.xml.gz',
          size: 100,
          type: '-',
        },
        {
          name: '50641_4682248_mp_template.txt.gz',
          size: 50,
          type: '-',
        },
      ],
      xml: `HDR|50641|Lego EU|24/05/2026 18:02:27
506416102211|La boîte de briques créatives LEGO|6102211|Toys & Games|Toys~~Building Toys|https://click.linksynergy.com/link?id=test&offerid=506416102211&type=15&murl=https%3A%2F%2Fwww.lego.com%2Ffr-fr%2Fproduct%2Flego-medium-creative-brick-box-10696|https://www.lego.com/cdn/cs/set/assets/10696.png|||Classic bricks||||24.99|||LEGO|5.95||10696|LEGO|FR:::5.95 EUR|in-stock|05702014521285|80|EUR|5100|https://ad.linksynergy.com/fs-bin/show?id=test|2020-01-01/00:00:00|kids||Classic`,
    });
    const importSpy = vi.fn();

    const report = await auditRakutenLegoFeedDiscovery({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
        importAffiliateFeedRowsForMerchantFn: importSpy,
      },
      options: {
        maxProductsPerFile: 1,
        redirectSampleLimit: 0,
      },
    });

    expect(importSpy).not.toHaveBeenCalled();
    expect(report.files.groups).toMatchObject({
      delta: 1,
      full: 1,
      template: 1,
    });
    expect(report.files.relevantFeedFiles).toEqual([
      '50641_4682248_mp.xml.gz',
      '50641_4682248_mp_delta.xml.gz',
    ]);
    expect(report.perFileAudits).toHaveLength(2);
    expect(report.perFileAudits[0]).toMatchObject({
      currencyCounts: {
        EUR: 1,
      },
      localeCounts: {
        'fr-fr': 1,
      },
    });
    expect(report.template.localeFieldHints).toEqual(
      expect.arrayContaining(['linkurl']),
    );
    expect(report.conclusion.likelyNlFeedAvailable).toBe(false);
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
        part_number: '10316',
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

  test('uses the standard NL feed filename by default', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(
        createImportResult({ matchedCatalogSetCount: 1, totalRowCount: 1 }),
      );

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
      '/GLOBAL/NL-NL_EUR/50641_4682248_mp_NL-NL_EUR.xml.gz',
    );
  });

  test('uses explicit filename override when configured', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult({ matchedCatalogSetCount: 1 }));

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
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult({ matchedCatalogSetCount: 1 }));

    await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          filename: undefined,
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
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
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
        slug: 'rakuten-lego-eu',
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
          affiliateDeeplink:
            'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316',
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
      merchantSlug: 'rakuten-lego-eu',
      normalizedRowCount: 1,
      phaseOneImportSummary: {
        eligibleImportRowCount: 1,
        excludedByReason: {},
        localeCounts: {
          'nl-nl': 1,
        },
        sampleEligibleSetNumbers: ['10316'],
      },
      unmatchedDebug: {
        totalUnmatchedRows: 1,
        uniqueUnmatchedSetCount: 1,
      },
    });
  });

  test('excludes non-NL deeplinks before the Phase 1 importer', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Ffr-fr%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    const result = await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => rakutenConfig,
        importAffiliateFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [],
      }),
    );
    expect(result.phaseOneImportSummary).toMatchObject({
      eligibleImportRowCount: 0,
      excludedByReason: {
        non_nl_deeplink_locale: 1,
      },
      localeCounts: {
        'fr-fr': 1,
      },
    });
  });

  test('blocks write imports unless the Phase 1 feature flag is enabled', async () => {
    const sftpClient = createMockSftpClient({});
    const importAffiliateFeedRowsForMerchantFn = vi.fn();

    await expect(
      syncRakutenLegoFeed({
        dependencies: {
          createSftpClientFn: () => sftpClient,
          getRakutenLegoFeedConfigFn: () => rakutenConfig,
          importAffiliateFeedRowsForMerchantFn,
        },
      }),
    ).rejects.toThrow('RAKUTEN_LEGO_PHASE1_IMPORT_ENABLED=true');
    expect(importAffiliateFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(sftpClient.connect).not.toHaveBeenCalled();
  });

  test('blocks stale merchant slug overrides before any SFTP work', async () => {
    const sftpClient = createMockSftpClient({});
    const importAffiliateFeedRowsForMerchantFn = vi.fn();

    await expect(
      syncRakutenLegoFeed({
        dependencies: {
          createSftpClientFn: () => sftpClient,
          getRakutenLegoFeedConfigFn: () => ({
            ...rakutenConfig,
            merchantSlug: 'lego-eu',
          }),
          importAffiliateFeedRowsForMerchantFn,
        },
        options: {
          dryRun: true,
        },
      }),
    ).rejects.toThrow('requires merchant slug rakuten-lego-eu');
    expect(importAffiliateFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(sftpClient.connect).not.toHaveBeenCalled();
  });

  test('allows write imports when the Phase 1 feature flag is enabled', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValueOnce(
        createImportResult({
          matchedCatalogSetCount: 1,
          skippedUnmatchedSetCount: 0,
        }),
      )
      .mockResolvedValueOnce(
        createImportResult({
          importedOfferCount: 1,
          matchedCatalogSetCount: 1,
          skippedUnmatchedSetCount: 0,
        }),
      );

    const result = await syncRakutenLegoFeed({
      dependencies: {
        createSftpClientFn: () => sftpClient,
        getRakutenLegoFeedConfigFn: () => ({
          ...rakutenConfig,
          enablePhaseOneImport: true,
        }),
        importAffiliateFeedRowsForMerchantFn,
      },
    });

    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        options: expect.objectContaining({
          dryRun: true,
          persistDiscoveredSets: false,
        }),
        rows: [
          expect.objectContaining({
            affiliateDeeplink:
              'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316',
            brand: 'LEGO',
            legoSetNumber: '10316',
          }),
        ],
      }),
    );
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        options: expect.objectContaining({
          dryRun: false,
          persistDiscoveredSets: false,
        }),
        rows: [
          expect.objectContaining({
            affiliateDeeplink:
              'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316',
            brand: 'LEGO',
            legoSetNumber: '10316',
          }),
        ],
      }),
    );
    expect(result.importedOfferCount).toBe(1);
    expect(result.preflightImportSummary).toEqual({
      matchedCatalogSetCount: 1,
      matchRate: 1,
      skippedUnmatchedSetCount: 0,
    });
  });

  test('fails before write import when the preflight match rate is too low', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <linkurl>https://click.linksynergy.com/link?id=test&amp;murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Frivendell-10316</linkurl>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult({ matchedCatalogSetCount: 0 }));

    await expect(
      syncRakutenLegoFeed({
        dependencies: {
          createSftpClientFn: () => sftpClient,
          getRakutenLegoFeedConfigFn: () => ({
            ...rakutenConfig,
            enablePhaseOneImport: true,
          }),
          importAffiliateFeedRowsForMerchantFn,
        },
      }),
    ).rejects.toThrow('match_rate=0.000');
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledTimes(1);
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          dryRun: true,
        }),
      }),
    );
  });

  test('fails before import when set-like products have missing deeplinks', async () => {
    const sftpClient = createMockSftpClient({
      xml: `<products>
  <product>
    <productname>LEGO Icons 10316 Rivendell</productname>
    <price>399.99</price>
    <currency>EUR</currency>
    <availability>available</availability>
    <part_number>10316</part_number>
  </product>
</products>`,
    });
    const importAffiliateFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());

    await expect(
      syncRakutenLegoFeed({
        dependencies: {
          createSftpClientFn: () => sftpClient,
          getRakutenLegoFeedConfigFn: () => ({
            ...rakutenConfig,
            enablePhaseOneImport: true,
          }),
          importAffiliateFeedRowsForMerchantFn,
        },
      }),
    ).rejects.toThrow('missing_deeplink_count=1');
    expect(importAffiliateFeedRowsForMerchantFn).toHaveBeenCalledTimes(1);
  });
});
