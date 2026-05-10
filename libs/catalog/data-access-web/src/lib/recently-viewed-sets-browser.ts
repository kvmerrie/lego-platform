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
