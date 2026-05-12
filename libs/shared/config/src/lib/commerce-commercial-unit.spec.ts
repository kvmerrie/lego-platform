import { describe, expect, test } from 'vitest';
import {
  areCommerceCommercialUnitsComparableForDeals,
  classifyCommerceCommercialUnitType,
  compareCommerceCommercialUnitPreference,
} from './commerce-commercial-unit';

describe('commerce commercial unit config', () => {
  test('classifies display boxes and complete sets deterministically', () => {
    expect(
      classifyCommerceCommercialUnitType({
        productTitle: 'LEGO Minifigures 71050 Complete Serie Random Box',
      }),
    ).toBe('display_box');
    expect(
      classifyCommerceCommercialUnitType({
        productTitle: 'LEGO Icons full set bouwset',
      }),
    ).toBe('full_set');
  });

  test('classifies blind bags and single units separately from displays', () => {
    expect(
      classifyCommerceCommercialUnitType({
        productTitle: 'LEGO 71050 losse minifiguur blind bag 1 stuk',
      }),
    ).toBe('blind_bag');
    expect(
      areCommerceCommercialUnitsComparableForDeals('display_box', 'blind_bag'),
    ).toBe(false);
  });

  test('treats normal LEGO set-number offers as full set packages', () => {
    expect(
      classifyCommerceCommercialUnitType({
        productUrl:
          'https://www.mediamarkt.nl/nl/product/_lego-technic-42177-mercedes-benz-g-500-bouwstenen-1892796.html',
        setId: '42177',
      }),
    ).toBe('full_set');
  });

  test('keeps collectible minifigure series unknown without explicit unit wording', () => {
    expect(
      classifyCommerceCommercialUnitType({
        productUrl:
          'https://www.example.nl/lego-71050-minifiguren-spider-man.html',
        setId: '71050',
      }),
    ).toBe('unknown');
  });

  test('treats unknown unit types as non-comparable for deal claims', () => {
    expect(classifyCommerceCommercialUnitType({ productTitle: '' })).toBe(
      'unknown',
    );
    expect(
      areCommerceCommercialUnitsComparableForDeals('unknown', 'full_set'),
    ).toBe(false);
    expect(compareCommerceCommercialUnitPreference('full_set', 'unknown')).toBe(
      -4,
    );
  });
});
