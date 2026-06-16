import { selectBestPurchasableOffer } from '@lego-platform/affiliate/util';
import type {
  CatalogCurrentOfferSummary,
  CatalogDiscoverySignal,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogFeatureSearchReviewedPriceContext } from '@lego-platform/catalog/feature-search-results';
import type { CatalogSetCardPriceContext } from '@lego-platform/catalog/ui';
import {
  buildSetDecisionPresentation,
  getFeaturedSetPriceContext,
} from '@lego-platform/pricing/data-access';
import {
  formatPriceMinor,
  type FeaturedSetPriceContext,
} from '@lego-platform/pricing/util';
import {
  getDefaultFormattingLocale,
  getCommerceCommercialUnitComparisonGroup,
  isCommerceCommercialUnitComparableForDeals,
  resolvePublicMerchantDisplayName,
} from '@lego-platform/shared/config';

const DEAL_REASON_MIN_MERCHANT_COUNT = 2;
const MARKET_POSITION_MIN_SPREAD_MINOR = 1000;
const MARKET_POSITION_MIN_SPREAD_RATIO = 0.05;
const GOOD_DEAL_MIN_REFERENCE_DISCOUNT_MINOR = 1000;
const GOOD_DEAL_MIN_REFERENCE_DISCOUNT_RATIO = 0.1;
const STRONG_DEAL_MIN_REFERENCE_DISCOUNT_MINOR = 2500;
const STRONG_DEAL_MIN_REFERENCE_DISCOUNT_RATIO = 0.2;
const TOP_DEAL_MIN_REFERENCE_DISCOUNT_MINOR = 4000;
const TOP_DEAL_MIN_REFERENCE_DISCOUNT_RATIO = 0.3;
type DealQualityLabel = 'Goede deal' | 'Sterke deal' | 'Topdeal';
type DealReferencePriceContext = Pick<
  FeaturedSetPriceContext,
  'deltaMinor' | 'merchantCount' | 'referencePriceMinor'
>;

export interface ReliableDealDiscount {
  absoluteMinor: number;
  label: DealQualityLabel;
  percentage: number;
  metricLabel: string;
}

interface OfficialLegoComparison extends Omit<ReliableDealDiscount, 'label'> {
  label?: DealQualityLabel;
  percentageLabel: string;
}

export interface CurrentOfferRailDiagnostics {
  current_offer_count: number;
  deal_candidate_count: number;
  eligible_offer_count: number;
  final_card_count: number;
  rejected_missing_best_offer: number;
  rejected_no_affiliate_url: number;
  rejected_no_price: number;
  rejected_out_of_stock: number;
  sample_rejected_set_ids: readonly string[];
}

export function compareReliableDealDiscounts({
  left,
  leftMerchantCount,
  right,
  rightMerchantCount,
}: {
  left?: ReliableDealDiscount;
  leftMerchantCount: number;
  right?: ReliableDealDiscount;
  rightMerchantCount: number;
}): number {
  return (
    (right?.percentage ?? 0) - (left?.percentage ?? 0) ||
    (right?.absoluteMinor ?? 0) - (left?.absoluteMinor ?? 0) ||
    rightMerchantCount - leftMerchantCount
  );
}

function formatCheckedOn(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
}

function formatDiscountPercentage(percentage: number): string {
  return `${Math.round(percentage)}% lager`;
}

function canBestOfferDriveDealClaims(
  bestOffer?: CatalogCurrentOfferSummary['bestOffer'],
): boolean {
  return isCommerceCommercialUnitComparableForDeals(
    bestOffer?.commercialUnitType,
  );
}

function getComparableInStockOffers(
  currentOfferSummary: CatalogCurrentOfferSummary,
): NonNullable<CatalogCurrentOfferSummary['bestOffer']>[] {
  const rankedOffers = selectBestPurchasableOffer(
    [...currentOfferSummary.offers, currentOfferSummary.bestOffer].filter(
      (offer): offer is NonNullable<CatalogCurrentOfferSummary['bestOffer']> =>
        Boolean(offer),
    ),
    {
      strategicTieBreakerOffer: currentOfferSummary.bestOffer ?? null,
    },
  ).rankedOffers;
  const [bestOffer] = rankedOffers;

  if (!bestOffer) {
    return [];
  }

  const bestComparisonGroup = getCommerceCommercialUnitComparisonGroup(
    bestOffer.commercialUnitType,
  );

  if (bestComparisonGroup === 'unknown') {
    return [bestOffer];
  }

  return rankedOffers.filter(
    (offer) =>
      getCommerceCommercialUnitComparisonGroup(offer.commercialUnitType) ===
      bestComparisonGroup,
  );
}

function getBestComparableInStockOffer(
  currentOfferSummary: CatalogCurrentOfferSummary,
): NonNullable<CatalogCurrentOfferSummary['bestOffer']> | undefined {
  return getComparableInStockOffers(currentOfferSummary)[0];
}

function getPublicBestOfferMerchantName(
  bestOffer: NonNullable<CatalogCurrentOfferSummary['bestOffer']>,
): string {
  return resolvePublicMerchantDisplayName({
    merchantName: bestOffer.merchantName,
    merchantSlug:
      'merchantSlug' in bestOffer && typeof bestOffer.merchantSlug === 'string'
        ? bestOffer.merchantSlug
        : undefined,
  });
}

function getDealQualityLabel({
  absoluteMinor,
  percentage,
}: {
  absoluteMinor: number;
  percentage: number;
}): DealQualityLabel | undefined {
  if (
    absoluteMinor >= TOP_DEAL_MIN_REFERENCE_DISCOUNT_MINOR &&
    percentage >= TOP_DEAL_MIN_REFERENCE_DISCOUNT_RATIO * 100
  ) {
    return 'Topdeal';
  }

  if (
    absoluteMinor >= STRONG_DEAL_MIN_REFERENCE_DISCOUNT_MINOR &&
    percentage >= STRONG_DEAL_MIN_REFERENCE_DISCOUNT_RATIO * 100
  ) {
    return 'Sterke deal';
  }

  if (
    absoluteMinor >= GOOD_DEAL_MIN_REFERENCE_DISCOUNT_MINOR &&
    percentage >= GOOD_DEAL_MIN_REFERENCE_DISCOUNT_RATIO * 100
  ) {
    return 'Goede deal';
  }

  return undefined;
}

function isOfficialLegoOffer(
  offer?: CatalogCurrentOfferSummary['bestOffer'],
): boolean {
  if (!offer) {
    return false;
  }

  const merchantSlug =
    'merchantSlug' in offer && typeof offer.merchantSlug === 'string'
      ? offer.merchantSlug
      : undefined;

  return (
    merchantSlug === 'rakuten-lego-eu' ||
    merchantSlug === 'lego' ||
    offer.merchant === 'lego' ||
    resolvePublicMerchantDisplayName({
      merchantName: offer.merchantName,
      merchantSlug,
    }) === 'LEGO®'
  );
}

function getOfficialLegoOffer(
  currentOfferSummary: CatalogCurrentOfferSummary,
): CatalogCurrentOfferSummary['bestOffer'] | undefined {
  return [...currentOfferSummary.offers, currentOfferSummary.bestOffer]
    .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
    .filter(isOfficialLegoOffer)
    .sort(
      (left, right) =>
        right.checkedAt.localeCompare(left.checkedAt) ||
        right.priceCents - left.priceCents,
    )[0];
}

function buildOfficialLegoComparison({
  bestOffer,
  currentOfferSummary,
}: {
  bestOffer: NonNullable<CatalogCurrentOfferSummary['bestOffer']>;
  currentOfferSummary: CatalogCurrentOfferSummary;
}): OfficialLegoComparison | undefined {
  const legoOffer = getOfficialLegoOffer(currentOfferSummary);

  if (
    !legoOffer ||
    isOfficialLegoOffer(bestOffer) ||
    !canBestOfferDriveDealClaims(bestOffer) ||
    legoOffer.availability === 'out_of_stock' ||
    bestOffer.currency !== legoOffer.currency ||
    bestOffer.priceCents <= 0 ||
    legoOffer.priceCents <= 0 ||
    bestOffer.priceCents >= legoOffer.priceCents
  ) {
    return undefined;
  }

  const absoluteMinor = legoOffer.priceCents - bestOffer.priceCents;
  const percentage = (absoluteMinor / legoOffer.priceCents) * 100;
  const label = getDealQualityLabel({ absoluteMinor, percentage });

  return {
    absoluteMinor,
    label,
    percentage,
    metricLabel: `${formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: absoluteMinor,
    })} goedkoper dan LEGO`,
    percentageLabel: `${Math.round(percentage)}% onder LEGO prijs`,
  };
}

function getCurrentOfferRejectionReason({
  currentOfferSummary,
}: {
  currentOfferSummary?: CatalogCurrentOfferSummary;
}):
  | keyof Pick<
      CurrentOfferRailDiagnostics,
      | 'rejected_missing_best_offer'
      | 'rejected_no_affiliate_url'
      | 'rejected_no_price'
      | 'rejected_out_of_stock'
    >
  | null {
  const bestOffer = currentOfferSummary?.bestOffer;

  if (!bestOffer) {
    return 'rejected_missing_best_offer';
  }

  if (bestOffer.availability === 'out_of_stock') {
    return 'rejected_out_of_stock';
  }

  if (bestOffer.priceCents <= 0) {
    return 'rejected_no_price';
  }

  if (!bestOffer.url) {
    return 'rejected_no_affiliate_url';
  }

  return null;
}

export function selectCurrentOfferSetCards<
  SetCard extends {
    id: string;
    name: string;
    pieces: number;
    releaseYear: number;
  },
>({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  limit,
  setCards,
}: {
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  limit: number;
  setCards: readonly SetCard[];
}): SetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return [...setCards]
    .filter(
      (setCard) =>
        !excludedSetIdSet.has(setCard.id) &&
        getCurrentOfferRejectionReason({
          currentOfferSummary: currentOfferSummaryBySetId.get(setCard.id),
        }) === null,
    )
    .sort((left, right) => {
      const leftSummary = currentOfferSummaryBySetId.get(left.id);
      const rightSummary = currentOfferSummaryBySetId.get(right.id);

      return (
        (rightSummary?.offers.length ?? 0) -
          (leftSummary?.offers.length ?? 0) ||
        (rightSummary?.bestOffer?.checkedAt ?? '').localeCompare(
          leftSummary?.bestOffer?.checkedAt ?? '',
        ) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    })
    .slice(0, limit);
}

export function getCurrentOfferRailDiagnostics<SetCard extends { id: string }>({
  currentOfferSummaryBySetId,
  finalSetCards,
  setCards,
}: {
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  finalSetCards: readonly SetCard[];
  setCards: readonly SetCard[];
}): CurrentOfferRailDiagnostics {
  const diagnostics: CurrentOfferRailDiagnostics = {
    current_offer_count: currentOfferSummaryBySetId.size,
    deal_candidate_count: setCards.length,
    eligible_offer_count: 0,
    final_card_count: finalSetCards.length,
    rejected_missing_best_offer: 0,
    rejected_no_affiliate_url: 0,
    rejected_no_price: 0,
    rejected_out_of_stock: 0,
    sample_rejected_set_ids: [],
  };
  const sampleRejectedSetIds: string[] = [];

  for (const setCard of setCards) {
    const rejectionReason = getCurrentOfferRejectionReason({
      currentOfferSummary: currentOfferSummaryBySetId.get(setCard.id),
    });

    if (!rejectionReason) {
      diagnostics.eligible_offer_count += 1;
      continue;
    }

    diagnostics[rejectionReason] += 1;

    if (sampleRejectedSetIds.length < 10) {
      sampleRejectedSetIds.push(setCard.id);
    }
  }

  return {
    ...diagnostics,
    sample_rejected_set_ids: sampleRejectedSetIds,
  };
}

export function buildReliableDealDiscount({
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: DealReferencePriceContext;
}): ReliableDealDiscount | undefined {
  const referencePriceMinor = pricePanelSnapshot?.referencePriceMinor;

  if (
    !currentOfferSummary ||
    typeof referencePriceMinor !== 'number' ||
    referencePriceMinor <= 0
  ) {
    return undefined;
  }

  const bestOffer = getBestComparableInStockOffer(currentOfferSummary);

  if (
    !bestOffer ||
    !canBestOfferDriveDealClaims(bestOffer) ||
    bestOffer.priceCents <= 0 ||
    bestOffer.priceCents >= referencePriceMinor
  ) {
    return undefined;
  }

  const hasReviewedMarket =
    currentOfferSummary.offers.length >= DEAL_REASON_MIN_MERCHANT_COUNT ||
    (typeof pricePanelSnapshot?.merchantCount === 'number' &&
      pricePanelSnapshot.merchantCount >= DEAL_REASON_MIN_MERCHANT_COUNT);

  if (!hasReviewedMarket) {
    return undefined;
  }

  const absoluteMinor = referencePriceMinor - bestOffer.priceCents;
  const percentage = (absoluteMinor / referencePriceMinor) * 100;
  const label = getDealQualityLabel({ absoluteMinor, percentage });

  if (!label) {
    return undefined;
  }

  return {
    absoluteMinor,
    label,
    percentage,
    metricLabel: `${formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: absoluteMinor,
    })} goedkoper · ${formatDiscountPercentage(percentage)}`,
  };
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
    })} onder referentie`;
  }

  return `${formatPriceMinor({
    currencyCode,
    minorUnits: deltaMinor,
  })} boven referentie`;
}

function getCoverageLabel(
  currentOfferSummary: CatalogCurrentOfferSummary,
): string {
  const merchantCount = currentOfferSummary.offers.length;
  const merchantCountLabel = `${merchantCount} winkel${
    merchantCount === 1 ? '' : 's'
  } nagekeken`;

  if (currentOfferSummary.bestOffer?.availability === 'in_stock') {
    return `Op voorraad · ${merchantCountLabel}`;
  }

  if (currentOfferSummary.bestOffer?.availability === 'out_of_stock') {
    return `Niet op voorraad · ${merchantCountLabel}`;
  }

  return merchantCountLabel;
}

function buildDealReason({
  currentOfferSummary,
}: {
  currentOfferSummary: CatalogCurrentOfferSummary;
}): string | undefined {
  const comparableOffers = getComparableInStockOffers(currentOfferSummary);
  const [bestOffer, nextBestOffer] = comparableOffers;

  if (
    comparableOffers.length < DEAL_REASON_MIN_MERCHANT_COUNT ||
    !bestOffer ||
    !nextBestOffer
  ) {
    return undefined;
  }

  const spreadMinor = nextBestOffer.priceCents - bestOffer.priceCents;
  const spreadRatio =
    nextBestOffer.priceCents > 0 ? spreadMinor / nextBestOffer.priceCents : 0;

  if (!canBestOfferDriveDealClaims(bestOffer)) {
    return undefined;
  }

  if (
    spreadMinor >= MARKET_POSITION_MIN_SPREAD_MINOR ||
    spreadRatio >= MARKET_POSITION_MIN_SPREAD_RATIO
  ) {
    return 'Beste marktprijs';
  }

  return 'Laagste prijs';
}

export function buildCurrentSetCardPriceContext({
  currentOfferSummary,
  pricePanelSnapshot,
  theme,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: DealReferencePriceContext;
  theme: string;
}): CatalogSetCardPriceContext | undefined {
  const bestOffer = currentOfferSummary
    ? getBestComparableInStockOffer(currentOfferSummary)
    : undefined;

  if (!bestOffer || !currentOfferSummary) {
    return undefined;
  }

  const decisionPresentation = buildSetDecisionPresentation({
    hasCurrentOffer: true,
    pricePanelSnapshot,
    theme,
  });
  const reliableDealDiscount = buildReliableDealDiscount({
    currentOfferSummary,
    pricePanelSnapshot,
  });
  const officialLegoComparison = buildOfficialLegoComparison({
    bestOffer,
    currentOfferSummary,
  });
  const dealQuality = officialLegoComparison?.label
    ? officialLegoComparison
    : reliableDealDiscount;
  const decisionLabel = dealQuality
    ? dealQuality.label
    : decisionPresentation.cardLabel === 'Actuele prijzen binnen' ||
        decisionPresentation.cardLabel === 'Prijsdata nog beperkt' ||
        decisionPresentation.cardLabel === 'Goede deal'
      ? 'Actuele prijs binnen'
      : decisionPresentation.cardLabel;
  const decisionNote = decisionPresentation.cardSupportingCopy?.includes(
    'bouwt',
  )
    ? undefined
    : decisionPresentation.cardSupportingCopy;
  const merchantName = getPublicBestOfferMerchantName(bestOffer);
  const merchantSlug =
    'merchantSlug' in bestOffer && typeof bestOffer.merchantSlug === 'string'
      ? bestOffer.merchantSlug
      : undefined;

  return {
    coverageLabel: getCoverageLabel(currentOfferSummary),
    currentPrice: formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: bestOffer.priceCents,
    }),
    discountMetric:
      officialLegoComparison?.metricLabel ?? reliableDealDiscount?.metricLabel,
    dealReason: buildDealReason({
      currentOfferSummary,
    }),
    decisionLabel,
    decisionNote,
    merchantLabel: `Nu het laagst bij ${merchantName}`,
    merchantName,
    merchantSlug,
    primaryActionHref: bestOffer.url,
    pricePositionLabel: getPricePositionLabel({
      currencyCode: bestOffer.currency,
      deltaMinor: pricePanelSnapshot?.deltaMinor,
    }),
    pricePositionTone: decisionPresentation.verdict.tone,
    reviewedLabel: `Nagekeken ${formatCheckedOn(bestOffer.checkedAt)}`,
  };
}

export function buildBrowseSetCardPriceContext({
  checkedAt,
  currencyCode = 'EUR',
  merchantName,
  priceMinor,
}: {
  checkedAt?: string;
  currencyCode?: string;
  merchantName?: string;
  priceMinor?: number;
}): CatalogSetCardPriceContext | undefined {
  if (
    typeof priceMinor !== 'number' ||
    !Number.isFinite(priceMinor) ||
    priceMinor <= 0
  ) {
    return undefined;
  }

  return {
    coverageLabel: 'Actuele prijs gevonden',
    currentPrice: `Vanaf ${formatPriceMinor({
      currencyCode,
      minorUnits: priceMinor,
    })}`,
    decisionLabel: 'Beste prijs',
    merchantLabel: merchantName
      ? `Laagst bij ${merchantName}`
      : 'Laagste bekende prijs',
    reviewedLabel: checkedAt
      ? `Nagekeken ${formatCheckedOn(checkedAt)}`
      : 'Server-side bijgewerkt',
  };
}

export function buildBrowseSetCardPriceContextBySetId<
  SetCard extends { id: string },
>({
  currentOfferSummaryBySetId,
  setCards,
}: {
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  setCards: readonly SetCard[];
}): Map<string, CatalogSetCardPriceContext> {
  const priceContextBySetId = new Map<string, CatalogSetCardPriceContext>();

  for (const setCard of setCards) {
    const bestOffer = currentOfferSummaryBySetId.get(setCard.id)?.bestOffer;
    const priceContext = buildBrowseSetCardPriceContext({
      checkedAt: bestOffer?.checkedAt,
      currencyCode: bestOffer?.currency,
      merchantName: bestOffer
        ? getPublicBestOfferMerchantName(bestOffer)
        : undefined,
      priceMinor: bestOffer?.priceCents,
    });

    if (priceContext) {
      priceContextBySetId.set(setCard.id, priceContext);
    }
  }

  return priceContextBySetId;
}

export function buildCurrentSetCardPriceContextBySetId<
  SetCard extends { id: string; theme: string },
>({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  setCards,
}: {
  catalogDiscoverySignalBySetId?: ReadonlyMap<string, CatalogDiscoverySignal>;
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  setCards: readonly SetCard[];
}): Map<string, CatalogSetCardPriceContext> {
  const priceContextBySetId = new Map<string, CatalogSetCardPriceContext>();

  for (const setCard of setCards) {
    const priceContext = buildCurrentSetCardPriceContext({
      catalogDiscoverySignal: catalogDiscoverySignalBySetId?.get(setCard.id),
      currentOfferSummary: currentOfferSummaryBySetId.get(setCard.id),
      pricePanelSnapshot: getFeaturedSetPriceContext(setCard.id),
      theme: setCard.theme,
    });

    if (priceContext) {
      priceContextBySetId.set(setCard.id, priceContext);
    }
  }

  return priceContextBySetId;
}

export function buildCurrentSearchReviewedPriceContext({
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: DealReferencePriceContext;
}): CatalogFeatureSearchReviewedPriceContext | undefined {
  const bestOffer = currentOfferSummary?.bestOffer;

  if (!bestOffer || !currentOfferSummary) {
    return undefined;
  }

  return {
    currencyCode: bestOffer.currency,
    deltaMinor: pricePanelSnapshot?.deltaMinor,
    headlinePriceMinor: bestOffer.priceCents,
    merchantName: getPublicBestOfferMerchantName(bestOffer),
    setId: currentOfferSummary.setId,
  };
}
