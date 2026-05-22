'use client';

import {
  forwardRef,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import styles from './catalog-ui.module.css';

export type CatalogSetCardMobileView = 'large' | 'compact';

export const SET_CARD_MOBILE_VIEW_STORAGE_KEY =
  'brickhunt:set-card-mobile-view';

export function normalizeSetCardMobileView(
  value: string | null | undefined,
): CatalogSetCardMobileView {
  return value === 'compact' ? 'compact' : 'large';
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

  useEffect(() => {
    setMobileView(readSavedMobileView());
  }, []);

  function updateMobileView(value: CatalogSetCardMobileView): void {
    setMobileView(value);
    saveMobileView(value);
  }

  return (
    <>
      <div
        aria-label="Mobiele kaartweergave"
        className={styles.setCardMobileLayoutToggle}
        role="group"
      >
        <button
          aria-pressed={mobileView === 'large'}
          className={styles.setCardMobileLayoutButton}
          onClick={() => updateMobileView('large')}
          type="button"
        >
          Groot
        </button>
        <button
          aria-pressed={mobileView === 'compact'}
          className={styles.setCardMobileLayoutButton}
          onClick={() => updateMobileView('compact')}
          type="button"
        >
          Compact
        </button>
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
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
