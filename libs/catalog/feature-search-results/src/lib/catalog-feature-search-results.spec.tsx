import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogFeatureSearchResults,
  CatalogFeatureSearchResultsLoading,
} from './catalog-feature-search-results';

const avengersSearchMatch = {
  discoverRank: 1,
  score: 0,
  setCard: {
    id: '76269',
    slug: 'avengers-tower-76269',
    name: 'Avengers Tower',
    theme: 'Marvel',
    releaseYear: 2023,
    pieces: 5201,
  },
} as const;

const atAtSearchMatch = {
  discoverRank: 1,
  score: 0,
  setCard: {
    id: '75313',
    slug: 'at-at-75313',
    name: 'AT-AT',
    theme: 'Star Wars',
    releaseYear: 2021,
    pieces: 6785,
  },
} as const;

const razorCrestSearchMatch = {
  discoverRank: 1,
  score: 0,
  setCard: {
    id: '75331',
    slug: 'the-razor-crest-75331',
    name: 'The Razor Crest',
    theme: 'Star Wars',
    releaseYear: 2022,
    pieces: 6187,
    minifigureHighlights: ['Grogu'],
  },
} as const;

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

  it('renders a shared search entry when the empty state receives one', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        searchEntry={<form action="/search">Zoek direct</form>}
      />,
    );

    expect(markup).toContain('Zoek direct');
    expect(markup).toContain('action="/search"');
  });

  it('renders matching catalog cards for a query', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="avengers"
        searchMatches={[avengersSearchMatch]}
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
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });

  it('renders theme results separately from set cards', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="Star War"
        searchMatches={[]}
        themeMatches={[
          {
            score: 1,
            theme: {
              themeSnapshot: {
                momentum: 'Ships, helmets and display sets.',
                name: 'Star Wars™',
                setCount: 42,
                signatureSet: 'AT-AT',
                slug: 'star-wars',
              },
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Resultaten voor &quot;Star War&quot;');
    expect(markup).toContain('0 passende sets · 1 thema');
    expect(markup).toContain('Thema&#x27;s');
    expect(markup).toContain('Star Wars™');
    expect(markup).toContain('42 sets');
    expect(markup).toContain('href="/themes/star-wars"');
    expect(markup).not.toContain('CatalogSetCard');
  });

  it('still returns the right set when no reviewed price context is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="at-at"
        searchMatches={[atAtSearchMatch]}
      />,
    );

    expect(markup).toContain('AT-AT');
    expect(markup).toContain('href="/sets/at-at-75313"');
  });

  it('renders character-name matches when a query hits curated minifigure highlights', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="grogu"
        searchMatches={[razorCrestSearchMatch]}
      />,
    );

    expect(markup).toContain('Resultaten voor &quot;grogu&quot;');
    expect(markup).toContain('The Razor Crest');
    expect(markup).toContain('href="/sets/the-razor-crest-75331"');
  });

  it('does not fall back to local collector prose when no reviewed price or minifigure context exists', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        query="rivendell"
        searchMatches={[
          {
            discoverRank: 1,
            score: 0,
            setCard: {
              id: '10316',
              slug: 'rivendell-10316',
              name: 'Rivendell',
              theme: 'Icons',
              releaseYear: 2023,
              pieces: 6167,
              collectorAngle: 'Epic fantasy display centerpiece',
              tagline: 'A premium fantasy build with broad collector reach.',
              availability: 'Steady flagship demand',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Rivendell');
    expect(markup).not.toContain('Epic fantasy display centerpiece');
    expect(markup).not.toContain(
      'A premium fantasy build with broad collector reach.',
    );
  });

  it('renders quick filters and keeps best-deal results when a deal filter is active', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults
        activeFilter="best-deals"
        query="avengers"
        searchMatches={[avengersSearchMatch]}
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
        searchMatches={[avengersSearchMatch]}
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
