import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogFeatureSearchResults,
  CatalogFeatureSearchResultsLoading,
} from './catalog-feature-search-results';

describe('CatalogFeatureSearchResults', () => {
  it('renders an empty-query state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureSearchResults />);

    expect(markup).toContain('Zoek sets');
    expect(markup).toContain(
      'Zoek op setnaam, personage of setnummer om direct naar reviewed prijzen, fancontext en setdetails te springen.',
    );
    expect(markup).toContain('<h1');
    expect(markup).toContain('Bekijk de catalogus');
    expect(markup).toContain('href="/discover"');
  });

  it('renders matching catalog cards for a query', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="avengers"
        reviewedPriceContexts={[
          {
            currencyCode: 'EUR',
            deltaMinor: -3000,
            headlinePriceMinor: 46999,
            merchantName: 'bol',
            setId: '76269',
          },
        ]}
      />,
    );

    expect(markup).toContain('Resultaten voor &quot;avengers&quot;');
    expect(markup).toContain('<h1');
    expect(markup).toContain('1 passende set');
    expect(markup).toContain('1 met reviewed prijzen');
    expect(markup).toContain('Avengers Tower');
    expect(markup).toContain('Reviewed prijs');
    expect(markup).toContain('bij bol');
    expect(markup).toContain('onder de referentie');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
    expect(markup).not.toContain('Reviewed price');
  });

  it('falls back to minifigure highlights when no reviewed price context is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="at-at" />,
    );

    expect(markup).toContain('AT-AT');
    expect(markup).toContain('Luke Skywalker');
    expect(markup).toContain('General Veers');
    expect(markup).toContain('Snowtrooper Commander');
    expect(markup).toContain('Met');
  });

  it('renders character-name matches when a query hits curated minifigure highlights', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="grogu" />,
    );

    expect(markup).toContain('Resultaten voor &quot;grogu&quot;');
    expect(markup).toContain('The Razor Crest');
    expect(markup).toContain('The Mandalorian');
    expect(markup).toContain('Grogu');
    expect(markup).toContain('Kuiil');
    expect(markup).toContain('Met');
    expect(markup).toContain('href="/sets/the-razor-crest-75331"');
  });

  it('renders quick filters and keeps best-deal results when a deal filter is active', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        activeFilter="best-deals"
        query="avengers"
        reviewedPriceContexts={[
          {
            currencyCode: 'EUR',
            deltaMinor: -3000,
            headlinePriceMinor: 46999,
            merchantName: 'bol',
            setId: '76269',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="Verfijn zoekresultaten"');
    expect(markup).toContain('href="/search?q=avengers&amp;filter=best-deals"');
    expect(markup).toContain('1 passende set · Beste deals');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Avengers Tower');
  });

  it('renders a filtered empty state when no result matches the selected quick filter', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        activeFilter="star-wars"
        query="avengers"
        reviewedPriceContexts={[
          {
            currencyCode: 'EUR',
            deltaMinor: -3000,
            headlinePriceMinor: 46999,
            merchantName: 'bol',
            setId: '76269',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="Verfijn zoekresultaten"');
    expect(markup).toContain('Geen star wars treffers');
    expect(markup).toContain(
      '&quot;avengers&quot; heeft wel treffers, maar niets in star wars.',
    );
    expect(markup).toContain('href="/search?q=avengers"');
    expect(markup).toContain('Toon alle treffers');
  });

  it('renders a no-results state when nothing matches', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="pirates hideout" />,
    );

    expect(markup).toContain(
      'Geen resultaten voor &quot;pirates hideout&quot;',
    );
    expect(markup).toContain('<h1');
    expect(markup).toContain(
      'Probeer een setnummer zoals 75355 of een sterkere setnaam.',
    );
    expect(markup).toContain('Bekijk de catalogus');
  });
});

describe('CatalogFeatureSearchResultsLoading', () => {
  it('renders a lightweight loading state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureSearchResultsLoading />);

    expect(markup).toContain('Sets worden gezocht');
    expect(markup).toContain('<h1');
    expect(markup).toContain('De huidige setcatalogus wordt doorzocht.');
  });
});
