import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import { getRebrickableApiConfig } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const REBRICKABLE_SOURCE_SYSTEM = 'rebrickable';
const CATALOG_MINIFIG_SYNC_PAGE_SIZE = 1000;
const REBRICKABLE_MINIFIG_PAGE_SIZE = 100;

type CatalogMinifigSupabaseClient = Pick<SupabaseClient, 'from'>;
type CatalogMinifigSyncMode = 'check' | 'write';

interface SupabaseLikeError {
  message?: string;
}

interface CatalogMinifigCatalogSetRow {
  set_id: string;
  slug: string;
  source: string;
  source_set_number: string;
  status: string;
}

interface CatalogSetMinifigSummaryRow {
  minifig_count: number;
  set_id: string;
  source_minifig_count: number | null;
}

export interface CatalogMinifigSyncCatalogSet {
  setId: string;
  slug: string;
  sourceSetNumber: string;
}

export interface CatalogSetMinifigSummary {
  minifigCount: number;
  setId: string;
  sourceMinifigCount?: number;
}

export interface CatalogSetMinifigSummaryUpsert {
  minifig_count: number;
  set_id: string;
  source_minifig_count: number | null;
  source_system: typeof REBRICKABLE_SOURCE_SYSTEM;
  synced_at: string;
  updated_at: string;
}

export interface RebrickableSetMinifigSummary {
  minifigCount: number;
  sourceMinifigCount: number;
}

export interface CatalogMinifigSyncResult {
  changedSetSlugs: readonly string[];
  changedSetIds: readonly string[];
  driftCount: number;
  durationMs: number;
  failedSetIds: readonly string[];
  failedSets: number;
  mode: CatalogMinifigSyncMode;
  setsChecked: number;
  summariesUpserted: number;
  zeroMinifigSets: number;
}

export interface RunCatalogMinifigSyncOptions {
  fetchRebrickableSetMinifigSummaryFn?: (
    sourceSetNumber: string,
  ) => Promise<RebrickableSetMinifigSummary>;
  listCatalogSetsForMinifigSyncFn?: () => Promise<
    readonly CatalogMinifigSyncCatalogSet[]
  >;
  loadExistingMinifigSummariesFn?: (
    setIds: readonly string[],
  ) => Promise<Map<string, CatalogSetMinifigSummary>>;
  mode: CatalogMinifigSyncMode;
  nowImpl?: () => Date;
  upsertCatalogSetMinifigSummariesFn?: (
    rows: readonly CatalogSetMinifigSummaryUpsert[],
  ) => Promise<number>;
}

function formatSupabaseError(error: SupabaseLikeError): string {
  return error.message?.trim() || 'Unknown Supabase error.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function toCatalogMinifigCatalogSet(
  row: CatalogMinifigCatalogSetRow,
): CatalogMinifigSyncCatalogSet | undefined {
  if (
    row.status !== 'active' ||
    row.source !== REBRICKABLE_SOURCE_SYSTEM ||
    !row.set_id ||
    !row.slug ||
    !row.source_set_number
  ) {
    return undefined;
  }

  return {
    setId: row.set_id,
    slug: row.slug,
    sourceSetNumber: row.source_set_number,
  };
}

export function summarizeRebrickableSetMinifigPayloads(
  payloads: readonly unknown[],
): RebrickableSetMinifigSummary {
  let minifigCount = 0;
  let sourceMinifigCount: number | undefined;
  let resultCount = 0;

  for (const payload of payloads) {
    if (!isRecord(payload)) {
      continue;
    }

    sourceMinifigCount ??= readNonNegativeInteger(payload['count']);

    const results = Array.isArray(payload['results']) ? payload['results'] : [];

    resultCount += results.length;

    for (const result of results) {
      if (!isRecord(result)) {
        continue;
      }

      minifigCount += readPositiveInteger(result['quantity']) ?? 1;
    }
  }

  return {
    minifigCount,
    sourceMinifigCount: sourceMinifigCount ?? resultCount,
  };
}

function isRebrickableNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Rebrickable request failed (404)')
  );
}

export async function fetchRebrickableSetMinifigSummary(
  sourceSetNumber: string,
): Promise<RebrickableSetMinifigSummary> {
  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
  });
  const payloads: unknown[] = [];

  try {
    for (let page = 1; ; page += 1) {
      const payload = await rebrickableClient.listSetMinifigs(sourceSetNumber, {
        page,
        pageSize: REBRICKABLE_MINIFIG_PAGE_SIZE,
      });
      payloads.push(payload);

      if (!isRecord(payload) || !payload['next']) {
        break;
      }
    }
  } catch (error) {
    if (isRebrickableNotFoundError(error)) {
      return {
        minifigCount: 0,
        sourceMinifigCount: 0,
      };
    }

    throw error;
  }

  return summarizeRebrickableSetMinifigPayloads(payloads);
}

export async function listCatalogSetsForMinifigSync({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CatalogMinifigSupabaseClient;
} = {}): Promise<CatalogMinifigSyncCatalogSet[]> {
  const rows: CatalogMinifigCatalogSetRow[] = [];

  for (let offset = 0; ; offset += CATALOG_MINIFIG_SYNC_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from(CATALOG_SETS_TABLE)
      .select('set_id, source_set_number, slug, source, status')
      .eq('source', REBRICKABLE_SOURCE_SYSTEM)
      .eq('status', 'active')
      .order('set_id', { ascending: true })
      .range(offset, offset + CATALOG_MINIFIG_SYNC_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Unable to load catalog sets for minifig sync. ${formatSupabaseError(
          error,
        )}`,
      );
    }

    const pageRows = (data as CatalogMinifigCatalogSetRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_MINIFIG_SYNC_PAGE_SIZE) {
      break;
    }
  }

  return rows
    .map(toCatalogMinifigCatalogSet)
    .filter((set): set is CatalogMinifigSyncCatalogSet => Boolean(set));
}

export async function loadExistingMinifigSummaries({
  setIds,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  setIds: readonly string[];
  supabaseClient?: CatalogMinifigSupabaseClient;
}): Promise<Map<string, CatalogSetMinifigSummary>> {
  const summaries = new Map<string, CatalogSetMinifigSummary>();

  for (let offset = 0; offset < setIds.length; offset += 500) {
    const setIdBatch = setIds.slice(offset, offset + 500);

    if (!setIdBatch.length) {
      continue;
    }

    const { data, error } = await supabaseClient
      .from(CATALOG_SET_MINIFIG_SUMMARIES_TABLE)
      .select('set_id, minifig_count, source_minifig_count')
      .in('set_id', setIdBatch);

    if (error) {
      throw new Error(
        `Unable to load catalog minifig summaries. ${formatSupabaseError(
          error,
        )}`,
      );
    }

    for (const row of (data as CatalogSetMinifigSummaryRow[] | null) ?? []) {
      summaries.set(row.set_id, {
        minifigCount: row.minifig_count,
        setId: row.set_id,
        ...(typeof row.source_minifig_count === 'number'
          ? {
              sourceMinifigCount: row.source_minifig_count,
            }
          : {}),
      });
    }
  }

  return summaries;
}

export async function upsertCatalogSetMinifigSummaries({
  rows,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  rows: readonly CatalogSetMinifigSummaryUpsert[];
  supabaseClient?: CatalogMinifigSupabaseClient;
}): Promise<number> {
  if (!rows.length) {
    return 0;
  }

  const { error } = await supabaseClient
    .from(CATALOG_SET_MINIFIG_SUMMARIES_TABLE)
    .upsert(rows, {
      onConflict: 'set_id',
    });

  if (error) {
    throw new Error(
      `Unable to upsert catalog minifig summaries. ${formatSupabaseError(
        error,
      )}`,
    );
  }

  return rows.length;
}

export async function runCatalogMinifigSync({
  fetchRebrickableSetMinifigSummaryFn = fetchRebrickableSetMinifigSummary,
  listCatalogSetsForMinifigSyncFn = () => listCatalogSetsForMinifigSync(),
  loadExistingMinifigSummariesFn = (setIds) =>
    loadExistingMinifigSummaries({ setIds }),
  mode,
  nowImpl = () => new Date(),
  upsertCatalogSetMinifigSummariesFn = (rows) =>
    upsertCatalogSetMinifigSummaries({ rows }),
}: RunCatalogMinifigSyncOptions): Promise<CatalogMinifigSyncResult> {
  const startedAt = Date.now();
  const catalogSets = await listCatalogSetsForMinifigSyncFn();
  const existingSummaries = await loadExistingMinifigSummariesFn(
    catalogSets.map((catalogSet) => catalogSet.setId),
  );
  const failedSetIds: string[] = [];
  const changedSetIds: string[] = [];
  const changedSetSlugs: string[] = [];
  const summaryRowsToUpsert: CatalogSetMinifigSummaryUpsert[] = [];
  let zeroMinifigSets = 0;

  for (const catalogSet of catalogSets) {
    try {
      const fetchedSummary = await fetchRebrickableSetMinifigSummaryFn(
        catalogSet.sourceSetNumber,
      );
      const existingSummary = existingSummaries.get(catalogSet.setId);

      if (fetchedSummary.minifigCount === 0) {
        zeroMinifigSets += 1;
      }

      const hasDrift =
        !existingSummary ||
        existingSummary.minifigCount !== fetchedSummary.minifigCount ||
        existingSummary.sourceMinifigCount !==
          fetchedSummary.sourceMinifigCount;

      if (!hasDrift) {
        continue;
      }

      changedSetIds.push(catalogSet.setId);
      changedSetSlugs.push(catalogSet.slug);

      if (mode === 'write') {
        const now = nowImpl().toISOString();

        summaryRowsToUpsert.push({
          minifig_count: fetchedSummary.minifigCount,
          set_id: catalogSet.setId,
          source_minifig_count: fetchedSummary.sourceMinifigCount,
          source_system: REBRICKABLE_SOURCE_SYSTEM,
          synced_at: now,
          updated_at: now,
        });
      }
    } catch {
      failedSetIds.push(catalogSet.setId);
    }
  }

  const summariesUpserted =
    mode === 'write' && summaryRowsToUpsert.length > 0
      ? await upsertCatalogSetMinifigSummariesFn(summaryRowsToUpsert)
      : 0;

  return {
    changedSetIds,
    changedSetSlugs,
    driftCount: changedSetIds.length,
    durationMs: Date.now() - startedAt,
    failedSetIds,
    failedSets: failedSetIds.length,
    mode,
    setsChecked: catalogSets.length,
    summariesUpserted,
    zeroMinifigSets,
  };
}
