import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import {
  type CommerceBenchmarkSet,
  type CommerceMerchant,
  type CommerceOfferSeed,
} from '@lego-platform/commerce/util';
import {
  createAdminCommerceRoutes,
  type AdminCommerceService,
} from '../app/routes/admin-commerce';

async function createAdminCommerceServer({
  commerceService,
}: {
  commerceService?: AdminCommerceService;
} = {}) {
  const nextCommerceService: AdminCommerceService = commerceService ?? {
    listBenchmarkSets: vi.fn(async () => []),
    createBenchmarkSet: vi.fn(
      async () =>
        ({
          setId: '10316',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceBenchmarkSet,
    ),
    deleteBenchmarkSet: vi.fn(async () => undefined),
    listMerchants: vi.fn(async () => []),
    createMerchant: vi.fn(
      async () =>
        ({
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceMerchant,
    ),
    updateMerchant: vi.fn(
      async () =>
        ({
          id: 'merchant-1',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceMerchant,
    ),
    listOfferSeeds: vi.fn(async () => []),
    createOfferSeed: vi.fn(
      async () =>
        ({
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceOfferSeed,
    ),
    updateOfferSeed: vi.fn(
      async () =>
        ({
          id: 'seed-1',
          setId: '10316',
          merchantId: 'merchant-1',
          productUrl: 'https://www.lego.com/rivendell',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-14T08:00:00.000Z',
          updatedAt: '2026-04-14T08:00:00.000Z',
        }) satisfies CommerceOfferSeed,
    ),
  };
  const server = Fastify();

  await server.register(
    createAdminCommerceRoutes({
      commerceService: nextCommerceService,
    }),
  );

  return {
    commerceService: nextCommerceService,
    server,
  };
}

describe('admin commerce routes', () => {
  test('lists merchants for the admin backoffice', async () => {
    const merchants: CommerceMerchant[] = [
      {
        id: 'merchant-1',
        slug: 'lego-nl',
        name: 'LEGO',
        isActive: true,
        sourceType: 'direct',
        notes: '',
        createdAt: '2026-04-14T08:00:00.000Z',
        updatedAt: '2026-04-14T08:00:00.000Z',
      },
    ];
    const { commerceService, server } = await createAdminCommerceServer({
      commerceService: {
        listBenchmarkSets: vi.fn(async () => []),
        createBenchmarkSet: vi.fn(),
        deleteBenchmarkSet: vi.fn(),
        listMerchants: vi.fn(async () => merchants),
        createMerchant: vi.fn(),
        updateMerchant: vi.fn(),
        listOfferSeeds: vi.fn(async () => []),
        createOfferSeed: vi.fn(),
        updateOfferSeed: vi.fn(),
      } as never,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/commerce/merchants',
    });

    expect(response.statusCode).toBe(200);
    expect(commerceService.listMerchants).toHaveBeenCalled();
    expect(response.json()).toEqual(merchants);

    await server.close();
  });

  test('creates a benchmark set when the set exists in the synced catalog', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/benchmark-sets',
      payload: {
        setId: '10316',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createBenchmarkSet).toHaveBeenCalledWith({
      setId: '10316',
      notes: '',
    });

    await server.close();
  });

  test('rejects benchmark sets for sets outside the synced catalog', async () => {
    const { server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/benchmark-sets',
      payload: {
        setId: '99999',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message:
        'Set 99999 is not part of the synced Brickhunt catalog, so it cannot receive commerce seeds yet.',
    });

    await server.close();
  });

  test('creates a merchant when the operator input is valid', async () => {
    const { commerceService, server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/merchants',
      payload: {
        slug: 'Amazon NL',
        name: 'Amazon',
        isActive: true,
        sourceType: 'affiliate',
        affiliateNetwork: 'Amazon Associates',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(commerceService.createMerchant).toHaveBeenCalledWith({
      slug: 'amazon-nl',
      name: 'Amazon',
      isActive: true,
      sourceType: 'affiliate',
      affiliateNetwork: 'Amazon Associates',
      notes: '',
    });

    await server.close();
  });

  test('rejects offer seeds for sets outside the synced catalog', async () => {
    const { server } = await createAdminCommerceServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/commerce/offer-seeds',
      payload: {
        setId: '99999',
        merchantId: 'merchant-1',
        productUrl: 'https://example.test/set',
        isActive: true,
        validationStatus: 'pending',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message:
        'Set 99999 is not part of the synced Brickhunt catalog, so it cannot receive commerce seeds yet.',
    });

    await server.close();
  });
});
