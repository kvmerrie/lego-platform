import {
  CatalogFeatureDiscover,
  type CatalogFeatureDiscoverRailItem,
} from '@lego-platform/catalog/feature-discover';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards,
  listDiscoverBestDealSetCards,
  listDiscoverForYouInterestingSetCards,
  listDiscoverNewInReleaseYearSetCards,
  listDiscoverNewOnBrickhuntSetCards,
  listDiscoverNowInterestingSetCards,
  listDiscoverRecentPriceChangeSetCards,
  listDiscoverRecentlyReleasedSetCards,
  selectCatalogThemeOfWeekRail,
} from '@lego-platform/catalog/data-access-web';
import {
  isCatalogBrowsablePrimaryTheme,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { buildCurrentSetCardPriceContext } from '../lib/current-set-card-price-context';

function toRailSetCards(
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

function toCommerceRailSetCards({
  currentOfferSummaryBySetId,
  pageSurface,
  sectionId,
  setCards,
}: {
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  pageSurface: 'discover';
  sectionId: string;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogFeatureDiscoverRailItem[] {
  return setCards
    .map((setCard, index) => {
      const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const bestCurrentOffer = currentOfferSummary?.bestOffer;
      const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
        featuredSetPriceContext?.deltaMinor,
      );
      const priceContext = buildCurrentSetCardPriceContext({
        currentOfferSummary,
        pricePanelSnapshot: featuredSetPriceContext,
        theme: setCard.theme,
      });
      const primaryActionTrackingEvent:
        | BrickhuntAnalyticsEventDescriptor
        | undefined = bestCurrentOffer
        ? {
            event: 'offer_click',
            properties: {
              merchantCount: currentOfferSummary?.offers.length,
              merchantName: bestCurrentOffer.merchantName,
              offerPlacement: 'card_primary_cta',
              offerRole: 'best',
              pageSurface,
              priceVerdict,
              rankPosition: index + 1,
              sectionId,
              setId: setCard.id,
              theme: setCard.theme,
            },
          }
        : undefined;

      return {
        ...setCard,
        actions: (
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount: currentOfferSummary?.offers.length,
              pageSurface,
              priceVerdict,
              sectionId,
              setId: setCard.id,
              theme: setCard.theme,
            }}
            productIntent={bestCurrentOffer ? 'price-alert' : 'wishlist'}
            setId={setCard.id}
            variant="inline"
          />
        ),
        ctaMode: 'commerce' as const,
        priceContext: priceContext
          ? {
              ...priceContext,
              primaryActionTrackingEvent,
            }
          : undefined,
      };
    })
    .filter((setCard) => setCard.priceContext?.primaryActionHref);
}

function countDiscoverThemes(
  setCards: readonly Pick<CatalogHomepageSetCard, 'theme'>[],
): number {
  return new Set(
    setCards
      .map((setCard) => setCard.theme)
      .filter((theme) => isCatalogBrowsablePrimaryTheme(theme)),
  ).size;
}

export default async function DiscoverPage() {
  const currentYear = new Date().getUTCFullYear();
  const [catalogDiscoverySignalBySetId, allCatalogSetCards] = await Promise.all(
    [listCatalogDiscoverySignalsBySetId(), listCatalogSetCards()],
  );
  const commerceRailRotationSeed = Math.floor(Date.now() / (1000 * 60 * 15));
  const bestDealCandidateSetCards = await listDiscoverBestDealSetCards({
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    rotationSeed: commerceRailRotationSeed,
    setCards: allCatalogSetCards,
  });
  const recentPriceChangeSetCards = await listDiscoverRecentPriceChangeSetCards(
    {
      excludedSetIds: bestDealCandidateSetCards.map(
        (catalogSetCard) => catalogSetCard.id,
      ),
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
      rotationSeed: commerceRailRotationSeed,
      setCards: allCatalogSetCards,
    },
  );
  const nowInterestingSetCards = await listDiscoverNowInterestingSetCards({
    excludedSetIds: [
      ...bestDealCandidateSetCards,
      ...recentPriceChangeSetCards,
    ].map((catalogSetCard) => catalogSetCard.id),
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    rotationSeed: commerceRailRotationSeed,
    setCards: allCatalogSetCards,
  });
  const [
    recentlyReleasedSetCards,
    newInReleaseYearSetCards,
    newOnBrickhuntSetCards,
  ] = await Promise.all([
    listDiscoverRecentlyReleasedSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
      setCards: allCatalogSetCards,
    }),
    listDiscoverNewInReleaseYearSetCards({
      currentYear,
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
      setCards: allCatalogSetCards,
    }),
    listDiscoverNewOnBrickhuntSetCards({
      getCatalogDiscoverySignalFn: (setId) =>
        catalogDiscoverySignalBySetId.get(setId),
      setCards: allCatalogSetCards,
    }),
  ]);
  const showStrictRecentlyReleasedRail =
    recentlyReleasedSetCards.length >= 3 ||
    newInReleaseYearSetCards.length === 0;
  const themeOfWeekRail = selectCatalogThemeOfWeekRail({
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    setCards: allCatalogSetCards,
  });
  const excludedForForYouSetIds = [
    ...new Set(
      [
        ...nowInterestingSetCards,
        ...bestDealCandidateSetCards,
        ...(showStrictRecentlyReleasedRail ? recentlyReleasedSetCards : []),
        ...newInReleaseYearSetCards,
        ...newOnBrickhuntSetCards,
        ...recentPriceChangeSetCards,
        ...(themeOfWeekRail?.setCards ?? []),
      ].map((catalogSetCard) => catalogSetCard.id),
    ),
  ];
  const initialForYouSetCards = await listDiscoverForYouInterestingSetCards({
    excludedSetIds: excludedForForYouSetIds,
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    setCards: allCatalogSetCards,
  });
  const forYouSetCards =
    initialForYouSetCards.length > 0
      ? initialForYouSetCards
      : await listDiscoverForYouInterestingSetCards({
          getCatalogDiscoverySignalFn: (setId) =>
            catalogDiscoverySignalBySetId.get(setId),
          setCards: allCatalogSetCards,
        });
  const totalSetCount = allCatalogSetCards.length;
  const totalThemeCount = countDiscoverThemes(allCatalogSetCards);
  const selectedRailSetIds = [
    ...new Set(
      [
        ...nowInterestingSetCards,
        ...bestDealCandidateSetCards,
        ...(showStrictRecentlyReleasedRail ? recentlyReleasedSetCards : []),
        ...newInReleaseYearSetCards,
        ...newOnBrickhuntSetCards,
        ...recentPriceChangeSetCards,
        ...(themeOfWeekRail?.setCards ?? []),
        ...forYouSetCards,
      ].map((catalogSetCard) => catalogSetCard.id),
    ),
  ];
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: selectedRailSetIds,
    });
  const nowInterestingRailSetCards = toCommerceRailSetCards({
    currentOfferSummaryBySetId,
    pageSurface: 'discover',
    sectionId: 'discover-now-interesting',
    setCards: nowInterestingSetCards,
  });
  const featuredDealSetCards = toCommerceRailSetCards({
    currentOfferSummaryBySetId,
    pageSurface: 'discover',
    sectionId: 'discover-best-deals',
    setCards: bestDealCandidateSetCards,
  }).slice(0, 6);
  const recentPriceChangeRailSetCards = toCommerceRailSetCards({
    currentOfferSummaryBySetId,
    pageSurface: 'discover',
    sectionId: 'discover-recent-price-drops',
    setCards: recentPriceChangeSetCards,
  });
  const recentlyReleasedRailSetCards = toRailSetCards(
    recentlyReleasedSetCards,
    currentOfferSummaryBySetId,
  );
  const newInReleaseYearRailSetCards = toRailSetCards(
    newInReleaseYearSetCards,
    currentOfferSummaryBySetId,
  );
  const newOnBrickhuntRailSetCards = toRailSetCards(
    newOnBrickhuntSetCards,
    currentOfferSummaryBySetId,
  );
  const themeOfWeekRailSetCards = themeOfWeekRail
    ? toRailSetCards(themeOfWeekRail.setCards, currentOfferSummaryBySetId)
    : [];
  const forYouRailSetCards = toRailSetCards(
    forYouSetCards,
    currentOfferSummaryBySetId,
  );
  return (
    <ShellWeb>
      <CatalogFeatureDiscover
        bestDealSetCards={featuredDealSetCards}
        forYouSetCards={forYouRailSetCards}
        newInReleaseYear={
          newInReleaseYearRailSetCards.length
            ? {
                releaseYear: currentYear,
                setCards: newInReleaseYearRailSetCards,
              }
            : undefined
        }
        nowInterestingSetCards={nowInterestingRailSetCards}
        newOnBrickhuntSetCards={newOnBrickhuntRailSetCards}
        recentPriceChangeSetCards={recentPriceChangeRailSetCards}
        recentlyReleasedSetCards={
          showStrictRecentlyReleasedRail ? recentlyReleasedRailSetCards : []
        }
        themeOfWeek={{
          setCards: themeOfWeekRailSetCards,
          themeName: themeOfWeekRail?.theme,
        }}
        totalSetCount={totalSetCount}
        totalThemeCount={totalThemeCount}
      />
    </ShellWeb>
  );
}
