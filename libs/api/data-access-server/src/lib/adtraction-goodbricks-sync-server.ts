import {
  getAdtractionGoodbricksFeedConfig,
  type AdtractionGoodbricksFeedConfig,
} from '@lego-platform/shared/config';
import { XMLParser } from 'fast-xml-parser';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

const adtractionGoodbricksXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  textNodeName: '#text',
  trimValues: true,
});

export interface AdtractionGoodbricksFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getAdtractionGoodbricksFeedConfigFn?: typeof getAdtractionGoodbricksFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface AdtractionGoodbricksFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  discoverMissingSets?: boolean;
  dryRun?: boolean;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export interface AdtractionGoodbricksFeedProduct {
  availability?: string;
  brand?: string;
  category?: string;
  condition?: string;
  currency?: string;
  description?: string;
  gtin?: string;
  id?: string;
  imageUrl?: string;
  itemGroupId?: string;
  articleNumber?: string;
  link?: string;
  itemNumber?: string;
  model?: string;
  mpn?: string;
  price?: string;
  productNumber?: string;
  salePrice?: string;
  shippingCost?: string;
  sku?: string;
  title?: string;
}

export interface AdtractionGoodbricksDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawBrand?: string;
  rawGtin?: string;
  rawMpn?: string;
  rawPrice?: string;
  rawProductId?: string;
  rawSalePrice?: string;
  rawTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface AdtractionGoodbricksDebugInfo {
  rawProductCount: number;
  sampleCount: number;
  samples: readonly AdtractionGoodbricksDebugSample[];
}

export interface AdtractionGoodbricksFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: AdtractionGoodbricksDebugInfo;
  fetchedProductCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
}

function ensureArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value as T];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return readString(value['#text']);
}

function readAliasedString(
  record: Record<string, unknown>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = readString(record[alias]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

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

function isLegoText(value?: string): boolean {
  return /\blego\b/i.test(normalizeSearchText(value));
}

function normalizeGoodbricksBrand(
  product: AdtractionGoodbricksFeedProduct,
): string | undefined {
  const explicitBrand = product.brand?.trim();

  if (explicitBrand) {
    return normalizeSearchText(explicitBrand).startsWith('lego')
      ? 'LEGO'
      : explicitBrand;
  }

  return isGoodbricksLegoContext(product) ? 'LEGO' : undefined;
}

function isGoodbricksLegoContext(
  product: AdtractionGoodbricksFeedProduct,
): boolean {
  if (product.brand?.trim() && !isLegoText(product.brand)) {
    return false;
  }

  return (
    isLegoText(product.brand) ||
    isLegoText(product.title) ||
    isLegoText(product.category) ||
    isLegoText(product.description)
  );
}

function stripHtml(value?: string): string | undefined {
  const strippedValue = value
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return strippedValue || undefined;
}

function readPriceParts(value?: string): { currency?: string; price?: number } {
  const rawValue = value?.trim();

  if (!rawValue) {
    return {};
  }

  const currencyMatch = rawValue.match(/\b([A-Z]{3})\b/iu);
  const numericMatch = rawValue.match(/[-+]?\d[\d.,\s]*/u);

  if (!numericMatch) {
    return {
      currency: currencyMatch?.[1]?.toUpperCase(),
    };
  }

  const compactValue = numericMatch[0]
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/\.(?=.*\.)/g, '.');
  const lastCommaIndex = compactValue.lastIndexOf(',');
  const lastDotIndex = compactValue.lastIndexOf('.');
  const normalizedValue =
    lastCommaIndex >= 0 && lastDotIndex >= 0
      ? lastCommaIndex > lastDotIndex
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue.replace(/,/g, '')
      : lastCommaIndex >= 0
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue;
  const price = Number(normalizedValue);

  return {
    currency: currencyMatch?.[1]?.toUpperCase(),
    price: Number.isFinite(price) && price > 0 ? price : undefined,
  };
}

function resolveGoodbricksPrice(
  product: AdtractionGoodbricksFeedProduct,
): number | undefined {
  return (
    readPriceParts(product.salePrice).price ??
    readPriceParts(product.price).price
  );
}

function resolveGoodbricksCurrency(
  product: AdtractionGoodbricksFeedProduct,
): string | undefined {
  return (
    product.currency?.trim().toUpperCase() ||
    readPriceParts(product.salePrice).currency ||
    readPriceParts(product.price).currency ||
    (typeof resolveGoodbricksPrice(product) === 'number' ? 'EUR' : undefined)
  );
}

function normalizeGoodbricksAvailability(value?: string): string | undefined {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return undefined;
  }

  if (
    ['true', '1', 'yes', 'y', 'in stock', 'instock', 'in_stock'].includes(
      normalizedValue,
    ) ||
    normalizedValue.includes('op voorraad')
  ) {
    return 'In stock';
  }

  if (
    ['false', '0', 'no', 'n', 'out of stock', 'out_of_stock'].includes(
      normalizedValue,
    ) ||
    normalizedValue.includes('niet op voorraad')
  ) {
    return 'Out of stock';
  }

  return value;
}

function canonicalizeGoodbricksSetNumber(value?: string): string | undefined {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const exactMatch = trimmedValue.match(/^(\d{5})(?:-\d+)?$/u);

  return exactMatch?.[1];
}

function extractFiveDigitSetNumbers(value?: string): readonly string[] {
  const matches =
    value?.match(/(?<!\d)(\d{5})(?:-\d+)?(?!\d)/gu)?.map((match) => {
      const [setNumber] = match.split('-', 1);

      return setNumber;
    }) ?? [];

  return [...new Set(matches)];
}

function resolveGoodbricksSetNumber(
  product: AdtractionGoodbricksFeedProduct,
): string | undefined {
  const explicitSetNumber =
    canonicalizeGoodbricksSetNumber(product.mpn) ??
    canonicalizeGoodbricksSetNumber(product.sku) ??
    canonicalizeGoodbricksSetNumber(product.productNumber) ??
    canonicalizeGoodbricksSetNumber(product.articleNumber) ??
    canonicalizeGoodbricksSetNumber(product.itemNumber) ??
    canonicalizeGoodbricksSetNumber(product.model) ??
    canonicalizeGoodbricksSetNumber(product.itemGroupId);

  if (explicitSetNumber) {
    return explicitSetNumber;
  }

  if (!isGoodbricksLegoContext(product)) {
    return undefined;
  }

  return (
    extractFiveDigitSetNumbers(product.title)[0] ??
    extractFiveDigitSetNumbers(product.link)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0] ??
    canonicalizeGoodbricksSetNumber(product.id)
  );
}

function buildSetNumberCandidateFields(
  product: AdtractionGoodbricksFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  if (product.mpn) {
    candidateFields.mpn = product.mpn;
  }

  if (product.itemGroupId) {
    candidateFields.itemGroupId = product.itemGroupId;
  }

  for (const key of [
    'sku',
    'productNumber',
    'articleNumber',
    'itemNumber',
    'model',
  ] as const) {
    const value = product[key];

    if (value) {
      candidateFields[key] = value;
    }
  }

  if (product.id) {
    candidateFields.productId = product.id;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.title,
  ).entries()) {
    candidateFields[`title.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.link,
  ).entries()) {
    candidateFields[`url.numberCandidate${index + 1}`] = candidate;
  }

  return candidateFields;
}

function readGoodbricksShippingCost(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return readString(value);
  }

  return readAliasedString(value, ['g:price', 'price']);
}

function toGoodbricksFeedProduct(
  value: unknown,
): AdtractionGoodbricksFeedProduct {
  if (!isRecord(value)) {
    throw new Error('Adtraction Goodbricks feed item is invalid.');
  }

  return {
    availability: readAliasedString(value, ['g:availability', 'availability']),
    brand: readAliasedString(value, ['g:brand', 'brand']),
    category:
      readAliasedString(value, ['g:product_type', 'product_type']) ??
      readAliasedString(value, [
        'g:google_product_category',
        'google_product_category',
      ]),
    condition: readAliasedString(value, ['g:condition', 'condition']),
    description: readString(value['description']),
    gtin: readAliasedString(value, ['g:gtin', 'gtin']),
    id: readAliasedString(value, ['g:id', 'id']),
    imageUrl: readAliasedString(value, ['g:image_link', 'image_link']),
    itemGroupId: readAliasedString(value, ['g:item_group_id', 'item_group_id']),
    articleNumber: readAliasedString(value, [
      'g:article_number',
      'article_number',
      'articleNumber',
    ]),
    itemNumber: readAliasedString(value, [
      'g:item_number',
      'item_number',
      'itemNumber',
    ]),
    link: readString(value['link']),
    model: readAliasedString(value, ['g:model', 'model']),
    mpn: readAliasedString(value, ['g:mpn', 'mpn']),
    price: readAliasedString(value, ['g:price', 'price']),
    productNumber: readAliasedString(value, [
      'g:product_number',
      'product_number',
      'productNumber',
    ]),
    salePrice: readAliasedString(value, ['g:sale_price', 'sale_price']),
    shippingCost: readGoodbricksShippingCost(
      value['g:shipping'] ?? value['shipping'],
    ),
    sku: readAliasedString(value, ['g:sku', 'sku']),
    title: readString(value['title']),
  };
}

export function parseAdtractionGoodbricksProductFeedXml(
  xml: string,
): readonly AdtractionGoodbricksFeedProduct[] {
  const parsedXml = adtractionGoodbricksXmlParser.parse(xml) as Record<
    string,
    unknown
  >;
  const rssNode = parsedXml['rss'];
  const channelNode = isRecord(rssNode) ? rssNode['channel'] : undefined;
  const itemValue = isRecord(channelNode) ? channelNode['item'] : undefined;

  if (!itemValue) {
    throw new Error('Adtraction Goodbricks feed XML is missing RSS items.');
  }

  return ensureArray(itemValue).map(toGoodbricksFeedProduct);
}

export function normalizeAdtractionGoodbricksProductToAffiliateFeedRow(
  product: AdtractionGoodbricksFeedProduct,
): AlternateAffiliateFeedRow {
  return {
    affiliateDeeplink: product.link ?? '',
    availabilityText: normalizeGoodbricksAvailability(product.availability),
    brand: normalizeGoodbricksBrand(product),
    category: product.category,
    condition: product.condition,
    currency: resolveGoodbricksCurrency(product),
    description: stripHtml(product.description),
    ean: product.gtin,
    imageUrl: product.imageUrl,
    legoSetNumber: resolveGoodbricksSetNumber(product),
    price: resolveGoodbricksPrice(product),
    productId: product.id,
    productTitle: product.title,
    shippingCost: readPriceParts(product.shippingCost).price,
  };
}

function buildRowDedupeKey(row: AlternateAffiliateFeedRow): string {
  return [
    row.productId?.trim() || '',
    row.affiliateDeeplink.trim(),
    row.legoSetNumber?.trim() || '',
  ].join('|');
}

export function dedupeAdtractionGoodbricksRows(
  rows: readonly AlternateAffiliateFeedRow[],
): readonly AlternateAffiliateFeedRow[] {
  const rowsByDedupeKey = new Map<string, AlternateAffiliateFeedRow>();

  for (const [index, row] of rows.entries()) {
    const dedupeKey = buildRowDedupeKey(row) || `__row_${index}`;

    if (!rowsByDedupeKey.has(dedupeKey)) {
      rowsByDedupeKey.set(dedupeKey, row);
    }
  }

  return [...rowsByDedupeKey.values()];
}

function buildAdtractionGoodbricksDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly AdtractionGoodbricksFeedProduct[];
  sampleLimit?: number;
}): AdtractionGoodbricksDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const samples = products
    .slice(0, sampleLimit)
    .map<AdtractionGoodbricksDebugSample>((product) => ({
      normalizedRow:
        normalizeAdtractionGoodbricksProductToAffiliateFeedRow(product),
      rawAvailability: product.availability,
      rawBrand: product.brand,
      rawGtin: product.gtin,
      rawMpn: product.mpn,
      rawPrice: product.price,
      rawProductId: product.id,
      rawSalePrice: product.salePrice,
      rawTitle: product.title,
      selectedLegoSetNumber: resolveGoodbricksSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    rawProductCount: products.length,
    sampleCount: samples.length,
    samples,
  };
}

async function fetchAdtractionGoodbricksFeedProducts({
  config,
  fetchFn,
}: {
  config: AdtractionGoodbricksFeedConfig;
  fetchFn: typeof fetch;
}): Promise<readonly AdtractionGoodbricksFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Adtraction Goodbricks feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseAdtractionGoodbricksProductFeedXml(await response.text());
}

export async function syncAdtractionGoodbricksFeed({
  dependencies,
  options,
}: {
  dependencies?: AdtractionGoodbricksFeedSyncDependencies;
  options?: AdtractionGoodbricksFeedSyncOptions;
} = {}): Promise<AdtractionGoodbricksFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getAdtractionGoodbricksFeedConfigFn =
    dependencies?.getAdtractionGoodbricksFeedConfigFn ??
    getAdtractionGoodbricksFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getAdtractionGoodbricksFeedConfigFn();
  const rawProducts = await fetchAdtractionGoodbricksFeedProducts({
    config,
    fetchFn,
  });
  const rows = dedupeAdtractionGoodbricksRows(
    rawProducts.map(normalizeAdtractionGoodbricksProductToAffiliateFeedRow),
  );
  const debugInfo = buildAdtractionGoodbricksDebugInfo({
    products: rawProducts,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'Adtraction',
      name: config.merchantName,
      notes:
        'Feed-driven merchant. Current offer state is imported from the Goodbricks Adtraction product feed.',
      slug: config.merchantSlug,
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      persistDiscoveredSets:
        options?.persistDiscoveredSets ?? options?.discoverMissingSets ?? false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount: rawProducts.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
  };
}
