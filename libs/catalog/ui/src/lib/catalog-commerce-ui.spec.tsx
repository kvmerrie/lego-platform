import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildCompactOfferComparisonContext,
  buildCompactOfferPresentation,
} from './catalog-offer-comparison-rail';
import { buildCatalogMerchantPresentation } from '@lego-platform/catalog/util';
import {
  CatalogKeyFacts,
  CatalogOfferComparison,
  CatalogPriceDecisionPanel,
  CatalogPriceDecisionPrimary,
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
          <button
            aria-label="Aan verlanglijst toevoegen"
            className="inlineToggleButtonActive"
            type="button"
          >
            ♥
          </button>
        }
        primaryOffer={{
          affiliateNote:
            'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
          checkedLabel: 'Recent gecontroleerd',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk deal bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Goede deal',
          decisionTone: 'positive',
          evidence: [
            '€ 30,00 goedkoper dan LEGO',
            'Recent gecontroleerd',
            '3 winkels nagekeken',
          ],
          merchantLabel: 'bol',
          merchantName: 'bol',
          merchantSlug: 'bol',
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
    expect(markup).toContain('aria-label="Bij bol"');
    expect(markup).toContain('aria-label="Bekijk winkel bol"');
    expect(markup).toContain('href="/winkels/bol"');
    expect(markup).toContain('src="/merchant-favicons/bol.ico"');
    expect(markup).toContain('€ 30,00 goedkoper dan LEGO');
    expect(markup).toContain('data-hero-commerce-slot="evidence"');
    expect(markup).toContain('bestDealEvidenceText');
    expect(markup).not.toContain('bestDealEvidencePill');
    expect(markup).not.toContain('bestDealEvidenceSupportList');
    expect(markup).not.toContain('€ 30,00 goedkoper dan de rest');
    expect(markup).not.toContain('3 winkels nagekeken');
    expect(markup).toContain('data-hero-commerce-slot="advice"');
    expect(markup).toContain('bestDealAdvice');
    expect(markup).not.toContain('bestDealRanking');
    expect(markup).toContain('data-hero-commerce-slot="trust"');
    expect(markup).toContain('bestDealTrustList');
    expect(markup).toContain('Op voorraad');
    expect(markup).toContain('Beste prijs van 3 winkels');
    expect(markup).toContain('Recent gecontroleerd');
    expect(markup).toContain('Bekijk deal bij bol');
    expect(markup).toContain('data-hero-commerce-cta-tone="accent"');
    expect(markup).toContain('bestDealActionRow');
    expect(markup).toContain('data-action-layout="merchant-follow"');
    expect(markup).toContain('data-commerce-cta-tone="accent"');
    expect(markup).toContain('bestDealSideAction');
    expect(markup).toContain('bestDealFollowIconButton');
    expect(markup).toContain('data-hero-follow-action="true"');
    expect(markup).not.toContain('data-hero-follow-tone');
    expect(markup).toContain('Aan verlanglijst toevoegen');
    expect(markup).toContain('inlineToggleButtonActive');
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
    expect(markup.indexOf('data-hero-commerce-slot="evidence"')).toBeLessThan(
      markup.indexOf('data-hero-commerce-slot="advice"'),
    );
    expect(markup.indexOf('data-hero-commerce-slot="advice"')).toBeLessThan(
      markup.indexOf('data-hero-commerce-slot="merchant"'),
    );
    expect(markup.indexOf('data-hero-commerce-slot="merchant"')).toBeLessThan(
      markup.indexOf('data-hero-commerce-slot="cta"'),
    );
    expect(markup.indexOf('data-hero-commerce-slot="cta"')).toBeLessThan(
      markup.indexOf('data-hero-commerce-slot="trust"'),
    );
    expect(markup.indexOf('Recent gecontroleerd')).toBeGreaterThan(
      markup.indexOf('data-hero-commerce-slot="cta"'),
    );
  });

  it('keeps warning merchant offers visible with calmer CTA tone', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPrimary
        heroSideAction={
          <button aria-label="Aan verlanglijst toevoegen" type="button">
            ♥
          </button>
        }
        primaryOffer={{
          checkedLabel: 'Eergisteren om 20:06',
          coverageLabel: '9 winkels nagekeken',
          ctaHref: 'https://example.com/proshop',
          ctaLabel: 'Bekijk deal bij Proshop',
          ctaTone: 'accent',
          decisionHelper:
            'De prijs lag recent lager. Volgen is waarschijnlijk slimmer dan nu kopen.',
          decisionLabel: 'Wachten kan lonen',
          decisionTone: 'warning',
          evidence: ['Recent goedkoper gezien'],
          merchantLabel: 'Proshop',
          merchantName: 'Proshop',
          merchantSlug: 'proshop',
          price: '€ 193,22',
          stockLabel: 'Op voorraad',
        }}
      />,
    );

    expect(markup).toContain('Wachten kan lonen');
    expect(markup).toContain('Bekijk deal bij Proshop');
    expect(markup).toContain('data-hero-commerce-cta-tone="secondary"');
    expect(markup).toContain('data-commerce-cta-tone="secondary"');
    expect(markup).toContain('bestDealSideAction');
    expect(markup).toContain('bestDealFollowIconButton');
    expect(markup).toContain('data-hero-follow-action="true"');
    expect(markup).not.toContain('data-hero-follow-tone');
    expect(markup).toContain('Aan verlanglijst toevoegen');
    expect(markup).toContain('Recent goedkoper gezien');
    expect(markup).toContain('Beste prijs van 9 winkels');
  });

  it('leads no-offer states with the follow-price action', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPanel
        followAction={<button type="button">Volg prijs</button>}
        primaryOffer={{
          checkedLabel: 'Vandaag om 07:01',
          coverageLabel: '5 winkels nagekeken',
          decisionHelper:
            'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
          decisionLabel: 'Nog geen deal',
          decisionTone: 'warning',
          merchantLabel: 'Prijsbeeld bouwt nog op',
          price: 'Nog geen actuele prijs',
          stockLabel: 'Prijsbeeld bouwt nog op',
        }}
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('Nog geen deal');
    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain(
      'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
    );
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('data-brickhunt-event="offer_click"');
  });

  it('renders selected-price merchant presentation in the set-detail hero without changing the CTA copy', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPrimary
        primaryOffer={{
          checkedLabel: 'Recent gecontroleerd',
          coverageLabel: '1 winkel nagekeken',
          ctaHref: 'https://example.com/lego',
          ctaLabel: 'Bekijk prijs bij LEGO',
          ctaTone: 'secondary',
          decisionLabel: 'Marktprijs',
          decisionTone: 'info',
          merchantLabel: 'LEGO',
          merchantName: 'LEGO',
          merchantPresentation: buildCatalogMerchantPresentation({
            claim: 'selected-price',
            merchantName: 'LEGO',
            merchantSlug: 'lego-nl',
          }),
          merchantSlug: 'lego-nl',
          price: '€ 249,99',
          stockLabel: 'Op voorraad',
        }}
      />,
    );

    expect(markup).toContain('aria-label="Prijs bij LEGO"');
    expect(markup).toContain('Prijs bij');
    expect(markup).toContain('Bekijk prijs bij LEGO');
    expect(markup).not.toContain('aria-label="Bij LEGO"');
    expect(markup).not.toContain('Laagst bij LEGO');
  });

  it('renders availability merchant presentation in the set-detail hero without changing the CTA copy', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPrimary
        primaryOffer={{
          checkedLabel: 'Recent gecontroleerd',
          coverageLabel: '1 winkel nagekeken',
          ctaHref: 'https://example.com/coolblue',
          ctaLabel: 'Bekijk voorraad bij Coolblue',
          ctaTone: 'secondary',
          decisionLabel: 'Voorraad gevonden',
          decisionTone: 'neutral',
          merchantLabel: 'Coolblue',
          merchantName: 'Coolblue',
          merchantPresentation: buildCatalogMerchantPresentation({
            claim: 'availability',
            merchantName: 'Coolblue',
            merchantSlug: 'coolblue',
          }),
          merchantSlug: 'coolblue',
          price: '€ 179,00',
          stockLabel: 'Op voorraad',
        }}
      />,
    );

    expect(markup).toContain('aria-label="Verkrijgbaar bij Coolblue"');
    expect(markup).toContain('Verkrijgbaar bij');
    expect(markup).toContain('Bekijk voorraad bij Coolblue');
    expect(markup).not.toContain('aria-label="Bij Coolblue"');
    expect(markup).not.toContain('Laagst bij Coolblue');
  });

  it('renders no-offer primary follow without a duplicate compact heart action', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPrimary
        followAction={<button type="button">Volg prijs</button>}
        heroSideAction={
          <button aria-label="Volg prijs compact" type="button">
            ♥
          </button>
        }
        primaryOffer={{
          checkedLabel: 'Vandaag om 07:01',
          coverageLabel: '5 winkels nagekeken',
          decisionHelper:
            'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
          decisionLabel: 'Nog geen deal',
          decisionTone: 'warning',
          merchantLabel: 'Prijsbeeld bouwt nog op',
          price: 'Nog geen actuele prijs',
          stockLabel: 'Prijsbeeld bouwt nog op',
        }}
      />,
    );

    expect(markup).toContain('data-commerce-state="follow"');
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('bestDealFollowAction');
    expect(markup).toContain('data-hero-follow-action="primary"');
    expect(markup).not.toContain('data-hero-follow-tone');
    expect(markup).not.toContain('bestDealSideAction');
    expect(markup).not.toContain('bestDealFollowIconButton');
    expect(markup).not.toContain('data-hero-follow-action="true"');
    expect(markup).not.toContain('Volg prijs compact');
    expect(markup).not.toContain('data-commerce-cta-tone=');
  });

  it('marks neutral no-data primary follow actions with the neutral hero hook', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPrimary
        followAction={<button type="button">Volg prijs</button>}
        primaryOffer={{
          checkedLabel: 'Vandaag om 07:01',
          coverageLabel: '5 winkels nagekeken',
          decisionHelper:
            'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
          decisionLabel: 'Geen actuele voorraad gevonden',
          decisionTone: 'neutral',
          merchantLabel: 'Geen actuele voorraad gevonden',
          price: 'Geen actuele voorraad gevonden',
          stockLabel: 'Geen actuele voorraad',
        }}
      />,
    );

    expect(markup).toContain('data-commerce-state="follow"');
    expect(markup).toContain('data-tone="neutral"');
    expect(markup).toContain('data-hero-follow-action="primary"');
    expect(markup).not.toContain('data-hero-follow-tone');
    expect(markup).not.toContain('bestDealSideAction');
    expect(markup).not.toContain('bestDealFollowIconButton');
  });

  it('renders the empty best-deal fallback as a warm follow-price card', () => {
    const markup = renderToStaticMarkup(
      <CatalogPriceDecisionPanel
        followAction={<button type="button">Volg prijs</button>}
      />,
    );

    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain('Nog geen deal');
    expect(markup).toContain('Nog geen actuele prijs');
    expect(markup).toContain(
      'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
    );
    expect(markup).toContain('Volg prijs');
  });

  it('keeps every hero commerce state on the same structural slots', () => {
    const states = [
      'Uitzonderlijke deal',
      'Sterke deal',
      'Goede prijs',
      'Normale prijs',
      'Wachten kan lonen',
      'Prijsbeeld bouwt op',
      'Geen betrouwbare prijs',
    ];

    for (const stateLabel of states) {
      const markup = renderToStaticMarkup(
        <CatalogPriceDecisionPrimary
          followAction={<button type="button">Volg prijs</button>}
          primaryOffer={{
            checkedLabel: 'Vandaag om 09:00',
            coverageLabel: '4 winkels nagekeken',
            decisionHelper: 'Korte onderbouwing voor deze status.',
            decisionLabel: stateLabel,
            decisionTone:
              stateLabel === 'Wachten kan lonen'
                ? 'warning'
                : stateLabel === 'Normale prijs'
                  ? 'info'
                  : stateLabel === 'Prijsbeeld bouwt op' ||
                      stateLabel === 'Geen betrouwbare prijs'
                    ? 'neutral'
                    : 'positive',
            merchantLabel: 'Alternate',
            merchantName: 'Alternate',
            merchantSlug: 'alternate',
            price:
              stateLabel === 'Prijsbeeld bouwt op'
                ? 'Nog geen actuele prijs'
                : '€ 74,90',
            stockLabel: 'Op voorraad',
          }}
        />,
      );

      expect(markup).toContain('data-hero-commerce-card="true"');
      expect(markup).toContain('data-hero-commerce-slot="status"');
      expect(markup).toContain('data-hero-commerce-slot="price"');
      expect(markup).toContain('data-hero-commerce-slot="evidence"');
      expect(markup).toContain('data-hero-commerce-slot="advice"');
      expect(markup).toContain('data-hero-commerce-slot="merchant"');
      expect(markup).toContain('data-hero-commerce-slot="trust"');
      expect(markup).toContain('data-hero-commerce-slot="cta"');
      expect(markup).toContain('data-hero-commerce-slot="disclosure"');
    }
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

  it('renders a compact comparison rail with an interactive heading action', () => {
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
    expect(markup).toContain('Naar winkel');
    expect(markup).toContain('Amazon');
    expect(markup).not.toContain('Amazon Amazon');
    expect(markup).toContain('2 apr 09:00');
    expect(markup).toContain('Nagekeken 2 april om 09:00');
    expect(markup).not.toContain('2 apr om 09:00');
    expect(markup).toContain('data-best="true"');
    expect(markup).toContain('data-stock-state="available"');
    expect(markup).toContain('data-brickhunt-event="offer_click"');
    expect(markup).toContain('offerPlacement');
    expect(markup).toContain('comparison_row');
    expect(markup).toContain('offerRole');
    expect(markup).toContain('alternative');
    expect(markup).toContain('rankPosition');
    expect(markup).toContain('aria-label="Vergelijk alle 2 winkels"');
    expect(markup).toContain('lucide-chevron-right');
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
    expect(markup).toContain('aria-label="Vergelijk alle 8 winkels"');
    expect(markup).toContain('lucide-chevron-right');
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
    expect(markup).toContain('aria-label="Vergelijk alle 21 winkels"');
    expect(markup).toContain('lucide-chevron-right');
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
    expect(presentation.railCheckedLabel).toBe('2 apr 09:00');
    expect(presentation.railCheckedTitle).toBe('Nagekeken 2 april om 09:00');
    expect(presentation.overlayCheckedLabel).toBe('2 apr om 09:00');
    expect(presentation.deltaLabel).toBe('€30,04 duurder');
    expect(presentation.actionLabel).toBe('Naar winkel');
    expect(presentation.priceComparisonState).toBe('higher');
  });

  it('formats compact rail timestamps with Dutch short dates and safe fallbacks', () => {
    const baseComparisonContext = {
      bestPriceMinor: 104995,
      comparedOfferCount: 1,
      reviewedInStockOfferCount: 1,
    };
    const datedPresentation = buildCompactOfferPresentation({
      comparisonContext: baseComparisonContext,
      offer: {
        checkedLabel: 'Nagekeken 7 juni, 12:55',
        ctaHref: 'https://example.com/dated',
        ctaLabel: 'Bekijk bij Shop',
        merchantLabel: 'Shop',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });
    const fallbackPresentation = buildCompactOfferPresentation({
      comparisonContext: baseComparisonContext,
      offer: {
        checkedLabel: '',
        ctaHref: 'https://example.com/fallback',
        ctaLabel: 'Bekijk bij Shop',
        merchantLabel: 'Shop',
        price: '€ 1.049,95',
        stockLabel: 'Op voorraad',
      },
    });

    expect(datedPresentation.railCheckedLabel).toBe('7 jun 12:55');
    expect(datedPresentation.railCheckedTitle).toBe(
      'Nagekeken 7 juni om 12:55',
    );
    expect(datedPresentation.overlayCheckedLabel).toBe('7 juni om 12:55');
    expect(fallbackPresentation.railCheckedLabel).toBe('onbekend');
    expect(fallbackPresentation.railCheckedTitle).toBe('Nagekeken onbekend');
  });

  it('marks exact price ties as shared best deals', () => {
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

    expect(presentation.confidenceLabel).toBeUndefined();
    expect(presentation.isBestDeal).toBe(true);
    expect(presentation.priceComparisonState).toBe('best');
  });

  it('uses the lowest current price as the best deal instead of a recommended flag', () => {
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

    expect(joybuyPresentation.actionLabel).toBe('Naar winkel');
    expect(joybuyPresentation.confidenceLabel).toBe(
      '€3,59 goedkoper dan de rest',
    );
    expect(joybuyPresentation.isBestDeal).toBe(true);
    expect(joybuyPresentation.priceComparisonState).toBe('best');
    expect(lidlPresentation.actionLabel).toBe('Naar winkel');
    expect(lidlPresentation.confidenceLabel).toBeUndefined();
    expect(lidlPresentation.deltaLabel).toBe('€3,59 duurder');
    expect(lidlPresentation.isBestDeal).toBe(false);
    expect(lidlPresentation.priceComparisonState).toBe('higher');
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
    expect(presentation.actionLabel).toBe('Naar winkel');
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

  it('hides generic cheapest-state copy when multiple reviewed offers have no meaningful delta', () => {
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

    expect(presentation.confidenceLabel).toBeUndefined();
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

    expect(presentation.railCheckedLabel).toBe('vandaag 03:00');
    expect(presentation.railCheckedTitle).toBe('Nagekeken vandaag om 03:00');
    expect(presentation.overlayCheckedLabel).toBe('Vandaag om 03:00');
  });

  it('renders compact checked timestamps in the rail with full native titles', () => {
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

    expect(markup).toContain('>vandaag 03:00<');
    expect(markup).toContain('>gisteren 11:34<');
    expect(markup).toContain('title="Nagekeken vandaag om 03:00"');
    expect(markup).toContain('title="Nagekeken gisteren om 11:34"');
    expect(markup).not.toContain('>Nagekeken vandaag<');
    expect(markup).not.toContain('>Nagekeken gisteren<');
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
