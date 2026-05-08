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
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain(
      'src="https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg"',
    );
    expect(markup).not.toContain('Premium collectors are consolidating around');
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
