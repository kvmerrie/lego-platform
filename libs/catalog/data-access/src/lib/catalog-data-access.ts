import {
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';

const catalogSetDetails: readonly CatalogSetDetail[] = [
  {
    id: '10316',
    slug: 'rivendell-10316',
    name: 'Rivendell',
    theme: 'Icons',
    releaseYear: 2023,
    pieces: 6167,
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
    id: '21348',
    slug: 'dungeons-and-dragons-red-dragons-tale-21348',
    name: "Dungeons & Dragons: Red Dragon's Tale",
    theme: 'Ideas',
    releaseYear: 2024,
    pieces: 3745,
    priceRange: '$359 to $409',
    collectorAngle: 'Crossover audience magnet',
    tagline:
      'A community-driven release with rich minifigure storytelling hooks.',
    availability: 'Strong launch momentum',
    collectorHighlights: [
      'Cross-category appeal for both LEGO and tabletop audiences',
      'Excellent lore density for content merchandising',
      'Healthy candidate for affiliate experimentation',
    ],
  },
  {
    id: '76269',
    slug: 'avengers-tower-76269',
    name: 'Avengers Tower',
    theme: 'Marvel',
    releaseYear: 2023,
    pieces: 5201,
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

const catalogThemeSnapshots: readonly CatalogThemeSnapshot[] = [
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

export function listCatalogSetSummaries(): CatalogSetSummary[] {
  return sortCatalogSetSummaries(
    catalogSetDetails.map((catalogSetDetail) => ({
      id: catalogSetDetail.id,
      slug: catalogSetDetail.slug,
      name: catalogSetDetail.name,
      theme: catalogSetDetail.theme,
      releaseYear: catalogSetDetail.releaseYear,
      pieces: catalogSetDetail.pieces,
      priceRange: catalogSetDetail.priceRange,
      collectorAngle: catalogSetDetail.collectorAngle,
    })),
  );
}

export function getFeaturedCatalogSet(): CatalogSetDetail {
  return catalogSetDetails[0];
}

export function getCatalogSetDetail(
  slug: string,
): CatalogSetDetail | undefined {
  return catalogSetDetails.find(
    (catalogSetDetail) => catalogSetDetail.slug === slug,
  );
}

export function listCatalogThemes(): CatalogThemeSnapshot[] {
  return [...catalogThemeSnapshots];
}
