import { describe, expect, test } from 'vitest';
import { buildCatalogMerchantPresentation } from './catalog-merchant-presentation';

describe('catalog merchant presentation', () => {
  test.each([
    ['lowest-current', 'Laagst bij Proshop'],
    ['selected-price', 'Prijs bij Proshop'],
    ['availability', 'Verkrijgbaar bij Proshop'],
    ['only-found', 'Alleen gevonden bij Proshop'],
    ['reviewed-lowest', 'Laagste reviewed prijs bij Proshop'],
    ['plain', 'Proshop'],
  ] as const)('maps %s claims to %s', (claim, label) => {
    expect(
      buildCatalogMerchantPresentation({
        claim,
        merchantName: 'Proshop',
        merchantSlug: 'proshop',
      }),
    ).toEqual({
      claim,
      label,
      merchantName: 'Proshop',
      merchantSlug: 'proshop',
      prefix: claim === 'plain' ? '' : label.replace(/\sProshop$/u, ''),
    });
  });
});
