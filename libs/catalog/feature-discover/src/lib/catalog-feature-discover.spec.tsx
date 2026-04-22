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
        totalSetCount={180}
        totalThemeCount={12}
      />,
    );

    expect(markup).toContain('Ontdek waar het nu echt beweegt');
    expect(markup).toContain('Waar prijzen recent zijn veranderd');
    expect(markup).toContain('Beste deals nu');
    expect(markup).toContain('Net uitgebracht');
    expect(markup.indexOf('Waar prijzen recent zijn veranderd')).toBeLessThan(
      markup.indexOf('Beste deals nu'),
    );
    expect(markup.indexOf('Beste deals nu')).toBeLessThan(
      markup.indexOf('Net uitgebracht'),
    );
    expect(markup).toContain(
      'Sets waar recent iets bewoog in prijs, zodat je sneller ziet waar het koopmoment verandert.',
    );
    expect(markup).toContain(
      'Sets waar de huidige prijs nu duidelijk afsteekt tegen wat we meestal of elders zien.',
    );
    expect(markup).toContain(
      'Nieuwe sets die net in de catalogus zitten en nu interessant worden om te volgen of vergelijken.',
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
