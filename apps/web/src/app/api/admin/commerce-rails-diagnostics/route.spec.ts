import { beforeEach, describe, expect, test, vi } from 'vitest';

const getCatalogCommerceRailRuntimeDiagnostics = vi.fn();
const getCatalogPartnerOfferRailDiagnostics = vi.fn();
const listCatalogCurrentOfferSummaries = vi.fn();
const listCatalogDiscoverySignalsBySetId = vi.fn();
const listCatalogSetCardsByIds = vi.fn();
const listDiscoverBestDealSetCards = vi.fn();
const listDiscoverRecentPriceChangeSetCards = vi.fn();
const rankCatalogPartnerOfferSetCards = vi.fn();
const selectCatalogFirstCommerceRailSetCards = vi.fn();

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics,
  listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards,
  rankCatalogPartnerOfferSetCards,
  selectCatalogFirstCommerceRailSetCards,
}));

describe('commerce rails diagnostics route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WEB_REVALIDATE_SECRET: 'diagnostics-secret',
    };
    vi.clearAllMocks();
    getCatalogCommerceRailRuntimeDiagnostics.mockResolvedValue({
      activeMerchantCount: 1,
      activeSeedCount: 2,
      currentOfferRowCount: 3,
      currentOfferRowsWithValidPriceCount: 3,
      hasBrowserSupabaseConfig: true,
      hasServerSupabaseConfig: true,
      missingBrowserSupabaseEnvKeys: [],
      missingServerSupabaseEnvKeys: [],
      rowsAfterMerchantJoinCount: 2,
      rowsAfterPriceDeeplinkInStockFiltersCount: 1,
      rowsAfterSeedJoinCount: 2,
      serverSupabaseUrlSource: 'SUPABASE_URL',
      summaryCount: 1,
    });
    getCatalogPartnerOfferRailDiagnostics.mockReturnValue([
      {
        discountScore: 0,
        excludedReason: 'included',
        finalScore: 210,
        hasDeeplink: true,
        hasPrice: true,
        inStock: true,
        priceSpread: 0,
        setId: '43247',
      },
    ]);
    listCatalogCurrentOfferSummaries.mockResolvedValue(
      new Map([
        [
          '43247',
          {
            bestOffer: {
              availability: 'in_stock',
              priceCents: 9999,
              url: 'https://partner.example/redacted',
            },
            offers: [
              {
                availability: 'in_stock',
                priceCents: 9999,
                url: 'https://partner.example/redacted',
              },
            ],
            setId: '43247',
          },
        ],
      ]),
    );
    listCatalogDiscoverySignalsBySetId.mockResolvedValue(new Map());
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '43247',
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
    ]);
    listDiscoverBestDealSetCards.mockResolvedValue([]);
    listDiscoverRecentPriceChangeSetCards.mockResolvedValue([]);
    rankCatalogPartnerOfferSetCards.mockReturnValue([
      {
        id: '43247',
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
    ]);
    selectCatalogFirstCommerceRailSetCards.mockReturnValue([
      {
        id: '43247',
        name: 'Young Simba the Lion King',
        pieces: 1445,
        releaseYear: 2024,
        slug: 'young-simba-the-lion-king-43247',
        theme: 'Disney',
      },
    ]);
  });

  test('requires an admin secret', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        'http://localhost:3000/api/admin/commerce-rails-diagnostics?page=deals',
      ),
    );

    expect(response.status).toBe(401);
    expect(listCatalogCurrentOfferSummaries).not.toHaveBeenCalled();
  });

  test('returns live diagnostics without relying on cached deals rendering', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        'http://localhost:3000/api/admin/commerce-rails-diagnostics?page=deals',
        {
          headers: {
            'x-admin-secret': 'diagnostics-secret',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(listCatalogCurrentOfferSummaries).toHaveBeenCalledWith({
      limit: 300,
    });
    expect(payload).toMatchObject({
      finalRailCounts: {
        goodPriced: 1,
      },
      page: 'deals',
      runtimeDiagnostics: {
        currentOfferRowCount: 3,
        hasServerSupabaseConfig: true,
        rowsAfterMerchantJoinCount: 2,
        rowsAfterPriceDeeplinkInStockFiltersCount: 1,
        rowsAfterSeedJoinCount: 2,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('partner.example');
  });

  test('returns homepage diagnostics shape', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        'http://localhost:3000/api/admin/commerce-rails-diagnostics?page=home&secret=diagnostics-secret',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      finalRailCounts: {
        bestDealsNow: 0,
      },
      page: 'home',
      runtimeDiagnostics: {
        activeMerchantCount: 1,
      },
    });
  });
});
