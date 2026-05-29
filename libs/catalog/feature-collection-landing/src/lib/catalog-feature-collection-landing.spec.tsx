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

  it('keeps the destination hero on the default Brickhunt styling', () => {
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
    expect(markup).toContain('Nieuwe LEGO sets');
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
