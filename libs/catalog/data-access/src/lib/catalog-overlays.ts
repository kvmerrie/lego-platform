import { CatalogSetOverlay } from '@lego-platform/catalog/util';

// Transitional presentation overrides only.
// This file no longer acts as the authoritative source for catalog identity,
// slugs, names, or theme assignment. Those move through the canonical
// Supabase-first catalog model.
//
// What still belongs here for now:
// - product-facing display overrides that have not been migrated yet
// - richer gallery/media choices for snapshot-backed set detail pages
// - theme presentation hints that older snapshot-first read models still use
//
// What does not belong here anymore:
// - per-set identity truth
// - primary theme truth
// - broad editorial/product copy
//
// If a set does not need a real display/media/factual fallback, it should not
// have an entry in this file.

export const catalogSetOverlays: readonly CatalogSetOverlay[] = [
  {
    canonicalId: '10316',
    productSlug: 'rivendell-10316',
    displayName: 'Rivendell',
    images: [
      {
        order: 0,
        type: 'hero',
        url: 'https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg',
      },
      {
        order: 1,
        type: 'detail',
        url: 'https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/1200x1184.jpg',
      },
      {
        order: 2,
        type: 'detail',
        url: 'https://media.s-bol.com/4qw0JDX60Dk6/Bw6wXx/1200x1200.jpg',
      },
      {
        order: 3,
        type: 'detail',
        url: 'https://media.s-bol.com/v0Wyx33XyDwr/mw9ZqlA/1200x675.jpg',
      },
      {
        order: 4,
        type: 'detail',
        url: 'https://media.s-bol.com/q5RXOnZBx4Nk/4n6WP7/1200x796.jpg',
      },
      {
        order: 5,
        type: 'detail',
        url: 'https://media.s-bol.com/8J2j151ADpL5/Q1469Bl/1200x800.jpg',
      },
    ],
    primaryImage: 'https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg',
    minifigureCount: 15,
    recommendedAge: 18,
    displaySize: {
      value: '72 × 50 × 39 cm',
    },
  },
  {
    canonicalId: '21348',
    displayTheme: 'Ideas',
    minifigureCount: 6,
    recommendedAge: 18,
  },
  {
    canonicalId: '76269',
    displayTheme: 'Marvel',
    minifigureCount: 31,
    recommendedAge: 18,
    displaySize: {
      label: 'Hoogte',
      value: '90 cm',
    },
    setStatus: 'backorder',
    subtheme: 'Avengers',
  },
  {
    canonicalId: '10305',
    minifigureCount: 22,
    recommendedAge: 18,
    displaySize: {
      label: 'Hoogte',
      value: '38 cm',
    },
  },
  {
    canonicalId: '21338',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '10320',
    minifigureCount: 8,
  },
  {
    canonicalId: '21335',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '10333',
    minifigureCount: 10,
    recommendedAge: 18,
    displaySize: {
      label: 'Hoogte',
      value: '83 cm',
    },
  },
  {
    canonicalId: '10332',
    minifigureCount: 8,
    recommendedAge: 18,
  },
  {
    canonicalId: '21333',
    productSlug: 'vincent-van-gogh-the-starry-night-21333',
    displayName: 'Vincent van Gogh - The Starry Night',
    displayTheme: 'Ideas',
    minifigureCount: 1,
    recommendedAge: 18,
  },
  {
    canonicalId: '21342',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '10318',
    recommendedAge: 18,
    displaySize: {
      value: '105 cm lang · 15 cm hoog',
    },
  },
  {
    canonicalId: '10341',
    recommendedAge: 18,
  },
  {
    canonicalId: '21349',
    displayTheme: 'Ideas',
    recommendedAge: 18,
  },
  {
    canonicalId: '10294',
    recommendedAge: 18,
    displaySize: {
      value: '135 cm lang',
    },
  },
  {
    canonicalId: '31208',
    displayTheme: 'Art',
  },
  {
    canonicalId: '75313',
    displayTheme: 'Star Wars',
    minifigureCount: 9,
    minifigureHighlights: [
      'Luke Skywalker',
      'General Veers',
      'Snowtrooper Commander',
    ],
  },
  {
    canonicalId: '21345',
    productSlug: 'polaroid-onestep-sx-70-camera-21345',
    displayName: 'Polaroid OneStep SX-70 Camera',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '10326',
    displayTheme: 'Modular Buildings',
    minifigureCount: 7,
    setStatus: 'available',
    subtheme: 'Modular Buildings',
  },
  {
    canonicalId: '10323',
    displayName: 'PAC-MAN Arcade',
  },
  {
    canonicalId: '10280',
    displayTheme: 'Botanicals',
  },
  {
    canonicalId: '10311',
    displayTheme: 'Botanicals',
  },
  {
    canonicalId: '21327',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '21343',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '42115',
    displayTheme: 'Technic',
  },
  {
    canonicalId: '42143',
    displayTheme: 'Technic',
  },
  {
    canonicalId: '71411',
    displayTheme: 'Super Mario',
  },
  {
    canonicalId: '71741',
    displayTheme: 'NINJAGO',
  },
  {
    canonicalId: '76218',
    displayTheme: 'Marvel',
    minifigureCount: 9,
    setStatus: 'retired',
    subtheme: 'Doctor Strange',
  },
  {
    canonicalId: '76956',
    displayTheme: 'Jurassic World',
  },
  {
    canonicalId: '75331',
    displayTheme: 'Star Wars',
    minifigureCount: 5,
    minifigureHighlights: ['The Mandalorian', 'Grogu', 'Kuiil', 'The Mythrol'],
    setStatus: 'retiring_soon',
    subtheme: 'Ultimate Collector Series',
  },
  {
    canonicalId: '76417',
    displayTheme: 'Harry Potter',
    minifigureCount: 13,
    recommendedAge: 18,
    minifigureHighlights: [
      'Harry Potter',
      'Hermione Granger',
      'Ron Weasley',
      'Griphook',
      'Hagrid',
    ],
    setStatus: 'backorder',
    subtheme: 'Diagon Alley',
  },
  {
    canonicalId: '76178',
    displayTheme: 'Marvel',
    minifigureCount: 25,
    recommendedAge: 18,
    minifigureHighlights: [
      'Spider-Man',
      'Green Goblin',
      'Daredevil',
      'J. Jonah Jameson',
      'Aunt May',
    ],
    setStatus: 'retired',
    subtheme: 'Spider-Man',
  },
  {
    canonicalId: '75367',
    displayTheme: 'Star Wars',
    minifigureCount: 2,
    subtheme: 'Ultimate Collector Series',
  },
  {
    canonicalId: '21350',
    displayTheme: 'Ideas',
  },
  {
    canonicalId: '76437',
    displayTheme: 'Harry Potter',
    minifigureCount: 10,
    minifigureHighlights: [
      'Arthur Weasley',
      'Molly Weasley',
      'Ron Weasley',
      'Ginny Weasley',
      'Harry Potter',
    ],
    setStatus: 'available',
    subtheme: 'Wizarding homes',
  },
  {
    canonicalId: '75355',
    displayTheme: 'Star Wars',
    minifigureCount: 2,
    minifigureHighlights: ['Luke Skywalker', 'R2-D2'],
    setStatus: 'retiring_soon',
    subtheme: 'Ultimate Collector Series',
  },
  {
    canonicalId: '75397',
    displayTheme: 'Star Wars',
    minifigureCount: 11,
    minifigureHighlights: [
      'Jabba the Hutt',
      'Princess Leia',
      'Bib Fortuna',
      'Max Rebo',
      'C-3PO',
    ],
    setStatus: 'available',
    subtheme: 'Return of the Jedi',
  },
  {
    canonicalId: '76429',
    displayTheme: 'Harry Potter',
  },
  {
    canonicalId: '76435',
    displayTheme: 'Harry Potter',
  },
  {
    canonicalId: '76294',
    displayTheme: 'Marvel',
    minifigureCount: 10,
    minifigureHighlights: [
      'Wolverine',
      'Professor X',
      'Storm',
      'Cyclops',
      'Magneto',
    ],
    subtheme: 'X-Men',
  },
  {
    canonicalId: '42171',
    displayTheme: 'Technic',
  },
  {
    canonicalId: '42172',
    displayTheme: 'Technic',
  },
  {
    canonicalId: '10328',
    displayTheme: 'Botanicals',
  },
  {
    canonicalId: '75398',
    displayTheme: 'Star Wars',
    minifigureCount: 1,
    minifigureHighlights: ['C-3PO'],
    subtheme: 'Droid display',
  },
  {
    canonicalId: '76453',
    displayTheme: 'Harry Potter',
    minifigureCount: 9,
    minifigureHighlights: [
      'Lucius Malfoy',
      'Narcissa Malfoy',
      'Bellatrix Lestrange',
      'Hermione Granger',
      'Dobby',
    ],
    subtheme: 'Deathly Hallows',
  },
  {
    canonicalId: '76313',
    displayTheme: 'Marvel',
    minifigureCount: 5,
    minifigureHighlights: [
      'Iron Man',
      'Captain America',
      'Thor',
      'Hulk',
      'Black Widow',
    ],
    subtheme: 'Marvel display',
  },
  {
    canonicalId: '10354',
    displayTheme: 'Icons',
    minifigureCount: 9,
    minifigureHighlights: [
      'Bilbo Baggins',
      'Frodo Baggins',
      'Samwise Gamgee',
      'Gandalf',
      'Rosie Cotton',
    ],
    subtheme: 'The Lord of the Rings',
  },
  {
    canonicalId: '42177',
    displayTheme: 'Technic',
    subtheme: 'Licensed vehicles',
  },
  {
    canonicalId: '10342',
    displayTheme: 'Botanicals',
    subtheme: 'Flower Collection',
  },
];
