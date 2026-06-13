/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImageCarousel,
  ImageGallery,
  type CarouselImage,
} from './image-carousel';
import {
  clampImageZoomTransform,
  getImageZoomContentPointForFocalPoint,
  stepImageZoomMomentum,
  zoomImageTransformAroundContentPoint,
  zoomImageTransformAroundFocalPoint,
} from './image-zoom-gestures';

vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    quality,
    src,
  }: {
    alt: string;
    className?: string;
    quality?: number;
    src: string;
  }) => (
    <img alt={alt} className={className} data-quality={quality} src={src} />
  ),
}));

function dispatchPointerEvent(
  element: Element | null,
  type: string,
  options: {
    button?: number;
    buttons?: number;
    clientX: number;
    clientY: number;
    isPrimary?: boolean;
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
    button: options.button ?? 0,
    buttons:
      options.buttons ??
      (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
    clientX: options.clientX,
    clientY: options.clientY,
    isPrimary: options.isPrimary ?? true,
    pointerId: options.pointerId ?? 1,
    pointerType: options.pointerType ?? 'touch',
  });

  element.dispatchEvent(event);

  return event;
}

function mockPointerCapture(element: Element | null) {
  const capturedPointerIds = new Set<number>();
  const setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointerIds.add(pointerId);
  });
  const releasePointerCapture = vi.fn((pointerId: number) => {
    capturedPointerIds.delete(pointerId);
  });
  const hasPointerCapture = vi.fn((pointerId: number) =>
    capturedPointerIds.has(pointerId),
  );

  if (element) {
    Object.defineProperties(element, {
      hasPointerCapture: {
        configurable: true,
        value: hasPointerCapture,
      },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
      setPointerCapture: {
        configurable: true,
        value: setPointerCapture,
      },
    });
  }

  return {
    hasPointerCapture,
    releasePointerCapture,
    setPointerCapture,
  };
}

function mockElementRect(
  element: Element | null,
  {
    height,
    left = 0,
    top = 0,
    width,
  }: {
    height: number;
    left?: number;
    top?: number;
    width: number;
  },
) {
  if (!element) {
    return;
  }

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: top + height,
      height,
      left,
      right: left + width,
      toJSON: () => undefined,
      top,
      width,
      x: left,
      y: top,
    }),
  });
}

describe('ImageGallery', () => {
  let container: HTMLDivElement;
  let root: Root;

  describe('image zoom gesture helpers', () => {
    it('zooms around a focal point instead of the image center', () => {
      const transform = zoomImageTransformAroundFocalPoint({
        currentTransform: {
          scale: 1,
          translateX: 0,
          translateY: 0,
        },
        focalPoint: {
          x: -150,
          y: -100,
        },
        targetScale: 2.5,
        transformOptions: {
          maxScale: 3,
          minScale: 1,
          viewport: {
            height: 300,
            width: 400,
          },
        },
      });

      expect(transform).toEqual({
        scale: 2.5,
        translateX: 225,
        translateY: 150,
      });
    });

    it('keeps the pinch midpoint stable under the fingers', () => {
      const initialTransform = {
        scale: 1.5,
        translateX: 20,
        translateY: -10,
      };
      const contentPoint = getImageZoomContentPointForFocalPoint({
        focalPoint: {
          x: 80,
          y: 20,
        },
        transform: initialTransform,
      });
      const nextTransform = zoomImageTransformAroundContentPoint({
        contentPoint,
        focalPoint: {
          x: 100,
          y: 40,
        },
        targetScale: 2.4,
        transformOptions: {
          maxScale: 3,
          minScale: 1,
          viewport: {
            height: 300,
            width: 400,
          },
        },
      });

      expect(contentPoint).toEqual({
        x: 40,
        y: 20,
      });
      expect(
        nextTransform.translateX + contentPoint.x * nextTransform.scale,
      ).toBeCloseTo(100);
      expect(
        nextTransform.translateY + contentPoint.y * nextTransform.scale,
      ).toBeCloseTo(40);
    });

    it('clamps pan so the zoomed image cannot be dragged fully out of view', () => {
      expect(
        clampImageZoomTransform(
          {
            scale: 2,
            translateX: 1000,
            translateY: -1000,
          },
          {
            maxScale: 3,
            minScale: 1,
            viewport: {
              height: 200,
              width: 300,
            },
          },
        ),
      ).toEqual({
        scale: 2,
        translateX: 150,
        translateY: -100,
      });

      expect(
        clampImageZoomTransform(
          {
            scale: 1,
            translateX: 80,
            translateY: 40,
          },
          {
            maxScale: 3,
            minScale: 1,
            viewport: {
              height: 200,
              width: 300,
            },
          },
        ),
      ).toEqual({
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
    });

    it('applies momentum with friction and stops at bounds', () => {
      const momentumStep = stepImageZoomMomentum({
        elapsedMs: 1000 / 60,
        friction: 0.92,
        minVelocity: 0.01,
        transform: {
          scale: 2,
          translateX: 0,
          translateY: 0,
        },
        transformOptions: {
          maxScale: 3,
          minScale: 1,
          viewport: {
            height: 300,
            width: 400,
          },
        },
        velocity: {
          x: 1,
          y: 0,
        },
      });

      expect(momentumStep.transform.translateX).toBeCloseTo(1000 / 60);
      expect(momentumStep.velocity.x).toBeCloseTo(0.92);
      expect(momentumStep.shouldContinue).toBe(true);

      const boundedStep = stepImageZoomMomentum({
        elapsedMs: 1000 / 60,
        friction: 0.92,
        minVelocity: 0.01,
        transform: {
          scale: 2,
          translateX: 200,
          translateY: 0,
        },
        transformOptions: {
          maxScale: 3,
          minScale: 1,
          viewport: {
            height: 300,
            width: 400,
          },
        },
        velocity: {
          x: 1,
          y: 0,
        },
      });

      expect(boundedStep.transform.translateX).toBe(200);
      expect(boundedStep.velocity.x).toBe(0);
      expect(boundedStep.shouldContinue).toBe(false);
    });
  });

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function flushAnimationFrame() {
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }

  async function finishLightboxClose() {
    const backdrop = document.body.querySelector(
      '[data-lightbox-backdrop="true"]',
    ) as HTMLDivElement | null;
    const dialog = document.body.querySelector(
      '[role="dialog"]',
    ) as HTMLDivElement | null;

    expect(backdrop?.getAttribute('data-lightbox-state')).toBe('closing');
    expect(dialog?.getAttribute('data-lightbox-state')).toBe('closing');

    act(() => {
      dialog?.dispatchEvent(
        new Event('transitionend', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await flushAnimationFrame();
  }

  function renderOverviewButtons(images: readonly CarouselImage[]) {
    act(() => {
      root.render(<ImageGallery images={images} variant="detail" />);
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    return Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '[data-lightbox-grid-index]',
      ),
    );
  }

  function getOverviewLayoutVariants(
    images: readonly CarouselImage[],
  ): string[] {
    return renderOverviewButtons(images).map(
      (button) => button.getAttribute('data-lightbox-layout-variant') ?? '',
    );
  }

  function createOverviewPatternImages(
    count: number,
  ): readonly CarouselImage[] {
    return Array.from({ length: count }, (_, index) => ({
      alt: `Productbeeld ${index + 1}`,
      aspectRatio: 1,
      mediaRole: 'product',
      src: `https://images.example/product-${index + 1}.jpg`,
    }));
  }

  function expectNoSingleStandardBeforeFullWidthOrEnd(
    layoutVariants: readonly string[],
  ) {
    let standardRunLength = 0;

    for (const layoutVariant of layoutVariants) {
      if (layoutVariant === 'standard') {
        standardRunLength += 1;
        continue;
      }

      expect(standardRunLength).not.toBe(1);
      standardRunLength = 0;
    }

    expect(standardRunLength).not.toBe(1);
  }

  it('renders one article image without lightbox navigation until opened', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
              src: '/articles/star-wars-day-2026/grogu.jpg',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(
      container.querySelector(
        'button[aria-label^="Open LEGO Star Wars Grogu als leerling van de Mandalorian"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Vorige afbeelding"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain('1 / 1');
  });

  it('can make only the detail hero media full-bleed on mobile', () => {
    act(() => {
      root.render(
        <ImageGallery
          detailMobileFullBleed
          images={[
            {
              alt: 'LEGO Harry Potter Hogwarts Castle The Main Tower',
              src: '/sets/hogwarts-main-tower.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const gallery = container.querySelector(
      '[data-detail-mobile-full-bleed="true"]',
    );

    expect(gallery).not.toBeNull();
    expect(
      gallery?.querySelector('[data-has-multiple-images="false"]'),
    ).not.toBeNull();
    expect(gallery?.querySelector('[class*="detailThumbRow"]')).toBeNull();

    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );
    const mobileBleedRule =
      css.match(
        /\.root\[data-detail-mobile-full-bleed='true'\] \.detailMainButton \{[^}]+\}/u,
      )?.[0] ?? '';
    const mobileFrameRule =
      css.match(
        /\.root\[data-detail-mobile-full-bleed='true'\] \.detailMainFrame \{[^}]+\}/u,
      )?.[0] ?? '';
    const mobileFocusRule =
      css.match(
        /\.root\[data-detail-mobile-full-bleed='true'\]\s+\.detailMainButton:focus-visible \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(mobileBleedRule).toContain('margin-inline: calc(50% - 50vw);');
    expect(mobileBleedRule).toContain('width: 100vw;');
    expect(mobileBleedRule).toContain('max-width: none;');
    expect(mobileFrameRule).toContain('border: 0;');
    expect(mobileFrameRule).toContain(
      'border-block-end: var(--lego-border-width-1) solid',
    );
    expect(mobileFrameRule).toContain('var(--lego-border-subtle);');
    expect(mobileFrameRule).toContain('border-radius: 0;');
    expect(mobileFocusRule).toContain(
      'box-shadow: inset 0 0 0 4px var(--lego-focus-ring);',
    );
  });

  it('uses high quality for set detail and lightbox images while keeping thumbnails lean', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Icons Vespa 125 hoofdbeeld',
              largeSrc: '/images/sets/10298/large/0.webp',
              src: '/images/sets/10298/hero.webp',
              thumbnailSrc: '/images/sets/10298/thumbs/hero.webp',
            },
            {
              alt: 'LEGO Icons Vespa 125 stuurdetail',
              src: '/images/sets/10298/gallery/detail.webp',
              thumbnailSrc: '/images/sets/10298/thumbs/detail.webp',
            },
          ]}
          variant="detail"
        />,
      );
    });

    expect(
      Array.from(
        container.querySelectorAll<HTMLImageElement>(
          '[class*="galleryImageDetail"]',
        ),
      ).some((image) => image.getAttribute('data-quality') === '90'),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLImageElement>('[class*="detailMainFrame"] img')
        ?.getAttribute('src'),
    ).toBe('/images/sets/10298/large/0.webp');

    expect(
      Array.from(
        container.querySelectorAll<HTMLImageElement>(
          '[class*="galleryImageThumbnail"]',
        ),
      ).every((image) => !image.hasAttribute('data-quality')),
    ).toBe(true);

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      Array.from(
        document.body.querySelectorAll<HTMLImageElement>(
          '[data-lightbox-media-surface="light"] [class*="galleryImageDetail"]',
        ),
      ).some((image) => image.getAttribute('data-quality') === '90'),
    ).toBe(true);
    expect(
      document.body
        .querySelector<HTMLImageElement>(
          '[data-lightbox-media-surface="light"] [class*="galleryImageDetail"]',
        )
        ?.getAttribute('src'),
    ).toBe('/images/sets/10298/large/0.webp');
  });

  it('renders an article grid and opens a fullscreen viewer with controls for multiple images', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
              src: '/articles/star-wars-day-2026/grogu.jpg',
            },
            {
              alt: 'LEGO Star Wars The Razor Crest',
              src: '/articles/star-wars-day-2026/razor-crest.png',
            },
            {
              alt: 'LEGO Star Wars Anzellan Starship',
              src: '/articles/star-wars-day-2026/anzellan-starship.png',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(
      container.querySelector('.articleGrid, [class*="articleGrid"]'),
    ).not.toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(3);
    expect(container.querySelector('[data-count="3"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-gallery-tile-index]'),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll('[data-gallery-zoom-overlay="true"]'),
    ).toHaveLength(3);

    const firstOpenButton = container.querySelector(
      'button[aria-label^="Open LEGO Star Wars Grogu als leerling van de Mandalorian"]',
    ) as HTMLButtonElement | null;
    const secondOpenButton = container.querySelector(
      'button[aria-label^="Open LEGO Star Wars The Razor Crest"]',
    ) as HTMLButtonElement | null;
    const thirdOpenButton = container.querySelector(
      'button[aria-label^="Open LEGO Star Wars Anzellan Starship"]',
    ) as HTMLButtonElement | null;

    act(() => {
      firstOpenButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    const nextButton = document.body.querySelector(
      'button[aria-label="Volgende afbeelding"]',
    ) as HTMLButtonElement | null;
    const dots = document.body.querySelectorAll(
      'button[aria-label^="Bekijk afbeelding"]',
    );

    expect(nextButton).not.toBeNull();
    expect(
      document.body.querySelector('button[aria-label="Sluit galerij"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-control="previous"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-control="next"]'),
    ).not.toBeNull();
    expect(dots).toHaveLength(3);
    expect(
      document.body.querySelectorAll('[class*="lightboxThumbButton"]'),
    ).toHaveLength(3);
    expect(
      document.body.querySelectorAll('[class*="lightboxThumbFrame"] img'),
    ).toHaveLength(3);
    expect(
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('1 / 3');

    act(() => {
      nextButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.textContent).toContain('2 / 3');
    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();

    const previousButton = document.body.querySelector(
      'button[aria-label="Vorige afbeelding"]',
    ) as HTMLButtonElement | null;

    act(() => {
      previousButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.textContent).toContain('1 / 3');
    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();

    const firstThumbnail = document.body.querySelector(
      'button[aria-label="Bekijk afbeelding 1"][data-active="false"]',
    ) as HTMLButtonElement | null;

    act(() => {
      firstThumbnail?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.textContent).toContain('1 / 3');
    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();

    const thirdThumbnail = document.body.querySelector(
      'button[aria-label="Bekijk afbeelding 3"]',
    ) as HTMLButtonElement | null;

    act(() => {
      thirdThumbnail?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.textContent).toContain('3 / 3');
    expect(
      document.body.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector(
        '[data-lightbox-thumb-index="2"][data-active="true"]',
      ),
    ).not.toBeNull();

    const closeButton = document.body.querySelector(
      'button[aria-label="Sluit galerij"]',
    ) as HTMLButtonElement | null;

    act(() => {
      closeButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    act(() => {
      secondOpenButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();

    const secondCloseButton = document.body.querySelector(
      'button[aria-label="Sluit galerij"]',
    ) as HTMLButtonElement | null;

    act(() => {
      secondCloseButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    act(() => {
      thirdOpenButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(
      document.body.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();
  });

  it('keeps article gallery tiles accessible and opens without set_click tracking', () => {
    const gtag = vi.fn();
    (window as unknown as { gtag?: typeof gtag }).gtag = gtag;

    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Star Wars Helmet Collection detail',
              src: '/articles/star-wars/helmet.webp',
            },
          ]}
          variant="article"
        />,
      );
    });

    const imageButton = container.querySelector(
      '[data-gallery-tile-index="0"]',
    ) as HTMLButtonElement | null;

    expect(imageButton).not.toBeNull();
    expect(imageButton?.tagName).toBe('BUTTON');
    expect(imageButton?.getAttribute('type')).toBe('button');
    expect(imageButton?.getAttribute('aria-label')).toBe(
      'Open LEGO Star Wars Helmet Collection detail in volledig scherm',
    );
    expect(
      container.querySelector('[data-gallery-zoom-overlay="true"]'),
    ).not.toBeNull();

    act(() => {
      imageButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(gtag).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();

    delete (window as unknown as { gtag?: typeof gtag }).gtag;
  });

  it('closes the fullscreen viewer with the close button and Escape', async () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
              src: '/articles/star-wars-day-2026/grogu.jpg',
            },
            {
              alt: 'LEGO Star Wars The Razor Crest',
              src: '/articles/star-wars-day-2026/razor-crest.png',
            },
          ]}
          variant="article"
        />,
      );
    });

    const openButton = container.querySelector(
      'button[aria-label^="Open LEGO Star Wars Grogu als leerling van de Mandalorian"]',
    ) as HTMLButtonElement | null;

    act(() => {
      openButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    const closeButton = document.body.querySelector(
      'button[aria-label="Sluit galerij"]',
    ) as HTMLButtonElement | null;

    act(() => {
      closeButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body
        .querySelector('[data-lightbox-backdrop="true"]')
        ?.getAttribute('data-lightbox-state'),
    ).toBe('closing');

    await finishLightboxClose();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      openButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    await finishLightboxClose();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the fullscreen viewer in a portal, locks scroll, traps focus, and restores focus to the trigger', async () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rivendell LEGO-set',
              src: 'https://images.example/rivendell-1.jpg',
            },
            {
              alt: 'Rivendell LEGO-set afbeelding 2',
              src: 'https://images.example/rivendell-2.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const openButton = container.querySelector(
      'button[aria-label^="Open Rivendell LEGO-set"]',
    ) as HTMLButtonElement | null;

    expect(openButton).not.toBeNull();

    act(() => {
      openButton?.focus();
      openButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await flushAnimationFrame();

    const backdrop = document.body.querySelector(
      '[data-lightbox-backdrop="true"]',
    ) as HTMLDivElement | null;
    const dialog = document.body.querySelector(
      '[role="dialog"]',
    ) as HTMLDivElement | null;
    const closeButton = document.body.querySelector(
      'button[aria-label="Sluit galerij"]',
    ) as HTMLButtonElement | null;

    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(backdrop?.getAttribute('data-lightbox-state')).toBe('open');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('data-lightbox-state')).toBe('open');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(closeButton);

    expect(dialog?.getAttribute('data-lightbox-mode')).toBe('overview');
    expect(
      document.body.querySelectorAll('[data-lightbox-grid-index]'),
    ).toHaveLength(2);

    const lastOverviewImage = document.body.querySelector(
      '[data-lightbox-grid-index="1"]',
    ) as HTMLButtonElement | null;

    act(() => {
      lastOverviewImage?.focus();
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
        }),
      );
    });

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Tab',
          shiftKey: true,
        }),
      );
    });

    expect(document.activeElement).toBe(lastOverviewImage);

    act(() => {
      closeButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    await finishLightboxClose();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(openButton);
  });

  it('supports keyboard navigation for the detail gallery and opens fullscreen from the main image', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rivendell LEGO-set',
              src: 'https://images.example/rivendell-1.jpg',
            },
            {
              alt: 'Rivendell LEGO-set afbeelding 2',
              src: 'https://images.example/rivendell-2.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const detailGallery = container.querySelector(
      'section[aria-label="Afbeeldingen"]',
    ) as HTMLElement | null;

    expect(detailGallery).not.toBeNull();

    act(() => {
      detailGallery?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowRight',
        }),
      );
    });

    expect(
      container.querySelector(
        'button[aria-label="Bekijk afbeelding 2"][data-active="true"]',
      ),
    ).not.toBeNull();

    const mainImageButton = container.querySelector(
      'button[aria-label^="Open Rivendell LEGO-set afbeelding 2"]',
    ) as HTMLButtonElement | null;

    act(() => {
      mainImageButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-mode="overview"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelectorAll('[data-lightbox-grid-index]'),
    ).toHaveLength(2);
    expect(
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).toBeNull();

    const secondGridImage = document.body.querySelector(
      '[data-lightbox-grid-index="1"]',
    ) as HTMLButtonElement | null;

    act(() => {
      secondGridImage?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(
      document.body.querySelector('[data-lightbox-mode="viewer"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
  });

  it('shows persistent detail gallery controls and updates the main image without opening the lightbox', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rivendell LEGO-set hoofdbeeld',
              src: 'https://images.example/rivendell-1.jpg',
            },
            {
              alt: 'Rivendell LEGO-set detailbeeld',
              src: 'https://images.example/rivendell-2.jpg',
            },
            {
              alt: 'Rivendell LEGO-set achterzijde',
              src: 'https://images.example/rivendell-3.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    expect(container.textContent).toContain('1/3');
    expect(
      container.querySelector(
        'button[aria-label="Alle afbeeldingen weergeven"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="Alle afbeeldingen weergeven"] svg',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Vorige afbeelding"]',
      )?.disabled,
    ).toBe(true);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Volgende afbeelding"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(container.textContent).toContain('2/3');
    expect(
      container.querySelector(
        'button[aria-label="Bekijk afbeelding 2"][data-active="true"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'button[aria-label^="Open Rivendell LEGO-set detailbeeld"]',
      ),
    ).not.toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Alle afbeeldingen weergeven"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      document.body.querySelector('[data-lightbox-mode="overview"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('Alle afbeeldingen');
  });

  it('renders adjacent images and slides the mobile detail track while dragging', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rivendell LEGO-set hoofdbeeld',
              src: 'https://images.example/rivendell-1.jpg',
            },
            {
              alt: 'Rivendell LEGO-set detailbeeld',
              src: 'https://images.example/rivendell-2.jpg',
            },
            {
              alt: 'Rivendell LEGO-set achterzijde',
              src: 'https://images.example/rivendell-3.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const mainButton = container.querySelector('[class*="detailMainButton"]');
    const swipeTrack = container.querySelector<HTMLElement>(
      '[data-swipe-track="detail"]',
    );

    expect(
      container.querySelector('[data-swipe-slide="next"] img'),
    ).not.toBeNull();

    act(() => {
      dispatchPointerEvent(mainButton, 'pointerdown', {
        clientX: 240,
        clientY: 120,
      });
      const horizontalMoveEvent = dispatchPointerEvent(
        mainButton,
        'pointermove',
        {
          clientX: 156,
          clientY: 124,
        },
      );

      expect(horizontalMoveEvent?.defaultPrevented).toBe(true);
    });

    expect(swipeTrack?.dataset['swipePhase']).toBe('dragging');
    expect(swipeTrack?.style.transform).toContain('-84px');
  });

  it('animates a valid mobile detail swipe before changing the selected image', () => {
    vi.useFakeTimers();
    const animationFrames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Rivendell LEGO-set hoofdbeeld',
                src: 'https://images.example/rivendell-1.jpg',
              },
              {
                alt: 'Rivendell LEGO-set detailbeeld',
                src: 'https://images.example/rivendell-2.jpg',
              },
              {
                alt: 'Rivendell LEGO-set achterzijde',
                src: 'https://images.example/rivendell-3.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      const mainButton = container.querySelector('[class*="detailMainButton"]');

      act(() => {
        dispatchPointerEvent(mainButton, 'pointerdown', {
          clientX: 240,
          clientY: 120,
        });
        dispatchPointerEvent(mainButton, 'pointermove', {
          clientX: 156,
          clientY: 124,
        });
        dispatchPointerEvent(mainButton, 'pointerup', {
          clientX: 150,
          clientY: 124,
        });
      });

      const swipeTrack = container.querySelector<HTMLElement>(
        '[data-swipe-track="detail"]',
      );
      const settledNextImageBeforeCommit =
        container.querySelector<HTMLImageElement>(
          '[data-swipe-track="detail"] [data-swipe-slide="next"] img',
        );

      expect(container.textContent).toContain('1/3');
      expect(swipeTrack?.dataset['swipePhase']).toBe('settling');
      expect(swipeTrack?.dataset['swipeDirection']).toBe('1');
      expect(swipeTrack?.style.transform).toContain('-66.666667%');
      expect(settledNextImageBeforeCommit?.getAttribute('src')).toBe(
        'https://images.example/rivendell-2.jpg',
      );

      act(() => {
        vi.advanceTimersByTime(240);
      });

      const settledCurrentImageAfterCommit =
        container.querySelector<HTMLImageElement>(
          '[data-swipe-track="detail"] [data-swipe-slide="current"] img',
        );

      expect(swipeTrack?.dataset['swipePhase']).toBe('resetting');
      expect(swipeTrack?.dataset['swipeDirection']).toBe('0');
      expect(swipeTrack?.style.transform).toContain('-33.333333%');
      expect(settledCurrentImageAfterCommit).toBe(settledNextImageBeforeCommit);
      expect(settledCurrentImageAfterCommit?.getAttribute('src')).toBe(
        'https://images.example/rivendell-2.jpg',
      );
      expect(container.textContent).toContain('2/3');
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();

      act(() => {
        animationFrames.shift()?.(performance.now());
      });

      expect(swipeTrack?.dataset['swipePhase']).toBe('idle');

      const settledPreviousImageBeforeCommit =
        container.querySelector<HTMLImageElement>(
          '[data-swipe-track="detail"] [data-swipe-slide="previous"] img',
        );

      expect(settledPreviousImageBeforeCommit?.getAttribute('src')).toBe(
        'https://images.example/rivendell-1.jpg',
      );

      act(() => {
        dispatchPointerEvent(mainButton, 'pointerdown', {
          clientX: 150,
          clientY: 120,
        });
        dispatchPointerEvent(mainButton, 'pointermove', {
          clientX: 238,
          clientY: 122,
        });
        dispatchPointerEvent(mainButton, 'pointerup', {
          clientX: 242,
          clientY: 122,
        });
      });

      expect(container.textContent).toContain('2/3');

      act(() => {
        vi.advanceTimersByTime(240);
      });

      const previousSwipeCurrentImageAfterCommit =
        container.querySelector<HTMLImageElement>(
          '[data-swipe-track="detail"] [data-swipe-slide="current"] img',
        );

      expect(swipeTrack?.dataset['swipePhase']).toBe('resetting');
      expect(swipeTrack?.dataset['swipeDirection']).toBe('0');
      expect(swipeTrack?.style.transform).toContain('-33.333333%');
      expect(previousSwipeCurrentImageAfterCommit).toBe(
        settledPreviousImageBeforeCommit,
      );
      expect(previousSwipeCurrentImageAfterCommit?.getAttribute('src')).toBe(
        'https://images.example/rivendell-1.jpg',
      );
      expect(container.textContent).toContain('1/3');
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('snaps short and vertical detail gallery gestures back without changing images', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Rivendell LEGO-set hoofdbeeld',
                src: 'https://images.example/rivendell-1.jpg',
              },
              {
                alt: 'Rivendell LEGO-set detailbeeld',
                src: 'https://images.example/rivendell-2.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      const mainButton = container.querySelector('[class*="detailMainButton"]');

      act(() => {
        dispatchPointerEvent(mainButton, 'pointerdown', {
          clientX: 200,
          clientY: 120,
        });
        dispatchPointerEvent(mainButton, 'pointermove', {
          clientX: 174,
          clientY: 122,
        });
        dispatchPointerEvent(mainButton, 'pointerup', {
          clientX: 172,
          clientY: 122,
        });
      });

      const swipeTrack = container.querySelector<HTMLElement>(
        '[data-swipe-track="detail"]',
      );

      expect(container.textContent).toContain('1/2');
      expect(swipeTrack?.dataset['swipePhase']).toBe('settling');
      expect(swipeTrack?.dataset['swipeDirection']).toBe('0');

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(container.textContent).toContain('1/2');

      act(() => {
        dispatchPointerEvent(mainButton, 'pointerdown', {
          clientX: 200,
          clientY: 120,
        });
        const verticalMoveEvent = dispatchPointerEvent(
          mainButton,
          'pointermove',
          {
            clientX: 178,
            clientY: 190,
          },
        );
        dispatchPointerEvent(mainButton, 'pointerup', {
          clientX: 150,
          clientY: 230,
        });

        expect(verticalMoveEvent?.defaultPrevented).toBe(false);
      });

      expect(container.textContent).toContain('1/2');
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports swipe gestures in the detail lightbox viewer', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Eiffeltoren hoofdbeeld',
                src: 'https://images.example/10307-main.jpg',
              },
              {
                alt: 'Eiffeltoren detail 1',
                src: 'https://images.example/10307-alt1.jpg',
              },
              {
                alt: 'Eiffeltoren detail 2',
                src: 'https://images.example/10307-alt2.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Alle afbeeldingen weergeven"]',
          )
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });
      act(() => {
        document.body
          .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector(
        '[data-swipe-target="lightbox"]',
      );

      expect(
        document.body.querySelector('[data-swipe-track="lightbox"]'),
      ).not.toBeNull();

      act(() => {
        dispatchPointerEvent(mediaFrame, 'pointerdown', {
          clientX: 240,
          clientY: 120,
        });
        const horizontalMoveEvent = dispatchPointerEvent(
          mediaFrame,
          'pointermove',
          {
            clientX: 140,
            clientY: 124,
          },
        );

        expect(horizontalMoveEvent?.defaultPrevented).toBe(true);
      });

      const swipeTrack = document.body.querySelector<HTMLElement>(
        '[data-swipe-track="lightbox"]',
      );

      expect(swipeTrack?.dataset['swipePhase']).toBe('dragging');
      expect(swipeTrack?.style.transform).toContain('-100px');

      act(() => {
        dispatchPointerEvent(mediaFrame, 'pointerup', {
          clientX: 132,
          clientY: 124,
        });
      });

      expect(
        document.body.querySelector('[data-lightbox-active-index="0"]'),
      ).not.toBeNull();
      expect(swipeTrack?.dataset['swipePhase']).toBe('settling');

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(
        document.body.querySelector('[data-lightbox-active-index="1"]'),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps vertical lightbox viewer gestures available for page scrolling', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Eiffeltoren hoofdbeeld',
              src: 'https://images.example/10307-main.jpg',
            },
            {
              alt: 'Eiffeltoren detail 1',
              src: 'https://images.example/10307-alt1.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Alle afbeeldingen weergeven"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const mediaFrame = document.body.querySelector(
      '[data-swipe-target="lightbox"]',
    );

    act(() => {
      dispatchPointerEvent(mediaFrame, 'pointerdown', {
        clientX: 240,
        clientY: 120,
      });
      const verticalMoveEvent = dispatchPointerEvent(
        mediaFrame,
        'pointermove',
        {
          clientX: 220,
          clientY: 190,
        },
      );
      dispatchPointerEvent(mediaFrame, 'pointerup', {
        clientX: 214,
        clientY: 230,
      });

      expect(verticalMoveEvent?.defaultPrevented).toBe(false);
    });

    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();
  });

  it('keeps short and vertical detail gallery gestures from changing images', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rivendell LEGO-set hoofdbeeld',
              src: 'https://images.example/rivendell-1.jpg',
            },
            {
              alt: 'Rivendell LEGO-set detailbeeld',
              src: 'https://images.example/rivendell-2.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const mainButton = container.querySelector('[class*="detailMainButton"]');

    act(() => {
      dispatchPointerEvent(mainButton, 'pointerdown', {
        clientX: 200,
        clientY: 120,
      });
      const verticalMoveEvent = dispatchPointerEvent(
        mainButton,
        'pointermove',
        {
          clientX: 178,
          clientY: 190,
        },
      );
      dispatchPointerEvent(mainButton, 'pointerup', {
        clientX: 150,
        clientY: 230,
      });

      expect(verticalMoveEvent?.defaultPrevented).toBe(false);
    });

    expect(container.textContent).toContain('1/2');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('lets vertical gestures over the detail thumbnail row chain to page scroll', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Eiffeltoren hoofdbeeld',
              src: 'https://images.example/10307-main.jpg',
            },
            {
              alt: 'Eiffeltoren detail 1',
              src: 'https://images.example/10307-alt1.jpg',
            },
            {
              alt: 'Eiffeltoren detail 2',
              src: 'https://images.example/10307-alt2.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const thumbRow = container.querySelector('[class*="detailThumbRow"]');

    act(() => {
      dispatchPointerEvent(thumbRow, 'pointerdown', {
        clientX: 120,
        clientY: 120,
      });
      const verticalMoveEvent = dispatchPointerEvent(thumbRow, 'pointermove', {
        clientX: 126,
        clientY: 190,
      });
      const horizontalMoveEvent = dispatchPointerEvent(
        thumbRow,
        'pointermove',
        {
          clientX: 48,
          clientY: 122,
        },
      );
      dispatchPointerEvent(thumbRow, 'pointerup', {
        clientX: 48,
        clientY: 122,
      });

      expect(verticalMoveEvent?.defaultPrevented).toBe(false);
      expect(horizontalMoveEvent?.defaultPrevented).toBe(false);
    });

    expect(container.textContent).toContain('1/3');
  });

  it('opens multi-image detail galleries into an all-images overview first', async () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Eiffeltoren hoofdbeeld',
              src: 'https://images.example/10307-main.jpg',
            },
            {
              alt: 'Eiffeltoren detail 1',
              caption: 'Image(s) courtesy of Brickset.com',
              src: 'https://images.example/10307-alt1.jpg',
              thumbnailSrc: 'https://images.example/tn_10307-alt1.jpg',
            },
            {
              alt: 'Eiffeltoren detail 2',
              src: 'https://images.example/10307-alt2.jpg',
              thumbnailSrc: 'https://images.example/tn_10307-alt2.jpg',
            },
            {
              alt: 'Eiffeltoren detail 3',
              src: 'https://images.example/10307-alt3.jpg',
              thumbnailSrc: 'https://images.example/tn_10307-alt3.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      document.body.querySelector('[data-lightbox-mode="overview"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('Alle afbeeldingen');
    expect(document.body.textContent).toContain(
      'Image(s) courtesy of Brickset.com',
    );
    expect(
      document.body.querySelector('[class*="lightboxFooter"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector(
        '[class*="lightboxFooter"] [class*="lightboxAttribution"]',
      ),
    ).not.toBeNull();
    expect(
      document.body.querySelectorAll('[data-lightbox-grid-index]'),
    ).toHaveLength(4);
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="0"]')
        ?.hasAttribute('data-has-image-metadata'),
    ).toBe(false);
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="0"]')
        ?.getAttribute('data-lightbox-tile'),
    ).toBe('fallback');
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="0"]')
        ?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="0"]')
        ?.hasAttribute('data-lightbox-featured'),
    ).toBe(false);
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="1"]')
        ?.getAttribute('data-lightbox-tile'),
    ).toBe('fallback');
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="1"]')
        ?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="2"]')
        ?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      document.body
        .querySelector('[data-lightbox-grid-index="3"]')
        ?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      document.body.querySelector('button[aria-label="Bekijk afbeelding 3"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).toBeNull();

    const gridImages = document.body.querySelectorAll<HTMLImageElement>(
      '[class*="lightboxOverviewFrame"] img',
    );

    expect(gridImages[1]?.getAttribute('src')).toBe(
      'https://images.example/10307-alt1.jpg',
    );
    expect(gridImages[1]?.getAttribute('src')).not.toContain('tn_');

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="2"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      document.body.querySelector('[data-lightbox-mode="viewer"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('3/4');
    expect(
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-thumb-index]'),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-lightbox-mode="viewer"] button[aria-label="Volgende afbeelding"]',
      ),
    ).not.toBeNull();
    expect(
      document.body.querySelector(
        'button[aria-label="Terug naar alle afbeeldingen"]',
      ),
    ).toBeNull();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>(
          '[data-lightbox-mode="viewer"] button[aria-label="Volgende afbeelding"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(document.body.textContent).toContain('4/4');
    expect(
      document.body.querySelector('[data-lightbox-active-index="3"]'),
    ).not.toBeNull();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>(
          '[data-lightbox-mode="viewer"] button[aria-label="Vorige afbeelding"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(document.body.textContent).toContain('3/4');
    expect(
      document.body.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>(
          '[data-lightbox-mode="viewer"] [data-lightbox-close="true"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      document.body.querySelector('[data-lightbox-mode="overview"]'),
    ).not.toBeNull();
    await flushAnimationFrame();
    expect(document.activeElement).toBe(
      document.body.querySelector('[data-lightbox-grid-index="2"]'),
    );
  });

  it('uses optional image metadata for detail frames and lightbox overview tiles', () => {
    const images = [
      {
        alt: 'Botanical Collection rozenboeket op tafel',
        aspectRatio: 1.5,
        height: 900,
        mediaRole: 'model',
        orientation: 'landscape',
        src: 'https://images.example/roses-lifestyle.jpg',
        width: 1350,
      },
      {
        alt: 'Botanical Collection rozenboeket detail',
        height: 1200,
        mediaRole: 'detail',
        src: 'https://images.example/roses-detail.jpg',
        width: 800,
      },
      {
        alt: 'Botanical Collection rozenboeket doos',
        height: 900,
        mediaRole: 'box',
        src: 'https://images.example/roses-box.jpg',
        width: 1200,
      },
      {
        alt: 'Botanical Collection rozenboeket in woonkamer',
        height: 900,
        mediaRole: 'lifestyle',
        src: 'https://images.example/roses-room.jpg',
        width: 1600,
      },
      {
        alt: 'Botanical Collection rozenboeket bloemdetail',
        height: 900,
        mediaRole: 'detail',
        src: 'https://images.example/roses-wide-detail.jpg',
        width: 1500,
      },
    ] satisfies readonly CarouselImage[];

    act(() => {
      root.render(<ImageGallery images={images} variant="detail" />);
    });

    const detailFrame = container.querySelector<HTMLElement>(
      '[class*="detailMainFrame"]',
    );

    expect(detailFrame?.getAttribute('data-image-orientation')).toBe(
      'landscape',
    );
    expect(detailFrame?.getAttribute('style')).toContain(
      '--gallery-image-aspect-ratio: 1.5000',
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const overviewButtons = document.body.querySelectorAll<HTMLButtonElement>(
      '[data-lightbox-grid-index]',
    );

    expect(overviewButtons).toHaveLength(5);
    expect(overviewButtons[0]?.getAttribute('data-lightbox-featured')).toBe(
      null,
    );
    expect(
      overviewButtons[0]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[0]?.getAttribute('data-lightbox-tile')).toBe(
      'standard',
    );
    expect(overviewButtons[0]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
    expect(
      overviewButtons[1]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[1]?.getAttribute('data-lightbox-tile')).toBe(
      'standard',
    );
    expect(overviewButtons[1]?.getAttribute('data-lightbox-frame')).toBe(
      'portrait',
    );
    expect(overviewButtons[2]?.getAttribute('data-lightbox-tile')).toBe(
      'standard',
    );
    expect(
      overviewButtons[2]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('fullWidth');
    expect(overviewButtons[2]?.getAttribute('data-image-media-role')).toBe(
      'box',
    );
    expect(overviewButtons[2]?.getAttribute('data-lightbox-frame')).toBe(
      'fullWidth',
    );
    expect(overviewButtons[3]?.getAttribute('data-lightbox-tile')).toBe(
      'lifestyle',
    );
    expect(overviewButtons[3]?.getAttribute('data-image-media-role')).toBe(
      'lifestyle',
    );
    expect(
      overviewButtons[3]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[3]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
    expect(overviewButtons[4]?.getAttribute('data-lightbox-tile')).toBe('wide');
    expect(
      overviewButtons[4]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[4]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
    overviewButtons.forEach((button, index) => {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('aria-label')).toBe(
        `Bekijk afbeelding ${index + 1}`,
      );
    });
  });

  it('starts the overview with two standard tiles and keeps a 2-1-2-1 rhythm', () => {
    const images = [
      {
        alt: 'Ruimteschip hoofdbeeld',
        aspectRatio: 1.5,
        mediaRole: 'model',
        src: 'https://images.example/spaceship-main.jpg',
      },
      {
        alt: 'Ruimteschip doos',
        aspectRatio: 1.33,
        mediaRole: 'box',
        src: 'https://images.example/spaceship-box.jpg',
      },
      {
        alt: 'Ruimteschip op bureau',
        aspectRatio: 1.78,
        mediaRole: 'lifestyle',
        src: 'https://images.example/spaceship-lifestyle.jpg',
      },
      {
        alt: 'Ruimteschip achterkant',
        aspectRatio: 1.33,
        mediaRole: 'product',
        src: 'https://images.example/spaceship-back.jpg',
      },
      {
        alt: 'Ruimteschip displaystandaard',
        aspectRatio: 1.33,
        mediaRole: 'product',
        src: 'https://images.example/spaceship-stand.jpg',
      },
      {
        alt: 'Ruimteschip minifiguren',
        aspectRatio: 1,
        mediaRole: 'product',
        src: 'https://images.example/spaceship-minifigures.jpg',
      },
      {
        alt: 'Ruimteschip in actie',
        aspectRatio: 1.78,
        mediaRole: 'lifestyle',
        src: 'https://images.example/spaceship-action.jpg',
      },
    ] satisfies readonly CarouselImage[];

    act(() => {
      root.render(<ImageGallery images={images} variant="detail" />);
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const overviewButtons = document.body.querySelectorAll<HTMLButtonElement>(
      '[data-lightbox-grid-index]',
    );

    expect(overviewButtons).toHaveLength(7);
    expect(
      overviewButtons[0]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[0]?.hasAttribute('data-lightbox-featured')).toBe(
      false,
    );
    expect(overviewButtons[0]?.getAttribute('data-lightbox-tile')).toBe(
      'standard',
    );
    expect(
      overviewButtons[1]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[1]?.getAttribute('data-lightbox-tile')).toBe(
      'standard',
    );
    expect(overviewButtons[1]?.getAttribute('data-lightbox-frame')).toBe(
      'square',
    );
    expect(
      overviewButtons[2]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('fullWidth');
    expect(overviewButtons[2]?.getAttribute('data-lightbox-tile')).toBe(
      'lifestyle',
    );
    expect(overviewButtons[2]?.getAttribute('data-lightbox-frame')).toBe(
      'fullWidth',
    );
    expect(
      overviewButtons[3]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      overviewButtons[4]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      overviewButtons[5]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      overviewButtons[6]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      Array.from(overviewButtons).map((button) =>
        button.getAttribute('data-lightbox-grid-index'),
      ),
    ).toEqual(['0', '1', '2', '3', '4', '5', '6']);

    overviewButtons.forEach((button, index) => {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('aria-label')).toBe(
        `Bekijk afbeelding ${index + 1}`,
      );
    });
  });

  it('renders two overview items as a standard pair', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(2),
    );

    expect(layoutVariants).toEqual(['standard', 'standard']);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('renders three overview items as a 2-1 rhythm', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(3),
    );

    expect(layoutVariants).toEqual(['standard', 'standard', 'fullWidth']);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('renders five overview items as a 2-1-2 rhythm', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(5),
    );

    expect(layoutVariants).toEqual([
      'standard',
      'standard',
      'fullWidth',
      'standard',
      'standard',
    ]);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('renders six overview items as a 2-1-2-1 rhythm', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(6),
    );

    expect(layoutVariants).toEqual([
      'standard',
      'standard',
      'fullWidth',
      'standard',
      'standard',
      'fullWidth',
    ]);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('renders seven overview items as 2-1-2-2 instead of over-promoting to full width', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(7),
    );

    expect(layoutVariants).toEqual([
      'standard',
      'standard',
      'fullWidth',
      'standard',
      'standard',
      'standard',
      'standard',
    ]);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('renders nine overview items as a 2-1-2-1-2-1 rhythm', () => {
    const layoutVariants = getOverviewLayoutVariants(
      createOverviewPatternImages(9),
    );

    expect(layoutVariants).toEqual([
      'standard',
      'standard',
      'fullWidth',
      'standard',
      'standard',
      'fullWidth',
      'standard',
      'standard',
      'fullWidth',
    ]);
    expectNoSingleStandardBeforeFullWidthOrEnd(layoutVariants);
  });

  it('preserves detail gallery image order in the lightbox overview regardless of media roles', () => {
    const images = [
      {
        alt: 'Darth Vader verpakking achterkant',
        aspectRatio: 1.33,
        imageRole: 'box_back',
        mediaRole: 'box',
        src: 'https://images.example/vader-box-back.jpg',
      },
      {
        alt: 'Darth Vader lifestyle op plank',
        aspectRatio: 1.78,
        imageRole: 'lifestyle_room',
        mediaRole: 'lifestyle',
        src: 'https://images.example/vader-room.jpg',
      },
      {
        alt: 'Darth Vader buste hoofdbeeld',
        aspectRatio: 1,
        imageRole: 'model_primary',
        mediaRole: 'model',
        src: 'https://images.example/vader-model-primary.jpg',
      },
      {
        alt: 'Darth Vader doos voorkant',
        aspectRatio: 1.33,
        imageRole: 'box_front',
        mediaRole: 'box',
        src: 'https://images.example/vader-box-front.jpg',
      },
      {
        alt: 'Darth Vader helm detail',
        aspectRatio: 0.78,
        imageRole: 'detail',
        mediaRole: 'detail',
        src: 'https://images.example/vader-detail.jpg',
      },
      {
        alt: 'Darth Vader tweede productbeeld',
        aspectRatio: 1,
        imageRole: 'model_secondary',
        mediaRole: 'model',
        src: 'https://images.example/vader-model-secondary-a.jpg',
      },
      {
        alt: 'Darth Vader derde productbeeld',
        aspectRatio: 1,
        imageRole: 'model_secondary',
        mediaRole: 'model',
        src: 'https://images.example/vader-model-secondary-b.jpg',
      },
    ] satisfies readonly CarouselImage[];

    act(() => {
      root.render(<ImageGallery images={images} variant="detail" />);
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const overviewButtons = document.body.querySelectorAll<HTMLButtonElement>(
      '[data-lightbox-grid-index]',
    );

    expect(
      Array.from(overviewButtons).map((button) =>
        button.getAttribute('data-image-role'),
      ),
    ).toEqual([
      'box_back',
      'lifestyle_room',
      'model_primary',
      'box_front',
      'detail',
      'model_secondary',
      'model_secondary',
    ]);
    expect(
      Array.from(overviewButtons).map((button) =>
        button.getAttribute('data-lightbox-grid-index'),
      ),
    ).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(
      overviewButtons[0]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      overviewButtons[1]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(
      overviewButtons[2]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('fullWidth');
    expect(overviewButtons[6]?.getAttribute('data-image-role')).toBe(
      'model_secondary',
    );

    act(() => {
      overviewButtons[4]?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(
      document.body.querySelector('[data-lightbox-active-index="4"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain('5/7');
  });

  it('uses compact landscape frames for standard overview tiles', () => {
    const images = [
      {
        alt: 'Stadsset straatscene links',
        aspectRatio: 1.78,
        mediaRole: 'model',
        orientation: 'landscape',
        src: 'https://images.example/city-street-left.jpg',
      },
      {
        alt: 'Stadsset straatscene rechts',
        aspectRatio: 1.78,
        mediaRole: 'model',
        orientation: 'landscape',
        src: 'https://images.example/city-street-right.jpg',
      },
      {
        alt: 'Stadsset doos',
        aspectRatio: 1.33,
        mediaRole: 'box',
        orientation: 'landscape',
        src: 'https://images.example/city-box.jpg',
      },
      {
        alt: 'Stadsset winkelpui',
        aspectRatio: 0.72,
        mediaRole: 'detail',
        orientation: 'portrait',
        src: 'https://images.example/city-shop.jpg',
      },
      {
        alt: 'Stadsset woonkamer',
        aspectRatio: 1.78,
        mediaRole: 'lifestyle',
        src: 'https://images.example/city-lifestyle.jpg',
      },
    ] satisfies readonly CarouselImage[];

    act(() => {
      root.render(<ImageGallery images={images} variant="detail" />);
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const overviewButtons = document.body.querySelectorAll<HTMLButtonElement>(
      '[data-lightbox-grid-index]',
    );

    expect(
      overviewButtons[0]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[0]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
    expect(
      overviewButtons[1]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[1]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
    expect(
      overviewButtons[2]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('fullWidth');
    expect(overviewButtons[2]?.getAttribute('data-lightbox-frame')).toBe(
      'fullWidth',
    );
    expect(
      overviewButtons[3]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[3]?.getAttribute('data-lightbox-frame')).toBe(
      'portrait',
    );
    expect(
      overviewButtons[4]?.getAttribute('data-lightbox-layout-variant'),
    ).toBe('standard');
    expect(overviewButtons[4]?.getAttribute('data-lightbox-frame')).toBe(
      'landscape',
    );
  });

  it('zooms the selected lightbox image with a desktop double click and resets zoom on image change', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Ruimteschip hoofdbeeld',
              src: 'https://images.example/spaceship-main.jpg',
            },
            {
              alt: 'Ruimteschip detail',
              src: 'https://images.example/spaceship-detail.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const mediaFrame = document.body.querySelector<HTMLElement>(
      '[data-lightbox-media-surface="light"]',
    );

    expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('false');
    mockElementRect(mediaFrame, {
      height: 300,
      width: 400,
    });

    act(() => {
      mediaFrame?.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX: 40,
          clientY: 50,
        }),
      );
    });

    expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
    expect(
      mediaFrame
        ?.querySelector<HTMLElement>('[class*="lightboxZoomSurface"]')
        ?.getAttribute('style'),
    ).toContain('translate3d(240px, 150px, 0) scale(2.5)');

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>(
          '[data-lightbox-mode="viewer"] button[aria-label="Volgende afbeelding"]',
        )
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      document.body
        .querySelector<HTMLElement>('[data-lightbox-media-surface="light"]')
        ?.getAttribute('data-lightbox-zoomed'),
    ).toBe('false');
  });

  it('debounces a rapid desktop double click after zooming and allows a later double click to zoom out', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Ruimteschip cockpit detail',
                src: 'https://images.example/spaceship-cockpit-detail.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector<HTMLElement>(
        '[data-lightbox-media-surface="light"]',
      );
      const zoomSurface = () =>
        mediaFrame?.querySelector<HTMLElement>(
          '[class*="lightboxZoomSurface"]',
        );

      mockElementRect(mediaFrame, {
        height: 300,
        width: 400,
      });

      act(() => {
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(2.5)');

      act(() => {
        vi.advanceTimersByTime(80);
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(2.5)');

      act(() => {
        vi.advanceTimersByTime(340);
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('false');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(1)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not move a zoomed lightbox image on desktop mousemove alone', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Ruimteschip motor detail',
                src: 'https://images.example/spaceship-engine.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector<HTMLElement>(
        '[data-lightbox-media-surface="light"]',
      );
      const zoomSurface = () =>
        mediaFrame?.querySelector<HTMLElement>(
          '[class*="lightboxZoomSurface"]',
        );

      mockElementRect(mediaFrame, {
        height: 300,
        width: 400,
      });

      act(() => {
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(2.5)');

      const pointerCapture = mockPointerCapture(mediaFrame);

      act(() => {
        const pointerMoveEvent = dispatchPointerEvent(
          mediaFrame,
          'pointermove',
          {
            buttons: 0,
            clientX: 0,
            clientY: 0,
            pointerId: 7,
            pointerType: 'mouse',
          },
        );

        expect(pointerMoveEvent?.defaultPrevented).toBe(false);
      });

      expect(pointerCapture.setPointerCapture).not.toHaveBeenCalled();
      expect(mediaFrame?.getAttribute('data-lightbox-panning')).toBe('false');
      expect(zoomSurface()?.getAttribute('style')).toContain(
        'translate3d(0px, 0px, 0) scale(2.5)',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('pans a zoomed lightbox image with desktop mouse drag and pointer capture', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Ruimteschip motor detail',
                src: 'https://images.example/spaceship-engine.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector<HTMLElement>(
        '[data-lightbox-media-surface="light"]',
      );
      const zoomSurface = () =>
        mediaFrame?.querySelector<HTMLElement>(
          '[class*="lightboxZoomSurface"]',
        );

      mockElementRect(mediaFrame, {
        height: 300,
        width: 400,
      });

      act(() => {
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain(
        'translate3d(0px, 0px, 0) scale(2.5)',
      );

      const pointerCapture = mockPointerCapture(mediaFrame);

      act(() => {
        const pointerDownEvent = dispatchPointerEvent(
          mediaFrame,
          'pointerdown',
          {
            clientX: 220,
            clientY: 150,
            pointerId: 7,
            pointerType: 'mouse',
          },
        );
        const pointerMoveEvent = dispatchPointerEvent(
          mediaFrame,
          'pointermove',
          {
            clientX: 110,
            clientY: 150,
            pointerId: 7,
            pointerType: 'mouse',
          },
        );

        expect(pointerDownEvent?.defaultPrevented).toBe(true);
        expect(pointerMoveEvent?.defaultPrevented).toBe(true);
      });

      expect(pointerCapture.setPointerCapture).toHaveBeenCalledWith(7);
      expect(mediaFrame?.getAttribute('data-lightbox-panning')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain(
        'translate3d(-110px, 0px, 0) scale(2.5)',
      );

      act(() => {
        dispatchPointerEvent(mediaFrame, 'pointerup', {
          clientX: 110,
          clientY: 150,
          pointerId: 7,
          pointerType: 'mouse',
        });
      });

      expect(pointerCapture.releasePointerCapture).toHaveBeenCalledWith(7);
      expect(mediaFrame?.getAttribute('data-lightbox-panning')).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores stray touch pointer movement without an active touch gesture', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Ruimteschip vleugeldetail',
              src: 'https://images.example/spaceship-wing.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const mediaFrame = document.body.querySelector<HTMLElement>(
      '[data-lightbox-media-surface="light"]',
    );
    const zoomSurface = () =>
      mediaFrame?.querySelector<HTMLElement>('[class*="lightboxZoomSurface"]');

    mockElementRect(mediaFrame, {
      height: 300,
      width: 400,
    });

    act(() => {
      mediaFrame?.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 150,
        }),
      );
    });

    expect(zoomSurface()?.getAttribute('style')).toContain(
      'translate3d(0px, 0px, 0) scale(2.5)',
    );

    act(() => {
      const pointerMoveEvent = dispatchPointerEvent(mediaFrame, 'pointermove', {
        clientX: 0,
        clientY: 0,
        pointerId: 9,
        pointerType: 'touch',
      });

      expect(pointerMoveEvent?.defaultPrevented).toBe(false);
    });

    expect(zoomSurface()?.getAttribute('style')).toContain(
      'translate3d(0px, 0px, 0) scale(2.5)',
    );
  });

  it('does not follow desktop mouse movement while the lightbox image is at scale one', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Ruimteschip cockpit',
              src: 'https://images.example/spaceship-cockpit.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    const mediaFrame = document.body.querySelector<HTMLElement>(
      '[data-lightbox-media-surface="light"]',
    );
    const zoomSurface = mediaFrame?.querySelector<HTMLElement>(
      '[class*="lightboxZoomSurface"]',
    );
    const pointerCapture = mockPointerCapture(mediaFrame);

    act(() => {
      const pointerMoveEvent = dispatchPointerEvent(mediaFrame, 'pointermove', {
        buttons: 0,
        clientX: 110,
        clientY: 150,
        pointerId: 8,
        pointerType: 'mouse',
      });

      expect(pointerMoveEvent?.defaultPrevented).toBe(false);
    });

    expect(pointerCapture.setPointerCapture).not.toHaveBeenCalled();
    expect(pointerCapture.releasePointerCapture).not.toHaveBeenCalled();
    expect(mediaFrame?.getAttribute('data-lightbox-panning')).toBe('false');
    expect(zoomSurface?.getAttribute('style')).toContain(
      'translate3d(0px, 0px, 0) scale(1)',
    );
  });

  it('debounces repeated quick touch taps after a focal-point double tap', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Minifiguur gezicht detail',
                src: 'https://images.example/minifigure-face.jpg',
              },
              {
                alt: 'Minifiguur accessoires',
                src: 'https://images.example/minifigure-accessories.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      act(() => {
        document.body
          .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector<HTMLElement>(
        '[data-lightbox-media-surface="light"]',
      );
      const zoomSurface = () =>
        mediaFrame?.querySelector<HTMLElement>(
          '[class*="lightboxZoomSurface"]',
        );
      let pointerId = 1;

      mockElementRect(mediaFrame, {
        height: 300,
        width: 400,
      });

      function tapLightbox() {
        dispatchPointerEvent(mediaFrame, 'pointerdown', {
          clientX: 64,
          clientY: 72,
          pointerId,
        });
        dispatchPointerEvent(mediaFrame, 'pointerup', {
          clientX: 64,
          clientY: 72,
          pointerId,
        });
        pointerId += 1;
      }

      act(() => {
        tapLightbox();
        vi.advanceTimersByTime(90);
        tapLightbox();
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(2.5)');

      act(() => {
        vi.advanceTimersByTime(80);
        tapLightbox();
        vi.advanceTimersByTime(80);
        tapLightbox();
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(2.5)');

      act(() => {
        vi.advanceTimersByTime(340);
        tapLightbox();
        vi.advanceTimersByTime(90);
        tapLightbox();
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('false');
      expect(zoomSurface()?.getAttribute('style')).toContain('scale(1)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets scale-one lightbox swipes navigate but blocks slide swipe while panning a zoomed image', () => {
    vi.useFakeTimers();

    try {
      act(() => {
        root.render(
          <ImageGallery
            images={[
              {
                alt: 'Kasteel voorzijde',
                src: 'https://images.example/castle-front.jpg',
              },
              {
                alt: 'Kasteel minifiguren',
                src: 'https://images.example/castle-minifigures.jpg',
              },
            ]}
            variant="detail"
          />,
        );
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Alle afbeeldingen weergeven"]',
          )
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });
      act(() => {
        document.body
          .querySelector<HTMLButtonElement>('[data-lightbox-grid-index="0"]')
          ?.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
            }),
          );
      });

      const mediaFrame = document.body.querySelector<HTMLElement>(
        '[data-swipe-target="lightbox"]',
      );
      const swipeTrack = document.body.querySelector<HTMLElement>(
        '[data-swipe-track="lightbox"]',
      );

      act(() => {
        dispatchPointerEvent(mediaFrame, 'pointerdown', {
          clientX: 240,
          clientY: 120,
          pointerId: 1,
        });
        dispatchPointerEvent(mediaFrame, 'pointermove', {
          clientX: 140,
          clientY: 124,
          pointerId: 1,
        });
        dispatchPointerEvent(mediaFrame, 'pointerup', {
          clientX: 132,
          clientY: 124,
          pointerId: 1,
        });
      });

      expect(swipeTrack?.dataset['swipePhase']).toBe('settling');

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(
        document.body.querySelector('[data-lightbox-active-index="1"]'),
      ).not.toBeNull();

      mockElementRect(mediaFrame, {
        height: 300,
        width: 400,
      });

      act(() => {
        mediaFrame?.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: 200,
            clientY: 150,
          }),
        );
      });

      expect(mediaFrame?.getAttribute('data-lightbox-zoomed')).toBe('true');

      act(() => {
        dispatchPointerEvent(mediaFrame, 'pointerdown', {
          clientX: 220,
          clientY: 150,
          pointerId: 2,
        });
        const panMoveEvent = dispatchPointerEvent(mediaFrame, 'pointermove', {
          clientX: 110,
          clientY: 150,
          pointerId: 2,
        });

        expect(panMoveEvent?.defaultPrevented).toBe(true);
      });

      expect(swipeTrack?.dataset['swipePhase']).not.toBe('dragging');
      expect(
        document.body.querySelector('[data-lightbox-active-index="1"]'),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps set detail gallery images on a white contained product surface', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.detailMainFrame {\n  aspect-ratio: 1 / 1;');
    expect(css).toContain('.detailMainFrame,\n.detailThumbFrame {');
    expect(css).toContain('background: #ffffff;');
    expect(css).toContain(
      '.detailMainButton {\n  border-radius: var(--lego-radius-lg);',
    );
    expect(css).toContain(
      '.detailThumbButton {\n  border-radius: var(--lego-radius-md);',
    );
    expect(css).toContain('.galleryImageDetail {');
    expect(css).toContain('object-fit: contain;');
    expect(css).toContain('.galleryImageThumbnail {\n  object-fit: contain;');
    expect(css).toContain('@media (min-width: 48rem)');
    expect(css).toContain(".detailGallery[data-has-multiple-images='true'] {");
    expect(css).toContain('gap: 0;');
    expect(css).toContain('grid-template-columns: 160px minmax(0, 1fr);');
    expect(css).toContain('background: #f2f2f2;');
    expect(css).toContain('border: var(--lego-border-width-1) solid');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('padding: var(--lego-space-3);');
    expect(css).toContain('aspect-ratio: auto;');
    expect(css).toContain('border: 0;');
    expect(css).toContain('height: 76px;');
    expect(css).toContain('width: min(130px, 100%);');
    expect(css).toContain('grid-auto-flow: row;');
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('overscroll-behavior-y: auto;');
    expect(css).toContain('touch-action: auto;');
    expect(css).toContain('box-shadow: 0 0 0 3px var(--lego-accent);');
    expect(css).toContain(
      ".detailGallery[data-has-multiple-images='true'] .detailMainButton {",
    );
    expect(css).toContain(
      'border-radius: 0 var(--lego-radius-lg) var(--lego-radius-lg) 0;',
    );
    expect(css).toContain('.detailGalleryControls {');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('background: rgba(12, 18, 32, 0.68);');
    expect(css).toContain('.detailMainButton {\n  touch-action: pan-y;');
    expect(css).toContain(
      '.lightboxMediaFrame {\n  cursor: zoom-in;\n  overscroll-behavior: contain;\n  touch-action: none;',
    );
    expect(css).toContain('user-select: none;');
    expect(css).toContain(
      ".lightboxZoomSurface[data-lightbox-zoom-animating='true']",
    );
    expect(css).toContain(
      'transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);',
    );
    expect(css).not.toContain('touch-action: pan-x;');
    expect(css).toContain('.swipeViewport {');
    expect(css).toContain('.swipeTrack {');
    expect(css).toContain('.swipeSlideFrame,');
    expect(css).toContain('.lightboxZoomSurface {');
    expect(css).toContain(".lightboxMediaFrame[data-lightbox-zoomed='true']");
    expect(css).toContain(".lightboxMediaFrame[data-lightbox-panning='true']");
    expect(css).toContain('cursor: grab;');
    expect(css).toContain('cursor: grabbing;');
    expect(css).toContain("data-swipe-phase='dragging'");
    expect(css).toContain("data-swipe-phase='resetting'");
    expect(css).toContain('transition: transform 240ms ease-out;');
    expect(css).toContain('width: 300%;');
    expect(css).toContain('flex: 0 0 33.333333%;');
    expect(css).toContain('.detailGalleryNavButton {');
    expect(css).toContain(
      ".detailGallery[data-has-multiple-images='true'] .detailGalleryControls {",
    );
    expect(css).toContain('left: calc(160px + var(--lego-space-3));');
    expect(css).not.toContain(
      ".detailGallery[data-has-multiple-images='true'] .articleZoomOverlay {",
    );
    expect(css).toContain('.detailMainFrame {\n    aspect-ratio: auto;');
    expect(css).toContain('height: clamp(28rem, 58vh, 42rem);');
    expect(css).toContain('@media (max-width: 47.99rem)');
    expect(css).toContain('.detailMainButton {\n    touch-action: pan-y;');
    expect(css).toContain('.detailThumbRow {\n    display: none;');
    expect(css).toContain('.detailGalleryCounter {\n    left: 0;');
    expect(css).toContain('.detailGalleryActions {\n    bottom: 0;');
    expect(css).toContain('.detailGalleryNavButton,\n  .lightboxNavButton {');
    expect(css).toContain('display: none;');
    expect(css).toContain('border-inline: 0;');
    expect(css).toContain('border-block-end: var(--lego-border-width-1) solid');
    expect(css).toContain('box-sizing: border-box;');
    expect(css).toContain('padding: var(--lego-space-3);');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('--lego-caption-font-size');
    expect(css).toContain('.lightboxBackdrop {');
    expect(css).toContain('--gallery-lightbox-open-duration: 380ms;');
    expect(css).toContain(
      '--gallery-lightbox-open-easing: cubic-bezier(0.32, 0.72, 0, 1);',
    );
    expect(css).toContain('--gallery-lightbox-close-duration: 260ms;');
    expect(css).toContain(
      '--gallery-lightbox-close-easing: cubic-bezier(0.32, 0, 0.67, 0);',
    );
    expect(css).toContain('position: fixed;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 1400;');
    expect(css).toContain(".lightboxBackdrop[data-lightbox-state='open'] {");
    expect(css).toContain(".lightboxBackdrop[data-lightbox-state='closing'] {");
    expect(css).toContain(
      ".lightboxBackdrop[data-lightbox-state='open'] .lightboxDialog {",
    );
    expect(css).toContain(
      ".lightboxBackdrop[data-lightbox-state='closing'] .lightboxDialog {",
    );
    expect(css).toContain('height: 92vh;');
    expect(css).toContain('width: 90vw;');
    expect(css).toContain('transform: translateY(100%);');
    expect(css).toContain(
      ".lightboxBackdrop[data-lightbox-state='open'] .lightboxDialog {\n    transform: translateY(0);",
    );
    expect(css).toContain('max-width: min(90vw, 92rem);');
    expect(css).toContain(".lightboxDialog[data-lightbox-variant='detail']");
    expect(css).toContain('gap: 0;');
    expect(css).toContain('padding: 0;');
    expect(css).toContain('.lightboxOverviewBody {');
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('.lightboxOverview {');
    expect(css).toContain('max-width: 980px;');
    expect(css).toContain('margin-inline: auto;');
    expect(css).toContain('grid-auto-rows: auto;');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('.lightboxOverviewFrame {');
    expect(css).toContain('max-height: min(54dvh, 28rem);');
    expect(css).toContain('min-height: clamp(8rem, 38vw, 13rem);');
    expect(css).not.toContain(
      '.lightboxOverviewFrame {\n  align-items: center;\n  aspect-ratio: 16 / 10;\n  background: #ffffff;\n  display: flex;\n  justify-content: center;\n  min-height: 14rem;\n  overflow: hidden;\n  padding:',
    );
    expect(css).toContain(
      ".lightboxDialog[data-lightbox-variant='detail'] .lightboxViewport {",
    );
    expect(css).toContain('align-items: center;');
    expect(css).toContain(
      ".lightboxDialog[data-lightbox-variant='detail'] .lightboxMediaFrame {",
    );
    expect(css).toContain('height: 100%;');
    expect(css).toContain('max-height: 100%;');
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='featured']",
    );
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='fullWidth']",
    );
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='fullWidth'][data-lightbox-tile='fallback']",
    );
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-tile='featured']",
    );
    expect(css).toContain('max-height: min(70dvh, 42rem);');
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-tile='lifestyle']",
    );
    expect(css).toContain(".lightboxOverviewButton[data-lightbox-tile='wide']");
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='standard'][data-lightbox-frame='landscape']",
    );
    expect(css).toContain('aspect-ratio: 16 / 10;');
    expect(css).toContain('min-height: clamp(6.5rem, 26vw, 10rem);');
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='standard'][data-lightbox-frame='portrait']",
    );
    expect(css).toContain('aspect-ratio: 3 / 4;');
    expect(css).toContain('max-height: min(60dvh, 34rem);');
    expect(css).toContain(
      ".lightboxOverviewButton[data-lightbox-layout-variant='standard'][data-lightbox-frame='square']",
    );
    expect(css).toContain('grid-column: 1 / -1;');
    expect(css).not.toContain('grid-column: span 2;');
    expect(css).not.toContain('nth-child(3n)');
    expect(css).toContain('min-height: clamp(13rem, 62vw, 24rem);');
    expect(css).toContain('@media (max-width: 22.49rem)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('.galleryImageOverview');
    expect(css).toContain('.galleryImageOverview {\n  object-fit: contain;');
    expect(css).toContain(
      '.lightboxMediaFrame {\n  aspect-ratio: var(--gallery-image-aspect-ratio, 4 / 3);',
    );
    expect(css).toContain('border: 0;');
    expect(css).toContain('.lightboxFooter {');
    expect(css).toContain('.lightboxAttribution');
    expect(css).toContain('font-size: var(--lego-caption-font-size);');
    expect(css).toContain('@media (max-width: 47.99rem)');
    expect(css).toContain('align-items: flex-end;');
    expect(css).toContain('height: min(92vh, 100dvh);');
    expect(css).toContain('max-height: 100dvh;');
    expect(css).toContain('--gallery-lightbox-sheet-top-offset: 56px;');
    expect(css).toContain(
      'height: calc(100dvh - var(--gallery-lightbox-sheet-top-offset));',
    );
    expect(css).toContain('max-width: 100vw;');
    expect(css).toContain('width: 100vw;');
    expect(css).toContain(
      'border-radius: var(--lego-radius-lg) var(--lego-radius-lg) 0 0;',
    );
  });

  it('uses largeSrc for set detail images while keeping thumbnailSrc for thumbnails', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Icons Eiffeltoren',
              src: 'https://cdn.example.com/10307-main.jpg',
            },
            {
              alt: 'LEGO Icons Eiffeltoren detail',
              largeSrc:
                'https://images.brickset.com/sets/AdditionalImages/10307-1/large_10307_alt1.webp',
              src: 'https://images.brickset.com/sets/AdditionalImages/10307-1/10307_alt1.jpg',
              thumbnailSrc:
                'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_alt1_jpg.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    const mainImage = container.querySelector<HTMLImageElement>(
      '[class*="detailMainFrame"] img',
    );
    const gallery = container.querySelector(
      '[data-has-multiple-images="true"]',
    );
    const thumbnails = container.querySelectorAll<HTMLImageElement>(
      '[class*="detailThumbFrame"] img',
    );

    expect(gallery).not.toBeNull();
    expect(mainImage?.getAttribute('src')).toBe(
      'https://cdn.example.com/10307-main.jpg',
    );
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]?.getAttribute('src')).toBe(
      'https://cdn.example.com/10307-main.jpg',
    );
    expect(thumbnails[1]?.getAttribute('src')).toBe(
      'https://images.brickset.com/sets/AdditionalImages/10307-1/tn_10307_alt1_jpg.jpg',
    );
    expect(thumbnails[1]?.getAttribute('src')).not.toContain('10307_alt1.jpg');

    act(() => {
      container
        .querySelectorAll<HTMLButtonElement>('[class*="detailThumbButton"]')[1]
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(
      container
        .querySelector<HTMLImageElement>('[class*="detailMainFrame"] img')
        ?.getAttribute('src'),
    ).toBe(
      'https://images.brickset.com/sets/AdditionalImages/10307-1/large_10307_alt1.webp',
    );
  });

  it('does not allocate the desktop thumbnail sidebar for single-image detail galleries', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'LEGO Icons Bloemenboeket',
              src: 'https://cdn.example.com/10280-main.jpg',
            },
          ]}
          variant="detail"
        />,
      );
    });

    expect(
      container.querySelector('[data-has-multiple-images="false"]'),
    ).not.toBeNull();
    expect(container.querySelector('[class*="detailThumbRow"]')).toBeNull();
    expect(
      container.querySelector('[class*="detailGalleryControls"]'),
    ).toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="Alle afbeeldingen weergeven"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector('[class*="detailMainFrame"] img'),
    ).not.toBeNull();
  });

  it('keeps the set detail main image stable without the article hover zoom treatment', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );

    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Oracle Red Bull Racing RB20 F1 Car',
              src: '/sets/42206.png',
            },
          ]}
          variant="detail"
        />,
      );
    });

    expect(
      container.querySelector('[data-detail-main-zoom-overlay="true"]'),
    ).toBeNull();
    expect(
      container.querySelector('[class*="detailGalleryControls"]'),
    ).toBeNull();
    expect(css).toContain('.articleZoomOverlay {');
    expect(css).toContain('.articleZoomIconShell {');
    expect(css).toContain('.articleImageButton:hover .articleZoomOverlay,');
    expect(css).not.toContain('.detailMainButton:hover .articleZoomOverlay');
    expect(css).not.toContain(
      '.detailMainButton:focus-visible .articleZoomOverlay',
    );
    expect(css).toContain('@media (hover: none), (pointer: coarse)');
  });

  it('opens the lightbox from the set detail main image', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Oracle Red Bull Racing RB20 F1 Car',
              src: '/sets/42206.png',
            },
          ]}
          variant="detail"
        />,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[class*="detailMainButton"]')
        ?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          }),
        );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-mode="viewer"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-grid-index]'),
    ).toBeNull();
  });

  it('keeps rounded focus rings aligned with gallery trigger radii', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain(
      '.articleImageButton {\n  border-radius: var(--lego-radius-lg);',
    );
    expect(css).toContain(
      '.detailMainButton {\n  border-radius: var(--lego-radius-lg);',
    );
    expect(css).toContain(
      '.detailThumbButton {\n  border-radius: var(--lego-radius-md);',
    );
    expect(css).toContain('.lightboxCloseButton,\n.lightboxNavButton {');
    expect(css).toContain('border-radius: var(--lego-radius-pill);');
    expect(css).toContain(
      '.lightboxThumbButton {\n  border-radius: var(--lego-radius-md);',
    );
    expect(css).toContain('@media (max-width: 47.99rem)');
    expect(css).toContain(
      '.detailMainButton,\n  .detailMainFrame {\n    border-radius: 0;',
    );
  });

  it('keeps ImageCarousel as a compatibility alias', () => {
    act(() => {
      root.render(
        <ImageCarousel
          images={[
            {
              alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
              src: '/articles/star-wars-day-2026/grogu.jpg',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('can open the existing lightbox from an external request without rendering a visible gallery grid', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Rocking Plants',
              caption: 'Rocking Plants · Set 11506',
              ctaHref: '/sets/rocking-plants-11506',
              ctaLabel: 'Bekijk set',
              src: '/sets/11506.png',
            },
            {
              alt: "The Mandalorian's N-1 Starfighter",
              caption: "The Mandalorian's N-1 Starfighter · Set 75442",
              ctaHref: '/sets/the-mandalorians-n-1-starfighter-75442',
              ctaLabel: 'Bekijk set',
              src: '/sets/75442.png',
            },
          ]}
          lightboxRequest={{
            index: 1,
            key: 1,
          }}
          presentation="lightbox-only"
          variant="article"
        />,
      );
    });

    expect(
      container.querySelector('section[aria-label="Afbeeldingen"]'),
    ).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain(
      "The Mandalorian's N-1 Starfighter · Set 75442",
    );
    expect(
      document.body.querySelector(
        'a[href="/sets/the-mandalorians-n-1-starfighter-75442"]',
      ),
    ).not.toBeNull();
  });

  it('uses balanced responsive article gallery layouts', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain(".articleGrid[data-count='1']");
    expect(css).toContain(".articleGrid[data-count='2']");
    expect(css).toContain(".articleGrid[data-count='3']");
    expect(css).toContain(".articleGrid[data-count='4'],");
    expect(css).toContain(".articleGrid[data-count='5-plus']");
    expect(css).toContain('grid-auto-flow: row;');
    expect(css).toContain('grid-auto-rows: auto;');
    expect(css).toContain('grid-template-rows: auto min-content;');
    expect(css).toContain('.articleImageButton {\n  border-radius:');
    expect(css).toContain('height: auto;');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('.articleMediaFrame,');
    expect(css).toContain('border-radius: var(--lego-radius-lg);');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('.articleMoreOverlay');
    expect(css).toContain('.articleZoomOverlay');
    expect(css).toContain('.articleZoomIconShell');
    expect(css).toContain('.articleZoomIcon');
    expect(css).toContain('rgba(12, 18, 32, 0.28) 100%');
    expect(css).toContain('border-radius: var(--lego-radius-pill);');
    expect(css).toContain('.articleImageButton:hover .articleZoomOverlay,');
    expect(css).toContain(
      '.articleImageButton:focus-visible .articleZoomOverlay',
    );
    expect(css).toContain('@media (hover: none), (pointer: coarse)');
    expect(css).toContain('.articleMediaFrame {\n  background: #ffffff;');
    expect(css).toContain('.galleryImageArticle {');
    expect(css).toContain('object-fit: cover;');
  });

  it('renders two article images as a two-tile gallery', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Afbeelding 1',
              src: '/articles/demo/1.webp',
            },
            {
              alt: 'Afbeelding 2',
              src: '/articles/demo/2.webp',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(container.querySelector('[data-count="2"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-gallery-tile-index]'),
    ).toHaveLength(2);
    expect(container.textContent).not.toContain('+');
  });

  it('shows the first four article images with a remaining-count overlay', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Afbeelding 1',
              src: '/articles/demo/1.webp',
            },
            {
              alt: 'Afbeelding 2',
              src: '/articles/demo/2.webp',
            },
            {
              alt: 'Afbeelding 3',
              src: '/articles/demo/3.webp',
            },
            {
              alt: 'Afbeelding 4',
              src: '/articles/demo/4.webp',
            },
            {
              alt: 'Afbeelding 5',
              src: '/articles/demo/5.webp',
            },
            {
              alt: 'Afbeelding 6',
              src: '/articles/demo/6.webp',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(container.querySelector('[data-count="5-plus"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-gallery-tile-index]'),
    ).toHaveLength(4);
    expect(container.textContent).toContain('+2');
  });

  it('renders four article images as a balanced four-tile layout', () => {
    act(() => {
      root.render(
        <ImageGallery
          images={[
            {
              alt: 'Afbeelding 1',
              src: '/articles/demo/1.webp',
            },
            {
              alt: 'Afbeelding 2',
              src: '/articles/demo/2.webp',
            },
            {
              alt: 'Afbeelding 3',
              src: '/articles/demo/3.webp',
            },
            {
              alt: 'Afbeelding 4',
              src: '/articles/demo/4.webp',
            },
          ]}
          variant="article"
        />,
      );
    });

    expect(container.querySelector('[data-count="4"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-gallery-tile-index]'),
    ).toHaveLength(4);
    expect(container.textContent).not.toContain('+');
  });
});
