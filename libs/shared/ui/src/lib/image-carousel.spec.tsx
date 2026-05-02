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
    expect(container.querySelector('[data-layout="three-up"]')).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureFeature"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureStackTop"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureStackBottom"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureFeature"] img'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureStackTop"] img'),
    ).not.toBeNull();
    expect(
      container.querySelector('[class*="articleFigureStackBottom"] img'),
    ).not.toBeNull();

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

    const nextButton = container.querySelector(
      'button[aria-label="Volgende afbeelding"]',
    ) as HTMLButtonElement | null;
    const dots = container.querySelectorAll(
      'button[aria-label^="Bekijk afbeelding"]',
    );

    expect(nextButton).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Sluit galerij"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-control="previous"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-control="next"]'),
    ).not.toBeNull();
    expect(dots).toHaveLength(3);
    expect(
      container.querySelectorAll('[class*="lightboxThumbButton"]'),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll('[class*="lightboxThumbFrame"] img'),
    ).toHaveLength(3);
    expect(
      container.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('1 / 3');

    act(() => {
      nextButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(container.textContent).toContain('2 / 3');
    expect(
      container.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();

    const previousButton = container.querySelector(
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

    expect(container.textContent).toContain('1 / 3');
    expect(
      container.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();

    const firstThumbnail = container.querySelector(
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

    expect(container.textContent).toContain('1 / 3');
    expect(
      container.querySelector('[data-lightbox-active-index="0"]'),
    ).not.toBeNull();

    const thirdThumbnail = container.querySelector(
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

    expect(container.textContent).toContain('3 / 3');
    expect(
      container.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-lightbox-thumb-index="2"][data-active="true"]',
      ),
    ).not.toBeNull();

    const closeButton = container.querySelector(
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
      container.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();

    const secondCloseButton = container.querySelector(
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
      container.querySelector('[data-lightbox-active-index="2"]'),
    ).not.toBeNull();
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

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    const closeButton = container.querySelector(
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

    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      openButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        }),
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
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

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-media-surface="light"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
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
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector('[data-lightbox-active-index="1"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain(
      "The Mandalorian's N-1 Starfighter · Set 75442",
    );
    expect(
      container.querySelector(
        'a[href="/sets/the-mandalorians-n-1-starfighter-75442"]',
      ),
    ).not.toBeNull();
  });

  it('uses an exact 3-image editorial grid with the parent grid owning height and the tiles stretching into it', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/shared/ui/src/lib/image-carousel.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.articleGridThreeUp');
    expect(css).toContain(
      'grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);',
    );
    expect(css).toContain('grid-template-rows: repeat(2, minmax(0, 1fr));');
    expect(css).toContain(
      '.articleGridThreeUp .articleFigure {\n    align-content: stretch;',
    );
    expect(css).toContain(
      '.articleGridThreeUp .articleMediaFrame,\n  .articleGridThreeUp .articleImageButton,\n  .articleGridThreeUp .galleryImage {',
    );
    expect(css).toContain('height: 100%;');
    expect(css).toContain(
      '.articleGridThreeUp .articleMediaFrame {\n    min-height: 100%;',
    );
  });
});
