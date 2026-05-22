import { Readable } from 'node:stream';
import { createGunzip, gunzipSync } from 'node:zlib';
import {
  importAffiliateFeedRowsForMerchant,
  type AffiliateFeedMerchantConfig,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface AwinFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface AwinFeedSyncOptions {
  collectStaleLatestDiagnostics?: boolean;
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export type AwinCsvRow = Readonly<Record<string, string>>;

export interface AwinDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawCurrency?: string;
  rawInStock?: string;
  rawProductName?: string;
  rawSearchPrice?: string;
  rawStockStatus?: string;
  rawStorePrice?: string;
}

export interface AwinDebugInfo {
  csvHeaders: readonly string[];
  fetchedProductCount: number;
  legoCandidateCount: number;
  rowCount: number;
  sampleCount: number;
  samples: readonly AwinDebugSample[];
}

export interface AwinFeedSyncResult extends AlternateAffiliateFeedImportResult {
  debugInfo?: AwinDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
}

export interface AwinFeedSyncDependencies {
  fetchFn?: typeof fetch;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface AwinFeedDefinition {
  config: AwinFeedConfig;
  merchantNotes: string;
  normalizeRow: (row: AwinCsvRow) => AlternateAffiliateFeedRow;
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/u, '');
}

function normalizeCsvHeader(value: string): string {
  return stripBom(value).trim().toLowerCase();
}

export function readAwinCsvCell(
  row: AwinCsvRow,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = row[alias];
    const trimmedValue = value?.trim();

    if (trimmedValue) {
      return trimmedValue;
    }
  }

  return undefined;
}

async function* iterateTextChunks(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  for await (const chunk of chunks) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else {
      yield decoder.decode(chunk, {
        stream: true,
      });
    }
  }

  const finalChunk = decoder.decode();

  if (finalChunk) {
    yield finalChunk;
  }
}

async function* parseCsvRecordsFromChunks(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
): AsyncGenerator<string[]> {
  let currentField = '';
  let currentRow: string[] = [];
  let insideQuotes = false;
  let pendingQuote = false;

  for await (const csvText of iterateTextChunks(chunks)) {
    for (let index = 0; index < csvText.length; index += 1) {
      const character = csvText[index];

      if (pendingQuote) {
        if (character === '"') {
          currentField += '"';
          pendingQuote = false;
          continue;
        }

        insideQuotes = false;
        pendingQuote = false;
      }

      if (insideQuotes) {
        if (character === '"') {
          if (csvText[index + 1] === '"') {
            currentField += '"';
            index += 1;
          } else if (index + 1 >= csvText.length) {
            pendingQuote = true;
          } else {
            insideQuotes = false;
          }
        } else {
          currentField += character;
        }

        continue;
      }

      if (character === '"') {
        insideQuotes = true;
        continue;
      }

      if (character === ',') {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if (character === '\n') {
        currentRow.push(currentField);
        currentField = '';

        if (currentRow.some((value) => value.trim())) {
          yield currentRow;
        }

        currentRow = [];
        continue;
      }

      if (character === '\r') {
        continue;
      }

      currentField += character;
    }
  }

  currentRow.push(currentField);

  if (currentRow.some((value) => value.trim())) {
    yield currentRow;
  }
}

export async function* parseAwinProductFeedCsvStream(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
): AsyncGenerator<AwinCsvRow> {
  let normalizedHeaders: string[] | undefined;

  for await (const parsedRow of parseCsvRecordsFromChunks(chunks)) {
    if (!normalizedHeaders) {
      normalizedHeaders = parsedRow.map(normalizeCsvHeader);
      continue;
    }

    yield normalizedHeaders.reduce<Record<string, string>>(
      (row, header, index) => {
        if (!header) {
          return row;
        }

        row[header] = parsedRow[index] ?? '';
        return row;
      },
      {},
    );
  }
}

export async function parseAwinProductFeedCsv(
  csvText: string,
): Promise<readonly AwinCsvRow[]> {
  const rows: AwinCsvRow[] = [];

  for await (const row of parseAwinProductFeedCsvStream([stripBom(csvText)])) {
    rows.push(row);
  }

  return rows;
}

function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

export function decodeAwinFeedBody(buffer: Buffer): string {
  const resolvedBuffer = isGzipBuffer(buffer) ? gunzipSync(buffer) : buffer;

  return stripBom(resolvedBuffer.toString('utf8'));
}

function normalizeAwinAvailabilityText(row: AwinCsvRow): string {
  const stockStatus = readAwinCsvCell(row, ['stock_status']);
  const inStockValue = readAwinCsvCell(row, ['in_stock'])?.toLowerCase();

  if (stockStatus) {
    return stockStatus;
  }

  if (!inStockValue) {
    return '';
  }

  if (['1', 'true', 'yes', 'y', 'in stock', 'instock'].includes(inStockValue)) {
    return 'In stock';
  }

  if (['0', 'false', 'no', 'n', 'out of stock'].includes(inStockValue)) {
    return 'Out of stock';
  }

  return inStockValue;
}

function detectAwinBrand(row: AwinCsvRow): string | undefined {
  const explicitBrand = readAwinCsvCell(row, ['brand']);

  if (explicitBrand) {
    return explicitBrand;
  }

  const searchText = readAwinCsvCell(row, ['product_name']) ?? '';

  return /\blego\b/i.test(searchText) ? 'LEGO' : undefined;
}

export function normalizeAwinCsvRowToAffiliateFeedRow(
  row: AwinCsvRow,
): AlternateAffiliateFeedRow {
  const rawCurrency = readAwinCsvCell(row, ['currency']);
  const rawSearchPrice = readAwinCsvCell(row, ['search_price']);
  const rawStorePrice = readAwinCsvCell(row, ['store_price']);

  return {
    affiliateDeeplink:
      readAwinCsvCell(row, ['aw_deep_link', 'merchant_deep_link']) ?? '',
    availabilityText: normalizeAwinAvailabilityText(row) || undefined,
    brand: detectAwinBrand(row),
    category: readAwinCsvCell(row, ['merchant_category', 'category_name']),
    currency: rawCurrency?.toUpperCase(),
    description: readAwinCsvCell(row, ['description']),
    imageUrl: readAwinCsvCell(row, ['merchant_image_url', 'aw_image_url']),
    legoSetNumber: readAwinCsvCell(row, ['mpn']),
    price: rawSearchPrice ?? rawStorePrice,
    productTitle: readAwinCsvCell(row, ['product_name']),
    shippingCost: readAwinCsvCell(row, ['delivery_cost']),
  };
}

function buildDebugSample({
  normalizeRow,
  row,
}: {
  normalizeRow: (row: AwinCsvRow) => AlternateAffiliateFeedRow;
  row: AwinCsvRow;
}): AwinDebugSample {
  return {
    normalizedRow: normalizeRow(row),
    rawCurrency: readAwinCsvCell(row, ['currency']),
    rawInStock: readAwinCsvCell(row, ['in_stock']),
    rawProductName: readAwinCsvCell(row, ['product_name']),
    rawSearchPrice: readAwinCsvCell(row, ['search_price']),
    rawStockStatus: readAwinCsvCell(row, ['stock_status']),
    rawStorePrice: readAwinCsvCell(row, ['store_price']),
  };
}

async function openAwinCsvResponseStream(
  response: Response,
): Promise<Readable> {
  if (!response.body) {
    const payloadBuffer = Buffer.from(await response.arrayBuffer());

    return Readable.from([payloadBuffer]);
  }

  return Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  );
}

async function fetchAwinFeedRows({
  config,
  fetchFn,
  maxProducts,
  normalizeRow,
  sampleLimit,
}: {
  config: AwinFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
  normalizeRow: (row: AwinCsvRow) => AlternateAffiliateFeedRow;
  sampleLimit?: number;
}): Promise<{
  csvHeaders: readonly string[];
  fetchedRows: number;
  legoCandidateCount: number;
  normalizedRows: readonly AlternateAffiliateFeedRow[];
  samples: readonly AwinDebugSample[];
}> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'text/csv,application/octet-stream;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Awin feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  const responseStream = await openAwinCsvResponseStream(response);
  const contentEncoding = response.headers?.get('content-encoding') ?? '';
  const contentType = response.headers?.get('content-type') ?? '';
  const shouldGunzip =
    contentEncoding.toLowerCase().includes('gzip') ||
    contentType.toLowerCase().includes('gzip') ||
    config.feedUrl.toLowerCase().includes('compression/gzip') ||
    config.feedUrl.toLowerCase().endsWith('.gz');
  const csvStream = shouldGunzip
    ? responseStream.pipe(createGunzip())
    : responseStream;
  const normalizedRows: AlternateAffiliateFeedRow[] = [];
  const samples: AwinDebugSample[] = [];
  const csvHeaders = new Set<string>();
  let fetchedRows = 0;
  let legoCandidateCount = 0;

  for await (const row of parseAwinProductFeedCsvStream(csvStream)) {
    fetchedRows += 1;

    for (const header of Object.keys(row)) {
      csvHeaders.add(header);
    }

    const normalizedRow = normalizeRow(row);
    normalizedRows.push(normalizedRow);

    if (normalizedRow.brand === 'LEGO') {
      legoCandidateCount += 1;
    }

    if (sampleLimit && sampleLimit > samples.length) {
      samples.push(
        buildDebugSample({
          normalizeRow,
          row,
        }),
      );
    }

    if (maxProducts && fetchedRows >= maxProducts) {
      break;
    }
  }

  return {
    csvHeaders: [...csvHeaders].sort((left, right) =>
      left.localeCompare(right),
    ),
    fetchedRows,
    legoCandidateCount,
    normalizedRows,
    samples,
  };
}

export async function syncAwinFeed({
  definition,
  dependencies,
  options,
}: {
  definition: AwinFeedDefinition;
  dependencies?: AwinFeedSyncDependencies;
  options?: AwinFeedSyncOptions;
}): Promise<AwinFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const parsedFeed = await fetchAwinFeedRows({
    config: definition.config,
    fetchFn,
    maxProducts: options?.maxProducts,
    normalizeRow: definition.normalizeRow,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      slug: definition.config.merchantSlug,
      name: definition.config.merchantName,
      affiliateNetwork: 'Awin',
      notes: definition.merchantNotes,
    } satisfies AffiliateFeedMerchantConfig,
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      persistDiscoveredSets: options?.persistDiscoveredSets ?? false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
      ...(options?.collectStaleLatestDiagnostics === undefined
        ? {}
        : {
            collectStaleLatestDiagnostics:
              options.collectStaleLatestDiagnostics,
          }),
    } satisfies AlternateAffiliateFeedImportOptions,
    rows: parsedFeed.normalizedRows,
  });
  const debugInfo =
    options?.debugSamples && options.debugSamples > 0
      ? {
          csvHeaders: parsedFeed.csvHeaders,
          fetchedProductCount: parsedFeed.fetchedRows,
          legoCandidateCount: parsedFeed.legoCandidateCount,
          rowCount: parsedFeed.fetchedRows,
          sampleCount: parsedFeed.samples.length,
          samples: parsedFeed.samples,
        }
      : undefined;

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount: parsedFeed.fetchedRows,
    legoCandidateCount: parsedFeed.legoCandidateCount,
    merchantName: definition.config.merchantName,
    merchantSlug: definition.config.merchantSlug,
    normalizedRowCount: parsedFeed.normalizedRows.length,
    unmatchedDebug: importResult.unmatchedDebug,
  };
}
