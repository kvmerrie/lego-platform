import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  addRecentlyViewedSetNum,
  getRecentlyViewedSetNums,
} from './recently-viewed-sets-browser';

function installStorageWindow() {
  const storage = new Map<string, string>();

  vi.stubGlobal('window', {
    localStorage: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
}

describe('recently viewed sets browser storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('keeps newest set nums first and dedupes', () => {
    installStorageWindow();

    addRecentlyViewedSetNum('10316');
    addRecentlyViewedSetNum('75355');
    addRecentlyViewedSetNum('10316');

    expect(getRecentlyViewedSetNums()).toEqual(['10316', '75355']);
  });

  test('keeps at most 12 set nums', () => {
    installStorageWindow();

    for (let index = 1; index <= 14; index += 1) {
      addRecentlyViewedSetNum(`${index}`);
    }

    expect(getRecentlyViewedSetNums()).toEqual([
      '14',
      '13',
      '12',
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
    ]);
  });

  test('clears invalid stored values', () => {
    installStorageWindow();

    window.localStorage.setItem(
      'brickhunt.recently-viewed-set-nums',
      JSON.stringify(['10316', '', 'bad value', '75355']),
    );

    expect(getRecentlyViewedSetNums()).toEqual(['10316', '75355']);
  });

  test('is a no-op when localStorage is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(() => addRecentlyViewedSetNum('10316')).not.toThrow();
    expect(getRecentlyViewedSetNums()).toEqual([]);
  });

  test('is a no-op when localStorage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('security');
        },
        removeItem: () => {
          throw new Error('security');
        },
        setItem: () => {
          throw new Error('quota');
        },
      },
    });

    expect(() => addRecentlyViewedSetNum('10316')).not.toThrow();
    expect(getRecentlyViewedSetNums()).toEqual([]);
  });
});
