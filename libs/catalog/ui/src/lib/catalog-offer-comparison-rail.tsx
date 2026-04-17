'use client';

import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Clock3, X } from 'lucide-react';
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
  summaryLabel?: string;
}

const MAX_VISIBLE_OFFER_RAIL_ITEMS = 6;

interface CompactOfferPresentation {
  checkedLabel: string;
  deltaLabel?: string;
  merchantLabel: string;
  price: string;
  stockLabel: string;
  stockState: 'available' | 'limited' | 'out' | 'unknown';
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

function formatCompactEuroDelta(deltaMinor: number): string {
  const hasWholeEuroAmount = deltaMinor % 100 === 0;

  return `+${new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    maximumFractionDigits: hasWholeEuroAmount ? 0 : 2,
    minimumFractionDigits: hasWholeEuroAmount ? 0 : 2,
    style: 'currency',
  })
    .format(deltaMinor / 100)
    .replace(/\s+/g, '')}`;
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

  return stockLabel.trim();
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

function getCompactDeltaLabel({
  bestPriceMinor,
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}): string | undefined {
  if (offer.isBest || bestPriceMinor === undefined) {
    return undefined;
  }

  const currentPriceMinor = parseDisplayedPriceMinor(offer.price);

  if (currentPriceMinor !== undefined && currentPriceMinor > bestPriceMinor) {
    return formatCompactEuroDelta(currentPriceMinor - bestPriceMinor);
  }

  const rankingLabelMatch = offer.rankingLabel?.match(/€\s?[\d.,]+/);

  if (!rankingLabelMatch) {
    return undefined;
  }

  return `+${rankingLabelMatch[0].replace(/^€\s?/, '€')}`;
}

export function buildCompactOfferPresentation({
  bestPriceMinor,
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}): CompactOfferPresentation {
  return {
    checkedLabel: getCompactCheckedLabel(offer.checkedLabel),
    deltaLabel: getCompactDeltaLabel({ bestPriceMinor, offer }),
    merchantLabel: offer.merchantLabel,
    price: offer.price,
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

function CatalogOfferRailCard({
  bestPriceMinor,
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}) {
  const presentation = buildCompactOfferPresentation({ bestPriceMinor, offer });

  return (
    <article
      className={styles.offerRailCard}
      data-best={offer.isBest ? 'true' : 'false'}
    >
      <div className={styles.offerRailHeader}>
        <p className={styles.offerRailMerchant}>{presentation.merchantLabel}</p>
        {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
      </div>
      <p className={styles.offerRailPrice}>{presentation.price}</p>
      <div className={styles.offerRailMetaRow}>
        <span
          className={styles.offerRailStock}
          data-state={presentation.stockState}
        >
          {presentation.stockLabel}
        </span>
        {presentation.deltaLabel ? (
          <span className={styles.offerRailDelta}>
            {presentation.deltaLabel}
          </span>
        ) : null}
      </div>
      <p className={styles.offerRailChecked}>
        <Clock3 aria-hidden="true" size={14} strokeWidth={2.2} />
        <span>{presentation.checkedLabel}</span>
      </p>
      <ActionLink
        className={styles.offerRailAction}
        href={offer.ctaHref}
        rel="noreferrer sponsored"
        size="compact"
        target="_blank"
        tone="secondary"
        {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
      >
        <>
          <span>Bekijk deal</span>
          <VisuallyHidden> bij {presentation.merchantLabel}</VisuallyHidden>
        </>
      </ActionLink>
    </article>
  );
}

function CatalogOfferOverlayRow({
  bestPriceMinor,
  offer,
}: {
  bestPriceMinor?: number;
  offer: CatalogOfferItem;
}) {
  const presentation = buildCompactOfferPresentation({ bestPriceMinor, offer });

  return (
    <ActionLink
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
      >
        <div className={styles.offerOverlayRowMain}>
          <div className={styles.offerOverlayRowHeader}>
            <p className={styles.offerOverlayMerchant}>
              {presentation.merchantLabel}
            </p>
            {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
          </div>
          <div className={styles.offerOverlayMetaRow}>
            <span
              className={styles.offerRailStock}
              data-state={presentation.stockState}
            >
              {presentation.stockLabel}
            </span>
            {presentation.deltaLabel ? (
              <span className={styles.offerRailDelta}>
                {presentation.deltaLabel}
              </span>
            ) : null}
            <p className={styles.offerOverlayChecked}>
              <Clock3 aria-hidden="true" size={14} strokeWidth={2.2} />
              <span>{presentation.checkedLabel}</span>
            </p>
          </div>
        </div>
        <div className={styles.offerOverlayRowSide}>
          <p className={styles.offerOverlayPrice}>{presentation.price}</p>
        </div>
        <VisuallyHidden>
          Bekijk deal bij {presentation.merchantLabel}
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
  const railOffers = offers.slice(0, MAX_VISIBLE_OFFER_RAIL_ITEMS);
  const bestPriceMinor = parseDisplayedPriceMinor(offers[0]?.price ?? '');
  const railTitle =
    railOffers.length < offers.length
      ? `Nu bij ${railOffers.length} van ${offers.length} winkels`
      : `Nu bij ${railOffers.length} winkels`;
  const viewAllLabel = `Vergelijk alle ${offers.length} winkel${
    offers.length === 1 ? '' : 's'
  }`;

  useEffect(() => {
    if (!isOverlayOpen) {
      triggerRef.current?.focus();
      return;
    }

    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOverlayOpen]);

  return (
    <>
      <Panel
        as="section"
        className={[styles.offerListCard, className].filter(Boolean).join(' ')}
        description={summaryLabel}
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
                  bestPriceMinor={bestPriceMinor}
                  offer={offer}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.offerRailFooter}>
          <Button
            aria-label={viewAllLabel}
            className={styles.offerRailViewAllAction}
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

      {isOverlayOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className={styles.offerOverlayBackdrop}
          onClick={() => setIsOverlayOpen(false)}
          onKeyDown={(event) =>
            handleOverlayEscape(event, () => setIsOverlayOpen(false))
          }
          role="dialog"
        >
          <div
            className={styles.offerOverlay}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.offerOverlayHeader}>
              <div className={styles.offerOverlayHeading}>
                <h2 className={styles.offerOverlayTitle} id={titleId}>
                  Vergelijk alle winkels
                </h2>
                {summaryLabel ? (
                  <p className={styles.offerOverlaySummary}>{summaryLabel}</p>
                ) : null}
              </div>
              <button
                aria-label="Vergelijking sluiten"
                className={styles.offerOverlayClose}
                onClick={() => setIsOverlayOpen(false)}
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
                      bestPriceMinor={bestPriceMinor}
                      offer={offer}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default CatalogOfferComparisonRail;
