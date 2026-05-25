import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.browser';

const setPageMocks = vi.hoisted(() => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId: vi.fn(),
  getCatalogSetBySlug: vi.fn(),
  listCatalogCurrentOfferCandidateSetIds: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCards: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listCatalogSetLiveOffersBySetId: vi.fn(),
  listCatalogSetSlugs: vi.fn(),
  listCatalogSimilarSetCards: vi.fn(),
  listPublishedArticlesByPrimarySetNumber: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (callback: () => unknown) => callback,
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId:
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId,
  getCatalogSetBySlug: setPageMocks.getCatalogSetBySlug,
  listCatalogCurrentOfferCandidateSetIds:
    setPageMocks.listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummariesBySetIds:
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    setPageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards: setPageMocks.listCatalogSetCards,
  listCatalogSetCardsByIds: setPageMocks.listCatalogSetCardsByIds,
  listCatalogSetLiveOffersBySetId: setPageMocks.listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs: setPageMocks.listCatalogSetSlugs,
  listCatalogSimilarSetCards: setPageMocks.listCatalogSimilarSetCards,
}));

vi.mock('@lego-platform/catalog/feature-set-detail', () => ({
  CatalogFeatureSetDetail: ({
    bestDeal,
    offerList,
    recentlyViewedRail,
    setNewsRail,
    similarSetsRail,
    themeDirectoryHref,
    themeHref,
  }: {
    bestDeal?: {
      ctaLabel?: string;
      decisionLabel?: string;
      decisionTone?: string;
      merchantLabel?: string;
      rankingLabel?: string;
    };
    offerList?: readonly {
      ctaLabel?: string;
      merchantLabel?: string;
    }[];
    recentlyViewedRail?: unknown;
    setNewsRail?: unknown;
    similarSetsRail?: unknown;
    themeDirectoryHref?: string;
    themeHref?: string;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'set-detail' },
      themeDirectoryHref
        ? createElement('a', { href: themeDirectoryHref }, "Thema's")
        : null,
      themeHref ? createElement('a', { href: themeHref }, 'Thema') : null,
      bestDeal
        ? createElement(
            'div',
            {
              'data-testid': 'best-deal',
              'data-tone': bestDeal.decisionTone,
            },
            bestDeal.decisionLabel,
            bestDeal.rankingLabel,
            bestDeal.ctaLabel,
            bestDeal.merchantLabel,
          )
        : null,
      offerList?.length
        ? createElement(
            'ul',
            { 'data-testid': 'offer-list' },
            ...offerList.map((offer, index) =>
              createElement(
                'li',
                { key: index },
                offer.ctaLabel,
                offer.merchantLabel,
              ),
            ),
          )
        : null,
      similarSetsRail
        ? createElement(
            'section',
            { 'data-testid': 'similar-slot' },
            'Similar slot',
            similarSetsRail,
          )
        : null,
      recentlyViewedRail
        ? createElement(
            'section',
            { 'data-testid': 'recently-slot' },
            'Recently viewed slot',
            recentlyViewedRail,
          )
        : null,
      setNewsRail,
    ),
}));

async function renderToStreamedMarkup(element: ReactElement) {
  const stream = await renderToReadableStream(element);

  await stream.allReady;

  return new Response(stream).text();
}

vi.mock('@lego-platform/catalog/feature-set-list', () => ({
  CatalogFeatureSetList: ({
    className,
    setCards,
    style,
    surfaceVariant,
    title,
  }: {
    className?: string;
    setCards: readonly { slug: string; name: string }[];
    style?: Record<string, string>;
    surfaceVariant?: string;
    title?: string;
  }) =>
    createElement(
      'section',
      {
        className,
        'data-surface-variant': surfaceVariant,
        'data-testid': 'set-list',
        style,
      },
      title ? createElement('h2', null, title) : null,
      ...setCards.map((setCard) =>
        createElement(
          'a',
          { href: `/sets/${setCard.slug}`, key: setCard.slug },
          setCard.name,
        ),
      ),
    ),
}));

vi.mock('@lego-platform/catalog/feature-recently-viewed', () => ({
  CatalogFeatureRecentlyViewed: () =>
    createElement(
      'section',
      {
        'data-testid': 'recently-viewed',
        'data-tone': 'inverse',
      },
      'Recent bekeken LEGO sets',
    ),
  CatalogRecentlyViewedSetTracker: () => null,
}));

vi.mock('@lego-platform/collection/feature-owned-toggle', () => ({
  CollectionFeatureOwnedToggle: () =>
    createElement('button', { type: 'button' }, 'owned'),
}));

vi.mock('@lego-platform/content/data-access', () => ({
  listPublishedArticlesByPrimarySetNumber:
    setPageMocks.listPublishedArticlesByPrimarySetNumber,
}));

vi.mock('@lego-platform/pricing/feature-price-history', () => ({
  PricingFeaturePriceHistory: () =>
    createElement('div', { 'data-testid': 'price-history' }),
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () =>
    createElement('button', { type: 'button' }, 'wishlist'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env['NEXT_PHASE'];
  delete process.env['SET_DETAIL_STATIC_PARAMS_LIMIT'];
  delete process.env['SKIP_SET_DETAIL_SSG_OPTIONAL_RAILS'];
});

function createCurrentOfferSummaryMap({
  offers,
  setId,
}: {
  offers: readonly {
    availability: 'in_stock' | 'out_of_stock' | 'unknown';
    checkedAt: string;
    currency: 'EUR';
    merchant: 'amazon' | 'bol' | 'lego' | 'other';
    merchantName: string;
    merchantSlug?: string;
    priceCents: number;
    url: string;
  }[];
  setId: string;
}) {
  return new Map([
    [
      setId,
      {
        bestOffer: offers[0],
        offers,
        setId,
      },
    ],
  ]);
}

describe('set detail static generation', () => {
  it('prerenders a capped hot-set subset and leaves the rest for dynamic ISR', async () => {
    process.env['SET_DETAIL_STATIC_PARAMS_LIMIT'] = '3';
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    setPageMocks.listCatalogSetSlugs.mockResolvedValue([
      'millennium-falcon-75192',
      'rivendell-10316',
      'x-wing-starfighter-75355',
      'small-car-60400',
      'wildflower-bouquet-10313',
    ]);
    setPageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '75192',
      '10316',
    ]);
    setPageMocks.listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '75192',
        name: 'Millennium Falcon',
        slug: 'millennium-falcon-75192',
      },
      {
        id: '10316',
        name: 'Rivendell',
        slug: 'rivendell-10316',
      },
    ]);
    setPageMocks.listCatalogSetCards.mockResolvedValue([
      {
        id: '75355',
        name: 'X-wing Starfighter',
        slug: 'x-wing-starfighter-75355',
      },
      {
        id: '60400',
        name: 'Small Car',
        slug: 'small-car-60400',
      },
    ]);

    const pageModule = await import('./page');
    const staticParams = await pageModule.generateStaticParams();

    expect(staticParams).toEqual([
      { slug: 'millennium-falcon-75192' },
      { slug: 'rivendell-10316' },
      { slug: 'x-wing-starfighter-75355' },
    ]);
    expect(
      setPageMocks.listCatalogCurrentOfferCandidateSetIds,
    ).toHaveBeenCalledWith({
      limit: 3,
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[set-detail-static-params]',
      expect.objectContaining({
        prerendered_set_count: 3,
        skipped_static_set_count: 2,
        total_set_count: 5,
      }),
    );
    consoleInfoSpy.mockRestore();
  });

  it('renders comparable sets during production build SSG when data is available', async () => {
    process.env['NEXT_PHASE'] = 'phase-production-build';
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '75355',
      imageUrl: 'https://cdn.example.com/75355.jpg',
      name: 'X-wing Starfighter',
      pieces: 1949,
      publicTheme: {
        accentColor: '#123456',
        name: 'Star Wars',
        slug: 'star-wars',
        surfaceColor: '#112244',
        surfaceTextColor: '#ffffff',
      },
      releaseYear: 2023,
      slug: 'x-wing-starfighter-75355',
      theme: 'Star Wars',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://cdn.example.com/75446.jpg',
        name: 'Grogu with Hover Pram',
        pieces: 1048,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'Goodbricks',
            priceCents: 9999,
            url: 'https://partner.example/75446',
          },
        ],
        setId: '75446',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'x-wing-starfighter-75355',
        }),
      }),
    );

    expect(html).toContain('data-testid="similar-slot"');
    expect(html).toContain('data-testid="recently-slot"');
    expect(html.indexOf('data-testid="similar-slot"')).toBeLessThan(
      html.indexOf('data-testid="recently-slot"'),
    );

    const railHtml = renderToStaticMarkup(
      await pageModule.loadSetDetailSimilarSetsRail({
        catalogSetDetail: {
          id: '75355',
          imageUrl: 'https://cdn.example.com/75355.jpg',
          name: 'X-wing Starfighter',
          pieces: 1949,
          publicTheme: {
            accentColor: '#123456',
            name: 'Star Wars',
            slug: 'star-wars',
            surfaceColor: '#112244',
            surfaceTextColor: '#ffffff',
          },
          releaseYear: 2023,
          slug: 'x-wing-starfighter-75355',
          theme: 'Star Wars',
        },
        signal: new AbortController().signal,
        slug: 'x-wing-starfighter-75355',
      }),
    );

    expect(railHtml).toContain('Meer uit dit thema');
    expect(railHtml).not.toContain('Vergelijkbare LEGO sets');
    expect(railHtml).toContain('Grogu with Hover Pram');
    expect(railHtml).toContain(
      'href="/sets/grogu-mandalorian-apprentice-75446"',
    );
    expect(railHtml).toContain('Verder ontdekken');
    expect(railHtml).toContain('href="/nieuwe-lego-sets"');
    expect(railHtml).toContain('href="/themes/star-wars"');
    expect(railHtml).toContain('href="/lego-voor-volwassenen"');
    expect(railHtml).toContain('data-surface-variant="themed"');
    expect(railHtml).toContain('--article-theme-surface:#112244');
    expect(railHtml).toContain('--article-theme-surface-text:#ffffff');
    expect(setPageMocks.listCatalogSimilarSetCards).toHaveBeenCalled();
  });

  it('selects one same-theme internal-link rail without duplicate set links', async () => {
    const pageModule = await import('./page');
    const blocks = pageModule.buildSetDetailInternalLinkBlocks({
      candidateSetCards: [
        {
          id: 'current',
          name: 'Current Set',
          pieces: 1000,
          releaseYear: 2024,
          slug: 'current-set',
          theme: 'Star Wars',
        },
        {
          id: 'theme-1',
          name: 'TIE Fighter',
          pieces: 432,
          releaseYear: 2026,
          slug: 'tie-fighter',
          theme: 'Star Wars',
        },
        {
          id: 'shared',
          name: 'Shared Candidate',
          pieces: 600,
          releaseYear: 2025,
          slug: 'shared-candidate',
          theme: 'Star Wars',
        },
      ],
      currentSetCard: {
        id: 'current',
        name: 'Current Set',
        pieces: 1000,
        releaseYear: 2024,
        theme: 'Star Wars',
      },
    });
    const linkedSetIds = blocks.flatMap((block) =>
      block.items.map((item) => item.id),
    );

    expect(blocks.map((block) => block.id)).toEqual(['same-theme']);
    expect(linkedSetIds).not.toContain('current');
    expect(new Set(linkedSetIds).size).toBe(linkedSetIds.length);
    expect(blocks.find((block) => block.id === 'same-theme')?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'shared' })]),
    );
  });

  it('builds relevant collection discovery links for set detail pages', async () => {
    const pageModule = await import('./page');
    const links = pageModule.buildSetDetailCollectionDiscoveryLinks({
      bestPriceMinor: 4_999,
      catalogSetDetail: {
        id: '75439',
        imageUrl: 'https://cdn.example.com/75439.jpg',
        name: 'Darth Vader Bust',
        pieces: 349,
        publicTheme: {
          name: 'Star Wars',
          slug: 'star-wars',
        },
        recommendedAge: 18,
        releaseYear: 2026,
        setStatus: 'retiring_soon',
        slug: 'darth-vader-bust-75439',
        theme: 'Star Wars',
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      '/nieuwe-lego-sets',
      '/lego-sets-onder-50-euro',
      '/lego-sets-onder-100-euro',
      '/themes/star-wars',
      '/lego-voor-volwassenen',
      '/retiring-lego-sets',
    ]);
  });
});

describe('set detail live offer loading', () => {
  it('tags live offer reads with price and set cache tags', async () => {
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);

    const { loadSetDetailLiveOffers } = await import('./page');

    await loadSetDetailLiveOffers({ setId: '75419' });

    expect(setPageMocks.listCatalogSetLiveOffersBySetId).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: 21_600,
        tags: ['prices', 'set:75419'],
      },
      setId: '75419',
    });
  });
});

describe('set detail availability fallback state', () => {
  it('treats a current-year set with no current tracked offers as no_current_price', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 2,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2026,
      }),
    ).toBe('no_current_price');
  });

  it('treats a recent exact release with unavailable tracked offers as no_current_price', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 1,
          validPrimaryOfferCount: 0,
        },
        releaseDate: '2026-05-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
      }),
    ).toBe('no_current_price');
  });

  it('treats an older set with no current tracked offers as no_current_stock unless retired is explicit', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 2,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2024,
      }),
    ).toBe('no_current_stock');
  });

  it('shows retired only when an explicit retired lifecycle signal exists', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 0,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2021,
        setStatus: 'retired',
      }),
    ).toBe('retired');
  });
});

describe('SetNewsRail', () => {
  it('renders latest update cards for matching set articles', async () => {
    const { SetNewsRail } = await import('./page');
    const html = renderToStaticMarkup(
      createElement(SetNewsRail, {
        articles: [
          {
            cardImageAlt: 'Alt',
            date: '2026-05-04',
            description: 'Nieuwe details over deze set.',
            heroImageAlt: 'Alt',
            primarySetNumber: '75459',
            slug: 'imperial-lambda-class-shuttle',
            status: 'published',
            theme: 'Star Wars',
            title: 'Imperial Lambda-Class Shuttle nu te pre-orderen',
          },
        ],
      }),
    );

    expect(html).toContain('Laatste updates');
    expect(html).not.toContain('Nieuws over deze set');
    expect(html).toContain('Imperial Lambda-Class Shuttle nu te pre-orderen');
    expect(html).toContain('Nieuwe details over deze set.');
    expect(html).toContain(
      '/artikelen/star-wars/imperial-lambda-class-shuttle',
    );
  });

  it('hides the rail when there are no matching articles', async () => {
    const { SetNewsRail } = await import('./page');

    expect(
      renderToStaticMarkup(createElement(SetNewsRail, { articles: [] })),
    ).toBe('');
  });
});

describe('set detail metadata', () => {
  const baseSet = {
    id: '75459',
    slug: 'imperial-lambda-class-shuttle-75459',
    name: 'Imperial Lambda-Class Shuttle',
    theme: 'Star Wars',
    releaseYear: 2026,
    releaseDate: '2026-07-01',
    releaseDatePrecision: 'day' as const,
    pieces: 1234,
    imageUrl: 'https://cdn.example.com/75459.jpg',
  };

  it('builds price-aware Open Graph metadata for a set with a current offer', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: baseSet,
      currentOfferSummary: {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-05-05T08:00:00.000Z',
          currency: 'EUR',
          merchantName: 'Coolblue',
          merchantSlug: 'coolblue',
          priceCents: 10395,
          url: 'https://partner.example/75459',
        },
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T08:00:00.000Z',
            currency: 'EUR',
            merchantName: 'Coolblue',
            merchantSlug: 'coolblue',
            priceCents: 10395,
            url: 'https://partner.example/75459',
          },
        ],
        setId: '75459',
      },
    });

    expect(metadata.title).toBe('Imperial Lambda-Class Shuttle. Nu € 103,95');
    expect(metadata.description).toBe(
      'Laagste nagekeken prijs bij Coolblue: € 103,95.',
    );
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
    expect(metadata.robots).toEqual({
      follow: false,
      googleBot: {
        follow: false,
        index: false,
      },
      index: false,
    });
    expect(JSON.stringify(metadata.robots)).not.toContain('noimageindex');
    expect(metadata.twitter?.title).toBe(metadata.title);
    expect(metadata.twitter?.description).toBe(metadata.description);
  });

  it('allows set detail metadata to index when launch indexing is enabled', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      allowIndexing: true,
      catalogSetDetail: baseSet,
    });

    expect(metadata.robots).toEqual({
      follow: true,
      googleBot: {
        follow: true,
        index: true,
      },
      index: true,
    });
    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
  });

  it('includes reliable discount and price-spread benefit copy when available', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        name: 'Scuderia Ferrari HP Helmet',
      },
      currentOfferSummary: {
        bestOffer: {
          availability: 'in_stock',
          checkedAt: '2026-05-05T08:00:00.000Z',
          currency: 'EUR',
          merchantName: 'MediaMarkt',
          merchantSlug: 'mediamarkt',
          priceCents: 6895,
          url: 'https://partner.example/43014-a',
        },
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T08:00:00.000Z',
            currency: 'EUR',
            merchantName: 'MediaMarkt',
            merchantSlug: 'mediamarkt',
            priceCents: 6895,
            url: 'https://partner.example/43014-a',
          },
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T08:00:00.000Z',
            currency: 'EUR',
            merchantName: 'Alternate',
            merchantSlug: 'alternate',
            priceCents: 8385,
            url: 'https://partner.example/43014-b',
          },
        ],
        setId: '43014',
      },
      pricePanelSnapshot: {
        condition: 'new',
        currencyCode: 'EUR',
        deltaMinor: -2104,
        headlinePriceMinor: 6895,
        lowestMerchantId: 'mediamarkt',
        lowestMerchantName: 'MediaMarkt',
        merchantCount: 2,
        observedAt: '2026-05-05T08:00:00.000Z',
        referencePriceMinor: 8999,
        regionCode: 'NL',
        setId: '43014',
      },
    });

    expect(metadata.title).toBe(
      'Scuderia Ferrari HP Helmet. Nu € 68,95. 23% korting',
    );
    expect(metadata.description).toBe(
      'Laagste nagekeken prijs bij MediaMarkt. € 14,90 goedkoper dan de rest.',
    );
  });

  it('uses clean fallback metadata when no price is available', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        imageUrl: undefined,
        name: 'Lucky Bamboo',
        pieces: 325,
        primaryImage: undefined,
        theme: 'Botanicals',
      },
    });

    expect(metadata.title).toBe('Lucky Bamboo');
    expect(metadata.description).toBe(
      'LEGO Botanicals-set uit 2026 met 325 stenen. Prijs volgt nog; volg deze set zodra er een koopmoment is.',
    );
    expect(JSON.stringify(metadata)).not.toContain('undefined');
    expect(JSON.stringify(metadata)).not.toContain('null');
  });

  it('uses an absolute primary set image for OG and Twitter previews', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        imageUrl: '/images/fallback.jpg',
        images: [
          {
            type: 'hero',
            url: '/images/hero.jpg',
          },
        ],
        primaryImage: 'https://cdn.example.com/primary.jpg',
      },
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/primary.jpg',
        secureUrl: 'https://cdn.example.com/primary.jpg',
        alt: 'Imperial Lambda-Class Shuttle setbeeld',
        height: 1200,
        type: 'image/jpeg',
        width: 1200,
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      {
        url: 'https://cdn.example.com/primary.jpg',
        secureUrl: 'https://cdn.example.com/primary.jpg',
        alt: 'Imperial Lambda-Class Shuttle setbeeld',
        height: 1200,
        type: 'image/jpeg',
        width: 1200,
      },
    ]);
  });

  it('prefers share-compatible jpg or png set images over webp-only candidates', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        imageUrl: 'https://cdn.example.com/fallback.webp',
        images: [
          {
            type: 'hero',
            url: 'https://cdn.example.com/hero.png',
          },
        ],
        primaryImage: 'https://cdn.example.com/primary.webp',
      },
    });

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/hero.png',
        secureUrl: 'https://cdn.example.com/hero.png',
        type: 'image/png',
        width: 1200,
        height: 1200,
      }),
    ]);
  });

  it('normalizes metadata image URLs to absolute https URLs', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        imageUrl: 'http://cdn.example.com/75459.jpg',
      },
    });

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/75459.jpg',
        secureUrl: 'https://cdn.example.com/75459.jpg',
      }),
    ]);
  });

  it('can check whether the resolved OG image responds publicly', async () => {
    const { resolveSetDetailOgImageDebugInfo } = await import('./page');
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
    }));

    await expect(
      resolveSetDetailOgImageDebugInfo({
        fetchFn: fetchFn as unknown as typeof fetch,
        imageUrl: 'https://cdn.example.com/75459.jpg',
      }),
    ).resolves.toEqual({
      imageUrl: 'https://cdn.example.com/75459.jpg',
      ok: true,
      status: 200,
    });
    expect(fetchFn).toHaveBeenCalledWith('https://cdn.example.com/75459.jpg', {
      method: 'HEAD',
      cache: 'no-store',
    });
  });
});

describe('set detail page JSON-LD', () => {
  it('renders Product and BreadcrumbList structured data', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '10316',
      imageUrl: 'https://cdn.example.com/10316.jpg',
      name: 'The Lord of the Rings: Rivendell',
      pieces: 6167,
      publicTheme: {
        name: 'Lord of the Rings',
        slug: 'lord-of-the-rings',
      },
      releaseYear: 2023,
      slug: 'lord-of-the-rings-rivendell-10316',
      theme: 'Lord of the Rings',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([
      {
        availability: 'in_stock',
        checkedAt: '2026-05-05T10:00:00.000Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'bol',
        merchantName: 'bol',
        priceCents: 39999,
        setId: '10316',
        url: 'https://partner.example/10316',
      },
    ]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 1,
        validPrimaryOfferCount: 1,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'bol',
            merchantName: 'bol',
            priceCents: 39999,
            url: 'https://partner.example/10316',
          },
        ],
        setId: '10316',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'lord-of-the-rings-rivendell-10316',
        }),
      }),
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"offers":{"@type":"Offer"');
    expect(html).toContain('"price":399.99');
    expect(html).toContain('"priceCurrency":"EUR"');
    expect(html).toContain('"availability":"https://schema.org/InStock"');
    expect(html).toContain('"seller":{"@type":"Organization","name":"bol"}');
    expect(html).toContain(
      'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
    );
    expect(
      setPageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: 21_600,
        tags: ['prices', 'set:10316'],
      },
      setIds: ['10316'],
    });
    expect(
      setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId,
    ).not.toHaveBeenCalled();
  });

  it('renders Rakuten LEGO offers with the public LEGO registered display name', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '10300',
      imageUrl: 'https://cdn.example.com/10300.jpg',
      name: 'Back to the Future Time Machine',
      pieces: 1872,
      releaseYear: 2022,
      slug: 'back-to-the-future-time-machine-10300',
      theme: 'Icons',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([
      {
        availability: 'in_stock',
        checkedAt: '2026-05-25T10:00:00.000Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'lego',
        merchantName: 'LEGO EU',
        merchantSlug: 'rakuten-lego-eu',
        priceCents: 19999,
        setId: '10300',
        url: 'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Fback-to-the-future-time-machine-10300',
      },
    ]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 1,
        validPrimaryOfferCount: 1,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-25T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'lego',
            merchantName: 'LEGO EU',
            merchantSlug: 'rakuten-lego-eu',
            priceCents: 19999,
            url: 'https://click.linksynergy.com/link?id=test&murl=https%3A%2F%2Fwww.lego.com%2Fnl-nl%2Fproduct%2Fback-to-the-future-time-machine-10300',
          },
        ],
        setId: '10300',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'back-to-the-future-time-machine-10300',
        }),
      }),
    );

    expect(html).toContain('Bekijk deal bij LEGO®');
    expect(html).toContain('Bekijk bij LEGO®');
    expect(html).toContain('"seller":{"@type":"Organization","name":"LEGO®"}');
    expect(html).not.toContain('LEGO EU');
  });

  it('uses the current discovery reference delta for the set-detail deal verdict', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '42177',
      imageUrl: 'https://cdn.example.com/42177.jpg',
      name: 'Mercedes-Benz G 500 Professional Line',
      pieces: 2891,
      releaseYear: 2024,
      slug: 'mercedes-benz-g-500-professional-line-42177',
      theme: 'Technic',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([
      {
        availability: 'in_stock',
        checkedAt: '2026-05-05T10:00:00.000Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'other',
        merchantName: 'Wehkamp',
        priceCents: 19999,
        setId: '42177',
        url: 'https://partner.example/42177',
      },
      {
        availability: 'in_stock',
        checkedAt: '2026-05-05T10:00:00.000Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'lego',
        merchantName: 'LEGO',
        priceCents: 24999,
        setId: '42177',
        url: 'https://partner.example/42177-lego',
      },
    ]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map([
        [
          '42177',
          {
            bestPriceMinor: 19999,
            merchantCount: 2,
            observedAt: '2026-05-05T10:00:00.000Z',
            priceSpreadMinor: 5000,
            referenceDeltaMinor: -5000,
          },
        ],
      ]),
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'Wehkamp',
            priceCents: 19999,
            url: 'https://partner.example/42177',
          },
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'lego',
            merchantName: 'LEGO',
            priceCents: 24999,
            url: 'https://partner.example/42177-lego',
          },
        ],
        setId: '42177',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'mercedes-benz-g-500-professional-line-42177',
        }),
      }),
    );

    expect(html).toContain('data-testid="best-deal"');
    expect(html).toContain('data-tone="positive"');
    expect(html).toContain('Goede deal');
    expect(html).toContain('€ 50,00 goedkoper dan de rest');
  });

  it('omits Product structured data when no valid offer is available', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '76439',
      imageUrl: 'https://cdn.example.com/76439.jpg',
      name: "Ollivanders & Madam Malkin's Robes",
      pieces: 744,
      releaseYear: 2026,
      slug: 'ollivanders-and-madam-malkins-robes-76439',
      theme: 'Harry Potter',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockRejectedValue(
      new Error('Unable to load live catalog offers.'),
    );
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockRejectedValue(
      new Error('Unable to load primary catalog merchant availability.'),
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'ollivanders-and-madam-malkins-robes-76439',
        }),
      }),
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain('"@type":"Product"');
    expect(html).not.toContain('"@type":"Offer"');
    expect(html).not.toContain('"@type":"AggregateOffer"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain(
      'https://www.brickhunt.nl/sets/ollivanders-and-madam-malkins-robes-76439',
    );
  });

  it('renders crawlable critical theme links without blocking on optional rails', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '75355',
      imageUrl: 'https://cdn.example.com/75355.jpg',
      name: 'X-wing Starfighter',
      pieces: 1949,
      publicTheme: {
        name: 'Star Wars',
        slug: 'star-wars',
      },
      releaseYear: 2023,
      slug: 'x-wing-starfighter-75355',
      theme: 'Star Wars',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([
      {
        id: '75446',
        imageUrl: 'https://cdn.example.com/75446.jpg',
        name: 'Grogu with Hover Pram',
        pieces: 1048,
        releaseYear: 2026,
        slug: 'grogu-mandalorian-apprentice-75446',
        theme: 'Star Wars',
      },
    ]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([
      {
        cardImageAlt: 'X-wing',
        date: '2026-05-04',
        description: 'Waarom deze X-wing telt.',
        heroImageAlt: 'X-wing',
        primarySetNumber: '75355',
        slug: 'x-wing-starfighter-review',
        status: 'published',
        theme: 'Star Wars',
        title: 'X-wing Starfighter blijft sterk',
      },
    ]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'x-wing-starfighter-75355',
        }),
      }),
    );

    expect(html).toContain('href="/themes"');
    expect(html).toContain('href="/themes/star-wars"');
    expect(html).not.toContain('href="/deals"');
    expect(html).toContain('data-testid="similar-slot"');
    expect(html).toContain('data-testid="recently-slot"');
    expect(html.indexOf('data-testid="similar-slot"')).toBeLessThan(
      html.indexOf('data-testid="recently-slot"'),
    );
    expect(
      setPageMocks.listPublishedArticlesByPrimarySetNumber,
    ).toHaveBeenCalledWith({
      limit: 4,
      setNumber: '75355',
    });
  });

  it('streams a real comparable rail above recently viewed for a Darth Vader-style set page', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '75439',
      imageUrl: 'https://cdn.example.com/75439.jpg',
      name: 'Darth Vader Bust',
      pieces: 349,
      publicTheme: {
        name: 'Star Wars',
        slug: 'star-wars',
        surfaceColor: '#171717',
        surfaceTextColor: '#ffffff',
      },
      releaseYear: 2026,
      slug: 'darth-vader-bust-75439',
      theme: 'Star Wars',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([
      {
        id: '75461',
        imageUrl: 'https://cdn.example.com/75461.jpg',
        name: 'Up-Scaled Darth Vader Minifigure',
        pieces: 0,
        releaseYear: 2026,
        slug: 'up-scaled-darth-vader-minifigure-75461',
        theme: 'Star Wars',
      },
      {
        id: '75280',
        imageUrl: 'https://cdn.example.com/75280.jpg',
        name: '501st Legion Clone Troopers',
        pieces: 285,
        releaseYear: 2020,
        slug: '501st-legion-clone-troopers-75280',
        theme: 'Star Wars',
      },
    ]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = await renderToStreamedMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'darth-vader-bust-75439',
        }),
      }),
    );

    expect(html).toContain('Meer uit dit thema');
    expect(html).not.toContain('Vergelijkbare LEGO sets');
    expect(html).toContain('Up-Scaled Darth Vader Minifigure');
    expect(html).toContain(
      'href="/sets/up-scaled-darth-vader-minifigure-75461"',
    );
    expect(html).toContain('href="/nieuwe-lego-sets"');
    expect(html).toContain('href="/themes/star-wars"');
    expect(html).toContain('Recent bekeken LEGO sets');
    expect(html.indexOf('Meer uit dit thema')).toBeLessThan(
      html.indexOf('Recent bekeken LEGO sets'),
    );
  });

  it('keeps optional similar and article rail slots from blocking the initial render', async () => {
    let similarRailAbortSignal: AbortSignal | undefined;

    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '75355',
      imageUrl: 'https://cdn.example.com/75355.jpg',
      name: 'X-wing Starfighter',
      pieces: 1949,
      publicTheme: {
        name: 'Star Wars',
        slug: 'star-wars',
      },
      releaseYear: 2023,
      slug: 'x-wing-starfighter-75355',
      theme: 'Star Wars',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockImplementation(({ signal }) => {
      similarRailAbortSignal = signal;

      return new Promise(() => undefined);
    });
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockImplementation(
      () => new Promise(() => undefined),
    );

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'x-wing-starfighter-75355',
        }),
      }),
    );

    expect(html).toContain('data-testid="set-detail"');
    expect(html).toContain('href="/themes/star-wars"');
    expect(html).not.toContain('href="/deals"');

    expect(similarRailAbortSignal?.aborted).toBe(false);
  });

  it('links set breadcrumbs to a public curated parent theme when available', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '43020',
      imageUrl: 'https://cdn.example.com/43020.jpg',
      name: 'Nike Dunk x LEGO',
      pieces: 1180,
      publicTheme: {
        name: 'LEGO® Editions',
        slug: 'editions',
      },
      releaseYear: 2026,
      slug: 'nike-dunk-x-lego-43020',
      subtheme: 'Nike x LEGO® collectie',
      theme: 'LEGO® Editions',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'nike-dunk-x-lego-43020',
        }),
      }),
    );

    expect(html).toContain('href="/themes"');
    expect(html).toContain('href="/themes/editions"');
    expect(html).not.toContain('href="/themes/other"');
    expect(html).not.toContain('href="/themes/nike-x-lego-collectie"');
  });

  it('does not link hidden set themes from breadcrumbs', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '99999',
      imageUrl: 'https://cdn.example.com/99999.jpg',
      name: 'Internal test set',
      pieces: 100,
      releaseYear: 2026,
      slug: 'internal-test-set-99999',
      theme: 'Other',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogSimilarSetCards.mockResolvedValue([]);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'internal-test-set-99999',
        }),
      }),
    );

    expect(html).toContain('href="/themes"');
    expect(html).not.toContain('href="/themes/other"');
  });
});
