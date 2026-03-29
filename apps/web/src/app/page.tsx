import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import { CatalogFeatureSetList } from '@lego-platform/catalog/feature-set-list';
import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
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
    })} below ref`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} above ref`;
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
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
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
  const homepageSetCards = listHomepageSetCards().map((homepageSetCard) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(homepageSetCard.id);

    return {
      ...homepageSetCard,
      priceContext: featuredSetPriceContext
        ? {
            currentPrice: formatPriceMinor({
              currencyCode: featuredSetPriceContext.currencyCode,
              minorUnits: featuredSetPriceContext.headlinePriceMinor,
            }),
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: getPricePositionTone(
              featuredSetPriceContext.deltaMinor,
            ),
            merchantSummary: featuredSetPriceContext.availabilityLabel
              ? `${featuredSetPriceContext.availabilityLabel} at ${featuredSetPriceContext.merchantName} · ${featuredSetPriceContext.merchantCount} offers reviewed`
              : `From ${featuredSetPriceContext.merchantName} · ${featuredSetPriceContext.merchantCount} offers reviewed`,
            reviewedLabel: `Reviewed ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
    };
  });

  return (
    <ShellWeb>
      <ContentFeaturePageRenderer editorialPage={homepagePage} />
      <CatalogFeatureSetList setCards={homepageSetCards} />
    </ShellWeb>
  );
}
