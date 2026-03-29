import { describe, expect, test } from 'vitest';
import {
  getCatalogSetBySlug,
  listCatalogSetCardsByIds,
  listCatalogSetSlugs,
  listHomepageSetCards,
  listCatalogSetSummaries,
  listCatalogThemes,
  listHomepageSets,
} from './catalog-data-access';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

describe('catalog snapshot artifacts', () => {
  test('keep the generated snapshot and manifest aligned', () => {
    expect(catalogSnapshot.setRecords).toHaveLength(7);
    expect(catalogSyncManifest.recordCount).toBe(
      catalogSnapshot.setRecords.length,
    );
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
      {
        canonicalId: '10305',
        slug: 'lion-knights-castle-10305',
        sourceSetNumber: '10305-1',
      },
      {
        canonicalId: '21338',
        slug: 'a-frame-cabin-21338',
        sourceSetNumber: '21338-1',
      },
      {
        canonicalId: '10320',
        slug: 'eldorado-fortress-10320',
        sourceSetNumber: '10320-1',
      },
      {
        canonicalId: '21335',
        slug: 'motorized-lighthouse-21335',
        sourceSetNumber: '21335-1',
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
      'lion-knights-castle-10305',
      'a-frame-cabin-21338',
      'eldorado-fortress-10320',
      'motorized-lighthouse-21335',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
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
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
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
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
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
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        priceRange: '$499 to $569',
        collectorAngle: 'Prestige display anchor',
      },
    ]);
  });

  test('builds richer homepage card reads with curated availability and tagline context', () => {
    expect(listHomepageSetCards()).toEqual([
      {
        id: '21348',
        slug: 'dungeons-and-dragons-red-dragons-tale-21348',
        name: "Dungeons & Dragons: Red Dragon's Tale",
        theme: 'Ideas',
        releaseYear: 2024,
        pieces: 3747,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
        priceRange: '$359 to $409',
        collectorAngle: 'Crossover audience magnet',
        tagline:
          'A community-driven release with rich minifigure storytelling hooks.',
        availability: 'Strong launch momentum',
      },
      {
        id: '76269',
        slug: 'avengers-tower-76269',
        name: 'Avengers Tower',
        theme: 'Marvel',
        releaseYear: 2023,
        pieces: 5202,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        priceRange: '$449 to $519',
        collectorAngle: 'Marvel flagship showcase',
        tagline: 'A marquee licensed set with broad household recognizability.',
        availability: 'Stable with strong seasonal demand',
      },
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        priceRange: '$499 to $569',
        collectorAngle: 'Prestige display anchor',
        tagline:
          'A flagship fantasy build that rewards both display space and patience.',
        availability: 'Healthy but premium availability',
      },
    ]);
  });

  test('maps curated ids to card-ready reads while skipping ids outside the public catalog slice', () => {
    expect(listCatalogSetCardsByIds(['76269', 'missing-set', '10316'])).toEqual(
      [
        {
          id: '76269',
          slug: 'avengers-tower-76269',
          name: 'Avengers Tower',
          theme: 'Marvel',
          releaseYear: 2023,
          pieces: 5202,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
          priceRange: '$449 to $519',
          collectorAngle: 'Marvel flagship showcase',
          tagline:
            'A marquee licensed set with broad household recognizability.',
          availability: 'Stable with strong seasonal demand',
        },
        {
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          priceRange: '$499 to $569',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        },
      ],
    );
  });

  test('does not expose upstream slug drift through the product route contract', () => {
    expect(
      getCatalogSetBySlug('lord-of-the-rings-rivendell-10316'),
    ).toBeUndefined();
  });

  test('keeps newly curated sets product-ready through local overlay coverage', () => {
    expect(getCatalogSetBySlug('lion-knights-castle-10305')).toEqual({
      id: '10305',
      slug: 'lion-knights-castle-10305',
      name: "Lion Knights' Castle",
      theme: 'Icons',
      releaseYear: 2022,
      pieces: 4515,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10305-1/152495.jpg',
      priceRange: '$359 to $429',
      collectorAngle: 'Castle nostalgia tentpole',
      tagline:
        'A modern fortress build that lands squarely at the intersection of nostalgia and display value.',
      availability: 'Steady premium demand',
      collectorHighlights: [
        'Strong crossover appeal between adult nostalgia and fantasy display buyers',
        'High perceived value thanks to dense build volume and minifigure count',
        'Excellent anchor set for long-form editorial and collection storytelling',
      ],
    });

    expect(getCatalogSetBySlug('a-frame-cabin-21338')).toEqual({
      id: '21338',
      slug: 'a-frame-cabin-21338',
      name: 'A-Frame Cabin',
      theme: 'Ideas',
      releaseYear: 2023,
      pieces: 2083,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21338-1/116515.jpg',
      priceRange: '$179 to $239',
      collectorAngle: 'Cabin-core conversation piece',
      tagline:
        'A warmly detailed display set with broad shelf appeal beyond traditional franchise collectors.',
      availability: 'Consistent enthusiast pull',
      collectorHighlights: [
        'Display-friendly footprint with strong giftability and crossover appeal',
        'Distinct silhouette helps diversify a curated premium set assortment',
        'Useful test case for editorial storytelling beyond licensed fandoms',
      ],
    });

    expect(getCatalogSetBySlug('eldorado-fortress-10320')).toEqual({
      id: '10320',
      slug: 'eldorado-fortress-10320',
      name: 'Eldorado Fortress',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 2509,
      imageUrl: undefined,
      priceRange: '$189 to $259',
      collectorAngle: 'Pirates nostalgia centerpiece',
      tagline:
        'A reconfigurable fortress throwback that lands as both a nostalgia play and a shelf-friendly adventure display.',
      availability: 'Measured enthusiast demand',
      collectorHighlights: [
        'Strong adult nostalgia pull without relying on a licensed franchise',
        'Modular island layout makes it easier to photograph, restyle, and merchandise',
        'Useful bridge set between display collectors and classic play-theme fans',
      ],
    });

    expect(getCatalogSetBySlug('motorized-lighthouse-21335')).toEqual({
      id: '21335',
      slug: 'motorized-lighthouse-21335',
      name: 'Motorized Lighthouse',
      theme: 'Ideas',
      releaseYear: 2022,
      pieces: 2065,
      imageUrl: undefined,
      priceRange: '$259 to $319',
      collectorAngle: 'Kinetic display standout',
      tagline:
        'A mechanically animated coastal build that feels equally at home in premium display shelves and gift-led collector curation.',
      availability: 'Selective premium availability',
      collectorHighlights: [
        'Motorized light and rotating beacon create stronger live display presence than most static shelf pieces',
        'Distinct silhouette broadens the curated assortment beyond castles, cabins, and towers',
        'Good candidate for editorial storytelling around function-first collector design',
      ],
    });
  });

  test('preserves the full summary read-model and theme snapshots', () => {
    expect(listCatalogSetSummaries()).toHaveLength(7);
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
