import type { CatalogSetDetail } from '@lego-platform/catalog/util';
import type {
  CatalogSetReview,
  CatalogSetReviewSummary,
} from '@lego-platform/reviews/util';
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
  resolvePublicMerchantDisplayName,
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
  merchantSlug?: string;
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

function getCatalogSetStructuredDataName(
  catalogSetDetail: Pick<CatalogSetDetail, 'displayTitle' | 'name'>,
): string {
  return catalogSetDetail.displayTitle?.trim() || catalogSetDetail.name;
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
      name: resolvePublicMerchantDisplayName({
        merchantName: offer.merchantName,
        merchantSlug: offer.merchantSlug,
      }),
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
  reviews = [],
  reviewSummary,
}: {
  canonicalUrl?: string;
  catalogSetDetail: CatalogSetDetail;
  offers?: readonly StructuredDataOffer[];
  reviews?: readonly CatalogSetReview[];
  reviewSummary?: CatalogSetReviewSummary;
}): JsonLdValue | undefined {
  const offerSchemas = offers.flatMap((offer) => {
    const offerSchema = toOfferSchema(offer);

    return offerSchema ? [offerSchema] : [];
  });
  const prices = offers
    .map((offer) => offer.priceCents)
    .filter((priceCents) => priceCents > 0);

  const hasApprovedReviews =
    reviewSummary &&
    reviewSummary.reviewCount > 0 &&
    typeof reviewSummary.averageRating === 'number';

  if (!offerSchemas.length && !hasApprovedReviews) {
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
    ...(hasApprovedReviews
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            bestRating: 5,
            ratingValue: reviewSummary.averageRating,
            reviewCount: reviewSummary.reviewCount,
            worstRating: 1,
          },
          ...(reviews.length > 0
            ? {
                review: reviews.map((review) => ({
                  '@type': 'Review',
                  author: {
                    '@type': 'Person',
                    name: review.authorDisplayName,
                  },
                  datePublished: review.createdAt,
                  ...(review.reviewText
                    ? { reviewBody: review.reviewText }
                    : {}),
                  reviewRating: {
                    '@type': 'Rating',
                    bestRating: 5,
                    ratingValue: review.overallRating,
                    worstRating: 1,
                  },
                })),
              }
            : {}),
        }
      : {}),
    mpn: catalogSetDetail.id,
    name: getCatalogSetStructuredDataName(catalogSetDetail),
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
      name: getCatalogSetStructuredDataName(catalogSetDetail),
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
