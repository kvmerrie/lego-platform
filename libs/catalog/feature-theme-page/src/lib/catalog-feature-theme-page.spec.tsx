import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureThemeIndex } from './catalog-feature-theme-index';
import { CatalogFeatureThemePage } from './catalog-feature-theme-page';

describe('CatalogFeatureThemePage', () => {
  it('renders a dedicated theme landing with browse grid and optional deals', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        dealSetCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
            collectorAngle: 'Marvel flagship showcase',
            tagline:
              'A marquee licensed set with broad household recognizability.',
            availability: 'Stable with strong seasonal demand',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
          {
            id: '76294',
            slug: 'the-x-mansion-76294',
            name: 'The X-Mansion',
            theme: 'Marvel',
            releaseYear: 2024,
            pieces: 3093,
            collectorAngle: 'Mutant mansion display anchor',
            tagline: 'A character-led Marvel set with strong crossover appeal.',
            availability: 'Fresh release momentum',
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 289.99',
              merchantLabel: 'Lowest reviewed price at LEGO',
              pricePositionLabel: 'EUR 15.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        themePage={{
          themeSnapshot: {
            name: 'Marvel',
            slug: 'marvel',
            setCount: 3,
            momentum:
              'Marvel now reads as a real collector lane with both a flagship tower and a landmark companion build.',
            signatureSet: 'Avengers Tower',
          },
          setCards: [
            {
              id: '76269',
              slug: 'avengers-tower-76269',
              name: 'Avengers Tower',
              theme: 'Marvel',
              releaseYear: 2023,
              pieces: 5202,
              collectorAngle: 'Marvel flagship showcase',
              tagline:
                'A marquee licensed set with broad household recognizability.',
              availability: 'Stable with strong seasonal demand',
            },
            {
              id: '76294',
              slug: 'the-x-mansion-76294',
              name: 'The X-Mansion',
              theme: 'Marvel',
              releaseYear: 2024,
              pieces: 3093,
              collectorAngle: 'Mutant mansion display anchor',
              tagline:
                'A character-led Marvel set with strong crossover appeal.',
              availability: 'Fresh release momentum',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('Marvel');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Bekijk alle');
    expect(markup).toContain('Bekijk beste deals');
    expect(markup).toContain('Themacontext');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="#theme-browse"');
    expect(markup).toContain('href="#theme-deals"');
    expect(markup).toContain('interactiveSurfaceLight');
    expect(markup).not.toContain('_introVisualStage_');
    expect(markup).not.toContain('Klaar voor themabeeld');
    expect(markup).toContain('Hier wil je nu als eerste kijken in');
    expect(markup).not.toContain(
      'Scroll Hier wil je nu als eerste kijken in Marvel naar rechts',
    );
    expect(markup).not.toContain(
      'Hier vergelijk je sets binnen een lijn in plaats van losse winkelhits.',
    );
    const dealSectionIdIndex = markup.indexOf('id="theme-deals"');
    const dealSectionStart = Math.max(0, dealSectionIdIndex - 500);
    const dealSectionEnd =
      markup.indexOf('</section><section', dealSectionIdIndex) +
      '</section>'.length;
    const dealSectionMarkup = markup.slice(dealSectionStart, dealSectionEnd);
    expect(dealSectionMarkup).toContain('sectionShellInverse');
    expect(dealSectionMarkup).not.toContain('sectionShellDefault');
    expect(dealSectionMarkup).not.toContain('setCardRailSectionThemed');
    expect(dealSectionMarkup).toContain('sectionHeaderTitle');
    expect(dealSectionMarkup).not.toContain('sectionHeaderDescription');
    expect(dealSectionMarkup).not.toContain('sectionHeaderSignal');
    expect(dealSectionMarkup).toContain('setCard');
    expect(markup).toContain('2 producten worden weergegeven');
    expect(markup).toContain('Alle');
    expect(markup).not.toContain('Scroll All Marvel sets forward');
    expect(markup).toContain('href="/sets/avengers-tower-76269"');
  });

  it('renders related article links and crawlable pagination links', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        currentPage={1}
        pageSize={1}
        relatedArticles={[
          {
            date: '2026-05-04',
            description: 'Welke Star Wars-sets je eerst wilt bekijken.',
            href: '/artikelen/star-wars/star-wars-day-2026',
            title: 'Star Wars Day 2026',
          },
        ]}
        themePage={{
          themeSnapshot: {
            name: 'Star Wars',
            slug: 'star-wars',
            setCount: 2,
            momentum: 'Ships, walkers en displaywaarde.',
            signatureSet: 'X-wing Starfighter',
          },
          setCards: [
            {
              id: '75355',
              slug: 'x-wing-starfighter-75355',
              name: 'X-wing Starfighter',
              theme: 'Star Wars',
              releaseYear: 2023,
              pieces: 1949,
            },
            {
              id: '75446',
              slug: 'grogu-mandalorian-apprentice-75446',
              name: 'Grogu with Hover Pram',
              theme: 'Star Wars',
              releaseYear: 2026,
              pieces: 1048,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/sets/x-wing-starfighter-75355"');
    expect(markup).not.toContain(
      'href="/sets/grogu-mandalorian-apprentice-75446"',
    );
    expect(markup).toContain('href="/themes/star-wars"');
    expect(markup).toContain('href="/themes/star-wars?page=2"');
    expect(markup).toContain('href="/artikelen/star-wars/star-wars-day-2026"');
  });

  it('uses server-paginated theme set cards without slicing them again', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        currentPage={2}
        pageSize={1}
        themePage={{
          themeSnapshot: {
            name: 'Star Wars',
            slug: 'star-wars',
            setCount: 2,
            momentum: 'Ships, walkers en displaywaarde.',
            signatureSet: 'X-wing Starfighter',
          },
          setCards: [
            {
              id: '75446',
              slug: 'grogu-mandalorian-apprentice-75446',
              name: 'Grogu with Hover Pram',
              theme: 'Star Wars',
              releaseYear: 2026,
              pieces: 1048,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/sets/grogu-mandalorian-apprentice-75446"');
    expect(markup).not.toContain('href="/sets/x-wing-starfighter-75355"');
    expect(markup).toContain('href="/themes/star-wars"');
    expect(markup).toContain('href="/themes/star-wars?page=2"');
  });

  it('does not synthesize hardcoded theme visual mapping for theme page surfaces', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        themePage={{
          themeSnapshot: {
            name: 'Architecture',
            slug: 'architecture',
            setCount: 1,
            momentum:
              'Voor strakke landmarks die rust, schaal en herkenning op één plank brengen.',
            signatureSet: 'Notre-Dame de Paris',
          },
          setCards: [
            {
              id: '21061',
              slug: 'notre-dame-de-paris-21061',
              name: 'Notre-Dame de Paris',
              theme: 'Architecture',
              releaseYear: 2024,
              pieces: 4383,
              collectorAngle: 'Monumentale skylineblikvanger',
              tagline: 'Een landmark die meteen statig leest op je plank.',
              availability: 'Goed verkrijgbaar',
            },
          ],
        }}
      />,
    );

    expect(markup).not.toContain('--theme-page-surface:#6f8594');
    expect(markup).not.toContain('--theme-page-text:#ffffff');
    expect(markup).toContain('interactiveSurfaceLight');
  });

  it('uses curated public theme visual metadata when provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemePage
        themePage={{
          themeSnapshot: {
            name: 'Editions',
            slug: 'editions',
            setCount: 14,
            momentum:
              'Voor losse specials die juist opvallen doordat ze nergens anders bij horen.',
            signatureSet: 'Nike Dunk x LEGO Set',
          },
          visual: {
            backgroundColor: '#e0b84f',
            imageUrl: 'https://images.example/editions.jpg',
            textColor: '#171a22',
          },
          setCards: [
            {
              id: '43020',
              slug: 'nike-dunk-x-lego-set-43020',
              name: 'Nike Dunk x LEGO Set',
              theme: 'Editions',
              releaseYear: 2026,
              pieces: 1180,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('--theme-page-surface:#e0b84f');
    expect(markup).toContain('--theme-page-text:#171a22');
    expect(markup).toContain('interactiveSurfaceLight');
  });
});

describe('CatalogFeatureThemeIndex', () => {
  it('renders a calm theme directory without set rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        visual={{
          backgroundColor: '#234bcd',
          textColor: '#ffffff',
        }}
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/icons.jpg',
            themeSnapshot: {
              name: 'Icons',
              slug: 'icons',
              setCount: 14,
              momentum:
                'Big display-led builds, nostalgic callbacks, and collector anchors.',
              signatureSet: 'Rivendell',
            },
          },
          {
            imageUrl: 'https://images.example/marvel.jpg',
            themeSnapshot: {
              name: 'Marvel',
              slug: 'marvel',
              setCount: 3,
              momentum:
                'Superhero flagships and skyline-style display builds with broad recognition.',
              signatureSet: 'Avengers Tower',
            },
          },
          {
            imageUrl: 'https://images.example/lotr.jpg',
            themeSnapshot: {
              name: 'Lord of the Rings™',
              slug: 'lord-of-the-rings',
              setCount: 3,
              momentum:
                'Middle-earth display builds with clear shelf presence.',
              signatureSet: 'Rivendell',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Alle thema');
    expect(markup).toContain('--theme-index-surface:#234bcd');
    expect(markup).toContain('--theme-index-text:#ffffff');
    expect(markup).toContain('Paginapad');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('3 themapagina');
    expect(markup).toContain('Ontdekken blijft beter voor gemengd bladeren');
    expect(markup).toContain('Kies je thema');
    expect(markup).toContain(
      'Icons, Star Wars, Botanicals en meer. Kies hier de lijn waar je als eerste in wilt duiken.',
    );
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain('href="/themes/lord-of-the-rings"');
    expect(markup).toContain('Lord of the Rings');
    expect(markup).toContain('src="https://images.example/icons.jpg"');
    expect(markup).not.toContain('href="/sets/');
  });

  it('renders late public themes such as Editions in the overview grid', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureThemeIndex
        themeDirectoryItems={[
          {
            imageUrl: 'https://images.example/editions.jpg',
            themeSnapshot: {
              name: 'Editions',
              slug: 'editions',
              setCount: 14,
              momentum:
                'Voor losse specials die juist opvallen doordat ze nergens anders bij horen.',
              signatureSet: 'Editions',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/themes/editions"');
    expect(markup).toContain('Editions');
    expect(markup).toContain('src="https://images.example/editions.jpg"');
  });
});
