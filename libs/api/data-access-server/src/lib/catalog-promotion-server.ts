import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  getServerSupabaseConfig,
  getStagingSupabaseConfig,
} from '@lego-platform/shared/config';
import { CATALOG_SETS_TABLE } from '@lego-platform/catalog/data-access-server';
import {
  buildCatalogSetSlug,
  buildCatalogThemeSlug,
} from '@lego-platform/catalog/util';
import {
  COMMERCE_BENCHMARK_SETS_TABLE,
  COMMERCE_MERCHANTS_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
} from '@lego-platform/commerce/data-access-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const CATALOG_PROMOTION_PAGE_SIZE = 1000;
const CATALOG_PROMOTION_DEFAULT_CAP_GUARDED_TABLES = new Set([
  CATALOG_SETS_TABLE,
  CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
]);
const CATALOG_PROMOTION_TIMESTAMPED_TABLES = new Set([
  CATALOG_SOURCE_THEMES_TABLE,
  CATALOG_THEMES_TABLE,
  CATALOG_THEME_MAPPINGS_TABLE,
  CATALOG_SETS_TABLE,
  CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
  COMMERCE_MERCHANTS_TABLE,
  COMMERCE_BENCHMARK_SETS_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
]);
const CATALOG_THEME_PUBLIC_REVALIDATION_FIELDS = [
  'public_display_name',
  'public_description',
  'public_image_url',
  'public_accent_color',
  'public_surface_color',
  'public_surface_text_color',
  'public_hero_text_color',
  'public_logo_url',
  'public_homepage_order',
  'public_order',
  'is_public',
  'status',
] as const;
const CATALOG_THEME_PRODUCTION_OWNED_PRESENTATION_FIELDS = [
  'display_name',
  'is_public',
  'public_accent_color',
  'public_description',
  'public_display_name',
  'public_hero_text_color',
  'public_homepage_order',
  'public_image_url',
  'public_logo_url',
  'public_order',
  'public_surface_color',
  'public_surface_text_color',
  'slug',
  'status',
] as const;
const CATALOG_PROMOTION_MUTABLE_COLUMNS_BY_TABLE: Record<
  string,
  readonly string[]
> = {
  catalog_sets: [
    'created_at',
    'image_url',
    'name',
    'piece_count',
    'primary_theme_id',
    'release_year',
    'slug',
    'source',
    'source_set_number',
    'source_theme_id',
    'status',
    'updated_at',
  ],
  [CATALOG_SOURCE_THEMES_TABLE]: [
    'parent_source_theme_id',
    'source_system',
    'source_theme_name',
  ],
  [CATALOG_THEMES_TABLE]: [
    // Existing production theme rows own their public presentation. Staging
    // values are used only when inserting a new theme.
  ],
  [CATALOG_THEME_MAPPINGS_TABLE]: ['primary_theme_id'],
  [CATALOG_SET_MINIFIG_SUMMARIES_TABLE]: [
    'source_system',
    'minifig_count',
    'source_minifig_count',
    'synced_at',
    'created_at',
    'updated_at',
  ],
  commerce_benchmark_sets: [],
  // TODO(brickhunt): decide whether production commerce seed and merchant
  // operator fields should be promoted at all. Keep manual/protected columns
  // out of updates until that contract is explicit.
  commerce_merchants: ['affiliate_network', 'name', 'source_type'],
  commerce_offer_seeds: [
    'id',
    'product_url',
    'is_active',
    'validation_status',
    'notes',
    'created_at',
    'updated_at',
  ],
};
const CATALOG_PROMOTION_FIELD_OWNERSHIP_BY_TABLE: Record<
  string,
  {
    canonical: readonly string[];
    curated: readonly string[];
    generatedRuntime: readonly string[];
    protected: readonly string[];
  }
> = {
  [CATALOG_SOURCE_THEMES_TABLE]: {
    canonical: [
      'id',
      'source_system',
      'source_theme_name',
      'parent_source_theme_id',
    ],
    curated: [],
    generatedRuntime: [],
    protected: ['created_at', 'updated_at'],
  },
  [CATALOG_THEMES_TABLE]: {
    canonical: ['id'],
    curated: [
      'display_name',
      'is_public',
      'public_accent_color',
      'public_description',
      'public_display_name',
      'public_hero_text_color',
      'public_homepage_order',
      'public_image_url',
      'public_logo_url',
      'public_order',
      'public_surface_color',
      'public_surface_text_color',
      'slug',
      'status',
    ],
    generatedRuntime: [],
    protected: ['created_at', 'updated_at'],
  },
  [CATALOG_THEME_MAPPINGS_TABLE]: {
    canonical: ['source_theme_id', 'primary_theme_id'],
    curated: [],
    generatedRuntime: [],
    protected: ['created_at', 'updated_at'],
  },
  [CATALOG_SETS_TABLE]: {
    canonical: [
      'set_id',
      'source_set_number',
      'slug',
      'name',
      'source_theme_id',
      'primary_theme_id',
      'release_year',
      'piece_count',
      'image_url',
      'source',
      'status',
    ],
    curated: [],
    generatedRuntime: [],
    protected: ['created_at', 'updated_at'],
  },
  [CATALOG_SET_MINIFIG_SUMMARIES_TABLE]: {
    canonical: ['set_id', 'source_system'],
    curated: [],
    generatedRuntime: ['minifig_count', 'source_minifig_count', 'synced_at'],
    protected: ['created_at', 'updated_at'],
  },
  [COMMERCE_MERCHANTS_TABLE]: {
    canonical: ['id', 'slug', 'name', 'source_type', 'affiliate_network'],
    curated: [],
    generatedRuntime: [],
    protected: ['is_active', 'notes', 'created_at', 'updated_at'],
  },
  [COMMERCE_BENCHMARK_SETS_TABLE]: {
    canonical: ['set_id'],
    curated: [],
    generatedRuntime: [],
    protected: ['notes', 'created_at', 'updated_at'],
  },
  [COMMERCE_OFFER_SEEDS_TABLE]: {
    canonical: [
      'id',
      'set_id',
      'merchant_id',
      'product_url',
      'is_active',
      'validation_status',
      'notes',
    ],
    curated: [],
    generatedRuntime: [],
    protected: ['last_verified_at', 'created_at', 'updated_at'],
  },
};

type CatalogPromotionSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

interface CatalogSourceThemeRow {
  created_at: string;
  id: string;
  parent_source_theme_id: string | null;
  source_system: string;
  source_theme_name: string;
  updated_at: string;
}

interface CatalogThemeRow {
  created_at: string;
  display_name: string;
  id: string;
  is_public: boolean;
  public_accent_color: string | null;
  public_description: string | null;
  public_display_name: string | null;
  public_hero_text_color: string | null;
  public_homepage_order: number | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_order: number | null;
  public_surface_color: string | null;
  public_surface_text_color: string | null;
  slug: string;
  status: string;
  updated_at: string;
}

interface CatalogThemeMappingRow {
  created_at: string;
  primary_theme_id: string;
  source_theme_id: string;
  updated_at: string;
}

interface CatalogSetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  primary_theme_id: string | null;
  release_year: number;
  set_id: string;
  slug: string;
  source: string;
  source_set_number: string;
  source_theme_id: string | null;
  status: string;
  updated_at: string;
}

interface CatalogSetMinifigSummaryRow {
  created_at: string;
  minifig_count: number;
  set_id: string;
  source_minifig_count: number | null;
  source_system: string;
  synced_at: string;
  updated_at: string;
}

interface CommerceMerchantRow {
  affiliate_network: string | null;
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  slug: string;
  source_type: string;
  updated_at: string;
}

interface CommerceBenchmarkSetRow {
  created_at: string;
  notes: string | null;
  set_id: string;
  updated_at: string;
}

interface CommerceOfferSeedRow {
  created_at: string;
  id: string;
  is_active: boolean;
  last_verified_at: string | null;
  merchant_id: string;
  notes: string | null;
  product_url: string;
  set_id: string;
  updated_at: string;
  validation_status: string;
}

export interface CatalogPromotionTableSummary {
  insertedCount: number;
  readCount: number;
  updatedCount: number;
  upsertedCount: number;
}

export interface CatalogPromotionResult {
  changedThemeSlugs: string[];
  durationMs: number;
  startedAt: string;
  status: 'ok';
  tables: {
    catalog_source_themes: CatalogPromotionTableSummary;
    catalog_themes: CatalogPromotionTableSummary;
    catalog_theme_mappings: CatalogPromotionTableSummary;
    catalog_sets: CatalogPromotionTableSummary;
    catalog_set_minifig_summaries: CatalogPromotionTableSummary;
    commerce_merchants: CatalogPromotionTableSummary;
    commerce_benchmark_sets: CatalogPromotionTableSummary;
    commerce_offer_seeds: CatalogPromotionTableSummary;
  };
}

export interface PromoteCatalogFromStagingToProductionDependencies {
  createProductionSupabaseClient?: () => CatalogPromotionSupabaseClient;
  createStagingSupabaseClient?: () => CatalogPromotionSupabaseClient;
  now?: () => Date;
}

interface CommerceMerchantPromotionPlan {
  merchantIdByStagingId: Map<string, string>;
  rowsForUpsert: CommerceMerchantRow[];
}

type ProductionOfferSeedIdentity = Pick<
  CommerceOfferSeedRow,
  'id' | 'merchant_id' | 'set_id'
> &
  Partial<
    Pick<
      CommerceOfferSeedRow,
      'created_at' | 'is_active' | 'notes' | 'updated_at' | 'validation_status'
    >
  >;

export class CatalogPromotionError extends Error {
  constructor(
    message: string,
    readonly context: {
      durationMs: number;
      failedTable?: string;
      tables: Partial<CatalogPromotionResult['tables']>;
    },
  ) {
    super(message);
    this.name = 'CatalogPromotionError';
  }
}

function chunkValues<TValue>(
  values: readonly TValue[],
  size: number,
): TValue[][] {
  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function splitConflictColumns(onConflict: string): string[] {
  return onConflict
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildConflictKey({
  columns,
  row,
}: {
  columns: readonly string[];
  row: Readonly<Record<string, unknown>>;
}): string {
  return columns
    .map((column) => `${column}:${String(row[column] ?? '')}`)
    .join('|');
}

function toRowRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value as Record<string, unknown>;
}

function assertPromotionReadWasNotDefaultCapped({
  readCount,
  table,
}: {
  readCount: number;
  table: string;
}) {
  if (
    CATALOG_PROMOTION_DEFAULT_CAP_GUARDED_TABLES.has(table) &&
    readCount === CATALOG_PROMOTION_PAGE_SIZE
  ) {
    throw new Error(
      `Catalog promotion read for ${table} returned exactly ${CATALOG_PROMOTION_PAGE_SIZE} rows. This table is expected to exceed Supabase's default cap, so aborting to avoid promoting a truncated staging snapshot.`,
    );
  }
}

function readRequiredPromotionString({
  column,
  row,
  table,
}: {
  column: string;
  row: Readonly<Record<string, unknown>>;
  table: string;
}): string {
  const value = row[column];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Unable to promote ${table}. Required column ${column} is missing for row ${JSON.stringify(row)}.`,
    );
  }

  return value;
}

function readRequiredPromotionBoolean({
  column,
  row,
  table,
}: {
  column: string;
  row: Readonly<Record<string, unknown>>;
  table: string;
}): boolean {
  const value = row[column];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Unable to promote ${table}. Required column ${column} is missing for row ${JSON.stringify(row)}.`,
    );
  }

  return value;
}

function readRequiredPromotionNumber({
  column,
  row,
  table,
}: {
  column: string;
  row: Readonly<Record<string, unknown>>;
  table: string;
}): number {
  const value = row[column];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Unable to promote ${table}. Required column ${column} is missing for row ${JSON.stringify(row)}.`,
    );
  }

  return value;
}

function readOptionalPromotionBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readOptionalPromotionString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function hasInvalidPromotionTimestamp(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim())
  );
}

function normalizePromotionTimestamps<
  TRow extends { created_at?: unknown; updated_at?: unknown },
>({
  nowIso,
  row,
}: {
  nowIso: string;
  row: TRow;
}): TRow & {
  created_at: string;
  updated_at: string;
} {
  return {
    ...row,
    created_at: readOptionalPromotionString(row.created_at) ?? nowIso,
    updated_at: readOptionalPromotionString(row.updated_at) ?? nowIso,
  };
}

function countRowsWithInvalidPromotionTimestamp({
  column,
  rows,
}: {
  column: 'created_at' | 'updated_at';
  rows: readonly Readonly<Record<string, unknown>>[];
}): number {
  return rows.filter(
    (row) =>
      Object.prototype.hasOwnProperty.call(row, column) &&
      hasInvalidPromotionTimestamp(row[column]),
  ).length;
}

function countRowsWithInvalidPromotionBoolean({
  column,
  rows,
}: {
  column: string;
  rows: readonly Readonly<Record<string, unknown>>[];
}): number {
  return rows.filter(
    (row) => readOptionalPromotionBoolean(row[column]) === undefined,
  ).length;
}

function countRowsWithInvalidPromotionString({
  column,
  rows,
}: {
  column: string;
  rows: readonly Readonly<Record<string, unknown>>[];
}): number {
  return rows.filter(
    (row) => readOptionalPromotionString(row[column]) === undefined,
  ).length;
}

function sanitizePromotionUpsertTimestamps({
  nowIso,
  rows,
  table,
}: {
  nowIso: string;
  rows: readonly Record<string, unknown>[];
  table: string;
}): Record<string, unknown>[] {
  if (!CATALOG_PROMOTION_TIMESTAMPED_TABLES.has(table)) {
    return [...rows];
  }

  return rows.map((row) => {
    const sanitizedRow = { ...row };

    if (
      Object.prototype.hasOwnProperty.call(sanitizedRow, 'created_at') &&
      hasInvalidPromotionTimestamp(sanitizedRow['created_at'])
    ) {
      sanitizedRow['created_at'] = nowIso;
    }

    if (
      Object.prototype.hasOwnProperty.call(sanitizedRow, 'updated_at') &&
      hasInvalidPromotionTimestamp(sanitizedRow['updated_at'])
    ) {
      sanitizedRow['updated_at'] = nowIso;
    }

    return sanitizedRow;
  });
}

function logCatalogThemeIsPublicNormalization({
  rowsAfter,
  rowsBefore,
}: {
  rowsAfter: readonly Readonly<Record<string, unknown>>[];
  rowsBefore: readonly Readonly<Record<string, unknown>>[];
}): void {
  const nullOrMissingBefore = countRowsWithInvalidPromotionBoolean({
    column: 'is_public',
    rows: rowsBefore,
  });

  if (nullOrMissingBefore === 0) {
    return;
  }

  console.info('[catalog-promotion] catalog theme boolean payload normalized', {
    inputRows: rowsBefore.length,
    nullOrMissingIsPublicAfterNormalize: countRowsWithInvalidPromotionBoolean({
      column: 'is_public',
      rows: rowsAfter,
    }),
    nullOrMissingIsPublicBeforeNormalize: nullOrMissingBefore,
    table: CATALOG_THEMES_TABLE,
  });
}

function logCatalogSetStatusNormalization({
  rowsAfter,
  rowsBefore,
}: {
  rowsAfter: readonly Readonly<Record<string, unknown>>[];
  rowsBefore: readonly Readonly<Record<string, unknown>>[];
}): void {
  const nullOrMissingBefore = countRowsWithInvalidPromotionString({
    column: 'status',
    rows: rowsBefore,
  });

  if (nullOrMissingBefore === 0) {
    return;
  }

  console.info('[catalog-promotion] catalog set status payload normalized', {
    inputRows: rowsBefore.length,
    nullOrMissingStatusAfterNormalize: countRowsWithInvalidPromotionString({
      column: 'status',
      rows: rowsAfter,
    }),
    nullOrMissingStatusBeforeNormalize: nullOrMissingBefore,
    table: CATALOG_SETS_TABLE,
  });
}

function logPromotionUpsertTimestampSanitization({
  rowsAfter,
  rowsBefore,
  table,
}: {
  rowsAfter: readonly Readonly<Record<string, unknown>>[];
  rowsBefore: readonly Readonly<Record<string, unknown>>[];
  table: string;
}): void {
  if (!CATALOG_PROMOTION_TIMESTAMPED_TABLES.has(table)) {
    return;
  }

  console.info('[catalog-promotion] timestamp upsert payload sanitized', {
    inputRows: rowsBefore.length,
    nullCreatedAtAfterSanitize: countRowsWithInvalidPromotionTimestamp({
      column: 'created_at',
      rows: rowsAfter,
    }),
    nullCreatedAtBeforeSanitize: countRowsWithInvalidPromotionTimestamp({
      column: 'created_at',
      rows: rowsBefore,
    }),
    nullUpdatedAtAfterSanitize: countRowsWithInvalidPromotionTimestamp({
      column: 'updated_at',
      rows: rowsAfter,
    }),
    nullUpdatedAtBeforeSanitize: countRowsWithInvalidPromotionTimestamp({
      column: 'updated_at',
      rows: rowsBefore,
    }),
    table,
  });
}

function normalizeCatalogThemeRow({
  nowIso,
  theme,
}: {
  nowIso: string;
  theme: CatalogThemeRow;
}): CatalogThemeRow {
  const displayName = readRequiredPromotionString({
    column: 'display_name',
    row: theme as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_THEMES_TABLE,
  });
  const id = readRequiredPromotionString({
    column: 'id',
    row: theme as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_THEMES_TABLE,
  });
  const normalizedSlug =
    typeof theme.slug === 'string' && theme.slug.trim()
      ? theme.slug.trim()
      : buildCatalogThemeSlug(displayName || id.replace(/^theme:/u, ''));

  if (!normalizedSlug) {
    throw new Error(
      `Unable to promote ${CATALOG_THEMES_TABLE}. Required column slug is missing for row ${JSON.stringify(theme)}.`,
    );
  }

  return {
    ...theme,
    created_at: readOptionalPromotionString(theme.created_at) ?? nowIso,
    display_name: displayName,
    id,
    is_public: readOptionalPromotionBoolean(theme.is_public) ?? false,
    public_order:
      typeof theme.public_order === 'number' &&
      Number.isFinite(theme.public_order)
        ? theme.public_order
        : null,
    public_homepage_order:
      typeof theme.public_homepage_order === 'number' &&
      Number.isFinite(theme.public_homepage_order)
        ? theme.public_homepage_order
        : null,
    slug: normalizedSlug,
    status: readOptionalPromotionString(theme.status) ?? 'active',
    updated_at: readOptionalPromotionString(theme.updated_at) ?? nowIso,
  };
}

function normalizeCatalogSetRow(catalogSet: CatalogSetRow): CatalogSetRow {
  const name = readRequiredPromotionString({
    column: 'name',
    row: catalogSet as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_SETS_TABLE,
  });
  const setId = readRequiredPromotionString({
    column: 'set_id',
    row: catalogSet as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_SETS_TABLE,
  });
  const normalizedSlug =
    typeof catalogSet.slug === 'string' && catalogSet.slug.trim()
      ? catalogSet.slug.trim()
      : buildCatalogSetSlug(name, setId);

  if (!normalizedSlug) {
    throw new Error(
      `Unable to promote ${CATALOG_SETS_TABLE}. Required column slug is missing for row ${JSON.stringify(catalogSet)}.`,
    );
  }

  return {
    ...catalogSet,
    name,
    set_id: setId,
    slug: normalizedSlug,
    status: readOptionalPromotionString(catalogSet.status) ?? 'active',
  };
}

function normalizeCatalogSetMinifigSummaryRow({
  nowIso,
  summary,
}: {
  nowIso: string;
  summary: CatalogSetMinifigSummaryRow;
}): CatalogSetMinifigSummaryRow {
  const setId = readRequiredPromotionString({
    column: 'set_id',
    row: summary as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
  });

  return normalizePromotionTimestamps({
    nowIso,
    row: {
      ...summary,
      minifig_count:
        typeof summary.minifig_count === 'number' &&
        Number.isInteger(summary.minifig_count) &&
        summary.minifig_count >= 0
          ? summary.minifig_count
          : 0,
      set_id: setId,
      source_minifig_count:
        typeof summary.source_minifig_count === 'number' &&
        Number.isInteger(summary.source_minifig_count) &&
        summary.source_minifig_count >= 0
          ? summary.source_minifig_count
          : null,
      source_system:
        readOptionalPromotionString(summary.source_system) ?? 'rebrickable',
      synced_at: readOptionalPromotionString(summary.synced_at) ?? nowIso,
    },
  });
}

function validatePromotionRowsRequiredColumns({
  columns,
  rows,
  table,
}: {
  columns: readonly string[];
  rows: readonly Readonly<Record<string, unknown>>[];
  table: string;
}) {
  for (const row of rows) {
    for (const column of columns) {
      readRequiredPromotionString({
        column,
        row,
        table,
      });
    }
  }
}

function validatePromotionRowsRequiredBooleanColumns({
  columns,
  rows,
  table,
}: {
  columns: readonly string[];
  rows: readonly Readonly<Record<string, unknown>>[];
  table: string;
}) {
  for (const row of rows) {
    for (const column of columns) {
      readRequiredPromotionBoolean({
        column,
        row,
        table,
      });
    }
  }
}

function validatePromotionRowsRequiredNumberColumns({
  columns,
  rows,
  table,
}: {
  columns: readonly string[];
  rows: readonly Readonly<Record<string, unknown>>[];
  table: string;
}) {
  for (const row of rows) {
    for (const column of columns) {
      readRequiredPromotionNumber({
        column,
        row,
        table,
      });
    }
  }
}

function hasBlankOptionalPromotionValue(value: unknown): boolean {
  return value === null || (typeof value === 'string' && !value.trim());
}

function valuesArePromotionEqual(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function isPublicCatalogThemeForRevalidation(
  row: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    row?.['is_public'] === true &&
    (readOptionalPromotionString(row['status']) ?? 'active') === 'active'
  );
}

function readCatalogThemeSlugForRevalidation(
  row: Readonly<Record<string, unknown>>,
): string | undefined {
  return readOptionalPromotionString(row['slug']);
}

function incrementPromotionFieldCount({
  counts,
  field,
}: {
  counts: Map<string, number>;
  field: string;
}): void {
  counts.set(field, (counts.get(field) ?? 0) + 1);
}

function toSortedFieldCountRecord(
  counts: ReadonlyMap<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function categorizePromotionField({
  field,
  table,
}: {
  field: string;
  table: string;
}): 'canonical' | 'curated' | 'generatedRuntime' | 'protected' {
  const ownership = CATALOG_PROMOTION_FIELD_OWNERSHIP_BY_TABLE[table];

  if (ownership?.curated.includes(field)) {
    return 'curated';
  }

  if (ownership?.generatedRuntime.includes(field)) {
    return 'generatedRuntime';
  }

  if (ownership?.canonical.includes(field)) {
    return 'canonical';
  }

  return 'protected';
}

function selectPromotionUpsertColumns({
  conflictColumns,
  existingRow,
  isExistingRow,
  row,
  table,
}: {
  conflictColumns: readonly string[];
  existingRow?: Readonly<Record<string, unknown>>;
  isExistingRow: boolean;
  row: Readonly<Record<string, unknown>>;
  table: string;
}): Record<string, unknown> {
  if (!isExistingRow) {
    return { ...row };
  }

  const mutableColumns =
    CATALOG_PROMOTION_MUTABLE_COLUMNS_BY_TABLE[table] ?? [];
  const allowedColumns = new Set([...conflictColumns, ...mutableColumns]);

  return Object.fromEntries(
    Object.entries(row).filter(([column, value]) => {
      if (!allowedColumns.has(column)) {
        return false;
      }

      if (
        table === CATALOG_THEMES_TABLE &&
        [
          'public_accent_color',
          'public_description',
          'public_display_name',
          'public_image_url',
          'public_logo_url',
          'public_order',
        ].includes(column) &&
        (hasBlankOptionalPromotionValue(value) ||
          (isExistingRow &&
            !hasBlankOptionalPromotionValue(existingRow?.[column])))
      ) {
        return false;
      }

      return true;
    }),
  );
}

function finalizePromotionUpsertRow({
  existingRow,
  nowIso,
  row,
  sourceRow,
  table,
}: {
  existingRow?: Readonly<Record<string, unknown>>;
  nowIso: string;
  row: Record<string, unknown>;
  sourceRow: Readonly<Record<string, unknown>>;
  table: string;
}): Record<string, unknown> {
  if (table !== CATALOG_THEMES_TABLE) {
    return row;
  }

  return {
    ...row,
    created_at:
      readOptionalPromotionString(existingRow?.['created_at']) ??
      readOptionalPromotionString(sourceRow['created_at']) ??
      readOptionalPromotionString(row['created_at']) ??
      nowIso,
    updated_at:
      readOptionalPromotionString(existingRow?.['updated_at']) ??
      readOptionalPromotionString(sourceRow['updated_at']) ??
      readOptionalPromotionString(row['updated_at']) ??
      nowIso,
    ...(existingRow
      ? {}
      : {
          status:
            readOptionalPromotionString(row['status']) ??
            readOptionalPromotionString(sourceRow['status']) ??
            'active',
        }),
  };
}

function createPromotionClients(): {
  productionSupabaseClient: CatalogPromotionSupabaseClient;
  stagingSupabaseClient: CatalogPromotionSupabaseClient;
} {
  return {
    productionSupabaseClient: createSupabaseAdminClient(
      getServerSupabaseConfig(),
    ),
    stagingSupabaseClient: createSupabaseAdminClient(
      getStagingSupabaseConfig(),
    ),
  };
}

function normalizeMerchantRow(
  merchant: CommerceMerchantRow,
): CommerceMerchantRow {
  return {
    ...merchant,
    notes: merchant.notes ?? '',
  };
}

function normalizeBenchmarkSetRow(
  benchmarkSet: CommerceBenchmarkSetRow,
): CommerceBenchmarkSetRow {
  return {
    ...benchmarkSet,
    notes: benchmarkSet.notes ?? '',
  };
}

function normalizeOfferSeedRow(
  offerSeed: CommerceOfferSeedRow,
): CommerceOfferSeedRow {
  return offerSeed;
}

async function readOrderedRows<TRow>({
  columns,
  orderBy,
  supabaseClient,
  table,
}: {
  columns: string;
  orderBy: string;
  supabaseClient: CatalogPromotionSupabaseClient;
  table: string;
}): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += CATALOG_PROMOTION_PAGE_SIZE) {
    const to = from + CATALOG_PROMOTION_PAGE_SIZE - 1;
    const { data, error } = await supabaseClient
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Unable to read ${table} from staging. ${JSON.stringify(error)}`,
      );
    }

    const pageRows = (data as unknown as TRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_PROMOTION_PAGE_SIZE) {
      return rows;
    }
  }
}

function listExistingPromotionInspectionColumns({
  conflictColumns,
  table,
}: {
  conflictColumns: readonly string[];
  table: string;
}): string {
  const ownership = CATALOG_PROMOTION_FIELD_OWNERSHIP_BY_TABLE[table];
  const mutableColumns =
    CATALOG_PROMOTION_MUTABLE_COLUMNS_BY_TABLE[table] ?? [];

  return [
    ...new Set([
      ...conflictColumns,
      ...mutableColumns,
      ...(ownership?.canonical ?? []),
      ...(ownership?.curated ?? []),
      ...(ownership?.generatedRuntime ?? []),
      ...(ownership?.protected ?? []),
    ]),
  ].join(', ');
}

async function listExistingConflictRows({
  onConflict,
  supabaseClient,
  table,
}: {
  onConflict: string;
  supabaseClient: CatalogPromotionSupabaseClient;
  table: string;
}): Promise<Map<string, Readonly<Record<string, unknown>>>> {
  const conflictColumns = splitConflictColumns(onConflict);
  const rows: Record<string, unknown>[] = [];
  const selectColumns = listExistingPromotionInspectionColumns({
    conflictColumns,
    table,
  });

  for (let from = 0; ; from += CATALOG_PROMOTION_PAGE_SIZE) {
    const to = from + CATALOG_PROMOTION_PAGE_SIZE - 1;
    const { data, error } = await supabaseClient
      .from(table)
      .select(selectColumns)
      .range(from, to);

    if (error) {
      throw new Error(
        `Unable to inspect existing ${table} rows before promotion. ${JSON.stringify(error)}`,
      );
    }

    const pageRows =
      (data as unknown as Record<string, unknown>[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_PROMOTION_PAGE_SIZE) {
      break;
    }
  }

  return new Map(
    rows.map((row) => [
      buildConflictKey({
        columns: conflictColumns,
        row,
      }),
      row,
    ]),
  );
}

async function upsertRows<TRow>({
  nowIso,
  onConflict,
  rows,
  supabaseClient,
  table,
}: {
  nowIso: string;
  onConflict: string;
  rows: readonly TRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
  table: string;
}): Promise<CatalogPromotionTableSummary> {
  if (rows.length === 0) {
    return {
      insertedCount: 0,
      readCount: 0,
      updatedCount: 0,
      upsertedCount: 0,
    };
  }

  const conflictColumns = splitConflictColumns(onConflict);
  const existingRowsByConflictKey = await listExistingConflictRows({
    onConflict,
    supabaseClient,
    table,
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let productionPresentationPreservedCount = 0;
  const changedCanonicalFields = new Map<string, number>();
  const changedCuratedFields = new Map<string, number>();
  const changedGeneratedRuntimeFields = new Map<string, number>();
  const skippedProtectedFields = new Map<string, number>();

  for (const row of rows) {
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row: toRowRecord(row),
    });

    if (existingRowsByConflictKey.has(conflictKey)) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  const projectedRowsForUpsert = rows.map((row) => {
    const rowRecord = toRowRecord(row);
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row: rowRecord,
    });

    const existingRow = existingRowsByConflictKey.get(conflictKey);
    const projectedRow = selectPromotionUpsertColumns({
      conflictColumns,
      existingRow,
      isExistingRow: existingRowsByConflictKey.has(conflictKey),
      row: rowRecord,
      table,
    });

    if (existingRow) {
      for (const [field, value] of Object.entries(projectedRow)) {
        if (
          Object.prototype.hasOwnProperty.call(existingRow, field) &&
          !valuesArePromotionEqual(existingRow[field], value)
        ) {
          const category = categorizePromotionField({ field, table });

          if (category === 'curated') {
            incrementPromotionFieldCount({
              counts: changedCuratedFields,
              field,
            });
          } else if (category === 'generatedRuntime') {
            incrementPromotionFieldCount({
              counts: changedGeneratedRuntimeFields,
              field,
            });
          } else {
            incrementPromotionFieldCount({
              counts: changedCanonicalFields,
              field,
            });
          }
        }
      }

      for (const [field, value] of Object.entries(rowRecord)) {
        if (
          !Object.prototype.hasOwnProperty.call(projectedRow, field) &&
          Object.prototype.hasOwnProperty.call(existingRow, field) &&
          !valuesArePromotionEqual(existingRow[field], value)
        ) {
          incrementPromotionFieldCount({
            counts: skippedProtectedFields,
            field,
          });
        }
      }

      if (
        table === CATALOG_THEMES_TABLE &&
        CATALOG_THEME_PRODUCTION_OWNED_PRESENTATION_FIELDS.some(
          (field) =>
            Object.prototype.hasOwnProperty.call(existingRow, field) &&
            Object.prototype.hasOwnProperty.call(rowRecord, field) &&
            !valuesArePromotionEqual(existingRow[field], rowRecord[field]),
        )
      ) {
        productionPresentationPreservedCount += 1;
      }
    }

    return finalizePromotionUpsertRow({
      existingRow,
      nowIso,
      row: projectedRow,
      sourceRow: rowRecord,
      table,
    });
  });

  console.info('[catalog-promotion] table promotion plan', {
    changedCanonicalFields: toSortedFieldCountRecord(changedCanonicalFields),
    changedCuratedFields: toSortedFieldCountRecord(changedCuratedFields),
    changedGeneratedRuntimeFields: toSortedFieldCountRecord(
      changedGeneratedRuntimeFields,
    ),
    insertedCount,
    readCount: rows.length,
    skippedProtectedFields: toSortedFieldCountRecord(skippedProtectedFields),
    table,
    ...(table === CATALOG_THEMES_TABLE
      ? {
          themes_inserted: insertedCount,
          themes_presentation_preserved: productionPresentationPreservedCount,
          themes_updated_canonical: updatedCount,
        }
      : {}),
    ...(table === CATALOG_SOURCE_THEMES_TABLE
      ? {
          source_themes_inserted: insertedCount,
          source_themes_updated: updatedCount,
        }
      : {}),
    ...(table === CATALOG_THEME_MAPPINGS_TABLE
      ? {
          mappings_inserted: insertedCount,
          mappings_updated: updatedCount,
        }
      : {}),
    updatedCount,
  });

  const rowsForUpsert = sanitizePromotionUpsertTimestamps({
    nowIso,
    rows: projectedRowsForUpsert,
    table,
  });

  logPromotionUpsertTimestampSanitization({
    rowsAfter: rowsForUpsert,
    rowsBefore: projectedRowsForUpsert,
    table,
  });

  for (const chunk of chunkValues(rowsForUpsert, 100)) {
    const { error } = await supabaseClient.from(table).upsert(chunk, {
      onConflict,
    });

    if (error) {
      throw new Error(
        `Unable to upsert ${table} into production. ${JSON.stringify(error)}`,
      );
    }
  }

  return {
    insertedCount,
    readCount: rows.length,
    updatedCount,
    upsertedCount: rows.length,
  };
}

async function listChangedPublicCatalogThemeSlugs({
  nowIso,
  rows,
  supabaseClient,
}: {
  nowIso: string;
  rows: readonly CatalogThemeRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<string[]> {
  if (rows.length === 0) {
    return [];
  }

  const conflictColumns = ['id'];
  const existingRowsByConflictKey = await listExistingConflictRows({
    onConflict: 'id',
    supabaseClient,
    table: CATALOG_THEMES_TABLE,
  });
  const changedSlugs = new Set<string>();

  for (const theme of rows) {
    const rowRecord = toRowRecord(theme);
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row: rowRecord,
    });
    const existingRow = existingRowsByConflictKey.get(conflictKey);
    const projectedRow = finalizePromotionUpsertRow({
      existingRow,
      nowIso,
      row: selectPromotionUpsertColumns({
        conflictColumns,
        existingRow,
        isExistingRow: Boolean(existingRow),
        row: rowRecord,
        table: CATALOG_THEMES_TABLE,
      }),
      sourceRow: rowRecord,
      table: CATALOG_THEMES_TABLE,
    });

    const wasPublic = isPublicCatalogThemeForRevalidation(existingRow);
    const willBePublic = isPublicCatalogThemeForRevalidation({
      ...existingRow,
      ...projectedRow,
    });

    if (!wasPublic && !willBePublic) {
      continue;
    }

    const changedPublicField = CATALOG_THEME_PUBLIC_REVALIDATION_FIELDS.some(
      (field) =>
        Object.prototype.hasOwnProperty.call(projectedRow, field) &&
        !valuesArePromotionEqual(existingRow?.[field], projectedRow[field]),
    );

    if (!changedPublicField && existingRow) {
      continue;
    }

    const slug =
      readCatalogThemeSlugForRevalidation(projectedRow) ??
      readCatalogThemeSlugForRevalidation(existingRow ?? {});

    if (slug) {
      changedSlugs.add(slug);
    }
  }

  return [...changedSlugs].sort((left, right) => left.localeCompare(right));
}

async function refreshCatalogThemeSummaries({
  supabaseClient,
}: {
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient.rpc('refresh_catalog_theme_summaries');

  if (error) {
    throw new Error(
      `Unable to refresh catalog theme summaries after catalog promotion. ${JSON.stringify(error)}`,
    );
  }
}

async function listProductionMerchants({
  supabaseClient,
}: {
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<Array<Pick<CommerceMerchantRow, 'id' | 'slug'>>> {
  const rows: Array<Pick<CommerceMerchantRow, 'id' | 'slug'>> = [];

  for (let from = 0; ; from += CATALOG_PROMOTION_PAGE_SIZE) {
    const to = from + CATALOG_PROMOTION_PAGE_SIZE - 1;
    const { data, error } = await supabaseClient
      .from(COMMERCE_MERCHANTS_TABLE)
      .select('id, slug')
      .order('slug', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Unable to inspect existing ${COMMERCE_MERCHANTS_TABLE} rows before promotion. ${JSON.stringify(error)}`,
      );
    }

    const pageRows =
      (data as unknown as Array<
        Pick<CommerceMerchantRow, 'id' | 'slug'>
      > | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_PROMOTION_PAGE_SIZE) {
      return rows;
    }
  }
}

async function listProductionOfferSeeds({
  supabaseClient,
}: {
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<ProductionOfferSeedIdentity[]> {
  const rows: ProductionOfferSeedIdentity[] = [];

  for (let from = 0; ; from += CATALOG_PROMOTION_PAGE_SIZE) {
    const to = from + CATALOG_PROMOTION_PAGE_SIZE - 1;
    const { data, error } = await supabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, is_active, validation_status, notes, created_at, updated_at',
      )
      .order('set_id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Unable to inspect existing ${COMMERCE_OFFER_SEEDS_TABLE} rows before promotion. ${JSON.stringify(error)}`,
      );
    }

    const pageRows =
      (data as unknown as ProductionOfferSeedIdentity[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_PROMOTION_PAGE_SIZE) {
      return rows;
    }
  }
}

async function planMerchantsBySlug({
  rows,
  supabaseClient,
}: {
  rows: readonly CommerceMerchantRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<CommerceMerchantPromotionPlan> {
  const existingMerchants = await listProductionMerchants({
    supabaseClient,
  });
  const existingMerchantIdBySlug = new Map(
    existingMerchants.map((merchant) => [merchant.slug, merchant.id]),
  );
  const merchantIdByStagingId = new Map<string, string>();
  const rowsForUpsert = rows.map((merchant) => {
    const targetId = existingMerchantIdBySlug.get(merchant.slug) ?? merchant.id;

    merchantIdByStagingId.set(merchant.id, targetId);

    return {
      ...merchant,
      id: targetId,
    };
  });

  return {
    merchantIdByStagingId,
    rowsForUpsert,
  };
}

async function upsertMerchantsBySlug({
  nowIso,
  plan,
  supabaseClient,
}: {
  nowIso: string;
  plan: CommerceMerchantPromotionPlan;
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<CatalogPromotionTableSummary> {
  return upsertRows({
    nowIso,
    onConflict: 'slug',
    rows: plan.rowsForUpsert,
    supabaseClient,
    table: COMMERCE_MERCHANTS_TABLE,
  });
}

function resolveOfferSeedsByCompositeKey({
  existingOfferSeeds,
  merchantIdByStagingId,
  nowIso,
  rows,
}: {
  existingOfferSeeds: readonly ProductionOfferSeedIdentity[];
  merchantIdByStagingId: ReadonlyMap<string, string>;
  nowIso: string;
  rows: readonly CommerceOfferSeedRow[];
}): CommerceOfferSeedRow[] {
  const existingOfferSeedByKey = new Map(
    existingOfferSeeds.map((offerSeed) => [
      `${offerSeed.set_id}::${offerSeed.merchant_id}`,
      offerSeed,
    ]),
  );
  return rows.map((offerSeed) => {
    const stagingMerchantId = readRequiredPromotionString({
      column: 'merchant_id',
      row: offerSeed as unknown as Readonly<Record<string, unknown>>,
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });
    const setId = readRequiredPromotionString({
      column: 'set_id',
      row: offerSeed as unknown as Readonly<Record<string, unknown>>,
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });
    const productUrl = readRequiredPromotionString({
      column: 'product_url',
      row: offerSeed as unknown as Readonly<Record<string, unknown>>,
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });
    const targetMerchantId = merchantIdByStagingId.get(stagingMerchantId);

    if (!targetMerchantId) {
      throw new Error(
        `Unable to map staging merchant ${offerSeed.merchant_id} for offer seed ${offerSeed.id}.`,
      );
    }

    const compositeKey = `${setId}::${targetMerchantId}`;
    const existingOfferSeed = existingOfferSeedByKey.get(compositeKey);
    const stagingId =
      typeof offerSeed.id === 'string' && offerSeed.id.trim()
        ? offerSeed.id.trim()
        : undefined;
    const targetId = existingOfferSeed?.id ?? stagingId;

    if (!targetId) {
      throw new Error(
        `Unable to promote ${COMMERCE_OFFER_SEEDS_TABLE}. Required column id is missing for new row set_id=${setId}, merchant_id=${targetMerchantId}.`,
      );
    }

    const isActive =
      readOptionalPromotionBoolean(offerSeed.is_active) ??
      readOptionalPromotionBoolean(existingOfferSeed?.is_active) ??
      true;
    const validationStatus =
      readOptionalPromotionString(offerSeed.validation_status) ??
      readOptionalPromotionString(existingOfferSeed?.validation_status) ??
      'pending';
    const notes =
      typeof offerSeed.notes === 'string'
        ? offerSeed.notes
        : (existingOfferSeed?.notes ?? '');
    const createdAt =
      readOptionalPromotionString(offerSeed.created_at) ??
      readOptionalPromotionString(existingOfferSeed?.created_at) ??
      nowIso;
    const updatedAt =
      readOptionalPromotionString(offerSeed.updated_at) ??
      readOptionalPromotionString(existingOfferSeed?.updated_at) ??
      nowIso;

    return {
      ...offerSeed,
      created_at: createdAt,
      id: targetId,
      is_active: isActive,
      merchant_id: targetMerchantId,
      notes,
      product_url: productUrl,
      set_id: setId,
      updated_at: updatedAt,
      validation_status: validationStatus,
    };
  });
}

async function upsertOfferSeedsByCompositeKey({
  nowIso,
  rows,
  supabaseClient,
}: {
  nowIso: string;
  rows: readonly CommerceOfferSeedRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<CatalogPromotionTableSummary> {
  return upsertRows({
    nowIso,
    onConflict: 'set_id,merchant_id',
    rows,
    supabaseClient,
    table: COMMERCE_OFFER_SEEDS_TABLE,
  });
}

export async function promoteCatalogFromStagingToProduction({
  createProductionSupabaseClient,
  createStagingSupabaseClient,
  now = () => new Date(),
}: PromoteCatalogFromStagingToProductionDependencies = {}): Promise<CatalogPromotionResult> {
  const startedAt = now();
  const startedAtIso = startedAt.toISOString();
  let promotionClients: ReturnType<typeof createPromotionClients> | undefined;
  const getPromotionClients = () => {
    promotionClients ??= createPromotionClients();

    return promotionClients;
  };
  const stagingSupabaseClient =
    createStagingSupabaseClient?.() ??
    getPromotionClients().stagingSupabaseClient;
  const productionSupabaseClient =
    createProductionSupabaseClient?.() ??
    getPromotionClients().productionSupabaseClient;
  const tables: Partial<CatalogPromotionResult['tables']> = {};

  try {
    const [
      catalogSourceThemes,
      catalogThemes,
      catalogThemeMappings,
      catalogSets,
      catalogSetMinifigSummaries,
      commerceMerchants,
      commerceBenchmarkSets,
      commerceOfferSeeds,
    ] = await Promise.all([
      readOrderedRows<CatalogSourceThemeRow>({
        columns:
          'id, source_system, source_theme_name, parent_source_theme_id, created_at, updated_at',
        orderBy: 'id',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_SOURCE_THEMES_TABLE,
      }),
      readOrderedRows<CatalogThemeRow>({
        columns:
          'id, slug, display_name, is_public, public_display_name, public_description, public_image_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_logo_url, public_homepage_order, public_order, status, created_at, updated_at',
        orderBy: 'slug',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_THEMES_TABLE,
      }),
      readOrderedRows<CatalogThemeMappingRow>({
        columns: 'source_theme_id, primary_theme_id, created_at, updated_at',
        orderBy: 'source_theme_id',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_THEME_MAPPINGS_TABLE,
      }),
      readOrderedRows<CatalogSetRow>({
        columns:
          'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
        orderBy: 'created_at',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_SETS_TABLE,
      }),
      readOrderedRows<CatalogSetMinifigSummaryRow>({
        columns:
          'set_id, source_system, minifig_count, source_minifig_count, synced_at, created_at, updated_at',
        orderBy: 'set_id',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
      }),
      readOrderedRows<CommerceMerchantRow>({
        columns:
          'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
        orderBy: 'slug',
        supabaseClient: stagingSupabaseClient,
        table: COMMERCE_MERCHANTS_TABLE,
      }),
      readOrderedRows<CommerceBenchmarkSetRow>({
        columns: 'set_id, notes, created_at, updated_at',
        orderBy: 'set_id',
        supabaseClient: stagingSupabaseClient,
        table: COMMERCE_BENCHMARK_SETS_TABLE,
      }),
      readOrderedRows<CommerceOfferSeedRow>({
        columns:
          'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
        orderBy: 'created_at',
        supabaseClient: stagingSupabaseClient,
        table: COMMERCE_OFFER_SEEDS_TABLE,
      }),
    ]);

    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSets.length,
      table: CATALOG_SETS_TABLE,
    });
    assertPromotionReadWasNotDefaultCapped({
      readCount: commerceOfferSeeds.length,
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });
    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSetMinifigSummaries.length,
      table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
    });

    const normalizedCatalogSourceThemes = catalogSourceThemes.map((theme) =>
      normalizePromotionTimestamps({
        nowIso: startedAtIso,
        row: theme,
      }),
    );
    const normalizedCatalogThemes = catalogThemes.map((theme) =>
      normalizeCatalogThemeRow({
        nowIso: startedAtIso,
        theme,
      }),
    );
    logCatalogThemeIsPublicNormalization({
      rowsAfter: normalizedCatalogThemes as unknown as Readonly<
        Record<string, unknown>
      >[],
      rowsBefore: catalogThemes as unknown as Readonly<
        Record<string, unknown>
      >[],
    });
    const normalizedCatalogThemeMappings = catalogThemeMappings.map((mapping) =>
      normalizePromotionTimestamps({
        nowIso: startedAtIso,
        row: mapping,
      }),
    );
    const normalizedCatalogSets = catalogSets.map((catalogSet) =>
      normalizePromotionTimestamps({
        nowIso: startedAtIso,
        row: normalizeCatalogSetRow(catalogSet),
      }),
    );
    const normalizedCatalogSetMinifigSummaries = catalogSetMinifigSummaries.map(
      (summary) =>
        normalizeCatalogSetMinifigSummaryRow({
          nowIso: startedAtIso,
          summary,
        }),
    );
    logCatalogSetStatusNormalization({
      rowsAfter: normalizedCatalogSets as unknown as Readonly<
        Record<string, unknown>
      >[],
      rowsBefore: catalogSets as unknown as Readonly<Record<string, unknown>>[],
    });
    const normalizedCommerceMerchants = commerceMerchants.map((merchant) =>
      normalizePromotionTimestamps({
        nowIso: startedAtIso,
        row: normalizeMerchantRow(merchant),
      }),
    );
    const normalizedCommerceBenchmarkSets = commerceBenchmarkSets.map(
      (benchmarkSet) =>
        normalizePromotionTimestamps({
          nowIso: startedAtIso,
          row: normalizeBenchmarkSetRow(benchmarkSet),
        }),
    );
    const normalizedCommerceOfferSeeds = commerceOfferSeeds.map(
      normalizeOfferSeedRow,
    );

    validatePromotionRowsRequiredColumns({
      columns: [
        'id',
        'source_system',
        'source_theme_name',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCatalogSourceThemes as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SOURCE_THEMES_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'id',
        'display_name',
        'slug',
        'status',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCatalogThemes as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_THEMES_TABLE,
    });
    validatePromotionRowsRequiredBooleanColumns({
      columns: ['is_public'],
      rows: normalizedCatalogThemes as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_THEMES_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'source_theme_id',
        'primary_theme_id',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCatalogThemeMappings as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_THEME_MAPPINGS_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'set_id',
        'source_set_number',
        'slug',
        'name',
        'source_theme_id',
        'primary_theme_id',
        'source',
        'status',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCatalogSets as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SETS_TABLE,
    });
    validatePromotionRowsRequiredNumberColumns({
      columns: ['release_year', 'piece_count'],
      rows: normalizedCatalogSets as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SETS_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'set_id',
        'source_system',
        'synced_at',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCatalogSetMinifigSummaries as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
    });
    validatePromotionRowsRequiredNumberColumns({
      columns: ['minifig_count'],
      rows: normalizedCatalogSetMinifigSummaries as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'id',
        'slug',
        'name',
        'source_type',
        'created_at',
        'updated_at',
      ],
      rows: normalizedCommerceMerchants as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COMMERCE_MERCHANTS_TABLE,
    });
    validatePromotionRowsRequiredBooleanColumns({
      columns: ['is_active'],
      rows: normalizedCommerceMerchants as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COMMERCE_MERCHANTS_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: ['set_id', 'created_at', 'updated_at'],
      rows: normalizedCommerceBenchmarkSets as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COMMERCE_BENCHMARK_SETS_TABLE,
    });

    const merchantPromotionPlan = await planMerchantsBySlug({
      rows: normalizedCommerceMerchants,
      supabaseClient: productionSupabaseClient,
    });
    const existingOfferSeeds = await listProductionOfferSeeds({
      supabaseClient: productionSupabaseClient,
    });
    const resolvedCommerceOfferSeeds = resolveOfferSeedsByCompositeKey({
      existingOfferSeeds,
      merchantIdByStagingId: merchantPromotionPlan.merchantIdByStagingId,
      nowIso: startedAt.toISOString(),
      rows: normalizedCommerceOfferSeeds,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'id',
        'set_id',
        'merchant_id',
        'product_url',
        'validation_status',
        'created_at',
        'updated_at',
      ],
      rows: resolvedCommerceOfferSeeds as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });
    validatePromotionRowsRequiredBooleanColumns({
      columns: ['is_active'],
      rows: resolvedCommerceOfferSeeds as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COMMERCE_OFFER_SEEDS_TABLE,
    });

    const changedThemeSlugs = await listChangedPublicCatalogThemeSlugs({
      nowIso: startedAtIso,
      rows: normalizedCatalogThemes,
      supabaseClient: productionSupabaseClient,
    });

    tables.catalog_source_themes = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'id',
      rows: normalizedCatalogSourceThemes,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SOURCE_THEMES_TABLE,
    });
    tables.catalog_themes = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'id',
      rows: normalizedCatalogThemes,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_THEMES_TABLE,
    });
    tables.catalog_theme_mappings = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'source_theme_id',
      rows: normalizedCatalogThemeMappings,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_THEME_MAPPINGS_TABLE,
    });
    tables.catalog_sets = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'set_id',
      rows: normalizedCatalogSets,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SETS_TABLE,
    });
    tables.catalog_set_minifig_summaries = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'set_id',
      rows: normalizedCatalogSetMinifigSummaries,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
    });

    if (
      tables.catalog_themes.upsertedCount > 0 ||
      tables.catalog_sets.upsertedCount > 0
    ) {
      await refreshCatalogThemeSummaries({
        supabaseClient: productionSupabaseClient,
      });
    }

    tables.commerce_merchants = await upsertMerchantsBySlug({
      nowIso: startedAtIso,
      plan: merchantPromotionPlan,
      supabaseClient: productionSupabaseClient,
    });

    tables.commerce_benchmark_sets = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'set_id',
      rows: normalizedCommerceBenchmarkSets,
      supabaseClient: productionSupabaseClient,
      table: COMMERCE_BENCHMARK_SETS_TABLE,
    });
    tables.commerce_offer_seeds = await upsertOfferSeedsByCompositeKey({
      nowIso: startedAtIso,
      rows: resolvedCommerceOfferSeeds,
      supabaseClient: productionSupabaseClient,
    });

    return {
      changedThemeSlugs,
      durationMs: now().getTime() - startedAt.getTime(),
      startedAt: startedAtIso,
      status: 'ok',
      tables: tables as CatalogPromotionResult['tables'],
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Catalog promotion failed unexpectedly.';
    const failedTableMatch = message.match(
      /(catalog_source_themes|catalog_themes|catalog_theme_mappings|catalog_sets|catalog_set_minifig_summaries|commerce_merchants|commerce_benchmark_sets|commerce_offer_seeds)/,
    );

    throw new CatalogPromotionError(message, {
      durationMs: now().getTime() - startedAt.getTime(),
      failedTable: failedTableMatch?.[1],
      tables,
    });
  }
}
