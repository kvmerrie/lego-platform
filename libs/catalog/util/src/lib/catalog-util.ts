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
}

export interface CatalogSetDetail extends CatalogSetSummary {
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
  minifigureCount?: number;
  setStatus?: CatalogSetStatus;
  subtheme?: string;
}

export type CatalogSetStatus =
  | 'available'
  | 'backorder'
  | 'retiring_soon'
  | 'retired';

export interface CatalogThemeSnapshot {
  name: string;
  slug: string;
  setCount: number;
  momentum: string;
  signatureSet: string;
}

export interface CatalogHomepageThemeVisual {
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
      label: 'Tracked sets',
      value: String(setSummaries.length),
      detail: 'Curated flagship inventory',
    },
    {
      label: 'Pieces indexed',
      value: formatCompactNumber(pieceCount),
      detail: 'Across featured catalog entries',
    },
    {
      label: 'Freshest release',
      value: String(
        Math.max(...setSummaries.map((setSummary) => setSummary.releaseYear)),
      ),
      detail: 'Latest collector-ready launch',
      tone: 'accent',
    },
  ];
}
