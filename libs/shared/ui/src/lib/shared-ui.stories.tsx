import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ActionLink,
  Badge,
  Breadcrumbs,
  Button,
  Container,
  LabelValue,
  LabelValueList,
  MarkerList,
  MetaSignal,
  Panel,
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

export const BreadcrumbStates: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '56rem', padding: '2rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Surface elevation="rested" tone="muted">
          <Breadcrumbs
            ariaLabel="Breadcrumb"
            items={[
              { href: '/', id: 'home', label: 'Home' },
              { href: '/themes', id: 'themes', label: "Thema's" },
              { href: '/themes/icons', id: 'icons', label: 'Icons' },
              { id: 'detail', label: 'Setdetail' },
            ]}
          />
        </Surface>
        <div style={{ maxWidth: '24rem' }}>
          <Surface elevation="rested" tone="default">
            <Breadcrumbs
              ariaLabel="Breadcrumb"
              items={[
                { href: '/', id: 'home-long', label: 'Home' },
                { href: '/pages', id: 'pages', label: "Redactionele pagina's" },
                {
                  id: 'current-long',
                  label:
                    'Waarom deze set op je plank meer doet dan alleen een lage prijs',
                },
              ]}
            />
          </Surface>
        </div>
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

export const PanelStates: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '52rem', padding: '2rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
        }}
      >
        <Panel
          description="Gebruik dit voor rustige hulp- en trustblokken."
          eyebrow="Panel"
          title="Standaard informatieblok"
          tone="muted"
        >
          <p style={{ margin: 0 }}>
            Alles in hetzelfde ritme: heading, body en acties.
          </p>
        </Panel>
        <Panel
          description="Compacte variant voor kleinere zijblokken en nested info."
          eyebrow="Compact"
          spacing="compact"
          title="Krapper ritme"
          tone="default"
        >
          <Button tone="secondary">Volg prijs</Button>
        </Panel>
      </div>
    </div>
  ),
};

export const MetaAndListStates: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '56rem', padding: '2rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
        }}
      >
        <Panel eyebrow="Meta" title="Meta-signals" tone="default">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <MetaSignal>3 winkels nagekeken</MetaSignal>
            <MetaSignal tone="warning">Nog niet bijzonder</MetaSignal>
            <MetaSignal tone="positive">Nu interessant geprijsd</MetaSignal>
          </div>
        </Panel>
        <Panel eyebrow="Lijst" title="Marker-lijsten" tone="muted">
          <MarkerList
            items={[
              { content: 'Onder wat we meestal zien voor deze set.', id: 'a' },
              { content: 'Geen nep-kortingen of verzonnen ranges.', id: 'b' },
              {
                content: 'Volgen blijft een volwaardige tweede stap.',
                id: 'c',
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  ),
};

export const LabelValueStates: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Panel eyebrow="Rollen" title="Enkele label/value" tone="muted">
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
            }}
          >
            <LabelValue label="Winkels" value="3 nagekeken" />
            <LabelValue
              appearance="tile"
              description="Laatst bevestigd in de huidige prijscheck."
              label="Nagekeken"
              value="2 apr 2026, 09:00"
            />
          </div>
        </Panel>
        <Panel eyebrow="Grid" title="Label/value-lijst" tone="default">
          <LabelValueList
            appearance="tile"
            items={[
              {
                id: 'set',
                label: 'Setnummer',
                value: '10316',
              },
              {
                id: 'price',
                label: 'Normaal',
                value: 'Rond normaal',
              },
              {
                id: 'merchant',
                label: 'Laagst bij',
                value: 'bol',
              },
            ]}
          />
        </Panel>
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
