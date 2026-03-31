import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureDiscover } from './catalog-feature-discover';

describe('CatalogFeatureDiscover', () => {
  it('renders a featured section followed by theme-based browse sections', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureDiscover />);

    expect(markup).toContain('Browse the catalog by theme');
    expect(markup).toContain('Start with the sets people open first');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Ideas');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('id="theme-icons"');
    expect(markup).toContain('id="theme-marvel"');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('The Lord of the Rings: Barad-dûr');
    expect(markup).toContain('Vincent van Gogh - The Starry Night');
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

    expect(markup).toContain('Good time to buy');
    expect(markup).toContain(
      'The clearest current price gaps among the biggest flagships and recognizable sets already in the catalog.',
    );
    expect(markup).toContain('EUR 30.00 below reference');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });
});
