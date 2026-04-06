import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Blocks,
  Cake,
  CalendarDays,
  Hash,
  Package2,
  Ruler,
  UsersRound,
} from 'lucide-react';
import { Button } from '@lego-platform/shared/ui';
import {
  CatalogKeyFacts,
  CatalogOfferComparison,
  CatalogOfferRow,
  CatalogPriceDecisionPanel,
  CatalogTrustPanel,
} from './catalog-commerce-ui';

const meta = {
  title: 'Catalog/Commerce',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const KeyFactsStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '64rem',
      }}
    >
      <CatalogKeyFacts
        items={[
          {
            id: 'set-number',
            icon: <Hash aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Setnummer',
            value: '10316',
          },
          {
            id: 'recommended-age',
            icon: <Cake aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Leeftijd',
            value: '18+',
          },
          {
            id: 'display-size',
            icon: <Ruler aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Formaat',
            value: '72 × 50 × 39 cm',
          },
          {
            id: 'pieces',
            icon: <Blocks aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Stenen',
            value: '6.167',
          },
          {
            id: 'minifigures',
            icon: <UsersRound aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Minifiguren',
            value: '15',
          },
          {
            id: 'year',
            icon: (
              <CalendarDays aria-hidden="true" size={17} strokeWidth={2.2} />
            ),
            label: 'Jaar',
            value: '2023',
          },
        ]}
      />
      <CatalogKeyFacts
        items={[
          {
            id: 'set-number-minimal',
            icon: <Hash aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Setnummer',
            value: '75398',
          },
          {
            id: 'pieces-minimal',
            icon: <Blocks aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Stenen',
            value: '1.138',
          },
          {
            id: 'year-minimal',
            icon: (
              <CalendarDays aria-hidden="true" size={17} strokeWidth={2.2} />
            ),
            label: 'Jaar',
            value: '2024',
          },
          {
            id: 'status-minimal',
            icon: <Package2 aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Status',
            value: 'Nu beschikbaar',
          },
        ]}
      />
    </div>
  ),
};

export const DecisionPanelStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '28rem',
      }}
    >
      <CatalogPriceDecisionPanel
        followAction={<Button tone="secondary">Volg prijs</Button>}
        primaryOffer={{
          checkedLabel: 'Nagekeken 2 apr, 09:00',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk bij bol',
          ctaTone: 'accent',
          decisionHelper: '€ 30,00 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Nu interessant geprijsd',
          decisionTone: 'positive',
          merchantLabel: 'bol',
          price: '€ 469,99',
          rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        supportItems={[
          {
            id: 'below-normal',
            text: 'Deze prijs ligt onder wat we meestal zien.',
          },
          {
            id: 'best-now',
            text: 'Dit is momenteel de scherpste prijs die we volgen.',
          },
        ]}
        supportTitle="Waarom dit nu interessant is"
        verdictTone="positive"
      />
      <CatalogPriceDecisionPanel
        followAction={<Button tone="secondary">Volg prijs</Button>}
        leadWithFollow
        primaryOffer={{
          checkedLabel: 'Nagekeken 2 apr, 09:00',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/gringotts',
          ctaLabel: 'Bekijk prijs bij bol',
          ctaTone: 'secondary',
          decisionHelper: '€ 20,00 boven wat we meestal zien voor deze set.',
          decisionLabel: 'Nog niet bijzonder',
          decisionTone: 'warning',
          merchantLabel: 'bol',
          price: '€ 449,99',
          rankingLabel: 'Laagste nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        supportItems={[
          {
            id: 'above-normal',
            text: 'Deze prijs ligt boven wat we meestal zien.',
          },
        ]}
        supportTitle="Waarom wachten slimmer is"
        verdictTone="warning"
      />
      <CatalogPriceDecisionPanel
        followAction={<Button tone="secondary">Volg prijs</Button>}
        supportItems={[
          {
            id: 'limited-data',
            text: 'We hebben nog weinig prijsdata voor deze set.',
          },
        ]}
        supportTitle="Wat we nu al kunnen zeggen"
        verdictTone="neutral"
      />
      <CatalogPriceDecisionPanel
        followAction={<Button tone="secondary">Bewaar</Button>}
        primaryOffer={{
          checkedLabel: 'Nagekeken 2 apr, 09:00',
          coverageLabel: '1 winkel nagekeken',
          ctaHref: 'https://example.com/batmobile',
          ctaLabel: 'Bekijk prijs bij LEGO',
          ctaTone: 'secondary',
          decisionHelper: 'Rond wat we meestal zien voor deze set.',
          decisionLabel: 'Rond normaal',
          decisionTone: 'info',
          merchantLabel: 'LEGO',
          price: '€ 149,99',
          rankingLabel: 'Enige nagekeken prijs die nu op voorraad is.',
          stockLabel: 'Op voorraad',
        }}
        supportItems={[
          {
            id: 'normal-range',
            text: 'Geen uitschieter, wel een bruikbaar vergelijkpunt.',
          },
        ]}
        supportTitle="Wat dit nu betekent"
        verdictTone="neutral"
      />
    </div>
  ),
};

export const OfferStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '56rem',
      }}
    >
      <CatalogOfferRow
        offer={{
          checkedLabel: 'Nagekeken 2 apr, 09:00',
          ctaHref: 'https://example.com/rivendell',
          ctaLabel: 'Bekijk bij bol',
          isBest: true,
          merchantLabel: 'bol',
          price: '€ 469,99',
          rankingLabel: 'Laagste prijs op voorraad',
          stockLabel: 'Op voorraad',
        }}
      />
      <CatalogOfferComparison
        offers={[
          {
            checkedLabel: 'Nagekeken 2 apr, 09:00',
            ctaHref: 'https://example.com/rivendell',
            ctaLabel: 'Bekijk bij bol',
            isBest: true,
            merchantLabel: 'bol',
            price: '€ 469,99',
            rankingLabel: 'Laagste prijs op voorraad',
            stockLabel: 'Op voorraad',
          },
          {
            checkedLabel: 'Nagekeken 2 apr, 09:10',
            ctaHref: 'https://example.com/rivendell-lego',
            ctaLabel: 'Bekijk bij LEGO',
            merchantLabel: 'LEGO',
            price: '€ 499,99',
            rankingLabel: '€ 30,00 hoger dan de beste optie',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="2 winkels nagekeken · Nagekeken 2 apr, 09:00"
      />
      <CatalogOfferComparison
        offers={[
          {
            checkedLabel: 'Nagekeken 2 apr, 09:00',
            ctaHref: 'https://example.com/c3po',
            ctaLabel: 'Bekijk bij LEGO',
            isBest: true,
            merchantLabel: 'LEGO',
            price: '€ 139,99',
            stockLabel: 'Op voorraad',
          },
        ]}
        summaryLabel="1 winkel nagekeken · Nagekeken 2 apr, 09:00"
      />
    </div>
  ),
};

export const TrustPanelStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '48rem',
      }}
    >
      <CatalogTrustPanel
        trustSignals={[
          { label: 'Laatst nagekeken', value: '2 apr 2026, 09:00' },
          { label: 'Winkels nagekeken', value: '3 winkels nagekeken' },
          { label: 'Valuta', value: 'Euro-aanbiedingen' },
        ]}
      />
      <CatalogTrustPanel
        eyebrow="Controle"
        title="Waar deze vergelijking op leunt"
        trustSignals={[
          { label: 'Laatst nagekeken', value: '2 apr 2026, 09:00' },
          { label: 'Winkels nagekeken', value: '1 winkel nagekeken' },
        ]}
      />
    </div>
  ),
};
