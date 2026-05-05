import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureDiscover } from './catalog-feature-discover';

describe('CatalogFeatureDiscover', () => {
  it('renders the discover rails in the intended order', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover
        bestDealSetCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
            minifigureHighlights: ['Iron Man', 'Captain America', 'Thor'],
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        forYouSetCards={[
          {
            id: '21348',
            slug: 'red-dragons-tale-21348',
            name: "Dungeons & Dragons: Red Dragon's Tale",
            theme: 'Ideas',
            releaseYear: 2024,
            pieces: 3745,
          },
        ]}
        newInReleaseYear={{
          releaseYear: 2026,
          setCards: [
            {
              id: '10354',
              slug: 'the-lord-of-the-rings-the-shire-10354',
              name: 'The Lord of the Rings: The Shire',
              theme: 'Icons',
              releaseYear: 2026,
              pieces: 2017,
              minifigureHighlights: [
                'Bilbo Baggins',
                'Gandalf',
                'Frodo Baggins',
              ],
              priceContext: {
                coverageLabel: 'In stock · 2 reviewed offers',
                currentPrice: 'EUR 229.99',
                merchantLabel: 'Lowest reviewed price at bol',
                reviewedLabel: 'Checked 31 mrt',
              },
            },
          ],
        }}
        nowInterestingSetCards={[
          {
            id: '10333',
            slug: 'the-lord-of-the-rings-barad-dur-10333',
            name: 'The Lord of the Rings: Barad-dur',
            theme: 'Icons',
            releaseYear: 2024,
            pieces: 5471,
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 429.99',
              merchantLabel: 'Lowest reviewed price at bol',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        recentPriceChangeSetCards={[
          {
            id: '10316',
            slug: 'rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6167,
            minifigureHighlights: ['Elrond', 'Frodo Baggins', 'Arwen'],
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 469.99',
              merchantLabel: 'Lowest reviewed price at LEGO',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        recentlyReleasedSetCards={[
          {
            id: '75417',
            slug: 'at-st-walker-75417',
            name: 'AT-ST Walker',
            theme: 'Star Wars',
            releaseYear: 2026,
            releaseDate: '2026-05-01',
            releaseDatePrecision: 'day',
            pieces: 1513,
            minifigureHighlights: ['AT-ST Driver'],
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 199.99',
              merchantLabel: 'Lowest reviewed price at bol',
              reviewedLabel: 'Checked 31 mrt',
            },
          },
        ]}
        newOnBrickhuntSetCards={[
          {
            id: '42209',
            slug: 'volvo-l120-electric-wheel-loader-42209',
            name: 'Volvo L120 Electric Wheel Loader',
            theme: 'Technic',
            releaseYear: 2026,
            pieces: 973,
          },
        ]}
        themeOfWeek={{
          setCards: [
            {
              id: '76419',
              slug: 'hogwarts-castle-and-grounds-76419',
              name: 'Hogwarts Castle and Grounds',
              theme: 'Harry Potter',
              releaseYear: 2023,
              pieces: 2660,
            },
          ],
          themeName: 'Harry Potter',
        }}
        totalSetCount={180}
        totalThemeCount={12}
      />,
    );

    expect(markup).toContain('Ontdek waar het nu echt beweegt');
    expect(markup).toContain('Nu interessant om te kopen');
    expect(markup).toContain('Beste deals nu');
    expect(markup).toContain('Nieuwe releases');
    expect(markup).toContain('Nieuw in 2026');
    expect(markup).toContain('Nieuw op Brickhunt');
    expect(markup).toContain('Net goedkoper geworden');
    expect(markup).toContain('Thema van de week');
    expect(markup).toContain('Harry Potter');
    expect(markup).toContain('In de gaten houden');
    expect(markup.indexOf('Nu interessant om te kopen')).toBeLessThan(
      markup.indexOf('Beste deals nu'),
    );
    expect(markup.indexOf('Beste deals nu')).toBeLessThan(
      markup.indexOf('Nieuwe releases'),
    );
    expect(markup.indexOf('Nieuwe releases')).toBeLessThan(
      markup.indexOf('Nieuw in 2026'),
    );
    expect(markup.indexOf('Nieuw in 2026')).toBeLessThan(
      markup.indexOf('Nieuw op Brickhunt'),
    );
    expect(markup.indexOf('Nieuw op Brickhunt')).toBeLessThan(
      markup.indexOf('Net goedkoper geworden'),
    );
    expect(markup.indexOf('Net goedkoper geworden')).toBeLessThan(
      markup.indexOf('Thema van de week'),
    );
    expect(markup.indexOf('Thema van de week')).toBeLessThan(
      markup.indexOf('In de gaten houden'),
    );
    expect(markup).toContain(
      'Sets die nu duidelijk scherper geprijsd zijn dan hun recente referentie.',
    );
    expect(markup).toContain('Recent uitgebracht of bijna beschikbaar.');
    expect(markup).toContain(
      'Sets uit dit releasejaar. Exacte releasedatums vullen we aan zodra die bekend zijn.',
    );
    expect(markup).toContain(
      'Sets die Brickhunt net heeft toegevoegd. Handig als je wilt zien wat er hier net is bijgekomen.',
    );
    expect(markup).toContain(
      'Prijsdalingen van de afgelopen dagen, met actuele winkelactie erbij.',
    );
    expect(markup).toContain(
      'Prijs, voorraad en winkeldekking komen hier samen. Dit zijn sets waar nu echt iets gebeurt.',
    );
    expect(markup).toContain('Bekijk alle thema');
    expect(markup).toContain('href="/themes"');
    expect(markup).not.toContain(
      'Scroll Waar prijzen recent zijn veranderd naar rechts',
    );
  });

  it('keeps deal cards commerce-focused while other rails stay compact', () => {
    const markup = renderToStaticMarkup(
      <CatalogFeatureDiscover
        bestDealSetCards={[
          {
            id: '76269',
            slug: 'avengers-tower-76269',
            name: 'Avengers Tower',
            theme: 'Marvel',
            releaseYear: 2023,
            pieces: 5202,
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 31 mrt',
            },
            actions: <button type="button">Volg prijs</button>,
            ctaMode: 'commerce',
          },
        ]}
        nowInterestingSetCards={[
          {
            id: '10333',
            slug: 'the-lord-of-the-rings-barad-dur-10333',
            name: 'The Lord of the Rings: Barad-dur',
            theme: 'Icons',
            releaseYear: 2024,
            pieces: 5471,
          },
        ]}
        recentPriceChangeSetCards={[
          {
            id: '10316',
            slug: 'rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6167,
          },
        ]}
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('EUR 30.00 below reference');
    expect(markup).toContain('Rivendell');
    expect(markup).toContain('The Lord of the Rings: Barad-dur');
  });

  it('drops the premature filter block and keeps a calm empty state', () => {
    const markup = renderToStaticMarkup(<CatalogFeatureDiscover />);

    expect(markup).toContain('Ontdek waar het nu echt beweegt');
    expect(markup).toContain('Ontdekken wordt verder gevuld');
    expect(markup).toContain('Toon alle sets');
    expect(markup).not.toContain('Kies eerst hoe je wilt kijken');
    expect(markup).not.toContain('Meer filters');
    expect(markup).not.toContain('href="/discover?filter=best-deals"');
  });
});
