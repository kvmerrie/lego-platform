import {
  listCatalogSetSlugs,
  listCatalogThemePageSlugs,
  getCatalogThemePageBySlug,
} from '@lego-platform/catalog/data-access-web';
import {
  listIndexableCatalogCollectionLandingPageConfigs,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import {
  getEditorialPageBySlug,
  listEditorialPageSlugs,
  listPublishedArticles,
} from '@lego-platform/content/data-access';
import {
  buildArticlePath,
  buildArticleThemePath,
  buildCanonicalUrl,
  buildSetDetailPath,
  buildThemePath,
  buildWebPath,
  hasPublicArticleContent,
  isIndexableSetDetailPage,
  isIndexablePage,
  publicSiteRobotsPolicy,
  webPathnames,
} from '@lego-platform/shared/config';

export interface SitemapUrlEntry {
  lastModified?: Date | string;
  url: string;
}

export interface SitemapCollectorOptions {
  allowIndexing?: boolean;
}

interface SitemapEntryInput {
  isThin?: boolean;
  lastModified?: Date | string;
  pageRobotsNoIndex?: boolean;
  paginationIntended?: boolean;
  pathname: string;
  seoNoIndex?: boolean;
}

interface SitemapDataAccess {
  getCatalogThemePageBySlug: typeof getCatalogThemePageBySlug;
  getEditorialPageBySlug: typeof getEditorialPageBySlug;
  listCatalogSetSlugs: typeof listCatalogSetSlugs;
  listCatalogThemePageSlugs: typeof listCatalogThemePageSlugs;
  listEditorialPageSlugs: typeof listEditorialPageSlugs;
  listPublishedArticles: typeof listPublishedArticles;
}

const sitemapDataAccess: SitemapDataAccess = {
  getCatalogThemePageBySlug,
  getEditorialPageBySlug,
  listCatalogSetSlugs,
  listCatalogThemePageSlugs,
  listEditorialPageSlugs,
  listPublishedArticles,
};

const legacyEditorialPageSlugsExcludedFromSitemap = new Set(['about']);

export const sitemapSegmentPaths = [
  '/sitemaps/sets.xml',
  '/sitemaps/themes.xml',
  '/sitemaps/deals.xml',
] as const;

function getAllowIndexing(allowIndexing?: boolean): boolean {
  return allowIndexing ?? publicSiteRobotsPolicy.allowIndexing;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function formatLastModified(lastModified: Date | string): string {
  return lastModified instanceof Date
    ? lastModified.toISOString()
    : new Date(lastModified).toISOString();
}

export function createSitemapUrlEntry({
  allowIndexing,
  isThin,
  lastModified,
  pageRobotsNoIndex,
  paginationIntended,
  pathname,
  seoNoIndex,
}: SitemapEntryInput & SitemapCollectorOptions): SitemapUrlEntry | undefined {
  if (
    !isIndexablePage({
      allowIndexing: getAllowIndexing(allowIndexing),
      isThin,
      pageRobotsNoIndex,
      paginationIntended,
      pathname,
      seoNoIndex,
    })
  ) {
    return undefined;
  }

  return {
    ...(lastModified ? { lastModified } : {}),
    url: buildCanonicalUrl(pathname, {
      allowedSearchParams: paginationIntended ? ['page'] : [],
    }),
  };
}

function uniqueSitemapEntries(
  entries: readonly (SitemapUrlEntry | undefined)[],
): SitemapUrlEntry[] {
  const entryByUrl = new Map<string, SitemapUrlEntry>();

  for (const entry of entries) {
    if (entry && !entryByUrl.has(entry.url)) {
      entryByUrl.set(entry.url, entry);
    }
  }

  return [...entryByUrl.values()];
}

export function buildSitemapIndexXml(
  entries: readonly SitemapUrlEntry[],
): string {
  const sitemapNodes = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(formatLastModified(entry.lastModified))}</lastmod>`
        : '';

      return `<sitemap><loc>${escapeXml(entry.url)}</loc>${lastModified}</sitemap>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapNodes}</sitemapindex>`;
}

export function buildUrlSetXml(entries: readonly SitemapUrlEntry[]): string {
  const urlNodes = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(formatLastModified(entry.lastModified))}</lastmod>`
        : '';

      return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified}</url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlNodes}</urlset>`;
}

export function createXmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  });
}

export function buildSitemapIndexEntries({
  allowIndexing,
}: SitemapCollectorOptions = {}): SitemapUrlEntry[] {
  if (!getAllowIndexing(allowIndexing)) {
    return [];
  }

  return sitemapSegmentPaths.map((pathname) => ({
    url: buildCanonicalUrl(pathname),
  }));
}

export async function collectSitemapIndexEntries({
  allowIndexing,
  dataAccess = sitemapDataAccess,
}: SitemapCollectorOptions & {
  dataAccess?: Pick<SitemapDataAccess, 'listPublishedArticles'>;
} = {}): Promise<SitemapUrlEntry[]> {
  const baseEntries = buildSitemapIndexEntries({ allowIndexing });

  if (!baseEntries.length) {
    return [];
  }

  const articles = await dataAccess.listPublishedArticles({
    limit: 5,
  });

  if (!hasPublicArticleContent(articles.length)) {
    return baseEntries;
  }

  return [
    baseEntries[0],
    {
      url: buildCanonicalUrl('/sitemaps/articles.xml'),
    },
    ...baseEntries.slice(1),
  ].filter((entry): entry is SitemapUrlEntry => Boolean(entry));
}

export async function collectSetSitemapEntries({
  allowIndexing,
  dataAccess = sitemapDataAccess,
}: SitemapCollectorOptions & {
  dataAccess?: Pick<SitemapDataAccess, 'listCatalogSetSlugs'>;
} = {}): Promise<SitemapUrlEntry[]> {
  if (!getAllowIndexing(allowIndexing)) {
    return [];
  }

  const slugs = await dataAccess.listCatalogSetSlugs();

  return uniqueSitemapEntries(
    slugs.map((slug) =>
      isIndexableSetDetailPage({
        allowIndexing: getAllowIndexing(allowIndexing),
        slug,
      })
        ? createSitemapUrlEntry({
            allowIndexing,
            pathname: buildSetDetailPath(slug),
          })
        : undefined,
    ),
  );
}

export async function collectArticleSitemapEntries({
  allowIndexing,
  dataAccess = sitemapDataAccess,
}: SitemapCollectorOptions & {
  dataAccess?: Pick<SitemapDataAccess, 'listPublishedArticles'>;
} = {}): Promise<SitemapUrlEntry[]> {
  if (!getAllowIndexing(allowIndexing)) {
    return [];
  }

  const articles = await dataAccess.listPublishedArticles();
  const hasEnoughArticlesForIndexPages = hasPublicArticleContent(
    articles.length,
  );
  const themeSlugs = new Set(
    articles.flatMap((article) => {
      const themeSlug = normalizeTheme(article.theme)?.key;

      return themeSlug ? [themeSlug] : [];
    }),
  );

  return uniqueSitemapEntries([
    ...(hasEnoughArticlesForIndexPages
      ? [
          createSitemapUrlEntry({
            allowIndexing,
            pathname: buildWebPath(webPathnames.articles),
          }),
          ...[...themeSlugs].map((themeSlug) =>
            createSitemapUrlEntry({
              allowIndexing,
              pathname: buildArticleThemePath(themeSlug),
            }),
          ),
        ]
      : []),
    ...articles.map((article) => {
      const themeSlug = normalizeTheme(article.theme)?.key;

      return themeSlug
        ? createSitemapUrlEntry({
            allowIndexing,
            lastModified: article.updatedAt ?? article.date,
            pathname: buildArticlePath(article.slug, themeSlug),
          })
        : undefined;
    }),
  ]);
}

export async function collectThemeSitemapEntries({
  allowIndexing,
  dataAccess = sitemapDataAccess,
}: SitemapCollectorOptions & {
  dataAccess?: Pick<
    SitemapDataAccess,
    'getCatalogThemePageBySlug' | 'listCatalogThemePageSlugs'
  >;
} = {}): Promise<SitemapUrlEntry[]> {
  if (!getAllowIndexing(allowIndexing)) {
    return [];
  }

  const slugs = await dataAccess.listCatalogThemePageSlugs();
  const themePages = await Promise.all(
    slugs.map(async (slug) => ({
      page: await dataAccess.getCatalogThemePageBySlug({ slug }),
      slug,
    })),
  );

  return uniqueSitemapEntries([
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.themes),
    }),
    ...themePages.map(({ page, slug }) =>
      createSitemapUrlEntry({
        allowIndexing,
        isThin: !page?.setCards.length,
        pathname: buildThemePath(slug),
      }),
    ),
  ]);
}

export async function collectDealsSitemapEntries({
  allowIndexing,
  dataAccess = sitemapDataAccess,
}: SitemapCollectorOptions & {
  dataAccess?: Pick<
    SitemapDataAccess,
    'getEditorialPageBySlug' | 'listEditorialPageSlugs'
  >;
} = {}): Promise<SitemapUrlEntry[]> {
  if (!getAllowIndexing(allowIndexing)) {
    return [];
  }

  const editorialPageSlugs = await dataAccess.listEditorialPageSlugs({
    mode: 'delivery',
  });
  const editorialPages = await Promise.all(
    editorialPageSlugs.map((slug) =>
      dataAccess.getEditorialPageBySlug(slug, {
        mode: 'delivery',
      }),
    ),
  );

  return uniqueSitemapEntries([
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.home),
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.deals),
    }),
    ...listIndexableCatalogCollectionLandingPageConfigs().map((config) =>
      createSitemapUrlEntry({
        allowIndexing,
        pathname: config.canonicalPath,
      }),
    ),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: '/hoe-werkt-het',
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: '/over-brickhunt',
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.contact),
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.privacy),
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.cookiePolicy),
    }),
    createSitemapUrlEntry({
      allowIndexing,
      pathname: buildWebPath(webPathnames.affiliateDisclosure),
    }),
    ...editorialPages.map((editorialPage) =>
      editorialPage?.slug &&
      !legacyEditorialPageSlugsExcludedFromSitemap.has(editorialPage.slug)
        ? createSitemapUrlEntry({
            allowIndexing,
            pathname: buildWebPath(
              `${webPathnames.pages}/${editorialPage.slug}`,
            ),
            seoNoIndex: editorialPage.seo.noIndex,
          })
        : undefined,
    ),
  ]);
}
