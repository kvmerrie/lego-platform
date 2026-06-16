'use client';

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Button } from '@lego-platform/shared/ui';
import { runWithProgrammaticScrollSuppression } from '@lego-platform/shared/util';
import { Grid2x2, Square } from 'lucide-react';
import styles from './catalog-ui.module.css';

export type CatalogSetCardMobileView = 'large' | 'compact';

export const SET_CARD_MOBILE_VIEW_STORAGE_KEY =
  'brickhunt:set-card-mobile-view';

export function normalizeSetCardMobileView(
  value: string | null | undefined,
): CatalogSetCardMobileView {
  return value === 'compact' ? 'compact' : 'large';
}

export interface CatalogSetCardViewportAnchorCandidate {
  bottom: number;
  setId: string;
  top: number;
}

export function getCatalogSetCardViewportAnchorId({
  candidates,
  viewportBottom,
  viewportTop,
}: {
  candidates: readonly CatalogSetCardViewportAnchorCandidate[];
  viewportBottom: number;
  viewportTop: number;
}): string | undefined {
  const firstFullyVisibleCandidate = candidates.find(
    (candidate) =>
      candidate.top >= viewportTop && candidate.bottom <= viewportBottom,
  );

  if (firstFullyVisibleCandidate) {
    return firstFullyVisibleCandidate.setId;
  }

  return candidates.reduce<CatalogSetCardViewportAnchorCandidate | undefined>(
    (bestCandidate, candidate) => {
      if (!bestCandidate) {
        return candidate;
      }

      return Math.abs(candidate.top - viewportTop) <
        Math.abs(bestCandidate.top - viewportTop)
        ? candidate
        : bestCandidate;
    },
    undefined,
  )?.setId;
}

export function getCatalogSetCardAnchorScrollTop({
  currentScrollY,
  elementTop,
  stickyOffset,
}: {
  currentScrollY: number;
  elementTop: number;
  stickyOffset: number;
}): number {
  return Math.max(0, currentScrollY + elementTop - stickyOffset);
}

export function isCatalogSetCardMobileToolbarStuck({
  sentinelTop,
  stickyTop,
}: {
  sentinelTop: number;
  stickyTop: number;
}): boolean {
  return sentinelTop <= stickyTop + 0.5;
}

export function getCatalogSetCardMobileToolbarStuckThreshold({
  currentIsStuck,
  headerHeight,
  headerHidden,
}: {
  currentIsStuck: boolean;
  headerHeight: number;
  headerHidden: boolean;
}): number {
  if (currentIsStuck) {
    return Math.max(0, headerHeight);
  }

  return headerHidden ? 0 : Math.max(0, headerHeight);
}

function readSavedMobileView(): CatalogSetCardMobileView {
  if (typeof window === 'undefined') {
    return 'large';
  }

  try {
    return normalizeSetCardMobileView(
      window.localStorage.getItem(SET_CARD_MOBILE_VIEW_STORAGE_KEY),
    );
  } catch {
    return 'large';
  }
}

function saveMobileView(value: CatalogSetCardMobileView): void {
  try {
    window.localStorage.setItem(SET_CARD_MOBILE_VIEW_STORAGE_KEY, value);
  } catch {
    // localStorage can be unavailable in privacy modes; the toggle still works.
  }
}

function assignForwardedRef<T>(
  forwardedRef: ForwardedRef<T>,
  value: T | null,
): void {
  if (typeof forwardedRef === 'function') {
    forwardedRef(value);

    return;
  }

  if (forwardedRef) {
    forwardedRef.current = value;
  }
}

function escapeAttributeValue(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/"/g, '\\"');
}

export const CatalogSetCardCollectionBrowseMobileLayout = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
  }
>(function CatalogSetCardCollectionBrowseMobileLayout(
  { children, className, ...props },
  ref,
) {
  const [mobileView, setMobileView] =
    useState<CatalogSetCardMobileView>('large');
  const gridRef = useRef<HTMLDivElement | null>(null);
  const pendingAnchorSetIdRef = useRef<string | undefined>(undefined);
  const sentinelRef = useRef<HTMLSpanElement | null>(null);
  const [isToolbarStuck, setIsToolbarStuck] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const getToolbarHeaderOffset = useCallback((): number => {
    const toolbarElement = toolbarRef.current;

    if (!toolbarElement) {
      return 0;
    }

    const toolbarHeaderOffset = Number.parseFloat(
      getComputedStyle(toolbarElement).scrollMarginTop,
    );

    return Number.isFinite(toolbarHeaderOffset) ? toolbarHeaderOffset : 0;
  }, []);

  const getToolbarStickyTopForState = useCallback(
    (currentIsStuck: boolean): number =>
      getCatalogSetCardMobileToolbarStuckThreshold({
        currentIsStuck,
        headerHeight: getToolbarHeaderOffset(),
        headerHidden:
          document.documentElement.getAttribute('data-shell-header-hidden') ===
          'true',
      }),
    [getToolbarHeaderOffset],
  );

  const getToolbarStickyOffset = useCallback((): number => {
    const toolbarElement = toolbarRef.current;

    if (!toolbarElement) {
      return 0;
    }

    const toolbarRect = toolbarElement.getBoundingClientRect();

    return toolbarRect.height + getToolbarStickyTopForState(isToolbarStuck);
  }, [getToolbarStickyTopForState, isToolbarStuck]);

  useEffect(() => {
    setMobileView(readSavedMobileView());
  }, []);

  useLayoutEffect(() => {
    const anchorSetId = pendingAnchorSetIdRef.current;

    if (!anchorSetId) {
      return undefined;
    }

    pendingAnchorSetIdRef.current = undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      const gridElement = gridRef.current;
      const targetElement = gridElement?.querySelector<HTMLElement>(
        `[data-catalog-set-card-id="${escapeAttributeValue(anchorSetId)}"]`,
      );

      if (!targetElement) {
        return;
      }

      runWithProgrammaticScrollSuppression(
        () => {
          window.scrollTo({
            behavior: 'auto',
            top: getCatalogSetCardAnchorScrollTop({
              currentScrollY: window.scrollY,
              elementTop: targetElement.getBoundingClientRect().top,
              stickyOffset: getToolbarStickyOffset(),
            }),
          });
        },
        { reason: 'collection-view-anchor-restore' },
      );
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [getToolbarStickyOffset, mobileView]);

  useEffect(() => {
    let animationFrame = 0;
    const documentElement = document.documentElement;

    function syncToolbarStuckState(): void {
      animationFrame = 0;

      const sentinelElement = sentinelRef.current;
      const toolbarElement = toolbarRef.current;

      if (!sentinelElement || !toolbarElement) {
        return;
      }

      const sentinelTop = sentinelElement.getBoundingClientRect().top;

      setIsToolbarStuck((currentIsStuck) => {
        const nextIsStuck = isCatalogSetCardMobileToolbarStuck({
          sentinelTop,
          stickyTop: getToolbarStickyTopForState(currentIsStuck),
        });

        return currentIsStuck === nextIsStuck ? currentIsStuck : nextIsStuck;
      });
    }

    function scheduleToolbarStuckStateSync(): void {
      if (animationFrame !== 0) {
        return;
      }

      animationFrame = window.requestAnimationFrame(syncToolbarStuckState);
    }

    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(scheduleToolbarStuckStateSync);

    syncToolbarStuckState();

    window.addEventListener('scroll', scheduleToolbarStuckStateSync, {
      passive: true,
    });
    window.addEventListener('resize', scheduleToolbarStuckStateSync);
    window.addEventListener('orientationchange', scheduleToolbarStuckStateSync);
    mutationObserver?.observe(documentElement, {
      attributeFilter: ['data-shell-header-hidden'],
      attributes: true,
    });

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener('scroll', scheduleToolbarStuckStateSync);
      window.removeEventListener('resize', scheduleToolbarStuckStateSync);
      window.removeEventListener(
        'orientationchange',
        scheduleToolbarStuckStateSync,
      );
      mutationObserver?.disconnect();
    };
  }, [getToolbarStickyTopForState]);

  function getViewportAnchorSetId(): string | undefined {
    const gridElement = gridRef.current;

    if (!gridElement) {
      return undefined;
    }

    const candidates = Array.from(
      gridElement.querySelectorAll<HTMLElement>('[data-catalog-set-card-id]'),
    ).flatMap<CatalogSetCardViewportAnchorCandidate>((candidateElement) => {
      const setId = candidateElement.dataset.catalogSetCardId;

      if (!setId) {
        return [];
      }

      const candidateRect = candidateElement.getBoundingClientRect();

      return [
        {
          bottom: candidateRect.bottom,
          setId,
          top: candidateRect.top,
        },
      ];
    });

    return getCatalogSetCardViewportAnchorId({
      candidates,
      viewportBottom: window.innerHeight,
      viewportTop: getToolbarStickyOffset(),
    });
  }

  function updateMobileView(value: CatalogSetCardMobileView): void {
    if (value === mobileView) {
      return;
    }

    pendingAnchorSetIdRef.current = getViewportAnchorSetId();
    setMobileView(value);
    saveMobileView(value);
  }

  return (
    <>
      <span
        aria-hidden="true"
        className={styles.setCardMobileLayoutSentinel}
        data-catalog-set-card-mobile-toolbar-sentinel="true"
        ref={sentinelRef}
      />
      <div
        aria-label="Mobiele kaartweergave"
        className={styles.setCardMobileLayoutToggle}
        data-catalog-set-card-mobile-toolbar="true"
        data-stuck={isToolbarStuck ? 'true' : 'false'}
        ref={toolbarRef}
        role="group"
      >
        <span className={styles.setCardMobileLayoutLabel}>Weergave</span>
        <span className={styles.setCardMobileLayoutActions}>
          <Button
            aria-label="Toon grote kaarten"
            aria-pressed={mobileView === 'large'}
            className={styles.setCardMobileLayoutButton}
            data-catalog-set-card-layout-state={
              mobileView === 'large' ? 'active' : 'inactive'
            }
            onClick={() => updateMobileView('large')}
            size="icon-md"
            type="button"
            variant="icon-secondary"
          >
            <Square
              aria-hidden="true"
              className={styles.setCardMobileLayoutIcon}
              size={19}
              strokeWidth={mobileView === 'large' ? 2.2 : 2.05}
            />
          </Button>
          <Button
            aria-label="Toon compacte kaarten"
            aria-pressed={mobileView === 'compact'}
            className={styles.setCardMobileLayoutButton}
            data-catalog-set-card-layout-state={
              mobileView === 'compact' ? 'active' : 'inactive'
            }
            onClick={() => updateMobileView('compact')}
            size="icon-md"
            type="button"
            variant="icon-secondary"
          >
            <Grid2x2
              aria-hidden="true"
              className={styles.setCardMobileLayoutIcon}
              size={19}
              strokeWidth={mobileView === 'compact' ? 2.2 : 2.05}
            />
          </Button>
        </span>
      </div>
      <div
        className={[
          className,
          mobileView === 'compact'
            ? styles.setCardCollectionMobileTwoColumn
            : styles.setCardCollectionMobileOneColumn,
        ]
          .filter(Boolean)
          .join(' ')}
        data-catalog-set-card-mobile-view={mobileView}
        ref={(node) => {
          gridRef.current = node;
          assignForwardedRef(ref, node);
        }}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
