import { afterEach, describe, expect, test } from 'vitest';
import { GET } from './route';

describe('IndexNow key file route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('publishes the configured key as a root text file through the rewrite', async () => {
    process.env.INDEXNOW_KEY = 'brickhunt-indexnow-key-2026';

    const response = await GET(
      new Request('https://www.brickhunt.nl/brickhunt-indexnow-key-2026.txt'),
      {
        params: Promise.resolve({
          indexNowKey: 'brickhunt-indexnow-key-2026',
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('brickhunt-indexnow-key-2026');
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    );
  });

  test('does not expose arbitrary txt files', async () => {
    process.env.INDEXNOW_KEY = 'brickhunt-indexnow-key-2026';

    const response = await GET(new Request('https://www.brickhunt.nl/key'), {
      params: Promise.resolve({
        indexNowKey: 'not-the-key',
      }),
    });

    expect(response.status).toBe(404);
  });

  test('stays unavailable when the key is missing', async () => {
    delete process.env.INDEXNOW_KEY;

    const response = await GET(new Request('https://www.brickhunt.nl/key'), {
      params: Promise.resolve({
        indexNowKey: 'brickhunt-indexnow-key-2026',
      }),
    });

    expect(response.status).toBe(404);
  });
});
