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
    expect(catalogSnapshot.setRecords).toHaveLength(16);
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
      {
        canonicalId: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        sourceSetNumber: '10333-1',
      },
      {
        canonicalId: '10332',
        slug: 'medieval-town-square-10332',
        sourceSetNumber: '10332-1',
      },
      {
        canonicalId: '10315',
        slug: 'tranquil-garden-10315',
        sourceSetNumber: '10315-1',
      },
      {
        canonicalId: '21333',
        slug: 'the-starry-night-21333',
        sourceSetNumber: '21333-1',
      },
      {
        canonicalId: '21342',
        slug: 'the-insect-collection-21342',
        sourceSetNumber: '21342-1',
      },
      {
        canonicalId: '10318',
        slug: 'concorde-10318',
        sourceSetNumber: '10318-1',
      },
      {
        canonicalId: '10331',
        slug: 'kingfisher-bird-10331',
        sourceSetNumber: '10331-1',
      },
      {
        canonicalId: '10341',
        slug: 'nasa-artemis-space-launch-system-10341',
        sourceSetNumber: '10341-1',
      },
      {
        canonicalId: '21349',
        slug: 'tuxedo-cat-21349',
        sourceSetNumber: '21349-1',
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
      'the-lord-of-the-rings-barad-dur-10333',
      'medieval-town-square-10332',
      'tranquil-garden-10315',
      'vincent-van-gogh-the-starry-night-21333',
      'the-insect-collection-21342',
      'concorde-10318',
      'kingfisher-bird-10331',
      'nasa-artemis-space-launch-system-10341',
      'tuxedo-cat-21349',
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
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10320-1/127861.jpg/1000x800p.jpg',
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
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/21335-1/107884.jpg/1000x800p.jpg',
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

    expect(
      getCatalogSetBySlug('the-lord-of-the-rings-barad-dur-10333'),
    ).toEqual({
      id: '10333',
      slug: 'the-lord-of-the-rings-barad-dur-10333',
      name: 'The Lord of the Rings: Barad-dur',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 5471,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10333-1/140959.jpg/1000x800p.jpg',
      priceRange: '$459 to $529',
      collectorAngle: 'Middle-earth display monolith',
      tagline:
        'A towering fantasy centerpiece with unusually strong shelf drama and cross-fandom recognizability.',
      availability: 'High-visibility premium demand',
      collectorHighlights: [
        'Vertical silhouette gives the curated assortment a more dramatic shelf profile than most wide-format display sets',
        'Large minifigure cast and franchise recognition strengthen both collector appeal and editorial storytelling potential',
        'Natural companion to Rivendell for a tighter premium Middle-earth collector arc',
      ],
    });

    expect(getCatalogSetBySlug('medieval-town-square-10332')).toEqual({
      id: '10332',
      slug: 'medieval-town-square-10332',
      name: 'Medieval Town Square',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 3304,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10332-1/137285.jpg/1000x800p.jpg',
      priceRange: '$189 to $249',
      collectorAngle: 'Castle-world village expansion',
      tagline:
        'A bustling medieval streetscape that broadens castle collecting beyond fortress-only display pieces.',
      availability: 'Broad but enthusiast-led availability',
      collectorHighlights: [
        "Pairs naturally with Lion Knights' Castle without feeling like a redundant second fortress",
        'Dense civilian scene-building helps the public catalog feel more rounded and collectible at a glance',
        'High minifigure and storefront variety make it especially useful for photography and editorial merchandising',
      ],
    });

    expect(getCatalogSetBySlug('tranquil-garden-10315')).toEqual({
      id: '10315',
      slug: 'tranquil-garden-10315',
      name: 'Tranquil Garden',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 1363,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10315-1/132380.jpg/1000x800p.jpg',
      priceRange: '$95 to $129',
      collectorAngle: 'Mindful display palate-cleanser',
      tagline:
        'A calmer sculptural garden build that gives the curated lineup a lighter, design-forward counterpoint.',
      availability: 'Accessible premium availability',
      collectorHighlights: [
        'Lower price point makes it a cleaner entry into the premium collector assortment',
        'Lifestyle-friendly display posture broadens the catalog beyond nostalgia and licensed fandom',
        'Strong visual contrast with towers, castles, and cabins helps the homepage feel less samey',
      ],
    });

    expect(
      getCatalogSetBySlug('vincent-van-gogh-the-starry-night-21333'),
    ).toEqual({
      id: '21333',
      slug: 'vincent-van-gogh-the-starry-night-21333',
      name: 'Vincent van Gogh - The Starry Night',
      theme: 'Ideas',
      releaseYear: 2022,
      pieces: 2316,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/21333-1/102873.jpg/1000x800p.jpg',
      priceRange: '$149 to $189',
      collectorAngle: 'Art-crossover wall display piece',
      tagline:
        'A museum-linked display set that sits comfortably between art object, gift piece, and collector conversation starter.',
      availability: 'Steady crossover demand',
      collectorHighlights: [
        'Instant subject recognition reaches well beyond the usual AFOL and franchise collector audience',
        'Wall-mount and shelf-display flexibility makes it more versatile than most curated centerpiece sets',
        'Useful proof point that the public catalog can feel collector-grade without leaning on nostalgia alone',
      ],
    });

    expect(getCatalogSetBySlug('the-insect-collection-21342')).toEqual({
      id: '21342',
      slug: 'the-insect-collection-21342',
      name: 'The Insect Collection',
      theme: 'Ideas',
      releaseYear: 2023,
      pieces: 1111,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/21342-1/126471.jpg/1000x800p.jpg',
      priceRange: '$69 to $99',
      collectorAngle: 'Nature-display gateway',
      tagline:
        'A smaller-scale Ideas release that adds approachable, giftable variety without breaking the premium collector tone.',
      availability: 'Healthy specialty availability',
      collectorHighlights: [
        'Lower-friction price point helps the curated public catalog feel easier to enter',
        'Three-display composition adds visual variety without introducing a new product domain or route type',
        'Broadens the Ideas slice with a subject that feels thoughtful and shelf-friendly rather than franchise-led',
      ],
    });

    expect(getCatalogSetBySlug('concorde-10318')).toEqual({
      id: '10318',
      slug: 'concorde-10318',
      name: 'Concorde',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 2083,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10318-1/132335.jpg/1000x800p.jpg',
      priceRange: '$169 to $229',
      collectorAngle: 'Engineering icon centerpiece',
      tagline:
        'A long-format aviation display build that adds sleek technical prestige to the curated lineup.',
      availability: 'Reliable premium availability',
      collectorHighlights: [
        'Instant silhouette recognition helps the public catalog feel broader without losing its collector-grade tone',
        'Large display footprint brings a very different kind of shelf presence than towers, castles, and architecture-led sets',
        'Strong fit for editorial storytelling around design icons, transport history, and adult display culture',
      ],
    });

    expect(getCatalogSetBySlug('kingfisher-bird-10331')).toEqual({
      id: '10331',
      slug: 'kingfisher-bird-10331',
      name: 'Kingfisher Bird',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 834,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10331-1/135670.jpg/1000x800p.jpg',
      priceRange: '$49 to $69',
      collectorAngle: 'Color-pop display accent',
      tagline:
        'A compact nature study that gives the catalog a sharper, more playful entry point without feeling toy-like.',
      availability: 'Widely accessible availability',
      collectorHighlights: [
        'Smaller scale lowers the barrier to entry for first-time collectors browsing the public catalog',
        'Vivid subject matter adds visual contrast to the current lineup of towers, buildings, and large-format displays',
        'Useful bridge between giftable design-led sets and the more expensive flagship collector pieces',
      ],
    });

    expect(
      getCatalogSetBySlug('nasa-artemis-space-launch-system-10341'),
    ).toEqual({
      id: '10341',
      slug: 'nasa-artemis-space-launch-system-10341',
      name: 'NASA Artemis Space Launch System',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 3601,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/10341-1/139647.jpg/1000x800p.jpg',
      priceRange: '$239 to $299',
      collectorAngle: 'Space-program display monument',
      tagline:
        'A towering spaceflight display build that expands the catalog into engineering-first collecting with real visual gravity.',
      availability: 'Specialist but steady premium demand',
      collectorHighlights: [
        'Vertical rocket-and-tower silhouette gives the public catalog a distinct display posture that is neither fortress nor fantasy spire',
        'NASA subject matter broadens collector relevance without relying on a licensed entertainment franchise',
        'Strong fit for detailed product storytelling around scale, engineering, and adult build ambition',
      ],
    });

    expect(getCatalogSetBySlug('tuxedo-cat-21349')).toEqual({
      id: '21349',
      slug: 'tuxedo-cat-21349',
      name: 'Tuxedo Cat',
      theme: 'Ideas',
      releaseYear: 2024,
      pieces: 1710,
      imageUrl:
        'https://cdn.rebrickable.com/media/thumbs/sets/21349-1/140411.jpg/1000x800p.jpg',
      priceRange: '$99 to $139',
      collectorAngle: 'Characterful home-display crowd-pleaser',
      tagline:
        'A poseable domestic display piece that keeps the collector tone warm, recognizable, and broadly giftable.',
      availability: 'Strong mainstream enthusiast availability',
      collectorHighlights: [
        'Highly recognizable subject gives the curated catalog another easy on-ramp for casual adult browsers',
        'Display-led personality helps the public set mix feel less architecture-heavy and more emotionally varied',
        'Good fit for social-proof, gifting, and home-display storytelling without expanding product scope',
      ],
    });
  });

  test('preserves the full summary read-model and theme snapshots', () => {
    expect(listCatalogSetSummaries()).toHaveLength(16);
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
