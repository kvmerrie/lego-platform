import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogQuickFilterBar,
  CatalogSectionHeader,
  CatalogSectionShell,
  CatalogSetDetailHero,
  CatalogSplitIntroPanel,
} from './catalog-ui';
import {
  CatalogKeyFacts,
  CatalogPriceDecisionPanel,
} from './catalog-commerce-ui';

describe('CatalogSectionHeader', () => {
  it('renders signal text and a below-heading utility action in one shared composition', () => {
    const markup = renderToStaticMarkup(
      <CatalogSectionHeader
        description="Sets die nu sneller beslissen."
        eyebrow="Deals"
        signal="3 sets met nagekeken prijzen"
        title="Hier wil je nu kijken"
        utility={
          <a href="/themes/icons" rel="noreferrer">
            Open volledig thema
          </a>
        }
        utilityPlacement="below-heading"
      />,
    );

    expect(markup).toContain('Hier wil je nu kijken');
    expect(markup).toContain('3 sets met nagekeken prijzen');
    expect(markup).toContain('Open volledig thema');
  });
});

describe('CatalogSectionShell', () => {
  it('renders a reusable section shell with header, signal, utility, and body content', () => {
    const markup = renderToStaticMarkup(
      <CatalogSectionShell
        description="Sets die nu sneller beslissen."
        eyebrow="Deals"
        signal="3 sets met nagekeken prijzen"
        title="Hier wil je nu kijken"
        tone="muted"
        utility={
          <a href="/themes/icons" rel="noreferrer">
            Open volledig thema
          </a>
        }
        utilityPlacement="below-heading"
      >
        <div>Body-content</div>
      </CatalogSectionShell>,
    );

    expect(markup).toContain('Hier wil je nu kijken');
    expect(markup).toContain('3 sets met nagekeken prijzen');
    expect(markup).toContain('Open volledig thema');
    expect(markup).toContain('Body-content');
  });
});

describe('CatalogSplitIntroPanel', () => {
  it('renders a split intro with primary framing and a secondary route', () => {
    const markup = renderToStaticMarkup(
      <CatalogSplitIntroPanel
        actionHref="/discover"
        actionLabel="Bekijk sets"
        primary={{
          description: 'Begin bij sets die je echt wilt blijven bekijken.',
          eyebrow: 'Hoe Brickhunt werkt',
          meta: 'Kies eerst. Koop daarna slimmer.',
          title: 'Sneller kiezen. Slimmer kopen.',
        }}
        secondary={{
          description: 'Klik nu door of volg de prijs later.',
          eyebrow: 'Volgende stap',
          title: 'Koop of volg',
        }}
      />,
    );

    expect(markup).toContain('Sneller kiezen. Slimmer kopen.');
    expect(markup).toContain('Kies eerst. Koop daarna slimmer.');
    expect(markup).toContain('Bekijk sets');
  });
});

describe('CatalogSetDetailHero', () => {
  it('renders the normalized detail-top composition with facts and a decision panel', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailHero
        children={<section>Vergelijk winkels</section>}
        decisionPanel={
          <CatalogPriceDecisionPanel
            followAction={<button type="button">Volg prijs</button>}
            primaryOffer={{
              checkedLabel: 'Nagekeken 2 apr',
              coverageLabel: '2 winkels nagekeken',
              ctaHref: 'https://example.com/rivendell',
              ctaLabel: 'Bekijk bij bol',
              decisionHelper: '€ 20 onder wat we meestal zien voor deze set.',
              decisionLabel: 'Nu interessant geprijsd',
              decisionTone: 'positive',
              merchantLabel: 'bol',
              price: '€ 469,99',
              rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
              stockLabel: 'Op voorraad',
            }}
            supportItems={[
              {
                id: 'support-1',
                text: 'Rivendell zakt niet vaak hard, dus dit moment valt op.',
              },
            ]}
            supportTitle="Waarom dit nu interessant is"
            verdictTone="positive"
          />
        }
        gallery={<div>Hero-afbeelding</div>}
        keyFacts={
          <CatalogKeyFacts
            items={[
              {
                id: 'set-number',
                label: 'Setnummer',
                value: '10316',
              },
              {
                id: 'pieces',
                label: 'Stenen',
                value: '6.167',
              },
            ]}
          />
        }
        pitch="Kies deze als je Midden-aarde groot op je plank wilt."
        title="Rivendell"
        verdict={{
          explanation: 'De prijs ligt onder wat we meestal zien voor deze set.',
          label: 'Nu interessant geprijsd',
          tone: 'positive',
        }}
      />,
    );

    expect(markup).toContain('Rivendell');
    expect(markup).toContain('Hero-afbeelding');
    expect(markup).toContain('Setnummer');
    expect(markup).toContain('Beste winkel nu');
    expect(markup).toContain('Waarom dit nu interessant is');
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('Vergelijk winkels');
  });
});

describe('CatalogQuickFilterBar', () => {
  it('keeps the active filter state inside the shared quick-filter composition', () => {
    const markup = renderToStaticMarkup(
      <CatalogQuickFilterBar
        ariaLabel="Verfijn ontdekken"
        items={[
          {
            href: '/discover',
            isActive: true,
            label: 'Alles',
          },
          {
            href: '/discover?filter=best-deals',
            label: 'Beste deals',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Beste deals');
  });
});
