import { describe, expect, it } from 'vitest';
import { getNextSearchActiveIndex } from './shell-web-search-navigation';

describe('shell web search navigation', () => {
  it('moves forward through search items and wraps at the end', () => {
    expect(
      getNextSearchActiveIndex({
        activeIndex: -1,
        itemCount: 3,
        key: 'ArrowDown',
      }),
    ).toBe(0);

    expect(
      getNextSearchActiveIndex({
        activeIndex: 2,
        itemCount: 3,
        key: 'ArrowDown',
      }),
    ).toBe(0);
  });

  it('moves backward through search items and wraps to the end', () => {
    expect(
      getNextSearchActiveIndex({
        activeIndex: -1,
        itemCount: 3,
        key: 'ArrowUp',
      }),
    ).toBe(2);

    expect(
      getNextSearchActiveIndex({
        activeIndex: 0,
        itemCount: 3,
        key: 'ArrowUp',
      }),
    ).toBe(2);
  });

  it('clears the active item when escape is pressed or there are no items', () => {
    expect(
      getNextSearchActiveIndex({
        activeIndex: 1,
        itemCount: 3,
        key: 'Escape',
      }),
    ).toBe(-1);

    expect(
      getNextSearchActiveIndex({
        activeIndex: 1,
        itemCount: 0,
        key: 'ArrowDown',
      }),
    ).toBe(-1);
  });
});
