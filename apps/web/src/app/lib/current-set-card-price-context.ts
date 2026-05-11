import type {
  CatalogCurrentOfferSummary,
  CatalogDiscoverySignal,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogFeatureSearchReviewedPriceContext } from '@lego-platform/catalog/feature-search-results';
import type { CatalogSetCardPriceContext } from '@lego-platform/catalog/ui';
import { buildSetDecisionPresentation } from '@lego-platform/pricing/data-access';
import {
  formatPriceMinor,
  type FeaturedSetPriceContext,
} from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';

const DEAL_REASON_MIN_MERCHANT_COUNT = 2;
const DEAL_REASON_MIN_PRICE_SPREAD_MINOR = 100;
const DEAL_REASON_MIN_REFERENCE_DISCOUNT_MINOR = 1000;
const DEAL_REASON_MIN_REFERENCE_DISCOUNT_RATIO = 0.03;

export interface ReliableDealDiscount {
  absoluteMinor: number;
  percentage: number;
  metricLabel: string;
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

export function buildReliableDealDiscount({
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: FeaturedSetPriceContext;
}): ReliableDealDiscount | undefined {
  const bestOffer = currentOfferSummary?.bestOffer;
  const referencePriceMinor = pricePanelSnapshot?.referencePriceMinor;

  if (
    !bestOffer ||
    !currentOfferSummary ||
    typeof referencePriceMinor !== 'number' ||
    referencePriceMinor <= 0 ||
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

  if (
    absoluteMinor < DEAL_REASON_MIN_REFERENCE_DISCOUNT_MINOR ||
    percentage < DEAL_REASON_MIN_REFERENCE_DISCOUNT_RATIO * 100
  ) {
    return undefined;
  }

  return {
    absoluteMinor,
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
  catalogDiscoverySignal,
  currentOfferSummary,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary: CatalogCurrentOfferSummary;
}): string | undefined {
  const bestOffer = currentOfferSummary.bestOffer;

  if (!bestOffer) {
    return undefined;
  }

  const hasReviewedMarket =
    currentOfferSummary.offers.length >= DEAL_REASON_MIN_MERCHANT_COUNT;

  if (
    hasReviewedMarket &&
    typeof catalogDiscoverySignal?.priceSpreadMinor === 'number' &&
    catalogDiscoverySignal.priceSpreadMinor >=
      DEAL_REASON_MIN_PRICE_SPREAD_MINOR
  ) {
    return `${formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: catalogDiscoverySignal.priceSpreadMinor,
    })} goedkoper dan de rest`;
  }

  if (
    hasReviewedMarket &&
    typeof catalogDiscoverySignal?.priceSpreadMinor === 'number' &&
    catalogDiscoverySignal.priceSpreadMinor === 0
  ) {
    return 'Laagste prijs nu';
  }

  return undefined;
}

export function buildCurrentSetCardPriceContext({
  catalogDiscoverySignal,
  currentOfferSummary,
  pricePanelSnapshot,
  theme,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: FeaturedSetPriceContext;
  theme: string;
}): CatalogSetCardPriceContext | undefined {
  const bestOffer = currentOfferSummary?.bestOffer;

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
  const decisionLabel = reliableDealDiscount
    ? 'Goede deal'
    : decisionPresentation.cardLabel === 'Actuele prijzen binnen' ||
        decisionPresentation.cardLabel === 'Prijsdata nog beperkt'
      ? 'Actuele prijs binnen'
      : decisionPresentation.cardLabel;
  const decisionNote = decisionPresentation.cardSupportingCopy?.includes(
    'bouwt',
  )
    ? undefined
    : decisionPresentation.cardSupportingCopy;

  return {
    coverageLabel: getCoverageLabel(currentOfferSummary),
    currentPrice: formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: bestOffer.priceCents,
    }),
    discountMetric: reliableDealDiscount?.metricLabel,
    dealReason: buildDealReason({
      catalogDiscoverySignal,
      currentOfferSummary,
    }),
    decisionLabel,
    decisionNote,
    merchantLabel: `Nu het laagst bij ${bestOffer.merchantName}`,
    primaryActionHref: bestOffer.url,
    pricePositionLabel: getPricePositionLabel({
      currencyCode: bestOffer.currency,
      deltaMinor: pricePanelSnapshot?.deltaMinor,
    }),
    pricePositionTone: decisionPresentation.verdict.tone,
    reviewedLabel: `Nagekeken ${formatCheckedOn(bestOffer.checkedAt)}`,
  };
}

export function buildCurrentSearchReviewedPriceContext({
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: FeaturedSetPriceContext;
}): CatalogFeatureSearchReviewedPriceContext | undefined {
  const bestOffer = currentOfferSummary?.bestOffer;

  if (!bestOffer || !currentOfferSummary) {
    return undefined;
  }

  return {
    currencyCode: bestOffer.currency,
    deltaMinor: pricePanelSnapshot?.deltaMinor,
    headlinePriceMinor: bestOffer.priceCents,
    merchantName: bestOffer.merchantName,
    setId: currentOfferSummary.setId,
  };
}
