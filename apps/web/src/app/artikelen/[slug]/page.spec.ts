import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPublishedArticleSlugs = vi.fn();
const getPublishedArticleBySlug = vi.fn();

vi.mock('next-mdx-remote/rsc', () => ({
  MDXRemote: () => null,
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getPublishedArticleBySlug,
  listPublishedArticleSlugs,
}));

vi.mock('@lego-platform/content/ui', () => ({
  ContentArticlePage: () => null,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('article detail route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    getPublishedArticleBySlug.mockResolvedValue({
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
});
