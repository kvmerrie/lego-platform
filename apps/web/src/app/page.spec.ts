import { describe, expect, it, vi } from 'vitest';

const pageMocks = vi.hoisted(() => ({
  getHomepagePage: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogCommerceRailRuntimeDiagnostics: vi.fn(),
  getCatalogPartnerOfferRailDiagnostics: vi.fn(),
  listCatalogCurrentOfferSummaries: vi.fn(),
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
  getFeaturedSetPriceContext: () => undefined,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => null,
}));

describe('home metadata', () => {
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
