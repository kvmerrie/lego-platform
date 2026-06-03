import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectionPageMocks = vi.hoisted(() => ({
  collectionConfig: {
    browseDescription: 'Sets die onder budget blijven.',
    browseEyebrow: 'Onder budget',
    browseTitle: 'LEGO sets onder 100 euro',
    canonicalPath: '/lego-sets-onder-100-euro',
    description: 'LEGO sets onder 100 euro.',
    filters: {
      maxBestPriceMinor: 10_000,
    },
    h1: 'LEGO sets onder 100 euro',
    intro:
      'Kijk hier als je een sterke doos zoekt zonder meteen groot te gaan.',
    links: {},
    metaDescription: 'Bekijk LEGO sets onder 100 euro.',
    metaTitle: 'LEGO sets onder 100 euro | Brickhunt',
    signalLabel: 'sets onder 100 euro',
    slug: 'lego-sets-onder-100-euro',
    sort: {
      default: 'price-asc',
      options: ['price-asc'],
    },
  },
  featureCollectionLandingPage: vi.fn(),
  getCatalogCollectionLandingPage: vi.fn(),
  getCatalogCollectionLandingPageSnapshot: vi.fn(),
  getCachedPublicBrowsePageData: vi.fn(),
  loadedCacheResults: [] as unknown[],
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogCollectionLandingPage:
    collectionPageMocks.getCatalogCollectionLandingPage,
  getCatalogCollectionLandingPageSnapshot:
    collectionPageMocks.getCatalogCollectionLandingPageSnapshot,
}));

vi.mock('@lego-platform/catalog/feature-collection-landing', () => ({
  CatalogFeatureCollectionLandingPage: (props: unknown) => {
    collectionPageMocks.featureCollectionLandingPage(props);

    return <main data-testid="collection-page" />;
  },
}));

vi.mock('../lib/public-browse-page-cache', () => ({
  getCachedPublicBrowsePageData:
    collectionPageMocks.getCachedPublicBrowsePageData,
  toPublicBrowsePagePriceMinorRecord: (
    priceMinorBySetId: ReadonlyMap<string, number>,
  ) => Object.fromEntries(priceMinorBySetId.entries()),
}));

vi.mock('@lego-platform/catalog/util', () => ({
  CATALOG_BROWSE_PAGE_SIZE: 40,
  getCatalogCollectionLandingPageConfig: (slug: string) =>
    slug === collectionPageMocks.collectionConfig.slug
      ? collectionPageMocks.collectionConfig
      : slug === 'lego-sets-onder-50-euro'
        ? {
            ...collectionPageMocks.collectionConfig,
            canonicalPath: '/lego-sets-onder-50-euro',
            h1: 'LEGO sets onder 50 euro',
            metaTitle: 'LEGO sets onder 50 euro | Brickhunt',
            slug: 'lego-sets-onder-50-euro',
          }
        : slug === 'lego-voor-volwassenen'
          ? {
              ...collectionPageMocks.collectionConfig,
              canonicalPath: '/lego-voor-volwassenen',
              h1: 'LEGO voor volwassenen',
              metaTitle: 'LEGO voor volwassenen | Brickhunt',
              slug: 'lego-voor-volwassenen',
              sort: {
                default: 'recommended',
                options: ['recommended', 'pieces-desc', 'newest'],
              },
            }
          : undefined,
  isCatalogCollectionPageSnapshotSlug: (slug: string) =>
    [
      'nieuwe-lego-sets',
      'retiring-lego-sets',
      'lego-sets-onder-50-euro',
      'lego-voor-volwassenen',
    ].includes(slug),
  listCatalogCollectionLandingPageConfigs: () => [
    collectionPageMocks.collectionConfig,
  ],
  normalizeCatalogCollectionLandingPageSortKey: ({
    config,
    value,
  }: {
    config?: { sort?: { default: string } };
    value?: string;
  }) =>
    value ??
    config?.sort?.default ??
    collectionPageMocks.collectionConfig.sort.default,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

vi.mock('@lego-platform/shared/config', () => ({
  buildCanonicalUrl: (path: string) => `https://www.brickhunt.nl${path}`,
  buildPublicBrowseCollectionCacheTags: ({
    collectionSlug,
  }: {
    collectionSlug: string;
  }) => [
    'catalog',
    'sets',
    'collections',
    `collection:${collectionSlug}`,
    'prices',
    'deals',
  ],
  buildWebPath: (path: string) => path,
  cacheTags: {
    catalog: () => 'catalog',
    deals: () => 'deals',
    prices: () => 'prices',
    sets: () => 'sets',
  },
  getDefaultFormattingLocale: () => 'nl-NL',
  isCommerceCommercialUnitComparableForDeals: () => true,
  platformConfig: {
    productName: 'Brickhunt',
  },
  resolvePublicMerchantDisplayName: ({
    merchantName,
  }: {
    merchantName?: string;
  }) => merchantName ?? 'winkel',
  webPathnames: {
    home: '/',
  },
}));

vi.mock('next/navigation', () => ({
  notFound: collectionPageMocks.notFound,
  permanentRedirect: collectionPageMocks.permanentRedirect,
}));

describe('collection landing page route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectionPageMocks.loadedCacheResults = [];
    collectionPageMocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    collectionPageMocks.getCachedPublicBrowsePageData.mockImplementation(
      async ({ load, ...cacheOptions }) => {
        const loaded = await load();
        collectionPageMocks.loadedCacheResults.push(loaded);

        if (loaded === null) {
          return null;
        }

        return JSON.parse(
          JSON.stringify({
            ...loaded,
            __cacheOptions: cacheOptions,
          }),
        );
      },
    );
    collectionPageMocks.getCatalogCollectionLandingPage.mockResolvedValue({
      bestPriceMinorBySetId: new Map([['10307', 9_999]]),
      setCards: [
        {
          id: '10307',
          imageUrl: 'https://cdn.example.com/10307.jpg',
          name: 'Eiffeltoren',
          pieces: 10001,
          releaseYear: 2022,
          slug: 'eiffel-tower-10307',
          theme: 'Icons',
        },
      ],
      totalSetCount: 1,
    });
    collectionPageMocks.getCatalogCollectionLandingPageSnapshot.mockResolvedValue(
      {
        bestPriceMinorBySetId: new Map(),
        snapshotGeneratedAt: new Date().toISOString(),
        setCards: [
          {
            id: '60430',
            imageUrl: 'https://cdn.example.com/60430.jpg',
            name: 'Ruimteschip',
            pieces: 240,
            priceContext: {
              coverageLabel: 'Actuele prijs gevonden',
              currentPrice: 'Vanaf € 39,99',
              merchantLabel: 'Laagst bij Brickfever',
            },
            releaseYear: 2026,
            slug: 'spaceship-60430',
            theme: 'City',
            publicTheme: {
              name: 'City',
              slug: 'city',
              surfaceColor: '#e7f2ff',
              surfaceTextColor: '#12385c',
            },
          },
        ],
        totalSetCount: 1,
      },
    );
  });

  it('uses the shared browse cache with a serializable collection result shape', async () => {
    const pageModule = await import('./page');

    const renderPage = async () =>
      renderToStaticMarkup(
        await pageModule.default({
          params: Promise.resolve({
            collectionSlug: 'lego-sets-onder-100-euro',
          }),
          searchParams: Promise.resolve({
            sort: 'price-asc',
          }),
        }),
      );

    await expect(renderPage()).resolves.toContain(
      'data-testid="collection-page"',
    );
    await expect(renderPage()).resolves.toContain(
      'data-testid="collection-page"',
    );

    expect(
      collectionPageMocks.getCachedPublicBrowsePageData,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pageType: 'collection',
        params: ['sort', 'price-asc', 'limit', 40, 'offset', 0],
        revalidateSeconds: 21_600,
        slug: 'lego-sets-onder-100-euro',
        tags: [
          'catalog',
          'sets',
          'collections',
          'collection:lego-sets-onder-100-euro',
          'prices',
          'deals',
        ],
      }),
    );
    expect(
      collectionPageMocks.getCachedPublicBrowsePageData,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pageType: 'collection',
        params: ['sort', 'price-asc', 'limit', 40, 'offset', 0],
        revalidateSeconds: 21_600,
        slug: 'lego-sets-onder-100-euro',
        tags: [
          'catalog',
          'sets',
          'collections',
          'collection:lego-sets-onder-100-euro',
          'prices',
          'deals',
        ],
      }),
    );
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheOptions: expect.objectContaining({
          revalidateSeconds: 21_600,
          tags: [
            'catalog',
            'sets',
            'collections',
            'collection:lego-sets-onder-100-euro',
            'prices',
            'deals',
          ],
        }),
      }),
    );
    expect(collectionPageMocks.loadedCacheResults[0]).toEqual(
      expect.objectContaining({
        bestPriceMinorBySetId: {
          '10307': 9_999,
        },
      }),
    );
    expect(
      (
        collectionPageMocks.loadedCacheResults[0] as {
          bestPriceMinorBySetId?: unknown;
        }
      ).bestPriceMinorBySetId,
    ).not.toBeInstanceOf(Map);
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSortKey: 'price-asc',
        currentPage: 1,
        pageSize: 40,
        setCards: [
          expect.objectContaining({
            id: '10307',
            priceContext: expect.objectContaining({
              coverageLabel: 'Actuele prijs gevonden',
              merchantLabel: 'Laagste bekende prijs',
              reviewedLabel: 'Server-side bijgewerkt',
            }),
          }),
        ],
        totalSetCount: 1,
      }),
    );
    expect(
      (
        collectionPageMocks.featureCollectionLandingPage.mock.calls[0]?.[0] as {
          config?: { visual?: unknown };
        }
      ).config,
    ).not.toHaveProperty('visual');
  });

  it('keeps collection pagination canonicals on the current page', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({
        collectionSlug: 'lego-sets-onder-100-euro',
      }),
      searchParams: Promise.resolve({
        page: '2',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/lego-sets-onder-100-euro?page=2',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/lego-sets-onder-100-euro?page=2',
      },
    });
  });

  it('keeps collection cards without snapshot price data on the current fallback state', async () => {
    collectionPageMocks.getCatalogCollectionLandingPage.mockResolvedValue({
      bestPriceMinorBySetId: new Map(),
      setCards: [
        {
          id: '10307',
          imageUrl: 'https://cdn.example.com/10307.jpg',
          name: 'Eiffeltoren',
          pieces: 10001,
          releaseYear: 2022,
          slug: 'eiffel-tower-10307',
          theme: 'Icons',
        },
      ],
      totalSetCount: 1,
    });
    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-sets-onder-100-euro',
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setCards: [
          expect.not.objectContaining({
            priceContext: expect.anything(),
          }),
        ],
      }),
    );
  });

  it('reads phase 1 collection pages from collection_page_snapshots without runtime candidate building', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-sets-onder-50-euro',
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      collectionPageMocks.getCatalogCollectionLandingPageSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 40,
        offset: 0,
        sortKey: 'price-asc',
      }),
    );
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).not.toHaveBeenCalled();
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setCards: [
          expect.objectContaining({
            id: '60430',
            publicTheme: expect.objectContaining({
              slug: 'city',
              surfaceColor: '#e7f2ff',
              surfaceTextColor: '#12385c',
            }),
            priceContext: expect.objectContaining({
              currentPrice: 'Vanaf € 39,99',
            }),
          }),
        ],
      }),
    );
  });

  it('renders an intentional empty state when a fresh snapshot has total_count=0', async () => {
    collectionPageMocks.getCatalogCollectionLandingPageSnapshot.mockResolvedValue(
      {
        bestPriceMinorBySetId: new Map(),
        snapshotGeneratedAt: new Date().toISOString(),
        setCards: [],
        totalSetCount: 0,
      },
    );

    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-sets-onder-50-euro',
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(collectionPageMocks.notFound).not.toHaveBeenCalled();
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).not.toHaveBeenCalled();
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setCards: [],
        totalSetCount: 0,
      }),
    );
  });

  it('does not render an indexable empty page when a required snapshot is missing', async () => {
    collectionPageMocks.getCatalogCollectionLandingPageSnapshot.mockResolvedValue(
      undefined,
    );

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-sets-onder-50-euro',
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(collectionPageMocks.notFound).toHaveBeenCalled();
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).not.toHaveBeenCalled();
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).not.toHaveBeenCalled();
  });

  it('does not render a normal indexable page when a required snapshot is stale', async () => {
    collectionPageMocks.getCatalogCollectionLandingPageSnapshot.mockResolvedValue(
      {
        bestPriceMinorBySetId: new Map(),
        snapshotGeneratedAt: '2020-01-01T00:00:00.000Z',
        setCards: [
          {
            id: '60430',
            imageUrl: 'https://cdn.example.com/60430.jpg',
            name: 'Ruimteschip',
            pieces: 240,
            releaseYear: 2026,
            slug: 'spaceship-60430',
            theme: 'City',
          },
        ],
        totalSetCount: 1,
      },
    );

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-sets-onder-50-euro',
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(collectionPageMocks.notFound).toHaveBeenCalled();
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).not.toHaveBeenCalled();
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).not.toHaveBeenCalled();
  });

  it('reads lego-voor-volwassenen from collection_page_snapshots', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          collectionSlug: 'lego-voor-volwassenen',
        }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      collectionPageMocks.getCatalogCollectionLandingPageSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          slug: 'lego-voor-volwassenen',
        }),
        limit: 40,
        offset: 0,
        sortKey: 'recommended',
      }),
    );
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).not.toHaveBeenCalled();
  });
});
