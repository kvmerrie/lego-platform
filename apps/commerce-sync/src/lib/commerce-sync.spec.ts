import type { CatalogSetSummary } from '@lego-platform/catalog/util';
import { describe, expect, test } from 'vitest';

import { resolveCommerceCatalogSetSummaries } from './commerce-sync';

function createCatalogSetSummary(
  overrides: Partial<CatalogSetSummary> & Pick<CatalogSetSummary, 'id'>,
): CatalogSetSummary {
  return {
    id: overrides.id,
    slug: overrides.slug ?? `set-${overrides.id}`,
    name: overrides.name ?? `Set ${overrides.id}`,
    theme: overrides.theme ?? 'Icons',
    releaseYear: overrides.releaseYear ?? 2026,
    pieces: overrides.pieces ?? 1000,
    collectorAngle:
      overrides.collectorAngle ??
      'Deze set blijft hangen door een sterke display-uitstraling.',
    imageUrl: overrides.imageUrl,
    images: overrides.images,
    primaryImage: overrides.primaryImage,
  };
}

describe('commerce sync catalog validation', () => {
  test('accepts a set present in the current canonical catalog', async () => {
    const overlaySetSummary = createCatalogSetSummary({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      pieces: 1972,
    });

    await expect(
      resolveCommerceCatalogSetSummaries({
        setIds: [overlaySetSummary.id],
        listCatalogSetSummariesWithOverlayFn: async () => [overlaySetSummary],
      }),
    ).resolves.toEqual([overlaySetSummary]);
  });

  test('rejects a set missing from the current canonical catalog', async () => {
    await expect(
      resolveCommerceCatalogSetSummaries({
        setIds: ['72037'],
        listCatalogSetSummariesWithOverlayFn: async () => [],
      }),
    ).rejects.toThrow(
      'Commerce-enabled set 72037 is missing from the current canonical catalog.',
    );
  });

  test('returns current catalog metadata for commerce-enabled sets', async () => {
    const canonicalSetSummary = createCatalogSetSummary({
      id: '10316',
      slug: 'rivendell-10316',
      name: 'Rivendell',
      theme: 'Icons',
      pieces: 6167,
      releaseYear: 2023,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
    });

    const overlaySetSummary = createCatalogSetSummary({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      pieces: 1972,
    });

    const resolvedSummaries = await resolveCommerceCatalogSetSummaries({
      setIds: [overlaySetSummary.id, canonicalSetSummary.id],
      listCatalogSetSummariesWithOverlayFn: async () => [
        canonicalSetSummary,
        overlaySetSummary,
      ],
    });

    expect(resolvedSummaries).toEqual([overlaySetSummary, canonicalSetSummary]);
    expect(resolvedSummaries[0]).toMatchObject({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
    });
  });
});
