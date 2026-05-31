/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogSetCardRail,
  CatalogSetCardRailSkeletonSection,
  CatalogSetCardRailSection,
} from './catalog-set-card-rail';

function dispatchPointerEvent(
  element: Element | null,
  type: string,
  options: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
  },
) {
  if (!element) {
    return null;
  }

  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  Object.assign(event, {
    button: 0,
    clientX: options.clientX,
    clientY: options.clientY,
    pointerId: options.pointerId ?? 1,
    pointerType: options.pointerType ?? 'touch',
  });

  element.dispatchEvent(event);

  return event;
}

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
  let originalScrollBy: typeof HTMLElement.prototype.scrollBy | undefined;
  let originalScrollTo: typeof HTMLElement.prototype.scrollTo | undefined;
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
    originalScrollBy = HTMLElement.prototype.scrollBy;
    originalScrollTo = HTMLElement.prototype.scrollTo;

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

    HTMLElement.prototype.scrollBy = function scrollBy({
      left = 0,
    }: ScrollToOptions) {
      if (this.className.toString().includes('setCardRailTrack')) {
        scrollLeftValue += left;
        this.dispatchEvent(new Event('scroll'));
      }
    };

    HTMLElement.prototype.scrollTo = function scrollTo({
      left = 0,
    }: ScrollToOptions) {
      if (this.className.toString().includes('setCardRailTrack')) {
        scrollLeftValue = left;
        this.dispatchEvent(new Event('scroll'));
      }
    };

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

    if (originalScrollBy) {
      HTMLElement.prototype.scrollBy = originalScrollBy;
    } else {
      delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy;
    }

    if (originalScrollTo) {
      HTMLElement.prototype.scrollTo = originalScrollTo;
    } else {
      delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });

  it('renders a stable skeleton rail for streamed or client-only rails', () => {
    act(() => {
      root.render(
        <CatalogSetCardRailSkeletonSection
          ariaLabel="Vergelijkbare LEGO sets laden"
          description="We zoeken vergelijkbare sets."
          eyebrow="Hierna kijken"
          itemCount={3}
          title="Vergelijkbare LEGO sets"
        />,
      );
    });

    expect(container.textContent).toContain('Vergelijkbare LEGO sets');
    expect(container.textContent).toContain('We zoeken vergelijkbare sets.');
    expect(
      container.querySelectorAll('[class*="setCardRailSkeletonCard"]'),
    ).toHaveLength(3);
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

  it('updates next and previous control state after button scrolling', () => {
    railScrollWidth = 2160;

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
              },
            },
            {
              id: '43247',
              setSummary: {
                id: '43247',
                slug: 'young-simba-the-lion-king-43247',
                name: 'Young Simba the Lion King',
                theme: 'Disney',
                releaseYear: 2024,
                pieces: 1445,
                imageUrl: 'https://images.example/simba.jpg',
              },
            },
          ]}
          showControls
          variant="featured"
        />,
      );
    });

    const thumb = container.querySelector(
      '[class*="setCardRailScrollbarThumb"]',
    ) as HTMLDivElement | null;
    const previousButton = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButton = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(false);
    expect(thumb?.style.left).toBe('0%');

    act(() => {
      nextButton?.click();
    });

    const previousButtonAfterFirstScroll = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonAfterFirstScroll = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButtonAfterFirstScroll?.disabled).toBe(false);
    expect(nextButtonAfterFirstScroll?.disabled).toBe(false);
    expect(thumb?.style.left).not.toBe('0%');

    act(() => {
      nextButtonAfterFirstScroll?.click();
    });

    const previousButtonAtEnd = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonAtEnd = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButtonAtEnd?.disabled).toBe(false);
    expect(nextButtonAtEnd?.disabled).toBe(true);

    act(() => {
      previousButtonAtEnd?.click();
    });

    const previousButtonAfterBack = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonAfterBack = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButtonAfterBack?.disabled).toBe(false);
    expect(nextButtonAfterBack?.disabled).toBe(false);

    act(() => {
      previousButtonAfterBack?.click();
    });

    const previousButtonAtStart = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonAtStart = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButtonAtStart?.disabled).toBe(true);
    expect(nextButtonAtStart?.disabled).toBe(false);
    expect(thumb?.style.left).toBe('0%');
  });

  it('keeps heading actions before the dedicated rail controls', () => {
    railScrollWidth = 2880;

    act(() => {
      root.render(
        <CatalogSetCardRailSection
          action={<a href="/deals">Bekijk alle deals</a>}
          ariaLabel="Beste deals nu"
          items={Array.from({ length: 20 }, (_, index) => {
            const setId = String(30_000 + index);

            return {
              id: setId,
              href: `/sets/set-${setId}`,
              setSummary: {
                id: setId,
                slug: `set-${setId}`,
                name: `Set ${index + 1}`,
                theme: 'Icons',
                releaseYear: 2024,
                pieces: 1000 + index,
                imageUrl: `https://images.example/${setId}.jpg`,
              },
            };
          })}
          title="Beste deals nu"
          variant="featured"
        />,
      );
    });

    expect(container.textContent).toContain('Bekijk alle deals');

    const markup = container.innerHTML;

    expect(markup.indexOf('Beste deals nu')).toBeLessThan(
      markup.indexOf('Bekijk alle deals'),
    );
    expect(markup.indexOf('Bekijk alle deals')).toBeLessThan(
      markup.indexOf('Scroll Beste deals nu naar links'),
    );
  });

  it('pages heading controls by the visible card group on desktop rails', () => {
    railClientWidth = 720;
    railScrollWidth = 2880;

    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Uitgelichte setrail"
          items={Array.from({ length: 20 }, (_, index) => {
            const setId = String(10_000 + index);

            return {
              id: setId,
              setSummary: {
                id: setId,
                slug: `set-${setId}`,
                name: `Set ${index + 1}`,
                theme: 'Icons',
                releaseYear: 2024,
                pieces: 1000 + index,
                imageUrl: `https://images.example/${setId}.jpg`,
              },
            };
          })}
          showControls
          variant="featured"
        />,
      );
    });

    const nextButton = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;
    const previousButton = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;

    act(() => {
      nextButton?.click();
    });
    expect(scrollLeftValue).toBe(720);

    act(() => {
      nextButton?.click();
    });
    expect(scrollLeftValue).toBe(1440);

    act(() => {
      nextButton?.click();
    });
    expect(scrollLeftValue).toBe(2160);

    act(() => {
      previousButton?.click();
    });
    expect(scrollLeftValue).toBe(1440);
  });

  it('uses the responsive visible card count for smaller rail viewports', () => {
    railClientWidth = 480;
    railScrollWidth = 2400;

    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Compacte setrail"
          items={Array.from({ length: 20 }, (_, index) => {
            const setId = String(20_000 + index);

            return {
              id: setId,
              setSummary: {
                id: setId,
                slug: `set-${setId}`,
                name: `Set ${index + 1}`,
                theme: 'City',
                releaseYear: 2024,
                pieces: 500 + index,
                imageUrl: `https://images.example/${setId}.jpg`,
              },
            };
          })}
          showControls
          variant="featured"
        />,
      );
    });

    const nextButton = container.querySelector(
      'button[aria-label="Scroll Compacte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    act(() => {
      nextButton?.click();
    });

    expect(scrollLeftValue).toBe(480);
  });

  it('uses the shared default section surface for themed rails so the rail shell keeps the standard radius', () => {
    act(() => {
      root.render(
        <CatalogSetCardRailSection
          ariaLabel="Star Wars rail"
          items={[
            {
              id: '75446',
              setSummary: {
                id: '75446',
                slug: 'grogu-mandalorian-apprentice-75446',
                name: 'Grogu (Mandalorian Apprentice)',
                theme: 'Star Wars',
                releaseYear: 2026,
                pieces: 1200,
                imageUrl: 'https://images.example/grogu.jpg',
              },
            },
          ]}
          surfaceVariant="themed"
          title="Nieuwe Star Wars releases"
          variant="compact"
        />,
      );
    });

    const railShell = container.querySelector(
      '[class*="sectionShellDefault"]',
    ) as HTMLElement | null;

    expect(railShell).not.toBeNull();
    expect(railShell?.className).toContain('setCardRailSectionThemed');
  });

  it('supports tablet-width overflow bleed for article-style rails', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Artikel rail"
          items={[
            {
              id: '75446',
              setSummary: {
                id: '75446',
                slug: 'grogu-mandalorian-apprentice-75446',
                name: 'Grogu (Mandalorian Apprentice)',
                theme: 'Star Wars',
                releaseYear: 2026,
                pieces: 1200,
                imageUrl: 'https://images.example/grogu.jpg',
              },
            },
          ]}
          mobileOverflowBleed
          mobileOverflowBleedUntil="page"
          variant="compact"
        />,
      );
    });

    const railRoot = container.querySelector(
      '[data-rail-mobile-bleed="true"]',
    ) as HTMLElement | null;

    expect(railRoot?.getAttribute('data-rail-mobile-bleed-until')).toBe('page');
    expect(railRoot?.className).toContain('setCardRailPageBleed');

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.setCardRailSectionPageBleed');
    expect(css).toContain('width: 100vw;');
    expect(css).toContain('margin-inline: calc(50% - 50vw);');
  });

  it('keeps themed rail header colors off the white cards themselves', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('--rail-scrollbar-track: color-mix(');
    expect(css).toContain('--rail-scrollbar-thumb: color-mix(');
    expect(css).toContain('--rail-card-border: var(--lego-border-subtle);');
    expect(css).toContain(
      'border: var(--lego-border-width-1) solid var(--rail-card-border);',
    );
    expect(css).toContain(
      'background: var(--article-theme-surface, var(--lego-surface-default));',
    );
    expect(css).not.toContain(
      '--article-theme-surface: var(--lego-surface-default);',
    );
    expect(css).not.toContain(
      '--article-theme-muted-text: var(--lego-text-muted);',
    );
    expect(css).not.toContain('--article-theme-surface-text: inherit;');
    expect(css).toContain('.setCardRailSectionThemed {');
    expect(css).toContain(
      '--rail-card-border: color-mix(\n      in srgb,\n      var(--article-theme-surface-text, currentColor) 16%,',
    );
    expect(css).toContain(
      '--rail-scrollbar-thumb-hover: color-mix(\n      in srgb,\n      var(--article-theme-surface-text, currentColor) 48%,',
    );
    expect(css).toContain('background: var(--rail-scrollbar-track);');
    expect(css).toContain('background: var(--rail-scrollbar-thumb);');
    expect(css).toContain('background: var(--rail-scrollbar-thumb-hover);');
    expect(css).toContain('.setCardRailSectionThemed .setCard');
    expect(css).toContain('.setCardRailSectionThemed .setCardLink');
    expect(css).toContain('color: var(--lego-text);');
    expect(css).toContain(
      '--lego-text-muted: var(--catalog-card-muted-text, #5d677c);',
    );
  });

  it('locks horizontal touch gestures and keeps taps responsive during rail momentum', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Uitgelichte setrail"
          items={[
            {
              href: '/sets/rivendell-10316',
              id: '10316',
              setSummary: {
                id: '10316',
                slug: 'rivendell-10316',
                name: 'Rivendell',
                theme: 'Icons',
                releaseYear: 2023,
                pieces: 6167,
                imageUrl: 'https://images.example/rivendell.jpg',
              },
            },
            {
              href: '/sets/avengers-tower-76269',
              id: '76269',
              setSummary: {
                id: '76269',
                slug: 'avengers-tower-76269',
                name: 'Avengers Tower',
                theme: 'Marvel',
                releaseYear: 2023,
                pieces: 5202,
                imageUrl: 'https://images.example/avengers-tower.jpg',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    const railTrack = container.querySelector(
      '[class*="setCardRailTrack"]',
    ) as HTMLDivElement | null;
    const firstLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/sets/rivendell-10316"]',
    );
    const clickHandler = vi.fn((event: MouseEvent) => event.preventDefault());

    firstLink?.addEventListener('click', clickHandler);
    scrollLeftValue = 120;

    dispatchPointerEvent(firstLink, 'pointerdown', {
      clientX: 140,
      clientY: 80,
    });
    firstLink?.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(clickHandler).toHaveBeenCalledTimes(1);

    dispatchPointerEvent(railTrack, 'pointerdown', {
      clientX: 140,
      clientY: 80,
    });
    const horizontalMoveEvent = dispatchPointerEvent(railTrack, 'pointermove', {
      clientX: 86,
      clientY: 84,
    });

    expect(scrollLeftValue).toBe(174);
    expect(horizontalMoveEvent?.defaultPrevented).toBe(true);

    scrollLeftValue = 120;

    dispatchPointerEvent(railTrack, 'pointerdown', {
      clientX: 140,
      clientY: 80,
    });
    const verticalMoveEvent = dispatchPointerEvent(railTrack, 'pointermove', {
      clientX: 128,
      clientY: 126,
    });

    expect(scrollLeftValue).toBe(120);
    expect(verticalMoveEvent?.defaultPrevented).toBe(false);

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.setCardRailTrack {');
    expect(css).toContain('touch-action: pan-y;');
    expect(css).not.toContain('touch-action: pan-x;');
  });

  it('syncs scroll progress and button state after native horizontal scrolling', async () => {
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
              },
            },
          ]}
          showControls
          variant="featured"
        />,
      );
    });

    const railTrack = container.querySelector(
      '[class*="setCardRailTrack"]',
    ) as HTMLDivElement | null;
    await act(async () => {
      railTrack?.scrollBy({ left: 360 });
      await Promise.resolve();
    });

    const previousButtonMidRail = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonMidRail = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    expect(previousButtonMidRail).not.toBeNull();
    expect(nextButtonMidRail).not.toBeNull();

    await act(async () => {
      railTrack?.scrollBy({ left: 360 });
      await Promise.resolve();
    });

    const previousButtonAtEnd = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar links"]',
    ) as HTMLButtonElement | null;
    const nextButtonAtEnd = container.querySelector(
      'button[aria-label="Scroll Uitgelichte setrail naar rechts"]',
    ) as HTMLButtonElement | null;

    await vi.waitFor(() => {
      expect(previousButtonAtEnd?.disabled).toBe(false);
      expect(nextButtonAtEnd?.disabled).toBe(true);
    });
  });
});
