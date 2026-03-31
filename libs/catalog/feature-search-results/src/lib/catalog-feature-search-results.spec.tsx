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
      'Search by set name or set number to go straight to a set page.',
    );
    expect(markup).toContain('Browse the catalog');
    expect(markup).toContain('href="/discover"');
  });

  it('renders matching catalog cards for a query', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="avengers" />,
    );

    expect(markup).toContain('Results for &quot;avengers&quot;');
    expect(markup).toContain('1 matching set');
    expect(markup).toContain('Avengers Tower');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
    expect(markup).not.toContain('Reviewed price');
  });

  it('renders a no-results state when nothing matches', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSearchResults query="pirates hideout" />,
    );

    expect(markup).toContain('No results for &quot;pirates hideout&quot;');
    expect(markup).toContain('Try another set name or set number.');
    expect(markup).toContain('Browse the catalog');
  });
});

describe('CatalogFeatureSearchResultsLoading', () => {
  it('renders a lightweight loading state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureSearchResultsLoading />);

    expect(markup).toContain('Searching sets');
    expect(markup).toContain('Looking through the current set catalog.');
  });
});
