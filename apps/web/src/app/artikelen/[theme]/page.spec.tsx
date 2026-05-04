import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const listPublishedArticles = vi.fn();
const getPopularArticles = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@lego-platform/content/data-access', () => ({
  getPopularArticles,
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
  listCatalogSetCards: vi.fn(async () => []),
  listCatalogSetCardsByIds: vi.fn(async () => []),
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

function createArticle(overrides: Record<string, unknown> = {}) {
  return {
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

describe('article theme listing route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPopularArticles.mockResolvedValue([]);
  });

  it('renders Star Wars articles for /artikelen/star-wars', async () => {
    listPublishedArticles.mockResolvedValue([
      createArticle(),
      createArticle({
        slug: 'marvel-news',
        theme: 'Marvel',
        title: 'Marvel nieuws',
      }),
    ]);

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({ theme: 'star-wars' }),
      }),
    );

    expect(markup).toContain('Star Wars™ nieuws');
    expect(markup).toContain('Star Wars Day 2026');
    expect(markup).toContain('/artikelen/star-wars/star-wars-day-2026');
    expect(markup).not.toContain('Marvel nieuws');
  });

  it('returns notFound for an invalid or empty article theme', async () => {
    listPublishedArticles.mockResolvedValue([
      createArticle({
        slug: 'icons-guide',
        theme: 'LEGO® Icons',
      }),
    ]);

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({ theme: 'star-wars' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
