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

  test('extracts a LEGO in-stock offer from structured data even when the page shell contains sold-out fragments', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'lego-nl',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "The Burrow – Collectors’ Edition",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "259.99",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
          <body>
            <script>
              window.__LEGOSTATE__ = {
                upsell: [
                  { availability: "https://schema.org/OutOfStock" }
                ],
                labels: ["SoldOut", "Niet op voorraad"]
              };
            </script>
            <span>Op voorraad</span>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      priceMinor: 25999,
      currencyCode: 'EUR',
      availability: 'in_stock',
    });
  });

  test('keeps a LEGO discontinued page unavailable when the price remains visible', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'lego-nl',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Lion Knights' Castle",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "399.99",
                  "availability": "https://schema.org/Discontinued"
                }
              }
            </script>
          </head>
          <body>
            <div>Uitverkocht</div>
            <div>Niet op voorraad</div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      priceMinor: 39999,
      currencyCode: 'EUR',
      availability: 'out_of_stock',
    });
  });

  test('marks a LEGO page with price but no trustworthy stock signal as stale instead of a successful offer', async () => {
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
                  "name": "Disney Castle",
                  "offers": {
                    "@type": "Offer",
                    "priceCurrency": "EUR",
                    "price": "399.99"
                  }
                }
              </script>
            </head>
            <body>
              <div>Bekijk de details van deze set.</div>
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

    const summary = await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-lego-ambiguous',
            setId: '43222',
            productUrl:
              'https://www.lego.com/nl-nl/product/disney-castle-43222',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-10T08:00:00.000Z',
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
    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: expect.objectContaining({
        offerSeedId: 'seed-lego-ambiguous',
        fetchStatus: 'error',
        errorMessage:
          'LEGO page resolved, but no trustworthy stock signal was found alongside the price.',
      }),
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-lego-ambiguous',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-10T08:00:00.000Z',
      },
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

  test('extracts an Amazon main offer when the buy box uses a shipping lead time instead of plain stock copy', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="corePrice_feature_div">
              <span class="a-offscreen">€172,40</span>
            </div>
            <div id="desktop_qualifiedBuyBox">
              <div id="availabilityInsideBuyBox_feature_div">
                <div id="availability">
                  <span class="a-size-base a-color-price primary-availability-message a-text-bold">
                    Wordt gewoonlijk verzonden binnen 6 tot 7 maanden
                  </span>
                </div>
              </div>
              <span id="submit.add-to-cart" class="a-button a-spacing-small a-button-primary a-button-icon">
                <span class="a-button-inner">
                  <input
                    id="add-to-cart-button"
                    name="submit.add-to-cart"
                    type="submit"
                    value="In winkelwagen"
                  />
                </span>
              </span>
            </div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 17240,
    });
  });

  test('extracts a high-value Amazon main offer from canonical buy-box price inputs', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="desktop_qualifiedBuyBox">
              <form id="addToCart">
                <input
                  type="hidden"
                  name="items[0.base][customerVisiblePrice][amount]"
                  value="1329.0"
                />
                <input
                  type="hidden"
                  name="items[0.base][customerVisiblePrice][displayString]"
                  value="€ 1.329,00"
                />
              </form>
              <div id="availabilityInsideBuyBox_feature_div">
                <div id="availability">
                  <span class="a-size-base a-color-price primary-availability-message a-text-bold">
                    Wordt gewoonlijk verzonden binnen 2 tot 3 dagen
                  </span>
                </div>
              </div>
              <span id="submit.add-to-cart" class="a-button a-spacing-small a-button-primary a-button-icon">
                <span class="a-button-inner">
                  <input
                    id="add-to-cart-button"
                    name="submit.add-to-cart"
                    type="submit"
                    value="In winkelwagen"
                  />
                </span>
              </span>
            </div>
            <div id="corePrice_feature_div">
              <span class="a-offscreen">€1.329,00</span>
              <span aria-hidden="true">
                <span class="a-price-symbol">€</span>
                <span class="a-price-whole">1.329<span class="a-price-decimal">,</span></span>
                <span class="a-price-fraction">00</span>
              </span>
            </div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 132900,
    });
  });

  test('parses Amazon display prices that use a trailing dash cents marker', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="corePrice_feature_div">
              <span class="a-offscreen">€1.329,-</span>
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
      priceMinor: 132900,
    });
  });

  test('uses Amazon structured-data price when the buy box exposes stock but not a visible price', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "165.41",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
          <body>
            <div id="desktop_qualifiedBuyBox">
              <div id="availabilityInsideBuyBox_feature_div">
                <div id="availability">
                  <span>Op voorraad</span>
                </div>
              </div>
              <input id="add-to-cart-button" type="submit" value="In winkelwagen" />
            </div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 16541,
    });
  });

  test('extracts an Amazon all-buying-choices offer as limited when no featured offer is available', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'amazon-nl',
      html: `
        <html>
          <body>
            <div id="availability_feature_div">
              <div id="availability">
                <div id="all-offers-display"></div>
                <span>Geen aanbevolen aanbod beschikbaar</span>
                <a id="buybox-see-all-buying-choices">Alle koopopties bekijken</a>
              </div>
            </div>
            <div id="apex_desktop">
              <span class="a-price apex-price-to-pay-value" data-a-size="medium_plus">
                <span class="a-offscreen">€ 201,00</span>
                <span aria-hidden="true">
                  <span class="a-price-symbol">€</span>
                  <span class="a-price-whole">201<span class="a-price-decimal">,</span></span>
                  <span class="a-price-fraction">00</span>
                </span>
              </span>
            </div>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'limited',
      currencyCode: 'EUR',
      priceMinor: 20100,
    });
  });

  test('extracts a bol main offer only when the in-stock block is explicit', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <p>De prijs van dit product is 531 euro en 98 cent.531,98</p>
              <p>Op voorraad</p>
              <p>Voor 23:00 uur besteld, morgen in huis</p>
              <p>Verkoop door bol</p>
              <button>In winkelwagen</button>
            </section>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 53198,
    });
  });

  test('accepts a bol main offer as unavailable only with explicit not-deliverable signals', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <h3>Niet leverbaar</h3>
              <button>Stuur mij een bericht</button>
            </section>
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

  test('parses a formatted high-value bol main-offer price correctly', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <p>€ 1.049,95</p>
              <p>Op voorraad</p>
              <p>Verkoop door bol</p>
              <button>In winkelwagen</button>
            </section>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 104995,
    });
  });

  test('parses a collapsed bol whole-plus-decimal price string correctly', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <p>€1.04995</p>
              <p>Op voorraad</p>
              <p>Verkoop door bol</p>
              <button>In winkelwagen</button>
            </section>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 104995,
    });
  });

  test('prefers the canonical bol structured-data price when the rendered main-offer text is partial', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "1049.95",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <p>€95,00</p>
              <p>Op voorraad</p>
              <p>Verkoop door bol</p>
              <button>In winkelwagen</button>
            </section>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 104995,
    });
  });

  test('uses bol structured-data availability to resolve an otherwise ambiguous main offer', () => {
    const parsedOfferSnapshot = extractCommerceOfferSnapshotFromHtml({
      merchantSlug: 'bol',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "EUR",
                  "price": "239.99",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
          <body>
            <section>
              <h2>Prijsinformatie en bestellen</h2>
              <p>€ 239,99</p>
              <p>Bekijk alle verkopers</p>
              <button>In winkelwagen</button>
            </section>
          </body>
        </html>
      `,
    });

    expect(parsedOfferSnapshot).toEqual({
      availability: 'in_stock',
      currencyCode: 'EUR',
      priceMinor: 23999,
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

  test('retries Proshop against the redirected canonical product url before giving up', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const redirectedForbiddenResponse = {
      status: 403,
      statusText: 'Forbidden',
      redirected: true,
      url: 'https://www.proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3174210',
      headers: new Headers({
        'content-type': 'text/html',
      }),
      ok: false,
      text: async () => '',
    } as unknown as Response;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirectedForbiddenResponse)
      .mockResolvedValueOnce(
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
                      "price": "239.99",
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
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'proshop',
            name: 'Proshop',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-proshop',
            setId: '10317',
            productUrl: 'https://www.proshop.nl/?s=10317',
            validationStatus: 'pending',
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
      successCount: 1,
      unavailableCount: 0,
      invalidCount: 0,
      staleCount: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'https://www.proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3174210',
    );
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          referer: 'https://www.proshop.nl/',
        }),
      }),
    );
  });

  test('normalizes Proshop to the canonical www host and reports Cloudflare challenge blocks explicitly', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const blockedResponse = new Response(
      '<html><title>Just a moment...</title><span>Enable JavaScript and cookies to continue</span></html>',
      {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'content-type': 'text/html',
          'cf-mitigated': 'challenge',
        },
      },
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(blockedResponse)
      .mockResolvedValueOnce(blockedResponse);

    const summary = await refreshCommerceOfferSeeds({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'proshop',
            name: 'Proshop',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-proshop-canonical',
            setId: '10317',
            productUrl:
              'https://proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3190354',
            validationStatus: 'valid',
          },
        }),
      ],
      now: new Date('2026-04-19T09:00:00.000Z'),
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
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://www.proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3190354',
    );
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          referer: 'https://www.proshop.nl/',
          'sec-fetch-mode': 'navigate',
        }),
      }),
    );
    expect(upsertLatestRecord).toHaveBeenCalledWith({
      input: expect.objectContaining({
        offerSeedId: 'seed-proshop-canonical',
        fetchStatus: 'error',
        fetchedAt: '2026-04-19T09:00:00.000Z',
        errorMessage:
          'Proshop returned a Cloudflare challenge even after retrying with the canonical www referer. The lightweight refresh request did not receive a parseable product page.',
      }),
    });
  });

  test('downgrades ambiguous bol availability signals to stale instead of unavailable', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <section>
                <h2>Prijsinformatie en bestellen</h2>
                <p>De prijs van dit product is 531 euro en 98 cent.531,98</p>
                <p>Bekijk alle verkopers</p>
              </section>
              <section>
                <h2>Anderen bekeken ook</h2>
                <p>Niet leverbaar</p>
              </section>
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
            slug: 'bol',
            name: 'bol',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-bol-ambiguous',
            productUrl:
              'https://www.bol.com/nl/nl/p/lego-star-wars-venator-class-republic-attack-cruiser-75367/9300000161235312/',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-bol-ambiguous',
              offerSeedId: 'seed-bol-ambiguous',
              setId: '10316',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.bol.com/nl/nl/p/lego-star-wars-venator-class-republic-attack-cruiser-75367/9300000161235312/',
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
        offerSeedId: 'seed-bol-ambiguous',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage: 'bol page resolved, but main offer state was ambiguous.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-bol-ambiguous',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-12T08:00:00.000Z',
      },
    });
  });

  test('rejects malformed partial bol prices instead of accepting them as valid offers', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <section>
                <h2>Prijsinformatie en bestellen</h2>
                <p>€95,00</p>
                <p>Op voorraad</p>
                <p>Verkoop door bol</p>
                <button>In winkelwagen</button>
              </section>
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
            slug: 'bol',
            name: 'bol',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-bol-partial-price',
            setId: 'test-bol-partial-price',
            productUrl:
              'https://www.bol.com/nl/nl/p/lego-star-wars-at-at-75313/9300000070992525/',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-bol-partial-price',
              offerSeedId: 'seed-bol-partial-price',
              setId: 'test-bol-partial-price',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.bol.com/nl/nl/p/lego-star-wars-at-at-75313/9300000070992525/',
              fetchStatus: 'success',
              priceMinor: 104995,
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
        offerSeedId: 'seed-bol-partial-price',
        priceMinor: 104995,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'bol price 9500 looks like a malformed or partial price parse versus the previous verified price 104995.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-bol-partial-price',
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

  test('uses a clearer Amazon reason when the main offer exists but exposes no usable price', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <div id="desktop_qualifiedBuyBox">
                <div id="availabilityInsideBuyBox_feature_div">
                  <div id="availability">
                    <span class="a-size-medium a-color-success primary-availability-message">
                      Op voorraad
                    </span>
                  </div>
                </div>
                <span id="submit.add-to-cart" class="a-button a-spacing-small a-button-primary a-button-icon">
                  <span class="a-button-inner">
                    <input
                      id="add-to-cart-button"
                      name="submit.add-to-cart"
                      type="submit"
                      value="In winkelwagen"
                    />
                  </span>
                </span>
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
            id: 'seed-amazon-no-price',
            productUrl:
              'https://www.amazon.nl/LEGO-Architecture-Notre-Dame-Volwassenen-21061/dp/B0CWH1M12W',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-amazon-no-price',
              offerSeedId: 'seed-amazon-no-price',
              setId: '10316',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.amazon.nl/LEGO-Architecture-Notre-Dame-Volwassenen-21061/dp/B0CWH1M12W',
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
        offerSeedId: 'seed-amazon-no-price',
        priceMinor: 49999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Amazon page resolved, but the main offer block was found without a usable main-offer price.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-amazon-no-price',
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
              <div id="desktop_qualifiedBuyBox">
                <div class="a-section">Bekijk bezorgopties</div>
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

  test('rejects malformed partial Amazon prices instead of accepting them as valid offers', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <div id="corePrice_feature_div">
                <span class="a-offscreen">€1.32</span>
              </div>
              <div id="desktop_qualifiedBuyBox">
                <div id="availabilityInsideBuyBox_feature_div">
                  <div id="availability">
                    <span class="a-size-medium a-color-success primary-availability-message">
                      Op voorraad
                    </span>
                  </div>
                </div>
                <span id="submit.add-to-cart" class="a-button a-spacing-small a-button-primary a-button-icon">
                  <span class="a-button-inner">
                    <input
                      id="add-to-cart-button"
                      name="submit.add-to-cart"
                      type="submit"
                      value="In winkelwagen"
                    />
                  </span>
                </span>
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
            id: 'seed-amazon-partial-price',
            setId: '75313',
            productUrl:
              'https://www.amazon.nl/LEGO-verzamel-set-volwassenen-presentatie-set-inclusief/dp/B09JKZ62H7',
            validationStatus: 'valid',
            lastVerifiedAt: '2026-04-12T08:00:00.000Z',
            latestOffer: {
              id: 'latest-amazon-partial-price',
              offerSeedId: 'seed-amazon-partial-price',
              setId: '75313',
              merchantId: 'merchant-1',
              productUrl:
                'https://www.amazon.nl/LEGO-verzamel-set-volwassenen-presentatie-set-inclusief/dp/B09JKZ62H7',
              fetchStatus: 'success',
              priceMinor: 132900,
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
        offerSeedId: 'seed-amazon-partial-price',
        priceMinor: 132900,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-12T08:00:00.000Z',
        fetchStatus: 'error',
        fetchedAt: '2026-04-14T12:00:00.000Z',
        errorMessage:
          'Amazon price 132 looks like a malformed or partial price parse versus the previous verified price 132900.',
      },
    });
    expect(updateSeedValidationState).toHaveBeenCalledWith({
      offerSeedId: 'seed-amazon-partial-price',
      input: {
        validationStatus: 'stale',
        lastVerifiedAt: '2026-04-12T08:00:00.000Z',
      },
    });
  });

  test('retries Top1Toys once after a timeout before marking the seed stale', async () => {
    const upsertLatestRecord = vi.fn().mockResolvedValue(undefined);
    const updateSeedValidationState = vi.fn().mockResolvedValue(undefined);
    const timeoutError = new Error('The operation timed out.');
    timeoutError.name = 'TimeoutError';
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
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
                      "price": "159.99",
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
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            slug: 'top1toys',
            name: 'Top1Toys',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-top1toys',
            merchantId: 'merchant-top1toys',
            setId: '76437',
            productUrl: 'https://www.top1toys.nl/catalog/product/view/id/12345',
            validationStatus: 'valid',
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
      successCount: 1,
      unavailableCount: 0,
      invalidCount: 0,
      staleCount: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

  test('normalizes dynamic fallback merchant hosts when seeds mix www and non-www product urls', () => {
    const result = buildCommerceSyncInputs({
      refreshSeeds: [
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            id: 'merchant-proshop-1',
            slug: 'proshop',
            name: 'Proshop',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-proshop-www',
            merchantId: 'merchant-proshop-1',
            setId: '10317',
            productUrl:
              'https://www.proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3174210',
            validationStatus: 'valid',
            latestOffer: {
              id: 'latest-proshop-www',
              offerSeedId: 'seed-proshop-www',
              setId: '10317',
              merchantId: 'merchant-proshop-1',
              productUrl:
                'https://www.proshop.nl/LEGO/LEGO-Icons-10317-Land-Rover-Classic-Defender-90/3174210',
              fetchStatus: 'success',
              priceMinor: 23999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-18T10:00:00.000Z',
              fetchedAt: '2026-04-18T10:01:00.000Z',
              createdAt: '2026-04-18T10:01:00.000Z',
              updatedAt: '2026-04-18T10:01:00.000Z',
            },
          },
        }),
        createRefreshSeed({
          merchant: {
            ...createRefreshSeed().merchant,
            id: 'merchant-proshop-2',
            slug: 'proshop',
            name: 'Proshop',
          },
          offerSeed: {
            ...createRefreshSeed().offerSeed,
            id: 'seed-proshop-root',
            merchantId: 'merchant-proshop-2',
            setId: '10320',
            productUrl:
              'https://proshop.nl/LEGO/LEGO-Star-Wars-10320-Example/3174222',
            validationStatus: 'valid',
            latestOffer: {
              id: 'latest-proshop-root',
              offerSeedId: 'seed-proshop-root',
              setId: '10320',
              merchantId: 'merchant-proshop-2',
              productUrl:
                'https://proshop.nl/LEGO/LEGO-Star-Wars-10320-Example/3174222',
              fetchStatus: 'success',
              priceMinor: 24999,
              currencyCode: 'EUR',
              availability: 'in_stock',
              observedAt: '2026-04-18T10:05:00.000Z',
              fetchedAt: '2026-04-18T10:06:00.000Z',
              createdAt: '2026-04-18T10:06:00.000Z',
              updatedAt: '2026-04-18T10:06:00.000Z',
            },
          },
        }),
      ],
    });

    expect(result.affiliateMerchantConfigs).toEqual([
      expect.objectContaining({
        merchantId: 'proshop',
        displayName: 'Proshop',
        urlHost: 'proshop.nl',
      }),
    ]);
  });
});
