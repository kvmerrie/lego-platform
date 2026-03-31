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
    expect(markup).toContain(
      'A compact mix of flagship buys, crowd-pulling click magnets, and easier collector entry points.',
    );
    expect(markup).toContain('2 featured sets');
    expect(markup).toContain('1 with reviewed prices');
    expect(markup).not.toContain('Public catalog');
  });

  it('supports custom curation framing for alternate homepage rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        description="Reviewed Dutch prices currently showing the clearest gaps below reference."
        eyebrow="Deals"
        sectionId="best-current-deals"
        setCards={[
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
        signalText="3 sets worth a closer look"
        title="Best current deals"
      />,
    );

    expect(markup).toContain('id="best-current-deals"');
    expect(markup).toContain('Best current deals');
    expect(markup).toContain(
      'Reviewed Dutch prices currently showing the clearest gaps below reference.',
    );
    expect(markup).toContain('3 sets worth a closer look');
    expect(markup).not.toContain('1 featured sets');
  });
});
