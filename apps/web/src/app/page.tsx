import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
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
  listCatalogSetCardsByIds,
  listDiscoverHighlightSetCards,
  listHomepageDealCandidateSetCards,
  listHomepageSetCards,
} from '@lego-platform/catalog/data-access';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { getHeroSection } from '@lego-platform/content/util';
import {
  getFeaturedSetPriceContext,
  listDealSpotlightPriceContexts,
} from '@lego-platform/pricing/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getDefaultFormattingLocale } from '@lego-platform/shared/config';
import { ActionLink, Panel } from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
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
    body: 'Nog niet bijzonder? Volg de set. Is de vergelijking te dun, dan blijven we stil.',
  },
] as const;

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
    })} onder normaal`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} boven normaal`;
  }

  return 'Rond normaal';
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

function toFeatureSetListItems(
  setCards: ReturnType<typeof listCatalogSetCardsByIds>,
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
    const priceVerdict = getBrickhuntAnalyticsPriceVerdictFromDelta(
      featuredSetPriceContext?.deltaMinor,
    );

    return {
      ...homepageSetCard,
      priceContext: featuredSetPriceContext
        ? {
            coverageLabel: featuredSetPriceContext.availabilityLabel
              ? `${featuredSetPriceContext.availabilityLabel} · ${featuredSetPriceContext.merchantCount} winkels`
              : `${featuredSetPriceContext.merchantCount} winkels`,
            currentPrice: formatPriceMinor({
              currencyCode: featuredSetPriceContext.currencyCode,
              minorUnits: featuredSetPriceContext.headlinePriceMinor,
            }),
            merchantLabel: `Nu het laagst bij ${featuredSetPriceContext.merchantName}`,
            pricePositionLabel: getPricePositionLabel({
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
            }),
            pricePositionTone: getPricePositionTone(
              featuredSetPriceContext.deltaMinor,
            ),
            reviewedLabel: `Nagekeken ${formatReviewedOn(
              featuredSetPriceContext.observedAt,
            )}`,
          }
        : undefined,
      trackingEvent: {
        event: 'catalog_set_click',
        properties: {
          cardSurface,
          merchantCount: featuredSetPriceContext?.merchantCount,
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
            merchantCount: featuredSetPriceContext?.merchantCount,
            pageSurface: 'homepage',
            priceVerdict,
            sectionId,
            setId: homepageSetCard.id,
            theme: homepageSetCard.theme,
          }}
          productIntent={featuredSetPriceContext ? 'price-alert' : 'wishlist'}
          setId={homepageSetCard.id}
          variant="inline"
        />
      ),
    };
  });
}

function createHomepageFeaturedRailItems({
  excludedSetIds = [],
}: {
  excludedSetIds?: readonly string[];
} = {}): CatalogFeatureSetListItem[] {
  const excludedSetIdSet = new Set(excludedSetIds);
  const featuredSetCards = listHomepageSetCards().filter(
    (featuredSetCard) => !excludedSetIdSet.has(featuredSetCard.id),
  );
  const additionalHighlightSetCards = listDiscoverHighlightSetCards({
    limit: HOMEPAGE_FEATURED_RAIL_FILL_LIMIT,
  });
  const mergedSetCards = [...featuredSetCards];

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

  return toFeatureSetListItems(mergedSetCards, {
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
  const homepagePage = await getHomepagePage({
    mode: queryMode,
  });
  const homepageHeroSection = getHeroSection(homepagePage.sections);
  const homepageDealSetCards = toFeatureSetListItems(
    listCatalogSetCardsByIds(
      listDealSpotlightPriceContexts({
        candidateSetIds: listHomepageDealCandidateSetCards().map(
          (catalogSetCard) => catalogSetCard.id,
        ),
        limit: 3,
      }).map((priceContext) => priceContext.setId),
    ),
    {
      cardSurface: 'deal',
      sectionId: 'best-current-deals',
    },
  );
  const homepageDealSetIds = homepageDealSetCards.map(
    (homepageDealSetCard) => homepageDealSetCard.id,
  );
  const homepageSetCards = createHomepageFeaturedRailItems({
    excludedSetIds: homepageDealSetIds,
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
          <CatalogFeatureThemeList tone="inverse" />
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
          <CatalogFeatureThemeSpotlight />
        </div>
      </div>
    </ShellWeb>
  );
}
