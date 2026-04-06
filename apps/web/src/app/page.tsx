import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import styles from './page.module.css';
import {
  CatalogFeatureSetList,
  type CatalogFeatureSetListItem,
} from '@lego-platform/catalog/feature-set-list';
import {
  CatalogFeatureThemeList,
  CatalogFeatureThemeSpotlight,
} from '@lego-platform/catalog/feature-theme-list';
import {
  listCatalogSetCardsByIds,
  listDiscoverHighlightSetCards,
  listHomepageDealCandidateSetCards,
  listHomepageSetCards,
} from '@lego-platform/catalog/data-access';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';

export const revalidate = 300;

function getPricePositionLabel({
  currencyCode,
  deltaMinor,
}: {
  currencyCode: string;
  deltaMinor?: number;
}): string | undefined {
  if (typeof deltaMinor !== 'number') {
    return undefined;
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} onder wat we meestal zien`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} boven wat we meestal zien`;
  }

  return 'Rond wat we meestal zien';
}

function getPricePositionTone(
  deltaMinor?: number,
): 'info' | 'positive' | 'warning' {
  if (typeof deltaMinor !== 'number' || deltaMinor === 0) {
    return 'info';
  }

  return deltaMinor < 0 ? 'positive' : 'warning';
}

function formatReviewedOn(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
}

function toFeatureSetListItems(
  setCards: ReturnType<typeof listCatalogSetCardsByIds>,
): CatalogFeatureSetListItem[] {
  return setCards.map((homepageSetCard) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(
      homepageSetCard.id,
    );

    return {
      ...homepageSetCard,
      priceContext: featuredSetPriceContext
        ? {
            coverageLabel: featuredSetPriceContext.availabilityLabel
              ? `${featuredSetPriceContext.availabilityLabel} · ${featuredSetPriceContext.merchantCount} winkels nagekeken`
              : `${featuredSetPriceContext.merchantCount} winkels nagekeken`,
            currentPrice: formatPriceMinor({
              currencyCode: featuredSetPriceContext.currencyCode,
              minorUnits: featuredSetPriceContext.headlinePriceMinor,
            }),
            merchantLabel: `Nu het laagst bij ${featuredSetPriceContext.merchantName}`,
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: getPricePositionTone(
              featuredSetPriceContext.deltaMinor,
            ),
            reviewedLabel: `Nagekeken op ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
      actions: (
        <WishlistFeatureWishlistToggle
          productIntent={featuredSetPriceContext ? 'price-alert' : 'wishlist'}
          setId={homepageSetCard.id}
          variant="inline"
        />
      ),
    };
  });
}

function createHomepageFeaturedRailItems(): CatalogFeatureSetListItem[] {
  const featuredSetCards = listHomepageSetCards();
  const additionalHighlightSetCards = listDiscoverHighlightSetCards({
    limit: 6,
  });
  const mergedSetCards = [...featuredSetCards];

  for (const additionalHighlightSetCard of additionalHighlightSetCards) {
    if (
      mergedSetCards.some(
        (featuredSetCard) =>
          featuredSetCard.id === additionalHighlightSetCard.id,
      )
    ) {
      continue;
    }

    mergedSetCards.push(additionalHighlightSetCard);

    if (mergedSetCards.length === 6) {
      break;
    }
  }

  return toFeatureSetListItems(mergedSetCards);
}

export async function generateMetadata(): Promise<Metadata> {
  const queryMode = await getEditorialQueryMode();
  const homepagePage = await getHomepagePage({
    mode: queryMode,
  });

  return getMetadataFromSeoFields(homepagePage.seo);
}

export default async function HomePage() {
  const queryMode = await getEditorialQueryMode();
  const homepagePage = await getHomepagePage({
    mode: queryMode,
  });
  const homepageSetCards = createHomepageFeaturedRailItems();
  const homepageDealSetCards = toFeatureSetListItems(
    listCatalogSetCardsByIds(
      listDealSpotlightPriceContexts({
        candidateSetIds: listHomepageDealCandidateSetCards().map(
          (catalogSetCard) => catalogSetCard.id,
        ),
        limit: 3,
      }).map((priceContext) => priceContext.setId),
    ),
  );

  return (
    <ShellWeb>
      <div className={styles.page}>
        <div className={styles.heroSection}>
          <ContentFeaturePageRenderer editorialPage={homepagePage} />
        </div>
        {homepageDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="We lichten hier sets uit die lager staan dan wat we meestal zien."
              eyebrow="Nu slimmer geprijsd"
              sectionId="best-current-deals"
              setCards={homepageDealSetCards}
              signalText={`${homepageDealSetCards.length} sets die nu interessanter zijn om te kopen`}
              tone="default"
              title="Hier wil je nu als eerste kijken"
            />
          </div>
        ) : null}
        <div className={styles.themeSection}>
          <CatalogFeatureThemeList tone="inverse" />
        </div>
        <div className={styles.sectionGroup}>
          <CatalogFeatureSetList
            description="Zoek je een groot displaystuk? Begin hier."
            eyebrow="Pronkstukken"
            setCards={homepageSetCards}
            title="Torens, walkers, supercars"
            tone="muted"
          />
        </div>
        <div className={styles.spotlightSection}>
          <CatalogFeatureThemeSpotlight />
        </div>
      </div>
    </ShellWeb>
  );
}
