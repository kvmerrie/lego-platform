import type { Meta, StoryObj } from '@storybook/react-vite';
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
          collectorAngle: 'Prestige fantasy display anchor',
          tagline:
            'A large-scale crossover set that reads clearly even in a fast browse context.',
          availability: 'Stable premium demand',
        }}
        supportingNote="Includes Elrond, Frodo Baggins, and Arwen"
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
          coverageLabel: 'In stock · 2 reviewed offers',
          currentPrice: 'EUR 469.99',
          merchantLabel: 'Lowest reviewed price at LEGO',
          pricePositionLabel: 'EUR 20.00 below reference',
          reviewedLabel: 'Checked 2 apr',
        }}
        setSummary={{
          id: '10316',
          slug: 'rivendell-10316',
          name: 'Rivendell',
          theme: 'Icons',
          releaseYear: 2023,
          pieces: 6167,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          collectorAngle: 'Prestige fantasy display anchor',
          tagline:
            'A flagship fantasy build that rewards both display space and patience.',
          availability: 'Healthy premium availability',
        }}
      />
    </div>
  ),
};

export const FeaturedCard: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogSetCard
        priceContext={{
          coverageLabel: 'In stock · 3 reviewed offers',
          currentPrice: 'EUR 479.99',
          merchantLabel: 'Lowest reviewed price at bol',
          pricePositionLabel: 'EUR 30.00 below reference',
          reviewedLabel: 'Checked 2 apr',
        }}
        setSummary={{
          id: '76269',
          slug: 'avengers-tower-76269',
          name: 'Avengers Tower',
          theme: 'Marvel',
          releaseYear: 2023,
          pieces: 5202,
          imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/124122.jpg',
          collectorAngle: 'Marvel flagship showcase',
          tagline:
            'A marquee licensed set with broad household recognizability.',
          availability: 'Stable with strong seasonal demand',
        }}
        supportingNote="Includes Iron Man, Captain America, and Thor"
        variant="featured"
      />
    </div>
  ),
};
