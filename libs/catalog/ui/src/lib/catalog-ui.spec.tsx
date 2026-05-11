import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogQuickFilterBar,
  CatalogSetCard,
  CatalogSetCardCollection,
  CatalogSetDetailPanel,
  CatalogThemeHighlight,
} from './catalog-ui';

describe('CatalogSetCard', () => {
  it('renders set detail gallery rounded on desktop and edge-to-edge on mobile', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.galleryMainButton {');
    expect(css).toContain('border-radius: var(--lego-radius-md);');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toContain('.galleryMain {\n    margin-inline: calc(');
    expect(css).toContain('.galleryMainButton,\n  .galleryMainVisual {');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('.galleryMainVisual {\n    border: 0;');
  });

  it('renders a lighter compact-card variant for dense catalog exploration', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup).not.toContain('Set 10316');
    expect(markup).toContain('Bekijk set');
    expect(markup).not.toContain('A flagship fantasy build');
    expect(markup).not.toContain('Reviewed prijs');
    expect(markup).not.toContain('Dekking');
  });

  it('renders a subtle saved-state badge when a set belongs to a collector list', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        savedState="owned"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
      />,
    );

    expect(markup).toContain('In collectie');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('Icons');
  });

  it('renders release-aware compact copy for exact recent releases', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/at-st-walker-75417"
        setSummary={{
          id: '75417',
          slug: 'at-st-walker-75417',
          name: 'AT-ST Walker',
          theme: 'Star Wars',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          pieces: 1513,
          imageUrl: 'https://images.example/atst.jpg',
        }}
        variant="compact"
      />,
    );

    expect(/Net uit|Nieuw in 2026|2026/.test(markup)).toBe(true);
    expect(markup).not.toContain('2026-01-01');
  });

  it('uses the shared theme color mapping for compact set cards', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/notre-dame-de-paris-21061"
        setSummary={{
          id: '21061',
          slug: 'notre-dame-de-paris-21061',
          name: 'Notre-Dame de Paris',
          theme: 'Architecture',
          releaseYear: 2024,
          pieces: 4383,
          imageUrl: 'https://images.example/notre-dame.jpg',
          collectorAngle: 'Monumentale skylineblikvanger',
          tagline: 'Een landmark die meteen statig leest op je plank.',
          availability: 'Goed verkrijgbaar',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('--card-theme-badge-bg:#6f8594');
    expect(markup).toContain('--card-theme-badge-text:#ffffff');
  });

  it('renders optional list actions below the default set-card metadata', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={<button type="button">Move to collection</button>}
        href="/sets/rivendell-10316"
        savedState="wishlist"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
      />,
    );

    expect(markup).toContain('Move to collection');
    expect(markup).toContain('Bekijk set');
  });

  it('renders compact-card secondary actions inside the shared footer action row when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={
          <>
            <button type="button">Bewaar</button>
            <button type="button">Zoom</button>
          </>
        }
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('Bewaar');
    expect(markup).toContain('Zoom');
    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('cardCompactDecisionZone');
    expect(markup).toContain('cardCompactFooterActions');
    expect(markup).toContain('data-catalog-set-card-click-layer="true"');
  });

  it('uses a stretched card link without nesting compact footer actions', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={<button type="button">Bewaar</button>}
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="compact"
      />,
    );
    const cardLinkStart = markup.indexOf(
      'data-catalog-set-card-click-layer="true"',
    );
    const cardLinkEnd = markup.indexOf('</a>', cardLinkStart);
    const footerStart = markup.indexOf('cardCompactFooterActions');
    const footerActionStart = markup.indexOf('aria-label="Bekijk set"');

    expect(cardLinkStart).toBeGreaterThan(-1);
    expect(cardLinkEnd).toBeGreaterThan(cardLinkStart);
    expect(footerStart).toBeGreaterThan(cardLinkEnd);
    expect(footerActionStart).toBeGreaterThan(cardLinkEnd);
    expect(markup.slice(cardLinkStart, cardLinkEnd)).not.toContain(
      'cardCompactFooterActions',
    );
  });

  it('styles compact card click targets as full-card overlays with outer focus rings', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.setCardClickLayer {');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 1;');
    expect(css).toContain('.setCardClickLayer:focus-visible::after {');
    expect(css).toContain('border-radius: inherit;');
    expect(css).toContain('box-shadow: 0 0 0 4px var(--lego-focus-ring);');
    expect(css).toContain('inset: -3px;');
    expect(css).toContain('.setCard:has(.setCardClickLayer:focus-visible)');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('.cardCompactFooterActions {');
    expect(css).toContain('z-index: 2;');
  });

  it('keeps the compact primary action white-on-blue inside the shared footer row', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const source = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.tsx'),
      'utf-8',
    );

    expect(css).toContain('.cardCompactPrimaryAction,');
    expect(css).toContain('.cardCompactPrimaryAction:visited {');
    expect(css).toContain('color: var(--lego-accent-contrast, #ffffff);');
    expect(css).toContain('.cardCompactActionBrowse,');
    expect(css).toContain('.cardCompactActionBrowse:visited {');
    expect(css).toContain('.cardCompactActionCommerce,');
    expect(css).toContain('.cardCompactActionCommerce:visited {');
    expect(css).toContain(
      '.cardCompactPrimaryAction.cardCompactPrimaryAction:hover,',
    );
    expect(css).toContain(
      '.cardCompactPrimaryAction.cardCompactPrimaryAction:focus-visible {',
    );
    expect(css).toContain('.cardCompactPrimaryAction .cardCompactActionIcon,');
    expect(css).toContain('.cardCompactPrimaryAction .cardCompactActionLabel,');
    expect(css).toContain('.cardCompactPrimaryAction .interactiveContent,');
    expect(css).toContain('.cardCompactPrimaryAction svg,');
    expect(css).toContain('.cardCompactPrimaryAction span {');
    expect(css).toContain('stroke: currentColor;');
    expect(css).toContain('text-decoration: none;');
    expect(css).toContain('.railActionLink,');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('border-radius: var(--lego-radius-pill);');
    expect(css).toContain(
      'background: color-mix(in srgb, var(--lego-accent) 9%, transparent);',
    );
    expect(css).toContain('.sectionHeaderAction');
    expect(css).toContain('text-decoration: underline;');
    expect(source).toContain('tone="card"');
  });

  it('keeps offer comparison card hover close to regular set card hover', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const offerHoverRule =
      css.match(/\.offerRailCardLink:hover \.offerRailCard \{[^}]+\}/u)?.[0] ??
      '';
    const offerCardRule = css.match(/\.offerRailCard \{[^}]+\}/u)?.[0] ?? '';
    const bestDealRule =
      css.match(/\.offerRailCard\[data-best='true'\] \{[^}]+\}/u)?.[0] ?? '';
    const bestDealHoverRule =
      css.match(
        /\.offerRailCardLink:hover \.offerRailCard\[data-best='true'\] \{[^}]+\}/u,
      )?.[0] ?? '';
    const secondaryActionRule =
      css.match(/\.offerRailAction\[data-tone='secondary'\] \{[^}]+\}/u)?.[0] ??
      '';
    const directHoverSecondaryActionRule =
      css.match(
        /\.offerRailAction\[data-tone='secondary'\]:hover \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(offerCardRule).not.toContain('transform');
    expect(bestDealRule).not.toContain('translateY');
    expect(offerHoverRule).not.toContain('translateY');
    expect(offerHoverRule).not.toContain('0 0.55rem');
    expect(offerCardRule).not.toContain('border:');
    expect(offerHoverRule).not.toContain('border-color');
    expect(offerHoverRule).not.toContain('box-shadow');
    expect(offerHoverRule).not.toContain('linear-gradient');
    expect(offerHoverRule).not.toContain('color-mix');
    expect(offerHoverRule).toContain(
      'background: var(--lego-surface-default);',
    );
    expect(bestDealRule).toContain('background: var(--lego-positive-subtle);');
    expect(bestDealHoverRule).toContain(
      'background: var(--lego-positive-subtle);',
    );
    expect(secondaryActionRule).toContain('background: transparent;');
    expect(secondaryActionRule).toContain('border-color: var(--lego-text);');
    expect(css).not.toContain(
      ".offerRailCardLink:hover .offerRailAction[data-tone='secondary']",
    );
    expect(css).not.toContain(
      ".offerRailCardLink:focus-visible .offerRailAction[data-tone='secondary']",
    );
    expect(directHoverSecondaryActionRule).toContain(
      'background: var(--lego-accent);',
    );
    expect(css).toContain('white-space: nowrap;');
  });

  it('keeps offer availability status compact with text and a status dot', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const statusRule =
      css.match(/\.offerAvailabilityStatus \{[^}]+\}/u)?.[0] ?? '';
    const statusDotRule =
      css.match(/\.offerAvailabilityStatus::before \{[^}]+\}/u)?.[0] ?? '';

    expect(statusRule).toContain('display: inline-flex;');
    expect(statusRule).toContain('white-space: nowrap;');
    expect(statusRule).not.toContain('padding:');
    expect(statusRule).not.toContain('background:');
    expect(statusRule).not.toContain('border-radius:');
    expect(statusDotRule).toContain('background: currentColor;');
    expect(statusDotRule).toContain('border-radius: var(--lego-radius-pill);');
    expect(css).not.toContain('offerRailStock');
    expect(css).not.toContain('offerOverlayStock');
  });

  it('does not put card CTA controls into hover state from parent card hover', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const browseActionHoverRule =
      css.match(/\.cardCompactActionBrowse:hover \{[^}]+\}/u)?.[0] ?? '';
    const offerAccentHoverRule =
      css.match(
        /\.offerRailAction\[data-tone='accent'\]:hover \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(css).not.toContain('.setCardLink:hover .cardCompactActionBrowse');
    expect(css).not.toContain(
      ".offerRailCardLink:hover .offerRailAction[data-tone='accent']",
    );
    expect(css).not.toContain(
      ".offerRailCardLink:focus-visible .offerRailAction[data-tone='accent']",
    );
    expect(browseActionHoverRule).toContain(
      'background: var(--lego-accent-hover);',
    );
    expect(offerAccentHoverRule).toContain(
      'background: var(--lego-accent-hover);',
    );
  });

  it('anchors optional visual actions inside the image wrapper with bottom-right padding', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const source = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.tsx'),
      'utf-8',
    );

    expect(source).toContain('overlayControls');
    expect(source).toContain('data-catalog-set-card-visual-actions="true"');
    expect(css).toContain('.visualActionSlot {');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('inset-block-end: 0.82rem;');
    expect(css).toContain('inset-inline-end: 0.82rem;');
    expect(css).not.toContain('.visualActionSlot {\n  top:');
  });

  it('renders a compact featured-card variant for homepage browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          primaryActionHref: 'https://merchant.example/rivendell',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          primaryActionTrackingEvent: {
            event: 'offer_click',
            properties: {
              merchantName: 'bol',
              setId: '10316',
            },
          },
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Laagst bij bol');
    expect(markup).toContain('EUR 10.00 below ref');
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('aria-label="Bekijk set"');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('data-brickhunt-event="offer_click"');
    expect(markup).not.toContain('Prestige display anchor');
    expect(markup).not.toContain('Op voorraad · 3 winkels · 29 mrt');
    expect(markup).not.toContain('Dekking');
    expect(markup).not.toContain('Actualiteit');
    expect(markup).not.toContain('Waarom verzamelaars dit kiezen');
    expect(markup).not.toContain('Nagekeken prijs');
  });

  it('keeps the homepage follow-later action lighter than the primary set click', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={<button type="button">Volg prijs</button>}
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('Bekijk set');
  });

  it('falls back to the detail page when pricing exists without a valid affiliate link', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        ctaMode="commerce"
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        trackingEvent={{
          event: 'catalog_set_click',
          properties: {
            setId: '10316',
          },
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('data-brickhunt-event="catalog_set_click"');
  });

  it('keeps commerce rail cards on the internal set-detail CTA', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        ctaMode="commerce"
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          primaryActionHref: 'https://merchant.example/rivendell',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          primaryActionTrackingEvent: {
            event: 'offer_click',
            properties: {
              merchantName: 'bol',
              setId: '10316',
            },
          },
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('aria-label="Bekijk set"');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).not.toContain('Koop nu');
    expect(markup).not.toContain('href="https://merchant.example/rivendell"');
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('data-brickhunt-event="offer_click"');
  });

  it('can hide a redundant theme badge when the surrounding collection already provides the theme context', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        showThemeBadge={false}
        variant="compact"
      />,
    );

    expect(markup).toContain('Rivendell');
    expect(markup).not.toContain('>Icons<');
  });

  it('keeps no-price featured cards calm when pricing is missing', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('Prijs volgt');
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup).not.toContain('Set 10316');
    expect(markup).not.toContain('Later bekijken');
    expect(markup).not.toContain('Setpagina staat live.');
  });

  it('renders set imagery alongside featured-set discovery context when available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        contextBadge={{
          label: 'Strong deal right now',
          tone: 'accent',
        }}
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          pricePositionTone: 'positive',
          reviewedLabel: 'Checked 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
      />,
    );

    expect(markup).toContain('Reviewed prijs');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Lowest reviewed price at bol');
    expect(markup).toContain('Strong deal right now');
    expect(markup).toContain('src="https://images.example/rivendell.jpg"');
    expect(markup).toContain('alt="Rivendell LEGO-set"');
    expect(markup).toContain('Dekking');
    expect(markup).toContain('Actualiteit');
    expect(markup).not.toContain('Waarom verzamelaars dit kiezen');
    expect(markup).not.toContain('Beschikbaarheid');
    expect(markup).not.toContain('Healthy but premium availability');
    expect(markup).not.toContain('Prestige display anchor');
    expect(markup).toContain('EUR 10.00 below ref');
  });

  it('renders a subtler reviewed-price treatment for personal collection surfaces', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 489.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 10.00 below ref',
          reviewedLabel: 'Checked 29 mrt',
        }}
        priceDisplay="subtle"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        supportingNote="Best current deal · In stock"
      />,
    );

    expect(markup).toContain('Huidige reviewed prijs');
    expect(markup).toContain('EUR 489.99 · Lowest reviewed price at bol');
    expect(markup).toContain('Huidige marktnotitie');
    expect(markup).toContain('Best current deal · In stock');
    expect(markup).not.toContain('Dekking');
    expect(markup).not.toContain('Actualiteit');
    expect(markup).not.toContain('Reviewed prijs nog niet gepubliceerd.');
  });

  it('renders a conversion-first set detail flow with gallery, best deal, alerts, and trust signals', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          affiliateNote:
            'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
          checkedLabel: '31 mrt om 09:00',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk deal bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Goede deal',
          decisionTone: 'positive',
          merchantLabel: 'Bij bol',
          price: '€ 469,99',
          rankingLabel: '€ 30,00 goedkoper dan de rest',
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
        brickhuntValueItems={[
          {
            id: 'brickhunt-monitoring',
            text: '2 winkels worden actief nagekeken.',
          },
          {
            id: 'brickhunt-guidance',
            text: 'Je ziet meteen of deze prijs echt opvalt.',
          },
          {
            id: 'brickhunt-alerts',
            text: 'Nog niet klaar? Volg de prijs.',
          },
        ]}
        catalogSetDetail={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          subtheme: 'The Lord of the Rings',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell-1.jpg',
          images: [
            {
              order: 0,
              type: 'hero',
              url: 'https://images.example/rivendell-1.jpg',
            },
            {
              order: 1,
              type: 'detail',
              url: 'https://images.example/rivendell-2.jpg',
            },
          ],
          primaryImage: 'https://images.example/rivendell-1.jpg',
          collectorAngle: 'De complete vallei blijft er als scene uitspringen.',
          tagline: 'Als je een grote Middle-earth-set wilt, pak je deze.',
          availability: 'Stevige vraag naar een premium set',
          collectorHighlights: [
            'De Council of Elrond-scene trekt meteen de aandacht.',
            'De mix van torens, bogen en herfstkleuren blijft op je plank werken.',
            'De cast maakt hem rijker dan een pure displaygevel.',
          ],
          minifigureCount: 15,
          minifigureHighlights: ['Frodo', 'Elrond'],
          recommendedAge: 18,
          displaySize: {
            value: '72 × 50 × 39 cm',
          },
          setStatus: 'available',
        }}
        dealSupportItems={[
          {
            id: 'price-below-normal',
            text: 'Onder het normale prijsniveau.',
          },
          {
            id: 'best-price-now',
            text: 'Beste prijs die we nu volgen.',
          },
          {
            id: 'merchant-coverage',
            text: '2 winkels nagekeken.',
          },
        ]}
        dealVerdict={{
          explanation:
            'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
          label: 'Goede deal',
          tone: 'positive',
        }}
        offerList={[
          {
            checkedLabel: '31 mrt om 09:00',
            ctaHref: 'https://example.com/rivendell',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 469,99',
            rankingLabel: 'Laagste prijs op voorraad',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: '31 mrt om 09:15',
            ctaHref: 'https://example.com/rivendell-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 499,99',
            rankingLabel: '€ 30,00 hoger dan de beste optie',
            stockLabel: 'Op voorraad',
          },
        ]}
        offerSummaryLabel="2 winkels nagekeken · 31 mrt om 09:00"
        ownershipActions={<button type="button">In collectie zetten</button>}
        priceAlertAction={<button type="button">Volg prijs</button>}
        priceHistoryPanel={
          <div>
            <p>Prijs in het kort</p>
            <p>Recent prijsverloop</p>
          </div>
        }
        themeDirectoryHref="/themes"
        themeHref="/themes/icons"
        trustSignals={[
          { label: 'Laatst nagekeken', value: '31 mrt om 09:00' },
          { label: 'Winkels nagekeken', value: '2 winkels nagekeken' },
        ]}
      />,
    );

    expect(markup).toContain('Goede deal');
    expect(markup).toContain('The Lord of the Rings');
    expect(markup).toContain('>10316</span>');
    expect(markup).toContain('aria-label="Afbeeldingen van Rivendell"');
    expect(markup).toContain('Open Rivendell LEGO-set in volledig scherm');
    expect(markup).toContain('Bekijk deal bij bol');
    expect(markup).toContain(
      '€ 30,00 onder wat we meestal zien voor deze set.',
    );
    expect(markup).toContain('--catalog-theme-badge-surface:#f0c63b');
    expect(markup).toContain('--catalog-theme-badge-text:#171a22');
    expect(markup).toContain('Beste prijs nu');
    expect(markup).toContain('Bij bol');
    expect(markup).toContain('€ 30,00 goedkoper dan de rest');
    expect(markup).toContain(
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    );
    expect(markup).toContain('data-brickhunt-event="offer_click"');
    expect(markup).toContain('offerPlacement');
    expect(markup).toContain('best_offer');
    expect(markup).toContain('Waarom nu');
    expect(markup).toContain('Beste prijs die we nu volgen.');
    expect(markup).toContain('Vergelijk winkels');
    expect(markup).toContain('Nu bij 2 winkels');
    expect(markup).toContain('2 winkels nagekeken');
    expect(markup).not.toContain('2 winkels nagekeken · 31 mrt om 09:00');
    expect(markup).toContain('Beste deal');
    expect(markup).toContain('data-wrap="best"');
    expect(markup).toContain('data-wrap="default"');
    expect(markup).toContain('€30 goedkoper dan de rest');
    expect(markup).toContain('€30 duurder');
    expect(markup).toContain('href="https://example.com/rivendell"');
    expect(markup).toContain('href="https://example.com/rivendell-lego"');
    expect(markup).toContain('rel="noreferrer sponsored"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('Bekijk beste deal');
    expect(markup).toContain('Naar winkel');
    expect(markup).toContain('Naar winkel bij LEGO');
    expect(markup).not.toContain('Sterke deal');
    expect(markup.indexOf('Vergelijk winkels')).toBeLessThan(
      markup.indexOf('Prijs in het kort'),
    );
    expect(markup).toContain('Nog niet klaar om te kopen?');
    expect(markup).toContain('Volg prijs');
    expect(markup.indexOf('Prijs in het kort')).toBeLessThan(
      markup.indexOf('Nog niet klaar om te kopen?'),
    );
    expect(markup).toContain('Zo lees je dit');
    expect(markup).toContain('Je ziet meteen of deze prijs echt opvalt.');
    expect(markup).toContain('Wat Brickhunt nu ziet');
    expect(markup).not.toContain(
      'Als je een grote Middle-earth-set wilt, pak je deze.',
    );
    expect(markup).toContain('Bekijk afbeelding 2');
    expect(markup).toContain('In collectie zetten');
    expect(markup).not.toContain('Set 10316');
    expect(markup).toContain('10316');
    expect(markup).toContain('Leeftijd');
    expect(markup).toContain('18+');
    expect(markup).toContain('Formaat');
    expect(markup).toContain('72 × 50 × 39 cm');
    expect(markup).toContain('Stenen');
    expect(markup).not.toContain('Wat hier blijft hangen');
    expect(markup).not.toContain(
      'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
    );
    expect(markup).not.toContain('$499 to $569');
  });

  it('avoids a thin comparison block when only one offer is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: '31 mrt om 09:00',
          ctaHref: 'https://example.com/c3po',
          ctaLabel: 'Bekijk bij LEGO',
          ctaTone: 'secondary',
          decisionHelper: 'Rond het normale prijsniveau voor deze set.',
          decisionLabel: 'Prima prijs',
          decisionTone: 'info',
          merchantLabel: 'LEGO',
          price: '€ 139,99',
          rankingLabel: 'Enige nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        catalogSetDetail={{
          id: '75398',
          slug: 'c-3po-75398',
          name: 'C-3PO',
          theme: 'Star Wars',
          releaseYear: 2024,
          pieces: 1138,
          imageUrl: 'https://images.example/c3po.jpg',
          collectorAngle: 'De gouden droid trekt meteen de aandacht.',
          tagline:
            'Als je 1 droid-displayset kiest, is dit de duidelijke favoriet.',
          availability: 'Steady',
          collectorHighlights: ['De goudkleurige afwerking valt direct op.'],
        }}
        dealVerdict={{
          explanation:
            'Prima prijs, maar niet uitzonderlijk laag. Alleen kopen als je hem nu graag wilt hebben.',
          label: 'Prima prijs',
          tone: 'info',
        }}
        offerList={[
          {
            checkedLabel: '31 mrt om 09:00',
            ctaHref: 'https://example.com/c3po',
            ctaLabel: 'Bekijk bij LEGO',
            isBest: true,
            merchantLabel: 'LEGO',
            price: '€ 139,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        offerSummaryLabel="1 winkel nagekeken · 31 mrt om 09:00"
        priceAlertAction={<button type="button">Volg prijs</button>}
        priceHistoryPanel={<div>Recent prijsverloop</div>}
      />,
    );

    expect(markup).toContain('Nog geen vergelijking');
    expect(markup).toContain(
      'Met 1 winkel is dit nog te dun voor een koopadvies.',
    );
    expect(markup).not.toContain('Meer nagekeken prijzen');
  });

  it('renders a calm image fallback on set detail pages when no catalog image is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation: 'Prijsdata nog beperkt.',
          label: 'Prijsdata nog beperkt',
          tone: 'neutral',
        }}
        catalogSetDetail={{
          id: '21335',
          slug: 'motorized-lighthouse-21335',
          name: 'Motorized Lighthouse',
          theme: 'Ideas',
          releaseYear: 2022,
          pieces: 2065,
          imageUrl: undefined,
          collectorAngle: 'Kinetic display standout',
          tagline:
            'A mechanically animated coastal build that feels equally at home in premium display shelves and gift-led collector curation.',
          availability: 'Selective premium availability',
          collectorHighlights: [
            'Motorized light and rotating beacon create stronger live display presence than most static shelf pieces',
          ],
        }}
        priceAlertAction={<button type="button">Volg prijs</button>}
        priceHistoryPanel={<div>Recent prijsverloop</div>}
        themeDirectoryHref="/themes"
        themeHref="/themes/ideas"
      />,
    );

    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="/themes/ideas"');
    expect(markup).toContain('Setcontext');
    expect(markup).toContain('Officiele afbeelding nog niet gepubliceerd');
    expect(markup).toContain('Set 21335');
    expect(markup).toContain('Volg deze prijs');
    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('Release');
    expect(markup).toContain('Uitgebracht in 2022');
    expect(markup).not.toContain('Minifiguren');
    expect(markup).not.toContain('Nog niet bekend');
    expect(markup).toContain('<h1');
    expect(markup).not.toContain('$259 to $319');
    expect(markup).not.toContain('Back to shortlist');
  });

  it('renders exact release copy on set detail pages when a release date is known', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation: 'Prijsdata nog beperkt.',
          label: 'Prijsdata nog beperkt',
          tone: 'neutral',
        }}
        catalogSetDetail={{
          id: '75417',
          slug: 'at-st-walker-75417',
          name: 'AT-ST Walker',
          theme: 'Star Wars',
          releaseDate: '2026-05-01',
          releaseDatePrecision: 'day',
          releaseYear: 2026,
          pieces: 1513,
          imageUrl: 'https://images.example/atst.jpg',
        }}
        priceAlertAction={<button type="button">Volg prijs</button>}
        priceHistoryPanel={<div>Recent prijsverloop</div>}
        themeDirectoryHref="/themes"
        themeHref="/themes/star-wars"
      />,
    );

    expect(markup).toContain('Release');
    expect(markup).toContain('1 mei 2026');
    expect(markup).not.toContain('2026-01-01');
  });

  it('renders a neutral no-current-price fallback without discontinued copy', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: '30 apr om 09:00',
          coverageLabel: '2 winkels nagekeken',
          decisionHelper:
            'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
          decisionLabel: 'Nog geen actuele prijs',
          decisionTone: 'neutral',
          eyebrow: 'Beschikbaarheid nu',
          merchantLabel: 'Nog geen actuele prijs',
          price: 'Nog geen actuele prijs',
          stockLabel: 'Nog geen actuele voorraad',
        }}
        catalogSetDetail={{
          id: '75446',
          slug: 'grogu-mandalorian-apprentice-75446',
          name: 'Grogu (Mandalorian Apprentice)',
          theme: 'Star Wars',
          releaseYear: 2026,
          pieces: 1048,
          imageUrl: 'https://images.example/grogu.jpg',
        }}
        dealSupportItems={[
          {
            id: 'availability-primary-shops',
            text: 'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
          },
        ]}
        dealVerdict={{
          explanation:
            'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
          label: 'Nog geen actuele prijs',
          tone: 'neutral',
        }}
        followCopy="Zodra we actuele voorraad zien bij de winkels die Brickhunt controleert, zie je dat hier terug."
        followEyebrow="Beschikbaarheid"
        followTitle="We volgen deze set"
        priceAlertAction={<button type="button">Volg prijs</button>}
      />,
    );

    expect(markup).toContain('Nog geen actuele prijs');
    expect(markup).toContain('Nog geen actuele voorraad');
    expect(markup.indexOf('Volg prijs')).toBeGreaterThan(
      markup.indexOf('Nog geen actuele prijs'),
    );
    expect(markup.indexOf('Volg prijs')).toBeLessThan(
      markup.indexOf('Zodra we actuele voorraad zien'),
    );
    expect(markup).toContain(
      'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
    );
    expect(markup).not.toContain('Uit productie');
    expect(markup).not.toContain('Niet meer verkrijgbaar');
  });

  it('pushes price-following harder when waiting is the smarter call', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: '31 mrt om 09:00',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/gringotts',
          ctaLabel: 'Bekijk bij bol',
          ctaTone: 'secondary',
          decisionHelper: '€ 20,00 boven wat we meestal zien voor deze set.',
          decisionLabel: 'Wachten loont',
          decisionTone: 'warning',
          merchantLabel: 'bol',
          price: '€ 449,99',
          rankingLabel: 'Laagste nagekeken prijs op voorraad.',
          stockLabel: 'Op voorraad',
        }}
        catalogSetDetail={{
          id: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
          name: "Gringotts Wizarding Bank - Collectors' Edition",
          theme: 'Harry Potter',
          releaseYear: 2023,
          pieces: 4803,
          imageUrl: 'https://images.example/gringotts.jpg',
          collectorAngle: 'Wizarding World premium landmark',
          tagline:
            'A major Gringotts display build that gives Harry Potter a stronger premium anchor beyond the smaller Hogwarts panorama.',
          availability: 'High-visibility franchise demand',
          collectorHighlights: [
            'Broad franchise recognition makes it a strong search target for casual and deep collectors alike',
          ],
        }}
        dealSupportItems={[
          {
            id: 'price-above-normal',
            text: 'Boven het normale prijsniveau.',
          },
        ]}
        dealVerdict={{
          explanation:
            'Deze prijs ligt boven wat we meestal zien. Wachten is slimmer dan nu kopen.',
          label: 'Wachten loont',
          tone: 'warning',
        }}
        priceAlertAction={<button type="button">Volg prijs</button>}
      />,
    );

    expect(markup).toContain('Slimmer om te wachten');
    expect(markup).toContain('Volg deze set');
    expect(markup).toContain('Waarom wachten');
    expect(markup).toContain('Bekijk bij bol');
    expect(markup).toContain('Volg prijs');
  });

  it('renders minifigure count in the detail specs grid when local data exists', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation:
            'Prima prijs, maar niet uitzonderlijk laag. Alleen kopen als je hem nu graag wilt hebben.',
          label: 'Prima prijs',
          tone: 'info',
        }}
        catalogSetDetail={{
          id: '10305',
          slug: 'lion-knights-castle-10305',
          name: "Lion Knights' Castle",
          theme: 'Icons',
          releaseYear: 2022,
          pieces: 4514,
          imageUrl: 'https://images.example/lion-knights-castle.jpg',
          collectorAngle: 'Castle nostalgia tentpole',
          tagline:
            'A modern fortress build that lands squarely at the intersection of nostalgia and display value.',
          availability: 'Steady premium demand',
          collectorHighlights: [
            'High perceived value thanks to dense build volume and minifigure count',
          ],
          minifigureCount: 22,
        }}
      />,
    );

    expect(markup).toContain('Minifiguren');
    expect(markup).toContain('22');
    expect(markup).not.toContain('Nog niet lokaal bijgehouden');
  });

  it('renders curated subtheme and set status when local fan metadata is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation:
            'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
          label: 'Goede deal',
          tone: 'positive',
        }}
        catalogSetDetail={{
          id: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
          name: "Gringotts Wizarding Bank - Collectors' Edition",
          theme: 'Harry Potter',
          subtheme: 'Diagon Alley',
          setStatus: 'backorder',
          releaseYear: 2023,
          pieces: 4803,
          imageUrl: 'https://images.example/gringotts.jpg',
          collectorAngle: 'Wizarding World premium landmark',
          tagline:
            'A major Gringotts display build that gives Harry Potter a stronger premium anchor beyond the smaller Hogwarts panorama.',
          availability: 'High-visibility franchise demand',
          collectorHighlights: [
            'Broad franchise recognition makes it a strong search target for casual and deep collectors alike',
          ],
          minifigureCount: 13,
        }}
      />,
    );

    expect(markup).toContain('Diagon Alley');
    expect(markup).toContain('Status');
    expect(markup).toContain('Nabestelling');
    expect(markup).toContain('Minifiguren');
    expect(markup).toContain('13');
  });

  it('keeps the detail flow lean and skips local collector prose blocks', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation:
            'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
          label: 'Goede deal',
          tone: 'positive',
        }}
        catalogSetDetail={{
          id: '75397',
          slug: 'jabbas-sail-barge-75397',
          name: "Jabba's Sail Barge",
          theme: 'Star Wars',
          releaseYear: 2024,
          pieces: 3942,
          imageUrl: 'https://images.example/jabbas-sail-barge.jpg',
          collectorAngle: 'Original Trilogy prestige centerpiece',
          tagline:
            'A large desert-scene flagship that gives Star Wars collectors a more cinematic shelf landmark than another fighter or walker.',
          availability: 'Fresh flagship demand',
          collectorHighlights: [
            'Return of an iconic trilogy scene makes it highly legible in browse and search',
          ],
          minifigureCount: 11,
          minifigureHighlights: [
            'Jabba the Hutt',
            'Princess Leia',
            'Bib Fortuna',
            'Max Rebo',
          ],
        }}
      />,
    );

    expect(markup).not.toContain('Waarom deze');
    expect(markup).not.toContain('Wat hier blijft hangen');
    expect(markup).not.toContain(
      'Jabba the Hutt, Princess Leia, Bib Fortuna, Max Rebo',
    );
    expect(markup).toContain('Minifiguren');
    expect(markup).toContain('11');
  });

  it('renders a larger feature tile variant for descriptive browsing surfaces', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        className="directory-tile"
        href="/themes/icons"
        imageUrl="https://images.example/rivendell.jpg"
        themeSnapshot={{
          name: 'Icons',
          slug: 'icons',
          setCount: 14,
          momentum:
            'Premium verzamelaars trekken steeds vaker naar grote displaystukken.',
          signatureSet: 'Rivendell',
        }}
        variant="feature"
      />,
    );

    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('src="https://images.example/rivendell.jpg"');
    expect(markup).toContain('directory-tile');
    expect(markup).toContain('Bekijk sets');
    expect(markup).toContain('Pak eerst');
    expect(markup).toContain('Rivendell');
  });

  it('lets descriptive theme tiles reuse curated color and image overrides without using portrait rail sizing', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/marvel"
        visual={{
          backgroundColor: '#cf554c',
          imageUrl: 'https://images.example/curated-avengers-tower.jpg',
          textColor: '#ffffff',
        }}
        imageUrl="https://images.example/fallback-avengers-tower.jpg"
        themeSnapshot={{
          name: 'Marvel',
          slug: 'marvel',
          setCount: 3,
          momentum:
            'Superheldenvlaggenschepen en skyline-achtige displaybuilds met brede herkenbaarheid.',
          signatureSet: 'Avengers Tower',
        }}
        variant="feature"
      />,
    );

    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain(
      'src="https://images.example/curated-avengers-tower.jpg"',
    );
    expect(markup).toContain('--theme-surface:#cf554c');
    expect(markup).toContain('--theme-text:#ffffff');
    expect(markup).toContain('Bekijk sets');
  });

  it('renders a leaner portrait theme tile variant for fast browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/icons"
        visual={{
          backgroundColor: '#f0c63b',
          imageUrl: 'https://images.example/curated-rivendell.jpg',
          textColor: '#171a22',
        }}
        imageUrl="https://images.example/fallback-rivendell.jpg"
        themeSnapshot={{
          name: 'Icons',
          slug: 'icons',
          setCount: 14,
          momentum:
            'Premium verzamelaars trekken steeds vaker naar grote displaystukken.',
          signatureSet: 'Rivendell',
        }}
        variant="portrait"
      />,
    );

    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain(
      'src="https://images.example/curated-rivendell.jpg"',
    );
    expect(markup).toContain('Icons');
    expect(markup).toContain('14 sets');
    expect(markup).toContain('--theme-surface:#f0c63b');
    expect(markup).toContain('--theme-text:#171a22');
    expect(markup).not.toContain('Bekijk sets');
    expect(markup).not.toContain('Pak eerst Rivendell');
    expect(markup).not.toContain(
      'Premium verzamelaars trekken steeds vaker naar grote displaystukken.',
    );
  });

  it('renders a lightweight quick-filter chip row with an active state', () => {
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

    expect(markup).toContain('aria-label="Verfijn ontdekken"');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Beste deals');
    expect(markup).toContain('href="/deals"');
  });
});

describe('CatalogSetCardCollection', () => {
  it('distinguishes continuous browse grids from standalone tile collections', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCardCollection gridMode="browse" variant="compact">
        <article>Cel</article>
      </CatalogSetCardCollection>,
    );

    expect(markup).toContain('setCardCollectionBrowse');
    expect(markup).toContain('setCardCollectionCompact');
  });
});
