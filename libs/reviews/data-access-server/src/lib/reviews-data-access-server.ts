import type { SupabaseClient } from '@supabase/supabase-js';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  CATALOG_SET_REVIEW_PUBLIC_AUTHOR_NAME,
  type CatalogSetReview,
  type CatalogSetReviewInput,
  type CatalogSetReviewModerationStatus,
  type CatalogSetReviewsPayload,
  type CatalogSetReviewsPublicPayload,
  createEmptyCatalogSetReviewSummary,
  normalizeCatalogSetReviewInput,
  resolveCatalogSetReviewModerationStatus,
  type CatalogSetReviewSummary,
} from '@lego-platform/reviews/util';

type ReviewSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogSetReviewRow {
  id: string;
  set_id: string;
  user_id?: string;
  build_experience_rating?: number | null;
  overall_rating: number;
  play_experience_rating?: number | null;
  recommends: boolean | null;
  review_text: string | null;
  value_for_money_rating?: number | null;
  moderation_status: CatalogSetReviewModerationStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface CatalogSetReviewModerationRow extends CatalogSetReviewRow {
  catalog_sets?: {
    name?: string | null;
    set_id?: string | null;
    slug?: string | null;
  } | null;
  moderation_reason?: string | null;
}

interface CatalogSetReviewSummaryRow {
  set_id: string;
  review_count: number;
  average_rating: number | string | null;
  average_build_experience_rating?: number | string | null;
  average_play_experience_rating?: number | string | null;
  average_value_for_money_rating?: number | string | null;
  recommend_count: number | null;
  rating_distribution: Record<string, number> | null;
}

interface CatalogSetSlugRow {
  set_id: string;
  slug: string;
}

export interface CatalogSetReviewModerationItem {
  authorDisplayName: string;
  createdAt: string;
  id: string;
  moderationReason?: string;
  moderationStatus: CatalogSetReviewModerationStatus;
  overallRating: number;
  recommends?: boolean | null;
  reviewText: string;
  setId: string;
  setName: string;
  setSlug?: string;
  updatedAt: string;
  userId: string;
}

export type CatalogSetReviewModerationTargetStatus = Extract<
  CatalogSetReviewModerationStatus,
  'approved' | 'hidden' | 'rejected'
>;

export class CatalogSetReviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogSetReviewAccessError';
  }
}

function getReviewsSupabaseClient(
  supabaseClient?: ReviewSupabaseClient,
): ReviewSupabaseClient | undefined {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!hasServerSupabaseConfig()) {
    return undefined;
  }

  return getServerSupabaseAdminClient();
}

function toCatalogSetReview(row: CatalogSetReviewRow): CatalogSetReview {
  return {
    authorDisplayName: CATALOG_SET_REVIEW_PUBLIC_AUTHOR_NAME,
    buildExperienceRating: row.build_experience_rating,
    createdAt: row.created_at,
    id: row.id,
    moderationStatus: row.moderation_status,
    overallRating: row.overall_rating,
    playExperienceRating: row.play_experience_rating,
    recommends: row.recommends,
    ...(row.review_text ? { reviewText: row.review_text } : {}),
    setId: row.set_id,
    updatedAt: row.updated_at,
    valueForMoneyRating: row.value_for_money_rating,
  };
}

function toCatalogSetReviewModerationItem(
  row: CatalogSetReviewModerationRow,
): CatalogSetReviewModerationItem {
  const catalogSet = row.catalog_sets;

  return {
    authorDisplayName: CATALOG_SET_REVIEW_PUBLIC_AUTHOR_NAME,
    createdAt: row.created_at,
    id: row.id,
    ...(row.moderation_reason
      ? { moderationReason: row.moderation_reason }
      : {}),
    moderationStatus: row.moderation_status,
    overallRating: row.overall_rating,
    recommends: row.recommends,
    reviewText: row.review_text ?? '',
    setId: row.set_id,
    setName: catalogSet?.name ?? row.set_id,
    ...(catalogSet?.slug ? { setSlug: catalogSet.slug } : {}),
    updatedAt: row.updated_at,
    userId: row.user_id ?? '',
  };
}

function toCatalogSetReviewSummary(
  setId: string,
  row: CatalogSetReviewSummaryRow | null | undefined,
  subratingAverages?: Partial<
    Pick<
      CatalogSetReviewSummary,
      | 'averageBuildExperienceRating'
      | 'averagePlayExperienceRating'
      | 'averageValueForMoneyRating'
    >
  >,
): CatalogSetReviewSummary {
  if (!row) {
    return {
      ...createEmptyCatalogSetReviewSummary(setId),
      ...subratingAverages,
    };
  }

  const distribution = row.rating_distribution ?? {};

  return {
    averageRating:
      row.average_rating === null ? undefined : Number(row.average_rating),
    recommendCount: row.recommend_count ?? 0,
    reviewCount: row.review_count,
    ratingDistribution: {
      '1': Number(distribution['1'] ?? 0),
      '2': Number(distribution['2'] ?? 0),
      '3': Number(distribution['3'] ?? 0),
      '4': Number(distribution['4'] ?? 0),
      '5': Number(distribution['5'] ?? 0),
    },
    setId,
    ...subratingAverages,
  };
}

function averageOptionalRating(
  rows: readonly CatalogSetReviewRow[],
  key:
    | 'build_experience_rating'
    | 'play_experience_rating'
    | 'value_for_money_rating',
): number | undefined {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => typeof value === 'number');

  if (!values.length) {
    return undefined;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.round((total / values.length) * 10) / 10;
}

function buildCatalogSetReviewSubratingAverages(
  rows: readonly CatalogSetReviewRow[],
): Partial<
  Pick<
    CatalogSetReviewSummary,
    | 'averageBuildExperienceRating'
    | 'averagePlayExperienceRating'
    | 'averageValueForMoneyRating'
  >
> {
  const averageBuildExperienceRating = averageOptionalRating(
    rows,
    'build_experience_rating',
  );
  const averagePlayExperienceRating = averageOptionalRating(
    rows,
    'play_experience_rating',
  );
  const averageValueForMoneyRating = averageOptionalRating(
    rows,
    'value_for_money_rating',
  );

  return {
    ...(typeof averageBuildExperienceRating === 'number'
      ? { averageBuildExperienceRating }
      : {}),
    ...(typeof averagePlayExperienceRating === 'number'
      ? { averagePlayExperienceRating }
      : {}),
    ...(typeof averageValueForMoneyRating === 'number'
      ? { averageValueForMoneyRating }
      : {}),
  };
}

function isMissingReviewStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const message =
    typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return (
    record.code === 'PGRST205' ||
    message.includes('catalog_set_reviews') ||
    message.includes('catalog_set_review_summaries') ||
    message.includes('schema cache')
  );
}

async function getCatalogSetSlugById({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: ReviewSupabaseClient;
}): Promise<string | undefined> {
  const { data, error } = await supabaseClient
    .from('catalog_sets')
    .select('set_id, slug')
    .eq('set_id', setId)
    .maybeSingle();

  if (error) {
    throw new CatalogSetReviewAccessError(
      `De setgegevens konden niet worden geladen: ${error.message}`,
    );
  }

  return (data as CatalogSetSlugRow | null)?.slug;
}

export async function getCatalogSetReviewsPublicPayload({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: ReviewSupabaseClient;
}): Promise<CatalogSetReviewsPublicPayload> {
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient) {
    return {
      reviews: [],
      summary: createEmptyCatalogSetReviewSummary(setId),
    };
  }

  const [summaryResult, reviewsResult, subratingAveragesResult] =
    await Promise.all([
      activeSupabaseClient
        .from('catalog_set_review_summaries')
        .select(
          'set_id, review_count, average_rating, recommend_count, rating_distribution',
        )
        .eq('set_id', setId)
        .maybeSingle(),
      activeSupabaseClient
        .from('catalog_set_reviews')
        .select(
          'id, set_id, build_experience_rating, overall_rating, play_experience_rating, recommends, review_text, value_for_money_rating, moderation_status, created_at, updated_at',
        )
        .eq('set_id', setId)
        .eq('moderation_status', 'approved')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(6),
      activeSupabaseClient
        .from('catalog_set_reviews')
        .select(
          'build_experience_rating, play_experience_rating, value_for_money_rating',
        )
        .eq('set_id', setId)
        .eq('moderation_status', 'approved')
        .is('deleted_at', null),
    ]);

  if (summaryResult.error) {
    if (isMissingReviewStorageError(summaryResult.error)) {
      return {
        reviews: [],
        summary: createEmptyCatalogSetReviewSummary(setId),
      };
    }

    throw new CatalogSetReviewAccessError(
      `De beoordelingsscore kon niet worden geladen: ${summaryResult.error.message}`,
    );
  }

  if (reviewsResult.error) {
    if (isMissingReviewStorageError(reviewsResult.error)) {
      return {
        reviews: [],
        summary: createEmptyCatalogSetReviewSummary(setId),
      };
    }

    throw new CatalogSetReviewAccessError(
      `De beoordelingen konden niet worden geladen: ${reviewsResult.error.message}`,
    );
  }

  if (subratingAveragesResult.error) {
    if (isMissingReviewStorageError(subratingAveragesResult.error)) {
      return {
        reviews: [],
        summary: createEmptyCatalogSetReviewSummary(setId),
      };
    }

    throw new CatalogSetReviewAccessError(
      `De subratings konden niet worden geladen: ${subratingAveragesResult.error.message}`,
    );
  }

  return {
    reviews: ((reviewsResult.data ?? []) as CatalogSetReviewRow[]).map(
      toCatalogSetReview,
    ),
    summary: toCatalogSetReviewSummary(
      setId,
      summaryResult.data as CatalogSetReviewSummaryRow | null,
      buildCatalogSetReviewSubratingAverages(
        (subratingAveragesResult.data ?? []) as CatalogSetReviewRow[],
      ),
    ),
  };
}

export async function getCatalogSetReviewsPayload({
  setId,
  supabaseClient,
  userId,
}: {
  setId: string;
  supabaseClient?: ReviewSupabaseClient;
  userId?: string;
}): Promise<CatalogSetReviewsPayload> {
  const publicPayload = await getCatalogSetReviewsPublicPayload({
    setId,
    supabaseClient,
  });
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient || !userId) {
    return publicPayload;
  }

  const { data, error } = await activeSupabaseClient
    .from('catalog_set_reviews')
    .select(
      'id, set_id, build_experience_rating, overall_rating, play_experience_rating, recommends, review_text, value_for_money_rating, moderation_status, created_at, updated_at',
    )
    .eq('set_id', setId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new CatalogSetReviewAccessError(
      `Je beoordeling kon niet worden geladen: ${error.message}`,
    );
  }

  return {
    ...publicPayload,
    ...(data
      ? { ownReview: toCatalogSetReview(data as CatalogSetReviewRow) }
      : {}),
  };
}

export async function upsertCatalogSetReview({
  input,
  setId,
  supabaseClient,
  userId,
}: {
  input: CatalogSetReviewInput;
  setId: string;
  supabaseClient?: ReviewSupabaseClient;
  userId: string;
}): Promise<{
  payload: CatalogSetReviewsPayload;
  publicReviewChanged: boolean;
  review: CatalogSetReview;
  setSlug?: string;
}> {
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient) {
    throw new CatalogSetReviewAccessError(
      'Beoordelingen zijn nu niet beschikbaar.',
    );
  }

  const normalizedInput = normalizeCatalogSetReviewInput(input);
  const moderationStatus =
    resolveCatalogSetReviewModerationStatus(normalizedInput);
  const [existingResult, setSlug] = await Promise.all([
    activeSupabaseClient
      .from('catalog_set_reviews')
      .select(
        'id, set_id, build_experience_rating, overall_rating, play_experience_rating, recommends, review_text, value_for_money_rating, moderation_status, created_at, updated_at, deleted_at',
      )
      .eq('set_id', setId)
      .eq('user_id', userId)
      .maybeSingle(),
    getCatalogSetSlugById({ setId, supabaseClient: activeSupabaseClient }),
  ]);

  if (existingResult.error) {
    throw new CatalogSetReviewAccessError(
      `Je bestaande beoordeling kon niet worden geladen: ${existingResult.error.message}`,
    );
  }

  const existingReview = existingResult.data as CatalogSetReviewRow | null;
  const reviewUpsertPayload = {
    ...(typeof normalizedInput.buildExperienceRating !== 'undefined'
      ? { build_experience_rating: normalizedInput.buildExperienceRating }
      : {}),
    deleted_at: null,
    moderation_status: moderationStatus,
    overall_rating: normalizedInput.overallRating,
    ...(typeof normalizedInput.playExperienceRating !== 'undefined'
      ? { play_experience_rating: normalizedInput.playExperienceRating }
      : {}),
    recommends: normalizedInput.recommends ?? null,
    review_text: normalizedInput.reviewText ?? null,
    set_id: setId,
    user_id: userId,
    ...(typeof normalizedInput.valueForMoneyRating !== 'undefined'
      ? { value_for_money_rating: normalizedInput.valueForMoneyRating }
      : {}),
  };
  const { data, error } = await activeSupabaseClient
    .from('catalog_set_reviews')
    .upsert(reviewUpsertPayload, {
      onConflict: 'set_id,user_id',
    })
    .select(
      'id, set_id, build_experience_rating, overall_rating, play_experience_rating, recommends, review_text, value_for_money_rating, moderation_status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new CatalogSetReviewAccessError(
      `Je beoordeling kon niet worden opgeslagen: ${error.message}`,
    );
  }

  const review = toCatalogSetReview(data as CatalogSetReviewRow);
  const publicReviewChanged =
    moderationStatus === 'approved' ||
    existingReview?.moderation_status === 'approved';
  const payload = await getCatalogSetReviewsPayload({
    setId,
    supabaseClient: activeSupabaseClient,
    userId,
  });

  return {
    payload,
    publicReviewChanged,
    review,
    setSlug,
  };
}

export async function softDeleteCatalogSetReview({
  setId,
  supabaseClient,
  userId,
}: {
  setId: string;
  supabaseClient?: ReviewSupabaseClient;
  userId: string;
}): Promise<{ publicReviewChanged: boolean; setSlug?: string }> {
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient) {
    throw new CatalogSetReviewAccessError(
      'Beoordelingen zijn nu niet beschikbaar.',
    );
  }

  const [existingResult, setSlug] = await Promise.all([
    activeSupabaseClient
      .from('catalog_set_reviews')
      .select('moderation_status')
      .eq('set_id', setId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
    getCatalogSetSlugById({ setId, supabaseClient: activeSupabaseClient }),
  ]);

  if (existingResult.error) {
    throw new CatalogSetReviewAccessError(
      `Je beoordeling kon niet worden geladen: ${existingResult.error.message}`,
    );
  }

  const { error } = await activeSupabaseClient
    .from('catalog_set_reviews')
    .update({
      deleted_at: new Date().toISOString(),
      moderation_status: 'hidden',
    })
    .eq('set_id', setId)
    .eq('user_id', userId);

  if (error) {
    throw new CatalogSetReviewAccessError(
      `Je beoordeling kon niet worden verwijderd: ${error.message}`,
    );
  }

  return {
    publicReviewChanged:
      (existingResult.data as { moderation_status?: string } | null)
        ?.moderation_status === 'approved',
    setSlug,
  };
}

function normalizeModerationReason(
  value: string | null | undefined,
): string | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(0, 500);
}

export async function listPendingCatalogSetReviewsForModeration({
  limit = 50,
  supabaseClient,
}: {
  limit?: number;
  supabaseClient?: ReviewSupabaseClient;
} = {}): Promise<CatalogSetReviewModerationItem[]> {
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient) {
    return [];
  }

  const { data, error } = await activeSupabaseClient
    .from('catalog_set_reviews')
    .select(
      'id, set_id, user_id, overall_rating, recommends, review_text, moderation_status, moderation_reason, created_at, updated_at, catalog_sets(set_id, name, slug)',
    )
    .eq('moderation_status', 'pending')
    .not('review_text', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    throw new CatalogSetReviewAccessError(
      `Pending beoordelingen konden niet worden geladen: ${error.message}`,
    );
  }

  return ((data ?? []) as CatalogSetReviewModerationRow[]).map(
    toCatalogSetReviewModerationItem,
  );
}

export async function moderateCatalogSetReview({
  moderatedByUserId,
  moderationReason,
  reviewId,
  status,
  supabaseClient,
}: {
  moderatedByUserId: string;
  moderationReason?: string | null;
  reviewId: string;
  status: CatalogSetReviewModerationTargetStatus;
  supabaseClient?: ReviewSupabaseClient;
}): Promise<{
  previousStatus: CatalogSetReviewModerationStatus;
  publicReviewChanged: boolean;
  review: CatalogSetReviewModerationItem;
}> {
  const activeSupabaseClient = getReviewsSupabaseClient(supabaseClient);

  if (!activeSupabaseClient) {
    throw new CatalogSetReviewAccessError(
      'Beoordelingen zijn nu niet beschikbaar.',
    );
  }

  const allowedStatuses: readonly CatalogSetReviewModerationTargetStatus[] = [
    'approved',
    'hidden',
    'rejected',
  ];

  if (!allowedStatuses.includes(status)) {
    throw new CatalogSetReviewAccessError('Ongeldige moderatiestatus.');
  }

  const selectColumns =
    'id, set_id, user_id, overall_rating, recommends, review_text, moderation_status, moderation_reason, created_at, updated_at, catalog_sets(set_id, name, slug)';
  const existingResult = await activeSupabaseClient
    .from('catalog_set_reviews')
    .select(selectColumns)
    .eq('id', reviewId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingResult.error) {
    throw new CatalogSetReviewAccessError(
      `Beoordeling kon niet worden geladen: ${existingResult.error.message}`,
    );
  }

  if (!existingResult.data) {
    throw new CatalogSetReviewAccessError('Beoordeling niet gevonden.');
  }

  const previousStatus = (existingResult.data as CatalogSetReviewModerationRow)
    .moderation_status;
  const { data, error } = await activeSupabaseClient
    .from('catalog_set_reviews')
    .update({
      moderated_at: new Date().toISOString(),
      moderated_by: moderatedByUserId,
      moderation_reason: normalizeModerationReason(moderationReason),
      moderation_status: status,
    })
    .eq('id', reviewId)
    .is('deleted_at', null)
    .select(selectColumns)
    .single();

  if (error) {
    throw new CatalogSetReviewAccessError(
      `Beoordeling kon niet worden gemodereerd: ${error.message}`,
    );
  }

  return {
    previousStatus,
    publicReviewChanged: previousStatus === 'approved' || status === 'approved',
    review: toCatalogSetReviewModerationItem(
      data as CatalogSetReviewModerationRow,
    ),
  };
}
