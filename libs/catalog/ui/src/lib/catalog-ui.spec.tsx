import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogSetCard, CatalogSetDetailPanel } from './catalog-ui';

describe('CatalogSetCard', () => {
  it('renders a lighter browse-card variant for catalog exploration', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          priceRange: '$499 to $569',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="browse"
      />,
    );

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('A flagship fantasy build');
    expect(markup).toContain('2023 · $499 to $569');
    expect(markup).toContain('Open set');
    expect(markup).not.toContain('Reviewed price');
    expect(markup).not.toContain('Coverage');
  });

  it('renders a compact featured-card variant for homepage browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          priceRange: '$499 to $569',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('Reviewed price');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Lowest reviewed price at bol');
    expect(markup).toContain('EUR 10.00 below ref');
    expect(markup).toContain('Checked 29 mrt');
    expect(markup).toContain('Open set');
    expect(markup).not.toContain('Coverage');
    expect(markup).not.toContain('Freshness');
    expect(markup).not.toContain('Why collectors like it');
  });

  it('renders set imagery alongside featured-set discovery context when available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          priceRange: '$499 to $569',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
      />,
    );

    expect(markup).toContain('Reviewed price');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Lowest reviewed price at bol');
    expect(markup).toContain('src="https://images.example/rivendell.jpg"');
    expect(markup).toContain('alt="Rivendell set"');
    expect(markup).toContain('Coverage');
    expect(markup).toContain('Freshness');
    expect(markup).toContain('Why collectors like it');
    expect(markup).toContain('Availability');
    expect(markup).toContain('Healthy but premium availability');
    expect(markup).toContain('Prestige display anchor');
    expect(markup).toContain('EUR 10.00 below ref');
  });

  it('renders a calm image fallback on set detail pages when no catalog image is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '21335',
          slug: 'motorized-lighthouse-21335',
          name: 'Motorized Lighthouse',
          theme: 'Ideas',
          releaseYear: 2022,
          pieces: 2065,
          imageUrl: undefined,
          priceRange: '$259 to $319',
          collectorAngle: 'Kinetic display standout',
          tagline:
            'A mechanically animated coastal build that feels equally at home in premium display shelves and gift-led collector curation.',
          availability: 'Selective premium availability',
          collectorHighlights: [
            'Motorized light and rotating beacon create stronger live display presence than most static shelf pieces',
          ],
        }}
        productSummary={<div>Lowest reviewed price</div>}
        supportingPanel={<div>30-day price history</div>}
      />,
    );

    expect(markup).toContain('Official image not published yet');
    expect(markup).toContain('Set 21335');
    expect(markup).toContain('Lowest reviewed price');
    expect(markup).toContain('30-day price history');
    expect(markup).toContain('Why collectors keep coming back');
    expect(markup).not.toContain('Back to shortlist');
  });
});
