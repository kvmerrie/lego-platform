import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const pageMocks = vi.hoisted(() => ({
  catalogFeatureSetList: vi.fn(),
  catalogFeatureThemeList: vi.fn(),
  catalogFeatureThemeSpotlight: vi.fn(),
  getHomepagePage: vi.fn(),
  getHomepageEditorialConfig: vi.fn(),
  getCatalogCommerceRailRuntimeDiagnostics: vi.fn(),
  getCatalogHomepageDealQualityDiagnostics: vi.fn(),
  getCatalogPartnerOfferRailDiagnostics: vi.fn(),
  listCatalogCurrentOfferCandidateSetIds: vi.fn(),
  listCatalogCurrentOfferSummaries: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCards: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listDiscoverBestDealSetCards: vi.fn(),
  listDiscoverNowInterestingSetCards: vi.fn(),
  listHomepageDiscoveryTiles: vi.fn(),
  listHomepageSetCards: vi.fn(),
  listHomepageThemeDirectoryItems: vi.fn(),
  listHomepageThemeSpotlightItems: vi.fn(),
  getCachedPublicLandingPageData: vi.fn(),
  rankCatalogPartnerOfferSetCards: vi.fn(),
  resolveHomepageFollowRailDiagnostics: vi.fn(),
  selectCatalogFirstCommerceRailSetCards: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getHomepageEditorialConfig: pageMocks.getHomepageEditorialConfig,
  getCatalogCommerceRailRuntimeDiagnostics:
    pageMocks.getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogHomepageDealQualityDiagnostics:
    pageMocks.getCatalogHomepageDealQualityDiagnostics,
  getCatalogPartnerOfferRailDiagnostics:
    pageMocks.getCatalogPartnerOfferRailDiagnostics,
  listCatalogCurrentOfferCandidateSetIds:
    pageMocks.listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummaries: pageMocks.listCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummariesBySetIds:
    pageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    pageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards: pageMocks.listCatalogSetCards,
  listCatalogSetCardsByIds: pageMocks.listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards: pageMocks.listDiscoverBestDealSetCards,
  listDiscoverNowInterestingSetCards:
    pageMocks.listDiscoverNowInterestingSetCards,
  listHomepageDiscoveryTiles: pageMocks.listHomepageDiscoveryTiles,
  listHomepageSetCards: pageMocks.listHomepageSetCards,
  listHomepageThemeDirectoryItems: pageMocks.listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems: pageMocks.listHomepageThemeSpotlightItems,
  rankCatalogPartnerOfferSetCards: pageMocks.rankCatalogPartnerOfferSetCards,
  resolveHomepageFollowRailDiagnostics:
    pageMocks.resolveHomepageFollowRailDiagnostics,
  selectCatalogFirstCommerceRailSetCards:
    pageMocks.selectCatalogFirstCommerceRailSetCards,
}));

vi.mock('@lego-platform/catalog/feature-set-list', () => ({
  CatalogFeatureSetList: (props: unknown) => {
    pageMocks.catalogFeatureSetList(props);
    const typedProps = props as {
      railLayoutMode?: string;
      sectionId?: string;
      surfaceVariant?: string;
      title?: string;
      tone?: string;
    };

    return React.createElement(
      'section',
      {
        'data-homepage-set-list': typedProps.sectionId ?? typedProps.title,
        'data-rail-layout-mode': typedProps.railLayoutMode ?? 'default',
        'data-surface-variant': typedProps.surfaceVariant ?? 'default',
        'data-tone': typedProps.tone ?? 'muted',
      },
      typedProps.title,
    );
  },
}));

vi.mock('@lego-platform/catalog/feature-theme-list', () => ({
  CatalogFeatureThemeList: (props: unknown) => {
    pageMocks.catalogFeatureThemeList(props);
    const typedProps = props as { title?: string; tone?: string };

    return React.createElement(
      'section',
      {
        'data-homepage-theme-list': 'explore-themes',
        'data-tone': typedProps.tone ?? 'default',
      },
      typedProps.title ?? 'Fantasy, Star Wars of strak design?',
    );
  },
  CatalogFeatureThemeSpotlight: (props: unknown) => {
    pageMocks.catalogFeatureThemeSpotlight(props);
    const typedProps = props as { title?: string };

    return React.createElement(
      'section',
      {
        'data-homepage-theme-spotlight': 'theme-spotlight',
        'data-tone': 'plain',
      },
      typedProps.title ?? 'Botanicals, kunst of modulaire straten?',
    );
  },
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
        ctaHref?: string;
        ctaLabel?: string;
        id: string;
      }[];
    };
  }) => {
    const heroSection = editorialPage.sections?.[0];

    return heroSection?.ctaHref && heroSection.ctaLabel
      ? React.createElement(
          'a',
          {
            'data-testid': 'homepage-hero-cta',
            href: heroSection.ctaHref,
          },
          heroSection.ctaLabel,
        )
      : null;
  },
}));

vi.mock('./lib/public-landing-page-cache', () => ({
  getCachedPublicLandingPageData: pageMocks.getCachedPublicLandingPageData,
}));

vi.mock('@lego-platform/pricing/data-access', () => ({
  buildSetDecisionPresentation: () => ({
    cardLabel: 'Actuele prijzen binnen',
    verdict: {
      tone: 'neutral',
    },
  }),
  getFeaturedSetPriceContext: () => undefined,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => null,
}));

const defaultHomepageDiscoveryTiles = [
  {
    href: '/nieuwe-lego-sets',
    id: 'new-sets',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/43019-1/167522.jpg',
    referenceType: 'collection',
    title: 'Nieuwe sets',
    visual: {
      backgroundColor: '#3aaee8',
      textColor: '#08243a',
    },
  },
  {
    href: '/lego-voor-volwassenen',
    id: 'adult-sets',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/10360-1/155899.jpg',
    referenceType: 'collection',
    title: 'LEGO voor volwassenen',
    visual: {
      backgroundColor: '#08636f',
      textColor: '#ffffff',
    },
  },
  {
    href: '/lego-sets-onder-50-euro',
    id: 'budget-sets',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/77256-1/162075.jpg',
    referenceType: 'collection',
    title: 'LEGO sets onder EUR 50',
    visual: {
      backgroundColor: '#35b765',
      textColor: '#062817',
    },
  },
  {
    href: '/retiring-lego-sets',
    id: 'retiring-sets',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/75355-1/119795.jpg',
    referenceType: 'collection',
    title: 'Binnenkort uit handel',
    visual: {
      backgroundColor: '#f28c28',
      textColor: '#281400',
    },
  },
  {
    href: '/deals',
    id: 'deals',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/42207-1/148295.jpg',
    referenceType: 'custom',
    title: 'Interessante deals',
    visual: {
      backgroundColor: '#00a99d',
      textColor: '#062927',
    },
  },
  {
    href: '/themes',
    id: 'themes',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/153296.jpg',
    referenceType: 'custom',
    title: 'Populaire thema’s',
    visual: {
      backgroundColor: '#8758d8',
      textColor: '#ffffff',
    },
  },
] as const;

function setupHomepageRenderMocks() {
  pageMocks.getHomepagePage.mockResolvedValue({
    sections: [],
    seo: {
      description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
      noIndex: false,
      title: 'Brickhunt',
    },
  });
  pageMocks.getHomepageEditorialConfig.mockResolvedValue(undefined);
  pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
  pageMocks.listHomepageDiscoveryTiles.mockResolvedValue(
    defaultHomepageDiscoveryTiles,
  );
  pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
  pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
  pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([]);
  pageMocks.listCatalogSetCardsByIds.mockResolvedValue([]);
  pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
    new Map(),
  );
  pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
  pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
  pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
  pageMocks.listHomepageSetCards.mockResolvedValue([]);
  pageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([]);
}

describe('home metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageMocks.getHomepageEditorialConfig.mockResolvedValue(undefined);
    pageMocks.getCachedPublicLandingPageData.mockImplementation(
      async ({ load, ...cacheOptions }) =>
        JSON.parse(
          JSON.stringify({
            ...(await load()),
            __cacheOptions: cacheOptions,
          }),
        ),
    );
    pageMocks.listHomepageDiscoveryTiles.mockResolvedValue(
      defaultHomepageDiscoveryTiles,
    );
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);
    pageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
  });

  it.each([
    ['undefined config', undefined],
    ['null config', null],
    ['empty config', { sections: [] }],
  ])('renders curated homepage fallback for %s', async (_label, config) => {
    setupHomepageRenderMocks();
    pageMocks.getHomepageEditorialConfig.mockResolvedValue(config);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain('Fantasy, Star Wars of strak design?');
    expect(markup).toContain('Botanicals, kunst of modulaire straten?');
    expect(pageMocks.listHomepageThemeDirectoryItems).toHaveBeenCalledWith({
      homepageEditorialConfig: undefined,
    });
  });

  it('does not import or mount the favorite themes rail on the homepage', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/page.tsx'),
      'utf-8',
    );

    expect(source).not.toContain('CatalogFeatureFavoriteThemesRail');
    expect(source).not.toContain('NEXT_PUBLIC_ENABLE_THEME_FAVORITES_RAIL');
  });

  it('renders the homepage even when the former favorite rail flag is enabled', async () => {
    setupHomepageRenderMocks();
    const previousFlag = process.env['NEXT_PUBLIC_ENABLE_THEME_FAVORITES_RAIL'];
    process.env['NEXT_PUBLIC_ENABLE_THEME_FAVORITES_RAIL'] = 'true';

    try {
      const pageModule = await import('./page');
      const markup = renderToStaticMarkup(await pageModule.default());

      expect(markup).toContain('Ontdek LEGO op jouw manier');
      expect(markup).not.toContain('Jouw favoriete thema’s');
    } finally {
      if (previousFlag === undefined) {
        delete process.env['NEXT_PUBLIC_ENABLE_THEME_FAVORITES_RAIL'];
      } else {
        process.env['NEXT_PUBLIC_ENABLE_THEME_FAVORITES_RAIL'] = previousFlag;
      }
    }
  });

  it('logs and renders curated fallback when homepage CMS fetch fails', async () => {
    setupHomepageRenderMocks();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const cmsError = new Error('public_page_sections does not exist');
    pageMocks.getHomepageEditorialConfig.mockRejectedValue(cmsError);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain('Fantasy, Star Wars of strak design?');
    expect(warnSpy).toHaveBeenCalledWith(
      '[homepage-cms] Falling back to curated homepage defaults.',
      cmsError,
    );
  });

  it('renders populated homepage CMS copy when config is available', async () => {
    setupHomepageRenderMocks();
    pageMocks.getHomepageEditorialConfig.mockResolvedValue({
      sections: [
        {
          enabled: true,
          items: [],
          pageKey: 'homepage',
          sectionKey: 'discovery_routes',
          sortOrder: 10,
          subtitle: 'Kies de route die bij je plank past.',
          title: 'Kies je LEGO route',
        },
        {
          enabled: true,
          items: [],
          pageKey: 'homepage',
          sectionKey: 'theme_rail',
          sortOrder: 20,
          title: 'Draken, Death Stars of displaystukken?',
        },
        {
          enabled: true,
          items: [],
          pageKey: 'homepage',
          sectionKey: 'theme_spotlight',
          sortOrder: 60,
          title: 'Meer werelden voor je kast',
        },
      ],
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Kies je LEGO route');
    expect(markup).toContain('Draken, Death Stars of displaystukken?');
    expect(markup).toContain('Meer werelden voor je kast');
    expect(pageMocks.listHomepageThemeDirectoryItems).toHaveBeenCalledWith({
      homepageEditorialConfig: expect.objectContaining({
        sections: expect.any(Array),
      }),
    });
  });

  it('renders discovery route CMS tiles returned by catalog data-access', async () => {
    setupHomepageRenderMocks();
    pageMocks.listHomepageDiscoveryTiles.mockResolvedValue([
      {
        alt: 'Rivendell displayset',
        href: '/lego-voor-volwassenen',
        id: 'cms-adult-sets',
        imageUrl: 'https://example.test/rivendell.jpg',
        referenceId: 'lego-voor-volwassenen',
        referenceType: 'collection',
        title: 'Displaysets voor je plank',
        visual: {
          backgroundColor: '#123456',
          textColor: '#ffffff',
        },
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('data-visual-tile="cms-adult-sets"');
    expect(markup).toContain('href="/lego-voor-volwassenen"');
    expect(markup).toContain('Displaysets voor je plank');
    expect(markup).toContain('src="https://example.test/rivendell.jpg"');
    expect(markup).toContain('alt="Rivendell displayset"');
    expect(markup).toContain('--theme-surface:#123456');
  });

  it('passes theme spotlight CMS items to the spotlight renderer', async () => {
    setupHomepageRenderMocks();
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([
      {
        description: 'Kies deze als Hogwarts je kast in mag.',
        href: '/themes/harry-potter',
        id: 'cms-harry-potter',
        imageUrl: 'https://example.test/hogwarts.jpg',
        referenceId: 'harry-potter',
        referenceType: 'theme',
        title: 'Hogwarts en Goudgrijp',
      },
    ]);

    const pageModule = await import('./page');
    renderToStaticMarkup(await pageModule.default());

    expect(pageMocks.catalogFeatureThemeSpotlight).toHaveBeenCalledWith(
      expect.objectContaining({
        themeItems: [
          expect.objectContaining({
            href: '/themes/harry-potter',
            id: 'cms-harry-potter',
            title: 'Hogwarts en Goudgrijp',
          }),
        ],
      }),
    );
  });

  it('falls back per missing homepage CMS section when config is partial', async () => {
    setupHomepageRenderMocks();
    pageMocks.getHomepageEditorialConfig.mockResolvedValue({
      sections: [
        {
          enabled: true,
          items: [],
          pageKey: 'homepage',
          sectionKey: 'theme_rail',
          sortOrder: 20,
          title: 'Alleen deze rail komt uit CMS',
        },
      ],
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain('Alleen deze rail komt uit CMS');
    expect(markup).toContain('Botanicals, kunst of modulaire straten?');
  });

  it('ignores malformed homepage CMS rows and renders fallback sections', async () => {
    setupHomepageRenderMocks();
    pageMocks.getHomepageEditorialConfig.mockResolvedValue({
      sections: [
        null,
        {},
        {
          enabled: false,
          items: [],
          pageKey: 'homepage',
          sectionKey: 'discovery_routes',
          sortOrder: 10,
          title: 'Deze uitgeschakelde rij mag niet renderen',
        },
      ],
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain('Fantasy, Star Wars of strak design?');
    expect(markup).toContain('Botanicals, kunst of modulaire straten?');
    expect(markup).not.toContain('Deze uitgeschakelde rij mag niet renderen');
  });

  it('renders current offer rail when hard and soft deal gates are empty', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [],
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
    pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
      '75355',
    ]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map([
        [
          '42177',
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T08:00:00.000Z',
              currency: 'EUR',
              merchantName: 'Goodbricks',
              priceCents: 19999,
              url: 'https://example.com/42177',
            },
            offers: [{ merchantName: 'Goodbricks' }],
            setId: '42177',
          },
        ],
        [
          '75355',
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T09:00:00.000Z',
              currency: 'EUR',
              merchantName: 'MisterBricks',
              priceCents: 23999,
              url: 'https://example.com/75355',
            },
            offers: [{ merchantName: 'MisterBricks' }],
            setId: '75355',
          },
        ],
      ]),
    );
    pageMocks.listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '42177',
        name: 'Mercedes-AMG F1 W14 E Performance',
        pieces: 1642,
        releaseYear: 2024,
        slug: 'mercedes-amg-f1-w14-e-performance-42177',
        theme: 'Technic',
      },
      {
        id: '75355',
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    pageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([
      {
        id: '42177',
        name: 'Mercedes-AMG F1 W14 E Performance',
        pieces: 1642,
        releaseYear: 2024,
        slug: 'mercedes-amg-f1-w14-e-performance-42177',
        theme: 'Technic',
      },
      {
        id: '75355',
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('Ontdek LEGO op jouw manier');
    expect(markup).toContain(
      'data-homepage-theme-list="explore-themes" data-tone="inverse"',
    );
    expect(markup).toContain('Fantasy, Star Wars of strak design?');
    expect(markup).toContain('Botanicals, kunst of modulaire straten?');
    expect(markup).toContain(
      'data-homepage-theme-spotlight="theme-spotlight" data-tone="plain"',
    );
    expect(markup).toContain('Waarom Brickhunt');
    const whyBrickhuntMarkup = markup.slice(
      Math.max(0, markup.indexOf('Waarom Brickhunt') - 500),
      markup.indexOf('Waarom Brickhunt') + 500,
    );
    expect(whyBrickhuntMarkup).toContain('surfaceMuted');
    const discoveryMarkup = markup.slice(
      Math.max(0, markup.indexOf('Ontdek LEGO op jouw manier') - 500),
      markup.indexOf('data-visual-tile="new-sets"'),
    );
    expect(discoveryMarkup).toContain('sectionShellInverse');
    expect(discoveryMarkup).toContain('sectionHeaderInverse');
    expect(markup).toContain('data-visual-tile="new-sets"');
    expect(markup).toContain('--theme-surface:#3aaee8');
    expect(markup).toContain('--theme-surface:#08636f');
    expect(markup).toContain('--theme-surface:#35b765');
    expect(markup).toContain('--theme-surface:#f28c28');
    expect(markup).toContain('--theme-surface:#00a99d');
    expect(markup).toContain('--theme-surface:#8758d8');
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/43019-1/167522.jpg"',
    );
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/10360-1/155899.jpg"',
    );
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/77256-1/162075.jpg"',
    );
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/75355-1/119795.jpg"',
    );
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/42207-1/148295.jpg"',
    );
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/72037-1/153296.jpg"',
    );
    expect(markup).toContain('href="/nieuwe-lego-sets"');
    expect(markup).toContain('href="/lego-voor-volwassenen"');
    expect(markup).toContain('href="/lego-sets-onder-50-euro"');
    expect(markup).toContain('href="/retiring-lego-sets"');
    expect(markup).toContain('href="/themes"');
    expect(markup).not.toContain(
      'Net uit: schepen, auto’s en displaymodellen.',
    );
    expect(markup).not.toContain(
      'Begin bij Star Wars, Icons, Technic of je vaste thema.',
    );
    expect(markup).not.toContain('#d9e4f2');
    expect(markup).not.toContain('#e7d4b5');
    expect(markup).not.toContain('#c9e2de');
    expect(markup).not.toContain('#dde0e5');
    expect(markup).not.toContain('#dbe8bf');
    expect(markup).not.toContain('#d8d1ee');
    expect(markup).not.toContain('#00a8e8');
    expect(markup).not.toContain('#6d28d9');
    expect(markup).not.toContain('#e43d12');
    expect(markup).not.toContain('--theme-surface:#5573b5');
    expect(markup).not.toContain('--theme-surface:#171717');
    expect(markup).not.toContain('--theme-surface:#e0b84f');
    expect(markup).not.toContain('--theme-surface:#d85a50');
    expect(markup).not.toContain('--theme-surface:#6bbf59');
    expect(markup).not.toContain('--theme-surface:#234bcd');
    expect(markup).not.toContain('--theme-surface:#79b7d8');
    expect(markup).not.toContain('--theme-surface:#202b3d');
    expect(markup).not.toContain('--theme-surface:#4fa37a');
    expect(markup).not.toContain('--theme-surface:#b96b36');
    expect(markup).not.toContain('--theme-surface:#247f6d');
    expect(markup).not.toContain('--theme-surface:#6a5a9f');
    expect(pageMocks.catalogFeatureSetList).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nu te vergelijken',
        tone: 'default',
      }),
    );
    expect(pageMocks.catalogFeatureSetList).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Populair om te volgen',
        tone: 'default',
      }),
    );
    const setListProps = pageMocks.catalogFeatureSetList.mock.calls.map(
      ([props]) =>
        props as {
          sectionId?: string;
          railLayoutMode?: string;
          surfaceVariant?: string;
          title?: string;
          tone?: string;
        },
    );
    const normalRailSetListProps = setListProps.filter((props) =>
      ['Nu te vergelijken', 'Populair om te volgen'].includes(
        props.title ?? '',
      ),
    );
    expect(normalRailSetListProps).toEqual([
      expect.objectContaining({
        title: 'Nu te vergelijken',
        tone: 'default',
      }),
      expect.objectContaining({
        title: 'Populair om te volgen',
        tone: 'default',
      }),
    ]);
    expect(
      normalRailSetListProps.map((props) => props.surfaceVariant ?? 'default'),
    ).toEqual(['default', 'default']);
    expect(normalRailSetListProps.map((props) => props.railLayoutMode)).toEqual(
      ['stable-square', 'stable-square'],
    );
    expect(pageMocks.catalogFeatureThemeList).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'inverse',
      }),
    );
    expect(pageMocks.getCachedPublicLandingPageData).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 'homepage',
        params: ['delivery'],
        revalidateSeconds: false,
        tags: ['homepage', 'catalog', 'sets', 'themes', 'prices', 'deals'],
      }),
    );
  });

  it('points the hero CTA to the hard deal rail when it is rendered', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: 'Ontdek welke sets nu opvallen.',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Ontdek sets',
          eyebrow: 'Brickhunt',
          id: 'home-hero',
          title: 'Welke set wil je?',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
    pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
      '75355',
    ]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map([
        [
          '42177',
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T08:00:00.000Z',
              currency: 'EUR',
              merchantName: 'Goodbricks',
              priceCents: 19999,
              url: 'https://example.com/42177',
            },
            offers: [{ merchantName: 'Goodbricks' }],
            setId: '42177',
          },
        ],
        [
          '75355',
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T09:00:00.000Z',
              currency: 'EUR',
              merchantName: 'MisterBricks',
              priceCents: 23999,
              url: 'https://example.com/75355',
            },
            offers: [{ merchantName: 'MisterBricks' }],
            setId: '75355',
          },
        ],
      ]),
    );
    pageMocks.listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '42177',
        name: 'Mercedes-AMG F1 W14 E Performance',
        pieces: 1642,
        releaseYear: 2024,
        slug: 'mercedes-amg-f1-w14-e-performance-42177',
        theme: 'Technic',
      },
      {
        id: '75355',
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map([
        ['42177', { setId: '42177' }],
        ['75355', { setId: '75355' }],
      ]),
    );
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([
      {
        id: '42177',
        name: 'Mercedes-AMG F1 W14 E Performance',
        pieces: 1642,
        releaseYear: 2024,
        slug: 'mercedes-amg-f1-w14-e-performance-42177',
        theme: 'Technic',
      },
      {
        id: '75355',
        name: 'X-wing Starfighter',
        pieces: 1949,
        releaseYear: 2023,
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('href="/#best-current-deals"');
    expect(pageMocks.catalogFeatureSetList).toHaveBeenCalledWith(
      expect.objectContaining({
        railLayoutMode: 'stable-square',
        sectionId: 'best-current-deals',
        title: 'Beste deals nu',
      }),
    );
  });

  it('points the hero CTA to an existing fallback rail when hard deals are not rendered', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [
        {
          body: 'Ontdek welke sets nu opvallen.',
          ctaHref: '#best-current-deals',
          ctaLabel: 'Ontdek sets',
          eyebrow: 'Brickhunt',
          id: 'home-hero',
          title: 'Welke set wil je?',
          type: 'hero',
        },
      ],
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
    pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([]);
    pageMocks.listCatalogSetCardsByIds.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([
      {
        id: '10316',
        name: 'The Lord of the Rings: Rivendell',
        pieces: 6167,
        releaseYear: 2023,
        slug: 'lord-of-the-rings-rivendell-10316',
        theme: 'Icons',
      },
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('href="/#popular-to-follow"');
    expect(pageMocks.catalogFeatureSetList).toHaveBeenCalledWith(
      expect.objectContaining({
        railLayoutMode: 'stable-square',
        sectionId: 'popular-to-follow',
        title: 'Populair om te volgen',
      }),
    );
  });

  it('scopes homepage discovery signals to rendered catalog and commerce cards', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [],
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
    pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
    ]);
    pageMocks.listCatalogSetCardsByIds.mockResolvedValue([{ id: '42177' }]);
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([]);
    pageMocks.selectCatalogFirstCommerceRailSetCards.mockReturnValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );

    const pageModule = await import('./page');
    await pageModule.default();

    expect(pageMocks.listCatalogDiscoverySignalsBySetId).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: false,
        tags: ['homepage', 'prices'],
      },
      setIds: ['10316', '42177'],
    });
  });

  it('loads targeted current offers for selected follow rail cards', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      sections: [],
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });
    pageMocks.listCatalogSetCards.mockResolvedValue([{ id: '10316' }]);
    pageMocks.listHomepageThemeDirectoryItems.mockResolvedValue([]);
    pageMocks.listHomepageThemeSpotlightItems.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
    ]);
    pageMocks.listCatalogSetCardsByIds.mockResolvedValue([{ id: '42177' }]);
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([
      {
        id: '75355',
        slug: 'x-wing-starfighter-75355',
        theme: 'Star Wars',
      },
    ]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map([
        [
          '75355',
          {
            bestOffer: {
              availability: 'in_stock',
              checkedAt: '2026-05-18T08:00:00.000Z',
              currency: 'EUR',
              merchantName: 'Goodbricks',
              priceCents: 19995,
              url: 'https://example.com/deal',
            },
            offers: [],
            setId: '75355',
          },
        ],
      ]),
    );

    const pageModule = await import('./page');
    await pageModule.default();

    expect(
      pageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: false,
        tags: ['homepage', 'prices', 'set:75355'],
      },
      setIds: ['75355'],
    });
  });

  it('renders representative canonical launch metadata', async () => {
    pageMocks.getHomepagePage.mockResolvedValue({
      seo: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        noIndex: false,
        title: 'Brickhunt',
      },
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata();

    expect(metadata).toMatchObject({
      title: 'Brickhunt',
      description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
      alternates: {
        canonical: 'https://www.brickhunt.nl/',
      },
      openGraph: {
        description: 'Vind LEGO sets die echt iets toevoegen aan je collectie.',
        siteName: 'Brickhunt',
        title: 'Brickhunt',
        type: 'website',
        url: 'https://www.brickhunt.nl/',
      },
    });
    expect(metadata.robots).toBeUndefined();
  });
});
