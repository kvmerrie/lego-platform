import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import type { PublicWebRevalidationResult } from '@lego-platform/api/data-access-server';
import type { CatalogSetReviewModerationItem } from '@lego-platform/reviews/data-access-server';
import { apiPaths } from '@lego-platform/shared/config';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';
import { createRequestPrincipalPlugin } from '../app/plugins/request-principal';
import {
  createAdminReviewsRoutes,
  type AdminReviewsService,
} from '../app/routes/admin-reviews';

const pendingReview: CatalogSetReviewModerationItem = {
  authorDisplayName: 'Brickhunt-gebruiker',
  createdAt: '2026-06-10T10:00:00.000Z',
  id: 'review-1',
  moderationStatus: 'pending',
  overallRating: 5,
  recommends: true,
  reviewText: 'Sterke skyline voor op een plank.',
  setId: '21066',
  setName: 'New York City',
  setSlug: 'new-york-city-the-big-apple-21066',
  updatedAt: '2026-06-10T10:00:00.000Z',
  userId: 'user-1',
};

async function createAdminReviewsServer({
  adminPreHandler,
  requestPrincipal = {
    email: 'admin@example.test',
    role: 'admin',
    state: 'authenticated',
    userId: 'admin-user',
  },
  reviewsService,
  revalidatePublicWebFn = vi.fn(async ({ paths = [], tags = [] }) => ({
    attempted: true,
    pathCount: paths.length,
    paths,
    skipped: false,
    tagCount: tags.length,
    tags,
  })) as typeof import('@lego-platform/api/data-access-server').revalidatePublicWeb,
}: {
  adminPreHandler?: Parameters<
    typeof createAdminReviewsRoutes
  >[0]['adminPreHandler'];
  requestPrincipal?: RequestPrincipal;
  reviewsService?: AdminReviewsService;
  revalidatePublicWebFn?: typeof import('@lego-platform/api/data-access-server').revalidatePublicWeb;
} = {}) {
  const nextReviewsService: AdminReviewsService = reviewsService ?? {
    listPendingReviews: vi.fn(async () => [pendingReview]),
    moderateReview: vi.fn(async ({ status }) => ({
      previousStatus: 'pending' as const,
      publicReviewChanged: status === 'approved',
      review: {
        ...pendingReview,
        moderationStatus: status,
      },
    })),
  };
  const server = Fastify();

  await server.register(
    createRequestPrincipalPlugin({
      resolveRequestPrincipal: vi.fn(async () => requestPrincipal),
    }),
  );
  await server.register(
    createAdminReviewsRoutes({
      ...(adminPreHandler ? { adminPreHandler } : {}),
      revalidatePublicWebFn,
      reviewsService: nextReviewsService,
    }),
  );

  return {
    revalidatePublicWebFn,
    reviewsService: nextReviewsService,
    server,
  };
}

describe('admin review moderation routes', () => {
  test('rejects non-admin review moderation reads with 403', async () => {
    const { server } = await createAdminReviewsServer({
      requestPrincipal: {
        email: 'collector@example.test',
        state: 'authenticated',
        userId: 'collector-user',
      },
    });

    const response = await server.inject({
      headers: {
        authorization: 'Bearer collector-token',
      },
      method: 'GET',
      url: apiPaths.adminReviews,
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('lists pending reviews for admins', async () => {
    const { reviewsService, server } = await createAdminReviewsServer({
      adminPreHandler: async () => undefined,
    });

    const response = await server.inject({
      method: 'GET',
      url: apiPaths.adminReviews,
    });

    expect(response.statusCode).toBe(200);
    expect(reviewsService.listPendingReviews).toHaveBeenCalled();
    expect(response.json()).toEqual([pendingReview]);

    await server.close();
  });

  test('updates moderation status and revalidates the affected set detail cache', async () => {
    const { revalidatePublicWebFn, reviewsService, server } =
      await createAdminReviewsServer({
        adminPreHandler: async () => undefined,
      });

    const response = await server.inject({
      headers: {
        authorization: 'Bearer admin-token',
      },
      method: 'PATCH',
      payload: {
        moderationReason: 'Past bij de richtlijnen.',
        status: 'approved',
      },
      url: `${apiPaths.adminReviews}/review-1`,
    });

    expect(response.statusCode).toBe(200);
    expect(reviewsService.moderateReview).toHaveBeenCalledWith({
      moderatedByUserId: 'admin-user',
      moderationReason: 'Past bij de richtlijnen.',
      reviewId: 'review-1',
      status: 'approved',
    });
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/sets/new-york-city-the-big-apple-21066'],
      reason: 'admin_review_moderation',
      tags: [
        'reviews',
        'set-reviews:21066',
        'set:21066',
        'set:new-york-city-the-big-apple-21066',
      ],
    });
    expect(response.json()).toMatchObject({
      revalidation: {
        paths: ['/sets/new-york-city-the-big-apple-21066'],
        tags: [
          'reviews',
          'set-reviews:21066',
          'set:21066',
          'set:new-york-city-the-big-apple-21066',
        ],
      },
      review: {
        id: 'review-1',
        moderationStatus: 'approved',
      },
    });

    await server.close();
  });

  test('allows rejected and hidden moderation statuses', async () => {
    const revalidationResult: PublicWebRevalidationResult = {
      attempted: true,
      pathCount: 1,
      paths: ['/sets/new-york-city-the-big-apple-21066'],
      skipped: false,
      tagCount: 4,
      tags: [
        'reviews',
        'set-reviews:21066',
        'set:21066',
        'set:new-york-city-the-big-apple-21066',
      ],
    };
    const { reviewsService, server } = await createAdminReviewsServer({
      adminPreHandler: async () => undefined,
      revalidatePublicWebFn: vi.fn(async () => revalidationResult),
    });

    const rejectResponse = await server.inject({
      headers: {
        authorization: 'Bearer admin-token',
      },
      method: 'PATCH',
      payload: {
        status: 'rejected',
      },
      url: `${apiPaths.adminReviews}/review-1`,
    });
    const hiddenResponse = await server.inject({
      headers: {
        authorization: 'Bearer admin-token',
      },
      method: 'PATCH',
      payload: {
        status: 'hidden',
      },
      url: `${apiPaths.adminReviews}/review-1`,
    });

    expect(rejectResponse.statusCode).toBe(200);
    expect(hiddenResponse.statusCode).toBe(200);
    expect(reviewsService.moderateReview).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' }),
    );
    expect(reviewsService.moderateReview).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'hidden' }),
    );

    await server.close();
  });
});
