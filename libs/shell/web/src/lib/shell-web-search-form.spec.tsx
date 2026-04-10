/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellWebSearchForm } from './shell-web-search-form';
import { writeSearchOverlayReturnState } from './shell-web-search-overlay-return-state';
import {
  createRecentSearchSetEntry,
  writeRecentSearch,
} from './shell-web-search-storage';

const routerBack = vi.fn();
const routerReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: routerBack,
    replace: routerReplace,
  }),
}));

describe('ShellWebSearchForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    routerBack.mockReset();
    routerReplace.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
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
    window.sessionStorage.clear();
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
      'button[aria-label="Open zoeken"]',
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
    expect(container.textContent).toContain('Recente zoekopdrachten');
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

    expect(container.textContent).toContain('Passende sets');
    expect(container.textContent).toContain(
      'Bekijk alle resultaten voor "grogu"',
    );

    act(() => {
      searchInput?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(openButton);
  });

  it('can autofocus the inline search field for a direct search page entry', () => {
    act(() => {
      root.render(
        <ShellWebSearchForm autoFocus inputId="site-search-inline-entry" />,
      );
    });

    const searchInput = container.querySelector(
      '#site-search-inline-entry',
    ) as HTMLInputElement | null;

    expect(document.activeElement).toBe(searchInput);
  });

  it('can open the fullscreen overlay immediately without rendering a trigger', () => {
    act(() => {
      root.render(
        <ShellWebSearchForm
          hideTrigger
          inputId="site-search-overlay-entry"
          openOnMount
          variant="mobile-overlay"
        />,
      );
    });

    const searchInput = container.querySelector(
      '#site-search-overlay-entry',
    ) as HTMLInputElement | null;

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Open zoeken"]'),
    ).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(searchInput);
  });

  it('returns to the stored fallback route when the overlay closes without history', () => {
    writeSearchOverlayReturnState(window.sessionStorage, {
      href: '/themes/icons',
      scrollX: 0,
      scrollY: 640,
    });

    act(() => {
      root.render(
        <ShellWebSearchForm
          closeFallbackHref="/discover"
          hideTrigger
          inputId="site-search-overlay-close"
          openOnMount
          variant="mobile-overlay"
        />,
      );
    });

    const closeButton = container.querySelector(
      'button[aria-label="Zoeken sluiten"]',
    ) as HTMLButtonElement | null;

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerReplace).toHaveBeenCalledWith('/themes/icons', {
      scroll: false,
    });
  });
});
