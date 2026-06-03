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
  let railClientWidthReadCount = 0;
  let railScrollWidthReadCount = 0;
  let railScrollLeftReadCount = 0;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    resizeObserverCallback = null;
    railClientWidth = 720;
    railScrollWidth = 1440;
    scrollLeftValue = 0;
    railClientWidthReadCount = 0;
    railScrollWidthReadCount = 0;
    railScrollLeftReadCount = 0;

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
        if (this.className.toString().includes('setCardRailTrack')) {
          railClientWidthReadCount += 1;

          return railClientWidth;
        }

        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        if (this.className.toString().includes('setCardRailTrack')) {
          railScrollWidthReadCount += 1;

          return railScrollWidth;
        }

        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get() {
        if (this.className.toString().includes('setCardRailTrack')) {
          railScrollLeftReadCount += 1;

          return scrollLeftValue;
        }

        return 0;
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
    requestAnimationFrameMock.mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
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
          tone="default"
        />,
      );
    });

    expect(container.textContent).toContain('Vergelijkbare LEGO sets');
    expect(container.textContent).toContain('We zoeken vergelijkbare sets.');
    expect(
      container.querySelector('[class*="sectionShellDefault"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('[class*="setCardRailSkeletonCard"]'),
    ).toHaveLength(3);

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const skeletonSectionRule =
      css.match(/\.setCardRailSkeletonSection \{[^}]+\}/u)?.[0] ?? '';
    const inverseSkeletonSectionRule =
      css.match(
        /\.sectionShellInverse\.setCardRailSkeletonSection \{[^}]+\}/u,
      )?.[0] ?? '';
    const skeletonCardRule =
      css.match(/\.setCardRailSkeletonCard \{[^}]+\}/u)?.[0] ?? '';
    const skeletonTrackRule =
      css.match(/\.setCardRailSkeletonTrack \{[^}]+\}/u)?.[0] ?? '';
    const skeletonImageRule =
      css.match(/\.setCardRailSkeletonImage \{[^}]+\}/u)?.[0] ?? '';
    const loadedRailCardRule =
      css.match(/\.setCardRailTrack > \.setCard \{[^}]+\}/u)?.[0] ?? '';

    expect(skeletonSectionRule).toContain(
      '--rail-skeleton-card-background: var(--lego-surface-default);',
    );
    expect(skeletonSectionRule).toContain(
      '--rail-skeleton-card-border: var(--lego-border-subtle);',
    );
    expect(skeletonSectionRule).toContain(
      '--rail-skeleton-card-min-block-size: clamp(27rem, 58vw, 31.25rem);',
    );
    expect(inverseSkeletonSectionRule).toContain(
      '--rail-skeleton-card-background: color-mix(',
    );
    expect(inverseSkeletonSectionRule).toContain(
      '--rail-skeleton-card-border: color-mix(',
    );
    expect(skeletonCardRule).toContain(
      'background: var(--rail-skeleton-card-background);',
    );
    expect(skeletonCardRule).toContain(
      'border: var(--lego-border-width-1) solid var(--rail-skeleton-card-border);',
    );
    expect(skeletonCardRule).toContain(
      'min-block-size: var(--rail-skeleton-card-min-block-size);',
    );
    expect(skeletonCardRule).toContain(
      '--catalog-rail-skeleton-title-slot: 2.35rem;',
    );
    expect(skeletonCardRule).toContain(
      '--catalog-rail-skeleton-price-slot: 1.75rem;',
    );
    expect(skeletonCardRule).toContain('align-self: stretch;');
    expect(skeletonCardRule).toContain('block-size: 100%;');
    expect(skeletonCardRule).toContain('box-sizing: border-box;');
    expect(skeletonCardRule).toContain('inline-size: 100%;');
    expect(skeletonCardRule).toContain('max-inline-size: 100%;');
    expect(skeletonCardRule).toContain('min-inline-size: 0;');
    expect(skeletonCardRule).toContain('overflow: hidden;');
    expect(skeletonCardRule).toContain('scroll-snap-align: start;');
    expect(skeletonTrackRule).toContain('align-items: stretch;');
    expect(skeletonTrackRule).toContain('grid-auto-flow: column;');
    expect(skeletonTrackRule).toContain(
      'grid-auto-columns: calc(\n      (100% - (var(--catalog-rail-card-gap) * 0.35)) / 1.5\n    );',
    );
    expect(skeletonTrackRule).toContain('overflow-x: auto;');
    expect(skeletonTrackRule).toContain('overflow-y: hidden;');
    expect(skeletonTrackRule).toContain('scroll-snap-type: x proximity;');
    expect(skeletonTrackRule).not.toContain('grid-auto-columns: 100%;');
    expect(skeletonTrackRule).not.toContain('overflow: hidden;');
    expect(skeletonImageRule).toContain('aspect-ratio: 1 / 1;');
    expect(skeletonImageRule).toContain('inline-size: 100%;');
    expect(skeletonImageRule).toContain('max-block-size: 15.5rem;');
    expect(skeletonImageRule).toContain('max-inline-size: 100%;');
    expect(skeletonImageRule).not.toContain('block-size: clamp(');
    expect(skeletonImageRule).toContain('overflow: hidden;');
    expect(loadedRailCardRule).toContain('min-width: 0;');
  });

  it('keeps inverse skeleton rails on the inverse section treatment', () => {
    act(() => {
      root.render(
        <CatalogSetCardRailSkeletonSection
          ariaLabel="Donkere rail laden"
          itemCount={2}
          title="Donkere rail"
          tone="inverse"
        />,
      );
    });

    expect(
      container.querySelector('[class*="sectionShellInverse"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="sectionShellDefault"]'),
    ).toBeNull();
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

  it('does not show set numbers on no-price rail set cards', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Populaire sets"
          items={[
            {
              actions: <button aria-label="Volg set" type="button" />,
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
          ]}
          variant="featured"
        />,
      );
    });

    expect(container.textContent).toContain('Rivendell');
    expect(container.textContent).toContain('Prijs volgt');
    expect(container.textContent).not.toContain('10316');
  });

  it('does not show set numbers on priced rail set cards', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Deals"
          items={[
            {
              actions: <button aria-label="Volg set" type="button" />,
              ctaMode: 'commerce',
              href: '/sets/rivendell-10316',
              id: '10316',
              priceContext: {
                coverageLabel: '2 actuele winkels',
                currentPrice: 'Vanaf € 489,99',
                merchantLabel: 'Laagst bij bol',
                pricePositionLabel: '€ 10 onder LEGO',
                pricePositionTone: 'positive',
                reviewedLabel: 'Vandaag bekeken',
              },
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
          ]}
          variant="featured"
        />,
      );
    });

    expect(container.textContent).toContain('€ 489,99');
    expect(container.textContent).not.toContain('Vanaf € 489,99');
    expect(container.querySelector('[aria-label="Bekijk set"]')).not.toBeNull();
    expect(container.textContent).not.toContain('10316');
  });

  it('does not run rail metrics again from image load events', () => {
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
    railClientWidthReadCount = 0;
    railScrollWidthReadCount = 0;
    railScrollLeftReadCount = 0;

    act(() => {
      firstImage?.dispatchEvent(new Event('load'));
    });

    expect(scrollbar?.dataset.visible).toBe('false');
    expect(railClientWidthReadCount).toBe(0);
    expect(railScrollWidthReadCount).toBe(0);
    expect(railScrollLeftReadCount).toBe(0);
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
    expect(css).toContain('--rail-card-border: transparent;');
    expect(css).toContain('--rail-card-border-hover: transparent;');
    expect(css).toContain(
      '--rail-scrollbar-thumb-hover: color-mix(\n      in srgb,\n      var(--article-theme-surface-text, currentColor) 48%,',
    );
    expect(css).toContain('background: var(--rail-scrollbar-track);');
    expect(css).toContain('background: var(--rail-scrollbar-thumb);');
    expect(css).toContain('background: var(--rail-scrollbar-thumb-hover);');
    expect(css).toContain('.setCardRailSectionThemed .setCard');
    expect(css).toContain('.setCardRailSectionThemed .setCardLink');
    expect(css).toContain('--catalog-card-hover-border-color: transparent;');
    expect(css).toContain('--catalog-card-hover-outline-color: transparent;');
    expect(css).toContain('color: var(--lego-text);');
    expect(css).toContain(
      '--lego-text-muted: var(--catalog-card-muted-text, #5d677c);',
    );
  });

  it('keeps neutral rail card borders and removes them only on rich rail backgrounds', () => {
    act(() => {
      root.render(
        <>
          <CatalogSetCardRailSection
            ariaLabel="White rail"
            items={[
              {
                id: '10316',
                setSummary: {
                  id: '10316',
                  slug: 'rivendell-10316',
                  name: 'Rivendell',
                  theme: 'Icons',
                  releaseYear: 2023,
                  pieces: 6181,
                  imageUrl: 'https://images.example/rivendell.jpg',
                },
              },
            ]}
            title="White rail"
            tone="default"
            variant="compact"
          />
          <CatalogSetCardRailSection
            ariaLabel="Muted rail"
            items={[
              {
                id: '21060',
                setSummary: {
                  id: '21060',
                  slug: 'himeji-castle-21060',
                  name: 'Himeji Castle',
                  theme: 'Architecture',
                  releaseYear: 2023,
                  pieces: 2125,
                  imageUrl: 'https://images.example/himeji.jpg',
                },
              },
            ]}
            title="Muted rail"
            tone="muted"
            variant="compact"
          />
          <CatalogSetCardRailSection
            ariaLabel="Inverse rail"
            items={[
              {
                id: '75313',
                setSummary: {
                  id: '75313',
                  slug: 'at-at-75313',
                  name: 'AT-AT',
                  theme: 'Star Wars',
                  releaseYear: 2021,
                  pieces: 6785,
                  imageUrl: 'https://images.example/atat.jpg',
                },
              },
            ]}
            title="Inverse rail"
            tone="inverse"
            variant="compact"
          />
          <CatalogSetCardRailSection
            ariaLabel="Themed rail"
            items={[
              {
                id: '10305',
                setSummary: {
                  id: '10305',
                  slug: 'lion-knights-castle-10305',
                  name: "Lion Knights' Castle",
                  theme: 'Icons',
                  releaseYear: 2022,
                  pieces: 4514,
                  imageUrl: 'https://images.example/castle.jpg',
                },
              },
            ]}
            surfaceVariant="themed"
            title="Themed rail"
            variant="compact"
          />
        </>,
      );
    });

    expect(
      container.querySelector('[class*="sectionShellDefault"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="sectionShellMuted"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="sectionShellInverse"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('[class*="setCardRailTrack"]').length,
    ).toBe(4);

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const themePageCss = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-theme-page/src/lib/catalog-feature-theme-page.module.css',
      ),
      'utf-8',
    );
    const themePageSource = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-theme-page/src/lib/catalog-feature-theme-page.tsx',
      ),
      'utf-8',
    );
    const railCardRule =
      css.match(/\.setCardRailTrack > \.setCard \{[^}]+\}/u)?.[0] ?? '';
    const themedRailCardRule =
      css.match(/\.setCardRailSectionThemed \.setCard \{[^}]+\}/u)?.[0] ?? '';
    const inverseRailCardRule =
      css.match(
        /\.sectionShellInverse \.setCardRailTrack > \.setCard \{[^}]+\}/u,
      )?.[0] ?? '';
    const railHoverRule =
      css.match(/\n    \.setCard:hover \{[^}]+\}/u)?.[0] ?? '';
    const focusRule =
      css.match(/\n  \.setCard:focus-within \{[^}]+\}/u)?.[0] ?? '';

    expect(railCardRule).not.toContain('--rail-card-border: transparent;');
    expect(railCardRule).not.toContain(
      '--catalog-card-hover-border-color: transparent;',
    );
    expect(css).toContain('--rail-card-border: var(--lego-border-subtle);');
    expect(css).toContain('.sectionShellMuted');
    expect(themedRailCardRule).toContain('--rail-card-border: transparent;');
    expect(themedRailCardRule).toContain(
      '--catalog-card-hover-border-color: transparent;',
    );
    expect(themedRailCardRule).toContain(
      '--catalog-card-hover-outline-color: transparent;',
    );
    expect(inverseRailCardRule).toContain('--rail-card-border: transparent;');
    expect(inverseRailCardRule).toContain(
      '--catalog-card-hover-border-color: transparent;',
    );
    expect(inverseRailCardRule).toContain(
      '--catalog-card-hover-outline-color: transparent;',
    );
    expect(railCardRule).toContain('scroll-snap-align: start;');
    expect(themedRailCardRule).toContain(
      '--catalog-card-interaction-border-color: color-mix(',
    );
    expect(inverseRailCardRule).toContain(
      '--catalog-card-interaction-outline-color: color-mix(',
    );
    expect(railHoverRule).toContain(
      'border-color: var(--catalog-card-hover-border-color);',
    );
    expect(railHoverRule).toContain(
      'box-shadow: inset 0 0 0 1px var(--catalog-card-hover-outline-color);',
    );
    expect(focusRule).toContain(
      'border-color: var(--catalog-card-interaction-border-color);',
    );
    expect(themePageCss).toContain('.dealSection');
    expect(themePageSource).toContain('className={styles.dealSection}');
    expect(themePageSource).not.toContain('surfaceVariant="themed"');
    expect(themePageSource).toContain('tone="default"');
    expect(themePageSource).toContain('<CatalogSetCardRailSection');
  });

  it('keeps rail card link, content, and CTA row contained inside the card shell', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Nu te vergelijken"
          items={[
            {
              actions: <button type="button">Volg set</button>,
              href: '/sets/rivendell-10316',
              id: '10316',
              priceContext: {
                coverageLabel: 'Actuele prijs gevonden',
                currentPrice: 'Vanaf € 489,99',
                merchantLabel: 'Laagst bij Brickshop',
                reviewedLabel: 'Nagekeken 29 mrt',
              },
              setSummary: {
                id: '10316',
                slug: 'rivendell-10316',
                name: 'Rivendell',
                theme: 'Icons',
                releaseYear: 2023,
                pieces: 6181,
                imageUrl: 'https://images.example/rivendell.jpg',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    const railCard = container.querySelector(
      '[data-catalog-set-card="true"]',
    ) as HTMLElement | null;
    const cardLink = container.querySelector(
      '[data-catalog-set-card-link="true"]',
    ) as HTMLElement | null;

    expect(railCard).not.toBeNull();
    expect(cardLink).not.toBeNull();
    expect(container.innerHTML).toContain('cardCompactFooterActions');
    expect(container.innerHTML).toContain('Bekijk set');
    expect(container.textContent).not.toContain('Set 10316');

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railCardRule =
      css.match(/\.setCardRailTrack > \.setCard \{[^}]+\}/u)?.[0] ?? '';
    const railLinkRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact > \.setCardLink \{[^}]+\}/u,
      )?.[0] ?? '';
    const railCardShellRule =
      css.match(/\.setCardCollectionRail > \.setCardCompact \{[^}]+\}/u)?.[0] ??
      '';
    const railDecisionRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact > \.cardCompactDecisionZone \{[^}]+\}/u,
      )?.[0] ?? '';
    const railFooterRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.cardCompactFooterActions \{[^}]+\}/u,
      )?.[0] ?? '';
    const railPrimaryActionRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.cardCompactPrimaryAction \{[^}]+\}/u,
      )?.[0] ?? '';
    const railSecondaryActionRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.cardCompactSecondaryAction \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(railCardRule).toContain('inline-size: 100%;');
    expect(railCardRule).toContain('max-inline-size: 100%;');
    expect(railCardRule).toContain('overflow: hidden;');
    expect(railCardRule).toContain('align-self: stretch;');
    expect(railCardRule).toContain('block-size: 100%;');
    expect(railCardShellRule).toContain('--catalog-rail-card-facts-slot');
    expect(railCardShellRule).toContain('--catalog-rail-card-title-slot');
    expect(railCardShellRule).toContain('--catalog-rail-card-price-slot');
    expect(railCardShellRule).toContain('--catalog-rail-card-merchant-slot');
    expect(railCardShellRule).toContain('block-size: 100%;');
    expect(railCardShellRule).toContain(
      'grid-template-rows: minmax(0, 1fr) auto;',
    );
    expect(railLinkRule).toContain('inline-size: 100%;');
    expect(railLinkRule).toContain('max-inline-size: 100%;');
    expect(railLinkRule).toContain('align-content: start;');
    expect(railDecisionRule).toContain('inline-size: 100%;');
    expect(railDecisionRule).toContain('align-self: end;');
    expect(railDecisionRule).toContain('overflow: hidden;');
    expect(railFooterRule).toContain('inline-size: 100%;');
    expect(railFooterRule).toContain('overflow: hidden;');
    expect(railPrimaryActionRule).toContain('flex: 0 1 auto;');
    expect(railPrimaryActionRule).toContain('overflow: hidden;');
    expect(railSecondaryActionRule).toContain(
      'flex: 0 0 var(--catalog-card-action-height);',
    );
  });

  it('keeps default rail image slots stable without optimized containment', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railTrackRule =
      css.match(/\n  \.setCardRailTrack \{[^}]+\}/u)?.[0] ?? '';
    const skeletonTrackRule =
      css.match(/\n  \.setCardRailSkeletonTrack \{[^}]+\}/u)?.[0] ?? '';
    const railCardShellRule =
      css.match(/\.setCardCollectionRail > \.setCardCompact \{[^}]+\}/u)?.[0] ??
      '';
    const stableRailCardShellRule =
      css.match(
        /\.setCardRailStableSquare \.setCardCollectionRail > \.setCardCompact \{[^}]+\}/u,
      )?.[0] ?? '';
    const railVisualRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact > \.setCardLink > \.setVisual \{[^}]+\}/u,
      )?.[0] ?? '';
    const stableRailVisualRule =
      css.match(
        /\.setCardRailStableSquare\s+\.setCardCollectionRail\s+> \.setCardCompact\s+> \.setCardLink\s+> \.setVisual \{[^}]+\}/u,
      )?.[0] ?? '';
    const railVisualMediaRule =
      css.match(
        /\.setCardCollectionRail\s+> \.setCardCompact\s+> \.setCardLink\s+> \.setVisual\s+> \.visualMedia \{[^}]+\}/u,
      )?.[0] ?? '';
    const stableRailVisualMediaRule =
      css.match(
        /\.setCardRailStableSquare\s+\.setCardCollectionRail\s+> \.setCardCompact\s+> \.setCardLink\s+> \.setVisual\s+> \.visualMedia \{[^}]+\}/u,
      )?.[0] ?? '';
    const stableRailImageRule =
      css.match(
        /\.setCardRailStableSquare\s+\.setCardCollectionRail\s+> \.setCardCompact\s+> \.setCardLink\s+> \.setVisual\s+\.setImage \{[^}]+\}/u,
      )?.[0] ?? '';
    const baseVisualRule = css.match(/\n  \.cardVisual \{[^}]+\}/u)?.[0] ?? '';
    const baseImageRule = css.match(/\n  \.setImage \{[^}]+\}/u)?.[0] ?? '';

    expect(css).not.toContain('--set-card-rail-card-width');
    expect(css).not.toContain('--set-card-rail-image-size');
    expect(railCardShellRule).not.toContain(
      'container: catalog-rail-set-card / inline-size;',
    );
    expect(railTrackRule).toContain('grid-auto-columns: calc(');
    expect(railTrackRule).toContain('100% -');
    expect(skeletonTrackRule).toContain('grid-auto-columns: calc(');
    expect(skeletonTrackRule).toContain(
      '(100% - (var(--catalog-rail-card-gap) * 0.35)) / 1.5',
    );
    expect(skeletonTrackRule).toContain('grid-auto-flow: column;');
    expect(skeletonTrackRule).toContain('overflow-x: auto;');
    expect(skeletonTrackRule).not.toContain('grid-auto-columns: 100%;');
    expect(stableRailCardShellRule).toContain(
      'container: catalog-rail-set-card / inline-size;',
    );
    expect(css).toContain('@container catalog-rail-set-card');
    expect(css).toContain(
      'grid-auto-columns: calc((100% - (var(--catalog-rail-card-gap) * 4)) / 5);',
    );
    expect(railVisualRule).toContain('aspect-ratio: 1 / 1;');
    expect(railVisualRule).not.toContain('contain: layout paint;');
    expect(railVisualRule).toContain('inline-size: 100%;');
    expect(railVisualRule).toContain('max-block-size: none;');
    expect(railVisualRule).toContain('min-block-size: 0;');
    expect(railVisualRule).toContain('overflow: hidden;');
    expect(railVisualRule).not.toContain(
      'block-size: var(--set-card-rail-image-size);',
    );
    expect(railVisualMediaRule).toContain('block-size: 100%;');
    expect(railVisualMediaRule).not.toContain('contain: layout paint;');
    expect(railVisualMediaRule).toContain('inline-size: 100%;');
    expect(railVisualMediaRule).toContain('margin-inline: auto;');
    expect(railVisualMediaRule).toContain('overflow: hidden;');
    expect(css).not.toContain(
      '.setCardCollectionRail > .setCardCompact > .setCardLink > .setVisual .setImage',
    );
    expect(stableRailVisualRule).toContain('contain: layout paint;');
    expect(stableRailVisualMediaRule).toContain('contain: layout paint;');
    expect(stableRailImageRule).toContain('block-size: auto;');
    expect(stableRailImageRule).toContain('inline-size: auto;');
    expect(stableRailImageRule).toContain('max-block-size: 100%;');
    expect(stableRailImageRule).toContain('max-inline-size: 100%;');
    expect(baseVisualRule).toContain('aspect-ratio: 1 / 1.02;');
    expect(baseVisualRule).not.toContain(
      'block-size: var(--set-card-rail-image-size);',
    );
    expect(baseImageRule).toContain('height: 100%;');
    expect(baseImageRule).toContain('width: 100%;');
    expect(baseImageRule).toContain('object-fit: contain;');
  });

  it('aligns mobile rail cards with internal slots instead of fixed card height', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railTrackRule =
      css.match(/\n  \.setCardRailTrack \{[^}]+\}/u)?.[0] ?? '';
    const railCardRule =
      css.match(/\.setCardRailTrack > \.setCard \{[^}]+\}/u)?.[0] ?? '';
    const railCardShellRule =
      css.match(/\.setCardCollectionRail > \.setCardCompact \{[^}]+\}/u)?.[0] ??
      '';
    const railLinkRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact > \.setCardLink \{[^}]+\}/u,
      )?.[0] ?? '';
    const railBodyRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.cardCompactBody \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(railTrackRule).toContain('align-items: stretch;');
    expect(railCardRule).toContain('block-size: 100%;');
    expect(railCardShellRule).toContain('block-size: 100%;');
    expect(railLinkRule).toContain('block-size: 100%;');
    expect(railBodyRule).toContain('--catalog-rail-card-facts-slot');
    expect(railBodyRule).toContain('--catalog-rail-card-title-slot');
    expect(railBodyRule).toContain('--catalog-rail-card-price-slot');
    expect(railBodyRule).toContain('--catalog-rail-card-context-slot');
    expect(railBodyRule).toContain('grid-template-rows:');
    expect(railCardShellRule).not.toContain('height: 30rem;');
    expect(railCardShellRule).not.toContain('min-height: 30rem;');
  });

  it('uses rail-only calm title and larger price typography without changing browse grids', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railTitleRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.cardTitle \{[^}]+\}/u,
      )?.[0] ?? '';
    const railPriceRule =
      [
        ...css.matchAll(
          /\.setCardCollectionRail > \.setCardCompact \.featuredPriceValue,[\s\S]+?\.setCardCollectionRail > \.setCardCompact \.cardCompactBrowsePriceValue \{[^}]+\}/gu,
        ),
      ]
        .map((match) => match[0])
        .find((rule) => rule.includes('font-size: 1.5rem;')) ?? '';
    const browsePriceRule =
      css.match(/\.cardCompactBrowsePriceValue \{[^}]+\}/u)?.[0] ?? '';
    const subgridStart = css.indexOf('@supports (grid-template-rows: subgrid)');
    const subgridBlock = css.slice(
      subgridStart,
      css.indexOf('.themeCard', subgridStart),
    );

    expect(railTitleRule).toContain('font-size: 1rem;');
    expect(railTitleRule).toContain('line-height: 1.16;');
    expect(railPriceRule).toContain('font-size: 1.5rem;');
    expect(railPriceRule).toContain('line-height: 1.08;');
    expect(browsePriceRule).toContain('font-size: 1.04rem;');
    expect(subgridBlock).toContain(
      '.setCardCollectionBrowse.setCardCollectionFeatured',
    );
    expect(subgridBlock).not.toContain(
      '.setCardCollectionFeatured > .setCardCompact > .setCardLink',
    );
  });

  it('renders priced and no-price rail card content with fixed internal rail slots', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Vergelijkbare LEGO sets"
          items={[
            {
              actions: <button type="button">Volg set</button>,
              href: '/sets/rivendell-10316',
              id: '10316',
              priceContext: {
                coverageLabel: 'Actuele prijs gevonden',
                currentPrice: 'Vanaf € 489,99',
                discountMetric: '€ 35 goedkoper',
                merchantLabel: 'Laagst bij Brickshop',
                reviewedLabel: 'Nagekeken 29 mrt',
              },
              setSummary: {
                id: '10316',
                slug: 'rivendell-10316',
                name: 'Rivendell met een behoorlijk lange titel',
                theme: 'Icons',
                releaseYear: 2023,
                pieces: 6181,
                imageUrl: 'https://images.example/rivendell.jpg',
              },
            },
            {
              actions: <button type="button">Volg set</button>,
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

    expect(container.innerHTML).toContain('Vanaf € 489,99');
    expect(container.innerHTML).toContain('Prijs volgt');
    expect(
      container.querySelectorAll('[class*="cardCompactDecisionZone"]'),
    ).toHaveLength(2);
    expect(container.textContent).not.toContain('Set 10316');
    expect(container.textContent).not.toContain('Set 76269');

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railContextRule =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact \.discountMetric,[\s\S]+?\.setCardCollectionRail > \.setCardCompact \.cardCompactSupporting \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(css).toContain('--catalog-rail-card-title-slot');
    expect(css).toContain('--catalog-rail-card-price-slot');
    expect(css).toContain('--catalog-rail-card-merchant-slot');
    expect(railContextRule).toContain('min-width: 0;');
  });

  it('keeps native rail panning available while custom touch drag stays vertical-safe', () => {
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
    expect(css).toContain('touch-action: auto;');
    expect(css).not.toContain('touch-action: pan-y;');
    expect(css).not.toContain('touch-action: pan-x;');
  });

  it('keeps rail metric work simple and free of resize observer loops', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/ui/src/lib/catalog-set-card-rail.tsx',
      ),
      'utf-8',
    );

    expect(source).toContain(
      "measuredRailElement.addEventListener('scroll', flushRailMetrics",
    );
    expect(source).not.toContain('new ResizeObserver');
    expect(source).not.toContain('new MutationObserver');
    expect(source).not.toContain('resizeObserver?.observe');
    expect(source).not.toContain("window.addEventListener('resize'");
    expect(source).not.toContain("window.addEventListener('load'");
    expect(source).not.toContain(
      'Array.from(railElement.children).forEach((child)',
    );
    expect(source).toContain(
      'areRailMetricsEqual(currentMetrics, nextMetrics)',
    );
    expect(source).toContain('const CatalogSetCardRailItems = memo');
    expect(source).toContain('<CatalogSetCardRailItems');
    expect(source).not.toContain('subtree: true');
  });

  it('keeps default detail-style rails off ResizeObserver and image mutation loops', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Meer uit dit thema"
          items={[
            {
              href: '/sets/golden-retriever-puppy-11384',
              id: '11384',
              setSummary: {
                id: '11384',
                slug: 'golden-retriever-puppy-11384',
                name: 'Golden Retriever Puppy',
                theme: 'Creator',
                releaseYear: 2025,
                pieces: 476,
                imageUrl: 'https://images.example/golden-retriever.jpg',
              },
            },
            {
              href: '/sets/playful-cat-31163',
              id: '31163',
              setSummary: {
                id: '31163',
                slug: 'playful-cat-31163',
                name: 'Playful Cat',
                theme: 'Creator',
                releaseYear: 2025,
                pieces: 407,
                imageUrl: 'https://images.example/playful-cat.jpg',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    expect(resizeObserverCallback).toBeNull();
    expect(
      container.querySelector('[data-rail-layout-mode="stable-square"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('Golden Retriever Puppy');
    expect(container.innerHTML).toContain('cardCompactFooterActions');
  });

  it('uses the stable-square layout by default and allows an explicit default opt-out', () => {
    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Nu te vergelijken"
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
                pieces: 6181,
                imageUrl: 'https://images.example/rivendell.jpg',
              },
            },
          ]}
          variant="featured"
        />,
      );
    });

    expect(
      container.querySelector('[data-rail-layout-mode="stable-square"]'),
    ).not.toBeNull();

    act(() => {
      root.render(
        <CatalogSetCardRail
          ariaLabel="Meer uit dit thema"
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
                pieces: 6181,
                imageUrl: 'https://images.example/rivendell.jpg',
              },
            },
          ]}
          railLayoutMode="default"
          variant="featured"
        />,
      );
    });

    expect(container.querySelector('[data-rail-layout-mode]')).toBeNull();
  });

  it('keeps rails off resize, mutation, and image-load observer loops', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/ui/src/lib/catalog-set-card-rail.tsx',
      ),
      'utf-8',
    );

    expect(source).toContain(
      "measuredRailElement.addEventListener('scroll', flushRailMetrics",
    );
    expect(source).not.toContain('new ResizeObserver');
    expect(source).not.toContain('new MutationObserver');
    expect(source).not.toContain("window.addEventListener('resize'");
    expect(source).not.toContain("window.addEventListener('load'");
    expect(source).not.toContain("image.addEventListener('load'");
    expect(source).not.toContain("image.addEventListener('error'");
    expect(source).not.toContain('queueRailMetricsSettledResize');
    expect(source).not.toContain(
      "railElement.addEventListener('scroll', queueRailMetricsSettledResize",
    );
  });
});
