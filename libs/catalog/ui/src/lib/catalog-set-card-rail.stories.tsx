import type { Meta, StoryObj } from '@storybook/react-vite';
import { CatalogSetCardRail } from './catalog-set-card-rail';

const meta = {
  title: 'Catalog/Rails',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const FeaturedRail: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '72rem', padding: '1.5rem' }}>
      <CatalogSetCardRail
        ariaLabel="Uitgelichte setrail"
        items={[
          {
            id: '10316',
            priceContext: {
              coverageLabel: 'Op voorraad · 2 winkels nagekeken',
              currentPrice: '€ 469,99',
              merchantLabel: 'Nu het laagst bij LEGO',
              pricePositionLabel: '€ 20,00 onder normaal',
              reviewedLabel: 'Nagekeken 2 apr',
            },
            setSummary: {
              id: '10316',
              slug: 'rivendell-10316',
              name: 'Rivendell',
              theme: 'Icons',
              releaseYear: 2023,
              pieces: 6167,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
              collectorAngle: 'De vallei blijft meteen hangen op je plank.',
              tagline: 'Als je een grote Middle-earth-set wilt, pak je deze.',
              availability: 'Gezonde beschikbaarheid voor een premium set',
            },
            supportingNote: 'Met Elrond, Frodo en Arwen.',
          },
          {
            id: '76269',
            priceContext: {
              coverageLabel: 'Op voorraad · 3 winkels nagekeken',
              currentPrice: '€ 479,99',
              merchantLabel: 'Nu het laagst bij bol',
              pricePositionLabel: '€ 30,00 onder normaal',
              reviewedLabel: 'Nagekeken 2 apr',
            },
            setSummary: {
              id: '76269',
              slug: 'avengers-tower-76269',
              name: 'Avengers Tower',
              theme: 'Marvel',
              releaseYear: 2023,
              pieces: 5202,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/76269-1/124122.jpg',
              collectorAngle: 'Een skyline-set die meteen herkenbaar is.',
              tagline: 'Als je Marvel groot wilt neerzetten, pak je deze.',
              availability: 'Stabiel met sterke seizoensvraag',
            },
            supportingNote: 'Met Iron Man, Captain America en Thor.',
          },
          {
            id: '21348',
            setSummary: {
              id: '21348',
              slug: 'dungeons-and-dragons-red-dragons-tale-21348',
              name: "Dungeons & Dragons: Red Dragon's Tale",
              theme: 'Ideas',
              releaseYear: 2024,
              pieces: 3747,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/21348-1/166370.jpg',
              collectorAngle: 'De draak en herberg trekken meteen aandacht.',
              tagline: 'Kies deze als je fantasy en minifiguren samen wilt.',
              availability: 'Sterke start voor een Ideas-set',
            },
            supportingNote: 'Met een volle party en veel speelhoeken.',
          },
          {
            id: '75331',
            setSummary: {
              id: '75331',
              slug: 'the-razor-crest-75331',
              name: 'The Razor Crest',
              theme: 'Star Wars',
              releaseYear: 2022,
              pieces: 6187,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/75331-1/116601.jpg',
              collectorAngle: 'Een groot schip dat je plank meteen vult.',
              tagline:
                'Als je een premium Star Wars-schip zoekt, kijk hier eerst.',
              availability: 'Prijscontext volgt later',
            },
            supportingNote: 'Met Grogu en The Mandalorian.',
          },
          {
            id: '76417',
            setSummary: {
              id: '76417',
              slug: 'gringotts-wizarding-bank-collectors-edition-76417',
              name: "Gringotts Wizarding Bank - Collectors' Edition",
              theme: 'Harry Potter',
              releaseYear: 2023,
              pieces: 4803,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/76417-1/126166.jpg',
              collectorAngle: 'De bank en draak trekken je plank meteen open.',
              tagline:
                'Kies deze als je een grote Wizarding World-set wilt neerzetten.',
              availability: 'Sterke franchisevraag',
            },
            supportingNote: 'Met Harry, Hermione en Ron.',
          },
        ]}
        variant="featured"
      />
    </div>
  ),
};

export const CompactRail: Story = {
  render: () => (
    <div style={{ margin: '0 auto', maxWidth: '72rem', padding: '1.5rem' }}>
      <CatalogSetCardRail
        ariaLabel="Compacte setrail"
        items={[
          {
            id: '75331',
            setSummary: {
              id: '75331',
              slug: 'the-razor-crest-75331',
              name: 'The Razor Crest',
              theme: 'Star Wars',
              releaseYear: 2022,
              pieces: 6187,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/75331-1/116601.jpg',
              collectorAngle: 'Een groot schip dat je plank meteen vult.',
              tagline:
                'Als je een premium Star Wars-schip zoekt, kijk hier eerst.',
              availability: 'Prijscontext volgt later',
            },
            supportingNote: 'Met Grogu en The Mandalorian.',
          },
          {
            id: '76417',
            setSummary: {
              id: '76417',
              slug: 'gringotts-wizarding-bank-collectors-edition-76417',
              name: "Gringotts Wizarding Bank - Collectors' Edition",
              theme: 'Harry Potter',
              releaseYear: 2023,
              pieces: 4803,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/76417-1/126166.jpg',
              collectorAngle: 'De bank en draak trekken je plank meteen open.',
              tagline:
                'Kies deze als je een grote Wizarding World-set wilt neerzetten.',
              availability: 'Sterke franchisevraag',
            },
            supportingNote: 'Met Harry, Hermione en Ron.',
          },
          {
            id: '76294',
            setSummary: {
              id: '76294',
              slug: 'the-x-mansion-76294',
              name: 'The X-Mansion',
              theme: 'Marvel',
              releaseYear: 2024,
              pieces: 3093,
              imageUrl:
                'https://cdn.rebrickable.com/media/sets/76294-1/172998.jpg',
              collectorAngle: 'De school en cast maken dit meteen herkenbaar.',
              tagline:
                'Pak deze als je Marvel liever als gebouw dan als schip zet.',
              availability: 'Frisse flagship-aandacht',
            },
            supportingNote: 'Met Wolverine, Professor X en Rogue.',
          },
        ]}
        variant="compact"
      />
    </div>
  ),
};
