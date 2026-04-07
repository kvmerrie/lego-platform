'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { Button } from '@lego-platform/shared/ui';
import type { BrickhuntAnalyticsEventDescriptor } from '@lego-platform/shared/util';
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
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
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
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const dragAbortControllerRef = useRef<AbortController | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragThumbOffsetRef = useRef(0);
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
    let isFrameQueued = false;

    function syncRailMetrics() {
      if (isFrameQueued) {
        return;
      }

      isFrameQueued = true;
      animationFrameId = requestAnimationFrame(() => {
        isFrameQueued = false;
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

  useEffect(
    () => () => {
      dragAbortControllerRef.current?.abort();
    },
    [],
  );

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

  function scrollRailFromThumbPosition(clientX: number) {
    const railElement = railRef.current;
    const scrollbarElement = scrollbarRef.current;

    if (!railElement || !scrollbarElement) {
      return;
    }

    const scrollbarRect = scrollbarElement.getBoundingClientRect();
    const maxScrollLeft = Math.max(
      railElement.scrollWidth - railElement.clientWidth,
      0,
    );

    if (maxScrollLeft <= 0 || scrollbarRect.width <= 0) {
      return;
    }

    const thumbWidth =
      (railMetrics.thumbWidthPercent / 100) * scrollbarRect.width;
    const maxThumbOffset = Math.max(scrollbarRect.width - thumbWidth, 0);
    const nextThumbOffset = Math.min(
      Math.max(clientX - scrollbarRect.left - dragThumbOffsetRef.current, 0),
      maxThumbOffset,
    );
    const nextProgress = maxThumbOffset ? nextThumbOffset / maxThumbOffset : 0;

    railElement.scrollLeft = nextProgress * maxScrollLeft;
  }

  function beginScrollbarDrag({
    clientX,
    pointerId,
    thumbOffset,
  }: {
    clientX: number;
    pointerId: number;
    thumbOffset: number;
  }) {
    dragAbortControllerRef.current?.abort();
    dragPointerIdRef.current = pointerId;
    dragThumbOffsetRef.current = thumbOffset;
    scrollRailFromThumbPosition(clientX);
    const dragAbortController = new AbortController();
    dragAbortControllerRef.current = dragAbortController;

    function handlePointerMove(event: PointerEvent) {
      if (dragPointerIdRef.current !== event.pointerId) {
        return;
      }

      scrollRailFromThumbPosition(event.clientX);
    }

    function handlePointerEnd(event: PointerEvent) {
      if (dragPointerIdRef.current !== event.pointerId) {
        return;
      }

      dragPointerIdRef.current = null;
      dragAbortController.abort();
      dragAbortControllerRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove, {
      signal: dragAbortController.signal,
    });
    window.addEventListener('pointerup', handlePointerEnd, {
      signal: dragAbortController.signal,
    });
    window.addEventListener('pointercancel', handlePointerEnd, {
      signal: dragAbortController.signal,
    });
  }

  function handleScrollbarPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const scrollbarElement = scrollbarRef.current;

    if (!scrollbarElement) {
      return;
    }

    event.preventDefault();

    const scrollbarRect = scrollbarElement.getBoundingClientRect();
    const thumbWidth =
      (railMetrics.thumbWidthPercent / 100) * scrollbarRect.width;

    beginScrollbarDrag({
      clientX: event.clientX,
      pointerId: event.pointerId,
      thumbOffset: thumbWidth / 2,
    });
  }

  function handleScrollbarThumbPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const thumbRect = event.currentTarget.getBoundingClientRect();

    event.preventDefault();
    event.stopPropagation();

    beginScrollbarDrag({
      clientX: event.clientX,
      pointerId: event.pointerId,
      thumbOffset: event.clientX - thumbRect.left,
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
              trackingEvent={item.trackingEvent}
              variant={variant}
            />
          </div>
        ))}
      </div>
      {railMetrics.hasOverflow ? (
        <div
          aria-hidden="true"
          className={styles.setCardRailScrollbar}
          onPointerDown={handleScrollbarPointerDown}
          ref={scrollbarRef}
          role="presentation"
        >
          <div
            className={styles.setCardRailScrollbarThumb}
            onPointerDown={handleScrollbarThumbPointerDown}
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
