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
  {
    canonicalId: '10305',
    priceRange: '$359 to $429',
    collectorAngle: 'Castle nostalgia tentpole',
    tagline:
      'A modern fortress build that lands squarely at the intersection of nostalgia and display value.',
    availability: 'Steady premium demand',
    collectorHighlights: [
      'Strong crossover appeal between adult nostalgia and fantasy display buyers',
      'High perceived value thanks to dense build volume and minifigure count',
      'Excellent anchor set for long-form editorial and collection storytelling',
    ],
  },
  {
    canonicalId: '21338',
    displayTheme: 'Ideas',
    priceRange: '$179 to $239',
    collectorAngle: 'Cabin-core conversation piece',
    tagline:
      'A warmly detailed display set with broad shelf appeal beyond traditional franchise collectors.',
    availability: 'Consistent enthusiast pull',
    collectorHighlights: [
      'Display-friendly footprint with strong giftability and crossover appeal',
      'Distinct silhouette helps diversify a curated premium set assortment',
      'Useful test case for editorial storytelling beyond licensed fandoms',
    ],
  },
  {
    canonicalId: '10320',
    priceRange: '$189 to $259',
    collectorAngle: 'Pirates nostalgia centerpiece',
    tagline:
      'A reconfigurable fortress throwback that lands as both a nostalgia play and a shelf-friendly adventure display.',
    availability: 'Measured enthusiast demand',
    collectorHighlights: [
      'Strong adult nostalgia pull without relying on a licensed franchise',
      'Modular island layout makes it easier to photograph, restyle, and merchandise',
      'Useful bridge set between display collectors and classic play-theme fans',
    ],
  },
  {
    canonicalId: '21335',
    displayTheme: 'Ideas',
    priceRange: '$259 to $319',
    collectorAngle: 'Kinetic display standout',
    tagline:
      'A mechanically animated coastal build that feels equally at home in premium display shelves and gift-led collector curation.',
    availability: 'Selective premium availability',
    collectorHighlights: [
      'Motorized light and rotating beacon create stronger live display presence than most static shelf pieces',
      'Distinct silhouette broadens the curated assortment beyond castles, cabins, and towers',
      'Good candidate for editorial storytelling around function-first collector design',
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
