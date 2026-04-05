import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureThemeList } from './catalog-feature-theme-list';
import { CatalogFeatureThemeSpotlight } from './catalog-feature-theme-spotlight';

describe('CatalogFeatureThemeList', () => {
  it('renders storefront-style theme browsing tiles with theme imagery', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureThemeList />);

    expect(markup).toContain('Rivendell, toren of supercar?');
    expect(markup).toContain('6 werelden, 6 totaal andere dozen');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg"',
    );
    expect(markup).not.toContain('Premium collectors are consolidating around');
  });

  it('renders a non-rail theme spotlight block for deeper homepage browsing', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureThemeSpotlight />);

    expect(markup).toContain('Andere hoek van de kast');
    expect(markup).toContain('Draak of walker?');
    expect(markup).toContain('4 thema&#x27;s, heel andere sfeer');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/star-wars"');
  });
});
