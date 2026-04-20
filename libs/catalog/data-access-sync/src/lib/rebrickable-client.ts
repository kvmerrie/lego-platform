export interface RebrickableClient {
  getSet(setNumber: string): Promise<unknown>;
  listSets(options?: {
    minYear?: number;
    ordering?: string;
    page?: number;
    pageSize?: number;
  }): Promise<unknown>;
  searchSets(query: string, options?: { pageSize?: number }): Promise<unknown>;
  getTheme(themeId: number): Promise<unknown>;
}

export interface RebrickableClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  logImpl?: (message: string) => void;
  maxRetries?: number;
  minimumRequestSpacingMs?: number;
  nowImpl?: () => number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function buildListQueryString(
  params: Record<string, number | string | undefined>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();

  return queryString ? `?${queryString}` : '';
}

function readRetryAfterDelayMs({
  nowMs,
  response,
}: {
  nowMs: number;
  response: Response;
}): number | undefined {
  const retryAfterHeader = response.headers.get('Retry-After');

  if (!retryAfterHeader) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  const retryAfterDateMs = Date.parse(retryAfterHeader);

  if (Number.isNaN(retryAfterDateMs)) {
    return undefined;
  }

  return Math.max(0, retryAfterDateMs - nowMs);
}

export function createRebrickableClient({
  apiKey,
  baseUrl = 'https://rebrickable.com/api/v3',
  fetchImpl = fetch,
  logImpl = console.warn,
  maxRetries = 4,
  minimumRequestSpacingMs = 150,
  nowImpl = Date.now,
  retryBaseDelayMs = 500,
  retryMaxDelayMs = 8_000,
  sleepImpl = wait,
}: RebrickableClientOptions): RebrickableClient {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
  let lastRequestStartedAtMs: number | undefined;

  async function waitForRequestSlot() {
    if (lastRequestStartedAtMs === undefined || minimumRequestSpacingMs <= 0) {
      lastRequestStartedAtMs = nowImpl();
      return;
    }

    const elapsedMs = nowImpl() - lastRequestStartedAtMs;
    const delayMs = Math.max(0, minimumRequestSpacingMs - elapsedMs);

    if (delayMs > 0) {
      await sleepImpl(delayMs);
    }

    lastRequestStartedAtMs = nowImpl();
  }

  async function requestJson(pathname: string): Promise<unknown> {
    let attemptCount = 0;

    while (true) {
      attemptCount += 1;

      await waitForRequestSlot();

      const response = await fetchImpl(`${resolvedBaseUrl}${pathname}`, {
        headers: {
          Authorization: `key ${apiKey}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return response.json();
      }

      if (response.status === 429 && attemptCount <= maxRetries) {
        const retryAttempt = attemptCount;
        const retryAfterDelayMs = readRetryAfterDelayMs({
          nowMs: nowImpl(),
          response,
        });
        const backoffDelayMs = Math.min(
          retryBaseDelayMs * 2 ** (retryAttempt - 1),
          retryMaxDelayMs,
        );
        const usedRetryAfter =
          retryAfterDelayMs !== undefined && retryAfterDelayMs > backoffDelayMs;
        const delayMs = usedRetryAfter ? retryAfterDelayMs : backoffDelayMs;

        logImpl(
          `[catalog-sync] rebrickable 429 endpoint=${pathname} retry_attempt=${retryAttempt}/${maxRetries} delay_ms=${delayMs} retry_after_ms=${retryAfterDelayMs ?? 'n/a'} used_retry_after=${usedRetryAfter}`,
        );

        await sleepImpl(delayMs);
        continue;
      }

      if (response.status === 429) {
        const retryAfterDelayMs = readRetryAfterDelayMs({
          nowMs: nowImpl(),
          response,
        });

        logImpl(
          `[catalog-sync] rebrickable 429 endpoint=${pathname} retry_attempt=${maxRetries}/${maxRetries} delay_ms=0 retry_after_ms=${retryAfterDelayMs ?? 'n/a'} used_retry_after=false exhausted=true`,
        );
      }

      throw new Error(
        `Rebrickable request failed (${response.status}) for ${pathname} after ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}.`,
      );
    }
  }

  return {
    getSet(setNumber: string) {
      return requestJson(`/lego/sets/${encodeURIComponent(setNumber)}/`);
    },
    listSets(options) {
      const page = Math.max(1, Math.floor(options?.page ?? 1));
      const pageSize = Math.max(
        1,
        Math.min(1000, Math.floor(options?.pageSize ?? 100)),
      );
      const minYear =
        typeof options?.minYear === 'number' &&
        Number.isInteger(options.minYear) &&
        options.minYear > 0
          ? options.minYear
          : undefined;
      const ordering =
        typeof options?.ordering === 'string' && options.ordering.trim()
          ? options.ordering.trim()
          : undefined;

      return requestJson(
        `/lego/sets/${buildListQueryString({
          min_year: minYear,
          ordering,
          page,
          page_size: pageSize,
        })}`,
      );
    },
    searchSets(query: string, options?: { pageSize?: number }) {
      const normalizedQuery = query.trim();
      const pageSize = Math.max(
        1,
        Math.min(100, Math.floor(options?.pageSize ?? 12)),
      );

      return requestJson(
        `/lego/sets/${buildListQueryString({
          page_size: pageSize,
          search: normalizedQuery,
        })}`,
      );
    },
    getTheme(themeId: number) {
      return requestJson(`/lego/themes/${themeId}/`);
    },
  };
}
