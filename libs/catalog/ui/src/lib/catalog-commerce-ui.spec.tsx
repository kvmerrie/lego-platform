import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
            'Als je doorklikt naar bol, kunnen wij een kleine commissie krijgen. Dat verandert jouw prijs niet.',
          checkedLabel: 'Nagekeken 2 apr, 09:00',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Nu interessant geprijsd',
          decisionTone: 'positive',
          merchantLabel: 'bol',
          price: '€ 469,99',
          rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        supportItems={[
          {
            id: 'below-normal',
            text: 'Deze prijs ligt onder wat we meestal zien.',
          },
        ]}
        supportTitle="Waarom dit nu interessant is"
        verdictTone="positive"
      />,
    );

    expect(markup).toContain('Nu interessant geprijsd');
    expect(markup).toContain('Beste winkel nu');
    expect(markup).toContain('bol');
    expect(markup).toContain('Laagste nagekeken prijs die nu op voorraad is.');
    expect(markup).toContain('Bekijk bij bol');
    expect(markup).toContain(
      'Als je doorklikt naar bol, kunnen wij een kleine commissie krijgen. Dat verandert jouw prijs niet.',
    );
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain(
      'Volg deze prijs. Brickhunt houdt het moment voor je in de gaten.',
    );
    expect(markup).toContain('Waarom dit nu interessant is');
  });

  it('renders a comparison fallback when only one reviewed offer is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        offers={[
          {
            checkedLabel: 'Nagekeken 2 apr, 09:00',
            ctaHref: 'https://example.com/c3po',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 139,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="1 winkel nagekeken · Nagekeken 2 apr, 09:00"
      />,
    );

    expect(markup).toContain('Nog geen echte vergelijking');
    expect(markup).toContain('We volgen nu 1 winkel voor deze set.');
    expect(markup).toContain('1 winkel nagekeken · Nagekeken 2 apr, 09:00');
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

    expect(markup).toContain('Waar prijs en winkels op steunen');
    expect(markup).toContain('Laatst nagekeken');
    expect(markup).toContain('3 winkels nagekeken');
  });
});
