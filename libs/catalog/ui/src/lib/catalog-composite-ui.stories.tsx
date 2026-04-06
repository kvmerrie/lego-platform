import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CatalogQuickFilterBar,
  CatalogSectionHeader,
  CatalogSectionShell,
  CatalogSetDetailHero,
  CatalogSetDetailPanel,
  CatalogSplitIntroPanel,
} from './catalog-ui';
import {
  CatalogKeyFacts,
  CatalogPriceDecisionPanel,
} from './catalog-commerce-ui';
import { ActionLink, Badge, Button, Surface } from '@lego-platform/shared/ui';

const meta = {
  title: 'Catalog/Compositions',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const detailFacts = [
  {
    id: 'set-number',
    label: 'Setnummer',
    value: '10316',
  },
  {
    id: 'recommended-age',
    label: 'Leeftijd',
    value: '18+',
  },
  {
    id: 'display-size',
    label: 'Formaat',
    value: '72 × 50 × 39 cm',
  },
  {
    id: 'pieces',
    label: 'Stenen',
    value: '6.167',
  },
  {
    id: 'minifigures',
    label: 'Minifiguren',
    value: '15',
  },
] as const;

const detailBase = {
  catalogSetDetail: {
    id: '10316',
    slug: 'rivendell-10316',
    name: 'Rivendell',
    theme: 'Icons',
    subtheme: 'The Lord of the Rings',
    releaseYear: 2023,
    pieces: 6167,
    recommendedAge: 18,
    displaySize: {
      value: '72 × 50 × 39 cm',
    },
    minifigureCount: 15,
    minifigureHighlights: ['Elrond', 'Frodo', 'Arwen'],
    availability: 'Goed verkrijgbaar voor een premium set',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
    primaryImage: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
    images: [
      {
        url: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
      },
      {
        url: 'https://cdn.rebrickable.com/media/sets/10316-1/132395.jpg',
      },
    ],
    tagline: 'Kies deze als je Midden-aarde groot en rustig op je plank wilt.',
    collectorAngle:
      'De boog, het bladwerk en de minifigs blijven je blik trekken.',
    collectorHighlights: [
      'De vallei leest meteen als Rivendell.',
      'De Fellowship-cast maakt het display rijker.',
      'Van dichtbij blijft de architectuur interessant.',
    ],
    setStatus: 'available',
  },
  brickhuntValueItems: [
    {
      id: 'trust-1',
      text: 'Geen nep-korting. Alleen nagekeken prijzen die echt live stonden.',
    },
    {
      id: 'trust-2',
      text: 'Je ziet snel of wachten slimmer is dan nu klikken.',
    },
  ],
  dealSupportItems: [
    {
      id: 'deal-1',
      text: 'Deze prijs zit duidelijk onder wat we normaal voor deze set zien.',
    },
    {
      id: 'deal-2',
      text: 'Rivendell zakt niet vaak hard, dus dit moment valt op.',
    },
  ],
  offerList: [
    {
      checkedLabel: 'Nagekeken 2 apr',
      ctaHref: 'https://example.com/bol/rivendell',
      ctaLabel: 'Bekijk bij bol',
      isBest: true,
      merchantLabel: 'bol',
      price: '€ 469,99',
      stockLabel: 'Op voorraad',
    },
    {
      checkedLabel: 'Nagekeken 2 apr',
      ctaHref: 'https://example.com/lego/rivendell',
      ctaLabel: 'Bekijk bij LEGO',
      merchantLabel: 'LEGO',
      price: '€ 499,99',
      stockLabel: 'Op voorraad',
    },
  ],
  offerSummaryLabel: '2 winkels nagekeken',
  ownershipActions: (
    <Button tone="secondary">Staat al in mijn collectie</Button>
  ),
  priceHistoryPanel: (
    <Surface tone="muted">
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Prijsverloop</p>
        <p style={{ margin: 0 }}>
          Laatste 30 dagen: van € 499,99 naar € 469,99.
        </p>
      </div>
    </Surface>
  ),
  themeDirectoryHref: '/themes',
  themeHref: '/themes/icons',
  trustSignals: [
    {
      label: 'Nagekeken prijzen',
      value: '2 winkels',
    },
    {
      label: 'Laatste check',
      value: '2 apr',
    },
    {
      label: 'Prijsbeeld',
      value: '€ 20 onder normaal',
    },
  ],
};

export const SectionHeaderStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '72rem',
        padding: '1.5rem',
      }}
    >
      <Surface tone="default">
        <CatalogSectionHeader
          description="Sets die nu echt de moeite zijn om eerst open te klikken."
          eyebrow="Nu slimmer geprijsd"
          signal="3 sets met nagekeken prijscontext"
          title="Hier wil je nu als eerste kijken"
        />
      </Surface>
      <Surface style={{ background: '#242424' }} tone="default">
        <CatalogSectionHeader
          description="Thema's met een totaal ander displaygevoel."
          eyebrow="Kies je hoek"
          signal="6 thema's om mee te starten"
          title="Fantasy, Star Wars of strak design?"
          tone="inverse"
        />
      </Surface>
      <Surface tone="muted">
        <CatalogSectionHeader
          description="Open een volledig thema als je verder wilt vergelijken."
          eyebrow="Thema"
          signal="8 getoond · 23 totaal"
          title={
            <span className="notranslate" translate="no">
              Marvel
            </span>
          }
          utility={
            <ActionLink href="/themes/marvel" tone="secondary">
              Open volledig thema
            </ActionLink>
          }
          utilityPlacement="below-heading"
        />
      </Surface>
    </div>
  ),
};

export const SectionShellStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '72rem',
        padding: '1.5rem',
      }}
    >
      <CatalogSectionShell
        description="Sets die nu sneller beslissen en direct een beter koopmoment laten zien."
        eyebrow="Nu slimmer geprijsd"
        padding="relaxed"
        signal="3 sets met nagekeken prijscontext"
        spacing="relaxed"
        title="Hier wil je nu als eerste kijken"
        tone="muted"
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Surface tone="default">
            <p style={{ margin: 0 }}>Rail of grid komt hier als body-slot.</p>
          </Surface>
          <Surface tone="default">
            <p style={{ margin: 0 }}>
              De shell bewaakt vooral het sectieritme.
            </p>
          </Surface>
        </div>
      </CatalogSectionShell>
      <CatalogSectionShell
        description="Open een volledig thema als je verder wilt vergelijken."
        eyebrow="Thema"
        padding="default"
        signal="8 getoond · 23 totaal"
        title={
          <span className="notranslate" translate="no">
            Marvel
          </span>
        }
        tone="default"
        utility={
          <ActionLink href="/themes/marvel" tone="secondary">
            Open volledig thema
          </ActionLink>
        }
        utilityPlacement="below-heading"
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Surface tone="muted">
            <p style={{ margin: 0 }}>
              Kaarten of facts kunnen hier direct onder.
            </p>
          </Surface>
        </div>
      </CatalogSectionShell>
      <CatalogSectionShell
        description="Donkere secties houden dezelfde header- en bodycadence."
        eyebrow="Kies je hoek"
        padding="none"
        signal="6 thema's om mee te starten"
        title="Fantasy, Star Wars of strak design?"
        tone="inverse"
      >
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'auto',
            padding: '0 1.5rem 1.5rem',
          }}
        >
          <Surface tone="default">
            <p style={{ margin: 0 }}>Thema 1</p>
          </Surface>
          <Surface tone="default">
            <p style={{ margin: 0 }}>Thema 2</p>
          </Surface>
        </div>
      </CatalogSectionShell>
      <CatalogSectionShell
        description="Ook platte secties kunnen dezelfde header/body-structuur gebruiken."
        eyebrow="Zoeken"
        padding="none"
        signal="12 passende sets"
        title='Resultaten voor "rivendell"'
        tone="plain"
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <CatalogQuickFilterBar
            ariaLabel="Verfijn zoeken"
            items={[
              { href: '/search?q=rivendell', isActive: true, label: 'Alles' },
              {
                href: '/search?q=rivendell&filter=best-deals',
                label: 'Beste deals',
              },
            ]}
          />
          <Surface tone="default">
            <p style={{ margin: 0 }}>Resultaten-grid of state-panel.</p>
          </Surface>
        </div>
      </CatalogSectionShell>
    </div>
  ),
};

export const QuickFilterStates: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '72rem', padding: '1.5rem' }}>
      <CatalogQuickFilterBar
        ariaLabel="Verfijn ontdekken"
        items={[
          { href: '/discover', isActive: true, label: 'Alles' },
          { href: '/discover?filter=deals', label: 'Nu interessant geprijsd' },
          { href: '/discover?filter=minifigs', label: 'Sterke minifiguren' },
          { href: '/discover?filter=display', label: 'Displaystukken' },
        ]}
      />
    </div>
  ),
};

export const SplitIntroPanelStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '72rem',
        padding: '1.5rem',
      }}
    >
      <CatalogSplitIntroPanel
        actionHref="/discover"
        actionLabel="Bekijk sets"
        primary={{
          description:
            'Begin bij sets die je echt wilt blijven bekijken en vergelijk daarna pas de prijs.',
          eyebrow: 'Zo werkt Brickhunt',
          meta: 'Kies eerst. Koop daarna slimmer.',
          title: 'Sneller kiezen. Slimmer kopen.',
          tone: 'display',
        }}
        secondary={{
          description:
            'Open een set als het moment goed is, of volg de prijs als wachten slimmer voelt.',
          eyebrow: 'Volgende stap',
          title: 'Klik nu door of kijk later opnieuw.',
        }}
      />
      <CatalogSplitIntroPanel
        primary={{
          description:
            'Gebruik deze compositie als een pagina één hoofdboodschap en één duidelijke vervolgrichting nodig heeft.',
          eyebrow: 'Split intro',
          meta: 'Korte lead links, praktische route rechts.',
          title: 'Eén duidelijke lead. Eén rustige vervolgstap.',
        }}
        secondary={{
          description:
            'De tweede kolom mag korter blijven zolang hij de volgende keuze helder maakt.',
          eyebrow: 'Rustige tweede kolom',
          title: 'Hou de tweede helft klein en bruikbaar.',
        }}
      />
    </div>
  ),
};

export const SetDetailHeroStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '76rem',
        padding: '1.5rem',
      }}
    >
      <CatalogSetDetailHero
        badges={
          <>
            <Badge tone="accent">Icons</Badge>
            <Badge tone="neutral">The Lord of the Rings</Badge>
            <Badge tone="positive">Nu interessant geprijsd</Badge>
          </>
        }
        decisionPanel={
          <CatalogPriceDecisionPanel
            followAction={<Button tone="secondary">Volg prijs</Button>}
            primaryOffer={{
              checkedLabel: 'Nagekeken 2 apr',
              coverageLabel: '2 winkels nagekeken',
              ctaHref: 'https://example.com/bol/rivendell',
              ctaLabel: 'Bekijk bij bol',
              decisionHelper: '€ 20 onder wat we meestal zien voor deze set.',
              decisionLabel: 'Nu interessant geprijsd',
              decisionTone: 'positive',
              merchantLabel: 'Nu het laagst bij bol',
              price: '€ 469,99',
              stockLabel: 'Op voorraad',
            }}
            supportItems={[
              {
                id: 'support-1',
                text: 'De prijs zit onder het normale niveau voor Rivendell.',
              },
            ]}
            supportTitle="Waarom dit nu interessant is"
            verdictTone="positive"
          />
        }
        gallery={
          <div
            style={{
              aspectRatio: '4 / 3',
              background: '#eef1f5',
              borderRadius: '1rem',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700 }}>Hero-afbeelding</span>
          </div>
        }
        keyFacts={<CatalogKeyFacts items={detailFacts} />}
        pitch="Kies deze als je Midden-aarde groot en rustig op je plank wilt."
        title="Rivendell"
        verdict={{
          explanation: 'De prijs ligt onder wat we meestal zien voor deze set.',
          label: 'Nu interessant geprijsd',
          tone: 'positive',
        }}
      />
      <CatalogSetDetailHero
        badges={
          <>
            <Badge tone="accent">Star Wars</Badge>
            <Badge tone="warning">Nog niet bijzonder</Badge>
          </>
        }
        decisionPanel={
          <CatalogPriceDecisionPanel
            followAction={<Button tone="secondary">Volg prijs</Button>}
            leadWithFollow
            primaryOffer={{
              checkedLabel: 'Nagekeken 2 apr',
              coverageLabel: '3 winkels nagekeken',
              ctaHref: 'https://example.com/bol/razor-crest',
              ctaLabel: 'Bekijk prijs bij bol',
              decisionHelper:
                'Niet het sterkste moment. Deze set zakt vaker verder weg.',
              decisionLabel: 'Nog niet bijzonder',
              decisionTone: 'warning',
              merchantLabel: 'Nu het laagst bij bol',
              price: '€ 589,99',
              stockLabel: 'Op voorraad',
            }}
            supportItems={[
              {
                id: 'support-2',
                text: 'Wachten geeft vaak meer kans op een betere prijs.',
              },
            ]}
            supportTitle="Waarom wachten slimmer is"
            verdictTone="warning"
          />
        }
        gallery={
          <div
            style={{
              aspectRatio: '4 / 3',
              background: '#eef1f5',
              borderRadius: '1rem',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700 }}>Hero-afbeelding</span>
          </div>
        }
        keyFacts={<CatalogKeyFacts items={detailFacts.slice(0, 3)} />}
        pitch="Een groot schip voor verzamelaars die liever wachten op een sterker moment."
        title="The Razor Crest"
        verdict={{
          explanation:
            'De prijs is nu niet gek, maar ook niet het beste moment.',
          label: 'Nog niet bijzonder',
          tone: 'warning',
        }}
      />
    </div>
  ),
};

export const SetDetailPanelStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '2rem',
        margin: '0 auto',
        maxWidth: '76rem',
        padding: '1.5rem',
      }}
    >
      <CatalogSetDetailPanel
        {...detailBase}
        bestDeal={{
          checkedLabel: 'Nagekeken 2 apr',
          coverageLabel: '2 winkels nagekeken',
          ctaHref: 'https://example.com/bol/rivendell',
          ctaLabel: 'Bekijk bij bol',
          decisionHelper: '€ 20 onder wat we meestal zien voor deze set.',
          decisionLabel: 'Nu interessant geprijsd',
          decisionTone: 'positive',
          merchantLabel: 'Nu het laagst bij bol',
          price: '€ 469,99',
          stockLabel: 'Op voorraad',
        }}
        dealVerdict={{
          explanation:
            'De prijs ligt onder wat we meestal zien voor Rivendell.',
          label: 'Nu interessant geprijsd',
          tone: 'positive',
        }}
        priceAlertAction={<Button tone="secondary">Volg prijs</Button>}
      />
      <CatalogSetDetailPanel
        {...detailBase}
        bestDeal={{
          checkedLabel: 'Nagekeken 2 apr',
          coverageLabel: '3 winkels nagekeken',
          ctaHref: 'https://example.com/bol/rivendell',
          ctaLabel: 'Bekijk prijs bij bol',
          decisionHelper:
            'Nog niet het beste moment. Deze set staat vaker lager.',
          decisionLabel: 'Nog niet bijzonder',
          decisionTone: 'warning',
          merchantLabel: 'Nu het laagst bij bol',
          price: '€ 519,99',
          stockLabel: 'Op voorraad',
        }}
        dealSupportItems={[
          {
            id: 'deal-3',
            text: 'De huidige prijs ligt boven wat we meestal voor deze set zien.',
          },
        ]}
        dealVerdict={{
          explanation:
            'De prijs is nu niet stuk, maar wachten kan meer opleveren.',
          label: 'Nog niet bijzonder',
          tone: 'warning',
        }}
        priceAlertAction={<Button tone="secondary">Volg prijs</Button>}
      />
    </div>
  ),
};
