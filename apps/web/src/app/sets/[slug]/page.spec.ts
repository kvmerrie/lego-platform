import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReadableStream } from 'react-dom/server.browser';

const setPageMocks = vi.hoisted(() => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId: vi.fn(),
  getCatalogSetDetailRelatedThemeSnapshot: vi.fn(),
  getCatalogSetBySlug: vi.fn(),
  listCatalogCurrentOfferCandidateSetIds: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCards: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listCatalogSetLiveOffersBySetId: vi.fn(),
  listCatalogSetSlugs: vi.fn(),
  listPublishedArticlesByPrimarySetNumber: vi.fn(),
  getCatalogSetReviewsPublicPayload: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: setPageMocks.unstableCache,
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogPrimaryOfferAvailabilityStateBySetId:
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId,
  getCatalogSetDetailRelatedThemeSnapshot:
    setPageMocks.getCatalogSetDetailRelatedThemeSnapshot,
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
}));

vi.mock('@lego-platform/catalog/feature-set-detail', () => ({
  CatalogFeatureSetDetail: ({
    bestDeal,
    catalogSetDetail,
    offerList,
    recentlyViewedRail,
    productReviewsSlot,
    setNewsRail,
    similarSetsRail,
    themeDirectoryHref,
    themeHref,
  }: {
    bestDeal?: {
      ctaLabel?: string;
      ctaTone?: string;
      decisionLabel?: string;
      decisionTone?: string;
      merchantLabel?: string;
      rankingLabel?: string;
    };
    catalogSetDetail?: {
      displayTitle?: string;
      imageUrl?: string;
      images?: readonly {
        thumbnailUrl?: string;
        type?: string;
        url: string;
      }[];
      legoProductDescription?: string;
      legoProductFeatures?: readonly {
        body: string;
        title?: string;
      }[];
      name: string;
    };
    offerList?: readonly {
      ctaLabel?: string;
      isBest?: boolean;
      merchantLabel?: string;
      rankingLabel?: string;
    }[];
    recentlyViewedRail?: unknown;
    productReviewsSlot?: unknown;
    setNewsRail?: unknown;
    similarSetsRail?: unknown;
    themeDirectoryHref?: string;
    themeHref?: string;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'set-detail' },
      catalogSetDetail
        ? createElement(
            'h1',
            {},
            catalogSetDetail.displayTitle ?? catalogSetDetail.name,
          )
        : null,
      ...(catalogSetDetail?.images ?? []).map((image, index) =>
        createElement('img', {
          alt: `${catalogSetDetail.name} ${index + 1}`,
          'data-thumbnail-src': image.thumbnailUrl,
          'data-type': image.type,
          key: image.url,
          src: image.url,
        }),
      ),
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
            bestDeal.ctaTone,
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
                {
                  'data-is-best': offer.isBest ? 'true' : 'false',
                  'data-merchant': offer.merchantLabel,
                  key: index,
                },
                offer.ctaLabel,
                offer.merchantLabel,
                offer.rankingLabel,
              ),
            ),
          )
        : null,
      catalogSetDetail?.legoProductDescription
        ? createElement(
            'details',
            {},
            createElement('summary', {}, 'Productgegevens'),
            catalogSetDetail.legoProductDescription,
          )
        : null,
      productReviewsSlot,
      catalogSetDetail?.legoProductFeatures?.length
        ? createElement(
            'details',
            {},
            createElement('summary', {}, 'Productkenmerken'),
            ...catalogSetDetail.legoProductFeatures.map((feature, index) =>
              createElement('p', { key: index }, feature.title, feature.body),
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
    headingActionLabel,
    headingHref,
    railLayoutMode,
    setCards,
    style,
    surfaceVariant,
    title,
  }: {
    className?: string;
    headingActionLabel?: string;
    headingHref?: string;
    railLayoutMode?: string;
    setCards: readonly { slug: string; name: string }[];
    style?: Record<string, string>;
    surfaceVariant?: string;
    title?: string;
  }) =>
    createElement(
      'section',
      {
        className,
        'data-rail-layout-mode': railLayoutMode,
        'data-surface-variant': surfaceVariant,
        'data-testid': 'set-list',
        style,
      },
      title
        ? createElement(
            'h2',
            null,
            headingHref
              ? createElement(
                  'a',
                  { 'aria-label': headingActionLabel, href: headingHref },
                  title,
                )
              : title,
          )
        : null,
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

vi.mock('@lego-platform/reviews/data-access-web', () => ({
  getCatalogSetReviewsPublicPayload:
    setPageMocks.getCatalogSetReviewsPublicPayload,
}));

vi.mock('@lego-platform/reviews/feature-set-reviews', () => ({
  ReviewsFeatureSetReviews: () =>
    createElement('section', {}, 'Productbeoordelingen'),
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
  delete process.env['BRICKSET_GALLERY_RENDER_MODE'];
  delete process.env['SET_DETAIL_STATIC_PARAMS_LIMIT'];
  delete process.env['SKIP_SET_DETAIL_SSG_OPTIONAL_RAILS'];
  setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
    new Map(),
  );
  setPageMocks.getCatalogSetDetailRelatedThemeSnapshot.mockResolvedValue(
    undefined,
  );
  setPageMocks.getCatalogSetReviewsPublicPayload.mockResolvedValue({
    reviews: [],
    summary: {
      averageRating: undefined,
      ratingDistribution: {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      },
      recommendCount: 0,
      reviewCount: 0,
      setId: 'unknown',
    },
  });
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
    setPageMocks.getCatalogSetDetailRelatedThemeSnapshot.mockResolvedValue({
      setCards: [
        {
          id: '75446',
          imageUrl: 'https://cdn.example.com/75446.jpg',
          name: 'Grogu with Hover Pram',
          pieces: 1048,
          priceContext: {
            coverageLabel: 'Actuele prijs gevonden',
            currentPrice: 'Vanaf € 99,99',
            merchantLabel: 'Laagst bij Goodbricks',
            reviewedLabel: 'Nagekeken 5 mei',
          },
          releaseYear: 2026,
          slug: 'grogu-mandalorian-apprentice-75446',
          theme: 'Star Wars',
        },
      ],
      totalSetCount: 1,
    });
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2099-05-05T10:00:00.000Z',
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
    expect(railHtml).toContain('data-rail-layout-mode="default"');
    expect(railHtml).toContain('Verder ontdekken');
    expect(railHtml).toContain('href="/nieuwe-lego-sets"');
    expect(railHtml).toContain('aria-label="Bekijk alle Star Wars-sets"');
    expect(railHtml).toContain('href="/themes/star-wars"');
    expect(railHtml).toContain('href="/lego-voor-volwassenen"');
    expect(railHtml).toContain('data-surface-variant="themed"');
    expect(railHtml).toContain('--article-theme-surface:#112244');
    expect(railHtml).toContain('--article-theme-surface-text:#ffffff');
    expect(
      setPageMocks.getCatalogSetDetailRelatedThemeSnapshot,
    ).toHaveBeenCalledWith({
      setId: '75355',
    });
  });

  it('only builds related theme heading links for valid theme paths', async () => {
    const pageModule = await import('./page');

    expect(
      pageModule.getSetDetailThemeHref({
        publicTheme: { slug: '../star-wars' },
        theme: 'Star Wars',
      }),
    ).toBe('/themes/star-wars');
    expect(
      pageModule.getSetDetailThemeHref({
        publicTheme: { slug: '../star-wars' },
        theme: '////',
      }),
    ).toBeUndefined();
  });

  it('keys set detail cache by Brickset gallery render mode', async () => {
    process.env['BRICKSET_GALLERY_RENDER_MODE'] = 'attribution_required';
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '10307',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10307-1/112417.jpg',
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://cdn.rebrickable.com/media/sets/10307-1/112417.jpg',
        },
        {
          attributionText: 'Image(s) courtesy of Brickset.com',
          order: 100,
          type: 'detail',
          url: 'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_alt1.jpg',
        },
      ],
      name: 'Eiffeltoren',
      pieces: 10001,
      publicTheme: {
        accentColor: '#123456',
        name: 'Icons',
        slug: 'icons',
        surfaceColor: '#112244',
      },
      releaseYear: 2022,
      slug: 'eiffel-tower-10307',
      theme: 'Icons',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 0,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'eiffel-tower-10307',
        }),
      }),
    );

    expect(setPageMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      [
        'catalog-set-detail',
        expect.any(String),
        'eiffel-tower-10307',
        'attribution_required',
      ],
      expect.objectContaining({
        tags: ['sets', 'set:10307', 'set:eiffel-tower-10307'],
      }),
    );
  });

  it('renders Brickhunt-owned set images as path-only UI sources', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '10309',
      imageUrl: '/images/sets/10309/hero.webp',
      images: [
        {
          order: 0,
          thumbnailUrl: '/images/sets/10309/thumbs/0.webp',
          type: 'hero',
          url: '/images/sets/10309/hero.webp',
        },
        {
          order: 201,
          thumbnailUrl: '/images/sets/10309/thumbs/3.webp',
          type: 'detail',
          url: '/images/sets/10309/gallery/3.webp',
        },
      ],
      name: 'Succulents',
      pieces: 771,
      primaryImage: '/images/sets/10309/hero.webp',
      publicTheme: {
        name: 'Botanicals',
        slug: 'botanicals',
      },
      releaseYear: 2022,
      slug: 'succulents-10309',
      theme: 'Botanicals',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 0,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'succulents-10309',
        }),
      }),
    );

    expect(html).toContain('src="/images/sets/10309/hero.webp"');
    expect(html).toContain('src="/images/sets/10309/gallery/3.webp"');
    expect(html).toContain(
      'data-thumbnail-src="/images/sets/10309/thumbs/3.webp"',
    );
    expect(html).not.toContain('https://www.brickhunt.nl/images/sets/');
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
      '/laatste-kans-lego-sets',
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

  it('generates price-aware metadata from snapshot summaries without loading live offers', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue(baseSet);
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T08:00:00.000Z',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'Coolblue',
            merchantSlug: 'coolblue',
            priceCents: 10395,
            url: 'https://partner.example/75459',
          },
        ],
        setId: '75459',
      }),
    );

    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({
        slug: 'imperial-lambda-class-shuttle-75459',
      }),
    });

    expect(metadata.title).toBe('Imperial Lambda-Class Shuttle. Nu € 103,95');
    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/sets/imperial-lambda-class-shuttle-75459',
    );
    expect(setPageMocks.listCatalogSetLiveOffersBySetId).not.toHaveBeenCalled();
    expect(
      setPageMocks.listCatalogCurrentOfferSummariesBySetIds,
    ).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: 21_600,
        tags: ['prices', 'set:75459'],
      },
      liveFallbackSetIdLimit: 0,
      setIds: ['75459'],
    });
  });

  it('shares the set detail cache key between metadata and page rendering where the cache is observable', async () => {
    const cachedValues = new Map<string, unknown>();

    setPageMocks.unstableCache.mockImplementation((callback, keyParts) => {
      return () => {
        const cacheKey = JSON.stringify(keyParts);

        if (!cachedValues.has(cacheKey)) {
          cachedValues.set(cacheKey, callback());
        }

        return cachedValues.get(cacheKey);
      };
    });
    setPageMocks.getCatalogSetBySlug.mockResolvedValue(baseSet);
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([]);
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 1,
        primarySeedCount: 0,
        validPrimaryOfferCount: 0,
      },
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');

    await pageModule.generateMetadata({
      params: Promise.resolve({
        slug: 'imperial-lambda-class-shuttle-75459',
      }),
    });
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'imperial-lambda-class-shuttle-75459',
        }),
      }),
    );

    expect(setPageMocks.getCatalogSetBySlug).toHaveBeenCalledTimes(1);
    expect(setPageMocks.getCatalogSetBySlug).toHaveBeenCalledWith({
      slug: 'imperial-lambda-class-shuttle-75459',
    });
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

  it('keeps canonical URLs stable when a LEGO NL display title is used', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const metadata = buildSetDetailMetadata({
      allowIndexing: true,
      catalogSetDetail: {
        ...baseSet,
        catalogName: 'Flower Bouquet',
        displayTitle: 'Bloemenboeket',
        displayTitleSource: 'rakuten-lego-eu',
        id: '10280',
        name: 'Flower Bouquet',
        slug: 'flower-bouquet-10280',
      },
    });

    expect(metadata.title).toBe('Bloemenboeket');
    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/sets/flower-bouquet-10280',
    );
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/sets/flower-bouquet-10280',
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

  it('prefers stored social set images for OG and Twitter previews', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const previousDeployEnvironment = process.env['BRICKHUNT_DEPLOY_ENV'];
    const previousWebBaseUrl = process.env['WEB_BASE_URL'];

    process.env['BRICKHUNT_DEPLOY_ENV'] = 'production';
    process.env['WEB_BASE_URL'] = 'https://www.brickhunt.nl';

    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        images: [
          {
            sha256: 'abcdef1234567890abcdef1234567890',
            type: 'social',
            url: '/images/sets/75459/social.jpg',
          },
          {
            type: 'hero',
            url: '/images/sets/75459/hero.webp',
          },
        ],
        primaryImage: '/images/sets/75459/hero.webp',
      },
    });

    if (previousDeployEnvironment == null) {
      delete process.env['BRICKHUNT_DEPLOY_ENV'];
    } else {
      process.env['BRICKHUNT_DEPLOY_ENV'] = previousDeployEnvironment;
    }
    if (previousWebBaseUrl == null) {
      delete process.env['WEB_BASE_URL'];
    } else {
      process.env['WEB_BASE_URL'] = previousWebBaseUrl;
    }

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://www.brickhunt.nl/images/sets/75459/social.jpg?v=abcdef123456',
        secureUrl:
          'https://www.brickhunt.nl/images/sets/75459/social.jpg?v=abcdef123456',
        type: 'image/jpeg',
        width: 1200,
        height: 1200,
      }),
    ]);
    expect(metadata.twitter?.images).toEqual([
      expect.objectContaining({
        url: 'https://www.brickhunt.nl/images/sets/75459/social.jpg?v=abcdef123456',
      }),
    ]);
  });

  it('keeps stored social metadata images unversioned when sha256 is missing', async () => {
    const { buildSetDetailMetadata } = await import('./page');
    const previousDeployEnvironment = process.env['BRICKHUNT_DEPLOY_ENV'];
    const previousWebBaseUrl = process.env['WEB_BASE_URL'];

    process.env['BRICKHUNT_DEPLOY_ENV'] = 'production';
    process.env['WEB_BASE_URL'] = 'https://www.brickhunt.nl';

    const metadata = buildSetDetailMetadata({
      catalogSetDetail: {
        ...baseSet,
        images: [
          {
            type: 'social',
            url: '/images/sets/75459/social.jpg',
          },
        ],
        primaryImage: '/images/sets/75459/hero.webp',
      },
    });

    if (previousDeployEnvironment == null) {
      delete process.env['BRICKHUNT_DEPLOY_ENV'];
    } else {
      process.env['BRICKHUNT_DEPLOY_ENV'] = previousDeployEnvironment;
    }
    if (previousWebBaseUrl == null) {
      delete process.env['WEB_BASE_URL'];
    } else {
      process.env['WEB_BASE_URL'] = previousWebBaseUrl;
    }

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://www.brickhunt.nl/images/sets/75459/social.jpg',
        secureUrl: 'https://www.brickhunt.nl/images/sets/75459/social.jpg',
      }),
    ]);
    expect(metadata.twitter?.images).toEqual([
      expect.objectContaining({
        url: 'https://www.brickhunt.nl/images/sets/75459/social.jpg',
      }),
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
      catalogName: 'Flower Bouquet',
      displayTitle: 'Bloemenboeket',
      displayTitleSource: 'rakuten-lego-eu',
      id: '10280',
      imageUrl: 'https://cdn.example.com/10280.jpg',
      legoProductDescription: 'Officiële LEGO beschrijving voor dit boeket.',
      legoProductFeatures: [
        {
          body: 'Zet het boeket in een vaas op tafel.',
          title: 'Displayklaar',
        },
        {
          body: 'Bouw rozen, madeliefjes en lavendel.',
          title: 'Bloemenmix',
        },
      ],
      name: 'Flower Bouquet',
      pieces: 756,
      publicTheme: {
        name: 'Icons',
        slug: 'icons',
      },
      releaseYear: 2021,
      slug: 'flower-bouquet-10280',
      theme: 'Icons',
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
        setId: '10280',
        url: 'https://partner.example/10280',
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
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2099-05-05T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'bol',
            merchantName: 'bol',
            priceCents: 39999,
            url: 'https://partner.example/10280',
          },
        ],
        setId: '10280',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'flower-bouquet-10280',
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
    expect(html).toContain('<h1>Bloemenboeket</h1>');
    expect(html).not.toContain('Ook bekend als:');
    expect(html).toContain('Officiële LEGO beschrijving voor dit boeket.');
    expect(html).toContain('Productkenmerken');
    expect(html).toContain('Displayklaar');
    expect(html).toContain('"name":"Bloemenboeket"');
    expect(html).not.toContain(
      '"description":"Officiële LEGO beschrijving voor dit boeket."',
    );
    expect(html).toContain(
      'https://www.brickhunt.nl/sets/flower-bouquet-10280',
    );
    expect(
      setPageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: 21_600,
        tags: ['prices', 'set:10280'],
      },
      setIds: ['10280'],
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
      {
        availability: 'in_stock',
        checkedAt: '2026-05-24T10:00:00.000Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'other',
        merchantName: 'LEGO®',
        merchantSlug: 'lego-eu',
        priceCents: 19999,
        setId: '10300',
        url: 'https://legacy.example/lego/10300',
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
          {
            availability: 'in_stock',
            checkedAt: '2026-05-24T10:00:00.000Z',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'LEGO®',
            merchantSlug: 'lego-eu',
            priceCents: 19999,
            url: 'https://legacy.example/lego/10300',
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
    expect(html.match(/Bekijk bij LEGO®/g) ?? []).toHaveLength(1);
    expect(html).toContain('"seller":{"@type":"Organization","name":"LEGO®"}');
    expect(html).not.toContain('LEGO® LEGO®');
    expect(html).not.toContain('LEGO EU');
    expect(html).not.toContain('https://legacy.example/lego/10300');
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
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      createCurrentOfferSummaryMap({
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            commercialUnitType: 'full_set',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'Wehkamp',
            priceCents: 19999,
            url: 'https://partner.example/42177',
          },
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            commercialUnitType: 'full_set',
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
    expect(html).toContain('Bespaar tot €50');
    expect(html).toContain('€50 onder LEGO prijs');
    expect(html).toContain('accent');
  });

  it('uses the LEGO merchant offer price as hero deal reference when the snapshot reference is missing', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '76454',
      imageUrl: 'https://cdn.example.com/76454.jpg',
      name: 'Hogwarts Castle: The Main Tower',
      pieces: 2135,
      releaseYear: 2025,
      slug: 'hogwarts-castle-the-main-tower-76454',
      theme: 'Harry Potter',
    });
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([
      {
        availability: 'in_stock',
        checkedAt: '2026-06-12T18:06:01.670Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'other',
        merchantName: 'Coolblue',
        merchantSlug: 'coolblue',
        priceCents: 17900,
        setId: '76454',
        url: 'https://partner.example/76454-coolblue',
      },
      {
        availability: 'in_stock',
        checkedAt: '2026-06-12T18:46:06.947Z',
        condition: 'new',
        currency: 'EUR',
        market: 'NL',
        merchant: 'lego',
        merchantName: 'LEGO',
        merchantSlug: 'rakuten-lego-eu',
        priceCents: 24999,
        setId: '76454',
        url: 'https://partner.example/76454-lego',
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
            checkedAt: '2026-06-12T18:06:01.670Z',
            currency: 'EUR',
            merchant: 'other',
            merchantName: 'Coolblue',
            merchantSlug: 'coolblue',
            priceCents: 17900,
            url: 'https://partner.example/76454-coolblue',
          },
          {
            availability: 'in_stock',
            checkedAt: '2026-06-12T18:46:06.947Z',
            currency: 'EUR',
            merchant: 'lego',
            merchantName: 'LEGO',
            merchantSlug: 'rakuten-lego-eu',
            priceCents: 24999,
            url: 'https://partner.example/76454-lego',
          },
        ],
        setId: '76454',
      }),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'hogwarts-castle-the-main-tower-76454',
        }),
      }),
    );

    expect(html).toContain('data-testid="best-deal"');
    expect(html).toContain('data-tone="positive"');
    expect(html).toContain('Bespaar tot €70');
    expect(html).toContain('€70 onder LEGO prijs');
    expect(html).toContain('accent');
  });

  it('marks the cheaper offer-list merchant as best while keeping the trusted hero deal', async () => {
    setPageMocks.getCatalogSetBySlug.mockResolvedValue({
      id: '60443',
      imageUrl: 'https://cdn.example.com/60443.jpg',
      name: 'F1 Pit Stop and Pit Crew with Ferrari Car',
      pieces: 322,
      releaseYear: 2025,
      slug: 'f1-pit-stop-and-pit-crew-with-ferrari-car-60443',
      theme: 'City',
    });
    const joybuyOffer = {
      availability: 'in_stock',
      checkedAt: '2026-05-25T10:00:00.000Z',
      condition: 'new',
      currency: 'EUR',
      market: 'NL',
      merchant: 'other',
      merchantName: 'Joybuy',
      merchantSlug: 'joybuy',
      priceCents: 5840,
      setId: '60443',
      url: 'https://joybuy.example/60443',
    };
    const lidlOffer = {
      availability: 'in_stock',
      checkedAt: '2026-05-25T10:00:00.000Z',
      condition: 'new',
      currency: 'EUR',
      market: 'NL',
      merchant: 'other',
      merchantName: 'Lidl',
      merchantSlug: 'lidl',
      priceCents: 6199,
      setId: '60443',
      url: 'https://lidl.example/60443',
    };
    setPageMocks.listCatalogSetLiveOffersBySetId.mockResolvedValue([
      joybuyOffer,
      lidlOffer,
    ]);
    setPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    setPageMocks.getCatalogPrimaryOfferAvailabilityStateBySetId.mockResolvedValue(
      {
        primaryMerchantCount: 2,
        primarySeedCount: 2,
        validPrimaryOfferCount: 2,
      },
    );
    setPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map([
        [
          '60443',
          {
            bestOffer: lidlOffer,
            offers: [lidlOffer, joybuyOffer],
            setId: '60443',
          },
        ],
      ]),
    );
    setPageMocks.listPublishedArticlesByPrimarySetNumber.mockResolvedValue([]);

    const pageModule = await import('./page');
    const html = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'f1-pit-stop-and-pit-crew-with-ferrari-car-60443',
        }),
      }),
    );

    expect(html).toContain('Bekijk deal bij Lidl');
    expect(html).toContain('Bij Lidl');
    expect(html).toContain('data-tone="neutral"');
    expect(html).toContain('accent');
    expect(html).toContain('€ 3,59 boven laagste prijs');
    expect(html).toContain('Joybuy');
    expect(html).toMatch(/data-is-best="true" data-merchant="Joybuy"/);
    expect(html).toMatch(/data-is-best="false" data-merchant="Lidl"/);
    expect(html).toContain('Laagste prijs');
    expect(html).not.toContain('Zelfde prijs als de beste optie');
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
    setPageMocks.getCatalogSetDetailRelatedThemeSnapshot.mockResolvedValue({
      setCards: [
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
      ],
      totalSetCount: 2,
    });
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
    expect(html).not.toContain('Sets uit hetzelfde thema laden');
    expect(html).not.toContain('We zoeken sets uit hetzelfde thema.');
    expect(html).toContain('Up-Scaled Darth Vader Minifigure');
    expect(html).toContain(
      'href="/sets/up-scaled-darth-vader-minifigure-75461"',
    );
    expect(html).toContain('href="/nieuwe-lego-sets"');
    expect(html).toContain('aria-label="Bekijk alle Star Wars-sets"');
    expect(html).toContain('href="/themes/star-wars"');
    expect(html).toContain('Recent bekeken LEGO sets');
    expect(html).toContain('data-rail-layout-mode="default"');
    expect(html.indexOf('Meer uit dit thema')).toBeLessThan(
      html.indexOf('Recent bekeken LEGO sets'),
    );
  });

  it('omits a missing snapshot-backed related theme rail while keeping async article slots non-blocking', async () => {
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
    setPageMocks.getCatalogSetDetailRelatedThemeSnapshot.mockResolvedValue(
      undefined,
    );
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
    expect(html).not.toContain('Meer uit dit thema');
    expect(html).not.toContain('Sets uit hetzelfde thema laden');
    expect(html).not.toContain('We zoeken sets uit hetzelfde thema.');
    expect(html).toContain('Verder ontdekken');
    expect(html).toContain('data-testid="recently-slot"');

    expect(
      setPageMocks.getCatalogSetDetailRelatedThemeSnapshot,
    ).toHaveBeenCalledWith({
      setId: '75355',
    });
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
    expect(html).toContain('Nike Dunk x LEGO');
    expect(html).not.toContain('Setdetail');
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
