export interface RebrickableClient {
  getSet(setNumber: string): Promise<unknown>;
  getTheme(themeId: number): Promise<unknown>;
}

export interface RebrickableClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function createRebrickableClient({
  apiKey,
  baseUrl = 'https://rebrickable.com/api/v3',
  fetchImpl = fetch,
}: RebrickableClientOptions): RebrickableClient {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);

  async function requestJson(pathname: string): Promise<unknown> {
    const response = await fetchImpl(`${resolvedBaseUrl}${pathname}`, {
      headers: {
        Authorization: `key ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Rebrickable request failed (${response.status}) for ${pathname}.`,
      );
    }

    return response.json();
  }

  return {
    getSet(setNumber: string) {
      return requestJson(`/lego/sets/${encodeURIComponent(setNumber)}/`);
    },
    getTheme(themeId: number) {
      return requestJson(`/lego/themes/${themeId}/`);
    },
  };
}
