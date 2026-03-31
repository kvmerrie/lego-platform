import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import {
  CatalogFeatureSetList,
  type CatalogFeatureSetListItem,
} from '@lego-platform/catalog/feature-set-list';
import { CatalogFeatureThemeList } from '@lego-platform/catalog/feature-theme-list';
import {
  listCatalogSetCardsByIds,
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
  const homepageSetCards = toFeatureSetListItems(listHomepageSetCards());
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
      <ContentFeaturePageRenderer editorialPage={homepagePage} />
      <CatalogFeatureThemeList />
      <CatalogFeatureSetList
        description="A first row of flagship anchors, click-magnet fan favorites, and one easier crossover entry point."
        setCards={homepageSetCards}
        title="Start with the sets worth opening first"
      />
      {homepageDealSetCards.length ? (
        <CatalogFeatureSetList
          description="Reviewed Dutch prices currently showing the clearest gaps below reference across the sets most likely to earn a click."
          eyebrow="Deals"
          sectionId="best-current-deals"
          setCards={homepageDealSetCards}
          signalText={`${homepageDealSetCards.length} sets worth a closer look`}
          tone="default"
          title="Best current deals"
        />
      ) : null}
    </ShellWeb>
  );
}
