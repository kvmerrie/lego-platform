import {
  getCatalogThemePageBySlug,
  listCatalogThemePageSlugs,
} from '@lego-platform/catalog/data-access';
import {
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

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

function toThemeDealSetCards({
  setIds,
  setCardById,
}: {
  setCardById: Map<string, CatalogFeatureThemePageDealItem>;
  setIds: readonly string[];
}): CatalogFeatureThemePageDealItem[] {
  return setIds.flatMap((setId) => {
    const setCard = setCardById.get(setId);

    if (!setCard) {
      return [];
    }

    const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);

    return [
      {
        ...setCard,
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
      },
    ];
  });
}

export function generateStaticParams() {
  return listCatalogThemePageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const themePage = getCatalogThemePageBySlug(slug);

  if (!themePage) {
    return {};
  }

  return {
    title: `${themePage.themeSnapshot.name} LEGO sets | Brick Ledger`,
    description: `Browse ${themePage.themeSnapshot.name} LEGO sets with reviewed prices, offers, and collector saves. ${themePage.themeSnapshot.momentum}`,
  };
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const themePage = getCatalogThemePageBySlug(slug);

  if (!themePage) {
    notFound();
  }

  const setCardById = new Map(
    themePage.setCards.map((setCard) => [setCard.id, setCard]),
  );
  const dealSetCards = toThemeDealSetCards({
    setCardById,
    setIds: listDealSpotlightPriceContexts({
      candidateSetIds: themePage.setCards.map((setCard) => setCard.id),
      limit: 4,
    }).map((priceContext) => priceContext.setId),
  });

  return (
    <ShellWeb>
      <CatalogFeatureThemePage
        dealSetCards={dealSetCards}
        themePage={themePage}
      />
    </ShellWeb>
  );
}
