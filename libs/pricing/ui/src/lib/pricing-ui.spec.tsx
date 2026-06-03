import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getPriceHistoryTooltipLines,
  getPriceHistoryTooltipTitle,
} from './price-history-canvas-chart';
import {
  PriceHistoryCard,
  PriceHistoryEmptyCard,
  PriceHistorySummaryCallout,
  PriceSummaryCard,
} from './pricing-ui';

describe('pricing ui history surfaces', () => {
  it('uses a fixed-height Chart.js canvas without resize lifecycle work', () => {
    const css = readFileSync(join(__dirname, 'pricing-ui.module.css'), 'utf8');
    const chartSource = readFileSync(
      join(__dirname, 'price-history-canvas-chart.tsx'),
      'utf8',
    );
    const pricingSource = readFileSync(
      join(__dirname, 'pricing-ui.tsx'),
      'utf8',
    );

    expect(css).toMatch(/\.historyChartShell\s*{[^}]*contain:\s*paint;/s);
    expect(css).toMatch(
      /\.historyCanvas\s*{[^}]*block-size:\s*var\(--pricing-history-chart-height\);/s,
    );
    expect(css).toMatch(/\.historyCanvas\s*{[^}]*inline-size:\s*100%;/s);
    expect(css).not.toContain('.historyGridLine');
    expect(css).not.toContain('.historyLine');
    expect(css).not.toContain('.historyPoint');
    expect(css).not.toContain('aspect-ratio: 100 / 48');
    expect(chartSource).toContain("from 'chart.js'");
    expect(chartSource).toContain('new Chart(canvas, config)');
    expect(chartSource).toContain("type: 'linear'");
    expect(chartSource).toContain('x: index');
    expect(chartSource).toContain('y: point.headlinePriceMinor');
    expect(chartSource).toContain('priceHistoryReferenceLines');
    expect(chartSource).toContain('beforeDatasetsDraw(chart)');
    expect(chartSource).toContain('responsive: false');
    expect(chartSource).toContain('animation: false');
    expect(chartSource).toContain('devicePixelRatio: getDevicePixelRatio()');
    expect(chartSource).toContain('context.fillStyle = value');
    expect(chartSource).not.toContain('ResizeObserver');
    expect(chartSource).not.toContain('MutationObserver');
    expect(chartSource).not.toContain("addEventListener('resize'");
    expect(chartSource).not.toContain('addEventListener("resize"');
    expect(pricingSource).not.toContain('<svg');
  });

  it('builds tooltip context with date, price, merchant and lowest-price copy', () => {
    const point = {
      headlinePriceMinor: 4899,
      label: '3 jun',
      merchantLabel: 'Goodbricks',
      valueLabel: '€ 48,99',
    };

    expect(getPriceHistoryTooltipTitle(point)).toBe('3 jun');
    expect(getPriceHistoryTooltipLines(point)).toEqual([
      '€ 48,99',
      'Laagste prijs bij Goodbricks',
      'Laagste prijs op dat moment',
    ]);
  });

  it('builds tooltip context without merchant data', () => {
    const point = {
      headlinePriceMinor: 4899,
      label: '3 jun',
      valueLabel: '€ 48,99',
    };

    expect(getPriceHistoryTooltipTitle(point)).toBe('3 jun');
    expect(getPriceHistoryTooltipLines(point)).toEqual([
      '€ 48,99',
      'Laagste prijs op dat moment',
    ]);
  });

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

    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('2 dagpunten');
    expect(markup).toContain('Recent Nederlandse prijsverloop');
    expect(markup).toContain('<canvas');
    expect(markup).toContain('aria-label="Recent Nederlandse prijsverloop"');
    expect(markup).not.toContain('Laagste prijs bij');
    expect(markup).not.toContain('<svg');
    expect(markup).toContain('30-daags laag');
    expect(markup).toContain('30-daags hoog');
    expect(markup).toContain('Zo liep de prijs de afgelopen 30 dagen.');
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

    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('We hebben nu 1 reviewed dagprijs voor deze set.');
    expect(markup).toContain('Prijsverloop bouwt nog op');
    expect(markup).toContain('1 dagpunt');
    expect(markup).not.toContain('1 dagpunten');
    expect(markup).toContain('Eerste bijgehouden prijs');
    expect(markup).toContain('Eerste dagprijs');
    expect(markup).toContain(
      'Het bijgehouden prijsbereik start vanaf deze eerste reviewed dag.',
    );
  });

  it('renders a compact empty state when history is not available yet', () => {
    const markup = renderToStaticMarkup(<PriceHistoryEmptyCard />);

    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain(
      'Voor deze set hebben we nog geen dagprijzen klaarstaan.',
    );
    expect(markup).not.toContain('<canvas');
    expect(markup).toContain('Prijsverloop bouwt nog op');
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

    expect(markup).not.toContain('Recent 30-day view');
    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('Beste deal nu');
    expect(markup).toContain('30-daags laag');
    expect(markup).toContain('30-daags hoog');
    expect(markup).toContain('Huidig vs gemiddelde');
    expect(markup).toContain('onder het 30-daags gemiddelde');
    expect(markup).toContain('30-daags gemiddelde:');
    expect(markup).toContain('Bijgehouden prijsbereik');
    expect(markup).toContain('Laagste bijgehouden prijs');
    expect(markup).toContain('Hoogste bijgehouden prijs');
    expect(markup).toContain('Bijgehouden sinds');
    expect(markup).toContain('Huidig vs bijgehouden laag');
    expect(markup).toContain('Huidig vs bijgehouden hoog');
    expect(markup).toContain('Bijgehouden vanaf');
  });

  it('renders a compact product-page pricing summary variant', () => {
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
        variant="product"
      />,
    );

    expect(markup).toContain('Laagste reviewed prijs');
    expect(markup).toContain('Nu het laagst bij bol');
    expect(markup).toContain('Beste deal nu');
    expect(markup).toContain('Gecheckt');
    expect(markup).not.toContain('Huidige reviewed prijs');
    expect(markup).not.toContain(
      'History and offers below use the same reviewed market view.',
    );
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

    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('We hebben nu 1 dagprijs voor deze set.');
    expect(markup).toContain('Bijgehouden prijsbereik');
    expect(markup).toContain('Gelijk aan bijgehouden laag');
    expect(markup).toContain('Gelijk aan bijgehouden hoog');
    expect(markup).toContain(
      'De bijgehouden geschiedenis start met een dagprijs.',
    );
  });

  it('falls back to lowest reviewed offer when no reference price exists yet', () => {
    const markup = renderToStaticMarkup(
      <PriceSummaryCard
        pricePanelSnapshot={{
          setId: '31208',
          regionCode: 'NL',
          currencyCode: 'EUR',
          condition: 'new',
          headlinePriceMinor: 8999,
          lowestMerchantId: 'lego',
          lowestMerchantName: 'LEGO',
          lowestAvailabilityLabel: 'In stock',
          merchantCount: 1,
          observedAt: '2026-03-30T09:00:00.000Z',
        }}
      />,
    );

    expect(markup).toContain('Laagste reviewed aanbieding');
    expect(markup).toContain('Tot nu toe pas 1 reviewed aanbieding');
    expect(markup).toContain('Nog geen referentieprijs.');
  });
});
