import { describe, expect, test } from 'vitest';
import {
  getCatalogSetBySlug,
  listCatalogSetSlugs,
  listCatalogSetSummaries,
  listCatalogThemes,
  listHomepageSets,
} from './catalog-data-access';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

describe('catalog snapshot artifacts', () => {
  test('keep the generated snapshot and manifest aligned', () => {
    expect(catalogSnapshot.setRecords).toHaveLength(3);
    expect(catalogSyncManifest.recordCount).toBe(catalogSnapshot.setRecords.length);
    expect(catalogSyncManifest.homepageFeaturedSetIds).toEqual([
      '10316',
      '21348',
      '76269',
    ]);
  });

  test('generated records keep source-normalized slugs and canonical ids', () => {
    expect(
      catalogSnapshot.setRecords.map((catalogSetRecord) => ({
        canonicalId: catalogSetRecord.canonicalId,
        slug: catalogSetRecord.slug,
        sourceSetNumber: catalogSetRecord.sourceSetNumber,
      })),
    ).toEqual([
      {
        canonicalId: '10316',
        slug: 'lord-of-the-rings-rivendell-10316',
        sourceSetNumber: '10316-1',
      },
      {
        canonicalId: '21348',
        slug: 'dungeons-and-dragons-red-dragons-tale-21348',
        sourceSetNumber: '21348-1',
      },
      {
        canonicalId: '76269',
        slug: 'avengers-tower-76269',
        sourceSetNumber: '76269-1',
      },
    ]);
  });
});

describe('catalog data-access contracts', () => {
  test('keeps static params generation stable through product-facing slugs', () => {
    expect(listCatalogSetSlugs()).toEqual([
      'rivendell-10316',
      'dungeons-and-dragons-red-dragons-tale-21348',
      'avengers-tower-76269',
    ]);
  });

  test('merges source-truth records with local product overlays for set detail reads', () => {
    expect(getCatalogSetBySlug('rivendell-10316')).toEqual({
      id: '10316',
      slug: 'rivendell-10316',
      name: 'Rivendell',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 6181,
      priceRange: '$499 to $569',
      collectorAngle: 'Prestige display anchor',
      tagline:
        'A flagship fantasy build that rewards both display space and patience.',
      availability: 'Healthy but premium availability',
      collectorHighlights: [
        'Three-story scene composition with strong shelf presence',
        'Long-term display value thanks to cross-fandom appeal',
        'Excellent candidate for future editorial storytelling',
      ],
    });
  });

  test('keeps homepage summaries stable while allowing source facts to refresh', () => {
    expect(listHomepageSets()).toEqual([
      {
        id: '21348',
        slug: 'dungeons-and-dragons-red-dragons-tale-21348',
        name: "Dungeons & Dragons: Red Dragon's Tale",
        theme: 'Ideas',
        releaseYear: 2024,
        pieces: 3747,
        priceRange: '$359 to $409',
        collectorAngle: 'Crossover audience magnet',
      },
      {
        id: '76269',
        slug: 'avengers-tower-76269',
        name: 'Avengers Tower',
        theme: 'Marvel',
        releaseYear: 2023,
        pieces: 5202,
        priceRange: '$449 to $519',
        collectorAngle: 'Marvel flagship showcase',
      },
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        priceRange: '$499 to $569',
        collectorAngle: 'Prestige display anchor',
      },
    ]);
  });

  test('does not expose upstream slug drift through the product route contract', () => {
    expect(getCatalogSetBySlug('lord-of-the-rings-rivendell-10316')).toBeUndefined();
  });

  test('preserves the full summary read-model and theme snapshots', () => {
    expect(listCatalogSetSummaries()).toHaveLength(3);
    expect(listCatalogThemes()).toEqual([
      {
        name: 'Icons',
        setCount: 14,
        momentum:
          'Premium collectors are consolidating around large display pieces.',
        signatureSet: 'Rivendell',
      },
      {
        name: 'Ideas',
        setCount: 11,
        momentum:
          'Community-voted launches continue to produce sharp launch-week demand.',
        signatureSet: "Dungeons & Dragons: Red Dragon's Tale",
      },
      {
        name: 'Marvel',
        setCount: 23,
        momentum:
          'Licensed tentpoles keep price visibility high and affiliate conversion strong.',
        signatureSet: 'Avengers Tower',
      },
    ]);
  });
});
