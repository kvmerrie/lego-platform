import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AffiliateFeatureOffers,
  AffiliateFeaturePrimaryOfferAction,
} from './affiliate-feature-offers';

describe('AffiliateFeatureOffers', () => {
  it('renders the reviewed Dutch merchant offers for a commerce-enabled set', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers setId="10316" />,
    );

    expect(markup).toContain('Reviewed offers');
    expect(markup).toContain('Merchant');
    expect(markup).toContain('Availability');
    expect(markup).toContain('Price');
    expect(markup).toContain('LEGO NL');
    expect(markup).toContain('Reviewed offer');
    expect(markup).toContain('Checked');
    expect(markup).toContain('Shop at LEGO NL');
    expect(markup).toContain('Direct official merchant link.');
  });

  it('renders a compact unavailable state when no offer snapshot exists', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers setId="10305" />,
    );

    expect(markup).toContain('Reviewed offers');
    expect(markup).toContain(
      'Reviewed Dutch offers are live for selected sets.',
    );
  });

  it('renders the cheapest reviewed merchant CTA for the set-detail hero', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeaturePrimaryOfferAction setId="10316" />,
    );

    expect(markup).toContain('Shop at bol');
    expect(markup).not.toContain('Cheapest reviewed offer');
    expect(markup).not.toContain('Checked');
  });
});
