import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSet,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
import {
  createAdminCatalogRoutes,
  type AdminCatalogService,
} from '../app/routes/admin-catalog';

async function createAdminCatalogServer({
  catalogService,
}: {
  catalogService?: AdminCatalogService;
} = {}) {
  const nextCatalogService: AdminCatalogService = catalogService ?? {
    createSet: vi.fn(
      async () =>
        ({
          createdAt: '2026-04-17T08:00:00.000Z',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77072-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          status: 'active',
          theme: 'The Legend of Zelda',
          updatedAt: '2026-04-17T08:00:00.000Z',
        }) satisfies CatalogSet,
    ),
    listCatalogSets: vi.fn(
      async () =>
        [
          {
            id: '10316',
            slug: 'lord-of-the-rings-rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6167,
            collectorAngle: 'De vallei blijft meteen hangen op je plank.',
          },
        ] satisfies CatalogSetSummary[],
    ),
    searchMissingSets: vi.fn(
      async () =>
        [
          {
            imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
            name: 'Great Deku Tree 2-in-1',
            pieces: 2500,
            releaseYear: 2024,
            setId: '77092',
            slug: 'great-deku-tree-2-in-1-77092',
            source: 'rebrickable',
            sourceSetNumber: '77092-1',
            theme: 'The Legend of Zelda',
          },
        ] satisfies CatalogExternalSetSearchResult[],
    ),
  };
  const server = Fastify();

  await server.register(
    createAdminCatalogRoutes({
      catalogService: nextCatalogService,
    }),
  );

  return {
    catalogService: nextCatalogService,
    server,
  };
}

describe('admin catalog routes', () => {
  test('lists merged catalog sets for the admin app', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/sets',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.listCatalogSets).toHaveBeenCalled();
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: '10316',
      }),
    ]);

    await server.close();
  });

  test('searches Rebrickable for missing sets', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/search?query=deku',
    });

    expect(response.statusCode).toBe(200);
    expect(catalogService.searchMissingSets).toHaveBeenCalledWith('deku');
    expect(response.json()).toEqual([
      expect.objectContaining({
        setId: '77092',
      }),
    ]);

    await server.close();
  });

  test('creates a catalog set from a search result', async () => {
    const { catalogService, server } = await createAdminCatalogServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/sets',
      payload: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
        name: 'Great Deku Tree 2-in-1',
        pieces: 2500,
        releaseYear: 2024,
        setId: '77092',
        slug: 'great-deku-tree-2-in-1-77092',
        source: 'rebrickable',
        sourceSetNumber: '77092-1',
        theme: 'The Legend of Zelda',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(catalogService.createSet).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
      name: 'Great Deku Tree 2-in-1',
      pieces: 2500,
      releaseYear: 2024,
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      source: 'rebrickable',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });

    await server.close();
  });
});
