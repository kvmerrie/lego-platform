import { describe, expect, test } from 'vitest';
import {
  listDiscoverDealCandidateSetCards,
  getCatalogThemePageBySlug,
  listDiscoverBrowseThemeGroups,
  listDiscoverCharacterSetCards,
  listDiscoverHighlightSetCards,
  listCatalogSearchMatches,
  getCatalogOffersBySetId,
  listCatalogSearchSuggestions,
  getCatalogSetBySlug,
  listCatalogBrowseThemeGroups,
  listCatalogThemeDirectoryItems,
  listCatalogSetCardsByIds,
  listCatalogThemePageSlugs,
  listHomepageDealCandidateSetCards,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  listHomepageThemeSnapshots,
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
  {
    canonicalId: '75355',
    slug: 'x-wing-starfighter-75355',
    sourceSetNumber: '75355-1',
  },
  {
    canonicalId: '75397',
    slug: 'jabbas-sail-barge-75397',
    sourceSetNumber: '75397-1',
  },
  {
    canonicalId: '76429',
    slug: 'talking-sorting-hat-76429',
    sourceSetNumber: '76429-1',
  },
  {
    canonicalId: '76435',
    slug: 'hogwarts-castle-the-great-hall-76435',
    sourceSetNumber: '76435-1',
  },
  {
    canonicalId: '76294',
    slug: 'the-x-mansion-76294',
    sourceSetNumber: '76294-1',
  },
  {
    canonicalId: '10335',
    slug: 'the-endurance-10335',
    sourceSetNumber: '10335-1',
  },
  {
    canonicalId: '10327',
    slug: 'dune-atreides-royal-ornithopter-10327',
    sourceSetNumber: '10327-1',
  },
  {
    canonicalId: '42171',
    slug: 'mercedes-amg-f1-w14-e-performance-42171',
    sourceSetNumber: '42171-1',
  },
  {
    canonicalId: '42172',
    slug: 'mclaren-p1-42172',
    sourceSetNumber: '42172-1',
  },
  {
    canonicalId: '10328',
    slug: 'bouquet-of-roses-10328',
    sourceSetNumber: '10328-1',
  },
  {
    canonicalId: '75398',
    slug: 'c-3po-75398',
    sourceSetNumber: '75398-1',
  },
  {
    canonicalId: '76453',
    slug: 'malfoy-manor-76453',
    sourceSetNumber: '76453-1',
  },
  {
    canonicalId: '76313',
    slug: 'marvel-logo-76313',
    sourceSetNumber: '76313-1',
  },
  {
    canonicalId: '10354',
    slug: 'the-lord-of-the-rings-the-shire-10354',
    sourceSetNumber: '10354-1',
  },
  {
    canonicalId: '42177',
    slug: 'mercedes-benz-g-500-professional-line-42177',
    sourceSetNumber: '42177-1',
  },
  {
    canonicalId: '10342',
    slug: 'pretty-pink-flower-bouquet-10342',
    sourceSetNumber: '10342-1',
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
  'x-wing-starfighter-75355',
  'jabbas-sail-barge-75397',
  'talking-sorting-hat-76429',
  'hogwarts-castle-the-great-hall-76435',
  'the-x-mansion-76294',
  'the-endurance-10335',
  'dune-atreides-royal-ornithopter-10327',
  'mercedes-amg-f1-w14-e-performance-42171',
  'mclaren-p1-42172',
  'bouquet-of-roses-10328',
  'c-3po-75398',
  'malfoy-manor-76453',
  'marvel-logo-76313',
  'the-lord-of-the-rings-the-shire-10354',
  'mercedes-benz-g-500-professional-line-42177',
  'pretty-pink-flower-bouquet-10342',
];

const expectedBrowseThemeGroups = [
  { theme: 'Icons', count: 17 },
  { theme: 'Marvel', count: 5 },
  { theme: 'Ideas', count: 10 },
  { theme: 'Star Wars', count: 6 },
  { theme: 'Harry Potter', count: 6 },
  { theme: 'Technic', count: 5 },
  { theme: 'Modular Buildings', count: 1 },
  { theme: 'Botanicals', count: 4 },
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
    slug: 'icons',
    setCount: 17,
    momentum:
      'Rivendell, Titanic, Concorde. Hier schuif je je plank voor vrij.',
    signatureSet: 'Rivendell',
  },
  {
    name: 'Ideas',
    slug: 'ideas',
    setCount: 10,
    momentum:
      'Een rode draak, een taverne, een complete scene. Ideas zet meteen iets neer.',
    signatureSet: "Dungeons & Dragons: Red Dragon's Tale",
  },
  {
    name: 'Marvel',
    slug: 'marvel',
    setCount: 5,
    momentum:
      "Grote gebouwen, veel minifigs, meteen herkenbaar. Hier zit Marvel op z'n sterkst.",
    signatureSet: 'Avengers Tower',
  },
  {
    name: 'Modular Buildings',
    slug: 'modular-buildings',
    setCount: 1,
    momentum:
      "Met een modulaire straat haal je meteen zo'n LEGO-hoek in huis waar je naar blijft kijken.",
    signatureSet: 'Natural History Museum',
  },
  {
    name: 'Botanicals',
    slug: 'botanicals',
    setCount: 4,
    momentum: 'Bloemen voor op tafel. LEGO voor op de kast.',
    signatureSet: 'Flower Bouquet',
  },
  {
    name: 'Technic',
    slug: 'technic',
    setCount: 5,
    momentum: 'Supercars met techniek waar je doorheen wilt blijven kijken.',
    signatureSet: 'Ferrari Daytona SP3',
  },
  {
    name: 'Super Mario',
    slug: 'super-mario',
    setCount: 1,
    momentum:
      'The Mighty Bowser laat zien hoe goed een game-icoon als grote displayset werkt.',
    signatureSet: 'The Mighty Bowser',
  },
  {
    name: 'NINJAGO',
    slug: 'ninjago',
    setCount: 1,
    momentum:
      "NINJAGO City Gardens is zo'n set waar je steeds weer nieuwe hoekjes en details in ziet.",
    signatureSet: 'NINJAGO City Gardens',
  },
  {
    name: 'Jurassic World',
    slug: 'jurassic-world',
    setCount: 1,
    momentum:
      'T. rex Breakout zet meteen een filmscene neer die ook buiten Jurassic-fans blijft werken.',
    signatureSet: 'T. rex Breakout',
  },
  {
    name: 'Star Wars',
    slug: 'star-wars',
    setCount: 6,
    momentum:
      'Walkers, schepen, pure displaykracht. Hier zit het Star Wars-spul dat blijft hangen.',
    signatureSet: 'AT-AT',
  },
  {
    name: 'Harry Potter',
    slug: 'harry-potter',
    setCount: 6,
    momentum:
      'Van The Burrow tot Gringotts. Hier kies je tussen warmte en pure tovenaarsdrukte.',
    signatureSet: "Gringotts Wizarding Bank – Collectors' Edition",
  },
  {
    name: 'Architecture',
    slug: 'architecture',
    setCount: 1,
    momentum:
      'Architecture is er voor herkenbare gebouwen die rustig ogen op een plank en toch meteen worden herkend.',
    signatureSet: 'Notre-Dame de Paris',
  },
  {
    name: 'Art',
    slug: 'art',
    setCount: 1,
    momentum:
      'Art is voor wie wel een LEGO-set wil neerzetten, maar geen gebouw of voertuig zoekt.',
    signatureSet: 'Hokusai - The Great Wave',
  },
  {
    name: 'Disney',
    slug: 'disney',
    setCount: 1,
    momentum:
      'Disney Castle is de set voor wie sprookjessfeer en een echt pronkstuk in een doos wil.',
    signatureSet: 'Disney Castle',
  },
];

const nonEmptyText = expect.stringMatching(/\S/);
const bannedCollectorCopyTerms = [
  'editorial potential',
  'merchandising',
  'assortment',
  'retail lane',
  'search target',
  'catalog breadth',
  'product storytelling',
  'shelf profile',
  'franchise pull',
  'redactioneel potentieel',
  'assortiment',
  'schapprofiel',
] as const;

describe('catalog snapshot artifacts', () => {
  test('keep the generated snapshot and manifest aligned', () => {
    expect(catalogSnapshot.setRecords).toHaveLength(60);
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
    const catalogSetDetail = getCatalogSetBySlug('rivendell-10316');

    expect(catalogSetDetail).toMatchObject({
      id: '10316',
      slug: 'rivendell-10316',
      name: 'Rivendell',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 6181,
      minifigureCount: 15,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
      priceRange: '$499 tot $569',
      collectorAngle: nonEmptyText,
      tagline: nonEmptyText,
      availability: nonEmptyText,
    });
    expect(catalogSetDetail?.collectorHighlights).toEqual([
      nonEmptyText,
      nonEmptyText,
      nonEmptyText,
    ]);
  });

  test('keeps homepage summaries stable while allowing source facts to refresh', () => {
    const homepageSets = listHomepageSets();

    expect(homepageSets).toMatchObject([
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        priceRange: '$499 tot $569',
        collectorAngle: nonEmptyText,
      },
      {
        id: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
        priceRange: '$459 tot $529',
        collectorAngle: nonEmptyText,
      },
      {
        id: '21333',
        slug: 'vincent-van-gogh-the-starry-night-21333',
        name: 'Vincent van Gogh - The Starry Night',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2316,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
        priceRange: '$149 tot $189',
        collectorAngle: nonEmptyText,
      },
    ]);
    expect(homepageSets).toHaveLength(3);
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

  test('exposes stable search-match scores for richer result ranking without changing text-first behavior', () => {
    expect(
      listCatalogSearchMatches('hogwarts').map((catalogSearchMatch) => ({
        id: catalogSearchMatch.setCard.id,
        score: catalogSearchMatch.score,
      })),
    ).toEqual([
      {
        id: '76435',
        score: 2,
      },
      {
        id: '76419',
        score: 2,
      },
    ]);
  });

  test('keeps the expanded catalog search useful for iconic names and numbers', () => {
    expect(searchCatalogSetCards('titanic')).toEqual([
      expect.objectContaining({
        id: '10294',
        name: 'Titanic',
      }),
    ]);

    expect(
      searchCatalogSetCards('hogwarts').map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    ).toEqual(['76435', '76419']);

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

    expect(searchCatalogSetCards('grogu')).toEqual([
      expect.objectContaining({
        id: '75331',
        name: 'The Razor Crest',
      }),
    ]);

    expect(searchCatalogSetCards('hermione').slice(0, 2)).toEqual([
      expect.objectContaining({
        id: '76453',
        name: 'Malfoy Manor',
      }),
      expect.objectContaining({
        id: '76417',
        name: "Gringotts Wizarding Bank – Collectors' Edition",
      }),
    ]);

    expect(searchCatalogSetCards('wolverine')).toEqual([
      expect.objectContaining({
        id: '76294',
        name: 'The X-Mansion',
      }),
    ]);

    expect(searchCatalogSetCards('10326')).toEqual([
      expect.objectContaining({
        id: '10326',
        name: 'Natural History Museum',
      }),
    ]);
  });

  test('prioritizes prefix-style suggestion matches and keeps typeahead compact', () => {
    expect(listCatalogSearchSuggestions('tower', 3)).toEqual([
      expect.objectContaining({
        id: '76269',
        name: 'Avengers Tower',
      }),
    ]);

    expect(listCatalogSearchSuggestions('grogu', 3)).toEqual([
      expect.objectContaining({
        id: '75331',
        name: 'The Razor Crest',
      }),
    ]);

    expect(listCatalogSearchSuggestions('103', 3)).toHaveLength(3);
    expect(listCatalogSearchSuggestions('103', 0)).toEqual([]);
  });

  test('keeps direct set-name matches ahead of character-only matches in score tiers', () => {
    expect(listCatalogSearchMatches('hogwarts')[0]).toEqual(
      expect.objectContaining({
        score: 2,
        setCard: expect.objectContaining({
          id: '76435',
        }),
      }),
    );

    expect(listCatalogSearchMatches('grogu')[0]).toEqual(
      expect.objectContaining({
        score: 5,
        setCard: expect.objectContaining({
          id: '75331',
        }),
      }),
    );
  });

  test('builds richer homepage card reads with curated availability and tagline context', () => {
    const homepageSetCards = listHomepageSetCards();

    expect(homepageSetCards).toMatchObject([
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        priceRange: '$499 tot $569',
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
        minifigureCount: 15,
      },
      {
        id: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
        priceRange: '$459 tot $529',
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
        minifigureCount: 10,
      },
      {
        id: '21333',
        slug: 'vincent-van-gogh-the-starry-night-21333',
        name: 'Vincent van Gogh - The Starry Night',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2316,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
        priceRange: '$149 tot $189',
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
      },
    ]);
    expect(homepageSetCards).toHaveLength(3);
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

  test('keeps discover highlights focused on the strongest curated click-magnets and flagships', () => {
    expect(
      listDiscoverHighlightSetCards().map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    ).toEqual(['76178', '75313', '75331', '76417', '76437', '10316']);
  });

  test('builds a compact discover character lane from curated sets with minifigure highlights', () => {
    expect(
      listDiscoverCharacterSetCards().map(
        (catalogSetCard) => catalogSetCard.id,
      ),
    ).toEqual(['76178', '75313', '75331', '76417', '76437']);
  });

  test('maps curated ids to card-ready reads while skipping ids outside the public catalog slice', () => {
    const catalogSetCards = listCatalogSetCardsByIds([
      '76269',
      'missing-set',
      '10316',
    ]);

    expect(catalogSetCards).toMatchObject([
      {
        id: '76269',
        slug: 'avengers-tower-76269',
        name: 'Avengers Tower',
        theme: 'Marvel',
        releaseYear: 2023,
        pieces: 5202,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        priceRange: '$449 tot $519',
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
        minifigureCount: 31,
      },
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        priceRange: '$499 tot $569',
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
        minifigureCount: 15,
      },
    ]);
    expect(catalogSetCards).toHaveLength(2);
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

    expect(getCatalogOffersBySetId('42143')).toEqual([
      expect.objectContaining({
        merchant: 'lego',
        merchantName: 'LEGO',
        priceCents: 41999,
        url: 'https://www.lego.com/nl-nl/product/ferrari-daytona-sp3-42143',
      }),
    ]);

    expect(
      listCatalogSetSummaries().every((catalogSetSummary) => {
        const catalogOffers = getCatalogOffersBySetId(catalogSetSummary.id);

        return (
          catalogOffers.length >= 1 &&
          catalogOffers.every(
            (catalogOffer) =>
              !catalogOffer.url.includes('searchtext=') &&
              !catalogOffer.url.includes('/search?q=') &&
              !catalogOffer.url.includes('/s?k='),
          )
        );
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
      '10354',
      '10327',
      '10331',
      '10335',
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

  test('builds compact discover theme groups with limited lanes and card counts', () => {
    const discoverBrowseThemeGroups = listDiscoverBrowseThemeGroups({
      reviewedSetIds: ['75355', '76435', '42172'],
    });

    expect(
      discoverBrowseThemeGroups.map(
        (catalogThemeGroup) => catalogThemeGroup.theme,
      ),
    ).toEqual([
      'Icons',
      'Marvel',
      'Ideas',
      'Star Wars',
      'Harry Potter',
      'Technic',
    ]);
    expect(
      discoverBrowseThemeGroups.every(
        (catalogThemeGroup) => catalogThemeGroup.setCards.length <= 6,
      ),
    ).toBe(true);
    expect(
      discoverBrowseThemeGroups.every(
        (catalogThemeGroup) =>
          typeof catalogThemeGroup.totalSetCount === 'number' &&
          catalogThemeGroup.totalSetCount >= catalogThemeGroup.setCards.length,
      ),
    ).toBe(true);
    expect(
      discoverBrowseThemeGroups.find(
        (catalogThemeGroup) => catalogThemeGroup.theme === 'Star Wars',
      )?.setCards[0]?.id,
    ).toBe('75355');
  });

  test('keeps homepage theme surfacing focused on the strongest browse lanes', () => {
    expect(
      listHomepageThemeSnapshots().map((themeSnapshot) => themeSnapshot.name),
    ).toEqual([
      'Icons',
      'Marvel',
      'Ideas',
      'Star Wars',
      'Harry Potter',
      'Technic',
    ]);
  });

  test('builds homepage theme directory items with representative images in homepage order', () => {
    expect(
      listHomepageThemeDirectoryItems().map((themeDirectoryItem) => ({
        imageUrl: themeDirectoryItem.imageUrl,
        name: themeDirectoryItem.themeSnapshot.name,
      })),
    ).toEqual([
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        name: 'Icons',
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        name: 'Marvel',
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
        name: 'Ideas',
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/94568.jpg',
        name: 'Star Wars',
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/127873.jpg',
        name: 'Harry Potter',
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/42143-1/103001.jpg',
        name: 'Technic',
      },
    ]);
  });

  test('prepares homepage theme tiles with explicit curated visuals', () => {
    expect(
      listHomepageThemeDirectoryItems().map((themeDirectoryItem) => ({
        backgroundColor: themeDirectoryItem.visual?.backgroundColor,
        imageUrl: themeDirectoryItem.visual?.imageUrl,
        name: themeDirectoryItem.themeSnapshot.name,
        textColor: themeDirectoryItem.visual?.textColor,
      })),
    ).toEqual([
      {
        backgroundColor: '#f0c63b',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        name: 'Icons',
        textColor: '#171a22',
      },
      {
        backgroundColor: '#cf554c',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        name: 'Marvel',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#68b8a0',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
        name: 'Ideas',
        textColor: '#10241f',
      },
      {
        backgroundColor: '#5573b5',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
        name: 'Star Wars',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#7f67bf',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/127873.jpg',
        name: 'Harry Potter',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#a8b4c2',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/42177-1/142596.jpg',
        name: 'Technic',
        textColor: '#171a22',
      },
    ]);
  });

  test('keeps curated theme visuals available in the full theme directory for /themes styling', () => {
    expect(
      listCatalogThemeDirectoryItems()
        .slice(0, 6)
        .map((themeDirectoryItem) => ({
          backgroundColor: themeDirectoryItem.visual?.backgroundColor,
          name: themeDirectoryItem.themeSnapshot.name,
          textColor: themeDirectoryItem.visual?.textColor,
        })),
    ).toEqual([
      {
        backgroundColor: '#f0c63b',
        name: 'Icons',
        textColor: '#171a22',
      },
      {
        backgroundColor: '#cf554c',
        name: 'Marvel',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#68b8a0',
        name: 'Ideas',
        textColor: '#10241f',
      },
      {
        backgroundColor: '#5573b5',
        name: 'Star Wars',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#7f67bf',
        name: 'Harry Potter',
        textColor: '#ffffff',
      },
      {
        backgroundColor: '#a8b4c2',
        name: 'Technic',
        textColor: '#171a22',
      },
    ]);
  });

  test('keeps theme spotlight browsing focused on four stronger homepage lanes', () => {
    expect(
      listHomepageThemeSpotlightItems().map(
        (themeDirectoryItem) => themeDirectoryItem.themeSnapshot.name,
      ),
    ).toEqual(['Icons', 'Marvel', 'Ideas', 'Star Wars']);
  });

  test('builds a full theme directory from the existing theme snapshots and browse order', () => {
    expect(
      listCatalogThemeDirectoryItems().map((themeDirectoryItem) => ({
        imageUrl: themeDirectoryItem.imageUrl,
        name: themeDirectoryItem.themeSnapshot.name,
        setCount: themeDirectoryItem.themeSnapshot.setCount,
      })),
    ).toEqual([
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        name: 'Icons',
        setCount: 17,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        name: 'Marvel',
        setCount: 5,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
        name: 'Ideas',
        setCount: 10,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/94568.jpg',
        name: 'Star Wars',
        setCount: 6,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/127873.jpg',
        name: 'Harry Potter',
        setCount: 6,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/42143-1/103001.jpg',
        name: 'Technic',
        setCount: 5,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10326-1/129017.jpg',
        name: 'Modular Buildings',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10280-1/148035.jpg',
        name: 'Botanicals',
        setCount: 4,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21061-1/140433.jpg',
        name: 'Architecture',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/31208-1/131769.jpg',
        name: 'Art',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/43222-1/130721.jpg',
        name: 'Disney',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/71741-1/80116.jpg',
        name: 'NINJAGO',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/71411-1/104617.jpg',
        name: 'Super Mario',
        setCount: 1,
      },
      {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76956-1/142003.jpg',
        name: 'Jurassic World',
        setCount: 1,
      },
    ]);
  });

  test('exposes dedicated slugs for the supported theme landing pages', () => {
    expect(listCatalogThemePageSlugs()).toEqual([
      'icons',
      'marvel',
      'ideas',
      'star-wars',
      'harry-potter',
      'technic',
      'modular-buildings',
      'botanicals',
      'architecture',
      'art',
      'disney',
      'ninjago',
      'super-mario',
      'jurassic-world',
    ]);
  });

  test('builds dedicated theme landing reads from the existing theme and set data', () => {
    expect(getCatalogThemePageBySlug('marvel')).toEqual({
      themeSnapshot: {
        name: 'Marvel',
        slug: 'marvel',
        setCount: 5,
        momentum:
          "Grote gebouwen, veel minifigs, meteen herkenbaar. Hier zit Marvel op z'n sterkst.",
        signatureSet: 'Avengers Tower',
      },
      setCards: expect.arrayContaining([
        expect.objectContaining({
          id: '76269',
          name: 'Avengers Tower',
          theme: 'Marvel',
        }),
      ]),
    });

    expect(getCatalogThemePageBySlug('super-mario')).toEqual({
      themeSnapshot: {
        name: 'Super Mario',
        slug: 'super-mario',
        setCount: 1,
        momentum:
          'The Mighty Bowser laat zien hoe goed een game-icoon als grote displayset werkt.',
        signatureSet: 'The Mighty Bowser',
      },
      setCards: expect.arrayContaining([
        expect.objectContaining({
          id: '71411',
          name: 'The Mighty Bowser',
          theme: 'Super Mario',
        }),
      ]),
    });
  });

  test('does not expose upstream slug drift through the product route contract', () => {
    expect(
      getCatalogSetBySlug('lord-of-the-rings-rivendell-10316'),
    ).toBeUndefined();
  });

  test('keeps newly curated sets product-ready through local overlay coverage', () => {
    const expectedCatalogSetDetails = [
      {
        id: '10305',
        slug: 'lion-knights-castle-10305',
        name: "Lion Knights' Castle",
        theme: 'Icons',
        releaseYear: 2022,
        pieces: 4515,
        minifigureCount: 22,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10305-1/152495.jpg',
        priceRange: '$359 tot $429',
      },
      {
        id: '21338',
        slug: 'a-frame-cabin-21338',
        name: 'A-Frame Cabin',
        theme: 'Ideas',
        releaseYear: 2023,
        pieces: 2083,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21338-1/116515.jpg',
        priceRange: '$179 tot $239',
      },
      {
        id: '10320',
        slug: 'eldorado-fortress-10320',
        name: 'Eldorado Fortress',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 2509,
        minifigureCount: 8,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10320-1/127861.jpg',
        priceRange: '$189 tot $259',
      },
      {
        id: '21335',
        slug: 'motorized-lighthouse-21335',
        name: 'Motorized Lighthouse',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2065,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21335-1/107884.jpg',
        priceRange: '$259 tot $319',
      },
      {
        id: '10333',
        slug: 'the-lord-of-the-rings-barad-dur-10333',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
        minifigureCount: 10,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg',
        priceRange: '$459 tot $529',
      },
      {
        id: '10332',
        slug: 'medieval-town-square-10332',
        name: 'Medieval Town Square',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 3308,
        minifigureCount: 8,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10332-1/137285.jpg',
        priceRange: '$189 tot $249',
      },
      {
        id: '10315',
        slug: 'tranquil-garden-10315',
        name: 'Tranquil Garden',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 1363,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10315-1/132380.jpg',
        priceRange: '$95 tot $129',
      },
      {
        id: '21333',
        slug: 'vincent-van-gogh-the-starry-night-21333',
        name: 'Vincent van Gogh - The Starry Night',
        theme: 'Ideas',
        releaseYear: 2022,
        pieces: 2316,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21333-1/102873.jpg',
        priceRange: '$149 tot $189',
      },
      {
        id: '21342',
        slug: 'the-insect-collection-21342',
        name: 'The Insect Collection',
        theme: 'Ideas',
        releaseYear: 2023,
        pieces: 1111,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21342-1/126471.jpg',
        priceRange: '$69 tot $99',
      },
      {
        id: '10318',
        slug: 'concorde-10318',
        name: 'Concorde',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 2083,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10318-1/132335.jpg',
        priceRange: '$169 tot $229',
      },
      {
        id: '10331',
        slug: 'kingfisher-bird-10331',
        name: 'Kingfisher Bird',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 834,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10331-1/135670.jpg',
        priceRange: '$49 tot $69',
      },
      {
        id: '10341',
        slug: 'nasa-artemis-space-launch-system-10341',
        name: 'NASA Artemis Space Launch System',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 3601,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10341-1/139647.jpg',
        priceRange: '$239 tot $299',
      },
      {
        id: '21349',
        slug: 'tuxedo-cat-21349',
        name: 'Tuxedo Cat',
        theme: 'Ideas',
        releaseYear: 2024,
        pieces: 1710,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21349-1/140411.jpg',
        priceRange: '$99 tot $139',
      },
      {
        id: '10300',
        slug: 'back-to-the-future-time-machine-10300',
        name: 'Back to the Future Time Machine',
        theme: 'Icons',
        releaseYear: 2022,
        pieces: 1872,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10300-1/99954.jpg',
        priceRange: '$179 tot $229',
      },
      {
        id: '10294',
        slug: 'titanic-10294',
        name: 'Titanic',
        theme: 'Icons',
        releaseYear: 2021,
        pieces: 9092,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10294-1/93446.jpg',
        priceRange: '$629 tot $749',
      },
      {
        id: '21061',
        slug: 'notre-dame-de-paris-21061',
        name: 'Notre-Dame de Paris',
        theme: 'Architecture',
        releaseYear: 2024,
        pieces: 4382,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21061-1/140433.jpg',
        priceRange: '$199 tot $249',
      },
      {
        id: '31208',
        slug: 'hokusai-the-great-wave-31208',
        name: 'Hokusai - The Great Wave',
        theme: 'Art',
        releaseYear: 2023,
        pieces: 1810,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/31208-1/131769.jpg',
        priceRange: '$79 tot $109',
      },
      {
        id: '76419',
        slug: 'hogwarts-castle-and-grounds-76419',
        name: 'Hogwarts Castle and Grounds',
        theme: 'Harry Potter',
        releaseYear: 2023,
        pieces: 2660,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76419-1/123597.jpg',
        priceRange: '$149 tot $189',
      },
      {
        id: '43222',
        slug: 'disney-castle-43222',
        name: 'Disney Castle',
        theme: 'Disney',
        releaseYear: 2023,
        pieces: 4837,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/43222-1/130721.jpg',
        priceRange: '$349 tot $429',
      },
      {
        id: '75313',
        slug: 'at-at-75313',
        name: 'AT-AT',
        theme: 'Star Wars',
        releaseYear: 2021,
        pieces: 6785,
        minifigureCount: 9,
        minifigureHighlights: [
          'Luke Skywalker',
          'General Veers',
          'Snowtrooper Commander',
        ],
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75313-1/94568.jpg',
        priceRange: '$649 tot $799',
      },
      {
        id: '21345',
        slug: 'polaroid-onestep-sx-70-camera-21345',
        name: 'Polaroid OneStep SX-70 Camera',
        theme: 'Ideas',
        releaseYear: 2024,
        pieces: 516,
        imageUrl: 'https://cdn.rebrickable.com/media/sets/21345-1/134647.jpg',
        priceRange: '$69 tot $99',
      },
    ];

    for (const expectedCatalogSetDetail of expectedCatalogSetDetails) {
      const catalogSetDetail = getCatalogSetBySlug(
        expectedCatalogSetDetail.slug,
      );

      expect(catalogSetDetail).toMatchObject({
        ...expectedCatalogSetDetail,
        collectorAngle: nonEmptyText,
        tagline: nonEmptyText,
        availability: nonEmptyText,
      });
      expect(catalogSetDetail?.collectorHighlights).toEqual([
        nonEmptyText,
        nonEmptyText,
        nonEmptyText,
      ]);
    }
  });

  test('keeps curated set copy free from internal editorial or merchandising language', () => {
    for (const slug of expectedProductSlugs) {
      const catalogSetDetail = getCatalogSetBySlug(slug);

      const copy = [
        catalogSetDetail?.collectorAngle,
        catalogSetDetail?.tagline,
        ...(catalogSetDetail?.collectorHighlights ?? []),
      ]
        .join(' ')
        .toLowerCase();

      for (const bannedTerm of bannedCollectorCopyTerms) {
        expect(copy).not.toContain(bannedTerm);
      }
    }
  });

  test('preserves the full summary read-model and theme snapshots', () => {
    expect(listCatalogSetSummaries()).toHaveLength(60);
    expect(listCatalogThemes()).toEqual(expectedCatalogThemes);
  });

  test('adds curated minifigure coverage where character counts matter most to collectors', () => {
    expect(
      [
        ['rivendell-10316', 15],
        ['avengers-tower-76269', 31],
        ['lion-knights-castle-10305', 22],
        ['eldorado-fortress-10320', 8],
        ['the-lord-of-the-rings-barad-dur-10333', 10],
        ['medieval-town-square-10332', 8],
        ['at-at-75313', 9],
        ['natural-history-museum-10326', 7],
        ['sanctum-sanctorum-76218', 9],
        ['the-razor-crest-75331', 5],
        ['gringotts-wizarding-bank-collectors-edition-76417', 13],
        ['daily-bugle-76178', 25],
        ['venator-class-republic-attack-cruiser-75367', 2],
        ['the-burrow-collectors-edition-76437', 10],
        ['x-wing-starfighter-75355', 2],
        ['jabbas-sail-barge-75397', 11],
        ['the-x-mansion-76294', 10],
        ['c-3po-75398', 1],
        ['malfoy-manor-76453', 9],
        ['marvel-logo-76313', 5],
        ['the-lord-of-the-rings-the-shire-10354', 9],
      ].map(([slug]) => {
        const catalogSetDetail = getCatalogSetBySlug(slug);

        return {
          minifigureCount: catalogSetDetail?.minifigureCount,
          slug,
        };
      }),
    ).toEqual(
      [
        ['rivendell-10316', 15],
        ['avengers-tower-76269', 31],
        ['lion-knights-castle-10305', 22],
        ['eldorado-fortress-10320', 8],
        ['the-lord-of-the-rings-barad-dur-10333', 10],
        ['medieval-town-square-10332', 8],
        ['at-at-75313', 9],
        ['natural-history-museum-10326', 7],
        ['sanctum-sanctorum-76218', 9],
        ['the-razor-crest-75331', 5],
        ['gringotts-wizarding-bank-collectors-edition-76417', 13],
        ['daily-bugle-76178', 25],
        ['venator-class-republic-attack-cruiser-75367', 2],
        ['the-burrow-collectors-edition-76437', 10],
        ['x-wing-starfighter-75355', 2],
        ['jabbas-sail-barge-75397', 11],
        ['the-x-mansion-76294', 10],
        ['c-3po-75398', 1],
        ['malfoy-manor-76453', 9],
        ['marvel-logo-76313', 5],
        ['the-lord-of-the-rings-the-shire-10354', 9],
      ].map(([slug, minifigureCount]) => ({
        minifigureCount,
        slug,
      })),
    );

    expect(
      listCatalogSetSlugs().flatMap((slug) => {
        const catalogSetDetail = getCatalogSetBySlug(slug);

        return typeof catalogSetDetail?.minifigureCount === 'number'
          ? [catalogSetDetail.id]
          : [];
      }),
    ).toHaveLength(21);
  });

  test('adds curated minifigure highlights for selected franchise collector sets', () => {
    expect(
      [
        [
          'at-at-75313',
          ['Luke Skywalker', 'General Veers', 'Snowtrooper Commander'],
        ],
        [
          'the-razor-crest-75331',
          ['The Mandalorian', 'Grogu', 'Kuiil', 'The Mythrol'],
        ],
        ['x-wing-starfighter-75355', ['Luke Skywalker', 'R2-D2']],
        [
          'jabbas-sail-barge-75397',
          [
            'Jabba the Hutt',
            'Princess Leia',
            'Bib Fortuna',
            'Max Rebo',
            'C-3PO',
          ],
        ],
        [
          'gringotts-wizarding-bank-collectors-edition-76417',
          [
            'Harry Potter',
            'Hermione Granger',
            'Ron Weasley',
            'Griphook',
            'Hagrid',
          ],
        ],
        [
          'the-burrow-collectors-edition-76437',
          [
            'Arthur Weasley',
            'Molly Weasley',
            'Ron Weasley',
            'Ginny Weasley',
            'Harry Potter',
          ],
        ],
        [
          'daily-bugle-76178',
          [
            'Spider-Man',
            'Green Goblin',
            'Daredevil',
            'J. Jonah Jameson',
            'Aunt May',
          ],
        ],
        [
          'the-x-mansion-76294',
          ['Wolverine', 'Professor X', 'Storm', 'Cyclops', 'Magneto'],
        ],
        ['c-3po-75398', ['C-3PO']],
        [
          'malfoy-manor-76453',
          [
            'Lucius Malfoy',
            'Narcissa Malfoy',
            'Bellatrix Lestrange',
            'Hermione Granger',
            'Dobby',
          ],
        ],
        [
          'marvel-logo-76313',
          ['Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow'],
        ],
        [
          'the-lord-of-the-rings-the-shire-10354',
          [
            'Bilbo Baggins',
            'Frodo Baggins',
            'Samwise Gamgee',
            'Gandalf',
            'Rosie Cotton',
          ],
        ],
      ].map(([slug]) => ({
        minifigureHighlights:
          getCatalogSetBySlug(slug)?.minifigureHighlights ?? undefined,
        slug,
      })),
    ).toEqual(
      [
        [
          'at-at-75313',
          ['Luke Skywalker', 'General Veers', 'Snowtrooper Commander'],
        ],
        [
          'the-razor-crest-75331',
          ['The Mandalorian', 'Grogu', 'Kuiil', 'The Mythrol'],
        ],
        ['x-wing-starfighter-75355', ['Luke Skywalker', 'R2-D2']],
        [
          'jabbas-sail-barge-75397',
          [
            'Jabba the Hutt',
            'Princess Leia',
            'Bib Fortuna',
            'Max Rebo',
            'C-3PO',
          ],
        ],
        [
          'gringotts-wizarding-bank-collectors-edition-76417',
          [
            'Harry Potter',
            'Hermione Granger',
            'Ron Weasley',
            'Griphook',
            'Hagrid',
          ],
        ],
        [
          'the-burrow-collectors-edition-76437',
          [
            'Arthur Weasley',
            'Molly Weasley',
            'Ron Weasley',
            'Ginny Weasley',
            'Harry Potter',
          ],
        ],
        [
          'daily-bugle-76178',
          [
            'Spider-Man',
            'Green Goblin',
            'Daredevil',
            'J. Jonah Jameson',
            'Aunt May',
          ],
        ],
        [
          'the-x-mansion-76294',
          ['Wolverine', 'Professor X', 'Storm', 'Cyclops', 'Magneto'],
        ],
        ['c-3po-75398', ['C-3PO']],
        [
          'malfoy-manor-76453',
          [
            'Lucius Malfoy',
            'Narcissa Malfoy',
            'Bellatrix Lestrange',
            'Hermione Granger',
            'Dobby',
          ],
        ],
        [
          'marvel-logo-76313',
          ['Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow'],
        ],
        [
          'the-lord-of-the-rings-the-shire-10354',
          [
            'Bilbo Baggins',
            'Frodo Baggins',
            'Samwise Gamgee',
            'Gandalf',
            'Rosie Cotton',
          ],
        ],
      ].map(([slug, minifigureHighlights]) => ({
        minifigureHighlights,
        slug,
      })),
    );

    expect(
      listCatalogSetSlugs().flatMap((slug) =>
        getCatalogSetBySlug(slug)?.minifigureHighlights?.length ? [slug] : [],
      ),
    ).toHaveLength(12);
  });

  test('adds curated subthemes and set-status labels for high-intent collector sets', () => {
    expect(
      [
        [
          'avengers-tower-76269',
          {
            setStatus: 'backorder',
            subtheme: 'Avengers',
          },
        ],
        [
          'natural-history-museum-10326',
          {
            setStatus: 'available',
            subtheme: 'Modular Buildings',
          },
        ],
        [
          'sanctum-sanctorum-76218',
          {
            setStatus: 'retired',
            subtheme: 'Doctor Strange',
          },
        ],
        [
          'the-razor-crest-75331',
          {
            setStatus: 'retiring_soon',
            subtheme: 'Ultimate Collector Series',
          },
        ],
        [
          'gringotts-wizarding-bank-collectors-edition-76417',
          {
            setStatus: 'backorder',
            subtheme: 'Diagon Alley',
          },
        ],
        [
          'daily-bugle-76178',
          {
            setStatus: 'retired',
            subtheme: 'Spider-Man',
          },
        ],
        [
          'the-burrow-collectors-edition-76437',
          {
            setStatus: 'available',
            subtheme: 'Wizarding homes',
          },
        ],
        [
          'x-wing-starfighter-75355',
          {
            setStatus: 'retiring_soon',
            subtheme: 'Ultimate Collector Series',
          },
        ],
        [
          'jabbas-sail-barge-75397',
          {
            setStatus: 'available',
            subtheme: 'Return of the Jedi',
          },
        ],
        [
          'the-x-mansion-76294',
          {
            setStatus: undefined,
            subtheme: 'X-Men',
          },
        ],
      ].map(([slug]) => ({
        slug,
        setStatus: getCatalogSetBySlug(slug)?.setStatus,
        subtheme: getCatalogSetBySlug(slug)?.subtheme,
      })),
    ).toEqual(
      [
        [
          'avengers-tower-76269',
          {
            setStatus: 'backorder',
            subtheme: 'Avengers',
          },
        ],
        [
          'natural-history-museum-10326',
          {
            setStatus: 'available',
            subtheme: 'Modular Buildings',
          },
        ],
        [
          'sanctum-sanctorum-76218',
          {
            setStatus: 'retired',
            subtheme: 'Doctor Strange',
          },
        ],
        [
          'the-razor-crest-75331',
          {
            setStatus: 'retiring_soon',
            subtheme: 'Ultimate Collector Series',
          },
        ],
        [
          'gringotts-wizarding-bank-collectors-edition-76417',
          {
            setStatus: 'backorder',
            subtheme: 'Diagon Alley',
          },
        ],
        [
          'daily-bugle-76178',
          {
            setStatus: 'retired',
            subtheme: 'Spider-Man',
          },
        ],
        [
          'the-burrow-collectors-edition-76437',
          {
            setStatus: 'available',
            subtheme: 'Wizarding homes',
          },
        ],
        [
          'x-wing-starfighter-75355',
          {
            setStatus: 'retiring_soon',
            subtheme: 'Ultimate Collector Series',
          },
        ],
        [
          'jabbas-sail-barge-75397',
          {
            setStatus: 'available',
            subtheme: 'Return of the Jedi',
          },
        ],
        [
          'the-x-mansion-76294',
          {
            setStatus: undefined,
            subtheme: 'X-Men',
          },
        ],
      ].map(([slug, expected]) => ({
        slug,
        ...expected,
      })),
    );
  });
});
