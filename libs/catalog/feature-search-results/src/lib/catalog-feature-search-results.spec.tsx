import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogFeatureSearchResults,
  CatalogFeatureSearchResultsLoading,
} from './catalog-feature-search-results';

describe('CatalogFeatureSearchResults', () => {
  it('renders an empty-query state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureSearchResults />);

    expect(markup).toContain('Search sets');
    expect(markup).toContain(
      'Search by set name or set number to jump straight into reviewed prices, fan context, and set details.',
    );
    expect(markup).toContain('<h1');
    expect(markup).toContain('Browse the catalog');
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

    expect(markup).toContain('Results for &quot;avengers&quot;');
    expect(markup).toContain('<h1');
    expect(markup).toContain('1 matching set');
    expect(markup).toContain('1 with reviewed pricing');
    expect(markup).toContain('Avengers Tower');
    expect(markup).toContain('Reviewed');
    expect(markup).toContain('at bol');
    expect(markup).toContain('below reference');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
    expect(markup).not.toContain('Reviewed price');
  });

  it('falls back to minifigure highlights when no reviewed price context is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="at-at" />,
    );

    expect(markup).toContain('AT-AT');
    expect(markup).toContain(
      'Includes Luke Skywalker, General Veers, and Snowtrooper Commander',
    );
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

    expect(markup).toContain('aria-label="Refine search results"');
    expect(markup).toContain('href="/search?q=avengers&amp;filter=best-deals"');
    expect(markup).toContain('1 matching set · Best deals');
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

    expect(markup).toContain('aria-label="Refine search results"');
    expect(markup).toContain('No star wars matches');
    expect(markup).toContain(
      '&quot;avengers&quot; has matches, but none in star wars.',
    );
    expect(markup).toContain('href="/search?q=avengers"');
    expect(markup).toContain('Show all matches');
  });

  it('renders a no-results state when nothing matches', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="pirates hideout" />,
    );

    expect(markup).toContain('No results for &quot;pirates hideout&quot;');
    expect(markup).toContain('<h1');
    expect(markup).toContain(
      'Try a set number like 75355 or a stronger set name.',
    );
    expect(markup).toContain('Browse the catalog');
  });
});

describe('CatalogFeatureSearchResultsLoading', () => {
  it('renders a lightweight loading state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureSearchResultsLoading />);

    expect(markup).toContain('Searching sets');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Looking through the current set catalog.');
  });
});
