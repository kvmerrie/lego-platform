import type {
  CatalogHomepageSetCard,
  CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/util';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';

const catalogSetCardsApiPath = '/api/catalog/set-cards';

export interface CatalogUserThemeFavoriteState {
  isFavorited: boolean;
  themeId: string;
}

export interface CatalogUserThemeFavoriteItem
  extends CatalogThemeDirectoryItem {
  favoritedAt: string;
}

export interface CatalogUserThemeFavoritesPayload {
  isAuthenticated: boolean;
  themeIds: string[];
  themes: CatalogUserThemeFavoriteItem[];
}

export interface CatalogUserThemeFavoriteContext {
  isAuthenticated: boolean;
  isFavorited: boolean;
  themeId: string;
}

const THEME_FAVORITES_BROWSER_FETCH_TIMEOUT_MS = 2500;

export async function listCatalogSetCardsByIdsForBrowser({
  canonicalIds,
  fetchImpl = fetch,
}: {
  canonicalIds: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<CatalogHomepageSetCard[]> {
  const orderedCanonicalIds = canonicalIds.filter(Boolean);

  if (!orderedCanonicalIds.length) {
    return [];
  }

  const uniqueCanonicalIds = [...new Set(orderedCanonicalIds)];

  try {
    const searchParams = new URLSearchParams();

    for (const canonicalId of uniqueCanonicalIds) {
      searchParams.append('setId', canonicalId);
    }

    const response = await fetchImpl(
      `${catalogSetCardsApiPath}?${searchParams.toString()}`,
      {
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load canonical catalog set cards.');
    }

    const responseSetCards =
      (await response.json()) as CatalogHomepageSetCard[];
    const responseSetCardById = new Map(
      responseSetCards.map((catalogSetCard) => [
        catalogSetCard.id,
        catalogSetCard,
      ]),
    );

    return orderedCanonicalIds.flatMap((canonicalId) => {
      const catalogSetCard = responseSetCardById.get(canonicalId);

      return catalogSetCard ? [catalogSetCard] : [];
    });
  } catch {
    return [];
  }
}

function normalizeThemeFavoriteId(themeId: string): string {
  return themeId.trim();
}

function createEmptyThemeFavoritesPayload({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
} = {}): CatalogUserThemeFavoritesPayload {
  return {
    isAuthenticated,
    themeIds: [],
    themes: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeFavoritePayloadText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function createFavoriteThemeFallbackName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function normalizeFavoriteThemeVisual(
  visual: unknown,
): CatalogUserThemeFavoriteItem['visual'] {
  if (!isRecord(visual)) {
    return undefined;
  }

  const backgroundColor = normalizeFavoritePayloadText(
    visual['backgroundColor'],
  );
  const imageUrl = normalizeFavoritePayloadText(visual['imageUrl']);
  const tileImageUrl = normalizeFavoritePayloadText(visual['tileImageUrl']);

  return backgroundColor || imageUrl || tileImageUrl
    ? {
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(tileImageUrl ? { tileImageUrl } : {}),
      }
    : undefined;
}

function mapFavoriteThemeItem(
  value: unknown,
): CatalogUserThemeFavoriteItem | undefined {
  if (!isRecord(value) || !isRecord(value['themeSnapshot'])) {
    return undefined;
  }

  const themeSnapshot = value['themeSnapshot'];
  const favoritedAt = normalizeFavoritePayloadText(value['favoritedAt']);
  const id = normalizeFavoritePayloadText(themeSnapshot['id']);
  const slug = normalizeFavoritePayloadText(themeSnapshot['slug']);

  if (!favoritedAt || !id || !slug) {
    return undefined;
  }

  const fallbackName = createFavoriteThemeFallbackName(slug);
  const name =
    normalizeFavoritePayloadText(themeSnapshot['name']) ?? fallbackName;
  const setCount =
    typeof themeSnapshot['setCount'] === 'number' &&
    Number.isFinite(themeSnapshot['setCount']) &&
    themeSnapshot['setCount'] >= 0
      ? themeSnapshot['setCount']
      : 0;
  const momentum =
    normalizeFavoritePayloadText(themeSnapshot['momentum']) ??
    `Bekijk welke ${name}-sets de moeite waard zijn.`;
  const signatureSet =
    normalizeFavoritePayloadText(themeSnapshot['signatureSet']) ?? name;
  const imageUrl = normalizeFavoritePayloadText(value['imageUrl']);
  const visual = normalizeFavoriteThemeVisual(value['visual']);

  return {
    favoritedAt,
    ...(imageUrl ? { imageUrl } : {}),
    themeSnapshot: {
      id,
      momentum,
      name,
      setCount,
      signatureSet,
      slug,
    },
    ...(visual ? { visual } : {}),
  };
}

function createThemeFavoritesFetchControls(signal?: AbortSignal): {
  dispose: () => void;
  signal: AbortSignal;
} {
  const timeoutController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    timeoutController.abort();
  }, THEME_FAVORITES_BROWSER_FETCH_TIMEOUT_MS);
  const dispose = () => globalThis.clearTimeout(timeoutId);

  timeoutController.signal.addEventListener('abort', dispose, { once: true });

  if (!signal) {
    return {
      dispose,
      signal: timeoutController.signal,
    };
  }

  if (signal.aborted) {
    timeoutController.abort();

    return {
      dispose,
      signal: timeoutController.signal,
    };
  }

  signal.addEventListener(
    'abort',
    () => {
      timeoutController.abort();
    },
    { once: true },
  );

  return {
    dispose,
    signal: timeoutController.signal,
  };
}

export async function listUserThemeFavoritesForBrowser({
  fetchImpl = fetch,
  signal,
}: {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
} = {}): Promise<CatalogUserThemeFavoritesPayload> {
  const fetchControls = createThemeFavoritesFetchControls(signal);

  try {
    const headers = await buildSupabaseAuthorizationHeaders();
    const response = await fetchImpl(apiPaths.themeFavorites, {
      cache: 'no-store',
      headers,
      signal: fetchControls.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return createEmptyThemeFavoritesPayload();
    }

    if (!response.ok) {
      return createEmptyThemeFavoritesPayload();
    }

    const payload = (await response.json()) as unknown;

    if (!isRecord(payload) || !Array.isArray(payload['themes'])) {
      return createEmptyThemeFavoritesPayload();
    }

    const themes = payload['themes'].flatMap((theme) => {
      const favoriteTheme = mapFavoriteThemeItem(theme);

      return favoriteTheme ? [favoriteTheme] : [];
    });

    const normalizedThemeIds = new Set(
      themes.map((theme) => theme.themeSnapshot.id),
    );
    const themeIds = Array.isArray(payload['themeIds'])
      ? payload['themeIds'].filter(
          (themeId): themeId is string =>
            typeof themeId === 'string' && normalizedThemeIds.has(themeId),
        )
      : themes
          .map((theme) => theme.themeSnapshot.id)
          .filter((themeId): themeId is string => typeof themeId === 'string');

    return {
      isAuthenticated: true,
      themeIds,
      themes,
    };
  } catch {
    return createEmptyThemeFavoritesPayload();
  } finally {
    fetchControls.dispose();
  }
}

export async function getUserThemeFavoriteContextForBrowser({
  fetchImpl = fetch,
  signal,
  themeId,
}: {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  themeId: string;
}): Promise<CatalogUserThemeFavoriteContext> {
  const normalizedThemeId = normalizeThemeFavoriteId(themeId);
  const favoriteThemes = await listUserThemeFavoritesForBrowser({
    fetchImpl,
    signal,
  });

  return {
    isAuthenticated: favoriteThemes.isAuthenticated,
    isFavorited: favoriteThemes.themeIds.includes(normalizedThemeId),
    themeId: normalizedThemeId,
  };
}

export async function addUserThemeFavoriteForBrowser({
  fetchImpl = fetch,
  themeId,
}: {
  fetchImpl?: typeof fetch;
  themeId: string;
}): Promise<CatalogUserThemeFavoriteState> {
  const normalizedThemeId = normalizeThemeFavoriteId(themeId);
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetchImpl(
    `${apiPaths.themeFavorites}/${encodeURIComponent(normalizedThemeId)}`,
    {
      headers,
      method: 'PUT',
    },
  );

  if (response.status === 401) {
    throw new Error('Log in om dit thema te bewaren.');
  }

  if (!response.ok) {
    throw new Error('Dit thema kon niet worden bewaard.');
  }

  const favoriteState =
    (await response.json()) as CatalogUserThemeFavoriteState;

  notifyBrowserAccountDataChanged();

  return favoriteState;
}

export async function removeUserThemeFavoriteForBrowser({
  fetchImpl = fetch,
  themeId,
}: {
  fetchImpl?: typeof fetch;
  themeId: string;
}): Promise<CatalogUserThemeFavoriteState> {
  const normalizedThemeId = normalizeThemeFavoriteId(themeId);
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetchImpl(
    `${apiPaths.themeFavorites}/${encodeURIComponent(normalizedThemeId)}`,
    {
      headers,
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw new Error('Log in om je opgeslagen thema’s bij te werken.');
  }

  if (!response.ok) {
    throw new Error('Dit thema kon niet worden verwijderd.');
  }

  const favoriteState =
    (await response.json()) as CatalogUserThemeFavoriteState;

  notifyBrowserAccountDataChanged();

  return favoriteState;
}
