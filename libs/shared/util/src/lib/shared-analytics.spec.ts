import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  postBrickhuntAnalyticsEventToServer,
  shouldPostSetViewAnalyticsEvent,
} from './shared-analytics';

function installWindow({
  fetchMock = vi.fn(),
  sendBeacon,
}: {
  fetchMock?: ReturnType<typeof vi.fn>;
  sendBeacon?: ReturnType<typeof vi.fn>;
} = {}) {
  const storage = new Map<string, string>();

  vi.stubGlobal(
    'Blob',
    class Blob {
      readonly parts: unknown[];

      constructor(parts: unknown[]) {
        this.parts = parts;
      }
    },
  );
  vi.stubGlobal('window', {
    crypto: {
      randomUUID: () => 'session-12345678',
    },
    fetch: fetchMock,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    location: {
      pathname: '/sets/icons-rivendell-10316',
    },
    navigator: {
      sendBeacon,
    },
  });

  return {
    fetchMock,
    sendBeacon,
    storage,
  };
}

describe('shared analytics server posting', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('uses sendBeacon when available', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);

    installWindow({ sendBeacon });

    postBrickhuntAnalyticsEventToServer({
      event: 'set_view',
      properties: {
        setId: '10316',
      },
    });

    expect(sendBeacon).toHaveBeenCalledWith(
      '/api/events/catalog',
      expect.any(Blob),
    );
  });

  test('falls back to fetch with keepalive', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));

    installWindow({
      fetchMock,
      sendBeacon: vi.fn().mockReturnValue(false),
    });

    postBrickhuntAnalyticsEventToServer({
      event: 'offer_click',
      properties: {
        merchantSlug: 'bol',
        setId: '10316',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events/catalog',
      expect.objectContaining({
        keepalive: true,
        method: 'POST',
      }),
    );
  });

  test('never throws when browser APIs fail', () => {
    installWindow({
      sendBeacon: vi.fn(() => {
        throw new Error('blocked');
      }),
    });

    expect(() =>
      postBrickhuntAnalyticsEventToServer({
        event: 'catalog_set_click',
        properties: {
          setId: '10316',
        },
      }),
    ).not.toThrow();
  });

  test('suppresses duplicate set_view posts within the TTL', () => {
    installWindow();

    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_000,
        pagePath: '/sets/icons-rivendell-10317',
        setNum: '10317',
      }),
    ).toBe(true);
    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_500,
        pagePath: '/sets/icons-rivendell-10317',
        setNum: '10317',
      }),
    ).toBe(false);
  });

  test('allows set_view again after the TTL expires', () => {
    installWindow();

    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_000,
        pagePath: '/sets/icons-rivendell-10316',
        setNum: '10316',
      }),
    ).toBe(true);
    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 31_001,
        pagePath: '/sets/icons-rivendell-10317',
        setNum: '10317',
      }),
    ).toBe(true);
  });

  test('allows different sets within the TTL', () => {
    installWindow();

    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_000,
        pagePath: '/sets/icons-rivendell-10318',
        setNum: '10318',
      }),
    ).toBe(true);
    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_500,
        pagePath: '/sets/star-wars-millennium-falcon-75192',
        setNum: '75192',
      }),
    ).toBe(true);
  });

  test('allows different page paths within the TTL', () => {
    installWindow();

    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_000,
        pagePath: '/sets/icons-rivendell-10319',
        setNum: '10319',
      }),
    ).toBe(true);
    expect(
      shouldPostSetViewAnalyticsEvent({
        now: 1_500,
        pagePath: '/sets/alt-rivendell-10316',
        setNum: '10319',
      }),
    ).toBe(true);
  });
});
