import {
  CatalogFeatureDiscover,
  type CatalogFeatureDiscoverDealItem,
} from '@lego-platform/catalog/feature-discover';
import {
  listCatalogSetCardsByIds,
  listDiscoverDealCandidateSetCards,
} from '@lego-platform/catalog/data-access';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogSetSlugsWithOverlay,
  listCatalogThemeDirectoryItemsWithOverlay,
  listDiscoverBrowseThemeGroupsWithOverlay,
} from '@lego-platform/catalog/data-access-web';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
  listReviewedPriceSetIds,
} from '@lego-platform/pricing/data-access';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { buildCurrentSetCardPriceContext } from '../lib/current-set-card-price-context';

function readQueryParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function getDiscoverMinifigureHighlightRank(
  minifigureHighlights?: readonly string[],
): number {
  return minifigureHighlights?.length ? 0 : 1;
}

function getDiscoverCandidateRank(
  setId: string,
  candidateSetIds: readonly string[],
): number {
  const rank = candidateSetIds.indexOf(setId);

  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function toDealSetCards(
  setCards: ReturnType<typeof listCatalogSetCardsByIds>,
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >,
): CatalogFeatureDiscoverDealItem[] {
  return setCards.map((setCard) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
    const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);

    return {
      ...setCard,
      priceContext: buildCurrentSetCardPriceContext({
        currentOfferSummary,
        pricePanelSnapshot: featuredSetPriceContext,
        theme: setCard.theme,
      }),
    };
  });
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeFilter = readQueryParam(resolvedSearchParams.filter);
  const discoverDealCandidateSetCards = listDiscoverDealCandidateSetCards();
  const discoverDealCandidateSetIds = discoverDealCandidateSetCards.map(
    (catalogSetCard) => catalogSetCard.id,
  );
  const reviewedSetIds = listReviewedPriceSetIds();
  const strongDealSetIds = reviewedSetIds.flatMap((setId) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(setId);

    return featuredSetPriceContext &&
      typeof featuredSetPriceContext.deltaMinor === 'number' &&
      featuredSetPriceContext.deltaMinor < 0
      ? [setId]
      : [];
  });
  const dealPriceContexts = listDealSpotlightPriceContexts({
    candidateSetIds: discoverDealCandidateSetIds,
    limit: discoverDealCandidateSetIds.length,
  });
  const dealPriceContextBySetId = new Map(
    dealPriceContexts.map((dealPriceContext) => [
      dealPriceContext.setId,
      dealPriceContext,
    ]),
  );
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: dealPriceContexts.map(
        (dealPriceContext) => dealPriceContext.setId,
      ),
    });
  const dealSetCards = toDealSetCards(
    listCatalogSetCardsByIds(
      dealPriceContexts.map((dealPriceContext) => dealPriceContext.setId),
    ),
    currentOfferSummaryBySetId,
  )
    .sort(
      (left, right) =>
        (dealPriceContextBySetId.get(left.id)?.deltaMinor ?? 0) -
          (dealPriceContextBySetId.get(right.id)?.deltaMinor ?? 0) ||
        getDiscoverMinifigureHighlightRank(left.minifigureHighlights) -
          getDiscoverMinifigureHighlightRank(right.minifigureHighlights) ||
        getDiscoverCandidateRank(left.id, discoverDealCandidateSetIds) -
          getDiscoverCandidateRank(right.id, discoverDealCandidateSetIds) ||
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 6);
  const featuredDealSetCards = dealSetCards.map((dealSetCard, index) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(dealSetCard.id);
    const currentOfferSummary = currentOfferSummaryBySetId.get(dealSetCard.id);
    const bestCurrentOffer = currentOfferSummary?.bestOffer;
    const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
      featuredSetPriceContext?.deltaMinor,
    );
    const primaryActionTrackingEvent:
      | BrickhuntAnalyticsEventDescriptor
      | undefined = bestCurrentOffer
      ? {
          event: 'offer_click',
          properties: {
            merchantCount: currentOfferSummary?.offers.length,
            merchantName: bestCurrentOffer?.merchantName,
            offerPlacement: 'card_primary_cta',
            offerRole: 'best',
            pageSurface: 'discover',
            priceVerdict,
            rankPosition: index + 1,
            sectionId: 'discover-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          },
        }
      : undefined;

    return {
      ...dealSetCard,
      actions: (
        <WishlistFeatureWishlistToggle
          analyticsContext={{
            merchantCount: currentOfferSummary?.offers.length,
            pageSurface: 'discover',
            priceVerdict,
            sectionId: 'discover-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          }}
          productIntent={bestCurrentOffer ? 'price-alert' : 'wishlist'}
          setId={dealSetCard.id}
          variant="inline"
        />
      ),
      ctaMode: 'commerce' as const,
      priceContext: dealSetCard.priceContext
        ? {
            ...dealSetCard.priceContext,
            primaryActionTrackingEvent,
          }
        : undefined,
    };
  });
  const [themeGroups, totalSetSlugs, themeDirectoryItems] = await Promise.all([
    listDiscoverBrowseThemeGroupsWithOverlay({
      reviewedSetIds,
    }),
    listCatalogSetSlugsWithOverlay(),
    listCatalogThemeDirectoryItemsWithOverlay(),
  ]);

  return (
    <ShellWeb>
      <CatalogFeatureDiscover
        activeFilter={activeFilter}
        bestDealSetIds={strongDealSetIds}
        dealSetCards={featuredDealSetCards}
        reviewedSetIds={reviewedSetIds}
        themeGroups={themeGroups}
        totalSetCount={totalSetSlugs.length}
        totalThemeCount={themeDirectoryItems.length}
      />
    </ShellWeb>
  );
}
