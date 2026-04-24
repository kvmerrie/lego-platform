import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogFeatureDiscover } from './catalog-feature-discover';

describe('CatalogFeatureDiscover', () => {
  it('renders the three market-driven rails in the intended order', () => {
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
            id: '10354',
            slug: 'the-lord-of-the-rings-the-shire-10354',
            name: 'The Lord of the Rings: The Shire',
            theme: 'Icons',
            releaseYear: 2026,
            pieces: 2017,
            minifigureHighlights: ['Bilbo Baggins', 'Gandalf', 'Frodo Baggins'],
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 229.99',
              merchantLabel: 'Lowest reviewed price at bol',
              reviewedLabel: 'Checked 31 mrt',
            },
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
    expect(markup).toContain('Nu interessant');
    expect(markup).toContain('Beste prijs nu');
    expect(markup).toContain('Net in prijs veranderd');
    expect(markup).toContain('Nieuwe releases');
    expect(markup).toContain('Thema van de week');
    expect(markup).toContain('Harry Potter');
    expect(markup).toContain('Voor jou interessant');
    expect(markup.indexOf('Nu interessant')).toBeLessThan(
      markup.indexOf('Beste prijs nu'),
    );
    expect(markup.indexOf('Beste prijs nu')).toBeLessThan(
      markup.indexOf('Net in prijs veranderd'),
    );
    expect(markup.indexOf('Net in prijs veranderd')).toBeLessThan(
      markup.indexOf('Nieuwe releases'),
    );
    expect(markup.indexOf('Nieuwe releases')).toBeLessThan(
      markup.indexOf('Thema van de week'),
    );
    expect(markup.indexOf('Thema van de week')).toBeLessThan(
      markup.indexOf('Voor jou interessant'),
    );
    expect(markup).toContain(
      'De scherpste prijzen die we nu zien bij winkels.',
    );
    expect(markup).toContain('Sets waarvan de prijs recent is aangepast.');
    expect(markup).toContain(
      'Nieuwe sets die net in de catalogus zitten en interessant worden.',
    );
    expect(markup).toContain(
      'Hier wil je nu als eerste kijken. Prijsbeweging, verse dekking en verschil tussen winkels komen hier samen.',
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
