import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureThemeIndex } from './catalog-feature-theme-index';
import { CatalogFeatureThemePage } from './catalog-feature-theme-page';

describe('CatalogFeatureThemePage', () => {
  it('renders a dedicated theme landing with browse grid and optional deals', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        dealSetCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
            priceRange: '$449 to $519',
            collectorAngle: 'Marvel flagship showcase',
            tagline:
              'A marquee licensed set with broad household recognizability.',
            availability: 'Stable with strong seasonal demand',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        themePage={{
          themeSnapshot: {
            name: 'Marvel',
            slug: 'marvel',
            setCount: 3,
            momentum:
              'Marvel now reads as a real collector lane with both a flagship tower and a landmark companion build.',
            signatureSet: 'Avengers Tower',
          },
          setCards: [
            {
              id: '76269',
              slug: 'avengers-tower-76269',
              name: 'Avengers Tower',
              theme: 'Marvel',
              releaseYear: 2023,
              pieces: 5202,
              priceRange: '$449 to $519',
              collectorAngle: 'Marvel flagship showcase',
              tagline:
                'A marquee licensed set with broad household recognizability.',
              availability: 'Stable with strong seasonal demand',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('Marvel');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Good time to buy in Marvel');
    expect(markup).toContain('All Marvel sets');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });
});

describe('CatalogFeatureThemeIndex', () => {
  it('renders a calm theme directory without set rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/icons.jpg',
            themeSnapshot: {
              name: 'Icons',
              slug: 'icons',
              setCount: 14,
              momentum:
                'Big display-led builds, nostalgic callbacks, and collector anchors.',
              signatureSet: 'Rivendell',
            },
          },
          {
            imageUrl: 'https://images.example/marvel.jpg',
            themeSnapshot: {
              name: 'Marvel',
              slug: 'marvel',
              setCount: 3,
              momentum:
                'Superhero flagships and skyline-style display builds with broad recognition.',
              signatureSet: 'Avengers Tower',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Browse every theme');
    expect(markup).toContain('2 theme pages');
    expect(markup).toContain('Discover stays better for mixed browsing');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain('src="https://images.example/icons.jpg"');
    expect(markup).not.toContain('href="/sets/');
  });
});
