'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogFeatureSetListItem } from '@lego-platform/catalog/feature-set-list';
import {
  CatalogSetCardRail,
  type CatalogSetCardRailItem,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import type { BrickhuntAnalyticsProperties } from '@lego-platform/shared/util';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import styles from '../page.module.css';

export type HomepageTabbedCommerceRailTabId =
  | 'best-deals'
  | 'biggest-price-drops'
  | 'gifts-under-100'
  | 'popular-this-week'
  | 'smart-to-follow'
  | 'wait-can-pay-off';

type HomepageTabbedCommerceRailWishlistAnalyticsContext =
  BrickhuntAnalyticsProperties & {
    cardSurface: 'buy' | 'follow';
    merchantName?: string;
    pageSurface: 'homepage';
    sectionId: string;
    setId: string;
    tabId: HomepageTabbedCommerceRailTabId;
    theme: string;
  };

export type HomepageTabbedCommerceRailCard = Omit<
  CatalogFeatureSetListItem,
  'actions'
> & {
  productIntent: 'price-alert' | 'wishlist';
  wishlistAnalyticsContext: HomepageTabbedCommerceRailWishlistAnalyticsContext;
};

export interface HomepageTabbedCommerceRailTab {
  actionHref?: string;
  actionLabel?: string;
  cards: readonly HomepageTabbedCommerceRailCard[];
  description: string;
  id: HomepageTabbedCommerceRailTabId;
  sectionId: string;
  title: string;
}

function toHomepageRailItems(
  setCards: readonly HomepageTabbedCommerceRailCard[],
): CatalogSetCardRailItem[] {
  return setCards.map(
    ({ productIntent, wishlistAnalyticsContext, ...homepageSetCard }) => ({
      actions: (
        <WishlistFeatureWishlistToggle
          analyticsContext={wishlistAnalyticsContext}
          productIntent={productIntent}
          setId={homepageSetCard.id}
          variant="inline"
        />
      ),
      ctaMode: homepageSetCard.ctaMode,
      href: buildSetDetailPath(homepageSetCard.slug),
      id: homepageSetCard.id,
      priceContext: homepageSetCard.priceContext,
      setSummary: homepageSetCard,
      trackingEvent: homepageSetCard.trackingEvent,
    }),
  );
}

function getNextTabId({
  activeTabId,
  direction,
  visibleTabs,
}: {
  activeTabId: HomepageTabbedCommerceRailTabId;
  direction: 'first' | 'last' | 'next' | 'previous';
  visibleTabs: readonly HomepageTabbedCommerceRailTab[];
}): HomepageTabbedCommerceRailTabId {
  const activeIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.id === activeTabId),
  );

  if (direction === 'first') {
    return visibleTabs[0]?.id ?? activeTabId;
  }

  if (direction === 'last') {
    return visibleTabs[visibleTabs.length - 1]?.id ?? activeTabId;
  }

  const nextIndex =
    direction === 'next'
      ? (activeIndex + 1) % visibleTabs.length
      : (activeIndex - 1 + visibleTabs.length) % visibleTabs.length;

  return visibleTabs[nextIndex]?.id ?? activeTabId;
}

export function HomepageTabbedCommerceRail({
  defaultTab,
  sectionId,
  tabs,
  title,
}: {
  defaultTab?: HomepageTabbedCommerceRailTabId;
  sectionId: string;
  tabs: readonly HomepageTabbedCommerceRailTab[];
  title: string;
}) {
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.cards.length > 0),
    [tabs],
  );
  const initialTabId = visibleTabs.find((tab) => tab.id === defaultTab)?.id;
  const [activeTabId, setActiveTabId] =
    useState<HomepageTabbedCommerceRailTabId>(
      initialTabId ?? visibleTabs[0]?.id ?? 'best-deals',
    );
  const tabButtonById = useRef(
    new Map<HomepageTabbedCommerceRailTabId, HTMLButtonElement>(),
  );
  const panelRef = useRef<HTMLDivElement>(null);

  if (!visibleTabs.length) {
    return null;
  }

  const fallbackActiveTab = visibleTabs[0];

  if (!fallbackActiveTab) {
    return null;
  }

  const activeTab =
    visibleTabs.find((tab) => tab.id === activeTabId) ?? fallbackActiveTab;
  const activeRailItems = toHomepageRailItems(activeTab.cards);

  useEffect(() => {
    const railTrack = panelRef.current?.querySelector<HTMLElement>(
      '[class*="setCardRailTrack"]',
    );

    if (railTrack) {
      railTrack.scrollLeft = 0;
    }
  }, [activeTab.id]);

  function activateTab(nextTabId: HomepageTabbedCommerceRailTabId) {
    setActiveTabId(nextTabId);
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const directionByKey: Record<
      string,
      'first' | 'last' | 'next' | 'previous'
    > = {
      ArrowLeft: 'previous',
      ArrowRight: 'next',
      End: 'last',
      Home: 'first',
    };
    const direction = directionByKey[event.key];

    if (!direction) {
      return;
    }

    event.preventDefault();

    const nextTabId = getNextTabId({
      activeTabId,
      direction,
      visibleTabs,
    });

    activateTab(nextTabId);
    window.requestAnimationFrame(() => {
      tabButtonById.current.get(nextTabId)?.focus();
    });
  }

  return (
    <section className={styles.intentRail} id={sectionId}>
      <CatalogSetCardRail
        ariaLabel={activeTab.title}
        items={activeRailItems}
        key={activeTab.id}
        railLayoutMode="stable-square"
        render={({ controls, rail }) => (
          <>
            <div className={styles.intentTop}>
              <div className={styles.intentMain}>
                <h2 className={styles.intentTitle}>{title}</h2>
                <div
                  aria-label={title}
                  className={styles.intentTabs}
                  role="tablist"
                >
                  {visibleTabs.map((tab) => {
                    const isActive = tab.id === activeTab.id;

                    return (
                      <button
                        aria-controls={`${tab.sectionId}-panel`}
                        aria-selected={isActive}
                        className={[
                          styles.intentTab,
                          isActive ? styles.intentTabActive : undefined,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        data-homepage-commerce-tab={tab.id}
                        id={`${tab.sectionId}-tab`}
                        key={tab.id}
                        onClick={() => activateTab(tab.id)}
                        onKeyDown={handleTabKeyDown}
                        ref={(element) => {
                          if (element) {
                            tabButtonById.current.set(tab.id, element);
                          } else {
                            tabButtonById.current.delete(tab.id);
                          }
                        }}
                        role="tab"
                        type="button"
                      >
                        {tab.title}
                      </button>
                    );
                  })}
                </div>
              </div>
              {controls ? (
                <div className={styles.intentControls}>{controls}</div>
              ) : null}
            </div>
            <div
              aria-labelledby={`${activeTab.sectionId}-tab`}
              className={styles.intentTabPanel}
              id={`${activeTab.sectionId}-panel`}
              ref={panelRef}
              role="tabpanel"
            >
              {rail}
            </div>
          </>
        )}
        variant="featured"
      />
    </section>
  );
}
