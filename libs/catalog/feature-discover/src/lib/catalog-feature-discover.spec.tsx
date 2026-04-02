import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureDiscover } from './catalog-feature-discover';

describe('CatalogFeatureDiscover', () => {
  it('renders deals, highlights, and the strongest theme lanes in a guided order', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover
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
            minifigureHighlights: ['Iron Man', 'Captain America', 'Thor'],
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        reviewedSetIds={['76269', '10316', '10333']}
      />,
    );

    expect(markup).toContain('Open the strongest sets first');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Best deals to check first');
    expect(markup).toContain('Iconic characters and cast favorites');
    expect(markup).toContain('Worth opening first');
    expect(markup.indexOf('Best deals to check first')).toBeLessThan(
      markup.indexOf('Iconic characters and cast favorites'),
    );
    expect(markup.indexOf('Iconic characters and cast favorites')).toBeLessThan(
      markup.indexOf('Worth opening first'),
    );
    expect(markup).toContain('Includes Iron Man, Captain America, and Thor');
    expect(markup).toContain(
      'Includes Spider-Man, Green Goblin, and Daredevil',
    );
    expect(markup).toContain('Browse all themes');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Ideas');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('Technic');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).not.toContain('href="/themes/botanicals"');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('The Lord of the Rings: Barad-dûr');
    expect(markup).toContain('Titanic');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain(
      'href="/sets/the-lord-of-the-rings-barad-dur-10333"',
    );
  });

  it('renders a compact deal section when reviewed deal cards are supplied', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover
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
            minifigureHighlights: ['Iron Man', 'Captain America', 'Thor'],
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Best deals to check first');
    expect(markup).toContain(
      'The clearest reviewed price gaps among the strongest flagship and click-magnet sets already in the catalog.',
    );
    expect(markup).toContain('EUR 30.00 below reference');
    expect(markup).toContain('Includes Iron Man, Captain America, and Thor');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });

  it('renders discover quick filters and a calm empty state when the active filter has no matches', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover activeFilter="best-deals" />,
    );

    expect(markup).toContain('aria-label="Refine discover"');
    expect(markup).toContain('href="/discover"');
    expect(markup).toContain('href="/discover?filter=best-deals"');
    expect(markup).toContain('No matches in Best deals');
    expect(markup).toContain('Show all sets');
  });

  it('filters theme lanes down to the selected theme chip', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover activeFilter="marvel" />,
    );

    expect(markup).toContain('href="/discover?filter=marvel"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).not.toContain('href="/themes/icons"');
  });
});
