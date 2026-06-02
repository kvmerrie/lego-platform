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

  it('prioritizes only the first image when the row is above the fold', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        prioritizeFirstImage
        setCards={[
          {
            id: '77244',
            slug: 'mercedes-amg-f1-w15-race-car-77244',
            name: 'Mercedes-AMG F1 W15 Race Car',
            theme: 'Speed Champions',
            releaseYear: 2025,
            pieces: 267,
            imageUrl: 'https://images.example/mercedes.jpg',
          },
          {
            id: '60445',
            slug: 'f1-truck-with-rb20-and-amr24-f1-cars-60445',
            name: 'F1 Truck with RB20 & AMR24 F1 Cars',
            theme: 'City',
            releaseYear: 2025,
            pieces: 1086,
            imageUrl: 'https://images.example/f1-truck.jpg',
          },
        ]}
      />,
    );

    expect(markup.match(/<img[^>]*fetchPriority="high"/g)).toHaveLength(1);
    expect(markup.match(/loading="eager"/g)).toHaveLength(1);
    expect(markup.match(/loading="lazy"/g)).toHaveLength(1);
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

  it('renders all provided homepage rail items without an experimental cap', () => {
    const setCards = Array.from({ length: 20 }, (_, index) => {
      const setId = String(45_000 + index);

      return {
        id: setId,
        slug: `homepage-set-${setId}`,
        name: `Homepage set ${index + 1}`,
        theme: 'Icons',
        releaseYear: 2025,
        pieces: 1200 + index,
        priceContext: {
          coverageLabel: 'In stock · 2 reviewed offers',
          currentPrice: 'EUR 119.99',
          merchantLabel: 'Lowest reviewed price at Goodbricks',
          reviewedLabel: 'Checked today',
        },
      };
    });
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList setCards={setCards} title="Nu te vergelijken" />,
    );

    expect(markup).toContain('20 sets die meteen de kamer pakken');
    expect(markup).toContain('20 met nagekeken prijzen');
    expect(markup).toContain('Homepage set 1');
    expect(markup).toContain('Homepage set 12');
    expect(markup).toContain('Homepage set 13');
    expect(markup).toContain('Homepage set 20');
  });

  it('does not emit experimental rail performance mode attributes', () => {
    const setCards = [
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://images.example/rivendell.jpg',
      },
    ];
    const defaultMarkup = renderToStaticMarkup(
      <CatalogFeatureSetList setCards={setCards} title="Meer uit dit thema" />,
    );

    expect(defaultMarkup).not.toContain('data-rail-performance-mode');
    expect(defaultMarkup).not.toContain('setCardRailOffscreenContainment');
    expect(defaultMarkup).not.toContain('data-rail-layout-mode');
  });

  it('passes the stable-square rail layout only when explicitly requested', () => {
    const setCards = [
      {
        id: '10316',
        slug: 'rivendell-10316',
        name: 'Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: 'https://images.example/rivendell.jpg',
      },
    ];
    const markup = renderToStaticMarkup(
      <CatalogFeatureSetList
        railLayoutMode="stable-square"
        setCards={setCards}
        title="Nu te vergelijken"
      />,
    );

    expect(markup).toContain('data-rail-layout-mode="stable-square"');
    expect(markup).not.toContain('data-rail-performance-mode');
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
