import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildCompactOfferPresentation } from './catalog-offer-comparison-rail';
import {
  CatalogKeyFacts,
  CatalogOfferComparison,
  CatalogPriceDecisionPanel,
  CatalogTrustPanel,
} from './catalog-commerce-ui';

describe('Catalog commerce UI', () => {
  it('renders a reusable key-facts row with concise labels and values', () => {
    const markup = renderToStaticMarkup(
      <CatalogKeyFacts
        items={[
          {
            id: 'set-number',
            label: 'Setnummer',
            value: '10316',
          },
          {
            id: 'recommended-age',
            label: 'Leeftijd',
            value: '18+',
          },
          {
            id: 'pieces',
            label: 'Stenen',
            value: '6.167',
          },
          {
            id: 'display-size',
            label: 'Formaat',
            value: '72 × 50 × 39 cm',
          },
        ]}
      />,
    );

    expect(markup).toContain('Setnummer');
    expect(markup).toContain('10316');
    expect(markup).toContain('Leeftijd');
    expect(markup).toContain('18+');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('6.167');
    expect(markup).toContain('Formaat');
    expect(markup).toContain('72 × 50 × 39 cm');
  });

  it('renders a decision panel with buy-now and follow-later states', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPanel
        followAction={<button type="button">Volg prijs</button>}
        primaryOffer={{
          affiliateNote:
            'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
          checkedLabel: '2 apr om 09:00',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Goede deal',
          decisionTone: 'positive',
          merchantLabel: 'bol',
          price: '€ 469,99',
          rankingLabel: 'Laagste nagekeken prijs op voorraad.',
          stockLabel: 'Op voorraad',
        }}
        supportItems={[
          {
            id: 'below-normal',
            text: 'Onder het normale prijsniveau.',
          },
        ]}
        supportTitle="Waarom nu"
        verdictTone="positive"
      />,
    );

    expect(markup).toContain('Goede deal');
    expect(markup).toContain('Beste deal nu');
    expect(markup).toContain('bol');
    expect(markup).toContain('Laagste nagekeken prijs op voorraad.');
    expect(markup).toContain('Bekijk bij bol');
    expect(markup).toContain(
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    );
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain(
      'Nog niet klaar? Dan houdt Brickhunt dit moment vast.',
    );
    expect(markup).toContain('Waarom nu');
  });

  it('renders a comparison fallback when only one reviewed offer is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={[
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/c3po',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 139,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="1 winkel nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('Nog geen vergelijking');
    expect(markup).toContain('id="set-offers"');
    expect(markup).toContain(
      'Met 1 winkel is dit nog te dun voor een koopadvies.',
    );
    expect(markup).toContain('1 winkel nagekeken · 2 apr om 09:00');
  });

  it('renders a compact comparison rail with a view-all action', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={[
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-bol',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 1.049,95',
            rankingLabel: 'Laagste nagekeken prijs op voorraad.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-amazon',
            ctaLabel: 'Bekijk bij Amazon',
            merchantLabel: 'Amazon',
            price: '€ 1.079,99',
            rankingLabel: '€ 30,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="2 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('Vergelijk winkels');
    expect(markup).toContain('Nu bij 2 winkels');
    expect(markup).toContain('Beste deal');
    expect(markup).toContain('bol');
    expect(markup).toContain('Amazon');
    expect(markup).toContain('data-wrap="best"');
    expect(markup).toContain('data-wrap="default"');
    expect(markup).toContain('€30,04 goedkoper dan de rest');
    expect(markup).toContain('€30,04 duurder');
    expect(markup).toContain('Ga naar beste deal');
    expect(markup).toContain('Bekijk alternatief');
    expect(markup).toContain('Vergelijk alle 2 winkels');
  });

  it('caps the visible rail at six offers while keeping the full comparison action for the rest', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={[
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-bol',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 1.049,95',
            rankingLabel: 'Laagste nagekeken prijs op voorraad.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-amazon',
            ctaLabel: 'Bekijk bij Amazon',
            merchantLabel: 'Amazon',
            price: '€ 1.079,99',
            rankingLabel: '€ 30,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 1.099,99',
            rankingLabel: '€ 50,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-top1toys',
            ctaLabel: 'Bekijk bij Top1Toys',
            merchantLabel: 'Top1Toys',
            price: '€ 1.119,99',
            rankingLabel: '€ 70,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-smyths',
            ctaLabel: 'Bekijk bij Smyths Toys',
            merchantLabel: 'Smyths Toys',
            price: '€ 1.139,99',
            rankingLabel: '€ 90,04 boven de beste prijs.',
            stockLabel: 'Beperkt leverbaar',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-misterbricks',
            ctaLabel: 'Bekijk bij MisterBricks',
            merchantLabel: 'MisterBricks',
            price: '€ 1.149,99',
            rankingLabel: '€ 100,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-intertoys',
            ctaLabel: 'Bekijk bij Intertoys',
            merchantLabel: 'Intertoys',
            price: '€ 1.169,99',
            rankingLabel: '€ 120,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="7 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('Nu bij 6 van 7 winkels');
    expect(markup).toContain('Vergelijk alle 7 winkels');
    expect(markup).toContain('LEGO');
    expect(markup).toContain('Top1Toys');
    expect(markup).toContain('MisterBricks');
    expect(markup).not.toContain('Intertoys');
  });

  it('builds one compact comparison presentation for rail and overlay use', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 3,
        nextBestAvailablePriceMinor: 104995,
        reviewedInStockOfferCount: 3,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-amazon',
        ctaLabel: 'Bekijk bij Amazon',
        merchantLabel: 'Amazon',
        price: '€ 1.079,99',
        rankingLabel: '€ 30,04 boven de beste prijs.',
        stockLabel: 'Niet leverbaar',
      },
    });

    expect(presentation.stockLabel).toBe('Uitverkocht');
    expect(presentation.railCheckedLabel).toBe('2 apr');
    expect(presentation.overlayCheckedLabel).toBe('2 apr om 09:00');
    expect(presentation.deltaLabel).toBe('€30,04 duurder');
    expect(presentation.actionLabel).toBe('Bekijk alternatief');
    expect(presentation.priceComparisonState).toBe('higher');
  });

  it('marks exact price ties as secondary alternatives', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 3,
        nextBestAvailablePriceMinor: 104995,
        reviewedInStockOfferCount: 3,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-lego',
        ctaLabel: 'Bekijk bij LEGO',
        merchantLabel: 'LEGO',
        price: '€ 1.049,95',
        rankingLabel: 'Zelfde prijs als de beste optie',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.deltaLabel).toBe('Zelfde prijs');
    expect(presentation.priceComparisonState).toBe('same');
  });

  it('shows the savings versus the next-best reviewed offer on the best card without an extra label', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 4,
        nextBestAvailablePriceMinor: 107999,
        reviewedInStockOfferCount: 4,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-bol',
        ctaLabel: 'Bekijk bij bol',
        isBest: true,
        merchantLabel: 'bol',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.confidenceLabel).toBe('€30,04 goedkoper dan de rest');
    expect(presentation.actionLabel).toBe('Ga naar beste deal');
    expect(presentation.priceComparisonState).toBe('best');
  });

  it('keeps a normal close savings line on the best card without adding a second label', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 4,
        nextBestAvailablePriceMinor: 105595,
        reviewedInStockOfferCount: 4,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-bol',
        ctaLabel: 'Bekijk bij bol',
        isBest: true,
        merchantLabel: 'bol',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.confidenceLabel).toBe('€6 goedkoper dan de rest');
  });

  it('falls back to a generic cheapest-state label when multiple reviewed offers exist without a concrete delta', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 4,
        nextBestAvailablePriceMinor: 104995,
        reviewedInStockOfferCount: 4,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-bol',
        ctaLabel: 'Bekijk bij bol',
        isBest: true,
        merchantLabel: 'bol',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.confidenceLabel).toBe('Goedkoopste optie nu');
  });

  it('marks the best offer as the only available option when no other reviewed in-stock offers exist', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 3,
        nextBestAvailablePriceMinor: undefined,
        reviewedInStockOfferCount: 1,
      },
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/atat-bol',
        ctaLabel: 'Bekijk bij bol',
        isBest: true,
        merchantLabel: 'bol',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.confidenceLabel).toBe('Enige beschikbare optie');
  });

  it('keeps alternatives on the default single-line support mode in rendered markup', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={[
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-bol',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 1.049,95',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 1.079,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="2 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('data-wrap="best"');
    expect(markup).toContain('data-wrap="default"');
  });

  it('uses compact day labels in the rail while preserving full timestamps for overlay context', () => {
    const presentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 104995,
        comparedOfferCount: 2,
        nextBestAvailablePriceMinor: 107999,
        reviewedInStockOfferCount: 2,
      },
      offer: {
        checkedLabel: 'Nagekeken Vandaag, 03:00',
        ctaHref: 'https://example.com/atat-bol',
        ctaLabel: 'Bekijk bij bol',
        isBest: true,
        merchantLabel: 'bol',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(presentation.railCheckedLabel).toBe('Vandaag');
    expect(presentation.overlayCheckedLabel).toBe('Vandaag om 03:00');
  });

  it('renders compact day labels in the rail without exact times', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={[
          {
            checkedLabel: 'Vandaag om 03:00',
            ctaHref: 'https://example.com/atat-bol',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 1.049,95',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: 'Gisteren om 11:34',
            ctaHref: 'https://example.com/atat-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 1.079,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="2 winkels nagekeken"
      />,
    );

    expect(markup).toContain('>Vandaag<');
    expect(markup).toContain('>Gisteren<');
    expect(markup).not.toContain('Vandaag om 03:00');
    expect(markup).not.toContain('Gisteren om 11:34');
  });

  it('renders a trust panel with compact signal rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogTrustPanel
        trustSignals={[
          { label: 'Laatst nagekeken', value: '2 apr 2026, 09:00' },
          { label: 'Winkels nagekeken', value: '3 winkels nagekeken' },
        ]}
      />,
    );

    expect(markup).toContain('Wat Brickhunt nu ziet');
    expect(markup).toContain('Laatst nagekeken');
    expect(markup).toContain('3 winkels nagekeken');
  });
});
