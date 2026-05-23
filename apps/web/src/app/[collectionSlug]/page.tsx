import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCatalogCollectionLandingPage } from '@lego-platform/catalog/data-access-web';
import { CatalogFeatureCollectionLandingPage } from '@lego-platform/catalog/feature-collection-landing';
import {
  getCatalogCollectionLandingPageConfig,
  listCatalogCollectionLandingPageConfigs,
  normalizeCatalogCollectionLandingPageSortKey,
  type CatalogCollectionLandingPageConfig,
} from '@lego-platform/catalog/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { buildCanonicalUrl, cacheTags } from '@lego-platform/shared/config';
import { JsonLdScript } from '../lib/json-ld';
import {
  buildBreadcrumbListJsonLd,
  buildCollectionPageJsonLd,
} from '../lib/structured-data';

export const dynamicParams = false;
export const revalidate = 21_600;

const COLLECTION_LANDING_PAGE_SIZE = 36;

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatCollectionPrice(minorUnits: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    style: 'currency',
  }).format(minorUnits / 100);
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
}: {
  params: Promise<{ collectionSlug: string }>;
}): Promise<Metadata> {
  const { collectionSlug } = await params;
  const config = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!config) {
    return {};
  }

  const canonicalUrl = buildCanonicalUrl(config.canonicalPath);

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
  searchParams?: Promise<{ sort?: string | string[] }>;
}) {
  const { collectionSlug } = await params;
  const config = getCatalogCollectionLandingPageConfig(collectionSlug);

  if (!config) {
    notFound();
  }

  if (config.redirectPath) {
    permanentRedirect(config.redirectPath);
  }

  const resolvedSearchParams = await searchParams;
  const sortKey = normalizeCatalogCollectionLandingPageSortKey({
    config,
    value: readSearchParam(resolvedSearchParams?.sort),
  });
  const collectionPage = await getCatalogCollectionLandingPage({
    cacheOptions: {
      revalidateSeconds: revalidate,
      tags: [
        cacheTags.catalog(),
        cacheTags.sets(),
        cacheTags.prices(),
        cacheTags.deals(),
      ],
    },
    config,
    limit: COLLECTION_LANDING_PAGE_SIZE,
    sortKey,
  });
  const canonicalUrl = buildCanonicalUrl(config.canonicalPath);
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
    const bestPriceMinor = collectionPage.bestPriceMinorBySetId.get(setCard.id);

    return {
      ...setCard,
      ...(bestPriceMinor
        ? {
            priceContext: {
              coverageLabel: 'Actuele prijs gevonden',
              currentPrice: `Vanaf ${formatCollectionPrice(bestPriceMinor)}`,
              merchantLabel: 'Laagste bekende prijs',
              reviewedLabel: 'Server-side bijgewerkt',
            },
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
        relatedPageLinks={getRelatedCollectionLandingPageLinks(config)}
        setCards={setCards}
        themeLinks={config.links.themes}
        totalSetCount={collectionPage.totalSetCount}
      />
    </ShellWeb>
  );
}
