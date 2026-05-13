import { timingSafeEqual } from 'node:crypto';
import {
  CatalogPromotionError,
  promoteCatalogFromStagingToProduction,
  revalidatePublicWeb,
  type CatalogPromotionResult,
  type PublicWebRevalidationResult,
} from '@lego-platform/api/data-access-server';
import {
  apiPaths,
  cacheTags,
  getAdminPromotionConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminPromoteService {
  promoteCatalog(): Promise<CatalogPromotionResult>;
}

type RevalidatePublicWebFn = typeof revalidatePublicWeb;

function createAdminPromoteService(): AdminPromoteService {
  return {
    promoteCatalog: () => promoteCatalogFromStagingToProduction(),
  };
}

function readAdminSecretHeader(
  headerValue: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string'
      ? headerValue[0].trim()
      : undefined;
  }

  return typeof headerValue === 'string' ? headerValue.trim() : undefined;
}

function matchesAdminSecret({
  expectedSecret,
  providedSecret,
}: {
  expectedSecret: string;
  providedSecret?: string;
}): boolean {
  if (!providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  const providedBuffer = Buffer.from(providedSecret, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function createAdminPromoteRoutes({
  adminPromoteService = createAdminPromoteService(),
  getExpectedAdminSecret = () => getAdminPromotionConfig().secret,
  revalidatePublicWebFn = revalidatePublicWeb,
}: {
  adminPromoteService?: AdminPromoteService;
  getExpectedAdminSecret?: () => string;
  revalidatePublicWebFn?: RevalidatePublicWebFn;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.post(
      apiPaths.adminCatalogPromotion,
      async function (request, reply) {
        let expectedAdminSecret: string;

        try {
          expectedAdminSecret = getExpectedAdminSecret();
        } catch (error) {
          request.log.error(
            {
              error,
              route: apiPaths.adminCatalogPromotion,
            },
            'Catalog promotion is not configured.',
          );

          return reply.status(503).send({
            message: 'Catalog promotion is not configured.',
            status: 'error',
          });
        }

        if (
          !matchesAdminSecret({
            expectedSecret: expectedAdminSecret,
            providedSecret: readAdminSecretHeader(
              request.headers['x-admin-secret'],
            ),
          })
        ) {
          return reply.status(401).send({
            message: 'Admin promotion secret is missing or invalid.',
            status: 'error',
          });
        }

        try {
          const result = await adminPromoteService.promoteCatalog();
          let revalidation: PublicWebRevalidationResult | undefined;
          let revalidationWarning: string | undefined;
          const revalidationPaths = [webPathnames.home, webPathnames.themes];
          const revalidationTags = [
            cacheTags.homepage(),
            cacheTags.themes(),
            'catalog',
          ];

          try {
            revalidation = await revalidatePublicWebFn({
              paths: revalidationPaths,
              reason: 'catalog_promote',
              tags: revalidationTags,
            });
          } catch (error) {
            revalidationWarning =
              error instanceof Error
                ? error.message
                : 'Public web revalidation failed after catalog promotion.';
            request.log.warn(
              {
                error,
                paths: revalidationPaths,
                reason: 'catalog_promote',
                route: apiPaths.adminCatalogPromotion,
                tags: revalidationTags,
              },
              'Public web revalidation failed after catalog promotion.',
            );
          }

          request.log.info(
            {
              durationMs: result.durationMs,
              revalidation: {
                attempted: revalidation?.attempted ?? false,
                pathCount: revalidation?.pathCount ?? revalidationPaths.length,
                paths: revalidation?.paths ?? revalidationPaths,
                skipped: revalidation?.skipped ?? false,
                tagCount: revalidation?.tagCount ?? revalidationTags.length,
                tags: revalidation?.tags ?? revalidationTags,
                warning: revalidationWarning,
              },
              route: apiPaths.adminCatalogPromotion,
              tables: result.tables,
            },
            'Catalog promotion completed.',
          );

          return {
            ...result,
            ...(revalidation
              ? {
                  revalidation,
                }
              : {}),
            ...(revalidationWarning
              ? {
                  revalidationWarning,
                }
              : {}),
          };
        } catch (error) {
          if (error instanceof CatalogPromotionError) {
            request.log.error(
              {
                durationMs: error.context.durationMs,
                failedTable: error.context.failedTable,
                route: apiPaths.adminCatalogPromotion,
                tables: error.context.tables,
              },
              error.message,
            );

            return reply.status(500).send({
              durationMs: error.context.durationMs,
              failedTable: error.context.failedTable,
              message: error.message,
              status: 'error',
              tables: error.context.tables,
            });
          }

          throw error;
        }
      },
    );
  };
}

export default createAdminPromoteRoutes();
