import { describe, expect, test, vi } from 'vitest';
import {
  buildTradeTrackerAlternateOnboardingQueue,
  normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow,
  syncAlternateTradeTrackerFeed,
} from './tradetracker-alternate-sync-server';

function buildSoapEnvelope(operation: string, bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${operation}Response>
      ${bodyXml}
    </${operation}Response>
  </soap12:Body>
</soap12:Envelope>`;
}

function createSoapResponse({
  bodyXml,
  operation,
  setCookie,
}: {
  bodyXml: string;
  operation: string;
  setCookie?: string;
}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(
      setCookie
        ? {
            'set-cookie': setCookie,
          }
        : undefined,
    ),
    text: async () => buildSoapEnvelope(operation, bodyXml),
  } as Response;
}

describe('TradeTracker Alternate sync server', () => {
  test('authenticates, selects the Alternate feed, normalizes rows, and reuses the existing importer', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'authenticate',
          bodyXml: '',
          setCookie: 'SID=tradetracker-session; Path=/; Secure; HttpOnly',
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getAffiliateSites',
          bodyXml: `
            <affiliateSites>
              <affiliateSite>
                <ID>67890</ID>
                <name>Brickhunt NL</name>
                <URL>https://brickhunt.nl</URL>
              </affiliateSite>
            </affiliateSites>
          `,
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getFeeds',
          bodyXml: `
            <feeds>
              <feed>
                <ID>321</ID>
                <campaign>
                  <ID>654</ID>
                  <name>Alternate Nederland</name>
                  <URL>https://www.alternate.nl</URL>
                </campaign>
                <name>Alternate Productfeed</name>
                <URL>https://feed.alternate.nl/products.xml</URL>
                <productCount>1</productCount>
                <assignmentStatus>accepted</assignmentStatus>
              </feed>
            </feeds>
          `,
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getFeedProducts',
          bodyXml: `
            <feedProducts>
              <feedProduct>
                <identifier>ALT-10354</identifier>
                <name>LEGO The Shire</name>
                <productCategoryName>Bouwsets</productCategoryName>
                <description>Een grote LOTR displayset.</description>
                <price>229.99</price>
                <productURL>https://clk.tradetracker.example/alternate/10354</productURL>
                <imageURL>https://cdn.alternate.example/10354.jpg</imageURL>
                <additional>
                  <feedProductAdditionalElement>
                    <name>Brand</name>
                    <value>LEGO</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Currency</name>
                    <value>EUR</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Condition</name>
                    <value>new</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Lego Set Number</name>
                    <value>10354</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Availability</name>
                    <value>Op voorraad</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Shipping cost</name>
                    <value>0.00</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>EAN</name>
                    <value>5702017650000</value>
                  </feedProductAdditionalElement>
                </additional>
              </feedProduct>
            </feedProducts>
          `,
        }),
      );
    const importAlternateAffiliateFeedRowsFn = vi.fn().mockResolvedValue({
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: false,
      merchantSlug: 'alternate',
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
    });

    const result = await syncAlternateTradeTrackerFeed({
      dependencies: {
        fetchFn,
        getTradeTrackerAffiliateConfigFn: () => ({
          customerId: 12345,
          passphrase: 'tt-passphrase',
        }),
        importAlternateAffiliateFeedRowsFn,
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(
      String(fetchFn.mock.calls[0]?.[1]?.headers?.['SOAPAction']),
    ).toContain('/authenticate');
    expect(String(fetchFn.mock.calls[1]?.[1]?.headers?.['Cookie'])).toContain(
      'SID=tradetracker-session',
    );
    expect(importAlternateAffiliateFeedRowsFn).toHaveBeenCalledWith({
      options: {
        collectUnmatchedDebug: undefined,
        unmatchedSampleLimit: undefined,
      },
      rows: [
        {
          affiliateDeeplink: 'https://clk.tradetracker.example/alternate/10354',
          availabilityText: 'Op voorraad',
          brand: 'LEGO',
          category: 'Bouwsets',
          condition: 'new',
          currency: 'EUR',
          description: 'Een grote LOTR displayset.',
          ean: '5702017650000',
          imageUrl: 'https://cdn.alternate.example/10354.jpg',
          legoSetNumber: '10354',
          price: 229.99,
          productTitle: 'LEGO The Shire',
          shippingCost: '0.00',
        },
      ],
    });
    expect(result).toEqual({
      affiliateSiteId: 67890,
      affiliateSiteName: 'Brickhunt NL',
      campaignId: 654,
      campaignName: 'Alternate Nederland',
      feedId: 321,
      feedName: 'Alternate Productfeed',
      fetchedProductCount: 1,
      normalizedRowCount: 1,
      pageCount: 1,
      selectionStrategy: 'heuristic',
      importedOfferCount: 1,
      matchedCatalogSetCount: 1,
      merchantCreated: false,
      merchantSlug: 'alternate',
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
    });
  });

  test('fails fast when TradeTracker returns multiple Alternate-like feeds without an explicit override', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'authenticate',
          bodyXml: '',
          setCookie: 'SID=tradetracker-session; Path=/; Secure; HttpOnly',
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getAffiliateSites',
          bodyXml: `
            <affiliateSites>
              <affiliateSite>
                <ID>67890</ID>
                <name>Brickhunt NL</name>
              </affiliateSite>
            </affiliateSites>
          `,
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getFeeds',
          bodyXml: `
            <feeds>
              <feed>
                <ID>321</ID>
                <campaign>
                  <ID>654</ID>
                  <name>Alternate Nederland</name>
                </campaign>
                <name>Alternate Feed A</name>
                <productCount>1</productCount>
              </feed>
              <feed>
                <ID>322</ID>
                <campaign>
                  <ID>655</ID>
                  <name>Alternate België</name>
                </campaign>
                <name>Alternate Feed B</name>
                <productCount>1</productCount>
              </feed>
            </feeds>
          `,
        }),
      );

    await expect(
      syncAlternateTradeTrackerFeed({
        dependencies: {
          fetchFn,
          getTradeTrackerAffiliateConfigFn: () => ({
            customerId: 12345,
            passphrase: 'tt-passphrase',
          }),
          importAlternateAffiliateFeedRowsFn: vi.fn(),
        },
      }),
    ).rejects.toThrow(
      'TradeTracker returned 2 Alternate-like feeds. Set TRADETRACKER_ALTERNATE_FEED_ID to choose one explicitly.',
    );
  });

  test('normalizes TradeTracker additional fields into the internal Alternate row shape', () => {
    expect(
      normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow({
        additional: {
          availabilitytext: 'Direct leverbaar',
          brand: 'LEGO',
          condition: 'nieuw',
          currencycode: 'EUR',
          ean13: '5702017812345',
          legosetnumber: '76784',
          shippingprice: '4.95',
        },
        description: 'Displayset',
        imageUrl: 'https://cdn.example/76784.jpg',
        name: 'LEGO Wednesday',
        price: 159.99,
        productCategoryName: 'Bouwsets',
        productUrl: 'https://clk.tradetracker.example/alternate/76784',
      }),
    ).toEqual({
      affiliateDeeplink: 'https://clk.tradetracker.example/alternate/76784',
      availabilityText: 'Direct leverbaar',
      brand: 'LEGO',
      category: 'Bouwsets',
      condition: 'nieuw',
      currency: 'EUR',
      description: 'Displayset',
      ean: '5702017812345',
      imageUrl: 'https://cdn.example/76784.jpg',
      legoSetNumber: '76784',
      price: 159.99,
      productTitle: 'LEGO Wednesday',
      shippingCost: '4.95',
    });
  });

  test('maps TradeTracker MPN to the internal LEGO set number field', () => {
    expect(
      normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow({
        additional: {
          brand: 'LEGO',
          currency: 'EUR',
          mpn: '10323',
        },
        name: 'LEGO Icons - PAC-MAN arcade Constructiespeelgoed',
        price: 229,
        productUrl: 'https://clk.tradetracker.example/alternate/10323',
      }),
    ).toEqual(
      expect.objectContaining({
        brand: 'LEGO',
        currency: 'EUR',
        legoSetNumber: '10323',
      }),
    );
  });

  test('defaults missing TradeTracker currency to EUR when a price is present', () => {
    expect(
      normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow({
        additional: {
          brand: 'LEGO',
          mpn: '60368',
        },
        name: 'LEGO City - Poolonderzoeksschip Constructiespeelgoed',
        price: 114.9,
        productUrl: 'https://clk.tradetracker.example/alternate/60368',
      }),
    ).toEqual(
      expect.objectContaining({
        currency: 'EUR',
        legoSetNumber: '60368',
        price: 114.9,
      }),
    );
  });

  test('keeps explicit non-EUR TradeTracker currencies unchanged', () => {
    expect(
      normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow({
        additional: {
          brand: 'LEGO',
          currency: 'USD',
          mpn: '31213',
        },
        name: 'LEGO Art voorbeeldset',
        price: 49.99,
        productUrl: 'https://clk.tradetracker.example/alternate/31213',
      }),
    ).toEqual(
      expect.objectContaining({
        currency: 'USD',
        legoSetNumber: '31213',
      }),
    );
  });

  test('captures LEGO set-number debug samples without changing importer behavior', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'authenticate',
          bodyXml: '',
          setCookie: 'SID=tradetracker-session; Path=/; Secure; HttpOnly',
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getAffiliateSites',
          bodyXml: `
            <affiliateSites>
              <affiliateSite>
                <ID>67890</ID>
                <name>Brickhunt NL</name>
              </affiliateSite>
            </affiliateSites>
          `,
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getFeeds',
          bodyXml: `
            <feeds>
              <feed>
                <ID>321</ID>
                <campaign>
                  <ID>654</ID>
                  <name>Alternate Nederland</name>
                </campaign>
                <name>Alternate Productfeed</name>
                <productCount>1</productCount>
              </feed>
            </feeds>
          `,
        }),
      )
      .mockResolvedValueOnce(
        createSoapResponse({
          operation: 'getFeedProducts',
          bodyXml: `
            <feedProducts>
              <feedProduct>
                <identifier>ALT-10354</identifier>
                <name>LEGO The Shire 10354</name>
                <productCategoryName>Bouwsets</productCategoryName>
                <price>229.99</price>
                <productURL>https://clk.tradetracker.example/alternate/10354</productURL>
                <additional>
                  <feedProductAdditionalElement>
                    <name>Brand</name>
                    <value>LEGO</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>Article Number</name>
                    <value>2432121</value>
                  </feedProductAdditionalElement>
                  <feedProductAdditionalElement>
                    <name>SKU</name>
                    <value>800642</value>
                  </feedProductAdditionalElement>
                </additional>
              </feedProduct>
            </feedProducts>
          `,
        }),
      );
    const importAlternateAffiliateFeedRowsFn = vi.fn().mockResolvedValue({
      importedOfferCount: 0,
      matchedCatalogSetCount: 0,
      merchantCreated: false,
      merchantSlug: 'alternate',
      skippedInvalidCurrencyCount: 0,
      skippedInvalidDeeplinkCount: 0,
      skippedInvalidPriceCount: 0,
      skippedMissingSetNumberCount: 1,
      skippedNonLegoCount: 0,
      skippedNonNewCount: 0,
      skippedUnmatchedSetCount: 0,
      totalRowCount: 1,
      upsertedLatestCount: 0,
      upsertedSeedCount: 0,
    });

    const result = await syncAlternateTradeTrackerFeed({
      dependencies: {
        fetchFn,
        getTradeTrackerAffiliateConfigFn: () => ({
          customerId: 12345,
          passphrase: 'tt-passphrase',
        }),
        importAlternateAffiliateFeedRowsFn,
      },
      options: {
        debugLegoSamples: 1,
      },
    });

    expect(result.setNumberDebug).toEqual({
      legoProductCount: 1,
      sampleCount: 1,
      uniqueAdditionalFieldKeys: ['articlenumber', 'brand', 'sku'],
      samples: [
        {
          additionalFieldKeys: ['articlenumber', 'brand', 'sku'],
          candidateFields: {
            'additional.articlenumber': '2432121',
            'additional.sku': '800642',
            'title.numberCandidate1': '10354',
            'topLevel.identifier': 'ALT-10354',
          },
          normalizedLegoSetNumber: undefined,
          price: 229.99,
          productIdentifier: 'ALT-10354',
          productTitle: 'LEGO The Shire 10354',
          titleNumberCandidates: ['10354'],
        },
      ],
    });
  });

  test('builds a commercially weighted onboarding queue from unmatched Alternate sets', () => {
    const result = buildTradeTrackerAlternateOnboardingQueue({
      batchSize: 3,
      unmatchedSets: [
        {
          count: 3,
          legoSetNumber: '60499',
          lowestPriceMinor: 2499,
          productTitle: 'LEGO City - Test reddingsboot Constructiespeelgoed',
        },
        {
          count: 1,
          legoSetNumber: '42146',
          lowestPriceMinor: 34999,
          productTitle:
            'LEGO Technic - Liebherr Rupskraan LR 13000 Constructiespeelgoed',
        },
        {
          count: 2,
          legoSetNumber: '10348',
          lowestPriceMinor: 5999,
          productTitle:
            'LEGO The Botanical Collection - Japanse esdoorn bonsaiboompje Constructiespeelgoed',
        },
        {
          count: 2,
          legoSetNumber: '42656',
          lowestPriceMinor: 1299,
          productTitle: 'LEGO Friends - Heartlake Airport Constructiespeelgoed',
        },
      ],
    });

    expect(result).toMatchObject({
      batchSize: 3,
      totalCandidateCount: 4,
    });
    expect(result.topBatch.map((entry) => entry.legoSetNumber)).toEqual([
      '42146',
      '10348',
      '60499',
    ]);
    expect(result.topBatch[0]).toMatchObject({
      inferredTheme: 'Technic',
    });
    expect(result.topBatch[0]?.priorityReasons).toEqual(
      expect.arrayContaining([
        'verschijnt 1x in de feed',
        'themafit: Technic (120)',
        expect.stringContaining('349,99'),
      ]),
    );
  });
});
