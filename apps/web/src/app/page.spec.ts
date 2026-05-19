import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const pageMocks = vi.hoisted(() => ({
  catalogFeatureSetList: vi.fn(),
  getHomepagePage: vi.fn(),
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
  listHomepageSetCards: vi.fn(),
  listHomepageThemeDirectoryItems: vi.fn(),
  listHomepageThemeSpotlightItems: vi.fn(),
  rankCatalogPartnerOfferSetCards: vi.fn(),
  resolveHomepageFollowRailDiagnostics: vi.fn(),
  selectCatalogFirstCommerceRailSetCards: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
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
    return null;
  },
}));

vi.mock('@lego-platform/catalog/feature-theme-list', () => ({
  CatalogFeatureThemeList: () => null,
  CatalogFeatureThemeSpotlight: () => null,
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getHomepagePage: pageMocks.getHomepagePage,
}));

vi.mock('@lego-platform/content/feature-page-renderer', () => ({
  ContentFeaturePageRenderer: () => null,
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

describe('home metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);
    pageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
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
    pageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    pageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    pageMocks.listDiscoverNowInterestingSetCards.mockResolvedValue([]);
    pageMocks.listHomepageSetCards.mockResolvedValue([]);
    const pageModule = await import('./page');
    renderToStaticMarkup(await pageModule.default());

    expect(pageMocks.catalogFeatureSetList).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nu te vergelijken',
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
        revalidateSeconds: 21_600,
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
        revalidateSeconds: 21_600,
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
