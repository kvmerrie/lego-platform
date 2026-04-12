'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  ComponentProps,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { Button } from '@lego-platform/shared/ui';
import type { BrickhuntAnalyticsEventDescriptor } from '@lego-platform/shared/util';
import { CatalogSectionShell } from './catalog-composite-ui';
import {
  CatalogSetCard,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  type CatalogSetCardPriceContext,
} from './catalog-ui';
import styles from './catalog-ui.module.css';

type CatalogSetCardRailSummary = CatalogSetSummary &
  Partial<Pick<CatalogHomepageSetCard, 'availability' | 'tagline'>>;

export interface CatalogSetCardRailItem {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  href?: string;
  id: string;
  priceContext?: CatalogSetCardPriceContext;
  setSummary: CatalogSetCardRailSummary;
  showThemeBadge?: boolean;
  supportingNote?: ReactNode;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
}

interface CatalogSetCardRailMetrics {
  hasOverflow: boolean;
  progress: number;
  thumbWidthPercent: number;
}

interface CatalogSetCardRailScrollbarDragState {
  maxScrollLeft: number;
  maxThumbOffset: number;
  pointerId: number;
  startClientX: number;
  startScrollLeft: number;
}

interface CatalogSetCardRailProps {
  ariaLabel: string;
  items: readonly CatalogSetCardRailItem[];
  variant?: 'compact' | 'featured';
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

function clampRailValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function CatalogSetCardRailIcon({
  icon: Icon,
}: {
  icon: typeof ChevronLeft | typeof ChevronRight;
}) {
  return (
    <Icon
      className={styles.setCardRailHeadingIcon}
      size={16}
      strokeWidth={2.35}
    />
  );
}

function CatalogSetCardRailHeadingControls({
  ariaLabel,
  canScrollNext,
  canScrollPrevious,
  hasOverflow,
  onNext,
  onPrevious,
  railId,
}: {
  ariaLabel: string;
  canScrollNext: boolean;
  canScrollPrevious: boolean;
  hasOverflow: boolean;
  onNext: () => void;
  onPrevious: () => void;
  railId: string;
}) {
  if (!hasOverflow) {
    return null;
  }

  return (
    <div className={styles.setCardRailHeadingControls}>
      <Button
        aria-controls={railId}
        aria-label={`Scroll ${ariaLabel} naar links`}
        className={styles.setCardRailHeadingButton}
        disabled={!canScrollPrevious}
        onClick={onPrevious}
        tone="secondary"
        type="button"
      >
        <CatalogSetCardRailIcon icon={ChevronLeft} />
      </Button>
      <Button
        aria-controls={railId}
        aria-label={`Scroll ${ariaLabel} naar rechts`}
        className={styles.setCardRailHeadingButton}
        disabled={!canScrollNext}
        onClick={onNext}
        tone="secondary"
        type="button"
      >
        <CatalogSetCardRailIcon icon={ChevronRight} />
      </Button>
    </div>
  );
}

function CatalogSetCardRailViewport({
  ariaLabel,
  items,
  render,
  variant = 'featured',
}: CatalogSetCardRailProps & {
  render: (content: { controls: ReactNode; rail: ReactNode }) => ReactNode;
}) {
  const railId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const scrollbarDragStateRef =
    useRef<CatalogSetCardRailScrollbarDragState | null>(null);
  const [railMetrics, setRailMetrics] = useState<CatalogSetCardRailMetrics>({
    hasOverflow: false,
    progress: 0,
    thumbWidthPercent: 100,
  });
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

  useEffect(() => {
    const railElement = railRef.current;

    if (!railElement) {
      return undefined;
    }

    let animationFrameId = 0;
    let followUpAnimationFrameId = 0;
    let isFrameQueued = false;
    let syncTimeoutId = 0;
    const cleanupImageListeners: Array<() => void> = [];

    function flushRailMetrics() {
      const nextRailElement = railRef.current;

      if (!nextRailElement) {
        return;
      }

      setRailMetrics(getRailMetrics(nextRailElement));
    }

    function syncRailMetrics() {
      if (isFrameQueued) {
        return;
      }

      isFrameQueued = true;
      animationFrameId = requestAnimationFrame(() => {
        isFrameQueued = false;
        flushRailMetrics();
      });
    }

    function syncRailMetricsSoon() {
      syncRailMetrics();
      clearTimeout(syncTimeoutId);
      syncTimeoutId = window.setTimeout(flushRailMetrics, 120);
    }

    function bindRailImageListeners() {
      const nextRailElement = railRef.current;

      cleanupImageListeners.splice(0).forEach((cleanup) => cleanup());

      if (!nextRailElement) {
        return;
      }

      const railImages = nextRailElement.querySelectorAll('img');

      railImages.forEach((image) => {
        image.addEventListener('load', syncRailMetricsSoon, { passive: true });
        image.addEventListener('error', syncRailMetricsSoon, {
          passive: true,
        });

        cleanupImageListeners.push(() => {
          image.removeEventListener('load', syncRailMetricsSoon);
          image.removeEventListener('error', syncRailMetricsSoon);
        });
      });
    }

    syncRailMetrics();
    followUpAnimationFrameId = requestAnimationFrame(() => {
      syncRailMetricsSoon();
    });
    railElement.addEventListener('scroll', syncRailMetrics, { passive: true });
    window.addEventListener('resize', syncRailMetricsSoon, { passive: true });
    window.addEventListener('load', syncRailMetricsSoon, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncRailMetricsSoon)
        : null;
    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            bindRailImageListeners();
            syncRailMetricsSoon();
          })
        : null;

    resizeObserver?.observe(railElement);
    Array.from(railElement.children).forEach((child) => {
      resizeObserver?.observe(child);
    });
    mutationObserver?.observe(railElement, {
      childList: true,
      subtree: true,
    });
    bindRailImageListeners();

    return () => {
      cancelAnimationFrame(animationFrameId);
      cancelAnimationFrame(followUpAnimationFrameId);
      clearTimeout(syncTimeoutId);
      railElement.removeEventListener('scroll', syncRailMetrics);
      window.removeEventListener('resize', syncRailMetricsSoon);
      window.removeEventListener('load', syncRailMetricsSoon);
      cleanupImageListeners.splice(0).forEach((cleanup) => cleanup());
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
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

  function getScrollbarLayout() {
    const railElement = railRef.current;
    const scrollbarElement = scrollbarRef.current;

    if (!railElement || !scrollbarElement) {
      return null;
    }

    const maxScrollLeft = Math.max(
      railElement.scrollWidth - railElement.clientWidth,
      0,
    );
    const trackWidth = scrollbarElement.clientWidth;
    const thumbWidth = (trackWidth * railMetrics.thumbWidthPercent) / 100;
    const maxThumbOffset = Math.max(trackWidth - thumbWidth, 0);

    return {
      maxScrollLeft,
      maxThumbOffset,
      railElement,
      scrollbarElement,
      thumbWidth,
      trackWidth,
    };
  }

  function setRailScrollPosition(nextScrollLeft: number) {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const maxScrollLeft = Math.max(
      railElement.scrollWidth - railElement.clientWidth,
      0,
    );
    railElement.scrollLeft = clampRailValue(nextScrollLeft, 0, maxScrollLeft);
    setRailMetrics(getRailMetrics(railElement));
  }

  function handleScrollbarTrackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0 || !railMetrics.hasOverflow) {
      return;
    }

    const layout = getScrollbarLayout();

    if (!layout || layout.maxScrollLeft <= 0) {
      return;
    }

    event.preventDefault();

    const pointerOffset =
      event.clientX - layout.scrollbarElement.getBoundingClientRect().left;
    const nextThumbOffset = clampRailValue(
      pointerOffset - layout.thumbWidth / 2,
      0,
      layout.maxThumbOffset,
    );
    const nextProgress = layout.maxThumbOffset
      ? nextThumbOffset / layout.maxThumbOffset
      : 0;

    setRailScrollPosition(nextProgress * layout.maxScrollLeft);
  }

  function handleScrollbarThumbPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0 || !railMetrics.hasOverflow) {
      return;
    }

    const layout = getScrollbarLayout();

    if (!layout || layout.maxScrollLeft <= 0 || layout.maxThumbOffset <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    scrollbarDragStateRef.current = {
      maxScrollLeft: layout.maxScrollLeft,
      maxThumbOffset: layout.maxThumbOffset,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startScrollLeft: layout.railElement.scrollLeft,
    };
    setIsScrollbarDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleScrollbarThumbPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const dragState = scrollbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const scrollDelta =
      ((event.clientX - dragState.startClientX) / dragState.maxThumbOffset) *
      dragState.maxScrollLeft;

    setRailScrollPosition(dragState.startScrollLeft + scrollDelta);
  }

  function handleScrollbarThumbPointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const dragState = scrollbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    scrollbarDragStateRef.current = null;
    setIsScrollbarDragging(false);
  }

  const thumbOffsetPercent = railMetrics.hasOverflow
    ? railMetrics.progress * (100 - railMetrics.thumbWidthPercent)
    : 0;
  const hasDesktopControls = items.length > 1 && railMetrics.hasOverflow;
  const shouldRenderScrollbar = items.length > 1;
  const controls = hasDesktopControls ? (
    <CatalogSetCardRailHeadingControls
      ariaLabel={ariaLabel}
      canScrollNext={railMetrics.progress < 0.99}
      canScrollPrevious={railMetrics.progress > 0.01}
      hasOverflow={hasDesktopControls}
      onNext={() => scrollRail('next')}
      onPrevious={() => scrollRail('previous')}
      railId={railId}
    />
  ) : null;
  const rail = (
    <div className={styles.setCardRail}>
      <CatalogSetCardCollection
        className={styles.setCardRailTrack}
        id={railId}
        layout="rail"
        ref={railRef}
        variant={variant}
      >
        {items.map((item) => (
          <CatalogSetCard
            actions={item.actions}
            ctaMode={item.ctaMode}
            href={item.href}
            key={item.id}
            priceContext={item.priceContext}
            setSummary={item.setSummary}
            showThemeBadge={item.showThemeBadge}
            supportingNote={item.supportingNote}
            trackingEvent={item.trackingEvent}
            variant={variant}
          />
        ))}
      </CatalogSetCardCollection>
      {shouldRenderScrollbar ? (
        <div
          aria-hidden="true"
          className={styles.setCardRailScrollbar}
          data-dragging={isScrollbarDragging ? 'true' : undefined}
          data-visible={railMetrics.hasOverflow ? 'true' : 'false'}
          onPointerDown={handleScrollbarTrackPointerDown}
          ref={scrollbarRef}
          role="presentation"
        >
          <div
            className={styles.setCardRailScrollbarThumb}
            data-dragging={isScrollbarDragging ? 'true' : undefined}
            onPointerCancel={handleScrollbarThumbPointerEnd}
            onPointerDown={handleScrollbarThumbPointerDown}
            onPointerMove={handleScrollbarThumbPointerMove}
            onPointerUp={handleScrollbarThumbPointerEnd}
            style={{
              left: `${thumbOffsetPercent}%`,
              width: `${railMetrics.thumbWidthPercent}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );

  return render({
    controls,
    rail,
  });
}

export function CatalogSetCardRail({
  ariaLabel,
  items,
  variant = 'featured',
}: CatalogSetCardRailProps) {
  return (
    <CatalogSetCardRailViewport
      ariaLabel={ariaLabel}
      items={items}
      render={({ rail }) => rail}
      variant={variant}
    />
  );
}

export function CatalogSetCardRailSection({
  ariaLabel,
  items,
  variant = 'featured',
  ...sectionProps
}: Omit<
  ComponentProps<typeof CatalogSectionShell>,
  'children' | 'utility' | 'utilityPlacement'
> &
  CatalogSetCardRailProps) {
  return (
    <CatalogSetCardRailViewport
      ariaLabel={ariaLabel}
      items={items}
      render={({ controls, rail }) => (
        <CatalogSectionShell
          utility={controls}
          utilityPlacement="aside"
          {...sectionProps}
        >
          {rail}
        </CatalogSectionShell>
      )}
      variant={variant}
    />
  );
}
