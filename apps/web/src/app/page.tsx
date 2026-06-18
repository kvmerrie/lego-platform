import { getEditorialQueryMode } from './lib/editorial-query-mode';
import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import { getCachedPublicLandingPageData } from './lib/public-landing-page-cache';
import styles from './page.module.css';
import React from 'react';
import {
  CatalogSectionShell,
  CatalogVisualTile,
  CatalogVisualTileRail,
} from '@lego-platform/catalog/ui';
import {
  CatalogFeatureThemeList,
  CatalogFeatureThemeSpotlight,
} from '@lego-platform/catalog/feature-theme-list';
import {
  getHomepageCommerceSnapshot,
  getHomepageEditorialConfig,
  listHomepageDiscoveryTiles,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
} from '@lego-platform/catalog/data-access-web';
import type {
  CatalogThemeDirectoryItem,
  HomepageCommerceCard,
  HomepageCommerceSnapshot,
  PublicHomepageEditorialConfig,
  PublicPageSection,
} from '@lego-platform/catalog/util';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { getHeroSection } from '@lego-platform/content/util';
import { ActionLink, Panel } from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
  type BrickhuntAnalyticsProperties,
} from '@lego-platform/shared/util';
import {
  buildWebPath,
  cacheTags,
  webPathnames,
} from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';
import {
  HomepageTabbedCommerceRail,
  type HomepageTabbedCommerceRailCard,
  type HomepageTabbedCommerceRailTab,
  type HomepageTabbedCommerceRailTabId,
} from './lib/homepage-tabbed-commerce-rail';

export const revalidate = false;

const HOMEPAGE_BUY_SECTION_ID = 'best-current-deals';
const HOMEPAGE_FOLLOW_SECTION_ID = 'price-smart-follow';
const HOMEPAGE_DISCOVERY_SECTION_ID = 'ontdek-lego-op-jouw-manier';
const HOMEPAGE_CACHE_TAGS = [
  cacheTags.homepage(),
  cacheTags.catalog(),
  cacheTags.sets(),
  cacheTags.themes(),
  cacheTags.prices(),
  cacheTags.deals(),
] as const;
const HOMEPAGE_LANDING_PAGE_CACHE_VERSION = 'homepage-editorial-v2';

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

type HomepageWishlistAnalyticsContext = BrickhuntAnalyticsProperties & {
  cardSurface: 'buy' | 'follow';
  merchantName?: string;
  pageSurface: 'homepage';
  sectionId: string;
  setId: string;
  tabId: HomepageTabbedCommerceRailTabId;
  theme: string;
};

type HomepageFeatureSetListRenderItem = HomepageTabbedCommerceRailCard;

interface HomepageLandingPageData {
  homepageCommerceSnapshot?: HomepageCommerceSnapshot;
  homepageDiscoveryTiles: Awaited<
    ReturnType<typeof listHomepageDiscoveryTiles>
  >;
  homepageEditorialConfig?: PublicHomepageEditorialConfig | null;
  homepagePage: Awaited<ReturnType<typeof getHomepagePage>>;
  homepageThemeDirectoryItems: readonly CatalogThemeDirectoryItem[];
  homepageThemeSpotlightItems: Awaited<
    ReturnType<typeof listHomepageThemeSpotlightItems>
  >;
}

function isHomepagePerformanceDebugEnabled(): boolean {
  return process.env['DEBUG_HOMEPAGE_PERFORMANCE'] === 'true';
}

function getJsonPayloadSizeMb(value: unknown): number {
  return Number(
    (Buffer.byteLength(JSON.stringify(value)) / 1_048_576).toFixed(3),
  );
}

function formatHomepageCommercePrice(minorUnits: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    style: 'currency',
  }).format(minorUnits / 100);
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

function toHomepageFeatureSetListRenderItems({
  cardSurface,
  cards,
  includeCommerceCta,
  sectionId,
  snapshotGeneratedAt,
  tabId,
}: {
  cardSurface: 'buy' | 'follow';
  cards: readonly HomepageCommerceCard[];
  includeCommerceCta: boolean;
  sectionId: string;
  snapshotGeneratedAt: string;
  tabId: HomepageTabbedCommerceRailTabId;
}): HomepageFeatureSetListRenderItem[] {
  const fallbackReleaseYear =
    new Date(snapshotGeneratedAt).getUTCFullYear() ||
    new Date().getUTCFullYear();

  return cards.map((card, index) => {
    const theme = card.theme ?? 'LEGO';
    const hasCurrentPrice =
      typeof card.currentPriceMinor === 'number' && card.currentPriceMinor > 0;
    const merchantLabel = card.merchantName
      ? `Laagst bij ${card.merchantName}`
      : 'Prijs nagekeken';
    const primaryActionTrackingEvent:
      | BrickhuntAnalyticsEventDescriptor
      | undefined =
      includeCommerceCta && card.ctaUrl
        ? {
            event: 'offer_click',
            properties: {
              cardSurface,
              ...(card.merchantName ? { merchantName: card.merchantName } : {}),
              ...(card.merchantSlug ? { merchantSlug: card.merchantSlug } : {}),
              offerPlacement: 'card_primary_cta',
              offerRole: 'best',
              pageSurface: 'homepage',
              rankPosition: index + 1,
              sectionId,
              setId: card.setId,
              tabId,
              theme,
            },
          }
        : undefined;
    const priceContext = hasCurrentPrice
      ? {
          coverageLabel: card.confidenceLabel ?? 'Actuele prijs',
          currentPrice: `Vanaf ${formatHomepageCommercePrice(
            card.currentPriceMinor ?? 0,
          )}`,
          ...(card.dealLabel ? { decisionLabel: card.dealLabel } : {}),
          ...(card.merchantName ? { decisionNote: merchantLabel } : {}),
          merchantLabel,
          ...(card.merchantName ? { merchantName: card.merchantName } : {}),
          ...(card.merchantSlug ? { merchantSlug: card.merchantSlug } : {}),
          ...(includeCommerceCta && card.ctaUrl
            ? { primaryActionHref: card.ctaUrl }
            : {}),
          ...(primaryActionTrackingEvent ? { primaryActionTrackingEvent } : {}),
          reviewedLabel: 'Snapshot bijgewerkt',
        }
      : undefined;
    const wishlistAnalyticsContext: HomepageWishlistAnalyticsContext = {
      cardSurface,
      ...(card.merchantName ? { merchantName: card.merchantName } : {}),
      ...(card.merchantSlug ? { merchantSlug: card.merchantSlug } : {}),
      pageSurface: 'homepage',
      sectionId,
      setId: card.setId,
      tabId,
      theme,
    };

    return {
      id: card.setId,
      slug: card.slug,
      name: card.name,
      theme,
      releaseYear: card.releaseYear ?? fallbackReleaseYear,
      pieces: card.pieces ?? 0,
      ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
      ctaMode:
        includeCommerceCta && card.ctaUrl ? ('commerce' as const) : 'default',
      productIntent:
        card.followRecommended || hasCurrentPrice ? 'price-alert' : 'wishlist',
      ...(priceContext ? { priceContext } : {}),
      trackingEvent: {
        event: 'catalog_set_click',
        properties: {
          cardSurface,
          hasCommerceCta: Boolean(includeCommerceCta && card.ctaUrl),
          ...(card.merchantName ? { merchantName: card.merchantName } : {}),
          ...(card.merchantSlug ? { merchantSlug: card.merchantSlug } : {}),
          pageSurface: 'homepage',
          rankPosition: index + 1,
          sectionId,
          setId: card.setId,
          tabId,
          theme,
        },
      },
      wishlistAnalyticsContext,
    };
  });
}

function buildHomepageCommerceTabs(
  snapshot: HomepageCommerceSnapshot | undefined,
): {
  buyTabs: HomepageTabbedCommerceRailTab[];
  followTabs: HomepageTabbedCommerceRailTab[];
} {
  if (!snapshot) {
    return {
      buyTabs: [],
      followTabs: [],
    };
  }

  const buyTabs: HomepageTabbedCommerceRailTab[] = [
    {
      actionHref: '/deals',
      actionLabel: 'Meer deals bekijken',
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'buy',
        cards: snapshot.buyRail.bestDeals,
        includeCommerceCta: true,
        sectionId: `${HOMEPAGE_BUY_SECTION_ID}-best-deals`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'best-deals',
      }),
      description:
        'Objectief sterke actuele deals met een werkende winkelroute. Begin hier als je nu wilt kopen.',
      id: 'best-deals',
      sectionId: `${HOMEPAGE_BUY_SECTION_ID}-best-deals`,
      title: 'Beste deals',
    },
    {
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'buy',
        cards: snapshot.buyRail.popularThisWeek,
        includeCommerceCta: true,
        sectionId: `${HOMEPAGE_BUY_SECTION_ID}-popular-this-week`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'popular-this-week',
      }),
      description:
        'Sets met echte activiteit deze week. Deze tab blijft leeg als er te weinig betrouwbare populariteit is.',
      id: 'popular-this-week',
      sectionId: `${HOMEPAGE_BUY_SECTION_ID}-popular-this-week`,
      title: 'Populair',
    },
    {
      actionHref: '/lego-sets-onder-100-euro',
      actionLabel: 'Meer sets onder €100',
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'buy',
        cards: snapshot.buyRail.giftsUnder100,
        includeCommerceCta: true,
        sectionId: `${HOMEPAGE_BUY_SECTION_ID}-gifts-under-100`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'gifts-under-100',
      }),
      description: 'Herkenbare sets onder €100 met een actuele koopbare prijs.',
      id: 'gifts-under-100',
      sectionId: `${HOMEPAGE_BUY_SECTION_ID}-gifts-under-100`,
      title: 'Onder €100',
    },
  ];
  const followTabs: HomepageTabbedCommerceRailTab[] = [
    {
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'follow',
        cards: snapshot.followRail.smartToFollow,
        includeCommerceCta: false,
        sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-smart-to-follow`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'smart-to-follow',
      }),
      description:
        'Sets die de moeite waard zijn om te volgen voordat je koopt.',
      id: 'smart-to-follow',
      sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-smart-to-follow`,
      title: 'Prijsalerts',
    },
    {
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'follow',
        cards: snapshot.followRail.biggestPriceDrops,
        includeCommerceCta: false,
        sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-biggest-price-drops`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'biggest-price-drops',
      }),
      description:
        'Sets waar de prijs zichtbaar is gezakt. Volg ze als je de volgende stap wilt afwachten.',
      id: 'biggest-price-drops',
      sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-biggest-price-drops`,
      title: 'Prijsdalingen',
    },
    {
      cards: toHomepageFeatureSetListRenderItems({
        cardSurface: 'follow',
        cards: snapshot.followRail.waitCanPayOff,
        includeCommerceCta: false,
        sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-wait-can-pay-off`,
        snapshotGeneratedAt: snapshot.generatedAt,
        tabId: 'wait-can-pay-off',
      }),
      description:
        'De prijs ligt nu boven wat Brickhunt normaal vindt. Hier is volgen slimmer dan meteen kopen.',
      id: 'wait-can-pay-off',
      sectionId: `${HOMEPAGE_FOLLOW_SECTION_ID}-wait-can-pay-off`,
      title: 'Wachten loont',
    },
  ];

  return {
    buyTabs,
    followTabs,
  };
}

function hasVisibleTab(
  tabs: readonly HomepageTabbedCommerceRailTab[],
): boolean {
  return tabs.some((tab) => tab.cards.length > 0);
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
  buyTabs,
  followTabs,
}: {
  buyTabs: readonly HomepageTabbedCommerceRailTab[];
  followTabs: readonly HomepageTabbedCommerceRailTab[];
}): string {
  if (hasVisibleTab(buyTabs)) {
    return HOMEPAGE_BUY_SECTION_ID;
  }

  if (hasVisibleTab(followTabs)) {
    return HOMEPAGE_FOLLOW_SECTION_ID;
  }

  return HOMEPAGE_DISCOVERY_SECTION_ID;
}

function HomepageCommerceIntentRail({
  sectionId,
  tabs,
  title,
}: {
  sectionId: string;
  tabs: readonly HomepageTabbedCommerceRailTab[];
  title: string;
}) {
  const visibleTabs = tabs.filter((tab) => tab.cards.length > 0);

  if (!visibleTabs.length) {
    return null;
  }

  return (
    <HomepageTabbedCommerceRail
      defaultTab={visibleTabs[0]?.id}
      sectionId={sectionId}
      tabs={visibleTabs}
      title={title}
    />
  );
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
  const startedAt = performance.now();
  const [homepagePage, homepageEditorialConfig, homepageCommerceSnapshot] =
    await Promise.all([
      getHomepagePage({
        mode: queryMode,
      }),
      loadHomepageEditorialConfigSafely(),
      getHomepageCommerceSnapshot(),
    ]);
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
  const payload: HomepageLandingPageData = {
    ...(homepageCommerceSnapshot ? { homepageCommerceSnapshot } : {}),
    homepageDiscoveryTiles,
    ...(homepageEditorialConfig ? { homepageEditorialConfig } : {}),
    homepagePage,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  };

  if (isHomepagePerformanceDebugEnabled()) {
    console.info('[homepage-performance]', {
      timingsMs: {
        loadSnapshotAndEditorial: Math.round(performance.now() - startedAt),
        total: Math.round(performance.now() - startedAt),
      },
      payloadSizeMb: getJsonPayloadSizeMb(payload),
      dataSource: {
        homepageCommerceSnapshot: Boolean(homepageCommerceSnapshot),
        buyRailSetCount: homepageCommerceSnapshot
          ? [
              ...homepageCommerceSnapshot.buyRail.bestDeals,
              ...homepageCommerceSnapshot.buyRail.popularThisWeek,
              ...homepageCommerceSnapshot.buyRail.giftsUnder100,
            ].length
          : 0,
        followRailSetCount: homepageCommerceSnapshot
          ? [
              ...homepageCommerceSnapshot.followRail.smartToFollow,
              ...homepageCommerceSnapshot.followRail.biggestPriceDrops,
              ...homepageCommerceSnapshot.followRail.waitCanPayOff,
            ].length
          : 0,
      },
    });
  }

  return payload;
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
    params: [
      queryMode,
      'homepage-commerce-snapshot-v1',
      HOMEPAGE_LANDING_PAGE_CACHE_VERSION,
    ],
    revalidateSeconds: revalidate,
    tags: HOMEPAGE_CACHE_TAGS,
  });
}

export default async function HomePage() {
  const queryMode = await getEditorialQueryMode();
  const {
    homepageCommerceSnapshot,
    homepageDiscoveryTiles,
    homepageEditorialConfig,
    homepagePage,
    homepageThemeDirectoryItems,
    homepageThemeSpotlightItems,
  } = await getHomepageLandingPageData({ queryMode });
  const { buyTabs, followTabs } = buildHomepageCommerceTabs(
    homepageCommerceSnapshot,
  );
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
  const homepageHeroPage = homepageHeroSection
    ? {
        ...homepagePage,
        sections: [
          {
            ...homepageHeroSection,
            ctaHref: shouldRetargetHomepageHeroCta(homepageHeroSection.ctaHref)
              ? buildHomepageAnchorHref(
                  getHomepageHeroCtaSectionId({ buyTabs, followTabs }),
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
          id={HOMEPAGE_DISCOVERY_SECTION_ID}
          title={
            homepageDiscoverySection?.title ?? 'Ontdek LEGO op jouw manier'
          }
          tone="inverse"
        >
          <CatalogVisualTileRail>
            {renderedHomepageDiscoveryTiles.map((tile, index) => (
              <CatalogVisualTile
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
          </CatalogVisualTileRail>
        </CatalogSectionShell>
        <HomepageCommerceIntentRail
          sectionId={HOMEPAGE_BUY_SECTION_ID}
          tabs={buyTabs}
          title="Slim kopen"
        />
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
        <HomepageCommerceIntentRail
          sectionId={HOMEPAGE_FOLLOW_SECTION_ID}
          tabs={followTabs}
          title="Slim volgen"
        />
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
