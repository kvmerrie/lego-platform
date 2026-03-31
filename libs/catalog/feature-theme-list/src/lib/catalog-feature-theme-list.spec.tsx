import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureThemeList } from './catalog-feature-theme-list';

describe('CatalogFeatureThemeList', () => {
  it('renders storefront-style theme browsing tiles linked into discover lanes', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureThemeList />);

    expect(markup).toContain('Explore by theme');
    expect(markup).toContain('theme pages worth opening');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
  });
});
