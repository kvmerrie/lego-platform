import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const CURRENT_CATALOG_SETS_TABLE = 'catalog_sets_overlay';
const CURRENT_CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CURRENT_CATALOG_THEMES_TABLE = 'catalog_themes';
const CURRENT_CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const CURRENT_COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const CURRENT_COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
const CURRENT_COMMERCE_BENCHMARK_SETS_TABLE = 'commerce_benchmark_sets';

const TARGET_CATALOG_SETS_TABLE = 'catalog_sets';
const TARGET_CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const TARGET_CATALOG_THEMES_TABLE = 'catalog_themes';
const TARGET_CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const TARGET_COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const TARGET_COMMERCE_BENCHMARK_SETS_TABLE = 'commerce_benchmark_sets';
const TARGET_COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';

type CatalogBootstrapSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogBootstrapSetRow {
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

interface CatalogBootstrapSourceThemeRow {
  created_at: string;
  id: string;
  parent_source_theme_id: string | null;
  source_system: string;
  source_theme_name: string;
  updated_at: string;
}

interface CatalogBootstrapThemeRow {
  created_at: string;
  display_name: string;
  id: string;
  slug: string;
  status: string;
  updated_at: string;
}

interface CatalogBootstrapThemeMappingRow {
  created_at: string;
  primary_theme_id: string;
  source_theme_id: string;
  updated_at: string;
}

interface CatalogBootstrapMerchantRow {
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

interface CatalogBootstrapOfferSeedRow {
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

interface CatalogBootstrapBenchmarkSetRow {
  created_at: string;
  notes: string | null;
  set_id: string;
  updated_at: string;
}

export interface CatalogBootstrapCatalogSet {
  createdAt: string;
  imageUrl?: string;
  name: string;
  pieceCount: number;
  primaryThemeId: string;
  releaseYear: number;
  setId: string;
  slug: string;
  source: string;
  sourceSetNumber: string;
  sourceThemeId: string;
  status: string;
  updatedAt: string;
}

export interface CatalogBootstrapSourceTheme {
  createdAt: string;
  id: string;
  parentSourceThemeId?: string;
  sourceSystem: string;
  sourceThemeName: string;
  updatedAt: string;
}

export interface CatalogBootstrapTheme {
  createdAt: string;
  displayName: string;
  id: string;
  slug: string;
  status: string;
  updatedAt: string;
}

export interface CatalogBootstrapThemeMapping {
  createdAt: string;
  primaryThemeId: string;
  sourceThemeId: string;
  updatedAt: string;
}

export interface CatalogBootstrapMerchant {
  affiliateNetwork?: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string;
  slug: string;
  sourceType: string;
  updatedAt: string;
}

export interface CatalogBootstrapOfferSeed {
  createdAt: string;
  id: string;
  isActive: boolean;
  lastVerifiedAt?: string;
  merchantId: string;
  notes: string;
  productUrl: string;
  setId: string;
  updatedAt: string;
  validationStatus: string;
}

export interface CatalogBootstrapBenchmarkSet {
  createdAt: string;
  notes: string;
  setId: string;
  updatedAt: string;
}

export interface CatalogCleanBootstrapPayload {
  catalog: {
    sets: readonly CatalogBootstrapCatalogSet[];
    sourceThemes: readonly CatalogBootstrapSourceTheme[];
    themeMappings: readonly CatalogBootstrapThemeMapping[];
    themes: readonly CatalogBootstrapTheme[];
  };
  commerce: {
    benchmarkSets: readonly CatalogBootstrapBenchmarkSet[];
    merchants: readonly CatalogBootstrapMerchant[];
    offerSeeds: readonly CatalogBootstrapOfferSeed[];
  };
  exclusions: {
    latestOffers: 'excluded';
    localCatalogProse: 'excluded';
    pricingHistoryRows: 'excluded';
    snapshotArtifacts: 'excluded';
    userData: 'excluded';
  };
  generatedAt: string;
  notes: string;
  source: 'brickhunt-clean-bootstrap';
}

export interface BuildCatalogCleanBootstrapPayloadOptions {
  includeInactiveCatalogSets?: boolean;
  includeInactiveMerchants?: boolean;
  includeInactiveOfferSeeds?: boolean;
  now?: Date;
  supabaseClient?: CatalogBootstrapSupabaseClient;
}

export interface CatalogCleanBootstrapImportStepSummary {
  insertedCount: number;
  inputCount: number;
  table: string;
  updatedCount: number;
}

export interface CatalogCleanBootstrapImportSummary {
  steps: readonly CatalogCleanBootstrapImportStepSummary[];
}

export interface CatalogCleanBootstrapVerifyStepSummary {
  expectedCount: number;
  matchedCount: number;
  missingKeys: readonly string[];
  table: string;
}

export interface CatalogCleanBootstrapVerifySummary {
  isComplete: boolean;
  steps: readonly CatalogCleanBootstrapVerifyStepSummary[];
}

async function retryCatalogBootstrapRead<TValue>({
  attempts = 3,
  load,
}: {
  attempts?: number;
  load: () => Promise<TValue>;
}): Promise<TValue> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, attempt * 250);
      });
    }
  }

  throw lastError;
}

function toBootstrapCatalogSet(
  row: CatalogBootstrapSetRow,
): CatalogBootstrapCatalogSet {
  if (!row.source_theme_id || !row.primary_theme_id) {
    throw new Error(
      `Catalog set ${row.set_id} is missing normalized theme ids. Run the theme backfill before exporting a clean bootstrap payload.`,
    );
  }

  return {
    createdAt: row.created_at,
    ...(row.image_url
      ? {
          imageUrl: row.image_url,
        }
      : {}),
    name: row.name,
    pieceCount: row.piece_count,
    primaryThemeId: row.primary_theme_id,
    releaseYear: row.release_year,
    setId: row.set_id,
    slug: row.slug,
    source: row.source,
    sourceSetNumber: row.source_set_number,
    sourceThemeId: row.source_theme_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toBootstrapSourceTheme(
  row: CatalogBootstrapSourceThemeRow,
): CatalogBootstrapSourceTheme {
  return {
    createdAt: row.created_at,
    id: row.id,
    ...(row.parent_source_theme_id
      ? {
          parentSourceThemeId: row.parent_source_theme_id,
        }
      : {}),
    sourceSystem: row.source_system,
    sourceThemeName: row.source_theme_name,
    updatedAt: row.updated_at,
  };
}

function toBootstrapTheme(
  row: CatalogBootstrapThemeRow,
): CatalogBootstrapTheme {
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toBootstrapThemeMapping(
  row: CatalogBootstrapThemeMappingRow,
): CatalogBootstrapThemeMapping {
  return {
    createdAt: row.created_at,
    primaryThemeId: row.primary_theme_id,
    sourceThemeId: row.source_theme_id,
    updatedAt: row.updated_at,
  };
}

function toBootstrapMerchant(
  row: CatalogBootstrapMerchantRow,
): CatalogBootstrapMerchant {
  return {
    ...(row.affiliate_network
      ? {
          affiliateNetwork: row.affiliate_network,
        }
      : {}),
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes ?? '',
    slug: row.slug,
    sourceType: row.source_type,
    updatedAt: row.updated_at,
  };
}

function toBootstrapOfferSeed(
  row: CatalogBootstrapOfferSeedRow,
): CatalogBootstrapOfferSeed {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    ...(row.last_verified_at
      ? {
          lastVerifiedAt: row.last_verified_at,
        }
      : {}),
    merchantId: row.merchant_id,
    notes: row.notes ?? '',
    productUrl: row.product_url,
    setId: row.set_id,
    updatedAt: row.updated_at,
    validationStatus: row.validation_status,
  };
}

function toBootstrapBenchmarkSet(
  row: CatalogBootstrapBenchmarkSetRow,
): CatalogBootstrapBenchmarkSet {
  return {
    createdAt: row.created_at,
    notes: row.notes ?? '',
    setId: row.set_id,
    updatedAt: row.updated_at,
  };
}

function sortByStringField<TValue>(
  values: readonly TValue[],
  getValue: (value: TValue) => string,
): TValue[] {
  return [...values].sort((left, right) =>
    getValue(left).localeCompare(getValue(right), 'nl'),
  );
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

function assertNoDuplicates({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      throw new Error(
        `Clean bootstrap payload cannot be built because ${label} contains a duplicate value: ${value}.`,
      );
    }

    seenValues.add(value);
  }
}

function validateCatalogCleanBootstrapPayload(
  payload: CatalogCleanBootstrapPayload,
): void {
  assertNoDuplicates({
    label: 'catalog set ids',
    values: payload.catalog.sets.map((catalogSet) => catalogSet.setId),
  });
  assertNoDuplicates({
    label: 'catalog set slugs',
    values: payload.catalog.sets.map((catalogSet) => catalogSet.slug),
  });
  assertNoDuplicates({
    label: 'catalog source theme ids',
    values: payload.catalog.sourceThemes.map((sourceTheme) => sourceTheme.id),
  });
  assertNoDuplicates({
    label: 'catalog theme ids',
    values: payload.catalog.themes.map((catalogTheme) => catalogTheme.id),
  });
  assertNoDuplicates({
    label: 'catalog theme slugs',
    values: payload.catalog.themes.map((catalogTheme) => catalogTheme.slug),
  });
  assertNoDuplicates({
    label: 'catalog theme mapping source ids',
    values: payload.catalog.themeMappings.map(
      (themeMapping) => themeMapping.sourceThemeId,
    ),
  });
  assertNoDuplicates({
    label: 'commerce merchant ids',
    values: payload.commerce.merchants.map((merchant) => merchant.id),
  });
  assertNoDuplicates({
    label: 'commerce merchant slugs',
    values: payload.commerce.merchants.map((merchant) => merchant.slug),
  });
  assertNoDuplicates({
    label: 'commerce offer seed ids',
    values: payload.commerce.offerSeeds.map((offerSeed) => offerSeed.id),
  });

  const sourceThemeById = new Map(
    payload.catalog.sourceThemes.map((sourceTheme) => [sourceTheme.id, true]),
  );
  const themeById = new Map(
    payload.catalog.themes.map((catalogTheme) => [catalogTheme.id, true]),
  );
  const themeMappingBySourceThemeId = new Map(
    payload.catalog.themeMappings.map((themeMapping) => [
      themeMapping.sourceThemeId,
      themeMapping.primaryThemeId,
    ]),
  );
  const catalogSetById = new Map(
    payload.catalog.sets.map((catalogSet) => [catalogSet.setId, true]),
  );
  const merchantById = new Map(
    payload.commerce.merchants.map((merchant) => [merchant.id, true]),
  );

  for (const sourceTheme of payload.catalog.sourceThemes) {
    if (
      sourceTheme.parentSourceThemeId &&
      !sourceThemeById.has(sourceTheme.parentSourceThemeId)
    ) {
      throw new Error(
        `Clean bootstrap payload references missing parent source theme ${sourceTheme.parentSourceThemeId}.`,
      );
    }
  }

  for (const themeMapping of payload.catalog.themeMappings) {
    if (!sourceThemeById.has(themeMapping.sourceThemeId)) {
      throw new Error(
        `Clean bootstrap payload references missing source theme ${themeMapping.sourceThemeId} in theme mappings.`,
      );
    }

    if (!themeById.has(themeMapping.primaryThemeId)) {
      throw new Error(
        `Clean bootstrap payload references missing primary theme ${themeMapping.primaryThemeId} in theme mappings.`,
      );
    }
  }

  for (const catalogSet of payload.catalog.sets) {
    if (!sourceThemeById.has(catalogSet.sourceThemeId)) {
      throw new Error(
        `Clean bootstrap payload references missing source theme ${catalogSet.sourceThemeId} for set ${catalogSet.setId}.`,
      );
    }

    if (!themeById.has(catalogSet.primaryThemeId)) {
      throw new Error(
        `Clean bootstrap payload references missing primary theme ${catalogSet.primaryThemeId} for set ${catalogSet.setId}.`,
      );
    }

    const mappedPrimaryThemeId = themeMappingBySourceThemeId.get(
      catalogSet.sourceThemeId,
    );

    if (!mappedPrimaryThemeId) {
      throw new Error(
        `Clean bootstrap payload is missing a theme mapping for set ${catalogSet.setId}.`,
      );
    }

    if (mappedPrimaryThemeId !== catalogSet.primaryThemeId) {
      throw new Error(
        `Clean bootstrap payload has mismatched theme ids for set ${catalogSet.setId}.`,
      );
    }
  }

  for (const benchmarkSet of payload.commerce.benchmarkSets) {
    if (!catalogSetById.has(benchmarkSet.setId)) {
      throw new Error(
        `Clean bootstrap payload benchmark set ${benchmarkSet.setId} is missing from catalog sets.`,
      );
    }
  }

  for (const offerSeed of payload.commerce.offerSeeds) {
    if (!catalogSetById.has(offerSeed.setId)) {
      throw new Error(
        `Clean bootstrap payload offer seed ${offerSeed.id} points at unknown set ${offerSeed.setId}.`,
      );
    }

    if (!merchantById.has(offerSeed.merchantId)) {
      throw new Error(
        `Clean bootstrap payload offer seed ${offerSeed.id} points at unknown merchant ${offerSeed.merchantId}.`,
      );
    }
  }
}

export async function readCatalogCleanBootstrapPayload({
  cwd = process.cwd(),
  inputPath,
  readFileImpl = readFile,
}: {
  cwd?: string;
  inputPath: string;
  readFileImpl?: typeof readFile;
}): Promise<CatalogCleanBootstrapPayload> {
  const resolvedInputPath = resolve(cwd, inputPath);
  const rawPayload = await readFileImpl(resolvedInputPath, 'utf8');
  const payload = JSON.parse(rawPayload) as CatalogCleanBootstrapPayload;

  if (payload.source !== 'brickhunt-clean-bootstrap') {
    throw new Error(
      `Bootstrap payload at ${resolvedInputPath} does not have source=brickhunt-clean-bootstrap.`,
    );
  }

  validateCatalogCleanBootstrapPayload(payload);

  return payload;
}

function toTargetSourceThemeRow(sourceTheme: CatalogBootstrapSourceTheme) {
  return {
    created_at: sourceTheme.createdAt,
    id: sourceTheme.id,
    parent_source_theme_id: sourceTheme.parentSourceThemeId ?? null,
    source_system: sourceTheme.sourceSystem,
    source_theme_name: sourceTheme.sourceThemeName,
    updated_at: sourceTheme.updatedAt,
  };
}

function toTargetThemeRow(theme: CatalogBootstrapTheme) {
  return {
    created_at: theme.createdAt,
    display_name: theme.displayName,
    id: theme.id,
    slug: theme.slug,
    status: theme.status,
    updated_at: theme.updatedAt,
  };
}

function toTargetThemeMappingRow(themeMapping: CatalogBootstrapThemeMapping) {
  return {
    created_at: themeMapping.createdAt,
    primary_theme_id: themeMapping.primaryThemeId,
    source_theme_id: themeMapping.sourceThemeId,
    updated_at: themeMapping.updatedAt,
  };
}

function toTargetCatalogSetRow(catalogSet: CatalogBootstrapCatalogSet) {
  return {
    created_at: catalogSet.createdAt,
    image_url: catalogSet.imageUrl ?? null,
    name: catalogSet.name,
    piece_count: catalogSet.pieceCount,
    primary_theme_id: catalogSet.primaryThemeId,
    release_year: catalogSet.releaseYear,
    set_id: catalogSet.setId,
    slug: catalogSet.slug,
    source: catalogSet.source,
    source_set_number: catalogSet.sourceSetNumber,
    source_theme_id: catalogSet.sourceThemeId,
    status: catalogSet.status,
    updated_at: catalogSet.updatedAt,
  };
}

function toTargetMerchantRow(merchant: CatalogBootstrapMerchant) {
  return {
    affiliate_network: merchant.affiliateNetwork ?? null,
    created_at: merchant.createdAt,
    id: merchant.id,
    is_active: merchant.isActive,
    name: merchant.name,
    notes: merchant.notes,
    slug: merchant.slug,
    source_type: merchant.sourceType,
    updated_at: merchant.updatedAt,
  };
}

function toTargetBenchmarkSetRow(benchmarkSet: CatalogBootstrapBenchmarkSet) {
  return {
    created_at: benchmarkSet.createdAt,
    notes: benchmarkSet.notes,
    set_id: benchmarkSet.setId,
    updated_at: benchmarkSet.updatedAt,
  };
}

function toTargetOfferSeedRow(offerSeed: CatalogBootstrapOfferSeed) {
  return {
    created_at: offerSeed.createdAt,
    id: offerSeed.id,
    is_active: offerSeed.isActive,
    last_verified_at: offerSeed.lastVerifiedAt ?? null,
    merchant_id: offerSeed.merchantId,
    notes: offerSeed.notes,
    product_url: offerSeed.productUrl,
    set_id: offerSeed.setId,
    updated_at: offerSeed.updatedAt,
    validation_status: offerSeed.validationStatus,
  };
}

async function listExistingConflictKeys({
  onConflict,
  supabaseClient,
  table,
}: {
  onConflict: string;
  supabaseClient: CatalogBootstrapSupabaseClient;
  table: string;
}): Promise<Set<string>> {
  const conflictColumns = splitConflictColumns(onConflict);
  const { data, error } = await supabaseClient
    .from(table)
    .select(conflictColumns.join(', '));

  if (error) {
    throw new Error(
      `Unable to load existing ${table} rows before import. ${JSON.stringify(error)}`,
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

async function upsertBootstrapRows<TRow extends Record<string, unknown>>({
  onConflict,
  rows,
  supabaseClient,
  table,
}: {
  onConflict: string;
  rows: readonly TRow[];
  supabaseClient: CatalogBootstrapSupabaseClient;
  table: string;
}): Promise<CatalogCleanBootstrapImportStepSummary> {
  if (rows.length === 0) {
    return {
      insertedCount: 0,
      inputCount: 0,
      table,
      updatedCount: 0,
    };
  }

  const conflictColumns = splitConflictColumns(onConflict);
  const existingKeys = await retryCatalogBootstrapRead({
    load: () =>
      listExistingConflictKeys({
        onConflict,
        supabaseClient,
        table,
      }),
  });

  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const conflictKey = buildConflictKey({
      columns: conflictColumns,
      row,
    });

    if (existingKeys.has(conflictKey)) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  for (const chunk of chunkValues(rows, 100)) {
    const { error } = await supabaseClient.from(table).upsert(chunk, {
      onConflict,
    });

    if (error) {
      throw new Error(`Unable to import ${table}. ${JSON.stringify(error)}`);
    }
  }

  return {
    insertedCount,
    inputCount: rows.length,
    table,
    updatedCount,
  };
}

export async function importCatalogCleanBootstrapPayload({
  payload,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  payload: CatalogCleanBootstrapPayload;
  supabaseClient?: CatalogBootstrapSupabaseClient;
}): Promise<CatalogCleanBootstrapImportSummary> {
  validateCatalogCleanBootstrapPayload(payload);

  const steps = [
    await upsertBootstrapRows({
      onConflict: 'id',
      rows: payload.catalog.sourceThemes.map(toTargetSourceThemeRow),
      supabaseClient,
      table: TARGET_CATALOG_SOURCE_THEMES_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'id',
      rows: payload.catalog.themes.map(toTargetThemeRow),
      supabaseClient,
      table: TARGET_CATALOG_THEMES_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'source_theme_id',
      rows: payload.catalog.themeMappings.map(toTargetThemeMappingRow),
      supabaseClient,
      table: TARGET_CATALOG_THEME_MAPPINGS_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'set_id',
      rows: payload.catalog.sets.map(toTargetCatalogSetRow),
      supabaseClient,
      table: TARGET_CATALOG_SETS_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'id',
      rows: payload.commerce.merchants.map(toTargetMerchantRow),
      supabaseClient,
      table: TARGET_COMMERCE_MERCHANTS_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'set_id',
      rows: payload.commerce.benchmarkSets.map(toTargetBenchmarkSetRow),
      supabaseClient,
      table: TARGET_COMMERCE_BENCHMARK_SETS_TABLE,
    }),
    await upsertBootstrapRows({
      onConflict: 'id',
      rows: payload.commerce.offerSeeds.map(toTargetOfferSeedRow),
      supabaseClient,
      table: TARGET_COMMERCE_OFFER_SEEDS_TABLE,
    }),
  ] satisfies CatalogCleanBootstrapImportStepSummary[];

  return {
    steps,
  };
}

async function verifyBootstrapRows({
  expectedRows,
  onConflict,
  supabaseClient,
  table,
}: {
  expectedRows: readonly Record<string, unknown>[];
  onConflict: string;
  supabaseClient: CatalogBootstrapSupabaseClient;
  table: string;
}): Promise<CatalogCleanBootstrapVerifyStepSummary> {
  const conflictColumns = splitConflictColumns(onConflict);
  const existingKeys = await retryCatalogBootstrapRead({
    load: () =>
      listExistingConflictKeys({
        onConflict,
        supabaseClient,
        table,
      }),
  });

  const missingKeys = expectedRows
    .map((row) =>
      buildConflictKey({
        columns: conflictColumns,
        row,
      }),
    )
    .filter((key) => !existingKeys.has(key));

  return {
    expectedCount: expectedRows.length,
    matchedCount: expectedRows.length - missingKeys.length,
    missingKeys,
    table,
  };
}

export async function verifyCatalogCleanBootstrapImport({
  payload,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  payload: CatalogCleanBootstrapPayload;
  supabaseClient?: CatalogBootstrapSupabaseClient;
}): Promise<CatalogCleanBootstrapVerifySummary> {
  validateCatalogCleanBootstrapPayload(payload);

  const steps = [
    await verifyBootstrapRows({
      expectedRows: payload.catalog.sourceThemes.map(toTargetSourceThemeRow),
      onConflict: 'id',
      supabaseClient,
      table: TARGET_CATALOG_SOURCE_THEMES_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.catalog.themes.map(toTargetThemeRow),
      onConflict: 'id',
      supabaseClient,
      table: TARGET_CATALOG_THEMES_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.catalog.themeMappings.map(toTargetThemeMappingRow),
      onConflict: 'source_theme_id',
      supabaseClient,
      table: TARGET_CATALOG_THEME_MAPPINGS_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.catalog.sets.map(toTargetCatalogSetRow),
      onConflict: 'set_id',
      supabaseClient,
      table: TARGET_CATALOG_SETS_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.commerce.merchants.map(toTargetMerchantRow),
      onConflict: 'id',
      supabaseClient,
      table: TARGET_COMMERCE_MERCHANTS_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.commerce.benchmarkSets.map(toTargetBenchmarkSetRow),
      onConflict: 'set_id',
      supabaseClient,
      table: TARGET_COMMERCE_BENCHMARK_SETS_TABLE,
    }),
    await verifyBootstrapRows({
      expectedRows: payload.commerce.offerSeeds.map(toTargetOfferSeedRow),
      onConflict: 'id',
      supabaseClient,
      table: TARGET_COMMERCE_OFFER_SEEDS_TABLE,
    }),
  ] satisfies CatalogCleanBootstrapVerifyStepSummary[];

  return {
    isComplete: steps.every((step) => step.missingKeys.length === 0),
    steps,
  };
}

async function listCurrentCatalogSetRows({
  includeInactive = true,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapSetRow[]> {
  let query = supabaseClient
    .from(CURRENT_CATALOG_SETS_TABLE)
    .select(
      'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
    )
    .order('created_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load current canonical catalog sets. ${JSON.stringify(error)}`,
    );
  }

  return (data as CatalogBootstrapSetRow[] | null) ?? [];
}

async function listCurrentSourceThemes({
  supabaseClient,
}: {
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapSourceThemeRow[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_CATALOG_SOURCE_THEMES_TABLE)
    .select(
      'id, source_system, source_theme_name, parent_source_theme_id, created_at, updated_at',
    )
    .order('id', { ascending: true });

  if (error) {
    throw new Error(
      `Unable to load current catalog source themes. ${JSON.stringify(error)}`,
    );
  }

  return (data as CatalogBootstrapSourceThemeRow[] | null) ?? [];
}

async function listCurrentThemes({
  supabaseClient,
}: {
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapThemeRow[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_CATALOG_THEMES_TABLE)
    .select('id, slug, display_name, status, created_at, updated_at')
    .order('slug', { ascending: true });

  if (error) {
    throw new Error('Unable to load current Brickhunt catalog themes.');
  }

  return (data as CatalogBootstrapThemeRow[] | null) ?? [];
}

async function listCurrentThemeMappings({
  supabaseClient,
}: {
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapThemeMappingRow[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_CATALOG_THEME_MAPPINGS_TABLE)
    .select('source_theme_id, primary_theme_id, created_at, updated_at')
    .order('source_theme_id', { ascending: true });

  if (error) {
    throw new Error('Unable to load current catalog theme mappings.');
  }

  return (data as CatalogBootstrapThemeMappingRow[] | null) ?? [];
}

async function listCurrentMerchants({
  includeInactive = true,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapMerchantRow[]> {
  let query = supabaseClient
    .from(CURRENT_COMMERCE_MERCHANTS_TABLE)
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to load current commerce merchants.');
  }

  return (data as CatalogBootstrapMerchantRow[] | null) ?? [];
}

async function listCurrentOfferSeeds({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapOfferSeedRow[]> {
  let query = supabaseClient
    .from(CURRENT_COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
    )
    .order('created_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to load current commerce offer seeds.');
  }

  return (data as CatalogBootstrapOfferSeedRow[] | null) ?? [];
}

async function listCurrentBenchmarkSets({
  supabaseClient,
}: {
  supabaseClient: CatalogBootstrapSupabaseClient;
}): Promise<CatalogBootstrapBenchmarkSetRow[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_COMMERCE_BENCHMARK_SETS_TABLE)
    .select('set_id, notes, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Unable to load current commerce benchmark sets.');
  }

  return (data as CatalogBootstrapBenchmarkSetRow[] | null) ?? [];
}

export async function buildCatalogCleanBootstrapPayload({
  includeInactiveCatalogSets = true,
  includeInactiveMerchants = true,
  includeInactiveOfferSeeds = false,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
}: BuildCatalogCleanBootstrapPayloadOptions = {}): Promise<CatalogCleanBootstrapPayload> {
  const catalogSetRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentCatalogSetRows({
        includeInactive: includeInactiveCatalogSets,
        supabaseClient,
      }),
  });
  const sourceThemeRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentSourceThemes({
        supabaseClient,
      }),
  });
  const themeRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentThemes({
        supabaseClient,
      }),
  });
  const themeMappingRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentThemeMappings({
        supabaseClient,
      }),
  });
  const merchantRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentMerchants({
        includeInactive: includeInactiveMerchants,
        supabaseClient,
      }),
  });
  const offerSeedRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentOfferSeeds({
        includeInactive: includeInactiveOfferSeeds,
        supabaseClient,
      }),
  });
  const benchmarkSetRows = await retryCatalogBootstrapRead({
    load: () =>
      listCurrentBenchmarkSets({
        supabaseClient,
      }),
  });

  const payload = {
    catalog: {
      sets: sortByStringField(
        catalogSetRows.map(toBootstrapCatalogSet),
        (catalogSet) => catalogSet.setId,
      ),
      sourceThemes: sortByStringField(
        sourceThemeRows.map(toBootstrapSourceTheme),
        (sourceTheme) => sourceTheme.id,
      ),
      themeMappings: sortByStringField(
        themeMappingRows.map(toBootstrapThemeMapping),
        (themeMapping) => themeMapping.sourceThemeId,
      ),
      themes: sortByStringField(
        themeRows.map(toBootstrapTheme),
        (catalogTheme) => catalogTheme.slug,
      ),
    },
    commerce: {
      benchmarkSets: sortByStringField(
        benchmarkSetRows.map(toBootstrapBenchmarkSet),
        (benchmarkSet) => benchmarkSet.setId,
      ),
      merchants: sortByStringField(
        merchantRows.map(toBootstrapMerchant),
        (merchant) => merchant.slug,
      ),
      offerSeeds: sortByStringField(
        offerSeedRows.map(toBootstrapOfferSeed),
        (offerSeed) => offerSeed.id,
      ),
    },
    exclusions: {
      latestOffers: 'excluded',
      localCatalogProse: 'excluded',
      pricingHistoryRows: 'excluded',
      snapshotArtifacts: 'excluded',
      userData: 'excluded',
    },
    generatedAt: now.toISOString(),
    notes:
      'Clean bootstrap payload from the current Brickhunt Supabase source. It intentionally carries canonical catalog sets, normalized themes, merchants, benchmark sets, and active operator seed data only.',
    source: 'brickhunt-clean-bootstrap' as const,
  } satisfies CatalogCleanBootstrapPayload;

  validateCatalogCleanBootstrapPayload(payload);

  return payload;
}

export async function writeCatalogCleanBootstrapPayload({
  cwd = process.cwd(),
  mkdirImpl = mkdir,
  outputPath,
  payload,
  writeFileImpl = writeFile,
}: {
  cwd?: string;
  mkdirImpl?: typeof mkdir;
  outputPath: string;
  payload: CatalogCleanBootstrapPayload;
  writeFileImpl?: typeof writeFile;
}): Promise<string> {
  const resolvedOutputPath = resolve(cwd, outputPath);

  await mkdirImpl(dirname(resolvedOutputPath), {
    recursive: true,
  });
  await writeFileImpl(
    resolvedOutputPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );

  return resolvedOutputPath;
}
