import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
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
  test('accepts a set present only in the active overlay catalog', async () => {
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

  test('rejects a set missing from both snapshot and active overlay', async () => {
    await expect(
      resolveCommerceCatalogSetSummaries({
        setIds: ['72037'],
        listCatalogSetSummariesWithOverlayFn: async () => [],
      }),
    ).rejects.toThrow(
      'Commerce-enabled set 72037 is missing from the current catalog (generated snapshot + active overlay).',
    );
  });

  test('returns merged catalog metadata for overlay-backed commerce sets', async () => {
    const snapshotSetSummary = listCatalogSetSummaries()[0];

    if (!snapshotSetSummary) {
      throw new Error('Expected at least one generated snapshot set in tests.');
    }

    const overlaySetSummary = createCatalogSetSummary({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      pieces: 1972,
    });

    const resolvedSummaries = await resolveCommerceCatalogSetSummaries({
      setIds: [overlaySetSummary.id, snapshotSetSummary.id],
      listCatalogSetSummariesWithOverlayFn: async () => [
        snapshotSetSummary,
        overlaySetSummary,
      ],
    });

    expect(resolvedSummaries).toEqual([overlaySetSummary, snapshotSetSummary]);
    expect(resolvedSummaries[0]).toMatchObject({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
    });
  });
});
