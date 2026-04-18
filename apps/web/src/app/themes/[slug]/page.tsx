import {
  listCatalogCurrentOfferSummariesBySetIds,
  getCatalogThemePageBySlugWithOverlay,
  listCatalogThemePageSlugsWithOverlay,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildCurrentSetCardPriceContext } from '../../lib/current-set-card-price-context';

export const dynamicParams = true;

function toThemeDealSetCards({
  currentOfferSummaryBySetId,
  setIds,
  setCardById,
}: {
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  setCardById: Map<string, CatalogFeatureThemePageDealItem>;
  setIds: readonly string[];
}): CatalogFeatureThemePageDealItem[] {
  return setIds.flatMap((setId) => {
    const setCard = setCardById.get(setId);

    if (!setCard) {
      return [];
    }

    const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
    const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);

    return [
      {
        ...setCard,
        priceContext: buildCurrentSetCardPriceContext({
          currentOfferSummary,
          pricePanelSnapshot: featuredSetPriceContext,
          theme: setCard.theme,
        }),
      },
    ];
  });
}

export async function generateStaticParams() {
  return (await listCatalogThemePageSlugsWithOverlay()).map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const themePage = await getCatalogThemePageBySlugWithOverlay({
    slug,
  });

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
  const themePage = await getCatalogThemePageBySlugWithOverlay({
    slug,
  });

  if (!themePage) {
    notFound();
  }

  const setCardById = new Map(
    themePage.setCards.map((setCard) => [setCard.id, setCard]),
  );
  const dealSetIds = listDealSpotlightPriceContexts({
    candidateSetIds: themePage.setCards.map((setCard) => setCard.id),
    limit: 4,
  }).map((priceContext) => priceContext.setId);
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: dealSetIds,
    });
  const dealSetCards = toThemeDealSetCards({
    currentOfferSummaryBySetId,
    setCardById,
    setIds: dealSetIds,
  });
  const featuredDealSetCards = dealSetCards.map((dealSetCard, index) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(dealSetCard.id);
    const currentOfferSummary = currentOfferSummaryBySetId.get(dealSetCard.id);
    const bestCurrentOffer = currentOfferSummary?.bestOffer;
    const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
      featuredSetPriceContext?.deltaMinor,
    );
    const primaryActionTrackingEvent:
      | BrickhuntAnalyticsEventDescriptor
      | undefined = bestCurrentOffer
      ? {
          event: 'offer_click',
          properties: {
            merchantCount: currentOfferSummary?.offers.length,
            merchantName: bestCurrentOffer?.merchantName,
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
            merchantCount: currentOfferSummary?.offers.length,
            pageSurface: 'theme_page',
            priceVerdict,
            sectionId: 'theme-best-deals',
            setId: dealSetCard.id,
            theme: dealSetCard.theme,
          }}
          productIntent={bestCurrentOffer ? 'price-alert' : 'wishlist'}
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
