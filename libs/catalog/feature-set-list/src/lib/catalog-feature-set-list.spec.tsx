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
            collectorAngle: 'Marvel flagship showcase',
            tagline:
              'A marquee licensed set with broad household recognizability.',
            availability: 'Stable with strong seasonal demand',
          },
        ]}
      />,
    );

    expect(markup).toContain('Torens, walkers, supercars');
    expect(markup).toContain('Wil je groot? Kijk hier.');
    expect(markup).toContain('2 dozen die je kast overnemen');
    expect(markup).toContain('1 met nagekeken prijzen');
    expect(markup).toContain('Scroll Torens, walkers, supercars naar links');
    expect(markup).toContain('Scroll Torens, walkers, supercars naar rechts');
    expect(markup).toContain('Vorige');
    expect(markup).toContain('Volgende');
    expect(markup).not.toContain('Public catalog');
  });

  it('supports custom curation framing for alternate homepage rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        description="Stond hij al op je lijst? Kijk nu."
        eyebrow="Prijs zakt"
        sectionId="best-current-deals"
        setCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
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
        signalText="3 dozen nu lager"
        title="Die doos komt dichterbij"
      />,
    );

    expect(markup).toContain('id="best-current-deals"');
    expect(markup).toContain('Die doos komt dichterbij');
    expect(markup).toContain('Stond hij al op je lijst? Kijk nu.');
    expect(markup).toContain('3 dozen nu lager');
    expect(markup).not.toContain('1 dozen die je kast overnemen');
  });
});
