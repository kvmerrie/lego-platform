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
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Button tone="accent">Bekijk set</Button>
            <Button tone="secondary">Volg prijs</Button>
            <Button tone="ghost">Bewaar</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Button disabled tone="accent">
              Niet beschikbaar
            </Button>
            <Button isLoading tone="secondary">
              Laden
            </Button>
            <Button tone="ghost">Meer prijzen</Button>
          </div>
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
            Bekijk bij bol
          </ActionLink>
          <ActionLink href="/themes/icons" tone="secondary">
            Bekijk thema
          </ActionLink>
          <ActionLink href="/discover" tone="ghost">
            Meer om te ontdekken
          </ActionLink>
          <ActionLink href="/themes" tone="inline">
            Hoe Brickhunt werkt
          </ActionLink>
        </div>
        <Surface elevation="rested" tone="muted">
          <ActionLink href="/discover" tone="card">
            <span>Kaart-link</span>
            <span style={{ color: 'var(--lego-text-muted)' }}>
              Gebruik dit wanneer een hele tegel klikbaar moet zijn zonder extra
              knopruis.
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
          <Badge tone="neutral">Nog niet opgeslagen</Badge>
          <Badge tone="accent">Nagekeken prijs</Badge>
          <Badge tone="info">Rond normaal</Badge>
          <Badge tone="positive">Nu interessant geprijsd</Badge>
          <Badge tone="warning">Nog niet bijzonder</Badge>
          <Badge tone="error">Status niet beschikbaar</Badge>
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
          Standaard surface
        </Surface>
        <Surface elevation="rested" tone="muted">
          Rustige surface
        </Surface>
        <Surface elevation="floating" tone="accent">
          Accent surface zonder glans
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
            description="Gebruik deze maat voor de meeste secties, kaarten en panelen."
            eyebrow="Standaard"
            title="Korte heading met rustige ritmiek"
          />
        </Surface>
        <Surface elevation="floating" tone="default">
          <SectionHeading
            description="Gebruik display alleen als de heading echt het blok moet trekken."
            eyebrow="Display"
            title="Grotere heading voor lead-secties"
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
              description="Gebruik dezelfde container-ritmiek als een sectie op de shell-grid moet aansluiten."
              eyebrow="Container"
              title="Vaste paginabreedte met strakke hiërarchie"
              titleAs="h3"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Badge tone="accent">Gedeelde ritmiek</Badge>
              <Badge tone="info">Gelijke gutter</Badge>
            </div>
          </div>
        </Surface>
      </Container>
    </div>
  ),
};
