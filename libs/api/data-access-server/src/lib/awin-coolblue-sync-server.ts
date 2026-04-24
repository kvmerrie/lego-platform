import { gunzipSync } from 'node:zlib';
import {
  getAwinCoolblueFeedConfig,
  type AwinCoolblueFeedConfig,
} from '@lego-platform/shared/config';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface AwinCoolblueFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getAwinCoolblueFeedConfigFn?: typeof getAwinCoolblueFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface AwinCoolblueFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  unmatchedSampleLimit?: number;
}

export interface AwinCoolblueDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawCurrency?: string;
  rawInStock?: string;
  rawMpn?: string;
  rawProductName?: string;
  rawSearchPrice?: string;
  rawStockStatus?: string;
  rawStorePrice?: string;
}

export interface AwinCoolblueDebugInfo {
  csvHeaders: readonly string[];
  rowCount: number;
  sampleCount: number;
  samples: readonly AwinCoolblueDebugSample[];
}

export interface AwinCoolblueFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: AwinCoolblueDebugInfo;
  fetchedProductCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
}

export type AwinCoolblueCsvRow = Readonly<Record<string, string>>;

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/u, '');
}

function normalizeCsvHeader(value: string): string {
  return stripBom(value).trim().toLowerCase();
}

function readCsvCell(
  row: AwinCoolblueCsvRow,
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

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (insideQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          currentField += '"';
          index += 1;
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
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    if (character === '\r') {
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);

  if (currentRow.some((value) => value.trim())) {
    rows.push(currentRow);
  }

  return rows;
}

export function parseAwinCoolblueProductFeedCsv(
  csvText: string,
): readonly AwinCoolblueCsvRow[] {
  const parsedRows = parseCsvRows(stripBom(csvText));

  if (!parsedRows.length) {
    return [];
  }

  const [headerRow, ...valueRows] = parsedRows;
  const normalizedHeaders = headerRow.map(normalizeCsvHeader);

  return valueRows.map((valueRow) =>
    normalizedHeaders.reduce<Record<string, string>>((row, header, index) => {
      if (!header) {
        return row;
      }

      row[header] = valueRow[index] ?? '';
      return row;
    }, {}),
  );
}

function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

export function decodeAwinCoolblueFeedBody(buffer: Buffer): string {
  const resolvedBuffer = isGzipBuffer(buffer) ? gunzipSync(buffer) : buffer;

  return stripBom(resolvedBuffer.toString('utf8'));
}

function normalizeAwinAvailabilityText(row: AwinCoolblueCsvRow): string {
  const stockStatus = readCsvCell(row, ['stock_status']);
  const inStockValue = readCsvCell(row, ['in_stock'])?.toLowerCase();

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

function detectAwinBrand(row: AwinCoolblueCsvRow): string | undefined {
  const explicitBrand = readCsvCell(row, ['brand']);

  if (explicitBrand) {
    return explicitBrand;
  }

  const searchText = readCsvCell(row, ['product_name']) ?? '';

  return /\blego\b/i.test(searchText) ? 'LEGO' : undefined;
}

export function normalizeAwinCoolblueCsvRowToAffiliateFeedRow(
  row: AwinCoolblueCsvRow,
): AlternateAffiliateFeedRow {
  const rawCurrency = readCsvCell(row, ['currency']);
  const rawSearchPrice = readCsvCell(row, ['search_price']);
  const rawStorePrice = readCsvCell(row, ['store_price']);

  return {
    affiliateDeeplink: readCsvCell(row, ['aw_deep_link']) ?? '',
    availabilityText: normalizeAwinAvailabilityText(row) || undefined,
    brand: detectAwinBrand(row),
    category: readCsvCell(row, ['merchant_category', 'category_name']),
    currency: rawCurrency?.toUpperCase(),
    description: readCsvCell(row, ['description']),
    imageUrl: readCsvCell(row, ['merchant_image_url', 'aw_image_url']),
    legoSetNumber: readCsvCell(row, ['mpn']),
    price: rawSearchPrice ?? rawStorePrice,
    productTitle: readCsvCell(row, ['product_name']),
    shippingCost: readCsvCell(row, ['delivery_cost']),
  };
}

function buildAwinCoolblueDebugInfo({
  rows,
  sampleLimit,
}: {
  rows: readonly AwinCoolblueCsvRow[];
  sampleLimit?: number;
}): AwinCoolblueDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const csvHeaders = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(
    (left, right) => left.localeCompare(right),
  );
  const samples = rows
    .slice(0, sampleLimit)
    .map<AwinCoolblueDebugSample>((row) => ({
      normalizedRow: normalizeAwinCoolblueCsvRowToAffiliateFeedRow(row),
      rawCurrency: readCsvCell(row, ['currency']),
      rawInStock: readCsvCell(row, ['in_stock']),
      rawMpn: readCsvCell(row, ['mpn']),
      rawProductName: readCsvCell(row, ['product_name']),
      rawSearchPrice: readCsvCell(row, ['search_price']),
      rawStockStatus: readCsvCell(row, ['stock_status']),
      rawStorePrice: readCsvCell(row, ['store_price']),
    }));

  return {
    csvHeaders,
    rowCount: rows.length,
    sampleCount: samples.length,
    samples,
  };
}

async function fetchAwinCoolblueFeedRows({
  config,
  fetchFn,
}: {
  config: AwinCoolblueFeedConfig;
  fetchFn: typeof fetch;
}): Promise<readonly AwinCoolblueCsvRow[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'text/csv,application/octet-stream;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Awin Coolblue feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  const payloadBuffer = Buffer.from(await response.arrayBuffer());
  const csvText = decodeAwinCoolblueFeedBody(payloadBuffer);

  return parseAwinCoolblueProductFeedCsv(csvText);
}

export async function syncAwinCoolblueFeed({
  dependencies,
  options,
}: {
  dependencies?: AwinCoolblueFeedSyncDependencies;
  options?: AwinCoolblueFeedSyncOptions;
} = {}): Promise<AwinCoolblueFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getAwinCoolblueFeedConfigFn =
    dependencies?.getAwinCoolblueFeedConfigFn ?? getAwinCoolblueFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getAwinCoolblueFeedConfigFn();
  const fetchedRows = await fetchAwinCoolblueFeedRows({
    config,
    fetchFn,
  });
  const normalizedRows = fetchedRows.map(
    normalizeAwinCoolblueCsvRowToAffiliateFeedRow,
  );
  const debugInfo = buildAwinCoolblueDebugInfo({
    rows: fetchedRows,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      slug: config.merchantSlug,
      name: config.merchantName,
      affiliateNetwork: 'Awin',
      notes:
        'Feed-driven merchant. Current offer state is imported from the Coolblue Awin product feed.',
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows: normalizedRows,
  });

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount: fetchedRows.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: normalizedRows.length,
    unmatchedDebug: importResult.unmatchedDebug,
  };
}
