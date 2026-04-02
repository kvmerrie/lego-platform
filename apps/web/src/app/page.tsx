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
    })} below reference`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} above reference`;
  }

  return 'At reference';
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
              ? `${featuredSetPriceContext.availabilityLabel} · ${featuredSetPriceContext.merchantCount} reviewed offers`
              : `${featuredSetPriceContext.merchantCount} reviewed offers`,
            currentPrice: formatPriceMinor({
              currencyCode: featuredSetPriceContext.currencyCode,
              minorUnits: featuredSetPriceContext.headlinePriceMinor,
            }),
            merchantLabel: `Lowest reviewed price at ${featuredSetPriceContext.merchantName}`,
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: getPricePositionTone(
              featuredSetPriceContext.deltaMinor,
            ),
            reviewedLabel: `Checked ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
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
        <div className={styles.themeSection}>
          <CatalogFeatureThemeList tone="inverse" />
        </div>
        <div className={styles.sectionGroup}>
          <CatalogFeatureSetList
            description="Open with the sets most likely to pull someone deeper into the catalog: premium anchors, broad-recognition favorites, and one easier display-led entry point."
            eyebrow="Featured sets"
            setCards={homepageSetCards}
            title="Featured sets worth opening first"
            tone="default"
          />
        </div>
        {homepageDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Reviewed Dutch prices currently showing the clearest gaps below reference across the sets most likely to reward a closer look."
              eyebrow="Best current deals"
              sectionId="best-current-deals"
              setCards={homepageDealSetCards}
              signalText={`${homepageDealSetCards.length} sets worth a closer look`}
              tone="muted"
              title="Best current deals"
            />
          </div>
        ) : null}
        <div className={styles.spotlightSection}>
          <CatalogFeatureThemeSpotlight />
        </div>
      </div>
    </ShellWeb>
  );
}
