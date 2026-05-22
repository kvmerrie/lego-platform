import { describe, expect, it, vi } from 'vitest';
import {
  buildSitemapIndexEntries,
  buildSitemapIndexXml,
  buildUrlSetXml,
  collectArticleSitemapEntries,
  collectDealsSitemapEntries,
  collectSetSitemapEntries,
  collectSitemapIndexEntries,
  collectThemeSitemapEntries,
  createSitemapUrlEntry,
} from './sitemap-builder';

describe('sitemap generation', () => {
  it('returns no-op sitemap output before launch', async () => {
    expect(buildSitemapIndexEntries()).toEqual([]);
    expect(buildSitemapIndexXml([])).toContain('<sitemapindex');
    expect(buildSitemapIndexXml([])).not.toContain('<sitemap><loc>');
    expect(await collectSetSitemapEntries()).toEqual([]);
    expect(await collectArticleSitemapEntries()).toEqual([]);
    expect(await collectThemeSitemapEntries()).toEqual([]);
    expect(await collectDealsSitemapEntries()).toEqual([]);
    expect(buildUrlSetXml([])).toContain('<urlset');
    expect(buildUrlSetXml([])).not.toContain('<url><loc>');
  });

  it('includes sitemap segment URLs when launch indexing is enabled', () => {
    const entries = buildSitemapIndexEntries({
      allowIndexing: true,
    });

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://www.brickhunt.nl/sitemaps/sets.xml',
      'https://www.brickhunt.nl/sitemaps/themes.xml',
      'https://www.brickhunt.nl/sitemaps/deals.xml',
    ]);
    expect(buildSitemapIndexXml(entries)).toContain(
      '<loc>https://www.brickhunt.nl/sitemaps/sets.xml</loc>',
    );
  });

  it('adds the article sitemap to the sitemap index only once enough public article content exists', async () => {
    await expect(
      collectSitemapIndexEntries({
        allowIndexing: true,
        dataAccess: {
          listPublishedArticles: vi.fn().mockResolvedValue(
            Array.from({ length: 4 }, (_, index) => ({
              date: `2026-05-0${index + 1}`,
              description: 'Star Wars artikel',
              heroImageAlt: 'Grogu',
              slug: `star-wars-day-2026-${index + 1}`,
              status: 'published',
              theme: 'Star Wars',
              title: `Star Wars Day 2026 ${index + 1}`,
            })),
          ),
        },
      }),
    ).resolves.toEqual([
      {
        url: 'https://www.brickhunt.nl/sitemaps/sets.xml',
      },
      {
        url: 'https://www.brickhunt.nl/sitemaps/themes.xml',
      },
      {
        url: 'https://www.brickhunt.nl/sitemaps/deals.xml',
      },
    ]);

    await expect(
      collectSitemapIndexEntries({
        allowIndexing: true,
        dataAccess: {
          listPublishedArticles: vi.fn().mockResolvedValue(
            Array.from({ length: 5 }, (_, index) => ({
              date: `2026-05-0${index + 1}`,
              description: 'Star Wars artikel',
              heroImageAlt: 'Grogu',
              slug: `star-wars-day-2026-${index + 1}`,
              status: 'published',
              theme: 'Star Wars',
              title: `Star Wars Day 2026 ${index + 1}`,
            })),
          ),
        },
      }),
    ).resolves.toEqual([
      {
        url: 'https://www.brickhunt.nl/sitemaps/sets.xml',
      },
      {
        url: 'https://www.brickhunt.nl/sitemaps/articles.xml',
      },
      {
        url: 'https://www.brickhunt.nl/sitemaps/themes.xml',
      },
      {
        url: 'https://www.brickhunt.nl/sitemaps/deals.xml',
      },
    ]);
  });

  it('keeps the set sitemap empty while launch indexing is disabled', async () => {
    await expect(
      collectSetSitemapEntries({
        allowIndexing: false,
        dataAccess: {
          listCatalogSetSlugs: vi
            .fn()
            .mockResolvedValue(['lord-of-the-rings-rivendell-10316']),
        },
      }),
    ).resolves.toEqual([]);
  });

  it('includes valid set canonical URLs when launch indexing is enabled', async () => {
    const entries = await collectSetSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        listCatalogSetSlugs: vi
          .fn()
          .mockResolvedValue(['lord-of-the-rings-rivendell-10316']),
      },
    });

    expect(entries).toEqual([
      {
        url: 'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
      },
    ]);
    expect(buildUrlSetXml(entries)).toContain(
      '<loc>https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316</loc>',
    );
  });

  it('excludes non-catalog merchandise and ISBN-like rows from the set sitemap', async () => {
    const entries = await collectSetSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        listCatalogSetSlugs: vi
          .fn()
          .mockResolvedValue([
            'lord-of-the-rings-rivendell-10316',
            'dk-super-readers-level-1-ninjago-go-team-ninja-9780241838389',
            '2026-u-s-soccer-national-team-jersey-43033',
            'the-shire-book-nook-10354',
          ]),
      },
    });

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
      'https://www.brickhunt.nl/sets/the-shire-book-nook-10354',
    ]);
  });

  it('keeps thin article index pages out of the article sitemap while preserving article detail URLs', async () => {
    const entries = await collectArticleSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        listPublishedArticles: vi.fn().mockResolvedValue([
          {
            date: '2026-05-01',
            description: 'Star Wars artikel',
            heroImageAlt: 'Grogu',
            slug: 'star-wars-day-2026',
            status: 'published',
            theme: 'Star Wars',
            title: 'Star Wars Day 2026',
            updatedAt: '2026-05-02T10:00:00.000Z',
          },
          {
            date: '2026-05-03',
            description: 'Artikel zonder thema',
            heroImageAlt: 'Set',
            slug: 'zonder-thema',
            status: 'published',
            title: 'Zonder thema',
          },
        ]),
      },
    });

    expect(entries).toEqual([
      {
        lastModified: '2026-05-02T10:00:00.000Z',
        url: 'https://www.brickhunt.nl/artikelen/star-wars/star-wars-day-2026',
      },
    ]);
  });

  it('includes article index pages once enough public article content exists', async () => {
    const entries = await collectArticleSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        listPublishedArticles: vi.fn().mockResolvedValue(
          Array.from({ length: 5 }, (_, index) => ({
            date: `2026-05-0${index + 1}`,
            description: 'Star Wars artikel',
            heroImageAlt: 'Grogu',
            slug: `star-wars-day-2026-${index + 1}`,
            status: 'published',
            theme: 'Star Wars',
            title: `Star Wars Day 2026 ${index + 1}`,
          })),
        ),
      },
    });

    expect(entries.map((entry) => entry.url)).toContain(
      'https://www.brickhunt.nl/artikelen',
    );
    expect(entries.map((entry) => entry.url)).toContain(
      'https://www.brickhunt.nl/artikelen/star-wars',
    );
  });

  it('excludes noindex CMS pages from the public static sitemap segment', async () => {
    const entries = await collectDealsSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        getEditorialPageBySlug: vi.fn(async (slug: string) => ({
          id: slug,
          pageType: 'page',
          sections: [],
          seo: {
            description: `${slug} description`,
            noIndex: slug === 'private-page',
            title: slug,
          },
          slug,
          title: slug,
        })),
        listEditorialPageSlugs: vi
          .fn()
          .mockResolvedValue(['about', 'private-page']),
      },
    });

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://www.brickhunt.nl/',
      'https://www.brickhunt.nl/deals',
      'https://www.brickhunt.nl/hoe-werkt-het',
      'https://www.brickhunt.nl/over-brickhunt',
      'https://www.brickhunt.nl/contact',
      'https://www.brickhunt.nl/privacy',
      'https://www.brickhunt.nl/cookiebeleid',
      'https://www.brickhunt.nl/affiliate-disclosure',
      'https://www.brickhunt.nl/pages/about',
    ]);
  });

  it('excludes empty theme pages when they are detectable', async () => {
    const entries = await collectThemeSitemapEntries({
      allowIndexing: true,
      dataAccess: {
        getCatalogThemePageBySlug: vi.fn(async ({ slug }: { slug: string }) =>
          slug === 'star-wars'
            ? {
                setCards: [{ slug: 'x-wing-starfighter-75355' }],
                themeSnapshot: {
                  name: 'Star Wars',
                  setCount: 1,
                  slug: 'star-wars',
                },
              }
            : {
                setCards: [],
                themeSnapshot: {
                  name: 'Empty',
                  setCount: 0,
                  slug: 'empty',
                },
              },
        ),
        listCatalogThemePageSlugs: vi
          .fn()
          .mockResolvedValue(['star-wars', 'empty']),
      },
    });

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://www.brickhunt.nl/themes',
      'https://www.brickhunt.nl/themes/star-wars',
    ]);
  });

  it('does not emit page=1 and only emits page=2+ when pagination is intended', () => {
    expect(
      createSitemapUrlEntry({
        allowIndexing: true,
        paginationIntended: true,
        pathname: '/deals?page=1',
      }),
    ).toBeUndefined();
    expect(
      createSitemapUrlEntry({
        allowIndexing: true,
        pathname: '/deals?page=2',
      }),
    ).toBeUndefined();
    expect(
      createSitemapUrlEntry({
        allowIndexing: true,
        paginationIntended: true,
        pathname: '/deals?page=2',
      }),
    ).toEqual({
      url: 'https://www.brickhunt.nl/deals?page=2',
    });
  });
});
