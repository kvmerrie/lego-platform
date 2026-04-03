import type { Meta, StoryObj } from '@storybook/react-vite';
import { CatalogThemeHighlight } from './catalog-ui';

const meta = {
  title: 'Catalog/Theme Highlights',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PortraitTile: Story = {
  render: () => (
    <div style={{ maxWidth: '14rem', width: '100%' }}>
      <CatalogThemeHighlight
        visual={{
          backgroundColor: '#f0c63b',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
          textColor: '#171a22',
        }}
        themeSnapshot={{
          name: 'Icons',
          slug: 'icons',
          setCount: 14,
          momentum:
            'Display-led builds, nostalgia anchors, and big collector landmarks.',
          signatureSet: 'Rivendell',
        }}
        variant="portrait"
      />
    </div>
  ),
};

export const FeatureTile: Story = {
  render: () => (
    <div style={{ maxWidth: '16rem', width: '100%' }}>
      <CatalogThemeHighlight
        visual={{
          backgroundColor: '#cf554c',
          imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/124122.jpg',
          textColor: '#ffffff',
        }}
        themeSnapshot={{
          name: 'Marvel',
          slug: 'marvel',
          setCount: 3,
          momentum:
            'Superhero flagships and skyline-style display builds with broad recognition.',
          signatureSet: 'Avengers Tower',
        }}
        variant="feature"
      />
    </div>
  ),
};

export const PlainTile: Story = {
  render: () => (
    <div style={{ maxWidth: '18rem', width: '100%' }}>
      <CatalogThemeHighlight
        themeSnapshot={{
          name: 'Botanicals',
          slug: 'botanicals',
          setCount: 6,
          momentum: 'Display-led floral builds with gift-friendly pull.',
          signatureSet: 'Bouquet of Roses',
        }}
      />
    </div>
  ),
};
