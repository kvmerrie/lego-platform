import { Readable } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';
import { importAffiliateFeedRowsForMerchant } from './alternate-affiliate-feed-server';
import { classifyScheduledJobFailure } from './scheduled-job-reliability';
import {
  normalizeUniekeBricksFeedProductToFeedRow,
  parseUniekeBricksProductFeedXmlStream,
  resolveUniekeBricksSetNumber,
  syncUniekeBricksFeed,
} from './unieke-bricks-feed-sync-server';

const sampleUniekeBricksFeedXml = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Brickhunt</title>
    <link>https://uniekebricks.nl</link>
    <description>WooCommerce Product Feed PRO</description>
    <item>
      <g:id>96483</g:id>
      <g:title>LEGO 40688 Trofee (schade doos)</g:title>
      <g:description><![CDATA[<p>Bouw de LEGO 40688 Trofee.</p>]]></g:description>
      <g:link>https://uniekebricks.nl/schade-sets/lego-40688-trofee-schade-doos/</g:link>
      <g:image_link>https://uniekebricks.nl/wp-content/uploads/2026/06/40688.jpg</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR24.99</g:price>
      <g:condition>new</g:condition>
      <g:gtin>5702017596664</g:gtin>
    </item>
    <item>
      <g:id>90000</g:id>
      <g:title>LEGO Harry Potter Collection Nintendo Switch</g:title>
      <g:description><![CDATA[Software voor Nintendo Switch.]]></g:description>
      <g:link>https://uniekebricks.nl/games/lego-harry-potter-switch/</g:link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR24.95</g:price>
      <g:condition>new</g:condition>
    </item>
    <item>
      <g:id>10316</g:id>
      <g:title>BRIO Houten trein</g:title>
      <g:description><![CDATA[Houten trein zonder bouwstenen.]]></g:description>
      <g:link>https://uniekebricks.nl/speelgoed/brio-houten-trein/</g:link>
      <g:availability>out_of_stock</g:availability>
      <g:price>EUR19.95</g:price>
      <g:condition>new</g:condition>
    </item>
    <item>
      <g:id>77777</g:id>
      <g:title>LEGO Bouwplezier zonder setnummer</g:title>
      <g:description><![CDATA[Geen herkenbaar setnummer.]]></g:description>
      <g:link>https://uniekebricks.nl/producten/lego-99999-negeer-url/</g:link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR9.95</g:price>
      <g:condition>new</g:condition>
      <g:gtin>5702012345678</g:gtin>
    </item>
    <item>
      <g:id>88888</g:id>
      <g:title>LEGO Icons Rivendell</g:title>
      <g:description><![CDATA[Voor fans van LEGO 10316 en de Council of Elrond.]]></g:description>
      <g:link>https://uniekebricks.nl/producten/lego-icons-rivendell/</g:link>
      <g:availability>out_of_stock</g:availability>
      <g:price>EUR429.99</g:price>
      <g:condition>new</g:condition>
      <g:gtin>5702017416883</g:gtin>
    </item>
  </channel>
</rss>`;

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
    importedOfferCount: 2,
    latestRowsMarkedStaleCount: 0,
    latestRowsSeenCount: 2,
    matchedCatalogSetCount: 2,
    matchedOfferCount: 2,
    merchantCreated: false,
    merchantSlug: 'uniekebricks',
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
    ...overrides,
  };
}

describe('Unieke Bricks feed sync server', () => {
  test('parses the Google Merchant XML stream and normalizes a valid LEGO set', async () => {
    const [product] = await parseUniekeBricksProductFeedXmlStream({
      stream: Readable.from([sampleUniekeBricksFeedXml]),
    });

    expect(normalizeUniekeBricksFeedProductToFeedRow(product)).toMatchObject({
      affiliateDeeplink:
        'https://uniekebricks.nl/schade-sets/lego-40688-trofee-schade-doos/',
      availabilityText: 'In stock',
      brand: 'LEGO',
      condition: 'new',
      currency: 'EUR',
      description: 'Bouw de LEGO 40688 Trofee.',
      ean: '5702017596664',
      imageUrl: 'https://uniekebricks.nl/wp-content/uploads/2026/06/40688.jpg',
      legoSetNumber: '40688',
      price: '24.99',
      productId: '96483',
      productTitle: 'LEGO 40688 Trofee (schade doos)',
      sourceMetadata: {
        availability: 'in_stock',
        condition: 'new',
        source: 'uniekebricks-direct-feed',
      },
    });
  });

  test('uses title and description set numbers but ignores feed ids, GTIN and URLs', () => {
    expect(
      resolveUniekeBricksSetNumber({
        gtin: '5702017416883',
        id: '10316',
        link: 'https://uniekebricks.nl/producten/lego-10316-url-only/',
        title: 'LEGO Icons Rivendell',
      }),
    ).toBeUndefined();

    expect(
      resolveUniekeBricksSetNumber({
        description: 'Voor fans van LEGO 10316 en de Council of Elrond.',
        gtin: '5702017416883',
        id: '88888',
        link: 'https://uniekebricks.nl/producten/lego-icons-rivendell/',
        title: 'LEGO Icons Rivendell',
      }),
    ).toBe('10316');

    expect(
      resolveUniekeBricksSetNumber({
        title: 'LEGO 40688 Trofee (schade doos)',
      }),
    ).toBe('40688');
  });

  test('filters LEGO software and accessories as non-construction offers', () => {
    expect(
      normalizeUniekeBricksFeedProductToFeedRow({
        id: '90000',
        price: 'EUR24.95',
        title: 'LEGO Harry Potter Collection Nintendo Switch',
      }),
    ).toMatchObject({
      brand: 'LEGO',
      legoSetNumber: undefined,
      price: '24.95',
    });
  });

  test('passes direct merchant rows through the strict importer', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(sampleUniekeBricksFeedXml));
    const result = await syncUniekeBricksFeed({
      dependencies: {
        fetchFn,
        getUniekeBricksFeedConfigFn: () => ({
          feedOriginHostHeader: 'uniekebricks.nl',
          feedUrl:
            'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Unieke Bricks',
          merchantSlug: 'uniekebricks',
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

    expect(fetchFn).toHaveBeenCalledWith(
      'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
      {
        headers: {
          Accept: 'application/xml,text/xml,*/*',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 compatible BrickhuntBot/1.0; +https://www.brickhunt.nl',
        },
      },
    );
    expect(importFeedRowsForMerchantFn).toHaveBeenCalledWith({
      merchant: {
        name: 'Unieke Bricks',
        notes:
          'Feed-driven non-affiliate merchant. Current offer state is imported from the Unieke Bricks product feed.',
        slug: 'uniekebricks',
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
            'https://uniekebricks.nl/schade-sets/lego-40688-trofee-schade-doos/',
          brand: 'LEGO',
          legoSetNumber: '40688',
          productTitle: 'LEGO 40688 Trofee (schade doos)',
        }),
        expect.objectContaining({
          affiliateDeeplink:
            'https://uniekebricks.nl/producten/lego-icons-rivendell/',
          brand: 'LEGO',
          legoSetNumber: '10316',
          productTitle: 'LEGO Icons Rivendell',
        }),
      ],
    });
    expect(result).toMatchObject({
      availabilityDistribution: {
        'In stock': 3,
        'Out of stock': 2,
      },
      debugInfo: {
        fetchedProductCount: 5,
        legoCandidateCount: 4,
        parseFailureCount: 0,
        sampleCount: 4,
      },
      excludedReasonCounts: {
        missing_or_invalid_set_number: 1,
        non_lego: 1,
        non_construction_lego: 1,
      },
      fetchedProductCount: 5,
      legoCandidateCount: 4,
      merchantName: 'Unieke Bricks',
      merchantSlug: 'uniekebricks',
      normalizedRowCount: 2,
      originMode: 'public',
      parseFailureCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
    });
  });

  test('uses the origin IP URL with the public Host header and browser-like headers', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(sampleUniekeBricksFeedXml));

    const result = await syncUniekeBricksFeed({
      dependencies: {
        fetchFn,
        getUniekeBricksFeedConfigFn: () => ({
          feedOriginHostHeader: 'uniekebricks.nl',
          feedOriginUrl:
            'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          feedUrl:
            'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Unieke Bricks',
          merchantSlug: 'uniekebricks',
        }),
        importFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(fetchFn).toHaveBeenCalledWith(
      'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
      {
        headers: {
          Accept: 'application/xml,text/xml,*/*',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Host: 'uniekebricks.nl',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 compatible BrickhuntBot/1.0; +https://www.brickhunt.nl',
        },
      },
    );
    expect(result.originMode).toBe('ip');
    expect(importFeedRowsForMerchantFn).toHaveBeenCalled();
  });

  test('calls fetch with the exact origin env URL and Host header for origin IP mode', async () => {
    const originUrl =
      'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/8qmhty7d03ku294ycsv6edyxbn20bqkh.xml';
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(sampleUniekeBricksFeedXml));
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      return undefined;
    });

    await syncUniekeBricksFeed({
      dependencies: {
        fetchFn,
        getUniekeBricksFeedConfigFn: () => ({
          feedOriginHostHeader: 'uniekebricks.nl',
          feedOriginUrl: originUrl,
          feedUrl:
            'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/8qmhty7d03ku294ycsv6edyxbn20bqkh.xml',
          merchantName: 'Unieke Bricks',
          merchantSlug: 'uniekebricks',
        }),
        importFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(fetchFn).toHaveBeenCalledWith(
      originUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Host: 'uniekebricks.nl',
        }),
      }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[uniekebricks-feed-sync] fetch_request origin_mode=ip attempt=1 request_url_host="93.119.2.137" request_host_header="uniekebricks.nl"',
    );
    expect(
      consoleLogSpy.mock.calls
        .flat()
        .some((message) =>
          String(message).includes('8qmhty7d03ku294ycsv6edyxbn20bqkh.xml'),
        ),
    ).toBe(false);

    consoleLogSpy.mockRestore();
  });

  test('uses the configured origin Host header override in origin IP mode', async () => {
    const originUrl =
      'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/feed.xml';
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(sampleUniekeBricksFeedXml));
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      return undefined;
    });

    await syncUniekeBricksFeed({
      dependencies: {
        fetchFn,
        getUniekeBricksFeedConfigFn: () => ({
          feedOriginHostHeader: 'www.uniekebricks.nl',
          feedOriginUrl: originUrl,
          feedUrl:
            'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Unieke Bricks',
          merchantSlug: 'uniekebricks',
        }),
        importFeedRowsForMerchantFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(fetchFn).toHaveBeenCalledWith(
      originUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Host: 'www.uniekebricks.nl',
        }),
      }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[uniekebricks-feed-sync] fetch_request origin_mode=ip attempt=1 request_url_host="93.119.2.137" request_host_header="www.uniekebricks.nl"',
    );

    consoleLogSpy.mockRestore();
  });

  test('retries a blocked feed request once and imports after recovery', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const sleepFn = vi.fn(async () => undefined);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('blocked', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 403,
          statusText: 'Forbidden',
        }),
      )
      .mockResolvedValueOnce(new Response(sampleUniekeBricksFeedXml));

    await syncUniekeBricksFeed({
      dependencies: {
        fetchFn,
        getUniekeBricksFeedConfigFn: () => ({
          feedOriginHostHeader: 'uniekebricks.nl',
          feedUrl:
            'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Unieke Bricks',
          merchantSlug: 'uniekebricks',
        }),
        importFeedRowsForMerchantFn,
        sleepFn,
      },
      options: {
        dryRun: true,
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(250);
    expect(importFeedRowsForMerchantFn).toHaveBeenCalled();
  });

  test('rejects Cloudflare HTML responses before importing or marking stale', async () => {
    const importFeedRowsForMerchantFn = vi.fn();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<html><head><title>Just a moment...</title></head><body><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>',
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
          statusText: 'OK',
        },
      ),
    );

    let caughtError: unknown;

    try {
      await syncUniekeBricksFeed({
        dependencies: {
          fetchFn,
          getUniekeBricksFeedConfigFn: () => ({
            feedOriginHostHeader: 'uniekebricks.nl',
            feedOriginUrl:
              'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            feedUrl:
              'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            merchantName: 'Unieke Bricks',
            merchantSlug: 'uniekebricks',
          }),
          importFeedRowsForMerchantFn,
        },
        options: {
          dryRun: false,
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      name: 'Error',
      message: expect.stringContaining(
        'Unieke Bricks feed returned HTML response instead of XML.',
      ),
    });
    expect(caughtError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('origin_mode=ip'),
      }),
    );
    expect(caughtError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('challenges.cloudflare.com'),
      }),
    );
    expect(importFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(classifyScheduledJobFailure(caughtError)).toEqual({
      exitCode: 0,
      failureType: 'upstream_invalid_response',
      recoverable: true,
    });
  });

  test('keeps origin IP 404 recoverable without importing rows or marking stale', async () => {
    const importFeedRowsForMerchantFn = vi.fn();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>Not found</html>', {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        status: 404,
        statusText: 'Not Found',
      }),
    );

    let caughtError: unknown;

    try {
      await syncUniekeBricksFeed({
        dependencies: {
          fetchFn,
          getUniekeBricksFeedConfigFn: () => ({
            feedOriginHostHeader: 'uniekebricks.nl',
            feedOriginUrl:
              'http://93.119.2.137/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            feedUrl:
              'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            merchantName: 'Unieke Bricks',
            merchantSlug: 'uniekebricks',
          }),
          importFeedRowsForMerchantFn,
        },
        options: {
          dryRun: false,
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      name: 'Error',
      message: expect.stringContaining(
        'Unieke Bricks feed request failed with 404 Not Found.',
      ),
    });
    expect(caughtError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('origin_mode=ip'),
      }),
    );
    expect(importFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(classifyScheduledJobFailure(caughtError)).toEqual({
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    });
  });

  test('keeps repeated 403 recoverable without importing rows or marking stale', async () => {
    const importFeedRowsForMerchantFn = vi.fn();
    const sleepFn = vi.fn(async () => undefined);
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>Forbidden</html>', {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        status: 403,
        statusText: 'Forbidden',
      }),
    );

    let caughtError: unknown;

    try {
      await syncUniekeBricksFeed({
        dependencies: {
          fetchFn,
          getUniekeBricksFeedConfigFn: () => ({
            feedOriginHostHeader: 'uniekebricks.nl',
            feedUrl:
              'https://uniekebricks.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            merchantName: 'Unieke Bricks',
            merchantSlug: 'uniekebricks',
          }),
          importFeedRowsForMerchantFn,
          sleepFn,
        },
        options: {
          dryRun: false,
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      name: 'Error',
      message: expect.stringContaining(
        'Unieke Bricks feed request failed with 403 Forbidden.',
      ),
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(importFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(classifyScheduledJobFailure(caughtError)).toEqual({
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    });
    expect(caughtError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'content_type="text/html; charset=utf-8"',
        ),
      }),
    );
    expect(caughtError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'body_snippet="<html>Forbidden</html>"',
        ),
      }),
    );
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
            setId: '40688',
            sourceSetNumber: '40688-1',
            status: 'active',
          },
        ]),
        listCommerceMerchantsFn: vi.fn(async () => []),
        updateCommerceMerchantFn: vi.fn(),
        upsertCommerceOfferLatestRecordFn: upsertLatest,
        upsertCommerceOfferSeedByCompositeKeyFn: upsertSeed,
      },
      merchant: {
        name: 'Unieke Bricks',
        notes: 'Feed-driven Unieke Bricks import.',
        slug: 'uniekebricks',
        sourceType: 'direct',
      },
      options: {
        dryRun: true,
      },
      rows: [
        {
          affiliateDeeplink:
            'https://uniekebricks.nl/schade-sets/lego-40688-trofee-schade-doos/',
          brand: 'LEGO',
          currency: 'EUR',
          legoSetNumber: '40688',
          price: 24.99,
          productTitle: 'LEGO 40688 Trofee (schade doos)',
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
