import type { CatalogCurrentOfferSummary } from '@lego-platform/catalog/data-access-web';
import type { CatalogFeatureSearchReviewedPriceContext } from '@lego-platform/catalog/feature-search-results';
import type { CatalogSetCardPriceContext } from '@lego-platform/catalog/ui';
import { buildSetDecisionPresentation } from '@lego-platform/pricing/data-access';
import {
  formatPriceMinor,
  type FeaturedSetPriceContext,
} from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';

function formatCheckedOn(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
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

export function buildCurrentSetCardPriceContext({
  currentOfferSummary,
  pricePanelSnapshot,
  theme,
}: {
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

  return {
    coverageLabel: getCoverageLabel(currentOfferSummary),
    currentPrice: formatPriceMinor({
      currencyCode: bestOffer.currency,
      minorUnits: bestOffer.priceCents,
    }),
    decisionLabel: decisionPresentation.cardLabel,
    decisionNote: decisionPresentation.cardSupportingCopy,
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
