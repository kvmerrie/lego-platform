const CACHE_TAG_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,127}$/;
const unsafeTagCharactersPattern = /[^a-z0-9:_-]+/g;
const repeatedSeparatorPattern = /[:-]{2,}/g;

function normalizeCacheTagSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(unsafeTagCharactersPattern, '-')
    .replace(repeatedSeparatorPattern, '-')
    .replace(/^[-:_]+|[-:_]+$/g, '');
}

function buildScopedTag(scope: string, value: string): string {
  const normalizedValue = normalizeCacheTagSegment(value);

  return normalizedValue ? `${scope}:${normalizedValue}` : scope;
}

export function isValidCacheTag(tag: string): boolean {
  return CACHE_TAG_PATTERN.test(tag);
}

export function normalizeCacheTag(tag: string): string | undefined {
  const normalizedTag = normalizeCacheTagSegment(tag);

  return isValidCacheTag(normalizedTag) ? normalizedTag : undefined;
}

export function normalizeCacheTags(tags: readonly string[]): string[] {
  return [
    ...new Set(
      tags.map(normalizeCacheTag).filter((tag): tag is string => Boolean(tag)),
    ),
  ];
}

export const cacheTags = {
  sets: () => 'sets',
  set: (setNumberOrSlug: string) => buildScopedTag('set', setNumberOrSlug),
  themes: () => 'themes',
  theme: (themeSlug: string) => buildScopedTag('theme', themeSlug),
  merchants: () => 'merchants',
  merchant: (merchantSlug: string) => buildScopedTag('merchant', merchantSlug),
  merchantProducts: (merchantSlug: string) =>
    buildScopedTag('merchant-products', merchantSlug),
  prices: () => 'prices',
  pricesForMerchant: (merchantSlug: string) =>
    buildScopedTag('prices', merchantSlug),
  news: () => 'news',
  newsArticle: (articleSlug: string) => buildScopedTag('news', articleSlug),
  homepage: () => 'homepage',
  deals: () => 'deals',
  sitemap: () => 'sitemap',
  searchIndex: () => 'search-index',
} as const;

export function buildMerchantRevalidationTags({
  affectsHomepage = false,
  affectsSitemap = false,
  includeGlobalPrices,
  merchantSlug,
  setNumbersOrSlugs = [],
}: {
  affectsHomepage?: boolean;
  affectsSitemap?: boolean;
  includeGlobalPrices?: boolean;
  merchantSlug: string;
  setNumbersOrSlugs?: readonly string[];
}): string[] {
  const shouldIncludeGlobalPrices =
    includeGlobalPrices ?? setNumbersOrSlugs.length === 0;

  return normalizeCacheTags([
    cacheTags.merchant(merchantSlug),
    cacheTags.merchantProducts(merchantSlug),
    ...(shouldIncludeGlobalPrices ? [cacheTags.prices()] : []),
    cacheTags.pricesForMerchant(merchantSlug),
    ...setNumbersOrSlugs.map((setNumberOrSlug) =>
      cacheTags.set(setNumberOrSlug),
    ),
    ...(affectsHomepage ? [cacheTags.homepage()] : []),
    ...(affectsSitemap ? [cacheTags.sitemap()] : []),
  ]);
}

export function buildCatalogSetRevalidationTags({
  affectsHomepage = false,
  affectsSearchIndex = false,
  affectsSitemap = false,
  setNumberOrSlug,
  themeSlug,
}: {
  affectsHomepage?: boolean;
  affectsSearchIndex?: boolean;
  affectsSitemap?: boolean;
  setNumberOrSlug: string;
  themeSlug?: string;
}): string[] {
  return normalizeCacheTags([
    cacheTags.sets(),
    cacheTags.set(setNumberOrSlug),
    ...(themeSlug ? [cacheTags.theme(themeSlug)] : []),
    ...(affectsHomepage ? [cacheTags.homepage()] : []),
    ...(affectsSitemap ? [cacheTags.sitemap()] : []),
    ...(affectsSearchIndex ? [cacheTags.searchIndex()] : []),
  ]);
}

export function buildThemeRevalidationTags({
  affectsHomepage = false,
  affectsSitemap = false,
  themeSlug,
}: {
  affectsHomepage?: boolean;
  affectsSitemap?: boolean;
  themeSlug: string;
}): string[] {
  return normalizeCacheTags([
    cacheTags.themes(),
    cacheTags.theme(themeSlug),
    ...(affectsHomepage ? [cacheTags.homepage()] : []),
    ...(affectsSitemap ? [cacheTags.sitemap()] : []),
  ]);
}

export function buildNewsRevalidationTags({
  affectsHomepage = false,
  affectsSitemap = false,
  articleSlug,
}: {
  affectsHomepage?: boolean;
  affectsSitemap?: boolean;
  articleSlug: string;
}): string[] {
  return normalizeCacheTags([
    cacheTags.news(),
    cacheTags.newsArticle(articleSlug),
    ...(affectsHomepage ? [cacheTags.homepage()] : []),
    ...(affectsSitemap ? [cacheTags.sitemap()] : []),
  ]);
}
