import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const getArticleBySlug = vi.fn();
const listPublishedArticles = vi.fn();
const listCatalogSetCards = vi.fn();
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
  listCatalogSetCards,
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

function createArticle(overrides: Record<string, unknown> = {}) {
  return {
    bodySource: '## Intro\n\nArtikeltekst.',
    cardImageAlt: 'Article image',
    date: '2026-05-03',
    description: 'Waarom deze release telt.',
    heroImageAlt: 'Article image',
    slug: 'star-wars-day-2026',
    status: 'published',
    theme: 'Star Wars',
    title: 'Star Wars Day 2026',
    ...overrides,
  };
}

describe('theme article detail route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listCatalogSetCards.mockResolvedValue([]);
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
        '[theme]',
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

  it('builds static params with theme slugs from the Theme Registry', async () => {
    listPublishedArticles.mockResolvedValue([
      createArticle({ slug: 'star-wars-day-2026', theme: 'Star Wars™' }),
      createArticle({ slug: 'icons-guide', theme: 'LEGO® Icons' }),
      createArticle({
        slug: 'rivendell',
        theme: 'Lord of the Rings™',
      }),
    ]);

    const pageModule = await import('./page');

    await expect(pageModule.generateStaticParams()).resolves.toEqual([
      { slug: 'star-wars-day-2026', theme: 'star-wars' },
      { slug: 'icons-guide', theme: 'icons' },
      { slug: 'rivendell', theme: 'lord-of-the-rings' },
    ]);
  });

  it('renders a matched theme article with article-theme breadcrumbs', async () => {
    getArticleBySlug.mockResolvedValue(createArticle());
    listPublishedArticles.mockResolvedValue([
      createArticle(),
      createArticle({ slug: 'related', title: 'Related' }),
    ]);

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars-day-2026',
          theme: 'star-wars',
        }),
      }),
    );

    expect(getArticleBySlug).toHaveBeenCalledWith('star-wars-day-2026');
    expect(contentArticlePageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        breadcrumbs: expect.arrayContaining([
          expect.objectContaining({
            href: '/artikelen',
            label: 'Artikelen',
          }),
          expect.objectContaining({
            href: '/artikelen/star-wars',
            label: 'Star Wars™',
          }),
        ]),
        contentArticle: expect.objectContaining({
          slug: 'star-wars-day-2026',
          themeSlug: 'star-wars',
        }),
      }),
      undefined,
    );
    expect(contentArticlePageSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        body: expect.anything(),
      }),
    );
  });

  it('returns notFound for a mismatched article theme', async () => {
    getArticleBySlug.mockResolvedValue(createArticle({ theme: 'Marvel' }));
    listPublishedArticles.mockResolvedValue([]);

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          slug: 'star-wars-day-2026',
          theme: 'star-wars',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
