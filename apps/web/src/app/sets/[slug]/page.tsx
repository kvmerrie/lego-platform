import {
  getBestOffer,
  sortCatalogOffers,
  type CatalogOffer,
} from '@lego-platform/affiliate/util';
import type { Metadata } from 'next';
import React from 'react';
import {
  getCatalogPrimaryOfferAvailabilityStateBySetId,
  type CatalogCurrentOfferSummary,
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  getCatalogSetBySlug,
  listCatalogSimilarSetCards,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogFeatureSetList,
  type CatalogFeatureSetListItem,
} from '@lego-platform/catalog/feature-set-list';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import type {
  CatalogSetDetailBestDeal,
  CatalogSetDetailOfferItem,
  CatalogSetDetailSupportItem,
  CatalogSetDetailTrustSignal,
  CatalogSetDetailVerdict,
} from '@lego-platform/catalog/ui';
import {
  buildCatalogThemeSlug,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import { listPublishedArticlesByPrimarySetNumber } from '@lego-platform/content/data-access';
import type { ContentArticleListItem } from '@lego-platform/content/util';
import {
  buildSetDecisionPresentation,
  buildBrickhuntValueItems,
  buildSetDecisionSupportItems,
  buildSetDealVerdict,
  getFeaturedSetPriceContext,
  getPricePanelSnapshot,
} from '@lego-platform/pricing/data-access';
import {
  formatPriceMinor,
  type PricePanelSnapshot,
} from '@lego-platform/pricing/util';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  buildArticlePath,
  getDefaultFormattingLocale,
  publicWebBaseUrls,
  webPathnames,
} from '@lego-platform/shared/config';
import { getBrickhuntAnalyticsPriceVerdict } from '@lego-platform/shared/util';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { notFound } from 'next/navigation';
import {
  getCatalogReleaseYear,
  resolveCatalogReleaseDatePrecision,
  type CatalogSetDetail,
  type CatalogReleaseDatePrecision,
  type CatalogSetStatus,
} from '@lego-platform/catalog/util';
import { buildCurrentSetCardPriceContext } from '../../lib/current-set-card-price-context';
import { buildSimilarSetsRailDescription } from '../../lib/similar-sets-rail-copy';
import styles from './page.module.css';

export const dynamicParams = true;
export const revalidate = 300;

const BRICKHUNT_TIME_ZONE = 'Europe/Amsterdam';
const SIMILAR_SETS_RAIL_LIMIT = 20;
const SET_NEWS_RAIL_LIMIT = 4;
const SET_DETAIL_RECENT_RELEASE_LOOKBACK_DAYS = 90;
const SET_DETAIL_RECENT_RELEASE_LOOKAHEAD_DAYS = 30;
const DEFAULT_SET_DETAIL_OG_IMAGE = '/favicon.ico';
const SET_DETAIL_OG_IMAGE_WIDTH = 1200;
const SET_DETAIL_OG_IMAGE_HEIGHT = 1200;

export type SetDetailAvailabilityFallbackState =
  | 'available'
  | 'no_current_price'
  | 'no_current_stock'
  | 'retired';

function getCalendarDayValue(date: Date): number {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);

  const day = Number(
    dateParts.find((part) => part.type === 'day')?.value ?? '0',
  );
  const month = Number(
    dateParts.find((part) => part.type === 'month')?.value ?? '0',
  );
  const year = Number(
    dateParts.find((part) => part.type === 'year')?.value ?? '0',
  );

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatOfferCheckedTime(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

function formatOfferCheckedDate(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

function isEuroCatalogOffer(catalogOffer: CatalogOffer): boolean {
  return catalogOffer.currency === 'EUR';
}

function formatOfferPrice(catalogOffer: CatalogOffer): string {
  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    style: 'currency',
    currency: catalogOffer.currency,
  }).format(catalogOffer.priceCents / 100);
}

function formatMetadataPrice({
  currencyCode,
  minorUnits,
}: {
  currencyCode: string;
  minorUnits: number;
}): string {
  return formatPriceMinor({
    currencyCode,
    minorUnits,
  }).replace(/\u00a0/g, ' ');
}

function toAbsoluteMetadataUrl(url: string | undefined): string {
  const baseUrl = publicWebBaseUrls.production;

  if (!url) {
    return `${baseUrl}${DEFAULT_SET_DETAIL_OG_IMAGE}`;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'https:';
    }

    return parsedUrl.toString();
  } catch {
    return new URL(url, baseUrl).toString();
  }
}

function getMetadataImageMimeType(imageUrl: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname.toLowerCase();
    } catch {
      return imageUrl.toLowerCase();
    }
  })();

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (pathname.endsWith('.png')) {
    return 'image/png';
  }

  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }

  return undefined;
}

function isSharePreferredImageUrl(imageUrl: string | undefined): boolean {
  if (!imageUrl) {
    return false;
  }

  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname.toLowerCase();
    } catch {
      return imageUrl.toLowerCase();
    }
  })();

  return (
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.png')
  );
}

function getSetDetailMetadataImageCandidateUrl(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
): string {
  const candidates = [
    catalogSetDetail.primaryImage,
    catalogSetDetail.images?.find((image) => image.type === 'hero')?.url,
    catalogSetDetail.imageUrl,
    ...(catalogSetDetail.images?.map((image) => image.url) ?? []),
  ].filter((imageUrl): imageUrl is string => Boolean(imageUrl));
  const preferredCandidate =
    candidates.find(isSharePreferredImageUrl) ?? candidates[0];

  return toAbsoluteMetadataUrl(preferredCandidate);
}

function getSetDetailMetadataImage(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
  alt: string,
) {
  const imageUrl = getSetDetailMetadataImageCandidateUrl(catalogSetDetail);
  const imageType = getMetadataImageMimeType(imageUrl);

  return {
    url: imageUrl,
    secureUrl: imageUrl,
    alt,
    width: SET_DETAIL_OG_IMAGE_WIDTH,
    height: SET_DETAIL_OG_IMAGE_HEIGHT,
    ...(imageType ? { type: imageType } : {}),
  };
}

function shouldLogSetDetailOgImageDebug(): boolean {
  return process.env['DEBUG_SET_OG_IMAGE']?.trim().toLowerCase() === 'true';
}

export async function resolveSetDetailOgImageDebugInfo({
  fetchFn = fetch,
  imageUrl,
}: {
  fetchFn?: typeof fetch;
  imageUrl: string;
}): Promise<{
  imageUrl: string;
  ok: boolean;
  status?: number;
}> {
  try {
    const response = await fetchFn(imageUrl, {
      method: 'HEAD',
      cache: 'no-store',
    });

    return {
      imageUrl,
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return {
      imageUrl,
      ok: false,
    };
  }
}

async function logSetDetailOgImageDebug(imageUrl: string): Promise<void> {
  if (!shouldLogSetDetailOgImageDebug()) {
    return;
  }

  const debugInfo = await resolveSetDetailOgImageDebugInfo({ imageUrl });

  console.warn('[set-detail-og-image]', debugInfo);
}

function getReliableDiscountPercentage(
  pricePanelSnapshot?: Pick<
    PricePanelSnapshot,
    'deltaMinor' | 'referencePriceMinor'
  >,
): number | undefined {
  if (
    typeof pricePanelSnapshot?.deltaMinor !== 'number' ||
    pricePanelSnapshot.deltaMinor >= 0 ||
    typeof pricePanelSnapshot.referencePriceMinor !== 'number' ||
    pricePanelSnapshot.referencePriceMinor <= 0
  ) {
    return undefined;
  }

  const percentage = Math.round(
    (Math.abs(pricePanelSnapshot.deltaMinor) /
      pricePanelSnapshot.referencePriceMinor) *
      100,
  );

  return percentage >= 5 ? percentage : undefined;
}

function getNextBestOfferPriceDeltaMinor(
  offers: readonly CatalogOffer[],
  bestOffer: CatalogOffer,
): number | undefined {
  const nextBestOffer = sortCatalogOffers(offers).find(
    (catalogOffer) => catalogOffer.url !== bestOffer.url,
  );
  const deltaMinor = nextBestOffer
    ? nextBestOffer.priceCents - bestOffer.priceCents
    : undefined;

  return typeof deltaMinor === 'number' && deltaMinor > 0
    ? deltaMinor
    : undefined;
}

export function buildSetDetailMetadata({
  catalogSetDetail,
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  catalogSetDetail: CatalogSetDetail;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: PricePanelSnapshot;
}): Metadata {
  const bestOffer = currentOfferSummary?.bestOffer;
  const discountPercentage = getReliableDiscountPercentage(pricePanelSnapshot);
  const metadataImage = getSetDetailMetadataImage(
    catalogSetDetail,
    `${catalogSetDetail.name} setbeeld`,
  );
  const priceLabel = bestOffer
    ? formatMetadataPrice({
        currencyCode: bestOffer.currency,
        minorUnits: bestOffer.priceCents,
      })
    : undefined;
  const titleParts = [
    catalogSetDetail.name,
    priceLabel ? `Nu ${priceLabel}` : undefined,
    discountPercentage ? `${discountPercentage}% korting` : undefined,
  ].filter(Boolean);
  const title = titleParts.join('. ');
  const nextBestPriceDeltaMinor =
    bestOffer && currentOfferSummary
      ? getNextBestOfferPriceDeltaMinor(currentOfferSummary.offers, bestOffer)
      : undefined;
  const fallbackDescriptionParts = [
    `LEGO ${catalogSetDetail.theme}-set`,
    catalogSetDetail.releaseYear
      ? `uit ${catalogSetDetail.releaseYear}`
      : undefined,
    catalogSetDetail.pieces > 0
      ? `met ${catalogSetDetail.pieces} stenen`
      : undefined,
  ].filter(Boolean);
  const description =
    bestOffer && typeof nextBestPriceDeltaMinor === 'number'
      ? `Laagste nagekeken prijs bij ${bestOffer.merchantName}. ${formatMetadataPrice(
          {
            currencyCode: bestOffer.currency,
            minorUnits: nextBestPriceDeltaMinor,
          },
        )} goedkoper dan de rest.`
      : bestOffer && (currentOfferSummary?.offers.length ?? 0) > 1
        ? `Nu verkrijgbaar bij ${currentOfferSummary?.offers.length} winkels. Laagste nagekeken prijs: ${priceLabel}.`
        : bestOffer
          ? `Laagste nagekeken prijs bij ${bestOffer.merchantName}: ${priceLabel}.`
          : `${fallbackDescriptionParts.join(' ')}. Prijs volgt nog; volg deze set zodra er een koopmoment is.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [metadataImage],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [metadataImage],
    },
  };
}

function formatOfferCheckedAt(checkedAt: string): string {
  return formatOfferCheckedAtCompact(checkedAt);
}

function formatOfferCheckedAtCompact(checkedAt: string): string {
  const checkedDate = new Date(checkedAt);

  if (Number.isNaN(checkedDate.getTime())) {
    return '';
  }

  const dayDifference =
    getCalendarDayValue(new Date()) - getCalendarDayValue(checkedDate);
  const timeLabel = formatOfferCheckedTime(checkedAt);

  if (dayDifference === 0) {
    return `Vandaag om ${timeLabel}`;
  }

  if (dayDifference === 1) {
    return `Gisteren om ${timeLabel}`;
  }

  if (dayDifference === 2) {
    return `Eergisteren om ${timeLabel}`;
  }

  return `${formatOfferCheckedDate(checkedAt)} om ${timeLabel}`;
}

function getSetDetailReleaseTimestamp({
  releaseDate,
  releaseDatePrecision,
  releaseYear,
}: {
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
}): number | undefined {
  const resolvedPrecision = resolveCatalogReleaseDatePrecision({
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  });
  const parsedReleaseDate = releaseDate
    ? Date.parse(`${releaseDate}T00:00:00Z`)
    : Number.NaN;

  if (
    (resolvedPrecision === 'day' || resolvedPrecision === 'month') &&
    Number.isFinite(parsedReleaseDate)
  ) {
    return parsedReleaseDate;
  }

  return undefined;
}

export function isCurrentOrRecentCatalogRelease({
  now = new Date(),
  releaseDate,
  releaseDatePrecision,
  releaseYear,
}: {
  now?: Date;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
}): boolean {
  const currentYear = now.getUTCFullYear();
  const resolvedReleaseYear = getCatalogReleaseYear({
    releaseDate,
    releaseYear,
  });

  if (resolvedReleaseYear === currentYear) {
    return true;
  }

  const releaseTimestamp = getSetDetailReleaseTimestamp({
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  });

  if (typeof releaseTimestamp !== 'number') {
    return false;
  }

  const lowerBound =
    now.getTime() - SET_DETAIL_RECENT_RELEASE_LOOKBACK_DAYS * 86_400_000;
  const upperBound =
    now.getTime() + SET_DETAIL_RECENT_RELEASE_LOOKAHEAD_DAYS * 86_400_000;

  return releaseTimestamp >= lowerBound && releaseTimestamp <= upperBound;
}

export function resolveSetDetailAvailabilityFallbackState({
  hasInStockOffer,
  now = new Date(),
  primaryOfferAvailability,
  releaseDate,
  releaseDatePrecision,
  releaseYear,
  setStatus,
}: {
  hasInStockOffer: boolean;
  now?: Date;
  primaryOfferAvailability: {
    primarySeedCount: number;
    validPrimaryOfferCount: number;
  };
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
  setStatus?: CatalogSetStatus;
}): SetDetailAvailabilityFallbackState {
  const hasExplicitRetiredLifecycle = setStatus === 'retired';

  if (
    hasExplicitRetiredLifecycle &&
    !hasInStockOffer &&
    primaryOfferAvailability.validPrimaryOfferCount === 0
  ) {
    return 'retired';
  }

  const hasTrackedOfferGap =
    primaryOfferAvailability.primarySeedCount > 0 &&
    primaryOfferAvailability.validPrimaryOfferCount === 0 &&
    !hasInStockOffer;

  if (!hasTrackedOfferGap) {
    return 'available';
  }

  return isCurrentOrRecentCatalogRelease({
    now,
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  })
    ? 'no_current_price'
    : 'no_current_stock';
}

function getOfferStockLabel(
  availability: CatalogOffer['availability'],
): string {
  if (availability === 'in_stock') {
    return 'Op voorraad';
  }

  if (availability === 'out_of_stock') {
    return 'Uitverkocht';
  }

  return 'Voorraad onbekend';
}

function buildMerchantCoverageLabel(
  merchantCount?: number,
): string | undefined {
  if (typeof merchantCount !== 'number' || merchantCount <= 0) {
    return undefined;
  }

  return `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`;
}

function buildOfferSummaryLabel({
  merchantCount,
  observedAt,
}: {
  merchantCount?: number;
  observedAt?: string;
}): string | undefined {
  const parts = [
    buildMerchantCoverageLabel(merchantCount),
    observedAt ? formatOfferCheckedAtCompact(observedAt) : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function buildBestOfferRankingLabel({
  availability,
  merchantCount,
}: {
  availability: CatalogOffer['availability'];
  merchantCount?: number;
}): string {
  if (typeof merchantCount === 'number' && merchantCount <= 1) {
    return availability === 'in_stock'
      ? 'Enige nagekeken prijs op voorraad.'
      : 'Enige nagekeken prijs nu.';
  }

  if (availability === 'in_stock') {
    return 'Laagste nagekeken prijs op voorraad.';
  }

  if (availability === 'unknown') {
    return 'Laagste nagekeken prijs, voorraad nog onzeker.';
  }

  return 'Laagste nagekeken prijs, nu uitverkocht.';
}

function buildOfferRankingLabel({
  bestOffer,
  catalogOffer,
}: {
  bestOffer?: CatalogOffer | null;
  catalogOffer: CatalogOffer;
}): string | undefined {
  if (!bestOffer) {
    return undefined;
  }

  if (bestOffer.url === catalogOffer.url) {
    return bestOffer.availability === 'in_stock'
      ? 'Laagste prijs op voorraad'
      : 'Laagste nagekeken prijs';
  }

  const priceDeltaMinor = catalogOffer.priceCents - bestOffer.priceCents;

  if (priceDeltaMinor < 0) {
    const lowerPriceLabel = formatPriceMinor({
      currencyCode: catalogOffer.currency,
      minorUnits: Math.abs(priceDeltaMinor),
    });

    if (catalogOffer.availability === 'out_of_stock') {
      return `${lowerPriceLabel} lager, maar uitverkocht`;
    }

    if (catalogOffer.availability === 'unknown') {
      return `${lowerPriceLabel} lager, maar voorraad onbekend`;
    }

    return `${lowerPriceLabel} lager, maar niet de beste keuze nu`;
  }

  if (priceDeltaMinor === 0) {
    return 'Zelfde prijs als de beste optie';
  }

  return `${formatPriceMinor({
    currencyCode: catalogOffer.currency,
    minorUnits: priceDeltaMinor,
  })} hoger dan de beste optie`;
}

function buildBestDeal({
  catalogOffer,
  decisionPresentation,
  dealVerdict,
  merchantCount,
  setId,
  pricePanelSnapshot,
  theme,
}: {
  catalogOffer?: CatalogOffer | null;
  decisionPresentation: ReturnType<typeof buildSetDecisionPresentation>;
  dealVerdict: ReturnType<typeof buildSetDealVerdict>;
  merchantCount?: number;
  setId: string;
  pricePanelSnapshot?: PricePanelSnapshot;
  theme: string;
}): CatalogSetDetailBestDeal | undefined {
  if (!catalogOffer && !pricePanelSnapshot) {
    return undefined;
  }

  if (!catalogOffer && pricePanelSnapshot) {
    const coverageLabel = buildMerchantCoverageLabel(merchantCount);

    return {
      checkedLabel: formatOfferCheckedAtCompact(pricePanelSnapshot.observedAt),
      coverageLabel,
      decisionHelper: decisionPresentation.noOfferCopy,
      decisionLabel: dealVerdict.label,
      decisionTone: dealVerdict.tone,
      eyebrow: 'Prijsbeeld nu',
      merchantLabel: decisionPresentation.noOfferTitle,
      price: formatPriceMinor({
        currencyCode: pricePanelSnapshot.currencyCode,
        minorUnits: pricePanelSnapshot.headlinePriceMinor,
      }),
      rankingLabel:
        [pricePanelSnapshot.lowestAvailabilityLabel, coverageLabel]
          .filter(Boolean)
          .join(' · ') || undefined,
      stockLabel:
        pricePanelSnapshot.lowestAvailabilityLabel ?? 'Prijs wordt gevolgd',
    };
  }

  if (!catalogOffer) {
    return undefined;
  }

  return {
    affiliateNote:
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
    ctaHref: catalogOffer.url,
    ctaLabel: `Bekijk bij ${catalogOffer.merchantName}`,
    ctaTone: dealVerdict.tone === 'positive' ? 'accent' : 'secondary',
    coverageLabel: buildMerchantCoverageLabel(merchantCount),
    decisionHelper: dealVerdict.explanation,
    decisionLabel: dealVerdict.label,
    decisionTone: dealVerdict.tone,
    eyebrow: 'Beste deal nu',
    merchantLabel: catalogOffer.merchantName,
    price: formatOfferPrice(catalogOffer),
    rankingLabel: buildBestOfferRankingLabel({
      availability: catalogOffer.availability,
      merchantCount,
    }),
    stockLabel: getOfferStockLabel(catalogOffer.availability),
    trackingEvent: {
      event: 'offer_click',
      properties: {
        merchantCount,
        merchantName: catalogOffer.merchantName,
        offerPlacement: 'best_offer',
        offerRole: 'best',
        pageSurface: 'set_detail',
        priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
        rankPosition: 1,
        setId,
        theme,
      },
    },
  };
}

function buildOfferList(
  catalogOffers: readonly CatalogOffer[],
  {
    dealVerdict,
    merchantCount,
    setId,
    theme,
  }: {
    dealVerdict: {
      tone?: 'info' | 'neutral' | 'positive' | 'warning';
    };
    merchantCount?: number;
    setId: string;
    theme: string;
  },
  bestOffer?: CatalogOffer | null,
): CatalogSetDetailOfferItem[] {
  return sortCatalogOffers(catalogOffers).map((catalogOffer, index) => ({
    checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
    ctaHref: catalogOffer.url,
    ctaLabel: `Bekijk bij ${catalogOffer.merchantName}`,
    isBest: bestOffer?.url === catalogOffer.url,
    merchantLabel: catalogOffer.merchantName,
    price: formatOfferPrice(catalogOffer),
    rankingLabel: buildOfferRankingLabel({
      bestOffer,
      catalogOffer,
    }),
    stockLabel: getOfferStockLabel(catalogOffer.availability),
    trackingEvent: {
      event: 'offer_click',
      properties: {
        merchantCount,
        merchantName: catalogOffer.merchantName,
        offerPlacement: 'comparison_row',
        offerRole: bestOffer?.url === catalogOffer.url ? 'best' : 'alternative',
        pageSurface: 'set_detail',
        priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
        rankPosition: index + 1,
        setId,
        theme,
      },
    },
  }));
}

function buildTrustSignals({
  bestOffer,
  merchantCount,
  observedAt,
}: {
  bestOffer?: CatalogOffer | null;
  merchantCount?: number;
  observedAt?: string;
}): CatalogSetDetailTrustSignal[] {
  return [
    ...(bestOffer || observedAt
      ? [
          {
            label: 'Laatst nagekeken',
            value: formatOfferCheckedAt(
              bestOffer?.checkedAt ?? observedAt ?? '',
            ),
          },
        ]
      : []),
    ...(typeof merchantCount === 'number'
      ? [
          {
            label: 'Winkels nagekeken',
            value: `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`,
          },
        ]
      : []),
  ];
}

function buildTrackedAvailabilityFallbackBestDeal({
  checkedAt,
  primarySeedCount,
  state,
}: {
  checkedAt?: string;
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailBestDeal {
  const sharedFields = {
    checkedLabel: checkedAt
      ? formatOfferCheckedAtCompact(checkedAt)
      : 'Recent gecontroleerd',
    coverageLabel: buildMerchantCoverageLabel(primarySeedCount),
    decisionTone: 'neutral' as const,
    eyebrow: 'Beschikbaarheid nu',
  };

  if (state === 'retired') {
    return {
      ...sharedFields,
      decisionHelper:
        'Bij de vaste winkels zien we nu geen nieuwe voorraad meer. Deze set lijkt uit productie en duikt vooral nog op via losse restvoorraad.',
      decisionLabel: 'Uit productie',
      merchantLabel: 'Niet meer verkrijgbaar',
      price: 'Niet meer verkrijgbaar',
      stockLabel: 'Soms nog tweedehands te vinden',
    };
  }

  if (state === 'no_current_price') {
    return {
      ...sharedFields,
      decisionHelper:
        'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
      decisionLabel: 'Nog geen actuele prijs',
      merchantLabel: 'Nog geen actuele prijs',
      price: 'Nog geen actuele prijs',
      stockLabel: 'Nog geen actuele voorraad',
    };
  }

  return {
    ...sharedFields,
    decisionHelper:
      'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    decisionLabel: 'Geen actuele voorraad gevonden',
    merchantLabel: 'Geen actuele voorraad gevonden',
    price: 'Geen actuele voorraad gevonden',
    stockLabel: 'Geen actuele voorraad',
  };
}

function buildTrackedAvailabilityFallbackDealVerdict({
  state,
}: {
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailVerdict {
  if (state === 'retired') {
    return {
      explanation:
        'Bij de vaste winkels zien we nu geen nieuwe voorraad meer. Deze set lijkt uit productie en vooral nog incidenteel vindbaar.',
      label: 'Niet meer verkrijgbaar',
      tone: 'neutral' as const,
    };
  }

  if (state === 'no_current_price') {
    return {
      explanation:
        'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
      label: 'Nog geen actuele prijs',
      tone: 'neutral' as const,
    };
  }

  return {
    explanation:
      'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    label: 'Geen actuele voorraad gevonden',
    tone: 'neutral' as const,
  };
}

function buildTrackedAvailabilityFallbackSupportItems({
  primarySeedCount,
  state,
}: {
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailSupportItem[] {
  return [
    {
      id: 'availability-primary-shops',
      text:
        state === 'no_current_price'
          ? 'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.'
          : state === 'retired'
            ? 'Bij de vaste winkels zien we nu geen nieuwe voorraad meer.'
            : 'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    },
    ...(primarySeedCount > 0
      ? [
          {
            id: 'availability-merchant-coverage',
            text: `${primarySeedCount} winkel${primarySeedCount === 1 ? '' : 's'} nagekeken.`,
          },
        ]
      : []),
    ...(state === 'retired'
      ? [
          {
            id: 'availability-secondhand',
            text: 'Soms duikt hij nog op via tweedehands of losse restvoorraad.',
          },
        ]
      : []),
  ];
}

function buildTrackedAvailabilityFallbackTrustSignals({
  checkedAt,
  primarySeedCount,
  state,
}: {
  checkedAt?: string;
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailTrustSignal[] {
  return [
    {
      label: 'Beschikbaarheid',
      value:
        state === 'no_current_price'
          ? 'Nog geen actuele voorraad'
          : state === 'retired'
            ? 'Niet meer verkrijgbaar'
            : 'Geen actuele voorraad gevonden',
    },
    ...(checkedAt
      ? [
          {
            label: 'Laatst nagekeken',
            value: formatOfferCheckedAt(checkedAt),
          },
        ]
      : []),
    ...(primarySeedCount > 0
      ? [
          {
            label: 'Winkels nagekeken',
            value: `${primarySeedCount} winkel${primarySeedCount === 1 ? '' : 's'} nagekeken`,
          },
        ]
      : []),
    ...(state === 'retired'
      ? [
          {
            label: 'Alternatief',
            value: 'Soms nog tweedehands te vinden',
          },
        ]
      : []),
  ];
}

function toSimilarSetRailItems({
  currentOfferSummaryBySetId,
  setCards,
}: {
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  setCards: readonly CatalogFeatureSetListItem[];
}): CatalogFeatureSetListItem[] {
  return setCards.map((setCard) => {
    const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
    const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);

    return {
      ...setCard,
      ctaMode: 'default' as const,
      priceContext: buildCurrentSetCardPriceContext({
        currentOfferSummary,
        pricePanelSnapshot: featuredSetPriceContext,
        theme: setCard.theme,
      }),
    };
  });
}

function formatSetNewsArticleDate(date: string): string {
  const parsedDate = Date.parse(`${date}T00:00:00Z`);

  if (!Number.isFinite(parsedDate)) {
    return date;
  }

  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'long',
    timeZone: BRICKHUNT_TIME_ZONE,
    year: 'numeric',
  }).format(new Date(parsedDate));
}

function getArticleThemeSlug(
  article: Pick<ContentArticleListItem, 'theme' | 'themeSlug'>,
): string {
  return article.themeSlug ?? normalizeTheme(article.theme)?.key ?? 'lego';
}

export function SetNewsRail({
  articles,
}: {
  articles: readonly ContentArticleListItem[];
}) {
  if (!articles.length) {
    return null;
  }

  return (
    <section aria-labelledby="set-news-title" className={styles.setNewsRail}>
      <div className={styles.setNewsHeader}>
        <p className={styles.setNewsEyebrow}>Updates</p>
        <h2 className={styles.setNewsTitle} id="set-news-title">
          Laatste updates
        </h2>
      </div>
      <div className={styles.setNewsGrid}>
        {articles.slice(0, SET_NEWS_RAIL_LIMIT).map((article) => (
          <a
            className={styles.setNewsCard}
            href={buildArticlePath(article.slug, getArticleThemeSlug(article))}
            key={article.slug}
          >
            <time className={styles.setNewsDate} dateTime={article.date}>
              {formatSetNewsArticleDate(article.date)}
            </time>
            <h3 className={styles.setNewsCardTitle}>{article.title}</h3>
            <p className={styles.setNewsDescription}>{article.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export async function generateStaticParams() {
  return (await listCatalogSetSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const catalogSetDetail = await getCatalogSetBySlug({
    slug,
  });

  if (!catalogSetDetail) {
    return {};
  }

  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      cacheOptions: {
        revalidateSeconds: revalidate,
      },
      setIds: [catalogSetDetail.id],
    });

  const metadata = buildSetDetailMetadata({
    catalogSetDetail,
    currentOfferSummary: currentOfferSummaryBySetId.get(catalogSetDetail.id),
    pricePanelSnapshot: getPricePanelSnapshot(catalogSetDetail.id),
  });

  const metadataImage = Array.isArray(metadata.openGraph?.images)
    ? metadata.openGraph.images[0]
    : metadata.openGraph?.images;
  const metadataImageUrl =
    typeof metadataImage === 'string' || metadataImage instanceof URL
      ? metadataImage.toString()
      : metadataImage?.url?.toString();

  if (metadataImageUrl) {
    await logSetDetailOgImageDebug(metadataImageUrl);
  }

  return metadata;
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogSetDetail = await getCatalogSetBySlug({
    slug,
  });

  if (!catalogSetDetail) {
    notFound();
  }

  const liveSetDetailOffers = await listCatalogSetLiveOffersBySetId({
    cacheOptions: {
      revalidateSeconds: revalidate,
    },
    setId: catalogSetDetail.id,
  });
  const catalogDiscoverySignalBySetId =
    await listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: revalidate,
      },
    });
  const primaryOfferAvailability =
    await getCatalogPrimaryOfferAvailabilityStateBySetId({
      setId: catalogSetDetail.id,
    });
  // Only live validated offers count as current public pricing.
  const localizedSetDetailOffers =
    liveSetDetailOffers.filter(isEuroCatalogOffer);
  const hasInStockOffer = localizedSetDetailOffers.some(
    (catalogOffer) => catalogOffer.availability === 'in_stock',
  );
  const availabilityFallbackState = resolveSetDetailAvailabilityFallbackState({
    hasInStockOffer,
    primaryOfferAvailability,
    releaseDate: catalogSetDetail.releaseDate,
    releaseDatePrecision: catalogSetDetail.releaseDatePrecision,
    releaseYear: catalogSetDetail.releaseYear,
    setStatus: catalogSetDetail.setStatus,
  });
  const hasTrackedAvailabilityFallback =
    availabilityFallbackState !== 'available';
  const bestOffer = getBestOffer(localizedSetDetailOffers);
  const pricePanelSnapshot = getPricePanelSnapshot(catalogSetDetail.id);
  const hasLiveCurrentOffer =
    Boolean(bestOffer) && !hasTrackedAvailabilityFallback;
  const defaultDecisionPresentation = buildSetDecisionPresentation({
    hasCurrentOffer: hasLiveCurrentOffer,
    pricePanelSnapshot,
    theme: catalogSetDetail.theme,
  });
  const defaultDealVerdict = buildSetDealVerdict(pricePanelSnapshot, {
    hasCurrentOffer: hasLiveCurrentOffer,
    theme: catalogSetDetail.theme,
  });
  const dealVerdict: CatalogSetDetailVerdict = hasTrackedAvailabilityFallback
    ? buildTrackedAvailabilityFallbackDealVerdict({
        state: availabilityFallbackState,
      })
    : defaultDealVerdict;
  const trackedMerchantCount = localizedSetDetailOffers.length;
  const unavailableCheckedAt =
    primaryOfferAvailability.latestPrimaryOfferCheckedAt ??
    pricePanelSnapshot?.observedAt;
  const unavailablePrimarySeedCount = primaryOfferAvailability.primarySeedCount;
  const analyticsPriceVerdict = hasTrackedAvailabilityFallback
    ? 'neutral'
    : getBrickhuntAnalyticsPriceVerdict(defaultDealVerdict.tone);
  const similarSetCards = await listCatalogSimilarSetCards({
    currentSetCard: {
      id: catalogSetDetail.id,
      name: catalogSetDetail.name,
      pieces: catalogSetDetail.pieces,
      releaseYear: catalogSetDetail.releaseYear,
      theme: catalogSetDetail.theme,
    },
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    limit: SIMILAR_SETS_RAIL_LIMIT,
    referenceBestPriceMinor:
      bestOffer?.priceCents ?? pricePanelSnapshot?.headlinePriceMinor,
  });
  const similarSetCurrentOfferSummaryBySetId =
    similarSetCards.length > 0
      ? await listCatalogCurrentOfferSummariesBySetIds({
          cacheOptions: {
            revalidateSeconds: revalidate,
          },
          setIds: similarSetCards.map((setCard) => setCard.id),
        })
      : new Map();
  const similarSetRailItems = toSimilarSetRailItems({
    currentOfferSummaryBySetId: similarSetCurrentOfferSummaryBySetId,
    setCards: similarSetCards,
  });
  const setNewsArticles = await listPublishedArticlesByPrimarySetNumber({
    limit: SET_NEWS_RAIL_LIMIT,
    setNumber: catalogSetDetail.id,
  });

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail
        bestDeal={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackBestDeal({
                checkedAt: unavailableCheckedAt,
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildBestDeal({
                catalogOffer: bestOffer,
                decisionPresentation: defaultDecisionPresentation,
                dealVerdict: defaultDealVerdict,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                setId: catalogSetDetail.id,
                pricePanelSnapshot,
                theme: catalogSetDetail.theme,
              })
        }
        brickhuntValueItems={buildBrickhuntValueItems({
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
        })}
        catalogSetDetail={catalogSetDetail}
        dealSupportItems={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackSupportItems({
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildSetDecisionSupportItems({
                hasCurrentOffer: hasLiveCurrentOffer,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                pricePanelSnapshot,
              })
        }
        dealVerdict={dealVerdict}
        offerList={
          hasTrackedAvailabilityFallback
            ? []
            : buildOfferList(
                localizedSetDetailOffers,
                {
                  dealVerdict: defaultDealVerdict,
                  merchantCount:
                    trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                  setId: catalogSetDetail.id,
                  theme: catalogSetDetail.theme,
                },
                bestOffer,
              )
        }
        offerSummaryLabel={
          hasTrackedAvailabilityFallback
            ? undefined
            : buildOfferSummaryLabel({
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                observedAt:
                  bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
              })
        }
        ownershipActions={
          <>
            <CollectionFeatureOwnedToggle
              setId={catalogSetDetail.id}
              variant="compact"
            />
          </>
        }
        priceAlertAction={
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount:
                trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
              pageSurface: 'set_detail',
              priceVerdict: analyticsPriceVerdict,
              setId: catalogSetDetail.id,
              theme: catalogSetDetail.theme,
            }}
            productIntent="price-alert"
            setId={catalogSetDetail.id}
            variant="product"
          />
        }
        priceHistoryPanel={
          <PricingFeaturePriceHistory
            hasCurrentOffer={hasLiveCurrentOffer}
            merchantCount={
              trackedMerchantCount > 0 ? trackedMerchantCount : undefined
            }
            setId={catalogSetDetail.id}
            variant="set-detail"
          />
        }
        similarSetsRail={
          similarSetRailItems.length > 0 ? (
            <CatalogFeatureSetList
              description={buildSimilarSetsRailDescription(
                catalogSetDetail.name,
              )}
              eyebrow="Hierna kijken"
              sectionId="similar-sets"
              setCards={similarSetRailItems}
              signalText={`${similarSetRailItems.length} sets in ${catalogSetDetail.theme} met een vergelijkbare schaal of prijszone`}
              tone="muted"
              title="Vergelijkbare sets"
            />
          ) : undefined
        }
        setNewsRail={
          setNewsArticles.length > 0 ? (
            <SetNewsRail articles={setNewsArticles} />
          ) : undefined
        }
        themeDirectoryHref={buildWebPath(webPathnames.themes)}
        themeHref={buildThemePath(
          buildCatalogThemeSlug(catalogSetDetail.theme),
        )}
        trustSignals={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackTrustSignals({
                checkedAt: unavailableCheckedAt,
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildTrustSignals({
                bestOffer,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                observedAt:
                  bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
              })
        }
        followCopy={
          availabilityFallbackState === 'retired'
            ? 'Hou deze set op je lijst als je hem later nog eens wilt spotten.'
            : availabilityFallbackState === 'no_current_price'
              ? 'Zodra we actuele voorraad zien bij de winkels die Brickhunt controleert, zie je dat hier terug.'
              : availabilityFallbackState === 'no_current_stock'
                ? 'Zodra er weer nieuwe voorraad opduikt bij de winkels die Brickhunt volgt, zie je dat hier terug.'
                : defaultDecisionPresentation.followCopy
        }
        followEyebrow={
          hasTrackedAvailabilityFallback
            ? 'Beschikbaarheid'
            : defaultDecisionPresentation.followEyebrow
        }
        followTitle={
          availabilityFallbackState === 'retired'
            ? 'Soms nog tweedehands te vinden'
            : availabilityFallbackState === 'no_current_price'
              ? 'We volgen deze set'
              : availabilityFallbackState === 'no_current_stock'
                ? 'Volg deze set'
                : defaultDecisionPresentation.followTitle
        }
      />
    </ShellWeb>
  );
}
