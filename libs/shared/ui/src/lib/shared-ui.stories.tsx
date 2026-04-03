import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ActionLink,
  Badge,
  Button,
  Container,
  SectionHeading,
  Surface,
} from './shared-ui';

const meta = {
  title: 'Shared/Primitives',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ButtonTones: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '44rem', padding: '2rem' }}>
      <Surface elevation="rested" tone="muted">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Button tone="accent">Accent action</Button>
          <Button tone="secondary">Secondary action</Button>
          <Button tone="ghost">Ghost action</Button>
        </div>
      </Surface>
    </div>
  ),
};

export const ActionLinkTones: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '48rem', padding: '2rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <ActionLink href="/sets/rivendell-10316" tone="accent">
            Accent link
          </ActionLink>
          <ActionLink href="/themes/icons" tone="secondary">
            Secondary link
          </ActionLink>
          <ActionLink href="/discover" tone="ghost">
            Ghost link
          </ActionLink>
          <ActionLink href="/themes" tone="inline">
            Inline link
          </ActionLink>
        </div>
        <Surface elevation="rested" tone="muted">
          <ActionLink href="/discover" tone="card">
            <span>Card-style link</span>
            <span style={{ color: 'var(--lego-text-muted)' }}>
              Stretch this treatment across a full presentational surface.
            </span>
          </ActionLink>
        </Surface>
      </div>
    </div>
  ),
};

export const BadgeTones: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '42rem', padding: '2rem' }}>
      <Surface elevation="rested" tone="muted">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Reviewed</Badge>
          <Badge tone="info">Collector friendly</Badge>
          <Badge tone="positive">Good deal</Badge>
          <Badge tone="warning">Price moving</Badge>
          <Badge tone="error">Unavailable</Badge>
        </div>
      </Surface>
    </div>
  ),
};

export const SurfaceElevations: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
        }}
      >
        <Surface elevation="default" tone="default">
          Default surface
        </Surface>
        <Surface elevation="rested" tone="muted">
          Muted rested surface
        </Surface>
        <Surface elevation="floating" tone="accent">
          Floating accent surface
        </Surface>
      </div>
    </div>
  ),
};

export const SectionHeadingScales: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
        }}
      >
        <Surface elevation="rested" tone="muted">
          <SectionHeading
            description="Use the default heading scale for most section surfaces."
            eyebrow="Default"
            title="Section heading inside a contained surface"
          />
        </Surface>
        <Surface elevation="floating" tone="default">
          <SectionHeading
            description="Use the display scale when the heading needs more presence without baking page context into the API."
            eyebrow="Display"
            title="Larger display-style heading"
            tone="display"
          />
        </Surface>
      </div>
    </div>
  ),
};

export const ContainedSection: Story = {
  render: () => (
    <div style={{ background: '#ece8e0', padding: '2rem 0' }}>
      <Container as="section">
        <Surface elevation="rested" tone="default">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeading
              description="Use the shared container when a section needs to align with the same page grid as the shell."
              eyebrow="Container"
              title="Contained page rhythm"
              titleAs="h3"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Badge tone="accent">1600px rhythm</Badge>
              <Badge tone="info">Shared gutter</Badge>
            </div>
          </div>
        </Surface>
      </Container>
    </div>
  ),
};
