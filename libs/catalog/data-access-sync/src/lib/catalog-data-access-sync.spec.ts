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

function createMockRebrickableClient(): RebrickableClient {
  return {
    async getSet(setNumber: string) {
      switch (setNumber) {
        case '10316-1':
          return {
            set_num: '10316-1',
            name: 'Lord of the Rings: Rivendell',
            year: 2023,
            num_parts: 6181,
            theme_id: 1,
            set_img_url: 'https://images.example/rivendell.jpg',
          };
        case '21348-1':
          return {
            set_num: '21348-1',
            name: "Dungeons & Dragons: Red Dragon's Tale",
            year: 2024,
            num_parts: 3747,
            theme_id: 2,
            set_img_url: 'https://images.example/dnd.jpg',
          };
        case '76269-1':
          return {
            set_num: '76269-1',
            name: 'Avengers Tower',
            year: 2023,
            num_parts: 5202,
            theme_id: 3,
            set_img_url: 'https://images.example/avengers.jpg',
          };
        case '10305-1':
          return {
            set_num: '10305-1',
            name: "Lion Knights' Castle",
            year: 2022,
            num_parts: 4515,
            theme_id: 1,
            set_img_url: 'https://images.example/lion-knights-castle.jpg',
          };
        case '21338-1':
          return {
            set_num: '21338-1',
            name: 'A-Frame Cabin',
            year: 2023,
            num_parts: 2083,
            theme_id: 2,
            set_img_url: 'https://images.example/a-frame-cabin.jpg',
          };
        case '10320-1':
          return {
            set_num: '10320-1',
            name: 'Eldorado Fortress',
            year: 2023,
            num_parts: 2509,
            theme_id: 1,
            set_img_url: 'https://images.example/eldorado-fortress.jpg',
          };
        case '21335-1':
          return {
            set_num: '21335-1',
            name: 'Motorized Lighthouse',
            year: 2022,
            num_parts: 2065,
            theme_id: 2,
            set_img_url: 'https://images.example/motorized-lighthouse.jpg',
          };
        case '10333-1':
          return {
            set_num: '10333-1',
            name: 'The Lord of the Rings: Barad-dûr',
            year: 2024,
            num_parts: 5478,
            theme_id: 1,
            set_img_url: 'https://images.example/barad-dur.jpg',
          };
        case '10332-1':
          return {
            set_num: '10332-1',
            name: 'Medieval Town Square',
            year: 2024,
            num_parts: 3308,
            theme_id: 1,
            set_img_url: 'https://images.example/medieval-town-square.jpg',
          };
        case '10315-1':
          return {
            set_num: '10315-1',
            name: 'Tranquil Garden',
            year: 2023,
            num_parts: 1363,
            theme_id: 1,
            set_img_url: 'https://images.example/tranquil-garden.jpg',
          };
        case '21333-1':
          return {
            set_num: '21333-1',
            name: 'The Starry Night',
            year: 2022,
            num_parts: 2316,
            theme_id: 2,
            set_img_url: 'https://images.example/the-starry-night.jpg',
          };
        case '21342-1':
          return {
            set_num: '21342-1',
            name: 'The Insect Collection',
            year: 2023,
            num_parts: 1111,
            theme_id: 2,
            set_img_url: 'https://images.example/the-insect-collection.jpg',
          };
        case '10318-1':
          return {
            set_num: '10318-1',
            name: 'Concorde',
            year: 2023,
            num_parts: 2083,
            theme_id: 1,
            set_img_url: 'https://images.example/concorde.jpg',
          };
        case '10331-1':
          return {
            set_num: '10331-1',
            name: 'Kingfisher Bird',
            year: 2024,
            num_parts: 834,
            theme_id: 1,
            set_img_url: 'https://images.example/kingfisher-bird.jpg',
          };
        case '10341-1':
          return {
            set_num: '10341-1',
            name: 'NASA Artemis Space Launch System',
            year: 2024,
            num_parts: 3601,
            theme_id: 1,
            set_img_url: 'https://images.example/nasa-artemis.jpg',
          };
        case '21349-1':
          return {
            set_num: '21349-1',
            name: 'Tuxedo Cat',
            year: 2024,
            num_parts: 1710,
            theme_id: 2,
            set_img_url: 'https://images.example/tuxedo-cat.jpg',
          };
        case '10300-1':
          return {
            set_num: '10300-1',
            name: 'Back to the Future Time Machine',
            year: 2022,
            num_parts: 1872,
            theme_id: 1,
            set_img_url: 'https://images.example/back-to-the-future.jpg',
          };
        case '10294-1':
          return {
            set_num: '10294-1',
            name: 'Titanic',
            year: 2021,
            num_parts: 9092,
            theme_id: 1,
            set_img_url: 'https://images.example/titanic.jpg',
          };
        case '21061-1':
          return {
            set_num: '21061-1',
            name: 'Notre-Dame de Paris',
            year: 2024,
            num_parts: 4382,
            theme_id: 4,
            set_img_url: 'https://images.example/notre-dame.jpg',
          };
        case '31208-1':
          return {
            set_num: '31208-1',
            name: 'Hokusai - The Great Wave',
            year: 2023,
            num_parts: 1810,
            theme_id: 5,
            set_img_url: 'https://images.example/the-great-wave.jpg',
          };
        case '76419-1':
          return {
            set_num: '76419-1',
            name: 'Hogwarts Castle and Grounds',
            year: 2023,
            num_parts: 2660,
            theme_id: 6,
            set_img_url:
              'https://images.example/hogwarts-castle-and-grounds.jpg',
          };
        case '43222-1':
          return {
            set_num: '43222-1',
            name: 'Disney Castle',
            year: 2023,
            num_parts: 4837,
            theme_id: 7,
            set_img_url: 'https://images.example/disney-castle.jpg',
          };
        case '75313-1':
          return {
            set_num: '75313-1',
            name: 'AT-AT',
            year: 2021,
            num_parts: 6785,
            theme_id: 8,
            set_img_url: 'https://images.example/at-at.jpg',
          };
        case '21345-1':
          return {
            set_num: '21345-1',
            name: 'Polaroid OneStep SX-70',
            year: 2024,
            num_parts: 516,
            theme_id: 2,
            set_img_url: 'https://images.example/polaroid.jpg',
          };
        default:
          throw new Error(`Unexpected set lookup for ${setNumber}.`);
      }
    },
    async getTheme(themeId: number) {
      switch (themeId) {
        case 1:
          return { id: 1, name: 'Icons' };
        case 2:
          return { id: 2, name: 'LEGO Ideas and CUUSOO' };
        case 3:
          return { id: 3, name: 'Avengers' };
        case 4:
          return { id: 4, name: 'Architecture' };
        case 5:
          return { id: 5, name: 'LEGO Art' };
        case 6:
          return { id: 6, name: 'Harry Potter' };
        case 7:
          return { id: 7, name: 'Disney' };
        case 8:
          return { id: 8, name: 'Star Wars > Ultimate Collector Series' };
        default:
          throw new Error(`Unexpected theme lookup for ${themeId}.`);
      }
    },
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

    expect(artifacts.catalogSnapshot).toEqual({
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
        {
          canonicalId: '21348',
          sourceSetNumber: '21348-1',
          slug: 'dungeons-and-dragons-red-dragons-tale-21348',
          name: "Dungeons & Dragons: Red Dragon's Tale",
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2024,
          pieces: 3747,
          imageUrl: 'https://images.example/dnd.jpg',
        },
        {
          canonicalId: '76269',
          sourceSetNumber: '76269-1',
          slug: 'avengers-tower-76269',
          name: 'Avengers Tower',
          theme: 'Avengers',
          releaseYear: 2023,
          pieces: 5202,
          imageUrl: 'https://images.example/avengers.jpg',
        },
        {
          canonicalId: '10305',
          sourceSetNumber: '10305-1',
          slug: 'lion-knights-castle-10305',
          name: "Lion Knights' Castle",
          theme: 'Icons',
          releaseYear: 2022,
          pieces: 4515,
          imageUrl: 'https://images.example/lion-knights-castle.jpg',
        },
        {
          canonicalId: '21338',
          sourceSetNumber: '21338-1',
          slug: 'a-frame-cabin-21338',
          name: 'A-Frame Cabin',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2023,
          pieces: 2083,
          imageUrl: 'https://images.example/a-frame-cabin.jpg',
        },
        {
          canonicalId: '10320',
          sourceSetNumber: '10320-1',
          slug: 'eldorado-fortress-10320',
          name: 'Eldorado Fortress',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 2509,
          imageUrl: 'https://images.example/eldorado-fortress.jpg',
        },
        {
          canonicalId: '21335',
          sourceSetNumber: '21335-1',
          slug: 'motorized-lighthouse-21335',
          name: 'Motorized Lighthouse',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2022,
          pieces: 2065,
          imageUrl: 'https://images.example/motorized-lighthouse.jpg',
        },
        {
          canonicalId: '10333',
          sourceSetNumber: '10333-1',
          slug: 'the-lord-of-the-rings-barad-dur-10333',
          name: 'The Lord of the Rings: Barad-dûr',
          theme: 'Icons',
          releaseYear: 2024,
          pieces: 5478,
          imageUrl: 'https://images.example/barad-dur.jpg',
        },
        {
          canonicalId: '10332',
          sourceSetNumber: '10332-1',
          slug: 'medieval-town-square-10332',
          name: 'Medieval Town Square',
          theme: 'Icons',
          releaseYear: 2024,
          pieces: 3308,
          imageUrl: 'https://images.example/medieval-town-square.jpg',
        },
        {
          canonicalId: '10315',
          sourceSetNumber: '10315-1',
          slug: 'tranquil-garden-10315',
          name: 'Tranquil Garden',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 1363,
          imageUrl: 'https://images.example/tranquil-garden.jpg',
        },
        {
          canonicalId: '21333',
          sourceSetNumber: '21333-1',
          slug: 'the-starry-night-21333',
          name: 'The Starry Night',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2022,
          pieces: 2316,
          imageUrl: 'https://images.example/the-starry-night.jpg',
        },
        {
          canonicalId: '21342',
          sourceSetNumber: '21342-1',
          slug: 'the-insect-collection-21342',
          name: 'The Insect Collection',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2023,
          pieces: 1111,
          imageUrl: 'https://images.example/the-insect-collection.jpg',
        },
        {
          canonicalId: '10318',
          sourceSetNumber: '10318-1',
          slug: 'concorde-10318',
          name: 'Concorde',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 2083,
          imageUrl: 'https://images.example/concorde.jpg',
        },
        {
          canonicalId: '10331',
          sourceSetNumber: '10331-1',
          slug: 'kingfisher-bird-10331',
          name: 'Kingfisher Bird',
          theme: 'Icons',
          releaseYear: 2024,
          pieces: 834,
          imageUrl: 'https://images.example/kingfisher-bird.jpg',
        },
        {
          canonicalId: '10341',
          sourceSetNumber: '10341-1',
          slug: 'nasa-artemis-space-launch-system-10341',
          name: 'NASA Artemis Space Launch System',
          theme: 'Icons',
          releaseYear: 2024,
          pieces: 3601,
          imageUrl: 'https://images.example/nasa-artemis.jpg',
        },
        {
          canonicalId: '21349',
          sourceSetNumber: '21349-1',
          slug: 'tuxedo-cat-21349',
          name: 'Tuxedo Cat',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2024,
          pieces: 1710,
          imageUrl: 'https://images.example/tuxedo-cat.jpg',
        },
        {
          canonicalId: '10300',
          sourceSetNumber: '10300-1',
          slug: 'back-to-the-future-time-machine-10300',
          name: 'Back to the Future Time Machine',
          theme: 'Icons',
          releaseYear: 2022,
          pieces: 1872,
          imageUrl: 'https://images.example/back-to-the-future.jpg',
        },
        {
          canonicalId: '10294',
          sourceSetNumber: '10294-1',
          slug: 'titanic-10294',
          name: 'Titanic',
          theme: 'Icons',
          releaseYear: 2021,
          pieces: 9092,
          imageUrl: 'https://images.example/titanic.jpg',
        },
        {
          canonicalId: '21061',
          sourceSetNumber: '21061-1',
          slug: 'notre-dame-de-paris-21061',
          name: 'Notre-Dame de Paris',
          theme: 'Architecture',
          releaseYear: 2024,
          pieces: 4382,
          imageUrl: 'https://images.example/notre-dame.jpg',
        },
        {
          canonicalId: '31208',
          sourceSetNumber: '31208-1',
          slug: 'hokusai-the-great-wave-31208',
          name: 'Hokusai - The Great Wave',
          theme: 'LEGO Art',
          releaseYear: 2023,
          pieces: 1810,
          imageUrl: 'https://images.example/the-great-wave.jpg',
        },
        {
          canonicalId: '76419',
          sourceSetNumber: '76419-1',
          slug: 'hogwarts-castle-and-grounds-76419',
          name: 'Hogwarts Castle and Grounds',
          theme: 'Harry Potter',
          releaseYear: 2023,
          pieces: 2660,
          imageUrl: 'https://images.example/hogwarts-castle-and-grounds.jpg',
        },
        {
          canonicalId: '43222',
          sourceSetNumber: '43222-1',
          slug: 'disney-castle-43222',
          name: 'Disney Castle',
          theme: 'Disney',
          releaseYear: 2023,
          pieces: 4837,
          imageUrl: 'https://images.example/disney-castle.jpg',
        },
        {
          canonicalId: '75313',
          sourceSetNumber: '75313-1',
          slug: 'at-at-75313',
          name: 'AT-AT',
          theme: 'Star Wars > Ultimate Collector Series',
          releaseYear: 2021,
          pieces: 6785,
          imageUrl: 'https://images.example/at-at.jpg',
        },
        {
          canonicalId: '21345',
          sourceSetNumber: '21345-1',
          slug: 'polaroid-onestep-sx-70-21345',
          name: 'Polaroid OneStep SX-70',
          theme: 'LEGO Ideas and CUUSOO',
          releaseYear: 2024,
          pieces: 516,
          imageUrl: 'https://images.example/polaroid.jpg',
        },
      ],
    });
    expect(artifacts.catalogSyncManifest).toEqual({
      source: 'rebrickable-api-v3',
      generatedAt: '2026-03-28T00:00:00.000Z',
      recordCount: 24,
      homepageFeaturedSetIds: ['10316', '21348', '76269'],
      notes:
        'Generated from the curated Rebrickable sync scope. Collector-facing overlays remain local.',
    });
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
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith('/lego/sets/10316-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10316-1',
              name: 'Lord of the Rings: Rivendell',
              year: 2023,
              num_parts: 6181,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21348-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21348-1',
              name: "Dungeons & Dragons: Red Dragon's Tale",
              year: 2024,
              num_parts: 3747,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/76269-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '76269-1',
              name: 'Avengers Tower',
              year: 2023,
              num_parts: 5202,
              theme_id: 3,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/themes/1/')) {
          return new Response(JSON.stringify({ id: 1, name: 'Icons' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/2/')) {
          return new Response(
            JSON.stringify({ id: 2, name: 'LEGO Ideas and CUUSOO' }),
            {
              status: 200,
            },
          );
        }

        if (url.endsWith('/lego/themes/3/')) {
          return new Response(JSON.stringify({ id: 3, name: 'Avengers' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/4/')) {
          return new Response(JSON.stringify({ id: 4, name: 'Architecture' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/5/')) {
          return new Response(JSON.stringify({ id: 5, name: 'LEGO Art' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/6/')) {
          return new Response(JSON.stringify({ id: 6, name: 'Harry Potter' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/7/')) {
          return new Response(JSON.stringify({ id: 7, name: 'Disney' }), {
            status: 200,
          });
        }

        if (url.endsWith('/lego/themes/8/')) {
          return new Response(
            JSON.stringify({
              id: 8,
              name: 'Star Wars > Ultimate Collector Series',
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10305-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10305-1',
              name: "Lion Knights' Castle",
              year: 2022,
              num_parts: 4515,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21338-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21338-1',
              name: 'A-Frame Cabin',
              year: 2023,
              num_parts: 2083,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10320-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10320-1',
              name: 'Eldorado Fortress',
              year: 2023,
              num_parts: 2509,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21335-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21335-1',
              name: 'Motorized Lighthouse',
              year: 2022,
              num_parts: 2065,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10333-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10333-1',
              name: 'The Lord of the Rings: Barad-dûr',
              year: 2024,
              num_parts: 5478,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10332-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10332-1',
              name: 'Medieval Town Square',
              year: 2024,
              num_parts: 3308,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10315-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10315-1',
              name: 'Tranquil Garden',
              year: 2023,
              num_parts: 1363,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21333-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21333-1',
              name: 'The Starry Night',
              year: 2022,
              num_parts: 2316,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21342-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21342-1',
              name: 'The Insect Collection',
              year: 2023,
              num_parts: 1111,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10318-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10318-1',
              name: 'Concorde',
              year: 2023,
              num_parts: 2083,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10331-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10331-1',
              name: 'Kingfisher Bird',
              year: 2024,
              num_parts: 834,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10341-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10341-1',
              name: 'NASA Artemis Space Launch System',
              year: 2024,
              num_parts: 3601,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21349-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21349-1',
              name: 'Tuxedo Cat',
              year: 2024,
              num_parts: 1710,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10300-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10300-1',
              name: 'Back to the Future Time Machine',
              year: 2022,
              num_parts: 1872,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/10294-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '10294-1',
              name: 'Titanic',
              year: 2021,
              num_parts: 9092,
              theme_id: 1,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21061-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21061-1',
              name: 'Notre-Dame de Paris',
              year: 2024,
              num_parts: 4382,
              theme_id: 4,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/31208-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '31208-1',
              name: 'Hokusai - The Great Wave',
              year: 2023,
              num_parts: 1810,
              theme_id: 5,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/76419-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '76419-1',
              name: 'Hogwarts Castle and Grounds',
              year: 2023,
              num_parts: 2660,
              theme_id: 6,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/43222-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '43222-1',
              name: 'Disney Castle',
              year: 2023,
              num_parts: 4837,
              theme_id: 7,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/75313-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '75313-1',
              name: 'AT-AT',
              year: 2021,
              num_parts: 6785,
              theme_id: 8,
            }),
            { status: 200 },
          );
        }

        if (url.endsWith('/lego/sets/21345-1/')) {
          return new Response(
            JSON.stringify({
              set_num: '21345-1',
              name: 'Polaroid OneStep SX-70',
              year: 2024,
              num_parts: 516,
              theme_id: 2,
            }),
            { status: 200 },
          );
        }

        return new Response(null, { status: 404 });
      },
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
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.endsWith('/lego/sets/10316-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10316-1',
            name: 'Lord of the Rings: Rivendell',
            year: 2023,
            num_parts: 6181,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21348-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21348-1',
            name: "Dungeons & Dragons: Red Dragon's Tale",
            year: 2024,
            num_parts: 3747,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/76269-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '76269-1',
            name: 'Avengers Tower',
            year: 2023,
            num_parts: 5202,
            theme_id: 3,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10305-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10305-1',
            name: "Lion Knights' Castle",
            year: 2022,
            num_parts: 4515,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21338-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21338-1',
            name: 'A-Frame Cabin',
            year: 2023,
            num_parts: 2083,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10320-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10320-1',
            name: 'Eldorado Fortress',
            year: 2023,
            num_parts: 2509,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21335-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21335-1',
            name: 'Motorized Lighthouse',
            year: 2022,
            num_parts: 2065,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10333-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10333-1',
            name: 'The Lord of the Rings: Barad-dûr',
            year: 2024,
            num_parts: 5478,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10332-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10332-1',
            name: 'Medieval Town Square',
            year: 2024,
            num_parts: 3308,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10315-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10315-1',
            name: 'Tranquil Garden',
            year: 2023,
            num_parts: 1363,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21333-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21333-1',
            name: 'The Starry Night',
            year: 2022,
            num_parts: 2316,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21342-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21342-1',
            name: 'The Insect Collection',
            year: 2023,
            num_parts: 1111,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10318-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10318-1',
            name: 'Concorde',
            year: 2023,
            num_parts: 2083,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10331-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10331-1',
            name: 'Kingfisher Bird',
            year: 2024,
            num_parts: 834,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10341-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10341-1',
            name: 'NASA Artemis Space Launch System',
            year: 2024,
            num_parts: 3601,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21349-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21349-1',
            name: 'Tuxedo Cat',
            year: 2024,
            num_parts: 1710,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10300-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10300-1',
            name: 'Back to the Future Time Machine',
            year: 2022,
            num_parts: 1872,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/10294-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '10294-1',
            name: 'Titanic',
            year: 2021,
            num_parts: 9092,
            theme_id: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21061-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21061-1',
            name: 'Notre-Dame de Paris',
            year: 2024,
            num_parts: 4382,
            theme_id: 4,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/31208-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '31208-1',
            name: 'Hokusai - The Great Wave',
            year: 2023,
            num_parts: 1810,
            theme_id: 5,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/76419-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '76419-1',
            name: 'Hogwarts Castle and Grounds',
            year: 2023,
            num_parts: 2660,
            theme_id: 6,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/43222-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '43222-1',
            name: 'Disney Castle',
            year: 2023,
            num_parts: 4837,
            theme_id: 7,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/75313-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '75313-1',
            name: 'AT-AT',
            year: 2021,
            num_parts: 6785,
            theme_id: 8,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/sets/21345-1/')) {
        return new Response(
          JSON.stringify({
            set_num: '21345-1',
            name: 'Polaroid OneStep SX-70',
            year: 2024,
            num_parts: 516,
            theme_id: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/themes/1/')) {
        return new Response(JSON.stringify({ id: 1, name: 'Icons' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/2/')) {
        return new Response(
          JSON.stringify({ id: 2, name: 'LEGO Ideas and CUUSOO' }),
          { status: 200 },
        );
      }

      if (url.endsWith('/lego/themes/3/')) {
        return new Response(JSON.stringify({ id: 3, name: 'Avengers' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/4/')) {
        return new Response(JSON.stringify({ id: 4, name: 'Architecture' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/5/')) {
        return new Response(JSON.stringify({ id: 5, name: 'LEGO Art' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/6/')) {
        return new Response(JSON.stringify({ id: 6, name: 'Harry Potter' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/7/')) {
        return new Response(JSON.stringify({ id: 7, name: 'Disney' }), {
          status: 200,
        });
      }

      if (url.endsWith('/lego/themes/8/')) {
        return new Response(
          JSON.stringify({
            id: 8,
            name: 'Star Wars > Ultimate Collector Series',
          }),
          { status: 200 },
        );
      }

      return new Response(null, { status: 404 });
    };

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
      'Homepage featured set 21348 is missing from the generated catalog snapshot.',
    );
  });
});
