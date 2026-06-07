'use client';

import { useCallback, useState } from 'react';
import { ChevronRight, Clock3, Eye } from 'lucide-react';
import {
  ActionLink,
  Badge,
  Button,
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
  confidenceLabel?: string;
  deltaLabel?: string;
  merchantLabel: string;
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

function getCompactRailCheckedLabel(checkedLabel: string): string {
  const normalizedLabel = getCompactCheckedLabel(checkedLabel);
  const normalizedLowerLabel = normalizedLabel.toLowerCase();

  if (normalizedLowerLabel.startsWith('vandaag')) {
    return 'Nagekeken vandaag';
  }

  if (normalizedLowerLabel.startsWith('gisteren')) {
    return 'Nagekeken gisteren';
  }

  if (normalizedLowerLabel.startsWith('eergisteren')) {
    return 'Nagekeken 2 dagen geleden';
  }

  return `Nagekeken ${normalizedLabel.replace(/\s+om\s+.+$/i, '')}`;
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
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}): Pick<CompactOfferPresentation, 'deltaLabel' | 'priceComparisonState'> {
  if (offer.isBest || bestPriceMinor === undefined) {
    return {
      priceComparisonState: offer.isBest ? 'best' : 'unknown',
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
  nextBestAvailablePriceMinor,
  offer,
  reviewedInStockOfferCount,
}: {
  bestPriceMinor?: number;
  comparedOfferCount: number;
  nextBestAvailablePriceMinor?: number;
  offer: CatalogOfferItem;
  reviewedInStockOfferCount: number;
}): string | undefined {
  if (!offer.isBest) {
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
  const deltaPresentation = getCompactDeltaPresentation({
    bestPriceMinor: comparisonContext.bestPriceMinor,
    offer,
  });

  return {
    actionLabel: offer.isBest ? 'Bekijk beste deal' : 'Naar winkel',
    overlayCheckedLabel: getCompactCheckedLabel(offer.checkedLabel),
    railCheckedLabel: getCompactRailCheckedLabel(offer.checkedLabel),
    confidenceLabel: getBestOfferConfidenceLabel({
      bestPriceMinor: comparisonContext.bestPriceMinor,
      comparedOfferCount: comparisonContext.comparedOfferCount,
      nextBestAvailablePriceMinor:
        comparisonContext.nextBestAvailablePriceMinor,
      offer,
      reviewedInStockOfferCount: comparisonContext.reviewedInStockOfferCount,
    }),
    deltaLabel: deltaPresentation.deltaLabel,
    merchantLabel: offer.merchantLabel,
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
    offer.isBest
      ? styles.offerRailSupportLineBest
      : styles.offerRailSupportLineDefault,
  ].join(' ');

  const card = (
    <article
      className={styles.offerRailCard}
      data-best={offer.isBest ? 'true' : 'false'}
      data-price-comparison={presentation.priceComparisonState}
      data-stock-state={presentation.stockState}
    >
      <div className={styles.offerRailHeader}>
        <p className={styles.offerRailMerchant}>{presentation.merchantLabel}</p>
        <div className={styles.offerRailBadges}>
          {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
          {!offer.isBest &&
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
            data-kind={offer.isBest ? 'confidence' : 'delta'}
            data-wrap={offer.isBest ? 'best' : 'default'}
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
        <p className={styles.offerRailChecked}>
          <Clock3 aria-hidden="true" size={14} strokeWidth={2.2} />
          <span>{presentation.railCheckedLabel}</span>
        </p>
      </div>
      <div className={styles.offerRailActionRow}>
        <span
          className={styles.offerRailAction}
          data-tone={offer.isBest ? 'accent' : 'secondary'}
        >
          <Eye aria-hidden="true" size={15} strokeWidth={2.2} />
          <span>{presentation.actionLabel}</span>
        </span>
      </div>
    </article>
  );

  return (
    <ActionLink
      className={styles.offerRailCardLink}
      href={offer.ctaHref}
      prefetch={false}
      rel="noopener noreferrer sponsored"
      target="_blank"
      tone="card"
      {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
    >
      {card}
      <VisuallyHidden>{presentation.actionLabel}</VisuallyHidden>
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
        data-best={offer.isBest ? 'true' : 'false'}
        data-price-comparison={presentation.priceComparisonState}
      >
        <div className={styles.offerOverlayMerchantCell}>
          <p className={styles.offerOverlayMerchant}>
            {presentation.merchantLabel}
          </p>
          <div className={styles.offerOverlayBadges}>
            {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
            {!offer.isBest &&
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
            data-kind={offer.isBest ? 'confidence' : 'delta'}
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
  const viewAllLabel = 'Bekijk alle winkels';
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
        headingClassName={styles.offerRailHeading}
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
        {hasMultipleOffers ? (
          <div className={styles.offerRailFooter}>
            <Button
              aria-label={viewAllAriaLabel}
              className={styles.offerRailViewAllAction}
              onClick={() => {
                setIsOverlayOpen(true);
              }}
              tone="secondary"
              type="button"
            >
              {viewAllLabel}
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
            </Button>
          </div>
        ) : null}
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
