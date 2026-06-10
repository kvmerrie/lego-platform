import { describe, expect, it } from 'vitest';
import {
  CatalogSetReviewValidationError,
  catalogSetReviewsApiPath,
  normalizeCatalogSetReviewInput,
  resolveCatalogSetReviewModerationStatus,
  toCatalogSetReviewApiPath,
} from './reviews-util';

describe('reviews util', () => {
  it('auto-approves rating-only reviews', () => {
    expect(resolveCatalogSetReviewModerationStatus({ reviewText: '' })).toBe(
      'approved',
    );
  });

  it('marks reviews with text as pending', () => {
    expect(
      resolveCatalogSetReviewModerationStatus({
        reviewText: 'Top op de plank',
      }),
    ).toBe('pending');
  });

  it('validates rating range', () => {
    expect(() => normalizeCatalogSetReviewInput({ overallRating: 6 })).toThrow(
      CatalogSetReviewValidationError,
    );
  });

  it('builds the canonical set reviews API route used by browser clients', () => {
    expect(catalogSetReviewsApiPath).toBe('/api/reviews/sets');
    expect(toCatalogSetReviewApiPath('21066')).toBe('/api/reviews/sets/21066');
  });
});
