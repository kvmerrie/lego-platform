import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  getCatalogThemeMetadataBySlug,
  getCatalogThemePageBySlug,
  listCatalogThemePageSlugs,
  rankCatalogComparisonDiscoverySetCards,
} from '@lego-platform/catalog/data-access-web';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import {
  CatalogFeatureThemePage,
  CatalogFeatureThemeDealRail,
  CatalogFeatureThemeRelatedArticles,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import { CatalogSetCardRailSkeletonSection } from '@lego-platform/catalog/ui';
import { listPublishedArticles } from '@lego-platform/content/data-access';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import {
  type BrickhuntAnalyticsEventDescriptor,
  getBrickhuntAnalyticsPriceVerdictFromDelta,
} from '@lego-platform/shared/util';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildCanonicalUrl,
  buildArticlePath,
  buildThemePath,
  buildPublicBrowseThemeCacheTags,
  cacheTags,
} from '@lego-platform/shared/config';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React, { Suspense } from 'react';
import {
  buildBrowseSetCardPriceContextBySetId,
  buildCurrentSetCardPriceContextBySetId,
} from '../../lib/current-set-card-price-context';
import { JsonLdScript } from '../../lib/json-ld';
import { getCachedPublicBrowsePageData } from '../../lib/public-browse-page-cache';
import {
  buildCollectionPageJsonLd,
  buildThemeBreadcrumbJsonLd,
  buildThemeCanonicalUrl,
} from '../../lib/structured-data';

export const dynamicParams = true;
export const revalidate = false;
const THEME_DISCOVERY_RAIL_LIMIT = 6;
const THEME_SET_PAGE_SIZE = CATALOG_BROWSE_PAGE_SIZE;
const THEME_RELATED_ARTICLE_LIMIT = 3;
const THEME_NON_CRITICAL_TIMEOUT_MS = 350;
const THEME_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS = 500;
const THEME_PAGE_PERF_DEFAULT_LOG_LIMIT = 12;
let themePagePerfLogCount = 0;

function getPublicMerchandisingRotationSeed(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 6));
}

function isThemePagePerfDebugEnabled(): boolean {
  return process.env['DEBUG_THEME_PAGE_PERF'] === 'true';
}

function isThemePagePerfVerboseEnabled(): boolean {
  return process.env['DEBUG_THEME_PAGE_PERF_VERBOSE'] === 'true';
}

function getThemePagePerfNumber({
  defaultValue,
  envName,
}: {
  defaultValue: number;
  envName: string;
}): number {
  const value = Number(process.env[envName]);

  return Number.isFinite(value) && value >= 0 ? value : defaultValue;
}

function shouldLogThemePagePerf({
  durationMs,
  status,
}: {
  durationMs: number;
  status: 'ok' | 'error' | 'timeout';
}): boolean {
  if (!isThemePagePerfDebugEnabled()) {
    return status === 'timeout';
  }

  if (isThemePagePerfVerboseEnabled()) {
    return true;
  }

  if (status !== 'ok') {
    return true;
  }

  return (
    durationMs >=
    getThemePagePerfNumber({
      defaultValue: THEME_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS,
      envName: 'DEBUG_THEME_PAGE_PERF_SLOW_MS',
    })
  );
}

function logThemePagePerf({
  details,
  durationMs,
  label,
  slug,
  status,
}: {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  label: string;
  slug: string;
  status: 'ok' | 'error' | 'timeout';
}) {
  if (!shouldLogThemePagePerf({ durationMs, status })) {
    return;
  }

  const logLimit = getThemePagePerfNumber({
    defaultValue: THEME_PAGE_PERF_DEFAULT_LOG_LIMIT,
    envName: 'DEBUG_THEME_PAGE_PERF_LOG_LIMIT',
  });

  if (status !== 'error' && themePagePerfLogCount >= logLimit) {
    return;
  }

  themePagePerfLogCount += 1;

  const log =
    status === 'timeout' || status === 'error' ? console.warn : console.info;

  log('[theme-page-perf]', {
    ...details,
    durationMs,
    label,
    slug,
    status,
  });
}

async function measureThemePageFetch<T>({
  label,
  load,
  slug,
}: {
  label: string;
  load: () => Promise<T>;
  slug: string;
}): Promise<T> {
  if (!isThemePagePerfDebugEnabled()) {
    return load();
  }

  const startedAt = Date.now();

  try {
    const result = await load();

    logThemePagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'ok',
    });

    return result;
  } catch (error) {
    logThemePagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'error',
    });

    throw error;
  }
}

async function withThemePageOptionalTimeout<T>({
  fallback,
  label,
  promise,
  slug,
  timeoutMs = THEME_NON_CRITICAL_TIMEOUT_MS,
}: {
  fallback: T;
  label: string;
  promise: Promise<T>;
  slug: string;
  timeoutMs?: number;
}): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      if (isThemePagePerfDebugEnabled()) {
        logThemePagePerf({
          durationMs: timeoutMs,
          label,
          slug,
          status: 'timeout',
        });
      }

      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise.catch(() => fallback), timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function getCachedCatalogThemeMetadataBySlug({ slug }: { slug: string }) {
  return getCachedPublicBrowsePageData({
    load: () => getCatalogThemeMetadataBySlug({ slug }),
    pageType: 'theme-metadata',
    revalidateSeconds: revalidate,
    slug,
    tags: buildPublicBrowseThemeCacheTags({ themeSlug: slug }),
  });
}

async function getCachedCatalogThemePageBySlug({
  limit,
  offset,
  slug,
}: {
  limit: number;
  offset: number;
  slug: string;
}) {
  return getCachedPublicBrowsePageData({
    load: () =>
      getCatalogThemePageBySlug({
        limit,
        offset,
        slug,
      }),
    pageType: 'theme',
    params: ['limit', limit, 'offset', offset],
    revalidateSeconds: revalidate,
    slug,
    tags: buildPublicBrowseThemeCacheTags({ themeSlug: slug }),
  });
}

function readThemePageParam(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(rawValue ?? '1', 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function toThemeDealSetCards({
  currentOfferSummaryBySetId,
  setCards,
}: {
  currentOfferSummaryBySetId: Awaited<
    ReturnType<typeof listCatalogCurrentOfferSummariesBySetIds>
  >;
  setCards: readonly CatalogFeatureThemePageDealItem[];
}): CatalogFeatureThemePageDealItem[] {
  const priceContextBySetId = buildCurrentSetCardPriceContextBySetId({
    currentOfferSummaryBySetId,
    setCards,
  });

  return setCards.flatMap((setCard) => {
    return [
      {
        ...setCard,
        priceContext: priceContextBySetId.get(setCard.id),
      },
    ];
  });
}

async function loadThemeRelatedArticles({ slug }: { slug: string }): Promise<
  {
    date?: string;
    description?: string;
    href: string;
    title: string;
  }[]
> {
  const publishedArticles = await measureThemePageFetch({
    label: 'related-articles',
    slug,
    load: () =>
      listPublishedArticles({
        limit: THEME_RELATED_ARTICLE_LIMIT,
        themeQuery: slug,
      }),
  });

  return publishedArticles
    .filter((article) => normalizeTheme(article.theme)?.key === slug)
    .slice(0, THEME_RELATED_ARTICLE_LIMIT)
    .map((article) => ({
      date: article.date,
      description: article.description,
      href: buildArticlePath(article.slug, slug),
      title: article.title,
    }));
}

async function loadThemeDealSetCards({
  slug,
  themePage,
}: {
  slug: string;
  themePage: NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>;
}): Promise<CatalogFeatureThemePageDealItem[]> {
  const catalogDiscoverySignalBySetId = await measureThemePageFetch({
    label: 'discovery-signals',
    slug,
    load: () =>
      listCatalogDiscoverySignalsBySetId({
        cacheOptions: {
          revalidateSeconds: revalidate,
          tags: [cacheTags.theme(slug), cacheTags.prices()],
        },
        setIds: themePage.setCards.map((setCard) => setCard.id),
      }),
  });

  if (!catalogDiscoverySignalBySetId.size) {
    return [];
  }

  const themeDiscoverySetCards = rankCatalogComparisonDiscoverySetCards({
    getCatalogDiscoverySignalFn: (setId) =>
      catalogDiscoverySignalBySetId.get(setId),
    limit: THEME_DISCOVERY_RAIL_LIMIT,
    rotationSeed: getPublicMerchandisingRotationSeed(),
    setCards: themePage.setCards,
  });

  if (!themeDiscoverySetCards.length) {
    return [];
  }

  const currentOfferSummaryBySetId = await measureThemePageFetch({
    label: 'current-offers',
    slug,
    load: () =>
      listCatalogCurrentOfferSummariesBySetIds({
        cacheOptions: {
          revalidateSeconds: revalidate,
          tags: [
            cacheTags.theme(slug),
            cacheTags.prices(),
            ...themeDiscoverySetCards.map((setCard) =>
              cacheTags.set(setCard.id),
            ),
          ],
        },
        setIds: themeDiscoverySetCards.map((setCard) => setCard.id),
      }),
  });
  const dealSetCards = toThemeDealSetCards({
    currentOfferSummaryBySetId,
    setCards: themeDiscoverySetCards,
  });

  return dealSetCards.map((dealSetCard, index) => {
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
}

async function withThemeBrowsePriceContexts({
  slug,
  themePage,
}: {
  slug: string;
  themePage: NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>;
}): Promise<
  NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>
> {
  if (!themePage.setCards.length) {
    return themePage;
  }

  const currentOfferSummaryBySetId = await measureThemePageFetch({
    label: 'browse-current-offers',
    slug,
    load: () =>
      listCatalogCurrentOfferSummariesBySetIds({
        cacheOptions: {
          revalidateSeconds: revalidate,
          tags: [
            cacheTags.theme(slug),
            cacheTags.prices(),
            ...themePage.setCards.map((setCard) => cacheTags.set(setCard.id)),
          ],
        },
        liveFallbackSetIdLimit: 0,
        setIds: themePage.setCards.map((setCard) => setCard.id),
      }),
  });
  const priceContextBySetId = buildBrowseSetCardPriceContextBySetId({
    currentOfferSummaryBySetId,
    setCards: themePage.setCards,
  });

  if (!priceContextBySetId.size) {
    return themePage;
  }

  return {
    ...themePage,
    setCards: themePage.setCards.map((setCard) => {
      const priceContext = priceContextBySetId.get(setCard.id);

      return {
        ...setCard,
        ...(priceContext ? { priceContext } : {}),
      };
    }),
  };
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
  const themeSnapshot = await measureThemePageFetch({
    label: 'metadata',
    slug,
    load: () => getCachedCatalogThemeMetadataBySlug({ slug }),
  });

  if (!themeSnapshot) {
    return {};
  }

  const title = `Brickhunt – ${themeSnapshot.name} LEGO sets`;
  const description = `Ontdek ${themeSnapshot.name} LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. ${themeSnapshot.momentum}`;
  const canonicalUrl = buildCanonicalUrl(buildThemePath(slug));

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      description,
      title,
      type: 'website',
      url: canonicalUrl,
    },
  };
}

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const serverRenderStartedAt = Date.now();
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = readThemePageParam(resolvedSearchParams?.page);
  const themePage = await measureThemePageFetch({
    label: 'theme-page',
    slug,
    load: () =>
      getCachedCatalogThemePageBySlug({
        limit: THEME_SET_PAGE_SIZE,
        offset: (currentPage - 1) * THEME_SET_PAGE_SIZE,
        slug,
      }),
  });

  if (!themePage) {
    notFound();
  }

  const pageCount = Math.max(
    1,
    Math.ceil(themePage.themeSnapshot.setCount / THEME_SET_PAGE_SIZE),
  );

  if (currentPage > pageCount) {
    notFound();
  }

  const pricedThemePage = await withThemeBrowsePriceContexts({
    slug,
    themePage,
  });
  const canonicalUrl = buildThemeCanonicalUrl(slug);
  const title = `Brickhunt – ${pricedThemePage.themeSnapshot.name} LEGO sets`;
  const description = `Ontdek ${pricedThemePage.themeSnapshot.name} LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. ${pricedThemePage.themeSnapshot.momentum}`;
  const jsonLd = [
    buildCollectionPageJsonLd({
      description,
      name: title,
      url: canonicalUrl,
    }),
    buildThemeBreadcrumbJsonLd({
      themeName: pricedThemePage.themeSnapshot.name,
      themeUrl: canonicalUrl,
    }),
  ];

  logThemePagePerf({
    details: {
      currentPage,
      lcpImageCandidate:
        pricedThemePage.visual?.imageUrl ??
        pricedThemePage.setCards[0]?.imageUrl,
      setCardCount: pricedThemePage.setCards.length,
      totalSetCount: pricedThemePage.themeSnapshot.setCount,
    },
    durationMs: Date.now() - serverRenderStartedAt,
    label: 'server-render-total',
    slug,
    status: 'ok',
  });

  return (
    <ShellWeb>
      <JsonLdScript data={jsonLd} />
      <CatalogFeatureThemePage
        currentPage={currentPage}
        dealRail={
          <Suspense
            fallback={
              <CatalogSetCardRailSkeletonSection
                ariaLabel={`Hier wil je nu als eerste kijken in ${themePage.themeSnapshot.name} laden`}
                description={`We halen actuele ${themePage.themeSnapshot.name}-prijzen op voor deze rail.`}
                eyebrow="Nu interessant"
                itemCount={5}
                title={`Hier wil je nu als eerste kijken in ${themePage.themeSnapshot.name}`}
                tone="default"
              />
            }
          >
            <ThemeDealRailSlot slug={slug} themePage={themePage} />
          </Suspense>
        }
        pageSize={THEME_SET_PAGE_SIZE}
        relatedArticlesRail={
          <Suspense fallback={null}>
            <ThemeRelatedArticlesSlot
              slug={slug}
              themeName={themePage.themeSnapshot.name}
            />
          </Suspense>
        }
        themePage={pricedThemePage}
      />
    </ShellWeb>
  );
}

async function ThemeDealRailSlot({
  slug,
  themePage,
}: {
  slug: string;
  themePage: NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>;
}) {
  const dealSetCards = await loadThemeDealSetCards({
    slug,
    themePage,
  });

  return (
    <CatalogFeatureThemeDealRail
      dealSetCards={dealSetCards}
      themeName={themePage.themeSnapshot.name}
    />
  );
}

async function ThemeRelatedArticlesSlot({
  slug,
  themeName,
}: {
  slug: string;
  themeName: string;
}) {
  const relatedArticles = await withThemePageOptionalTimeout({
    fallback: [] as Awaited<ReturnType<typeof loadThemeRelatedArticles>>,
    label: 'related-articles',
    promise: loadThemeRelatedArticles({
      slug,
    }),
    slug,
  });

  return (
    <CatalogFeatureThemeRelatedArticles
      relatedArticles={relatedArticles}
      themeName={themeName}
    />
  );
}
