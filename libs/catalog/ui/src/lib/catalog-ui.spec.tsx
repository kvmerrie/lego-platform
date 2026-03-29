import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogSetCard } from './catalog-ui';

describe('CatalogSetCard', () => {
  it('renders enriched featured-set discovery context when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest current offer from bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Reviewed 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          priceRange: '$499 to $569',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
      />,
    );

    expect(markup).toContain('Current reviewed price');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Lowest current offer from bol');
    expect(markup).toContain('Coverage');
    expect(markup).toContain('Freshness');
    expect(markup).toContain('Collector angle');
    expect(markup).toContain('Availability posture');
    expect(markup).toContain('Healthy but premium availability');
    expect(markup).toContain('Prestige display anchor');
    expect(markup).toContain('EUR 10.00 below ref');
  });
});
