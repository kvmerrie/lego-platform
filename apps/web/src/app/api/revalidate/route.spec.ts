import { beforeEach, describe, expect, test, vi } from 'vitest';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
}));

describe('web revalidation route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    revalidatePath.mockReset();
    revalidateTag.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test('rejects invalid secrets', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'wrong-secret',
        },
        body: JSON.stringify({
          paths: ['/sets/rivendell-10316'],
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  test('revalidates each normalized path and tag when the request is authorized', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'expected-secret',
        },
        body: JSON.stringify({
          paths: [
            '/sets/rivendell-10316/',
            '/themes/icons',
            '/themes',
            '/themes/icons',
          ],
          tags: [
            'set:Rivendell 10316',
            'set:rivendell-10316',
            'prices:coolblue',
          ],
          reason: 'catalog_bulk_onboarding',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(3);
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/sets/rivendell-10316');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/themes/icons');
    expect(revalidatePath).toHaveBeenNthCalledWith(3, '/themes');
    expect(revalidateTag).toHaveBeenCalledTimes(4);
    expect(revalidateTag).toHaveBeenNthCalledWith(
      1,
      'set:rivendell-10316',
      'max',
    );
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'prices:coolblue', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(3, 'sets', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(4, 'set:10316', 'max');
    await expect(response.json()).resolves.toMatchObject({
      pathCount: 3,
      paths: ['/sets/rivendell-10316', '/themes/icons', '/themes'],
      tagCount: 4,
      tags: ['set:rivendell-10316', 'prices:coolblue', 'sets', 'set:10316'],
    });
  });

  test('derives canonical set detail tags from manual set paths', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'expected-secret',
        },
        body: JSON.stringify({
          paths: ['/sets/sagrada-familia-21065'],
          reason: 'manual_set_detail_debug',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/sets/sagrada-familia-21065');
    expect(revalidateTag).toHaveBeenCalledWith('sets', 'max');
    expect(revalidateTag).toHaveBeenCalledWith('set:21065', 'max');
    expect(revalidateTag).toHaveBeenCalledWith(
      'set:sagrada-familia-21065',
      'max',
    );
    await expect(response.json()).resolves.toMatchObject({
      pathCount: 1,
      paths: ['/sets/sagrada-familia-21065'],
      tagCount: 3,
      tags: ['sets', 'set:21065', 'set:sagrada-familia-21065'],
    });
  });

  test('rejects empty revalidation payloads', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer expected-secret',
        },
        body: JSON.stringify({
          paths: ['relative-path'],
          tags: ['---'],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  test('logs compact metrics and warns when broad tags are revalidated', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer expected-secret',
        },
        body: JSON.stringify({
          paths: Array.from(
            { length: 14 },
            (_, index) => `/sets/rivendell-${index}`,
          ),
          reason: 'observability_test',
          tags: ['homepage', 'homepage', 'set:10316'],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledWith(
      'Public web revalidation requested.',
      expect.objectContaining({
        broadTagCount: 2,
        pathCount: 14,
        pathSampleOmittedCount: 2,
        reason: 'observability_test',
        tagCount: 17,
        tagSample: [
          'homepage',
          'set:10316',
          'sets',
          'set:rivendell-0',
          'set:rivendell-1',
          'set:rivendell-2',
          'set:rivendell-3',
          'set:rivendell-4',
          'set:rivendell-5',
          'set:rivendell-6',
          'set:rivendell-7',
          'set:rivendell-8',
        ],
        tagSampleOmittedCount: 5,
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Public web revalidation received broad tags.',
      {
        broadTags: ['homepage', 'sets'],
        reason: 'observability_test',
      },
    );
  });

  test('accepts and revalidates public browse cache tags', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'expected-secret',
        },
        body: JSON.stringify({
          reason: 'browse_cache_invalidation',
          tags: [
            'catalog',
            'sets',
            'themes',
            'theme:star-wars',
            'collections',
            'collection:lego-sets-onder-100-euro',
            'prices',
            'deals',
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(8);
    expect(revalidateTag).toHaveBeenNthCalledWith(1, 'catalog', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'sets', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(3, 'themes', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(4, 'theme:star-wars', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(5, 'collections', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(
      6,
      'collection:lego-sets-onder-100-euro',
      'max',
    );
    expect(revalidateTag).toHaveBeenNthCalledWith(7, 'prices', 'max');
    expect(revalidateTag).toHaveBeenNthCalledWith(8, 'deals', 'max');
    await expect(response.json()).resolves.toMatchObject({
      pathCount: 0,
      tagCount: 8,
      tags: [
        'catalog',
        'sets',
        'themes',
        'theme:star-wars',
        'collections',
        'collection:lego-sets-onder-100-euro',
        'prices',
        'deals',
      ],
    });
  });
});
