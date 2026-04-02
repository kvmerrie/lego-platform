import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogSetCard,
  CatalogSetDetailPanel,
  CatalogThemeHighlight,
} from './catalog-ui';

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
    expect(markup).toContain('alt="Rivendell LEGO set"');
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
        themeDirectoryHref="/themes"
        themeHref="/themes/ideas"
      />,
    );

    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="/themes/ideas"');
    expect(markup).toContain('Set context');
    expect(markup).toContain('Official image not published yet');
    expect(markup).toContain('Set 21335');
    expect(markup).toContain('Lowest reviewed price');
    expect(markup).toContain('30-day price history');
    expect(markup).toContain('What LEGO fans usually check first');
    expect(markup).toContain('Set number');
    expect(markup).toContain('Theme');
    expect(markup).toContain('Release year');
    expect(markup).toContain('Pieces');
    expect(markup).toContain('Minifigures');
    expect(markup).toContain('Not tracked locally yet');
    expect(markup).toContain('Collector take');
    expect(markup).toContain('Availability');
    expect(markup).toContain('<h1');
    expect(markup).not.toContain('Back to shortlist');
  });

  it('renders minifigure count in the detail specs grid when local data exists', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '10305',
          slug: 'lion-knights-castle-10305',
          name: "Lion Knights' Castle",
          theme: 'Icons',
          releaseYear: 2022,
          pieces: 4514,
          imageUrl: 'https://images.example/lion-knights-castle.jpg',
          priceRange: '$359 to $429',
          collectorAngle: 'Castle nostalgia tentpole',
          tagline:
            'A modern fortress build that lands squarely at the intersection of nostalgia and display value.',
          availability: 'Steady premium demand',
          collectorHighlights: [
            'High perceived value thanks to dense build volume and minifigure count',
          ],
          minifigureCount: 22,
        }}
      />,
    );

    expect(markup).toContain('Minifigures');
    expect(markup).toContain('22');
    expect(markup).not.toContain('Not tracked locally yet');
  });

  it('renders curated subtheme and set status when local fan metadata is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
          name: "Gringotts Wizarding Bank - Collectors' Edition",
          theme: 'Harry Potter',
          subtheme: 'Diagon Alley',
          setStatus: 'backorder',
          releaseYear: 2023,
          pieces: 4803,
          imageUrl: 'https://images.example/gringotts.jpg',
          priceRange: '$369 to $449',
          collectorAngle: 'Wizarding World premium landmark',
          tagline:
            'A major Gringotts display build that gives Harry Potter a stronger premium anchor beyond the smaller Hogwarts panorama.',
          availability: 'High-visibility franchise demand',
          collectorHighlights: [
            'Broad franchise recognition makes it a strong search target for casual and deep collectors alike',
          ],
          minifigureCount: 13,
        }}
      />,
    );

    expect(markup).toContain('Subtheme');
    expect(markup).toContain('Diagon Alley');
    expect(markup).toContain('Status');
    expect(markup).toContain('Back order');
    expect(markup).toContain('Minifigures');
    expect(markup).toContain('13');
  });

  it('renders curated minifigure highlights as a lightweight includes line', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '75397',
          slug: 'jabbas-sail-barge-75397',
          name: "Jabba's Sail Barge",
          theme: 'Star Wars',
          releaseYear: 2024,
          pieces: 3942,
          imageUrl: 'https://images.example/jabbas-sail-barge.jpg',
          priceRange: '$429 to $529',
          collectorAngle: 'Original Trilogy prestige centerpiece',
          tagline:
            'A large desert-scene flagship that gives Star Wars collectors a more cinematic shelf landmark than another fighter or walker.',
          availability: 'Fresh flagship demand',
          collectorHighlights: [
            'Return of an iconic trilogy scene makes it highly legible in browse and search',
          ],
          minifigureCount: 11,
          minifigureHighlights: [
            'Jabba the Hutt',
            'Princess Leia',
            'Bib Fortuna',
            'Max Rebo',
          ],
        }}
      />,
    );

    expect(markup).toContain('Includes');
    expect(markup).toContain(
      'Jabba the Hutt, Princess Leia, Bib Fortuna, Max Rebo',
    );
  });

  it('renders a larger theme tile variant for storefront browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/icons"
        imageUrl="https://images.example/rivendell.jpg"
        themeSnapshot={{
          name: 'Icons',
          slug: 'icons',
          setCount: 14,
          momentum:
            'Premium collectors are consolidating around large display pieces.',
          signatureSet: 'Rivendell',
        }}
        variant="tile"
      />,
    );

    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('src="https://images.example/rivendell.jpg"');
    expect(markup).toContain('Open theme page');
    expect(markup).toContain('Start with Rivendell');
  });

  it('renders a leaner homepage theme tile variant for fast browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/icons"
        homepageVisual={{
          backgroundColor: '#f0c63b',
          imageUrl: 'https://images.example/curated-rivendell.jpg',
          textColor: '#171a22',
        }}
        imageUrl="https://images.example/fallback-rivendell.jpg"
        themeSnapshot={{
          name: 'Icons',
          slug: 'icons',
          setCount: 14,
          momentum:
            'Premium collectors are consolidating around large display pieces.',
          signatureSet: 'Rivendell',
        }}
        variant="homepage"
      />,
    );

    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain(
      'src="https://images.example/curated-rivendell.jpg"',
    );
    expect(markup).toContain('Icons');
    expect(markup).toContain('14 sets');
    expect(markup).toContain('--theme-home-surface:#f0c63b');
    expect(markup).toContain('--theme-home-text:#171a22');
    expect(markup).not.toContain('Open theme page');
    expect(markup).not.toContain('Start with Rivendell');
    expect(markup).not.toContain(
      'Premium collectors are consolidating around large display pieces.',
    );
  });
});
