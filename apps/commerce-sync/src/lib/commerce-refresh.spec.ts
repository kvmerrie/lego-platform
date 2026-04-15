import { describe, expect, test, vi } from 'vitest';
import type { CommerceRefreshSeed } from '@lego-platform/commerce/data-access-server';
import {
  buildCommerceSyncInputs,
  extractCommerceOfferSnapshotFromHtml,
  refreshCommerceOfferSeeds,
} from './commerce-refresh';

function createRefreshSeed(
  overrides: Partial<CommerceRefreshSeed> = {},
): CommerceRefreshSeed {
  return {
    merchant: {
      id: 'merchant-1',
      slug: 'lego-nl',
      name: 'LEGO',
      isActive: true,
      sourceType: 'direct',
      notes: '',
      createdAt: '2026-04-14T08:00:00.000Z',
      updatedAt: '2026-04-14T08:00:00.000Z',
    },
    offerSeed: {
      id: 'seed-1',
      setId: '10316',
      merchantId: 'merchant-1',
      productUrl:
        'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
      isActive: true,
      validationStatus: 'pending',
      notes: '',
      createdAt: '2026-04-14T08:00:00.000Z',
      updatedAt: '2026-04-14T08:00:00.000Z',
    },
    ...overrides,
  };
}

describe('commerce refresh', () => {
  test('extracts a priced offer from structured data', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Rivendell",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "499.99",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      priceMinor: 49999,
      currencyCode: 'EUR',
      availability: 'in_stock',
    });
  });

  test('ignores Amazon related-product prices when the main offer is unavailable', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="availabilityInsideBuyBox_feature_div">
              <span>Currently unavailable.</span>
            </div>
            <div id="desktop-mlbt-inline-content">
              <span>€ 149,99</span>
            </div>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "149.99",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'out_of_stock',
      currencyCode: 'EUR',
      priceMinor: undefined,
    });
  });

  test('uses the Amazon main buy-box action to infer in-stock availability', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="corePrice_feature_div">
              <span class="a-offscreen">€ 649,99</span>
            </div>
            <div id="desktop_qualifiedBuyBox">
              <input id="add-to-cart-button" type="submit" value="In winkelwagen" />
            </div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 64999,
    });
  });

  test('marks a successful verification as valid and upserts the latest offer state', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <head>
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Product",
                  "offers": {
                    "@type": "Offer",
                    "priceCurrency": "EUR",
                    "price": "499.99",
                    "availability": "https://schema.org/InStock"
                  }
                }
              </script>
            </head>
          </html>
        `,
        {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        },
      ),
    );

    const summary = await refreshCommerceOfferSeeds({
      refreshSeeds: [createRefreshSeed()],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(summary).toEqual({
      totalCount: 1,
      successCount: 1,
      unavailableCount: 0,
      invalidCount: 0,
      staleCount: 0,
    });
    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-1',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        fetchStatus: 'success',
        observedAt: '2026-04-14T12:00:00.000Z',
        fetchedAt: '2026-04-14T12:00:00.000Z',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-1',
      input: {
        validationStatus: 'valid',
        lastVerifiedAt: '2026-04-14T12:00:00.000Z',
      },
    });
  });

  test('marks a broken seed URL as invalid', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('', {
        status: 404,
      }),
    );

    const summary = await refreshCommerceOfferSeeds({
      refreshSeeds: [createRefreshSeed()],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(summary.invalidCount).toBe(1);
    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: expect.objectContaining({
        offerSeedId: 'seed-1',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage: 'Merchant returned 404 for the seed URL.',
      }),
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-1',
      input: {
        validationStatus: 'invalid',
        lastVerifiedAt: '2026-04-14T12:00:00.000Z',
      },
    });
  });

  test('marks parsing failures as stale while preserving the previous latest offer state', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<html><body>No price here.</body></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      }),
    );

    await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-10T08:00:00.000Z',
            latestOffer: {
              id: 'latest-1',
              offerSeedId: 'seed-1',
              setId: '10316',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
              fetchStatus: 'success',
              priceMinor: 49999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-10T08:00:00.000Z',
              fetchedAt: '2026-04-10T08:00:00.000Z',
              createdAt: '2026-04-10T08:00:00.000Z',
              updatedAt: '2026-04-10T08:00:00.000Z',
            },
          },
        }),
      ],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-1',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-10T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Unable to parse a price or a stock signal from the merchant page.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-1',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-10T08:00:00.000Z',
      },
    });
  });

  test('retries Intertoys with a merchant referer and keeps the failure state honest on 403', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 403,
          statusText: 'Forbidden',
        }),
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 403,
          statusText: 'Forbidden',
        }),
      );

    const summary = await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'intertoys',
            name: 'Intertoys',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-intertoys',
            productUrl:
              'https://www.intertoys.nl/lego-star-wars-venator-class-republic-attack-cruiser-75367',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-intertoys',
              offerSeedId: 'seed-intertoys',
              setId: '10316',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.intertoys.nl/lego-star-wars-venator-class-republic-attack-cruiser-75367',
              fetchStatus: 'success',
              priceMinor: 49999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-12T08:00:00.000Z',
              fetchedAt: '2026-04-12T08:00:00.000Z',
              createdAt: '2026-04-12T08:00:00.000Z',
              updatedAt: '2026-04-12T08:00:00.000Z',
            },
          },
        }),
      ],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(summary).toEqual({
      totalCount: 1,
      successCount: 0,
      unavailableCount: 0,
      invalidCount: 0,
      staleCount: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': expect.stringContaining('Mozilla/5.0'),
          accept: expect.stringContaining('text/html'),
        }),
      }),
    );
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          referer: 'https://www.intertoys.nl/',
        }),
      }),
    );
    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-intertoys',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Intertoys returned 403 Forbidden even after retrying with a merchant referer. The product page blocked the refresh request.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-12T08:00:00.000Z',
      },
    });
  });

  test('uses a clearer Amazon reason when no main offer block is present', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <div id="desktop-mlbt-inline-content">
                <span>€ 149,99</span>
              </div>
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Product",
                  "offers": {
                    "@type": "Offer",
                    "priceCurrency": "EUR",
                    "price": "149.99",
                    "availability": "https://schema.org/InStock"
                  }
                }
              </script>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        },
      ),
    );

    await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'amazon-nl',
            name: 'Amazon',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-amazon-no-main-offer',
            productUrl:
              'https://www.amazon.nl/LEGO-75367-Venator-klasse-Republiek-aanvalskruiser/dp/B0CGY4T856',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-amazon-no-main-offer',
              offerSeedId: 'seed-amazon-no-main-offer',
              setId: '10316',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.amazon.nl/LEGO-75367-Venator-klasse-Republiek-aanvalskruiser/dp/B0CGY4T856',
              fetchStatus: 'success',
              priceMinor: 49999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-12T08:00:00.000Z',
              fetchedAt: '2026-04-12T08:00:00.000Z',
              createdAt: '2026-04-12T08:00:00.000Z',
              updatedAt: '2026-04-12T08:00:00.000Z',
            },
          },
        }),
      ],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-amazon-no-main-offer',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Amazon page resolved, but no main offer block was found.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-amazon-no-main-offer',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-12T08:00:00.000Z',
      },
    });
  });

  test('downgrades suspicious Amazon prices when availability is unknown', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <div id="corePrice_feature_div">
                <span>€ 149,99</span>
              </div>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        },
      ),
    );

    await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'amazon-nl',
            name: 'Amazon',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-venator',
            setId: '75367',
            productUrl:
              'https://www.amazon.nl/LEGO-75367-Venator-klasse-Republiek-aanvalskruiser/dp/B0CGY4T856',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-venator',
              offerSeedId: 'seed-venator',
              setId: '75367',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.amazon.nl/LEGO-75367-Venator-klasse-Republiek-aanvalskruiser/dp/B0CGY4T856',
              fetchStatus: 'success',
              priceMinor: 64999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-12T08:00:00.000Z',
              fetchedAt: '2026-04-12T08:00:00.000Z',
              createdAt: '2026-04-12T08:00:00.000Z',
              updatedAt: '2026-04-12T08:00:00.000Z',
            },
          },
        }),
      ],
      now: new Date('2026-04-14T12:00:00.000Z'),
      fetchImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      upsertLatestRecord,
      updateSeedValidationState,
    });

    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: {
        offerSeedId: 'seed-venator',
        priceMinor: 64999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Amazon price 14999 is implausibly low versus the reference price 64999.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-venator',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-12T08:00:00.000Z',
      },
    });
  });

  test('builds pricing sync inputs from active refresh seeds and merchant slugs', () => {
    const result = buildCommerceSyncInputs({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'amazon-nl',
            name: 'Amazon',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-2',
            merchantId: 'merchant-2',
            productUrl:
              'https://www.amazon.nl/LEGO-10316-Icons-LORD-RINGS/dp/B0BVMZ5NT5',
            validationStatus: 'stale',
            latestOffer: {
              id: 'latest-2',
              offerSeedId: 'seed-2',
              setId: '10316',
              merchantId: 'merchant-2',
              productUrl:
                'https://www.amazon.nl/LEGO-10316-Icons-LORD-RINGS/dp/B0BVMZ5NT5',
              fetchStatus: 'error',
              priceMinor: 48246,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-14T10:00:00.000Z',
              fetchedAt: '2026-04-14T11:00:00.000Z',
              errorMessage: 'Timed out.',
              createdAt: '2026-04-14T10:00:00.000Z',
              updatedAt: '2026-04-14T11:00:00.000Z',
            },
          },
        }),
      ],
    });

    expect(result.activeMerchantCount).toBe(1);
    expect(result.enabledSetIds).toEqual(['10316']);
    expect(result.pricingObservationSeeds).toEqual([
      expect.objectContaining({
        setId: '10316',
        merchantId: 'amazon-nl',
        totalPriceMinor: 48246,
        availability: 'in_stock',
      }),
    ]);
    expect(result.affiliateMerchantConfigs).toEqual([
      expect.objectContaining({
        merchantId: 'amazon-nl',
        displayName: 'Amazon',
        urlHost: 'www.amazon.nl',
      }),
    ]);
  });
});
