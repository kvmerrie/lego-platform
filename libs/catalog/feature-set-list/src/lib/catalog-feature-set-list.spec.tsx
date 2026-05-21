import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureSetList } from './catalog-feature-set-list';

describe('CatalogFeatureSetList', () => {
  it('renders curated scanability signals for the featured-set shortlist', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        setCards={[
          {
            actions: <button type="button">Volg prijs</button>,
            id: '21348',
            slug: 'dungeons-and-dragons-red-dragons-tale-21348',
            name: "Dungeons & Dragons: Red Dragon's Tale",
            theme: 'Ideas',
            releaseYear: 2024,
            pieces: 3747,
            collectorAngle: 'Crossover audience magnet',
            tagline:
              'A community-driven release with rich minifigure storytelling hooks.',
            availability: 'Strong launch momentum',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 359.99',
              merchantLabel: 'Lowest reviewed price at bol',
              reviewedLabel: 'Checked 29 mrt',
            },
          },
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
        ]}
      />,
    );

    expect(markup).toContain('Torens, walkers, supercars');
    expect(markup).toContain('Grote sets die je plank én budget bepalen.');
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('2 sets die meteen de kamer pakken');
    expect(markup).toContain('1 met nagekeken prijzen');
    expect(markup).toContain('Prijs volgt');
    expect(markup).not.toContain(
      'Scroll Torens, walkers, supercars naar links',
    );
    expect(markup).not.toContain(
      'Scroll Torens, walkers, supercars naar rechts',
    );
    expect(markup).not.toContain('Vorige');
    expect(markup).not.toContain('Volgende');
    expect(markup).not.toContain('Public catalog');
  });

  it('supports custom curation framing for alternate homepage rows', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        description="Stond hij al op je lijst? Kijk nu."
        eyebrow="Prijs zakt"
        sectionId="best-current-deals"
        setCards={[
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
        ]}
        signalText="3 dozen nu lager"
        title="Die doos komt dichterbij"
      />,
    );

    expect(markup).toContain('id="best-current-deals"');
    expect(markup).toContain('Die doos komt dichterbij');
    expect(markup).toContain('Stond hij al op je lijst? Kijk nu.');
    expect(markup).toContain('3 dozen nu lager');
    expect(markup).not.toContain('1 dozen die je kast overnemen');
  });

  it('renders an expanded commerce rail with up to twenty useful sets', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        actionHref="/deals"
        actionLabel="Bekijk alle deals"
        sectionId="best-current-deals"
        showSignal={false}
        setCards={Array.from({ length: 20 }, (_, index) => {
          const setId = String(43_000 + index);

          return {
            id: setId,
            slug: `buyable-set-${setId}`,
            name: `Buyable set ${index + 1}`,
            theme: 'Disney',
            releaseYear: 2024,
            pieces: 1000 + index,
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 99.99',
              merchantLabel: 'Lowest reviewed price at Goodbricks',
              reviewedLabel: 'Checked today',
            },
          };
        })}
        title="Beste deals nu"
      />,
    );

    expect(markup).toContain('Bekijk alle deals');
    expect(markup).toContain('href="/deals"');
    expect(markup).not.toContain('20 sets die meteen de kamer pakken');
    expect(markup).not.toContain('20 sets met een directe kooplink');
    expect(markup.indexOf('Beste deals nu')).toBeLessThan(
      markup.indexOf('Bekijk alle deals'),
    );
    expect(markup.indexOf('Bekijk alle deals')).toBeLessThan(
      markup.indexOf('Buyable set 1'),
    );
    expect(markup).toContain('Buyable set 1');
    expect(markup).toContain('Buyable set 20');
  });

  it('preserves theme badge colors from set-card public theme presentation', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        sectionId="similar-sets"
        setCards={[
          {
            id: '75461',
            slug: 'up-scaled-darth-vader-minifigure-75461',
            name: 'Up-Scaled Darth Vader Minifigure',
            theme: 'Star Wars',
            publicTheme: {
              name: 'Star Wars',
              slug: 'star-wars',
              surfaceColor: '#171717',
              surfaceTextColor: '#ffffff',
            },
            releaseYear: 2026,
            pieces: 0,
            imageUrl: 'https://images.example/darth-vader.jpg',
          },
        ]}
        title="Vergelijkbare LEGO sets"
      />,
    );

    expect(markup).toContain('--card-theme-badge-bg:#171717');
    expect(markup).toContain('--card-theme-badge-text:#ffffff');
    expect(markup).toContain('>Star Wars<');
  });

  it('keeps the commerce rail calm when no tertiary action is provided', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        sectionId="best-current-deals"
        showSignal={false}
        setCards={Array.from({ length: 20 }, (_, index) => {
          const setId = String(44_000 + index);

          return {
            id: setId,
            slug: `buyable-set-${setId}`,
            name: `Buyable set ${index + 1}`,
            theme: 'Disney',
            releaseYear: 2024,
            pieces: 1000 + index,
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 99.99',
              merchantLabel: 'Lowest reviewed price at Goodbricks',
              reviewedLabel: 'Checked today',
            },
          };
        })}
        title="Beste deals nu"
      />,
    );

    expect(markup).not.toContain('Bekijk alle deals');
    expect(markup).not.toContain('20 sets die meteen de kamer pakken');
    expect(markup).toContain('Buyable set 20');
  });
});
