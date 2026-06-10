import { describe, expect, it, vi } from 'vitest';
import {
  getCatalogSetReviewsPublicPayload,
  listPendingCatalogSetReviewsForModeration,
  moderateCatalogSetReview,
  upsertCatalogSetReview,
} from './reviews-data-access-server';

function createQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  const chain = () => query;

  query.select = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.is = vi.fn(chain);
  query.not = vi.fn(chain);
  query.order = vi.fn(chain);
  query.limit = vi.fn(chain);
  query.update = vi.fn(chain);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  query.then = vi.fn((onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected),
  );

  return query;
}

describe('reviews data access server', () => {
  it('stores rating-only reviews as approved', async () => {
    const upsert = vi.fn(() =>
      createQuery({
        data: {
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'approved',
          overall_rating: 5,
          recommends: true,
          review_text: null,
          set_id: '10316',
          updated_at: '2026-06-10T10:00:00Z',
        },
        error: null,
      }),
    );
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_reviews') {
        const selectQuery = createQuery({ data: null, error: null });

        return {
          ...selectQuery,
          upsert,
        };
      }

      if (table === 'catalog_sets') {
        return createQuery({
          data: { set_id: '10316', slug: 'rivendell-10316' },
          error: null,
        });
      }

      return createQuery({ data: null, error: null });
    });

    await upsertCatalogSetReview({
      input: { overallRating: 5, recommends: true },
      setId: '10316',
      supabaseClient: { from } as never,
      userId: 'user-1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        moderation_status: 'approved',
        review_text: null,
      }),
      { onConflict: 'set_id,user_id' },
    );
  });

  it('stores optional subratings when they are provided', async () => {
    const upsert = vi.fn(() =>
      createQuery({
        data: {
          build_experience_rating: 5,
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'approved',
          overall_rating: 5,
          play_experience_rating: 4,
          recommends: true,
          review_text: null,
          set_id: '10316',
          updated_at: '2026-06-10T10:00:00Z',
          value_for_money_rating: 3,
        },
        error: null,
      }),
    );
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_reviews') {
        const selectQuery = createQuery({ data: null, error: null });

        return {
          ...selectQuery,
          upsert,
        };
      }

      if (table === 'catalog_sets') {
        return createQuery({
          data: { set_id: '10316', slug: 'rivendell-10316' },
          error: null,
        });
      }

      return createQuery({ data: null, error: null });
    });

    await upsertCatalogSetReview({
      input: {
        buildExperienceRating: 5,
        overallRating: 5,
        playExperienceRating: 4,
        recommends: true,
        valueForMoneyRating: 3,
      },
      setId: '10316',
      supabaseClient: { from } as never,
      userId: 'user-1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        build_experience_rating: 5,
        play_experience_rating: 4,
        value_for_money_rating: 3,
      }),
      { onConflict: 'set_id,user_id' },
    );
  });

  it('stores explicitly empty subratings as null', async () => {
    const upsert = vi.fn(() =>
      createQuery({
        data: {
          build_experience_rating: null,
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'approved',
          overall_rating: 5,
          play_experience_rating: null,
          recommends: true,
          review_text: null,
          set_id: '10316',
          updated_at: '2026-06-10T10:00:00Z',
          value_for_money_rating: null,
        },
        error: null,
      }),
    );
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_reviews') {
        const selectQuery = createQuery({ data: null, error: null });

        return {
          ...selectQuery,
          upsert,
        };
      }

      if (table === 'catalog_sets') {
        return createQuery({
          data: { set_id: '10316', slug: 'rivendell-10316' },
          error: null,
        });
      }

      return createQuery({ data: null, error: null });
    });

    await upsertCatalogSetReview({
      input: {
        buildExperienceRating: null,
        overallRating: 5,
        playExperienceRating: null,
        recommends: true,
        valueForMoneyRating: null,
      },
      setId: '10316',
      supabaseClient: { from } as never,
      userId: 'user-1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        build_experience_rating: null,
        play_experience_rating: null,
        value_for_money_rating: null,
      }),
      { onConflict: 'set_id,user_id' },
    );
  });

  it('does not overwrite subratings for legacy update payloads without subrating fields', async () => {
    const upsert = vi.fn(() =>
      createQuery({
        data: {
          build_experience_rating: 5,
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'approved',
          overall_rating: 4,
          play_experience_rating: 4,
          recommends: true,
          review_text: null,
          set_id: '10316',
          updated_at: '2026-06-10T10:00:00Z',
          value_for_money_rating: 3,
        },
        error: null,
      }),
    );
    let catalogSetReviewsCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_reviews') {
        catalogSetReviewsCallCount += 1;

        if (catalogSetReviewsCallCount > 2) {
          return createQuery({ data: [], error: null });
        }

        const selectQuery = createQuery({
          data: {
            build_experience_rating: 5,
            created_at: '2026-06-10T10:00:00Z',
            deleted_at: null,
            id: 'review-1',
            moderation_status: 'approved',
            overall_rating: 5,
            play_experience_rating: 4,
            recommends: true,
            review_text: null,
            set_id: '10316',
            updated_at: '2026-06-10T10:00:00Z',
            value_for_money_rating: 3,
          },
          error: null,
        });

        return {
          ...selectQuery,
          upsert,
        };
      }

      if (table === 'catalog_sets') {
        return createQuery({
          data: { set_id: '10316', slug: 'rivendell-10316' },
          error: null,
        });
      }

      return createQuery({ data: null, error: null });
    });

    await upsertCatalogSetReview({
      input: {
        overallRating: 4,
        recommends: true,
      },
      setId: '10316',
      supabaseClient: { from } as never,
      userId: 'user-1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        build_experience_rating: expect.anything(),
        play_experience_rating: expect.anything(),
        value_for_money_rating: expect.anything(),
      }),
      { onConflict: 'set_id,user_id' },
    );
  });

  it('stores reviews with text as pending', async () => {
    const upsert = vi.fn(() =>
      createQuery({
        data: {
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'pending',
          overall_rating: 4,
          recommends: true,
          review_text: 'Sterk displaymodel.',
          set_id: '10316',
          updated_at: '2026-06-10T10:00:00Z',
        },
        error: null,
      }),
    );
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_reviews') {
        const selectQuery = createQuery({ data: null, error: null });

        return {
          ...selectQuery,
          upsert,
        };
      }

      if (table === 'catalog_sets') {
        return createQuery({
          data: { set_id: '10316', slug: 'rivendell-10316' },
          error: null,
        });
      }

      return createQuery({ data: null, error: null });
    });

    await upsertCatalogSetReview({
      input: {
        overallRating: 4,
        recommends: true,
        reviewText: 'Sterk displaymodel.',
      },
      setId: '10316',
      supabaseClient: { from } as never,
      userId: 'user-1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        moderation_status: 'pending',
        review_text: 'Sterk displaymodel.',
      }),
      { onConflict: 'set_id,user_id' },
    );
  });

  it('lists pending text reviews for admin moderation', async () => {
    const query = createQuery({
      data: [
        {
          catalog_sets: {
            name: 'New York City',
            set_id: '21066',
            slug: 'new-york-city-the-big-apple-21066',
          },
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_reason: null,
          moderation_status: 'pending',
          overall_rating: 4,
          recommends: true,
          review_text: 'Sterke skyline voor op een plank.',
          set_id: '21066',
          updated_at: '2026-06-10T10:00:00Z',
          user_id: 'user-1',
        },
      ],
      error: null,
    });
    const from = vi.fn(() => query);

    const reviews = await listPendingCatalogSetReviewsForModeration({
      supabaseClient: { from } as never,
    });

    expect(query.eq).toHaveBeenCalledWith('moderation_status', 'pending');
    expect(query.not).toHaveBeenCalledWith('review_text', 'is', null);
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(reviews).toEqual([
      expect.objectContaining({
        authorDisplayName: 'Brickhunt-gebruiker',
        id: 'review-1',
        reviewText: 'Sterke skyline voor op een plank.',
        setId: '21066',
        setName: 'New York City',
        setSlug: 'new-york-city-the-big-apple-21066',
        userId: 'user-1',
      }),
    ]);
  });

  it('updates moderation status and stores moderator metadata', async () => {
    const selectQuery = createQuery({
      data: {
        catalog_sets: {
          name: 'New York City',
          set_id: '21066',
          slug: 'new-york-city-the-big-apple-21066',
        },
        created_at: '2026-06-10T10:00:00Z',
        id: 'review-1',
        moderation_reason: null,
        moderation_status: 'pending',
        overall_rating: 5,
        recommends: true,
        review_text: 'Mooi displaymodel.',
        set_id: '21066',
        updated_at: '2026-06-10T10:00:00Z',
        user_id: 'user-1',
      },
      error: null,
    });
    const update = vi.fn(() =>
      createQuery({
        data: {
          catalog_sets: {
            name: 'New York City',
            set_id: '21066',
            slug: 'new-york-city-the-big-apple-21066',
          },
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_reason: 'Past bij de richtlijnen.',
          moderation_status: 'approved',
          overall_rating: 5,
          recommends: true,
          review_text: 'Mooi displaymodel.',
          set_id: '21066',
          updated_at: '2026-06-10T10:05:00Z',
          user_id: 'user-1',
        },
        error: null,
      }),
    );
    const from = vi.fn(() => ({
      ...selectQuery,
      update,
    }));

    const result = await moderateCatalogSetReview({
      moderatedByUserId: 'admin-user',
      moderationReason: ' Past bij de richtlijnen. ',
      reviewId: 'review-1',
      status: 'approved',
      supabaseClient: { from } as never,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        moderated_by: 'admin-user',
        moderation_reason: 'Past bij de richtlijnen.',
        moderation_status: 'approved',
      }),
    );
    expect(result.publicReviewChanged).toBe(true);
    expect(result.review).toEqual(
      expect.objectContaining({
        moderationReason: 'Past bij de richtlijnen.',
        moderationStatus: 'approved',
        setSlug: 'new-york-city-the-big-apple-21066',
      }),
    );
  });

  it('loads public summaries from approved non-deleted reviews only', async () => {
    const summaryQuery = createQuery({
      data: {
        average_rating: 5,
        rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 },
        recommend_count: 1,
        review_count: 1,
        set_id: '21066',
      },
      error: null,
    });
    const reviewsQuery = createQuery({
      data: [
        {
          created_at: '2026-06-10T10:00:00Z',
          id: 'review-1',
          moderation_status: 'approved',
          overall_rating: 5,
          recommends: true,
          review_text: 'Mooi displaymodel.',
          set_id: '21066',
          updated_at: '2026-06-10T10:00:00Z',
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === 'catalog_set_review_summaries' ? summaryQuery : reviewsQuery,
    );

    const payload = await getCatalogSetReviewsPublicPayload({
      setId: '21066',
      supabaseClient: { from } as never,
    });

    expect(reviewsQuery.eq).toHaveBeenCalledWith(
      'moderation_status',
      'approved',
    );
    expect(reviewsQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(payload.summary.reviewCount).toBe(1);
    expect(payload.reviews).toHaveLength(1);
  });

  it('calculates subrating averages from approved reviews and ignores null values', async () => {
    const summaryQuery = createQuery({
      data: {
        average_rating: 4.8,
        rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 4 },
        recommend_count: 5,
        review_count: 5,
        set_id: '21066',
      },
      error: null,
    });
    const reviewsQuery = createQuery({
      data: [],
      error: null,
    });
    const subratingQuery = createQuery({
      data: [
        {
          build_experience_rating: 5,
          play_experience_rating: 4,
          value_for_money_rating: null,
        },
        {
          build_experience_rating: 4,
          play_experience_rating: null,
          value_for_money_rating: 3,
        },
        {
          build_experience_rating: null,
          play_experience_rating: 5,
          value_for_money_rating: 5,
        },
      ],
      error: null,
    });
    let catalogSetReviewsCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === 'catalog_set_review_summaries') {
        return summaryQuery;
      }

      catalogSetReviewsCallCount += 1;

      return catalogSetReviewsCallCount === 1 ? reviewsQuery : subratingQuery;
    });

    const payload = await getCatalogSetReviewsPublicPayload({
      setId: '21066',
      supabaseClient: { from } as never,
    });

    expect(subratingQuery.eq).toHaveBeenCalledWith(
      'moderation_status',
      'approved',
    );
    expect(subratingQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(payload.summary.averageBuildExperienceRating).toBe(4.5);
    expect(payload.summary.averagePlayExperienceRating).toBe(4.5);
    expect(payload.summary.averageValueForMoneyRating).toBe(4);
  });
});
