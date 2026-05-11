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
