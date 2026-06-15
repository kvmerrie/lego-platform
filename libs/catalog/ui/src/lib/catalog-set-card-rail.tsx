'use client';

import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  ComponentProps,
  MouseEvent as ReactMouseEvent,
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
  imageFetchPriority?: 'auto' | 'high' | 'low';
  imageLoading?: 'eager' | 'lazy';
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

interface CatalogSetCardRailGestureState {
  didDrag: boolean;
  mode: 'horizontal' | 'vertical' | null;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
}

export type CatalogSetCardRailLayoutMode = 'default' | 'stable-square';

export interface CatalogSetCardRailRenderProps {
  controls: ReactNode;
  rail: ReactNode;
}

interface CatalogSetCardRailProps {
  ariaLabel: string;
  items: readonly CatalogSetCardRailItem[];
  railLayoutMode?: CatalogSetCardRailLayoutMode;
  mobileOverflowBleed?: boolean;
  mobileOverflowBleedUntil?: 'mobile' | 'page' | 'tablet';
  render?: (props: CatalogSetCardRailRenderProps) => ReactNode;
  showControls?: boolean;
  variant?: 'compact' | 'featured';
}

const RAIL_SCROLL_EPSILON = 1;
const RAIL_GESTURE_AXIS_THRESHOLD_PX = 10;
const RAIL_GESTURE_AXIS_RATIO = 1.6;
const RAIL_CLICK_SUPPRESS_THRESHOLD_PX = 6;
function areRailMetricsEqual(
  left: CatalogSetCardRailMetrics,
  right: CatalogSetCardRailMetrics,
): boolean {
  return (
    left.canScrollNext === right.canScrollNext &&
    left.canScrollPrevious === right.canScrollPrevious &&
    left.hasOverflow === right.hasOverflow &&
    left.progress === right.progress &&
    left.thumbWidthPercent === right.thumbWidthPercent
  );
}

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
        size="icon-md"
        tone="secondary"
        type="button"
        variant="icon-secondary"
      >
        <CatalogSetCardRailIcon icon={ChevronLeft} />
      </Button>
      <Button
        aria-controls={railId}
        aria-label={`Scroll ${ariaLabel} naar rechts`}
        className={styles.setCardRailHeadingButton}
        disabled={!canScrollNext}
        onClick={onNext}
        size="icon-md"
        tone="secondary"
        type="button"
        variant="icon-secondary"
      >
        <CatalogSetCardRailIcon icon={ChevronRight} />
      </Button>
    </div>
  );
}

const CatalogSetCardRailItems = memo(function CatalogSetCardRailItems({
  items,
  variant,
}: {
  items: readonly CatalogSetCardRailItem[];
  variant: 'compact' | 'featured';
}) {
  return (
    <>
      {items.map((item) => (
        <CatalogSetCard
          actions={item.actions}
          ctaMode={item.ctaMode}
          href={item.href}
          imageFetchPriority={item.imageFetchPriority}
          imageLoading={item.imageLoading}
          key={item.id}
          priceContext={item.priceContext}
          setSummary={item.setSummary}
          showThemeBadge={item.showThemeBadge}
          supportingNote={item.supportingNote}
          trackingEvent={item.trackingEvent}
          variant={variant}
        />
      ))}
    </>
  );
});

function CatalogSetCardRailViewport({
  ariaLabel,
  items,
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
  railLayoutMode = 'stable-square',
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
  const railGestureStateRef = useRef<CatalogSetCardRailGestureState | null>(
    null,
  );
  const suppressNextRailClickRef = useRef(false);
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

    const nextMetrics = getRailMetrics(railElement);

    setRailMetrics((currentMetrics) =>
      areRailMetricsEqual(currentMetrics, nextMetrics)
        ? currentMetrics
        : nextMetrics,
    );
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

    if (!railElement) {
      return undefined;
    }
    const measuredRailElement = railElement;

    queueRailMetricsFlush();
    measuredRailElement.addEventListener('scroll', flushRailMetrics, {
      passive: true,
    });

    return () => {
      cancelAnimationFrame(metricAnimationFrameIdRef.current);
      clearTimeout(metricFollowUpTimeoutIdRef.current);
      isMetricFrameQueuedRef.current = false;
      measuredRailElement.removeEventListener('scroll', flushRailMetrics);
    };
  }, [flushRailMetrics, items.length, queueRailMetricsFlush]);

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

  function cancelRailMomentum() {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const currentScrollLeft = railElement.scrollLeft;

    railElement.scrollTo?.({
      behavior: 'auto',
      left: currentScrollLeft,
    });
    railElement.scrollLeft = currentScrollLeft;
  }

  function handleRailPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    cancelRailMomentum();

    if (
      event.pointerType === 'mouse' ||
      event.button !== 0 ||
      !railMetrics.hasOverflow
    ) {
      railGestureStateRef.current = null;

      return;
    }

    railGestureStateRef.current = {
      didDrag: false,
      mode: null,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
    };
  }

  function handleRailPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gestureState = railGestureStateRef.current;

    if (!gestureState || gestureState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gestureState.startClientX;
    const deltaY = event.clientY - gestureState.startClientY;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (!gestureState.mode) {
      if (
        absoluteDeltaX < RAIL_GESTURE_AXIS_THRESHOLD_PX &&
        absoluteDeltaY < RAIL_GESTURE_AXIS_THRESHOLD_PX
      ) {
        return;
      }

      gestureState.mode =
        absoluteDeltaX > absoluteDeltaY * RAIL_GESTURE_AXIS_RATIO
          ? 'horizontal'
          : 'vertical';

      if (gestureState.mode === 'horizontal') {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else {
        railGestureStateRef.current = null;
        return;
      }
    }

    if (gestureState.mode !== 'horizontal') {
      return;
    }

    event.preventDefault();

    if (absoluteDeltaX >= RAIL_CLICK_SUPPRESS_THRESHOLD_PX) {
      gestureState.didDrag = true;
    }

    setRailScrollPosition(gestureState.startScrollLeft - deltaX);
  }

  function handleRailPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const gestureState = railGestureStateRef.current;

    if (!gestureState || gestureState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    suppressNextRailClickRef.current =
      gestureState.mode === 'horizontal' && gestureState.didDrag;
    railGestureStateRef.current = null;
    queueRailMetricsFollowUp();
  }

  function handleRailClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressNextRailClickRef.current) {
      return;
    }

    suppressNextRailClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
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
      } ${
        railLayoutMode === 'stable-square' ? styles.setCardRailStableSquare : ''
      }`.trim()}
      data-rail-layout-mode={
        railLayoutMode === 'stable-square' ? 'stable-square' : undefined
      }
      data-rail-mobile-bleed={mobileOverflowBleed ? 'true' : undefined}
      data-rail-mobile-bleed-until={
        mobileOverflowBleed ? mobileOverflowBleedUntil : undefined
      }
    >
      <CatalogSetCardCollection
        className={styles.setCardRailTrack}
        id={railId}
        layout="rail"
        onClickCapture={handleRailClickCapture}
        onPointerCancel={handleRailPointerEnd}
        onPointerDownCapture={handleRailPointerDown}
        onPointerMove={handleRailPointerMove}
        onPointerUp={handleRailPointerEnd}
        ref={railRef}
        variant={variant}
      >
        <CatalogSetCardRailItems items={items} variant={variant} />
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
  railLayoutMode = 'stable-square',
  render,
  showControls = false,
  variant = 'featured',
}: CatalogSetCardRailProps) {
  return (
    <CatalogSetCardRailViewport
      ariaLabel={ariaLabel}
      items={items}
      mobileOverflowBleed={mobileOverflowBleed}
      mobileOverflowBleedUntil={mobileOverflowBleedUntil}
      railLayoutMode={railLayoutMode}
      render={({ controls, rail }) =>
        render ? (
          render({ controls, rail })
        ) : showControls && controls ? (
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
  railLayoutMode = 'stable-square',
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
      railLayoutMode={railLayoutMode}
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
          description={undefined}
          signal={undefined}
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
  itemCount = 4,
  mobileOverflowBleed = false,
  mobileOverflowBleedUntil = 'mobile',
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
      description={undefined}
      signal={undefined}
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
