import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import React from 'react';
import {
  getCatalogCollectionLandingPage,
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

function getCollectionSnapshotMaxAgeMs(
  config: CatalogCollectionLandingPageConfig,
): number {
  return config.slug === 'lego-sets-onder-50-euro'
    ? PRICE_SNAPSHOT_PAGE_MAX_AGE_MS
    : COLLECTION_PAGE_SNAPSHOT_MAX_AGE_MS;
}

function logUnsafeCollectionSnapshot({
  config,
  generatedAt,
  health,
  limit,
  offset,
  sortKey,
}: {
  config: CatalogCollectionLandingPageConfig;
  generatedAt?: string | null;
  health: 'missing' | 'stale';
  limit: number;
  offset: number;
  sortKey: CatalogCollectionLandingPageSortKey;
}): void {
  console.warn('[collection-page-snapshot] unsafe page render blocked', {
    collection_slug: config.slug,
    generated_at: generatedAt ?? null,
    health,
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
}): Promise<SerializableCollectionLandingPageResult | null> {
  const tags = buildPublicBrowseCollectionCacheTags({
    collectionSlug: config.slug,
  });

  return getCachedPublicBrowsePageData({
    load: async () => {
      const collectionPage = isCatalogCollectionPageSnapshotSlug(config.slug)
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
              logUnsafeCollectionSnapshot({
                config,
                generatedAt: snapshot?.snapshotGeneratedAt,
                health,
                limit,
                offset,
                sortKey,
              });

              return null;
            }

            return snapshot;
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

      return collectionPage
        ? toSerializableCollectionLandingPageResult(collectionPage)
        : null;
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
  return listCatalogCollectionLandingPageConfigs().map((config) => ({
    collectionSlug: config.slug,
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
  const config = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!config) {
    return {};
  }

  const currentPage = normalizeCollectionPageNumber(
    readSearchParam(resolvedSearchParams?.page),
  );
  const canonicalPath = buildCollectionCanonicalPath({
    config,
    page: currentPage,
  });
  const canonicalUrl = buildCanonicalUrl(canonicalPath);

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
  const config = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!config) {
    return notFound();
  }

  if (config.redirectPath) {
    permanentRedirect(config.redirectPath);
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

  if (!collectionPage) {
    return notFound();
  }

  const pageCount = Math.max(
    1,
    Math.ceil(collectionPage.totalSetCount / COLLECTION_LANDING_PAGE_SIZE),
  );

  if (currentPage > pageCount) {
    return notFound();
  }

  const canonicalUrl = buildCanonicalUrl(
    buildCollectionCanonicalPath({ config, page: currentPage }),
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
