import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureDiscover } from './catalog-feature-discover';

describe('CatalogFeatureDiscover', () => {
  it('renders a featured section followed by theme-based browse sections', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureDiscover />);

    expect(markup).toContain('Explore the public set catalog');
    expect(markup).toContain('Start with a standout shortlist');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Ideas');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('Avengers Tower');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });
});
