import { describe, expect, test } from 'vitest';
import { getPriceDealSummary } from './pricing-util';

describe('pricing util deal summaries', () => {
  test('surfaces a best current deal label with limited coverage copy', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: -2000,
        merchantCount: 2,
      }),
    ).toEqual({
      label: 'Best current deal',
      coverageNote: 'Only 2 reviewed offers so far',
    });
  });

  test('surfaces above-reference guidance without weak coverage copy when coverage is broader', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: 1500,
        merchantCount: 3,
      }),
    ).toEqual({
      label: 'Above reference',
      coverageNote: undefined,
    });
  });

  test('falls back to lowest reviewed offer when no reference price exists yet', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: undefined,
        merchantCount: 1,
      }),
    ).toEqual({
      label: 'Lowest reviewed offer',
      coverageNote: 'Only 1 reviewed offer so far',
    });
  });
});
