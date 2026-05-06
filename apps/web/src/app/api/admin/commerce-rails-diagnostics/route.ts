import { NextResponse } from 'next/server';
import {
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics,
  listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards,
  rankCatalogPartnerOfferSetCards,
  selectCatalogFirstCommerceRailSetCards,
  type CatalogCurrentOfferSummary,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  getPublicWebRevalidationConfig,
  hasPublicWebRevalidationConfig,
} from '@lego-platform/shared/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COMMERCE_DIAGNOSTICS_LIMIT = 300;
const HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT = 20;
const HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS = 2;
const DEALS_RAIL_LIMIT = 20;
const DEALS_MIN_OPTIONAL_RAIL_ITEMS = 4;

type CommerceDiagnosticsPage = 'deals' | 'home';
type CurrentOfferSummaryBySetId = Awaited<
  ReturnType<typeof listCatalogCurrentOfferSummaries>
>;
type CatalogDiscoverySignalBySetId = Awaited<
  ReturnType<typeof listCatalogDiscoverySignalsBySetId>
>;

function readDiagnosticsSecret(request: Request): string {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const adminSecret = request.headers.get('x-admin-secret');
  const revalidationSecret = request.headers.get('x-revalidate-secret');
  const authorizationHeader = request.headers.get('authorization');

  if (adminSecret) {
    return adminSecret;
  }

  if (revalidationSecret) {
    return revalidationSecret;
  }

  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length).trim();
  }

  return querySecret ?? '';
}

function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('cache-control', 'no-store, max-age=0');

  return response;
}

function hasCommerceAction(
  currentOfferSummary?: CatalogCurrentOfferSummary,
): boolean {
  const bestOffer = currentOfferSummary?.bestOffer;

  return Boolean(
    bestOffer?.url &&
      bestOffer.priceCents > 0 &&
      bestOffer.availability !== 'out_of_stock',
  );
}

function getUniqueSetIds(
  setCardGroups: readonly (readonly Pick<CatalogHomepageSetCard, 'id'>[])[],
): string[] {
  return [
    ...new Set(
      setCardGroups.flatMap((setCards) =>
        setCards.map((catalogSetCard) => catalogSetCard.id),
      ),
    ),
  ];
}

function selectBudgetSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards
    .filter((setCard) => {
      const bestOffer = currentOfferSummaryBySetId.get(setCard.id)?.bestOffer;

      return (
        !excludedSetIdSet.has(setCard.id) &&
        typeof bestOffer?.priceCents === 'number' &&
        bestOffer.priceCents > 0 &&
        bestOffer.priceCents <= 5000 &&
        Boolean(bestOffer.url) &&
        bestOffer.availability !== 'out_of_stock'
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

function selectDisplaySetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards
    .filter((setCard) => {
      const bestOffer = currentOfferSummaryBySetId.get(setCard.id)?.bestOffer;

      return (
        !excludedSetIdSet.has(setCard.id) &&
        typeof bestOffer?.priceCents === 'number' &&
        bestOffer.priceCents > 0 &&
        Boolean(bestOffer.url) &&
        bestOffer.availability !== 'out_of_stock' &&
        (setCard.pieces >= 1500 ||
          ['Architecture', 'Icons', 'Star Wars', 'Technic'].includes(
            setCard.theme,
          ))
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

function toRenderableCommerceSetCards({
  currentOfferSummaryBySetId,
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return setCards.filter((setCard) =>
    hasCommerceAction(currentOfferSummaryBySetId.get(setCard.id)),
  );
}

async function buildCommerceDiagnostics(page: CommerceDiagnosticsPage) {
  const [catalogDiscoverySignalBySetId, currentOfferSummaryBySetId] =
    await Promise.all([
      listCatalogDiscoverySignalsBySetId({
        cacheOptions: {
          revalidateSeconds: 0,
        },
      }),
      listCatalogCurrentOfferSummaries({
        limit: COMMERCE_DIAGNOSTICS_LIMIT,
      }),
    ]);
  const [commerceCandidateSetCards, runtimeDiagnostics] = await Promise.all([
    listCatalogSetCardsByIds({
      canonicalIds: [...currentOfferSummaryBySetId.keys()],
    }),
    getCatalogCommerceRailRuntimeDiagnostics({
      limit: COMMERCE_DIAGNOSTICS_LIMIT,
    }),
  ]);
  const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 15));

  return page === 'home'
    ? buildHomepageDiagnostics({
        catalogDiscoverySignalBySetId,
        commerceCandidateSetCards,
        currentOfferSummaryBySetId,
        rotationSeed,
        runtimeDiagnostics,
      })
    : buildDealsDiagnostics({
        catalogDiscoverySignalBySetId,
        commerceCandidateSetCards,
        currentOfferSummaryBySetId,
        rotationSeed,
        runtimeDiagnostics,
      });
}

async function buildHomepageDiagnostics({
  catalogDiscoverySignalBySetId,
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
  rotationSeed,
  runtimeDiagnostics,
}: {
  catalogDiscoverySignalBySetId: CatalogDiscoverySignalBySetId;
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  rotationSeed: number;
  runtimeDiagnostics: Awaited<
    ReturnType<typeof getCatalogCommerceRailRuntimeDiagnostics>
  >;
}) {
  const getCatalogDiscoverySignalFn =
    catalogDiscoverySignalBySetId.size > 0
      ? (setId: string) => catalogDiscoverySignalBySetId.get(setId)
      : undefined;
  const strictDealSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverBestDealSetCards({
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
        rotationSeed,
        setCards: commerceCandidateSetCards,
      })
    : [];
  const scoredCommerceCandidateSetCards = rankCatalogPartnerOfferSetCards({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
    rotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const firstCommerceInputSetCards = selectCatalogFirstCommerceRailSetCards({
    limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
    scoredCommerceCandidateSetCards,
    strictDealSetCards,
  });
  const firstCommerceRenderableSetCards = toRenderableCommerceSetCards({
    currentOfferSummaryBySetId,
    setCards: firstCommerceInputSetCards,
  });
  const finalBestDealsNowCount =
    firstCommerceRenderableSetCards.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? firstCommerceRenderableSetCards.length
      : 0;

  return {
    page: 'home' as const,
    candidateCounts: {
      commerceCandidates: commerceCandidateSetCards.length,
      currentOfferSummaries: currentOfferSummaryBySetId.size,
      firstCommerceInput: firstCommerceInputSetCards.length,
      scoredCommerceCandidates: scoredCommerceCandidateSetCards.length,
      strictDeals: strictDealSetCards.length,
    },
    finalRailCounts: {
      bestDealsNow: finalBestDealsNowCount,
    },
    firstScoringReasons: getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      excludedSetIds: [],
      limit: 10,
      rotationSeed,
      setCards: commerceCandidateSetCards,
    }),
    offerSignals: buildOfferSignals({
      commerceCandidateSetCards,
      currentOfferSummaryBySetId,
    }),
    runtimeDiagnostics,
  };
}

async function buildDealsDiagnostics({
  catalogDiscoverySignalBySetId,
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
  rotationSeed,
  runtimeDiagnostics,
}: {
  catalogDiscoverySignalBySetId: CatalogDiscoverySignalBySetId;
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  rotationSeed: number;
  runtimeDiagnostics: Awaited<
    ReturnType<typeof getCatalogCommerceRailRuntimeDiagnostics>
  >;
}) {
  const getCatalogDiscoverySignalFn = (setId: string) =>
    catalogDiscoverySignalBySetId.get(setId);
  const bestDealCandidateSetCards = await listDiscoverBestDealSetCards({
    getCatalogDiscoverySignalFn,
    limit: DEALS_RAIL_LIMIT,
    rotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const bestDealSetCards = toRenderableCommerceSetCards({
    currentOfferSummaryBySetId,
    setCards: bestDealCandidateSetCards,
  });
  const goodPricedCandidateSetCards = rankCatalogPartnerOfferSetCards({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([bestDealSetCards]),
    limit: DEALS_RAIL_LIMIT,
    rotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const goodPricedSetCards = toRenderableCommerceSetCards({
    currentOfferSummaryBySetId,
    setCards: goodPricedCandidateSetCards,
  });
  const recentPriceChangeCandidateSetCards =
    await listDiscoverRecentPriceChangeSetCards({
      excludedSetIds: getUniqueSetIds([bestDealSetCards, goodPricedSetCards]),
      getCatalogDiscoverySignalFn,
      limit: DEALS_RAIL_LIMIT,
      rotationSeed,
      setCards: commerceCandidateSetCards,
    });
  const recentPriceChangeSetCards = toRenderableCommerceSetCards({
    currentOfferSummaryBySetId,
    setCards: recentPriceChangeCandidateSetCards,
  });
  const budgetSetCards = selectBudgetSetCards({
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([
      bestDealSetCards,
      goodPricedSetCards,
      recentPriceChangeSetCards,
    ]),
    setCards: commerceCandidateSetCards,
  });
  const displaySetCards = selectDisplaySetCards({
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([
      bestDealSetCards,
      goodPricedSetCards,
      recentPriceChangeSetCards,
      budgetSetCards,
    ]),
    setCards: commerceCandidateSetCards,
  });

  return {
    page: 'deals' as const,
    candidateCounts: {
      bestDealsNow: bestDealCandidateSetCards.length,
      commerceCandidates: commerceCandidateSetCards.length,
      currentOfferSummaries: currentOfferSummaryBySetId.size,
      goodPriced: goodPricedCandidateSetCards.length,
      recentPriceDrops: recentPriceChangeCandidateSetCards.length,
    },
    finalRailCounts: {
      bestDealsNow: bestDealSetCards.length,
      budget:
        budgetSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
          ? budgetSetCards.length
          : 0,
      display:
        displaySetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
          ? displaySetCards.length
          : 0,
      goodPriced: goodPricedSetCards.length,
      recentPriceDrops:
        recentPriceChangeSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
          ? recentPriceChangeSetCards.length
          : 0,
    },
    firstScoringReasons: getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      limit: 10,
      rotationSeed,
      setCards: commerceCandidateSetCards,
    }),
    offerSignals: buildOfferSignals({
      commerceCandidateSetCards,
      currentOfferSummaryBySetId,
    }),
    runtimeDiagnostics,
  };
}

function buildOfferSignals({
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
}: {
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
}) {
  const offerSummaries = [...currentOfferSummaryBySetId.values()];

  return {
    firstCommerceCandidateSetIds: commerceCandidateSetCards
      .map((catalogSetCard) => catalogSetCard.id)
      .slice(0, 20),
    firstReturnedOfferSetIds: offerSummaries
      .map((currentOfferSummary) => currentOfferSummary.setId)
      .slice(0, 20),
    setsInStock: offerSummaries.filter(
      (currentOfferSummary) =>
        currentOfferSummary.bestOffer?.availability === 'in_stock',
    ).length,
    setsWithAffiliateDeeplink: offerSummaries.filter(
      (currentOfferSummary) =>
        typeof currentOfferSummary.bestOffer?.url === 'string' &&
        currentOfferSummary.bestOffer.url.length > 0,
    ).length,
    setsWithCurrentPrice: offerSummaries.filter(
      (currentOfferSummary) =>
        typeof currentOfferSummary.bestOffer?.priceCents === 'number' &&
        currentOfferSummary.bestOffer.priceCents > 0,
    ).length,
    totalOfferSummaries: offerSummaries.length,
  };
}

export async function GET(request: Request) {
  if (!hasPublicWebRevalidationConfig()) {
    return jsonNoStore(
      {
        error: 'Commerce rail diagnostics are not configured.',
      },
      {
        status: 503,
      },
    );
  }

  const expectedSecret = getPublicWebRevalidationConfig().secret;
  const providedSecret = readDiagnosticsSecret(request);

  if (!providedSecret || providedSecret !== expectedSecret) {
    return jsonNoStore(
      {
        error: 'Invalid admin secret.',
      },
      {
        status: 401,
      },
    );
  }

  const url = new URL(request.url);
  const page = url.searchParams.get('page');

  if (page !== 'home' && page !== 'deals') {
    return jsonNoStore(
      {
        error: 'Invalid page. Use page=home or page=deals.',
      },
      {
        status: 400,
      },
    );
  }

  const diagnostics = await buildCommerceDiagnostics(page);

  console.warn('[commerce-rails] admin diagnostics', diagnostics);

  return jsonNoStore(diagnostics);
}
