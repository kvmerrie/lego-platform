import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PriceHistoryCard, PriceHistoryEmptyCard } from './pricing-ui';

describe('pricing ui history surfaces', () => {
  it('renders a compact 30-day chart when history points exist', () => {
    const markup = renderToStaticMarkup(
      <PriceHistoryCard
        priceHistoryPoints={[
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 49499,
            referencePriceMinor: 49999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-03-28T09:00:00.000Z',
            recordedOn: '2026-03-28',
          },
          {
            setId: '10316',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 48999,
            referencePriceMinor: 49999,
            lowestMerchantId: 'bol',
            observedAt: '2026-03-29T09:00:00.000Z',
            recordedOn: '2026-03-29',
          },
        ]}
      />,
    );

    expect(markup).toContain('30-day price history');
    expect(markup).toContain('2 daily points');
    expect(markup).toContain('30-day Dutch price history');
    expect(markup).toContain('30-day low');
    expect(markup).toContain('30-day high');
  });

  it('renders a compact empty state when history is not available yet', () => {
    const markup = renderToStaticMarkup(<PriceHistoryEmptyCard />);

    expect(markup).toContain('30-day price history');
    expect(markup).toContain(
      'No 30-day pricing history is available for this set yet.',
    );
  });
});
