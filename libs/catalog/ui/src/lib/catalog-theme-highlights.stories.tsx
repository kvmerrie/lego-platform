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
            'Grote displaysets, nostalgie en plankstukken die blijven hangen.',
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
            'Grote skyline- en HQ-sets met brede herkenning en veel plankpresence.',
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
          momentum:
            'Bloemen en planten die direct werken als displayset of cadeau.',
          signatureSet: 'Bouquet of Roses',
        }}
      />
    </div>
  ),
};

export const FeatureTileWithoutImage: Story = {
  render: () => (
    <div style={{ maxWidth: '16rem', width: '100%' }}>
      <CatalogThemeHighlight
        themeSnapshot={{
          name: 'Modular Buildings',
          slug: 'modular-buildings',
          setCount: 8,
          momentum:
            'Straten, hoeken en gevels die sterker worden zodra je meer dan één pand naast elkaar zet.',
          signatureSet: 'Natural History Museum',
        }}
        variant="feature"
      />
    </div>
  ),
};
