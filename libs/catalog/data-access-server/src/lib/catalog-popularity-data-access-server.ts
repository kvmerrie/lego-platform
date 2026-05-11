import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CatalogPopularityEventType,
  type CatalogPopularitySetCounts,
  type CatalogPopularitySetSnapshot,
  type CatalogPopularitySnapshot,
  renderCatalogPopularitySnapshotModule,
} from '@lego-platform/catalog/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

const CATALOG_USER_EVENTS_TABLE = 'catalog_user_events';
const GENERATED_POPULARITY_SNAPSHOT_PATH =
  'libs/catalog/data-access/src/lib/catalog-popularity-snapshot.generated.ts';
const CATALOG_POPULARITY_EVENT_TYPES = [
  'set_view',
  'catalog_set_click',
  'offer_click',
] as const satisfies readonly CatalogPopularityEventType[];

const CATALOG_POPULARITY_SCORE_WEIGHTS = {
  set_view: 1,
  catalog_set_click: 3,
  offer_click: 8,
} as const satisfies Record<CatalogPopularityEventType, number>;

const DEFAULT_MIN_SCORE = 5;
const DEFAULT_MIN_UNIQUE_SESSIONS = 2;
const DEFAULT_MAX_ITEMS_PER_WINDOW = 100;
const EVENT_PAGE_SIZE = 1_000;
const MAX_EVENT_ROWS_PER_RUN = 100_000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_WINDOW_MS = 7 * DAY_WINDOW_MS;

type CatalogPopularitySupabaseClient = Pick<SupabaseClient, 'from'>;

export interface CatalogPopularityEventRow {
  created_at: string;
  event_type: string;
  session_id: string;
  set_num: string | null;
}

export interface CatalogPopularityRunResult {
  artifactCheck: CatalogPopularityArtifactCheckResult;
  mode: 'check' | 'write';
  popularitySnapshot: CatalogPopularitySnapshot;
}

export interface CatalogPopularityArtifactCheckResult {
  isClean: boolean;
  popularitySnapshotPath: string;
  stalePaths: string[];
}

interface CatalogPopularityWindowOptions {
  cutoffMs: number;
  events: readonly CatalogPopularityEventRow[];
  maxItemsPerWindow: number;
  minScore: number;
  nowMs: number;
}

interface CatalogPopularityAggregateOptions {
  events: readonly CatalogPopularityEventRow[];
  maxItemsPerWindow?: number;
  minScore?: number;
  now?: Date;
}

interface RunCatalogPopularitySyncOptions {
  mode?: 'check' | 'write';
  now?: Date;
  supabaseClient?: CatalogPopularitySupabaseClient;
  workspaceRoot: string;
}

interface LoadCatalogPopularityEventsOptions {
  eventPageSize?: number;
  maxEventRows?: number;
  now?: Date;
  supabaseClient?: CatalogPopularitySupabaseClient;
}

function createEmptyCounts(): CatalogPopularitySetCounts {
  return {
    set_view: 0,
    catalog_set_click: 0,
    offer_click: 0,
  };
}

function isCatalogPopularityEventType(
  eventType: string,
): eventType is CatalogPopularityEventType {
  return CATALOG_POPULARITY_EVENT_TYPES.includes(
    eventType as CatalogPopularityEventType,
  );
}

function calculateCatalogPopularityScore(
  counts: CatalogPopularitySetCounts,
): number {
  return (
    counts.set_view * CATALOG_POPULARITY_SCORE_WEIGHTS.set_view +
    counts.catalog_set_click *
      CATALOG_POPULARITY_SCORE_WEIGHTS.catalog_set_click +
    counts.offer_click * CATALOG_POPULARITY_SCORE_WEIGHTS.offer_click
  );
}

function aggregateCatalogPopularityWindow({
  cutoffMs,
  events,
  maxItemsPerWindow,
  minScore,
  nowMs,
}: CatalogPopularityWindowOptions): CatalogPopularitySetSnapshot[] {
  const seenEventKeys = new Set<string>();
  const countsBySetNum = new Map<string, CatalogPopularitySetCounts>();
  const sessionIdsBySetNum = new Map<string, Set<string>>();

  for (const event of events) {
    if (
      !event.set_num ||
      !event.session_id ||
      !isCatalogPopularityEventType(event.event_type)
    ) {
      continue;
    }

    const createdAtMs = new Date(event.created_at).getTime();

    if (
      Number.isNaN(createdAtMs) ||
      createdAtMs < cutoffMs ||
      createdAtMs > nowMs
    ) {
      continue;
    }

    const eventKey = `${event.session_id}:${event.set_num}:${event.event_type}`;

    if (seenEventKeys.has(eventKey)) {
      continue;
    }

    seenEventKeys.add(eventKey);

    const counts = countsBySetNum.get(event.set_num) ?? createEmptyCounts();
    counts[event.event_type] += 1;
    countsBySetNum.set(event.set_num, counts);

    const sessionIds = sessionIdsBySetNum.get(event.set_num) ?? new Set();
    sessionIds.add(event.session_id);
    sessionIdsBySetNum.set(event.set_num, sessionIds);
  }

  return [...countsBySetNum.entries()]
    .map(([setNum, counts]) => ({
      set_num: setNum,
      score: calculateCatalogPopularityScore(counts),
      unique_sessions: sessionIdsBySetNum.get(setNum)?.size ?? 0,
      counts,
    }))
    .filter(
      (snapshot) =>
        snapshot.score >= minScore &&
        snapshot.unique_sessions >= DEFAULT_MIN_UNIQUE_SESSIONS,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.counts.offer_click - left.counts.offer_click ||
        right.counts.catalog_set_click - left.counts.catalog_set_click ||
        right.counts.set_view - left.counts.set_view ||
        left.set_num.localeCompare(right.set_num),
    )
    .slice(0, maxItemsPerWindow);
}

export function aggregateCatalogPopularityEvents({
  events,
  maxItemsPerWindow = DEFAULT_MAX_ITEMS_PER_WINDOW,
  minScore = DEFAULT_MIN_SCORE,
  now = new Date(),
}: CatalogPopularityAggregateOptions): CatalogPopularitySnapshot {
  const nowMs = now.getTime();

  return {
    generatedAt: now.toISOString(),
    windows: {
      day: aggregateCatalogPopularityWindow({
        cutoffMs: nowMs - DAY_WINDOW_MS,
        events,
        maxItemsPerWindow,
        minScore,
        nowMs,
      }),
      week: aggregateCatalogPopularityWindow({
        cutoffMs: nowMs - WEEK_WINDOW_MS,
        events,
        maxItemsPerWindow,
        minScore,
        nowMs,
      }),
    },
  };
}

function getCatalogPopularitySnapshotPath(workspaceRoot: string): string {
  return resolve(workspaceRoot, GENERATED_POPULARITY_SNAPSHOT_PATH);
}

async function readArtifactFile(
  artifactPath: string,
): Promise<string | undefined> {
  try {
    return await readFile(artifactPath, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }

    throw error;
  }
}

function parseCatalogPopularitySnapshotModule({
  artifactPath,
  moduleSource,
}: {
  artifactPath: string;
  moduleSource: string;
}): CatalogPopularitySnapshot {
  const payloadPrefix = 'const catalogPopularitySnapshotPayload = String.raw`';
  const payloadStart = moduleSource.indexOf(payloadPrefix);
  const payloadEnd =
    payloadStart === -1
      ? -1
      : moduleSource.indexOf('`;', payloadStart + payloadPrefix.length);

  if (payloadStart === -1 || payloadEnd === -1) {
    throw new Error(
      `Unable to parse generated catalog popularity artifact payload from ${artifactPath}. Expected the canonical JSON template payload format.`,
    );
  }

  const payload = moduleSource.slice(
    payloadStart + payloadPrefix.length,
    payloadEnd,
  );

  try {
    return JSON.parse(payload) as CatalogPopularitySnapshot;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown JSON parse failure.';

    throw new Error(
      `Generated catalog popularity artifact at ${artifactPath} is not in canonical JSON template payload format. ${message}`,
    );
  }
}

function stabilizeCatalogPopularityGeneratedAt({
  currentSnapshot,
  nextSnapshot,
}: {
  currentSnapshot?: CatalogPopularitySnapshot;
  nextSnapshot: CatalogPopularitySnapshot;
}): CatalogPopularitySnapshot {
  if (!currentSnapshot) {
    return nextSnapshot;
  }

  if (
    JSON.stringify(currentSnapshot.windows) !==
    JSON.stringify(nextSnapshot.windows)
  ) {
    return nextSnapshot;
  }

  return {
    ...nextSnapshot,
    generatedAt: currentSnapshot.generatedAt,
  };
}

async function checkCatalogPopularitySnapshotArtifact({
  popularitySnapshot,
  workspaceRoot,
}: {
  popularitySnapshot: CatalogPopularitySnapshot;
  workspaceRoot: string;
}): Promise<CatalogPopularityArtifactCheckResult> {
  const popularitySnapshotPath =
    getCatalogPopularitySnapshotPath(workspaceRoot);
  const nextModule = renderCatalogPopularitySnapshotModule(popularitySnapshot);
  const currentModule = await readArtifactFile(popularitySnapshotPath);
  const stalePaths =
    currentModule === nextModule ? [] : [popularitySnapshotPath];

  return {
    isClean: stalePaths.length === 0,
    popularitySnapshotPath,
    stalePaths,
  };
}

async function writeCatalogPopularitySnapshotArtifact({
  popularitySnapshot,
  workspaceRoot,
}: {
  popularitySnapshot: CatalogPopularitySnapshot;
  workspaceRoot: string;
}): Promise<CatalogPopularityArtifactCheckResult> {
  const artifactCheck = await checkCatalogPopularitySnapshotArtifact({
    popularitySnapshot,
    workspaceRoot,
  });

  if (artifactCheck.stalePaths.includes(artifactCheck.popularitySnapshotPath)) {
    await mkdir(dirname(artifactCheck.popularitySnapshotPath), {
      recursive: true,
    });
    await writeFile(
      artifactCheck.popularitySnapshotPath,
      renderCatalogPopularitySnapshotModule(popularitySnapshot),
      'utf8',
    );
  }

  return artifactCheck;
}

async function getCurrentCatalogPopularitySnapshot({
  workspaceRoot,
}: {
  workspaceRoot: string;
}): Promise<CatalogPopularitySnapshot | undefined> {
  const popularitySnapshotPath =
    getCatalogPopularitySnapshotPath(workspaceRoot);
  const currentModule = await readArtifactFile(popularitySnapshotPath);

  return currentModule
    ? parseCatalogPopularitySnapshotModule({
        artifactPath: popularitySnapshotPath,
        moduleSource: currentModule,
      })
    : undefined;
}

export async function listCatalogPopularityEventRows({
  eventPageSize = EVENT_PAGE_SIZE,
  maxEventRows = MAX_EVENT_ROWS_PER_RUN,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
}: LoadCatalogPopularityEventsOptions = {}): Promise<
  CatalogPopularityEventRow[]
> {
  const cutoffIso = new Date(now.getTime() - WEEK_WINDOW_MS).toISOString();
  const rows: CatalogPopularityEventRow[] = [];
  let offset = 0;

  while (rows.length <= maxEventRows) {
    const remainingRowsBeforeCap = maxEventRows - rows.length;
    const pageSize = Math.min(eventPageSize, remainingRowsBeforeCap + 1);
    const { data, error } = await supabaseClient
      .from(CATALOG_USER_EVENTS_TABLE)
      .select('created_at, event_type, session_id, set_num')
      .in('event_type', CATALOG_POPULARITY_EVENT_TYPES)
      .not('set_num', 'is', null)
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        'Unable to load catalog user events for popularity aggregation.',
      );
    }

    const pageRows = (data as CatalogPopularityEventRow[] | null) ?? [];

    if (rows.length + pageRows.length > maxEventRows) {
      throw new Error(
        `Catalog popularity aggregation exceeded the fail-safe limit of ${maxEventRows} event rows per run.`,
      );
    }

    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }

    offset += pageRows.length;
  }

  throw new Error(
    `Catalog popularity aggregation exceeded the fail-safe limit of ${maxEventRows} event rows per run.`,
  );
}

export async function runCatalogPopularitySync({
  mode = 'write',
  now = new Date(),
  supabaseClient,
  workspaceRoot,
}: RunCatalogPopularitySyncOptions): Promise<CatalogPopularityRunResult> {
  const events = await listCatalogPopularityEventRows({
    now,
    supabaseClient,
  });
  const currentSnapshot = await getCurrentCatalogPopularitySnapshot({
    workspaceRoot,
  });
  const popularitySnapshot = stabilizeCatalogPopularityGeneratedAt({
    currentSnapshot,
    nextSnapshot: aggregateCatalogPopularityEvents({
      events,
      now,
    }),
  });
  const artifactCheck =
    mode === 'check'
      ? await checkCatalogPopularitySnapshotArtifact({
          popularitySnapshot,
          workspaceRoot,
        })
      : await writeCatalogPopularitySnapshotArtifact({
          popularitySnapshot,
          workspaceRoot,
        });

  return {
    artifactCheck,
    mode,
    popularitySnapshot,
  };
}
