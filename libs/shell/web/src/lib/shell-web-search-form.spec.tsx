/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  clearShellWebSearchSuggestionOverlaySetCardsCache,
  ShellWebSearchForm,
} from './shell-web-search-form';
import { writeSearchOverlayReturnState } from './shell-web-search-overlay-return-state';
import { openMobileSearchOverlayEventName } from './shell-web-search-overlay-events';
import {
  createRecentSearchSetEntry,
  writeRecentSearch,
} from './shell-web-search-storage';

const routerBack = vi.fn();
const routerReplace = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const requestAnimationFrameMock = vi
  .spyOn(window, 'requestAnimationFrame')
  .mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });

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
    vi.stubGlobal('fetch', fetchMock);
    clearShellWebSearchSuggestionOverlaySetCardsCache();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    routerBack.mockReset();
    routerReplace.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );
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
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    requestAnimationFrameMock.mockClear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
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

    const openButton = document.body.querySelector(
      'button[aria-label="Open zoeken"]',
    ) as HTMLButtonElement | null;

    expect(openButton).not.toBeNull();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const searchInput = document.body.querySelector(
      '#site-search-mobile',
    ) as HTMLInputElement | null;

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(searchInput);
    expect(document.body.textContent).toContain('Recente zoekopdrachten');
    expect(document.body.textContent).toContain('The Razor Crest');

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

    expect(document.body.textContent).toContain('Passende sets');
    expect(document.body.textContent).toContain(
      'Bekijk alle resultaten voor "grogu"',
    );

    act(() => {
      searchInput?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(openButton);
  });

  it('shows overlay-backed sets in live shell suggestions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: '72037',
            imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
            name: 'Mario Kart - Mario & Standard Kart',
            pieces: 1972,
            releaseYear: 2025,
            slug: 'mario-kart-mario-standard-kart-72037',
            theme: 'Super Mario',
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    act(() => {
      root.render(
        <ShellWebSearchForm autoFocus inputId="site-search-inline-overlay" />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-overlay',
    ) as HTMLInputElement | null;

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, '72037');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.body.textContent).toContain(
      'Mario Kart - Mario & Standard Kart',
    );
    expect(
      document.body.querySelector(
        'a[href="/sets/mario-kart-mario-standard-kart-72037"]',
      ),
    ).not.toBeNull();
  });

  it('shows theme suggestions and closes inline search from the backdrop', async () => {
    const restoreTarget = document.createElement('button');
    restoreTarget.id = 'search-restore-target';
    restoreTarget.textContent = 'Account';
    document.body.appendChild(restoreTarget);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sets: [],
          themes: [
            {
              themeSnapshot: {
                momentum: 'Ships, helmets and display sets.',
                name: 'Star Wars™',
                setCount: 42,
                signatureSet: 'AT-AT',
                slug: 'star-wars',
              },
            },
          ],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    act(() => {
      root.render(
        <ShellWebSearchForm
          autoFocus
          inputId="site-search-theme-suggestion"
          restoreFocusTargetId="search-restore-target"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-theme-suggestion',
    ) as HTMLInputElement | null;

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, 'Star War');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.body.textContent).toContain("Thema's");
    expect(document.body.textContent).toContain('Star Wars™');
    expect(document.body.textContent).toContain('Thema · 42 sets');
    expect(
      document.body.querySelector('a[href="/themes/star-wars"]'),
    ).not.toBeNull();
    const backdrop = document.body.querySelector(
      'button[data-search-backdrop="true"]',
    ) as HTMLButtonElement | null;
    const overlayLayer = document.body.querySelector(
      '[data-search-overlay-layer="true"]',
    );

    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(overlayLayer?.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.dataset['shellSearchOpen']).toBe('true');
    expect(document.activeElement).toBe(searchInput);

    await act(async () => {
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain('Star Wars™');
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement).not.toBe(restoreTarget);
    expect(document.activeElement).not.toBe(searchInput);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
        }),
      );
      await Promise.resolve();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement).toBe(restoreTarget);
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.dataset['shellSearchOpen']).toBeUndefined();
    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).toBeNull();
  });

  it('closes inline search and defers account focus until Tab after Escape', async () => {
    const restoreTarget = document.createElement('button');
    restoreTarget.id = 'escape-restore-target';
    restoreTarget.textContent = 'Account';
    document.body.appendChild(restoreTarget);

    act(() => {
      root.render(
        <ShellWebSearchForm
          autoFocus
          inputId="site-search-inline-escape"
          restoreFocusTargetId="escape-restore-target"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-escape',
    ) as HTMLInputElement | null;

    expect(searchInput).not.toBeNull();
    expect(document.activeElement).toBe(searchInput);
    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).not.toBeNull();

    await act(async () => {
      searchInput?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      );
      await Promise.resolve();
    });

    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).toBeNull();
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement).not.toBe(restoreTarget);
    expect(document.activeElement).not.toBe(searchInput);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
        }),
      );
      await Promise.resolve();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement).toBe(restoreTarget);
  });

  it('continues to the account control after tabbing past the last suggestion', async () => {
    const restoreTarget = document.createElement('button');
    restoreTarget.id = 'tab-restore-target';
    restoreTarget.textContent = 'Account';
    document.body.appendChild(restoreTarget);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sets: [
            {
              id: '10316',
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
              name: 'Rivendell',
              pieces: 6167,
              releaseYear: 2023,
              slug: 'rivendell-10316',
              theme: 'LEGO® Icons',
            },
          ],
          themes: [],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    act(() => {
      root.render(
        <ShellWebSearchForm
          autoFocus
          inputId="site-search-inline-tab"
          restoreFocusTargetId="tab-restore-target"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-tab',
    ) as HTMLInputElement | null;

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, 'Rivendell');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const searchResultsLink = document.body.querySelector(
      'a[href="/search?q=Rivendell"]',
    ) as HTMLAnchorElement | null;

    expect(searchResultsLink).not.toBeNull();
    searchResultsLink?.focus();
    expect(document.activeElement).toBe(searchResultsLink);

    await act(async () => {
      searchResultsLink?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
        }),
      );
      await Promise.resolve();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(restoreTarget);
  });

  it('moves focus back to the search input when shift-tabbing from the first suggestion', async () => {
    const restoreTarget = document.createElement('button');
    restoreTarget.id = 'shift-tab-restore-target';
    restoreTarget.textContent = 'Account';
    document.body.appendChild(restoreTarget);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sets: [
            {
              id: '10316',
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
              name: 'Rivendell',
              pieces: 6167,
              releaseYear: 2023,
              slug: 'rivendell-10316',
              theme: 'LEGO® Icons',
            },
          ],
          themes: [],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    act(() => {
      root.render(
        <ShellWebSearchForm
          autoFocus
          inputId="site-search-inline-shift-tab"
          restoreFocusTargetId="shift-tab-restore-target"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-shift-tab',
    ) as HTMLInputElement | null;

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, 'Rivendell');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const firstSuggestion = document.body.querySelector(
      'a[href="/sets/rivendell-10316"]',
    ) as HTMLAnchorElement | null;

    expect(firstSuggestion).not.toBeNull();
    firstSuggestion?.focus();

    await act(async () => {
      firstSuggestion?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
          shiftKey: true,
        }),
      );
      await Promise.resolve();
    });

    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(searchInput);
  });

  it('moves focus to the previous navbar control when shift-tabbing from the active search input', async () => {
    const previousNavControl = document.createElement('a');
    previousNavControl.href = '/volgt';
    previousNavControl.textContent = 'Volgt';
    document.body.insertBefore(previousNavControl, container);

    const restoreTarget = document.createElement('button');
    restoreTarget.id = 'shift-tab-input-restore-target';
    restoreTarget.textContent = 'Account';
    document.body.appendChild(restoreTarget);

    act(() => {
      root.render(
        <ShellWebSearchForm
          autoFocus
          inputId="site-search-inline-input-shift-tab"
          restoreFocusTargetId="shift-tab-input-restore-target"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-input-shift-tab',
    ) as HTMLInputElement | null;

    expect(searchInput).not.toBeNull();
    expect(document.activeElement).toBe(searchInput);

    await act(async () => {
      searchInput?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
          shiftKey: true,
        }),
      );
      await Promise.resolve();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(
      document.body.querySelector('button[data-search-backdrop="true"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(previousNavControl);
    expect(document.activeElement).not.toBe(restoreTarget);
  });

  it('keeps snapshot-backed suggestions available while deduping overlay duplicates', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: '72037',
            imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
            name: 'Mario Kart - Mario & Standard Kart',
            pieces: 1972,
            releaseYear: 2025,
            slug: 'mario-kart-mario-standard-kart-72037',
            theme: 'Super Mario',
          },
          {
            id: '72037',
            imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
            name: 'Mario Kart - Mario & Standard Kart',
            pieces: 1972,
            releaseYear: 2025,
            slug: 'mario-kart-mario-standard-kart-72037',
            theme: 'Super Mario',
          },
          {
            id: '10316',
            imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
            name: 'Rivendell',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'rivendell-10316',
            theme: 'LEGO® Icons',
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    act(() => {
      root.render(
        <ShellWebSearchForm autoFocus inputId="site-search-inline-snapshot" />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-snapshot',
    ) as HTMLInputElement | null;

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, '10316');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.body.textContent).toContain('Rivendell');

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, '72037');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(
      document.body.querySelectorAll(
        'a[href="/sets/mario-kart-mario-standard-kart-72037"]',
      ),
    ).toHaveLength(1);
  });

  it('can autofocus the inline search field for a direct search page entry', async () => {
    act(() => {
      root.render(
        <ShellWebSearchForm autoFocus inputId="site-search-inline-entry" />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = document.getElementById(
      'site-search-inline-entry',
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

    const searchInput = document.body.querySelector(
      '#site-search-overlay-entry',
    ) as HTMLInputElement | null;

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('button[aria-label="Open zoeken"]'),
    ).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(searchInput);
  });

  it('can open the hidden mobile overlay from the shared tab-bar event and focus immediately', () => {
    act(() => {
      root.render(
        <ShellWebSearchForm
          hideTrigger
          inputId="site-search-shell-overlay"
          variant="mobile-overlay"
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new Event(openMobileSearchOverlayEventName));
    });

    const searchInput = document.body.querySelector(
      '#site-search-shell-overlay',
    ) as HTMLInputElement | null;

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
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
          closeFallbackHref="/themes"
          hideTrigger
          inputId="site-search-overlay-close"
          openOnMount
          variant="mobile-overlay"
        />,
      );
    });

    const closeButton = document.body.querySelector(
      'button[aria-label="Zoeken sluiten"]',
    ) as HTMLButtonElement | null;

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerReplace).toHaveBeenCalledWith('/themes/icons', {
      scroll: false,
    });
  });

  it('executes the search route when the mobile overlay form submits', () => {
    act(() => {
      root.render(
        <ShellWebSearchForm
          hideTrigger
          inputId="site-search-overlay-submit"
          openOnMount
          variant="mobile-overlay"
        />,
      );
    });

    const searchInput = document.body.querySelector(
      '#site-search-overlay-submit',
    ) as HTMLInputElement | null;
    const searchForm = document.body.querySelector('form[role="search"]');

    act(() => {
      if (searchInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        valueSetter?.call(searchInput, 'Riven');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    act(() => {
      searchForm?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });

    expect(routerReplace).toHaveBeenCalledWith('/search?q=Riven', {
      scroll: false,
    });
  });

  it('re-focuses the overlay search input when the mobile search route is reopened', () => {
    act(() => {
      root.render(
        <ShellWebSearchForm
          hideTrigger
          inputId="site-search-overlay-reopen"
          openOnMount
          query="Rivendell"
          variant="mobile-overlay"
        />,
      );
    });

    const searchInput = document.body.querySelector(
      '#site-search-overlay-reopen',
    ) as HTMLInputElement | null;
    const closeButton = document.body.querySelector(
      'button[aria-label="Zoeken sluiten"]',
    ) as HTMLButtonElement | null;

    act(() => {
      closeButton?.focus();
    });

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      window.dispatchEvent(new Event(openMobileSearchOverlayEventName));
    });

    expect(document.activeElement).toBe(searchInput);
    expect(searchInput?.selectionStart).toBe(0);
    expect(searchInput?.selectionEnd).toBe('Rivendell'.length);
  });
});
