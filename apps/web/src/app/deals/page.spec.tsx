import { describe, expect, it, vi } from 'vitest';

const dealsPageMocks = vi.hoisted(() => ({
  getCatalogCommerceRailRuntimeDiagnostics: vi.fn(),
  getCatalogPartnerOfferRailDiagnostics: vi.fn(),
  listCachedCatalogCurrentOfferSummaries: vi.fn(),
  listCatalogCurrentOfferSummaries: vi.fn(),
  listCatalogDiscoverySignalsBySetId: vi.fn(),
  listCatalogSetCardsByIds: vi.fn(),
  listDiscoverBestDealSetCards: vi.fn(),
  listDiscoverRecentPriceChangeSetCards: vi.fn(),
  rankCatalogPartnerOfferSetCards: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogCommerceRailRuntimeDiagnostics:
    dealsPageMocks.getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics:
    dealsPageMocks.getCatalogPartnerOfferRailDiagnostics,
  listCachedCatalogCurrentOfferSummaries:
    dealsPageMocks.listCachedCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummaries:
    dealsPageMocks.listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId:
    dealsPageMocks.listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds: dealsPageMocks.listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards: dealsPageMocks.listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards:
    dealsPageMocks.listDiscoverRecentPriceChangeSetCards,
  rankCatalogPartnerOfferSetCards:
    dealsPageMocks.rankCatalogPartnerOfferSetCards,
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogSetCardRailSection: () => null,
}));

vi.mock('@lego-platform/pricing/data-access', () => ({
  getFeaturedSetPriceContext: () => undefined,
}));

vi.mock('@lego-platform/shared/ui', () => ({
  SectionHeading: () => null,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => null,
}));

describe('deals page discovery signals', () => {
  it('scopes discovery signals to current commerce candidate cards', async () => {
    dealsPageMocks.listCachedCatalogCurrentOfferSummaries.mockResolvedValue(
      new Map([
        ['42177', { setId: '42177', offers: [] }],
        ['75398', { setId: '75398', offers: [] }],
      ]),
    );
    dealsPageMocks.listCatalogSetCardsByIds.mockResolvedValue([
      { id: '42177' },
      { id: '75398' },
    ]);
    dealsPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    dealsPageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    dealsPageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([]);
    dealsPageMocks.listDiscoverRecentPriceChangeSetCards.mockResolvedValue([]);

    const pageModule = await import('./page');
    await pageModule.default();

    expect(
      dealsPageMocks.listCatalogDiscoverySignalsBySetId,
    ).toHaveBeenCalledWith({
      cacheOptions: {
        revalidateSeconds: 21_600,
        tags: ['deals'],
      },
      setIds: ['42177', '75398'],
    });
  });
});
