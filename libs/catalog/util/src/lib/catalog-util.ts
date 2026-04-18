import { MetricCard } from '@lego-platform/shared/types';
import { formatCompactNumber } from '@lego-platform/shared/util';

export interface CatalogSetSummary {
  id: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  collectorAngle: string;
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
}

export type CatalogSetImageType = 'hero' | 'detail' | 'minifig';

export interface CatalogSetImage {
  order?: number;
  type?: CatalogSetImageType;
  url: string;
}

export type CatalogSetImageSeed = CatalogSetImage | string;

export interface CatalogHomepageSetCard extends CatalogSetSummary {
  tagline: string;
  availability: string;
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
}

export interface CatalogSetCardSearchMatch<
  T extends Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'releaseYear' | 'minifigureHighlights'
  > = CatalogHomepageSetCard,
> {
  score: number;
  setCard: T;
}

export interface CatalogSetDisplaySize {
  label?: string;
  value: string;
}

export interface CatalogThemeIdentity {
  primaryTheme: string;
  secondaryThemes: readonly string[];
}

export interface CatalogSetDetail extends CatalogSetSummary {
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  recommendedAge?: number;
  displaySize?: CatalogSetDisplaySize;
  setStatus?: CatalogSetStatus;
  subtheme?: string;
}

export type CatalogSetStatus =
  | 'available'
  | 'backorder'
  | 'retiring_soon'
  | 'retired';

export type CatalogQuickFilterKey =
  | 'all'
  | 'best-deals'
  | 'with-minifigures'
  | 'star-wars'
  | 'harry-potter'
  | 'marvel'
  | 'icons';

export interface CatalogQuickFilterOption {
  key: CatalogQuickFilterKey;
  label: string;
  theme?: string;
}

const catalogQuickFilterOptions = [
  {
    key: 'all',
    label: 'Alles',
  },
  {
    key: 'best-deals',
    label: 'Beste deals',
  },
  {
    key: 'with-minifigures',
    label: 'Met minifiguren',
  },
  {
    key: 'star-wars',
    label: 'Star Wars',
    theme: 'Star Wars',
  },
  {
    key: 'harry-potter',
    label: 'Harry Potter',
    theme: 'Harry Potter',
  },
  {
    key: 'marvel',
    label: 'Marvel',
    theme: 'Marvel',
  },
  {
    key: 'icons',
    label: 'Icons',
    theme: 'Icons',
  },
] as const satisfies readonly CatalogQuickFilterOption[];

export function listCatalogQuickFilterOptions(): readonly CatalogQuickFilterOption[] {
  return catalogQuickFilterOptions;
}

export function normalizeCatalogQuickFilterKey(
  value?: string,
): CatalogQuickFilterKey {
  return catalogQuickFilterOptions.some(
    (catalogQuickFilterOption) => catalogQuickFilterOption.key === value,
  )
    ? (value as CatalogQuickFilterKey)
    : 'all';
}

function hasCatalogMinifigureSignal({
  minifigureCount,
  minifigureHighlights,
}: Pick<CatalogHomepageSetCard, 'minifigureCount' | 'minifigureHighlights'>) {
  return (
    typeof minifigureCount === 'number' || Boolean(minifigureHighlights?.length)
  );
}

export function matchesCatalogQuickFilter({
  filter,
  setCard,
  strongDealSetIds = [],
}: {
  filter: CatalogQuickFilterKey;
  setCard: Pick<
    CatalogHomepageSetCard,
    'id' | 'theme' | 'minifigureCount' | 'minifigureHighlights'
  >;
  strongDealSetIds?: readonly string[];
}): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'best-deals') {
    return strongDealSetIds.includes(setCard.id);
  }

  if (filter === 'with-minifigures') {
    return hasCatalogMinifigureSignal(setCard);
  }

  const catalogQuickFilterOption = catalogQuickFilterOptions.find(
    (quickFilterOption) => quickFilterOption.key === filter,
  );

  if (!catalogQuickFilterOption || !('theme' in catalogQuickFilterOption)) {
    return false;
  }

  return catalogQuickFilterOption.theme === setCard.theme;
}

function normalizeCatalogSearchText(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCatalogSearchToken(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCatalogSetCardSearchScore<
  T extends Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'minifigureHighlights'
  >,
>({
  queryText,
  queryToken,
  setCard,
}: {
  queryText: string;
  queryToken: string;
  setCard: T;
}): number | undefined {
  const canonicalIdToken = normalizeCatalogSearchToken(setCard.id);
  const normalizedName = normalizeCatalogSearchText(setCard.name);
  const compactName = normalizeCatalogSearchToken(setCard.name);
  const highlightText = setCard.minifigureHighlights?.join(' ');
  const normalizedHighlights = highlightText
    ? normalizeCatalogSearchText(highlightText)
    : undefined;
  const compactHighlights = highlightText
    ? normalizeCatalogSearchToken(highlightText)
    : undefined;

  if (canonicalIdToken === queryToken) {
    return 0;
  }

  if (canonicalIdToken.startsWith(queryToken)) {
    return 1;
  }

  if (
    normalizedName.startsWith(queryText) ||
    compactName.startsWith(queryToken)
  ) {
    return 2;
  }

  if (
    normalizedName
      .split(' ')
      .some((normalizedNameWord) => normalizedNameWord.startsWith(queryText))
  ) {
    return 3;
  }

  if (normalizedName.includes(queryText) || compactName.includes(queryToken)) {
    return 4;
  }

  if (
    normalizedHighlights
      ?.split(' ')
      .some((normalizedHighlightWord) =>
        normalizedHighlightWord.startsWith(queryText),
      )
  ) {
    return 5;
  }

  if (
    normalizedHighlights?.includes(queryText) ||
    compactHighlights?.includes(queryToken)
  ) {
    return 6;
  }

  return undefined;
}

export function listCatalogSetCardSearchMatches<
  T extends Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'releaseYear' | 'minifigureHighlights'
  >,
>({
  limit = 6,
  query,
  setCards,
}: {
  limit?: number;
  query: string;
  setCards: readonly T[];
}): CatalogSetCardSearchMatch<T>[] {
  const normalizedQueryText = normalizeCatalogSearchText(query);
  const normalizedQueryToken = normalizeCatalogSearchToken(query);
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizedQueryText || !normalizedQueryToken || suggestionLimit === 0) {
    return [];
  }

  return setCards
    .flatMap((setCard) => {
      const score = getCatalogSetCardSearchScore({
        queryText: normalizedQueryText,
        queryToken: normalizedQueryToken,
        setCard,
      });

      return typeof score === 'number'
        ? [
            {
              score,
              setCard,
            } satisfies CatalogSetCardSearchMatch<T>,
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .slice(0, suggestionLimit);
}

export interface CatalogThemeSnapshot {
  name: string;
  slug: string;
  setCount: number;
  momentum: string;
  signatureSet: string;
}

export interface CatalogThemeVisual {
  backgroundColor?: string;
  imageUrl?: string;
  textColor?: string;
}

export interface CatalogThemeDefinition {
  name: string;
  slug: string;
  visual: CatalogThemeVisual;
}

const curatedCatalogThemeVisualsByName = new Map<string, CatalogThemeVisual>([
  [
    'Icons',
    {
      backgroundColor: '#f0c63b',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
      textColor: '#171a22',
    },
  ],
  [
    'Marvel',
    {
      backgroundColor: '#cf554c',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Ideas',
    {
      backgroundColor: '#68b8a0',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
      textColor: '#10241f',
    },
  ],
  [
    'Star Wars',
    {
      backgroundColor: '#5573b5',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Harry Potter',
    {
      backgroundColor: '#7f67bf',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/127873.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Technic',
    {
      backgroundColor: '#a8b4c2',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/42177-1/142596.jpg',
      textColor: '#171a22',
    },
  ],
  [
    'Modular Buildings',
    {
      backgroundColor: '#b88d6c',
      textColor: '#171a22',
    },
  ],
  [
    'Botanicals',
    {
      backgroundColor: '#7caf76',
      textColor: '#10241f',
    },
  ],
  [
    'Architecture',
    {
      backgroundColor: '#6f8594',
      textColor: '#ffffff',
    },
  ],
  [
    'Art',
    {
      backgroundColor: '#d26d53',
      textColor: '#ffffff',
    },
  ],
  [
    'Disney',
    {
      backgroundColor: '#6483d8',
      textColor: '#ffffff',
    },
  ],
  [
    'NINJAGO',
    {
      backgroundColor: '#bf4b47',
      textColor: '#ffffff',
    },
  ],
  [
    'Super Mario',
    {
      backgroundColor: '#d85a50',
      textColor: '#ffffff',
    },
  ],
  [
    'Jurassic World',
    {
      backgroundColor: '#5f7b70',
      textColor: '#ffffff',
    },
  ],
]);

export function getCatalogThemeVisual(
  themeName?: string,
): CatalogThemeVisual | undefined {
  return getCatalogThemeDefinition(themeName)?.visual;
}

export interface CatalogSetRecord {
  canonicalId: string;
  sourceSetNumber: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
}

export const catalogOverlaySetSources = ['rebrickable'] as const;

export const catalogOverlaySetStatuses = ['active', 'inactive'] as const;

export type CatalogOverlaySetSource = (typeof catalogOverlaySetSources)[number];

export type CatalogOverlaySetStatus =
  (typeof catalogOverlaySetStatuses)[number];

export interface CatalogAddableSetRecord {
  imageUrl?: string;
  name: string;
  pieces: number;
  releaseYear: number;
  setId: string;
  slug: string;
  source: CatalogOverlaySetSource;
  sourceSetNumber: string;
  theme: string;
}

export type CatalogExternalSetSearchResult = CatalogAddableSetRecord;

export interface CatalogOverlaySet extends CatalogAddableSetRecord {
  createdAt: string;
  status: CatalogOverlaySetStatus;
  updatedAt: string;
}

export interface CatalogSnapshot {
  source: string;
  generatedAt: string;
  setRecords: readonly CatalogSetRecord[];
}

export interface CatalogSetOverlay {
  canonicalId: string;
  productSlug?: string;
  displayName?: string;
  displayTheme?: string;
  collectorAngle: string;
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  recommendedAge?: number;
  displaySize?: CatalogSetDisplaySize;
  setStatus?: CatalogSetStatus;
  subtheme?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}

export interface CatalogThemeOverlay {
  name: string;
  setCount: number;
  momentum: string;
  signatureSet: string;
}

export interface CatalogSyncManifest {
  source: string;
  generatedAt: string;
  recordCount: number;
  homepageFeaturedSetIds: readonly string[];
  notes?: string;
}

export interface CatalogSetSeed {
  sourceSetNumber: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  imageUrl?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}

function normalizeCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const catalogCanonicalThemeNames = new Map<string, string>([
  ['LEGO Art', 'Art'],
  ['LEGO Ideas and CUUSOO', 'Ideas'],
  ['Ninjago', 'NINJAGO'],
]);

const catalogPrimaryThemeBySecondaryTheme = new Map<string, string>([
  ['Avengers', 'Marvel'],
  ['Spider-Man', 'Marvel'],
  ['The Infinity Saga', 'Marvel'],
  ['Ultimate Collector Series', 'Star Wars'],
  ['X-Men', 'Marvel'],
]);

function canonicalizeCatalogThemeName(themeName: string): string {
  const normalizedThemeName = normalizeCatalogText(themeName);

  return (
    catalogCanonicalThemeNames.get(normalizedThemeName) ?? normalizedThemeName
  );
}

function dedupeCatalogSecondaryThemes({
  primaryTheme,
  secondaryThemes,
}: CatalogThemeIdentity): readonly string[] {
  const seenThemes = new Set<string>();

  return secondaryThemes.filter((secondaryTheme) => {
    if (!secondaryTheme || secondaryTheme === primaryTheme) {
      return false;
    }

    if (seenThemes.has(secondaryTheme)) {
      return false;
    }

    seenThemes.add(secondaryTheme);

    return true;
  });
}

export function resolveCatalogThemeIdentity({
  parentTheme,
  rawTheme,
}: {
  parentTheme?: string;
  rawTheme: string;
}): CatalogThemeIdentity {
  const normalizedRawTheme = normalizeCatalogText(rawTheme);
  const rawThemeSegments = normalizedRawTheme
    .split('>')
    .map((segment) => canonicalizeCatalogThemeName(segment))
    .filter(Boolean);
  const canonicalRawTheme =
    rawThemeSegments.length > 0
      ? rawThemeSegments[rawThemeSegments.length - 1]
      : canonicalizeCatalogThemeName(normalizedRawTheme);
  const canonicalParentTheme = parentTheme
    ? canonicalizeCatalogThemeName(parentTheme)
    : undefined;

  if (canonicalParentTheme) {
    const secondaryThemes =
      rawThemeSegments.length > 1
        ? rawThemeSegments[0] === canonicalParentTheme
          ? rawThemeSegments.slice(1)
          : rawThemeSegments
        : canonicalRawTheme !== canonicalParentTheme
          ? [canonicalRawTheme]
          : [];

    return {
      primaryTheme: canonicalParentTheme,
      secondaryThemes: dedupeCatalogSecondaryThemes({
        primaryTheme: canonicalParentTheme,
        secondaryThemes,
      }),
    };
  }

  if (rawThemeSegments.length > 1) {
    const primaryTheme = rawThemeSegments[0];

    return {
      primaryTheme,
      secondaryThemes: dedupeCatalogSecondaryThemes({
        primaryTheme,
        secondaryThemes: rawThemeSegments.slice(1),
      }),
    };
  }

  const derivedPrimaryTheme =
    catalogPrimaryThemeBySecondaryTheme.get(canonicalRawTheme);

  if (derivedPrimaryTheme) {
    return {
      primaryTheme: derivedPrimaryTheme,
      secondaryThemes: [canonicalRawTheme],
    };
  }

  return {
    primaryTheme: canonicalRawTheme,
    secondaryThemes: [],
  };
}

export function getCatalogPrimaryTheme({
  parentTheme,
  rawTheme,
}: {
  parentTheme?: string;
  rawTheme: string;
}): string {
  return resolveCatalogThemeIdentity({
    parentTheme,
    rawTheme,
  }).primaryTheme;
}

export function getCatalogThemeDefinition(
  themeName?: string,
): CatalogThemeDefinition | undefined {
  if (!themeName) {
    return undefined;
  }

  const primaryTheme = getCatalogPrimaryTheme({
    rawTheme: themeName,
  });
  const curatedThemeVisual = curatedCatalogThemeVisualsByName.get(primaryTheme);

  if (!curatedThemeVisual) {
    return undefined;
  }

  return {
    name: primaryTheme,
    slug: buildCatalogThemeSlug(primaryTheme),
    visual: { ...curatedThemeVisual },
  };
}

function usesLightCatalogThemeText(textColor?: string): boolean {
  const normalizedTextColor = textColor?.trim().toLowerCase();

  return Boolean(
    normalizedTextColor &&
      [
        '#fff',
        '#ffffff',
        'white',
        'rgb(255, 255, 255)',
        'rgb(255,255,255)',
      ].includes(normalizedTextColor),
  );
}

export function getCatalogThemeMutedTextColor(textColor?: string): string {
  return usesLightCatalogThemeText(textColor) ? '#f4f7fb' : '#425066';
}

export function getCatalogThemeSurfaceTone(
  themeName?: string,
): 'dark' | 'light' {
  return usesLightCatalogThemeText(getCatalogThemeVisual(themeName)?.textColor)
    ? 'dark'
    : 'light';
}

function normalizeCatalogImageUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\\+$/g, '');

  return normalizedValue ? normalizedValue : undefined;
}

function toCatalogSetImageSeed(
  image: CatalogSetImageSeed,
): CatalogSetImage | undefined {
  if (typeof image === 'string') {
    const normalizedUrl = normalizeCatalogImageUrl(image);

    return normalizedUrl
      ? {
          url: normalizedUrl,
        }
      : undefined;
  }

  const normalizedUrl = normalizeCatalogImageUrl(image.url);

  if (!normalizedUrl) {
    return undefined;
  }

  return {
    ...(typeof image.order === 'number' ? { order: image.order } : {}),
    ...(image.type
      ? {
          type: image.type,
        }
      : {}),
    url: normalizedUrl,
  };
}

export function normalizeCatalogSetImages({
  imageUrl,
  images,
  primaryImage,
}: {
  imageUrl?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}): {
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
} {
  const normalizedPrimaryImage = normalizeCatalogImageUrl(primaryImage);
  const normalizedImageUrl = normalizeCatalogImageUrl(imageUrl);
  const seededImages = [
    ...(normalizedPrimaryImage
      ? [
          {
            order: 0,
            type: 'hero' as const,
            url: normalizedPrimaryImage,
          },
        ]
      : []),
    ...(images ?? []),
    ...(normalizedImageUrl ? [normalizedImageUrl] : []),
  ];

  if (seededImages.length === 0) {
    return {
      ...(normalizedImageUrl
        ? {
            imageUrl: normalizedImageUrl,
          }
        : {}),
      ...(normalizedPrimaryImage
        ? {
            primaryImage: normalizedPrimaryImage,
          }
        : {}),
    };
  }

  const normalizedImagesByUrl = new Map<
    string,
    CatalogSetImage & { insertionIndex: number; isPrimary: boolean }
  >();

  seededImages.forEach((catalogSetImageSeed, index) => {
    const normalizedCatalogSetImage =
      toCatalogSetImageSeed(catalogSetImageSeed);

    if (!normalizedCatalogSetImage) {
      return;
    }

    const existingCatalogSetImage = normalizedImagesByUrl.get(
      normalizedCatalogSetImage.url,
    );

    if (!existingCatalogSetImage) {
      normalizedImagesByUrl.set(normalizedCatalogSetImage.url, {
        ...normalizedCatalogSetImage,
        insertionIndex: index,
        isPrimary: normalizedCatalogSetImage.url === normalizedPrimaryImage,
      });

      return;
    }

    normalizedImagesByUrl.set(normalizedCatalogSetImage.url, {
      insertionIndex: Math.min(existingCatalogSetImage.insertionIndex, index),
      isPrimary:
        existingCatalogSetImage.isPrimary ||
        normalizedCatalogSetImage.url === normalizedPrimaryImage,
      order:
        typeof existingCatalogSetImage.order === 'number'
          ? existingCatalogSetImage.order
          : normalizedCatalogSetImage.order,
      type: existingCatalogSetImage.type ?? normalizedCatalogSetImage.type,
      url: normalizedCatalogSetImage.url,
    });
  });

  const normalizedImages = [...normalizedImagesByUrl.values()]
    .sort(
      (left, right) =>
        Number(right.isPrimary) - Number(left.isPrimary) ||
        Number(right.type === 'hero') - Number(left.type === 'hero') ||
        (left.order ?? Number.MAX_SAFE_INTEGER) -
          (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.insertionIndex - right.insertionIndex,
    )
    .map((catalogSetImage, index) => ({
      order:
        typeof catalogSetImage.order === 'number'
          ? catalogSetImage.order
          : index,
      ...(catalogSetImage.type
        ? {
            type: catalogSetImage.type,
          }
        : index === 0
          ? {
              type: 'hero' as const,
            }
          : {}),
      url: catalogSetImage.url,
    }));

  const resolvedPrimaryImage =
    normalizedPrimaryImage ?? normalizedImages[0]?.url;

  return {
    ...(resolvedPrimaryImage
      ? {
          imageUrl: resolvedPrimaryImage,
          primaryImage: resolvedPrimaryImage,
        }
      : {}),
    ...(normalizedImages.length
      ? {
          images: normalizedImages,
        }
      : {}),
  };
}

function stripCatalogDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCatalogAsciiText(value: string): string {
  return stripCatalogDiacritics(normalizeCatalogText(value));
}

function buildCatalogSlugBase({
  canonicalId,
  name,
  stripDiacritics,
}: {
  canonicalId: string;
  name: string;
  stripDiacritics: boolean;
}): string {
  const normalizedName = (
    stripDiacritics ? normalizeCatalogAsciiText(name) : name
  )
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalizedName}-${canonicalId}`;
}

export function getCanonicalCatalogSetId(sourceSetNumber: string): string {
  const normalizedSourceSetNumber = normalizeCatalogText(sourceSetNumber);
  const variantMatch = normalizedSourceSetNumber.match(
    /^([0-9A-Za-z]+)-[0-9A-Za-z]+$/,
  );

  return variantMatch ? variantMatch[1] : normalizedSourceSetNumber;
}

export function buildCatalogSetSlug(name: string, canonicalId: string): string {
  return buildCatalogSlugBase({
    canonicalId,
    name,
    stripDiacritics: true,
  });
}

export function buildCatalogThemeSlug(themeName: string): string {
  return normalizeCatalogAsciiText(
    getCatalogPrimaryTheme({
      rawTheme: themeName,
    }),
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCatalogProductSlug({
  catalogSetRecord,
  catalogSetOverlay,
}: {
  catalogSetRecord: CatalogSetRecord;
  catalogSetOverlay: Pick<CatalogSetOverlay, 'productSlug'>;
}): string {
  return catalogSetOverlay.productSlug ?? catalogSetRecord.slug;
}

export function createCatalogSetRecord(
  catalogSetSeed: CatalogSetSeed,
): CatalogSetRecord {
  const normalizedSourceSetNumber = normalizeCatalogText(
    catalogSetSeed.sourceSetNumber,
  );
  const canonicalId = getCanonicalCatalogSetId(normalizedSourceSetNumber);
  const catalogSetImages = normalizeCatalogSetImages({
    imageUrl: catalogSetSeed.imageUrl,
    images: catalogSetSeed.images,
    primaryImage: catalogSetSeed.primaryImage,
  });
  const hasExplicitGalleryImages = Boolean(
    catalogSetSeed.primaryImage || catalogSetSeed.images?.length,
  );

  return {
    canonicalId,
    sourceSetNumber: normalizedSourceSetNumber,
    slug: buildCatalogSetSlug(catalogSetSeed.name, canonicalId),
    name: normalizeCatalogText(catalogSetSeed.name),
    theme: getCatalogPrimaryTheme({
      rawTheme: catalogSetSeed.theme,
    }),
    releaseYear: catalogSetSeed.releaseYear,
    pieces: catalogSetSeed.pieces,
    imageUrl: catalogSetImages.imageUrl,
    ...(hasExplicitGalleryImages && catalogSetImages.images
      ? {
          images: catalogSetImages.images,
        }
      : {}),
    ...(hasExplicitGalleryImages && catalogSetImages.primaryImage
      ? {
          primaryImage: catalogSetImages.primaryImage,
        }
      : {}),
  };
}

function renderCatalogGeneratedModule<
  T extends CatalogSnapshot | CatalogSyncManifest,
>({
  exportName,
  importName,
  payload,
}: {
  exportName: 'catalogSnapshot' | 'catalogSyncManifest';
  importName: 'CatalogSnapshot' | 'CatalogSyncManifest';
  payload: T;
}): string {
  const payloadVariableName = `${exportName}Payload`;

  return `import type { ${importName} } from '@lego-platform/catalog/util';

// Generated by apps/catalog-sync. Do not edit by hand.
const ${payloadVariableName} = String.raw\`${JSON.stringify(payload, null, 2)}\`;

export const ${exportName}: ${importName} = JSON.parse(
  ${payloadVariableName},
) as ${importName};
`;
}

export function renderCatalogSnapshotModule(
  catalogSnapshot: CatalogSnapshot,
): string {
  return renderCatalogGeneratedModule({
    exportName: 'catalogSnapshot',
    importName: 'CatalogSnapshot',
    payload: catalogSnapshot,
  });
}

export function renderCatalogSyncManifestModule(
  catalogSyncManifest: CatalogSyncManifest,
): string {
  return renderCatalogGeneratedModule({
    exportName: 'catalogSyncManifest',
    importName: 'CatalogSyncManifest',
    payload: catalogSyncManifest,
  });
}

export function sortCatalogSetSummaries(
  setSummaries: readonly CatalogSetSummary[],
): CatalogSetSummary[] {
  return [...setSummaries].sort(
    (left, right) =>
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

export function buildCatalogMetrics(
  setSummaries: readonly CatalogSetSummary[],
): MetricCard[] {
  const pieceCount = setSummaries.reduce(
    (total, setSummary) => total + setSummary.pieces,
    0,
  );

  return [
    {
      label: 'Gevolgde sets',
      value: String(setSummaries.length),
      detail: 'Samengestelde vlaggenschipselectie',
    },
    {
      label: 'Geindexeerde steentjes',
      value: formatCompactNumber(pieceCount),
      detail: 'Verspreid over uitgelichte catalogusitems',
    },
    {
      label: 'Nieuwste release',
      value: String(
        Math.max(...setSummaries.map((setSummary) => setSummary.releaseYear)),
      ),
      detail: 'Laatste verzamelklare lancering',
      tone: 'accent',
    },
  ];
}
