import {
  getAwinJoybuyFeedConfig,
  type AwinJoybuyFeedConfig,
} from '@lego-platform/shared/config';
import {
  readAwinCsvCell,
  syncAwinFeed,
  type AwinCsvRow,
  type AwinDebugInfo,
  type AwinDebugSample,
  type AwinFeedSyncDependencies,
  type AwinFeedSyncOptions,
  type AwinFeedSyncResult,
} from './awin-feed-sync-server';
import type { AlternateAffiliateFeedRow } from './alternate-affiliate-feed-server';

export interface AwinJoybuyFeedSyncDependencies
  extends AwinFeedSyncDependencies {
  getAwinJoybuyFeedConfigFn?: typeof getAwinJoybuyFeedConfig;
}

export type AwinJoybuyFeedSyncOptions = AwinFeedSyncOptions;
export type AwinJoybuyDebugSample = AwinDebugSample;
export type AwinJoybuyDebugInfo = AwinDebugInfo;
export type AwinJoybuyFeedSyncResult = AwinFeedSyncResult;
export type AwinJoybuyCsvRow = AwinCsvRow;

const nonLegoProductPattern =
  /\b(?:nintendo\s*switch|playstation|ps5|xbox|videogame|video\s*game|software|game|games|boek|book|boeken|kleding|shirt|pyjama|rugzak|tas|beker|drinkfles|sleutelhanger|keychain|watch|horloge|lamp|light\s*kit|storage|opberg|etui|puzzel|puzzle|poster|kalender|calendar|display\s*case|vitrine|stofkap|onderdelen|loose\s*parts|losse\s*stenen|minifiguur\s*los|minifigure\s*display|compatible\s*bricks|alternative\s*brick|cada|cobi|mould\s*king)\b/iu;
const setNumberPattern = /\b(\d{4,7})(?:-1)?\b/u;

function normalizeSearchText(value?: string): string {
  return (
    value
      ?.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/®/g, '')
      .toLowerCase()
      .trim() ?? ''
  );
}

function stripHtml(value?: string): string | undefined {
  const strippedValue = value
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return strippedValue || undefined;
}

function readHumanTextFields(row: AwinJoybuyCsvRow): readonly string[] {
  return [
    readAwinCsvCell(row, ['product_name']),
    readAwinCsvCell(row, ['description']),
    readAwinCsvCell(row, ['merchant_category']),
    readAwinCsvCell(row, ['category_name']),
  ].flatMap((value) => (value ? [stripHtml(value) ?? value] : []));
}

export function isStrictAwinJoybuyLegoCandidate(
  row: AwinJoybuyCsvRow,
): boolean {
  const humanText = normalizeSearchText(readHumanTextFields(row).join(' '));

  return (
    Boolean(humanText) &&
    /\blego\b/u.test(humanText) &&
    !nonLegoProductPattern.test(humanText)
  );
}

export function extractAwinJoybuySetNumberFromHumanFields(
  row: AwinJoybuyCsvRow,
): string | undefined {
  if (!isStrictAwinJoybuyLegoCandidate(row)) {
    return undefined;
  }

  for (const fieldValue of readHumanTextFields(row)) {
    const match = setNumberPattern.exec(fieldValue);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function normalizeAwinAvailabilityText(row: AwinJoybuyCsvRow): string {
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

export function normalizeAwinJoybuyCsvRowToAffiliateFeedRow(
  row: AwinJoybuyCsvRow,
): AlternateAffiliateFeedRow {
  const rawCurrency = readAwinCsvCell(row, ['currency']);
  const rawSearchPrice = readAwinCsvCell(row, ['search_price']);
  const rawStorePrice = readAwinCsvCell(row, ['store_price']);
  const isLegoCandidate = isStrictAwinJoybuyLegoCandidate(row);

  return {
    affiliateDeeplink:
      readAwinCsvCell(row, ['aw_deep_link', 'merchant_deep_link']) ?? '',
    availabilityText: normalizeAwinAvailabilityText(row) || undefined,
    brand: isLegoCandidate ? 'LEGO' : undefined,
    category: readAwinCsvCell(row, ['merchant_category', 'category_name']),
    currency: rawCurrency?.toUpperCase(),
    description: stripHtml(readAwinCsvCell(row, ['description'])),
    imageUrl: readAwinCsvCell(row, ['merchant_image_url', 'aw_image_url']),
    legoSetNumber: extractAwinJoybuySetNumberFromHumanFields(row),
    price: rawSearchPrice ?? rawStorePrice,
    productId: readAwinCsvCell(row, ['aw_product_id', 'merchant_product_id']),
    productTitle: readAwinCsvCell(row, ['product_name']),
    shippingCost: readAwinCsvCell(row, ['delivery_cost']),
  };
}

export async function syncAwinJoybuyFeed({
  dependencies,
  options,
}: {
  dependencies?: AwinJoybuyFeedSyncDependencies;
  options?: AwinJoybuyFeedSyncOptions;
} = {}): Promise<AwinJoybuyFeedSyncResult> {
  const getAwinJoybuyFeedConfigFn =
    dependencies?.getAwinJoybuyFeedConfigFn ?? getAwinJoybuyFeedConfig;
  const config: AwinJoybuyFeedConfig = getAwinJoybuyFeedConfigFn();

  return syncAwinFeed({
    dependencies,
    definition: {
      config,
      merchantNotes:
        'Feed-driven merchant. Current offer state is imported from the Joybuy Awin product feed.',
      normalizeRow: normalizeAwinJoybuyCsvRowToAffiliateFeedRow,
    },
    options,
  });
}
