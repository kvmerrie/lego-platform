import {
  CatalogFeatureDiscover,
  type CatalogFeatureDiscoverDealItem,
} from '@lego-platform/catalog/feature-discover';
import { getBestAffiliateOffer } from '@lego-platform/affiliate/data-access';
import {
  listCatalogSetCardsByIds,
  listDiscoverDealCandidateSetCards,
} from '@lego-platform/catalog/data-access';
import {
  buildSetDecisionPresentation,
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
  listReviewedPriceSetIds,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';

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

function getPricePositionLabel({
  currencyCode,
  deltaMinor,
}: {
  currencyCode: string;
  deltaMinor?: number;
}): string | undefined {
  if (typeof deltaMinor !== 'number') {
    return undefined;
  }

  if (deltaMinor === 0) {
    return 'Rond normaal';
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} below reference`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} above reference`;
  }

  return 'At reference';
}

function formatReviewedOn(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
}

function toDealSetCards(
  setCards: ReturnType<typeof listCatalogSetCardsByIds>,
): CatalogFeatureDiscoverDealItem[] {
  return setCards.map((setCard) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
    const bestAffiliateOffer = getBestAffiliateOffer(setCard.id);
    const decisionPresentation = buildSetDecisionPresentation({
      hasCurrentOffer: Boolean(bestAffiliateOffer?.url),
      pricePanelSnapshot: featuredSetPriceContext,
      theme: setCard.theme,
    });

    return {
      ...setCard,
      priceContext: featuredSetPriceContext
        ? {
            coverageLabel: featuredSetPriceContext.availabilityLabel
              ? `${featuredSetPriceContext.availabilityLabel} · ${featuredSetPriceContext.merchantCount} reviewed offers`
              : `${featuredSetPriceContext.merchantCount} reviewed offers`,
            currentPrice: formatPriceMinor({
              currencyCode: featuredSetPriceContext.currencyCode,
              minorUnits: featuredSetPriceContext.headlinePriceMinor,
            }),
            merchantLabel: `Lowest reviewed price at ${featuredSetPriceContext.merchantName}`,
            decisionLabel: decisionPresentation.cardLabel,
            decisionNote: decisionPresentation.cardSupportingCopy,
            primaryActionHref: bestAffiliateOffer?.url,
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: decisionPresentation.verdict.tone,
            reviewedLabel: `Checked ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
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
  const dealSetCards = toDealSetCards(
    listCatalogSetCardsByIds(
      dealPriceContexts.map((dealPriceContext) => dealPriceContext.setId),
    ),
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
    const bestAffiliateOffer = getBestAffiliateOffer(dealSetCard.id);
    const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
      featuredSetPriceContext?.deltaMinor,
    );
    const primaryActionTrackingEvent:
      | BrickhuntAnalyticsEventDescriptor
      | undefined = bestAffiliateOffer
      ? {
          event: 'offer_click',
          properties: {
            merchantCount: featuredSetPriceContext?.merchantCount,
            merchantName: bestAffiliateOffer.merchantName,
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
            merchantCount: featuredSetPriceContext?.merchantCount,
            pageSurface: 'discover',
            priceVerdict,
            sectionId: 'discover-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          }}
          productIntent={featuredSetPriceContext ? 'price-alert' : 'wishlist'}
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
        activeFilter={activeFilter}
        bestDealSetIds={strongDealSetIds}
        dealSetCards={featuredDealSetCards}
        reviewedSetIds={reviewedSetIds}
      />
    </ShellWeb>
  );
}
