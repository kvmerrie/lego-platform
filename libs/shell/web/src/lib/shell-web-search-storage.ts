const RECENT_SEARCH_STORAGE_KEY = 'brickhunt:recent-searches';
const RECENT_SEARCH_LIMIT = 5;

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export type ShellWebRecentSearchEntry =
  | {
      kind: 'query';
      label: string;
      query: string;
    }
  | {
      kind: 'set';
      href: string;
      label: string;
      meta: string;
      query: string;
    };

export function normalizeRecentSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

function normalizeRecentSearchEntry(
  recentSearchEntry: ShellWebRecentSearchEntry,
): ShellWebRecentSearchEntry | undefined {
  const normalizedLabel = normalizeRecentSearchQuery(recentSearchEntry.label);
  const normalizedQuery = normalizeRecentSearchQuery(recentSearchEntry.query);

  if (!normalizedLabel || !normalizedQuery) {
    return undefined;
  }

  if (recentSearchEntry.kind === 'query') {
    return {
      kind: 'query',
      label: normalizedLabel,
      query: normalizedQuery,
    };
  }

  const normalizedMeta = normalizeRecentSearchQuery(recentSearchEntry.meta);

  if (!recentSearchEntry.href || !normalizedMeta) {
    return undefined;
  }

  return {
    kind: 'set',
    href: recentSearchEntry.href,
    label: normalizedLabel,
    meta: normalizedMeta,
    query: normalizedQuery,
  };
}

function toLegacyRecentSearchEntry(
  recentSearchQuery: string,
): ShellWebRecentSearchEntry | undefined {
  const normalizedQuery = normalizeRecentSearchQuery(recentSearchQuery);

  if (!normalizedQuery) {
    return undefined;
  }

  return {
    kind: 'query',
    label: normalizedQuery,
    query: normalizedQuery,
  };
}

function parseRecentSearchEntry(
  value: unknown,
): ShellWebRecentSearchEntry | undefined {
  if (typeof value === 'string') {
    return toLegacyRecentSearchEntry(value);
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidateEntry = value as Partial<ShellWebRecentSearchEntry>;

  if (candidateEntry.kind === 'query') {
    return normalizeRecentSearchEntry({
      kind: 'query',
      label: candidateEntry.label ?? '',
      query: candidateEntry.query ?? candidateEntry.label ?? '',
    });
  }

  if (candidateEntry.kind === 'set') {
    return normalizeRecentSearchEntry({
      kind: 'set',
      href: candidateEntry.href ?? '',
      label: candidateEntry.label ?? '',
      meta: candidateEntry.meta ?? '',
      query: candidateEntry.query ?? candidateEntry.label ?? '',
    });
  }

  return undefined;
}

function getRecentSearchEntryKeys(
  recentSearchEntry: ShellWebRecentSearchEntry,
): string[] {
  const normalizedLabel = normalizeRecentSearchQuery(
    recentSearchEntry.label,
  ).toLowerCase();
  const normalizedQuery = normalizeRecentSearchQuery(
    recentSearchEntry.query,
  ).toLowerCase();

  return recentSearchEntry.kind === 'set'
    ? [
        `href:${recentSearchEntry.href}`,
        `query:${normalizedQuery}`,
        `label:${normalizedLabel}`,
      ]
    : [`query:${normalizedQuery}`, `label:${normalizedLabel}`];
}

export function createRecentSearchQueryEntry(
  query: string,
): ShellWebRecentSearchEntry | undefined {
  return normalizeRecentSearchEntry({
    kind: 'query',
    label: query,
    query,
  });
}

export function createRecentSearchSetEntry({
  href,
  label,
  meta,
  query,
}: {
  href: string;
  label: string;
  meta: string;
  query?: string;
}): ShellWebRecentSearchEntry | undefined {
  return normalizeRecentSearchEntry({
    kind: 'set',
    href,
    label,
    meta,
    query: query ?? label,
  });
}

export function mergeRecentSearches(
  recentSearches: readonly ShellWebRecentSearchEntry[],
  recentSearchEntry: ShellWebRecentSearchEntry,
): ShellWebRecentSearchEntry[] {
  const normalizedRecentSearchEntry =
    normalizeRecentSearchEntry(recentSearchEntry);

  if (!normalizedRecentSearchEntry) {
    return [...recentSearches];
  }

  const recentSearchEntryKeys = new Set(
    getRecentSearchEntryKeys(normalizedRecentSearchEntry),
  );

  return [
    normalizedRecentSearchEntry,
    ...recentSearches.filter((existingRecentSearchEntry) =>
      getRecentSearchEntryKeys(existingRecentSearchEntry).every(
        (recentSearchEntryKey) =>
          !recentSearchEntryKeys.has(recentSearchEntryKey),
      ),
    ),
  ].slice(0, RECENT_SEARCH_LIMIT);
}

export function removeRecentSearchEntry(
  recentSearches: readonly ShellWebRecentSearchEntry[],
  recentSearchEntry: ShellWebRecentSearchEntry,
): ShellWebRecentSearchEntry[] {
  const normalizedRecentSearchEntry =
    normalizeRecentSearchEntry(recentSearchEntry);

  if (!normalizedRecentSearchEntry) {
    return [...recentSearches];
  }

  const recentSearchEntryKeys = new Set(
    getRecentSearchEntryKeys(normalizedRecentSearchEntry),
  );

  return recentSearches.filter((existingRecentSearchEntry) =>
    getRecentSearchEntryKeys(existingRecentSearchEntry).every(
      (existingRecentSearchEntryKey) =>
        !recentSearchEntryKeys.has(existingRecentSearchEntryKey),
    ),
  );
}

export function readRecentSearches(
  storage?: StorageReader,
): ShellWebRecentSearchEntry[] {
  if (!storage) {
    return [];
  }

  const storedValue = storage.getItem(RECENT_SEARCH_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .flatMap((value) => {
        const recentSearchEntry = parseRecentSearchEntry(value);
        return recentSearchEntry ? [recentSearchEntry] : [];
      })
      .slice(0, RECENT_SEARCH_LIMIT);
  } catch {
    return [];
  }
}

export function writeRecentSearch(
  storage: StorageReader & StorageWriter,
  recentSearchEntry: ShellWebRecentSearchEntry,
): ShellWebRecentSearchEntry[] {
  const nextRecentSearches = mergeRecentSearches(
    readRecentSearches(storage),
    recentSearchEntry,
  );

  storage.setItem(
    RECENT_SEARCH_STORAGE_KEY,
    JSON.stringify(nextRecentSearches),
  );

  return nextRecentSearches;
}

export function removeRecentSearch(
  storage: StorageReader & StorageWriter,
  recentSearchEntry: ShellWebRecentSearchEntry,
): ShellWebRecentSearchEntry[] {
  const nextRecentSearches = removeRecentSearchEntry(
    readRecentSearches(storage),
    recentSearchEntry,
  );

  storage.setItem(
    RECENT_SEARCH_STORAGE_KEY,
    JSON.stringify(nextRecentSearches),
  );

  return nextRecentSearches;
}
