'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { Button } from '@lego-platform/shared/ui';
import { CatalogSetCard, type CatalogSetCardPriceContext } from './catalog-ui';
import styles from './catalog-ui.module.css';

type CatalogSetCardRailSummary = CatalogSetSummary &
  Partial<Pick<CatalogHomepageSetCard, 'availability' | 'tagline'>>;

export interface CatalogSetCardRailItem {
  actions?: ReactNode;
  href?: string;
  id: string;
  priceContext?: CatalogSetCardPriceContext;
  setSummary: CatalogSetCardRailSummary;
  supportingNote?: ReactNode;
}

interface CatalogSetCardRailMetrics {
  hasOverflow: boolean;
  progress: number;
  thumbWidthPercent: number;
}

function getRailMetrics(
  railElement: HTMLDivElement,
): CatalogSetCardRailMetrics {
  const maxScrollLeft = Math.max(
    railElement.scrollWidth - railElement.clientWidth,
    0,
  );
  const hasOverflow = maxScrollLeft > 1;
  const thumbWidthPercent = railElement.scrollWidth
    ? Math.min((railElement.clientWidth / railElement.scrollWidth) * 100, 100)
    : 100;
  const progress = maxScrollLeft
    ? Math.min(Math.max(railElement.scrollLeft / maxScrollLeft, 0), 1)
    : 0;

  return {
    hasOverflow,
    progress,
    thumbWidthPercent,
  };
}

export function CatalogSetCardRail({
  ariaLabel,
  items,
  variant = 'featured',
}: {
  ariaLabel: string;
  items: readonly CatalogSetCardRailItem[];
  variant?: 'compact' | 'featured';
}) {
  const railId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const [railMetrics, setRailMetrics] = useState<CatalogSetCardRailMetrics>({
    hasOverflow: false,
    progress: 0,
    thumbWidthPercent: 100,
  });

  useEffect(() => {
    const railElement = railRef.current;

    if (!railElement) {
      return undefined;
    }

    let animationFrameId = 0;

    function syncRailMetrics() {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const nextRailElement = railRef.current;

        if (!nextRailElement) {
          return;
        }

        setRailMetrics(getRailMetrics(nextRailElement));
      });
    }

    syncRailMetrics();
    railElement.addEventListener('scroll', syncRailMetrics, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncRailMetrics)
        : null;

    resizeObserver?.observe(railElement);

    return () => {
      cancelAnimationFrame(animationFrameId);
      railElement.removeEventListener('scroll', syncRailMetrics);
      resizeObserver?.disconnect();
    };
  }, [items.length]);

  if (!items.length) {
    return null;
  }

  function scrollRail(direction: 'next' | 'previous') {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const scrollAmount = Math.max(railElement.clientWidth * 0.92, 240);

    railElement.scrollBy({
      behavior: 'smooth',
      left: direction === 'next' ? scrollAmount : -scrollAmount,
    });
  }

  const thumbOffsetPercent = railMetrics.hasOverflow
    ? railMetrics.progress * (100 - railMetrics.thumbWidthPercent)
    : 0;

  return (
    <div className={styles.setCardRail}>
      {items.length > 1 ? (
        <div className={styles.setCardRailControls}>
          <Button
            aria-controls={railId}
            aria-label={`Scroll ${ariaLabel} naar links`}
            className={styles.setCardRailButton}
            onClick={() => scrollRail('previous')}
            tone="secondary"
            type="button"
          >
            Vorige
          </Button>
          <Button
            aria-controls={railId}
            aria-label={`Scroll ${ariaLabel} naar rechts`}
            className={styles.setCardRailButton}
            onClick={() => scrollRail('next')}
            tone="secondary"
            type="button"
          >
            Volgende
          </Button>
        </div>
      ) : null}
      <div className={styles.setCardRailTrack} id={railId} ref={railRef}>
        {items.map((item) => (
          <div className={styles.setCardRailItem} key={item.id}>
            <CatalogSetCard
              actions={item.actions}
              href={item.href}
              priceContext={item.priceContext}
              setSummary={item.setSummary}
              supportingNote={item.supportingNote}
              variant={variant}
            />
          </div>
        ))}
      </div>
      {railMetrics.hasOverflow ? (
        <div
          aria-hidden="true"
          className={styles.setCardRailScrollbar}
          role="presentation"
        >
          <div
            className={styles.setCardRailScrollbarThumb}
            style={{
              left: `${thumbOffsetPercent}%`,
              width: `${railMetrics.thumbWidthPercent}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
