import type { ReactNode } from 'react';
import {
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics,
  listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards,
  rankCatalogPartnerOfferSetCards,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogSetCardRailSection,
  type CatalogSetCardCtaMode,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { buildCurrentSetCardPriceContext } from '../lib/current-set-card-price-context';
import styles from './deals-page.module.css';

export const revalidate = 300;

const DEALS_RAIL_LIMIT = 20;
const DEALS_MIN_OPTIONAL_RAIL_ITEMS = 4;

type CurrentOfferSummaryBySetId = Awaited<
  ReturnType<typeof listCatalogCurrentOfferSummaries>
>;

interface DealsRailItem extends CatalogHomepageSetCard {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  priceContext?: CatalogSetCardPriceContext;
}

function formatSetCount(count: number): string {
  return `${count} set${count === 1 ? '' : 's'}`;
}

function isDealsCommerceRailsDebugEnabled(): boolean {
  return (
    process.env['DEBUG_COMMERCE_RAILS'] === 'true' ||
    process.env['NODE_ENV'] === 'development'
  );
}

function logDealsCommerceRailDiagnostics({
  bestDealCandidateSetCards,
  bestDealSetCards,
  budgetSetCards,
  catalogDiscoverySignalBySetId,
  commerceCandidateSetCards,
  currentOfferSummaryBySetId,
  displaySetCards,
  goodPricedCandidateSetCards,
  goodPricedSetCards,
  recentPriceChangeSetCards,
  rotationSeed,
  runtimeDiagnostics,
}: {
  bestDealCandidateSetCards: readonly CatalogHomepageSetCard[];
  bestDealSetCards: readonly DealsRailItem[];
  budgetSetCards: readonly DealsRailItem[];
  catalogDiscoverySignalBySetId: Awaited<
    ReturnType<typeof listCatalogDiscoverySignalsBySetId>
  >;
  commerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  displaySetCards: readonly DealsRailItem[];
  goodPricedCandidateSetCards: readonly CatalogHomepageSetCard[];
  goodPricedSetCards: readonly DealsRailItem[];
  recentPriceChangeSetCards: readonly DealsRailItem[];
  rotationSeed: number;
  runtimeDiagnostics?: Awaited<
    ReturnType<typeof getCatalogCommerceRailRuntimeDiagnostics>
  >;
}): void {
  if (!isDealsCommerceRailsDebugEnabled()) {
    return;
  }

  const offerSummaries = [...currentOfferSummaryBySetId.values()];

  console.info('[commerce-rails] deals diagnostics', {
    candidateCounts: {
      bestDealsNow: bestDealCandidateSetCards.length,
      commerceCandidates: commerceCandidateSetCards.length,
      goodPriced: goodPricedCandidateSetCards.length,
      offerSummaries: offerSummaries.length,
    },
    finalRailCounts: {
      bestDealsNow: bestDealSetCards.length,
      budget: budgetSetCards.length,
      display: displaySetCards.length,
      goodPriced: goodPricedSetCards.length,
      recentPriceDrops: recentPriceChangeSetCards.length,
    },
    firstSetScoringInputs: getCatalogPartnerOfferRailDiagnostics({
      catalogDiscoverySignalBySetId,
      currentOfferSummaryBySetId,
      limit: 10,
      rotationSeed,
      setCards: commerceCandidateSetCards,
    }),
    offerSignals: {
      firstCommerceCandidateSetIds: commerceCandidateSetCards
        .map((catalogSetCard) => catalogSetCard.id)
        .slice(0, 20),
      firstReturnedOfferSetIds: offerSummaries
        .map((currentOfferSummary) => currentOfferSummary.setId)
        .slice(0, 20),
      setsInStock: offerSummaries.filter(
        (currentOfferSummary) =>
          currentOfferSummary.bestOffer?.availability === 'in_stock',
      ).length,
      setsWithAffiliateDeeplink: offerSummaries.filter(
        (currentOfferSummary) =>
          typeof currentOfferSummary.bestOffer?.url === 'string' &&
          currentOfferSummary.bestOffer.url.length > 0,
      ).length,
      setsWithCurrentPrice: offerSummaries.filter(
        (currentOfferSummary) =>
          typeof currentOfferSummary.bestOffer?.priceCents === 'number' &&
          currentOfferSummary.bestOffer.priceCents > 0,
      ).length,
    },
    ...(runtimeDiagnostics ? { runtimeDiagnostics } : {}),
  });
}

function renderCanonicalNames(names: readonly string[]): ReactNode {
  return names.map((name, index) => (
    <span key={`${name}-${index}`}>
      {index > 0 ? (index === names.length - 1 ? ' en ' : ', ') : null}
      <span className="notranslate" translate="no">
        {name}
      </span>
    </span>
  ));
}

function formatFanContext(
  setCard: Pick<CatalogHomepageSetCard, 'minifigureHighlights'>,
): ReactNode {
  if (setCard.minifigureHighlights?.length) {
    const visibleHighlights = setCard.minifigureHighlights.slice(0, 3);
    return <>Met {renderCanonicalNames(visibleHighlights)}</>;
  }
}

function toRailItems(setCards: readonly DealsRailItem[]) {
  return setCards.map((setCard) => ({
    actions: setCard.actions,
    ctaMode: setCard.ctaMode,
    href: buildSetDetailPath(setCard.slug),
    id: setCard.id,
    priceContext: setCard.priceContext,
    setSummary: setCard,
    supportingNote: formatFanContext(setCard),
  }));
}

function toDealsRailSetCards({
  currentOfferSummaryBySetId,
  sectionId,
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  sectionId: string;
  setCards: readonly CatalogHomepageSetCard[];
}): DealsRailItem[] {
  return setCards
    .map((setCard, index) => {
      const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const bestCurrentOffer = currentOfferSummary?.bestOffer;
      const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
        featuredSetPriceContext?.deltaMinor,
      );
      const priceContext = buildCurrentSetCardPriceContext({
        currentOfferSummary,
        pricePanelSnapshot: featuredSetPriceContext,
        theme: setCard.theme,
      });
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
              pageSurface: 'deals',
              priceVerdict,
              rankPosition: index + 1,
              sectionId,
              setId: setCard.id,
              theme: setCard.theme,
            },
          }
        : undefined;

      return {
        ...setCard,
        actions: (
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount: currentOfferSummary?.offers.length,
              pageSurface: 'deals',
              priceVerdict,
              sectionId,
              setId: setCard.id,
              theme: setCard.theme,
            }}
            productIntent={bestCurrentOffer ? 'price-alert' : 'wishlist'}
            setId={setCard.id}
            variant="inline"
          />
        ),
        ctaMode: 'commerce' as const,
        priceContext: priceContext
          ? {
              ...priceContext,
              primaryActionTrackingEvent,
            }
          : undefined,
      };
    })
    .filter((setCard) => setCard.priceContext?.primaryActionHref);
}

function getUniqueSetIds(
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

function selectDealBudgetSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards
    .filter((setCard) => {
      const bestOffer = currentOfferSummaryBySetId.get(setCard.id)?.bestOffer;

      return (
        !excludedSetIdSet.has(setCard.id) &&
        typeof bestOffer?.priceCents === 'number' &&
        bestOffer.priceCents > 0 &&
        bestOffer.priceCents <= 5000 &&
        Boolean(bestOffer.url) &&
        bestOffer.availability !== 'out_of_stock'
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

function selectDealDisplaySetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards
    .filter((setCard) => {
      const bestOffer = currentOfferSummaryBySetId.get(setCard.id)?.bestOffer;

      return (
        !excludedSetIdSet.has(setCard.id) &&
        typeof bestOffer?.priceCents === 'number' &&
        bestOffer.priceCents > 0 &&
        Boolean(bestOffer.url) &&
        bestOffer.availability !== 'out_of_stock' &&
        (setCard.pieces >= 1500 ||
          ['Architecture', 'Icons', 'Star Wars', 'Technic'].includes(
            setCard.theme,
          ))
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

export default async function DealsPage() {
  const [catalogDiscoverySignalBySetId, currentOfferSummaryBySetId] =
    await Promise.all([
      listCatalogDiscoverySignalsBySetId({
        cacheOptions: {
          revalidateSeconds: 300,
        },
      }),
      listCatalogCurrentOfferSummaries({
        limit: 300,
      }),
    ]);
  const commerceCandidateSetCards = await listCatalogSetCardsByIds({
    canonicalIds: [...currentOfferSummaryBySetId.keys()],
  });
  const commerceRailRotationSeed = Math.floor(Date.now() / (1000 * 60 * 15));
  const getCatalogDiscoverySignalFn = (setId: string) =>
    catalogDiscoverySignalBySetId.get(setId);
  const bestDealCandidateSetCards = await listDiscoverBestDealSetCards({
    getCatalogDiscoverySignalFn,
    limit: DEALS_RAIL_LIMIT,
    rotationSeed: commerceRailRotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const bestDealSetCards = toDealsRailSetCards({
    currentOfferSummaryBySetId,
    sectionId: 'deals-best-deals',
    setCards: bestDealCandidateSetCards,
  });
  const goodPricedCandidateSetCards = rankCatalogPartnerOfferSetCards({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([bestDealSetCards]),
    limit: DEALS_RAIL_LIMIT,
    rotationSeed: commerceRailRotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const goodPricedSetCards = toDealsRailSetCards({
    currentOfferSummaryBySetId,
    sectionId: 'deals-good-priced',
    setCards: goodPricedCandidateSetCards,
  });
  const recentPriceChangeCandidateSetCards =
    await listDiscoverRecentPriceChangeSetCards({
      excludedSetIds: getUniqueSetIds([bestDealSetCards, goodPricedSetCards]),
      getCatalogDiscoverySignalFn,
      limit: DEALS_RAIL_LIMIT,
      rotationSeed: commerceRailRotationSeed,
      setCards: commerceCandidateSetCards,
    });
  const recentPriceChangeSetCards = toDealsRailSetCards({
    currentOfferSummaryBySetId,
    sectionId: 'deals-recent-price-drops',
    setCards: recentPriceChangeCandidateSetCards,
  });
  const budgetCandidateSetCards = selectDealBudgetSetCards({
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([
      bestDealSetCards,
      goodPricedSetCards,
      recentPriceChangeSetCards,
    ]),
    setCards: commerceCandidateSetCards,
  });
  const budgetSetCards = toDealsRailSetCards({
    currentOfferSummaryBySetId,
    sectionId: 'deals-budget',
    setCards: budgetCandidateSetCards,
  });
  const displayCandidateSetCards = selectDealDisplaySetCards({
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([
      bestDealSetCards,
      goodPricedSetCards,
      recentPriceChangeSetCards,
      budgetSetCards,
    ]),
    setCards: commerceCandidateSetCards,
  });
  const displaySetCards = toDealsRailSetCards({
    currentOfferSummaryBySetId,
    sectionId: 'deals-display',
    setCards: displayCandidateSetCards,
  });
  const commerceRailRuntimeDiagnostics = isDealsCommerceRailsDebugEnabled()
    ? await getCatalogCommerceRailRuntimeDiagnostics({
        limit: 300,
      })
    : undefined;

  logDealsCommerceRailDiagnostics({
    bestDealCandidateSetCards,
    bestDealSetCards,
    budgetSetCards,
    catalogDiscoverySignalBySetId,
    commerceCandidateSetCards,
    currentOfferSummaryBySetId,
    displaySetCards,
    goodPricedCandidateSetCards,
    goodPricedSetCards,
    recentPriceChangeSetCards,
    rotationSeed: commerceRailRotationSeed,
    runtimeDiagnostics: commerceRailRuntimeDiagnostics,
  });

  return (
    <ShellWeb>
      <div className={styles.page}>
        <section className={styles.intro}>
          <SectionHeading
            description="Alleen sets met actuele prijzen en kooplinks. Hier draait het om wat je vandaag echt kunt kopen."
            eyebrow="Deals"
            title="Deals die nu iets waard zijn"
            titleAs="h1"
          />
          <p className={styles.introMeta}>
            {commerceCandidateSetCards.length} sets met actuele koopdata
          </p>
        </section>

        {goodPricedSetCards.length ? (
          <CatalogSetCardRailSection
            as="section"
            ariaLabel="Nu goed geprijsd"
            bodySpacing="relaxed"
            description="Actuele partnerprijzen met een werkende kooplink. Geen losse geruchten, wel sets die je nu echt kunt vergelijken."
            eyebrow="Prijscheck"
            items={toRailItems(goodPricedSetCards)}
            padding="default"
            signal={formatSetCount(goodPricedSetCards.length)}
            title="Nu goed geprijsd"
            titleAs="h2"
            tone="default"
            variant="featured"
          />
        ) : null}

        {bestDealSetCards.length ? (
          <CatalogSetCardRailSection
            as="section"
            ariaLabel="Beste deals nu"
            bodySpacing="relaxed"
            description="Sets die nu duidelijk scherper geprijsd zijn dan hun recente referentie."
            eyebrow="Deals"
            items={toRailItems(bestDealSetCards)}
            padding="default"
            signal={formatSetCount(bestDealSetCards.length)}
            title="Beste deals nu"
            titleAs="h2"
            tone="default"
            variant="featured"
          />
        ) : null}

        {recentPriceChangeSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS ? (
          <CatalogSetCardRailSection
            as="section"
            ariaLabel="Net goedkoper geworden"
            bodySpacing="relaxed"
            description="Prijsdalingen van de afgelopen dagen, met actuele winkelactie erbij."
            eyebrow="Prijsdaling"
            items={toRailItems(recentPriceChangeSetCards)}
            padding="default"
            signal={formatSetCount(recentPriceChangeSetCards.length)}
            title="Net goedkoper geworden"
            titleAs="h2"
            tone="muted"
            variant="featured"
          />
        ) : null}

        {budgetSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS ? (
          <CatalogSetCardRailSection
            as="section"
            ariaLabel="Klein budget"
            bodySpacing="relaxed"
            description="Betaalbare sets met een actuele kooplink. Handig als je iets zoekt dat niet meteen je hele budget opeet."
            eyebrow="Budget"
            items={toRailItems(budgetSetCards)}
            padding="default"
            signal={formatSetCount(budgetSetCards.length)}
            title="Klein budget"
            titleAs="h2"
            tone="muted"
            variant="featured"
          />
        ) : null}

        {displaySetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS ? (
          <CatalogSetCardRailSection
            as="section"
            ariaLabel="Grote displaysets"
            bodySpacing="relaxed"
            description="Grotere sets met actuele prijzen. Dit zijn dozen die je koopt omdat ze straks echt zichtbaar staan."
            eyebrow="Display"
            items={toRailItems(displaySetCards)}
            padding="default"
            signal={formatSetCount(displaySetCards.length)}
            title="Grote displaysets"
            titleAs="h2"
            tone="muted"
            variant="featured"
          />
        ) : null}
      </div>
    </ShellWeb>
  );
}
