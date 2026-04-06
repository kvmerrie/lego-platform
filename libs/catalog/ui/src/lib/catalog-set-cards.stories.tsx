import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@lego-platform/shared/ui';
import { CatalogSetCard } from './catalog-ui';

const meta = {
  title: 'Catalog/Set Cards',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompactCard: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogSetCard
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6167,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          collectorAngle: 'De vallei blijft meteen hangen op je plank.',
          tagline: 'Als je een grote Middle-earth-set wilt, pak je deze.',
          availability: 'Stabiele vraag naar een premium set',
        }}
        supportingNote="Met Elrond, Frodo en Arwen."
        variant="compact"
      />
    </div>
  ),
};

export const DefaultCard: Story = {
  render: () => (
    <div style={{ maxWidth: '21rem', width: '100%' }}>
      <CatalogSetCard
        priceContext={{
          coverageLabel: 'Op voorraad · 2 nagekeken winkels',
          currentPrice: '€ 469,99',
          merchantLabel: 'Nu het laagst bij LEGO',
          pricePositionLabel: '€ 20,00 onder referentie',
          reviewedLabel: 'Nagekeken 2 apr',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6167,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          collectorAngle: 'De vallei blijft meteen hangen op je plank.',
          tagline: 'Als je een grote Middle-earth-set wilt, pak je deze.',
          availability: 'Gezonde beschikbaarheid voor een premium set',
        }}
      />
    </div>
  ),
};

export const FeaturedCard: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogSetCard
        actions={<Button tone="ghost">Volg prijs</Button>}
        priceContext={{
          coverageLabel: '3 winkels nagekeken',
          currentPrice: '€ 479,99',
          merchantLabel: 'Nu het laagst bij bol',
          pricePositionLabel: '€ 30,00 onder normaal',
          pricePositionTone: 'positive',
          reviewedLabel: 'Nagekeken 2 apr',
        }}
        setSummary={{
          id: '76269',
          slug: 'avengers-tower-76269',
          name: 'Avengers Tower',
          theme: 'Marvel',
          releaseYear: 2023,
          pieces: 5202,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/124122.jpg',
          collectorAngle: 'Een skyline-set die meteen herkenbaar is.',
          tagline: 'Als je Marvel groot wilt neerzetten, pak je deze.',
          availability: 'Stabiel met sterke seizoensvraag',
        }}
        supportingNote="Met Iron Man, Captain America en Thor."
        variant="featured"
      />
    </div>
  ),
};

export const FeaturedQuietState: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogSetCard
        actions={<Button tone="ghost">Bewaar</Button>}
        savedState="wishlist"
        setSummary={{
          id: '75331',
          slug: 'the-razor-crest-75331',
          name: 'The Razor Crest',
          theme: 'Star Wars',
          releaseYear: 2022,
          pieces: 6187,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/75331-1/116601.jpg',
          collectorAngle: 'Een groot schip dat je plank meteen vult.',
          tagline: 'Als je een premium Star Wars-schip zoekt, kijk hier eerst.',
          availability: 'Prijscontext volgt later',
        }}
        supportingNote="Met Grogu en The Mandalorian."
        variant="featured"
      />
    </div>
  ),
};

export const FeaturedSavedState: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogSetCard
        actions={<Button tone="ghost">Volgt prijs</Button>}
        priceContext={{
          coverageLabel: '2 winkels nagekeken',
          currentPrice: '€ 349,99',
          merchantLabel: 'Nu het laagst bij bol',
          pricePositionLabel: 'Rond normaal',
          pricePositionTone: 'info',
          reviewedLabel: 'Nagekeken 2 apr',
        }}
        savedState="price-alert"
        setSummary={{
          id: '76417',
          slug: 'gringotts-wizarding-bank-collectors-edition-76417',
          name: "Gringotts Wizarding Bank - Collectors' Edition",
          theme: 'Harry Potter',
          releaseYear: 2023,
          pieces: 4803,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/126166.jpg',
          collectorAngle: 'De bank en draak trekken je plank meteen open.',
          tagline:
            'Kies deze als je een grote Wizarding World-set wilt neerzetten.',
          availability: 'Rustige prijs, wel goed om te volgen',
        }}
        supportingNote="Met Harry, Hermione en Ron."
        variant="featured"
      />
    </div>
  ),
};
