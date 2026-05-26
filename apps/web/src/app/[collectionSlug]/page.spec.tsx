import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectionPageMocks = vi.hoisted(() => ({
  cacheCalls: [] as {
    keyParts: readonly string[];
    options: { revalidate?: number; tags?: readonly string[] };
  }[],
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
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogCollectionLandingPage:
    collectionPageMocks.getCatalogCollectionLandingPage,
}));

vi.mock('@lego-platform/catalog/feature-collection-landing', () => ({
  CatalogFeatureCollectionLandingPage: (props: unknown) => {
    collectionPageMocks.featureCollectionLandingPage(props);

    return <main data-testid="collection-page" />;
  },
}));

vi.mock('@lego-platform/catalog/util', () => ({
  CATALOG_BROWSE_PAGE_SIZE: 40,
  getCatalogCollectionLandingPageConfig: (slug: string) =>
    slug === collectionPageMocks.collectionConfig.slug
      ? collectionPageMocks.collectionConfig
      : undefined,
  listCatalogCollectionLandingPageConfigs: () => [
    collectionPageMocks.collectionConfig,
  ],
  normalizeCatalogCollectionLandingPageSortKey: ({
    value,
  }: {
    value?: string;
  }) => value ?? collectionPageMocks.collectionConfig.sort.default,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('@lego-platform/shared/config', () => ({
  buildCanonicalUrl: (path: string) => `https://www.brickhunt.nl${path}`,
  buildWebPath: (path: string) => path,
  cacheTags: {
    catalog: () => 'catalog',
    deals: () => 'deals',
    prices: () => 'prices',
    sets: () => 'sets',
  },
  platformConfig: {
    productName: 'Brickhunt',
  },
  webPathnames: {
    home: '/',
  },
}));

vi.mock('next/cache', () => ({
  unstable_cache: (
    callback: () => unknown,
    keyParts: readonly string[],
    options: { revalidate?: number; tags?: readonly string[] },
  ) => {
    collectionPageMocks.cacheCalls.push({ keyParts, options });

    return callback;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: collectionPageMocks.notFound,
  permanentRedirect: collectionPageMocks.permanentRedirect,
}));

describe('collection landing page route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectionPageMocks.cacheCalls.length = 0;
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
  });

  it('wraps collection data loading in a route-level cache keyed by slug, sort and pagination', async () => {
    const pageModule = await import('./page');

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

    expect(collectionPageMocks.cacheCalls).toEqual([
      {
        keyParts: [
          'catalog-collection-landing-page',
          'lego-sets-onder-100-euro',
          'price-asc',
          '40',
          '0',
        ],
        options: {
          revalidate: 21_600,
          tags: ['catalog', 'sets', 'prices', 'deals'],
        },
      },
    ]);
    expect(
      collectionPageMocks.getCatalogCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        config: collectionPageMocks.collectionConfig,
        limit: 40,
        offset: 0,
        sortKey: 'price-asc',
      }),
    );
    expect(
      collectionPageMocks.featureCollectionLandingPage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSortKey: 'price-asc',
        currentPage: 1,
        pageSize: 40,
        totalSetCount: 1,
      }),
    );
  });
});
