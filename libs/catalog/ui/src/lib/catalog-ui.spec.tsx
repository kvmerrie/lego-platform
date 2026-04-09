import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CatalogQuickFilterBar,
  CatalogSetCard,
  CatalogSetDetailPanel,
  CatalogThemeHighlight,
} from './catalog-ui';

describe('CatalogSetCard', () => {
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

  it('renders a compact featured-card variant for homepage browsing', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetCard
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

    expect(markup).toContain('href="/sets/rivendell-10316"');
    expect(markup).toContain('EUR 489.99');
    expect(markup).toContain('Laagst bij bol');
    expect(markup).toContain('EUR 10.00 below ref');
    expect(markup).toContain('2023');
    expect(markup).toContain('6.181 stenen');
    expect(markup).toContain('Bekijk prijs');
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
    expect(markup).toContain('Bekijk prijs');
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
    expect(markup).toContain('Waarom verzamelaars dit kiezen');
    expect(markup).toContain('Beschikbaarheid');
    expect(markup).toContain('Healthy but premium availability');
    expect(markup).toContain('Prestige display anchor');
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
          checkedLabel: 'Nagekeken 31 mrt, 09:00',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Nu interessant geprijsd',
          decisionTone: 'positive',
          merchantLabel: 'bol',
          price: '€ 469,99',
          rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        brickhuntValueItems={[
          {
            id: 'brickhunt-monitoring',
            text: 'We vergelijken 2 Nederlandse winkels zolang die vergelijking iets zegt.',
          },
          {
            id: 'brickhunt-guidance',
            text: 'Je ziet eerst of deze set nu echt opvalt.',
          },
          {
            id: 'brickhunt-alerts',
            text: 'Nog niet klaar? Volg de prijs en laat Brickhunt meekijken.',
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
            text: 'Deze prijs ligt onder wat we meestal zien.',
          },
          {
            id: 'best-price-now',
            text: 'Dit is momenteel de scherpste prijs die we volgen.',
          },
          {
            id: 'merchant-coverage',
            text: 'We volgen 2 Nederlandse winkels voor deze set.',
          },
        ]}
        dealVerdict={{
          explanation:
            'Deze set zit onder wat we meestal zien. Kopen is nu logisch als je hem wilt hebben.',
          label: 'Nu interessant geprijsd',
          tone: 'positive',
        }}
        offerList={[
          {
            checkedLabel: 'Nagekeken 31 mrt, 09:00',
            ctaHref: 'https://example.com/rivendell',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 469,99',
            rankingLabel: 'Laagste prijs op voorraad',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: 'Nagekeken 31 mrt, 09:15',
            ctaHref: 'https://example.com/rivendell-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 499,99',
            rankingLabel: '€ 30,00 hoger dan de beste optie',
            stockLabel: 'Op voorraad',
          },
        ]}
        offerSummaryLabel="2 winkels nagekeken · Nagekeken 31 mrt, 09:00"
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
          { label: 'Laatst nagekeken', value: '31 mrt 2026, 09:00' },
          { label: 'Winkels nagekeken', value: '2 winkels nagekeken' },
        ]}
      />,
    );

    expect(markup).toContain('Nu interessant geprijsd');
    expect(markup).toContain(
      'Deze set zit onder wat we meestal zien. Kopen is nu logisch als je hem wilt hebben.',
    );
    expect(markup).toContain('The Lord of the Rings');
    expect(markup).toContain('Bekijk bij bol');
    expect(markup).toContain(
      '€ 30,00 onder wat we meestal zien voor deze set.',
    );
    expect(markup).toContain('Beste winkel nu');
    expect(markup).toContain('bol');
    expect(markup).toContain('Laagste nagekeken prijs die nu op voorraad is.');
    expect(markup).toContain(
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    );
    expect(markup).toContain('Waarom dit nu interessant is');
    expect(markup).toContain(
      'Dit is momenteel de scherpste prijs die we volgen.',
    );
    expect(markup).toContain('Nog niet klaar om te kopen?');
    expect(markup).toContain('Volg prijs');
    expect(markup).toContain('Vergelijk winkels');
    expect(markup).toContain('2 winkels nagekeken · Nagekeken 31 mrt, 09:00');
    expect(markup).toContain('Laagste prijs op voorraad');
    expect(markup).toContain('€ 30,00 hoger dan de beste optie');
    expect(markup).toContain('Waarom dit hier meer is dan een prijslink');
    expect(markup).toContain('Je ziet eerst of deze set nu echt opvalt.');
    expect(markup).toContain('Waar prijs en winkels op steunen');
    expect(markup).toContain('Ga naar afbeelding 2');
    expect(markup).toContain('Swipe voor meer foto&#x27;s');
    expect(markup).toContain('In collectie zetten');
    expect(markup).toContain('Setnummer');
    expect(markup).toContain('10316');
    expect(markup).toContain('Leeftijd');
    expect(markup).toContain('18+');
    expect(markup).toContain('Formaat');
    expect(markup).toContain('72 × 50 × 39 cm');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('Wat hier blijft hangen');
    expect(markup).not.toContain('$499 to $569');
  });

  it('avoids a thin comparison block when only one offer is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: 'Nagekeken 31 mrt, 09:00',
          ctaHref: 'https://example.com/c3po',
          ctaLabel: 'Bekijk bij LEGO',
          ctaTone: 'secondary',
          decisionHelper: 'Rond het normale prijsniveau voor deze set.',
          decisionLabel: 'Rond normaal',
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
            'Prima prijs, maar niet opvallend laag. Alleen kopen als je nu wilt instappen.',
          label: 'Rond normaal',
          tone: 'info',
        }}
        offerList={[
          {
            checkedLabel: 'Nagekeken 31 mrt, 09:00',
            ctaHref: 'https://example.com/c3po',
            ctaLabel: 'Bekijk bij LEGO',
            isBest: true,
            merchantLabel: 'LEGO',
            price: '€ 139,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        offerSummaryLabel="1 winkel nagekeken · Nagekeken 31 mrt, 09:00"
        priceAlertAction={<button type="button">Volg prijs</button>}
        priceHistoryPanel={<div>Recent prijsverloop</div>}
      />,
    );

    expect(markup).toContain('Nog geen echte vergelijking');
    expect(markup).toContain('We volgen nu 1 winkel voor deze set.');
    expect(markup).not.toContain('Meer nagekeken prijzen');
  });

  it('renders a calm image fallback on set detail pages when no catalog image is available', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation: 'We volgen nog te weinig prijzen.',
          label: 'Nog te weinig data',
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
    expect(markup).toContain('Setnummer');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('Jaar');
    expect(markup).toContain('2022');
    expect(markup).not.toContain('Minifiguren');
    expect(markup).not.toContain('Nog niet bekend');
    expect(markup).toContain('<h1');
    expect(markup).not.toContain('$259 to $319');
    expect(markup).not.toContain('Back to shortlist');
  });

  it('pushes price-following harder when waiting is the smarter call', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        bestDeal={{
          checkedLabel: 'Nagekeken 31 mrt, 09:00',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/gringotts',
          ctaLabel: 'Bekijk prijs bij bol',
          ctaTone: 'secondary',
          decisionHelper: '€ 20,00 boven wat we meestal zien voor deze set.',
          decisionLabel: 'Nog niet bijzonder',
          decisionTone: 'warning',
          merchantLabel: 'bol',
          price: '€ 449,99',
          rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
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
            text: 'Deze prijs ligt boven wat we meestal zien.',
          },
        ]}
        dealVerdict={{
          explanation:
            'Deze prijs ligt boven wat we meestal zien. Volgen en wachten is slimmer.',
          label: 'Nog niet bijzonder',
          tone: 'warning',
        }}
        priceAlertAction={<button type="button">Volg prijs</button>}
      />,
    );

    expect(markup).toContain('Slimmer om te wachten');
    expect(markup).toContain('Volg deze set');
    expect(markup).toContain('Waarom wachten slimmer is');
    expect(markup).toContain('Bekijk prijs bij bol');
    expect(markup).toContain('Volg prijs');
  });

  it('renders minifigure count in the detail specs grid when local data exists', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation:
            'Prima prijs, maar niet opvallend laag. Alleen kopen als je nu wilt instappen.',
          label: 'Rond normaal',
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
            'Deze set zit onder wat we meestal zien. Kopen is nu logisch als je hem wilt hebben.',
          label: 'Nu interessant geprijsd',
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

  it('renders curated minifigure highlights as a lightweight includes line', () => {
    const markup = renderToStaticMarkup(
      <CatalogSetDetailPanel
        dealVerdict={{
          explanation:
            'Deze set zit onder wat we meestal zien. Kopen is nu logisch als je hem wilt hebben.',
          label: 'Nu interessant geprijsd',
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

    expect(markup).toContain('Minifigs');
    expect(markup).toContain(
      'Jabba the Hutt, Princess Leia, Bib Fortuna, Max Rebo',
    );
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
            href: '/discover',
            isActive: true,
            label: 'Alles',
          },
          {
            href: '/discover?filter=best-deals',
            label: 'Beste deals',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="Verfijn ontdekken"');
    expect(markup).toContain('href="/discover"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Beste deals');
    expect(markup).toContain('href="/discover?filter=best-deals"');
  });
});
