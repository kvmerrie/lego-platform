import { describe, expect, test, vi } from 'vitest';
import {
  buildIndexNowPayload,
  INDEXNOW_MAX_URLS_PER_BATCH,
  isIndexNowEnabled,
  normalizeIndexNowUrls,
  submitUrl,
  submitUrls,
} from './indexnow';

function createProductionEnvironment() {
  return {
    BRICKHUNT_DEPLOY_ENV: 'production',
    BRICKHUNT_CANONICAL_HOST: 'www.brickhunt.nl',
    INDEXNOW_ENABLED: 'true',
    INDEXNOW_KEY: 'brickhunt-indexnow-key-2026',
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('IndexNow server service', () => {
  test('builds the official bulk payload shape', () => {
    expect(
      buildIndexNowPayload({
        host: 'www.brickhunt.nl',
        key: 'brickhunt-indexnow-key-2026',
        keyLocation: 'https://www.brickhunt.nl/brickhunt-indexnow-key-2026.txt',
        urls: [
          'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
          'https://www.brickhunt.nl/themes/icons',
        ],
      }),
    ).toEqual({
      host: 'www.brickhunt.nl',
      key: 'brickhunt-indexnow-key-2026',
      keyLocation: 'https://www.brickhunt.nl/brickhunt-indexnow-key-2026.txt',
      urlList: [
        'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
        'https://www.brickhunt.nl/themes/icons',
      ],
    });
  });

  test('canonicalizes, dedupes, and rejects non-indexable or external URLs', () => {
    expect(
      normalizeIndexNowUrls([
        '/sets/lord-of-the-rings-rivendell-10316',
        'https://brickhunt.nl/sets/lord-of-the-rings-rivendell-10316?utm_source=test',
        '/search?q=rivendell',
        'https://example.com/sets/not-ours',
        '',
      ]),
    ).toEqual({
      invalidUrls: [
        {
          reason: 'non_indexable_route',
          url: '/search?q=rivendell',
        },
        {
          reason: 'external_url',
          url: 'https://example.com/sets/not-ours',
        },
        {
          reason: 'empty_url',
          url: '',
        },
      ],
      urls: ['https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316'],
    });
  });

  test('stays disabled without production config or a valid key', () => {
    expect(isIndexNowEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(
      isIndexNowEnabled({
        ...createProductionEnvironment(),
        INDEXNOW_KEY: 'short',
      }),
    ).toBe(false);
  });

  test('skips disabled mode without logging noisy development output', async () => {
    const fetchImpl = vi.fn();
    const logger = createLogger();

    const result = await submitUrls(['/sets/rivendell-10316'], {
      environment: {
        INDEXNOW_ENABLED: 'false',
        INDEXNOW_KEY: 'brickhunt-indexnow-key-2026',
      },
      fetchImpl,
      logger,
      reason: 'test_disabled',
    });

    expect(result).toMatchObject({
      attempted: false,
      enabled: false,
      skipped: true,
      skipReason: 'disabled',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('submits one URL through the bulk endpoint', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('accepted', { status: 202 }),
    );
    const logger = createLogger();

    const result = await submitUrl('/themes/star-wars', {
      environment: createProductionEnvironment(),
      fetchImpl,
      logger,
      reason: 'theme_publish',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.indexnow.org/indexnow',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }),
    );
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string)).toEqual({
      host: 'www.brickhunt.nl',
      key: 'brickhunt-indexnow-key-2026',
      keyLocation: 'https://www.brickhunt.nl/brickhunt-indexnow-key-2026.txt',
      urlList: ['https://www.brickhunt.nl/themes/star-wars'],
    });
    expect(result).toMatchObject({
      attempted: true,
      batchCount: 1,
      submittedUrlCount: 1,
      skipped: false,
    });
    expect(logger.info).toHaveBeenCalledWith(
      '[indexnow] submitted urls',
      expect.objectContaining({
        reason: 'theme_publish',
        statusCode: 202,
        success: true,
        urls: ['https://www.brickhunt.nl/themes/star-wars'],
      }),
    );
  });

  test('batches bulk submissions at the IndexNow limit', async () => {
    const urls = Array.from(
      { length: INDEXNOW_MAX_URLS_PER_BATCH + 1 },
      (_, index) => `/sets/test-set-${index}-10${index}`,
    );
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));

    const result = await submitUrls(urls, {
      environment: createProductionEnvironment(),
      fetchImpl,
      logger: createLogger(),
      reason: 'catalog_bulk_publish',
    });

    expect(result.batchCount).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string).urlList,
    ).toHaveLength(INDEXNOW_MAX_URLS_PER_BATCH);
    expect(
      JSON.parse(fetchImpl.mock.calls[1]?.[1]?.body as string).urlList,
    ).toHaveLength(1);
  });

  test('logs failures and returns a non-throwing result', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('invalid key', { status: 403 }),
    );
    const logger = createLogger();

    const result = await submitUrls(['/sets/rivendell-10316'], {
      environment: createProductionEnvironment(),
      fetchImpl,
      logger,
      reason: 'catalog_publish',
    });

    expect(result.batches).toEqual([
      expect.objectContaining({
        responseBody: 'invalid key',
        statusCode: 403,
        success: false,
      }),
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      '[indexnow] submit urls failed',
      expect.objectContaining({
        responseBody: 'invalid key',
        statusCode: 403,
        success: false,
      }),
    );
  });

  test('catches fetch errors without throwing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const logger = createLogger();

    await expect(
      submitUrls(['/sets/rivendell-10316'], {
        environment: createProductionEnvironment(),
        fetchImpl,
        logger,
      }),
    ).resolves.toMatchObject({
      attempted: true,
      batches: [
        expect.objectContaining({
          responseBody: 'network down',
          success: false,
        }),
      ],
      skipped: false,
    });
  });
});
