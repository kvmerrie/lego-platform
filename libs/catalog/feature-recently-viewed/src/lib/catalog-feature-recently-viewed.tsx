'use client';

import { useEffect, useState } from 'react';
import {
  addRecentlyViewedSetNum,
  getRecentlyViewedSetNums,
  listCatalogSetCardsByIdsForBrowser,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCardRailSkeletonSection,
  CatalogSetCardRailSection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { trackBrickhuntAnalyticsEvent } from '@lego-platform/shared/util';

const RECENTLY_VIEWED_RAIL_LIMIT = 12;
const RECENTLY_VIEWED_RAIL_MIN_ITEMS = 3;

export function CatalogRecentlyViewedSetTracker({
  setNum,
}: {
  setNum: string;
}) {
  useEffect(() => {
    addRecentlyViewedSetNum(setNum);
    trackBrickhuntAnalyticsEvent({
      event: 'set_view',
      properties: {
        pageSurface: 'set_detail',
        setId: setNum,
      },
    });
  }, [setNum]);

  return null;
}

export function CatalogFeatureRecentlyViewed({
  currentSetNum,
}: {
  currentSetNum?: string;
}) {
  const [hasCheckedRecentlyViewed, setHasCheckedRecentlyViewed] =
    useState(false);
  const [setCards, setSetCards] = useState<readonly CatalogHomepageSetCard[]>(
    [],
  );

  useEffect(() => {
    let isMounted = true;
    setHasCheckedRecentlyViewed(false);
    const recentlyViewedSetNums = getRecentlyViewedSetNums()
      .filter((setNum) => setNum !== currentSetNum)
      .slice(0, RECENTLY_VIEWED_RAIL_LIMIT);

    if (recentlyViewedSetNums.length < RECENTLY_VIEWED_RAIL_MIN_ITEMS) {
      setSetCards([]);
      setHasCheckedRecentlyViewed(true);
      return;
    }

    void listCatalogSetCardsByIdsForBrowser({
      canonicalIds: recentlyViewedSetNums,
    }).then(
      (catalogSetCards) => {
        if (isMounted) {
          setSetCards(catalogSetCards);
          setHasCheckedRecentlyViewed(true);
        }
      },
      () => {
        if (isMounted) {
          setSetCards([]);
          setHasCheckedRecentlyViewed(true);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [currentSetNum]);

  if (!hasCheckedRecentlyViewed) {
    return (
      <CatalogSetCardRailSkeletonSection
        ariaLabel="Recent bekeken LEGO sets laden"
        description="Sets waar je net naar keek verschijnen hier zodra je browserlijst is geladen."
        eyebrow="Verder vergelijken"
        itemCount={4}
        title="Recent bekeken LEGO sets"
        tone="inverse"
      />
    );
  }

  if (setCards.length < RECENTLY_VIEWED_RAIL_MIN_ITEMS) {
    return null;
  }

  return (
    <CatalogSetCardRailSection
      ariaLabel="Recent bekeken LEGO sets"
      bodySpacing="relaxed"
      description="Sets waar je net naar keek. Handig als je Rivendell, een Star Wars-ship of die ene displayset nog even naast elkaar wilt houden."
      eyebrow="Verder vergelijken"
      items={setCards.map((setCard) => ({
        href: buildSetDetailPath(setCard.slug),
        id: setCard.id,
        priceContext: (
          setCard as CatalogHomepageSetCard & {
            priceContext?: CatalogSetCardPriceContext;
          }
        ).priceContext,
        setSummary: setCard,
        trackingEvent: {
          event: 'catalog_set_click',
          properties: {
            cardSurface: 'recently_viewed',
            pageSurface: 'set_detail',
            sectionId: 'recently-viewed',
            setId: setCard.id,
            theme: setCard.theme,
          },
        },
      }))}
      padding="default"
      spacing="relaxed"
      title="Recent bekeken LEGO sets"
      tone="inverse"
      variant="featured"
    />
  );
}
