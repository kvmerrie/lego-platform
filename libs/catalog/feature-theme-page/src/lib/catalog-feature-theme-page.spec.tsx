import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
