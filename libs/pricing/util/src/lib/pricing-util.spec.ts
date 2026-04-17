import { describe, expect, test } from 'vitest';
import {
  getPriceDealSummary,
  renderPricingObservationsModule,
} from './pricing-util';

describe('pricing util deal summaries', () => {
  test('surfaces a best current deal label with limited coverage copy', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: -2000,
        merchantCount: 2,
      }),
    ).toEqual({
      label: 'Beste deal nu',
      coverageNote: 'Tot nu toe pas 2 reviewed aanbiedingen',
    });
  });

  test('surfaces above-reference guidance without weak coverage copy when coverage is broader', () => {
    expect(
      getPriceDealSummary({
        deltaMinor: 1500,
        merchantCount: 3,
      }),
    ).toEqual({
      label: 'Boven referentie',
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
      label: 'Laagste reviewed aanbieding',
      coverageNote: 'Tot nu toe pas 1 reviewed aanbieding',
    });
  });

  test('renders pricing generated modules in a Prettier-stable shape', async () => {
    const { format } = await import('prettier');
    const renderedModule = renderPricingObservationsModule([
      {
        availability: 'in_stock',
        condition: 'new',
        currencyCode: 'EUR',
        merchantId: 'lego-nl',
        observedAt: '2026-04-03T09:00:00.000Z',
        regionCode: 'NL',
        setId: '10316',
        totalPriceMinor: 49999,
      },
    ]);

    await expect(
      format(renderedModule, {
        parser: 'typescript',
        singleQuote: true,
      }),
    ).resolves.toBe(renderedModule);
  });
});
