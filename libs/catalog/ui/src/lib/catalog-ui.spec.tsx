import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogBrowsePagination,
  CatalogQuickFilterBar,
  CatalogSetCard,
  CatalogSetCardCollection,
  CatalogSetDetailPanel,
  CatalogSetProductFeatures,
  CatalogSetProductDescription,
  CatalogThemeHighlight,
  CatalogVisualTile,
  CatalogVisualTileRail,
} from './catalog-ui';
import {
  SET_CARD_MOBILE_VIEW_STORAGE_KEY,
  normalizeSetCardMobileView,
} from './catalog-set-card-mobile-layout';
import { getAccessibleForegroundColor } from '@lego-platform/shared/util';

describe('CatalogSetCard', () => {
  function parseTestHexColor(
    color: string,
  ): [red: number, green: number, blue: number] {
    const match = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu);

    if (!match) {
      throw new Error(`Invalid hex color: ${color}`);
    }

    return [
      parseInt(match[1], 16),
      parseInt(match[2], 16),
      parseInt(match[3], 16),
    ];
  }

  function getTestRelativeLuminance(color: string): number {
    const [red, green, blue] = parseTestHexColor(color).map((channel) => {
      const normalizedChannel = channel / 255;

      return normalizedChannel <= 0.03928
        ? normalizedChannel / 12.92
        : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function getTestContrastRatio(
    foregroundHex: string,
    backgroundColor: string,
  ): number {
    const foregroundLuminance = getTestRelativeLuminance(foregroundHex);
    const backgroundLuminance = getTestRelativeLuminance(backgroundColor);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  }

  it('prefers stored card images before hero and external image URLs', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          cardImageUrl: '/images/sets/10316/card.webp',
          id: '10316',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/123.jpg',
          name: 'Rivendell',
          pieces: 6167,
          primaryImage: '/images/sets/10316/hero.webp',
          releaseYear: 2023,
          slug: 'rivendell-10316',
          theme: 'Icons',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('src="/images/sets/10316/card.webp"');
    expect(markup).not.toContain('src="/images/sets/10316/hero.webp"');
  });

  it('uses migrated summary card URLs before stored hero URLs', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          imageUrl: '/images/sets/10316/card.webp',
          name: 'Rivendell',
          pieces: 6167,
          primaryImage: '/images/sets/10316/hero.webp',
          releaseYear: 2023,
          slug: 'rivendell-10316',
          theme: 'Icons',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('src="/images/sets/10316/card.webp"');
    expect(markup).not.toContain('src="/images/sets/10316/hero.webp"');
  });

  it('falls back from card image URLs to external image URLs for set cards', () => {
    const externalMarkup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        setSummary={{
          id: '10316',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/123.jpg',
          name: 'Rivendell',
          pieces: 6167,
          releaseYear: 2023,
          slug: 'rivendell-10316',
          theme: 'Icons',
        }}
        variant="featured"
      />,
    );

    expect(externalMarkup).toContain(
      'url=https%3A%2F%2Fcdn.rebrickable.com%2Fmedia%2Fsets%2F10316-1%2F123.jpg',
    );
  });

  function readPaginationBreakpointMarkup(
    markup: string,
    breakpoint: 'desktop' | 'mobile' | 'tablet',
  ) {
    if (breakpoint === 'mobile') {
      return (
        markup.match(
          /<span[^>]+data-pagination-breakpoint="mobile"[^>]*>[\s\S]*?<\/span>/u,
        )?.[0] ?? ''
      );
    }

    const match = markup.match(
      new RegExp(
        `<ol[^>]+data-pagination-breakpoint="${breakpoint}"[^>]*>[\\s\\S]*?</ol>`,
        'u',
      ),
    );

    return match?.[0] ?? '';
  }

  it('keeps catalog component CSS in a later cascade layer than shared primitives', () => {
    const catalogCss = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const sharedCss = readFileSync(
      resolve(process.cwd(), 'libs/shared/ui/src/lib/shared-ui.module.css'),
      'utf-8',
    );

    expect(sharedCss).toContain('@layer reset, shared, catalog;');
    expect(sharedCss).toContain('@layer shared {');
    expect(catalogCss).toContain('@layer reset, shared, catalog;');
    expect(catalogCss).toContain('@layer catalog {');
    expect(sharedCss).toContain('.detailAccordionDisclosure');
    expect(catalogCss).toContain('--product-description-padding-inline: var(');
    expect(catalogCss).toContain('--lego-section-inline-padding,');
    expect(catalogCss).toContain(
      'padding-inline: var(--product-description-padding-inline);',
    );
    expect(
      catalogCss.match(
        /padding-inline: var\(--product-description-padding-inline\);/gu,
      )?.length,
    ).toBeGreaterThanOrEqual(1);
    expect(sharedCss).toContain('.detailAccordionTitle');
    expect(sharedCss).toContain('font-size: 20px;');
    expect(sharedCss).toContain('.detailAccordionIconFrame');
    expect(sharedCss).toContain('flex: 0 0 2.75rem;');
    expect(catalogCss).toContain('max-inline-size: 72ch;');
    expect(catalogCss).toContain('max-height: min(26rem, 62vw);');
    expect(sharedCss).toContain('transform: rotate(-90deg);');
    expect(sharedCss).toContain(
      '.detailAccordionDisclosure[open] .detailAccordionIcon',
    );
    expect(catalogCss).not.toContain('.productDescriptionTitle');
    expect(catalogCss).not.toContain('.productDescriptionIconFrame');
    expect(catalogCss).not.toContain('--lego-text-role-section-title-');
  });

  it('renders crawlable shared browse pagination links with preserved query params', () => {
    const markup = renderToStaticMarkup(
      <CatalogBrowsePagination
        ariaLabel="Collectiepagina's"
        basePath="/lego-voor-volwassenen"
        currentPage={2}
        pageCount={3}
        queryParams={{ sort: 'newest' }}
      />,
    );

    expect(markup).toContain('Collectiepagina');
    expect(markup).toContain('href="/lego-voor-volwassenen?sort=newest"');
    expect(markup).toContain(
      'href="/lego-voor-volwassenen?sort=newest&amp;page=2"',
    );
    expect(markup).toContain(
      'href="/lego-voor-volwassenen?sort=newest&amp;page=3"',
    );
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Vorige');
    expect(markup).toContain('Volgende');
  });

  it('renders compact adaptive browse pagination for long result sets', () => {
    const markup = renderToStaticMarkup(
      <CatalogBrowsePagination
        ariaLabel="Collectiepagina's"
        basePath="/nieuwe-lego-sets"
        currentPage={8}
        pageCount={19}
        queryParams={{ sort: 'newest' }}
      />,
    );
    const mobileMarkup = readPaginationBreakpointMarkup(markup, 'mobile');
    const tabletMarkup = readPaginationBreakpointMarkup(markup, 'tablet');
    const desktopMarkup = readPaginationBreakpointMarkup(markup, 'desktop');

    expect(mobileMarkup).toContain('8 van 19');
    expect(mobileMarkup).toContain('aria-current="page"');
    expect(mobileMarkup).not.toContain('browsePaginationPageLink');
    expect(
      [...markup.matchAll(/class="[^"]*browsePaginationPageLink/g)].length,
    ).toBeLessThan(19);

    expect(tabletMarkup).toContain('>1</a>');
    expect(tabletMarkup).toContain('>7</a>');
    expect(tabletMarkup).toContain('>8</a>');
    expect(tabletMarkup).toContain('>9</a>');
    expect(tabletMarkup).toContain('>19</a>');
    expect(tabletMarkup).toContain('...');

    expect(
      [...desktopMarkup.matchAll(/browsePaginationPageLink/g)].length,
    ).toBeLessThanOrEqual(7);
    expect(markup).toContain('href="/nieuwe-lego-sets?sort=newest&amp;page=7"');
    expect(markup).toContain('href="/nieuwe-lego-sets?sort=newest&amp;page=9"');
    expect(markup).toContain('aria-current="page"');
  });

  it('renders a back-to-top link when browse pagination is unnecessary', () => {
    const markup = renderToStaticMarkup(
      <CatalogBrowsePagination
        ariaLabel="Collectiepagina's"
        basePath="/laatste-kans-lego-sets"
        pageCount={1}
      />,
    );

    expect(markup).toContain('href="#top"');
    expect(markup).toContain('Terug naar boven');
    expect(markup).not.toContain('Volgende');
  });

  it('renders set detail gallery rounded on desktop and edge-to-edge on mobile', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const galleryVisualRule =
      css.match(/\.galleryMainVisual \{[^}]+\}/u)?.[0] ?? '';
    const galleryImageLayerRule =
      css.match(/\.galleryMainImageLayer \{[^}]+\}/u)?.[0] ?? '';
    const galleryThumbRule =
      css.match(/\.galleryThumbButton \{[^}]+\}/u)?.[0] ?? '';

    expect(css).toContain('.galleryMainButton {');
    expect(css).toContain('border-radius: var(--lego-radius-md);');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toMatch(/\.galleryMain \{\s+margin-inline: calc\(/u);
    expect(css).toMatch(
      /\.galleryMainButton,\s+\.galleryMainVisual \{\s+border-radius: 0;/u,
    );
    expect(css).toContain('border-radius: 0;');
    expect(css).toMatch(/\.galleryMainVisual \{\s+border: 0;/u);
    expect(galleryVisualRule).toContain('aspect-ratio: 1 / 1;');
    expect(galleryVisualRule).toContain('contain: paint;');
    expect(galleryVisualRule).toContain('transition: border-color');
    expect(galleryVisualRule).not.toContain('box-shadow var(');
    expect(css).toContain('height: clamp(28rem, 58vh, 42rem);');
    expect(css).not.toContain('height: 32rem;');
    expect(css).not.toContain('min-height: 32rem;');
    expect(galleryImageLayerRule).toContain('contain: paint;');
    expect(galleryThumbRule).toContain('transition: border-color');
    expect(galleryThumbRule).not.toContain('box-shadow var(');
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
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          collectorAngle: 'Prestige display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy but premium availability',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('width="420"');
    expect(markup).toContain('height="420"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('srcSet="/_next/image?url=');
    expect(markup).toContain(
      'sizes="(min-width: 64rem) 280px, (min-width: 48rem) 33vw, 100vw"',
    );
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup).not.toContain('Set 10316');
    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('aria-label="Bekijk Rivendell"');
    expect(markup).not.toContain('aria-label="Bekijk set, prijs volgt"');
    expect(markup).toContain('title="Bekijk set, prijs volgt"');
    expect(markup).not.toContain('A flagship fantasy build');
    expect(markup).not.toContain('Reviewed prijs');
    expect(markup).not.toContain('Dekking');
  });

  it('renders compact browse metadata before the title', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Actuele prijs gevonden',
          currentPrice: 'Vanaf € 489,99',
          decisionLabel: 'Beste prijs',
          merchantLabel: 'Laagst bij Brickshop',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
        variant="compact"
      />,
    );
    const factsIndex = markup.indexOf('cardFactRow');
    const titleIndex = markup.indexOf('<h3');

    expect(factsIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(-1);
    expect(factsIndex).toBeLessThan(titleIndex);
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
  });

  it('simplifies compact browse facts while preserving accessible labels', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/f1-pit-stop-60443"
        setSummary={{
          id: '60443',
          slug: 'f1-pit-stop-60443',
          name: 'F1 Pit Stop',
          theme: 'City',
          releaseYear: 2026,
          pieces: 788,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/60443-1/123.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('Uitgekomen in 2026');
    expect(markup).toContain('788 stenen');
    expect(markup).not.toContain('aria-label="Uitgekomen in 2026"');
    expect(markup).not.toContain('aria-label="788 stenen"');
    expect(markup).toContain('>2026</span>');
    expect(markup).toContain('>788</span>');
    expect(markup).not.toContain('>Nieuw in 2026</span>');
    expect(markup).toContain('>788 stenen</span>');
    expect(markup).toContain('lucide-toy-brick');
  });

  it('styles compact browse spacing, metadata, price, and CTA alignment', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain(
      ".setCardCompact[data-catalog-set-card-variant='compact'] > .setCardLink,",
    );
    expect(css).toContain(
      ".setCardCompact[data-catalog-set-card-variant='featured'] > .setCardLink {",
    );
    expect(css).toContain('gap: var(--catalog-rail-card-link-gap);');
    expect(css).toContain(
      'padding-block-start: var(--catalog-rail-card-link-padding-block-start);',
    );
    expect(css).toContain('aspect-ratio: 1 / 1.08;');
    expect(css).toContain('min-height: 11.65rem;');
    expect(css).toContain(
      'padding: var(--catalog-rail-card-media-padding-block-start)',
    );
    expect(css).toMatch(/\.cardCompactBody \{[\s\S]*gap: 0\.48rem;/u);
    expect(css).toMatch(/\.cardFactItem \{[\s\S]*font-size: 0\.875rem;/u);
    expect(css).toMatch(
      /\.cardCompactBrowsePriceValue \{[\s\S]*font-weight: 700;/u,
    );
    const compactFooterBlock =
      css.match(/\.cardCompactFooter \{[^}]+\}/u)?.[0] ?? '';

    expect(compactFooterBlock).toContain('justify-content: flex-start;');
    expect(compactFooterBlock).not.toContain('justify-content: flex-end;');
  });

  it('keeps rail card mobile density and resize-safe square image constraints', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railTrackBlock =
      css.match(/\.setCardRailTrack \{[^}]+\}/u)?.[0] ?? '';
    const railImageBlock =
      css.match(
        /\.setCardCollectionRail > \.setCardCompact > \.setCardLink > \.setVisual \{[^}]+\}/u,
      )?.[0] ?? '';
    const stableSquareImageBlock =
      css.match(
        /\.setCardRailStableSquare[\s\S]+?> \.setVisual \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(railTrackBlock).toContain(
      'grid-auto-columns: calc(\n      (100% - (var(--catalog-rail-card-gap) * 0.75)) / 1.75\n    );',
    );
    expect(railTrackBlock).toContain('scroll-snap-type: x proximity;');
    expect(railImageBlock).toContain(
      'aspect-ratio: var(--catalog-rail-card-image-ratio);',
    );
    expect(railImageBlock).toContain('inline-size: 100%;');
    expect(stableSquareImageBlock).toContain('contain: layout paint;');
  });

  it('uses compact blue browse CTA styling without changing featured actions', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const compactCardBlock =
      css.match(/\.setCardCompact \{[^}]+\}/u)?.[0] ?? '';
    const collectionBrowseBlock =
      css.match(/\.setCardCollectionBrowse \{[^}]+\}/u)?.[0] ?? '';
    const collectionBrowseFocusBlock =
      css.match(
        /\.setCardCollectionBrowse > \.setCard:focus-within \{[^}]+\}/u,
      )?.[0] ?? '';
    const compactBrowseActionBlock =
      css.match(
        /\.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactActionBrowse,[\s\S]+?\.cardCompactActionPending:visited \{[\s\S]+?\n {2}\}/u,
      )?.[0] ?? '';
    const compactBrowseActionIconBlock =
      css.match(
        /\.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactPrimaryAction\s+\.cardCompactActionIcon \{[^}]+\}/u,
      )?.[0] ?? '';
    const compactBrowseActionLabelBlock =
      css.match(
        /\.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactPrimaryAction\s+\.cardCompactActionLabel \{[^}]+\}/u,
      )?.[0] ?? '';
    const desktopCompactBrowseActionBlock =
      css.match(
        /@media \(min-width: 48rem\) \{[\s\S]+?\.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactActionBrowse,[\s\S]+?\.cardCompactActionPending:visited \{[\s\S]+?\n {4}\}/u,
      )?.[0] ?? '';
    const desktopCompactBrowseActionLabelBlock =
      css.match(
        /@media \(min-width: 48rem\) \{[\s\S]+?\.setCardCompact \.cardCompactPrimaryAction \.cardCompactActionLabel \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(compactCardBlock).toContain(
      '--rail-card-border: color-mix(\n      in srgb,\n      var(--lego-border-subtle) 86%,\n      transparent\n    );',
    );
    expect(collectionBrowseBlock).toContain(
      '--catalog-browse-grid-divider-color: color-mix(\n      in srgb,\n      var(--lego-border-subtle) 86%,\n      transparent\n    );',
    );
    expect(collectionBrowseBlock).toContain(
      '--catalog-browse-grid-hover-ring-color: transparent;',
    );
    expect(collectionBrowseBlock).toContain(
      '--catalog-browse-grid-focus-ring-color: color-mix(\n      in srgb,\n      var(--lego-border) 42%,\n      transparent\n    );',
    );
    expect(collectionBrowseFocusBlock).toContain(
      'var(--catalog-browse-grid-focus-ring-color)',
    );
    expect(compactBrowseActionBlock).toContain(
      'font-size: var(--lego-text-role-meta-size);',
    );
    expect(compactBrowseActionBlock).toContain(
      'inline-size: var(--catalog-card-action-height);',
    );
    expect(compactBrowseActionBlock).toContain('min-height: 2.75rem;');
    expect(compactBrowseActionBlock).toContain(
      'min-width: var(--catalog-card-action-height);',
    );
    expect(compactBrowseActionBlock).toContain('padding-inline: 0;');
    expect(compactBrowseActionIconBlock).toContain('display: block;');
    expect(compactBrowseActionLabelBlock).toContain('display: none;');
    expect(desktopCompactBrowseActionBlock).toContain('min-height: 2.75rem;');
    expect(desktopCompactBrowseActionBlock).toContain(
      'padding-inline: 0.95rem;',
    );
    expect(desktopCompactBrowseActionBlock).toContain('gap: 0.55rem;');
    expect(desktopCompactBrowseActionLabelBlock).toContain('display: inline;');
    expect(css).toContain('.setCardCollectionFeatured');
    expect(css).toContain('.cardCompactActionCommerce,');
    expect(css).toContain('background: var(--lego-accent);');
    expect(css).toContain('.cardCompactActionPending,');
    expect(css).toContain('background: var(--lego-surface-muted);');
  });

  it('neutralizes compact hover borders while preserving focus visibility', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const compactCardBlock =
      css.match(/\.setCardCompact \{[^}]+\}/u)?.[0] ?? '';
    const cardLinkFocusBlock =
      css.match(
        /\.setCard:has\(\.setCardClickLayer:focus-visible\) \{[^}]+\}/u,
      )?.[0] ?? '';
    const cardLinkFocusHaloBlock =
      css.match(
        /\.setCard:has\(\.setCardClickLayer:focus-visible\)::after \{[^}]+\}/u,
      )?.[0] ?? '';
    const hoverBlock = css.match(/\n {4}\.setCard:hover \{[^}]+\}/u)?.[0] ?? '';

    expect(compactCardBlock).toContain(
      '--rail-card-border: color-mix(\n      in srgb,\n      var(--lego-border-subtle) 86%,\n      transparent\n    );',
    );
    expect(compactCardBlock).toContain(
      '--catalog-card-hover-border-color: var(--rail-card-border);',
    );
    expect(compactCardBlock).toContain(
      '--catalog-card-hover-outline-color: transparent;',
    );
    expect(css).not.toContain('\n  .setCard:focus-within {');
    expect(cardLinkFocusBlock).toContain(
      'border-color: var(--catalog-card-interaction-border-color);',
    );
    expect(cardLinkFocusBlock).toContain(
      'outline: var(--catalog-card-focus-ring-width) solid',
    );
    expect(cardLinkFocusBlock).toContain(
      'var(--catalog-card-focus-ring-color);',
    );
    expect(cardLinkFocusBlock).toContain(
      'outline-offset: var(--catalog-card-focus-ring-offset);',
    );
    expect(cardLinkFocusHaloBlock).toContain(
      'box-shadow: 0 0 0 var(--catalog-card-focus-ring-offset)',
    );
    expect(hoverBlock).toContain(
      'border-color: var(--catalog-card-hover-border-color);',
    );
    expect(hoverBlock).toContain(
      'box-shadow: inset 0 0 0 1px var(--catalog-card-hover-outline-color);',
    );
  });

  it('keeps public set-card transitions narrow and resize-safe', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const setCardBlock = css.match(/\n {2}\.setCard \{[^}]+\}/u)?.[0] ?? '';
    const compactActionBlock =
      css.match(/\n {2}\.cardCompactAction \{[^}]+\}/u)?.[0] ?? '';
    const transitionDeclarations =
      css.match(/transition(?:-property)?:[^;]+;/gu) ?? [];
    const layoutTransitionPattern =
      /\b(width|height|max-height|min-height|padding|margin|gap|grid-template|flex-basis|left|right|top|bottom)\b/u;

    expect(transitionDeclarations.join('\n')).not.toContain('transition: all');
    expect(transitionDeclarations.join('\n')).not.toContain(
      'transition-property: all',
    );
    expect(transitionDeclarations).not.toEqual(
      expect.arrayContaining([expect.stringMatching(layoutTransitionPattern)]),
    );
    expect(setCardBlock).toContain('transition:');
    expect(setCardBlock).toContain('border-color');
    expect(setCardBlock).not.toContain('container:');
    expect(setCardBlock).not.toContain('box-shadow var(');
    expect(compactActionBlock).not.toContain('transition:');
  });

  it('keeps rich rail borderless styling scoped to inverse editorial rails', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const themePageSource = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-theme-page/src/lib/catalog-feature-theme-page.tsx',
      ),
      'utf-8',
    );
    const themedRailCardRule =
      css.match(/\.setCardRailSectionThemed \.setCard \{[^}]+\}/u)?.[0] ?? '';
    const inverseRailCardRule =
      css.match(
        /\.sectionShellInverse \.setCardRailTrack > \.setCard \{[^}]+\}/u,
      )?.[0] ?? '';
    const dealRailStart = themePageSource.indexOf(
      'export function CatalogFeatureThemeDealRail',
    );
    const relatedArticlesStart = themePageSource.indexOf(
      'export function CatalogFeatureThemeRelatedArticles',
    );
    const dealRailSource = themePageSource.slice(
      dealRailStart,
      relatedArticlesStart,
    );

    expect(themedRailCardRule).toContain('--rail-card-border: transparent;');
    expect(themedRailCardRule).toContain(
      '--catalog-card-focus-ring-color: var(',
    );
    expect(inverseRailCardRule).toContain('--rail-card-border: transparent;');
    expect(inverseRailCardRule).toContain(
      '--catalog-card-focus-ring-color: var(--lego-contrast-white);',
    );
    expect(dealRailSource).toContain('className={styles.dealSection}');
    expect(dealRailSource).toContain('tone="inverse"');
    expect(dealRailSource).not.toContain('tone="default"');
    expect(dealRailSource).not.toContain('surfaceVariant="themed"');
  });

  it('keeps the theme detail deal rail skeleton on the inverse editorial tone', () => {
    const themeRouteSource = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/themes/[slug]/page.tsx'),
      'utf-8',
    );
    const fallbackStart = themeRouteSource.indexOf(
      '<CatalogSetCardRailSkeletonSection',
    );
    const fallbackEnd = themeRouteSource.indexOf('/>', fallbackStart);
    const fallbackSource = themeRouteSource.slice(fallbackStart, fallbackEnd);

    expect(fallbackSource).not.toContain('eyebrow=');
    expect(fallbackSource).toContain('itemCount={5}');
    expect(fallbackSource).toContain('tone="inverse"');
    expect(fallbackSource).not.toContain('tone="default"');
    expect(fallbackSource).not.toContain('surfaceVariant="themed"');
  });

  it('keeps compact visual badge positioning untouched', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toMatch(/\.visualOverlay \{[\s\S]*right: 0;[\s\S]*top: 0;/u);
    expect(css).not.toContain(
      "[data-catalog-set-card-variant='compact'] .visualOverlay",
    );
  });

  it('renders only the visible price on compact browse set cards', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Actuele prijs gevonden',
          currentPrice: 'Vanaf € 489,99',
          decisionLabel: 'Beste prijs',
          merchantLabel: 'Laagst bij Brickshop',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('€ 489,99');
    expect(markup).not.toContain('Vanaf € 489,99');
    expect(markup).not.toContain('Beste prijs');
    expect(markup).not.toContain('Reviewed prijs');
    expect(markup).not.toContain('Dekking');
  });

  it('keeps the browse price prefix available to assistive technology', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Actuele prijs gevonden',
          currentPrice: 'Vanaf € 489,99',
          merchantLabel: 'Laagst bij Brickshop',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('visuallyHidden');
    expect(markup).toContain('>Vanaf </span>€ 489,99');
  });

  it('does not show the set number on regular compact browse cards', () => {
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
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).not.toContain('cardCompactMeta');
    expect(markup).not.toContain('Set 10316');
  });

  it('keeps featured deal cards calm while preserving accessible price context', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        ctaMode="commerce"
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: '4 actuele winkels',
          currentPrice: 'Vanaf € 489,99',
          dealReason: '6 ct/steen',
          decisionLabel: 'Sterke deal',
          discountMetric: '€ 80 onder de adviesprijs',
          merchantLabel: 'Laagst bij Brickshop',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup).not.toContain('aria-label="Vanaf € 489,99"');
    expect(markup).toContain('>Vanaf </span>€ 489,99');
    expect(markup).not.toContain('>Vanaf € 489,99<');
    expect(markup).not.toContain('6 ct/steen');
    expect(markup).not.toContain('cent per steen');
    expect(markup).toContain('€ 80 onder de adviesprijs');
    expect(markup).toContain('Laagst bij Brickshop');
    expect(markup).not.toContain('Sterke deal');
    expect(markup.match(/discountMetric/g) ?? []).toHaveLength(1);
    expect(markup.match(/cardCompactSupporting/g) ?? []).toHaveLength(1);
  });

  it('uses the rail-card price scale and calmer spacing for featured deal cards', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const priceBlockRule = css.slice(
      css.indexOf('.priceCompactBlock {'),
      css.indexOf('.cardCompactBrowsePrice {'),
    );
    const featuredBodyRule = css.slice(
      css.indexOf('.featuredCardBody {'),
      css.indexOf('.featuredPriceValue {'),
    );
    const featuredPriceRule = css.slice(
      css.indexOf('.featuredPriceValue {'),
      css.indexOf('.cardCompactFooter {'),
    );

    expect(priceBlockRule).toContain('gap: 0.35rem;');
    expect(priceBlockRule).toContain('min-block-size: 4.75rem;');
    expect(featuredBodyRule).toContain('gap: 0.88rem;');
    expect(featuredPriceRule).toContain('font-size: 1.5rem;');
    expect(featuredPriceRule).toContain('font-weight: 700;');
    expect(featuredPriceRule).toContain('line-height: 1.08;');
  });

  it('keeps featured deal card layout selectors aligned with compact browse cards', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.setCardCollectionBrowse.setCardCollectionFeatured');
    expect(css).not.toContain(
      '.setCardCollectionFeatured > .setCardCompact > .setCardLink {',
    );
    expect(css).toContain('grid-row: 1 / span 5;');
    expect(css).toContain('> .cardFeaturedSupportingSlot');
    expect(css).toContain('.setCardCollectionFeatured');
    expect(css).toContain('> .priceCompactBlock');
    expect(css).toContain('.cardCompactDecisionZone {');
  });

  it('allows callers to prioritize a known above-the-fold set image', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        imageFetchPriority="high"
        imageLoading="eager"
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
        }}
      />,
    );

    expect(markup).toContain('fetchPriority="high"');
    expect(markup).toContain('loading="eager"');
    expect(markup).toContain('srcSet="/_next/image?url=');
  });

  it('keeps unknown remote set images as plain images to avoid broken Next image hosts', () => {
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
        }}
      />,
    );

    expect(markup).toContain('src="https://images.example/rivendell.jpg"');
    expect(markup).not.toContain('/_next/image?url=');
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

  it('does not synthesize hardcoded theme colors for compact set cards', () => {
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

    expect(markup).not.toContain('--card-theme-badge-bg:#6f8594');
    expect(markup).not.toContain('--card-theme-badge-text:#ffffff');
  });

  it('uses Supabase theme presentation colors for compact set-card theme badges', () => {
    const surfaceColor = '#171717';
    const badgeForeground = getAccessibleForegroundColor(surfaceColor);
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/darth-vader-bust-75439"
        setSummary={{
          id: '75439',
          slug: 'darth-vader-bust-75439',
          name: 'Darth Vader Bust',
          theme: 'Star Wars',
          publicTheme: {
            name: 'Star Wars',
            slug: 'star-wars',
            surfaceColor,
          },
          releaseYear: 2025,
          pieces: 327,
          imageUrl: 'https://images.example/darth-vader.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain('--card-theme-badge-accent:#171717');
    expect(markup).toContain(`--card-theme-badge-bg:${surfaceColor}`);
    expect(markup).toContain(`--card-theme-badge-text:${badgeForeground}`);
    expect(
      getTestContrastRatio(badgeForeground, surfaceColor),
    ).toBeGreaterThanOrEqual(4.5);
    expect(markup).toContain('>Star Wars<');
  });

  it('uses Pokémon theme presentation colors for set-card theme badges', () => {
    const surfaceColor = '#f5d547';
    const badgeForeground = getAccessibleForegroundColor(surfaceColor);
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/pikachu-21587"
        setSummary={{
          id: '21587',
          slug: 'pikachu-21587',
          name: 'Pikachu',
          theme: 'Pokémon',
          publicTheme: {
            name: 'Pokémon',
            slug: 'pokemon',
            surfaceColor,
          },
          releaseYear: 2026,
          pieces: 683,
          imageUrl: 'https://images.example/pikachu.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain(`--card-theme-badge-bg:${surfaceColor}`);
    expect(markup).toContain(`--card-theme-badge-text:${badgeForeground}`);
    expect(
      getTestContrastRatio(badgeForeground, surfaceColor),
    ).toBeGreaterThanOrEqual(4.5);
    expect(markup).toContain('>Pokémon<');
  });

  it('keeps theme badge and muted tile text above AA contrast on medium theme colors', () => {
    const surfaceColor = '#2f7fc0';
    const accessibleTextColor = '#05070d';
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/snackbartruck-60488"
        setSummary={{
          id: '60488',
          slug: 'snackbartruck-60488',
          name: 'Snackbartruck',
          theme: 'City',
          publicTheme: {
            name: 'City',
            slug: 'city',
            surfaceColor,
          },
          releaseYear: 2025,
          pieces: 345,
          imageUrl: 'https://images.example/snackbartruck.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain(`--card-theme-badge-accent:${surfaceColor}`);
    expect(markup).toContain(`--card-theme-badge-bg:${surfaceColor}`);
    expect(markup).toContain(`--card-theme-badge-text:${accessibleTextColor}`);
    expect(
      getTestContrastRatio(accessibleTextColor, surfaceColor),
    ).toBeGreaterThanOrEqual(4.5);
    expect(markup).toContain('--theme-card-foreground:#05070d');
    expect(markup).toContain('--theme-muted:#05070d');
    expect(markup).toContain('>City<');
  });

  it('computes an accessible badge text color when theme text color is missing', () => {
    const surfaceColor = '#e0b84f';
    const accessibleTextColor = '#05070d';
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/modular-display-10350"
        setSummary={{
          id: '10350',
          slug: 'modular-display-10350',
          name: 'Modular Display',
          theme: 'Icons',
          publicTheme: {
            name: 'Icons',
            slug: 'icons',
            surfaceColor,
          },
          releaseYear: 2026,
          pieces: 2210,
          imageUrl: 'https://images.example/modular-display.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).toContain(`--card-theme-badge-bg:${surfaceColor}`);
    expect(markup).toContain(`--card-theme-badge-text:${accessibleTextColor}`);
    expect(
      getTestContrastRatio(accessibleTextColor, surfaceColor),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('does not tint set-card theme badges with translucent overlay styling', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const compactBadgeRule =
      css.match(
        /\.setCardCompact\[data-catalog-set-card-variant='compact'\] \.cardThemeBadge,[\s\S]*?\.cardMetaRow \{/u,
      )?.[0] ?? '';

    expect(compactBadgeRule).toContain(
      'background: var(--card-theme-badge-bg, var(--lego-surface-muted));',
    );
    expect(compactBadgeRule).not.toContain('background: color-mix');
    expect(compactBadgeRule).not.toContain('transparent');
  });

  it('keeps neutral badge colors when theme presentation colors are missing', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/snackbartruck-60488"
        setSummary={{
          id: '60488',
          slug: 'snackbartruck-60488',
          name: 'Snackbartruck',
          theme: 'City',
          publicTheme: {
            name: 'City',
            slug: 'city',
          },
          releaseYear: 2025,
          pieces: 345,
          imageUrl: 'https://images.example/snackbartruck.jpg',
        }}
        variant="compact"
      />,
    );

    expect(markup).not.toContain('--card-theme-badge-bg:');
    expect(markup).not.toContain('--card-theme-badge-accent:');
    expect(markup).not.toContain('--card-theme-badge-text:');
    expect(markup).toContain('>City<');
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
            <button aria-label="Volg set" type="button">
              ♡
            </button>
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

    expect(markup).toContain('aria-label="Volg set"');
    expect(markup).toContain('Zoom');
    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('cardCompactDecisionZone');
    expect(markup).toContain('cardCompactFooterActions');
    expect(markup).toContain('data-catalog-set-card-click-layer="true"');
    expect(markup).not.toContain('Setnummer');

    const primaryActionStart = markup.indexOf(
      'aria-label="Bekijk set, prijs volgt"',
    );
    const followActionStart = markup.indexOf('aria-label="Volg set"');

    expect(primaryActionStart).toBeGreaterThan(-1);
    expect(followActionStart).toBeGreaterThan(primaryActionStart);
    expect(markup).toContain('Prijs volgt');
    expect(markup).toContain('href="/sets/rivendell-10316"');
  });

  it('renders featured deal-card follow actions next to the primary CTA', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={
          <button aria-label="Ontvolg set" type="button">
            ♥
          </button>
        }
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
        variant="featured"
      />,
    );

    expect(markup).toContain('aria-label="Ontvolg set"');
    expect(markup).toContain('Bekijk set');
    expect(markup).toContain('cardCompactFooterActions');

    const primaryActionStart = markup.indexOf('aria-label="Bekijk set"');
    const followActionStart = markup.indexOf('aria-label="Ontvolg set"');

    expect(primaryActionStart).toBeGreaterThan(-1);
    expect(followActionStart).toBeGreaterThan(primaryActionStart);
  });

  it('renders no-price featured cards with a neutral pending-price CTA next to follow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.tsx'),
      'utf-8',
    );
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        actions={<button aria-label="Volg set" type="button" />}
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
        variant="featured"
      />,
    );

    expect(markup).toContain('aria-label="Bekijk set, prijs volgt"');
    expect(markup).toContain('Prijs volgt');
    expect(markup).toContain('cardCompactActionPending');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('aria-label="Volg set"');
    expect(markup).not.toContain('>10316<');
    expect(source).toContain('icon: Clock3');

    const pendingActionStart = markup.indexOf(
      'aria-label="Bekijk set, prijs volgt"',
    );
    const followActionStart = markup.indexOf('aria-label="Volg set"');

    expect(followActionStart).toBeGreaterThan(pendingActionStart);
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
    const footerActionStart = markup.indexOf(
      'aria-label="Bekijk set, prijs volgt"',
    );

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
    expect(css).not.toContain('.setCardClickLayer:focus-visible::after {');
    expect(css).toContain('border-radius: inherit;');
    expect(css).toContain('.setCard:has(.setCardClickLayer:focus-visible)');
    expect(css).toContain('var(--catalog-card-focus-ring-color);');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain(
      'outline: var(--catalog-card-focus-ring-width) solid',
    );
    expect(css).toContain(
      'outline-offset: var(--catalog-card-focus-ring-offset);',
    );
    expect(css).toContain(
      'box-shadow: 0 0 0 var(--catalog-card-focus-ring-offset)',
    );
    expect(css).toContain('.cardCompactFooterActions {');
    expect(css).toContain('z-index: 2;');
  });

  it('left-aligns compact CTA rows and keeps primary and follow actions at 44px', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const footerActionsBlock =
      css.match(/\.cardCompactFooterActions \{[^}]+\}/u)?.[0] ?? '';
    const secondaryActionBlock =
      css.match(/\.cardCompactSecondaryAction \{[^}]+\}/u)?.[0] ?? '';
    const compactBrowseActionBlock =
      css.match(
        /\.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactActionBrowse,[\s\S]+?\.cardCompactActionPending:visited \{[\s\S]+?\n {2}\}/u,
      )?.[0] ?? '';
    const pendingActionBlock =
      css.match(
        /\.cardCompactActionPending,[\s\S]+?\.cardCompactActionPending:visited \{[^}]+\}/u,
      )?.[0] ?? '';
    const mobileLabelBlock =
      css.match(/\.cardCompactActionLabel \{[^}]+\}/u)?.[0] ?? '';
    const desktopPrimaryActionBlock =
      css.match(
        /@media \(min-width: 48rem\) \{[\s\S]+?\.setCardCompact \.cardCompactPrimaryAction,[\s\S]+?\.setCardCompact \.cardCompactPrimaryAction:visited \{[^}]+\}/u,
      )?.[0] ?? '';
    const desktopLabelBlock =
      css.match(
        /@media \(min-width: 48rem\) \{[\s\S]+?\.setCardCompact \.cardCompactPrimaryAction \.cardCompactActionLabel \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(footerActionsBlock).toContain('justify-content: flex-start;');
    expect(footerActionsBlock).toContain('margin-left: 0;');
    expect(footerActionsBlock).not.toContain('justify-content: flex-end;');
    expect(footerActionsBlock).not.toContain('margin-left: auto;');
    expect(secondaryActionBlock).toContain(
      '--catalog-card-action-height: 2.75rem;',
    );
    expect(compactBrowseActionBlock).toContain('min-height: 2.75rem;');
    expect(compactBrowseActionBlock).toContain('padding-inline: 0;');
    expect(pendingActionBlock).toContain(
      'background: var(--lego-surface-muted);',
    );
    expect(pendingActionBlock).toContain('color: var(--lego-text);');
    expect(mobileLabelBlock).toContain('display: none;');
    expect(desktopPrimaryActionBlock).toContain('gap: 0.55rem;');
    expect(desktopLabelBlock).toContain('display: inline;');
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
    expect(css).toContain('gap: 0.55rem;');
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
    expect(css).not.toMatch(/^ {2}\.sectionHeaderWithAside \{/mu);
    expect(css).toMatch(
      /@media \(min-width: 56rem\) \{[\s\S]*?\.sectionHeaderWithAside \{\s*gap: var\(--lego-space-3\);/u,
    );
    expect(css).toContain(
      'font-size: clamp(1.45rem, 1.28rem + 0.7vw, 1.75rem);',
    );
    expect(css).toContain('font-size: clamp(1.8rem, 1.5rem + 1.2vw, 2.25rem);');
    expect(css).toContain(
      '.sectionHeaderTitle {\n      font-size: var(--lego-text-role-section-size);',
    );
    expect(css).toContain('text-decoration: underline;');
    expect(source).toContain('tone="card"');
  });

  it('keeps rail heading buttons square, bordered, focused, and visible on inverse rails', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const railSource = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/ui/src/lib/catalog-set-card-rail.tsx',
      ),
      'utf-8',
    );
    const headingButtonRule =
      css.match(/\.setCardRailHeadingButton \{[^}]+\}/u)?.[0] ?? '';
    const inverseUtilityRule =
      css.match(
        /\.sectionHeaderInverse \.sectionHeaderUtility \{[^}]+\}/u,
      )?.[0] ?? '';
    const inverseFocusRule =
      css.match(
        /\.sectionHeaderInverse \.setCardRailHeadingButton \{[^}]+\}/u,
      )?.[0] ?? '';

    expect(railSource).toContain('variant="icon-secondary"');
    expect(railSource).toContain('size="icon-md"');
    expect(headingButtonRule).toContain(
      '--lego-button-secondary-border-color: currentColor;',
    );
    expect(headingButtonRule).toContain(
      '--lego-button-secondary-hover-border-color: currentColor;',
    );
    expect(headingButtonRule).toContain(
      '--lego-button-secondary-active-border-color: currentColor;',
    );
    expect(headingButtonRule).not.toContain('min-height: 2.4rem;');
    expect(headingButtonRule).not.toContain('min-width: 2.4rem;');
    expect(inverseUtilityRule).toContain('color: #ffffff;');
    expect(inverseFocusRule).toContain(
      '--lego-button-focus-ring-color: var(--lego-contrast-white);',
    );
  });

  it('keeps offer comparison card hover close to regular set card hover', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const offerCardRule =
      css.match(/\n {2}\.offerRailCard \{[^}]+\}/u)?.[0] ?? '';
    const bestDealRule =
      css.match(/\.offerRailCard\[data-best='true'\] \{[^}]+\}/u)?.[0] ?? '';
    const unknownStockRule =
      css.match(
        /\.offerRailCard\[data-stock-state='unknown'\] \{[^}]+\}/u,
      )?.[0] ?? '';
    const unknownLowerPriceRule =
      css.match(
        /\.offerRailCard\[data-stock-state='unknown'\]\[data-price-comparison='lower-unavailable'\]\s+\.offerRailPrice \{[^}]+\}/u,
      )?.[0] ?? '';
    const actionRule = css.match(/\.offerRailAction \{[^}]+\}/u)?.[0] ?? '';

    expect(offerCardRule).not.toContain('transform');
    expect(bestDealRule).not.toContain('translateY');
    expect(offerCardRule).toContain('border: var(--lego-border-width-1) solid');
    expect(offerCardRule).toContain('transition: border-color');
    expect(offerCardRule).not.toContain('box-shadow var(');
    expect(offerCardRule).toContain('background: var(--lego-surface-default);');
    expect(bestDealRule).toContain('background: var(--lego-positive-subtle);');
    expect(bestDealRule).toContain('--catalog-offer-card-border-color:');
    expect(bestDealRule).toContain(
      '--catalog-offer-card-interaction-border-color:',
    );
    expect(bestDealRule).toContain(
      '--catalog-offer-card-interaction-outline-color:',
    );
    expect(bestDealRule).toContain('var(--lego-positive) 36%');
    expect(bestDealRule).toContain('var(--lego-positive) 24%');
    expect(unknownStockRule).toContain(
      'background: var(--lego-surface-subtle);',
    );
    expect(unknownStockRule).not.toContain('color:');
    expect(unknownLowerPriceRule).toContain('color: var(--lego-text-muted);');
    expect(css).not.toContain(
      ".offerRailCardLink:hover .offerRailCard[data-best='true']",
    );
    expect(css).not.toContain(
      ".offerRailCardLink:hover .offerRailCard[data-price-comparison='lower-unavailable']",
    );
    expect(actionRule).toContain('width: 100%;');
    expect(actionRule).toContain('white-space: nowrap;');
    expect(actionRule).not.toContain('background:');
    expect(actionRule).not.toContain('border-color:');
    expect(actionRule).not.toContain('color:');
    expect(css).not.toContain('.offerRailViewAllAction');
    expect(css).not.toContain('.offerRailFooter');
    expect(css).not.toContain(
      ".offerRailCardLink:hover .offerRailAction[data-tone='secondary']",
    );
    expect(css).not.toContain(
      ".offerRailCardLink:focus-visible .offerRailAction[data-tone='secondary']",
    );
    expect(css).not.toContain(".offerRailAction[data-tone='secondary']");
    expect(css).not.toContain(".offerRailAction[data-tone='accent']");
    expect(css).toContain('white-space: nowrap;');
  });

  it('lets offer comparison cards scroll full-bleed on mobile only', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const viewportRule = css.match(/\.offerRailViewport \{[^}]+\}/u)?.[0] ?? '';
    const desktopViewportRule =
      css.match(
        /\.offerRailViewport \{\s+margin-inline: calc\(var\(--lego-space-1\) \* -1\);[^}]+\}/u,
      )?.[0] ?? '';

    expect(viewportRule).toContain('margin-inline: calc(50% - 50vw);');
    expect(viewportRule).toContain('contain: paint;');
    expect(viewportRule).toContain('--catalog-offer-rail-inline-padding: var(');
    expect(viewportRule).toContain(
      'padding: 0.25rem var(--catalog-offer-rail-inline-padding) 0.35rem;',
    );
    expect(viewportRule).toContain(
      'scroll-padding-inline: var(--catalog-offer-rail-inline-padding);',
    );
    expect(viewportRule).toContain('overflow-x: auto;');
    expect(viewportRule).toContain('overflow-y: hidden;');
    expect(desktopViewportRule).toContain(
      'margin-inline: calc(var(--lego-space-1) * -1);',
    );
    expect(desktopViewportRule).toContain(
      'padding: 0 var(--lego-space-1) 0.05rem;',
    );
    expect(desktopViewportRule).toContain(
      'scroll-padding-inline: var(--lego-space-1);',
    );
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
    expect(css).not.toContain(".offerRailAction[data-tone='accent']:hover");
    expect(css).not.toContain(".offerRailAction[data-tone='secondary']:hover");
    expect(css).not.toContain('.offerRailCardLink:hover .offerRailAction');
    expect(css).not.toContain(
      '.offerRailCardLink:focus-visible .offerRailAction',
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
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup.indexOf('cardFactRow')).toBeLessThan(markup.indexOf('<h3'));
    expect(markup.indexOf('<h3')).toBeLessThan(markup.indexOf('EUR 489.99'));
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
    expect(markup).not.toContain('EUR 10.00 below ref');
  });

  it('renders a compact deal reason under the price when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Op voorraad · 3 winkels nagekeken',
          currentPrice: '€ 489,99',
          dealReason: '€50 goedkoper dan de rest',
          merchantLabel: 'Nu het laagst bij bol',
          pricePositionLabel: 'Goede deal',
          pricePositionTone: 'positive',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup.indexOf('€ 489,99')).toBeLessThan(
      markup.indexOf('€50 goedkoper dan de rest'),
    );
    expect(markup).toContain('€50 goedkoper dan de rest');
  });

  it('renders a prominent discount metric under the price when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Op voorraad · 3 winkels nagekeken',
          currentPrice: '€ 489,99',
          discountMetric: '€ 60,00 goedkoper · 11% lager',
          merchantLabel: 'Nu het laagst bij bol',
          pricePositionLabel: 'Goede deal',
          pricePositionTone: 'positive',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup.indexOf('€ 489,99')).toBeLessThan(
      markup.indexOf('€ 60,00 goedkoper · 11% lager'),
    );
    expect(markup).toContain('data-catalog-discount-metric="true"');
    expect(markup).toContain('€ 60,00 goedkoper · 11% lager');
  });

  it('renders duplicate deal context only once', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Op voorraad · 3 winkels nagekeken',
          currentPrice: '€ 399,99',
          dealReason: '€ 66,99 goedkoper dan LEGO',
          discountMetric: '€ 66,99 goedkoper dan LEGO',
          merchantLabel: 'Nu het laagst bij MediaMarkt',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup.match(/€ 66,99 goedkoper dan LEGO/g) ?? []).toHaveLength(1);
    expect(markup).toContain('Laagst bij MediaMarkt');
  });

  it('does not render an empty deal reason fallback', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Op voorraad · 3 winkels nagekeken',
          currentPrice: '€ 489,99',
          merchantLabel: 'Nu het laagst bij bol',
          pricePositionLabel: 'Goede deal',
          pricePositionTone: 'positive',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup).not.toContain('class="dealReason"');
  });

  it('keeps deal reasons to one mobile-safe line', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const dealReasonRule = css.slice(
      css.indexOf('.dealReason {'),
      css.indexOf('.priceMeta {'),
    );

    expect(dealReasonRule).toContain('overflow: hidden;');
    expect(dealReasonRule).toContain('text-overflow: ellipsis;');
    expect(dealReasonRule).toContain('white-space: nowrap;');
    expect(dealReasonRule).toContain('min-width: 0;');
  });

  it('keeps discount metrics to one mobile-safe line', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const discountMetricRule = css.slice(
      css.indexOf('.discountMetric {'),
      css.indexOf('.dealReason {'),
    );

    expect(discountMetricRule).toContain('color: var(--lego-positive);');
    expect(discountMetricRule).toContain('overflow: hidden;');
    expect(discountMetricRule).toContain('text-overflow: ellipsis;');
    expect(discountMetricRule).toContain('white-space: nowrap;');
    expect(discountMetricRule).toContain('min-width: 0;');
  });

  it('does not rely on ambiguous truncated LEGO percentage copy', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
        href="/sets/rivendell-10316"
        priceContext={{
          coverageLabel: 'Op voorraad · 3 winkels nagekeken',
          currentPrice: '€ 399,99',
          discountMetric: '€ 66,99 goedkoper dan LEGO',
          merchantLabel: 'Actuele prijs bij MediaMarkt',
          reviewedLabel: 'Nagekeken 29 mrt',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell.jpg',
        }}
        variant="featured"
      />,
    );

    expect(markup).toContain('€ 66,99 goedkoper dan LEGO');
    expect(markup).not.toContain('22%');
    expect(markup).not.toContain('22% …');
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

  it('uses the affiliate product URL for commerce card primary CTAs', () => {
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

    expect(markup).toContain('Naar winkel');
    expect(markup).toContain('aria-label="Naar winkel"');
    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).not.toContain('Koop nu');
    expect(markup).toContain('href="https://merchant.example/rivendell"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer sponsored"');
    expect(markup).toContain('data-brickhunt-event="offer_click"');
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
          publicTheme: {
            logoUrl: '/themes/logos/icons_logo.png',
            name: 'Icons',
            slug: 'icons',
          },
          subtheme: 'The Lord of the Rings',
          releaseYear: 2023,
          pieces: 6181,
          imageUrl: 'https://images.example/rivendell-1.jpg',
          images: [
            {
              height: 900,
              imageRole: 'model_primary',
              order: 0,
              type: 'hero',
              url: 'https://images.example/rivendell-1.jpg',
              width: 1200,
            },
            {
              order: -100,
              type: 'social',
              url: 'https://images.example/rivendell-social.jpg',
            },
            {
              attributionText: 'Image(s) courtesy of Brickset.com',
              imageRole: 'lifestyle_room',
              order: 1,
              thumbnailUrl: 'https://images.example/rivendell-2-thumb.jpg',
              type: 'detail',
              url: 'https://images.example/rivendell-2.jpg',
            },
            {
              imageRole: 'model_secondary',
              order: 2,
              thumbnailUrl:
                'https://images.example/rivendell-product-thumb.jpg',
              type: 'detail',
              url: 'https://images.example/rivendell-product-white.jpg',
            },
            {
              imageRole: 'box_back',
              order: 3,
              thumbnailUrl:
                'https://images.example/rivendell-box-back-thumb.jpg',
              type: 'detail',
              url: 'https://images.example/rivendell-box-back.jpg',
            },
            {
              order: 4,
              type: 'thumbnail',
              url: 'https://images.example/rivendell-thumbnail-row.webp',
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
          legoProductDescription:
            '<p>Bouw de vallei van <strong>Rivendell</strong> met de Council of Elrond.</p><ul><li>Frodo</li><li><em>Elrond</em></li></ul>',
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
        productReviewsSlot={
          <section className="productReviewsSection">
            Productbeoordelingen
          </section>
        }
        reviewSummary={{
          averageRating: 4.8,
          reviewCount: 19,
        }}
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
    expect(markup).toContain('href="#productbeoordelingen"');
    expect(markup).toContain('(19)');
    expect(markup).toContain(
      '4,8 van 5 sterren, 19 beoordelingen. Ga naar Productbeoordelingen.',
    );
    expect(markup.indexOf('Rivendell')).toBeLessThan(
      markup.indexOf('href="#productbeoordelingen"'),
    );
    expect(markup).not.toContain('detailHeroIdentifier');
    expect(markup).toContain('aria-label="Afbeeldingen van Rivendell"');
    expect(markup).toContain('Open Rivendell LEGO-set in volledig scherm');
    expect(markup).toContain('alt="Icons logo"');
    expect(markup).toContain('aria-label="Bekijk Icons"');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('src="/themes/logos/icons_logo.png"');
    expect(markup.indexOf('src="/themes/logos/icons_logo.png"')).toBeLessThan(
      markup.indexOf('6.181'),
    );
    expect(markup).toContain('Bekijk deal bij bol');
    expect(markup).toContain(
      '€ 30,00 onder wat we meestal zien voor deze set.',
    );
    expect(markup).not.toContain('--catalog-theme-badge-surface:#f0c63b');
    expect(markup).not.toContain('--catalog-theme-badge-text:#171a22');
    expect(markup).not.toContain('Beste prijs nu');
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
    expect(markup).not.toContain('Vergelijk winkels');
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
    expect(markup).toContain('rel="noopener noreferrer sponsored"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('Bekijk deal');
    expect(markup).toContain('Naar winkel');
    expect(markup).toContain('LEGO');
    expect(markup).not.toContain('LEGO LEGO');
    expect(markup).not.toContain('Sterke deal');
    expect(markup).toContain('Nog niet klaar om te kopen?');
    expect(markup).toContain('Volg prijs');
    expect(markup.indexOf('Prijs in het kort')).toBeLessThan(
      markup.indexOf('Nog niet klaar om te kopen?'),
    );
    expect(markup).toContain('<details');
    expect(markup).not.toContain('<details open');
    expect(markup).not.toContain('Beschrijving van LEGO');
    expect(markup).toContain('<h2');
    expect(markup).toContain('Productgegevens</h2>');
    expect(markup).toContain('detailAccordionTitle');
    expect(markup).toContain('Productbeoordelingen');
    expect(markup).toContain('detailSectionsList');
    expect(markup.indexOf('detailSectionsList')).toBeLessThan(
      markup.indexOf('Productgegevens</h2>'),
    );
    expect(markup.indexOf('Productgegevens</h2>')).toBeLessThan(
      markup.indexOf('<section class="productReviewsSection">'),
    );
    expect(markup).toContain('Bouw de vallei van <strong>Rivendell</strong>');
    expect(markup).toContain('<li>Frodo</li>');
    expect(markup).toContain('<li><em>Elrond</em></li>');
    expect(markup).toContain('alt="Rivendell LEGO-set"');
    expect(markup).toContain('data-image-role="model_primary"');
    expect(markup).toContain('data-image-media-role="model"');
    expect(markup).toContain('data-image-orientation="landscape"');
    expect(
      markup.indexOf('https://images.example/rivendell-product-thumb.jpg'),
    ).toBeLessThan(
      markup.indexOf('https://images.example/rivendell-2-thumb.jpg'),
    );
    expect(
      markup.indexOf('https://images.example/rivendell-2-thumb.jpg'),
    ).toBeLessThan(
      markup.indexOf('https://images.example/rivendell-box-back-thumb.jpg'),
    );
    expect(markup).toContain('--gallery-image-aspect-ratio:1.3333');
    expect(markup).toContain('Zo lees je dit');
    expect(markup).toContain('Je ziet meteen of deze prijs echt opvalt.');
    expect(markup).toContain('Wat Brickhunt nu ziet');
    expect(markup).not.toContain(
      'Als je een grote Middle-earth-set wilt, pak je deze.',
    );
    expect(markup).toContain('Bekijk afbeelding 2');
    expect(markup).toContain('https://images.example/rivendell-2-thumb.jpg');
    expect(markup).not.toContain('rivendell-social.jpg');
    expect(markup).not.toContain('rivendell-thumbnail-row.webp');
    expect(markup).toContain('Image(s) courtesy of Brickset.com');
    expect(markup).toContain('In collectie zetten');
    expect(markup).not.toContain('Set 10316');
    expect(markup).toContain('10316');
    expect(markup).toContain('Leeftijd');
    expect(markup).toContain('18+');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('6.181');
    expect(markup).toContain('Minifiguren');
    expect(markup).toContain('15');
    expect(markup).toContain('Release');
    expect(markup).not.toContain('Formaat');
    expect(markup).not.toContain('72 × 50 × 39 cm');
    expect(markup).not.toContain('Uitgebracht in 2023');
    expect(markup).not.toContain('Wat hier blijft hangen');
    expect(markup).not.toContain(
      'Sterke prijs voor deze set. Als je hem wilt hebben, is dit een goed moment om te kopen.',
    );
    expect(markup).not.toContain('$499 to $569');

    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    expect(css).toContain('.setImageGalleryWithAttribution {');
    expect(css).toContain('gap: var(--lego-space-1);');
    expect(css).toContain('.setImageGalleryAttribution {');
    expect(css).toContain('font-size: var(--lego-caption-font-size);');
    expect(css).toContain('.bestDealAffiliateNote {');
    expect(css).toContain('.bestDealCard {');
    expect(css).toContain('border-radius: var(--lego-radius-md);');
    expect(css).toContain('.bestDealEvidenceText {');
    expect(css).not.toContain('.bestDealEvidencePill {');
    expect(css).not.toContain('.bestDealEvidenceSupportList {');
    expect(css).toContain(
      ".bestDealCard[data-tone='warning'] .bestDealEvidenceText",
    );
    expect(css).toContain('.bestDealAdvice {');
    expect(css).toContain('.bestDealTrustList {');
    expect(css).toContain('.bestDealTrustItem:nth-child(n + 3) {');
    expect(css).toContain('.bestDealMerchant {');
    expect(css).toContain('.bestDealMerchantLink {');
    expect(css).toContain('.merchantBrandInline {');
    expect(css).toContain('display: inline-flex;');
    expect(css).toContain('gap: 0.38rem;');
    expect(css).not.toContain('.bestDealRanking {');
    expect(css).toContain('.bestDealActionRow {');
    expect(css).toContain('--catalog-card-action-height: 3.35rem;');
    expect(css).toContain("data-action-layout='merchant'");
    expect(css).toContain('flex: 1 1 auto;');
    expect(css).toContain('flex: 0 0 var(--catalog-card-action-height);');
    expect(css).toContain('.bestDealFollowIconButton {');
    expect(css).toContain(
      '--catalog-hero-side-action-background: transparent;',
    );
    expect(css).not.toContain('data-hero-follow-tone');
    expect(css).not.toContain('.bestDealFollowIconButton[data-hero-follow');
    expect(css).not.toContain('.bestDealFollowAction[data-hero-follow');
    expect(css).toContain('--catalog-hero-side-action-background');
    expect(css).toContain('--catalog-hero-side-action-border-color');
    expect(css).toContain('--wishlist-button-background: var(');
    expect(css).toContain('--wishlist-button-border-color: var(');
    expect(css).toContain('--wishlist-button-color: var(');
    expect(css).toContain('--wishlist-button-active-background: var(');
    expect(css).toContain('--wishlist-button-active-border-color: var(');
    expect(css).toContain('--wishlist-button-active-color: var(');
    expect(css).toContain('--wishlist-button-active-hover-color: var(');
    expect(css).toContain('--wishlist-button-active-pressed-background: var(');
    expect(css).toContain(
      '--wishlist-button-active-pressed-border-color: var(',
    );
    expect(css).toContain('--wishlist-button-active-pressed-color: var(');
    expect(css).toContain('--lego-button-secondary-background');
    expect(css).toContain('--lego-button-secondary-border-color');
    expect(css).toContain('--lego-button-secondary-color');
    expect(css).toContain('--lego-button-accent-background');
    expect(css).toContain('--lego-button-accent-hover-background');
    expect(css).toContain('--lego-button-accent-active-background');
    expect(css).toContain('--lego-button-accent-color');
    expect(css).toContain('--lego-button-accent-hover-color');
    expect(css).toContain('--lego-button-accent-active-color');
    expect(css).toContain('#ffffff');
    expect(css).not.toContain("[class*='inlineToggleButtonActive']");
    expect(css).toContain('--catalog-hero-side-action-active-background');
    expect(css).toContain('--catalog-hero-side-action-active-border-color');
    expect(css).toContain('box-shadow: 0 0 0 4px var(--lego-focus-ring);');
    expect(css).toContain(
      'min-inline-size: var(--catalog-card-action-height, 3.35rem);',
    );
    const heroFollowVariableBlock =
      css.match(
        /\.bestDealSideAction,\s*\n\s*\.bestDealFollowAction \{[\s\S]+?\n\s*\}/u,
      )?.[0] ?? '';
    expect(heroFollowVariableBlock).toContain(
      '--catalog-hero-side-action-background',
    );
    expect(heroFollowVariableBlock).toContain(
      '--lego-button-secondary-background',
    );
    expect(heroFollowVariableBlock).toContain(
      '--lego-button-secondary-border-color',
    );
    expect(heroFollowVariableBlock).toContain('--lego-button-secondary-color');
    expect(heroFollowVariableBlock).toContain(
      '--lego-button-accent-background',
    );
    expect(heroFollowVariableBlock).toContain('--lego-button-accent-color');
    expect(heroFollowVariableBlock).toContain('#ffffff');
    expect(heroFollowVariableBlock).not.toContain('--lego-positive');
    expect(heroFollowVariableBlock).not.toContain('--lego-commerce');
    expect(css).toContain('.alertCard {');
    expect(css).toContain('.detailDecisionSupport {');
    expect(css).toContain('.offerListCard {');
    expect(css).toContain('.detailSectionsList {');
    expect(css).toContain('gap: 0;');
  });

  it('does not render the LEGO product description section without description', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductDescription description={undefined} />,
    );

    expect(markup).toBe('');
  });

  it('renders safe product description structure without opening by default', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductDescription
        description={
          '<p>Een <strong>displayset</strong><br>voor je plank.</p><ol><li>Eerste stap</li><li><em>Tweede stap</em></li></ol>'
        }
        imageAlt="Bloemenboeket LEGO-set"
        imageUrl="https://images.example/10280.jpg"
      />,
    );

    expect(markup).toContain('<details');
    expect(markup).not.toContain('<details open');
    expect(markup).toContain('<strong>displayset</strong><br/>voor je plank.');
    expect(markup).toContain('<ol');
    expect(markup).toContain('<li>Eerste stap</li>');
    expect(markup).toContain('<li><em>Tweede stap</em></li>');
    expect(markup).toContain('src="https://images.example/10280.jpg"');
  });

  it('stacks the product description image above text on mobile while keeping desktop text left', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toMatch(/\.productDescriptionVisual\s*\{[\s\S]*?order:\s*1;/u);
    expect(css).toMatch(/\.productDescriptionBody\s*\{[\s\S]*?order:\s*2;/u);
    expect(css).toMatch(
      /@media \(min-width:\s*72rem\)\s*\{[\s\S]*?\.productDescriptionBody\s*\{[\s\S]*?order:\s*1;[\s\S]*?\.productDescriptionVisual\s*\{[\s\S]*?order:\s*2;/u,
    );
  });

  it('converts bullet-like description lines into semantic list items', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductDescription
        description={
          '<p>Dit valt op:<br>• Een vaas vol kleur<br>- Lange stelen<br>* Displayklaar</p>'
        }
      />,
    );

    expect(markup).toContain('<p');
    expect(markup).toContain('Dit valt op:');
    expect(markup).toContain('<ul');
    expect(markup).toContain('<li>Een vaas vol kleur</li>');
    expect(markup).toContain('<li>Lange stelen</li>');
    expect(markup).toContain('<li>Displayklaar</li>');
  });

  it('renders unknown product description markup as escaped text', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductDescription
        description={'<script>x</script> Veilig'}
      />,
    );

    expect(markup).toContain('&lt;script&gt;x&lt;/script&gt; Veilig');
    expect(markup).not.toContain('<script>');
  });

  it('renders LEGO product features as a collapsed structured list', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductFeatures
        features={[
          {
            body: 'Bouw de zwarte en zilveren Mercedes-AMG F1 W15.',
            title: 'F1 displaymodel',
          },
          {
            body: 'Zet hem naast andere racewagens op je plank.',
            title: 'Voor verzamelaars',
          },
        ]}
      />,
    );

    expect(markup).toContain('<details');
    expect(markup).not.toContain('<details open');
    expect(markup).toContain('Productkenmerken');
    expect(markup).toContain('<strong>F1 displaymodel</strong>');
    expect(markup).toContain('Bouw de zwarte en zilveren Mercedes-AMG F1 W15.');
    expect(markup).toContain('<li');
  });

  it('does not render LEGO product features for a single plain feature', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetProductFeatures
        features={[
          {
            body: 'Een gewone beschrijving is nog geen featureblok.',
          },
        ]}
      />,
    );

    expect(markup).toBe('');
  });

  it('does not render an empty theme logo spec when the public theme has no logo', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '60488',
          slug: 'snackbartruck-60488',
          name: 'Snackbartruck',
          theme: 'City',
          publicTheme: {
            name: 'City',
            slug: 'city',
          },
          releaseYear: 2025,
          pieces: 345,
          imageUrl: 'https://images.example/snackbartruck.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
      />,
    );

    expect(markup).toContain('345');
    expect(markup).toContain('Release');
    expect(markup).not.toContain('_logo.png');
    expect(markup).not.toContain('heroThemeLogo');
  });

  it('uses public theme colors for set-detail theme badges', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '75439',
          slug: 'darth-vader-bust-75439',
          name: 'Darth Vader Bust',
          theme: 'Star Wars',
          publicTheme: {
            name: 'Star Wars',
            slug: 'star-wars',
            surfaceColor: '#171717',
          },
          releaseYear: 2025,
          pieces: 327,
          imageUrl: 'https://images.example/darth-vader.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
        themeHref="/themes/star-wars"
      />,
    );

    expect(markup).toContain('--catalog-theme-badge-surface:#171717');
    expect(markup).toContain('--catalog-theme-badge-text:#ffffff');
    expect(markup).toContain('>Star Wars<');
  });

  it('renders only valid compact hero specs and never shows zero values', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '5000000',
          slug: 'collector-keychain-5000000',
          name: 'Collector Keychain',
          theme: 'Gear',
          releaseYear: 2026,
          pieces: 0,
          minifigureCount: 0,
          imageUrl: 'https://images.example/keychain.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
      />,
    );

    expect(markup).toContain('data-label-value-id="release"');
    expect(markup).toContain('Nieuw');
    expect(markup).toContain('2026');
    expect(markup).not.toContain('data-label-value-id="piece-count"');
    expect(markup).not.toContain('data-label-value-id="minifigures"');
    expect(markup).not.toContain('0</dd>');
    expect(markup).not.toContain('Nieuw in 2026');
  });

  it('links the theme logo to the public theme page when a valid theme href exists', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
          name: 'Goudgrijp Tovenaarsbank - Verzamelaarseditie',
          theme: 'Harry Potter',
          publicTheme: {
            logoUrl: '/themes/logos/harry-potter_logo.png',
            name: 'Harry Potter',
            slug: 'harry-potter',
          },
          releaseYear: 2023,
          pieces: 4803,
          imageUrl: 'https://images.example/gringotts.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
        themeHref="/themes/harry-potter"
      />,
    );

    expect(markup).toContain('href="/themes/harry-potter"');
    expect(markup).toContain('aria-label="Bekijk Harry Potter"');
    expect(markup).toContain('alt="Harry Potter logo"');
    expect(markup).toContain('detailHeroMetaStrip');
    expect(markup.indexOf('data-label-value-id="theme-logo"')).toBeLessThan(
      markup.indexOf('data-label-value-id="piece-count"'),
    );
    expect(
      markup.indexOf('src="/themes/logos/harry-potter_logo.png"'),
    ).toBeLessThan(markup.indexOf('4.803'));
  });

  it('keeps set-detail logo and specs in one compact metadata strip', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const metadataStripRule =
      css.match(/\.detailHeroMetaStrip \{[^}]+\}/u)?.[0] ?? '';
    const railWrapperRule =
      css.match(
        /\.detailHeroRail,\n\s+\.detailHeroRailInner \{[^}]+\}/u,
      )?.[0] ?? '';
    const detailHeroContentRule =
      css.match(/\.detailHeroContent \{[^}]+\}/u)?.[0] ?? '';
    const detailHeroSpecsRule =
      css.match(/\.detailHeroSpecs \{[^}]+\}/u)?.[0] ?? '';

    expect(css).toContain('.detailHeroMetaStrip {');
    expect(css).toContain('.heroThemeLogo {');
    expect(css).toContain('object-fit: contain;');
    expect(railWrapperRule).toContain('display: contents;');
    expect(detailHeroContentRule).toContain('order: 2;');
    expect(detailHeroSpecsRule).toContain('order: 3;');
    expect(metadataStripRule).toContain('display: flex;');
    expect(metadataStripRule).toContain('flex-wrap: nowrap;');
    expect(metadataStripRule).toContain('justify-content: stretch;');
    expect(css).toContain(
      ".detailHeroMetaStrip > [data-label-value-id='theme-logo'] {",
    );
    expect(css).toContain('flex: 0 0 auto;');
    expect(css).toContain('min-inline-size: 0;');
    expect(css).toContain('.detailHeroMetaStripDesktop {');
    expect(css).toContain('display: none;');
    expect(css).toContain(
      '--hero-theme-logo-max-inline-size: min(8rem, 34vw);',
    );
    expect(css).toContain('max-width: 128px;');
    expect(css).toContain('@media (min-width: 48rem)');
    expect(css).toContain('.detailHeroMetaStripMobile {');
    expect(css).toContain('.detailHeroMetaStripDesktop {');
    expect(css).toContain('grid-template-columns: repeat(5, max-content);');
    expect(css).toContain('justify-content: center;');
    expect(css).toContain('@media (min-width: 64rem)');
    expect(css).toContain('grid-template-columns: repeat(5, max-content);');
    expect(css).toContain('@media (min-width: 72rem)');
    expect(css).toContain('justify-content: flex-start;');
    expect(css).toContain('display: grid;');
  });

  it('keeps the set-detail hero hierarchy image-led on desktop', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain(
      'grid-template-columns: minmax(0, 1fr) clamp(19rem, 28vw, 23rem);',
    );
    expect(css).toContain(
      'grid-template-columns: minmax(0, 1fr) clamp(20.5rem, 24vw, 25rem);',
    );
    expect(css).toContain('max-width: 25rem;');
    expect(css).toContain('font-size: clamp(2.05rem, 2.8vw, 2.85rem);');
    expect(css).toContain('font-size: clamp(2.2rem, 2.45vw, 2.9rem);');
    expect(css).toContain('.detailHero .bestDealPrice {');
    expect(css).toContain('font-size: clamp(1.95rem, 4.6vw, 2.75rem);');
    expect(css).toContain('gap: var(--lego-space-12);');
  });

  it('keeps set-detail breadcrumbs aligned with a compact non-hero intro rhythm', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const detailIntroRule =
      css.match(/\.detailPageIntro \{[^}]+\}/u)?.[0] ?? '';

    expect(detailIntroRule).toContain(
      '--catalog-page-intro-inline-padding: var(',
    );
    expect(detailIntroRule).toContain('gap: var(--lego-space-2);');
    expect(detailIntroRule).toContain(
      'padding-block-start: var(--lego-space-2);',
    );
    expect(css).toContain('@media (min-width: 64rem)');
    expect(css).toContain(
      '.detailPageIntro {\n      gap: var(--lego-space-3);',
    );
    expect(css).toContain('padding-block-start: var(--lego-space-3);');
  });

  it('keeps the theme logo non-clickable when the theme href is not valid', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          id: '75355',
          slug: 'ucs-x-wing-starfighter-75355',
          name: 'UCS X-wing Starfighter',
          theme: 'Star Wars',
          publicTheme: {
            logoUrl: '/themes/logos/star-wars_logo.png',
            name: 'Star Wars',
            slug: 'star-wars',
          },
          releaseYear: 2023,
          pieces: 1949,
          imageUrl: 'https://images.example/x-wing.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
        themeHref="https://example.com/themes/star-wars"
      />,
    );

    expect(markup).toContain('src="/themes/logos/star-wars_logo.png"');
    expect(markup).toContain('alt="Star Wars logo"');
    expect(markup).not.toContain('aria-label="Bekijk Star Wars"');
    expect(markup).not.toContain('heroThemeLogoLink');
  });

  it('uses an audited display title for the set detail H1 without rendering the catalog alias', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        catalogSetDetail={{
          catalogName: 'Flower Bouquet',
          displayTitle: 'Bloemenboeket',
          displayTitleSource: 'rakuten-lego-eu',
          id: '10280',
          slug: 'flower-bouquet-10280',
          name: 'Flower Bouquet',
          theme: 'Botanicals',
          releaseYear: 2021,
          pieces: 756,
          imageUrl: 'https://images.example/flower-bouquet.jpg',
        }}
        dealVerdict={{
          explanation: 'Prijsbeeld bouwt nog op.',
          label: 'Prijs volgt',
          tone: 'info',
        }}
      />,
    );

    expect(markup).toMatch(/<h1[^>]*>.*Bloemenboeket.*<\/h1>/);
    expect(markup).not.toMatch(/<h1[^>]*>.*Ook bekend als:.*<\/h1>/);
    expect(markup).not.toContain('Ook bekend als:');
  });

  it('avoids a thin comparison block when only one offer is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: '31 mrt om 09:00',
          ctaHref: 'https://example.com/c3po',
          ctaLabel: 'Bekijk bij LEGO',
          ctaTone: 'accent',
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
    expect(markup).toContain('detailPageIntro');
    expect(markup).toContain('detailBreadcrumbs');
    expect(markup.indexOf('Setcontext')).toBeLessThan(
      markup.indexOf('Motorized Lighthouse'),
    );
    expect(markup).toContain('Officiele afbeelding nog niet gepubliceerd');
    expect(markup).toContain('Set 21335');
    expect(markup).toContain('Volg deze prijs');
    expect(markup).toContain('Recent prijsverloop');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('Release');
    expect(markup).toContain('2022');
    expect(markup).not.toContain('Uitgebracht in 2022');
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

    expect(markup).toContain('Nieuw');
    expect(markup).toContain('2026');
    expect(markup).not.toContain('1 mei 2026');
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

    expect(markup).not.toContain('Slimmer om te wachten');
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
    expect(markup).not.toContain('Status');
    expect(markup).not.toContain('Nabestelling');
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
    expect(markup).toContain('width="420"');
    expect(markup).toContain('height="420"');
    expect(markup).toContain('--theme-surface:#cf554c');
    expect(markup).toContain('--theme-card-foreground:#05070d');
    expect(markup).toContain('--theme-text:#05070d');
    expect(markup).toContain('--theme-muted:#05070d');
    expect(markup).toContain('Bekijk sets');
  });

  it('uses one accessible foreground color on theme tiles', () => {
    const darkMarkup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/star-wars"
        themeSnapshot={{
          name: 'Star Wars',
          slug: 'star-wars',
          setCount: 24,
          momentum: 'Ships en displayhelmen met herkenbare silhouetten.',
          signatureSet: 'AT-AT',
        }}
        variant="portrait"
        visual={{
          backgroundColor: '#5573b5',
        }}
      />,
    );
    const lightMarkup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/animal-crossing"
        themeSnapshot={{
          name: 'LEGO® Animal Crossing™',
          slug: 'animal-crossing',
          setCount: 9,
          momentum: 'Eilandscenes en herkenbare villagers.',
          signatureSet: "Kapp'n's Island Boat Tour",
        }}
        variant="portrait"
        visual={{
          backgroundColor: '#6bbf59',
        }}
      />,
    );

    expect(darkMarkup).toContain('--theme-surface:#5573b5');
    expect(darkMarkup).toContain('--theme-card-foreground:#ffffff');
    expect(darkMarkup).toContain('--theme-text:#ffffff');
    expect(darkMarkup).toContain('--theme-muted:#ffffff');
    expect(lightMarkup).toContain('--theme-surface:#6bbf59');
    expect(lightMarkup).toContain('--theme-card-foreground:#05070d');
    expect(lightMarkup).toContain('--theme-text:#05070d');
    expect(lightMarkup).toContain('--theme-muted:#05070d');
  });

  it('can render feature theme tiles with only one helper line below the title', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/botanicals"
        showFeatureSignature={false}
        themeSnapshot={{
          name: 'Botanicals',
          slug: 'botanicals',
          setCount: 4,
          momentum:
            'Boeketten en planten die tafel, kast en cadeau meteen meer kleur geven.',
          signatureSet: 'Flower Bouquet',
        }}
        variant="feature"
      />,
    );

    expect(markup).toContain('Bekijk sets');
    expect(markup).toContain('Botanicals');
    expect(markup).toContain(
      'Boeketten en planten die tafel, kast en cadeau meteen meer kleur geven.',
    );
    expect(markup).not.toContain('Pak eerst');
    expect(markup).not.toContain('Flower Bouquet');
  });

  it('keeps feature theme tile copy inside a fixed bottom content zone', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const featureCardRule =
      css.match(/\.themeCard\.themeFeatureCard \{[^}]+\}/u)?.[0] ?? '';
    const featureLinkRule =
      css.match(/\.themeFeatureLink \{[^}]+\}/u)?.[0] ?? '';
    const featureBodyRule =
      css.match(/\.themeFeatureBody \{[^}]+\}/u)?.[0] ?? '';
    const featureTitleRule =
      css.match(/\.themeFeatureTitle \{[^}]+\}/u)?.[0] ?? '';
    const featureCopyRule =
      css.match(/\.themeFeatureCopy \{[^}]+\}/u)?.[0] ?? '';
    const featureHoverRule =
      css.match(/\.themeFeatureLink:hover \{[^}]+\}/u)?.[0] ?? '';

    expect(featureCardRule).toContain('min-height: 18.5rem;');
    expect(css).toContain(
      '.themeCard.themeFeatureCard {\n      min-height: 22.5rem;',
    );
    expect(featureCardRule).toContain('overflow: hidden;');
    expect(featureLinkRule).toContain('display: grid;');
    expect(featureLinkRule).toContain(
      'grid-template-rows: minmax(7.75rem, 1fr) auto;',
    );
    expect(featureBodyRule).toContain(
      'grid-template-rows: auto auto minmax(3rem, auto);',
    );
    expect(featureBodyRule).toContain('min-height: 12.25rem;');
    expect(featureBodyRule).toContain('overflow: hidden;');
    expect(featureTitleRule).toContain('-webkit-line-clamp: 2;');
    expect(featureTitleRule).toContain('line-clamp: 2;');
    expect(featureCopyRule).toContain('-webkit-line-clamp: 2;');
    expect(featureCopyRule).toContain('line-clamp: 2;');
    expect(featureHoverRule).toContain('background: transparent;');
  });

  it('renders a leaner portrait theme tile variant for fast browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogThemeHighlight
        href="/themes/icons"
        visual={{
          backgroundColor: '#f0c63b',
          imageUrl: 'https://images.example/curated-rivendell.jpg',
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
    expect(markup).toContain('--theme-card-foreground:#05070d');
    expect(markup).toContain('--theme-text:#05070d');
    expect(markup).toContain('--theme-muted:#05070d');
    expect(markup).not.toContain('Bekijk sets');
    expect(markup).not.toContain('Pak eerst Rivendell');
    expect(markup).not.toContain(
      'Premium verzamelaars trekken steeds vaker naar grote displaystukken.',
    );
  });

  it('renders a generic visual tile with the same portrait theme tile structure', () => {
    const markup = renderToStaticMarkup(
      <CatalogVisualTile
        dataTile="new-sets"
        href="/nieuwe-lego-sets"
        imageUrl="https://images.example/new-set.jpg"
        title="Nieuwe sets"
        visual={{
          backgroundColor: '#5573b5',
        }}
      />,
    );

    expect(markup).toContain('href="/nieuwe-lego-sets"');
    expect(markup).toContain('data-visual-tile="new-sets"');
    expect(markup).toContain('src="https://images.example/new-set.jpg"');
    expect(markup).toContain('Nieuwe sets');
    expect(markup).toContain('--theme-surface:#5573b5');
    expect(markup).toContain('--theme-card-foreground:#ffffff');
    expect(markup).toContain('--theme-text:#ffffff');
    expect(markup).toContain('--theme-muted:#ffffff');
    expect(markup).not.toContain('themePortraitMeta');
  });

  it('renders a reusable visual tile rail for compact discovery tiles', () => {
    const markup = renderToStaticMarkup(
      <CatalogVisualTileRail ariaLabel="Deal categorieen" as="nav">
        <CatalogVisualTile
          dataTile="new-sets"
          href="/nieuwe-lego-sets"
          imageUrl="https://images.example/new-set.jpg"
          title="Nieuwe sets"
        />
      </CatalogVisualTileRail>,
    );

    expect(markup).toContain('aria-label="Deal categorieen"');
    expect(markup).toContain('visualTileRailViewport');
    expect(markup).toContain('visualTileRailTrack');
    expect(markup).toContain('data-visual-tile="new-sets"');
  });

  it('keeps the generic visual tile rail dense and swipe-friendly on mobile', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const viewportRule =
      css.match(/\.visualTileRailViewport \{[^}]+\}/u)?.[0] ?? '';
    const trackRule = css.match(/\.visualTileRailTrack \{[^}]+\}/u)?.[0] ?? '';
    const itemRule =
      css.match(/\.visualTileRailTrack > \* \{[^}]+\}/u)?.[0] ?? '';
    const railTitleRule =
      css.match(/\.visualTileRailTrack \.themePortraitTitle \{[^}]+\}/u)?.[0] ??
      '';

    expect(viewportRule).toContain('-webkit-overflow-scrolling: touch;');
    expect(viewportRule).toContain('overscroll-behavior-x: contain;');
    expect(viewportRule).toContain('scrollbar-width: none;');
    expect(trackRule).toContain('gap: var(--lego-space-2);');
    expect(trackRule).toContain('scroll-snap-type: x proximity;');
    expect(trackRule).toContain('touch-action: pan-x pan-y;');
    expect(itemRule).toContain(
      'flex: 0 0 min(10rem, calc(100% - var(--lego-space-6)));',
    );
    expect(railTitleRule).toContain('letter-spacing: 0;');
    expect(railTitleRule).toContain('line-height: 1.12;');
    expect(railTitleRule).toContain('overflow: visible;');
    expect(railTitleRule).toContain('padding-block: 0.04em 0.06em;');
    expect(railTitleRule).toContain('-webkit-line-clamp: unset;');
    expect(css).toContain('flex-basis: min(13rem');
  });

  it('keeps theme tile surface colors stronger than shared Surface tone classes', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const portraitCardRule =
      css.match(/\.themeCard\.themePortraitCard \{[^}]+\}/u)?.[0] ?? '';
    const featureCardRule =
      css.match(/\.themeCard\.themeFeatureCard \{[^}]+\}/u)?.[0] ?? '';

    expect(portraitCardRule).toContain('background: var(--theme-surface);');
    expect(featureCardRule).toContain('background: var(--theme-surface);');
    expect(portraitCardRule).toContain(
      '--theme-text: var(--theme-card-foreground);',
    );
    expect(featureCardRule).toContain(
      '--theme-muted: var(--theme-card-foreground);',
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

  it('renders a mobile-only browse layout toggle above browse grids', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCardCollection gridMode="browse" variant="compact">
        <article>Cel</article>
      </CatalogSetCardCollection>,
    );

    expect(markup).toContain('aria-label="Mobiele kaartweergave"');
    expect(markup.indexOf('Mobiele kaartweergave')).toBeLessThan(
      markup.indexOf('data-catalog-set-card-collection="true"'),
    );
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Groot');
    expect(markup).toContain('Compact');
    expect(markup).toContain('data-catalog-set-card-mobile-view="large"');
    expect(markup).toContain('setCardCollectionMobileOneColumn');
  });

  it('keeps the mobile card layout preference browser-local and normalized', () => {
    expect(SET_CARD_MOBILE_VIEW_STORAGE_KEY).toBe(
      'brickhunt:set-card-mobile-view',
    );
    expect(normalizeSetCardMobileView('compact')).toBe('compact');
    expect(normalizeSetCardMobileView('large')).toBe('large');
    expect(normalizeSetCardMobileView('anything-else')).toBe('large');
    expect(normalizeSetCardMobileView(null)).toBe('large');
  });

  it('uses mobile-only CSS for the compact two-column browse grid', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.setCardMobileLayoutToggle');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileOneColumn \{\s+grid-template-columns: minmax\(0, 1fr\);/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileOneColumn > \.setCard \{\s+border-right: 0;\s+grid-column: 1 \/ -1;/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn \{\s+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn > \.setCard,[\s\S]+?\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn[\s\S]+?> \.cardCompactBody \{\s+min-inline-size: 0;\s+min-width: 0;/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn > \.setCard \{\s+grid-column: auto;/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn\s+> \.setCard:nth-child\(odd\) \{\s+border-right: var\(--catalog-browse-grid-divider-size\) solid\s+var\(--catalog-browse-grid-divider-color\);/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn\s+> \.setCard:nth-child\(even\) \{\s+border-right: 0;/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn\s+> \.setCardCompact\[data-catalog-set-card-variant='compact'\] \{\s+--catalog-card-action-icon-size: 0\.88rem;/u,
    );
    expect(css).toMatch(
      /\.setCardCollectionBrowse\.setCardCollectionMobileTwoColumn\s+> \.setCardCompact\[data-catalog-set-card-variant='compact'\]\s+\.cardCompactActionBrowse,[\s\S]+?\.cardCompactActionPending:visited \{\s+inline-size: var\(--catalog-card-action-height\);\s+min-height: 2\.75rem;\s+min-width: var\(--catalog-card-action-height\);\s+padding-inline: 0;/u,
    );
    expect(css).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]*?\.setCardMobileLayoutToggle \{\s+display: none;/u,
    );
  });

  it('keeps page browse grids from overriding the mobile compact columns', () => {
    const searchCss = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-search-results/src/lib/catalog-feature-search-results.module.css',
      ),
      'utf-8',
    );
    const themeCss = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-theme-page/src/lib/catalog-feature-theme-page.module.css',
      ),
      'utf-8',
    );
    const searchBaseGridRule =
      searchCss.match(/\.resultsGrid\s*\{[^}]+\}/u)?.[0] ?? '';
    const themeBaseGridRule =
      themeCss.match(/\.browseGrid\s*\{[^}]+\}/u)?.[0] ?? '';

    expect(searchBaseGridRule).toMatch(/\.resultsGrid \{\s+--catalog-browse/u);
    expect(searchBaseGridRule).not.toMatch(
      /\.resultsGrid \{[^}]+grid-template-columns:/u,
    );
    expect(searchCss).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]+?\.resultsGrid \{[\s\S]+?grid-template-columns:/u,
    );
    expect(searchCss).not.toContain('@media (min-width: 32rem)');
    expect(themeBaseGridRule).toMatch(/\.browseGrid \{\s+--catalog-browse/u);
    expect(themeBaseGridRule).not.toMatch(
      /\.browseGrid \{[^}]+grid-template-columns:/u,
    );
    expect(themeCss).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]+?\.browseGrid \{[\s\S]+?grid-template-columns:/u,
    );
    expect(themeCss).not.toContain('@media (min-width: 28rem)');
  });
});
