import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PricingFeaturePricePanel } from './pricing-feature-price-panel';

describe('PricingFeaturePricePanel', () => {
  it('renders the current Dutch market pricing panel for a commerce-enabled set', () => {
    const markup = renderToStaticMarkup(
      <PricingFeaturePricePanel setId="10316" />,
    );

    expect(markup).toContain('Current Dutch market price');
    expect(markup).toContain('489,99');
    expect(markup).toContain('Current reviewed price');
    expect(markup).toContain('Lowest reviewed offer from bol');
    expect(markup).toContain('Reviewed');
  });

  it('renders a compact unavailable state outside the current commerce slice', () => {
    const markup = renderToStaticMarkup(
      <PricingFeaturePricePanel setId="10305" />,
    );

    expect(markup).toContain('Current Dutch market price');
    expect(markup).toContain(
      'not in the current reviewed Dutch commerce slice',
    );
    expect(markup).toContain('Collector browsing still works normally');
  });
});
