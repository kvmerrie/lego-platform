import { MetricCard } from '@lego-platform/shared/types';
import { formatCompactNumber } from '@lego-platform/shared/util';

export interface CatalogSetSummary {
  id: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  priceRange: string;
  collectorAngle: string;
  imageUrl?: string;
}

export interface CatalogHomepageSetCard extends CatalogSetSummary {
  tagline: string;
  availability: string;
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
}

export interface CatalogSetDetail extends CatalogSetSummary {
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
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

export interface CatalogSetRecord {
  canonicalId: string;
  sourceSetNumber: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  imageUrl?: string;
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
  priceRange: string;
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  setStatus?: CatalogSetStatus;
  subtheme?: string;
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
}

function normalizeCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
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
  return normalizeCatalogAsciiText(themeName)
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

  return {
    canonicalId,
    sourceSetNumber: normalizedSourceSetNumber,
    slug: buildCatalogSetSlug(catalogSetSeed.name, canonicalId),
    name: normalizeCatalogText(catalogSetSeed.name),
    theme: normalizeCatalogText(catalogSetSeed.theme),
    releaseYear: catalogSetSeed.releaseYear,
    pieces: catalogSetSeed.pieces,
    imageUrl: catalogSetSeed.imageUrl,
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
