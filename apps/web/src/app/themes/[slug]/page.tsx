import {
  getCatalogThemeMetadataBySlug,
  getCatalogThemePageBySlug,
  getThemeCommerceSnapshot,
  listCatalogThemePageSlugs,
} from '@lego-platform/catalog/data-access-web';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  type ThemeBrowsePriceContext,
  type ThemeCommerceCard,
  type ThemeCommerceSnapshot,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import {
  CatalogFeatureThemeFavoriteToggle,
  CatalogFeatureThemePage,
  type CatalogFeatureThemePageDealItem,
} from '@lego-platform/catalog/feature-theme-page';
import { type CatalogSetCardPriceContext } from '@lego-platform/catalog/ui';
import { listPublishedArticles } from '@lego-platform/content/data-access';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildCanonicalUrl,
  buildArticlePath,
  buildThemePath,
  buildPublicBrowseThemeCacheTags,
} from '@lego-platform/shared/config';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';
import { buildBrowseSetCardPriceContext } from '../../lib/current-set-card-price-context';
import { JsonLdScript } from '../../lib/json-ld';
import { getCachedPublicBrowsePageData } from '../../lib/public-browse-page-cache';
import {
  buildCollectionPageJsonLd,
  buildThemeBreadcrumbJsonLd,
} from '../../lib/structured-data';

export const dynamicParams = true;
export const revalidate = false;
const THEME_SET_PAGE_SIZE = CATALOG_BROWSE_PAGE_SIZE;
const THEME_RELATED_ARTICLE_LIMIT = 3;
const THEME_NON_CRITICAL_TIMEOUT_MS = 350;
const THEME_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS = 500;
const THEME_PAGE_PERF_DEFAULT_LOG_LIMIT = 12;
let themePagePerfLogCount = 0;

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

function buildThemeCanonicalPath({
  page,
  slug,
}: {
  page: number;
  slug: string;
}): string {
  const themePath = buildThemePath(slug);

  return page > 1 ? `${themePath}?page=${page}` : themePath;
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

function buildThemeDealCardPriceContext(
  card: ThemeCommerceCard,
): CatalogSetCardPriceContext | undefined {
  if (
    typeof card.currentPriceMinor !== 'number' ||
    card.currentPriceMinor <= 0
  ) {
    return undefined;
  }

  return {
    coverageLabel: card.confidenceLabel ?? 'Actuele prijs gevonden',
    currentPrice: `Vanaf ${formatPriceMinor({
      currencyCode: 'EUR',
      minorUnits: card.currentPriceMinor,
    })}`,
    decisionLabel: card.dealLabel ?? 'Beste prijs',
    merchantLabel: card.merchantName
      ? `Laagst bij ${card.merchantName}`
      : 'Laagste bekende prijs',
    ...(card.ctaUrl ? { primaryActionHref: card.ctaUrl } : {}),
    pricePositionLabel: card.dealLabel ?? 'Beste prijs',
    pricePositionTone: 'positive',
    reviewedLabel: 'Snapshot bijgewerkt',
  };
}

function buildThemeBrowseCardPriceContext(
  priceContext?: ThemeBrowsePriceContext,
): CatalogSetCardPriceContext | undefined {
  if (!priceContext) {
    return undefined;
  }

  const basePriceContext = buildBrowseSetCardPriceContext({
    merchantName: priceContext.merchantName,
    priceMinor: priceContext.currentPriceMinor,
  });

  if (!basePriceContext && !priceContext.priceLabel) {
    return undefined;
  }

  return {
    coverageLabel:
      priceContext.confidenceLabel ??
      basePriceContext?.coverageLabel ??
      'Actuele prijs gevonden',
    currentPrice:
      priceContext.priceLabel ??
      basePriceContext?.currentPrice ??
      'Prijs volgt',
    decisionLabel:
      priceContext.dealLabel ??
      basePriceContext?.decisionLabel ??
      'Beste prijs',
    merchantLabel: priceContext.merchantName
      ? `Laagst bij ${priceContext.merchantName}`
      : (basePriceContext?.merchantLabel ?? 'Laagste bekende prijs'),
    ...(priceContext.ctaUrl ? { primaryActionHref: priceContext.ctaUrl } : {}),
    reviewedLabel: basePriceContext?.reviewedLabel ?? 'Snapshot bijgewerkt',
  };
}

function toThemeDealSetCards({
  snapshot,
  themeName,
}: {
  snapshot?: ThemeCommerceSnapshot;
  themeName: string;
}): CatalogFeatureThemePageDealItem[] {
  return (snapshot?.featuredDeals ?? []).flatMap((card) => {
    if (
      typeof card.releaseYear !== 'number' ||
      typeof card.pieces !== 'number'
    ) {
      return [];
    }

    const theme = card.theme ?? themeName;
    const priceContext = buildThemeDealCardPriceContext(card);

    return [
      {
        id: card.setId,
        slug: card.slug,
        name: card.name,
        imageUrl: card.imageUrl,
        ...(card.publicTheme ? { publicTheme: card.publicTheme } : {}),
        theme,
        releaseYear: card.releaseYear,
        pieces: card.pieces,
        actions: (
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              pageSurface: 'theme_page',
              sectionId: 'theme-best-deals',
              setId: card.setId,
              theme,
            }}
            productIntent={priceContext ? 'price-alert' : 'wishlist'}
            setId={card.setId}
            variant="inline"
          />
        ),
        ctaMode: card.ctaUrl ? 'commerce' : 'default',
        ...(priceContext ? { priceContext } : {}),
      },
    ];
  });
}

async function withThemeBrowsePriceContexts({
  themeCommerceSnapshot,
  themePage,
}: {
  themeCommerceSnapshot?: ThemeCommerceSnapshot;
  themePage: NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>;
}): Promise<
  NonNullable<Awaited<ReturnType<typeof getCatalogThemePageBySlug>>>
> {
  if (!themePage.setCards.length) {
    return themePage;
  }

  return {
    ...themePage,
    setCards: themePage.setCards.map((setCard) => {
      const priceContext = buildThemeBrowseCardPriceContext(
        themeCommerceSnapshot?.browsePriceContextBySetId[setCard.id],
      );

      return {
        ...setCard,
        actions: (
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              pageSurface: 'theme_page',
              sectionId: 'theme-browse',
              setId: setCard.id,
              theme: setCard.theme,
            }}
            productIntent={priceContext ? 'price-alert' : 'wishlist'}
            setId={setCard.id}
            variant="inline"
          />
        ),
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = readThemePageParam(resolvedSearchParams?.page);
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
  const canonicalUrl = buildCanonicalUrl(
    buildThemeCanonicalPath({
      page: currentPage,
      slug,
    }),
    {
      allowedSearchParams: ['page'],
    },
  );

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
  const [themePage, themeCommerceSnapshot] = await Promise.all([
    measureThemePageFetch({
      label: 'theme-page',
      slug,
      load: () =>
        getCachedCatalogThemePageBySlug({
          limit: THEME_SET_PAGE_SIZE,
          offset: (currentPage - 1) * THEME_SET_PAGE_SIZE,
          slug,
        }),
    }),
    measureThemePageFetch({
      label: 'theme-commerce-snapshot',
      slug,
      load: () => getThemeCommerceSnapshot({ slug }),
    }),
  ]);

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

  const relatedArticlesPromise = withThemePageOptionalTimeout({
    fallback: [] as Awaited<ReturnType<typeof loadThemeRelatedArticles>>,
    label: 'related-articles',
    promise: loadThemeRelatedArticles({
      slug,
    }),
    slug,
  });
  const pricedThemePage = await withThemeBrowsePriceContexts({
    themeCommerceSnapshot,
    themePage,
  });
  const dealSetCards = toThemeDealSetCards({
    snapshot: themeCommerceSnapshot,
    themeName: pricedThemePage.themeSnapshot.name,
  });
  const relatedArticles = await relatedArticlesPromise;
  const canonicalUrl = buildCanonicalUrl(
    buildThemeCanonicalPath({
      page: currentPage,
      slug,
    }),
    {
      allowedSearchParams: ['page'],
    },
  );
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
        dealSetCards={dealSetCards}
        pageSize={THEME_SET_PAGE_SIZE}
        relatedArticles={relatedArticles}
        themeFavoriteAction={
          pricedThemePage.themeSnapshot.id
            ? ({ buttonSurface }) => (
                <CatalogFeatureThemeFavoriteToggle
                  buttonSurface={buttonSurface}
                  themeId={pricedThemePage.themeSnapshot.id ?? ''}
                  themeName={pricedThemePage.themeSnapshot.name}
                />
              )
            : undefined
        }
        themePage={pricedThemePage}
      />
    </ShellWeb>
  );
}
