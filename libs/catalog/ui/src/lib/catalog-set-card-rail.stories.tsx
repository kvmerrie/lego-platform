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
        ariaLabel="Featured rail"
        items={[
          {
            id: '10316',
            priceContext: {
              coverageLabel: 'In stock · 2 reviewed offers',
              currentPrice: 'EUR 469.99',
              merchantLabel: 'Lowest reviewed price at LEGO',
              pricePositionLabel: 'EUR 20.00 below reference',
              reviewedLabel: 'Checked 2 apr',
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
              priceRange: '$449 to $519',
              collectorAngle: 'Prestige fantasy display anchor',
              tagline:
                'A flagship fantasy build that rewards both display space and patience.',
              availability: 'Healthy premium availability',
            },
            supportingNote: 'Includes Elrond, Frodo Baggins, and Arwen',
          },
          {
            id: '76269',
            priceContext: {
              coverageLabel: 'In stock · 3 reviewed offers',
              currentPrice: 'EUR 479.99',
              merchantLabel: 'Lowest reviewed price at bol',
              pricePositionLabel: 'EUR 30.00 below reference',
              reviewedLabel: 'Checked 2 apr',
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
              priceRange: '$449 to $519',
              collectorAngle: 'Marvel flagship showcase',
              tagline:
                'A marquee licensed set with broad household recognizability.',
              availability: 'Stable with strong seasonal demand',
            },
            supportingNote: 'Includes Iron Man, Captain America, and Thor',
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
              priceRange: '$359 to $409',
              collectorAngle: 'Crossover audience magnet',
              tagline:
                'A community-driven release with rich minifigure storytelling hooks.',
              availability: 'Strong launch momentum',
            },
            supportingNote: 'Set page is live.',
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
              priceRange: '$479 to $599',
              collectorAngle: 'Original trilogy-adjacent prestige build',
              tagline:
                'A large ship build with stronger emotional pull than a generic fleet piece.',
              availability: 'Reviewed pricing not published yet',
            },
            supportingNote: 'Includes Grogu and The Mandalorian',
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
              priceRange: '$369 to $449',
              collectorAngle: 'Wizarding World premium landmark',
              tagline:
                'A major Gringotts display build with strong franchise recognition.',
              availability: 'High-visibility franchise demand',
            },
            supportingNote:
              'Includes Harry Potter, Hermione Granger, and Ron Weasley',
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
        ariaLabel="Compact rail"
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
              priceRange: '$479 to $599',
              collectorAngle: 'Original trilogy-adjacent prestige build',
              tagline:
                'A large ship build with stronger emotional pull than a generic fleet piece.',
              availability: 'Reviewed pricing not published yet',
            },
            supportingNote: 'Includes Grogu and The Mandalorian',
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
              priceRange: '$369 to $449',
              collectorAngle: 'Wizarding World premium landmark',
              tagline:
                'A major Gringotts display build with strong franchise recognition.',
              availability: 'High-visibility franchise demand',
            },
            supportingNote:
              'Includes Harry Potter, Hermione Granger, and Ron Weasley',
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
              priceRange: '$279 to $339',
              collectorAngle: 'Mutant-team display anchor',
              tagline:
                'A franchise landmark with strong cast recognition and shelf presence.',
              availability: 'Fresh flagship demand',
            },
            supportingNote: 'Includes Wolverine, Professor X, and Rogue',
          },
        ]}
        variant="compact"
      />
    </div>
  ),
};
