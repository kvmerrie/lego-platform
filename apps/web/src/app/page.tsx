import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import { getCachedPublicLandingPageData } from './lib/public-landing-page-cache';
import {
  buildCurrentSetCardPriceContextBySetId,
  getCurrentOfferRailDiagnostics,
} from './lib/current-set-card-price-context';
import styles from './page.module.css';
import React from 'react';
import {
  CatalogFeatureSetList,
  type CatalogFeatureSetListItem,
} from '@lego-platform/catalog/feature-set-list';
import {
  CatalogSectionShell,
  CatalogVisualTile,
} from '@lego-platform/catalog/ui';
import {
  CatalogFeatureThemeList,
  CatalogFeatureThemeSpotlight,
} from '@lego-platform/catalog/feature-theme-list';
import {
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogHomepageDealQualityDiagnostics,
  getHomepageEditorialConfig,
  getCatalogPartnerOfferRailDiagnostics,
  listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listDiscoverNowInterestingSetCards,
  listHomepageDiscoveryTiles,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  rankCatalogPartnerOfferSetCards,
  resolveHomepageFollowRailDiagnostics,
} from '@lego-platform/catalog/data-access-web';
import type {
  CatalogHomepageSetCard,
  CatalogThemeDirectoryItem,
  PublicHomepageEditorialConfig,
  PublicPageSection,
} from '@lego-platform/catalog/util';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { getHeroSection } from '@lego-platform/content/util';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import { ActionLink, Panel } from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import {
  buildWebPath,
  cacheTags,
  hasBrowserSupabaseConfig,
  hasServerSupabaseConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';

export const revalidate = false;
const HOMEPAGE_DISCOVERY_RAIL_LIMIT = 20;
const HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT = 20;
const HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT = 20;
const HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS = false;
const HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS = 2;
const HOMEPAGE_PRIMARY_DEAL_SECTION_ID = 'best-current-deals';
const HOMEPAGE_SOFT_DEAL_SECTION_ID = 'soft-price-opportunities';
const HOMEPAGE_CURRENT_OFFERS_SECTION_ID = 'current-offers';
const HOMEPAGE_POPULAR_TO_FOLLOW_SECTION_ID = 'popular-to-follow';
const HOMEPAGE_DISCOVERY_SECTION_ID = 'ontdek-lego-op-jouw-manier';
const HOMEPAGE_CACHE_TAGS = [
  cacheTags.homepage(),
  cacheTags.catalog(),
  cacheTags.sets(),
  cacheTags.themes(),
  cacheTags.prices(),
  cacheTags.deals(),
] as const;

function getPublicMerchandisingRotationSeed(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 6));
}
const homepageValueSignals = [
  {
    id: 'price-context',
    title: 'Prijscontext, geen losse korting',
    body: 'We leggen nagekeken winkelprijzen naast wat we voor die set meestal zien.',
  },
  {
    id: 'when-to-buy',
    title: 'Het juiste koopmoment',
    body: 'Brickhunt helpt je zien of nu instappen slim is of dat wachten beter voelt.',
  },
  {
    id: 'verified-offers',
    title: 'Nagekeken winkels, geen prijsruis',
    body: 'Nog geen goede deal? Volg de set. Is de vergelijking te dun, dan blijven we stil.',
  },
] as const;
type HomepageQueryMode = Awaited<ReturnType<typeof getEditorialQueryMode>>;

type HomepageCurrentOfferSummaryEntries = ReadonlyArray<
  readonly [
    string,
    Awaited<
      ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
    > extends Map<string, infer Summary>
      ? Summary
      : never,
  ]
>;

type HomepageDiscoverySignalEntries = ReadonlyArray<
  readonly [
    string,
    Awaited<ReturnType<typeof listCatalogDiscoverySignalsBySetId>> extends Map<
      string,
      infer Signal
    >
      ? Signal
      : never,
  ]
>;

interface HomepageLandingPageData {
  allCatalogSetCards: readonly CatalogHomepageSetCard[];
  catalogDiscoverySignalEntries: HomepageDiscoverySignalEntries;
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  commerceRailRotationSeed: number;
  currentOfferSummaryEntries: HomepageCurrentOfferSummaryEntries;
  homepageBestDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageCurrentOfferCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageFollowCurrentOfferSummaryEntries: HomepageCurrentOfferSummaryEntries;
  homepageFollowSetCards: readonly CatalogHomepageSetCard[];
  homepageDiscoveryTiles: Awaited<
    ReturnType<typeof listHomepageDiscoveryTiles>
  >;
  homepageEditorialConfig?: PublicHomepageEditorialConfig | null;
  homepagePage: Awaited<ReturnType<typeof getHomepagePage>>;
  homepageSoftDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageThemeDirectoryItems: readonly CatalogThemeDirectoryItem[];
  homepageThemeSpotlightItems: Awaited<
    ReturnType<typeof listHomepageThemeSpotlightItems>
  >;
}

function getHomepageSectionConfig(
  config: PublicHomepageEditorialConfig | null | undefined,
  sectionKey: string,
): PublicPageSection | undefined {
  if (!Array.isArray(config?.sections) || config.sections.length === 0) {
    return undefined;
  }

  return config.sections.find((section) => {
    if (!section || typeof section !== 'object') {
      return false;
    }

    return section.enabled === true && section.sectionKey === sectionKey;
  });
}

async function loadHomepageEditorialConfigSafely(): Promise<
  PublicHomepageEditorialConfig | undefined
> {
  try {
    const config = await getHomepageEditorialConfig();

    return Array.isArray(config?.sections) && config.sections.length > 0
      ? config
      : undefined;
  } catch (error) {
    console.warn(
      '[homepage-cms] Falling back to curated homepage defaults.',
      error,
    );

    return undefined;
  }
}

function toFeatureSetListItems(
  setCards: readonly CatalogHomepageSetCard[],
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummaries>
  >,
  {
    cardSurface,
    catalogDiscoverySignalBySetId,
    sectionId,
  }: {
    cardSurface: 'deal' | 'featured';
    catalogDiscoverySignalBySetId?: Awaited<
      ReturnType<typeof listCatalogDiscoverySignalsBySetId>
    >;
    sectionId: string;
  },
): CatalogFeatureSetListItem[] {
  const priceContextBySetId = buildCurrentSetCardPriceContextBySetId({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    setCards,
  });

  return setCards.map((homepageSetCard, index) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(
      homepageSetCard.id,
    );
    const currentOfferSummary = currentOfferSummaryBySetId.get(
      homepageSetCard.id,
    );
    const bestCurrentOffer = currentOfferSummary?.bestOffer;
    const priceContext = priceContextBySetId.get(homepageSetCard.id);
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
            merchantName: bestCurrentOffer.merchantName,
            offerPlacement: 'card_primary_cta',
            offerRole: 'best',
            pageSurface: 'homepage',
            priceVerdict,
            rankPosition: index + 1,
            sectionId,
            setId: homepageSetCard.id,
            theme: homepageSetCard.theme,
          },
        }
      : undefined;

    return {
      ...homepageSetCard,
      ctaMode: cardSurface === 'deal' ? ('commerce' as const) : 'default',
      priceContext: priceContext
        ? {
            ...priceContext,
            primaryActionTrackingEvent,
          }
        : undefined,
      trackingEvent: {
        event: 'catalog_set_click',
        properties: {
          cardSurface,
          merchantCount: currentOfferSummary?.offers.length,
          pageSurface: 'homepage',
          priceVerdict,
          rankPosition: index + 1,
          sectionId,
          setId: homepageSetCard.id,
          theme: homepageSetCard.theme,
        },
      },
      actions: (
        <WishlistFeatureWishlistToggle
          analyticsContext={{
            cardSurface,
            merchantCount: currentOfferSummary?.offers.length,
            pageSurface: 'homepage',
            priceVerdict,
            sectionId,
            setId: homepageSetCard.id,
            theme: homepageSetCard.theme,
          }}
          productIntent={bestCurrentOffer ? 'price-alert' : 'wishlist'}
          setId={homepageSetCard.id}
          variant="inline"
        />
      ),
    };
  });
}

function hasCommerceAction(catalogSetCard: CatalogFeatureSetListItem): boolean {
  return Boolean(catalogSetCard.priceContext?.primaryActionHref);
}

function buildHomepageAnchorHref(sectionId: string): string {
  return `/#${sectionId}`;
}

function shouldRetargetHomepageHeroCta(ctaHref?: string): boolean {
  return (
    ctaHref === '#best-current-deals' || ctaHref === '/#best-current-deals'
  );
}

function getHomepageHeroCtaSectionId({
  currentOfferSetCards,
  softDealSetCards,
  strongDealSetCards,
}: {
  currentOfferSetCards: readonly CatalogFeatureSetListItem[];
  softDealSetCards: readonly CatalogFeatureSetListItem[];
  strongDealSetCards: readonly CatalogFeatureSetListItem[];
}): string {
  if (strongDealSetCards.length) {
    return HOMEPAGE_PRIMARY_DEAL_SECTION_ID;
  }

  if (softDealSetCards.length) {
    return HOMEPAGE_SOFT_DEAL_SECTION_ID;
  }

  if (currentOfferSetCards.length) {
    return HOMEPAGE_CURRENT_OFFERS_SECTION_ID;
  }

  return HOMEPAGE_POPULAR_TO_FOLLOW_SECTION_ID;
}

function getUniqueCatalogSetIds(
  setCardGroups: readonly (readonly Pick<CatalogHomepageSetCard, 'id'>[])[],
): string[] {
  return [
    ...new Set(
      setCardGroups.flatMap((setCards) =>
        setCards.map((catalogSetCard) => catalogSetCard.id),
      ),
    ),
  ];
}

function isCatalogHomepageSetCardArray(
  value: unknown,
): value is readonly CatalogHomepageSetCard[] {
  return Array.isArray(value);
}

function isHomepageCommerceRailsDebugEnabled(): boolean {
  return process.env['DEBUG_COMMERCE_RAILS'] === 'true';
}

function logHomepageCommerceRailDiagnostics({
  allCatalogSetCards,
  catalogDiscoverySignalBySetId,
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
  homepageRenderedDealSetCards,
  homepageFollowRailDiagnostics,
  homepageSoftDealCandidateSetCards,
  homepageSoftDealSetCards,
  homepageStrongDealCandidateSetCards,
  homepageStrongDealSetCards,
  runtimeDiagnostics,
  rotationSeed,
}: {
  allCatalogSetCards: readonly CatalogHomepageSetCard[];
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  catalogDiscoverySignalBySetId: Awaited<
    ReturnType<typeof listCatalogDiscoverySignalsBySetId>
  >;
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummaries>
  >;
  homepageRenderedDealSetCards: readonly CatalogFeatureSetListItem[];
  homepageFollowRailDiagnostics?: Awaited<
    ReturnType<typeof resolveHomepageFollowRailDiagnostics>
  >;
  homepageSoftDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageSoftDealSetCards: readonly CatalogFeatureSetListItem[];
  homepageStrongDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageStrongDealSetCards: readonly CatalogFeatureSetListItem[];
  runtimeDiagnostics?: Awaited<
    ReturnType<typeof getCatalogCommerceRailRuntimeDiagnostics>
  >;
  rotationSeed: number;
}): void {
  if (!isHomepageCommerceRailsDebugEnabled()) {
    return;
  }

  const offerSummaries = [...currentOfferSummaryBySetId.values()];
  const nonEmptyOfferSummaries = offerSummaries.filter(
    (currentOfferSummary) =>
      currentOfferSummary.offers.length > 0 ||
      Boolean(currentOfferSummary.bestOffer),
  );
  const summariesWithOffers = offerSummaries.filter(
    (currentOfferSummary) => currentOfferSummary.offers.length > 0,
  ).length;
  const summariesWithBestOffer = offerSummaries.filter((currentOfferSummary) =>
    Boolean(currentOfferSummary.bestOffer),
  ).length;
  const setsWithCurrentPrice = offerSummaries.filter(
    (currentOfferSummary) =>
      typeof currentOfferSummary.bestOffer?.priceCents === 'number' &&
      currentOfferSummary.bestOffer.priceCents > 0,
  ).length;
  const setsWithAffiliateDeeplink = offerSummaries.filter(
    (currentOfferSummary) =>
      typeof currentOfferSummary.bestOffer?.url === 'string' &&
      currentOfferSummary.bestOffer.url.length > 0,
  ).length;
  const setsInStock = offerSummaries.filter(
    (currentOfferSummary) =>
      currentOfferSummary.bestOffer?.availability === 'in_stock',
  ).length;
  const sampleOfferSummaries = offerSummaries
    .filter((currentOfferSummary) => currentOfferSummary.bestOffer)
    .slice(0, 3)
    .map((currentOfferSummary) => {
      const bestOffer = currentOfferSummary.bestOffer;
      const merchantSlug =
        bestOffer && 'merchantSlug' in bestOffer
          ? (bestOffer as { merchantSlug?: string }).merchantSlug
          : undefined;

      return {
        availability: bestOffer?.availability,
        checkedAt: bestOffer?.checkedAt,
        currency: bestOffer?.currency,
        hasUrl: Boolean(bestOffer?.url),
        merchantName: bestOffer?.merchantName,
        merchantSlug,
        priceCents: bestOffer?.priceCents,
        setId: currentOfferSummary.setId,
      };
    });
  const homepageCardsMissingOffers = homepageFollowRailDiagnostics
    ? homepageFollowRailDiagnostics.selectedSetIds.filter(
        (setId) => !currentOfferSummaryBySetId.get(setId)?.bestOffer,
      )
    : [];

  console.info('[commerce-rails] homepage diagnostics', {
    candidates: {
      softPriceOpportunities: homepageSoftDealCandidateSetCards.map(
        (catalogSetCard) => catalogSetCard.id,
      ),
      strongDealsNow: homepageStrongDealCandidateSetCards.map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    },
    dataSource: {
      apiProxyTarget: process.env['API_PROXY_TARGET'] ?? null,
      commerceRailSource: 'current-offers-first',
      currentOfferLoader: 'runtime-current-offers',
      hasBrowserSupabaseConfig: hasBrowserSupabaseConfig(),
      hasServerSupabaseConfig: hasServerSupabaseConfig(),
      supabaseFallbackAvailable: hasServerSupabaseConfig(),
      usingGeneratedArtifactsForCurrentOffers: false,
      usingRuntimeSupabaseCommerceData: true,
    },
    ...(runtimeDiagnostics ? { runtimeDiagnostics } : {}),
    finalRailCounts: {
      cards_missing_offer_count: homepageCardsMissingOffers.length,
      eligible_offer_count:
        (homepageFollowRailDiagnostics?.selectedCount ?? 0) -
        homepageCardsMissingOffers.length,
      renderedDeals: homepageRenderedDealSetCards.length,
      softPriceOpportunities: homepageSoftDealSetCards.length,
      strongDealsNow: homepageStrongDealSetCards.length,
      popularToFollow: homepageFollowRailDiagnostics?.selectedCount,
    },
    followRail: homepageFollowRailDiagnostics
      ? {
          excludedCommerceSetIds: homepageFollowRailDiagnostics.excludedSetIds,
          firstSelectedSetIds: homepageFollowRailDiagnostics.selectedSetIds,
          rawCandidateCount: homepageFollowRailDiagnostics.rawCandidateCount,
          selectedCount: homepageFollowRailDiagnostics.selectedCount,
          source: homepageFollowRailDiagnostics.source,
        }
      : undefined,
    railPipeline: {
      softCandidateCount: homepageSoftDealCandidateSetCards.length,
      strongCandidateCount: homepageStrongDealCandidateSetCards.length,
      renderedDealCount: homepageRenderedDealSetCards.length,
    },
    firstSetScoringInputs: getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      excludedSetIds: homepageRenderedDealSetCards.map(
        (catalogSetCard) => catalogSetCard.id,
      ),
      limit: 10,
      rotationSeed,
      setCards: commerceCandidateSetCards,
    }),
    offerSignals: {
      firstHomepageCatalogSetIds: allCatalogSetCards
        .map((catalogSetCard) => catalogSetCard.id)
        .slice(0, 20),
      firstCommerceCandidateSetIds: commerceCandidateSetCards
        .map((catalogSetCard) => catalogSetCard.id)
        .slice(0, 20),
      firstReturnedOfferSetIds: offerSummaries
        .map((currentOfferSummary) => currentOfferSummary.setId)
        .slice(0, 20),
      nonEmptySummaryCount: nonEmptyOfferSummaries.length,
      sampleOfferSummaries,
      sampleMissingOfferSetIds: homepageCardsMissingOffers.slice(0, 8),
      setsInStock,
      setsWithAffiliateDeeplink,
      setsWithCurrentPrice,
      summariesWithBestOffer,
      summariesWithOffers,
      totalOfferSummaries: offerSummaries.length,
    },
    totalSetsLoaded: allCatalogSetCards.length,
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const queryMode = await getEditorialQueryMode();
  const homepagePage = await getHomepagePage({
    mode: queryMode,
  });

  return getMetadataFromSeoFields(homepagePage.seo, {
    canonicalPath: buildWebPath(webPathnames.home),
  });
}

async function loadHomepageLandingPageData({
  queryMode,
}: {
  queryMode: HomepageQueryMode;
}): Promise<HomepageLandingPageData> {
  const [homepagePage, allCatalogSetCards] = await Promise.all([
    getHomepagePage({
      mode: queryMode,
    }),
    listCatalogSetCards({ limit: 240 }),
  ]);
  const homepageEditorialConfig = await loadHomepageEditorialConfigSafely();
  const [
    homepageDiscoveryTiles,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  ] = await Promise.all([
    listHomepageDiscoveryTiles({
      homepageEditorialConfig,
    }),
    listHomepageThemeDirectoryItems({
      homepageEditorialConfig,
    }),
    listHomepageThemeSpotlightItems({
      homepageEditorialConfig,
    }),
  ]);
  const commerceRailRotationSeed = getPublicMerchandisingRotationSeed();
  const commerceCandidateSetIds = await listCatalogCurrentOfferCandidateSetIds({
    cacheOptions: {
      revalidateSeconds: revalidate,
      tags: [cacheTags.homepage(), cacheTags.prices()],
    },
    limit: 240,
  });
  const commerceCandidateSetCards = await listCatalogSetCardsByIds({
    canonicalIds: commerceCandidateSetIds,
  });
  const currentOfferSummaryBySetId =
    commerceCandidateSetCards.length > 0
      ? await listCatalogCurrentOfferSummariesBySetIds({
          cacheOptions: {
            revalidateSeconds: revalidate,
            tags: [cacheTags.homepage(), cacheTags.prices()],
          },
          setIds: commerceCandidateSetCards.map((setCard) => setCard.id),
        })
      : new Map();
  const catalogDiscoverySignalBySetId =
    await listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS,
        tags: [cacheTags.homepage(), cacheTags.prices()],
      },
      setIds: getUniqueCatalogSetIds([
        allCatalogSetCards,
        commerceCandidateSetCards,
      ]),
    });
  const getCatalogDiscoverySignalFn =
    catalogDiscoverySignalBySetId.size > 0
      ? (setId: string) => catalogDiscoverySignalBySetId.get(setId)
      : undefined;
  const homepageBestDealCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverBestDealSetCards({
        currentOfferSummaryBySetId,
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: commerceCandidateSetCards,
      })
    : [];
  const homepageSoftDealCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverNowInterestingSetCards({
        currentOfferSummaryBySetId,
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: commerceCandidateSetCards,
      })
    : [];
  const homepageBestDealCandidates = toFeatureSetListItems(
    homepageBestDealCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_PRIMARY_DEAL_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageStrongDealSetCards =
    homepageBestDealCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageBestDealCandidates
      : [];
  const homepageSoftDealCandidates = toFeatureSetListItems(
    homepageSoftDealCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_SOFT_DEAL_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageSoftDealSetCards =
    homepageStrongDealSetCards.length === 0 &&
    homepageSoftDealCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageSoftDealCandidates
      : [];
  const homepageCurrentOfferCandidateSetCards = rankCatalogPartnerOfferSetCards(
    {
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      excludedSetIds: getUniqueCatalogSetIds([
        homepageStrongDealSetCards,
        homepageSoftDealSetCards,
      ]),
      limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
      rotationSeed: commerceRailRotationSeed,
      setCards: commerceCandidateSetCards,
    },
  );
  const homepageCurrentOfferCandidates = toFeatureSetListItems(
    homepageCurrentOfferCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_CURRENT_OFFERS_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageCurrentOfferSetCards =
    homepageStrongDealSetCards.length === 0 &&
    homepageSoftDealSetCards.length === 0 &&
    homepageCurrentOfferCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageCurrentOfferCandidates
      : [];
  const homepageRenderedDealSetCards = homepageStrongDealSetCards.length
    ? homepageStrongDealSetCards
    : homepageSoftDealSetCards.length
      ? homepageSoftDealSetCards
      : homepageCurrentOfferSetCards;
  const homepageFollowExcludedSetIds = getUniqueCatalogSetIds([
    homepageRenderedDealSetCards,
  ]);
  const homepageFollowSetCards = await listHomepageSetCards({
    excludedSetIds: homepageFollowExcludedSetIds,
    getCatalogDiscoverySignalFn,
    limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
    rotationSeed: commerceRailRotationSeed,
  });
  const homepageFollowCurrentOfferSummaryBySetId =
    homepageFollowSetCards.length > 0
      ? await listCatalogCurrentOfferSummariesBySetIds({
          cacheOptions: {
            revalidateSeconds: revalidate,
            tags: [
              cacheTags.homepage(),
              cacheTags.prices(),
              ...homepageFollowSetCards.map((setCard) =>
                cacheTags.set(setCard.id),
              ),
            ],
          },
          setIds: homepageFollowSetCards.map((setCard) => setCard.id),
        })
      : new Map();

  return {
    allCatalogSetCards,
    catalogDiscoverySignalEntries: [...catalogDiscoverySignalBySetId.entries()],
    commerceCandidateSetCards,
    commerceRailRotationSeed,
    currentOfferSummaryEntries: [...currentOfferSummaryBySetId.entries()],
    homepageBestDealCandidateSetCards,
    homepageCurrentOfferCandidateSetCards,
    homepageFollowCurrentOfferSummaryEntries: [
      ...homepageFollowCurrentOfferSummaryBySetId.entries(),
    ],
    homepageFollowSetCards,
    homepageDiscoveryTiles,
    homepageEditorialConfig,
    homepagePage,
    homepageSoftDealCandidateSetCards,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  };
}

function getHomepageLandingPageData({
  queryMode,
}: {
  queryMode: HomepageQueryMode;
}): Promise<HomepageLandingPageData> {
  if (queryMode === 'preview') {
    return loadHomepageLandingPageData({ queryMode });
  }

  return getCachedPublicLandingPageData({
    load: () => loadHomepageLandingPageData({ queryMode }),
    page: 'homepage',
    params: [queryMode],
    revalidateSeconds: revalidate,
    tags: HOMEPAGE_CACHE_TAGS,
  });
}

export default async function HomePage() {
  const queryMode = await getEditorialQueryMode();
  const {
    allCatalogSetCards,
    catalogDiscoverySignalEntries,
    commerceCandidateSetCards,
    commerceRailRotationSeed,
    currentOfferSummaryEntries,
    homepagePage,
    homepageBestDealCandidateSetCards,
    homepageCurrentOfferCandidateSetCards,
    homepageDiscoveryTiles,
    homepageEditorialConfig,
    homepageFollowCurrentOfferSummaryEntries,
    homepageFollowSetCards,
    homepageSoftDealCandidateSetCards,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  } = await getHomepageLandingPageData({ queryMode });
  const currentOfferSummaryBySetId = new Map(currentOfferSummaryEntries);
  const stableCommerceRailRotationSeed =
    typeof commerceRailRotationSeed === 'number' ? commerceRailRotationSeed : 0;
  const commerceRailRuntimeDiagnostics = isHomepageCommerceRailsDebugEnabled()
    ? await getCatalogCommerceRailRuntimeDiagnostics({
        limit: 300,
      })
    : undefined;
  const catalogDiscoverySignalBySetId = new Map(catalogDiscoverySignalEntries);
  const getCatalogDiscoverySignalFn =
    catalogDiscoverySignalBySetId.size > 0
      ? (setId: string) => catalogDiscoverySignalBySetId.get(setId)
      : undefined;
  const homepageHeroSection = getHeroSection(homepagePage.sections);
  const renderedHomepageDiscoveryTiles = Array.isArray(homepageDiscoveryTiles)
    ? homepageDiscoveryTiles
    : await listHomepageDiscoveryTiles({
        homepageEditorialConfig: homepageEditorialConfig ?? undefined,
      });
  const renderedHomepageThemeSpotlightItems =
    Array.isArray(homepageThemeSpotlightItems) &&
    homepageThemeSpotlightItems.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        'href' in item &&
        typeof item.href === 'string',
    )
      ? homepageThemeSpotlightItems
      : await listHomepageThemeSpotlightItems({
          homepageEditorialConfig: homepageEditorialConfig ?? undefined,
        });
  const homepageDiscoverySection = getHomepageSectionConfig(
    homepageEditorialConfig,
    'discovery_routes',
  );
  const homepageThemeRailSection = getHomepageSectionConfig(
    homepageEditorialConfig,
    'theme_rail',
  );
  const homepageThemeSpotlightSection = getHomepageSectionConfig(
    homepageEditorialConfig,
    'theme_spotlight',
  );
  const homepageBestDealCandidates = toFeatureSetListItems(
    homepageBestDealCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_PRIMARY_DEAL_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageStrongDealSetCards =
    homepageBestDealCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageBestDealCandidates
      : [];
  const homepageSoftDealCandidates = toFeatureSetListItems(
    homepageSoftDealCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_SOFT_DEAL_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageSoftDealSetCards =
    homepageStrongDealSetCards.length === 0 &&
    homepageSoftDealCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageSoftDealCandidates
      : [];
  const stableHomepageCurrentOfferCandidateSetCards =
    isCatalogHomepageSetCardArray(homepageCurrentOfferCandidateSetCards)
      ? homepageCurrentOfferCandidateSetCards
      : rankCatalogPartnerOfferSetCards({
          catalogDiscoverySignalBySetId,
          currentOfferSummaryBySetId,
          excludedSetIds: getUniqueCatalogSetIds([
            homepageStrongDealSetCards,
            homepageSoftDealSetCards,
          ]),
          limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
          rotationSeed: stableCommerceRailRotationSeed,
          setCards: isCatalogHomepageSetCardArray(commerceCandidateSetCards)
            ? commerceCandidateSetCards
            : [],
        });
  const homepageCurrentOfferCandidates = toFeatureSetListItems(
    stableHomepageCurrentOfferCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_CURRENT_OFFERS_SECTION_ID,
    },
  ).filter(hasCommerceAction);
  const homepageCurrentOfferSetCards =
    homepageStrongDealSetCards.length === 0 &&
    homepageSoftDealSetCards.length === 0 &&
    homepageCurrentOfferCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageCurrentOfferCandidates
      : [];
  const homepageRenderedDealSetCards = homepageStrongDealSetCards.length
    ? homepageStrongDealSetCards
    : homepageSoftDealSetCards.length
      ? homepageSoftDealSetCards
      : homepageCurrentOfferSetCards;
  if (isHomepageCommerceRailsDebugEnabled()) {
    console.info('[homepage-deal-quality]', {
      ...getCatalogHomepageDealQualityDiagnostics({
        catalogDiscoverySignalBySetId,
        currentOfferSummaryBySetId,
        selectedSetCards: homepageRenderedDealSetCards,
        softSetCards: homepageSoftDealSetCards,
        strongSetCards: homepageStrongDealSetCards,
        setCards: commerceCandidateSetCards,
      }),
      currentOfferFallback: getCurrentOfferRailDiagnostics({
        currentOfferSummaryBySetId,
        finalSetCards: homepageCurrentOfferSetCards,
        setCards: commerceCandidateSetCards,
      }),
    });
  }
  const homepageFollowExcludedSetIds = getUniqueCatalogSetIds([
    homepageRenderedDealSetCards,
  ]);
  const homepageFollowRailDiagnostics = isHomepageCommerceRailsDebugEnabled()
    ? await resolveHomepageFollowRailDiagnostics({
        excludedSetIds: homepageFollowExcludedSetIds,
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
        rotationSeed: stableCommerceRailRotationSeed,
      })
    : undefined;
  const homepageFollowCurrentOfferSummaryBySetId = new Map(
    homepageFollowCurrentOfferSummaryEntries,
  );
  const homepageCardCurrentOfferSummaryBySetId = new Map([
    ...currentOfferSummaryBySetId,
    ...homepageFollowCurrentOfferSummaryBySetId,
  ]);
  const homepageSetCards = toFeatureSetListItems(
    homepageFollowSetCards,
    homepageCardCurrentOfferSummaryBySetId,
    {
      cardSurface: 'featured',
      catalogDiscoverySignalBySetId,
      sectionId: HOMEPAGE_POPULAR_TO_FOLLOW_SECTION_ID,
    },
  );

  logHomepageCommerceRailDiagnostics({
    allCatalogSetCards,
    catalogDiscoverySignalBySetId,
    commerceCandidateSetCards,
    currentOfferSummaryBySetId: homepageCardCurrentOfferSummaryBySetId,
    homepageRenderedDealSetCards,
    homepageFollowRailDiagnostics,
    homepageSoftDealCandidateSetCards,
    homepageSoftDealSetCards,
    homepageStrongDealCandidateSetCards: homepageBestDealCandidateSetCards,
    homepageStrongDealSetCards,
    runtimeDiagnostics: commerceRailRuntimeDiagnostics,
    rotationSeed: stableCommerceRailRotationSeed,
  });

  const homepageHeroPage = homepageHeroSection
    ? {
        ...homepagePage,
        sections: [
          {
            ...homepageHeroSection,
            ctaHref: shouldRetargetHomepageHeroCta(homepageHeroSection.ctaHref)
              ? buildHomepageAnchorHref(
                  getHomepageHeroCtaSectionId({
                    currentOfferSetCards: homepageCurrentOfferSetCards,
                    softDealSetCards: homepageSoftDealSetCards,
                    strongDealSetCards: homepageStrongDealSetCards,
                  }),
                )
              : homepageHeroSection.ctaHref,
          },
        ],
      }
    : homepagePage;

  return (
    <ShellWeb>
      <div className={styles.page}>
        <div className={styles.heroSection}>
          <ContentFeaturePageRenderer editorialPage={homepageHeroPage} />
        </div>
        <CatalogSectionShell
          className={styles.discoveryTileSection}
          headingClassName={styles.discoveryTileHeading}
          id={HOMEPAGE_DISCOVERY_SECTION_ID}
          title={
            homepageDiscoverySection?.title ?? 'Ontdek LEGO op jouw manier'
          }
          tone="inverse"
        >
          <div className={styles.discoveryTileViewport}>
            <div className={styles.discoveryTileTrack}>
              {renderedHomepageDiscoveryTiles.map((tile, index) => (
                <CatalogVisualTile
                  className={styles.discoveryTile}
                  dataTile={tile.id}
                  href={tile.href}
                  imageAlt={tile.alt}
                  imageUrl={tile.imageUrl}
                  key={tile.id}
                  title={tile.title}
                  trackingEvent={{
                    event: 'theme_tile_click',
                    properties: {
                      pageSurface: 'homepage',
                      rankPosition: index + 1,
                      sectionId: HOMEPAGE_DISCOVERY_SECTION_ID,
                      tileType: 'discovery',
                      tileId: tile.id,
                    },
                  }}
                  visual={tile.visual}
                />
              ))}
            </div>
          </div>
        </CatalogSectionShell>
        {homepageStrongDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Sets die nu duidelijk onder hun recente referentieprijs zitten. Dit zijn de eerste plekken om te kijken."
              prioritizeFirstImage
              railLayoutMode="stable-square"
              sectionId={HOMEPAGE_PRIMARY_DEAL_SECTION_ID}
              setCards={homepageStrongDealSetCards}
              showSignal={false}
              tone="default"
              title="Beste deals nu"
            />
          </div>
        ) : homepageSoftDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Sets die nu lager staan dan recent. Geen hard deal-label, wel een goed moment om te kijken."
              prioritizeFirstImage
              railLayoutMode="stable-square"
              sectionId={HOMEPAGE_SOFT_DEAL_SECTION_ID}
              setCards={homepageSoftDealSetCards}
              showSignal={false}
              tone="default"
              title="Nu lager geprijsd"
            />
          </div>
        ) : homepageCurrentOfferSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Geen harde kortingclaim, wel actuele prijzen met een werkende winkelroute. Begin hier als je nu wilt vergelijken."
              prioritizeFirstImage
              railLayoutMode="stable-square"
              sectionId={HOMEPAGE_CURRENT_OFFERS_SECTION_ID}
              setCards={homepageCurrentOfferSetCards}
              showSignal={false}
              tone="default"
              title="Nu te vergelijken"
            />
          </div>
        ) : (
          <div className={styles.sectionGroup}>
            <Panel
              as="section"
              description="We tonen hier alleen sets waarvan prijs, winkel en settype goed vergelijkbaar zijn. Vandaag is er nog geen deal die hard genoeg is."
              padding="md"
              title="Nog geen harde deals"
              tone="muted"
            >
              <ActionLink href="/deals" tone="inline">
                Bekijk alle actuele prijzen
              </ActionLink>
            </Panel>
          </div>
        )}
        <div className={styles.themeSection}>
          <CatalogFeatureThemeList
            themeItems={homepageThemeDirectoryItems}
            title={
              homepageThemeRailSection?.title ??
              'Fantasy, Star Wars of strak design?'
            }
            tone="inverse"
          />
        </div>
        <div className={styles.sectionGroup}>
          <CatalogFeatureSetList
            description="Geen deal-label, wel sets die je collectie richting geven. Volg ze en pak het moment zodra prijs of voorraad goed wordt."
            railLayoutMode="stable-square"
            setCards={homepageSetCards}
            sectionId={HOMEPAGE_POPULAR_TO_FOLLOW_SECTION_ID}
            title="Populair om te volgen"
            tone="default"
          />
        </div>
        <Panel
          as="section"
          className={styles.valueSection}
          description="Geen couponsite. Eerst begrijpen of een set nu echt opvalt, dan pas kiezen waar je heen gaat."
          padding="lg"
          title="Waarom Brickhunt?"
          tone="muted"
        >
          <div className={styles.valueGrid}>
            {homepageValueSignals.map((homepageValueSignal) => (
              <article
                className={styles.valueCard}
                key={homepageValueSignal.id}
              >
                <h2 className={styles.valueTitle}>
                  {homepageValueSignal.title}
                </h2>
                <p className={styles.valueBody}>{homepageValueSignal.body}</p>
              </article>
            ))}
          </div>
          <p className={styles.supportingLinkRow}>
            <span>Meer over Brickhunt:</span>{' '}
            <ActionLink
              className={styles.supportingLink}
              href="/hoe-werkt-het"
              tone="inline"
              {...buildBrickhuntAnalyticsAttributes({
                event: 'support_link_click',
                properties: {
                  linkTarget: 'how_it_works',
                  pageSurface: 'homepage',
                  sectionId: HOMEPAGE_DISCOVERY_SECTION_ID,
                },
              })}
            >
              Hoe Brickhunt werkt
            </ActionLink>
            <span aria-hidden="true">·</span>
            <ActionLink
              className={styles.supportingLink}
              href="/over-brickhunt"
              tone="inline"
            >
              Over Brickhunt
            </ActionLink>
          </p>
        </Panel>
        <div className={styles.spotlightSection}>
          <CatalogFeatureThemeSpotlight
            themeItems={renderedHomepageThemeSpotlightItems}
            title={
              homepageThemeSpotlightSection?.title ??
              'Botanicals, kunst of modulaire straten?'
            }
          />
        </div>
      </div>
    </ShellWeb>
  );
}
