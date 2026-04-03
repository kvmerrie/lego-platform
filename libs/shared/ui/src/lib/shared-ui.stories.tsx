import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, SectionHeading, Surface } from './shared-ui';

const meta = {
  title: 'Shared/UI Patterns',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SectionHeadingOnMutedSurface: Story = {
  render: () => (
    <div style={{ maxWidth: '42rem', width: '100%' }}>
      <Surface elevation="rested" tone="muted">
        <SectionHeading
          description="Use this pattern for calm retail sections that still need a clear hierarchy."
          eyebrow="Shared pattern"
          title="Section heading inside a contained surface"
        />
      </Surface>
    </div>
  ),
};

export const SurfaceWithActions: Story = {
  render: () => (
    <div style={{ maxWidth: '34rem', width: '100%' }}>
      <Surface elevation="floating" tone="default">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SectionHeading
            description="A small playground surface for spacing, buttons, and badge rhythm."
            eyebrow="Playground"
            title="Compact action group"
            titleAs="h3"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Badge tone="accent">Reviewed</Badge>
            <Badge tone="info">Collector friendly</Badge>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Button tone="accent">Primary action</Button>
            <Button tone="secondary">Secondary action</Button>
          </div>
        </div>
      </Surface>
    </div>
  ),
};
