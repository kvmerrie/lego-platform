import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CatalogFeatureThemeList } from './catalog-feature-theme-list';
import { CatalogFeatureThemeSpotlight } from './catalog-feature-theme-spotlight';

function createThemeItem({
  imageUrl,
  name,
  slug,
}: {
  imageUrl?: string;
  name: string;
  slug: string;
}) {
  return {
    imageUrl,
    themeSnapshot: {
      momentum: `${name} blijft meteen hangen.`,
      name,
      setCount: 3,
      signatureSet: name,
      slug,
    },
  };
}

describe('CatalogFeatureThemeList', () => {
  it('renders storefront-style theme choice tiles with theme imagery', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeList
        themeItems={[
          createThemeItem({
            imageUrl:
              'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
            name: 'Icons',
            slug: 'icons',
          }),
          createThemeItem({ name: 'Marvel', slug: 'marvel' }),
          createThemeItem({ name: 'Star Wars', slug: 'star-wars' }),
          createThemeItem({ name: 'Harry Potter', slug: 'harry-potter' }),
          createThemeItem({ name: 'Botanicals', slug: 'botanicals' }),
          createThemeItem({ name: 'Ideas', slug: 'ideas' }),
        ]}
      />,
    );

    expect(markup).toContain('Kies je hoek');
    expect(markup).toContain('Fantasy, Star Wars of strak design?');
    expect(markup).toContain('6 thema’s om mee te starten + alle thema’s');
    expect(markup).toContain('Icons');
    expect(markup).toContain('Marvel');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain('Alle thema&#x27;s');
    expect(markup).toContain('34 thema&#x27;s');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<svg');
    expect(markup).not.toContain('>…</span>');
    expect(markup).not.toContain('Alles ontdekken');
    expect(markup).not.toContain('Van Botanicals tot Technic');
    expect(markup).not.toContain('Ontdek alle thema&#x27;s →');
    expect(markup).not.toContain('data-theme="speed-champions"');
    expect(markup).not.toContain('Zie alles bij elkaar');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg"',
    );
    expect(markup).not.toContain('Premium collectors are consolidating around');
  });

  it('styles the all themes tile as a compact portrait discovery card', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/catalog-feature-theme-list.module.css'),
      'utf-8',
    );
    const trackSpacerRule =
      css.match(/\.railTrack::after \{[^}]+\}/u)?.[0] ?? '';
    const tileRule = css.match(/\.allThemesTile \{[^}]+\}/u)?.[0] ?? '';
    const linkRule = css.match(/\.allThemesLink \{[^}]+\}/u)?.[0] ?? '';
    const visualRule = css.match(/\.allThemesVisual \{[^}]+\}/u)?.[0] ?? '';
    const iconRule = css.match(/\.allThemesIcon \{[^}]+\}/u)?.[0] ?? '';
    const bodyRule = css.match(/\.allThemesBody \{[^}]+\}/u)?.[0] ?? '';
    const titleRule = css.match(/\.allThemesTitle \{[^}]+\}/u)?.[0] ?? '';
    const metaRule = css.match(/\.allThemesMeta \{[^}]+\}/u)?.[0] ?? '';

    expect(trackSpacerRule).toContain("content: '';");
    expect(trackSpacerRule).toContain(
      'flex: 0 0 var(--catalog-section-inline-padding, var(--lego-space-4));',
    );
    expect(tileRule).toContain('aspect-ratio: 3 / 4;');
    expect(tileRule).toContain('background: #6f8594;');
    expect(tileRule).toContain('border-radius: var(--lego-radius-sm);');
    expect(linkRule).toContain('grid-template-rows: minmax(0, 1fr) auto;');
    expect(visualRule).toContain('min-height: 11.25rem;');
    expect(iconRule).toContain('height: clamp(4.25rem');
    expect(iconRule).toContain('width: clamp(4.25rem');
    expect(bodyRule).toContain(
      'padding: var(--lego-space-3) var(--lego-space-3) var(--lego-space-4);',
    );
    expect(titleRule).toContain('-webkit-line-clamp: 2;');
    expect(metaRule).toContain('color: #f4f7fb;');
    expect(css).not.toContain('.allThemesTags');
    expect(css).not.toContain('.allThemesAction');
    expect(css).toContain('.railTrack::after {\n    content: none;');
  });

  it('renders a non-rail theme spotlight block for deeper homepage browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeSpotlight
        themeItems={[
          createThemeItem({
            name: 'Modular Buildings',
            slug: 'modular-buildings',
          }),
          createThemeItem({ name: 'Botanicals', slug: 'botanicals' }),
          createThemeItem({ name: 'Technic', slug: 'technic' }),
          createThemeItem({ name: 'Architecture', slug: 'architecture' }),
        ]}
      />,
    );

    expect(markup).toContain('Meer om te ontdekken');
    expect(markup).toContain('Botanicals, kunst of modulaire straten?');
    expect(markup).toContain('4 thema&#x27;s als je iets anders zoekt');
    expect(markup).toContain('href="/themes/modular-buildings"');
    expect(markup).toContain('href="/themes/botanicals"');
    expect(markup).not.toContain('href="/themes/icons"');
    expect(markup).not.toContain('Pak eerst');
  });

  it('keeps homepage spotlight theme tiles on equal safe rows', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/catalog-feature-theme-spotlight.module.css',
      ),
      'utf-8',
    );
    const gridRule = css.match(/\.grid \{[^}]+\}/u)?.[0] ?? '';
    const spotlightTileRule =
      css.match(/\.spotlightTile \{[^}]+\}/u)?.[0] ?? '';

    expect(gridRule).toContain('grid-auto-rows: 1fr;');
    expect(spotlightTileRule).toContain('min-height: 22.5rem;');
    expect(spotlightTileRule).not.toContain('min-height: 0;');
  });

  it('uses stable keys when theme names repeat with different slugs', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const themeItems = [
      {
        themeSnapshot: {
          momentum: 'Avengers Tower blijft meteen hangen.',
          name: 'Marvel',
          setCount: 4,
          signatureSet: 'Avengers Tower',
          slug: 'marvel',
        },
      },
      {
        themeSnapshot: {
          momentum: 'X-Men op de plank geeft meteen kleur.',
          name: 'Marvel',
          setCount: 2,
          signatureSet: 'X-Mansion',
          slug: 'x-men',
        },
      },
    ];

    const spotlightMarkup = renderToStaticMarkup(
      <CatalogFeatureThemeSpotlight themeItems={themeItems} />,
    );
    const listMarkup = renderToStaticMarkup(
      <CatalogFeatureThemeList themeItems={themeItems} />,
    );

    expect(spotlightMarkup).toContain('href="/themes/marvel"');
    expect(spotlightMarkup).toContain('href="/themes/x-men"');
    expect(listMarkup).toContain('href="/themes/marvel"');
    expect(listMarkup).toContain('href="/themes/x-men"');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Encountered two children with the same key'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });
});
