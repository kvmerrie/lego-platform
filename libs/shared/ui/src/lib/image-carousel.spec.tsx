/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCarousel, ImageGallery } from './image-carousel';

vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    src,
  }: {
    alt: string;
    className?: string;
    src: string;
  }) => <img alt={alt} className={className} src={src} />,
}));

describe('ImageGallery', () => {
  let container: HTMLDivElement;
  let root: Root;

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
    expect(mobileFrameRule).toContain('border-radius: 0;');
    expect(mobileFocusRule).toContain(
      'box-shadow: inset 0 0 0 4px var(--lego-focus-ring);',
    );
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

  it('closes the fullscreen viewer with the close button and Escape', () => {
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
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(closeButton);

    const lastThumbnail = document.body.querySelector(
      '[data-lightbox-thumb-index="1"]',
    ) as HTMLButtonElement | null;

    act(() => {
      lastThumbnail?.focus();
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

    expect(document.activeElement).toBe(lastThumbnail);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Escape',
        }),
      );
    });

    await flushAnimationFrame();

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
      document.body.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
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
    expect(css).toContain('@media (min-width: 48rem)');
    expect(css).toContain('.detailMainFrame {\n    aspect-ratio: auto;');
    expect(css).toContain('height: 508px;');
    expect(css).toContain('@media (max-width: 47.99rem)');
    expect(css).toContain('.detailMainFrame {\n    border-inline: 0;');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('.lightboxBackdrop {');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 1400;');
  });

  it('gives the set detail main image the same zoom affordance as article galleries', () => {
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
    ).not.toBeNull();
    expect(css).toContain('.articleZoomOverlay {');
    expect(css).toContain('.articleZoomIconShell {');
    expect(css).toContain('.articleImageButton:hover .articleZoomOverlay,');
    expect(css).toContain('.detailMainButton:hover .articleZoomOverlay,');
    expect(css).toContain(
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
