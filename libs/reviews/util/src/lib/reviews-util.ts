export const CATALOG_SET_REVIEW_MAX_TEXT_LENGTH = 4_000;
export const CATALOG_SET_REVIEW_PUBLIC_AUTHOR_NAME = 'Brickhunt-gebruiker';

export type CatalogSetReviewModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden';

export interface CatalogSetReviewInput {
  buildExperienceRating?: number | null;
  overallRating: number;
  playExperienceRating?: number | null;
  recommends?: boolean | null;
  reviewText?: string | null;
  valueForMoneyRating?: number | null;
}

export interface CatalogSetReview {
  buildExperienceRating?: number | null;
  id: string;
  setId: string;
  overallRating: number;
  playExperienceRating?: number | null;
  recommends?: boolean | null;
  reviewText?: string;
  valueForMoneyRating?: number | null;
  moderationStatus: CatalogSetReviewModerationStatus;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSetReviewSummary {
  setId: string;
  reviewCount: number;
  averageRating?: number;
  averageBuildExperienceRating?: number;
  averagePlayExperienceRating?: number;
  averageValueForMoneyRating?: number;
  recommendCount: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface CatalogSetReviewsPublicPayload {
  reviews: CatalogSetReview[];
  summary: CatalogSetReviewSummary;
}

export interface CatalogSetReviewsPayload
  extends CatalogSetReviewsPublicPayload {
  ownReview?: CatalogSetReview;
}

export class CatalogSetReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogSetReviewValidationError';
  }
}

export function createEmptyCatalogSetReviewSummary(
  setId: string,
): CatalogSetReviewSummary {
  return {
    averageRating: undefined,
    recommendCount: 0,
    reviewCount: 0,
    ratingDistribution: {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    },
    setId,
  };
}

export function normalizeCatalogSetReviewText(
  value: string | null | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue || undefined;
}

function normalizeOptionalCatalogSetReviewRating(
  value: number | null | undefined,
  label: string,
): number | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new CatalogSetReviewValidationError(
      `${label} moet leeg zijn of een beoordeling van 1 tot en met 5 stenen.`,
    );
  }

  return value;
}

export function normalizeCatalogSetReviewInput(
  input: CatalogSetReviewInput,
): Required<Pick<CatalogSetReviewInput, 'overallRating'>> &
  Pick<
    CatalogSetReviewInput,
    | 'buildExperienceRating'
    | 'playExperienceRating'
    | 'recommends'
    | 'valueForMoneyRating'
  > & {
    reviewText?: string;
  } {
  if (!Number.isInteger(input.overallRating)) {
    throw new CatalogSetReviewValidationError(
      'Kies een beoordeling van 1 tot en met 5 sterren.',
    );
  }

  if (input.overallRating < 1 || input.overallRating > 5) {
    throw new CatalogSetReviewValidationError(
      'Kies een beoordeling van 1 tot en met 5 sterren.',
    );
  }

  const reviewText = normalizeCatalogSetReviewText(input.reviewText);

  if (reviewText && reviewText.length > CATALOG_SET_REVIEW_MAX_TEXT_LENGTH) {
    throw new CatalogSetReviewValidationError(
      `Houd je beoordeling onder ${CATALOG_SET_REVIEW_MAX_TEXT_LENGTH} tekens.`,
    );
  }

  return {
    buildExperienceRating: normalizeOptionalCatalogSetReviewRating(
      input.buildExperienceRating,
      'Bouwervaring',
    ),
    overallRating: input.overallRating,
    playExperienceRating: normalizeOptionalCatalogSetReviewRating(
      input.playExperienceRating,
      'Speelervaring',
    ),
    recommends: typeof input.recommends === 'boolean' ? input.recommends : null,
    valueForMoneyRating: normalizeOptionalCatalogSetReviewRating(
      input.valueForMoneyRating,
      'Waar voor je geld',
    ),
    ...(reviewText ? { reviewText } : {}),
  };
}

export function resolveCatalogSetReviewModerationStatus(
  input: Pick<CatalogSetReviewInput, 'reviewText'>,
): CatalogSetReviewModerationStatus {
  return normalizeCatalogSetReviewText(input.reviewText)
    ? 'pending'
    : 'approved';
}

export const catalogSetReviewsApiPath = '/api/reviews/sets';

export function toCatalogSetReviewApiPath(setId: string): string {
  return `${catalogSetReviewsApiPath}/${encodeURIComponent(setId)}`;
}
