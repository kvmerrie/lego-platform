import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import {
  getTradeDoublerMediaMarktFeedConfig,
  type TradeDoublerMediaMarktFeedConfig,
} from '@lego-platform/shared/config';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

type ProductFieldMap = Map<string, string[]>;

interface ProductStackEntry {
  attributes: Record<string, string>;
  localName: string;
}

export interface TradeDoublerMediaMarktFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getTradeDoublerMediaMarktFeedConfigFn?: typeof getTradeDoublerMediaMarktFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface TradeDoublerMediaMarktFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  unmatchedSampleLimit?: number;
}

export interface TradeDoublerMediaMarktFeedProduct {
  availability?: string;
  brand?: string;
  category?: string;
  currency?: string;
  description?: string;
  ean?: string;
  imageUrl?: string;
  inStock?: string;
  model?: string;
  name?: string;
  price?: string;
  productUrl?: string;
  shortDescription?: string;
  sku?: string;
  sourceProductId?: string;
}

export interface TradeDoublerMediaMarktDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawBrand?: string;
  rawCurrency?: string;
  rawProductId?: string;
  rawTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface TradeDoublerMediaMarktDebugInfo {
  fetchedProductCount: number;
  legoCandidateCount: number;
  sampleCount: number;
  samples: readonly TradeDoublerMediaMarktDebugSample[];
}

export interface TradeDoublerMediaMarktFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: TradeDoublerMediaMarktDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
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

function stripHtml(value?: string): string | undefined {
  const strippedValue = value
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return strippedValue || undefined;
}

function addFieldValue(
  fields: ProductFieldMap,
  key: string,
  value: string,
): void {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (!normalizedValue) {
    return;
  }

  const normalizedKey = normalizeLookupKey(key);
  const existingValues = fields.get(normalizedKey) ?? [];

  existingValues.push(normalizedValue);
  fields.set(normalizedKey, existingValues);
}

function readField(
  fields: ProductFieldMap,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const values = fields.get(normalizeLookupKey(alias));
    const value = values?.find((candidate) => candidate.trim());

    if (value) {
      return value;
    }
  }

  for (const [key, values] of fields.entries()) {
    if (
      aliases.some((alias) => {
        const normalizedAlias = normalizeLookupKey(alias);

        return key.endsWith(normalizedAlias) || key.includes(normalizedAlias);
      })
    ) {
      const value = values.find((candidate) => candidate.trim());

      if (value) {
        return value;
      }
    }
  }

  return undefined;
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

function canonicalizeMediaMarktSetNumber(value?: string): string | undefined {
  const exactMatch = value?.trim().match(/^(\d{5})(?:-\d+)?$/u);

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

function buildMediaMarktHaystack(product: TradeDoublerMediaMarktFeedProduct) {
  return [
    product.name,
    product.description,
    product.shortDescription,
    product.model,
    product.brand,
    product.category,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
}

function isMediaMarktLegoContext(
  product: TradeDoublerMediaMarktFeedProduct,
): boolean {
  return /\blego\b/i.test(
    normalizeSearchText(buildMediaMarktHaystack(product)),
  );
}

function isMediaMarktLegoVideoGame(
  product: TradeDoublerMediaMarktFeedProduct,
): boolean {
  const categoryText = normalizeSearchText(product.category);
  const brandText = normalizeSearchText(product.brand);
  const productText = normalizeSearchText(
    [
      product.name,
      product.model,
      product.shortDescription,
      stripHtml(product.description),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' '),
  );

  return (
    categoryText.includes('gaming') ||
    brandText.includes('warner bros games') ||
    /\b(nintendo switch|playstation|ps5|xbox|game|videogame|software)\b/iu.test(
      productText,
    )
  );
}

function isMediaMarktLegoConstructionProduct(
  product: TradeDoublerMediaMarktFeedProduct,
): boolean {
  return (
    isMediaMarktLegoContext(product) && !isMediaMarktLegoVideoGame(product)
  );
}

function normalizeMediaMarktBrand(
  product: TradeDoublerMediaMarktFeedProduct,
): string | undefined {
  const explicitBrand = product.brand?.trim();

  if (explicitBrand) {
    return normalizeSearchText(explicitBrand).startsWith('lego')
      ? 'LEGO'
      : explicitBrand;
  }

  return isMediaMarktLegoContext(product) ? 'LEGO' : undefined;
}

function resolveMediaMarktSetNumber(
  product: TradeDoublerMediaMarktFeedProduct,
): string | undefined {
  if (!isMediaMarktLegoConstructionProduct(product)) {
    return undefined;
  }

  return (
    canonicalizeMediaMarktSetNumber(product.model) ??
    extractFiveDigitSetNumbers(product.name)[0] ??
    extractFiveDigitSetNumbers(product.model)[0] ??
    extractFiveDigitSetNumbers(product.shortDescription)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0]
  );
}

function buildSetNumberCandidateFields(
  product: TradeDoublerMediaMarktFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  if (product.model) {
    candidateFields.model = product.model;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.name,
  ).entries()) {
    candidateFields[`name.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.shortDescription,
  ).entries()) {
    candidateFields[`shortDescription.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    stripHtml(product.description),
  ).entries()) {
    candidateFields[`description.numberCandidate${index + 1}`] = candidate;
  }

  if (product.ean) {
    candidateFields.eanIgnored = product.ean;
  }

  if (product.sku) {
    candidateFields.skuIgnored = product.sku;
  }

  if (product.sourceProductId) {
    candidateFields.sourceProductIdIgnored = product.sourceProductId;
  }

  if (product.productUrl) {
    candidateFields.productUrlIgnored = product.productUrl;
  }

  return candidateFields;
}

function resolveMediaMarktPrice(
  product: TradeDoublerMediaMarktFeedProduct,
): number | undefined {
  return readPriceParts(product.price).price;
}

function resolveMediaMarktCurrency(
  product: TradeDoublerMediaMarktFeedProduct,
): string | undefined {
  return (
    product.currency?.trim().toUpperCase() ||
    readPriceParts(product.price).currency ||
    (typeof resolveMediaMarktPrice(product) === 'number' ? 'EUR' : undefined)
  );
}

export function normalizeMediaMarktAvailability({
  availability,
  inStock,
}: {
  availability?: string;
  inStock?: string;
}): string | undefined {
  const normalizedAvailability = normalizeSearchText(availability);
  const normalizedInStock = normalizeSearchText(inStock);

  if (
    normalizedAvailability === 'in stock' ||
    normalizedAvailability === 'instock' ||
    normalizedAvailability === 'in_stock' ||
    normalizedAvailability.includes('op voorraad') ||
    ['true', 'yes', '1'].includes(normalizedInStock) ||
    (Number.isFinite(Number(normalizedInStock)) &&
      Number(normalizedInStock) > 0)
  ) {
    return 'In stock';
  }

  if (
    normalizedAvailability.includes('out of stock') ||
    normalizedAvailability.includes('niet op voorraad') ||
    ['false', 'no', '0'].includes(normalizedInStock)
  ) {
    return 'Out of stock';
  }

  return availability?.trim() || undefined;
}

function toTradeDoublerMediaMarktProduct(
  fields: ProductFieldMap,
): TradeDoublerMediaMarktFeedProduct {
  return {
    availability: readField(fields, [
      'availability',
      'stockStatus',
      'deliveryStatus',
    ]),
    brand: readField(fields, ['brand', 'manufacturer', 'vendor']),
    category: readField(fields, [
      'categoryPath',
      'category_path',
      'categoryName',
      'category',
      'categories',
    ]),
    currency: readField(fields, [
      'currency',
      'priceCurrency',
      'price.currency',
      'priceHistory.currency',
    ]),
    description: readField(fields, ['description', 'longDescription']),
    ean: readField(fields, ['ean', 'gtin', 'barcode']),
    imageUrl: readField(fields, [
      'imageUrl',
      'imageURL',
      'image',
      'productImage',
      'productImageUrl',
    ]),
    inStock: readField(fields, ['inStock', 'stock', 'stockLevel']),
    model: readField(fields, ['model', 'mpn']),
    name: readField(fields, ['name', 'title', 'productName']),
    price: readField(fields, [
      'priceHistory.price',
      'currentPrice',
      'salePrice',
      'price',
      'price.value',
      'amount',
      'grossPrice',
    ]),
    productUrl: readField(fields, [
      'productUrl',
      'productURL',
      'trackingUrl',
      'affiliateUrl',
      'clickUrl',
      'url',
      'link',
    ]),
    shortDescription: readField(fields, [
      'shortDescription',
      'short_description',
      'subtitle',
    ]),
    sku: readField(fields, ['sku', 'articleNumber', 'itemNumber']),
    sourceProductId: readField(fields, [
      'sourceProductId',
      'sourceProductID',
      'productId',
      'productID',
      'id',
      'sku',
    ]),
  };
}

export function normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow(
  product: TradeDoublerMediaMarktFeedProduct,
): AlternateAffiliateFeedRow {
  return {
    affiliateDeeplink: product.productUrl ?? '',
    availabilityText: normalizeMediaMarktAvailability({
      availability: product.availability,
      inStock: product.inStock,
    }),
    brand: normalizeMediaMarktBrand(product),
    category: product.category,
    condition: 'new',
    currency: resolveMediaMarktCurrency(product),
    description: stripHtml(product.description),
    ean: product.ean,
    imageUrl: product.imageUrl,
    legoSetNumber: resolveMediaMarktSetNumber(product),
    price: resolveMediaMarktPrice(product),
    productId: product.sourceProductId ?? product.sku,
    productTitle: product.name,
  };
}

function readLocalName(name: string): string {
  return name.includes(':') ? (name.split(':').pop() ?? name) : name;
}

function toAttributeRecord(
  attributes: SaxesTagPlain['attributes'],
): Record<string, string> {
  return Object.entries(attributes).reduce<Record<string, string>>(
    (record, [key, value]) => {
      record[readLocalName(key)] = String(value);

      return record;
    },
    {},
  );
}

export async function parseTradeDoublerMediaMarktProductFeedXmlStream(
  xmlStream: Readable,
  options: {
    maxProducts?: number;
    onProduct?: (product: TradeDoublerMediaMarktFeedProduct) => void;
  } = {},
): Promise<readonly TradeDoublerMediaMarktFeedProduct[]> {
  const products: TradeDoublerMediaMarktFeedProduct[] = [];
  const parser = new SaxesParser({
    fragment: false,
    position: false,
    xmlns: false,
  });
  let currentProductFields: ProductFieldMap | undefined;
  let productDepth = -1;
  const stack: ProductStackEntry[] = [];

  function recordProductText(text: string) {
    if (!currentProductFields || productDepth < 0) {
      return;
    }

    const relativeStack = stack.slice(productDepth + 1);
    const currentEntry = relativeStack.at(-1);

    if (!currentEntry) {
      return;
    }

    const relativePath = relativeStack
      .map((entry) => entry.localName)
      .join('.');

    addFieldValue(currentProductFields, currentEntry.localName, text);
    addFieldValue(currentProductFields, relativePath, text);

    for (const [attributeName, attributeValue] of Object.entries(
      currentEntry.attributes,
    )) {
      if (['name', 'field', 'type', 'property'].includes(attributeName)) {
        addFieldValue(currentProductFields, attributeValue, text);
        addFieldValue(
          currentProductFields,
          `${currentEntry.localName}.${attributeValue}`,
          text,
        );
      }
    }
  }

  parser.on('opentag', (tag) => {
    const localName = readLocalName(tag.name);
    stack.push({
      attributes: toAttributeRecord(tag.attributes),
      localName,
    });

    if (localName === 'product' && !currentProductFields) {
      currentProductFields = new Map();
      productDepth = stack.length - 1;

      for (const [attributeName, attributeValue] of Object.entries(
        toAttributeRecord(tag.attributes),
      )) {
        addFieldValue(currentProductFields, attributeName, attributeValue);
        addFieldValue(
          currentProductFields,
          `product.${attributeName}`,
          attributeValue,
        );
      }
      return;
    }

    if (currentProductFields && productDepth >= 0) {
      const relativePath = stack
        .slice(productDepth + 1)
        .map((entry) => entry.localName)
        .join('.');

      for (const [attributeName, attributeValue] of Object.entries(
        toAttributeRecord(tag.attributes),
      )) {
        addFieldValue(currentProductFields, attributeName, attributeValue);
        addFieldValue(
          currentProductFields,
          `${relativePath}.${attributeName}`,
          attributeValue,
        );
      }
    }
  });

  parser.on('text', recordProductText);
  parser.on('cdata', recordProductText);
  parser.on('closetag', (tag) => {
    const localName = readLocalName(tag.name);

    if (localName === 'product' && currentProductFields) {
      const product = toTradeDoublerMediaMarktProduct(currentProductFields);

      products.push(product);
      options.onProduct?.(product);
      currentProductFields = undefined;
      productDepth = -1;
    }

    stack.pop();

    if (
      options.maxProducts &&
      options.maxProducts > 0 &&
      products.length >= options.maxProducts
    ) {
      xmlStream.destroy();
    }
  });

  parser.on('error', (error) => {
    throw error;
  });

  await pipeline(
    xmlStream,
    new Writable({
      write(chunk, _encoding, callback) {
        try {
          parser.write(chunk.toString('utf8'));
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
      final(callback) {
        try {
          parser.close();
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    }),
  ).catch((error: unknown) => {
    if (
      options.maxProducts &&
      options.maxProducts > 0 &&
      products.length >= options.maxProducts
    ) {
      return;
    }

    throw error;
  });

  return products;
}

function buildRowDedupeKey(row: AlternateAffiliateFeedRow): string {
  return [
    row.productId?.trim() || '',
    row.affiliateDeeplink.trim(),
    row.legoSetNumber?.trim() || '',
  ].join('|');
}

export function dedupeTradeDoublerMediaMarktRows(
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

function buildTradeDoublerMediaMarktDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly TradeDoublerMediaMarktFeedProduct[];
  sampleLimit?: number;
}): TradeDoublerMediaMarktDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isMediaMarktLegoContext);
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<TradeDoublerMediaMarktDebugSample>((product) => ({
      normalizedRow:
        normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow(product),
      rawAvailability: product.availability,
      rawBrand: product.brand,
      rawCurrency: product.currency,
      rawProductId: product.sourceProductId,
      rawTitle: product.name,
      selectedLegoSetNumber: resolveMediaMarktSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    sampleCount: samples.length,
    samples,
  };
}

async function createXmlStreamFromMaybeGzippedResponse({
  contentEncoding,
  contentType,
  responseStream,
}: {
  contentEncoding?: string | null;
  contentType?: string | null;
  responseStream: Readable;
}): Promise<Readable> {
  const normalizedEncoding = contentEncoding?.toLowerCase() ?? '';
  const normalizedContentType = contentType?.toLowerCase() ?? '';
  const iterator = responseStream[Symbol.asyncIterator]();
  const firstChunks: Buffer[] = [];
  let firstByte: number | undefined;
  let secondByte: number | undefined;

  while (secondByte === undefined) {
    const next = await iterator.next();

    if (next.done) {
      break;
    }

    const chunk = Buffer.isBuffer(next.value)
      ? next.value
      : Buffer.from(next.value);

    if (chunk.length === 0) {
      continue;
    }

    firstChunks.push(chunk);

    for (const byte of chunk) {
      if (firstByte === undefined) {
        firstByte = byte;
        continue;
      }

      secondByte = byte;
      break;
    }
  }

  async function* replayPeekedStream(): AsyncGenerator<Buffer> {
    yield* firstChunks;

    for await (const chunk of iterator) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  }

  const hasGzipHeader =
    normalizedEncoding.includes('gzip') ||
    normalizedEncoding.includes('x-gzip');
  const hasGzipMagicBytes = firstByte === 0x1f && secondByte === 0x8b;
  const xmlStream = Readable.from(replayPeekedStream());

  // TradeDoubler can return plain XML from a URL that still contains
  // ";compress=gz", so the URL is not a safe decompression signal.
  void normalizedContentType;

  return hasGzipHeader || hasGzipMagicBytes
    ? xmlStream.pipe(createGunzip())
    : xmlStream;
}

async function fetchTradeDoublerMediaMarktFeedProducts({
  config,
  fetchFn,
  maxProducts,
}: {
  config: TradeDoublerMediaMarktFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
}): Promise<readonly TradeDoublerMediaMarktFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      'Accept-Encoding': 'gzip',
    },
  });

  if (!response.ok) {
    throw new Error(
      `TradeDoubler MediaMarkt feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  if (!response.body) {
    throw new Error('TradeDoubler MediaMarkt feed response has no body.');
  }

  const responseStream = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>,
  );
  const xmlStream = await createXmlStreamFromMaybeGzippedResponse({
    contentEncoding: response.headers.get('content-encoding'),
    contentType: response.headers.get('content-type'),
    responseStream,
  });

  return parseTradeDoublerMediaMarktProductFeedXmlStream(xmlStream, {
    maxProducts,
  });
}

export async function syncTradeDoublerMediaMarktFeed({
  dependencies,
  options,
}: {
  dependencies?: TradeDoublerMediaMarktFeedSyncDependencies;
  options?: TradeDoublerMediaMarktFeedSyncOptions;
} = {}): Promise<TradeDoublerMediaMarktFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getTradeDoublerMediaMarktFeedConfigFn =
    dependencies?.getTradeDoublerMediaMarktFeedConfigFn ??
    getTradeDoublerMediaMarktFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getTradeDoublerMediaMarktFeedConfigFn();
  const rawProducts = await fetchTradeDoublerMediaMarktFeedProducts({
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
  });
  const legoProducts = rawProducts.filter(isMediaMarktLegoContext);
  const legoVideoGameProducts = legoProducts.filter(isMediaMarktLegoVideoGame);
  const constructionProducts = legoProducts.filter(
    isMediaMarktLegoConstructionProduct,
  );
  const missingSetNumberProductCount = constructionProducts.filter(
    (product) => !resolveMediaMarktSetNumber(product),
  ).length;
  const rows = dedupeTradeDoublerMediaMarktRows(
    constructionProducts
      .map(normalizeTradeDoublerMediaMarktProductToAffiliateFeedRow)
      .filter((row) => Boolean(row.legoSetNumber)),
  );
  const debugInfo = buildTradeDoublerMediaMarktDebugInfo({
    products: rawProducts,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'TradeDoubler',
      name: config.merchantName,
      notes:
        'Feed-driven merchant. Current offer state is imported from the MediaMarkt TradeDoubler product feed.',
      slug: config.merchantSlug,
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount: rawProducts.length,
    legoCandidateCount: legoProducts.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (rawProducts.length - legoProducts.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount + legoVideoGameProducts.length,
  };
}
