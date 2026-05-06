import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const setPageMocks = vi.hoisted(() => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId: vi.fn(),
  getCatalogSetBySlug: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetLiveOffersBySetId: vi.fn(),
  listCatalogSetSlugs: vi.fn(),
  listCatalogSimilarSetCards: vi.fn(),
  listPublishedArticlesByPrimarySetNumber: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId:
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId,
  getCatalogSetBySlug: setPageMocks.getCatalogSetBySlug,
  listCatalogCurrentOfferSummariesBySetIds:
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    setPageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetLiveOffersBySetId: setPageMocks.listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs: setPageMocks.listCatalogSetSlugs,
  listCatalogSimilarSetCards: setPageMocks.listCatalogSimilarSetCards,
}));

vi.mock('@lego-platform/catalog/feature-set-detail', () => ({
  CatalogFeatureSetDetail: ({
    dealsHref,
    setNewsRail,
    similarSetsRail,
    themeDirectoryHref,
    themeHref,
  }: {
    dealsHref?: string;
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
      dealsHref ? createElement('a', { href: dealsHref }, 'Deals') : null,
      similarSetsRail,
      setNewsRail,
    ),
}));

vi.mock('@lego-platform/catalog/feature-set-list', () => ({
  CatalogFeatureSetList: ({
    setCards,
  }: {
    setCards: readonly { slug: string; name: string }[];
  }) =>
    createElement(
      'div',
      { 'data-testid': 'set-list' },
      ...setCards.map((setCard) =>
        createElement(
          'a',
          { href: `/sets/${setCard.slug}`, key: setCard.slug },
          setCard.name,
        ),
      ),
    ),
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
      new Map(),
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
    expect(html).toContain(
      'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
    );
  });

  it('renders without offer schema when merchant availability fails', async () => {
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
    expect(html).toContain('"@type":"Product"');
    expect(html).not.toContain('"@type":"Offer"');
    expect(html).not.toContain('"@type":"AggregateOffer"');
    expect(html).toContain(
      'https://www.brickhunt.nl/sets/ollivanders-and-madam-malkins-robes-76439',
    );
  });

  it('renders crawlable theme, related set, related article, and deals links', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '75355',
      imageUrl: 'https://cdn.example.com/75355.jpg',
      name: 'X-wing Starfighter',
      pieces: 1949,
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
    expect(html).toContain('href="/sets/grogu-mandalorian-apprentice-75446"');
    expect(html).toContain(
      'href="/artikelen/star-wars/x-wing-starfighter-review"',
    );
    expect(html).toContain('href="/deals"');
  });
});
