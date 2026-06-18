import { describe, expect, test, vi } from 'vitest';
import { classifyScheduledJobFailure } from './scheduled-job-reliability';
import { syncBrickspointFeed } from './brickspoint-feed-sync-server';

const sampleBrickspointFeedXml = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Brickspoint</title>
    <link>https://brickspoint.nl</link>
    <description>WooCommerce Product Feed PRO</description>
    <item>
      <g:id>96483</g:id>
      <g:title>LEGO 40688 Trofee (schade doos)</g:title>
      <g:description><![CDATA[<p>Bouw de LEGO 40688 Trofee.</p>]]></g:description>
      <g:link>https://brickspoint.nl/product/lego-40688-trofee-schade-doos/</g:link>
      <g:image_link>https://brickspoint.nl/wp-content/uploads/2026/06/40688.jpg</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR24.99</g:price>
      <g:condition>new</g:condition>
      <g:gtin>5702017596664</g:gtin>
    </item>
    <item>
      <g:id>90000</g:id>
      <g:title>LEGO Harry Potter Collection Nintendo Switch</g:title>
      <g:description><![CDATA[Software voor Nintendo Switch.]]></g:description>
      <g:link>https://brickspoint.nl/product/lego-harry-potter-switch/</g:link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR24.95</g:price>
      <g:condition>new</g:condition>
    </item>
    <item>
      <g:id>10316</g:id>
      <g:title>BRIO Houten trein</g:title>
      <g:description><![CDATA[Houten trein zonder bouwstenen.]]></g:description>
      <g:link>https://brickspoint.nl/product/brio-houten-trein-10316/</g:link>
      <g:availability>out_of_stock</g:availability>
      <g:price>EUR19.95</g:price>
      <g:condition>new</g:condition>
    </item>
    <item>
      <g:id>77777</g:id>
      <g:title>LEGO Bouwplezier zonder setnummer</g:title>
      <g:description><![CDATA[Geen herkenbaar setnummer.]]></g:description>
      <g:link>https://brickspoint.nl/product/lego-99999-negeer-url/</g:link>
      <g:availability>in_stock</g:availability>
      <g:price>EUR9.95</g:price>
      <g:condition>new</g:condition>
      <g:gtin>5702012345678</g:gtin>
    </item>
    <item>
      <g:id>88888</g:id>
      <g:title>LEGO Icons Rivendell</g:title>
      <g:description><![CDATA[Voor fans van LEGO 10316 en de Council of Elrond.]]></g:description>
      <g:link>https://brickspoint.nl/product/lego-icons-rivendell/</g:link>
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
    merchantSlug: 'brickspoint',
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

describe('Brickspoint feed sync server', () => {
  test('passes direct WooCommerce merchant rows through the strict importer', async () => {
    const importFeedRowsForMerchantFn = vi
      .fn()
      .mockResolvedValue(createImportResult());
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(sampleBrickspointFeedXml));

    const result = await syncBrickspointFeed({
      dependencies: {
        fetchFn,
        getBrickspointFeedConfigFn: () => ({
          feedUrl:
            'https://brickspoint.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Brickspoint',
          merchantSlug: 'brickspoint',
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
      'https://brickspoint.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
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
        name: 'Brickspoint',
        notes:
          'Feed-driven non-affiliate merchant. Current offer state is imported from the Brickspoint product feed.',
        slug: 'brickspoint',
        sourceType: 'direct',
      },
      options: {
        collectStaleLatestDiagnostics: false,
        collectUnmatchedDebug: true,
        dryRun: true,
        persistDiscoveredSets: false,
        unmatchedSampleLimit: 5,
      },
      rows: [
        expect.objectContaining({
          affiliateDeeplink:
            'https://brickspoint.nl/product/lego-40688-trofee-schade-doos/',
          brand: 'LEGO',
          legoSetNumber: '40688',
          productTitle: 'LEGO 40688 Trofee (schade doos)',
          sourceMetadata: expect.objectContaining({
            source: 'brickspoint-direct-feed',
          }),
        }),
        expect.objectContaining({
          affiliateDeeplink:
            'https://brickspoint.nl/product/lego-icons-rivendell/',
          brand: 'LEGO',
          legoSetNumber: '10316',
          productTitle: 'LEGO Icons Rivendell',
          sourceMetadata: expect.objectContaining({
            source: 'brickspoint-direct-feed',
          }),
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
      merchantName: 'Brickspoint',
      merchantSlug: 'brickspoint',
      normalizedRowCount: 2,
      originMode: 'public',
      parseFailureCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 1,
      skippedNonNewCount: 1,
    });
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
      .mockResolvedValueOnce(new Response(sampleBrickspointFeedXml));

    await syncBrickspointFeed({
      dependencies: {
        fetchFn,
        getBrickspointFeedConfigFn: () => ({
          feedUrl:
            'https://brickspoint.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
          merchantName: 'Brickspoint',
          merchantSlug: 'brickspoint',
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
      await syncBrickspointFeed({
        dependencies: {
          fetchFn,
          getBrickspointFeedConfigFn: () => ({
            feedUrl:
              'https://brickspoint.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            merchantName: 'Brickspoint',
            merchantSlug: 'brickspoint',
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
        'Brickspoint feed returned HTML response instead of XML.',
      ),
    });
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
      await syncBrickspointFeed({
        dependencies: {
          fetchFn,
          getBrickspointFeedConfigFn: () => ({
            feedUrl:
              'https://brickspoint.nl/wp-content/uploads/woo-product-feed-pro/xml/feed.xml',
            merchantName: 'Brickspoint',
            merchantSlug: 'brickspoint',
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
        'Brickspoint feed request failed with 403 Forbidden.',
      ),
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(importFeedRowsForMerchantFn).not.toHaveBeenCalled();
    expect(classifyScheduledJobFailure(caughtError)).toEqual({
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    });
  });
});
