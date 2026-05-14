import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import { getRebrickableApiConfig } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const REBRICKABLE_SOURCE_SYSTEM = 'rebrickable';
const CATALOG_MINIFIG_SYNC_PAGE_SIZE = 1000;
const REBRICKABLE_MINIFIG_PAGE_SIZE = 100;
export const DEFAULT_CATALOG_MINIFIG_SYNC_LIMIT = 100;
export const DEFAULT_REBRICKABLE_MINIFIG_REQUEST_DELAY_MS = 750;
export const DEFAULT_REBRICKABLE_MINIFIG_MAX_RETRIES = 4;

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
  isPartial: boolean;
  lastProcessedSetId?: string;
  limit: number | null;
  mode: CatalogMinifigSyncMode;
  nextAfterSetId?: string;
  processedSets: number;
  rateLimitCount: number;
  selectedSetCount: number;
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
  afterSetId?: string;
  limit?: number | null;
  onlyMissing?: boolean;
  requestDelayMs?: number;
  selectedSetIds?: readonly string[];
  mode: CatalogMinifigSyncMode;
  maxRetries?: number;
  nowImpl?: () => Date;
  sleepImpl?: (delayMs: number) => Promise<void>;
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

function isRebrickableRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Rebrickable request failed (429)')
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export function selectCatalogSetsForMinifigSync({
  afterSetId,
  catalogSets,
  existingSummaries,
  limit,
  onlyMissing = false,
  selectedSetIds,
}: {
  afterSetId?: string;
  catalogSets: readonly CatalogMinifigSyncCatalogSet[];
  existingSummaries?: ReadonlyMap<string, CatalogSetMinifigSummary>;
  limit?: number | null;
  onlyMissing?: boolean;
  selectedSetIds?: readonly string[];
}): CatalogMinifigSyncCatalogSet[] {
  const selectedSetIdSet = selectedSetIds?.length
    ? new Set(selectedSetIds)
    : undefined;
  const normalizedLimit =
    typeof limit === 'number' && Number.isInteger(limit) && limit >= 0
      ? limit
      : null;

  const filteredSets = catalogSets.filter((catalogSet) => {
    if (afterSetId && catalogSet.setId <= afterSetId) {
      return false;
    }

    if (selectedSetIdSet && !selectedSetIdSet.has(catalogSet.setId)) {
      return false;
    }

    if (onlyMissing && existingSummaries?.has(catalogSet.setId)) {
      return false;
    }

    return true;
  });

  return normalizedLimit === null
    ? filteredSets
    : filteredSets.slice(0, normalizedLimit);
}

export function createRebrickableSetMinifigSummaryFetcher({
  maxRetries = DEFAULT_REBRICKABLE_MINIFIG_MAX_RETRIES,
  minimumRequestSpacingMs = DEFAULT_REBRICKABLE_MINIFIG_REQUEST_DELAY_MS,
  onRateLimit,
}: {
  maxRetries?: number;
  minimumRequestSpacingMs?: number;
  onRateLimit?: () => void;
} = {}): (sourceSetNumber: string) => Promise<RebrickableSetMinifigSummary> {
  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
    maxRetries,
    minimumRequestSpacingMs,
    logImpl: (message) => {
      if (message.includes('rebrickable 429')) {
        onRateLimit?.();
      }

      console.warn(message);
    },
  });

  return async (sourceSetNumber) => {
    const payloads: unknown[] = [];

    try {
      for (let page = 1; ; page += 1) {
        const payload = await rebrickableClient.listSetMinifigs(
          sourceSetNumber,
          {
            page,
            pageSize: REBRICKABLE_MINIFIG_PAGE_SIZE,
          },
        );
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
  };
}

export async function fetchRebrickableSetMinifigSummary(
  sourceSetNumber: string,
): Promise<RebrickableSetMinifigSummary> {
  return createRebrickableSetMinifigSummaryFetcher()(sourceSetNumber);
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
  fetchRebrickableSetMinifigSummaryFn,
  afterSetId,
  listCatalogSetsForMinifigSyncFn = () => listCatalogSetsForMinifigSync(),
  loadExistingMinifigSummariesFn = (setIds) =>
    loadExistingMinifigSummaries({ setIds }),
  limit = DEFAULT_CATALOG_MINIFIG_SYNC_LIMIT,
  mode,
  maxRetries = DEFAULT_REBRICKABLE_MINIFIG_MAX_RETRIES,
  nowImpl = () => new Date(),
  onlyMissing = false,
  requestDelayMs = DEFAULT_REBRICKABLE_MINIFIG_REQUEST_DELAY_MS,
  selectedSetIds,
  sleepImpl = wait,
  upsertCatalogSetMinifigSummariesFn = (rows) =>
    upsertCatalogSetMinifigSummaries({ rows }),
}: RunCatalogMinifigSyncOptions): Promise<CatalogMinifigSyncResult> {
  const startedAt = Date.now();
  const catalogSets = await listCatalogSetsForMinifigSyncFn();
  const existingSummaries = await loadExistingMinifigSummariesFn(
    catalogSets.map((catalogSet) => catalogSet.setId),
  );
  const selectedCatalogSets = selectCatalogSetsForMinifigSync({
    afterSetId,
    catalogSets,
    existingSummaries,
    limit,
    onlyMissing,
    selectedSetIds,
  });
  const failedSetIds: string[] = [];
  const changedSetIds: string[] = [];
  const changedSetSlugs: string[] = [];
  const summaryRowsToUpsert: CatalogSetMinifigSummaryUpsert[] = [];
  let zeroMinifigSets = 0;
  let rateLimitCount = 0;
  let lastProcessedSetId: string | undefined;
  const fetchSetMinifigSummary =
    fetchRebrickableSetMinifigSummaryFn ??
    createRebrickableSetMinifigSummaryFetcher({
      maxRetries,
      minimumRequestSpacingMs: requestDelayMs,
      onRateLimit: () => {
        rateLimitCount += 1;
      },
    });

  for (const [index, catalogSet] of selectedCatalogSets.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await sleepImpl(requestDelayMs);
    }

    lastProcessedSetId = catalogSet.setId;

    try {
      const fetchedSummary = await fetchSetMinifigSummary(
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
    } catch (error) {
      if (isRebrickableRateLimitError(error)) {
        rateLimitCount += 1;
      }

      failedSetIds.push(catalogSet.setId);
    }
  }

  const summariesUpserted =
    mode === 'write' && summaryRowsToUpsert.length > 0
      ? await upsertCatalogSetMinifigSummariesFn(summaryRowsToUpsert)
      : 0;

  const processedSets = selectedCatalogSets.length;
  const selectedSetIdsSet = selectedSetIds?.length
    ? new Set(selectedSetIds)
    : undefined;
  const remainingCatalogSets = selectCatalogSetsForMinifigSync({
    afterSetId: lastProcessedSetId ?? afterSetId,
    catalogSets,
    existingSummaries,
    limit: null,
    onlyMissing,
    selectedSetIds,
  });
  const nextAfterSetId =
    selectedSetIdsSet || remainingCatalogSets.length === 0
      ? undefined
      : (lastProcessedSetId ?? afterSetId);
  const isPartial =
    selectedCatalogSets.length < catalogSets.length &&
    (Boolean(afterSetId) ||
      Boolean(onlyMissing) ||
      Boolean(selectedSetIds?.length) ||
      remainingCatalogSets.length > 0);

  return {
    changedSetIds,
    changedSetSlugs,
    driftCount: changedSetIds.length,
    durationMs: Date.now() - startedAt,
    failedSetIds,
    failedSets: failedSetIds.length,
    isPartial,
    ...(lastProcessedSetId ? { lastProcessedSetId } : {}),
    limit:
      typeof limit === 'number' && Number.isInteger(limit) && limit >= 0
        ? limit
        : null,
    mode,
    ...(nextAfterSetId ? { nextAfterSetId } : {}),
    processedSets,
    rateLimitCount,
    selectedSetCount: selectedCatalogSets.length,
    setsChecked: processedSets,
    summariesUpserted,
    zeroMinifigSets,
  };
}
