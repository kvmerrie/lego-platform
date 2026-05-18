import { describe, expect, it, vi } from 'vitest';

const pageMocks = vi.hoisted(() => ({
  getHomepagePage: vi.fn(),
  getCatalogCommerceRailRuntimeDiagnostics: vi.fn(),
  getCatalogHomepageDealQualityDiagnostics: vi.fn(),
  getCatalogPartnerOfferRailDiagnostics: vi.fn(),
  listCachedCatalogAllCurrentOfferSummaries: vi.fn(),
  listCatalogCurrentOfferSummaries: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCards: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listDiscoverBestDealSetCards: vi.fn(),
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
  listCachedCatalogAllCurrentOfferSummaries:
    pageMocks.listCachedCatalogAllCurrentOfferSummaries,
  listCatalogCurrentOfferSummaries: pageMocks.listCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummariesBySetIds:
    pageMocks.listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId:
    pageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards: pageMocks.listCatalogSetCards,
  listCatalogSetCardsByIds: pageMocks.listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards: pageMocks.listDiscoverBestDealSetCards,
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
  CatalogFeatureSetList: () => null,
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
    pageMocks.listCachedCatalogAllCurrentOfferSummaries.mockResolvedValue(
      new Map([['42177', { setId: '42177', offers: [] }]]),
    );
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
    pageMocks.listCachedCatalogAllCurrentOfferSummaries.mockResolvedValue(
      new Map([['42177', { setId: '42177', offers: [] }]]),
    );
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
