import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HomepageCommerceSnapshot } from '@lego-platform/catalog/util';

const pageMocks = vi.hoisted(() => ({
  cachedPayload: undefined as unknown,
  catalogFeatureSetList: vi.fn(),
  catalogSetCardRail: vi.fn(),
  catalogFeatureThemeList: vi.fn(),
  catalogFeatureThemeSpotlight: vi.fn(),
  catalogSectionShell: vi.fn(),
  catalogVisualTile: vi.fn(),
  getCachedPublicLandingPageData: vi.fn(),
  getHomepageCommerceSnapshot: vi.fn(),
  getHomepageEditorialConfig: vi.fn(),
  getHomepagePage: vi.fn(),
  listCatalogCurrentOfferCandidateSetIds: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listDiscoverBestDealSetCards: vi.fn(),
  listDiscoverNowInterestingSetCards: vi.fn(),
  listHomepageDiscoveryTiles: vi.fn(),
  listHomepageSetCards: vi.fn(),
  listHomepageThemeDirectoryItems: vi.fn(),
  listHomepageThemeSpotlightItems: vi.fn(),
  rankCatalogPartnerOfferSetCards: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getHomepageCommerceSnapshot: pageMocks.getHomepageCommerceSnapshot,
  getHomepageEditorialConfig: pageMocks.getHomepageEditorialConfig,
  listCatalogCurrentOfferCandidateSetIds:
    pageMocks.listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummariesBySetIds:
    pageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    pageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds: pageMocks.listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards: pageMocks.listDiscoverBestDealSetCards,
  listDiscoverNowInterestingSetCards:
    pageMocks.listDiscoverNowInterestingSetCards,
  listHomepageDiscoveryTiles: pageMocks.listHomepageDiscoveryTiles,
  listHomepageSetCards: pageMocks.listHomepageSetCards,
  listHomepageThemeDirectoryItems: pageMocks.listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems: pageMocks.listHomepageThemeSpotlightItems,
  rankCatalogPartnerOfferSetCards: pageMocks.rankCatalogPartnerOfferSetCards,
}));

vi.mock('@lego-platform/catalog/feature-set-list', () => ({
  CatalogFeatureSetList: (props: unknown) => {
    pageMocks.catalogFeatureSetList(props);
    const typedProps = props as {
      sectionId?: string;
      setCards?: readonly {
        name: string;
        priceContext?: { currentPrice: string };
      }[];
      showHeader?: boolean;
      title?: string;
    };

    return React.createElement(
      'section',
      {
        'data-homepage-set-list': typedProps.sectionId ?? typedProps.title,
      },
      [
        typedProps.showHeader === false ? '' : typedProps.title,
        ...(typedProps.setCards ?? []).flatMap((card) => [
          card.name,
          card.priceContext?.currentPrice ?? '',
        ]),
      ].join(' '),
    );
  },
}));

vi.mock('@lego-platform/catalog/feature-theme-list', () => ({
  CatalogFeatureThemeList: (props: unknown) => {
    pageMocks.catalogFeatureThemeList(props);
    const typedProps = props as { title?: string };

    return React.createElement(
      'section',
      { 'data-homepage-theme-list': 'explore-themes' },
      typedProps.title ?? 'Fantasy, Star Wars of strak design?',
    );
  },
  CatalogFeatureThemeSpotlight: (props: unknown) => {
    pageMocks.catalogFeatureThemeSpotlight(props);
    const typedProps = props as { title?: string };

    return React.createElement(
      'section',
      { 'data-homepage-theme-spotlight': 'theme-spotlight' },
      typedProps.title ?? 'Botanicals, kunst of modulaire straten?',
    );
  },
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogSetCardRail: (props: unknown) => {
    pageMocks.catalogSetCardRail(props);
    const typedProps = props as {
      items: readonly {
        id: string;
        priceContext?: { currentPrice: string };
        setSummary: { name: string };
      }[];
      render: (props: {
        controls: React.ReactNode;
        rail: React.ReactNode;
      }) => React.ReactNode;
    };

    return typedProps.render({
      controls: React.createElement(
        'div',
        { 'data-rail-controls': true },
        'Controls',
      ),
      rail: React.createElement(
        'section',
        { 'data-homepage-set-list': true },
        typedProps.items
          .flatMap((item) => [
            item.setSummary.name,
            item.priceContext?.currentPrice ?? '',
          ])
          .join(' '),
      ),
    });
  },
  CatalogSectionShell: ({
    children,
    id,
    title,
  }: {
    children?: React.ReactNode;
    id?: string;
    title?: string;
  }) => {
    pageMocks.catalogSectionShell({ id, title });

    return React.createElement('section', { id }, [title, children]);
  },
  CatalogVisualTile: (props: unknown) => {
    pageMocks.catalogVisualTile(props);
    const typedProps = props as { href: string; title: string };

    return React.createElement(
      'a',
      { href: typedProps.href },
      typedProps.title,
    );
  },
  CatalogVisualTileRail: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-visual-tile-rail': true }, children),
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getHomepagePage: pageMocks.getHomepagePage,
}));

vi.mock('@lego-platform/content/feature-page-renderer', () => ({
  ContentFeaturePageRenderer: ({
    editorialPage,
  }: {
    editorialPage: {
      sections?: readonly {
        body?: string;
        ctaHref?: string;
        ctaLabel?: string;
        id: string;
        title?: string;
      }[];
    };
  }) => {
    const heroSection = editorialPage.sections?.[0];

    return heroSection
      ? React.createElement('section', { 'data-testid': 'homepage-hero' }, [
          heroSection.title
            ? React.createElement('h1', { key: 'title' }, heroSection.title)
            : null,
          heroSection.body
            ? React.createElement('p', { key: 'body' }, heroSection.body)
            : null,
          heroSection.ctaHref && heroSection.ctaLabel
            ? React.createElement(
                'a',
                {
                  'data-testid': 'homepage-hero-cta',
                  href: heroSection.ctaHref,
                  key: 'cta',
                },
                heroSection.ctaLabel,
              )
            : null,
        ])
      : null;
  },
}));

vi.mock('./lib/public-landing-page-cache', () => ({
  getCachedPublicLandingPageData: pageMocks.getCachedPublicLandingPageData,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () =>
    React.createElement('span', { 'data-wishlist-toggle': true }),
}));

const defaultHomepageDiscoveryTiles = [
  {
    href: '/nieuwe-lego-sets',
    id: 'new-sets',
    imageUrl: 'https://cdn.example/new.jpg',
    referenceType: 'collection',
    title: 'Nieuwe sets',
  },
  {
    href: '/deals',
    id: 'deals',
    imageUrl: 'https://cdn.example/deals.jpg',
    referenceType: 'custom',
    title: 'Interessante deals',
  },
] as const;

function homepageCommerceSnapshot(
  patch: Partial<HomepageCommerceSnapshot> = {},
): HomepageCommerceSnapshot {
  return {
    generatedAt: '2026-06-15T08:00:00.000Z',
    buyRail: {
      bestDeals: [
        {
          setId: '10316',
          slug: 'the-lord-of-the-rings-rivendell-10316',
          name: 'Rivendell',
          imageUrl: 'https://cdn.example/10316.jpg',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6167,
          currentPriceMinor: 42999,
          merchantName: 'Toy Shop',
          dealLabel: 'Sterke deal',
          confidenceLabel: '3 vergeleken winkels',
          ctaUrl: 'https://merchant.example/10316',
        },
      ],
      popularThisWeek: [],
      giftsUnder100: [
        {
          setId: '31170',
          slug: 'wild-animals-pink-flamingo-31170',
          name: 'Wild Animals: Pink Flamingo',
          imageUrl: 'https://cdn.example/31170.jpg',
          currentPriceMinor: 2499,
          merchantName: 'Toy Shop',
          ctaUrl: 'https://merchant.example/31170',
        },
      ],
    },
    followRail: {
      smartToFollow: [
        {
          setId: '75355',
          slug: 'ucs-x-wing-starfighter-75355',
          name: 'UCS X-wing Starfighter',
          imageUrl: 'https://cdn.example/75355.jpg',
          currentPriceMinor: 22999,
          dealLabel: 'Slim om te volgen',
          followRecommended: true,
        },
      ],
      biggestPriceDrops: [],
      waitCanPayOff: [],
    },
    ...patch,
  };
}

function setupHomepageRenderMocks(
  options: {
    snapshot?: HomepageCommerceSnapshot | undefined;
  } = {},
) {
  const resolvedSnapshot = Object.prototype.hasOwnProperty.call(
    options,
    'snapshot',
  )
    ? options.snapshot
    : homepageCommerceSnapshot();

  pageMocks.cachedPayload = undefined;
  pageMocks.getHomepagePage.mockResolvedValue({
    sections: [],
    seo: {
      description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
      noIndex: false,
      title: 'Brickhunt',
    },
  });
  pageMocks.getHomepageEditorialConfig.mockResolvedValue(undefined);
  pageMocks.getHomepageCommerceSnapshot.mockResolvedValue(resolvedSnapshot);
  pageMocks.listHomepageDiscoveryTiles.mockResolvedValue(
    defaultHomepageDiscoveryTiles,
  );
  pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
  pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
  pageMocks.getCachedPublicLandingPageData.mockImplementation(
    async ({ load, ...cacheOptions }) => {
      const payload = await load();

      pageMocks.cachedPayload = payload;

      return JSON.parse(
        JSON.stringify({
          ...payload,
          __cacheOptions: cacheOptions,
        }),
      );
    },
  );
}

describe('homepage commerce snapshot runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupHomepageRenderMocks();
  });

  it('renders discovery, buy intent, and follow intent from the snapshot', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain('Slim kopen');
    expect(markup).toContain('Beste deals');
    expect(markup).toContain('Onder €100');
    expect(markup).toContain('Slim volgen');
    expect(markup).toContain('Prijsalerts');
    expect(markup).not.toContain('Onder EUR 100');
    expect(markup).not.toContain('Beste koopkansen van dit moment');
    expect(markup).not.toContain('Prijs slim volgen');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('Vanaf');
    expect(markup).not.toContain('Eerst de sets waar kopen nu logisch is');
    expect(markup).not.toContain('Niet alles hoef je vandaag te kopen');
  });

  it('renders buy and follow commerce as one active tabbed section each', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('role="tablist"');
    expect(pageMocks.catalogSetCardRail).toHaveBeenCalledTimes(2);
    expect(pageMocks.catalogSetCardRail).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Beste deals',
      }),
    );
    expect(pageMocks.catalogSetCardRail).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Prijsalerts',
      }),
    );
    expect(pageMocks.catalogSetCardRail).not.toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Onder €100',
      }),
    );
    expect(markup).toContain('Onder €100');
    expect(markup).not.toContain('Wild Animals: Pink Flamingo');
  });

  it('maps current snapshot prices to homepage card price contexts', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(await pageModule.default());

    expect(pageMocks.catalogSetCardRail).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            ctaMode: 'commerce',
            id: '10316',
            priceContext: expect.objectContaining({
              currentPrice: 'Vanaf € 429,99',
              primaryActionHref: 'https://merchant.example/10316',
            }),
          }),
        ]),
      }),
    );
  });

  it('does not run homepage commerce ranking or offer hydration at runtime', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(await pageModule.default());

    expect(
      pageMocks.listCatalogCurrentOfferCandidateSetIds,
    ).not.toHaveBeenCalled();
    expect(
      pageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).not.toHaveBeenCalled();
    expect(pageMocks.listCatalogDiscoverySignalsBySetId).not.toHaveBeenCalled();
    expect(pageMocks.listCatalogSetCardsByIds).not.toHaveBeenCalled();
    expect(pageMocks.listDiscoverBestDealSetCards).not.toHaveBeenCalled();
    expect(pageMocks.listDiscoverNowInterestingSetCards).not.toHaveBeenCalled();
    expect(pageMocks.listHomepageSetCards).not.toHaveBeenCalled();
    expect(pageMocks.rankCatalogPartnerOfferSetCards).not.toHaveBeenCalled();
  });

  it('keeps the cached homepage commerce payload compact', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(await pageModule.default());

    expect(pageMocks.cachedPayload).toHaveProperty('homepageCommerceSnapshot');
    expect(pageMocks.cachedPayload).not.toHaveProperty(
      'currentOfferSummaryEntries',
    );
    expect(pageMocks.cachedPayload).not.toHaveProperty(
      'catalogDiscoverySignalEntries',
    );
    expect(pageMocks.cachedPayload).not.toHaveProperty(
      'commerceCandidateSetCards',
    );
    expect(
      Buffer.byteLength(JSON.stringify(pageMocks.cachedPayload)),
    ).toBeLessThan(2_000_000);
    expect(pageMocks.getCachedPublicLandingPageData).toHaveBeenCalledWith(
      expect.objectContaining({
        params: [
          'delivery',
          'homepage-commerce-snapshot-v1',
          'homepage-editorial-v2',
        ],
      }),
    );
  });

  it('renders without runtime offer hydration when the snapshot is missing', async () => {
    setupHomepageRenderMocks({
      snapshot: undefined,
    });
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).not.toContain('Slim kopen');
    expect(markup).not.toContain('Slim volgen');
    expect(
      pageMocks.listCatalogCurrentOfferCandidateSetIds,
    ).not.toHaveBeenCalled();
  });

  it('renders the commerce-focused hero copy while keeping the CTA anchored to the buy rail', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: 'Vergelijk prijzen, ontdek de beste deals en zie wanneer wachten slimmer is.',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Bekijk beste deals',
          id: 'hero',
          title: 'Welke set wil je?',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Homepage',
        noIndex: false,
        title: 'Brickhunt',
      },
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Welke set wil je?');
    expect(markup).toContain(
      'Vergelijk prijzen, ontdek de beste deals en zie wanneer wachten slimmer is.',
    );
    expect(markup).toContain('Bekijk beste deals');
    expect(markup).toContain('href="/#best-current-deals"');
    expect(markup).not.toContain('Ontdek sets');
    expect(markup).not.toContain(
      'Ontdek welke sets het waard zijn en of dit een slim moment is om te kopen.',
    );
  });

  it('retargets the hero CTA to buy, then follow, then discovery', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: '',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Bekijk beste deals',
          id: 'hero',
          title: 'Brickhunt',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Homepage',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    const pageModule = await import('./page');
    const buyMarkup = renderToStaticMarkup(await pageModule.default());

    expect(buyMarkup).toContain('href="/#best-current-deals"');

    setupHomepageRenderMocks({
      snapshot: homepageCommerceSnapshot({
        buyRail: {
          bestDeals: [],
          popularThisWeek: [],
          giftsUnder100: [],
        },
      }),
    });
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: '',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Bekijk beste deals',
          id: 'hero',
          title: 'Brickhunt',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Homepage',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    vi.resetModules();
    const followPageModule = await import('./page');
    const followMarkup = renderToStaticMarkup(await followPageModule.default());

    expect(followMarkup).toContain('href="/#price-smart-follow"');

    setupHomepageRenderMocks({
      snapshot: homepageCommerceSnapshot({
        buyRail: {
          bestDeals: [],
          popularThisWeek: [],
          giftsUnder100: [],
        },
        followRail: {
          smartToFollow: [],
          biggestPriceDrops: [],
          waitCanPayOff: [],
        },
      }),
    });
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: '',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Bekijk beste deals',
          id: 'hero',
          title: 'Brickhunt',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Homepage',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    vi.resetModules();
    const discoveryPageModule = await import('./page');
    const discoveryMarkup = renderToStaticMarkup(
      await discoveryPageModule.default(),
    );

    expect(discoveryMarkup).toContain('href="/#ontdek-lego-op-jouw-manier"');
  });

  it('hides the popular tab when genuine popularity data is absent', async () => {
    setupHomepageRenderMocks({
      snapshot: homepageCommerceSnapshot({
        buyRail: {
          bestDeals: [],
          popularThisWeek: [],
          giftsUnder100: [],
        },
      }),
    });
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).not.toContain('Populair');
  });
});
