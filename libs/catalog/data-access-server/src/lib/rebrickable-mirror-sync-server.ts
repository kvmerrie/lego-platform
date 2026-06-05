import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const REBRICKABLE_DOWNLOAD_BASE_URL =
  'https://cdn.rebrickable.com/media/downloads';
const THEMES_FILENAME = 'themes.csv.gz';
const SETS_FILENAME = 'sets.csv.gz';
const REBRICKABLE_THEMES_TABLE = 'rebrickable_themes';
const REBRICKABLE_SETS_TABLE = 'rebrickable_sets';

type RebrickableMirrorSupabaseClient = Pick<SupabaseClient, 'from'>;

export interface RebrickableMirrorThemeRow {
  id: number;
  name: string;
  parent_id: number | null;
  source_updated_at: string | null;
  synced_at: string;
}

export interface RebrickableMirrorSetRow {
  img_url: string | null;
  name: string;
  num_parts: number;
  set_img_url: string | null;
  set_num: string;
  source_updated_at: string | null;
  synced_at: string;
  theme_id: number;
  year: number;
}

export interface RebrickableMirrorTableSyncSummary {
  downloadedRows: number;
  parsedRows: number;
  skippedRows: number;
  sourceUpdatedAt?: string;
  sourceUrl: string;
  upsertedRows: number;
}

export interface RebrickableMirrorSyncResult {
  durationMs: number;
  dryRun: boolean;
  sets?: RebrickableMirrorTableSyncSummary;
  themes?: RebrickableMirrorTableSyncSummary;
}

export interface RebrickableMirrorSyncOptions {
  downloadDir?: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  limit?: number;
  setsOnly?: boolean;
  sourceDir?: string;
  supabaseClient?: RebrickableMirrorSupabaseClient;
  themesOnly?: boolean;
}

interface DownloadedCsvGzip {
  buffer: Buffer;
  sourceUpdatedAt?: string;
  sourceUrl: string;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);

  return values;
}

export function parseRebrickableCsvRows(
  csvText: string,
): Array<Record<string, string>> {
  const lines = stripBom(csvText)
    .split(/\r?\n/u)
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function readInteger(value: string, minimumValue: number): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);

  return Number.isInteger(parsed) && parsed >= minimumValue
    ? parsed
    : undefined;
}

export function parseRebrickableThemesCsv({
  csvText,
  limit,
  nowIso,
  sourceUpdatedAt,
}: {
  csvText: string;
  limit?: number;
  nowIso: string;
  sourceUpdatedAt?: string;
}): {
  downloadedRows: number;
  rows: RebrickableMirrorThemeRow[];
  skippedRows: number;
} {
  const csvRows = parseRebrickableCsvRows(csvText);
  const rows: RebrickableMirrorThemeRow[] = [];
  let skippedRows = 0;

  for (const csvRow of csvRows) {
    if (limit !== undefined && rows.length >= limit) {
      break;
    }

    const id = readInteger(csvRow['id'] ?? '', 1);
    const parentId =
      csvRow['parent_id']?.trim() || csvRow['parent_id'] === '0'
        ? (readInteger(csvRow['parent_id'], 1) ?? null)
        : null;
    const name = csvRow['name']?.trim();

    if (!id || !name) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      id,
      name,
      parent_id: parentId,
      source_updated_at: sourceUpdatedAt ?? null,
      synced_at: nowIso,
    });
  }

  return {
    downloadedRows: csvRows.length,
    rows,
    skippedRows,
  };
}

export function parseRebrickableSetsCsv({
  csvText,
  limit,
  nowIso,
  sourceUpdatedAt,
}: {
  csvText: string;
  limit?: number;
  nowIso: string;
  sourceUpdatedAt?: string;
}): {
  downloadedRows: number;
  rows: RebrickableMirrorSetRow[];
  skippedRows: number;
} {
  const csvRows = parseRebrickableCsvRows(csvText);
  const rows: RebrickableMirrorSetRow[] = [];
  let skippedRows = 0;

  for (const csvRow of csvRows) {
    if (limit !== undefined && rows.length >= limit) {
      break;
    }

    const setNum = csvRow['set_num']?.trim();
    const name = csvRow['name']?.trim();
    const year = readInteger(csvRow['year'] ?? '', 1940);
    const themeId = readInteger(csvRow['theme_id'] ?? '', 1);
    const numParts = readInteger(csvRow['num_parts'] ?? '', 0);

    if (!setNum || !name || !year || !themeId || numParts === undefined) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      img_url: csvRow['img_url']?.trim() || null,
      name,
      num_parts: numParts,
      set_img_url: csvRow['set_img_url']?.trim() || null,
      set_num: setNum,
      source_updated_at: sourceUpdatedAt ?? null,
      synced_at: nowIso,
      theme_id: themeId,
      year,
    });
  }

  return {
    downloadedRows: csvRows.length,
    rows,
    skippedRows,
  };
}

async function readSourceCsvGzip({
  downloadDir,
  fetchImpl,
  filename,
  sourceDir,
}: {
  downloadDir?: string;
  fetchImpl: typeof fetch;
  filename: string;
  sourceDir?: string;
}): Promise<DownloadedCsvGzip> {
  const sourceUrl = `${REBRICKABLE_DOWNLOAD_BASE_URL}/${filename}`;

  if (sourceDir) {
    return {
      buffer: await readFile(join(sourceDir, filename)),
      sourceUrl: join(sourceDir, filename),
    };
  }

  const response = await fetchImpl(sourceUrl, {
    headers: {
      Accept: 'application/gzip,application/octet-stream;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to download ${filename} from Rebrickable (${response.status}).`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (downloadDir) {
    await mkdir(downloadDir, { recursive: true });
    await writeFile(join(downloadDir, filename), buffer);
  }

  const lastModified = response.headers.get('last-modified');

  return {
    buffer,
    ...(lastModified
      ? { sourceUpdatedAt: new Date(lastModified).toISOString() }
      : {}),
    sourceUrl,
  };
}

async function upsertRows({
  dryRun,
  rows,
  supabaseClient,
  table,
}: {
  dryRun: boolean;
  rows: readonly object[];
  supabaseClient: RebrickableMirrorSupabaseClient;
  table: string;
}): Promise<number> {
  if (dryRun || rows.length === 0) {
    return 0;
  }

  let upsertedRows = 0;

  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const { error } = await supabaseClient.from(table).upsert(chunk);

    if (error) {
      throw new Error(
        `Unable to upsert local Rebrickable mirror table ${table}.`,
      );
    }

    upsertedRows += chunk.length;
  }

  return upsertedRows;
}

export async function syncLocalRebrickableMirror({
  downloadDir,
  dryRun = false,
  fetchImpl = fetch,
  limit,
  setsOnly = false,
  sourceDir,
  supabaseClient = getServerSupabaseAdminClient(),
  themesOnly = false,
}: RebrickableMirrorSyncOptions = {}): Promise<RebrickableMirrorSyncResult> {
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();
  const safeLimit =
    limit === undefined ? undefined : Math.max(1, Math.floor(limit));
  const shouldSyncThemes = !setsOnly;
  const shouldSyncSets = !themesOnly;
  const result: RebrickableMirrorSyncResult = {
    durationMs: 0,
    dryRun,
  };

  if (shouldSyncThemes) {
    const source = await readSourceCsvGzip({
      downloadDir,
      fetchImpl,
      filename: THEMES_FILENAME,
      sourceDir,
    });
    const parsed = parseRebrickableThemesCsv({
      csvText: gunzipSync(source.buffer).toString('utf8'),
      ...(safeLimit ? { limit: safeLimit } : {}),
      nowIso,
      sourceUpdatedAt: source.sourceUpdatedAt,
    });
    const upsertedRows = await upsertRows({
      dryRun,
      rows: parsed.rows,
      supabaseClient,
      table: REBRICKABLE_THEMES_TABLE,
    });

    result.themes = {
      downloadedRows: parsed.downloadedRows,
      parsedRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      sourceUrl: source.sourceUrl,
      upsertedRows,
      ...(source.sourceUpdatedAt
        ? { sourceUpdatedAt: source.sourceUpdatedAt }
        : {}),
    };
  }

  if (shouldSyncSets) {
    const source = await readSourceCsvGzip({
      downloadDir,
      fetchImpl,
      filename: SETS_FILENAME,
      sourceDir,
    });
    const parsed = parseRebrickableSetsCsv({
      csvText: gunzipSync(source.buffer).toString('utf8'),
      ...(safeLimit ? { limit: safeLimit } : {}),
      nowIso,
      sourceUpdatedAt: source.sourceUpdatedAt,
    });
    const upsertedRows = await upsertRows({
      dryRun,
      rows: parsed.rows,
      supabaseClient,
      table: REBRICKABLE_SETS_TABLE,
    });

    result.sets = {
      downloadedRows: parsed.downloadedRows,
      parsedRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      sourceUrl: source.sourceUrl,
      upsertedRows,
      ...(source.sourceUpdatedAt
        ? { sourceUpdatedAt: source.sourceUpdatedAt }
        : {}),
    };
  }

  return {
    ...result,
    durationMs: Date.now() - startedAt,
  };
}
