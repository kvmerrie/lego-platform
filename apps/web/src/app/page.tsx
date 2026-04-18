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
  listDiscoverHighlightSetCardsWithOverlay,
  listHomepageDealCandidateSetCardsWithOverlay,
  listHomepageSetCardsWithOverlay,
  listHomepageThemeDirectoryItemsWithOverlay,
  listHomepageThemeSpotlightItemsWithOverlay,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { getHeroSection } from '@lego-platform/content/util';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
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
const HOMEPAGE_FEATURED_RAIL_LIMIT = 6;
const HOMEPAGE_FEATURED_RAIL_FILL_LIMIT = HOMEPAGE_FEATURED_RAIL_LIMIT * 3;
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
      ctaMode: 'default' as const,
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

function selectSetCardsByIds({
  setCards,
  setIds,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  setIds: readonly string[];
}): CatalogHomepageSetCard[] {
  const setCardById = new Map(
    setCards.map((catalogSetCard) => [catalogSetCard.id, catalogSetCard]),
  );

  return setIds.flatMap((setId) => {
    const setCard = setCardById.get(setId);

    return setCard ? [setCard] : [];
  });
}

function createHomepageFeaturedRailItems({
  additionalHighlightSetCards,
  excludedSetIds = [],
  currentOfferSummaryBySetId,
  featuredSetCards,
}: {
  additionalHighlightSetCards: readonly CatalogHomepageSetCard[];
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  excludedSetIds?: readonly string[];
  featuredSetCards: readonly CatalogHomepageSetCard[];
}): CatalogFeatureSetListItem[] {
  const excludedSetIdSet = new Set(excludedSetIds);
  const filteredFeaturedSetCards = featuredSetCards.filter(
    (featuredSetCard) => !excludedSetIdSet.has(featuredSetCard.id),
  );
  const mergedSetCards = [...filteredFeaturedSetCards];

  for (const additionalHighlightSetCard of additionalHighlightSetCards) {
    if (
      excludedSetIdSet.has(additionalHighlightSetCard.id) ||
      mergedSetCards.some(
        (featuredSetCard) =>
          featuredSetCard.id === additionalHighlightSetCard.id,
      )
    ) {
      continue;
    }

    mergedSetCards.push(additionalHighlightSetCard);

    if (mergedSetCards.length === HOMEPAGE_FEATURED_RAIL_LIMIT) {
      break;
    }
  }

  return toFeatureSetListItems(mergedSetCards, currentOfferSummaryBySetId, {
    cardSurface: 'featured',
    sectionId: 'featured-sets',
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
  const [
    homepagePage,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
    homepageDealCandidateSetCards,
    homepageFeaturedCandidateSetCards,
    homepageFeaturedFillSetCards,
  ] = await Promise.all([
    getHomepagePage({
      mode: queryMode,
    }),
    listHomepageThemeDirectoryItemsWithOverlay(),
    listHomepageThemeSpotlightItemsWithOverlay(),
    listHomepageDealCandidateSetCardsWithOverlay(),
    listHomepageSetCardsWithOverlay(),
    listDiscoverHighlightSetCardsWithOverlay({
      limit: HOMEPAGE_FEATURED_RAIL_FILL_LIMIT,
    }),
  ]);
  const homepageDealSetIds = listDealSpotlightPriceContexts({
    candidateSetIds: homepageDealCandidateSetCards.map(
      (catalogSetCard) => catalogSetCard.id,
    ),
    limit: 3,
  }).map((priceContext) => priceContext.setId);
  const homepageFeaturedCandidateSetIds = homepageFeaturedCandidateSetCards.map(
    (featuredSetCard) => featuredSetCard.id,
  );
  const homepageFeaturedFillSetIds = homepageFeaturedFillSetCards.map(
    (highlightSetCard) => highlightSetCard.id,
  );
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: [
        ...homepageDealSetIds,
        ...homepageFeaturedCandidateSetIds,
        ...homepageFeaturedFillSetIds,
      ],
    });
  const homepageHeroSection = getHeroSection(homepagePage.sections);
  const homepageDealSetCards = toFeatureSetListItems(
    selectSetCardsByIds({
      setCards: homepageDealCandidateSetCards,
      setIds: homepageDealSetIds,
    }),
    currentOfferSummaryBySetId,
    {
      cardSurface: 'deal',
      sectionId: 'best-current-deals',
    },
  );
  const homepageDealSetCardIds = homepageDealSetCards.map(
    (homepageDealSetCard) => homepageDealSetCard.id,
  );
  const homepageSetCards = createHomepageFeaturedRailItems({
    additionalHighlightSetCards: homepageFeaturedFillSetCards,
    currentOfferSummaryBySetId,
    excludedSetIds: homepageDealSetCardIds,
    featuredSetCards: homepageFeaturedCandidateSetCards,
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
        {homepageDealSetCards.length ? (
          <div className={styles.sectionGroup}>
            <CatalogFeatureSetList
              description="Hier zie je wat nu slimmer geprijsd is. Nog niet klaar? Volg de prijs op de set."
              eyebrow="Nu slimmer geprijsd"
              sectionId="best-current-deals"
              setCards={homepageDealSetCards}
              signalText={`${homepageDealSetCards.length} sets die nu interessanter zijn om te kopen`}
              tone="default"
              title="Hier wil je nu als eerste kijken"
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
