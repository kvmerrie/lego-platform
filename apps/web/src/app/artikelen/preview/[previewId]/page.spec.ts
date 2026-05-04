import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const getArticlePreviewById = vi.fn();
const listCatalogSetCardsByIds = vi.fn();
const contentArticlePageSpy = vi.fn(() => null);
const mdxRemoteSpy = vi.fn(() => null);
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
let previewEnabled = true;

vi.mock('next-mdx-remote/rsc', () => ({
  MDXRemote: mdxRemoteSpy,
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getArticlePreviewById,
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

vi.mock('@lego-platform/shared/config', async () => {
  const actual = await vi.importActual<
    typeof import('@lego-platform/shared/config')
  >('@lego-platform/shared/config');

  return {
    ...actual,
    isArticlePreviewEnabled: () => previewEnabled,
  };
});

describe('article preview route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    previewEnabled = true;
    listCatalogSetCardsByIds.mockResolvedValue([]);
  });

  it('renders preview MDX with the same article components', async () => {
    getArticlePreviewById.mockResolvedValue({
      bodySource: 'Intro\n\n<FeaturedSet setNumber="40787" />',
      date: '2026-05-01',
      description: 'Preview beschrijving.',
      heroImage: undefined,
      heroImageAlt: 'Wordt vervangen',
      primarySetNumber: '40787',
      slug: 'preview-00000000-0000-4000-8000-000000000001',
      status: 'draft',
      theme: 'Super Mario',
      title: 'Preview artikel',
    });
    listCatalogSetCardsByIds.mockResolvedValue([
      {
        id: '40787',
        imageUrl: 'https://example.com/40787.jpg',
        name: 'Mario Kart - Spiny Shell',
        pieces: 234,
        releaseYear: 2026,
        slug: 'mario-kart-spiny-shell-40787',
        theme: 'Super Mario',
      },
    ]);

    const pageModule = await import('./page');
    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        previewId: '00000000-0000-4000-8000-000000000001',
      }),
    });

    renderToStaticMarkup(renderedPage);

    expect(getArticlePreviewById).toHaveBeenCalledWith({
      previewId: '00000000-0000-4000-8000-000000000001',
    });
    expect(contentArticlePageSpy.mock.calls[0]?.[0]?.body.props).toEqual(
      expect.objectContaining({
        source: 'Intro\n\n<FeaturedSet setNumber="40787" />',
      }),
    );
    expect(contentArticlePageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contentArticle: expect.objectContaining({
          heroImage: 'https://example.com/40787.jpg',
          heroImageSource: 'featuredSet',
          title: 'Preview artikel',
        }),
      }),
      undefined,
    );
  });

  it('keeps manual heroImage before catalog fallback', async () => {
    getArticlePreviewById.mockResolvedValue({
      bodySource: '<FeaturedSet setNumber="40787" />',
      date: '2026-05-01',
      description: 'Preview beschrijving.',
      heroImage: 'https://storage.example/hero.webp',
      heroImageAlt: 'Manual hero',
      primarySetNumber: '40787',
      slug: 'preview-00000000-0000-4000-8000-000000000001',
      status: 'draft',
      theme: 'Super Mario',
      title: 'Preview artikel',
    });

    const pageModule = await import('./page');
    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        previewId: '00000000-0000-4000-8000-000000000001',
      }),
    });

    renderToStaticMarkup(renderedPage);

    expect(contentArticlePageSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        contentArticle: expect.objectContaining({
          heroImage: 'https://storage.example/hero.webp',
          heroImageAlt: 'Manual hero',
          heroImageSource: 'manual',
        }),
      }),
    );
  });

  it('passes ImageGallery snippets through to the preview MDX renderer', async () => {
    getArticlePreviewById.mockResolvedValue({
      bodySource:
        'Intro\n\n<ImageGallery images="https://storage.example/gallery-one.webp::Gallery beeld" />',
      date: '2026-05-01',
      description: 'Preview beschrijving.',
      heroImage: 'https://storage.example/hero.webp',
      heroImageAlt: 'Manual hero',
      slug: 'preview-00000000-0000-4000-8000-000000000001',
      status: 'draft',
      theme: 'Star Wars',
      title: 'Preview artikel',
    });

    const pageModule = await import('./page');
    const renderedPage = await pageModule.default({
      params: Promise.resolve({
        previewId: '00000000-0000-4000-8000-000000000001',
      }),
    });

    renderToStaticMarkup(renderedPage);

    expect(contentArticlePageSpy.mock.calls[0]?.[0]?.body.props).toEqual(
      expect.objectContaining({
        source:
          'Intro\n\n<ImageGallery images="https://storage.example/gallery-one.webp::Gallery beeld" />',
      }),
    );
  });

  it('calls notFound for expired or missing previews', async () => {
    getArticlePreviewById.mockResolvedValue(null);

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          previewId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is disabled when ARTICLE_PREVIEW_ENABLED is false', async () => {
    previewEnabled = false;

    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          previewId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getArticlePreviewById).not.toHaveBeenCalled();
  });

  it('metadata is noindex', async () => {
    getArticlePreviewById.mockResolvedValue({
      title: 'Preview artikel',
    });

    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({
          previewId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
    ).resolves.toMatchObject({
      robots: {
        follow: false,
        index: false,
      },
      title: 'Preview: Preview artikel',
    });
  });
});
