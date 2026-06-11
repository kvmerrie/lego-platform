import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildCompactOfferComparisonContext,
  buildCompactOfferPresentation,
} from './catalog-offer-comparison-rail';
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

  it('renders only the first three available specs in the mobile hero facts row', () => {
    const markup = renderToStaticMarkup(
      <CatalogKeyFacts
        items={[
          {
            id: 'theme-logo',
            label: 'Thema',
            value: 'Logo',
          },
          {
            id: 'recommended-age',
            label: 'Leeftijd',
            value: '18+',
          },
          {
            id: 'piece-count',
            label: 'Stenen',
            value: '5.471',
          },
          {
            id: 'minifigures',
            label: 'Minifiguren',
            value: '10',
          },
          {
            id: 'release',
            label: 'Release',
            value: '2026',
          },
        ]}
      />,
    );
    const mobileMarkup =
      markup.match(
        /<dl[^>]*detailHeroMetaStripMobile[^>]*>([\s\S]*?)<\/dl>/u,
      )?.[1] ?? '';

    expect(mobileMarkup).toContain('Logo');
    expect(mobileMarkup).toContain('Leeftijd');
    expect(mobileMarkup).toContain('Stenen');
    expect(mobileMarkup).toContain('Minifiguren');
    expect(mobileMarkup).not.toContain('Release');
  });

  it('keeps release visible on mobile when it is one of the only available specs', () => {
    const markup = renderToStaticMarkup(
      <CatalogKeyFacts
        items={[
          {
            id: 'theme-logo',
            label: 'Thema',
            value: 'Logo',
          },
          {
            id: 'release',
            label: 'Release',
            value: '2026',
          },
        ]}
      />,
    );
    const mobileMarkup =
      markup.match(
        /<dl[^>]*detailHeroMetaStripMobile[^>]*>([\s\S]*?)<\/dl>/u,
      )?.[1] ?? '';

    expect(mobileMarkup).toContain('Logo');
    expect(mobileMarkup).toContain('Release');
    expect(mobileMarkup).toContain('2026');
  });

  it('renders a decision panel with buy-now and follow-later states', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPanel
        followAction={<button type="button">Volg prijs</button>}
        heroSideAction={
          <button aria-label="Aan verlanglijst toevoegen" type="button">
            ♥
          </button>
        }
        primaryOffer={{
          affiliateNote:
            'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
          checkedLabel: '2 apr om 09:00',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk deal bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Goede deal',
          decisionTone: 'positive',
          merchantLabel: 'Bij bol',
          price: '€ 469,99',
          rankingLabel: '€ 30,00 goedkoper dan de rest',
          stockLabel: 'Op voorraad',
          trackingEvent: {
            event: 'offer_click',
            properties: {
              merchantName: 'bol',
              offerPlacement: 'best_offer',
              setId: '10316',
            },
          },
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
    expect(markup).not.toContain('Beste prijs nu');
    expect(markup).toContain('Bij bol');
    expect(markup).toContain('€ 30,00 goedkoper dan de rest');
    expect(markup).toContain('Bekijk deal bij bol');
    expect(markup).toContain('bestDealActionRow');
    expect(markup).toContain('bestDealSideAction');
    expect(markup).toContain('Aan verlanglijst toevoegen');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer sponsored"');
    expect(markup).toContain('data-brickhunt-event="offer_click"');
    expect(markup).toContain('offerPlacement');
    expect(markup).toContain('best_offer');
    expect(markup).toContain(
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    );
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain(
      'Nog niet klaar? Dan houdt Brickhunt dit moment vast.',
    );
    expect(markup).toContain('Waarom nu');
  });

  it('leads no-offer states with the follow-price action', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPanel
        followAction={<button type="button">Volg prijs</button>}
        primaryOffer={{
          checkedLabel: 'Vandaag om 07:01',
          coverageLabel: '5 winkels nagekeken',
          decisionHelper: 'We volgen deze set zodra er voorraad terugkomt.',
          decisionLabel: 'Nog geen deal',
          decisionTone: 'neutral',
          merchantLabel: 'Nog geen deal',
          price: 'Nog geen actuele prijs',
          stockLabel: 'Nog geen voorraad',
        }}
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('Nog geen deal');
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('data-brickhunt-event="offer_click"');
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
            trackingEvent: {
              event: 'offer_click',
              properties: {
                offerPlacement: 'comparison_row',
                offerRole: 'best',
                rankPosition: 1,
                setId: '75313',
              },
            },
          },
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-amazon',
            ctaLabel: 'Bekijk bij Amazon',
            merchantLabel: 'Amazon',
            price: '€ 1.079,99',
            rankingLabel: '€ 30,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
            trackingEvent: {
              event: 'offer_click',
              properties: {
                offerPlacement: 'comparison_row',
                offerRole: 'alternative',
                rankPosition: 2,
                setId: '75313',
              },
            },
          },
        ]}
        setDetailHref="/sets/ultimate-collectors-series-at-at-75313"
        summaryLabel="2 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).not.toContain('Vergelijk winkels');
    expect(markup).toContain('Nu bij 2 winkels');
    expect(markup).not.toContain('2 winkels nagekeken');
    expect(markup).not.toContain('2 winkels nagekeken · 2 apr om 09:00');
    expect(markup).toContain('Beste deal');
    expect(markup).toContain('bol');
    expect(markup).toContain('Amazon');
    expect(markup).toContain('data-wrap="best"');
    expect(markup).toContain('data-wrap="default"');
    expect(markup).toContain('€30,04 goedkoper dan de rest');
    expect(markup).toContain('€30,04 duurder');
    expect(markup).toContain('href="https://example.com/atat-bol"');
    expect(markup).toContain('href="https://example.com/atat-amazon"');
    expect(markup).toContain('rel="noopener noreferrer sponsored"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('Bekijk beste deal');
    expect(markup).toContain('Naar winkel');
    expect(markup).toContain('Amazon');
    expect(markup).not.toContain('Amazon Amazon');
    expect(markup).toContain('Nagekeken 2 apr');
    expect(markup).not.toContain('2 apr om 09:00');
    expect(markup).toContain('data-best="true"');
    expect(markup).toContain('data-stock-state="available"');
    expect(markup).toContain('data-brickhunt-event="offer_click"');
    expect(markup).toContain('offerPlacement');
    expect(markup).toContain('comparison_row');
    expect(markup).toContain('offerRole');
    expect(markup).toContain('alternative');
    expect(markup).toContain('rankPosition');
    expect(markup).toContain('Bekijk alle winkels');
    expect(markup).toContain('aria-label="Vergelijk alle 2 winkels"');
  });

  it('shows all offers when the comparison has at most twenty shops', () => {
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
          {
            checkedLabel: '2 apr om 09:00',
            ctaHref: 'https://example.com/atat-coolblue',
            ctaLabel: 'Bekijk bij Coolblue',
            merchantLabel: 'Coolblue',
            price: '€ 1.179,99',
            rankingLabel: '€ 130,04 boven de beste prijs.',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="8 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('Nu bij 8 winkels');
    expect(markup).not.toContain('Nu bij 8 van 8 winkels');
    expect(markup).toContain('Bekijk alle winkels');
    expect(markup).toContain('aria-label="Vergelijk alle 8 winkels"');
    expect(markup).toContain('LEGO');
    expect(markup).toContain('Top1Toys');
    expect(markup).toContain('MisterBricks');
    expect(markup).toContain('Intertoys');
    expect(markup).toContain('Coolblue');
  });

  it('caps the visible rail at twenty offers while keeping the full comparison action for the rest', () => {
    const offers = Array.from({ length: 21 }, (_, index) => ({
      checkedLabel: '2 apr om 09:00',
      ctaHref: `https://example.com/atat-shop-${index + 1}`,
      ctaLabel: `Bekijk bij Shop ${index + 1}`,
      isBest: index === 0,
      merchantLabel: `Shop ${index + 1}`,
      price: `€ ${1_049 + index},99`,
      rankingLabel:
        index === 0
          ? 'Laagste nagekeken prijs op voorraad.'
          : `€ ${index},00 boven de beste prijs.`,
      stockLabel: 'Op voorraad',
    }));
    const markup = renderToStaticMarkup(
      <CatalogOfferComparison
        id="set-offers"
        offers={offers}
        summaryLabel="21 winkels nagekeken · 2 apr om 09:00"
      />,
    );

    expect(markup).toContain('Nu bij 20 van 21 winkels');
    expect(markup).toContain('Bekijk alle winkels');
    expect(markup).toContain('aria-label="Vergelijk alle 21 winkels"');
    expect(markup).toContain('Shop 20');
    expect(markup).not.toContain('Shop 21');
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
    expect(presentation.railCheckedLabel).toBe('Nagekeken 2 apr');
    expect(presentation.overlayCheckedLabel).toBe('2 apr om 09:00');
    expect(presentation.deltaLabel).toBe('€30,04 duurder');
    expect(presentation.actionLabel).toBe('Naar winkel');
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

  it('keeps lowest-price alternatives distinct from recommended best deals', () => {
    const comparisonContext = buildCompactOfferComparisonContext([
      {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/joybuy',
        ctaLabel: 'Bekijk bij Joybuy',
        merchantLabel: 'Joybuy',
        price: '€ 58,40',
        rankingLabel: 'Laagste prijs',
        stockLabel: 'Op voorraad',
      },
      {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/lidl',
        ctaLabel: 'Bekijk bij Lidl',
        isBest: true,
        merchantLabel: 'Lidl',
        price: '€ 61,99',
        rankingLabel: '€ 3,59 boven laagste prijs',
        stockLabel: 'Op voorraad',
      },
    ]);
    const joybuyPresentation = buildCompactOfferPresentation({
      comparisonContext,
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/joybuy',
        ctaLabel: 'Bekijk bij Joybuy',
        merchantLabel: 'Joybuy',
        price: '€ 58,40',
        rankingLabel: 'Laagste prijs',
        stockLabel: 'Op voorraad',
      },
    });
    const lidlPresentation = buildCompactOfferPresentation({
      comparisonContext,
      offer: {
        checkedLabel: 'Nagekeken 2 apr, 09:00',
        ctaHref: 'https://example.com/lidl',
        ctaLabel: 'Bekijk bij Lidl',
        isBest: true,
        merchantLabel: 'Lidl',
        price: '€ 61,99',
        rankingLabel: '€ 3,59 boven laagste prijs',
        stockLabel: 'Op voorraad',
      },
    });

    expect(joybuyPresentation.deltaLabel).toBe('Laagste prijs');
    expect(joybuyPresentation.priceComparisonState).toBe('same');
    expect(lidlPresentation.confidenceLabel).toBe('€3,59 boven laagste prijs');
    expect(lidlPresentation.priceComparisonState).toBe('best');
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
    expect(presentation.actionLabel).toBe('Bekijk beste deal');
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

    expect(presentation.confidenceLabel).toBe('Laagste prijs');
  });

  it('shows lower unavailable alternatives without presenting them as equal-price choices', () => {
    const soldOutPresentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 19999,
        comparedOfferCount: 3,
        nextBestAvailablePriceMinor: 21999,
        reviewedInStockOfferCount: 2,
      },
      offer: {
        checkedLabel: 'Vandaag om 07:01',
        ctaHref: 'https://example.com/sold-out',
        ctaLabel: 'Bekijk bij Sold Out',
        merchantLabel: 'Sold Out',
        price: '€ 189,99',
        stockLabel: 'Uitverkocht',
      },
    });
    const unknownPresentation = buildCompactOfferPresentation({
      comparisonContext: {
        bestPriceMinor: 19999,
        comparedOfferCount: 3,
        nextBestAvailablePriceMinor: 21999,
        reviewedInStockOfferCount: 2,
      },
      offer: {
        checkedLabel: 'Vandaag om 07:01',
        ctaHref: 'https://example.com/unknown',
        ctaLabel: 'Bekijk bij Unknown',
        merchantLabel: 'Unknown',
        price: '€ 189,99',
        stockLabel: 'Voorraad onbekend',
      },
    });

    expect(soldOutPresentation.deltaLabel).toBe('Uitverkocht maar lager');
    expect(soldOutPresentation.priceComparisonState).toBe('lower-unavailable');
    expect(unknownPresentation.deltaLabel).toBe('Voorraad onbekend, lager');
    expect(unknownPresentation.priceComparisonState).toBe('lower-unavailable');
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

    expect(presentation.railCheckedLabel).toBe('Nagekeken vandaag');
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

    expect(markup).toContain('>Nagekeken vandaag<');
    expect(markup).toContain('>Nagekeken gisteren<');
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
