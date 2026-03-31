import { describe, expect, test } from 'vitest';
import {
  listDiscoverDealCandidateSetCards,
  getCatalogOffersBySetId,
  getCatalogSetBySlug,
  listCatalogBrowseThemeGroups,
  listCatalogSetCardsByIds,
  listHomepageDealCandidateSetCards,
  listCatalogSetSlugs,
  listHomepageSetCards,
  listCatalogSetSummaries,
  listCatalogThemes,
  listHomepageSets,
  searchCatalogSetCards,
} from './catalog-data-access';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

const expectedGeneratedCatalogRecords = [
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
  {
    canonicalId: '10300',
    slug: 'back-to-the-future-time-machine-10300',
    sourceSetNumber: '10300-1',
  },
  {
    canonicalId: '10294',
    slug: 'titanic-10294',
    sourceSetNumber: '10294-1',
  },
  {
    canonicalId: '21061',
    slug: 'notre-dame-de-paris-21061',
    sourceSetNumber: '21061-1',
  },
  {
    canonicalId: '31208',
    slug: 'hokusai-the-great-wave-31208',
    sourceSetNumber: '31208-1',
  },
  {
    canonicalId: '76419',
    slug: 'hogwarts-castle-and-grounds-76419',
    sourceSetNumber: '76419-1',
  },
  {
    canonicalId: '43222',
    slug: 'disney-castle-43222',
    sourceSetNumber: '43222-1',
  },
  {
    canonicalId: '75313',
    slug: 'at-at-75313',
    sourceSetNumber: '75313-1',
  },
  {
    canonicalId: '21345',
    slug: 'polaroid-onestep-sx-70-21345',
    sourceSetNumber: '21345-1',
  },
  {
    canonicalId: '10326',
    slug: 'natural-history-museum-10326',
    sourceSetNumber: '10326-1',
  },
  {
    canonicalId: '10323',
    slug: 'pac-man-arcade-10323',
    sourceSetNumber: '10323-1',
  },
  {
    canonicalId: '10306',
    slug: 'atari-2600-10306',
    sourceSetNumber: '10306-1',
  },
  {
    canonicalId: '10280',
    slug: 'flower-bouquet-10280',
    sourceSetNumber: '10280-1',
  },
  {
    canonicalId: '10311',
    slug: 'orchid-10311',
    sourceSetNumber: '10311-1',
  },
  {
    canonicalId: '21327',
    slug: 'typewriter-21327',
    sourceSetNumber: '21327-1',
  },
  {
    canonicalId: '21343',
    slug: 'viking-village-21343',
    sourceSetNumber: '21343-1',
  },
  {
    canonicalId: '42115',
    slug: 'lamborghini-sian-fkp-37-42115',
    sourceSetNumber: '42115-1',
  },
  {
    canonicalId: '42143',
    slug: 'ferrari-daytona-sp3-42143',
    sourceSetNumber: '42143-1',
  },
  {
    canonicalId: '71411',
    slug: 'the-mighty-bowser-71411',
    sourceSetNumber: '71411-1',
  },
  {
    canonicalId: '71741',
    slug: 'ninjago-city-gardens-71741',
    sourceSetNumber: '71741-1',
  },
  {
    canonicalId: '76218',
    slug: 'sanctum-sanctorum-76218',
    sourceSetNumber: '76218-1',
  },
  {
    canonicalId: '76956',
    slug: 't-rex-breakout-76956',
    sourceSetNumber: '76956-1',
  },
  {
    canonicalId: '75331',
    slug: 'the-razor-crest-75331',
    sourceSetNumber: '75331-1',
  },
  {
    canonicalId: '76417',
    slug: 'gringotts-wizarding-bank-collectors-edition-76417',
    sourceSetNumber: '76417-1',
  },
  {
    canonicalId: '76178',
    slug: 'daily-bugle-76178',
    sourceSetNumber: '76178-1',
  },
  {
    canonicalId: '75367',
    slug: 'venator-class-republic-attack-cruiser-75367',
    sourceSetNumber: '75367-1',
  },
  {
    canonicalId: '21350',
    slug: 'jaws-21350',
    sourceSetNumber: '21350-1',
  },
  {
    canonicalId: '10317',
    slug: 'land-rover-classic-defender-90-10317',
    sourceSetNumber: '10317-1',
  },
  {
    canonicalId: '76437',
    slug: 'the-burrow-collectors-edition-76437',
    sourceSetNumber: '76437-1',
  },
];

const expectedProductSlugs = [
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
  'back-to-the-future-time-machine-10300',
  'titanic-10294',
  'notre-dame-de-paris-21061',
  'hokusai-the-great-wave-31208',
  'hogwarts-castle-and-grounds-76419',
  'disney-castle-43222',
  'at-at-75313',
  'polaroid-onestep-sx-70-camera-21345',
  'natural-history-museum-10326',
  'pac-man-arcade-10323',
  'atari-2600-10306',
  'flower-bouquet-10280',
  'orchid-10311',
  'typewriter-21327',
  'viking-village-21343',
  'lamborghini-sian-fkp-37-42115',
  'ferrari-daytona-sp3-42143',
  'the-mighty-bowser-71411',
  'ninjago-city-gardens-71741',
  'sanctum-sanctorum-76218',
  't-rex-breakout-76956',
  'the-razor-crest-75331',
  'gringotts-wizarding-bank-collectors-edition-76417',
  'daily-bugle-76178',
  'venator-class-republic-attack-cruiser-75367',
  'jaws-21350',
  'land-rover-classic-defender-90-10317',
  'the-burrow-collectors-edition-76437',
];

const expectedBrowseThemeGroups = [
  { theme: 'Icons', count: 14 },
  { theme: 'Marvel', count: 3 },
  { theme: 'Ideas', count: 10 },
  { theme: 'Star Wars', count: 3 },
  { theme: 'Harry Potter', count: 3 },
  { theme: 'Technic', count: 2 },
  { theme: 'Modular Buildings', count: 1 },
  { theme: 'Botanicals', count: 2 },
  { theme: 'Architecture', count: 1 },
  { theme: 'Art', count: 1 },
  { theme: 'Disney', count: 1 },
  { theme: 'NINJAGO', count: 1 },
  { theme: 'Super Mario', count: 1 },
  { theme: 'Jurassic World', count: 1 },
];

const expectedCatalogThemes = [
  {
    name: 'Icons',
    setCount: 14,
    momentum:
      'Premium collectors are consolidating around large display pieces.',
    signatureSet: 'Rivendell',
  },
  {
    name: 'Ideas',
    setCount: 10,
    momentum:
      'Community-voted display builds keep balancing fandom, nostalgia, and design-object appeal.',
    signatureSet: "Dungeons & Dragons: Red Dragon's Tale",
  },
  {
    name: 'Marvel',
    setCount: 3,
    momentum:
      'Marvel now reads as a real collector lane with both a flagship tower and a landmark companion build.',
    signatureSet: 'Avengers Tower',
  },
  {
    name: 'Modular Buildings',
    setCount: 1,
    momentum:
      'Collector interest in premium street-scale buildings stays strong because they photograph and display so well.',
    signatureSet: 'Natural History Museum',
  },
  {
    name: 'Botanicals',
    setCount: 2,
    momentum:
      'Giftable adult builds keep bringing more casual browsers into the catalog through recognizable botanical subjects.',
    signatureSet: 'Flower Bouquet',
  },
  {
    name: 'Technic',
    setCount: 2,
    momentum:
      'Large-scale supercars remain the cleanest path into Technic for collectors who browse for recognizable icons.',
    signatureSet: 'Ferrari Daytona SP3',
  },
  {
    name: 'Super Mario',
    setCount: 1,
    momentum:
      'Character-led display pieces give the public catalog a broader gaming entry without turning into a play-focused assortment.',
    signatureSet: 'The Mighty Bowser',
  },
  {
    name: 'NINJAGO',
    setCount: 1,
    momentum:
      'Collector appetite for dense NINJAGO city builds stays strong even outside the core franchise audience.',
    signatureSet: 'NINJAGO City Gardens',
  },
  {
    name: 'Jurassic World',
    setCount: 1,
    momentum:
      'Film-scene nostalgia keeps Jurassic builds easy to understand and easy to search for in a curated public catalog.',
    signatureSet: 'T. rex Breakout',
  },
  {
    name: 'Star Wars',
    setCount: 3,
    momentum:
      'High-end Star Wars collecting lands best when the public mix shows more than one obvious flagship silhouette.',
    signatureSet: 'AT-AT',
  },
  {
    name: 'Harry Potter',
    setCount: 3,
    momentum:
      'Wizarding World remains one of the broadest franchise search drivers once the catalog shows both entry and flagship display options.',
    signatureSet: "Gringotts Wizarding Bank – Collectors' Edition",
  },
  {
    name: 'Architecture',
    setCount: 1,
    momentum:
      'Globally recognizable landmarks keep architecture sets valuable as broad search-entry anchors.',
    signatureSet: 'Notre-Dame de Paris',
  },
  {
    name: 'Art',
    setCount: 1,
    momentum:
      'Wall-friendly art builds keep the catalog from feeling limited to buildings, vehicles, and franchise landmarks.',
    signatureSet: 'Hokusai - The Great Wave',
  },
  {
    name: 'Disney',
    setCount: 1,
    momentum:
      'Disney display icons bring family recognition and gifting appeal into a mostly adult-collector public mix.',
    signatureSet: 'Disney Castle',
  },
];

describe('catalog snapshot artifacts', () => {
  test('keep the generated snapshot and manifest aligned', () => {
    expect(catalogSnapshot.setRecords).toHaveLength(44);
    expect(catalogSyncManifest.recordCount).toBe(
      catalogSnapshot.setRecords.length,
    );
    expect(catalogSyncManifest.homepageFeaturedSetIds).toEqual([
      '10316',
      '10333',
      '21333',
    ]);
  });

  test('generated records keep source-normalized slugs and canonical ids', () => {
    expect(
      catalogSnapshot.setRecords.map((catalogSetRecord) => ({
        canonicalId: catalogSetRecord.canonicalId,
        slug: catalogSetRecord.slug,
        sourceSetNumber: catalogSetRecord.sourceSetNumber,
      })),
    ).toEqual(expectedGeneratedCatalogRecords);
  });
});

describe('catalog data-access contracts', () => {
  test('keeps product-facing slugs clean and stable', () => {
    expect(listCatalogSetSlugs()).toEqual(expectedProductSlugs);
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
      {
        id: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
        priceRange: '$459 to $529',
        collectorAngle: 'Middle-earth display monolith',
      },
      {
        id: '21333',
        slug: 'vincent-van-gogh-the-starry-night-21333',
        name: 'Vincent van Gogh - The Starry Night',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2316,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
        priceRange: '$149 to $189',
        collectorAngle: 'Art-crossover wall display piece',
      },
    ]);
  });

  test('searches curated sets by product name and canonical id', () => {
    expect(searchCatalogSetCards('avengers')).toEqual([
      expect.objectContaining({
        id: '76269',
        name: 'Avengers Tower',
      }),
    ]);

    expect(searchCatalogSetCards('10316')).toEqual([
      expect.objectContaining({
        id: '10316',
        name: 'Rivendell',
      }),
    ]);
  });

  test('matches source set numbers and returns no results for an empty query', () => {
    expect(searchCatalogSetCards('10316-1')).toEqual([
      expect.objectContaining({
        id: '10316',
        name: 'Rivendell',
      }),
    ]);

    expect(searchCatalogSetCards('   ')).toEqual([]);
  });

  test('keeps the expanded catalog search useful for iconic names and numbers', () => {
    expect(searchCatalogSetCards('titanic')).toEqual([
      expect.objectContaining({
        id: '10294',
        name: 'Titanic',
      }),
    ]);

    expect(searchCatalogSetCards('hogwarts')).toEqual([
      expect.objectContaining({
        id: '76419',
        name: 'Hogwarts Castle and Grounds',
      }),
    ]);

    expect(searchCatalogSetCards('21061')).toEqual([
      expect.objectContaining({
        id: '21061',
        name: 'Notre-Dame de Paris',
      }),
    ]);

    expect(searchCatalogSetCards('barad dur')).toEqual([
      expect.objectContaining({
        id: '10333',
        name: 'The Lord of the Rings: Barad-dûr',
      }),
    ]);

    expect(searchCatalogSetCards('bowser')).toEqual([
      expect.objectContaining({
        id: '71411',
        name: 'The Mighty Bowser',
      }),
    ]);

    expect(searchCatalogSetCards('10326')).toEqual([
      expect.objectContaining({
        id: '10326',
        name: 'Natural History Museum',
      }),
    ]);
  });

  test('builds richer homepage card reads with curated availability and tagline context', () => {
    expect(listHomepageSetCards()).toEqual([
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
      {
        id: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
        priceRange: '$459 to $529',
        collectorAngle: 'Middle-earth display monolith',
        tagline:
          'A towering fantasy centerpiece with unusually strong shelf drama and cross-fandom recognizability.',
        availability: 'High-visibility premium demand',
      },
      {
        id: '21333',
        slug: 'vincent-van-gogh-the-starry-night-21333',
        name: 'Vincent van Gogh - The Starry Night',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2316,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
        priceRange: '$149 to $189',
        collectorAngle: 'Art-crossover wall display piece',
        tagline:
          'A museum-linked display set that sits comfortably between art object, gift piece, and collector conversation starter.',
        availability: 'Steady crossover demand',
      },
    ]);
  });

  test('keeps homepage deal candidates focused on reviewed click-magnets outside the main hero row', () => {
    expect(
      listHomepageDealCandidateSetCards().map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    ).toEqual(['76269', '21348', '10294', '21349', '10332', '10305', '21061']);
  });

  test('keeps discover deal candidates anchored in flagship and high-interest sets', () => {
    expect(
      listDiscoverDealCandidateSetCards()
        .slice(0, 6)
        .map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['76269', '10316', '21348', '10333', '10294', '21333']);
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

  test('returns comparable catalog offers for every public set', () => {
    expect(getCatalogOffersBySetId('10316')).toEqual([
      expect.objectContaining({
        setId: '10316',
        merchant: 'bol',
        merchantName: 'bol',
        market: 'NL',
        currency: 'EUR',
        availability: 'in_stock',
        condition: 'new',
        priceCents: 46999,
      }),
      expect.objectContaining({
        setId: '10316',
        merchant: 'lego',
        merchantName: 'LEGO',
        market: 'NL',
        currency: 'EUR',
        availability: 'in_stock',
        condition: 'new',
        priceCents: 49999,
      }),
    ]);

    expect(getCatalogOffersBySetId('42143')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 42999,
        }),
      ]),
    );

    expect(
      listCatalogSetSummaries().every((catalogSetSummary) => {
        const catalogOffers = getCatalogOffersBySetId(catalogSetSummary.id);

        return catalogOffers.length >= 2 && catalogOffers.length <= 3;
      }),
    ).toBe(true);

    expect(getCatalogOffersBySetId('missing-set')).toEqual([]);
  });

  test('groups the discover browse catalog by theme in a stable retail order', () => {
    expect(
      listCatalogBrowseThemeGroups().map((catalogThemeGroup) => ({
        count: catalogThemeGroup.setCards.length,
        theme: catalogThemeGroup.theme,
      })),
    ).toEqual(expectedBrowseThemeGroups);

    expect(
      listCatalogBrowseThemeGroups()[0]?.setCards.map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    ).toEqual([
      '10316',
      '10333',
      '10294',
      '10300',
      '10305',
      '10332',
      '10318',
      '10341',
      '10317',
      '10331',
      '10320',
      '10323',
      '10315',
      '10306',
    ]);

    expect(
      listCatalogBrowseThemeGroups()[2]
        ?.setCards.slice(0, 4)
        .map((catalogSetCard) => catalogSetCard.id),
    ).toEqual(['21348', '21350', '21333', '21345']);
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10320-1/127861.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21335-1/107884.jpg',
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
      name: 'The Lord of the Rings: Barad-dûr',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 5478,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
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
      pieces: 3308,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10332-1/137285.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10315-1/132380.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21342-1/126471.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10318-1/132335.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10331-1/135670.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10341-1/139647.jpg',
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
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21349-1/140411.jpg',
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

    expect(
      getCatalogSetBySlug('back-to-the-future-time-machine-10300'),
    ).toEqual({
      id: '10300',
      slug: 'back-to-the-future-time-machine-10300',
      name: 'Back to the Future Time Machine',
      theme: 'Icons',
      releaseYear: 2022,
      pieces: 1872,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10300-1/99954.jpg',
      priceRange: '$179 to $229',
      collectorAngle: 'Pop-culture vehicle icon',
      tagline:
        'A movie-car display set that is instantly recognizable even beyond core LEGO collectors.',
      availability: 'Broad enthusiast availability',
      collectorHighlights: [
        'Three film variants make it more replayable than most single-vehicle display sets',
        'Strong search target thanks to one of the most recognizable movie cars in pop culture',
        'Balances premium collector tone with a more approachable size and price than the biggest flagships',
      ],
    });

    expect(getCatalogSetBySlug('titanic-10294')).toEqual({
      id: '10294',
      slug: 'titanic-10294',
      name: 'Titanic',
      theme: 'Icons',
      releaseYear: 2021,
      pieces: 9092,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10294-1/93446.jpg',
      priceRange: '$629 to $749',
      collectorAngle: 'Monumental display statement',
      tagline:
        'A massive ocean-liner build that reads as both engineering feat and living-room conversation piece.',
      availability: 'Selective flagship availability',
      collectorHighlights: [
        'One of the most recognizable large-format display sets in the broader adult market',
        'Extreme scale gives the public catalog a true top-end centerpiece beyond castles and towers',
        'Excellent search target for collectors who browse by iconic real-world subjects',
      ],
    });

    expect(getCatalogSetBySlug('notre-dame-de-paris-21061')).toEqual({
      id: '21061',
      slug: 'notre-dame-de-paris-21061',
      name: 'Notre-Dame de Paris',
      theme: 'Architecture',
      releaseYear: 2024,
      pieces: 4382,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21061-1/140433.jpg',
      priceRange: '$199 to $249',
      collectorAngle: 'Architecture prestige landmark',
      tagline:
        'A globally recognizable landmark build that adds architectural gravitas without feeling cold or corporate.',
      availability: 'Healthy premium availability',
      collectorHighlights: [
        'Highly recognizable subject broadens search relevance far beyond existing fandom-led sets',
        'Dense silhouette and historical subject matter strengthen editorial and gift-led merchandising',
        'Brings a cleaner architecture entry point than the current fantasy- and franchise-heavy mix',
      ],
    });

    expect(getCatalogSetBySlug('hokusai-the-great-wave-31208')).toEqual({
      id: '31208',
      slug: 'hokusai-the-great-wave-31208',
      name: 'Hokusai - The Great Wave',
      theme: 'Art',
      releaseYear: 2023,
      pieces: 1810,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/31208-1/131769.jpg',
      priceRange: '$79 to $109',
      collectorAngle: 'Wall-display art crossover',
      tagline:
        'A framed wave composition that makes the public catalog feel more design-led and giftable at a glance.',
      availability: 'Consistent art-line availability',
      collectorHighlights: [
        'Instant visual recognition makes it a strong search target even for casual browsers',
        'Wall-friendly format adds a new display posture without adding product complexity',
        'Helps the catalog feel more varied than a lineup of only buildings, towers, and vehicles',
      ],
    });

    expect(getCatalogSetBySlug('hogwarts-castle-and-grounds-76419')).toEqual({
      id: '76419',
      slug: 'hogwarts-castle-and-grounds-76419',
      name: 'Hogwarts Castle and Grounds',
      theme: 'Harry Potter',
      releaseYear: 2023,
      pieces: 2660,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76419-1/123597.jpg',
      priceRange: '$149 to $189',
      collectorAngle: 'Wizarding World display overview',
      tagline:
        'A compact Hogwarts panorama that brings one of LEGO’s most searched fantasy subjects into a cleaner display format.',
      availability: 'Strong mainstream availability',
      collectorHighlights: [
        'Broad franchise recognition makes it one of the easiest search-entry sets beyond Marvel and Middle-earth',
        'More shelf-manageable than the largest Hogwarts releases while still reading as collector-grade',
        'Adds a major fantasy license without crowding the premium lineup with another oversized flagship',
      ],
    });

    expect(getCatalogSetBySlug('disney-castle-43222')).toEqual({
      id: '43222',
      slug: 'disney-castle-43222',
      name: 'Disney Castle',
      theme: 'Disney',
      releaseYear: 2023,
      pieces: 4837,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/43222-1/130721.jpg',
      priceRange: '$349 to $429',
      collectorAngle: 'Fairytale flagship centerpiece',
      tagline:
        'A castle display icon with unusually broad household recognition and strong gift-led appeal.',
      availability: 'Healthy flagship availability',
      collectorHighlights: [
        'One of the most recognizable display silhouettes in the broader LEGO catalog',
        'Adds a warmer, more family-adjacent flagship without losing adult collector credibility',
        'Powerful search target for Disney and castle collectors alike',
      ],
    });

    expect(getCatalogSetBySlug('at-at-75313')).toEqual({
      id: '75313',
      slug: 'at-at-75313',
      name: 'AT-AT',
      theme: 'Star Wars',
      releaseYear: 2021,
      pieces: 6785,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/94568.jpg',
      priceRange: '$649 to $799',
      collectorAngle: 'Star Wars collector monument',
      tagline:
        'A towering Ultimate Collector Series build that signals serious collector depth the moment it appears in search.',
      availability: 'Selective UCS availability',
      collectorHighlights: [
        'One of the most recognizable high-end Star Wars sets in the modern catalog',
        'Massive scale and franchise pull make it a strong anchor for premium search demand',
        'Expands the curated mix into Star Wars without widening product scope or behavior',
      ],
    });

    expect(getCatalogSetBySlug('polaroid-onestep-sx-70-camera-21345')).toEqual({
      id: '21345',
      slug: 'polaroid-onestep-sx-70-camera-21345',
      name: 'Polaroid OneStep SX-70 Camera',
      theme: 'Ideas',
      releaseYear: 2024,
      pieces: 516,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21345-1/134647.jpg',
      priceRange: '$69 to $99',
      collectorAngle: 'Retro design-object crowd-pleaser',
      tagline:
        'A playful camera build that feels instantly familiar, giftable, and display-ready without becoming novelty-first.',
      availability: 'Accessible enthusiast availability',
      collectorHighlights: [
        'Recognizable real-world object makes it an easy search and gifting on-ramp',
        'Compact footprint adds a lower-commitment collector option to the public mix',
        'Keeps the Ideas slice warm and design-led rather than only scenic or fandom-heavy',
      ],
    });
  });

  test('preserves the full summary read-model and theme snapshots', () => {
    expect(listCatalogSetSummaries()).toHaveLength(44);
    expect(listCatalogThemes()).toEqual(expectedCatalogThemes);
  });
});
