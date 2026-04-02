import {
  CatalogFeatureDiscover,
  type CatalogFeatureDiscoverDealItem,
} from '@lego-platform/catalog/feature-discover';
import {
  listCatalogSetCardsByIds,
  listDiscoverDealCandidateSetCards,
} from '@lego-platform/catalog/data-access';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
  listReviewedPriceSetIds,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';

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

function getPricePositionTone(
  deltaMinor?: number,
): 'info' | 'positive' | 'warning' {
  if (typeof deltaMinor !== 'number' || deltaMinor === 0) {
    return 'info';
  }

  return deltaMinor < 0 ? 'positive' : 'warning';
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
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: getPricePositionTone(
              featuredSetPriceContext.deltaMinor,
            ),
            reviewedLabel: `Checked ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
    };
  });
}

export default function DiscoverPage() {
  const discoverDealCandidateSetCards = listDiscoverDealCandidateSetCards();
  const discoverDealCandidateSetIds = discoverDealCandidateSetCards.map(
    (catalogSetCard) => catalogSetCard.id,
  );
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
  const reviewedSetIds = listReviewedPriceSetIds();

  return (
    <ShellWeb>
      <CatalogFeatureDiscover
        dealSetCards={dealSetCards}
        reviewedSetIds={reviewedSetIds}
      />
    </ShellWeb>
  );
}
