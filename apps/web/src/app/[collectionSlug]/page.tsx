import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import React from 'react';
import {
  getCatalogCollectionLandingPage,
  getCatalogCollectionLandingPageConfigWithPresentation,
  getCatalogCollectionLandingPageSnapshot,
} from '@lego-platform/catalog/data-access-web';
import { CatalogFeatureCollectionLandingPage } from '@lego-platform/catalog/feature-collection-landing';
import {
  getCatalogCollectionLandingPageConfig,
  listCatalogCollectionLandingPageConfigs,
  normalizeCatalogCollectionLandingPageSortKey,
  CATALOG_BROWSE_PAGE_SIZE,
  isCatalogCollectionPageSnapshotSlug,
  type CatalogCollectionLandingPageConfig,
  type CatalogCollectionLandingPageSortKey,
} from '@lego-platform/catalog/util';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildCanonicalUrl,
  buildPublicBrowseCollectionCacheTags,
} from '@lego-platform/shared/config';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { JsonLdScript } from '../lib/json-ld';
import {
  getCachedPublicBrowsePageData,
  type SerializablePublicBrowsePageResult,
  toPublicBrowsePagePriceMinorRecord,
} from '../lib/public-browse-page-cache';
import {
  buildBreadcrumbListJsonLd,
  buildCollectionPageJsonLd,
} from '../lib/structured-data';
import {
  COLLECTION_PAGE_SNAPSHOT_MAX_AGE_MS,
  PRICE_SNAPSHOT_PAGE_MAX_AGE_MS,
  getSnapshotPageHealth,
} from '../lib/snapshot-page-health';
import { buildBrowseSetCardPriceContext } from '../lib/current-set-card-price-context';

export const dynamicParams = false;
export const revalidate = 21_600;

const COLLECTION_LANDING_PAGE_SIZE = CATALOG_BROWSE_PAGE_SIZE;

type CatalogCollectionLandingPageResult = Awaited<
  ReturnType<typeof getCatalogCollectionLandingPage>
>;

type CatalogCollectionSetCard =
  CatalogCollectionLandingPageResult['setCards'][number];

interface SerializableCollectionLandingPageResult
  extends SerializablePublicBrowsePageResult<CatalogCollectionSetCard> {
  readonly bestPriceMinorBySetId: Readonly<Record<string, number>>;
}

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCollectionPageNumber(value?: string): number {
  const parsedPage = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;
}

function buildCollectionCanonicalPath({
  config,
  page,
}: {
  config: CatalogCollectionLandingPageConfig;
  page: number;
}): string {
  return page > 1
    ? `${config.canonicalPath}?page=${page}`
    : config.canonicalPath;
}

function toSerializableCollectionLandingPageResult(
  collectionPage: CatalogCollectionLandingPageResult,
): SerializableCollectionLandingPageResult {
  return {
    bestPriceMinorBySetId: toPublicBrowsePagePriceMinorRecord(
      collectionPage.bestPriceMinorBySetId,
    ),
    setCards: collectionPage.setCards,
    totalSetCount: collectionPage.totalSetCount,
  };
}

function createEmptyCollectionLandingPageResult(): SerializableCollectionLandingPageResult {
  return {
    bestPriceMinorBySetId: {},
    setCards: [],
    totalSetCount: 0,
  };
}

function getCollectionSnapshotMaxAgeMs(
  config: CatalogCollectionLandingPageConfig,
): number {
  return config.slug === 'lego-sets-onder-50-euro' ||
    config.slug === 'lego-sets-onder-100-euro'
    ? PRICE_SNAPSHOT_PAGE_MAX_AGE_MS
    : COLLECTION_PAGE_SNAPSHOT_MAX_AGE_MS;
}

function logKnownCollectionFallback({
  config,
  generatedAt,
  health,
  limit,
  offset,
  reason,
  sortKey,
}: {
  config: CatalogCollectionLandingPageConfig;
  generatedAt?: string | null;
  health?: 'missing' | 'stale';
  limit: number;
  offset: number;
  reason: 'missing_snapshot' | 'stale_snapshot' | 'missing_runtime_data';
  sortKey: CatalogCollectionLandingPageSortKey;
}): void {
  console.warn('[collection-page] known collection rendered with fallback', {
    canonical_path: config.canonicalPath,
    collection_slug: config.slug,
    generated_at: generatedAt ?? null,
    health: health ?? null,
    limit,
    offset,
    reason,
    sort_key: sortKey,
  });
}

function logKnownCollectionZeroProducts({
  config,
  limit,
  offset,
  sortKey,
}: {
  config: CatalogCollectionLandingPageConfig;
  limit: number;
  offset: number;
  sortKey: CatalogCollectionLandingPageSortKey;
}): void {
  console.warn('[collection-page] known collection has zero products', {
    canonical_path: config.canonicalPath,
    collection_slug: config.slug,
    limit,
    offset,
    sort_key: sortKey,
  });
}

async function getCachedSerializableCollectionLandingPage({
  config,
  limit,
  offset,
  sortKey,
}: {
  config: CatalogCollectionLandingPageConfig;
  limit: number;
  offset: number;
  sortKey: CatalogCollectionLandingPageSortKey;
}): Promise<SerializableCollectionLandingPageResult> {
  const tags = buildPublicBrowseCollectionCacheTags({
    collectionSlug: config.slug,
  });

  return getCachedPublicBrowsePageData({
    load: async () => {
      const collectionPage: CatalogCollectionLandingPageResult | null =
        isCatalogCollectionPageSnapshotSlug(config.slug)
          ? await getCatalogCollectionLandingPageSnapshot({
              config,
              limit,
              offset,
              sortKey,
            }).then((snapshot) => {
              const health = getSnapshotPageHealth({
                generatedAt: snapshot?.snapshotGeneratedAt,
                maxAgeMs: getCollectionSnapshotMaxAgeMs(config),
              });

              if (health !== 'fresh') {
                logKnownCollectionFallback({
                  config,
                  generatedAt: snapshot?.snapshotGeneratedAt,
                  health,
                  limit,
                  offset,
                  reason:
                    health === 'missing'
                      ? 'missing_snapshot'
                      : 'stale_snapshot',
                  sortKey,
                });

                return null;
              }

              return snapshot ?? null;
            })
          : await getCatalogCollectionLandingPage({
              cacheOptions: {
                revalidateSeconds: revalidate,
                tags,
              },
              config,
              limit,
              offset,
              sortKey,
            });

      if (!collectionPage) {
        if (!isCatalogCollectionPageSnapshotSlug(config.slug)) {
          logKnownCollectionFallback({
            config,
            limit,
            offset,
            reason: 'missing_runtime_data',
            sortKey,
          });
        }

        return createEmptyCollectionLandingPageResult();
      }

      const result = toSerializableCollectionLandingPageResult(collectionPage);

      if (result.totalSetCount === 0 || result.setCards.length === 0) {
        logKnownCollectionZeroProducts({
          config,
          limit,
          offset,
          sortKey,
        });
      }

      return result;
    },
    pageType: 'collection',
    params: ['sort', sortKey, 'limit', limit, 'offset', offset],
    revalidateSeconds: revalidate,
    slug: config.slug,
    tags,
  });
}

function getRelatedCollectionLandingPageLinks(
  config: CatalogCollectionLandingPageConfig,
) {
  return (config.links.relatedPages ?? []).flatMap((slug) => {
    const relatedConfig = getCatalogCollectionLandingPageConfig(slug);

    return relatedConfig && !relatedConfig.redirectPath
      ? [
          {
            href: relatedConfig.canonicalPath,
            label: relatedConfig.h1,
          },
        ]
      : [];
  });
}

export function generateStaticParams() {
  const collectionSlugs = new Set<string>();

  for (const config of listCatalogCollectionLandingPageConfigs()) {
    collectionSlugs.add(config.slug);
    collectionSlugs.add(config.canonicalPath.replace(/^\/+|\/+$/gu, ''));
  }

  return [...collectionSlugs].map((collectionSlug) => ({
    collectionSlug,
  }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ collectionSlug: string }>;
  searchParams?: Promise<{
    page?: string | string[];
    sort?: string | string[];
  }>;
}): Promise<Metadata> {
  const { collectionSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const baseConfig = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!baseConfig) {
    return {};
  }

  const config = await getCatalogCollectionLandingPageConfigWithPresentation({
    config: baseConfig,
  });

  const currentPage = normalizeCollectionPageNumber(
    readSearchParam(resolvedSearchParams?.page),
  );
  const canonicalPath = buildCollectionCanonicalPath({
    config,
    page: currentPage,
  });
  const canonicalUrl = buildCanonicalUrl(canonicalPath, {
    allowedSearchParams: ['page'],
  });

  if (config.redirectPath) {
    return {
      title: config.metaTitle,
      description: config.metaDescription,
      alternates: {
        canonical: buildCanonicalUrl(config.redirectPath),
      },
      robots: {
        follow: true,
        index: false,
      },
    };
  }

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      description: config.metaDescription,
      title: config.metaTitle,
      type: 'website',
      url: canonicalUrl,
    },
  };
}

export default async function CollectionLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionSlug: string }>;
  searchParams?: Promise<{
    page?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const { collectionSlug } = await params;
  const baseConfig = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!baseConfig) {
    return notFound();
  }

  const config = await getCatalogCollectionLandingPageConfigWithPresentation({
    config: baseConfig,
  });

  if (config.redirectPath) {
    permanentRedirect(config.redirectPath);
  }

  if (`/${collectionSlug}` !== config.canonicalPath) {
    permanentRedirect(config.canonicalPath);
  }

  const resolvedSearchParams = await searchParams;
  const sortKey = normalizeCatalogCollectionLandingPageSortKey({
    config,
    value: readSearchParam(resolvedSearchParams?.sort),
  });
  const currentPage = normalizeCollectionPageNumber(
    readSearchParam(resolvedSearchParams?.page),
  );
  const collectionPage = await getCachedSerializableCollectionLandingPage({
    config,
    limit: COLLECTION_LANDING_PAGE_SIZE,
    offset: (currentPage - 1) * COLLECTION_LANDING_PAGE_SIZE,
    sortKey,
  });

  const pageCount = Math.max(
    1,
    Math.ceil(collectionPage.totalSetCount / COLLECTION_LANDING_PAGE_SIZE),
  );

  if (currentPage > pageCount) {
    console.warn('[collection-page] known collection page exceeds page count', {
      canonical_path: config.canonicalPath,
      collection_slug: config.slug,
      current_page: currentPage,
      page_count: pageCount,
      total_set_count: collectionPage.totalSetCount,
    });
  }

  const canonicalUrl = buildCanonicalUrl(
    buildCollectionCanonicalPath({ config, page: currentPage }),
    {
      allowedSearchParams: ['page'],
    },
  );
  const jsonLd = [
    buildCollectionPageJsonLd({
      description: config.metaDescription,
      name: config.metaTitle,
      url: canonicalUrl,
    }),
    buildBreadcrumbListJsonLd([
      {
        name: 'Brickhunt',
        url: buildCanonicalUrl('/'),
      },
      {
        name: config.h1,
        url: canonicalUrl,
      },
    ]),
  ];
  const setCards = collectionPage.setCards.map((setCard) => {
    const bestPriceMinor = collectionPage.bestPriceMinorBySetId[setCard.id];
    const priceContext = buildBrowseSetCardPriceContext({
      priceMinor: bestPriceMinor,
    });

    return {
      ...setCard,
      actions: (
        <WishlistFeatureWishlistToggle
          analyticsContext={{
            pageSurface: 'collection_page',
            sectionId: config.slug,
            setId: setCard.id,
            theme: setCard.theme,
          }}
          productIntent={priceContext ? 'price-alert' : 'wishlist'}
          setId={setCard.id}
          variant="inline"
        />
      ),
      ...(priceContext
        ? {
            priceContext,
          }
        : {}),
    };
  });

  return (
    <ShellWeb>
      <JsonLdScript data={jsonLd} />
      <CatalogFeatureCollectionLandingPage
        activeSortKey={sortKey}
        config={config}
        currentPage={currentPage}
        pageSize={COLLECTION_LANDING_PAGE_SIZE}
        relatedPageLinks={getRelatedCollectionLandingPageLinks(config)}
        setCards={setCards}
        themeLinks={config.links.themes}
        totalSetCount={collectionPage.totalSetCount}
      />
    </ShellWeb>
  );
}
