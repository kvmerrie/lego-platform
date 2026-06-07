import { timingSafeEqual } from 'node:crypto';
import {
  CatalogPromotionError,
  previewCmsPromotionFromStagingToProduction,
  previewCatalogPromotionFromStagingToProduction,
  promoteCmsFromStagingToProduction,
  promoteCatalogFromStagingToProduction,
  revalidatePublicWeb,
  type CmsPromotionPreviewResult,
  type CmsPromotionResult,
  type CatalogPromotionPreviewResult,
  type CatalogPromotionResult,
  type PublicWebRevalidationResult,
} from '@lego-platform/api/data-access-server';
import {
  apiPaths,
  buildSetDetailPath,
  buildThemePath,
  cacheTags,
  getAdminPromotionConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import {
  authorizeAdminRequest,
  createAdminPreHandler,
} from '../lib/admin-authorization';

const MAX_THEME_DETAIL_REVALIDATION_PATHS = 50;
const MAX_PROMOTED_METADATA_SET_REVALIDATION_PATHS = 25;
const LOGGED_CHANGED_THEME_SLUG_LIMIT = 12;
const CATALOG_PROMOTION_CONFIRMATION_PHRASE = 'PROMOTE CATALOG';
const CMS_PROMOTION_CONFIRMATION_PHRASE = 'PROMOTE CMS';

export interface AdminPromoteService {
  previewCms(): Promise<CmsPromotionPreviewResult>;
  previewCatalog(input?: {
    includeCommerceSeeds?: boolean;
    includeHeavy?: boolean;
  }): Promise<CatalogPromotionPreviewResult>;
  promoteCms(): Promise<CmsPromotionResult>;
  promoteCatalog(input?: {
    includeCommerceSeeds?: boolean;
  }): Promise<CatalogPromotionResult>;
}

type RevalidatePublicWebFn = typeof revalidatePublicWeb;

function createAdminPromoteService(): AdminPromoteService {
  return {
    previewCms: () => previewCmsPromotionFromStagingToProduction(),
    previewCatalog: (input) =>
      previewCatalogPromotionFromStagingToProduction({
        includeCommerceSeeds: input?.includeCommerceSeeds === true,
        includeHeavy: input?.includeHeavy === true,
      }),
    promoteCms: () => promoteCmsFromStagingToProduction(),
    promoteCatalog: (input) =>
      promoteCatalogFromStagingToProduction({
        includeCommerceSeeds: input?.includeCommerceSeeds === true,
      }),
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

function readCmsPromotionConfirmationPhrase(
  body: { confirmationPhrase?: unknown } | undefined,
): string {
  return typeof body?.confirmationPhrase === 'string'
    ? body.confirmationPhrase.trim()
    : '';
}

function readCatalogPromotionConfirmationPhrase(
  body: { confirmationPhrase?: unknown } | undefined,
): string {
  return typeof body?.confirmationPhrase === 'string'
    ? body.confirmationPhrase.trim()
    : '';
}

function buildCatalogPromoteRevalidationPaths({
  changedThemeSlugs,
  log,
}: {
  changedThemeSlugs: readonly string[];
  log: FastifyBaseLogger;
}): {
  fallbackMode: boolean;
  paths: string[];
} {
  const basePaths = [webPathnames.home, webPathnames.themes];
  const uniqueChangedThemeSlugs = [...new Set(changedThemeSlugs)].sort(
    (left, right) => left.localeCompare(right),
  );
  const fallbackMode =
    uniqueChangedThemeSlugs.length > MAX_THEME_DETAIL_REVALIDATION_PATHS;

  if (fallbackMode) {
    log.warn(
      {
        changedThemeSlugCount: uniqueChangedThemeSlugs.length,
        changedThemeSlugSample: uniqueChangedThemeSlugs.slice(
          0,
          LOGGED_CHANGED_THEME_SLUG_LIMIT,
        ),
        event: 'broad_theme_revalidation_fallback',
        finalPathCount: basePaths.length,
        maxThemeDetailRevalidationPaths: MAX_THEME_DETAIL_REVALIDATION_PATHS,
        paths: basePaths,
        route: apiPaths.adminCatalogPromotion,
      },
      'Skipping targeted theme detail revalidation after catalog promotion because too many public themes changed.',
    );

    return {
      fallbackMode,
      paths: basePaths,
    };
  }

  const themeDetailPaths = uniqueChangedThemeSlugs.map((slug) =>
    buildThemePath(slug),
  );
  const paths = [...basePaths, ...themeDetailPaths];

  log.info(
    {
      changedThemeSlugCount: uniqueChangedThemeSlugs.length,
      changedThemeSlugSample: uniqueChangedThemeSlugs.slice(
        0,
        LOGGED_CHANGED_THEME_SLUG_LIMIT,
      ),
      fallbackMode,
      finalPathCount: paths.length,
      paths,
      route: apiPaths.adminCatalogPromotion,
    },
    'Catalog promotion public web revalidation targets planned.',
  );

  return {
    fallbackMode,
    paths,
  };
}

function buildCmsPromoteRevalidationTargets({
  affectedCollectionSlugs,
  affectedThemeSlugs,
}: {
  affectedCollectionSlugs: readonly string[];
  affectedThemeSlugs: readonly string[];
}): {
  paths: string[];
  tags: string[];
} {
  const uniqueThemeSlugs = [...new Set(affectedThemeSlugs)].sort(
    (left, right) => left.localeCompare(right),
  );
  const uniqueCollectionSlugs = [...new Set(affectedCollectionSlugs)].sort(
    (left, right) => left.localeCompare(right),
  );

  return {
    paths: [
      webPathnames.home,
      webPathnames.themes,
      ...uniqueThemeSlugs.map((slug) => buildThemePath(slug)),
      ...uniqueCollectionSlugs.map((slug) => `/${slug}`),
    ],
    tags: [
      cacheTags.homepage(),
      cacheTags.themes(),
      cacheTags.collections(),
      ...uniqueThemeSlugs.map((slug) => cacheTags.theme(slug)),
      ...uniqueCollectionSlugs.map((slug) => cacheTags.collection(slug)),
    ],
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function createAdminPromoteRoutes({
  adminPreHandler = createAdminPreHandler(),
  adminPromoteService = createAdminPromoteService(),
  getExpectedAdminSecret = () => getAdminPromotionConfig().secret,
  revalidatePublicWebFn = revalidatePublicWeb,
}: {
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  adminPromoteService?: AdminPromoteService;
  getExpectedAdminSecret?: () => string;
  revalidatePublicWebFn?: RevalidatePublicWebFn;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get<{
      Querystring: { includeCommerceSeeds?: string; includeHeavy?: string };
    }>(
      apiPaths.adminCatalogPromotionPreview,
      {
        preHandler: adminPreHandler,
      },
      async function (request) {
        return adminPromoteService.previewCatalog({
          includeCommerceSeeds: request.query.includeCommerceSeeds === 'true',
          includeHeavy: request.query.includeHeavy === 'true',
        });
      },
    );

    fastify.get(
      apiPaths.adminCmsPromotionPreview,
      {
        preHandler: adminPreHandler,
      },
      async function () {
        return adminPromoteService.previewCms();
      },
    );

    fastify.post<{
      Body: { confirmationPhrase?: unknown } | undefined;
    }>(apiPaths.adminCmsPromotion, async function (request, reply) {
      let expectedAdminSecret: string;

      try {
        expectedAdminSecret = getExpectedAdminSecret();
      } catch (error) {
        request.log.error(
          {
            error,
            route: apiPaths.adminCmsPromotion,
          },
          'CMS promotion is not configured.',
        );

        return reply.status(503).send({
          message: 'CMS promotion is not configured.',
          status: 'error',
        });
      }

      const providedAdminSecret = readAdminSecretHeader(
        request.headers['x-admin-secret'],
      );
      const machineSecretMatches = matchesAdminSecret({
        expectedSecret: expectedAdminSecret,
        providedSecret: providedAdminSecret,
      });
      const authorization = authorizeAdminRequest({
        allowMachineSecret: true,
        getExpectedMachineSecret: () => expectedAdminSecret,
        providedMachineSecret: providedAdminSecret,
        requestPrincipal: request.requestPrincipal,
      });

      if (authorization.authorized === false) {
        return reply.status(authorization.statusCode).send({
          message: machineSecretMatches
            ? authorization.message
            : 'Admin promotion secret is missing or invalid.',
          status: 'error',
        });
      }

      if (
        readCmsPromotionConfirmationPhrase(request.body) !==
        CMS_PROMOTION_CONFIRMATION_PHRASE
      ) {
        return reply.status(400).send({
          message: 'CMS promotion confirmation phrase is missing.',
          status: 'error',
        });
      }

      const result = await adminPromoteService.promoteCms();
      const targets = buildCmsPromoteRevalidationTargets({
        affectedCollectionSlugs: result.affectedCollectionSlugs,
        affectedThemeSlugs: result.affectedThemeSlugs,
      });
      let revalidation: PublicWebRevalidationResult | undefined;
      let revalidationWarning: string | undefined;

      try {
        revalidation = await revalidatePublicWebFn({
          paths: targets.paths,
          reason: 'cms_promote',
          tags: targets.tags,
        });
      } catch (error) {
        revalidationWarning =
          error instanceof Error
            ? error.message
            : 'Public web revalidation failed after CMS promotion.';
        request.log.warn(
          {
            error,
            paths: targets.paths,
            reason: 'cms_promote',
            route: apiPaths.adminCmsPromotion,
            tags: targets.tags,
          },
          'Public web revalidation failed after CMS promotion.',
        );
      }

      request.log.info(
        {
          durationMs: result.durationMs,
          pendingPromoteCount: result.pendingPromoteCount,
          revalidation: {
            attempted: revalidation?.attempted ?? false,
            pathCount: revalidation?.pathCount ?? targets.paths.length,
            paths: revalidation?.paths ?? targets.paths,
            skipped: revalidation?.skipped ?? false,
            tagCount: revalidation?.tagCount ?? targets.tags.length,
            tags: revalidation?.tags ?? targets.tags,
            warning: revalidationWarning,
          },
          route: apiPaths.adminCmsPromotion,
          tables: result.tables,
        },
        'CMS promotion completed.',
      );

      return {
        ...result,
        ...(revalidation ? { revalidation } : {}),
        ...(revalidationWarning ? { revalidationWarning } : {}),
      };
    });

    fastify.post<{
      Body:
        | { confirmationPhrase?: unknown; includeCommerceSeeds?: boolean }
        | undefined;
    }>(apiPaths.adminCatalogPromotion, async function (request, reply) {
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

      const providedAdminSecret = readAdminSecretHeader(
        request.headers['x-admin-secret'],
      );
      const machineSecretMatches = matchesAdminSecret({
        expectedSecret: expectedAdminSecret,
        providedSecret: providedAdminSecret,
      });
      const authorization = authorizeAdminRequest({
        allowMachineSecret: true,
        getExpectedMachineSecret: () => expectedAdminSecret,
        providedMachineSecret: providedAdminSecret,
        requestPrincipal: request.requestPrincipal,
      });

      if (authorization.authorized === false) {
        return reply.status(authorization.statusCode).send({
          message: machineSecretMatches
            ? authorization.message
            : 'Admin promotion secret is missing or invalid.',
          status: 'error',
        });
      }

      if (
        authorization.actor.kind !== 'admin_secret' &&
        readCatalogPromotionConfirmationPhrase(request.body) !==
          CATALOG_PROMOTION_CONFIRMATION_PHRASE
      ) {
        return reply.status(400).send({
          message: 'Catalog promotion confirmation phrase is missing.',
          status: 'error',
        });
      }

      try {
        const result = await adminPromoteService.promoteCatalog({
          includeCommerceSeeds: request.body?.includeCommerceSeeds === true,
        });
        let revalidation: PublicWebRevalidationResult | undefined;
        let revalidationWarning: string | undefined;
        const revalidationPlan = buildCatalogPromoteRevalidationPaths({
          changedThemeSlugs: result.changedThemeSlugs,
          log: request.log,
        });
        const promotedMetadataSetSlugs = uniqueSorted([
          ...(result.promotedMetadataSetSlugs ?? []),
          ...(result.promotedImageMetadataSetSlugs ?? []),
        ]);
        const promotedMetadataSetIds = uniqueSorted([
          ...(result.promotedMetadataSetIds ?? []),
          ...(result.promotedImageMetadataSetIds ?? []),
        ]);
        const promotedMetadataSetPathFallback =
          promotedMetadataSetSlugs.length >
          MAX_PROMOTED_METADATA_SET_REVALIDATION_PATHS;
        const promotedMetadataSetPaths = promotedMetadataSetPathFallback
          ? []
          : promotedMetadataSetSlugs.map((slug) => buildSetDetailPath(slug));
        const revalidationPaths = [
          ...revalidationPlan.paths,
          '/nieuwe-lego-sets',
          '/retiring-lego-sets',
          '/lego-voor-volwassenen',
          ...promotedMetadataSetPaths,
        ];
        const revalidationTags = [
          cacheTags.homepage(),
          cacheTags.themes(),
          cacheTags.collections(),
          cacheTags.collection('nieuwe-lego-sets'),
          cacheTags.collection('retiring-lego-sets'),
          cacheTags.collection('lego-voor-volwassenen'),
          cacheTags.catalog(),
          cacheTags.sets(),
          ...promotedMetadataSetIds.map((setId) => cacheTags.set(setId)),
        ];

        if (promotedMetadataSetPathFallback) {
          request.log.warn(
            {
              maxSetDetailRevalidationPaths:
                MAX_PROMOTED_METADATA_SET_REVALIDATION_PATHS,
              promotedMetadataSetCount: promotedMetadataSetSlugs.length,
              route: apiPaths.adminCatalogPromotion,
            },
            'Skipping targeted set detail revalidation after metadata promotion because too many set paths changed.',
          );
        }

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
            affectedThemes: {
              count:
                result.affectedThemeCount ??
                result.affectedThemeSlugs?.length ??
                result.changedThemeSlugs.length,
              slugs: result.affectedThemeSlugs ?? result.changedThemeSlugs,
            },
            collectionPageSnapshots: {
              bySlug:
                result.collection_page_snapshots_by_slug ??
                result.collectionPageSnapshotsBySlug,
              read:
                result.collection_page_snapshots_read_count ??
                result.collectionPageSnapshotsReadCount,
              upserted:
                result.collection_page_snapshots_upserted_count ??
                result.collectionPageSnapshotsUpsertedCount,
            },
            catalogSetImages: result.catalogSetImages,
            sourceMetadata: {
              bricksetPromoted:
                result.brickset_source_metadata_promoted_count ??
                result.bricksetSourceMetadataPromotedCount,
              eligible:
                result.source_metadata_eligible_count ??
                result.sourceMetadataEligibleCount,
              rakutenPromoted:
                result.rakuten_source_metadata_promoted_count ??
                result.rakutenSourceMetadataPromotedCount,
              read:
                result.source_metadata_read_count ??
                result.sourceMetadataReadCount,
              skipped:
                result.skipped_source_metadata_count ??
                result.skippedSourceMetadataCount,
            },
            revalidation: {
              attempted: revalidation?.attempted ?? false,
              pathCount: revalidation?.pathCount ?? revalidationPaths.length,
              paths: revalidation?.paths ?? revalidationPaths,
              promotedMetadataSetPathFallback,
              themeDetailFallback: revalidationPlan.fallbackMode,
              skipped: revalidation?.skipped ?? false,
              tagCount: revalidation?.tagCount ?? revalidationTags.length,
              tags: revalidation?.tags ?? revalidationTags,
              warning: revalidationWarning,
            },
            route: apiPaths.adminCatalogPromotion,
            tables: result.tables,
            themeSummaryRefresh: result.themeSummaryRefresh,
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
    });
  };
}

export default createAdminPromoteRoutes();
