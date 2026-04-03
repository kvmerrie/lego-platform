import type { Meta, StoryObj } from '@storybook/react-vite';
import { CatalogSplitIntroPanel } from './catalog-ui';

const meta = {
  title: 'Catalog/Surfaces',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SplitIntroPanel: Story = {
  render: () => (
    <div style={{ maxWidth: '60rem', width: '100%' }}>
      <CatalogSplitIntroPanel
        actionHref="/discover"
        actionLabel="Browse the catalog"
        primary={{
          description:
            'Use a split intro surface when one side needs the primary framing and the other side adds a supporting route into the catalog.',
          eyebrow: 'Intro surface',
          meta: 'Quick to scan. Clear enough to act.',
          title: 'Lead with the strongest catalog message.',
          tone: 'display',
        }}
        secondary={{
          description:
            'The supporting block can stay shorter and point people toward the next browse action without baking any page-specific assumptions into the component API.',
          eyebrow: 'Supporting route',
          title: 'Keep the secondary panel practical.',
          titleAs: 'h2',
        }}
      />
    </div>
  ),
};
