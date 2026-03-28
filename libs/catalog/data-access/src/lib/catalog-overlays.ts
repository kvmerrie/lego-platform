import {
  CatalogSetOverlay,
  CatalogThemeOverlay,
} from '@lego-platform/catalog/util';

export const catalogSetOverlays: readonly CatalogSetOverlay[] = [
  {
    canonicalId: '10316',
    productSlug: 'rivendell-10316',
    displayName: 'Rivendell',
    priceRange: '$499 to $569',
    collectorAngle: 'Prestige display anchor',
    tagline:
      'A flagship fantasy build that rewards both display space and patience.',
    availability: 'Healthy but premium availability',
    collectorHighlights: [
      'Three-story scene composition with strong shelf presence',
      'Long-term display value thanks to cross-fandom appeal',
      'Excellent candidate for future editorial storytelling',
    ],
  },
  {
    canonicalId: '21348',
    displayTheme: 'Ideas',
    priceRange: '$359 to $409',
    collectorAngle: 'Crossover audience magnet',
    tagline:
      'A community-driven release with rich minifigure storytelling hooks.',
    availability: 'Strong launch momentum',
    collectorHighlights: [
      'Cross-category appeal for both LEGO and tabletop audiences',
      'Excellent lore density for content merchandising',
      'Healthy candidate for future affiliate experimentation',
    ],
  },
  {
    canonicalId: '76269',
    displayTheme: 'Marvel',
    priceRange: '$449 to $519',
    collectorAngle: 'Marvel flagship showcase',
    tagline: 'A marquee licensed set with broad household recognizability.',
    availability: 'Stable with strong seasonal demand',
    collectorHighlights: [
      'Broad market liquidity compared with niche premium sets',
      'Works well in collection and pricing narratives',
      'Good test case for franchise-driven merchandising',
    ],
  },
];

export const catalogThemeOverlays: readonly CatalogThemeOverlay[] = [
  {
    name: 'Icons',
    setCount: 14,
    momentum:
      'Premium collectors are consolidating around large display pieces.',
    signatureSet: 'Rivendell',
  },
  {
    name: 'Ideas',
    setCount: 11,
    momentum:
      'Community-voted launches continue to produce sharp launch-week demand.',
    signatureSet: "Dungeons & Dragons: Red Dragon's Tale",
  },
  {
    name: 'Marvel',
    setCount: 23,
    momentum:
      'Licensed tentpoles keep price visibility high and affiliate conversion strong.',
    signatureSet: 'Avengers Tower',
  },
];
