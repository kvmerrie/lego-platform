import {
  revalidatePublicWeb,
  type PublicWebRevalidationResult,
} from '@lego-platform/api/data-access-server';
import {
  listPendingCatalogSetReviewsForModeration,
  moderateCatalogSetReview,
  type CatalogSetReviewModerationItem,
  type CatalogSetReviewModerationTargetStatus,
} from '@lego-platform/reviews/data-access-server';
import {
  apiPaths,
  buildSetDetailPath,
  cacheTags,
  normalizeCacheTags,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import { createAdminPreHandler } from '../lib/admin-authorization';

export interface AdminReviewsService {
  listPendingReviews(): Promise<CatalogSetReviewModerationItem[]>;
  moderateReview(input: {
    moderatedByUserId: string;
    moderationReason?: string | null;
    reviewId: string;
    status: CatalogSetReviewModerationTargetStatus;
  }): Promise<Awaited<ReturnType<typeof moderateCatalogSetReview>>>;
}

interface AdminReviewModerationBody {
  moderationReason?: unknown;
  status?: unknown;
}

interface AdminReviewModerationResponse {
  revalidation: {
    paths: readonly string[];
    result: PublicWebRevalidationResult;
    tags: readonly string[];
  };
  review: CatalogSetReviewModerationItem;
}

function createAdminReviewsService(): AdminReviewsService {
  return {
    listPendingReviews: () => listPendingCatalogSetReviewsForModeration(),
    moderateReview: (input) => moderateCatalogSetReview(input),
  };
}

function readModerationBody(body: AdminReviewModerationBody): {
  moderationReason?: string | null;
  status: CatalogSetReviewModerationTargetStatus;
} {
  const status = body.status;

  if (status !== 'approved' && status !== 'hidden' && status !== 'rejected') {
    throw new Error('Kies approved, rejected of hidden als status.');
  }

  const moderationReason =
    typeof body.moderationReason === 'string' ? body.moderationReason : null;

  return {
    moderationReason,
    status,
  };
}

function buildReviewModerationRevalidationTargets(
  review: CatalogSetReviewModerationItem,
): {
  paths: readonly string[];
  tags: readonly string[];
} {
  const paths = review.setSlug ? [buildSetDetailPath(review.setSlug)] : [];
  const tags = normalizeCacheTags([
    cacheTags.reviews(),
    cacheTags.setReviews(review.setId),
    cacheTags.set(review.setId),
    ...(review.setSlug ? [cacheTags.set(review.setSlug)] : []),
  ]);

  return {
    paths,
    tags,
  };
}

export function createAdminReviewsRoutes({
  adminPreHandler = createAdminPreHandler(),
  revalidatePublicWebFn = revalidatePublicWeb,
  reviewsService = createAdminReviewsService(),
}: {
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
  reviewsService?: AdminReviewsService;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(
      apiPaths.adminReviews,
      {
        preHandler: adminPreHandler,
      },
      async function () {
        return reviewsService.listPendingReviews();
      },
    );

    fastify.patch<{
      Body: AdminReviewModerationBody;
      Params: { reviewId: string };
    }>(
      `${apiPaths.adminReviews}/:reviewId`,
      {
        preHandler: adminPreHandler,
      },
      async function (request, reply): Promise<AdminReviewModerationResponse> {
        const principal = request.requestPrincipal;

        if (principal?.state !== 'authenticated') {
          return reply.status(401).send({
            message: 'Admin authentication is required.',
            status: 'error',
          }) as never;
        }

        let moderationInput: ReturnType<typeof readModerationBody>;

        try {
          moderationInput = readModerationBody(request.body ?? {});
        } catch (error) {
          return reply.status(400).send({
            message:
              error instanceof Error
                ? error.message
                : 'Ongeldige reviewmoderatie.',
            status: 'error',
          }) as never;
        }

        const result = await reviewsService.moderateReview({
          moderatedByUserId: principal.userId,
          moderationReason: moderationInput.moderationReason,
          reviewId: request.params.reviewId,
          status: moderationInput.status,
        });
        const revalidationTargets = buildReviewModerationRevalidationTargets(
          result.review,
        );
        const revalidationResult = await revalidatePublicWebFn({
          paths: revalidationTargets.paths,
          reason: 'admin_review_moderation',
          tags: revalidationTargets.tags,
        });

        request.log.info(
          {
            pathCount: revalidationTargets.paths.length,
            paths: revalidationTargets.paths,
            reviewId: result.review.id,
            setId: result.review.setId,
            setSlug: result.review.setSlug,
            status: result.review.moderationStatus,
            tagCount: revalidationTargets.tags.length,
            tags: revalidationTargets.tags,
          },
          'Admin review moderation revalidated public set detail cache.',
        );

        return {
          revalidation: {
            paths: revalidationTargets.paths,
            result: revalidationResult,
            tags: revalidationTargets.tags,
          },
          review: result.review,
        };
      },
    );
  };
}

export default createAdminReviewsRoutes();
