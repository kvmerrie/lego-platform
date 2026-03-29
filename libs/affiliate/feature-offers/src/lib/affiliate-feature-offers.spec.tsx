import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AffiliateFeatureOffers } from './affiliate-feature-offers';

describe('AffiliateFeatureOffers', () => {
  it('renders the reviewed Dutch merchant offers for a commerce-enabled set', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers setId="10316" />,
    );

    expect(markup).toContain('Current Dutch offers');
    expect(markup).toContain('LEGO NL');
    expect(markup).toContain('Shop direct');
  });

  it('renders a compact unavailable state when no offer snapshot exists', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers setId="10305" />,
    );

    expect(markup).toContain('Current Dutch offers');
    expect(markup).toContain('does not have a reviewed Dutch offer list');
  });
});
