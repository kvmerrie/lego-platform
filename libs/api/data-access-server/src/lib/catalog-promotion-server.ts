import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  getServerSupabaseConfig,
  getStagingSupabaseConfig,
} from '@lego-platform/shared/config';
import { CATALOG_SETS_TABLE } from '@lego-platform/catalog/data-access-server';
import {
  COMMERCE_BENCHMARK_SETS_TABLE,
  COMMERCE_MERCHANTS_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
} from '@lego-platform/commerce/data-access-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';

type CatalogPromotionSupabaseClient = Pick<SupabaseClient, 'from'>;

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
  durationMs: number;
  startedAt: string;
  status: 'ok';
  tables: {
    catalog_source_themes: CatalogPromotionTableSummary;
    catalog_themes: CatalogPromotionTableSummary;
    catalog_theme_mappings: CatalogPromotionTableSummary;
    catalog_sets: CatalogPromotionTableSummary;
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
  return {
    ...offerSeed,
    notes: offerSeed.notes ?? '',
  };
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
  const { data, error } = await supabaseClient
    .from(table)
    .select(columns)
    .order(orderBy, { ascending: true });

  if (error) {
    throw new Error(
      `Unable to read ${table} from staging. ${JSON.stringify(error)}`,
    );
  }

  return (data as unknown as TRow[] | null) ?? [];
}

async function listExistingConflictKeys({
  onConflict,
  supabaseClient,
  table,
}: {
  onConflict: string;
  supabaseClient: CatalogPromotionSupabaseClient;
  table: string;
}): Promise<Set<string>> {
  const conflictColumns = splitConflictColumns(onConflict);
  const { data, error } = await supabaseClient
    .from(table)
    .select(conflictColumns.join(', '));

  if (error) {
    throw new Error(
      `Unable to inspect existing ${table} rows before promotion. ${JSON.stringify(error)}`,
    );
  }

  const rows = (data as unknown as Record<string, unknown>[] | null) ?? [];

  return new Set(
    rows.map((row) =>
      buildConflictKey({
        columns: conflictColumns,
        row,
      }),
    ),
  );
}

async function upsertRows<TRow>({
  onConflict,
  rows,
  supabaseClient,
  table,
}: {
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
  const existingKeys = await listExistingConflictKeys({
    onConflict,
    supabaseClient,
    table,
  });

  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row: toRowRecord(row),
    });

    if (existingKeys.has(conflictKey)) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  for (const chunk of chunkValues(rows, 100)) {
    const { error } = await supabaseClient
      .from(table)
      .upsert(chunk as readonly Record<string, unknown>[], {
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

async function listProductionMerchants({
  supabaseClient,
}: {
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<Array<Pick<CommerceMerchantRow, 'id' | 'slug'>>> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select('id, slug');

  if (error) {
    throw new Error(
      `Unable to inspect existing ${COMMERCE_MERCHANTS_TABLE} rows before promotion. ${JSON.stringify(error)}`,
    );
  }

  return (data as Array<Pick<CommerceMerchantRow, 'id' | 'slug'>> | null) ?? [];
}

async function listProductionOfferSeeds({
  supabaseClient,
}: {
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<
  Array<Pick<CommerceOfferSeedRow, 'id' | 'merchant_id' | 'set_id'>>
> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select('id, set_id, merchant_id');

  if (error) {
    throw new Error(
      `Unable to inspect existing ${COMMERCE_OFFER_SEEDS_TABLE} rows before promotion. ${JSON.stringify(error)}`,
    );
  }

  return (
    (data as Array<
      Pick<CommerceOfferSeedRow, 'id' | 'merchant_id' | 'set_id'>
    > | null) ?? []
  );
}

async function upsertMerchantsBySlug({
  rows,
  supabaseClient,
}: {
  rows: readonly CommerceMerchantRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<{
  merchantIdByStagingId: Map<string, string>;
  summary: CatalogPromotionTableSummary;
}> {
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
    summary: await upsertRows({
      onConflict: 'slug',
      rows: rowsForUpsert,
      supabaseClient,
      table: COMMERCE_MERCHANTS_TABLE,
    }),
  };
}

async function upsertOfferSeedsByCompositeKey({
  merchantIdByStagingId,
  rows,
  supabaseClient,
}: {
  merchantIdByStagingId: ReadonlyMap<string, string>;
  rows: readonly CommerceOfferSeedRow[];
  supabaseClient: CatalogPromotionSupabaseClient;
}): Promise<CatalogPromotionTableSummary> {
  const existingOfferSeeds = await listProductionOfferSeeds({
    supabaseClient,
  });
  const existingOfferSeedIdByKey = new Map(
    existingOfferSeeds.map((offerSeed) => [
      `${offerSeed.set_id}::${offerSeed.merchant_id}`,
      offerSeed.id,
    ]),
  );
  const rowsForUpsert = rows.map((offerSeed) => {
    const targetMerchantId = merchantIdByStagingId.get(offerSeed.merchant_id);

    if (!targetMerchantId) {
      throw new Error(
        `Unable to map staging merchant ${offerSeed.merchant_id} for offer seed ${offerSeed.id}.`,
      );
    }

    const compositeKey = `${offerSeed.set_id}::${targetMerchantId}`;
    const targetId = existingOfferSeedIdByKey.get(compositeKey) ?? offerSeed.id;

    return {
      ...offerSeed,
      id: targetId,
      merchant_id: targetMerchantId,
    };
  });

  return upsertRows({
    onConflict: 'set_id,merchant_id',
    rows: rowsForUpsert,
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
        columns: 'id, slug, display_name, status, created_at, updated_at',
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

    tables.catalog_source_themes = await upsertRows({
      onConflict: 'id',
      rows: catalogSourceThemes,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SOURCE_THEMES_TABLE,
    });
    tables.catalog_themes = await upsertRows({
      onConflict: 'id',
      rows: catalogThemes,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_THEMES_TABLE,
    });
    tables.catalog_theme_mappings = await upsertRows({
      onConflict: 'source_theme_id',
      rows: catalogThemeMappings,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_THEME_MAPPINGS_TABLE,
    });
    tables.catalog_sets = await upsertRows({
      onConflict: 'set_id',
      rows: catalogSets,
      supabaseClient: productionSupabaseClient,
      table: CATALOG_SETS_TABLE,
    });

    const merchantPromotion = await upsertMerchantsBySlug({
      rows: commerceMerchants.map(normalizeMerchantRow),
      supabaseClient: productionSupabaseClient,
    });

    tables.commerce_merchants = merchantPromotion.summary;
    tables.commerce_benchmark_sets = await upsertRows({
      onConflict: 'set_id',
      rows: commerceBenchmarkSets.map(normalizeBenchmarkSetRow),
      supabaseClient: productionSupabaseClient,
      table: COMMERCE_BENCHMARK_SETS_TABLE,
    });
    tables.commerce_offer_seeds = await upsertOfferSeedsByCompositeKey({
      merchantIdByStagingId: merchantPromotion.merchantIdByStagingId,
      rows: commerceOfferSeeds.map(normalizeOfferSeedRow),
      supabaseClient: productionSupabaseClient,
    });

    return {
      durationMs: now().getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      status: 'ok',
      tables: tables as CatalogPromotionResult['tables'],
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Catalog promotion failed unexpectedly.';
    const failedTableMatch = message.match(
      /(catalog_source_themes|catalog_themes|catalog_theme_mappings|catalog_sets|commerce_merchants|commerce_benchmark_sets|commerce_offer_seeds)/,
    );

    throw new CatalogPromotionError(message, {
      durationMs: now().getTime() - startedAt.getTime(),
      failedTable: failedTableMatch?.[1],
      tables,
    });
  }
}
