import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.browser';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_BROWSE_PAGE_SIZE } from '@lego-platform/catalog/util';

const themePageMocks = vi.hoisted(() => ({
  getCatalogThemeMetadataBySlug: vi.fn(),
  getCatalogThemePageBySlug: vi.fn(),
  getCachedPublicBrowsePageData: vi.fn(),
  catalogFeatureThemePage: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogThemePageSlugs: vi.fn(),
  listPublishedArticles: vi.fn(),
  rankCatalogComparisonDiscoverySetCards: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogThemeMetadataBySlug: themePageMocks.getCatalogThemeMetadataBySlug,
  getCatalogThemePageBySlug: themePageMocks.getCatalogThemePageBySlug,
  listCatalogCurrentOfferSummariesBySetIds:
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    themePageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogThemePageSlugs: themePageMocks.listCatalogThemePageSlugs,
  rankCatalogComparisonDiscoverySetCards:
    themePageMocks.rankCatalogComparisonDiscoverySetCards,
}));

vi.mock('@lego-platform/catalog/feature-theme-page', () => ({
  CatalogFeatureThemePage: (props: {
    dealRail?: React.ReactNode;
    relatedArticlesRail?: React.ReactNode;
    themePage?: unknown;
  }) => {
    themePageMocks.catalogFeatureThemePage(props);

    return (
      <div data-testid="theme-page">
        {props.dealRail}
        {props.relatedArticlesRail}
      </div>
    );
  },
  CatalogFeatureThemeDealRail: ({
    dealSetCards,
  }: {
    dealSetCards: readonly unknown[];
  }) =>
    dealSetCards.length ? <section data-testid="theme-deal-rail" /> : null,
  CatalogFeatureThemeRelatedArticles: () => (
    <section data-testid="theme-related-articles" />
  ),
}));

vi.mock('../../lib/public-browse-page-cache', () => ({
  getCachedPublicBrowsePageData: themePageMocks.getCachedPublicBrowsePageData,
}));

vi.mock('@lego-platform/content/data-access', () => ({
  listPublishedArticles: themePageMocks.listPublishedArticles,
}));

vi.mock('@lego-platform/pricing/data-access', () => ({
  getFeaturedSetPriceContext: () => undefined,
}));

vi.mock('@lego-platform/shared/config', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@lego-platform/shared/config')>();

  return {
    ...actual,
    buildPublicBrowseThemeCacheTags: ({ themeSlug }: { themeSlug: string }) => [
      'catalog',
      'sets',
      'themes',
      `theme:${themeSlug}`,
      'prices',
    ],
  };
});

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

async function renderToStreamedMarkup(element: React.ReactElement) {
  const stream = await renderToReadableStream(element);

  await stream.allReady;

  return new Response(stream).text();
}

function createCurrentOfferSummary({
  checkedAt = '2026-05-31T09:00:00.000Z',
  merchantName = 'Brickshop',
  priceCents = 6_400,
  setId = '75355',
}: {
  checkedAt?: string;
  merchantName?: string;
  priceCents?: number;
  setId?: string;
} = {}) {
  const bestOffer = {
    availability: 'in_stock',
    checkedAt,
    condition: 'new',
    commercialUnitType: 'full_set',
    currency: 'EUR',
    market: 'NL',
    merchant: merchantName.toLowerCase(),
    merchantName,
    priceCents,
    setId,
    url: 'https://example.com/deal',
  };

  return {
    bestOffer,
    offers: [bestOffer],
    setId,
  };
}

describe('theme page JSON-LD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    themePageMocks.getCachedPublicBrowsePageData.mockImplementation(
      async ({ load }) => load(),
    );
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
  });

  it('renders representative canonical theme metadata', async () => {
    themePageMocks.getCatalogThemeMetadataBySlug.mockResolvedValue({
      momentum: 'X-wings, R2-D2 en displayhelmen blijven goede blikvangers.',
      name: 'Star Wars',
      setCount: 0,
      signatureSet: 'Star Wars',
      slug: 'star-wars',
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'star-wars',
      }),
    });

    expect(metadata).toMatchObject({
      title: 'Brickhunt – Star Wars LEGO sets',
      description:
        'Ontdek Star Wars LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. X-wings, R2-D2 en displayhelmen blijven goede blikvangers.',
      alternates: {
        canonical: 'https://www.brickhunt.nl/themes/star-wars',
      },
      openGraph: {
        description:
          'Ontdek Star Wars LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. X-wings, R2-D2 en displayhelmen blijven goede blikvangers.',
        title: 'Brickhunt – Star Wars LEGO sets',
        type: 'website',
        url: 'https://www.brickhunt.nl/themes/star-wars',
      },
    });
    expect(metadata.robots).toBeUndefined();
    expect(themePageMocks.getCatalogThemeMetadataBySlug).toHaveBeenCalledWith({
      slug: 'star-wars',
    });
    expect(themePageMocks.getCachedPublicBrowsePageData).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: 'theme-metadata',
        revalidateSeconds: false,
        slug: 'star-wars',
        tags: ['catalog', 'sets', 'themes', 'theme:star-wars', 'prices'],
      }),
    );
    expect(themePageMocks.getCatalogThemePageBySlug).not.toHaveBeenCalled();
  });

  it('keeps paginated theme metadata canonical and Open Graph URLs on the current page', async () => {
    themePageMocks.getCatalogThemeMetadataBySlug.mockResolvedValue({
      momentum: 'X-wings, R2-D2 en displayhelmen blijven goede blikvangers.',
      name: 'Star Wars',
      setCount: 120,
      signatureSet: 'Star Wars',
      slug: 'star-wars',
    });

    const { generateMetadata } = await import('./page');
    const pageTwoMetadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'star-wars',
      }),
      searchParams: Promise.resolve({
        page: '2',
      }),
    });
    const pageSevenMetadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'star-wars',
      }),
      searchParams: Promise.resolve({
        page: '7',
      }),
    });

    expect(pageTwoMetadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/themes/star-wars?page=2',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/themes/star-wars?page=2',
      },
    });
    expect(pageSevenMetadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/themes/star-wars?page=7',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/themes/star-wars?page=7',
      },
    });
  });

  it('normalizes invalid theme metadata page values to the page-one canonical', async () => {
    themePageMocks.getCatalogThemeMetadataBySlug.mockResolvedValue({
      momentum: 'X-wings, R2-D2 en displayhelmen blijven goede blikvangers.',
      name: 'Star Wars',
      setCount: 120,
      signatureSet: 'Star Wars',
      slug: 'star-wars',
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'star-wars',
      }),
      searchParams: Promise.resolve({
        page: 'niet-een-pagina',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/themes/star-wars',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/themes/star-wars',
      },
    });
  });

  it('renders CollectionPage and BreadcrumbList structured data', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: 1,
        slug: 'star-wars',
      },
      visual: {
        backgroundColor: '#1f4f7a',
        textColor: '#ffffff',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
      }),
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('https://www.brickhunt.nl/themes/star-wars');
    expect(themePageMocks.getCatalogThemePageBySlug).toHaveBeenCalledWith({
      limit: CATALOG_BROWSE_PAGE_SIZE,
      offset: 0,
      slug: 'star-wars',
    });
    expect(themePageMocks.getCachedPublicBrowsePageData).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: 'theme',
        params: ['limit', CATALOG_BROWSE_PAGE_SIZE, 'offset', 0],
        revalidateSeconds: false,
        slug: 'star-wars',
        tags: ['catalog', 'sets', 'themes', 'theme:star-wars', 'prices'],
      }),
    );
    expect(themePageMocks.catalogFeatureThemePage).toHaveBeenCalledWith(
      expect.objectContaining({
        themePage: expect.objectContaining({
          visual: {
            backgroundColor: '#1f4f7a',
            textColor: '#ffffff',
          },
        }),
      }),
    );
    expect(themePageMocks.catalogFeatureThemePage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        themePage: expect.objectContaining({
          visual: expect.objectContaining({
            backgroundColor: '#3aaee8',
          }),
        }),
      }),
    );
    expect(
      themePageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setIds: ['75355'],
      }),
    );
    expect(themePageMocks.listPublishedArticles).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 3,
        themeQuery: 'star-wars',
      }),
    );
  });

  it('uses the paginated canonical URL in theme structured data', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: CATALOG_BROWSE_PAGE_SIZE * 3,
        slug: 'star-wars',
      },
      visual: {
        backgroundColor: '#1f4f7a',
        textColor: '#ffffff',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
        searchParams: Promise.resolve({
          page: '2',
        }),
      }),
    );

    expect(html).toContain('https://www.brickhunt.nl/themes/star-wars?page=2');
    expect(themePageMocks.getCatalogThemePageBySlug).toHaveBeenCalledWith({
      limit: CATALOG_BROWSE_PAGE_SIZE,
      offset: CATALOG_BROWSE_PAGE_SIZE,
      slug: 'star-wars',
    });
  });

  it('adds snapshot-backed price context to theme browse cards', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: 1,
        slug: 'star-wars',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map([['75355', createCurrentOfferSummary()]]),
    );
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
      }),
    );

    expect(
      themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        liveFallbackSetIdLimit: 0,
        setIds: ['75355'],
      }),
    );
    expect(themePageMocks.catalogFeatureThemePage).toHaveBeenCalledWith(
      expect.objectContaining({
        themePage: expect.objectContaining({
          setCards: [
            expect.objectContaining({
              id: '75355',
              priceContext: expect.objectContaining({
                currentPrice: 'Vanaf € 64,00',
                decisionLabel: 'Beste prijs',
                merchantLabel: 'Laagst bij Brickshop',
              }),
            }),
          ],
        }),
      }),
    );
  });

  it('keeps theme browse cards without a current offer snapshot on the fallback state', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: 1,
        slug: 'star-wars',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
      }),
    );

    expect(themePageMocks.catalogFeatureThemePage).toHaveBeenCalledWith(
      expect.objectContaining({
        themePage: expect.objectContaining({
          setCards: [
            expect.not.objectContaining({
              priceContext: expect.anything(),
            }),
          ],
        }),
      }),
    );
  });

  it('does not block the first HTML on optional deal or article rails', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: 1,
        slug: 'star-wars',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockImplementation(
      () => new Promise(() => undefined),
    );
    themePageMocks.listPublishedArticles.mockImplementation(
      () => new Promise(() => undefined),
    );

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
      }),
    );

    expect(html).toContain('data-testid="theme-page"');
    expect(
      themePageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setIds: ['75355'],
      }),
    );
    expect(
      themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledTimes(1);
    expect(
      themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        liveFallbackSetIdLimit: 0,
        setIds: ['75355'],
      }),
    );
  });

  it('streams the deal rail after slow discovery resolves on client navigation', async () => {
    themePageMocks.getCatalogThemePageBySlug.mockResolvedValue({
      setCards: [
        {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
      ],
      themeSnapshot: {
        momentum: 'R2-D2, X-wings en displaysets houden dit thema sterk.',
        name: 'Star Wars',
        setCount: 1,
        slug: 'star-wars',
      },
    });
    themePageMocks.listCatalogDiscoverySignalsBySetId.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Map([
                  [
                    '75355',
                    {
                      latestPriceMinor: 19999,
                    },
                  ],
                ]),
              ),
            450,
          );
        }),
    );
    themePageMocks.rankCatalogComparisonDiscoverySetCards.mockReturnValue([
      {
        id: '75355',
        imageUrl: 'https://cdn.example.com/75355.jpg',
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    themePageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = await renderToStreamedMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars',
        }),
      }),
    );

    expect(html).toContain('data-testid="theme-deal-rail"');
    expect(
      themePageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setIds: ['75355'],
      }),
    );
    expect(
      themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        setIds: ['75355'],
      }),
    );
  });
});
