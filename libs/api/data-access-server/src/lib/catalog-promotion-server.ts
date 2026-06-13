import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  getProductionSupabaseConfig,
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
import {
  refreshSetDetailRelatedThemeSnapshotsForSetIds,
  type SetDetailRelatedThemeSnapshotRefreshResult,
} from './set-detail-related-theme-snapshot-server';

const COLLECTION_PAGE_SNAPSHOTS_TABLE = 'collection_page_snapshots';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const CATALOG_SET_IMAGES_TABLE = 'catalog_set_images';
const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const BRICKSET_SOURCE_METADATA_SOURCE = 'brickset';
const RAKUTEN_LEGO_SOURCE_METADATA_SOURCE = 'rakuten-lego-eu';
const RAKUTEN_LEGO_SOURCE_METADATA_LOCALE = 'nl-NL';
const EXACT_SET_NUMBER_MATCH_CONFIDENCE = 'exact_set_number';
const RAKUTEN_SOURCE_METADATA_PROMOTABLE_CONFIDENCES = new Set([
  EXACT_SET_NUMBER_MATCH_CONFIDENCE,
  'high',
  'medium',
]);
const CATALOG_PROMOTION_PAGE_SIZE = 1000;
const CATALOG_PROMOTION_NON_PRICE_COLLECTION_SNAPSHOT_SLUGS = new Set([
  'nieuwe-lego-sets',
  'retiring-lego-sets',
  'lego-voor-volwassenen',
]);
const CATALOG_PROMOTION_DEFAULT_CAP_GUARDED_TABLES = new Set([
  CATALOG_SETS_TABLE,
  CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
  CATALOG_SET_IMAGES_TABLE,
  CATALOG_SET_SOURCE_METADATA_TABLE,
  COLLECTION_PAGE_SNAPSHOTS_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
]);
const CATALOG_PROMOTION_COMMERCE_SEED_TABLES = [
  COMMERCE_MERCHANTS_TABLE,
  COMMERCE_BENCHMARK_SETS_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
] as const;
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
  'public_homepage_order',
  'public_image_url',
  'public_logo_url',
  'public_order',
  'public_surface_color',
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
  [CATALOG_SET_IMAGES_TABLE]: [
    'source',
    'source_url',
    'storage_bucket',
    'storage_path',
    'public_url',
    'width',
    'height',
    'content_type',
    'byte_size',
    'sha256',
    'perceptual_hash',
    'image_role',
    'duplicate_of_id',
    'duplicate_reason',
    'duplicate_distance',
    'status',
    'metadata_json',
  ],
  [CATALOG_SET_SOURCE_METADATA_TABLE]: [
    'last_seen_at',
    'match_confidence',
    'metadata_json',
    'policy',
    'set_number',
  ],
  [COLLECTION_PAGE_SNAPSHOTS_TABLE]: [
    'total_count',
    'items_json',
    'source_version',
    'snapshot_source',
    'generated_at',
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
      'public_homepage_order',
      'public_image_url',
      'public_logo_url',
      'public_order',
      'public_surface_color',
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
  [CATALOG_SET_IMAGES_TABLE]: {
    canonical: ['set_id', 'image_type', 'sort_order', 'source', 'source_url'],
    curated: [],
    generatedRuntime: [
      'storage_bucket',
      'storage_path',
      'public_url',
      'width',
      'height',
      'content_type',
      'byte_size',
      'sha256',
      'perceptual_hash',
      'image_role',
      'duplicate_of_id',
      'duplicate_reason',
      'duplicate_distance',
      'status',
      'metadata_json',
    ],
    protected: [],
  },
  [CATALOG_SET_SOURCE_METADATA_TABLE]: {
    canonical: [
      'catalog_set_id',
      'source',
      'locale',
      'match_confidence',
      'set_number',
    ],
    curated: [],
    generatedRuntime: ['metadata_json', 'policy', 'last_seen_at'],
    protected: [],
  },
  [COLLECTION_PAGE_SNAPSHOTS_TABLE]: {
    canonical: ['collection_slug', 'sort_key', 'page', 'page_size'],
    curated: [],
    generatedRuntime: [
      'total_count',
      'items_json',
      'source_version',
      'snapshot_source',
      'generated_at',
    ],
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
  public_homepage_order: number | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_order: number | null;
  public_surface_color: string | null;
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

interface CatalogSetImageRow {
  byte_size: number | null;
  content_type: string | null;
  duplicate_distance: number | null;
  duplicate_of_id: string | null;
  duplicate_reason: 'perceptual' | 'sha256' | null;
  height: number | null;
  image_role:
    | 'box_back'
    | 'box_front'
    | 'build'
    | 'detail'
    | 'lifestyle_people'
    | 'lifestyle_room'
    | 'logo'
    | 'minifigure'
    | 'model_primary'
    | 'model_secondary'
    | 'unknown';
  image_type: 'card' | 'gallery' | 'hero' | 'social' | 'thumbnail';
  metadata_json: Record<string, unknown>;
  perceptual_hash: string | null;
  public_url: string | null;
  set_id: string;
  sha256: string | null;
  sort_order: number;
  source: 'brickset' | 'manual' | 'rebrickable';
  source_url: string;
  status: 'active' | 'duplicate' | 'failed';
  storage_bucket: string | null;
  storage_path: string | null;
  width: number | null;
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

interface CatalogSetSourceMetadataRow {
  catalog_set_id: string;
  last_seen_at: string;
  locale: string;
  match_confidence: string;
  metadata_json: Record<string, unknown>;
  policy: string;
  set_number: string;
  source: string;
}

interface CollectionPageSnapshotRow {
  collection_slug: string;
  generated_at: string;
  items_json: unknown;
  page: number;
  page_size: number;
  snapshot_source: string;
  sort_key: string;
  source_version: string | null;
  total_count: number;
}

type CatalogSetImageRole = CatalogSetImageRow['image_role'];

const CATALOG_SET_IMAGE_ROLES = new Set<CatalogSetImageRole>([
  'box_back',
  'box_front',
  'build',
  'detail',
  'lifestyle_people',
  'lifestyle_room',
  'logo',
  'minifigure',
  'model_primary',
  'model_secondary',
  'unknown',
]);

export interface CatalogPromotionTableSummary {
  insertedCount: number;
  readCount: number;
  updatedCount: number;
  upsertedCount: number;
}

export interface CatalogPromotionPreviewTableSummary {
  insertedCount: number;
  readCount: number;
  skipped: boolean;
  strategy: 'excluded' | 'heavy_skipped' | 'sample_diff';
  updatedCount: number;
  warning?: string;
}

export interface CatalogPromotionPreviewSample {
  changeType: 'insert' | 'update';
  changedFields: string[];
  key: string;
  table: string;
}

export interface CatalogPromotionPreviewResult {
  catalogSetImages?: CatalogSetImagePromotionDiagnostics;
  generatedAt: string;
  meaningfulPendingPromoteCount: number;
  operatorSummary: {
    mappings: CatalogPromotionPreviewTableSummary;
    sets: CatalogPromotionPreviewTableSummary;
    themes: CatalogPromotionPreviewTableSummary;
  };
  pendingPromoteCount: number;
  excludedTables?: string[];
  samples: CatalogPromotionPreviewSample[];
  skippedHeavyTables: string[];
  sourceEnvironment: 'staging';
  status: 'ok';
  tables: Record<string, CatalogPromotionPreviewTableSummary>;
  targetEnvironment: 'production';
}

export interface CatalogSetImagePromotionDiagnostics {
  activeGalleryCount: number;
  activeHeroCount: number;
  activeSocialCount: number;
  affectedSetCount: number;
  insertedCount: number;
  readCount: number;
  updatedCount: number;
  upsertedCount?: number;
}

export interface CatalogPromotionResult {
  affectedThemeCount?: number;
  affectedThemeSlugs?: string[];
  brickset_source_metadata_promoted_count?: number;
  bricksetSourceMetadataPromotedCount?: number;
  changedCollectionPageSnapshotSlugs?: string[];
  changedHomepageThemeSlugs?: string[];
  changedThemeSlugs: string[];
  collection_page_snapshots_by_slug?: Record<string, number>;
  collection_page_snapshots_read_count?: number;
  collection_page_snapshots_upserted_count?: number;
  collectionPageSnapshotsBySlug?: Record<string, number>;
  collectionPageSnapshotsReadCount?: number;
  collectionPageSnapshotsUpsertedCount?: number;
  catalog_set_images_active_gallery_count?: number;
  catalog_set_images_active_hero_count?: number;
  catalog_set_images_active_social_count?: number;
  catalog_set_images_affected_set_count?: number;
  catalog_set_images_read_count?: number;
  catalog_set_images_upserted_count?: number;
  catalogSetImages?: CatalogSetImagePromotionDiagnostics;
  durationMs: number;
  homepageAffected?: boolean;
  promotedMetadataSetIds?: string[];
  promotedMetadataSetSlugs?: string[];
  promotedImageMetadataSetIds?: string[];
  promotedImageMetadataSetSlugs?: string[];
  rakuten_source_metadata_promoted_count?: number;
  rakutenSourceMetadataPromotedCount?: number;
  skipped_source_metadata_count?: number;
  source_metadata_eligible_count?: number;
  source_metadata_read_count?: number;
  sourceMetadataEligibleCount?: number;
  sourceMetadataReadCount?: number;
  skippedSourceMetadataCount?: number;
  startedAt: string;
  status: 'ok';
  setDetailRelatedThemeSnapshotRefresh?: SetDetailRelatedThemeSnapshotRefreshResult;
  setDetailRelatedThemeSnapshotRefreshWarning?: string;
  themeSummaryRefresh?: {
    affectedThemeCount: number;
    affectedThemeSlugs: string[];
    attempted: boolean;
    status: 'skipped' | 'success';
  };
  tables: {
    catalog_source_themes: CatalogPromotionTableSummary;
    catalog_themes: CatalogPromotionTableSummary;
    catalog_theme_mappings: CatalogPromotionTableSummary;
    catalog_sets: CatalogPromotionTableSummary;
    catalog_set_minifig_summaries: CatalogPromotionTableSummary;
    catalog_set_images: CatalogPromotionTableSummary;
    catalog_set_source_metadata?: CatalogPromotionTableSummary;
    collection_page_snapshots?: CatalogPromotionTableSummary;
    commerce_merchants?: CatalogPromotionTableSummary;
    commerce_benchmark_sets?: CatalogPromotionTableSummary;
    commerce_offer_seeds?: CatalogPromotionTableSummary;
  };
  excludedTables?: string[];
}

export interface PromoteCatalogFromStagingToProductionDependencies {
  createProductionSupabaseClient?: () => CatalogPromotionSupabaseClient;
  createStagingSupabaseClient?: () => CatalogPromotionSupabaseClient;
  includeCommerceSeeds?: boolean;
  now?: () => Date;
  refreshSetDetailRelatedThemeSnapshotsForSetIdsFn?: typeof refreshSetDetailRelatedThemeSnapshotsForSetIds;
}

export type PreviewCatalogPromotionDependencies =
  PromoteCatalogFromStagingToProductionDependencies & {
    includeHeavy?: boolean;
  };

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

const CATALOG_PROMOTION_PREVIEW_TABLES = [
  {
    columns:
      'id, source_system, source_theme_name, parent_source_theme_id, created_at, updated_at',
    onConflict: 'id',
    orderBy: 'id',
    table: CATALOG_SOURCE_THEMES_TABLE,
  },
  {
    columns:
      'id, slug, display_name, is_public, public_display_name, public_description, public_image_url, public_accent_color, public_surface_color, public_logo_url, public_homepage_order, public_order, status, created_at, updated_at',
    onConflict: 'id',
    orderBy: 'slug',
    table: CATALOG_THEMES_TABLE,
  },
  {
    columns: 'source_theme_id, primary_theme_id, created_at, updated_at',
    onConflict: 'source_theme_id',
    orderBy: 'source_theme_id',
    table: CATALOG_THEME_MAPPINGS_TABLE,
  },
  {
    columns:
      'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
    onConflict: 'set_id',
    orderBy: 'created_at',
    table: CATALOG_SETS_TABLE,
  },
  {
    columns:
      'set_id, source_system, minifig_count, source_minifig_count, synced_at, created_at, updated_at',
    onConflict: 'set_id',
    orderBy: 'set_id',
    table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
  },
  {
    columns:
      'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, duplicate_of_id, duplicate_reason, duplicate_distance, status, metadata_json',
    onConflict: 'set_id,image_type,sort_order',
    orderBy: 'set_id',
    table: CATALOG_SET_IMAGES_TABLE,
  },
  {
    columns:
      'catalog_set_id, set_number, source, locale, metadata_json, match_confidence, policy, last_seen_at',
    onConflict: 'catalog_set_id,source,locale',
    orderBy: 'catalog_set_id',
    table: CATALOG_SET_SOURCE_METADATA_TABLE,
  },
  {
    columns:
      'collection_slug, sort_key, page, page_size, total_count, items_json, source_version, snapshot_source, generated_at, created_at, updated_at',
    heavy: true,
    onConflict: 'collection_slug,sort_key,page,page_size',
    orderBy: 'collection_slug',
    table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
  },
  {
    columns:
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    commerceSeed: true,
    onConflict: 'slug',
    orderBy: 'slug',
    table: COMMERCE_MERCHANTS_TABLE,
  },
  {
    columns: 'set_id, notes, created_at, updated_at',
    commerceSeed: true,
    onConflict: 'set_id',
    orderBy: 'set_id',
    table: COMMERCE_BENCHMARK_SETS_TABLE,
  },
  {
    columns:
      'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
    commerceSeed: true,
    onConflict: 'set_id,merchant_id',
    orderBy: 'created_at',
    table: COMMERCE_OFFER_SEEDS_TABLE,
  },
] as const;

type CatalogPromotionPreviewTableConfig =
  (typeof CATALOG_PROMOTION_PREVIEW_TABLES)[number];

function isHeavyPromotionPreviewTable(
  tableConfig: CatalogPromotionPreviewTableConfig,
): boolean {
  return 'heavy' in tableConfig && tableConfig.heavy === true;
}

function isCommerceSeedPromotionTable(
  table: string,
): table is (typeof CATALOG_PROMOTION_COMMERCE_SEED_TABLES)[number] {
  return CATALOG_PROMOTION_COMMERCE_SEED_TABLES.includes(
    table as (typeof CATALOG_PROMOTION_COMMERCE_SEED_TABLES)[number],
  );
}

function isCommerceSeedPromotionTableConfig(
  tableConfig: CatalogPromotionPreviewTableConfig,
): boolean {
  return 'commerceSeed' in tableConfig && tableConfig.commerceSeed === true;
}

function listPromotionPreviewTableConfigs({
  includeCommerceSeeds,
}: {
  includeCommerceSeeds: boolean;
}): readonly CatalogPromotionPreviewTableConfig[] {
  return CATALOG_PROMOTION_PREVIEW_TABLES.filter(
    (tableConfig) =>
      includeCommerceSeeds || !isCommerceSeedPromotionTableConfig(tableConfig),
  );
}

function buildExcludedPreviewTableSummary(): CatalogPromotionPreviewTableSummary {
  return {
    insertedCount: 0,
    readCount: 0,
    skipped: true,
    strategy: 'excluded',
    updatedCount: 0,
    warning: 'Excluded from catalog promotion by default.',
  };
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

function readOptionalPromotionRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function readCatalogSetImageRole(
  value: unknown,
): CatalogSetImageRole | undefined {
  return typeof value === 'string' &&
    CATALOG_SET_IMAGE_ROLES.has(value as CatalogSetImageRole)
    ? (value as CatalogSetImageRole)
    : undefined;
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

function hasReferencePriceOnlyUsage(metadataJson: unknown): boolean {
  const metadata = readOptionalPromotionRecord(metadataJson);

  if (!metadata) {
    return false;
  }

  if (metadata['usage'] === 'reference_price_only') {
    return true;
  }

  const referencePriceEvidence = readOptionalPromotionRecord(
    metadata['referencePriceEvidence'],
  );

  return referencePriceEvidence?.['usage'] === 'reference_price_only';
}

function isCatalogSetSourceMetadataRowPromotable({
  promotedCatalogSetIds,
  row,
}: {
  promotedCatalogSetIds: ReadonlySet<string>;
  row: Pick<
    CatalogSetSourceMetadataRow,
    | 'catalog_set_id'
    | 'locale'
    | 'match_confidence'
    | 'metadata_json'
    | 'source'
  >;
}): boolean {
  if (!promotedCatalogSetIds.has(row.catalog_set_id)) {
    return false;
  }

  if (row.source === BRICKSET_SOURCE_METADATA_SOURCE) {
    return true;
  }

  if (
    row.source !== RAKUTEN_LEGO_SOURCE_METADATA_SOURCE ||
    row.locale !== RAKUTEN_LEGO_SOURCE_METADATA_LOCALE
  ) {
    return false;
  }

  return (
    RAKUTEN_SOURCE_METADATA_PROMOTABLE_CONFIDENCES.has(row.match_confidence) ||
    hasReferencePriceOnlyUsage(row.metadata_json)
  );
}

function filterCatalogSetSourceMetadataRowsForPromotion<
  TRow extends Pick<
    CatalogSetSourceMetadataRow,
    | 'catalog_set_id'
    | 'locale'
    | 'match_confidence'
    | 'metadata_json'
    | 'source'
  >,
>({
  promotedCatalogSetIds,
  rows,
}: {
  promotedCatalogSetIds: ReadonlySet<string>;
  rows: readonly TRow[];
}): TRow[] {
  return rows.filter((row) =>
    isCatalogSetSourceMetadataRowPromotable({
      promotedCatalogSetIds,
      row,
    }),
  );
}

function buildCatalogSetImagePromotionDiagnostics({
  rows,
  summary,
}: {
  rows: readonly Pick<CatalogSetImageRow, 'image_type' | 'set_id' | 'status'>[];
  summary: Pick<
    CatalogPromotionTableSummary | CatalogPromotionPreviewTableSummary,
    'insertedCount' | 'readCount' | 'updatedCount'
  > & {
    upsertedCount?: number;
  };
}): CatalogSetImagePromotionDiagnostics {
  const activeRows = rows.filter((row) => row.status === 'active');

  return {
    activeGalleryCount: activeRows.filter((row) => row.image_type === 'gallery')
      .length,
    activeHeroCount: activeRows.filter((row) => row.image_type === 'hero')
      .length,
    activeSocialCount: activeRows.filter((row) => row.image_type === 'social')
      .length,
    affectedSetCount: new Set(rows.map((row) => row.set_id)).size,
    insertedCount: summary.insertedCount,
    readCount: summary.readCount,
    updatedCount: summary.updatedCount,
    ...(typeof summary.upsertedCount === 'number'
      ? { upsertedCount: summary.upsertedCount }
      : {}),
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

function countCatalogSetImageRowsWithNullRole({
  rows,
}: {
  rows: readonly Readonly<Record<string, unknown>>[];
}): number {
  return rows.filter(
    (row) => readCatalogSetImageRole(row['image_role']) === undefined,
  ).length;
}

function sampleCatalogSetImageRowsWithNullRole({
  rows,
}: {
  rows: readonly Readonly<Record<string, unknown>>[];
}): readonly Record<string, unknown>[] {
  return rows
    .filter((row) => readCatalogSetImageRole(row['image_role']) === undefined)
    .slice(0, 5)
    .map((row) => ({
      image_role: row['image_role'] ?? null,
      image_type: row['image_type'] ?? null,
      metadataRoleClassification:
        readOptionalPromotionRecord(
          readOptionalPromotionRecord(row['metadata_json'])?.[
            'roleClassification'
          ],
        )?.['role'] ?? null,
      set_id: row['set_id'] ?? null,
      sort_order: row['sort_order'] ?? null,
      storage_path: row['storage_path'] ?? null,
    }));
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

function logCatalogThemeRequiredFieldNormalization({
  rowsAfter,
  rowsBefore,
}: {
  rowsAfter: readonly Readonly<Record<string, unknown>>[];
  rowsBefore: readonly Readonly<Record<string, unknown>>[];
}): void {
  const nullOrMissingDisplayNameBefore = countRowsWithInvalidPromotionString({
    column: 'display_name',
    rows: rowsBefore,
  });
  const nullOrMissingSlugBefore = countRowsWithInvalidPromotionString({
    column: 'slug',
    rows: rowsBefore,
  });

  if (nullOrMissingDisplayNameBefore === 0 && nullOrMissingSlugBefore === 0) {
    return;
  }

  console.info(
    '[catalog-promotion] catalog theme required payload normalized',
    {
      inputRows: rowsBefore.length,
      nullOrMissingDisplayNameAfterNormalize:
        countRowsWithInvalidPromotionString({
          column: 'display_name',
          rows: rowsAfter,
        }),
      nullOrMissingDisplayNameBeforeNormalize: nullOrMissingDisplayNameBefore,
      nullOrMissingSlugAfterNormalize: countRowsWithInvalidPromotionString({
        column: 'slug',
        rows: rowsAfter,
      }),
      nullOrMissingSlugBeforeNormalize: nullOrMissingSlugBefore,
      table: CATALOG_THEMES_TABLE,
    },
  );
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

function logCatalogSetImageRoleNormalization({
  rowsAfter,
  rowsBefore,
}: {
  rowsAfter: readonly Readonly<Record<string, unknown>>[];
  rowsBefore: readonly Readonly<Record<string, unknown>>[];
}): void {
  const nullSourceRoleCount = countCatalogSetImageRowsWithNullRole({
    rows: rowsBefore,
  });
  const nullMappedRoleCount = countCatalogSetImageRowsWithNullRole({
    rows: rowsAfter,
  });

  console.info(
    '[catalog-promotion] catalog set image role payload normalized',
    {
      inputRows: rowsBefore.length,
      mappedNullImageRoleCount: nullMappedRoleCount,
      mappedNullImageRoleSample: sampleCatalogSetImageRowsWithNullRole({
        rows: rowsAfter,
      }),
      sourceNullImageRoleCount: nullSourceRoleCount,
      sourceNullImageRoleSample: sampleCatalogSetImageRowsWithNullRole({
        rows: rowsBefore,
      }),
      table: CATALOG_SET_IMAGES_TABLE,
    },
  );
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

function humanizeCatalogThemeFallbackName(value: string): string {
  return value
    .replace(/^theme:/u, '')
    .replace(/[-_]+/gu, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase('nl-NL'));
}

function normalizeCatalogThemeRow({
  nowIso,
  theme,
}: {
  nowIso: string;
  theme: CatalogThemeRow;
}): CatalogThemeRow {
  const id = readRequiredPromotionString({
    column: 'id',
    row: theme as unknown as Readonly<Record<string, unknown>>,
    table: CATALOG_THEMES_TABLE,
  });
  const fallbackDisplayName = humanizeCatalogThemeFallbackName(id);
  const displayName =
    readOptionalPromotionString(theme.display_name) ??
    readOptionalPromotionString(theme.public_display_name) ??
    fallbackDisplayName;
  const normalizedSlug =
    typeof theme.slug === 'string' && theme.slug.trim()
      ? theme.slug.trim()
      : buildCatalogThemeSlug(displayName || id.replace(/^theme:/u, ''));

  if (!displayName || !normalizedSlug) {
    throw new Error(
      `Unable to promote ${CATALOG_THEMES_TABLE}. Required display_name/slug could not be derived for row ${JSON.stringify(theme)}.`,
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

function getCatalogSetImageRoleFallback(
  imageType: CatalogSetImageRow['image_type'],
): CatalogSetImageRole {
  return imageType === 'hero' || imageType === 'card' || imageType === 'social'
    ? 'model_primary'
    : 'unknown';
}

function resolveCatalogSetImageRole(
  row: CatalogSetImageRow,
): CatalogSetImageRole {
  const metadata = readOptionalPromotionRecord(row.metadata_json);
  const roleClassification = readOptionalPromotionRecord(
    metadata?.['roleClassification'],
  );

  return (
    readCatalogSetImageRole(row.image_role) ??
    readCatalogSetImageRole(roleClassification?.['role']) ??
    getCatalogSetImageRoleFallback(row.image_type)
  );
}

function normalizeCatalogSetImageRow(
  row: CatalogSetImageRow,
): CatalogSetImageRow {
  return {
    ...row,
    duplicate_distance:
      typeof row.duplicate_distance === 'number' &&
      Number.isFinite(row.duplicate_distance)
        ? row.duplicate_distance
        : null,
    duplicate_of_id: readOptionalPromotionString(row.duplicate_of_id) ?? null,
    duplicate_reason:
      row.duplicate_reason === 'perceptual' || row.duplicate_reason === 'sha256'
        ? row.duplicate_reason
        : null,
    image_role: resolveCatalogSetImageRole(row),
  };
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

function valuesArePromotionJsonEqual(left: unknown, right: unknown): boolean {
  if (
    left !== null &&
    right !== null &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return valuesArePromotionEqual(left, right);
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

function isCatalogThemeVisibleOnHomepage(
  row: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    isPublicCatalogThemeForRevalidation(row) &&
    typeof row?.['public_homepage_order'] === 'number' &&
    Number.isFinite(row['public_homepage_order'])
  );
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

  const displayName =
    readOptionalPromotionString(existingRow?.['display_name']) ??
    readOptionalPromotionString(row['display_name']) ??
    readOptionalPromotionString(sourceRow['display_name']) ??
    readOptionalPromotionString(sourceRow['public_display_name']) ??
    humanizeCatalogThemeFallbackName(
      readOptionalPromotionString(sourceRow['id']) ??
        readOptionalPromotionString(row['id']) ??
        '',
    );
  const slug =
    readOptionalPromotionString(existingRow?.['slug']) ??
    readOptionalPromotionString(row['slug']) ??
    readOptionalPromotionString(sourceRow['slug']) ??
    buildCatalogThemeSlug(
      displayName ||
        readOptionalPromotionString(sourceRow['id'])?.replace(/^theme:/u, '') ||
        readOptionalPromotionString(row['id'])?.replace(/^theme:/u, '') ||
        '',
    );

  if (!displayName || !slug) {
    throw new Error(
      `Unable to promote ${CATALOG_THEMES_TABLE}. Final upsert payload is missing required display_name/slug for id ${readOptionalPromotionString(sourceRow['id']) ?? readOptionalPromotionString(row['id']) ?? 'unknown'}.`,
    );
  }

  return {
    ...row,
    created_at:
      readOptionalPromotionString(existingRow?.['created_at']) ??
      readOptionalPromotionString(sourceRow['created_at']) ??
      readOptionalPromotionString(row['created_at']) ??
      nowIso,
    display_name: displayName,
    is_public:
      readOptionalPromotionBoolean(existingRow?.['is_public']) ??
      readOptionalPromotionBoolean(row['is_public']) ??
      readOptionalPromotionBoolean(sourceRow['is_public']) ??
      false,
    slug,
    status:
      readOptionalPromotionString(existingRow?.['status']) ??
      readOptionalPromotionString(row['status']) ??
      readOptionalPromotionString(sourceRow['status']) ??
      'active',
    updated_at:
      readOptionalPromotionString(existingRow?.['updated_at']) ??
      readOptionalPromotionString(sourceRow['updated_at']) ??
      readOptionalPromotionString(row['updated_at']) ??
      nowIso,
  };
}

function assertCatalogThemeUpsertPayloadHasRequiredIdentity({
  rows,
  table,
}: {
  rows: readonly Record<string, unknown>[];
  table: string;
}): void {
  if (table !== CATALOG_THEMES_TABLE) {
    return;
  }

  const invalidIds = rows
    .filter(
      (row) =>
        !readOptionalPromotionString(row['display_name']) ||
        !readOptionalPromotionString(row['slug']),
    )
    .map((row) => readOptionalPromotionString(row['id']) ?? 'unknown')
    .slice(0, 20);

  if (invalidIds.length === 0) {
    return;
  }

  throw new Error(
    `Unable to promote ${CATALOG_THEMES_TABLE}. Final upsert payload is missing required display_name/slug for ids: ${invalidIds.join(', ')}`,
  );
}

function assertCatalogSetImageUpsertPayloadHasImageRole({
  rows,
  table,
}: {
  rows: readonly Record<string, unknown>[];
  table: string;
}): void {
  if (table !== CATALOG_SET_IMAGES_TABLE) {
    return;
  }

  const invalidSamples = sampleCatalogSetImageRowsWithNullRole({ rows });

  if (invalidSamples.length === 0) {
    return;
  }

  throw new Error(
    `Unable to promote ${CATALOG_SET_IMAGES_TABLE}. Final upsert payload has null image_role for rows: ${JSON.stringify(invalidSamples)}`,
  );
}

function createPromotionClients(): {
  productionSupabaseClient: CatalogPromotionSupabaseClient;
  stagingSupabaseClient: CatalogPromotionSupabaseClient;
} {
  let productionSupabaseConfig: ReturnType<typeof getProductionSupabaseConfig>;

  try {
    productionSupabaseConfig = getProductionSupabaseConfig();
  } catch (error) {
    throw new Error('production Supabase config missing');
  }

  const stagingSupabaseConfig = getStagingSupabaseConfig();

  if (stagingSupabaseConfig.url === productionSupabaseConfig.url) {
    throw new Error('refusing to compare/promote identical Supabase targets');
  }

  return {
    productionSupabaseClient: createSupabaseAdminClient(
      productionSupabaseConfig,
    ),
    stagingSupabaseClient: createSupabaseAdminClient(stagingSupabaseConfig),
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

function listPromotionPreviewColumns({
  columns,
  onConflict,
  table,
}: {
  columns: string;
  onConflict: string;
  table: string;
}): string {
  return [
    ...new Set([
      ...columns
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean),
      ...listExistingPromotionInspectionColumns({
        conflictColumns: splitConflictColumns(onConflict),
        table,
      })
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean),
    ]),
  ].join(', ');
}

async function previewPromotionTable({
  columns,
  onConflict,
  orderBy,
  preloadedStagingRows,
  promotedCatalogSetIds,
  productionSupabaseClient,
  samples,
  stagingSupabaseClient,
  table,
}: {
  columns: string;
  onConflict: string;
  orderBy: string;
  preloadedStagingRows?: readonly Record<string, unknown>[];
  promotedCatalogSetIds?: ReadonlySet<string>;
  productionSupabaseClient: CatalogPromotionSupabaseClient;
  samples: CatalogPromotionPreviewSample[];
  stagingSupabaseClient: CatalogPromotionSupabaseClient;
  table: string;
}): Promise<CatalogPromotionPreviewTableSummary> {
  const conflictColumns = splitConflictColumns(onConflict);
  const previewColumns = listPromotionPreviewColumns({
    columns,
    onConflict,
    table,
  });
  const stagingRows =
    preloadedStagingRows ??
    (await readOrderedRows<Record<string, unknown>>({
      columns: previewColumns,
      orderBy,
      supabaseClient: stagingSupabaseClient,
      table,
    }));
  const promotableStagingRows: readonly Record<string, unknown>[] =
    table === CATALOG_SET_SOURCE_METADATA_TABLE && promotedCatalogSetIds
      ? (filterCatalogSetSourceMetadataRowsForPromotion({
          promotedCatalogSetIds,
          rows: stagingRows as unknown as CatalogSetSourceMetadataRow[],
        }) as unknown as Record<string, unknown>[])
      : stagingRows;
  const productionRowsByConflictKey = await listExistingConflictRows({
    onConflict,
    supabaseClient: productionSupabaseClient,
    table,
  });
  const mutableColumns =
    CATALOG_PROMOTION_MUTABLE_COLUMNS_BY_TABLE[table] ?? [];
  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of promotableStagingRows) {
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row,
    });
    const productionRow = productionRowsByConflictKey.get(conflictKey);

    if (!productionRow) {
      insertedCount += 1;

      if (samples.length < 25) {
        samples.push({
          changeType: 'insert',
          changedFields: conflictColumns,
          key: conflictKey,
          table,
        });
      }

      continue;
    }

    const changedFields = mutableColumns.filter((column) =>
      Object.prototype.hasOwnProperty.call(row, column)
        ? !valuesArePromotionEqual(row[column], productionRow[column])
        : false,
    );

    if (changedFields.length > 0) {
      updatedCount += 1;

      if (samples.length < 25) {
        samples.push({
          changeType: 'update',
          changedFields,
          key: conflictKey,
          table,
        });
      }
    }
  }

  return {
    insertedCount,
    readCount: promotableStagingRows.length,
    skipped: false,
    strategy: 'sample_diff',
    updatedCount,
  };
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

  assertCatalogThemeUpsertPayloadHasRequiredIdentity({
    rows: rowsForUpsert,
    table,
  });
  assertCatalogSetImageUpsertPayloadHasImageRole({
    rows: rowsForUpsert,
    table,
  });

  logPromotionUpsertTimestampSanitization({
    rowsAfter: rowsForUpsert,
    rowsBefore: projectedRowsForUpsert,
    table,
  });
  if (table === CATALOG_SET_IMAGES_TABLE) {
    console.info(
      '[catalog-promotion] catalog set image upsert payload checked',
      {
        mappedNullImageRoleCount: countCatalogSetImageRowsWithNullRole({
          rows: rowsForUpsert,
        }),
        mappedNullImageRoleSample: sampleCatalogSetImageRowsWithNullRole({
          rows: rowsForUpsert,
        }),
        table,
      },
    );
  }

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

async function listChangedPublicCatalogThemeTargets({
  nowIso,
  rows,
  supabaseClient,
}: {
  nowIso: string;
  rows: readonly CatalogThemeRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<{
  changedHomepageThemeSlugs: string[];
  changedThemeSlugs: string[];
}> {
  if (rows.length === 0) {
    return {
      changedHomepageThemeSlugs: [],
      changedThemeSlugs: [],
    };
  }

  const conflictColumns = ['id'];
  const existingRowsByConflictKey = await listExistingConflictRows({
    onConflict: 'id',
    supabaseClient,
    table: CATALOG_THEMES_TABLE,
  });
  const changedSlugs = new Set<string>();
  const changedHomepageSlugs = new Set<string>();

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

      if (
        isCatalogThemeVisibleOnHomepage(existingRow) ||
        isCatalogThemeVisibleOnHomepage({
          ...existingRow,
          ...projectedRow,
        })
      ) {
        changedHomepageSlugs.add(slug);
      }
    }
  }

  return {
    changedHomepageThemeSlugs: [...changedHomepageSlugs].sort((left, right) =>
      left.localeCompare(right),
    ),
    changedThemeSlugs: [...changedSlugs].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function isActiveCatalogSetForThemeSummary(
  row: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    row?.['status'] === 'active' && typeof row['primary_theme_id'] === 'string'
  );
}

function readCatalogSetPrimaryThemeId(
  row: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const value = row?.['primary_theme_id'];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function catalogSetProjectionChangesThemeSurface({
  existingRow,
  projectedRow,
}: {
  existingRow: Readonly<Record<string, unknown>> | undefined;
  projectedRow: Readonly<Record<string, unknown>>;
}): boolean {
  if (!existingRow) {
    return true;
  }

  return [
    'image_url',
    'name',
    'piece_count',
    'primary_theme_id',
    'release_year',
    'slug',
    'status',
  ].some((field) => {
    if (!Object.prototype.hasOwnProperty.call(projectedRow, field)) {
      return false;
    }

    return !valuesArePromotionEqual(existingRow[field], projectedRow[field]);
  });
}

async function listChangedCatalogSetThemeSlugs({
  catalogThemes,
  nowIso,
  rows,
  supabaseClient,
}: {
  catalogThemes: readonly CatalogThemeRow[];
  nowIso: string;
  rows: readonly CatalogSetRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<string[]> {
  if (rows.length === 0) {
    return [];
  }

  const existingCatalogSetsByConflictKey = await listExistingConflictRows({
    onConflict: 'set_id',
    supabaseClient,
    table: CATALOG_SETS_TABLE,
  });
  const existingCatalogThemesByConflictKey = await listExistingConflictRows({
    onConflict: 'id',
    supabaseClient,
    table: CATALOG_THEMES_TABLE,
  });
  const themeRowsById = new Map<string, Readonly<Record<string, unknown>>>();

  for (const existingTheme of existingCatalogThemesByConflictKey.values()) {
    const themeId = existingTheme['id'];

    if (typeof themeId === 'string') {
      themeRowsById.set(themeId, existingTheme);
    }
  }

  for (const catalogTheme of catalogThemes) {
    themeRowsById.set(
      catalogTheme.id,
      catalogTheme as unknown as Record<string, unknown>,
    );
  }

  const changedThemeIds = new Set<string>();

  for (const catalogSet of rows) {
    const rowRecord = toRowRecord(catalogSet);
    const conflictKey = buildConflictKey({
      columns: ['set_id'],
      row: rowRecord,
    });
    const existingRow = existingCatalogSetsByConflictKey.get(conflictKey);
    const projectedRow = finalizePromotionUpsertRow({
      existingRow,
      nowIso,
      row: selectPromotionUpsertColumns({
        conflictColumns: ['set_id'],
        existingRow,
        isExistingRow: Boolean(existingRow),
        row: rowRecord,
        table: CATALOG_SETS_TABLE,
      }),
      sourceRow: rowRecord,
      table: CATALOG_SETS_TABLE,
    });
    const projectedCatalogSet = {
      ...existingRow,
      ...projectedRow,
    };

    if (
      !catalogSetProjectionChangesThemeSurface({
        existingRow,
        projectedRow,
      })
    ) {
      continue;
    }

    if (isActiveCatalogSetForThemeSummary(existingRow)) {
      const previousThemeId = readCatalogSetPrimaryThemeId(existingRow);

      if (previousThemeId) {
        changedThemeIds.add(previousThemeId);
      }
    }

    if (isActiveCatalogSetForThemeSummary(projectedCatalogSet)) {
      const nextThemeId = readCatalogSetPrimaryThemeId(projectedCatalogSet);

      if (nextThemeId) {
        changedThemeIds.add(nextThemeId);
      }
    }
  }

  const changedSlugs = new Set<string>();

  for (const themeId of changedThemeIds) {
    const themeRow = themeRowsById.get(themeId);

    if (!isPublicCatalogThemeForRevalidation(themeRow)) {
      continue;
    }

    const slug = readCatalogThemeSlugForRevalidation(themeRow);

    if (slug) {
      changedSlugs.add(slug);
    }
  }

  return [...changedSlugs].sort((left, right) => left.localeCompare(right));
}

async function listChangedCollectionPageSnapshotSlugs({
  rows,
  supabaseClient,
}: {
  rows: readonly CollectionPageSnapshotRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<string[]> {
  if (rows.length === 0) {
    return [];
  }

  const conflictColumns = splitConflictColumns(
    'collection_slug,sort_key,page,page_size',
  );
  const existingRowsByConflictKey = await listExistingConflictRows({
    onConflict: 'collection_slug,sort_key,page,page_size',
    supabaseClient,
    table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
  });
  const mutableColumns = (
    CATALOG_PROMOTION_MUTABLE_COLUMNS_BY_TABLE[
      COLLECTION_PAGE_SNAPSHOTS_TABLE
    ] ?? []
  ).filter((column) => column !== 'created_at' && column !== 'updated_at');
  const changedSlugs = new Set<string>();

  for (const snapshot of rows) {
    const rowRecord = toRowRecord(snapshot);
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row: rowRecord,
    });
    const existingRow = existingRowsByConflictKey.get(conflictKey);

    if (!existingRow) {
      changedSlugs.add(snapshot.collection_slug);
      continue;
    }

    const changedFields = mutableColumns.filter((column) =>
      Object.prototype.hasOwnProperty.call(rowRecord, column)
        ? !valuesArePromotionJsonEqual(rowRecord[column], existingRow[column])
        : false,
    );

    if (changedFields.length > 0) {
      changedSlugs.add(snapshot.collection_slug);
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
  includeCommerceSeeds = false,
  now = () => new Date(),
  refreshSetDetailRelatedThemeSnapshotsForSetIdsFn = refreshSetDetailRelatedThemeSnapshotsForSetIds,
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
  const excludedTables = includeCommerceSeeds
    ? []
    : [...CATALOG_PROMOTION_COMMERCE_SEED_TABLES];

  try {
    const [
      catalogSourceThemes,
      catalogThemes,
      catalogThemeMappings,
      catalogSets,
      catalogSetMinifigSummaries,
      catalogSetImages,
      catalogSetSourceMetadata,
      collectionPageSnapshots,
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
          'id, slug, display_name, is_public, public_display_name, public_description, public_image_url, public_accent_color, public_surface_color, public_logo_url, public_homepage_order, public_order, status, created_at, updated_at',
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
      readOrderedRows<CatalogSetImageRow>({
        columns:
          'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, duplicate_of_id, duplicate_reason, duplicate_distance, status, metadata_json',
        orderBy: 'set_id',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_SET_IMAGES_TABLE,
      }),
      readOrderedRows<CatalogSetSourceMetadataRow>({
        columns:
          'catalog_set_id, set_number, source, locale, metadata_json, match_confidence, policy, last_seen_at',
        orderBy: 'catalog_set_id',
        supabaseClient: stagingSupabaseClient,
        table: CATALOG_SET_SOURCE_METADATA_TABLE,
      }),
      readOrderedRows<CollectionPageSnapshotRow>({
        columns:
          'collection_slug, sort_key, page, page_size, total_count, items_json, source_version, snapshot_source, generated_at, created_at, updated_at',
        orderBy: 'collection_slug',
        supabaseClient: stagingSupabaseClient,
        table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
      }),
    ]);
    const [commerceMerchants, commerceBenchmarkSets, commerceOfferSeeds] =
      includeCommerceSeeds
        ? await Promise.all([
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
          ])
        : [
            [] as CommerceMerchantRow[],
            [] as CommerceBenchmarkSetRow[],
            [] as CommerceOfferSeedRow[],
          ];

    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSets.length,
      table: CATALOG_SETS_TABLE,
    });
    if (includeCommerceSeeds) {
      assertPromotionReadWasNotDefaultCapped({
        readCount: commerceOfferSeeds.length,
        table: COMMERCE_OFFER_SEEDS_TABLE,
      });
    }
    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSetMinifigSummaries.length,
      table: CATALOG_SET_MINIFIG_SUMMARIES_TABLE,
    });
    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSetImages.length,
      table: CATALOG_SET_IMAGES_TABLE,
    });
    assertPromotionReadWasNotDefaultCapped({
      readCount: catalogSetSourceMetadata.length,
      table: CATALOG_SET_SOURCE_METADATA_TABLE,
    });
    assertPromotionReadWasNotDefaultCapped({
      readCount: collectionPageSnapshots.length,
      table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
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
    logCatalogThemeRequiredFieldNormalization({
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
    const normalizedCatalogSetImages = catalogSetImages.map(
      normalizeCatalogSetImageRow,
    );
    logCatalogSetImageRoleNormalization({
      rowsAfter: normalizedCatalogSetImages as unknown as Readonly<
        Record<string, unknown>
      >[],
      rowsBefore: catalogSetImages as unknown as Readonly<
        Record<string, unknown>
      >[],
    });
    const promotedCatalogSetIds = new Set(
      normalizedCatalogSets.map((catalogSet) => catalogSet.set_id),
    );
    const normalizedCatalogSetSourceMetadata =
      filterCatalogSetSourceMetadataRowsForPromotion({
        promotedCatalogSetIds,
        rows: catalogSetSourceMetadata,
      });
    const bricksetSourceMetadataPromotedCount =
      normalizedCatalogSetSourceMetadata.filter(
        (row) => row.source === BRICKSET_SOURCE_METADATA_SOURCE,
      ).length;
    const rakutenSourceMetadataPromotedCount =
      normalizedCatalogSetSourceMetadata.filter(
        (row) => row.source === RAKUTEN_LEGO_SOURCE_METADATA_SOURCE,
      ).length;
    const skippedSourceMetadataCount =
      catalogSetSourceMetadata.length -
      normalizedCatalogSetSourceMetadata.length;
    const normalizedCollectionPageSnapshots = collectionPageSnapshots.filter(
      (snapshot) =>
        CATALOG_PROMOTION_NON_PRICE_COLLECTION_SNAPSHOT_SLUGS.has(
          snapshot.collection_slug,
        ),
    );
    const collectionPageSnapshotsBySlug =
      normalizedCollectionPageSnapshots.reduce<Record<string, number>>(
        (countsBySlug, snapshot) => ({
          ...countsBySlug,
          [snapshot.collection_slug]:
            (countsBySlug[snapshot.collection_slug] ?? 0) + 1,
        }),
        {},
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
        'set_id',
        'source',
        'source_url',
        'image_type',
        'image_role',
        'status',
      ],
      rows: normalizedCatalogSetImages as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SET_IMAGES_TABLE,
    });
    validatePromotionRowsRequiredNumberColumns({
      columns: ['sort_order'],
      rows: normalizedCatalogSetImages as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SET_IMAGES_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'catalog_set_id',
        'source',
        'locale',
        'match_confidence',
        'policy',
        'set_number',
        'last_seen_at',
      ],
      rows: normalizedCatalogSetSourceMetadata as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: CATALOG_SET_SOURCE_METADATA_TABLE,
    });
    validatePromotionRowsRequiredColumns({
      columns: [
        'collection_slug',
        'sort_key',
        'snapshot_source',
        'generated_at',
      ],
      rows: normalizedCollectionPageSnapshots as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
    });
    validatePromotionRowsRequiredNumberColumns({
      columns: ['page', 'page_size', 'total_count'],
      rows: normalizedCollectionPageSnapshots as unknown as Readonly<
        Record<string, unknown>
      >[],
      table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
    });
    if (includeCommerceSeeds) {
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
    }

    const merchantPromotionPlan = includeCommerceSeeds
      ? await planMerchantsBySlug({
          rows: normalizedCommerceMerchants,
          supabaseClient: productionSupabaseClient,
        })
      : undefined;
    const existingOfferSeeds = includeCommerceSeeds
      ? await listProductionOfferSeeds({
          supabaseClient: productionSupabaseClient,
        })
      : [];
    const resolvedCommerceOfferSeeds =
      includeCommerceSeeds && merchantPromotionPlan
        ? resolveOfferSeedsByCompositeKey({
            existingOfferSeeds,
            merchantIdByStagingId: merchantPromotionPlan.merchantIdByStagingId,
            nowIso: startedAt.toISOString(),
            rows: normalizedCommerceOfferSeeds,
          })
        : [];

    if (includeCommerceSeeds) {
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
    }

    const changedPublicCatalogThemeTargets =
      await listChangedPublicCatalogThemeTargets({
        nowIso: startedAtIso,
        rows: normalizedCatalogThemes,
        supabaseClient: productionSupabaseClient,
      });
    const changedThemeRowSlugs =
      changedPublicCatalogThemeTargets.changedThemeSlugs;
    const changedHomepageThemeSlugs =
      changedPublicCatalogThemeTargets.changedHomepageThemeSlugs;
    const changedCollectionPageSnapshotSlugs =
      await listChangedCollectionPageSnapshotSlugs({
        rows: normalizedCollectionPageSnapshots,
        supabaseClient: productionSupabaseClient,
      });
    const changedCatalogSetThemeSlugs = await listChangedCatalogSetThemeSlugs({
      catalogThemes: normalizedCatalogThemes,
      nowIso: startedAtIso,
      rows: normalizedCatalogSets,
      supabaseClient: productionSupabaseClient,
    });
    const changedThemeSlugs = [
      ...new Set([...changedThemeRowSlugs, ...changedCatalogSetThemeSlugs]),
    ].sort((left, right) => left.localeCompare(right));
    const catalogSetBySetId = new Map(
      normalizedCatalogSets.map((catalogSet) => [
        catalogSet.set_id,
        catalogSet,
      ]),
    );
    const promotedMetadataSetIds = [
      ...new Set(
        normalizedCatalogSetSourceMetadata.map(
          (metadata) => metadata.catalog_set_id,
        ),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const promotedMetadataSetSlugs = [
      ...new Set(
        promotedMetadataSetIds
          .map((setId) => catalogSetBySetId.get(setId)?.slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const promotedImageMetadataSetIds = [
      ...new Set(
        normalizedCatalogSetImages.map((imageMetadata) => imageMetadata.set_id),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const promotedImageMetadataSetSlugs = [
      ...new Set(
        promotedImageMetadataSetIds
          .map((setId) => catalogSetBySetId.get(setId)?.slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
    ].sort((left, right) => left.localeCompare(right));

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
    tables.catalog_set_images = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'set_id,image_type,sort_order',
      rows: normalizedCatalogSetImages,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SET_IMAGES_TABLE,
    });
    tables.catalog_set_source_metadata = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'catalog_set_id,source,locale',
      rows: normalizedCatalogSetSourceMetadata,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SET_SOURCE_METADATA_TABLE,
    });
    tables.collection_page_snapshots = await upsertRows({
      nowIso: startedAtIso,
      onConflict: 'collection_slug,sort_key,page,page_size',
      rows: normalizedCollectionPageSnapshots,
      supabaseClient: productionSupabaseClient,
      table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
    });

    console.info('[catalog-promotion] promote_metadata_rows_copied', {
      brickset_source_metadata_promoted_count:
        bricksetSourceMetadataPromotedCount,
      promote_metadata_rows_copied:
        tables.catalog_set_source_metadata.upsertedCount,
      rakuten_source_metadata_promoted_count:
        rakutenSourceMetadataPromotedCount,
      source_metadata_eligible_count: normalizedCatalogSetSourceMetadata.length,
      source_metadata_read_count: catalogSetSourceMetadata.length,
      skipped_source_metadata_count: skippedSourceMetadataCount,
      table: CATALOG_SET_SOURCE_METADATA_TABLE,
    });
    const catalogSetImagesDiagnostics =
      buildCatalogSetImagePromotionDiagnostics({
        rows: normalizedCatalogSetImages,
        summary: tables.catalog_set_images,
      });
    console.info('[catalog-promotion] promote_catalog_set_images', {
      active_gallery_count: catalogSetImagesDiagnostics.activeGalleryCount,
      active_hero_count: catalogSetImagesDiagnostics.activeHeroCount,
      active_social_count: catalogSetImagesDiagnostics.activeSocialCount,
      affected_set_count: catalogSetImagesDiagnostics.affectedSetCount,
      catalog_set_images_inserted_count:
        catalogSetImagesDiagnostics.insertedCount,
      catalog_set_images_read_count: catalogSetImagesDiagnostics.readCount,
      catalog_set_images_updated_count:
        catalogSetImagesDiagnostics.updatedCount,
      catalog_set_images_upserted_count:
        catalogSetImagesDiagnostics.upsertedCount,
      table: CATALOG_SET_IMAGES_TABLE,
    });
    console.info('[catalog-promotion] promote_collection_page_snapshots', {
      changed_collection_page_snapshot_slugs:
        changedCollectionPageSnapshotSlugs,
      collection_page_snapshots_by_slug: collectionPageSnapshotsBySlug,
      collection_page_snapshots_read_count: collectionPageSnapshots.length,
      collection_page_snapshots_upserted_count:
        tables.collection_page_snapshots.upsertedCount,
      table: COLLECTION_PAGE_SNAPSHOTS_TABLE,
    });

    const shouldRefreshThemeSummaries =
      tables.catalog_themes.upsertedCount > 0 ||
      tables.catalog_theme_mappings.upsertedCount > 0 ||
      tables.catalog_sets.upsertedCount > 0;
    const themeSummaryRefresh = {
      affectedThemeCount: changedThemeSlugs.length,
      affectedThemeSlugs: changedThemeSlugs,
      attempted: shouldRefreshThemeSummaries,
      status: shouldRefreshThemeSummaries ? 'success' : 'skipped',
    } satisfies NonNullable<CatalogPromotionResult['themeSummaryRefresh']>;

    if (shouldRefreshThemeSummaries) {
      await refreshCatalogThemeSummaries({
        supabaseClient: productionSupabaseClient,
      });
    }
    let setDetailRelatedThemeSnapshotRefresh:
      | SetDetailRelatedThemeSnapshotRefreshResult
      | undefined;
    let setDetailRelatedThemeSnapshotRefreshWarning: string | undefined;

    if (changedThemeSlugs.length > 0) {
      try {
        setDetailRelatedThemeSnapshotRefresh =
          await refreshSetDetailRelatedThemeSnapshotsForSetIdsFn({
            supabaseClient: productionSupabaseClient,
            themeSlugs: changedThemeSlugs,
          });
      } catch (error) {
        setDetailRelatedThemeSnapshotRefreshWarning =
          error instanceof Error
            ? error.message
            : 'Set detail related-theme snapshot refresh failed.';
        console.warn(
          '[catalog-promotion] set_detail_related_theme_refresh_failed',
          {
            error: setDetailRelatedThemeSnapshotRefreshWarning,
            theme_slugs: changedThemeSlugs,
          },
        );
      }
    }

    if (includeCommerceSeeds && merchantPromotionPlan) {
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
    }

    return {
      brickset_source_metadata_promoted_count:
        bricksetSourceMetadataPromotedCount,
      bricksetSourceMetadataPromotedCount,
      affectedThemeCount: changedThemeSlugs.length,
      affectedThemeSlugs: changedThemeSlugs,
      changedCollectionPageSnapshotSlugs,
      changedHomepageThemeSlugs,
      changedThemeSlugs,
      collection_page_snapshots_by_slug: collectionPageSnapshotsBySlug,
      collection_page_snapshots_read_count: collectionPageSnapshots.length,
      collection_page_snapshots_upserted_count:
        tables.collection_page_snapshots.upsertedCount,
      collectionPageSnapshotsBySlug,
      collectionPageSnapshotsReadCount: collectionPageSnapshots.length,
      collectionPageSnapshotsUpsertedCount:
        tables.collection_page_snapshots.upsertedCount,
      catalog_set_images_active_gallery_count:
        catalogSetImagesDiagnostics.activeGalleryCount,
      catalog_set_images_active_hero_count:
        catalogSetImagesDiagnostics.activeHeroCount,
      catalog_set_images_active_social_count:
        catalogSetImagesDiagnostics.activeSocialCount,
      catalog_set_images_affected_set_count:
        catalogSetImagesDiagnostics.affectedSetCount,
      catalog_set_images_read_count: catalogSetImagesDiagnostics.readCount,
      catalog_set_images_upserted_count:
        catalogSetImagesDiagnostics.upsertedCount,
      catalogSetImages: catalogSetImagesDiagnostics,
      durationMs: now().getTime() - startedAt.getTime(),
      homepageAffected: changedHomepageThemeSlugs.length > 0,
      promotedImageMetadataSetIds,
      promotedImageMetadataSetSlugs,
      promotedMetadataSetIds,
      promotedMetadataSetSlugs,
      rakuten_source_metadata_promoted_count:
        rakutenSourceMetadataPromotedCount,
      rakutenSourceMetadataPromotedCount,
      skipped_source_metadata_count: skippedSourceMetadataCount,
      source_metadata_eligible_count: normalizedCatalogSetSourceMetadata.length,
      source_metadata_read_count: catalogSetSourceMetadata.length,
      sourceMetadataEligibleCount: normalizedCatalogSetSourceMetadata.length,
      sourceMetadataReadCount: catalogSetSourceMetadata.length,
      skippedSourceMetadataCount,
      startedAt: startedAtIso,
      status: 'ok',
      ...(setDetailRelatedThemeSnapshotRefresh
        ? { setDetailRelatedThemeSnapshotRefresh }
        : {}),
      ...(setDetailRelatedThemeSnapshotRefreshWarning
        ? { setDetailRelatedThemeSnapshotRefreshWarning }
        : {}),
      themeSummaryRefresh,
      excludedTables,
      tables: tables as CatalogPromotionResult['tables'],
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Catalog promotion failed unexpectedly.';
    const failedTableMatch = message.match(
      /(catalog_source_themes|catalog_themes|catalog_theme_mappings|catalog_sets|catalog_set_minifig_summaries|catalog_set_images|catalog_set_source_metadata|collection_page_snapshots|commerce_merchants|commerce_benchmark_sets|commerce_offer_seeds)/,
    );

    throw new CatalogPromotionError(message, {
      durationMs: now().getTime() - startedAt.getTime(),
      failedTable: failedTableMatch?.[1],
      tables,
    });
  }
}

export async function previewCatalogPromotionFromStagingToProduction({
  createProductionSupabaseClient,
  createStagingSupabaseClient,
  includeCommerceSeeds = false,
  includeHeavy = false,
  now = () => new Date(),
}: PreviewCatalogPromotionDependencies = {}): Promise<CatalogPromotionPreviewResult> {
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
  const samples: CatalogPromotionPreviewSample[] = [];
  const tableConfigs = listPromotionPreviewTableConfigs({
    includeCommerceSeeds,
  });
  const excludedTables = includeCommerceSeeds
    ? []
    : [...CATALOG_PROMOTION_COMMERCE_SEED_TABLES];
  const catalogSetIdRows = await readOrderedRows<Pick<CatalogSetRow, 'set_id'>>(
    {
      columns: 'set_id',
      orderBy: 'created_at',
      supabaseClient: stagingSupabaseClient,
      table: CATALOG_SETS_TABLE,
    },
  );
  const promotedCatalogSetIds = new Set(
    catalogSetIdRows.map((catalogSet) => catalogSet.set_id),
  );
  const catalogSetImageRows = await readOrderedRows<CatalogSetImageRow>({
    columns:
      'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, duplicate_of_id, duplicate_reason, duplicate_distance, status, metadata_json',
    orderBy: 'set_id',
    supabaseClient: stagingSupabaseClient,
    table: CATALOG_SET_IMAGES_TABLE,
  });
  assertPromotionReadWasNotDefaultCapped({
    readCount: catalogSetImageRows.length,
    table: CATALOG_SET_IMAGES_TABLE,
  });
  const skippedHeavyTables = tableConfigs
    .filter(
      (tableConfig) =>
        isHeavyPromotionPreviewTable(tableConfig) && !includeHeavy,
    )
    .map((tableConfig) => tableConfig.table);
  const tableEntries = await Promise.all(
    tableConfigs.map(async (tableConfig) => {
      if (isHeavyPromotionPreviewTable(tableConfig) && !includeHeavy) {
        return [
          tableConfig.table,
          {
            insertedCount: 0,
            readCount: 0,
            skipped: true,
            strategy: 'heavy_skipped',
            updatedCount: 0,
            warning: 'Skipped in lightweight preview.',
          } satisfies CatalogPromotionPreviewTableSummary,
        ] as const;
      }

      return [
        tableConfig.table,
        await previewPromotionTable({
          ...tableConfig,
          ...(tableConfig.table === CATALOG_SET_IMAGES_TABLE
            ? {
                preloadedStagingRows: catalogSetImageRows as unknown as Record<
                  string,
                  unknown
                >[],
              }
            : {}),
          promotedCatalogSetIds,
          productionSupabaseClient,
          samples,
          stagingSupabaseClient,
        }),
      ] as const;
    }),
  );
  const excludedTableEntries = excludedTables.map(
    (table) => [table, buildExcludedPreviewTableSummary()] as const,
  );
  const tables = Object.fromEntries(tableEntries) as Record<
    string,
    CatalogPromotionPreviewTableSummary
  >;
  for (const [table, summary] of excludedTableEntries) {
    tables[table] = summary;
  }
  const pendingPromoteCount = Object.values(tables).reduce(
    (total, tableSummary) =>
      total + tableSummary.insertedCount + tableSummary.updatedCount,
    0,
  );
  const operatorSummary = {
    mappings: tables[CATALOG_THEME_MAPPINGS_TABLE] ?? {
      insertedCount: 0,
      readCount: 0,
      skipped: false,
      strategy: 'sample_diff',
      updatedCount: 0,
    },
    sets: tables[CATALOG_SETS_TABLE] ?? {
      insertedCount: 0,
      readCount: 0,
      skipped: false,
      strategy: 'sample_diff',
      updatedCount: 0,
    },
    themes: tables[CATALOG_THEMES_TABLE] ?? {
      insertedCount: 0,
      readCount: 0,
      skipped: false,
      strategy: 'sample_diff',
      updatedCount: 0,
    },
  } satisfies CatalogPromotionPreviewResult['operatorSummary'];
  const meaningfulPendingPromoteCount = Object.values(operatorSummary).reduce(
    (total, tableSummary) =>
      total + tableSummary.insertedCount + tableSummary.updatedCount,
    0,
  );
  const catalogSetImages = buildCatalogSetImagePromotionDiagnostics({
    rows: catalogSetImageRows,
    summary: tables[CATALOG_SET_IMAGES_TABLE] ?? {
      insertedCount: 0,
      readCount: 0,
      updatedCount: 0,
    },
  });

  return {
    catalogSetImages,
    generatedAt: now().toISOString(),
    excludedTables,
    meaningfulPendingPromoteCount,
    operatorSummary,
    pendingPromoteCount,
    samples,
    skippedHeavyTables,
    sourceEnvironment: 'staging',
    status: 'ok',
    tables,
    targetEnvironment: 'production',
  };
}
