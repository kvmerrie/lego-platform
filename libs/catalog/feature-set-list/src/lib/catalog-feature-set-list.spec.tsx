import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureSetList } from './catalog-feature-set-list';

describe('CatalogFeatureSetList', () => {
  it('renders curated scanability signals for the featured-set shortlist', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        setCards={[
          {
            id: '21348',
            slug: 'dungeons-and-dragons-red-dragons-tale-21348',
            name: "Dungeons & Dragons: Red Dragon's Tale",
            theme: 'Ideas',
            releaseYear: 2024,
            pieces: 3747,
            priceRange: '$359 to $409',
            collectorAngle: 'Crossover audience magnet',
            tagline:
              'A community-driven release with rich minifigure storytelling hooks.',
            availability: 'Strong launch momentum',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 359.99',
              merchantLabel: 'Lowest reviewed price at bol',
              reviewedLabel: 'Checked 29 mrt',
            },
          },
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
        ]}
      />,
    );

    expect(markup).toContain('Start with sets worth opening.');
    expect(markup).toContain('2 featured sets');
    expect(markup).toContain('1 with reviewed prices');
    expect(markup).not.toContain('Public catalog');
  });
});
