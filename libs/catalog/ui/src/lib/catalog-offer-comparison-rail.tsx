'use client';

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Clock3, Eye, X } from 'lucide-react';
import {
  ActionLink,
  Badge,
  Button,
  Panel,
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

const MAX_VISIBLE_OFFER_RAIL_ITEMS = 6;
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

function buildCompactOfferComparisonContext(
  offers: readonly CatalogOfferItem[],
): CompactOfferComparisonContext {
  const bestPriceMinor = parseDisplayedPriceMinor(offers[0]?.price ?? '');
  const availableOffers = offers.filter(isOfferAvailableForComparison);
  const nextBestAvailablePriceMinor = availableOffers
    .filter((offer) => !offer.isBest)
    .map((offer) => parseDisplayedPriceMinor(offer.price))
    .find((priceMinor): priceMinor is number => typeof priceMinor === 'number');

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

function handleOverlayEscape(
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void,
) {
  if (event.key !== 'Escape') {
    return;
  }

  event.preventDefault();
  onClose();
}

function getFocusableOverlayElements(dialog: HTMLDivElement | null) {
  if (!dialog) {
    return [];
  }

  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true',
  );
}

function handleOverlayTabTrap(
  event: KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null,
) {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableOverlayElements(dialog);

  if (!focusableElements.length) {
    event.preventDefault();
    dialog?.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
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
      rel="noreferrer sponsored"
      target="_blank"
      tone="card"
      {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
    >
      {card}
      <VisuallyHidden>
        {presentation.actionLabel} bij {presentation.merchantLabel}
      </VisuallyHidden>
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
      aria-label={`${presentation.actionLabel} bij ${presentation.merchantLabel}`}
      className={styles.offerOverlayRowLink}
      href={offer.ctaHref}
      rel="noreferrer sponsored"
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
        <VisuallyHidden>
          {presentation.actionLabel} bij {presentation.merchantLabel}
        </VisuallyHidden>
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
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayDialogRef = useRef<HTMLDivElement>(null);
  const railOffers = offers.slice(0, MAX_VISIBLE_OFFER_RAIL_ITEMS);
  const comparisonContext = buildCompactOfferComparisonContext(offers);
  const railTitle =
    railOffers.length < offers.length
      ? `Nu bij ${railOffers.length} van ${offers.length} winkels`
      : `Nu bij ${railOffers.length} winkels`;
  const offerCountSummaryLabel = getOfferCountSummaryLabel({
    offerCount: offers.length,
    summaryLabel,
  });
  const viewAllLabel = `Vergelijk alle ${offers.length} winkel${
    offers.length === 1 ? '' : 's'
  }`;
  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  useEffect(() => {
    if (!isOverlayOpen) {
      return undefined;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocumentOverflow;

      window.requestAnimationFrame(() => {
        triggerRef.current?.focus({ preventScroll: true });
      });
    };
  }, [isOverlayOpen]);

  const offerOverlay =
    isOverlayOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.offerOverlayBackdrop}
            data-offer-comparison-backdrop="true"
            onClick={closeOverlay}
            role="presentation"
          >
            <div
              aria-labelledby={titleId}
              aria-modal="true"
              className={styles.offerOverlay}
              data-offer-comparison-dialog="true"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                handleOverlayEscape(event, closeOverlay);
                handleOverlayTabTrap(event, overlayDialogRef.current);
              }}
              ref={overlayDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className={styles.offerOverlayHeader}>
                <div className={styles.offerOverlayHeading}>
                  <h2 className={styles.offerOverlayTitle} id={titleId}>
                    Vergelijk alle winkels
                  </h2>
                  <p className={styles.offerOverlaySummary}>
                    {offerCountSummaryLabel}
                  </p>
                </div>
                <button
                  aria-label="Vergelijking sluiten"
                  className={styles.offerOverlayClose}
                  onClick={closeOverlay}
                  ref={closeButtonRef}
                  type="button"
                >
                  <X aria-hidden="true" size={18} strokeWidth={2.2} />
                  <VisuallyHidden>Vergelijking sluiten</VisuallyHidden>
                </button>
              </div>
              <div className={styles.offerOverlayBody}>
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
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Panel
        as="section"
        className={[styles.offerListCard, className].filter(Boolean).join(' ')}
        description={offerCountSummaryLabel}
        eyebrow="Vergelijk winkels"
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
        <div className={styles.offerRailFooter}>
          <Button
            aria-label={viewAllLabel}
            className={`${styles.railActionLink} ${styles.offerRailViewAllAction}`}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setIsOverlayOpen(true);
            }}
            tone="inline"
            type="button"
          >
            {viewAllLabel}
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
          </Button>
        </div>
      </Panel>

      {offerOverlay}
    </>
  );
}

export default CatalogOfferComparisonRail;
