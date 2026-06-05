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
  buildArticlePath,
  buildArticlePreviewPath,
  buildArticleThemePath,
  buildNewsRevalidationTags,
  buildWebPath,
  getPublicWebBaseUrl,
  hasAdminPromotionConfig,
  isArticlePreviewEnabled,
  webPathnames,
} from '@lego-platform/shared/config';
import { normalizeTheme } from '@lego-platform/catalog/util';
import { revalidatePublicWeb } from '@lego-platform/api/data-access-server';
import type { FastifyInstance } from 'fastify';
import { createAdminPreHandler } from '../lib/admin-authorization';

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
  hasAdminPromotionSecret: boolean;
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

function buildArticleRevalidationPaths({
  article,
  slug,
}: {
  article?: Pick<AdminContentArticleDetail, 'theme'>;
  slug: string;
}): string[] {
  const themeSlug = normalizeTheme(article?.theme)?.key;

  return [
    buildWebPath(webPathnames.articles),
    ...(themeSlug ? [buildArticleThemePath(themeSlug)] : []),
    ...(themeSlug ? [buildArticlePath(slug, themeSlug)] : []),
  ];
}

async function revalidateArticleSurfaces({
  article,
  reason,
  slug,
}: {
  article?: Pick<AdminContentArticleDetail, 'theme'>;
  reason: string;
  slug: string;
}): Promise<void> {
  try {
    await revalidatePublicWeb({
      paths: buildArticleRevalidationPaths({
        article,
        slug,
      }),
      reason,
      tags: buildNewsRevalidationTags({
        affectsHomepage: true,
        affectsSitemap: true,
        articleSlug: slug,
      }),
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? error.message
        : 'Public web article revalidation failed.',
    );
  }
}

export function createAdminArticlesRoutes({
  adminPreHandler = createAdminPreHandler(),
  articlesService = createAdminArticlesService(),
  hasAdminPromotionSecret = () => hasAdminPromotionConfig(),
  isPreviewEnabled = () => isArticlePreviewEnabled(),
}: {
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  articlesService?: AdminArticlesService;
  hasAdminPromotionSecret?: () => boolean;
  isPreviewEnabled?: () => boolean;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.addHook('preHandler', adminPreHandler);

    fastify.get(apiPaths.adminRuntimeConfig, async function () {
      return {
        articlePreviewEnabled: isPreviewEnabled(),
        hasAdminPromotionSecret: hasAdminPromotionSecret(),
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
          const article = await articlesService.updateArticle({
            article: readUpdateInput(request.body),
            slug: readSlugParam(request.params),
          });

          await revalidateArticleSurfaces({
            article,
            reason: 'admin_article_update',
            slug: article.slug,
          });

          return article;
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
          const slug = readSlugParam(request.params);
          const result = await articlesService.deleteArticle({
            slug,
          });

          await revalidateArticleSurfaces({
            reason: 'admin_article_delete',
            slug,
          });

          return result;
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
