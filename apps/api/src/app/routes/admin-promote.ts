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
import { getCatalogCollectionLandingPageConfig } from '@lego-platform/catalog/util';
import {
  apiPaths,
  buildCatalogSetDetailCacheTags,
  buildSetDetailPath,
  buildThemePath,
  cacheTags,
  getAdminPromotionConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import {
  authorizeAdminRequest,
  createAdminPreHandler,
} from '../lib/admin-authorization';

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
      ...uniqueCollectionSlugs.flatMap((slug) =>
        buildCatalogCollectionRevalidationPaths(slug),
      ),
    ],
    tags: [
      cacheTags.homepage(),
      cacheTags.themes(),
      cacheTags.collections(),
      ...(uniqueCollectionSlugs.length > 0
        ? [cacheTags.catalog(), cacheTags.sets()]
        : []),
      ...uniqueThemeSlugs.map((slug) => cacheTags.theme(slug)),
      ...uniqueCollectionSlugs.map((slug) => cacheTags.collection(slug)),
    ],
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildCatalogCollectionRevalidationPaths(slug: string): string[] {
  const config = getCatalogCollectionLandingPageConfig(slug);

  return uniqueSorted([config?.canonicalPath ?? `/${slug}`, `/${slug}`]);
}

function buildPromotedSetTargets({
  promotedImageMetadataSetIds = [],
  promotedImageMetadataSetSlugs = [],
  promotedMetadataSetIds = [],
  promotedMetadataSetSlugs = [],
}: Pick<
  CatalogPromotionResult,
  | 'promotedImageMetadataSetIds'
  | 'promotedImageMetadataSetSlugs'
  | 'promotedMetadataSetIds'
  | 'promotedMetadataSetSlugs'
>): Array<{ setId?: string; slug: string }> {
  const bySlug = new Map<string, { setId?: string; slug: string }>();
  const addTargets = (slugs: readonly string[], setIds: readonly string[]) => {
    slugs.forEach((slug, index) => {
      if (!slug) {
        return;
      }

      const existingTarget = bySlug.get(slug);
      const setId = setIds[index];

      bySlug.set(slug, {
        setId: existingTarget?.setId ?? setId,
        slug,
      });
    });
  };

  addTargets(promotedMetadataSetSlugs, promotedMetadataSetIds);
  addTargets(promotedImageMetadataSetSlugs, promotedImageMetadataSetIds);

  return [...bySlug.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}

function buildCatalogPromoteRevalidationTargets({
  result,
}: {
  result: CatalogPromotionResult;
}): {
  diagnostics: {
    affected_collection_slugs: string[];
    affected_theme_slugs: string[];
    homepage_affected: boolean;
    promoted_set_count: number;
    revalidated_paths_count: number;
    revalidated_tags_count: number;
    sample_paths: string[];
    sample_tags: string[];
  };
  paths: string[];
  promotedSetTargets: Array<{ setId?: string; slug: string }>;
  tags: string[];
} {
  const promotedSetTargets = buildPromotedSetTargets(result);
  const changedThemeSlugs = uniqueSorted(result.changedThemeSlugs);
  const changedCollectionSlugs = uniqueSorted(
    result.changedCollectionPageSnapshotSlugs ?? [],
  );
  const homepageAffected = result.homepageAffected === true;
  const paths = uniqueSorted([
    ...(homepageAffected ? [webPathnames.home] : []),
    ...(changedThemeSlugs.length > 0 ? [webPathnames.themes] : []),
    ...changedThemeSlugs.map((slug) => buildThemePath(slug)),
    ...changedCollectionSlugs.flatMap((slug) =>
      buildCatalogCollectionRevalidationPaths(slug),
    ),
    ...promotedSetTargets.map((target) => buildSetDetailPath(target.slug)),
  ]);
  const tags = uniqueSorted([
    ...(homepageAffected ? [cacheTags.homepage()] : []),
    ...(changedThemeSlugs.length > 0 ? [cacheTags.themes()] : []),
    ...changedThemeSlugs.map((slug) => cacheTags.theme(slug)),
    ...(changedCollectionSlugs.length > 0 ? [cacheTags.collections()] : []),
    ...(changedCollectionSlugs.length > 0 ? [cacheTags.catalog()] : []),
    ...changedCollectionSlugs.map((slug) => cacheTags.collection(slug)),
    ...(changedCollectionSlugs.length > 0 || promotedSetTargets.length > 0
      ? [cacheTags.sets()]
      : []),
    ...promotedSetTargets.flatMap((target) =>
      buildCatalogSetDetailCacheTags({
        setId: target.setId,
        slug: target.slug,
      }),
    ),
  ]);

  return {
    diagnostics: {
      affected_collection_slugs: changedCollectionSlugs,
      affected_theme_slugs: changedThemeSlugs,
      homepage_affected: homepageAffected,
      promoted_set_count: promotedSetTargets.length,
      revalidated_paths_count: paths.length,
      revalidated_tags_count: tags.length,
      sample_paths: paths.slice(0, LOGGED_CHANGED_THEME_SLUG_LIMIT),
      sample_tags: tags.slice(0, LOGGED_CHANGED_THEME_SLUG_LIMIT),
    },
    paths,
    promotedSetTargets,
    tags,
  };
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
        const revalidationTargets = buildCatalogPromoteRevalidationTargets({
          result,
        });
        const revalidationPaths = revalidationTargets.paths;
        const revalidationTags = revalidationTargets.tags;
        const setDetailRevalidationSamples =
          revalidationTargets.promotedSetTargets
            .slice(0, LOGGED_CHANGED_THEME_SLUG_LIMIT)
            .map((target) => ({
              path: buildSetDetailPath(target.slug),
              setId: target.setId ?? null,
              tags: buildCatalogSetDetailCacheTags({
                setId: target.setId,
                slug: target.slug,
              }),
            }));

        request.log.info(
          {
            reason: 'catalog_promote',
            revalidationDiagnostics: revalidationTargets.diagnostics,
            route: apiPaths.adminCatalogPromotion,
            setDetailRevalidationSamples,
          },
          'Catalog promote revalidation targets planned.',
        );

        if (revalidationPaths.length > 0 || revalidationTags.length > 0) {
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
              diagnostics: revalidationTargets.diagnostics,
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
          catalogPromoteRevalidation: revalidationTargets.diagnostics,
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
