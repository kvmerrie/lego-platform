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

    const searchInput = container.querySelector(
      '#site-search-inline-overlay',
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

    expect(container.textContent).toContain(
      'Mario Kart - Mario & Standard Kart',
    );
    expect(
      container.querySelector(
        'a[href="/sets/mario-kart-mario-standard-kart-72037"]',
      ),
    ).not.toBeNull();
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

    const searchInput = container.querySelector(
      '#site-search-inline-snapshot',
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

    expect(container.textContent).toContain('Rivendell');

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
      container.querySelectorAll(
        'a[href="/sets/mario-kart-mario-standard-kart-72037"]',
      ),
    ).toHaveLength(1);
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

    const searchInput = container.querySelector(
      '#site-search-shell-overlay',
    ) as HTMLInputElement | null;

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
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

    const searchInput = container.querySelector(
      '#site-search-overlay-submit',
    ) as HTMLInputElement | null;
    const searchForm = container.querySelector('form[role="search"]');

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

    const searchInput = container.querySelector(
      '#site-search-overlay-reopen',
    ) as HTMLInputElement | null;
    const closeButton = container.querySelector(
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
