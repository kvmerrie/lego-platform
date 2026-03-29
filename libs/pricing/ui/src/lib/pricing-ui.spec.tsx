import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PriceHistoryCard,
  PriceHistoryEmptyCard,
  PriceHistorySummaryCallout,
  PriceSummaryCard,
} from './pricing-ui';

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

  it('renders a calm building state when only one daily history point exists', () => {
    const markup = renderToStaticMarkup(
      <PriceHistoryCard
        priceHistoryPoints={[
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
    expect(markup).toContain('History is building');
    expect(markup).toContain('1 daily point');
    expect(markup).not.toContain('1 daily points');
    expect(markup).toContain('Latest recorded price');
  });

  it('renders a compact empty state when history is not available yet', () => {
    const markup = renderToStaticMarkup(<PriceHistoryEmptyCard />);

    expect(markup).toContain('30-day price history');
    expect(markup).toContain(
      'History is building. No reviewed daily point has been stored for this set yet.',
    );
  });

  it('renders a compact 30-day summary block for the current price panel', () => {
    const markup = renderToStaticMarkup(
      <PriceSummaryCard
        pricePanelSnapshot={{
          setId: '10316',
          regionCode: 'NL',
          currencyCode: 'EUR',
          condition: 'new',
          headlinePriceMinor: 48999,
          lowestMerchantId: 'bol',
          lowestMerchantName: 'bol',
          lowestAvailabilityLabel: 'In stock',
          merchantCount: 3,
          observedAt: '2026-03-29T09:00:00.000Z',
          referencePriceMinor: 49999,
          deltaMinor: -1000,
        }}
      >
        <PriceHistorySummaryCallout
          priceHistorySummary={{
            currencyCode: 'EUR',
            currentHeadlinePriceMinor: 48999,
            averagePriceMinor: 49249,
            deltaVsAverageMinor: -250,
            lowPriceMinor: 48999,
            highPriceMinor: 49499,
            pointCount: 2,
          }}
          trackedPriceSummary={{
            currencyCode: 'EUR',
            currentHeadlinePriceMinor: 48999,
            deltaVsTrackedLowMinor: 0,
            deltaVsTrackedHighMinor: -2000,
            pointCount: 3,
            trackedLowPriceMinor: 48999,
            trackedHighPriceMinor: 50999,
            trackedSinceRecordedOn: '2026-03-20',
          }}
        />
      </PriceSummaryCard>,
    );

    expect(markup).toContain('30-day summary');
    expect(markup).toContain('30-day low');
    expect(markup).toContain('30-day high');
    expect(markup).toContain('Current vs average');
    expect(markup).toContain('below 30-day average');
    expect(markup).toContain('30-day average:');
    expect(markup).toContain('Tracked price range');
    expect(markup).toContain('Lowest tracked price');
    expect(markup).toContain('Highest tracked price');
    expect(markup).toContain('Tracked since');
    expect(markup).toContain('Current vs tracked low');
    expect(markup).toContain('Current vs tracked high');
  });

  it('renders a calm fallback when only one history point exists so far', () => {
    const markup = renderToStaticMarkup(
      <PriceHistorySummaryCallout
        historyPointCount={1}
        trackedPriceSummary={{
          currencyCode: 'EUR',
          currentHeadlinePriceMinor: 48999,
          deltaVsTrackedLowMinor: 0,
          deltaVsTrackedHighMinor: 0,
          pointCount: 1,
          trackedLowPriceMinor: 48999,
          trackedHighPriceMinor: 48999,
          trackedSinceRecordedOn: '2026-03-29',
        }}
      />,
    );

    expect(markup).toContain('30-day summary');
    expect(markup).toContain(
      'History is building. One daily point has been recorded so far, so 30-day range and average comparisons will appear after the next reviewed point.',
    );
    expect(markup).toContain('Tracked price range');
    expect(markup).toContain('Matches tracked low');
    expect(markup).toContain('Matches tracked high');
  });
});
