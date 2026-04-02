/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShellWebSearchForm } from './shell-web-search-form';
import {
  createRecentSearchSetEntry,
  writeRecentSearch,
} from './shell-web-search-storage';

describe('ShellWebSearchForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    container.remove();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    window.localStorage.clear();
  });

  it('opens a full-screen mobile overlay with recent searches and live suggestions', () => {
    const recentSearchEntry = createRecentSearchSetEntry({
      href: '/sets/the-razor-crest-75331',
      label: 'The Razor Crest',
      meta: 'Set 75331 · Star Wars',
    });

    if (recentSearchEntry) {
      writeRecentSearch(window.localStorage, recentSearchEntry);
    }

    act(() => {
      root.render(
        <ShellWebSearchForm
          inputId="site-search-mobile"
          variant="mobile-overlay"
        />,
      );
    });

    const openButton = container.querySelector(
      'button[aria-label="Open search"]',
    ) as HTMLButtonElement | null;

    expect(openButton).not.toBeNull();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const searchInput = container.querySelector(
      '#site-search-mobile',
    ) as HTMLInputElement | null;

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(searchInput);
    expect(container.textContent).toContain('Recent searches');
    expect(container.textContent).toContain('The Razor Crest');

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, 'grogu');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('Matching sets');
    expect(container.textContent).toContain('See all results for "grogu"');

    act(() => {
      searchInput?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(openButton);
  });
});
