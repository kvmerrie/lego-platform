import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CatalogOffer } from '@lego-platform/affiliate/util';
import {
  AffiliateFeatureOffers,
  AffiliateFeaturePrimaryOfferAction,
} from './affiliate-feature-offers';

const catalogOffers: readonly CatalogOffer[] = [
  {
    setId: '10316',
    merchant: 'bol',
    merchantName: 'bol',
    url: 'https://www.bol.com/nl/nl/s/?searchtext=LEGO%2010316-1',
    priceCents: 48999,
    currency: 'EUR',
    availability: 'in_stock',
    condition: 'new',
    checkedAt: '2026-03-30T11:30:00.000Z',
    market: 'NL',
  },
  {
    setId: '10316',
    merchant: 'lego',
    merchantName: 'LEGO',
    url: 'https://www.lego.com/nl-nl/search?q=10316-1',
    priceCents: 49999,
    currency: 'EUR',
    availability: 'in_stock',
    condition: 'new',
    checkedAt: '2026-03-30T11:30:00.000Z',
    market: 'NL',
  },
];

describe('AffiliateFeatureOffers', () => {
  it('renders the reviewed Dutch merchant offers for a commerce-enabled set', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers affiliateOffers={catalogOffers} />,
    );

    expect(markup).toContain('Reviewed offers');
    expect(markup).toContain('Only 2 reviewed offers so far');
    expect(markup).toContain('Merchant');
    expect(markup).toContain('Price');
    expect(markup).toContain('Availability');
    expect(markup).toContain('Last checked');
    expect(markup).toContain('LEGO');
    expect(markup).toContain('Open offer');
    expect(markup).toContain(
      'Reviewed offers for this set, including merchant, price, availability, last checked time, and outbound action.',
    );
  });

  it('renders a compact unavailable state when no offer snapshot exists', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeatureOffers affiliateOffers={[]} />,
    );

    expect(markup).toContain('Reviewed offers');
    expect(markup).toContain(
      'We have not reviewed shop offers for this set yet.',
    );
  });

  it('renders the best in-stock merchant CTA for the set-detail hero', () => {
    const markup = renderToStaticMarkup(
      <AffiliateFeaturePrimaryOfferAction
        affiliateOffers={[
          {
            ...catalogOffers[0],
            setId: '42143',
            priceCents: 41999,
          },
          {
            ...catalogOffers[0],
            setId: '42143',
            merchant: 'amazon',
            merchantName: 'Amazon',
            url: 'https://www.amazon.nl/s?k=LEGO%2042143-1',
            priceCents: 40999,
          },
          {
            ...catalogOffers[1],
            setId: '42143',
            priceCents: 42999,
          },
        ]}
      />,
    );

    expect(markup).toContain('Shop at Amazon');
    expect(markup).not.toContain('Cheapest reviewed offer');
    expect(markup).not.toContain('Checked');
  });
});
