import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogHeroMedia,
  CatalogPageIntro,
  CatalogQuickFilterBar,
  CatalogSectionHeader,
  CatalogSectionShell,
  CatalogSetDetailHero,
  CatalogSplitIntroPanel,
  getHeroButtonSurface,
  getHeroButtonTone,
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
    expect(markup).toContain('sectionHeaderWithAside');
    expect(markup).toContain('Open volledig thema');
  });

  it('does not add aside spacing when no aside content is rendered', () => {
    const markup = renderToStaticMarkup(
      <CatalogSectionHeader title="Alleen een titel" />,
    );

    expect(markup).toContain('sectionHeader');
    expect(markup).not.toContain('sectionHeaderWithAside');
    expect(markup).not.toContain('sectionHeaderAside');
  });

  it('renders a rail action inside the title row before aside controls', () => {
    const markup = renderToStaticMarkup(
      <CatalogSectionHeader
        action={<a href="/deals">Bekijk alle deals</a>}
        description="Sets die nu sneller beslissen."
        eyebrow="Deals"
        title="Beste deals nu"
        utility={<button type="button">Volgende rail</button>}
      />,
    );

    expect(markup).toContain('sectionHeaderTitleRow');
    expect(markup).toContain('sectionHeaderAction');
    expect(markup.indexOf('Beste deals nu')).toBeLessThan(
      markup.indexOf('Bekijk alle deals'),
    );
    expect(markup.indexOf('Bekijk alle deals')).toBeLessThan(
      markup.indexOf('Sets die nu sneller beslissen.'),
    );
    expect(markup.indexOf('Sets die nu sneller beslissen.')).toBeLessThan(
      markup.indexOf('Volgende rail'),
    );
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

describe('CatalogPageIntro', () => {
  it('renders breadcrumbs in a stable shared slot before intro content', () => {
    const markup = renderToStaticMarkup(
      <CatalogPageIntro
        breadcrumbs={{
          ariaLabel: 'Paginapad',
          items: [
            { href: '/', id: 'home', label: 'Start' },
            { id: 'themes', label: "Thema's" },
          ],
        }}
      >
        <h1>Alle thema&apos;s</h1>
        <p>Begin hier.</p>
      </CatalogPageIntro>,
    );

    expect(markup).toContain('aria-label="Paginapad"');
    expect(markup).toContain('data-has-breadcrumbs="true"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('Alle thema&#x27;s');
    expect(markup.indexOf('Paginapad')).toBeLessThan(
      markup.indexOf('Alle thema&#x27;s'),
    );
  });

  it('resolves reusable black and white hero button tones from visual contrast', () => {
    expect(getHeroButtonTone({ backgroundColor: '#0b1020' })).toBe('white');
    expect(getHeroButtonSurface({ backgroundColor: '#0b1020' })).toBe('dark');
    expect(getHeroButtonTone({ backgroundColor: '#f4d35e' })).toBe('black');
    expect(getHeroButtonSurface({ backgroundColor: '#f4d35e' })).toBe('light');
  });

  it('exposes the shared hero button tone and media sizing contract', () => {
    const markup = renderToStaticMarkup(
      <CatalogPageIntro heroButtonTone="white">
        <CatalogHeroMedia
          alt=""
          decoding="async"
          height={420}
          src="https://images.example/hero.jpg"
          width={560}
        />
      </CatalogPageIntro>,
    );
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const whiteToneRule =
      css.match(
        /\.pageIntro\[data-hero-button-tone='white'\] \{[^}]+\}/u,
      )?.[0] ?? '';
    const blackToneRule =
      css.match(
        /\.pageIntro\[data-hero-button-tone='black'\] \{[^}]+\}/u,
      )?.[0] ?? '';
    const mediaFrameRule = css.match(/\.heroMediaFrame \{[^}]+\}/u)?.[0] ?? '';
    const mediaImageRule = css.match(/\.heroMediaImage \{[^}]+\}/u)?.[0] ?? '';

    expect(markup).toContain('data-hero-button-tone="white"');
    expect(markup).toContain('heroMediaFrame');
    expect(markup).toContain('heroMediaImage');
    expect(whiteToneRule).toContain(
      '--catalog-hero-button-fill-background: var(--lego-contrast-white);',
    );
    expect(whiteToneRule).toContain(
      '--catalog-hero-button-fill-foreground: color-mix(',
    );
    expect(whiteToneRule).toContain('var(--catalog-hero-surface) 78%');
    expect(blackToneRule).toContain(
      '--catalog-hero-button-fill-background: var(--lego-contrast-ink);',
    );
    expect(blackToneRule).toContain(
      '--catalog-hero-button-fill-foreground: color-mix(',
    );
    expect(blackToneRule).toContain('var(--catalog-hero-surface) 72%');
    expect(mediaFrameRule).toContain(
      '--catalog-hero-media-max-block-size: clamp(18rem, 42vw, 30rem);',
    );
    expect(mediaFrameRule).toContain(
      'max-block-size: var(--catalog-hero-media-max-block-size);',
    );
    expect(mediaImageRule).toContain(
      'object-fit: var(--catalog-hero-media-object-fit, cover);',
    );
    expect(mediaImageRule).toContain(
      'max-block-size: var(--catalog-hero-media-max-block-size);',
    );
  });
});

describe('CatalogSplitIntroPanel', () => {
  it('renders a split intro with primary framing and a secondary route', () => {
    const markup = renderToStaticMarkup(
      <CatalogSplitIntroPanel
        actionHref="/themes"
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
    expect(markup).not.toContain('Hoe Brickhunt werkt');
    expect(markup).not.toContain('Volgende stap');
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
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            }}
            supportItems={[
              {
                id: 'support-1',
                text: 'Rivendell zakt niet vaak hard, dus dit moment valt op.',
              },
            ]}
            supportTitle="Waarom nu"
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
        title="Rivendell"
      />,
    );

    expect(markup).toContain('Rivendell');
    expect(markup).toContain('Hero-afbeelding');
    expect(markup).toContain('Setnummer');
    expect(markup).not.toContain('Beste prijs nu');
    expect(markup).toContain('Waarom nu');
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
            href: '/themes',
            isActive: true,
            label: 'Alles',
          },
          {
            href: '/deals',
            label: 'Beste deals',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Beste deals');
  });
});
