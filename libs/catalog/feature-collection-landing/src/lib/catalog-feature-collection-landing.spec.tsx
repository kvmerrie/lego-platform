import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getCatalogCollectionLandingPageConfig } from '@lego-platform/catalog/util';
import { CatalogFeatureCollectionLandingPage } from './catalog-feature-collection-landing';

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
    const css = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/catalog-feature-collection-landing.module.css',
      ),
      'utf-8',
    );

    expect(markup).toContain('--collection-page-surface:#123047');
    expect(markup).toContain('--collection-page-text:#ffffff');
    expect(markup).toContain('data-hero-button-tone="white"');
    expect(markup).toContain('interactiveSurfaceDark');
    expect(markup).toContain('heroMediaFrame');
    expect(markup).toContain('heroMediaImage');
    expect(css).not.toContain('.introImage');
    expect(css).not.toContain('--lego-button-accent-background');
    expect(css).not.toContain('--lego-button-secondary-border-color');
    expect(css).toContain('--catalog-hero-media-object-fit: contain;');
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
