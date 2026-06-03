import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';

const RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY =
  'brickhunt.recently-viewed-set-nums';
const MAX_RECENTLY_VIEWED_SET_NUMS = 12;
const RECENTLY_VIEWED_SET_NUM_PATTERN = /^[a-z0-9-]+$/iu;

function getRecentlyViewedStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeRecentlyViewedSetNum(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedSetNum = value.trim();

  return normalizedSetNum &&
    RECENTLY_VIEWED_SET_NUM_PATTERN.test(normalizedSetNum)
    ? normalizedSetNum
    : undefined;
}

function normalizeRecentlyViewedSetNums(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueSetNums: string[] = [];
  const seenSetNums = new Set<string>();

  for (const item of value) {
    const normalizedSetNum = normalizeRecentlyViewedSetNum(item);

    if (!normalizedSetNum || seenSetNums.has(normalizedSetNum)) {
      continue;
    }

    uniqueSetNums.push(normalizedSetNum);
    seenSetNums.add(normalizedSetNum);

    if (uniqueSetNums.length >= MAX_RECENTLY_VIEWED_SET_NUMS) {
      break;
    }
  }

  return uniqueSetNums;
}

function writeRecentlyViewedSetNums(setNums: readonly string[]): void {
  const storage = getRecentlyViewedStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY,
      JSON.stringify([...setNums]),
    );
  } catch {
    // Recently viewed state must never break browsing.
  }
}

export function getRecentlyViewedSetNums(): string[] {
  const storage = getRecentlyViewedStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY);
    const setNums = normalizeRecentlyViewedSetNums(
      rawValue ? JSON.parse(rawValue) : [],
    );

    if (rawValue && setNums.length === 0) {
      storage.removeItem(RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY);
    } else if (rawValue && JSON.stringify(setNums) !== rawValue) {
      writeRecentlyViewedSetNums(setNums);
    }

    return setNums;
  } catch {
    try {
      storage.removeItem(RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }

    return [];
  }
}

export function addRecentlyViewedSetNum(setNum: string): void {
  const normalizedSetNum = normalizeRecentlyViewedSetNum(setNum);

  if (!normalizedSetNum) {
    return;
  }

  const nextSetNums = [
    normalizedSetNum,
    ...getRecentlyViewedSetNums().filter(
      (recentSetNum) => recentSetNum !== normalizedSetNum,
    ),
  ].slice(0, MAX_RECENTLY_VIEWED_SET_NUMS);

  writeRecentlyViewedSetNums(nextSetNums);
}

function clearRecentlyViewedSetNums(): void {
  const storage = getRecentlyViewedStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(RECENTLY_VIEWED_SET_NUMS_STORAGE_KEY);
  } catch {
    // Recently viewed cleanup must never break browsing.
  }
}

function readRecentlyViewedRemoteSetNumsPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return normalizeRecentlyViewedSetNums(
    (payload as Record<string, unknown>).setIds,
  );
}

async function getAuthenticatedRecentlyViewedHeaders(): Promise<
  Headers | undefined
> {
  const headers = await buildSupabaseAuthorizationHeaders();

  return headers.has('Authorization') ? headers : undefined;
}

export async function recordRecentlyViewedSetNum(
  setNum: string,
): Promise<void> {
  const normalizedSetNum = normalizeRecentlyViewedSetNum(setNum);

  if (!normalizedSetNum) {
    return;
  }

  const headers = await getAuthenticatedRecentlyViewedHeaders();

  if (!headers) {
    addRecentlyViewedSetNum(normalizedSetNum);
    return;
  }

  try {
    const response = await fetch(
      `${apiPaths.recentlyViewedSets}/${encodeURIComponent(normalizedSetNum)}`,
      {
        headers,
        method: 'PUT',
      },
    );

    if (response.status === 401) {
      addRecentlyViewedSetNum(normalizedSetNum);
      return;
    }

    if (response.ok) {
      notifyBrowserAccountDataChanged();
    }
  } catch {
    // A remote write must never block the set detail page.
  }
}

export async function getRecentlyViewedSetNumsForCurrentUser(): Promise<{
  isAuthenticated: boolean;
  setNums: string[];
}> {
  const headers = await getAuthenticatedRecentlyViewedHeaders();

  if (!headers) {
    return {
      isAuthenticated: false,
      setNums: getRecentlyViewedSetNums(),
    };
  }

  const localSetNums = getRecentlyViewedSetNums();

  try {
    const mergeHeaders = new Headers(headers);
    mergeHeaders.set('Content-Type', 'application/json');
    const response =
      localSetNums.length > 0
        ? await fetch(`${apiPaths.recentlyViewedSets}/merge`, {
            body: JSON.stringify({ setIds: localSetNums }),
            headers: mergeHeaders,
            method: 'POST',
          })
        : await fetch(apiPaths.recentlyViewedSets, {
            cache: 'no-store',
            headers,
          });

    if (response.status === 401) {
      return {
        isAuthenticated: false,
        setNums: localSetNums,
      };
    }

    if (!response.ok) {
      throw new Error('Unable to load remote recently viewed sets.');
    }

    const remoteSetNums = readRecentlyViewedRemoteSetNumsPayload(
      await response.json(),
    );

    if (localSetNums.length > 0) {
      clearRecentlyViewedSetNums();
    }

    return {
      isAuthenticated: true,
      setNums: remoteSetNums,
    };
  } catch {
    return {
      isAuthenticated: false,
      setNums: localSetNums,
    };
  }
}
