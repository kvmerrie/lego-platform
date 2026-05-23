export const catalogCollectionLandingPageSortKeys = [
  'recommended',
  'price-asc',
  'newest',
  'pieces-desc',
] as const;

export type CatalogCollectionLandingPageSortKey =
  (typeof catalogCollectionLandingPageSortKeys)[number];

export interface CatalogCollectionLandingPageFilterConfig {
  adultCollector?: boolean;
  maxBestPriceMinor?: number;
  recentRelease?: boolean;
  setStatuses?: readonly (
    | 'available'
    | 'backorder'
    | 'retiring_soon'
    | 'retired'
  )[];
  themeSlugs?: readonly string[];
}

export interface CatalogCollectionLandingPageLinkConfig {
  href: string;
  label: string;
}

export interface CatalogCollectionLandingPageConfig {
  browseDescription: string;
  browseEyebrow: string;
  browseTitle: string;
  canonicalPath: string;
  description: string;
  filters: CatalogCollectionLandingPageFilterConfig;
  h1: string;
  intro: string;
  links: {
    relatedPages?: readonly string[];
    themes?: readonly CatalogCollectionLandingPageLinkConfig[];
  };
  metaDescription: string;
  metaTitle: string;
  redirectPath?: string;
  signalLabel: string;
  slug: string;
  sort: {
    default: CatalogCollectionLandingPageSortKey;
    options: readonly CatalogCollectionLandingPageSortKey[];
  };
}

export const catalogCollectionLandingPageConfigs = [
  {
    slug: 'lego-sets-onder-50-euro',
    canonicalPath: '/lego-sets-onder-50-euro',
    h1: 'LEGO sets onder 50 euro',
    intro:
      'Kies hier compacte dozen die wél iets doen op je plank. Denk aan Speed Champions-auto’s, kleine Star Wars-builds en Botanicals die makkelijk cadeau kunnen.',
    description:
      'Betaalbare LEGO keuzes met actuele prijsdekking, gesorteerd voor snel vergelijken.',
    metaTitle: 'LEGO sets onder 50 euro | Brickhunt',
    metaDescription:
      'Bekijk LEGO sets onder 50 euro met actuele prijzen, thema-links en snelle doorkliks naar de beste dozen.',
    browseEyebrow: 'Slim kiezen',
    browseTitle: 'Sets die onder 50 euro blijven',
    browseDescription:
      'Begin met sets die meteen herkenbaar zijn: een starfighter, racewagen of kleine displaybouw die niet je hele budget pakt.',
    signalLabel: 'sets onder 50 euro',
    filters: {
      maxBestPriceMinor: 5_000,
    },
    sort: {
      default: 'price-asc',
      options: ['price-asc', 'newest', 'pieces-desc'],
    },
    links: {
      themes: [
        { href: '/themes/speed-champions', label: 'Speed Champions' },
        { href: '/themes/star-wars', label: 'Star Wars' },
        { href: '/themes/botanicals', label: 'Botanicals' },
      ],
      relatedPages: ['lego-sets-onder-100-euro', 'nieuwe-lego-sets'],
    },
  },
  {
    slug: 'lego-sets-onder-100-euro',
    canonicalPath: '/lego-sets-onder-100-euro',
    h1: 'LEGO sets onder 100 euro',
    intro:
      'Hier zitten de sets waar je al echt iets neerzet: een herkenbaar schip, een gebouw met details of een displaystuk dat niet meteen richting topprijs gaat.',
    description:
      'LEGO sets onder 100 euro met actuele prijsfilters en links naar relevante thema’s.',
    metaTitle: 'LEGO sets onder 100 euro | Brickhunt',
    metaDescription:
      'Vind LEGO sets onder 100 euro en vergelijk actuele prijzen, thema’s en populaire keuzes.',
    browseEyebrow: 'Meer bouw voor je budget',
    browseTitle: 'Goede keuzes tot 100 euro',
    browseDescription:
      'Kijk vooral naar sets met een duidelijk hoofdmodel: die blijven op een plank interessanter dan losse kleine builds.',
    signalLabel: 'sets onder 100 euro',
    filters: {
      maxBestPriceMinor: 10_000,
    },
    sort: {
      default: 'recommended',
      options: ['recommended', 'price-asc', 'newest', 'pieces-desc'],
    },
    links: {
      themes: [
        { href: '/themes/icons', label: 'Icons' },
        { href: '/themes/star-wars', label: 'Star Wars' },
        { href: '/themes/harry-potter', label: 'Harry Potter' },
      ],
      relatedPages: ['lego-sets-onder-50-euro', 'lego-voor-volwassenen'],
    },
  },
  {
    slug: 'nieuwe-lego-sets',
    canonicalPath: '/nieuwe-lego-sets',
    h1: 'Nieuwe LEGO sets',
    intro:
      'Nieuw binnen en meteen het bekijken waard. Hier vind je releases met herkenbare scènes, voertuigen en displaymodellen voordat ze tussen de rest verdwijnen.',
    description:
      'Nieuwe LEGO sets, server-side geselecteerd uit catalogusdata en release-informatie.',
    metaTitle: 'Nieuwe LEGO sets | Brickhunt',
    metaDescription:
      'Bekijk nieuwe LEGO sets met release-informatie, thema-links en directe setpagina’s.',
    browseEyebrow: 'Net uit',
    browseTitle: 'Nieuwe dozen om nu te bekijken',
    browseDescription:
      'Kies deze lijst als je wilt zien welke builds net zijn toegevoegd of rond deze periode uitkomen.',
    signalLabel: 'nieuwe sets',
    filters: {
      recentRelease: true,
    },
    sort: {
      default: 'newest',
      options: ['newest', 'recommended', 'pieces-desc'],
    },
    links: {
      themes: [
        { href: '/themes/icons', label: 'Icons' },
        { href: '/themes/star-wars', label: 'Star Wars' },
        { href: '/themes/technic', label: 'Technic' },
      ],
      relatedPages: ['lego-sets-onder-100-euro', 'retiring-lego-sets'],
    },
  },
  {
    slug: 'lego-voor-volwassenen',
    canonicalPath: '/lego-voor-volwassenen',
    h1: 'LEGO voor volwassenen',
    intro:
      'Displaysets, grote gebouwen en modellen waar je langer naar blijft kijken. Kies hier als Rivendell, modulaire panden of Technic-supercars beter bij je plank passen.',
    description:
      'Collectorgerichte LEGO sets voor volwassenen, gekozen op leeftijdssignalen, thema en displaywaarde.',
    metaTitle: 'LEGO voor volwassenen | Brickhunt',
    metaDescription:
      'Ontdek LEGO voor volwassenen: displaysets, Icons, Ideas, Architecture en grote bouwprojecten.',
    browseEyebrow: 'Voor op de plank',
    browseTitle: 'Sets die als displaystuk werken',
    browseDescription:
      'Let op vorm, hoogte en herkenbaarheid. Dat bepaalt of een set na het bouwen blijft trekken.',
    signalLabel: 'collector sets',
    filters: {
      adultCollector: true,
    },
    sort: {
      default: 'recommended',
      options: ['recommended', 'pieces-desc', 'newest'],
    },
    links: {
      themes: [
        { href: '/themes/icons', label: 'Icons' },
        { href: '/themes/ideas', label: 'Ideas' },
        { href: '/themes/architecture', label: 'Architecture' },
      ],
      relatedPages: ['lego-sets-onder-100-euro', 'retiring-lego-sets'],
    },
  },
  {
    slug: 'lego-star-wars-sets',
    canonicalPath: '/lego-star-wars-sets',
    h1: 'LEGO Star Wars sets',
    intro:
      'Van starfighters tot UCS-modellen: hier kijk je als je schepen, droids en minifiguren zoekt die meteen Star Wars roepen.',
    description:
      'LEGO Star Wars discovery page met catalogussets, theme-linking en set detail links.',
    metaTitle: 'LEGO Star Wars sets | Brickhunt',
    metaDescription:
      'Bekijk LEGO Star Wars sets, van starfighters tot displaymodellen, met directe links naar setpagina’s.',
    redirectPath: '/themes/star-wars',
    browseEyebrow: 'Galaxy bouwen',
    browseTitle: 'Star Wars sets om te vergelijken',
    browseDescription:
      'Kies op wat je verzameling mist: een herkenbaar schip, een sterke minifigure-line-up of een groot displaymodel.',
    signalLabel: 'Star Wars sets',
    filters: {
      themeSlugs: ['star-wars'],
    },
    sort: {
      default: 'recommended',
      options: ['recommended', 'newest', 'pieces-desc'],
    },
    links: {
      themes: [{ href: '/themes/star-wars', label: 'Star Wars thema' }],
      relatedPages: ['lego-voor-volwassenen', 'retiring-lego-sets'],
    },
  },
  {
    slug: 'retiring-lego-sets',
    canonicalPath: '/retiring-lego-sets',
    h1: 'LEGO sets die binnenkort verdwijnen',
    intro:
      'Sets die je niet te lang wilt laten liggen. Kijk vooral naar grote displaymodellen, Star Wars-schepen en populaire thema’s voordat prijzen onrustig worden.',
    description:
      'LEGO sets die richting uitverkocht of retired gaan, met directe links naar de setpagina’s.',
    metaTitle: 'LEGO sets die binnenkort verdwijnen | Brickhunt',
    metaDescription:
      'Bekijk LEGO sets die binnenkort verdwijnen en beslis welke dozen je niet te lang wilt uitstellen.',
    browseEyebrow: 'Niet laten liggen',
    browseTitle: 'Sets om nu te checken',
    browseDescription:
      'Als je er één wilt hebben voor je collectie, wacht dan vooral niet tot hij overal uitverkocht raakt.',
    signalLabel: 'retiring sets',
    filters: {
      setStatuses: ['retiring_soon', 'retired'],
    },
    sort: {
      default: 'recommended',
      options: ['recommended', 'pieces-desc', 'newest'],
    },
    links: {
      themes: [
        { href: '/themes/icons', label: 'Icons' },
        { href: '/themes/star-wars', label: 'Star Wars' },
        { href: '/themes/ideas', label: 'Ideas' },
      ],
      relatedPages: ['nieuwe-lego-sets', 'lego-voor-volwassenen'],
    },
  },
] as const satisfies readonly CatalogCollectionLandingPageConfig[];

export type CatalogCollectionLandingPageSlug =
  (typeof catalogCollectionLandingPageConfigs)[number]['slug'];

export function listCatalogCollectionLandingPageConfigs(): readonly CatalogCollectionLandingPageConfig[] {
  return catalogCollectionLandingPageConfigs;
}

export function listIndexableCatalogCollectionLandingPageConfigs(): readonly CatalogCollectionLandingPageConfig[] {
  const configs: readonly CatalogCollectionLandingPageConfig[] =
    catalogCollectionLandingPageConfigs;

  return configs.filter((config) => !config.redirectPath);
}

export function getCatalogCollectionLandingPageConfig(
  slug: string,
): CatalogCollectionLandingPageConfig | undefined {
  return catalogCollectionLandingPageConfigs.find(
    (config) => config.slug === slug,
  );
}

export function normalizeCatalogCollectionLandingPageSortKey({
  config,
  value,
}: {
  config: CatalogCollectionLandingPageConfig;
  value?: string;
}): CatalogCollectionLandingPageSortKey {
  return config.sort.options.includes(
    value as CatalogCollectionLandingPageSortKey,
  )
    ? (value as CatalogCollectionLandingPageSortKey)
    : config.sort.default;
}
