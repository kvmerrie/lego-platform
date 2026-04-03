import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  renderCatalogSnapshotModule,
  renderCatalogSyncManifestModule,
} from '@lego-platform/catalog/util';
import { readCatalogGeneratedArtifacts } from './catalog-artifact-writer';
import {
  buildCatalogSyncArtifacts,
  runCatalogSync,
  validateCatalogSyncArtifacts,
} from './catalog-data-access-sync';
import type { RebrickableClient } from './rebrickable-client';

type MockCatalogSet = {
  canonicalId: string;
  slug: string;
  set_num: string;
  name: string;
  year: number;
  num_parts: number;
  theme_id: number;
  set_img_url: string;
};

const mockCatalogThemes = new Map<number, string>([
  [1, 'Icons'],
  [2, 'LEGO Ideas and CUUSOO'],
  [3, 'Avengers'],
  [4, 'Architecture'],
  [5, 'LEGO Art'],
  [6, 'Harry Potter'],
  [7, 'Disney'],
  [8, 'Star Wars > Ultimate Collector Series'],
  [9, 'Modular Buildings'],
  [10, 'Botanicals'],
  [11, 'Technic'],
  [12, 'Super Mario'],
  [13, 'Ninjago'],
  [14, 'The Infinity Saga'],
  [15, 'Jurassic World'],
  [16, 'Spider-Man'],
  [17, 'X-Men'],
  [18, 'Star Wars'],
]);

const mockCatalogSets: readonly MockCatalogSet[] = [
  {
    canonicalId: '10316',
    slug: 'lord-of-the-rings-rivendell-10316',
    set_num: '10316-1',
    name: 'Lord of the Rings: Rivendell',
    year: 2023,
    num_parts: 6181,
    theme_id: 1,
    set_img_url: 'https://images.example/rivendell.jpg',
  },
  {
    canonicalId: '21348',
    slug: 'dungeons-and-dragons-red-dragons-tale-21348',
    set_num: '21348-1',
    name: "Dungeons & Dragons: Red Dragon's Tale",
    year: 2024,
    num_parts: 3747,
    theme_id: 2,
    set_img_url: 'https://images.example/dnd.jpg',
  },
  {
    canonicalId: '76269',
    slug: 'avengers-tower-76269',
    set_num: '76269-1',
    name: 'Avengers Tower',
    year: 2023,
    num_parts: 5202,
    theme_id: 3,
    set_img_url: 'https://images.example/avengers.jpg',
  },
  {
    canonicalId: '10305',
    slug: 'lion-knights-castle-10305',
    set_num: '10305-1',
    name: "Lion Knights' Castle",
    year: 2022,
    num_parts: 4515,
    theme_id: 1,
    set_img_url: 'https://images.example/lion-knights-castle.jpg',
  },
  {
    canonicalId: '21338',
    slug: 'a-frame-cabin-21338',
    set_num: '21338-1',
    name: 'A-Frame Cabin',
    year: 2023,
    num_parts: 2083,
    theme_id: 2,
    set_img_url: 'https://images.example/a-frame-cabin.jpg',
  },
  {
    canonicalId: '10320',
    slug: 'eldorado-fortress-10320',
    set_num: '10320-1',
    name: 'Eldorado Fortress',
    year: 2023,
    num_parts: 2509,
    theme_id: 1,
    set_img_url: 'https://images.example/eldorado-fortress.jpg',
  },
  {
    canonicalId: '21335',
    slug: 'motorized-lighthouse-21335',
    set_num: '21335-1',
    name: 'Motorized Lighthouse',
    year: 2022,
    num_parts: 2065,
    theme_id: 2,
    set_img_url: 'https://images.example/motorized-lighthouse.jpg',
  },
  {
    canonicalId: '10333',
    slug: 'the-lord-of-the-rings-barad-dur-10333',
    set_num: '10333-1',
    name: 'The Lord of the Rings: Barad-dûr',
    year: 2024,
    num_parts: 5478,
    theme_id: 1,
    set_img_url: 'https://images.example/barad-dur.jpg',
  },
  {
    canonicalId: '10332',
    slug: 'medieval-town-square-10332',
    set_num: '10332-1',
    name: 'Medieval Town Square',
    year: 2024,
    num_parts: 3308,
    theme_id: 1,
    set_img_url: 'https://images.example/medieval-town-square.jpg',
  },
  {
    canonicalId: '10315',
    slug: 'tranquil-garden-10315',
    set_num: '10315-1',
    name: 'Tranquil Garden',
    year: 2023,
    num_parts: 1363,
    theme_id: 1,
    set_img_url: 'https://images.example/tranquil-garden.jpg',
  },
  {
    canonicalId: '21333',
    slug: 'the-starry-night-21333',
    set_num: '21333-1',
    name: 'The Starry Night',
    year: 2022,
    num_parts: 2316,
    theme_id: 2,
    set_img_url: 'https://images.example/the-starry-night.jpg',
  },
  {
    canonicalId: '21342',
    slug: 'the-insect-collection-21342',
    set_num: '21342-1',
    name: 'The Insect Collection',
    year: 2023,
    num_parts: 1111,
    theme_id: 2,
    set_img_url: 'https://images.example/the-insect-collection.jpg',
  },
  {
    canonicalId: '10318',
    slug: 'concorde-10318',
    set_num: '10318-1',
    name: 'Concorde',
    year: 2023,
    num_parts: 2083,
    theme_id: 1,
    set_img_url: 'https://images.example/concorde.jpg',
  },
  {
    canonicalId: '10331',
    slug: 'kingfisher-bird-10331',
    set_num: '10331-1',
    name: 'Kingfisher Bird',
    year: 2024,
    num_parts: 834,
    theme_id: 1,
    set_img_url: 'https://images.example/kingfisher-bird.jpg',
  },
  {
    canonicalId: '10341',
    slug: 'nasa-artemis-space-launch-system-10341',
    set_num: '10341-1',
    name: 'NASA Artemis Space Launch System',
    year: 2024,
    num_parts: 3601,
    theme_id: 1,
    set_img_url: 'https://images.example/nasa-artemis.jpg',
  },
  {
    canonicalId: '21349',
    slug: 'tuxedo-cat-21349',
    set_num: '21349-1',
    name: 'Tuxedo Cat',
    year: 2024,
    num_parts: 1710,
    theme_id: 2,
    set_img_url: 'https://images.example/tuxedo-cat.jpg',
  },
  {
    canonicalId: '10300',
    slug: 'back-to-the-future-time-machine-10300',
    set_num: '10300-1',
    name: 'Back to the Future Time Machine',
    year: 2022,
    num_parts: 1872,
    theme_id: 1,
    set_img_url: 'https://images.example/back-to-the-future.jpg',
  },
  {
    canonicalId: '10294',
    slug: 'titanic-10294',
    set_num: '10294-1',
    name: 'Titanic',
    year: 2021,
    num_parts: 9092,
    theme_id: 1,
    set_img_url: 'https://images.example/titanic.jpg',
  },
  {
    canonicalId: '21061',
    slug: 'notre-dame-de-paris-21061',
    set_num: '21061-1',
    name: 'Notre-Dame de Paris',
    year: 2024,
    num_parts: 4382,
    theme_id: 4,
    set_img_url: 'https://images.example/notre-dame.jpg',
  },
  {
    canonicalId: '31208',
    slug: 'hokusai-the-great-wave-31208',
    set_num: '31208-1',
    name: 'Hokusai - The Great Wave',
    year: 2023,
    num_parts: 1810,
    theme_id: 5,
    set_img_url: 'https://images.example/the-great-wave.jpg',
  },
  {
    canonicalId: '76419',
    slug: 'hogwarts-castle-and-grounds-76419',
    set_num: '76419-1',
    name: 'Hogwarts Castle and Grounds',
    year: 2023,
    num_parts: 2660,
    theme_id: 6,
    set_img_url: 'https://images.example/hogwarts-castle-and-grounds.jpg',
  },
  {
    canonicalId: '43222',
    slug: 'disney-castle-43222',
    set_num: '43222-1',
    name: 'Disney Castle',
    year: 2023,
    num_parts: 4837,
    theme_id: 7,
    set_img_url: 'https://images.example/disney-castle.jpg',
  },
  {
    canonicalId: '75313',
    slug: 'at-at-75313',
    set_num: '75313-1',
    name: 'AT-AT',
    year: 2021,
    num_parts: 6785,
    theme_id: 8,
    set_img_url: 'https://images.example/at-at.jpg',
  },
  {
    canonicalId: '21345',
    slug: 'polaroid-onestep-sx-70-21345',
    set_num: '21345-1',
    name: 'Polaroid OneStep SX-70',
    year: 2024,
    num_parts: 516,
    theme_id: 2,
    set_img_url: 'https://images.example/polaroid.jpg',
  },
  {
    canonicalId: '10326',
    slug: 'natural-history-museum-10326',
    set_num: '10326-1',
    name: 'Natural History Museum',
    year: 2023,
    num_parts: 4015,
    theme_id: 9,
    set_img_url: 'https://images.example/natural-history-museum.jpg',
  },
  {
    canonicalId: '10323',
    slug: 'pac-man-arcade-10323',
    set_num: '10323-1',
    name: 'PAC-MAN Arcade',
    year: 2023,
    num_parts: 2651,
    theme_id: 1,
    set_img_url: 'https://images.example/pac-man-arcade.jpg',
  },
  {
    canonicalId: '10306',
    slug: 'atari-2600-10306',
    set_num: '10306-1',
    name: 'Atari 2600',
    year: 2022,
    num_parts: 2532,
    theme_id: 1,
    set_img_url: 'https://images.example/atari-2600.jpg',
  },
  {
    canonicalId: '10280',
    slug: 'flower-bouquet-10280',
    set_num: '10280-1',
    name: 'Flower Bouquet',
    year: 2021,
    num_parts: 756,
    theme_id: 10,
    set_img_url: 'https://images.example/flower-bouquet.jpg',
  },
  {
    canonicalId: '10311',
    slug: 'orchid-10311',
    set_num: '10311-1',
    name: 'Orchid',
    year: 2022,
    num_parts: 608,
    theme_id: 10,
    set_img_url: 'https://images.example/orchid.jpg',
  },
  {
    canonicalId: '21327',
    slug: 'typewriter-21327',
    set_num: '21327-1',
    name: 'Typewriter',
    year: 2021,
    num_parts: 2080,
    theme_id: 2,
    set_img_url: 'https://images.example/typewriter.jpg',
  },
  {
    canonicalId: '21343',
    slug: 'viking-village-21343',
    set_num: '21343-1',
    name: 'Viking Village',
    year: 2023,
    num_parts: 2104,
    theme_id: 2,
    set_img_url: 'https://images.example/viking-village.jpg',
  },
  {
    canonicalId: '42115',
    slug: 'lamborghini-sian-fkp-37-42115',
    set_num: '42115-1',
    name: 'Lamborghini Sián FKP 37',
    year: 2020,
    num_parts: 3696,
    theme_id: 11,
    set_img_url: 'https://images.example/lamborghini-sian.jpg',
  },
  {
    canonicalId: '42143',
    slug: 'ferrari-daytona-sp3-42143',
    set_num: '42143-1',
    name: 'Ferrari Daytona SP3',
    year: 2022,
    num_parts: 3778,
    theme_id: 11,
    set_img_url: 'https://images.example/ferrari-daytona-sp3.jpg',
  },
  {
    canonicalId: '71411',
    slug: 'the-mighty-bowser-71411',
    set_num: '71411-1',
    name: 'The Mighty Bowser',
    year: 2022,
    num_parts: 2807,
    theme_id: 12,
    set_img_url: 'https://images.example/the-mighty-bowser.jpg',
  },
  {
    canonicalId: '71741',
    slug: 'ninjago-city-gardens-71741',
    set_num: '71741-1',
    name: 'NINJAGO City Gardens',
    year: 2021,
    num_parts: 5710,
    theme_id: 13,
    set_img_url: 'https://images.example/ninjago-city-gardens.jpg',
  },
  {
    canonicalId: '76218',
    slug: 'sanctum-sanctorum-76218',
    set_num: '76218-1',
    name: 'Sanctum Sanctorum',
    year: 2022,
    num_parts: 2713,
    theme_id: 14,
    set_img_url: 'https://images.example/sanctum-sanctorum.jpg',
  },
  {
    canonicalId: '76956',
    slug: 't-rex-breakout-76956',
    set_num: '76956-1',
    name: 'T. rex Breakout',
    year: 2022,
    num_parts: 1212,
    theme_id: 15,
    set_img_url: 'https://images.example/t-rex-breakout.jpg',
  },
  {
    canonicalId: '75331',
    slug: 'the-razor-crest-75331',
    set_num: '75331-1',
    name: 'The Razor Crest',
    year: 2022,
    num_parts: 6187,
    theme_id: 8,
    set_img_url: 'https://images.example/the-razor-crest.jpg',
  },
  {
    canonicalId: '76417',
    slug: 'gringotts-wizarding-bank-collectors-edition-76417',
    set_num: '76417-1',
    name: "Gringotts Wizarding Bank – Collectors' Edition",
    year: 2023,
    num_parts: 4809,
    theme_id: 6,
    set_img_url: 'https://images.example/gringotts.jpg',
  },
  {
    canonicalId: '76178',
    slug: 'daily-bugle-76178',
    set_num: '76178-1',
    name: 'Daily Bugle',
    year: 2021,
    num_parts: 3803,
    theme_id: 16,
    set_img_url: 'https://images.example/daily-bugle.jpg',
  },
  {
    canonicalId: '75367',
    slug: 'venator-class-republic-attack-cruiser-75367',
    set_num: '75367-1',
    name: 'Venator-Class Republic Attack Cruiser',
    year: 2023,
    num_parts: 5381,
    theme_id: 8,
    set_img_url: 'https://images.example/venator.jpg',
  },
  {
    canonicalId: '21350',
    slug: 'jaws-21350',
    set_num: '21350-1',
    name: 'Jaws',
    year: 2024,
    num_parts: 1497,
    theme_id: 2,
    set_img_url: 'https://images.example/jaws.jpg',
  },
  {
    canonicalId: '10317',
    slug: 'land-rover-classic-defender-90-10317',
    set_num: '10317-1',
    name: 'Land Rover Classic Defender 90',
    year: 2023,
    num_parts: 2344,
    theme_id: 1,
    set_img_url: 'https://images.example/land-rover-classic-defender-90.jpg',
  },
  {
    canonicalId: '76437',
    slug: 'the-burrow-collectors-edition-76437',
    set_num: '76437-1',
    name: "The Burrow – Collectors' Edition",
    year: 2024,
    num_parts: 2403,
    theme_id: 6,
    set_img_url: 'https://images.example/the-burrow-collectors-edition.jpg',
  },
  {
    canonicalId: '75355',
    slug: 'x-wing-starfighter-75355',
    set_num: '75355-1',
    name: 'X-Wing Starfighter',
    year: 2023,
    num_parts: 1949,
    theme_id: 8,
    set_img_url: 'https://images.example/x-wing-starfighter.jpg',
  },
  {
    canonicalId: '75397',
    slug: 'jabbas-sail-barge-75397',
    set_num: '75397-1',
    name: "Jabba's Sail Barge",
    year: 2024,
    num_parts: 3942,
    theme_id: 8,
    set_img_url: 'https://images.example/jabbas-sail-barge.jpg',
  },
  {
    canonicalId: '76429',
    slug: 'talking-sorting-hat-76429',
    set_num: '76429-1',
    name: 'Talking Sorting Hat',
    year: 2024,
    num_parts: 561,
    theme_id: 6,
    set_img_url: 'https://images.example/talking-sorting-hat.jpg',
  },
  {
    canonicalId: '76435',
    slug: 'hogwarts-castle-the-great-hall-76435',
    set_num: '76435-1',
    name: 'Hogwarts Castle: The Great Hall',
    year: 2024,
    num_parts: 1732,
    theme_id: 6,
    set_img_url: 'https://images.example/hogwarts-great-hall.jpg',
  },
  {
    canonicalId: '76294',
    slug: 'x-mansion-76294',
    set_num: '76294-1',
    name: 'X-Mansion',
    year: 2024,
    num_parts: 3093,
    theme_id: 17,
    set_img_url: 'https://images.example/x-mansion.jpg',
  },
  {
    canonicalId: '10335',
    slug: 'the-endurance-10335',
    set_num: '10335-1',
    name: 'The Endurance',
    year: 2024,
    num_parts: 3011,
    theme_id: 1,
    set_img_url: 'https://images.example/the-endurance.jpg',
  },
  {
    canonicalId: '10327',
    slug: 'dune-atreides-royal-ornithopter-10327',
    set_num: '10327-1',
    name: 'Dune Atreides Royal Ornithopter',
    year: 2024,
    num_parts: 1369,
    theme_id: 1,
    set_img_url: 'https://images.example/dune-ornithopter.jpg',
  },
  {
    canonicalId: '42171',
    slug: 'mercedes-amg-f1-w14-e-performance-42171',
    set_num: '42171-1',
    name: 'Mercedes-AMG F1 W14 E Performance',
    year: 2024,
    num_parts: 1642,
    theme_id: 11,
    set_img_url: 'https://images.example/mercedes-f1.jpg',
  },
  {
    canonicalId: '42172',
    slug: 'mclaren-p1-42172',
    set_num: '42172-1',
    name: 'McLaren P1',
    year: 2024,
    num_parts: 3893,
    theme_id: 11,
    set_img_url: 'https://images.example/mclaren-p1.jpg',
  },
  {
    canonicalId: '10328',
    slug: 'bouquet-of-roses-10328',
    set_num: '10328-1',
    name: 'Bouquet of Roses',
    year: 2024,
    num_parts: 822,
    theme_id: 10,
    set_img_url: 'https://images.example/bouquet-of-roses.jpg',
  },
  {
    canonicalId: '75398',
    slug: 'c-3po-75398',
    set_num: '75398-1',
    name: 'C-3PO',
    year: 2024,
    num_parts: 1140,
    theme_id: 18,
    set_img_url: 'https://images.example/c-3po.jpg',
  },
  {
    canonicalId: '76453',
    slug: 'malfoy-manor-76453',
    set_num: '76453-1',
    name: 'Malfoy Manor',
    year: 2025,
    num_parts: 1602,
    theme_id: 6,
    set_img_url: 'https://images.example/malfoy-manor.jpg',
  },
  {
    canonicalId: '76313',
    slug: 'marvel-logo-76313',
    set_num: '76313-1',
    name: 'MARVEL Logo',
    year: 2025,
    num_parts: 931,
    theme_id: 14,
    set_img_url: 'https://images.example/marvel-logo.jpg',
  },
  {
    canonicalId: '10354',
    slug: 'the-lord-of-the-rings-the-shire-10354',
    set_num: '10354-1',
    name: 'The Lord of the Rings: The Shire',
    year: 2025,
    num_parts: 2017,
    theme_id: 1,
    set_img_url: 'https://images.example/the-shire.jpg',
  },
  {
    canonicalId: '42177',
    slug: 'mercedes-benz-g-500-professional-line-42177',
    set_num: '42177-1',
    name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
    year: 2024,
    num_parts: 2891,
    theme_id: 1,
    set_img_url: 'https://images.example/mercedes-benz-g-500.jpg',
  },
  {
    canonicalId: '10342',
    slug: 'pretty-pink-flower-bouquet-10342',
    set_num: '10342-1',
    name: 'Pretty Pink Flower Bouquet',
    year: 2025,
    num_parts: 749,
    theme_id: 10,
    set_img_url: 'https://images.example/pretty-pink-flower-bouquet.jpg',
  },
];

function toRebrickableSetPayload(mockCatalogSet: MockCatalogSet) {
  return {
    set_num: mockCatalogSet.set_num,
    name: mockCatalogSet.name,
    year: mockCatalogSet.year,
    num_parts: mockCatalogSet.num_parts,
    theme_id: mockCatalogSet.theme_id,
    set_img_url: mockCatalogSet.set_img_url,
  };
}

function getMockThemeName(themeId: number): string {
  const themeName = mockCatalogThemes.get(themeId);

  if (!themeName) {
    throw new Error(`Unexpected theme lookup for ${themeId}.`);
  }

  return themeName;
}

const expectedCatalogSnapshot = {
  source: 'rebrickable-api-v3',
  generatedAt: '2026-03-28T00:00:00.000Z',
  setRecords: mockCatalogSets.map((mockCatalogSet) => ({
    canonicalId: mockCatalogSet.canonicalId,
    sourceSetNumber: mockCatalogSet.set_num,
    slug: mockCatalogSet.slug,
    name: mockCatalogSet.name,
    theme: getMockThemeName(mockCatalogSet.theme_id),
    releaseYear: mockCatalogSet.year,
    pieces: mockCatalogSet.num_parts,
    imageUrl: mockCatalogSet.set_img_url,
  })),
};

const expectedCatalogSyncManifest = {
  source: 'rebrickable-api-v3',
  generatedAt: '2026-03-28T00:00:00.000Z',
  recordCount: mockCatalogSets.length,
  homepageFeaturedSetIds: ['10316', '10333', '21333'],
  notes:
    'Generated from the curated Rebrickable sync scope. Collector-facing overlays remain local.',
};

function createMockRebrickableClient(): RebrickableClient {
  const setPayloadByNumber = new Map(
    mockCatalogSets.map((mockCatalogSet) => [
      mockCatalogSet.set_num,
      toRebrickableSetPayload(mockCatalogSet),
    ]),
  );

  return {
    async getSet(setNumber: string) {
      const setPayload = setPayloadByNumber.get(setNumber);

      if (!setPayload) {
        throw new Error(`Unexpected set lookup for ${setNumber}.`);
      }

      return setPayload;
    },
    async getTheme(themeId: number) {
      return { id: themeId, name: getMockThemeName(themeId) };
    },
  };
}

function createMockFetchImpl(): typeof fetch {
  return async (input) => {
    const url = String(input);

    for (const mockCatalogSet of mockCatalogSets) {
      if (url.endsWith(`/lego/sets/${mockCatalogSet.set_num}/`)) {
        return new Response(
          JSON.stringify(toRebrickableSetPayload(mockCatalogSet)),
          {
            status: 200,
          },
        );
      }
    }

    for (const [themeId, themeName] of mockCatalogThemes) {
      if (url.endsWith(`/lego/themes/${themeId}/`)) {
        return new Response(JSON.stringify({ id: themeId, name: themeName }), {
          status: 200,
        });
      }
    }

    return new Response(null, { status: 404 });
  };
}

describe('catalog sync artifacts', () => {
  test('reads committed-style generated artifact modules in canonical writer format', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'catalog-artifacts-'));
    const snapshotPath = join(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts',
    );
    const manifestPath = join(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts',
    );

    await mkdir(dirname(snapshotPath), { recursive: true });

    await writeFile(
      snapshotPath,
      renderCatalogSnapshotModule({
        source: 'rebrickable-api-v3',
        generatedAt: '2026-03-28T00:00:00.000Z',
        setRecords: [
          {
            canonicalId: '10316',
            sourceSetNumber: '10316-1',
            slug: 'lord-of-the-rings-rivendell-10316',
            name: 'Lord of the Rings: Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6181,
            imageUrl: 'https://images.example/rivendell.jpg',
          },
        ],
      }),
      'utf8',
    );
    await writeFile(
      manifestPath,
      renderCatalogSyncManifestModule({
        source: 'rebrickable-api-v3',
        generatedAt: '2026-03-28T00:00:00.000Z',
        recordCount: 1,
        homepageFeaturedSetIds: ['10316'],
        notes: 'Generated from the curated Rebrickable sync scope.',
      }),
      'utf8',
    );

    await expect(
      readCatalogGeneratedArtifacts({
        workspaceRoot,
      }),
    ).resolves.toEqual({
      catalogSnapshot: {
        source: 'rebrickable-api-v3',
        generatedAt: '2026-03-28T00:00:00.000Z',
        setRecords: [
          {
            canonicalId: '10316',
            sourceSetNumber: '10316-1',
            slug: 'lord-of-the-rings-rivendell-10316',
            name: 'Lord of the Rings: Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6181,
            imageUrl: 'https://images.example/rivendell.jpg',
          },
        ],
      },
      catalogSyncManifest: {
        source: 'rebrickable-api-v3',
        generatedAt: '2026-03-28T00:00:00.000Z',
        recordCount: 1,
        homepageFeaturedSetIds: ['10316'],
        notes: 'Generated from the curated Rebrickable sync scope.',
      },
    });
  });

  test('rejects generated artifact modules that drift into object-literal formatting', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'catalog-artifacts-'));
    const snapshotPath = join(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts',
    );
    const manifestPath = join(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts',
    );

    await mkdir(dirname(snapshotPath), { recursive: true });

    await writeFile(
      snapshotPath,
      `import type { CatalogSnapshot } from '@lego-platform/catalog/util';

// Generated by apps/catalog-sync. Do not edit by hand.
export const catalogSnapshot: CatalogSnapshot = {
  source: 'rebrickable-api-v3',
  generatedAt: '2026-03-28T00:00:00.000Z',
  setRecords: [],
};
`,
      'utf8',
    );
    await writeFile(
      manifestPath,
      renderCatalogSyncManifestModule({
        source: 'rebrickable-api-v3',
        generatedAt: '2026-03-28T00:00:00.000Z',
        recordCount: 0,
        homepageFeaturedSetIds: [],
      }),
      'utf8',
    );

    await expect(
      readCatalogGeneratedArtifacts({
        workspaceRoot,
      }),
    ).rejects.toThrow('canonical JSON template payload format');
  });

  test('builds normalized snapshot and manifest data from curated Rebrickable records', async () => {
    const artifacts = await buildCatalogSyncArtifacts({
      now: new Date('2026-03-28T00:00:00.000Z'),
      rebrickableClient: createMockRebrickableClient(),
    });

    expect(artifacts.catalogSnapshot).toEqual(expectedCatalogSnapshot);
    expect(artifacts.catalogSyncManifest).toEqual(expectedCatalogSyncManifest);
  });

  test('rejects malformed source payloads before artifacts are built', async () => {
    await expect(
      buildCatalogSyncArtifacts({
        now: new Date('2026-03-28T00:00:00.000Z'),
        rebrickableClient: {
          async getSet() {
            return {
              set_num: '10316-1',
              name: '',
              year: 2023,
              num_parts: 6167,
              theme_id: 1,
            };
          },
          async getTheme() {
            return { id: 1, name: 'Icons' };
          },
        },
      }),
    ).rejects.toThrow(
      'Invalid Rebrickable set payload for 10316-1: name is required.',
    );
  });

  test('writes generated artifact modules into the existing catalog read-artifact paths', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'catalog-sync-'));

    await runCatalogSync({
      apiKey: 'test-key',
      fetchImpl: createMockFetchImpl(),
      now: new Date('2026-03-28T00:00:00.000Z'),
      workspaceRoot,
    });

    const snapshotModule = await readFile(
      join(
        workspaceRoot,
        'libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts',
      ),
      'utf8',
    );
    const manifestModule = await readFile(
      join(
        workspaceRoot,
        'libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts',
      ),
      'utf8',
    );

    expect(snapshotModule).toContain(
      '// Generated by apps/catalog-sync. Do not edit by hand.',
    );
    expect(snapshotModule).toContain('"canonicalId": "10316"');
    expect(manifestModule).toContain('"homepageFeaturedSetIds": [');
  });

  test('keeps generated artifacts stable across repeated runs when source data is unchanged', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'catalog-sync-stable-'));
    const fetchImpl = createMockFetchImpl();

    const writeResult = await runCatalogSync({
      apiKey: 'test-key',
      fetchImpl,
      now: new Date('2026-03-28T00:00:00.000Z'),
      workspaceRoot,
    });

    const checkResult = await runCatalogSync({
      apiKey: 'test-key',
      fetchImpl,
      mode: 'check',
      now: new Date('2026-03-29T00:00:00.000Z'),
      workspaceRoot,
    });

    expect(writeResult.catalogSnapshot.generatedAt).toBe(
      '2026-03-28T00:00:00.000Z',
    );
    expect(checkResult.catalogSnapshot.generatedAt).toBe(
      '2026-03-28T00:00:00.000Z',
    );
    expect(checkResult.catalogSyncManifest.generatedAt).toBe(
      '2026-03-28T00:00:00.000Z',
    );
    expect(checkResult.artifactCheck.isClean).toBe(true);
    expect(checkResult.artifactCheck.stalePaths).toEqual([]);
  });

  test('fails validation when a synced set is missing a local product overlay', () => {
    expect(() =>
      validateCatalogSyncArtifacts({
        catalogSnapshot: {
          source: 'rebrickable-api-v3',
          generatedAt: '2026-03-28T00:00:00.000Z',
          setRecords: [
            {
              canonicalId: '99999',
              sourceSetNumber: '99999-1',
              slug: 'mystery-set-99999',
              name: 'Mystery Set',
              theme: 'Icons',
              releaseYear: 2026,
              pieces: 1000,
            },
          ],
        },
        catalogSyncManifest: {
          source: 'rebrickable-api-v3',
          generatedAt: '2026-03-28T00:00:00.000Z',
          recordCount: 1,
          homepageFeaturedSetIds: ['99999'],
        },
      }),
    ).toThrow('Missing product overlay for synced catalog set 99999.');
  });

  test('fails validation when product slug overrides collide', () => {
    expect(() =>
      validateCatalogSyncArtifacts({
        catalogSnapshot: {
          source: 'rebrickable-api-v3',
          generatedAt: '2026-03-28T00:00:00.000Z',
          setRecords: [
            {
              canonicalId: '10316',
              sourceSetNumber: '10316-1',
              slug: 'lord-of-the-rings-rivendell-10316',
              name: 'Lord of the Rings: Rivendell',
              theme: 'Icons',
              releaseYear: 2023,
              pieces: 6181,
            },
            {
              canonicalId: '10305',
              sourceSetNumber: '10305-1',
              slug: 'lion-knights-castle-10305',
              name: "Lion Knights' Castle",
              theme: 'Icons',
              releaseYear: 2022,
              pieces: 4515,
            },
            {
              canonicalId: '10320',
              sourceSetNumber: '10320-1',
              slug: 'eldorado-fortress-10320',
              name: 'Eldorado Fortress',
              theme: 'Icons',
              releaseYear: 2023,
              pieces: 2509,
            },
          ],
        },
        catalogSyncManifest: {
          source: 'rebrickable-api-v3',
          generatedAt: '2026-03-28T00:00:00.000Z',
          recordCount: 3,
          homepageFeaturedSetIds: ['10316'],
        },
        catalogSetOverlays: [
          {
            canonicalId: '10316',
            productSlug: 'shared-product-slug',
            collectorAngle: 'Anchor',
            priceRange: '$0',
            tagline: 'Tagline',
            availability: 'Availability',
            collectorHighlights: ['One'],
          },
          {
            canonicalId: '10305',
            productSlug: 'shared-product-slug',
            collectorAngle: 'Anchor',
            priceRange: '$0',
            tagline: 'Tagline',
            availability: 'Availability',
            collectorHighlights: ['One'],
          },
        ],
      }),
    ).toThrow(
      'Catalog sync produced a duplicate product slug: shared-product-slug.',
    );
  });

  test('fails validation when homepage featured ids drift outside the snapshot', async () => {
    await expect(
      buildCatalogSyncArtifacts({
        now: new Date('2026-03-28T00:00:00.000Z'),
        rebrickableClient: createMockRebrickableClient(),
        curatedSetNumbers: ['10316-1'],
      }),
    ).rejects.toThrow(
      'Homepage featured set 10333 is missing from the generated catalog snapshot.',
    );
  });
});
