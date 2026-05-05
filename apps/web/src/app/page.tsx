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
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCards,
  listDiscoverBestDealSetCards,
  listDiscoverNowInterestingSetCards,
  listDiscoverRecentPriceChangeSetCards,
  listHomepageSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
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
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';

export const revalidate = 300;
const HOMEPAGE_DISCOVERY_RAIL_LIMIT = 6;
const HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT = 6;
const HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS = 300;
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
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
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

export async function generateMetadata(): Promise<Metadata> {
  const queryMode = await getEditorialQueryMode();
  const homepagePage = await getHomepagePage({
    mode: queryMode,
  });

  return getMetadataFromSeoFields(homepagePage.seo);
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
  const commerceRailRotationSeed = Math.floor(Date.now() / (1000 * 60 * 15));
  const homepageBestDealCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverBestDealSetCards({
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: allCatalogSetCards,
      })
    : [];
  const homepageRecentPriceDropCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverRecentPriceChangeSetCards({
        excludedSetIds: homepageBestDealCandidateSetCards.map(
          (catalogSetCard) => catalogSetCard.id,
        ),
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: allCatalogSetCards,
      })
    : [];
  const homepageNowInterestingCandidateSetCards = getCatalogDiscoverySignalFn
    ? await listDiscoverNowInterestingSetCards({
        excludedSetIds: getUniqueCatalogSetIds([
          homepageBestDealCandidateSetCards,
          homepageRecentPriceDropCandidateSetCards,
        ]),
        getCatalogDiscoverySignalFn,
        limit: HOMEPAGE_DISCOVERY_RAIL_LIMIT,
        rotationSeed: commerceRailRotationSeed,
        setCards: allCatalogSetCards,
      })
    : [];
  const homepageFallbackWatchSetCards = await listHomepageSetCards({
    excludedSetIds: getUniqueCatalogSetIds([
      homepageBestDealCandidateSetCards,
      homepageRecentPriceDropCandidateSetCards,
      homepageNowInterestingCandidateSetCards,
    ]),
    getCatalogDiscoverySignalFn,
    limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
  });
  const homepageFeaturedSetCards = await listHomepageSetCards({
    excludedSetIds: getUniqueCatalogSetIds([
      homepageBestDealCandidateSetCards,
      homepageRecentPriceDropCandidateSetCards,
      homepageNowInterestingCandidateSetCards,
      homepageFallbackWatchSetCards,
    ]),
    getCatalogDiscoverySignalFn,
    limit: HOMEPAGE_PREMIUM_DISCOVERY_RAIL_LIMIT,
  });
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      cacheOptions: {
        revalidateSeconds: HOMEPAGE_COMMERCE_RAIL_REVALIDATE_SECONDS,
      },
      setIds: getUniqueCatalogSetIds([
        homepageBestDealCandidateSetCards,
        homepageRecentPriceDropCandidateSetCards,
        homepageNowInterestingCandidateSetCards,
        homepageFallbackWatchSetCards,
        homepageFeaturedSetCards,
      ]),
    });
  const homepageHeroSection = getHeroSection(homepagePage.sections);
  const homepageBestDealSetCards = toFeatureSetListItems(
    homepageBestDealCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'best-current-deals',
    },
  ).filter(hasCommerceAction);
  const homepageRecentPriceDropSetCards = toFeatureSetListItems(
    homepageRecentPriceDropCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'recent-price-drops',
    },
  ).filter(hasCommerceAction);
  const homepageNowInterestingSetCards = toFeatureSetListItems(
    homepageNowInterestingCandidateSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'now-interesting-to-buy',
    },
  ).filter(hasCommerceAction);
  const homepageFallbackWatchItems = toFeatureSetListItems(
    homepageFallbackWatchSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'watchlist-commerce-fallback',
    },
  ).filter(hasCommerceAction);
  const homepageSetCards = toFeatureSetListItems(
    homepageFeaturedSetCards,
    currentOfferSummaryBySetId,
    {
      cardSurface: 'featured',
      sectionId: 'featured-sets',
    },
  );
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
              signalText={`${homepageBestDealSetCards.length} sets met een directe kooplink`}
              tone="default"
              title="Beste deals nu"
            />
          </div>
        ) : null}
        {homepageRecentPriceDropSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Deze sets zijn de afgelopen dagen goedkoper geworden en hebben nu een werkende winkelactie."
              eyebrow="Prijsdaling"
              sectionId="recent-price-drops"
              setCards={homepageRecentPriceDropSetCards}
              signalText={`${homepageRecentPriceDropSetCards.length} recente prijsdalingen`}
              tone="default"
              title="Net goedkoper geworden"
            />
          </div>
        ) : null}
        {homepageNowInterestingSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Goede prijs, voorraad en winkeldekking komen hier samen. Handig als je vandaag wilt kiezen."
              eyebrow="Koopmoment"
              sectionId="now-interesting-to-buy"
              setCards={homepageNowInterestingSetCards}
              signalText={`${homepageNowInterestingSetCards.length} sets met koopmoment`}
              tone="default"
              title="Nu interessant om te kopen"
            />
          </div>
        ) : null}
        {!homepageBestDealSetCards.length &&
        !homepageRecentPriceDropSetCards.length &&
        !homepageNowInterestingSetCards.length &&
        homepageFallbackWatchItems.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Nog geen hard dealsignaal, maar deze sets hebben wel actuele winkeldata. Zet ze klaar om te volgen."
              eyebrow="Volgen"
              sectionId="watchlist-commerce-fallback"
              setCards={homepageFallbackWatchItems}
              signalText={`${homepageFallbackWatchItems.length} sets met actuele prijsdata`}
              tone="default"
              title="In de gaten houden"
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
            description="Zoek je een groot displaystuk? Begin hier."
            eyebrow="Pronkstukken"
            setCards={homepageSetCards}
            title="Torens, walkers, supercars"
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
