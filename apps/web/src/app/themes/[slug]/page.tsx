import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  getCatalogThemeMetadataBySlug,
  getCatalogThemePageBySlug,
  listCatalogThemePageSlugs,
  rankCatalogComparisonDiscoverySetCards,
} from '@lego-platform/catalog/data-access-web';
import { normalizeTheme } from '@lego-platform/catalog/util';
import {
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
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
  cacheTags,
} from '@lego-platform/shared/config';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';
import { buildCurrentSetCardPriceContext } from '../../lib/current-set-card-price-context';
import { JsonLdScript } from '../../lib/json-ld';
import {
  buildCollectionPageJsonLd,
  buildThemeBreadcrumbJsonLd,
  buildThemeCanonicalUrl,
} from '../../lib/structured-data';

export const dynamicParams = true;
export const revalidate = 21_600;
const THEME_DISCOVERY_RAIL_LIMIT = 6;
const THEME_SET_PAGE_SIZE = 48;
const THEME_RELATED_ARTICLE_LIMIT = 3;
const THEME_NON_CRITICAL_TIMEOUT_MS = 350;

function isThemePagePerfDebugEnabled(): boolean {
  return process.env['DEBUG_THEME_PAGE_PERF'] === 'true';
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

    console.info('[theme-page-perf]', {
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'ok',
    });

    return result;
  } catch (error) {
    console.info('[theme-page-perf]', {
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
        console.info('[theme-page-perf]', {
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
          tags: [cacheTags.theme(slug)],
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
    load: () => getCatalogThemeMetadataBySlug({ slug }),
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
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = readThemePageParam(resolvedSearchParams?.page);
  const themePage = await measureThemePageFetch({
    label: 'theme-page',
    slug,
    load: () =>
      getCatalogThemePageBySlug({
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

  const [featuredDealSetCards, relatedArticles] = await Promise.all([
    withThemePageOptionalTimeout({
      fallback: [] as CatalogFeatureThemePageDealItem[],
      label: 'deal-rail',
      promise: loadThemeDealSetCards({
        slug,
        themePage,
      }),
      slug,
    }),
    withThemePageOptionalTimeout({
      fallback: [] as Awaited<ReturnType<typeof loadThemeRelatedArticles>>,
      label: 'related-articles',
      promise: loadThemeRelatedArticles({
        slug,
      }),
      slug,
    }),
  ]);
  const canonicalUrl = buildThemeCanonicalUrl(slug);
  const title = `Brickhunt – ${themePage.themeSnapshot.name} LEGO sets`;
  const description = `Ontdek ${themePage.themeSnapshot.name} LEGO sets op Brickhunt met reviewed prijzen, shops en private saves. ${themePage.themeSnapshot.momentum}`;
  const jsonLd = [
    buildCollectionPageJsonLd({
      description,
      name: title,
      url: canonicalUrl,
    }),
    buildThemeBreadcrumbJsonLd({
      themeName: themePage.themeSnapshot.name,
      themeUrl: canonicalUrl,
    }),
  ];

  return (
    <ShellWeb>
      <JsonLdScript data={jsonLd} />
      <CatalogFeatureThemePage
        currentPage={currentPage}
        dealSetCards={featuredDealSetCards}
        pageSize={THEME_SET_PAGE_SIZE}
        relatedArticles={relatedArticles}
        themePage={themePage}
      />
    </ShellWeb>
  );
}
