import React, { type ReactNode } from 'react';
import type { Metadata } from 'next';
import {
  getCatalogCommerceRailRuntimeDiagnostics,
  getCatalogPartnerOfferRailDiagnostics,
  listCachedCatalogAllCurrentOfferSummaries,
  listCatalogCurrentOfferSummaries,
  listCatalogDiscoverySignalsBySetId,
  listCatalogSetCardsByIds,
  listDiscoverBestDealSetCards,
  listDiscoverRecentPriceChangeSetCards,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogSetCardRailSection,
  type CatalogSetCardCtaMode,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import {
  buildCanonicalUrl,
  buildSetDetailPath,
  buildWebPath,
  cacheTags,
  webPathnames,
} from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import {
  buildCurrentSetCardPriceContextBySetId,
  compareReliableDealDiscounts,
  buildReliableDealDiscount,
} from '../lib/current-set-card-price-context';
import styles from './deals-page.module.css';

export const revalidate = 21_600;

const dealsMetadataTitle = 'LEGO deals en actuele prijzen';
const dealsMetadataDescription =
  'Bekijk LEGO-sets met actuele prijzen, kooplinks en prijsbewegingen bij Brickhunt.';

export const metadata: Metadata = {
  title: dealsMetadataTitle,
  description: dealsMetadataDescription,
  alternates: {
    canonical: buildCanonicalUrl(buildWebPath(webPathnames.deals)),
  },
  openGraph: {
    title: dealsMetadataTitle,
    description: dealsMetadataDescription,
    type: 'website',
    url: buildCanonicalUrl(buildWebPath(webPathnames.deals)),
  },
};

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
  return process.env['DEBUG_COMMERCE_RAILS'] === 'true';
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

function renderMerchandisingGroups({
  budgetSetCards,
  displaySetCards,
  goodPricedSetCards,
  recentPriceChangeSetCards,
}: {
  budgetSetCards: readonly DealsRailItem[];
  displaySetCards: readonly DealsRailItem[];
  goodPricedSetCards: readonly DealsRailItem[];
  recentPriceChangeSetCards: readonly DealsRailItem[];
}): ReactNode {
  const groups = [
    goodPricedSetCards.length ? 'Nu goed geprijsd' : undefined,
    budgetSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
      ? 'Onder €50'
      : undefined,
    displaySetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
      ? 'Grote displaysets'
      : undefined,
    recentPriceChangeSetCards.length >= DEALS_MIN_OPTIONAL_RAIL_ITEMS
      ? 'Net goedkoper'
      : undefined,
  ].filter((group): group is string => Boolean(group));

  if (groups.length === 0) {
    return null;
  }

  return (
    <ul className={styles.merchandisingGroups} aria-label="Dealgroepen">
      {groups.map((group) => (
        <li className={styles.merchandisingGroup} key={group}>
          {group}
        </li>
      ))}
    </ul>
  );
}

function toDealsRailSetCards({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  sectionId,
  setCards,
}: {
  catalogDiscoverySignalBySetId: Awaited<
    ReturnType<typeof listCatalogDiscoverySignalsBySetId>
  >;
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  sectionId: string;
  setCards: readonly CatalogHomepageSetCard[];
}): DealsRailItem[] {
  const priceContextBySetId = buildCurrentSetCardPriceContextBySetId({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    setCards,
  });

  return setCards
    .map((setCard, index) => {
      const featuredSetPriceContext = getFeaturedSetPriceContext(setCard.id);
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const bestCurrentOffer = currentOfferSummary?.bestOffer;
      const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
        featuredSetPriceContext?.deltaMinor,
      );
      const priceContext = priceContextBySetId.get(setCard.id);
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

function selectReliableDiscountSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return [...setCards]
    .filter((setCard) => {
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const bestOffer = currentOfferSummary?.bestOffer;

      return (
        !excludedSetIdSet.has(setCard.id) &&
        Boolean(bestOffer?.url) &&
        bestOffer?.availability !== 'out_of_stock' &&
        Boolean(
          buildReliableDealDiscount({
            currentOfferSummary,
            pricePanelSnapshot: getFeaturedSetPriceContext(setCard.id),
          }),
        )
      );
    })
    .sort((left, right) => {
      const leftDiscount = buildReliableDealDiscount({
        currentOfferSummary: currentOfferSummaryBySetId.get(left.id),
        pricePanelSnapshot: getFeaturedSetPriceContext(left.id),
      });
      const rightDiscount = buildReliableDealDiscount({
        currentOfferSummary: currentOfferSummaryBySetId.get(right.id),
        pricePanelSnapshot: getFeaturedSetPriceContext(right.id),
      });

      return (
        compareReliableDealDiscounts({
          left: leftDiscount,
          leftMerchantCount:
            currentOfferSummaryBySetId.get(left.id)?.offers.length ?? 0,
          right: rightDiscount,
          rightMerchantCount:
            currentOfferSummaryBySetId.get(right.id)?.offers.length ?? 0,
        }) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

function selectDealDisplaySetCards({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  setCards,
}: {
  catalogDiscoverySignalBySetId: Awaited<
    ReturnType<typeof listCatalogDiscoverySignalsBySetId>
  >;
  currentOfferSummaryBySetId: CurrentOfferSummaryBySetId;
  excludedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards
    .filter((setCard) => {
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const bestOffer = currentOfferSummary?.bestOffer;
      const discoverySignal = catalogDiscoverySignalBySetId.get(setCard.id);
      const hasClearBuyingReason =
        Boolean(
          buildReliableDealDiscount({
            currentOfferSummary,
            pricePanelSnapshot: getFeaturedSetPriceContext(setCard.id),
          }),
        ) ||
        Boolean(
          currentOfferSummary &&
            currentOfferSummary.offers.length >= 2 &&
            typeof discoverySignal?.priceSpreadMinor === 'number' &&
            discoverySignal.priceSpreadMinor >= 100,
        );

      return (
        !excludedSetIdSet.has(setCard.id) &&
        typeof bestOffer?.priceCents === 'number' &&
        bestOffer.priceCents > 0 &&
        Boolean(bestOffer.url) &&
        bestOffer.availability !== 'out_of_stock' &&
        hasClearBuyingReason &&
        setCard.pieces >= 1500 &&
        ['Architecture', 'Icons', 'Ideas', 'Star Wars', 'Technic'].includes(
          setCard.theme,
        )
      );
    })
    .slice(0, DEALS_RAIL_LIMIT);
}

export default async function DealsPage() {
  const currentOfferSummaryBySetId =
    await listCachedCatalogAllCurrentOfferSummaries({
      cacheOptions: {
        revalidateSeconds: revalidate,
        tags: [cacheTags.deals(), cacheTags.prices()],
      },
    });
  const commerceCandidateSetCards = await listCatalogSetCardsByIds({
    canonicalIds: [...currentOfferSummaryBySetId.keys()],
  });
  const catalogDiscoverySignalBySetId =
    await listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: revalidate,
        tags: [cacheTags.deals(), cacheTags.prices()],
      },
      setIds: commerceCandidateSetCards.map((setCard) => setCard.id),
    });
  const commerceRailRotationSeed = 0;
  const getCatalogDiscoverySignalFn = (setId: string) =>
    catalogDiscoverySignalBySetId.get(setId);
  const bestDealCandidateSetCards = await listDiscoverBestDealSetCards({
    getCatalogDiscoverySignalFn,
    limit: DEALS_RAIL_LIMIT,
    rotationSeed: commerceRailRotationSeed,
    setCards: commerceCandidateSetCards,
  });
  const bestDealSetCards = toDealsRailSetCards({
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    sectionId: 'deals-best-deals',
    setCards: bestDealCandidateSetCards,
  });
  const goodPricedCandidateSetCards = selectReliableDiscountSetCards({
    currentOfferSummaryBySetId,
    excludedSetIds: getUniqueSetIds([bestDealSetCards]),
    setCards: commerceCandidateSetCards,
  });
  const goodPricedSetCards = toDealsRailSetCards({
    catalogDiscoverySignalBySetId,
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
    catalogDiscoverySignalBySetId,
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
    catalogDiscoverySignalBySetId,
    currentOfferSummaryBySetId,
    sectionId: 'deals-budget',
    setCards: budgetCandidateSetCards,
  });
  const displayCandidateSetCards = selectDealDisplaySetCards({
    catalogDiscoverySignalBySetId,
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
    catalogDiscoverySignalBySetId,
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
          {renderMerchandisingGroups({
            budgetSetCards,
            displaySetCards,
            goodPricedSetCards,
            recentPriceChangeSetCards,
          })}
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
            title="Onder €50"
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
