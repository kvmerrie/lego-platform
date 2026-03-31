import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PricingFeaturePricePanel } from './pricing-feature-price-panel';

describe('PricingFeaturePricePanel', () => {
  it('renders the current Dutch market pricing panel for a commerce-enabled set', () => {
    const markup = renderToStaticMarkup(
      <PricingFeaturePricePanel setId="10316" />,
    );

    expect(markup).toContain('Current reviewed price');
    expect(markup).toContain('489,99');
    expect(markup).toContain('Reviewed price');
    expect(markup).toContain('Lowest reviewed price at bol');
    expect(markup).toContain('Best current deal');
    expect(markup).toContain('Only 2 reviewed offers so far');
    expect(markup).toContain(
      'History and offers below use the same reviewed market view.',
    );
    expect(markup).toContain('Last reviewed');
  });

  it('renders a compact unavailable state outside the current commerce slice', () => {
    const markup = renderToStaticMarkup(
      <PricingFeaturePricePanel setId="10305" />,
    );

    expect(markup).toContain('Current reviewed price');
    expect(markup).toContain('live for selected sets');
    expect(markup).toContain('Browsing and private saves still work.');
  });
});
