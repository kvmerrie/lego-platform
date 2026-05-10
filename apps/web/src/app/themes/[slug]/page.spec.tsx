import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.browser';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const themePageMocks = vi.hoisted(() => ({
  getCatalogThemeMetadataBySlug: vi.fn(),
  getCatalogThemePageBySlug: vi.fn(),
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
  CatalogFeatureThemePage: ({
    dealRail,
    relatedArticlesRail,
  }: {
    dealRail?: React.ReactNode;
    relatedArticlesRail?: React.ReactNode;
  }) => (
    <div data-testid="theme-page">
      {dealRail}
      {relatedArticlesRail}
    </div>
  ),
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

vi.mock('@lego-platform/content/data-access', () => ({
  listPublishedArticles: themePageMocks.listPublishedArticles,
}));

vi.mock('@lego-platform/pricing/data-access', () => ({
  getFeaturedSetPriceContext: () => undefined,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (callback: () => unknown) => callback,
}));

async function renderToStreamedMarkup(element: React.ReactElement) {
  const stream = await renderToReadableStream(element);

  await stream.allReady;

  return new Response(stream).text();
}

describe('theme page JSON-LD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    expect(themePageMocks.getCatalogThemePageBySlug).not.toHaveBeenCalled();
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
      limit: 20,
      offset: 0,
      slug: 'star-wars',
    });
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

  it('does not load current offer summaries when discovery has no scoped signals', async () => {
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
    themePageMocks.listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    await pageModule.default({
      params: Promise.resolve({
        slug: 'star-wars',
      }),
    });

    expect(
      themePageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).not.toHaveBeenCalled();
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
    ).not.toHaveBeenCalled();
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
