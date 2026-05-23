import type { CatalogSetDetail } from '@lego-platform/catalog/util';
import type {
  ContentArticle,
  ContentArticleListItem,
} from '@lego-platform/content/util';
import {
  buildArticlePath,
  buildCanonicalUrl,
  buildSetDetailPath,
  buildThemePath,
  buildWebPath,
  platformConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import type { JsonLdValue } from './json-ld';

export interface BreadcrumbListItem {
  name: string;
  url?: string;
}

interface StructuredDataOffer {
  availability:
    | 'in_stock'
    | 'limited'
    | 'out_of_stock'
    | 'preorder'
    | 'unknown';
  currency: string;
  merchantName: string;
  priceCents: number;
  url: string;
}

function toAbsoluteImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) {
    return undefined;
  }

  return new URL(imageUrl, buildCanonicalUrl('/')).toString();
}

function toSchemaPrice(priceCents?: number): number | undefined {
  return typeof priceCents === 'number' && priceCents > 0
    ? Number((priceCents / 100).toFixed(2))
    : undefined;
}

function toSchemaAvailability(
  availability?: StructuredDataOffer['availability'],
): string | undefined {
  if (availability === 'in_stock' || availability === 'limited') {
    return 'https://schema.org/InStock';
  }

  if (availability === 'out_of_stock') {
    return 'https://schema.org/OutOfStock';
  }

  if (availability === 'preorder') {
    return 'https://schema.org/PreOrder';
  }

  return undefined;
}

function toSetDescription(catalogSetDetail: CatalogSetDetail): string {
  const descriptionParts = [
    `LEGO ${catalogSetDetail.theme}-set`,
    catalogSetDetail.releaseYear
      ? `uit ${catalogSetDetail.releaseYear}`
      : undefined,
    catalogSetDetail.pieces > 0
      ? `met ${catalogSetDetail.pieces} stenen`
      : undefined,
  ].filter(Boolean);

  return catalogSetDetail.tagline ?? `${descriptionParts.join(' ')}.`;
}

function toOfferSchema(offer: StructuredDataOffer): JsonLdValue | undefined {
  const price = toSchemaPrice(offer.priceCents);

  if (!price) {
    return undefined;
  }

  return {
    '@type': 'Offer',
    availability: toSchemaAvailability(offer.availability),
    price,
    priceCurrency: offer.currency,
    seller: {
      '@type': 'Organization',
      name: offer.merchantName,
    },
    url: offer.url,
  };
}

export function buildBreadcrumbListJsonLd(
  items: readonly BreadcrumbListItem[],
): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  };
}

export function buildSetProductJsonLd({
  catalogSetDetail,
  canonicalUrl = buildCanonicalUrl(buildSetDetailPath(catalogSetDetail.slug)),
  offers = [],
}: {
  canonicalUrl?: string;
  catalogSetDetail: CatalogSetDetail;
  offers?: readonly StructuredDataOffer[];
}): JsonLdValue | undefined {
  const offerSchemas = offers.flatMap((offer) => {
    const offerSchema = toOfferSchema(offer);

    return offerSchema ? [offerSchema] : [];
  });
  const prices = offers
    .map((offer) => offer.priceCents)
    .filter((priceCents) => priceCents > 0);

  if (!offerSchemas.length) {
    return undefined;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    offers:
      offerSchemas.length > 1 && prices.length
        ? {
            '@type': 'AggregateOffer',
            highPrice: toSchemaPrice(Math.max(...prices)),
            lowPrice: toSchemaPrice(Math.min(...prices)),
            offerCount: offerSchemas.length,
            offers: offerSchemas,
            priceCurrency: offers.find((offer) => offer.priceCents > 0)
              ?.currency,
          }
        : offerSchemas[0],
    brand: {
      '@type': 'Brand',
      name: 'LEGO',
    },
    description: toSetDescription(catalogSetDetail),
    image: toAbsoluteImageUrl(
      catalogSetDetail.primaryImage ?? catalogSetDetail.imageUrl,
    ),
    mpn: catalogSetDetail.id,
    name: catalogSetDetail.name,
    sku: catalogSetDetail.id,
    url: canonicalUrl,
  };
}

export function buildArticleNewsJsonLd({
  canonicalUrl,
  contentArticle,
}: {
  canonicalUrl: string;
  contentArticle: ContentArticle | ContentArticleListItem;
}): JsonLdValue {
  const imageUrl = toAbsoluteImageUrl(
    contentArticle.heroImage ?? contentArticle.cardImage,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    author: {
      '@type': 'Organization',
      name: platformConfig.productName,
    },
    dateModified: contentArticle.updatedAt ?? contentArticle.date,
    datePublished: contentArticle.date,
    description: contentArticle.description,
    headline: contentArticle.title,
    image: imageUrl ? [imageUrl] : undefined,
    mainEntityOfPage: {
      '@id': canonicalUrl,
      '@type': 'WebPage',
    },
    publisher: {
      '@type': 'Organization',
      name: platformConfig.productName,
    },
  };
}

export function buildCollectionPageJsonLd({
  description,
  name,
  url,
}: {
  description?: string;
  name: string;
  url: string;
}): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: platformConfig.productName,
      url: buildCanonicalUrl(buildWebPath(webPathnames.home)),
    },
    name,
    url,
  };
}

export function buildArticleBreadcrumbJsonLd({
  articleTitle,
  articleUrl,
  themeName,
  themeUrl,
}: {
  articleTitle: string;
  articleUrl: string;
  themeName?: string;
  themeUrl?: string;
}): JsonLdValue {
  return buildBreadcrumbListJsonLd([
    {
      name: 'Artikelen',
      url: buildCanonicalUrl(buildWebPath(webPathnames.articles)),
    },
    ...(themeName && themeUrl
      ? [
          {
            name: themeName,
            url: buildCanonicalUrl(themeUrl),
          },
        ]
      : []),
    {
      name: articleTitle,
      url: articleUrl,
    },
  ]);
}

export function buildSetBreadcrumbJsonLd({
  catalogSetDetail,
  themeUrl,
}: {
  catalogSetDetail: CatalogSetDetail;
  themeUrl?: string;
}): JsonLdValue {
  return buildBreadcrumbListJsonLd([
    {
      name: "Thema's",
      url: buildCanonicalUrl(buildWebPath(webPathnames.themes)),
    },
    ...(themeUrl
      ? [
          {
            name: catalogSetDetail.publicTheme?.name ?? catalogSetDetail.theme,
            url: buildCanonicalUrl(themeUrl),
          },
        ]
      : []),
    {
      name: catalogSetDetail.name,
      url: buildCanonicalUrl(buildSetDetailPath(catalogSetDetail.slug)),
    },
  ]);
}

export function buildThemeBreadcrumbJsonLd({
  themeName,
  themeUrl,
}: {
  themeName: string;
  themeUrl: string;
}): JsonLdValue {
  return buildBreadcrumbListJsonLd([
    {
      name: "Thema's",
      url: buildCanonicalUrl(buildWebPath(webPathnames.themes)),
    },
    {
      name: themeName,
      url: buildCanonicalUrl(themeUrl),
    },
  ]);
}

export function buildArticleCanonicalUrl(slug: string, theme: string): string {
  return buildCanonicalUrl(buildArticlePath(slug, theme));
}

export function buildThemeCanonicalUrl(slug: string): string {
  return buildCanonicalUrl(buildThemePath(slug));
}
