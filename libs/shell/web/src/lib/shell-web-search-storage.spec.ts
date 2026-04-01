import { describe, expect, it } from 'vitest';
import {
  createRecentSearchQueryEntry,
  createRecentSearchSetEntry,
  mergeRecentSearches,
  normalizeRecentSearchQuery,
  readRecentSearches,
  removeRecentSearch,
  removeRecentSearchEntry,
  writeRecentSearch,
} from './shell-web-search-storage';

function createMemoryStorage(initialValue?: string) {
  const values = new Map<string, string>();

  if (initialValue) {
    values.set('brickhunt:recent-searches', initialValue);
  }

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('shell web search storage', () => {
  it('normalizes recent search queries before storing them', () => {
    expect(normalizeRecentSearchQuery('  barad   dur  ')).toBe('barad dur');
  });

  it('keeps recent searches unique and capped', () => {
    const rivendellEntry = createRecentSearchSetEntry({
      href: '/sets/rivendell-10316',
      label: 'Rivendell',
      meta: 'Set 10316 · Icons',
    });
    const baradDurEntry = createRecentSearchQueryEntry('Barad-dur');
    const titanicEntry = createRecentSearchQueryEntry('Titanic');
    const bowserEntry = createRecentSearchQueryEntry('Bowser');
    const gringottsEntry = createRecentSearchQueryEntry('Gringotts');
    const avengersEntry = createRecentSearchQueryEntry('Avengers Tower');

    if (!avengersEntry) {
      throw new Error('Expected Avengers Tower recent-search entry.');
    }

    expect(
      mergeRecentSearches(
        [
          rivendellEntry,
          baradDurEntry,
          titanicEntry,
          bowserEntry,
          gringottsEntry,
        ].flatMap((entry) => (entry ? [entry] : [])),
        avengersEntry,
      ),
    ).toEqual([
      avengersEntry,
      rivendellEntry,
      baradDurEntry,
      titanicEntry,
      bowserEntry,
    ]);
  });

  it('replaces a raw query with the selected set result when they refer to the same intent', () => {
    const queryEntry = createRecentSearchQueryEntry('Rivendell');
    const setEntry = createRecentSearchSetEntry({
      href: '/sets/rivendell-10316',
      label: 'Rivendell',
      meta: 'Set 10316 · Icons',
    });

    if (!queryEntry || !setEntry) {
      throw new Error('Expected Rivendell recent-search entries.');
    }

    expect(mergeRecentSearches([queryEntry], setEntry)).toEqual([setEntry]);
  });

  it('reads legacy string payloads and writes stable structured recent-search state', () => {
    const storage = createMemoryStorage('["Avengers Tower"]');

    expect(readRecentSearches(storage)).toEqual([
      {
        kind: 'query',
        label: 'Avengers Tower',
        query: 'Avengers Tower',
      },
    ]);

    const avengersSetEntry = createRecentSearchSetEntry({
      href: '/sets/avengers-tower-76269',
      label: 'Avengers Tower',
      meta: 'Set 76269 · Marvel',
    });

    if (!avengersSetEntry) {
      throw new Error('Expected Avengers Tower set recent-search entry.');
    }

    const nextRecentSearches = writeRecentSearch(storage, avengersSetEntry);

    expect(nextRecentSearches).toEqual([
      {
        kind: 'set',
        href: '/sets/avengers-tower-76269',
        label: 'Avengers Tower',
        meta: 'Set 76269 · Marvel',
        query: 'Avengers Tower',
      },
    ]);
    expect(readRecentSearches(storage)).toEqual(nextRecentSearches);
  });

  it('removes a single recent-search entry without disturbing the rest of the list', () => {
    const rivendellEntry = createRecentSearchSetEntry({
      href: '/sets/rivendell-10316',
      label: 'Rivendell',
      meta: 'Set 10316 · Icons',
    });
    const baradDurEntry = createRecentSearchQueryEntry('Barad-dur');
    const titanicEntry = createRecentSearchQueryEntry('Titanic');

    if (!rivendellEntry || !baradDurEntry || !titanicEntry) {
      throw new Error('Expected recent-search entries for removal test.');
    }

    expect(
      removeRecentSearchEntry(
        [rivendellEntry, baradDurEntry, titanicEntry],
        baradDurEntry,
      ),
    ).toEqual([rivendellEntry, titanicEntry]);
  });

  it('updates stored recent searches immediately when a single item is removed', () => {
    const storage = createMemoryStorage(
      JSON.stringify([
        {
          kind: 'set',
          href: '/sets/rivendell-10316',
          label: 'Rivendell',
          meta: 'Set 10316 · Icons',
          query: 'Rivendell',
        },
        {
          kind: 'query',
          label: 'Titanic',
          query: 'Titanic',
        },
      ]),
    );
    const titanicEntry = createRecentSearchQueryEntry('Titanic');

    if (!titanicEntry) {
      throw new Error('Expected Titanic recent-search entry.');
    }

    expect(removeRecentSearch(storage, titanicEntry)).toEqual([
      {
        kind: 'set',
        href: '/sets/rivendell-10316',
        label: 'Rivendell',
        meta: 'Set 10316 · Icons',
        query: 'Rivendell',
      },
    ]);
    expect(readRecentSearches(storage)).toEqual([
      {
        kind: 'set',
        href: '/sets/rivendell-10316',
        label: 'Rivendell',
        meta: 'Set 10316 · Icons',
        query: 'Rivendell',
      },
    ]);
  });

  it('ignores malformed storage payloads', () => {
    const storage = createMemoryStorage('{"invalid":true}');

    expect(readRecentSearches(storage)).toEqual([]);
  });
});
