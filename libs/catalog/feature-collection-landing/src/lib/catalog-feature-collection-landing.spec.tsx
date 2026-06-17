import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getCatalogCollectionLandingPageConfig } from '@lego-platform/catalog/util';
import { CatalogFeatureCollectionLandingPage } from './catalog-feature-collection-landing';

function createSetCard(index: number) {
  return {
    id: `set-${index}`,
    slug: `set-${index}`,
    name: `Set ${index}`,
    theme: 'Icons',
    releaseYear: 2026,
    pieces: 100 + index,
  };
}

function readCollectionLandingCss(): string {
  const candidatePaths = [
    resolve(
      process.cwd(),
      'src/lib/catalog-feature-collection-landing.module.css',
    ),
    resolve(
      process.cwd(),
      'libs/catalog/feature-collection-landing/src/lib/catalog-feature-collection-landing.module.css',
    ),
  ];
  const cssPath = candidatePaths.find((candidatePath) =>
    existsSync(candidatePath),
  );

  if (!cssPath) {
    throw new Error('Missing collection landing CSS fixture.');
  }

  return readFileSync(cssPath, 'utf-8');
}

describe('CatalogFeatureCollectionLandingPage', () => {
  it('renders indexable collection content with sort links and internal links', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-voor-volwassenen',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        currentPage={1}
        pageSize={1}
        relatedPageLinks={[
          {
            href: '/lego-voor-volwassenen',
            label: 'LEGO voor volwassenen',
          },
        ]}
        setCards={[
          {
            id: '75355',
            slug: 'x-wing-starfighter-75355',
            name: 'X-wing Starfighter',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 1949,
          },
        ]}
        themeLinks={[{ href: '/themes/icons', label: 'Icons' }]}
        totalSetCount={2}
      />,
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('LEGO voor volwassenen');
    expect(markup).not.toContain('--collection-page-surface:');
    expect(markup).not.toContain('--collection-page-text:');
    expect(markup).not.toContain('introHeroBreadcrumbs');
    expect(markup).toContain('data-hero-button-tone="black"');
    expect(markup).toContain('interactiveSurfaceLight');
    expect(markup).toContain('X-wing Starfighter');
    expect(markup).toContain('data-catalog-set-card-collection="true"');
    expect(markup).toContain(
      'data-catalog-set-card-collection-grid-mode="browse"',
    );
    expect(markup).toContain(
      'data-catalog-set-card-collection-variant="compact"',
    );
    expect(markup).toContain('/sets/x-wing-starfighter-75355');
    expect(markup).toContain('/themes/icons');
    expect(markup).toContain('/lego-voor-volwassenen');
    expect(markup).toContain('?sort=newest');
    expect(markup).toContain('href="/lego-voor-volwassenen?page=2"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-active="true"');
  });

  it('renders sort navigation as URL-driven tabs instead of pill chips', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-voor-volwassenen',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="newest"
        config={config}
        setCards={[createSetCard(1)]}
        totalSetCount={1}
      />,
    );
    const css = readCollectionLandingCss();
    const sortLinkRule =
      css.match(/\.sortLink \{(?<body>[^}]+)\}/u)?.groups?.body ?? '';

    expect(markup).toContain('aria-label="Sorteer sets"');
    expect(markup).toContain('href="/lego-voor-volwassenen?sort=newest"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-active="true"');
    expect(css).toContain('.sortLink::after');
    expect(css).toContain(".sortLink[aria-current='page']::after");
    expect(css).toContain('overflow-x: auto;');
    expect(css).toContain('white-space: nowrap;');
    expect(sortLinkRule).not.toContain('border:');
    expect(sortLinkRule).not.toContain('border-radius');
    expect(sortLinkRule).not.toContain('background:');
  });

  it('keeps sort tabs separate from the mobile view toolbar', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-voor-volwassenen',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        setCards={[createSetCard(1)]}
        totalSetCount={1}
      />,
    );

    expect(markup).toContain('aria-label="Sorteer sets"');
    expect(markup).toContain('aria-label="Mobiele kaartweergave"');
    expect(markup.indexOf('aria-label="Sorteer sets"')).toBeLessThan(
      markup.indexOf('aria-label="Mobiele kaartweergave"'),
    );
    expect(markup).toContain('Weergave');
    expect(markup).toContain('aria-label="Toon grote kaarten"');
    expect(markup).toContain('aria-label="Toon compacte kaarten"');
  });

  it('shows total-aware result count copy for the first page', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-100-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        currentPage={1}
        pageSize={40}
        setCards={Array.from({ length: 40 }, (_, index) =>
          createSetCard(index + 1),
        )}
        totalSetCount={123}
      />,
    );

    expect(markup).toContain('40 van 123 sets weergegeven');
    expect(markup).not.toContain('producten worden weergegeven');
  });

  it('shows a result range after the first page', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-100-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        currentPage={2}
        pageSize={40}
        setCards={Array.from({ length: 40 }, (_, index) =>
          createSetCard(index + 41),
        )}
        totalSetCount={123}
      />,
    );

    expect(markup).toContain('41–80 van 123 sets weergegeven');
  });

  it('shows the final result range on the last page', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-100-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        currentPage={4}
        pageSize={40}
        setCards={Array.from({ length: 3 }, (_, index) =>
          createSetCard(index + 121),
        )}
        totalSetCount={123}
      />,
    );

    expect(markup).toContain('121–123 van 123 sets weergegeven');
  });

  it('shows a compact result count when all sets fit on one page', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-100-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        pageSize={40}
        setCards={Array.from({ length: 23 }, (_, index) =>
          createSetCard(index + 1),
        )}
        totalSetCount={23}
      />,
    );

    expect(markup).toContain('23 sets weergegeven');
  });

  it('uses an honest empty result count when no sets are available', () => {
    const config = getCatalogCollectionLandingPageConfig('nieuwe-lego-sets');

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="newest"
        config={config}
        pageSize={40}
        setCards={[]}
        totalSetCount={0}
      />,
    );

    expect(markup).toContain('Geen sets gevonden');
    expect(markup).not.toContain('producten');
  });

  it('keeps the destination hero on the shared black button treatment', () => {
    const config = getCatalogCollectionLandingPageConfig('nieuwe-lego-sets');

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="newest"
        config={config}
        setCards={[]}
        totalSetCount={0}
      />,
    );

    expect(markup).not.toContain('--collection-page-surface:');
    expect(markup).not.toContain('--collection-page-text:');
    expect(markup).toContain('data-hero-button-tone="black"');
    expect(markup).toContain('interactiveSurfaceLight');
    expect(markup).toContain('Nieuwe LEGO sets');
  });

  it('uses white hero buttons and shared media sizing on dark collection visuals', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-100-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={{
          ...config,
          visual: {
            backgroundColor: '#123047',
            imageUrl: 'https://images.example/dark-collection.jpg',
          },
        }}
        setCards={[]}
        themeLinks={[{ href: '/themes/icons', label: 'Icons' }]}
        totalSetCount={0}
      />,
    );
    const css = readCollectionLandingCss();

    expect(markup).toContain('--collection-page-surface:#123047');
    expect(markup).toContain('--collection-page-text:#ffffff');
    expect(markup).toContain('introHeroBreadcrumbs');
    expect(markup).toContain('data-hero-button-tone="white"');
    expect(markup).toContain('interactiveSurfaceDark');
    expect(markup).toContain('heroMediaFrame');
    expect(markup).toContain('heroMediaImage');
    expect(css).not.toContain('.introImage');
    expect(css).not.toContain('--lego-button-accent-background');
    expect(css).not.toContain('--lego-button-secondary-border-color');
    expect(css).toContain('--catalog-hero-media-object-fit: contain;');
    expect(css).toContain('.introHeroBreadcrumbs {');
    expect(css).toContain('--lego-breadcrumb-link: currentColor;');
    expect(css).toContain('--lego-breadcrumb-link-hover: currentColor;');
    expect(css).toContain('--lego-button-focus-ring-color: currentColor;');
    expect(css).toContain('color: var(--collection-page-text);');
  });

  it('renders a compact empty state when collection data is missing', () => {
    const config = getCatalogCollectionLandingPageConfig('nieuwe-lego-sets');

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="newest"
        config={config}
        setCards={[]}
        totalSetCount={0}
      />,
    );

    expect(markup).toContain(
      'Deze collectie wacht nog op genoeg betrouwbare catalogusdata.',
    );
    expect(markup).not.toContain('data-catalog-set-card-collection="true"');
  });

  it('renders an honest coverage note for thin retiring data', () => {
    const config = getCatalogCollectionLandingPageConfig('retiring-lego-sets');

    if (!config) {
      throw new Error('Missing test config.');
    }

    const markup = renderToStaticMarkup(
      <CatalogFeatureCollectionLandingPage
        activeSortKey="recommended"
        config={config}
        pageSize={40}
        setCards={[
          {
            id: '75331',
            slug: 'the-razor-crest-75331',
            name: 'The Razor Crest',
            theme: 'Star Wars',
            releaseYear: 2022,
            pieces: 6187,
          },
        ]}
        totalSetCount={1}
      />,
    );

    expect(markup).toContain('href="#top"');
    expect(markup).toContain('Terug naar boven');
    expect(markup).toContain(
      'alleen sets met een expliciet retiring- of retired-signaal',
    );
  });
});
