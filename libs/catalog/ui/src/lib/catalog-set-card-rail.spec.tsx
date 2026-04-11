/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogSetCardRail } from './catalog-set-card-rail';

const requestAnimationFrameMock = vi
  .spyOn(window, 'requestAnimationFrame')
  .mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });

describe('CatalogSetCardRail', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resizeObserverCallback: ResizeObserverCallback | null;
  let originalClientWidthDescriptor: PropertyDescriptor | undefined;
  let originalScrollWidthDescriptor: PropertyDescriptor | undefined;
  let originalScrollLeftDescriptor: PropertyDescriptor | undefined;
  let railClientWidth = 720;
  let railScrollWidth = 1440;
  let scrollLeftValue = 0;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    resizeObserverCallback = null;
    railClientWidth = 720;
    railScrollWidth = 1440;
    scrollLeftValue = 0;

    originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    originalScrollWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth',
    );
    originalScrollLeftDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollLeft',
    );

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.className.toString().includes('setCardRailTrack')
          ? railClientWidth
          : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.className.toString().includes('setCardRailTrack')
          ? railScrollWidth
          : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get() {
        return this.className.toString().includes('setCardRailTrack')
          ? scrollLeftValue
          : 0;
      },
      set(value: number) {
        if (this.className.toString().includes('setCardRailTrack')) {
          scrollLeftValue = value;
        }
      },
    });

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe(target: Element) {
        resizeObserverCallback?.(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {
        return undefined;
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    container.remove();
    document.body.innerHTML = '';
    requestAnimationFrameMock.mockClear();
    vi.unstubAllGlobals();

    if (originalClientWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientWidth',
        originalClientWidthDescriptor,
      );
    }

    if (originalScrollWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollWidth',
        originalScrollWidthDescriptor,
      );
    }

    if (originalScrollLeftDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollLeft',
        originalScrollLeftDescriptor,
      );
    }
  });

  it('renders the custom desktop scrollbar layer when the native rail overflows', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Uitgelichte setrail"
          items={[
            {
              id: '10316',
              setSummary: {
                id: '10316',
                slug: 'rivendell-10316',
                name: 'Rivendell',
                theme: 'Icons',
                releaseYear: 2023,
                pieces: 6167,
                imageUrl: 'https://images.example/rivendell.jpg',
                collectorAngle: 'De vallei blijft meteen hangen op je plank.',
              },
            },
            {
              id: '76269',
              setSummary: {
                id: '76269',
                slug: 'avengers-tower-76269',
                name: 'Avengers Tower',
                theme: 'Marvel',
                releaseYear: 2023,
                pieces: 5202,
                imageUrl: 'https://images.example/avengers-tower.jpg',
                collectorAngle: 'Een skyline-set die meteen herkenbaar is.',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    const scrollbar = container.querySelector(
      '[class*="setCardRailScrollbar"]',
    ) as HTMLDivElement | null;

    expect(scrollbar).not.toBeNull();
    expect(scrollbar?.dataset.visible).toBe('true');
    expect(
      container.querySelector('[class*="setCardRailScrollbarThumb"]'),
    ).not.toBeNull();
  });

  it('updates overflow visibility after delayed image/layout completion', () => {
    railScrollWidth = 720;

    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Uitgelichte setrail"
          items={[
            {
              id: '10316',
              setSummary: {
                id: '10316',
                slug: 'rivendell-10316',
                name: 'Rivendell',
                theme: 'Icons',
                releaseYear: 2023,
                pieces: 6167,
                imageUrl: 'https://images.example/rivendell.jpg',
                collectorAngle: 'De vallei blijft meteen hangen op je plank.',
              },
            },
            {
              id: '76269',
              setSummary: {
                id: '76269',
                slug: 'avengers-tower-76269',
                name: 'Avengers Tower',
                theme: 'Marvel',
                releaseYear: 2023,
                pieces: 5202,
                imageUrl: 'https://images.example/avengers-tower.jpg',
                collectorAngle: 'Een skyline-set die meteen herkenbaar is.',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    const scrollbar = container.querySelector(
      '[class*="setCardRailScrollbar"]',
    ) as HTMLDivElement | null;
    const firstImage = container.querySelector('img');

    expect(scrollbar?.dataset.visible).toBe('false');

    railScrollWidth = 1440;

    act(() => {
      firstImage?.dispatchEvent(new Event('load'));
    });

    expect(scrollbar?.dataset.visible).toBe('true');
  });
});
