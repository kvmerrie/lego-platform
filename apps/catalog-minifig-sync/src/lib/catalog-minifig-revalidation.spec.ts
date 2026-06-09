import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildCatalogMinifigRevalidationBatches,
  revalidateCatalogMinifigSetPages,
} from './catalog-minifig-revalidation';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
  process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('catalog minifig sync revalidation', () => {
  test('builds valid set detail paths and tags', () => {
    const batches = buildCatalogMinifigRevalidationBatches({
      changedSetIds: ['10316'],
      changedSetSlugs: ['rivendell-10316'],
      reason: 'catalog_minifig_sync',
    });

    expect(batches).toEqual([
      {
        paths: ['/sets/rivendell-10316'],
        reason: 'catalog_minifig_sync',
        tags: ['sets', 'set:10316', 'set:rivendell-10316'],
      },
    ]);
  });

  test('skips invalid or missing slugs', () => {
    const batches = buildCatalogMinifigRevalidationBatches({
      changedSetIds: ['10316', '21326', '75355'],
      changedSetSlugs: ['', 'bad/slug', 'x-wing-starfighter-75355'],
      reason: 'catalog_minifig_sync',
    });

    expect(batches).toHaveLength(1);
    expect(batches[0]?.paths).toEqual(['/sets/x-wing-starfighter-75355']);
    expect(batches[0]?.tags).toEqual([
      'sets',
      'set:75355',
      'set:x-wing-starfighter-75355',
    ]);
  });

  test('batches more than 25 set paths', () => {
    const changedSetIds = Array.from({ length: 51 }, (_, index) =>
      String(10_000 + index),
    );
    const changedSetSlugs = changedSetIds.map((setId) => `set-${setId}`);

    const batches = buildCatalogMinifigRevalidationBatches({
      changedSetIds,
      changedSetSlugs,
      reason: 'catalog_minifig_sync',
    });

    expect(batches.map((batch) => batch.paths.length)).toEqual([25, 25, 1]);
    expect(
      Math.max(...batches.map((batch) => batch.tags.length)),
    ).toBeLessThanOrEqual(100);
  });

  test('returns a warning instead of failing the sync on 400 by default', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Provide at most 25 paths.' }), {
          status: 400,
        }),
    );

    const result = await revalidateCatalogMinifigSetPages({
      changedSetIds: ['10316'],
      changedSetSlugs: ['rivendell-10316'],
      fetchImpl,
      reason: 'catalog_minifig_sync',
    });

    expect(result.warning).toContain('revalidation failed');
    expect(result.failedBatches).toEqual([
      {
        bodyExcerpt: '{"error":"Provide at most 25 paths."}',
        pathCount: 1,
        pathSample: ['/sets/rivendell-10316'],
        status: 400,
        tagCount: 3,
        tagSample: ['sets', 'set:10316', 'set:rivendell-10316'],
      },
    ]);
  });

  test('strict mode fails on revalidation errors', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('Bad request', { status: 400 }),
    );

    await expect(
      revalidateCatalogMinifigSetPages({
        changedSetIds: ['10316'],
        changedSetSlugs: ['rivendell-10316'],
        fetchImpl,
        reason: 'catalog_minifig_sync',
        strict: true,
      }),
    ).rejects.toThrow(
      'Catalog minifig public web revalidation failed for 1/1 batch(es).',
    );
  });
});
