import { createRequire } from 'node:module';
import { afterEach, describe, expect, test } from 'vitest';
import { GET } from './route';

const require = createRequire(import.meta.url);

describe('IndexNow key file route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('publishes the configured key as plain text', async () => {
    process.env.INDEXNOW_KEY =
      '87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e';

    const response = await GET(
      new Request(
        'https://www.brickhunt.nl/87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e.txt',
      ),
      {
        params: Promise.resolve({
          indexNowKey:
            '87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e',
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(
      '87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e',
    );
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    );
  });

  test('rewrites the public txt key URL to the routable app segment', async () => {
    const createNextConfig = require('../../../../next.config.js') as (
      phase?: unknown,
      context?: unknown,
    ) => Promise<{
      rewrites(): Promise<
        Array<{
          destination: string;
          source: string;
        }>
      >;
    }>;

    const nextConfig = await createNextConfig(undefined, {
      defaultConfig: {},
    });
    const rewrites = await nextConfig.rewrites();

    expect(rewrites).toContainEqual({
      destination: '/indexnow/:indexNowKey',
      source: '/:indexNowKey([A-Za-z0-9-]{8,128}).txt',
    });
  });

  test('redirects the legacy Rakuten LEGO merchant URL with a permanent 301', async () => {
    const createNextConfig = require('../../../../next.config.js') as (
      phase?: unknown,
      context?: unknown,
    ) => Promise<{
      redirects(): Promise<
        Array<{
          destination: string;
          source: string;
          statusCode: number;
        }>
      >;
    }>;

    const nextConfig = await createNextConfig(undefined, {
      defaultConfig: {},
    });
    const redirects = await nextConfig.redirects();

    expect(redirects).toContainEqual({
      destination: '/winkels/lego',
      source: '/winkels/rakuten-lego-eu',
      statusCode: 301,
    });
  });

  test('returns 404 for a wrong key', async () => {
    process.env.INDEXNOW_KEY =
      '87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e';

    const response = await GET(
      new Request('https://www.brickhunt.nl/indexnow/not-the-key'),
      {
        params: Promise.resolve({
          indexNowKey: 'not-the-key',
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  test('stays unavailable when the key is missing', async () => {
    delete process.env.INDEXNOW_KEY;

    const response = await GET(
      new Request(
        'https://www.brickhunt.nl/indexnow/87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e',
      ),
      {
        params: Promise.resolve({
          indexNowKey:
            '87c4a7164ee6fd0edca6efa8cb96fc0589c7a6bfaaee14d27e49c0d9aabd770e',
        }),
      },
    );

    expect(response.status).toBe(404);
  });
});
