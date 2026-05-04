import {
  ContentArticleAdminNotFoundError,
  ContentArticleAdminValidationError,
  createAdminArticlePreview,
  deleteAdminPublishedArticleBySlug,
  getAdminPublishedArticleBySlug,
  listAdminPublishedArticles,
  updateAdminPublishedArticle,
} from '@lego-platform/content/data-access-server';
import type {
  AdminContentArticleDetail,
  AdminContentArticleDeleteSummary,
  AdminContentArticleSummary,
  AdminContentArticleUpdateInput,
} from '@lego-platform/content/util';
import {
  apiPaths,
  buildArticlePreviewPath,
  getPublicWebBaseUrl,
  isArticlePreviewEnabled,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminArticlesService {
  createPreview(input: {
    article: AdminContentArticleUpdateInput;
  }): Promise<{ previewId: string }>;
  deleteArticle(input: {
    slug: string;
  }): Promise<AdminContentArticleDeleteSummary>;
  getArticle(input: {
    slug: string;
  }): Promise<AdminContentArticleDetail | null>;
  listArticles(): Promise<readonly AdminContentArticleSummary[]>;
  updateArticle(input: {
    article: AdminContentArticleUpdateInput;
    slug: string;
  }): Promise<AdminContentArticleDetail>;
}

export interface AdminRuntimeConfig {
  articlePreviewEnabled: boolean;
}

export function createAdminArticlesService(): AdminArticlesService {
  return {
    createPreview: async ({ article }) =>
      createAdminArticlePreview({
        input: article,
      }),
    deleteArticle: ({ slug }) => deleteAdminPublishedArticleBySlug({ slug }),
    getArticle: ({ slug }) => getAdminPublishedArticleBySlug({ slug }),
    listArticles: () => listAdminPublishedArticles(),
    updateArticle: ({ article, slug }) =>
      updateAdminPublishedArticle({
        input: article,
        slug,
      }),
  };
}

function readSlugParam(value: unknown): string {
  const slug =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { slug?: unknown }).slug
      : undefined;

  if (typeof slug !== 'string' || slug.trim().length === 0) {
    throw new ContentArticleAdminValidationError('Artikel-slug ontbreekt.');
  }

  return slug.trim();
}

function readUpdateInput(value: unknown): AdminContentArticleUpdateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticleAdminValidationError('Artikel-input ontbreekt.');
  }

  const mdx = (value as { mdx?: unknown }).mdx;
  const frontmatter = (value as { frontmatter?: unknown }).frontmatter;

  if (typeof mdx !== 'string') {
    throw new ContentArticleAdminValidationError('Artikel-MDX ontbreekt.');
  }

  if (
    !frontmatter ||
    typeof frontmatter !== 'object' ||
    Array.isArray(frontmatter)
  ) {
    throw new ContentArticleAdminValidationError(
      'Artikel-frontmatter ontbreekt.',
    );
  }

  return {
    frontmatter: frontmatter as AdminContentArticleUpdateInput['frontmatter'],
    mdx,
  };
}

export function createAdminArticlesRoutes({
  articlesService = createAdminArticlesService(),
  isPreviewEnabled = () => isArticlePreviewEnabled(),
}: {
  articlesService?: AdminArticlesService;
  isPreviewEnabled?: () => boolean;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(apiPaths.adminRuntimeConfig, async function () {
      return {
        articlePreviewEnabled: isPreviewEnabled(),
      } satisfies AdminRuntimeConfig;
    });

    fastify.get(apiPaths.adminArticles, async function () {
      return articlesService.listArticles();
    });

    fastify.get<{ Params: unknown }>(
      `${apiPaths.adminArticles}/:slug`,
      async function (request, reply) {
        try {
          const article = await articlesService.getArticle({
            slug: readSlugParam(request.params),
          });

          if (!article) {
            return reply.status(404).send({
              message: 'Artikel niet gevonden.',
            });
          }

          return article;
        } catch (error) {
          request.log.error({ err: error }, 'Admin article load failed');

          if (error instanceof ContentArticleAdminValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Artikel kon niet worden opgehaald.',
          });
        }
      },
    );

    fastify.patch<{ Body: unknown; Params: unknown }>(
      `${apiPaths.adminArticles}/:slug`,
      async function (request, reply) {
        try {
          return await articlesService.updateArticle({
            article: readUpdateInput(request.body),
            slug: readSlugParam(request.params),
          });
        } catch (error) {
          request.log.error({ err: error }, 'Admin article update failed');

          if (error instanceof ContentArticleAdminValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          if (error instanceof ContentArticleAdminNotFoundError) {
            return reply.status(404).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Artikel opslaan is mislukt.',
          });
        }
      },
    );

    fastify.delete<{ Params: unknown }>(
      `${apiPaths.adminArticles}/:slug`,
      async function (request, reply) {
        try {
          return await articlesService.deleteArticle({
            slug: readSlugParam(request.params),
          });
        } catch (error) {
          request.log.error({ err: error }, 'Admin article delete failed');

          if (error instanceof ContentArticleAdminValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          if (error instanceof ContentArticleAdminNotFoundError) {
            return reply.status(404).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message:
              error instanceof Error && error.message.trim()
                ? error.message
                : 'Artikel verwijderen is mislukt.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminArticlesPreview,
      async function (request, reply) {
        if (!isPreviewEnabled()) {
          return reply.status(404).send({
            message: 'Artikel-preview is niet beschikbaar.',
          });
        }

        try {
          const { previewId } = await articlesService.createPreview({
            article: readUpdateInput(request.body),
          });
          const previewUrl = `${getPublicWebBaseUrl()}${buildArticlePreviewPath(
            previewId,
          )}`;

          return {
            previewId,
            previewUrl,
          };
        } catch (error) {
          request.log.error({ err: error }, 'Admin article preview failed');

          if (error instanceof ContentArticleAdminValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Artikel-preview aanmaken is mislukt.',
          });
        }
      },
    );
  };
}

export default createAdminArticlesRoutes();
