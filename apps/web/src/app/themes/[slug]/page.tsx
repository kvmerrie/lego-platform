import {
  getCatalogThemePageBySlug,
  listCatalogThemePageSlugs,
} from '@lego-platform/catalog/data-access';
import { getBestAffiliateOffer } from '@lego-platform/affiliate/data-access';
import {
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import {
  buildSetDecisionPresentation,
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
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

  if (deltaMinor === 0) {
    return 'Rond normaal';
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
    const bestAffiliateOffer = getBestAffiliateOffer(setCard.id);
    const decisionPresentation = buildSetDecisionPresentation({
      hasCurrentOffer: Boolean(bestAffiliateOffer?.url),
      pricePanelSnapshot: featuredSetPriceContext,
      theme: setCard.theme,
    });

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
              decisionLabel: decisionPresentation.cardLabel,
              decisionNote: decisionPresentation.cardSupportingCopy,
              primaryActionHref: bestAffiliateOffer?.url,
              pricePositionLabel: getPricePositionLabel({
                currencyCode: featuredSetPriceContext.currencyCode,
                deltaMinor: featuredSetPriceContext.deltaMinor,
              }),
              pricePositionTone: decisionPresentation.verdict.tone,
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
    title: `Brickhunt – ${themePage.themeSnapshot.name} LEGO sets`,
    description: `Ontdek ${themePage.themeSnapshot.name} LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. ${themePage.themeSnapshot.momentum}`,
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
  const featuredDealSetCards = dealSetCards.map((dealSetCard, index) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(dealSetCard.id);
    const bestAffiliateOffer = getBestAffiliateOffer(dealSetCard.id);
    const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
      featuredSetPriceContext?.deltaMinor,
    );
    const primaryActionTrackingEvent:
      | BrickhuntAnalyticsEventDescriptor
      | undefined = bestAffiliateOffer
      ? {
          event: 'offer_click',
          properties: {
            merchantCount: featuredSetPriceContext?.merchantCount,
            merchantName: bestAffiliateOffer.merchantName,
            offerPlacement: 'card_primary_cta',
            offerRole: 'best',
            pageSurface: 'theme_page',
            priceVerdict,
            rankPosition: index + 1,
            sectionId: 'theme-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          },
        }
      : undefined;

    return {
      ...dealSetCard,
      actions: (
        <WishlistFeatureWishlistToggle
          analyticsContext={{
            merchantCount: featuredSetPriceContext?.merchantCount,
            pageSurface: 'theme_page',
            priceVerdict,
            sectionId: 'theme-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          }}
          productIntent={featuredSetPriceContext ? 'price-alert' : 'wishlist'}
          setId={dealSetCard.id}
          variant="inline"
        />
      ),
      ctaMode: 'default' as const,
      priceContext: dealSetCard.priceContext
        ? {
            ...dealSetCard.priceContext,
            primaryActionTrackingEvent,
          }
        : undefined,
    };
  });

  return (
    <ShellWeb>
      <CatalogFeatureThemePage
        dealSetCards={featuredDealSetCards}
        themePage={themePage}
      />
    </ShellWeb>
  );
}
