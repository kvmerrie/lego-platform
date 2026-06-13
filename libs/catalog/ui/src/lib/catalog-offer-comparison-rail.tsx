'use client';

import { useCallback, useState } from 'react';
import { ChevronRight, Clock3, Eye } from 'lucide-react';
import {
  ActionChrome,
  ActionLink,
  Badge,
  Panel,
  ResponsiveDialog,
  VisuallyHidden,
} from '@lego-platform/shared/ui';
import { buildBrickhuntAnalyticsAttributes } from '@lego-platform/shared/util';
import type { CatalogOfferItem } from './catalog-commerce-ui';
import styles from './catalog-ui.module.css';

interface CatalogOfferComparisonRailProps {
  className?: string;
  id?: string;
  offers: readonly CatalogOfferItem[];
  setDetailHref?: string;
  summaryLabel?: string;
}

const MAX_VISIBLE_OFFER_RAIL_ITEMS = 20;
const CLOSE_PRICE_DELTA_MINOR = 100;

interface CompactOfferPresentation {
  actionLabel: string;
  overlayCheckedLabel: string;
  railCheckedLabel: string;
  railCheckedTitle: string;
  confidenceLabel?: string;
  deltaLabel?: string;
  isBestDeal: boolean;
  merchantId?: string;
  merchantKey?: string;
  merchantLabel: string;
  merchantSlug?: string;
  price: string;
  priceComparisonState:
    | 'best'
    | 'close'
    | 'higher'
    | 'lower-unavailable'
    | 'same'
    | 'unknown';
  stockLabel: string;
  stockState: 'available' | 'limited' | 'out' | 'unknown';
}

interface CompactOfferComparisonContext {
  bestPriceMinor?: number;
  comparedOfferCount: number;
  nextBestAvailablePriceMinor?: number;
  reviewedInStockOfferCount: number;
}

interface MerchantFaviconInput {
  merchantId?: string;
  merchantKey?: string;
  merchantLabel?: string;
  merchantName?: string;
  merchantSlug?: string;
}

const MERCHANT_FAVICON_BASE_PATH = '/merchant-favicons';

const MERCHANT_FAVICON_BY_KEY: Record<string, string> = {
  alternate: 'alternate.png',
  'amazon-nl': 'amazon-nl.ico',
  amazon: 'amazon-nl.ico',
  bol: 'bol.ico',
  brickfever: 'brickfever.png',
  conrad: 'conrad.webp',
  coolblue: 'coolblue.png',
  coppens: 'coppenswarenhuis.png',
  coppenswarenhuis: 'coppenswarenhuis.png',
  goodbricks: 'goodbricks.png',
  intertoys: 'intertoys.ico',
  joybuy: 'joybuy.ico',
  lego: 'lego-nl.png',
  'lego-eu': 'lego-nl.png',
  'lego-nl': 'lego-nl.png',
  lidl: 'lidl.png',
  mediamarkt: 'mediamarkt.png',
  'media-markt': 'mediamarkt.png',
  misterbricks: 'misterbricks.png',
  proshop: 'proshop.png',
  'rakuten-lego-eu': 'rakuten-lego-eu.png',
  top1toys: 'top1toys.png',
  'top-1-toys': 'top1toys.png',
  wehkamp: 'wehkamp.ico',
};
// Smyths Toys is intentionally omitted until its official site returns a
// verifiable favicon instead of bot-challenge HTML to non-interactive fetches.

function normalizeMerchantFaviconKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/®/g, '')
    .replace(/&/g, ' en ')
    .replace(/^(?:bij|laagst bij|nu het laagst bij|actuele prijs bij)\s+/u, '')
    .replace(/^merchant-/u, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getMerchantFaviconFileName(
  merchant: MerchantFaviconInput,
): string | undefined {
  const candidateKeys = [
    merchant.merchantSlug,
    merchant.merchantKey,
    merchant.merchantId,
    merchant.merchantName,
    merchant.merchantLabel,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeMerchantFaviconKey);

  for (const candidateKey of candidateKeys) {
    const faviconFileName = MERCHANT_FAVICON_BY_KEY[candidateKey];

    if (faviconFileName) {
      return faviconFileName;
    }
  }

  return undefined;
}

export function getMerchantFaviconUrl(
  merchant: MerchantFaviconInput,
): string | undefined {
  const faviconFileName = getMerchantFaviconFileName(merchant);

  return faviconFileName
    ? `${MERCHANT_FAVICON_BASE_PATH}/${faviconFileName}`
    : undefined;
}

export function MerchantBrandInline({
  className,
  merchant,
}: {
  className?: string;
  merchant: MerchantFaviconInput & { merchantLabel: string };
}) {
  const faviconUrl = getMerchantFaviconUrl(merchant);

  return (
    <p
      className={[className, styles.merchantBrandInline]
        .filter(Boolean)
        .join(' ')}
    >
      {faviconUrl ? (
        <img
          alt=""
          className={styles.merchantBrandFavicon}
          decoding="async"
          loading="lazy"
          src={faviconUrl}
        />
      ) : null}
      <span className={styles.merchantBrandName} title={merchant.merchantLabel}>
        {merchant.merchantLabel}
      </span>
    </p>
  );
}

function parseDisplayedPriceMinor(priceLabel: string): number | undefined {
  const normalizedPrice = priceLabel
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '')
    .replace(',', '.');

  const parsedPrice = Number.parseFloat(normalizedPrice);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return undefined;
  }

  return Math.round(parsedPrice * 100);
}

function formatCompactEuroAmount(deltaMinor: number): string {
  const hasWholeEuroAmount = deltaMinor % 100 === 0;

  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    maximumFractionDigits: hasWholeEuroAmount ? 0 : 2,
    minimumFractionDigits: hasWholeEuroAmount ? 0 : 2,
    style: 'currency',
  })
    .format(deltaMinor / 100)
    .replace(/\s+/g, '');
}

function getCompactStockLabel(stockLabel: string): string {
  const normalizedLabel = stockLabel.trim().toLowerCase();

  if (normalizedLabel.includes('beperkt')) {
    return 'Beperkt';
  }

  if (
    normalizedLabel.includes('uitverkocht') ||
    normalizedLabel.includes('niet leverbaar') ||
    normalizedLabel.includes('niet op voorraad')
  ) {
    return 'Uitverkocht';
  }

  if (normalizedLabel.includes('op voorraad')) {
    return 'Op voorraad';
  }

  if (normalizedLabel.includes('onbekend')) {
    return 'Voorraad onbekend';
  }

  return stockLabel.trim() || 'Voorraad onbekend';
}

function getStockState(
  stockLabel: string,
): 'available' | 'limited' | 'out' | 'unknown' {
  const compactLabel = getCompactStockLabel(stockLabel);

  if (compactLabel === 'Op voorraad') {
    return 'available';
  }

  if (compactLabel === 'Beperkt') {
    return 'limited';
  }

  if (compactLabel === 'Uitverkocht') {
    return 'out';
  }

  return 'unknown';
}

function getCompactCheckedLabel(checkedLabel: string): string {
  return checkedLabel.replace(/^nagekeken\s+/i, '').replace(', ', ' om ');
}

const COMPACT_CHECKED_MONTHS: Record<string, { full: string; short: string }> =
  {
    apr: { full: 'april', short: 'apr' },
    april: { full: 'april', short: 'apr' },
    aug: { full: 'augustus', short: 'aug' },
    augustus: { full: 'augustus', short: 'aug' },
    dec: { full: 'december', short: 'dec' },
    december: { full: 'december', short: 'dec' },
    feb: { full: 'februari', short: 'feb' },
    februari: { full: 'februari', short: 'feb' },
    jan: { full: 'januari', short: 'jan' },
    januari: { full: 'januari', short: 'jan' },
    jul: { full: 'juli', short: 'jul' },
    juli: { full: 'juli', short: 'jul' },
    jun: { full: 'juni', short: 'jun' },
    juni: { full: 'juni', short: 'jun' },
    maart: { full: 'maart', short: 'mrt' },
    mei: { full: 'mei', short: 'mei' },
    mrt: { full: 'maart', short: 'mrt' },
    nov: { full: 'november', short: 'nov' },
    november: { full: 'november', short: 'nov' },
    okt: { full: 'oktober', short: 'okt' },
    oktober: { full: 'oktober', short: 'okt' },
    sep: { full: 'september', short: 'sep' },
    september: { full: 'september', short: 'sep' },
  };

function getCompactRailCheckedPresentation(checkedLabel: string): {
  label: string;
  title: string;
} {
  const normalizedLabel = getCompactCheckedLabel(checkedLabel)
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedLowerLabel = normalizedLabel.toLowerCase();
  const relativeDateMatch = normalizedLabel.match(
    /^(vandaag|gisteren|eergisteren)\s+om\s+(\d{1,2}:\d{2})/iu,
  );

  if (relativeDateMatch) {
    const relativeDay = relativeDateMatch[1]?.toLowerCase() ?? 'vandaag';
    const timeLabel = relativeDateMatch[2] ?? '';

    return {
      label: `${relativeDay} ${timeLabel}`.trim(),
      title: `Nagekeken ${relativeDay} om ${timeLabel}`.trim(),
    };
  }

  const dateMatch = normalizedLabel.match(
    /^(\d{1,2})\s+([a-z]+)\s+om\s+(\d{1,2}:\d{2})/iu,
  );

  if (dateMatch) {
    const day = dateMatch[1] ?? '';
    const month = dateMatch[2]?.toLowerCase() ?? '';
    const timeLabel = dateMatch[3] ?? '';
    const monthPresentation = COMPACT_CHECKED_MONTHS[month] ?? {
      full: month,
      short: month,
    };

    return {
      label: `${day} ${monthPresentation.short} ${timeLabel}`.trim(),
      title:
        `Nagekeken ${day} ${monthPresentation.full} om ${timeLabel}`.trim(),
    };
  }

  if (normalizedLowerLabel.startsWith('vandaag')) {
    return {
      label: 'vandaag',
      title: 'Nagekeken vandaag',
    };
  }

  if (normalizedLowerLabel.startsWith('gisteren')) {
    return {
      label: 'gisteren',
      title: 'Nagekeken gisteren',
    };
  }

  if (normalizedLowerLabel.startsWith('eergisteren')) {
    return {
      label: '2 dagen geleden',
      title: 'Nagekeken 2 dagen geleden',
    };
  }

  const fallbackLabel =
    normalizedLabel.replace(/\s+om\s+.+$/i, '').trim() || 'onbekend';

  return {
    label: fallbackLabel,
    title: `Nagekeken ${fallbackLabel}`,
  };
}

function getOfferCountSummaryLabel({
  offerCount,
  summaryLabel,
}: {
  offerCount: number;
  summaryLabel?: string;
}): string {
  const merchantCountLabel = `${offerCount} winkel${
    offerCount === 1 ? '' : 's'
  } nagekeken`;

  if (!summaryLabel) {
    return merchantCountLabel;
  }

  return summaryLabel.split('·')[0]?.trim() || merchantCountLabel;
}

function isOfferAvailableForComparison(offer: CatalogOfferItem): boolean {
  const stockState = getStockState(offer.stockLabel);

  return stockState === 'available' || stockState === 'limited';
}

function isCompactOfferBestDeal({
  bestPriceMinor,
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}): boolean {
  if (
    !isOfferAvailableForComparison(offer) ||
    typeof bestPriceMinor !== 'number'
  ) {
    return false;
  }

  return parseDisplayedPriceMinor(offer.price) === bestPriceMinor;
}

export function buildCompactOfferComparisonContext(
  offers: readonly CatalogOfferItem[],
): CompactOfferComparisonContext {
  const availableOffers = offers.filter(isOfferAvailableForComparison);
  const availablePrices = availableOffers
    .map((offer) => parseDisplayedPriceMinor(offer.price))
    .filter(
      (priceMinor): priceMinor is number => typeof priceMinor === 'number',
    )
    .sort((left, right) => left - right);
  const bestPriceMinor = availablePrices[0];
  const nextBestAvailablePriceMinor = availableOffers
    .map((offer) => parseDisplayedPriceMinor(offer.price))
    .filter(
      (priceMinor): priceMinor is number =>
        typeof priceMinor === 'number' && priceMinor > (bestPriceMinor ?? 0),
    )
    .sort((left, right) => left - right)[0];

  return {
    bestPriceMinor,
    comparedOfferCount: offers.length,
    nextBestAvailablePriceMinor,
    reviewedInStockOfferCount: availableOffers.length,
  };
}

function getCompactDeltaPresentation({
  bestPriceMinor,
  isBestDeal,
  offer,
}: {
  bestPriceMinor?: number;
  isBestDeal: boolean;
  offer: CatalogOfferItem;
}): Pick<CompactOfferPresentation, 'deltaLabel' | 'priceComparisonState'> {
  if (isBestDeal || bestPriceMinor === undefined) {
    return {
      priceComparisonState: isBestDeal ? 'best' : 'unknown',
    };
  }

  const currentPriceMinor = parseDisplayedPriceMinor(offer.price);

  if (currentPriceMinor !== undefined) {
    const deltaMinor = currentPriceMinor - bestPriceMinor;

    if (deltaMinor < 0) {
      const stockState = getStockState(offer.stockLabel);

      if (stockState === 'out') {
        return {
          deltaLabel: 'Uitverkocht maar lager',
          priceComparisonState: 'lower-unavailable',
        };
      }

      if (stockState === 'unknown') {
        return {
          deltaLabel: 'Voorraad onbekend, lager',
          priceComparisonState: 'lower-unavailable',
        };
      }

      return {
        deltaLabel: `${formatCompactEuroAmount(Math.abs(deltaMinor))} lager`,
        priceComparisonState: 'lower-unavailable',
      };
    }

    if (deltaMinor === 0) {
      if (offer.rankingLabel?.toLowerCase().includes('laagste prijs')) {
        return {
          deltaLabel: 'Laagste prijs',
          priceComparisonState: 'same',
        };
      }

      return {
        deltaLabel: 'Zelfde prijs',
        priceComparisonState: 'same',
      };
    }

    return {
      deltaLabel: `${formatCompactEuroAmount(deltaMinor)} duurder`,
      priceComparisonState:
        deltaMinor <= CLOSE_PRICE_DELTA_MINOR ? 'close' : 'higher',
    };
  }

  if (offer.rankingLabel?.toLowerCase().includes('zelfde prijs')) {
    return {
      deltaLabel: 'Zelfde prijs',
      priceComparisonState: 'same',
    };
  }

  const rankingLabelMatch = offer.rankingLabel?.match(/€\s?[\d.,]+/);

  if (!rankingLabelMatch) {
    return {
      priceComparisonState: 'unknown',
    };
  }

  return {
    deltaLabel: `${rankingLabelMatch[0].replace(/^€\s?/, '€')} duurder`,
    priceComparisonState: 'higher',
  };
}

function getBestOfferConfidenceLabel({
  bestPriceMinor,
  comparedOfferCount,
  isBestDeal,
  nextBestAvailablePriceMinor,
  offer,
  reviewedInStockOfferCount,
}: {
  bestPriceMinor?: number;
  comparedOfferCount: number;
  isBestDeal: boolean;
  nextBestAvailablePriceMinor?: number;
  offer: CatalogOfferItem;
  reviewedInStockOfferCount: number;
}): string | undefined {
  if (!isBestDeal) {
    return undefined;
  }

  const offerPriceMinor = parseDisplayedPriceMinor(offer.price);

  if (
    typeof bestPriceMinor === 'number' &&
    typeof offerPriceMinor === 'number' &&
    offerPriceMinor > bestPriceMinor
  ) {
    return `${formatCompactEuroAmount(
      offerPriceMinor - bestPriceMinor,
    )} boven laagste prijs`;
  }

  if (reviewedInStockOfferCount <= 1) {
    return 'Enige beschikbare optie';
  }

  if (
    typeof bestPriceMinor === 'number' &&
    typeof nextBestAvailablePriceMinor === 'number'
  ) {
    const nextBestDeltaMinor = nextBestAvailablePriceMinor - bestPriceMinor;

    if (nextBestDeltaMinor > 0) {
      return `${formatCompactEuroAmount(nextBestDeltaMinor)} goedkoper dan de rest`;
    }
  }

  if (comparedOfferCount > 1) {
    return 'Laagste prijs';
  }

  return 'Enige beschikbare optie';
}

export function buildCompactOfferPresentation({
  comparisonContext,
  offer,
}: {
  comparisonContext: CompactOfferComparisonContext;
  offer: CatalogOfferItem;
}): CompactOfferPresentation {
  const isBestDeal = isCompactOfferBestDeal({
    bestPriceMinor: comparisonContext.bestPriceMinor,
    offer,
  });
  const deltaPresentation = getCompactDeltaPresentation({
    bestPriceMinor: comparisonContext.bestPriceMinor,
    isBestDeal,
    offer,
  });
  const railCheckedPresentation = getCompactRailCheckedPresentation(
    offer.checkedLabel,
  );

  return {
    actionLabel: isBestDeal ? 'Bekijk deal' : 'Naar winkel',
    overlayCheckedLabel: getCompactCheckedLabel(offer.checkedLabel),
    railCheckedLabel: railCheckedPresentation.label,
    railCheckedTitle: railCheckedPresentation.title,
    confidenceLabel: getBestOfferConfidenceLabel({
      bestPriceMinor: comparisonContext.bestPriceMinor,
      comparedOfferCount: comparisonContext.comparedOfferCount,
      isBestDeal,
      nextBestAvailablePriceMinor:
        comparisonContext.nextBestAvailablePriceMinor,
      offer,
      reviewedInStockOfferCount: comparisonContext.reviewedInStockOfferCount,
    }),
    deltaLabel: deltaPresentation.deltaLabel,
    isBestDeal,
    merchantId: offer.merchantId,
    merchantKey: offer.merchantKey,
    merchantLabel: offer.merchantLabel,
    merchantSlug: offer.merchantSlug,
    price: offer.price,
    priceComparisonState: deltaPresentation.priceComparisonState,
    stockLabel: getCompactStockLabel(offer.stockLabel),
    stockState: getStockState(offer.stockLabel),
  };
}

function buildOfferActionAriaLabel({
  actionLabel,
  merchantLabel,
}: {
  actionLabel: string;
  merchantLabel: string;
}): string {
  return actionLabel.toLowerCase().includes(merchantLabel.toLowerCase())
    ? actionLabel
    : `${actionLabel} bij ${merchantLabel}`;
}

function CatalogOfferRailCard({
  comparisonContext,
  offer,
}: {
  comparisonContext: CompactOfferComparisonContext;
  offer: CatalogOfferItem;
}) {
  const presentation = buildCompactOfferPresentation({
    comparisonContext,
    offer,
  });
  const supportLineClassName = [
    styles.offerRailSupportLine,
    presentation.isBestDeal
      ? styles.offerRailSupportLineBest
      : styles.offerRailSupportLineDefault,
  ].join(' ');

  return (
    <ActionLink
      aria-label={buildOfferActionAriaLabel({
        actionLabel: presentation.actionLabel,
        merchantLabel: presentation.merchantLabel,
      })}
      className={styles.offerRailCardLink}
      href={offer.ctaHref}
      prefetch={false}
      rel="noopener noreferrer sponsored"
      target="_blank"
      tone="card"
      {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
    >
      <article
        className={styles.offerRailCard}
        data-best={presentation.isBestDeal ? 'true' : 'false'}
        data-price-comparison={presentation.priceComparisonState}
        data-stock-state={presentation.stockState}
      >
        <div className={styles.offerRailHeader}>
          <MerchantBrandInline
            className={styles.offerRailMerchant}
            merchant={presentation}
          />
          <div className={styles.offerRailBadges}>
            {presentation.isBestDeal ? (
              <Badge tone="accent">Beste deal</Badge>
            ) : null}
            {!presentation.isBestDeal &&
            (presentation.priceComparisonState === 'same' ||
              presentation.priceComparisonState === 'close') ? (
              <Badge tone="neutral">Alternatief</Badge>
            ) : null}
          </div>
        </div>
        <div className={styles.offerRailPriceBlock}>
          <p className={styles.offerRailPrice}>{presentation.price}</p>
          <div className={styles.offerRailSupport}>
            <p
              aria-hidden={
                !presentation.confidenceLabel && !presentation.deltaLabel
                  ? 'true'
                  : undefined
              }
              className={supportLineClassName}
              data-kind={presentation.isBestDeal ? 'confidence' : 'delta'}
              data-wrap={presentation.isBestDeal ? 'best' : 'default'}
            >
              {presentation.confidenceLabel ??
                presentation.deltaLabel ??
                '\u00a0'}
            </p>
          </div>
        </div>
        <div className={styles.offerRailStatusBlock}>
          <span
            className={styles.offerAvailabilityStatus}
            data-state={presentation.stockState}
          >
            {presentation.stockLabel}
          </span>
          <p
            aria-label={presentation.railCheckedTitle}
            className={styles.offerRailChecked}
            title={presentation.railCheckedTitle}
          >
            <Clock3 aria-hidden="true" size={14} strokeWidth={2.2} />
            <span>{presentation.railCheckedLabel}</span>
          </p>
        </div>
        <div className={styles.offerRailActionRow}>
          <ActionChrome
            aria-hidden="true"
            className={styles.offerRailAction}
            variant={presentation.isBestDeal ? 'primary' : 'secondary'}
          >
            <Eye aria-hidden="true" size={15} strokeWidth={2.2} />
            <span>{presentation.actionLabel}</span>
          </ActionChrome>
        </div>
        <VisuallyHidden>{presentation.actionLabel}</VisuallyHidden>
      </article>
    </ActionLink>
  );
}

function CatalogOfferOverlayRow({
  comparisonContext,
  offer,
}: {
  comparisonContext: CompactOfferComparisonContext;
  offer: CatalogOfferItem;
}) {
  const presentation = buildCompactOfferPresentation({
    comparisonContext,
    offer,
  });

  return (
    <ActionLink
      aria-label={buildOfferActionAriaLabel({
        actionLabel: presentation.actionLabel,
        merchantLabel: presentation.merchantLabel,
      })}
      className={styles.offerOverlayRowLink}
      href={offer.ctaHref}
      rel="noopener noreferrer sponsored"
      target="_blank"
      tone="card"
      {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
    >
      <article
        className={styles.offerOverlayRow}
        data-best={presentation.isBestDeal ? 'true' : 'false'}
        data-price-comparison={presentation.priceComparisonState}
      >
        <div className={styles.offerOverlayMerchantCell}>
          <MerchantBrandInline
            className={styles.offerOverlayMerchant}
            merchant={presentation}
          />
          <div className={styles.offerOverlayBadges}>
            {presentation.isBestDeal ? (
              <Badge tone="accent">Beste deal</Badge>
            ) : null}
            {!presentation.isBestDeal &&
            (presentation.priceComparisonState === 'same' ||
              presentation.priceComparisonState === 'close') ? (
              <Badge tone="neutral">Alternatief</Badge>
            ) : null}
          </div>
        </div>
        <div className={styles.offerOverlayMetaCell}>
          <span
            className={styles.offerAvailabilityStatus}
            data-state={presentation.stockState}
          >
            {presentation.stockLabel}
          </span>
          <p className={styles.offerOverlayChecked}>
            <Clock3 aria-hidden="true" size={14} strokeWidth={2.2} />
            <span>{presentation.overlayCheckedLabel}</span>
          </p>
        </div>
        <div className={styles.offerOverlayPriceCell}>
          <p className={styles.offerOverlayPrice}>{presentation.price}</p>
          <p
            aria-hidden={
              !presentation.confidenceLabel && !presentation.deltaLabel
                ? 'true'
                : undefined
            }
            className={styles.offerOverlaySupportLine}
            data-kind={presentation.isBestDeal ? 'confidence' : 'delta'}
          >
            {presentation.confidenceLabel ??
              presentation.deltaLabel ??
              '\u00a0'}
          </p>
        </div>
        <span className={styles.offerOverlayChevron} aria-hidden="true">
          <ChevronRight size={18} strokeWidth={2.2} />
        </span>
        <VisuallyHidden>{presentation.actionLabel}</VisuallyHidden>
      </article>
    </ActionLink>
  );
}

export function CatalogOfferComparisonRail({
  className,
  id,
  offers,
  summaryLabel,
}: CatalogOfferComparisonRailProps) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const railOffers = offers.slice(0, MAX_VISIBLE_OFFER_RAIL_ITEMS);
  const hasHiddenOffers = railOffers.length < offers.length;
  const hasMultipleOffers = offers.length > 1;
  const comparisonContext = buildCompactOfferComparisonContext(offers);
  const railTitle = hasHiddenOffers
    ? `Nu bij ${railOffers.length} van ${offers.length} winkels`
    : `Nu bij ${railOffers.length} winkels`;
  const offerCountSummaryLabel = getOfferCountSummaryLabel({
    offerCount: offers.length,
    summaryLabel,
  });
  const viewAllAriaLabel = `Vergelijk alle ${offers.length} winkel${
    offers.length === 1 ? '' : 's'
  }`;
  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  return (
    <>
      <Panel
        as="section"
        className={[styles.offerListCard, className].filter(Boolean).join(' ')}
        elevation="rested"
        headingActionLabel={hasMultipleOffers ? viewAllAriaLabel : undefined}
        headingClassName={styles.offerRailHeading}
        headingOnClick={
          hasMultipleOffers
            ? () => {
                setIsOverlayOpen(true);
              }
            : undefined
        }
        id={id}
        spacing="compact"
        title={railTitle}
        tone="muted"
      >
        <div className={styles.offerRailViewport}>
          <ol className={styles.offerRail} type="1">
            {railOffers.map((offer) => (
              <li
                className={styles.offerRailItem}
                key={`${offer.merchantLabel}-${offer.price}`}
              >
                <CatalogOfferRailCard
                  comparisonContext={comparisonContext}
                  offer={offer}
                />
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      <ResponsiveDialog
        backdropProps={{
          'data-offer-comparison-backdrop': 'true',
        }}
        bodyClassName={styles.offerOverlayBody}
        closeButtonClassName={styles.offerOverlayClose}
        closeLabel="Vergelijking sluiten"
        description={offerCountSummaryLabel}
        descriptionClassName={styles.offerOverlaySummary}
        dialogProps={{
          'data-offer-comparison-dialog': 'true',
        }}
        headerClassName={styles.offerOverlayHeader}
        headingClassName={styles.offerOverlayHeading}
        isOpen={isOverlayOpen}
        panelClassName={styles.offerOverlay}
        title="Vergelijk alle winkels"
        titleClassName={styles.offerOverlayTitle}
        onClose={closeOverlay}
      >
        <ol className={styles.offerOverlayList} type="1">
          {offers.map((offer) => (
            <li
              className={styles.offerOverlayListItem}
              key={`overlay-${offer.merchantLabel}-${offer.price}`}
            >
              <CatalogOfferOverlayRow
                comparisonContext={comparisonContext}
                offer={offer}
              />
            </li>
          ))}
        </ol>
      </ResponsiveDialog>
    </>
  );
}

export default CatalogOfferComparisonRail;
