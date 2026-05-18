export interface BrickhuntThemeRegistryEntry {
  key: string;
  displayName: string;
  legoDisplayName?: string;
  aliases: readonly string[];
  parentThemeKey?: string;
}

export interface ThemeNormalizationContext {
  id?: string;
  parentTheme?: string;
  parentThemeId?: string;
  slug?: string;
  setId?: string;
  setNumber?: string;
  sourceSetNumber?: string;
  name?: string;
  theme?: string;
  secondaryLabels?: readonly string[];
}

type ThemeSortable =
  | string
  | {
      key?: string;
      name?: string;
      displayName?: string;
      theme?: string;
      themeSnapshot?: {
        name: string;
        setCount?: number;
      };
    };

const utilityThemeNames = new Set([
  'books',
  'bricklink designer program',
  'gear',
  'powered up',
  'serious play',
]);

const parentGroupingThemeNames = new Set([
  ...utilityThemeNames,
  'city',
  'dc',
  'disney',
  'duplo',
  'icons',
  'marvel',
  'star wars',
]);

function normalizeRegistryText(value: string): string {
  return value
    .replace(/[®™]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildThemeKey(displayName: string): string {
  return normalizeRegistryText(displayName)
    .replace(/^lego /, '')
    .replace(/\s+speelgoed en sets$/u, '')
    .replace(/\s+collectie$/u, '')
    .replace(/\s+/g, '-');
}

function hasCityAdventContext(context?: ThemeNormalizationContext): boolean {
  const values = [
    context?.id,
    context?.parentTheme,
    context?.parentThemeId,
    context?.setId,
    context?.setNumber,
    context?.sourceSetNumber,
    context?.name,
    context?.slug,
    context?.theme,
    context?.setId,
    context?.setNumber,
    context?.sourceSetNumber,
    ...(context?.secondaryLabels ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedContext = normalizeRegistryText(values);

  return (
    normalizedContext.includes('60510') ||
    (normalizedContext.includes('city') &&
      (normalizedContext.includes('advent calendar') ||
        normalizedContext.includes('advent')))
  );
}

function hasLordOfTheRingsSetContext(
  context?: ThemeNormalizationContext,
): boolean {
  const values = [
    context?.name,
    context?.slug,
    context?.theme,
    context?.setId,
    context?.setNumber,
    context?.sourceSetNumber,
    ...(context?.secondaryLabels ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedContext = normalizeRegistryText(values);

  return (
    normalizedContext.includes('lord of the rings') ||
    /\blotr\b/u.test(normalizedContext)
  );
}

function inferThemeFromContext(
  context?: ThemeNormalizationContext,
): BrickhuntThemeRegistryEntry | undefined {
  const values = [
    context?.id,
    context?.name,
    context?.slug,
    context?.setId,
    context?.setNumber,
    context?.sourceSetNumber,
    context?.theme,
    ...(context?.secondaryLabels ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedContext = normalizeRegistryText(values);

  if (!normalizedContext) {
    return undefined;
  }

  if (
    normalizedContext.includes('speed champions') ||
    normalizedContext.includes('formula 1') ||
    /\bf1\b/u.test(normalizedContext) ||
    normalizedContext.includes('lewis hamilton') ||
    normalizedContext.includes('piastri') ||
    normalizedContext.includes('norris') ||
    normalizedContext.includes('mclaren') ||
    normalizedContext.includes('ferrari') ||
    normalizedContext.includes('mercedes amg') ||
    normalizedContext.includes('williams racing')
  ) {
    return normalizeTheme('Speed Champions');
  }

  if (
    normalizedContext.includes('technic') ||
    normalizedContext.includes('bugatti') ||
    normalizedContext.includes('lamborghini') ||
    normalizedContext.includes('koenigsegg')
  ) {
    return normalizeTheme('Technic');
  }

  return undefined;
}

function createThemeOverride({
  aliases = [],
  displayName,
  key = buildThemeKey(displayName),
  legoDisplayName,
  parentThemeKey,
}: Pick<BrickhuntThemeRegistryEntry, 'displayName'> &
  Partial<
    Omit<BrickhuntThemeRegistryEntry, 'displayName'>
  >): BrickhuntThemeRegistryEntry {
  return {
    key,
    displayName,
    ...(legoDisplayName ? { legoDisplayName } : {}),
    aliases,
    ...(parentThemeKey ? { parentThemeKey } : {}),
  };
}

// This list is intentionally an override layer, not a complete theme catalog.
// Rebrickable/catalog theme names are allowed to fall through automatically.
export const brickhuntThemeRegistry = [
  createThemeOverride({
    displayName: 'LEGO® Animal Crossing™',
    aliases: ['Animal Crossing'],
  }),
  createThemeOverride({
    displayName: 'Architecture',
    aliases: ['Skylines'],
  }),
  createThemeOverride({ displayName: 'LEGO® Art', aliases: ['Art'] }),
  createThemeOverride({ displayName: 'Batman™', aliases: ['Batman'] }),
  createThemeOverride({
    displayName: 'Botanicals',
    aliases: ['Botanical Collection', 'The Botanical Collection'],
  }),
  createThemeOverride({
    displayName: 'BrickLink Designer Program',
  }),
  createThemeOverride({
    displayName: 'BrickHeadz',
    aliases: ['Brickheadz', 'BrickHeadz'],
  }),
  createThemeOverride({
    displayName: 'City',
  }),
  createThemeOverride({
    displayName: 'Creator 3in1',
    aliases: ['Creator', 'Creator 3-in-1', 'Creator 3in1'],
  }),
  createThemeOverride({
    displayName: 'Disney',
  }),
  createThemeOverride({
    displayName: 'LEGO® DREAMZzz™',
    aliases: ['Dreamzzz', 'DREAMZzz'],
  }),
  createThemeOverride({
    displayName: 'Editions',
  }),
  createThemeOverride({
    displayName: 'LEGO® DUPLO®',
    aliases: ['Duplo', 'DUPLO'],
  }),
  createThemeOverride({
    displayName: 'LEGO® DUPLO® Peppa Big',
    aliases: ['Peppa Pig', 'Duplo Peppa Pig', 'DUPLO Peppa Pig'],
    parentThemeKey: 'duplo',
  }),
  createThemeOverride({
    displayName: 'LEGO® Education',
    aliases: ['Education', 'Educational and Dacta'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Fortnite®',
    aliases: ['Fortnite'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Gabby’s Dollhouse',
    aliases: [
      "Gabby's Dollhouse",
      "Gabby's poppenhuis",
      "Gabby's Poppenhuis",
      'Gabby’s Dollhouse',
      'Gabby’s Poppenhuis',
      'Gabby’s poppenhuis',
    ],
    key: 'gabby-s-poppenhuis',
  }),
  createThemeOverride({
    displayName: 'Gear',
  }),
  createThemeOverride({
    displayName: 'Harry Potter™',
    aliases: ['Harry Potter'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Icons',
    aliases: ['Icons', 'Modular Buildings', 'LEGO Exclusive'],
  }),
  createThemeOverride({
    displayName: 'Ideas',
    aliases: ['LEGO Ideas and CUUSOO'],
  }),
  createThemeOverride({
    displayName: 'Looney Tunes™',
    aliases: ['Looney Tunes'],
  }),
  createThemeOverride({
    displayName: 'Lord of the Rings™',
    aliases: ['Lord of the Rings', 'The Lord of the Rings', 'LOTR'],
  }),
  createThemeOverride({
    displayName: 'Marvel',
    aliases: [
      'Avengers',
      'Spider-Man',
      'Spidey and His Amazing Friends',
      'Super Heroes Marvel',
      'The Infinity Saga',
      'X-Men',
    ],
  }),
  createThemeOverride({
    displayName: 'Minecraft®',
    aliases: ['Minecraft'],
  }),
  createThemeOverride({
    displayName: 'Minifiguren',
    aliases: ['Collectible Minifigures', 'Minifigures'],
    key: 'collectible-minifigures',
  }),
  createThemeOverride({
    displayName: 'Monkie Kid™',
    aliases: ['Monkie Kid'],
  }),
  createThemeOverride({
    displayName: 'Nike x LEGO® collectie',
    aliases: ['Nike'],
  }),
  createThemeOverride({
    displayName: 'NINJAGO®',
    aliases: ['Ninjago', 'NINJAGO'],
  }),
  createThemeOverride({
    displayName: 'ONE PIECE',
    aliases: ['One Piece'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Pokémon™ speelgoed en sets',
    aliases: ['Pokémon', 'Pokemon'],
  }),
  createThemeOverride({
    displayName: 'Powered UP',
    aliases: ['Powered Up'],
  }),
  createThemeOverride({
    displayName: 'SERIOUS PLAY®',
    aliases: ['Serious Play', 'SERIOUS PLAY'],
  }),
  createThemeOverride({
    displayName: 'Sonic the Hedgehog™',
    aliases: ['Sonic The Hedgehog', 'Sonic the Hedgehog', 'Sonic'],
  }),
  createThemeOverride({
    displayName: 'Speed Champions',
  }),
  createThemeOverride({
    displayName: 'Star Wars™',
    aliases: ['Star Wars', 'Ultimate Collector Series'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Super Mario™',
    aliases: ['Super Mario'],
  }),
  createThemeOverride({
    displayName: 'Technic',
  }),
  createThemeOverride({
    displayName: 'LEGO® The Legend of Zelda™',
    aliases: ['The Legend of Zelda', 'Zelda'],
  }),
  createThemeOverride({
    displayName: 'LEGO® Wednesday',
    aliases: ['Wednesday'],
  }),
  createThemeOverride({
    displayName: 'Wicked',
  }),
] as const satisfies readonly BrickhuntThemeRegistryEntry[];

const themeByKey = new Map(
  brickhuntThemeRegistry.map((theme) => [theme.key, theme]),
);

const themeByAlias = new Map<string, BrickhuntThemeRegistryEntry>();

for (const theme of brickhuntThemeRegistry) {
  for (const alias of [
    theme.key,
    theme.displayName,
    theme.legoDisplayName,
    ...theme.aliases,
  ]) {
    if (!alias) {
      continue;
    }

    themeByAlias.set(normalizeRegistryText(alias), theme);
  }
}

function createCatalogThemeEntry(
  themeName: string,
): BrickhuntThemeRegistryEntry {
  return {
    key: buildThemeKey(themeName),
    displayName: themeName,
    aliases: [],
  };
}

export function shouldMapThemeToParent({
  parentTheme,
  rawTheme,
}: {
  parentTheme?: string;
  rawTheme?: string;
}): boolean {
  if (!parentTheme || !rawTheme) {
    return false;
  }

  const normalizedParentTheme = normalizeRegistryText(parentTheme);
  const normalizedRawTheme = normalizeRegistryText(rawTheme);
  const rawThemeOverride = themeByAlias.get(normalizedRawTheme);

  if (
    rawThemeOverride &&
    utilityThemeNames.has(normalizedParentTheme) &&
    !utilityThemeNames.has(normalizeRegistryText(rawThemeOverride.displayName))
  ) {
    return false;
  }

  return (
    Boolean(normalizedParentTheme) &&
    normalizedParentTheme !== normalizedRawTheme &&
    parentGroupingThemeNames.has(normalizedParentTheme)
  );
}

function isParentThemeMappingContext(
  context?: ThemeNormalizationContext,
): boolean {
  return shouldMapThemeToParent({
    parentTheme: context?.parentTheme,
    rawTheme: context?.theme,
  });
}

export function getThemeByKey(
  key: string,
): BrickhuntThemeRegistryEntry | undefined {
  return themeByKey.get(key) ?? themeByAlias.get(normalizeRegistryText(key));
}

export function normalizeTheme(
  rawTheme?: string,
  context?: ThemeNormalizationContext,
): BrickhuntThemeRegistryEntry | undefined {
  const contextTheme = inferThemeFromContext(context);

  if (!rawTheme) {
    return contextTheme;
  }

  const normalizedRawTheme = normalizeRegistryText(rawTheme);

  if (
    (normalizedRawTheme === 'other' || normalizedRawTheme === 'unknown') &&
    contextTheme
  ) {
    return contextTheme;
  }

  if (normalizedRawTheme === 'advent' && hasCityAdventContext(context)) {
    return normalizeTheme('City');
  }

  if (normalizedRawTheme === 'icons' && hasLordOfTheRingsSetContext(context)) {
    return normalizeTheme('Lord of the Rings');
  }

  if (isParentThemeMappingContext(context)) {
    return normalizeTheme(context?.parentTheme);
  }

  return (
    themeByAlias.get(normalizedRawTheme) ?? createCatalogThemeEntry(rawTheme)
  );
}

export function getThemeDisplayName(
  themeKeyOrRaw?: string,
): string | undefined {
  if (!themeKeyOrRaw) {
    return undefined;
  }

  return normalizeTheme(themeKeyOrRaw)?.displayName;
}

export function isThemeVisible(
  themeKeyOrRaw?: string,
  context?: ThemeNormalizationContext,
): boolean {
  const normalizedTheme = normalizeTheme(themeKeyOrRaw, context);

  if (!normalizedTheme) {
    return false;
  }

  return !utilityThemeNames.has(
    normalizeRegistryText(normalizedTheme.displayName),
  );
}

export function getFeaturedThemes(): BrickhuntThemeRegistryEntry[] {
  return [];
}

export function getThemeTileImage(themeKeyOrRaw?: string): string | undefined {
  void themeKeyOrRaw;
  return undefined;
}

function getSortableThemeName(theme: ThemeSortable): string {
  if (typeof theme === 'string') {
    return theme;
  }

  return (
    theme.key ??
    theme.displayName ??
    theme.name ??
    theme.theme ??
    theme.themeSnapshot?.name ??
    ''
  );
}

function getSortableThemeSetCount(theme: ThemeSortable): number {
  if (typeof theme === 'string') {
    return 0;
  }

  return theme.themeSnapshot?.setCount ?? 0;
}

export function sortThemesForHome<T extends ThemeSortable>(
  themes: readonly T[],
): T[] {
  return [...themes].sort((left, right) => {
    const setCountDifference =
      getSortableThemeSetCount(right) - getSortableThemeSetCount(left);

    if (setCountDifference !== 0) {
      return setCountDifference;
    }

    return getSortableThemeName(left).localeCompare(
      getSortableThemeName(right),
      'nl',
    );
  });
}
