import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  getCatalogThemePageBySlug,
  listCatalogThemePageSlugs,
  rankCatalogComparisonDiscoverySetCards,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
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
export const revalidate = 300;
const THEME_DISCOVERY_RAIL_LIMIT = 6;

function toThemeDealSetCards({
  currentOfferSummaryBySetId,
  setCards,
}: {
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  setCards: readonly CatalogFeatureThemePageDealItem[];
}): CatalogFeatureThemePageDealItem[] {
  return setCards.flatMap((setCard) => {
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
  return (await listCatalogThemePageSlugs()).map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const themePage = await getCatalogThemePageBySlug({
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
  const [themePage, catalogDiscoverySignalBySetId] = await Promise.all([
    getCatalogThemePageBySlug({
      slug,
    }),
    listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: revalidate,
      },
    }),
  ]);

  if (!themePage) {
    notFound();
  }

  const themeDiscoverySetCards = catalogDiscoverySignalBySetId.size
    ? rankCatalogComparisonDiscoverySetCards({
        getCatalogDiscoverySignalFn: (setId) =>
          catalogDiscoverySignalBySetId.get(setId),
        limit: THEME_DISCOVERY_RAIL_LIMIT,
        setCards: themePage.setCards,
      })
    : themePage.setCards.slice(0, THEME_DISCOVERY_RAIL_LIMIT);
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      cacheOptions: {
        revalidateSeconds: revalidate,
      },
      setIds: themeDiscoverySetCards.map((setCard) => setCard.id),
    });
  const dealSetCards = toThemeDealSetCards({
    currentOfferSummaryBySetId,
    setCards: themeDiscoverySetCards,
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
