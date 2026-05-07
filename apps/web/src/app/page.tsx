import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import { buildCurrentSetCardPriceContext } from './lib/current-set-card-price-context';
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
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics,
  listCachedCatalogCurrentOfferSummaries,
  listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  rankCatalogPartnerOfferSetCards,
  resolveHomepageFollowRailDiagnostics,
  selectCatalogFirstCommerceRailSetCards,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
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

export const revalidate = 21_600;
const HOMEPAGE_DISCOVERY_RAIL_LIMIT = 20;
const HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT = 20;
const HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT = 20;
const HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS = 21_600;
const HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS = 2;
const homepageValueSignals = [
  {
    id: 'price-context',
    title: 'Prijscontext, geen losse korting',
    body: 'We leggen nagekeken winkelprijzen naast wat we voor die set meestal zien.',
  },
  {
    id: 'when-to-buy',
    title: 'Niet alleen waar, maar wanneer',
    body: 'Brickhunt helpt je zien of nu instappen slim is of dat wachten beter voelt.',
  },
  {
    id: 'verified-offers',
    title: 'Nagekeken winkels, geen prijsruis',
    body: 'Nog geen goede deal? Volg de set. Is de vergelijking te dun, dan blijven we stil.',
  },
] as const;

function toFeatureSetListItems(
  setCards: readonly CatalogHomepageSetCard[],
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummaries>
  >,
  {
    cardSurface,
    sectionId,
  }: {
    cardSurface: 'deal' | 'featured';
    sectionId: string;
  },
): CatalogFeatureSetListItem[] {
  return setCards.map((homepageSetCard, index) => {
    const featuredSetPriceContext = getFeaturedSetPriceContext(
      homepageSetCard.id,
    );
    const currentOfferSummary = currentOfferSummaryBySetId.get(
      homepageSetCard.id,
    );
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
      priceContext: (() => {
        const currentSetCardPriceContext = buildCurrentSetCardPriceContext({
          currentOfferSummary,
          pricePanelSnapshot: featuredSetPriceContext,
          theme: homepageSetCard.theme,
        });

        return currentSetCardPriceContext
          ? {
              ...currentSetCardPriceContext,
              primaryActionTrackingEvent,
            }
          : undefined;
      })(),
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

function isHomepageCommerceRailsDebugEnabled(): boolean {
  return (
    process.env['DEBUG_COMMERCE_RAILS'] === 'true' ||
    process.env['NODE_ENV'] === 'development'
  );
}

function logHomepageCommerceRailDiagnostics({
  allCatalogSetCards,
  catalogDiscoverySignalBySetId,
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
  homepageBestDealCandidateSetCards,
  homepageBestDealSetCards,
  homepageFirstCommerceInputSetCards,
  homepageFollowRailDiagnostics,
  runtimeDiagnostics,
  scoredCommerceCandidateSetCards,
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
  homepageBestDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  homepageBestDealSetCards: readonly CatalogFeatureSetListItem[];
  homepageFirstCommerceInputSetCards: readonly CatalogHomepageSetCard[];
  homepageFollowRailDiagnostics?: Awaited<
    ReturnType<typeof resolveHomepageFollowRailDiagnostics>
  >;
  runtimeDiagnostics?: Awaited<
    ReturnType<typeof getCatalogCommerceRailRuntimeDiagnostics>
  >;
  scoredCommerceCandidateSetCards: readonly CatalogHomepageSetCard[];
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

  console.info('[commerce-rails] homepage diagnostics', {
    candidates: {
      bestDealsNow: homepageBestDealCandidateSetCards.map(
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
      bestDealsNow: homepageBestDealSetCards.length,
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
      firstRailInputCount: homepageFirstCommerceInputSetCards.length,
      firstRailRenderedCount: homepageBestDealSetCards.length,
      scoredCommerceCandidateCount: scoredCommerceCandidateSetCards.length,
    },
    firstSetScoringInputs: getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      excludedSetIds: homepageBestDealSetCards.map(
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

export default async function HomePage() {
  const queryMode = await getEditorialQueryMode();
  const [
    homepagePage,
    catalogDiscoverySignalBySetId,
    allCatalogSetCards,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  ] = await Promise.all([
    getHomepagePage({
      mode: queryMode,
    }),
    listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS,
        tags: [cacheTags.homepage()],
      },
    }),
    listCatalogSetCards(),
    listHomepageThemeDirectoryItems(),
    listHomepageThemeSpotlightItems(),
  ]);
  const getCatalogDiscoverySignalFn =
    catalogDiscoverySignalBySetId.size > 0
      ? (setId: string) => catalogDiscoverySignalBySetId.get(setId)
      : undefined;
  const commerceRailRotationSeed = 0;
  const currentOfferSummaryBySetId =
    await listCachedCatalogCurrentOfferSummaries({
      cacheOptions: {
        revalidateSeconds: revalidate,
        tags: [cacheTags.homepage()],
      },
      limit: 300,
    });
  const commerceRailRuntimeDiagnostics = isHomepageCommerceRailsDebugEnabled()
    ? await getCatalogCommerceRailRuntimeDiagnostics({
        limit: 300,
      })
    : undefined;
  const commerceCandidateSetCards = await listCatalogSetCardsByIds({
    canonicalIds: [...currentOfferSummaryBySetId.keys()],
  });
  const homepageBestDealCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverBestDealSetCards({
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: commerceCandidateSetCards,
      })
    : [];
  const homepageScoredCommerceCandidateSetCards =
    rankCatalogPartnerOfferSetCards({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
      rotationSeed: commerceRailRotationSeed,
      setCards: commerceCandidateSetCards,
    });
  const homepageFirstCommerceInputSetCards =
    selectCatalogFirstCommerceRailSetCards({
      limit: HOMEPAGE_FIRST_COMMERCE_RAIL_LIMIT,
      scoredCommerceCandidateSetCards: homepageScoredCommerceCandidateSetCards,
      strictDealSetCards: homepageBestDealCandidateSetCards,
    });
  const homepageHeroSection = getHeroSection(homepagePage.sections);
  const homepageBestDealCandidates = toFeatureSetListItems(
    homepageFirstCommerceInputSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'best-current-deals',
    },
  ).filter(hasCommerceAction);
  const homepageBestDealSetCards =
    homepageBestDealCandidates.length >= HOMEPAGE_MIN_COMMERCE_RAIL_ITEMS
      ? homepageBestDealCandidates
      : [];
  const homepageFollowExcludedSetIds = getUniqueCatalogSetIds([
    homepageBestDealSetCards,
  ]);
  const homepageFollowSetCards = await listHomepageSetCards({
    excludedSetIds: homepageFollowExcludedSetIds,
    getCatalogDiscoverySignalFn,
    limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
    rotationSeed: commerceRailRotationSeed,
  });
  const homepageFollowRailDiagnostics = isHomepageCommerceRailsDebugEnabled()
    ? await resolveHomepageFollowRailDiagnostics({
        excludedSetIds: homepageFollowExcludedSetIds,
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
      })
    : undefined;
  const homepageSetCards = toFeatureSetListItems(
    homepageFollowSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'featured',
      sectionId: 'popular-to-follow',
    },
  );

  logHomepageCommerceRailDiagnostics({
    allCatalogSetCards,
    catalogDiscoverySignalBySetId,
    commerceCandidateSetCards,
    currentOfferSummaryBySetId,
    homepageBestDealCandidateSetCards,
    homepageBestDealSetCards,
    homepageFirstCommerceInputSetCards,
    homepageFollowRailDiagnostics,
    runtimeDiagnostics: commerceRailRuntimeDiagnostics,
    scoredCommerceCandidateSetCards: homepageScoredCommerceCandidateSetCards,
    rotationSeed: commerceRailRotationSeed,
  });

  const homepageHeroPage = homepageHeroSection
    ? {
        ...homepagePage,
        sections: [homepageHeroSection],
      }
    : homepagePage;

  return (
    <ShellWeb>
      <div className={styles.page}>
        <div className={styles.heroSection}>
          <ContentFeaturePageRenderer editorialPage={homepageHeroPage} />
        </div>
        {homepageBestDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Sets die nu duidelijk onder hun recente referentieprijs zitten. Dit zijn de eerste plekken om te kijken."
              eyebrow="Deals"
              sectionId="best-current-deals"
              setCards={homepageBestDealSetCards}
              showSignal={false}
              tone="default"
              title="Beste deals nu"
            />
          </div>
        ) : null}
        <Panel
          as="section"
          className={styles.valueSection}
          description="Geen couponsite. Eerst begrijpen of een set nu echt opvalt, dan pas kiezen waar je heen gaat."
          eyebrow="Waarom Brickhunt"
          padding="lg"
          title="Niet alleen waar, maar wanneer"
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
                  sectionId: 'best-current-deals',
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
        <div className={styles.themeSection}>
          <CatalogFeatureThemeList
            themeItems={homepageThemeDirectoryItems}
            tone="inverse"
          />
        </div>
        <div className={styles.sectionGroup}>
          <CatalogFeatureSetList
            description="Geen deal-label, wel sets die je collectie richting geven. Volg ze en pak het moment zodra prijs of voorraad goed wordt."
            eyebrow="Volgen"
            setCards={homepageSetCards}
            title="Populair om te volgen"
            tone="muted"
          />
        </div>
        <div className={styles.spotlightSection}>
          <CatalogFeatureThemeSpotlight
            themeItems={homepageThemeSpotlightItems}
          />
        </div>
      </div>
    </ShellWeb>
  );
}
