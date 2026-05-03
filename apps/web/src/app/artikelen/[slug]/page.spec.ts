import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const listPublishedArticleSlugs = vi.fn();
const listPublishedArticles = vi.fn();
const getArticleBySlug = vi.fn();
const listCatalogSetCardsByIds = vi.fn();
const contentArticlePageSpy = vi.fn(() => null);
const mdxRemoteSpy = vi.fn(() => null);
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next-mdx-remote/rsc', () => ({
  MDXRemote: mdxRemoteSpy,
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getArticleBySlug,
  listPublishedArticles,
  listPublishedArticleSlugs,
}));

vi.mock('next/navigation', () => ({
  notFound,
}));

vi.mock('@lego-platform/catalog/data-access', () => ({
  catalogSnapshot: {
    generatedAt: '2026-05-01T12:00:00.000Z',
    source: 'test',
    setRecords: [],
  },
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  listCatalogSetCardsByIds,
}));

vi.mock('@lego-platform/catalog/util', async () => {
  const actual = await vi.importActual<
    typeof import('@lego-platform/catalog/util')
  >('@lego-platform/catalog/util');

  return {
    ...actual,
    getCanonicalCatalogSetId: (sourceSetNumber: string) =>
      sourceSetNumber.trim().replace(/-1$/u, ''),
    normalizeCatalogSetImages: ({
      imageUrl,
      primaryImage,
    }: {
      imageUrl?: string;
      primaryImage?: string;
    }) => ({
      imageUrl,
      primaryImage: primaryImage ?? imageUrl,
    }),
  };
});

vi.mock('@lego-platform/content/ui', () => ({
  ContentArticlePage: contentArticlePageSpy,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('article detail route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listCatalogSetCardsByIds.mockResolvedValue([]);
  });

  it('stays a server-rendered route without client-side data fetching', async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        'apps',
        'web',
        'src',
        'app',
        'artikelen',
        '[slug]',
        'page.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useSWR');
    expect(source).not.toContain('fetch(');
    expect(source).toContain('await getArticleBySlug(slug)');
    expect(source).toContain('<MDXRemote');
  });

  it('builds static params from published article slugs', async () => {
    listPublishedArticleSlugs.mockResolvedValue([
      'star-wars-day-2026',
      'lego-icons-guide',
    ]);

    const { generateStaticParams } = await import('./page');

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'star-wars-day-2026' },
      { slug: 'lego-icons-guide' },
    ]);
  });

  it('derives metadata from the published article frontmatter', async () => {
    getArticleBySlug.mockResolvedValue({
      description: 'Waar wil je nu op letten?',
      heroImage: '/articles/star-wars-day-2026/hero.jpg',
      title: 'Star Wars Day 2026 (May the 4th)',
    });

    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'star-wars-day-2026',
        }),
      }),
    ).resolves.toMatchObject({
      description: 'Waar wil je nu op letten?',
      openGraph: {
        description: 'Waar wil je nu op letten?',
        images: ['/articles/star-wars-day-2026/hero.jpg'],
        title: 'Star Wars Day 2026 (May the 4th)',
      },
      title: 'Star Wars Day 2026 (May the 4th)',
    });
  });

  it('falls back to the primary set image for article metadata when heroImage is missing', async () => {
    getArticleBySlug.mockResolvedValue({
      description: 'Waarom dit nu telt.',
      heroImage: undefined,
      heroImageAlt: 'Leeg',
      primarySetNumber: '40787',
      title: 'Spiny Shell terug',
    });
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '40787',
        imageUrl: 'https://example.com/40787.jpg',
        name: 'Mario Kart – Spiny Shell',
        pieces: 234,
        releaseYear: 2026,
        slug: 'mario-kart-spiny-shell-40787',
        theme: 'Super Mario',
      },
    ]);

    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'spiny-shell-terug',
        }),
      }),
    ).resolves.toMatchObject({
      openGraph: {
        images: ['https://example.com/40787.jpg'],
      },
    });
  });

  it('keeps the frontmatter hero image when one exists', async () => {
    getArticleBySlug.mockResolvedValue({
      bodySource: 'Intro',
      cardImageAlt: 'Star Wars hero',
      date: '2026-05-01',
      description: 'Waar wil je nu op letten?',
      heroImage: '/articles/star-wars-day-2026/hero.jpg',
      heroImageAlt: 'Star Wars hero',
      slug: 'star-wars-day-2026',
      status: 'published',
      theme: 'Star Wars',
      title: 'Star Wars Day 2026 (May the 4th)',
    });
    listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');
    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        slug: 'star-wars-day-2026',
      }),
    });
    renderToStaticMarkup(renderedPage);

    expect(contentArticlePageSpy).toHaveBeenCalled();
    expect(contentArticlePageSpy.mock.calls[0]?.[0]?.body.props).toEqual(
      expect.objectContaining({
        source: 'Intro',
      }),
    );
    expect(contentArticlePageSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        contentArticle: expect.objectContaining({
          heroImage: '/articles/star-wars-day-2026/hero.jpg',
        }),
      }),
    );
  });

  it('falls back to the FeaturedSet image when heroImage is missing', async () => {
    getArticleBySlug.mockResolvedValue({
      bodySource: '<FeaturedSet setNumber="40787" />',
      cardImageAlt: 'Mario Kart',
      date: '2026-05-01',
      description: 'Waarom dit nu telt.',
      heroImage: undefined,
      heroImageAlt: 'Wordt vervangen',
      primarySetNumber: '40787',
      slug: 'spiny-shell-terug',
      status: 'published',
      theme: 'Super Mario',
      title: 'Spiny Shell terug',
    });
    listPublishedArticles.mockResolvedValue([]);
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '40787',
        imageUrl: 'https://example.com/40787.jpg',
        name: 'Mario Kart – Spiny Shell',
        pieces: 234,
        releaseYear: 2026,
        slug: 'mario-kart-spiny-shell-40787',
        theme: 'Super Mario',
      },
    ]);

    const pageModule = await import('./page');
    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        slug: 'spiny-shell-terug',
      }),
    });
    renderToStaticMarkup(renderedPage);

    expect(contentArticlePageSpy).toHaveBeenCalled();
    expect(contentArticlePageSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        contentArticle: expect.objectContaining({
          heroImage: 'https://example.com/40787.jpg',
          heroImageAlt: 'Mario Kart – Spiny Shell LEGO-set',
        }),
      }),
    );
  });

  it('renders safely without a hero when neither frontmatter nor FeaturedSet image exists', async () => {
    getArticleBySlug.mockResolvedValue({
      bodySource: 'Geen hero, geen featured set.',
      cardImageAlt: 'Artikel',
      date: '2026-05-01',
      description: 'Kort nieuws.',
      heroImage: undefined,
      heroImageAlt: 'Lege hero',
      slug: 'zonder-hero',
      status: 'published',
      theme: 'Icons',
      title: 'Zonder hero',
    });
    listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');

    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        slug: 'zonder-hero',
      }),
    });

    expect(renderedPage).toBeDefined();
    renderToStaticMarkup(renderedPage);

    expect(contentArticlePageSpy).toHaveBeenCalled();
    expect(contentArticlePageSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        contentArticle: expect.objectContaining({
          heroImage: undefined,
        }),
      }),
    );
  });

  it('calls notFound when the article slug is unknown', async () => {
    getArticleBySlug.mockResolvedValue(null);

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          slug: 'niet-gevonden',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
