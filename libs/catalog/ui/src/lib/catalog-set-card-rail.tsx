'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  canScrollNext: boolean;
  canScrollPrevious: boolean;
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
  mobileOverflowBleed?: boolean;
  mobileOverflowBleedUntil?: 'mobile' | 'page' | 'tablet';
  showControls?: boolean;
  variant?: 'compact' | 'featured';
}

const RAIL_SCROLL_EPSILON = 1;

function getRailMetrics(
  railElement: HTMLDivElement,
): CatalogSetCardRailMetrics {
  const maxScrollLeft = Math.max(
    railElement.scrollWidth - railElement.clientWidth,
    0,
  );
  const normalizedScrollLeft = clampRailValue(
    railElement.scrollLeft,
    0,
    maxScrollLeft,
  );
  const hasOverflow = maxScrollLeft > RAIL_SCROLL_EPSILON;
  const thumbWidthPercent = railElement.scrollWidth
    ? Math.min((railElement.clientWidth / railElement.scrollWidth) * 100, 100)
    : 100;
  const progress = maxScrollLeft
    ? Math.min(Math.max(normalizedScrollLeft / maxScrollLeft, 0), 1)
    : 0;

  return {
    canScrollNext: normalizedScrollLeft < maxScrollLeft - RAIL_SCROLL_EPSILON,
    canScrollPrevious: normalizedScrollLeft > RAIL_SCROLL_EPSILON,
    hasOverflow,
    progress,
    thumbWidthPercent,
  };
}

function clampRailValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRailVisibleGroupScrollTarget({
  direction,
  itemCount,
  railElement,
}: {
  direction: 'next' | 'previous';
  itemCount: number;
  railElement: HTMLDivElement;
}): number {
  const maxScrollLeft = Math.max(
    railElement.scrollWidth - railElement.clientWidth,
    0,
  );

  if (itemCount <= 0 || maxScrollLeft <= RAIL_SCROLL_EPSILON) {
    return railElement.scrollLeft;
  }

  const estimatedCardSpan = railElement.scrollWidth / itemCount;

  if (!Number.isFinite(estimatedCardSpan) || estimatedCardSpan <= 0) {
    return clampRailValue(
      railElement.scrollLeft +
        (direction === 'next'
          ? railElement.clientWidth
          : -railElement.clientWidth),
      0,
      maxScrollLeft,
    );
  }

  const visibleCardCount = Math.max(
    1,
    Math.round(railElement.clientWidth / estimatedCardSpan),
  );
  const currentCardIndex = Math.round(
    railElement.scrollLeft / estimatedCardSpan,
  );
  const nextCardIndex =
    currentCardIndex +
    (direction === 'next' ? visibleCardCount : -visibleCardCount);
  const nextScrollLeft = nextCardIndex * estimatedCardSpan;

  return clampRailValue(nextScrollLeft, 0, maxScrollLeft);
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
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
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
    canScrollNext: false,
    canScrollPrevious: false,
    hasOverflow: false,
    progress: 0,
    thumbWidthPercent: 100,
  });
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);
  const metricAnimationFrameIdRef = useRef(0);
  const metricFollowUpTimeoutIdRef = useRef(0);
  const isMetricFrameQueuedRef = useRef(false);

  const flushRailMetrics = useCallback(() => {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    setRailMetrics(getRailMetrics(railElement));
  }, []);

  const queueRailMetricsFlush = useCallback(() => {
    if (isMetricFrameQueuedRef.current) {
      return;
    }

    isMetricFrameQueuedRef.current = true;
    metricAnimationFrameIdRef.current = requestAnimationFrame(() => {
      isMetricFrameQueuedRef.current = false;
      flushRailMetrics();
    });
  }, [flushRailMetrics]);

  const queueRailMetricsFollowUp = useCallback(() => {
    queueRailMetricsFlush();
    clearTimeout(metricFollowUpTimeoutIdRef.current);
    metricFollowUpTimeoutIdRef.current = window.setTimeout(
      flushRailMetrics,
      160,
    );
  }, [flushRailMetrics, queueRailMetricsFlush]);

  useEffect(() => {
    const railElement = railRef.current;
    const scrollbarElement = scrollbarRef.current;

    if (!railElement) {
      return undefined;
    }
    const cleanupImageListeners: Array<() => void> = [];

    function bindRailImageListeners() {
      const nextRailElement = railRef.current;

      cleanupImageListeners.splice(0).forEach((cleanup) => cleanup());

      if (!nextRailElement) {
        return;
      }

      const railImages = nextRailElement.querySelectorAll('img');

      railImages.forEach((image) => {
        image.addEventListener('load', queueRailMetricsFollowUp, {
          passive: true,
        });
        image.addEventListener('error', queueRailMetricsFollowUp, {
          passive: true,
        });

        cleanupImageListeners.push(() => {
          image.removeEventListener('load', queueRailMetricsFollowUp);
          image.removeEventListener('error', queueRailMetricsFollowUp);
        });
      });
    }

    queueRailMetricsFlush();
    metricAnimationFrameIdRef.current = requestAnimationFrame(() => {
      queueRailMetricsFollowUp();
    });
    railElement.addEventListener('scroll', flushRailMetrics, { passive: true });
    window.addEventListener('resize', queueRailMetricsFollowUp, {
      passive: true,
    });
    window.addEventListener('load', queueRailMetricsFollowUp, {
      passive: true,
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(queueRailMetricsFollowUp)
        : null;
    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            bindRailImageListeners();
            queueRailMetricsFollowUp();
          })
        : null;

    resizeObserver?.observe(railElement);
    if (scrollbarElement) {
      resizeObserver?.observe(scrollbarElement);
    }
    Array.from(railElement.children).forEach((child) => {
      resizeObserver?.observe(child);
    });
    mutationObserver?.observe(railElement, {
      childList: true,
      subtree: true,
    });
    bindRailImageListeners();

    return () => {
      cancelAnimationFrame(metricAnimationFrameIdRef.current);
      clearTimeout(metricFollowUpTimeoutIdRef.current);
      isMetricFrameQueuedRef.current = false;
      railElement.removeEventListener('scroll', flushRailMetrics);
      window.removeEventListener('resize', queueRailMetricsFollowUp);
      window.removeEventListener('load', queueRailMetricsFollowUp);
      cleanupImageListeners.splice(0).forEach((cleanup) => cleanup());
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [
    flushRailMetrics,
    items.length,
    queueRailMetricsFlush,
    queueRailMetricsFollowUp,
  ]);

  if (!items.length) {
    return null;
  }

  function scrollRail(direction: 'next' | 'previous') {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const nextScrollLeft = getRailVisibleGroupScrollTarget({
      direction,
      itemCount: items.length,
      railElement,
    });

    railElement.scrollBy({
      behavior: 'smooth',
      left: nextScrollLeft - railElement.scrollLeft,
    });
    queueRailMetricsFollowUp();
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
    flushRailMetrics();
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
      canScrollNext={railMetrics.canScrollNext}
      canScrollPrevious={railMetrics.canScrollPrevious}
      hasOverflow={hasDesktopControls}
      onNext={() => scrollRail('next')}
      onPrevious={() => scrollRail('previous')}
      railId={railId}
    />
  ) : null;
  const rail = (
    <div
      className={`${styles.setCardRail} ${
        mobileOverflowBleed
          ? mobileOverflowBleedUntil === 'page'
            ? styles.setCardRailPageBleed
            : mobileOverflowBleedUntil === 'tablet'
              ? styles.setCardRailTabletBleed
              : styles.setCardRailMobileBleed
          : ''
      }`.trim()}
      data-rail-mobile-bleed={mobileOverflowBleed ? 'true' : undefined}
      data-rail-mobile-bleed-until={
        mobileOverflowBleed ? mobileOverflowBleedUntil : undefined
      }
    >
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
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
  showControls = false,
  variant = 'featured',
}: CatalogSetCardRailProps) {
  return (
    <CatalogSetCardRailViewport
      ariaLabel={ariaLabel}
      items={items}
      mobileOverflowBleed={mobileOverflowBleed}
      mobileOverflowBleedUntil={mobileOverflowBleedUntil}
      render={({ controls, rail }) =>
        showControls && controls ? (
          <div className={styles.setCardRailInline}>
            <div className={styles.setCardRailInlineControls}>{controls}</div>
            {rail}
          </div>
        ) : (
          rail
        )
      }
      variant={variant}
    />
  );
}

export function CatalogSetCardRailSection({
  ariaLabel,
  className,
  footer,
  items,
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
  railClassName,
  surfaceVariant = 'default',
  tone = surfaceVariant === 'themed' ? 'default' : 'plain',
  variant = 'featured',
  ...sectionProps
}: Omit<
  ComponentProps<typeof CatalogSectionShell>,
  'children' | 'utility' | 'utilityPlacement'
> &
  CatalogSetCardRailProps & {
    footer?: ReactNode;
    railClassName?: string;
    surfaceVariant?: 'default' | 'themed';
  }) {
  return (
    <CatalogSetCardRailViewport
      ariaLabel={ariaLabel}
      items={items}
      mobileOverflowBleed={mobileOverflowBleed}
      mobileOverflowBleedUntil={mobileOverflowBleedUntil}
      render={({ controls, rail }) => (
        <CatalogSectionShell
          className={[
            className,
            mobileOverflowBleed && mobileOverflowBleedUntil === 'tablet'
              ? styles.setCardRailSectionTabletBleed
              : mobileOverflowBleed && mobileOverflowBleedUntil === 'page'
                ? styles.setCardRailSectionPageBleed
                : '',
            surfaceVariant === 'themed' ? styles.setCardRailSectionThemed : '',
          ]
            .filter(Boolean)
            .join(' ')}
          tone={tone}
          {...sectionProps}
          utility={controls}
          utilityPlacement="aside"
        >
          <div className={railClassName}>{rail}</div>
          {footer}
        </CatalogSectionShell>
      )}
      variant={variant}
    />
  );
}

export function CatalogSetCardRailSkeletonSection({
  ariaLabel,
  className,
  description,
  eyebrow,
  itemCount = 4,
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
  signal,
  surfaceVariant = 'default',
  title,
  tone = surfaceVariant === 'themed' ? 'default' : 'plain',
}: Pick<
  ComponentProps<typeof CatalogSectionShell>,
  'description' | 'eyebrow' | 'signal' | 'title' | 'tone'
> & {
  ariaLabel: string;
  className?: string;
  itemCount?: number;
  mobileOverflowBleed?: boolean;
  mobileOverflowBleedUntil?: 'mobile' | 'page' | 'tablet';
  surfaceVariant?: 'default' | 'themed';
}) {
  const skeletonItems = Array.from(
    { length: Math.max(1, itemCount) },
    (_, index) => index,
  );

  return (
    <CatalogSectionShell
      aria-label={ariaLabel}
      className={[
        className,
        styles.setCardRailSkeletonSection,
        mobileOverflowBleed && mobileOverflowBleedUntil === 'tablet'
          ? styles.setCardRailSectionTabletBleed
          : mobileOverflowBleed && mobileOverflowBleedUntil === 'page'
            ? styles.setCardRailSectionPageBleed
            : '',
        surfaceVariant === 'themed' ? styles.setCardRailSectionThemed : '',
      ]
        .filter(Boolean)
        .join(' ')}
      description={description}
      eyebrow={eyebrow}
      signal={signal}
      title={title}
      tone={tone}
    >
      <div
        aria-hidden="true"
        className={[
          styles.setCardRail,
          mobileOverflowBleed
            ? mobileOverflowBleedUntil === 'page'
              ? styles.setCardRailPageBleed
              : mobileOverflowBleedUntil === 'tablet'
                ? styles.setCardRailTabletBleed
                : styles.setCardRailMobileBleed
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.setCardRailSkeletonTrack}>
          {skeletonItems.map((index) => (
            <div className={styles.setCardRailSkeletonCard} key={index}>
              <div className={styles.setCardRailSkeletonImage} />
              <div className={styles.setCardRailSkeletonLine} />
              <div className={styles.setCardRailSkeletonLineShort} />
            </div>
          ))}
        </div>
      </div>
    </CatalogSectionShell>
  );
}
