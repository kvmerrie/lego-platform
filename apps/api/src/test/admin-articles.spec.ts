import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  ContentArticleAdminNotFoundError,
  ContentArticleAdminValidationError,
} from '@lego-platform/content/data-access-server';
import {
  createAdminArticlesRoutes,
  type AdminArticlesService,
} from '../app/routes/admin-articles';

function createArticleDetail() {
  return {
    date: '2026-05-01',
    description: 'Een korte beschrijving.',
    frontmatter: {
      date: '2026-05-01',
      description: 'Een korte beschrijving.',
      heroImage: '',
      slug: 'spiny-shell',
      status: 'published' as const,
      theme: 'Super Mario',
      title: 'LEGO Spiny Shell',
    },
    heroImage: '',
    mdx: '## Wanneer kiezen?\n\nKort.',
    publishedAt: '2026-05-01T09:00:00.000Z',
    slug: 'spiny-shell',
    status: 'published' as const,
    theme: 'Super Mario',
    title: 'LEGO Spiny Shell',
    updatedAt: '2026-05-01T10:00:00.000Z',
  };
}

async function createAdminArticlesServer({
  articlesService,
}: {
  articlesService?: AdminArticlesService;
} = {}) {
  const nextArticlesService: AdminArticlesService = articlesService ?? {
    createPreview: vi.fn(async () => ({
      previewId: '00000000-0000-4000-8000-000000000001',
    })),
    deleteArticle: vi.fn(async () => ({
      clearedFeedItems: 1,
      deletedArticle: true,
      deletedEvents: 2,
      deletedPreviews: 1,
      deletedStorageObjects: 3,
    })),
    getArticle: vi.fn(async () => createArticleDetail()),
    listArticles: vi.fn(async () => [
      {
        date: '2026-05-01',
        slug: 'spiny-shell',
        status: 'published' as const,
        title: 'LEGO Spiny Shell',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]),
    updateArticle: vi.fn(async () => createArticleDetail()),
  };
  const server = Fastify({
    logger: false,
  });

  await server.register(
    createAdminArticlesRoutes({
      adminPreHandler: async () => undefined,
      articlesService: nextArticlesService,
    }),
  );

  return {
    articlesService: nextArticlesService,
    server,
  };
}

describe('admin articles routes', () => {
  test('returns admin runtime config with article preview flag', async () => {
    const { articlesService, server } = await createAdminArticlesServer();

    await server.close();

    const enabledServer = Fastify({ logger: false });

    await enabledServer.register(
      createAdminArticlesRoutes({
        adminPreHandler: async () => undefined,
        articlesService,
        isPreviewEnabled: () => true,
      }),
    );

    const response = await enabledServer.inject({
      method: 'GET',
      url: '/api/v1/admin/runtime-config',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      articlePreviewEnabled: true,
    });

    await enabledServer.close();
  });

  test('lists published articles for admin editing', async () => {
    const { server } = await createAdminArticlesServer();
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/articles',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        date: '2026-05-01',
        slug: 'spiny-shell',
        status: 'published',
        title: 'LEGO Spiny Shell',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]);
  });

  test('loads one published article by slug', async () => {
    const { articlesService, server } = await createAdminArticlesServer();
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/articles/spiny-shell',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      mdx: '## Wanneer kiezen?\n\nKort.',
      slug: 'spiny-shell',
      title: 'LEGO Spiny Shell',
    });
    expect(articlesService.getArticle).toHaveBeenCalledWith({
      slug: 'spiny-shell',
    });
  });

  test('updates article frontmatter and mdx', async () => {
    const { articlesService, server } = await createAdminArticlesServer();
    const response = await server.inject({
      method: 'PATCH',
      payload: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          heroImage: 'https://storage.example/hero.webp',
          theme: 'Super Mario',
          title: 'Nieuwe titel',
        },
        mdx: '## Nieuwe heading\n\nNieuwe copy.',
      },
      url: '/api/v1/admin/articles/spiny-shell',
    });

    expect(response.statusCode).toBe(200);
    expect(articlesService.updateArticle).toHaveBeenCalledWith({
      article: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          heroImage: 'https://storage.example/hero.webp',
          theme: 'Super Mario',
          title: 'Nieuwe titel',
        },
        mdx: '## Nieuwe heading\n\nNieuwe copy.',
      },
      slug: 'spiny-shell',
    });
  });

  test('deletes one published article by slug', async () => {
    const { articlesService, server } = await createAdminArticlesServer();
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/articles/spiny-shell',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      clearedFeedItems: 1,
      deletedArticle: true,
      deletedEvents: 2,
      deletedPreviews: 1,
      deletedStorageObjects: 3,
    });
    expect(articlesService.deleteArticle).toHaveBeenCalledWith({
      slug: 'spiny-shell',
    });
  });

  test('returns not found when deleting an unknown article', async () => {
    const { server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => ({
          previewId: '00000000-0000-4000-8000-000000000001',
        })),
        deleteArticle: vi.fn(async () => {
          throw new ContentArticleAdminNotFoundError('Artikel niet gevonden.');
        }),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => createArticleDetail()),
      },
    });
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/articles/onbekend',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'Artikel niet gevonden.',
    });
  });

  test('creates an article preview when enabled', async () => {
    const { articlesService, server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => ({
          previewId: '00000000-0000-4000-8000-000000000001',
        })),
        deleteArticle: vi.fn(async () => ({
          clearedFeedItems: 0,
          deletedArticle: true,
          deletedEvents: 0,
          deletedPreviews: 0,
          deletedStorageObjects: 0,
        })),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => createArticleDetail()),
      },
    });

    await server.close();

    const enabledServer = Fastify({ logger: false });

    await enabledServer.register(
      createAdminArticlesRoutes({
        adminPreHandler: async () => undefined,
        articlesService,
        isPreviewEnabled: () => true,
      }),
    );

    const response = await enabledServer.inject({
      method: 'POST',
      payload: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Preview beschrijving.',
          title: 'Preview artikel',
        },
        mdx: '## Preview heading\n\nCopy.',
      },
      url: '/api/v1/admin/articles/preview',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      previewId: '00000000-0000-4000-8000-000000000001',
      previewUrl:
        'http://localhost:3000/artikelen/preview/00000000-0000-4000-8000-000000000001',
    });
    expect(articlesService.createPreview).toHaveBeenCalledWith({
      article: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Preview beschrijving.',
          title: 'Preview artikel',
        },
        mdx: '## Preview heading\n\nCopy.',
      },
    });

    await enabledServer.close();
  });

  test('rejects invalid preview input', async () => {
    const { server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => {
          throw new ContentArticleAdminValidationError(
            'Artikel-MDX moet minimaal één heading bevatten.',
          );
        }),
        deleteArticle: vi.fn(async () => ({
          clearedFeedItems: 0,
          deletedArticle: true,
          deletedEvents: 0,
          deletedPreviews: 0,
          deletedStorageObjects: 0,
        })),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => createArticleDetail()),
      },
    });

    await server.close();

    const enabledServer = Fastify({ logger: false });

    await enabledServer.register(
      createAdminArticlesRoutes({
        adminPreHandler: async () => undefined,
        articlesService: {
          createPreview: vi.fn(async () => {
            throw new ContentArticleAdminValidationError(
              'Artikel-MDX moet minimaal één heading bevatten.',
            );
          }),
          deleteArticle: vi.fn(async () => ({
            clearedFeedItems: 0,
            deletedArticle: true,
            deletedEvents: 0,
            deletedPreviews: 0,
            deletedStorageObjects: 0,
          })),
          getArticle: vi.fn(async () => null),
          listArticles: vi.fn(async () => []),
          updateArticle: vi.fn(async () => createArticleDetail()),
        },
        isPreviewEnabled: () => true,
      }),
    );

    const response = await enabledServer.inject({
      method: 'POST',
      payload: {
        frontmatter: {
          title: 'Preview artikel',
        },
        mdx: 'Geen heading.',
      },
      url: '/api/v1/admin/articles/preview',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Artikel-MDX moet minimaal één heading bevatten.',
    });

    await enabledServer.close();
  });

  test('returns not found when article preview is disabled', async () => {
    const { articlesService, server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => ({
          previewId: '00000000-0000-4000-8000-000000000001',
        })),
        deleteArticle: vi.fn(async () => ({
          clearedFeedItems: 0,
          deletedArticle: true,
          deletedEvents: 0,
          deletedPreviews: 0,
          deletedStorageObjects: 0,
        })),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => createArticleDetail()),
      },
    });
    await server.close();

    const disabledServer = Fastify({ logger: false });

    await disabledServer.register(
      createAdminArticlesRoutes({
        adminPreHandler: async () => undefined,
        articlesService,
        isPreviewEnabled: () => false,
      }),
    );
    const response = await disabledServer.inject({
      method: 'POST',
      payload: {
        frontmatter: {
          title: 'Preview artikel',
        },
        mdx: '## Heading\n\nCopy.',
      },
      url: '/api/v1/admin/articles/preview',
    });

    expect(response.statusCode).toBe(404);
    expect(articlesService.createPreview).not.toHaveBeenCalled();

    await disabledServer.close();
  });

  test('returns validation and not-found errors clearly', async () => {
    const { server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => ({
          previewId: '00000000-0000-4000-8000-000000000001',
        })),
        deleteArticle: vi.fn(async () => ({
          clearedFeedItems: 0,
          deletedArticle: true,
          deletedEvents: 0,
          deletedPreviews: 0,
          deletedStorageObjects: 0,
        })),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => {
          throw new ContentArticleAdminValidationError(
            'Artikel-MDX moet minimaal één heading bevatten.',
          );
        }),
      },
    });

    const loadResponse = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/articles/onbekend',
    });
    const updateResponse = await server.inject({
      method: 'PATCH',
      payload: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          title: 'Nieuwe titel',
        },
        mdx: 'Geen heading.',
      },
      url: '/api/v1/admin/articles/onbekend',
    });

    expect(loadResponse.statusCode).toBe(404);
    expect(loadResponse.json()).toEqual({
      message: 'Artikel niet gevonden.',
    });
    expect(updateResponse.statusCode).toBe(400);
    expect(updateResponse.json()).toEqual({
      message: 'Artikel-MDX moet minimaal één heading bevatten.',
    });
  });

  test('returns a not-found response when update cannot find the article', async () => {
    const { server } = await createAdminArticlesServer({
      articlesService: {
        createPreview: vi.fn(async () => ({
          previewId: '00000000-0000-4000-8000-000000000001',
        })),
        deleteArticle: vi.fn(async () => ({
          clearedFeedItems: 0,
          deletedArticle: true,
          deletedEvents: 0,
          deletedPreviews: 0,
          deletedStorageObjects: 0,
        })),
        getArticle: vi.fn(async () => null),
        listArticles: vi.fn(async () => []),
        updateArticle: vi.fn(async () => {
          throw new ContentArticleAdminNotFoundError('Artikel niet gevonden.');
        }),
      },
    });
    const response = await server.inject({
      method: 'PATCH',
      payload: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          title: 'Nieuwe titel',
        },
        mdx: '## Heading\n\nCopy.',
      },
      url: '/api/v1/admin/articles/onbekend',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'Artikel niet gevonden.',
    });
  });
});
