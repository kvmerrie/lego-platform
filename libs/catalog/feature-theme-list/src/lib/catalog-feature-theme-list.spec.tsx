import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureThemeList } from './catalog-feature-theme-list';
import { CatalogFeatureThemeSpotlight } from './catalog-feature-theme-spotlight';

describe('CatalogFeatureThemeList', () => {
  it('renders storefront-style theme browsing tiles with theme imagery', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureThemeList />);

    expect(markup).toContain('Explore by theme');
    expect(markup).toContain('theme pages ready to browse');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg"',
    );
  });

  it('renders a non-rail theme spotlight block for deeper homepage browsing', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureThemeSpotlight />);

    expect(markup).toContain('Theme spotlight');
    expect(markup).toContain('Pick a theme and keep browsing from there');
    expect(markup).toContain(
      '4 stronger catalog lanes, each with its own page',
    );
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/star-wars"');
  });
});
