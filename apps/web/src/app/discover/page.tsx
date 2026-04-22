import {
  CatalogFeatureDiscover,
  type CatalogFeatureDiscoverRailItem,
} from '@lego-platform/catalog/feature-discover';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetSlugs,
  listCatalogThemeDirectoryItems,
  listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards,
  listDiscoverRecentlyReleasedSetCards,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { buildCurrentSetCardPriceContext } from '../lib/current-set-card-price-context';

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
  setCards: readonly CatalogHomepageSetCard[],
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >,
): CatalogFeatureDiscoverRailItem[] {
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

export default async function DiscoverPage() {
  const catalogDiscoverySignalBySetId =
    await listCatalogDiscoverySignalsBySetId();
  const [
    recentPriceChangeSetCards,
    bestDealCandidateSetCards,
    recentlyReleasedSetCards,
    totalSetSlugs,
    themeDirectoryItems,
  ] = await Promise.all([
    listDiscoverRecentPriceChangeSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
    }),
    listDiscoverBestDealSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
    }),
    listDiscoverRecentlyReleasedSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
    }),
    listCatalogSetSlugs(),
    listCatalogThemeDirectoryItems(),
  ]);
  const bestDealCandidateSetIds = bestDealCandidateSetCards.map(
    (catalogSetCard) => catalogSetCard.id,
  );
  const selectedRailSetIds = [
    ...new Set(
      [
        ...recentPriceChangeSetCards,
        ...bestDealCandidateSetCards,
        ...recentlyReleasedSetCards,
      ].map((catalogSetCard) => catalogSetCard.id),
    ),
  ];
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: selectedRailSetIds,
    });
  const dealSetCards = toDealSetCards(
    bestDealCandidateSetCards,
    currentOfferSummaryBySetId,
  )
    .sort(
      (left, right) =>
        (catalogDiscoverySignalBySetId.get(left.id)?.referenceDeltaMinor ?? 0) -
          (catalogDiscoverySignalBySetId.get(right.id)?.referenceDeltaMinor ??
            0) ||
        getDiscoverMinifigureHighlightRank(left.minifigureHighlights) -
          getDiscoverMinifigureHighlightRank(right.minifigureHighlights) ||
        getDiscoverCandidateRank(left.id, bestDealCandidateSetIds) -
          getDiscoverCandidateRank(right.id, bestDealCandidateSetIds) ||
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 6);
  const recentPriceChangeRailSetCards = toDealSetCards(
    recentPriceChangeSetCards,
    currentOfferSummaryBySetId,
  );
  const recentlyReleasedRailSetCards = toDealSetCards(
    recentlyReleasedSetCards,
    currentOfferSummaryBySetId,
  );
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

  return (
    <ShellWeb>
      <CatalogFeatureDiscover
        bestDealSetCards={featuredDealSetCards}
        recentPriceChangeSetCards={recentPriceChangeRailSetCards}
        recentlyReleasedSetCards={recentlyReleasedRailSetCards}
        totalSetCount={totalSetSlugs.length}
        totalThemeCount={themeDirectoryItems.length}
      />
    </ShellWeb>
  );
}
