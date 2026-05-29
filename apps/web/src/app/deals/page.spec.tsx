import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const dealsPageMocks = vi.hoisted(() => ({
  catalogSetCardRailSection: vi.fn(),
  getCatalogCommerceRailRuntimeDiagnostics: vi.fn(),
  getCatalogPartnerOfferRailDiagnostics: vi.fn(),
  listCatalogCurrentOfferCandidateSetIds: vi.fn(),
  listCatalogCurrentOfferSummaries: vi.fn(),
  listCatalogCurrentOfferSummariesBySetIds: vi.fn(),
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
  listCatalogCurrentOfferCandidateSetIds:
    dealsPageMocks.listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummaries:
    dealsPageMocks.listCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummariesBySetIds:
    dealsPageMocks.listCatalogCurrentOfferSummariesBySetIds,
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
  CatalogSetCardRailSection: (props: unknown) => {
    dealsPageMocks.catalogSetCardRailSection(props);
    return null;
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
    dealsPageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    dealsPageMocks.listDiscoverRecentPriceChangeSetCards.mockResolvedValue([]);
    dealsPageMocks.rankCatalogPartnerOfferSetCards.mockReturnValue([]);
    dealsPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
      new Map(),
    );
  });

  it('renders current offer cards when reference-discount deal gates are empty', async () => {
    dealsPageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
    ]);
    dealsPageMocks.listCatalogCurrentOfferSummariesBySetIds.mockResolvedValue(
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
      ]),
    );
    dealsPageMocks.listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '42177',
        name: 'Mercedes-AMG F1 W14 E Performance',
        pieces: 1642,
        releaseYear: 2024,
        slug: 'mercedes-amg-f1-w14-e-performance-42177',
        theme: 'Technic',
      },
    ]);
    dealsPageMocks.rankCatalogPartnerOfferSetCards
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          id: '42177',
          name: 'Mercedes-AMG F1 W14 E Performance',
          pieces: 1642,
          releaseYear: 2024,
          slug: 'mercedes-amg-f1-w14-e-performance-42177',
          theme: 'Technic',
        },
      ]);
    dealsPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );
    dealsPageMocks.listDiscoverBestDealSetCards.mockResolvedValue([]);
    dealsPageMocks.listDiscoverRecentPriceChangeSetCards.mockResolvedValue([]);

    const pageModule = await import('./page');
    renderToStaticMarkup(await pageModule.default());

    expect(dealsPageMocks.catalogSetCardRailSection).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Actueel te koop',
      }),
    );
  });

  it('keeps the standalone deals hero independent from discovery tile variants', async () => {
    dealsPageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([]);
    dealsPageMocks.listCatalogSetCardsByIds.mockResolvedValue([]);
    dealsPageMocks.listCatalogDiscoverySignalsBySetId.mockResolvedValue(
      new Map(),
    );

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('--deals-page-surface:#6bbf59');
    expect(markup).not.toContain('--deals-page-surface:#00a99d');
  });

  it('scopes discovery signals to current commerce candidate cards', async () => {
    dealsPageMocks.listCatalogCurrentOfferCandidateSetIds.mockResolvedValue([
      '42177',
      '75398',
    ]);
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
        revalidateSeconds: false,
        tags: ['deals', 'prices'],
      },
      setIds: ['42177', '75398'],
    });
  });
});
