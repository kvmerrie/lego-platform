import { PassThrough, Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import {
  getRakutenLegoFeedConfig,
  resolveRakutenLegoFeedFilename,
  type RakutenLegoFeedConfig,
} from '@lego-platform/shared/config';
import SftpClient from 'ssh2-sftp-client';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AffiliateFeedMerchantConfig,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

type RakutenXmlProduct = Readonly<Record<string, string | undefined>>;

export interface RakutenLegoDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawCurrency?: string;
  rawPrice?: string;
  rawProductId?: string;
  rawTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: readonly string[];
}

export interface RakutenLegoDebugInfo {
  fetchedProductCount: number;
  legoCandidateCount: number;
  sampleCount: number;
  samples: readonly RakutenLegoDebugSample[];
}

export interface RakutenLegoFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export interface RakutenLegoFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: RakutenLegoDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
  parseFailureCount: number;
}

export interface RakutenSftpListEntry {
  listPath: string;
  modifyTime?: number;
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface RakutenSftpListFailure {
  message: string;
  path: string;
}

export interface RakutenSftpListResult {
  entries: readonly RakutenSftpListEntry[];
  failures: readonly RakutenSftpListFailure[];
  pwd?: string;
  successfulPaths: readonly string[];
}

interface RakutenSftpClient {
  connect(config: {
    host: string;
    password: string;
    port: number;
    readyTimeout?: number;
    username: string;
  }): Promise<unknown>;
  createReadStream(path: string): NodeJS.ReadableStream;
  end(): Promise<unknown>;
  get(path: string): Promise<Buffer | NodeJS.ReadableStream | string>;
  list(path: string): Promise<
    readonly {
      modifyTime?: number;
      name: string;
      size?: number;
      type?: string;
    }[]
  >;
  pwd?(): Promise<string>;
}

export interface RakutenLegoFeedSyncDependencies {
  createSftpClientFn?: () => RakutenSftpClient;
  getRakutenLegoFeedConfigFn?: typeof getRakutenLegoFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

const RAKUTEN_LEGO_MERCHANT_NOTES =
  'Feed-driven merchant. Current offer state is imported from the LEGO Rakuten Product Catalog feed.';

const NON_BUILDING_SET_PATTERN =
  /\b(?:boek|books?|game|games|software|playstation|xbox|nintendo|switch|pc|kleding|shirt|t-shirt|hoodie|pyjama|sokken|cap|rugzak|backpack|tas|bag|sleutelhanger|keychain|keyring|lamp|lighting|light kit|display case|vitrine|beker|mok|mug|drinkfles|sticker|poster|puzzel|puzzle|plush|knuffel|costume|kostuum|watch|horloge)\b/i;
const LEGO_SET_NUMBER_PATTERN = /\b(?:LEGO\s*)?(\d{4,6})(?:-\d+)?\b/i;
const PRODUCT_TAG_NAMES = new Set(['product', 'item']);

function createDefaultSftpClient(): RakutenSftpClient {
  return new SftpClient() as unknown as RakutenSftpClient;
}

function joinRemotePath(
  directory: string | undefined,
  filename: string,
): string {
  const trimmedFilename = filename.trim();
  const rawDirectory = directory?.trim();
  const trimmedDirectory = rawDirectory?.replace(/\/+$/u, '');

  if (rawDirectory === '/' && !trimmedFilename.startsWith('/')) {
    return `/${trimmedFilename.replace(/^\/+/u, '')}`;
  }

  if (!trimmedDirectory || trimmedFilename.startsWith('/')) {
    return trimmedFilename;
  }

  return `${trimmedDirectory}/${trimmedFilename.replace(/^\/+/u, '')}`;
}

export function resolveRakutenLegoFeedRemotePath(
  config: Pick<RakutenLegoFeedConfig, 'filename' | 'mid' | 'remoteDir' | 'sid'>,
): string {
  if (config.filename?.trim()) {
    return config.filename.trim();
  }

  return joinRemotePath(
    config.remoteDir,
    resolveRakutenLegoFeedFilename(config),
  );
}

function buildRakutenListCandidatePaths(
  config: Pick<RakutenLegoFeedConfig, 'mid' | 'remoteDir'>,
): readonly string[] {
  return ['.', config.remoteDir, '/', config.mid].reduce<string[]>(
    (paths, path) => {
      const trimmedPath = path?.trim();

      if (trimmedPath && !paths.includes(trimmedPath)) {
        paths.push(trimmedPath);
      }

      return paths;
    },
    [],
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmedValue = String(value).trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizeLookupKey(value: string): string {
  return value
    .replace(/^[^:]+:/u, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function readProductField(
  product: RakutenXmlProduct,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = product[normalizeLookupKey(alias)] ?? product[alias];
    const trimmedValue = readString(value);

    if (trimmedValue) {
      return trimmedValue;
    }
  }

  return undefined;
}

function buildHumanSetNumberCandidateFields(
  product: RakutenXmlProduct,
): readonly string[] {
  return [
    readProductField(product, [
      'product_name',
      'productname',
      'name',
      'title',
      'product_title',
      'producttitle',
    ]),
    readProductField(product, [
      'short_description',
      'shortdescription',
      'short_desc',
      'summary',
    ]),
    readProductField(product, ['description', 'long_description']),
    readProductField(product, [
      'category',
      'category_name',
      'categoryname',
      'primary_category',
      'product_category',
    ]),
  ].filter((value): value is string => Boolean(value));
}

export function extractRakutenLegoSetNumberFromHumanFields(
  product: RakutenXmlProduct,
): string | undefined {
  for (const fieldValue of buildHumanSetNumberCandidateFields(product)) {
    const match = LEGO_SET_NUMBER_PATTERN.exec(fieldValue);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function getSearchText(product: RakutenXmlProduct): string {
  return buildHumanSetNumberCandidateFields(product).join(' ');
}

export function isStrictRakutenLegoSetCandidate(
  product: RakutenXmlProduct,
): boolean {
  const searchText = getSearchText(product);
  const brand = readProductField(product, [
    'brand',
    'manufacturer',
    'product_brand',
    'make',
  ]);

  if (!/\blego\b/i.test(`${brand ?? ''} ${searchText}`)) {
    return false;
  }

  if (NON_BUILDING_SET_PATTERN.test(searchText)) {
    return false;
  }

  return Boolean(extractRakutenLegoSetNumberFromHumanFields(product));
}

function readRakutenAvailabilityText(
  product: RakutenXmlProduct,
): string | undefined {
  const rawValue = readProductField(product, [
    'availability',
    'availability_status',
    'stock_status',
    'stock',
    'instock',
    'in_stock',
    'inventory',
  ]);

  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (
    ['1', 'true', 'yes', 'y', 'available', 'instock'].includes(normalizedValue)
  ) {
    return 'In stock';
  }

  if (
    ['0', 'false', 'no', 'n', 'unavailable', 'outofstock'].includes(
      normalizedValue,
    )
  ) {
    return 'Out of stock';
  }

  return rawValue;
}

function readRakutenCurrency(product: RakutenXmlProduct): string | undefined {
  return readProductField(product, [
    'currency',
    'price_currency',
    'currency_code',
  ])
    ?.trim()
    .toUpperCase();
}

export function normalizeRakutenLegoProductToAffiliateFeedRow(
  product: RakutenXmlProduct,
): AlternateAffiliateFeedRow {
  const isLegoSetCandidate = isStrictRakutenLegoSetCandidate(product);
  const productTitle = readProductField(product, [
    'product_name',
    'productname',
    'name',
    'title',
    'product_title',
    'producttitle',
  ]);

  return {
    affiliateDeeplink:
      readProductField(product, [
        'linkurl',
        'link_url',
        'clickurl',
        'click_url',
        'deeplink',
        'product_url',
        'producturl',
        'url',
      ]) ?? '',
    availabilityText: readRakutenAvailabilityText(product),
    brand: isLegoSetCandidate ? 'LEGO' : undefined,
    category: readProductField(product, [
      'category',
      'category_name',
      'categoryname',
      'primary_category',
      'product_category',
    ]),
    condition: readProductField(product, ['condition', 'item_condition']),
    currency: readRakutenCurrency(product),
    description: readProductField(product, [
      'description',
      'short_description',
      'shortdescription',
      'long_description',
    ]),
    ean: readProductField(product, ['ean', 'gtin', 'upc']),
    imageUrl: readProductField(product, [
      'imageurl',
      'image_url',
      'image',
      'largeimage',
      'large_image',
      'thumbnail',
    ]),
    legoSetNumber: isLegoSetCandidate
      ? extractRakutenLegoSetNumberFromHumanFields(product)
      : undefined,
    price: readProductField(product, [
      'price',
      'sale_price',
      'saleprice',
      'retail_price',
      'retailprice',
    ]),
    productId: readProductField(product, [
      'product_id',
      'productid',
      'sku',
      'merchant_sku',
      'rakuten_product_id',
      'id',
    ]),
    productTitle,
    shippingCost: readProductField(product, ['shipping', 'shipping_cost']),
  };
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

function setProductField({
  currentProduct,
  fieldName,
  value,
}: {
  currentProduct: Record<string, string | undefined>;
  fieldName: string;
  value: string;
}): void {
  const normalizedFieldName = normalizeLookupKey(fieldName);

  if (!normalizedFieldName || currentProduct[normalizedFieldName]) {
    return;
  }

  currentProduct[normalizedFieldName] = value;
}

export async function* parseRakutenLegoProductFeedXmlStream(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
  options?: {
    maxProducts?: number;
    onParseFailure?: () => void;
  },
): AsyncGenerator<RakutenXmlProduct> {
  const parser = new SaxesParser({
    xmlns: false,
  });
  const productQueue: RakutenXmlProduct[] = [];
  const pendingErrors: Error[] = [];
  const path: string[] = [];
  let currentProduct: Record<string, string | undefined> | undefined;
  let currentText = '';
  let productCount = 0;
  let shouldStop = false;
  let parserEnded = false;

  parser.on('opentag', (tag: SaxesTagPlain) => {
    const tagName = tag.name;
    path.push(tagName);
    currentText = '';

    if (shouldStop) {
      return;
    }

    if (!currentProduct && PRODUCT_TAG_NAMES.has(normalizeLookupKey(tagName))) {
      currentProduct = {};

      for (const [attributeName, attributeValue] of Object.entries(
        tag.attributes,
      )) {
        const value = readString(attributeValue);

        if (value) {
          setProductField({
            currentProduct,
            fieldName: attributeName,
            value,
          });
        }
      }
    } else if (currentProduct) {
      for (const [attributeName, attributeValue] of Object.entries(
        tag.attributes,
      )) {
        const value = readString(attributeValue);

        if (value) {
          setProductField({
            currentProduct,
            fieldName: `${tagName}_${attributeName}`,
            value,
          });
        }
      }
    }
  });
  parser.on('text', (text) => {
    if (!shouldStop) {
      currentText += text;
    }
  });
  parser.on('cdata', (text) => {
    if (!shouldStop) {
      currentText += text;
    }
  });
  parser.on('error', (error) => {
    options?.onParseFailure?.();
    pendingErrors.push(error);
  });
  parser.on('closetag', (tag) => {
    if (shouldStop) {
      path.pop();

      return;
    }

    const normalizedTagName = normalizeLookupKey(tag.name);
    const text = currentText.trim();

    try {
      if (currentProduct && text && !PRODUCT_TAG_NAMES.has(normalizedTagName)) {
        setProductField({
          currentProduct,
          fieldName: tag.name,
          value: text,
        });
      }

      if (currentProduct && PRODUCT_TAG_NAMES.has(normalizedTagName)) {
        productQueue.push(currentProduct);
        currentProduct = undefined;
        productCount += 1;

        if (options?.maxProducts && productCount >= options.maxProducts) {
          shouldStop = true;
        }
      }
    } catch {
      options?.onParseFailure?.();
    } finally {
      path.pop();
      currentText = '';
    }
  });
  parser.on('end', () => {
    parserEnded = true;
  });

  for await (const chunk of iterateTextChunks(chunks)) {
    if (!shouldStop) {
      parser.write(chunk);
    }

    while (productQueue.length > 0) {
      const product = productQueue.shift();

      if (product) {
        yield product;
      }
    }

    if (pendingErrors.length > 0) {
      throw pendingErrors[0];
    }
  }

  if (!parserEnded) {
    parser.close();
  }

  while (productQueue.length > 0) {
    const product = productQueue.shift();

    if (product) {
      yield product;
    }
  }

  if (pendingErrors.length > 0) {
    throw pendingErrors[0];
  }
}

function toReadableStream(
  input: Buffer | NodeJS.ReadableStream | string,
): Readable {
  if (Buffer.isBuffer(input) || typeof input === 'string') {
    return Readable.from([input]);
  }

  return input instanceof Readable ? input : Readable.from(input);
}

async function downloadRakutenFeedXmlStream({
  config,
  createSftpClientFn,
  filename,
}: {
  config: RakutenLegoFeedConfig;
  createSftpClientFn: () => RakutenSftpClient;
  filename: string;
}): Promise<Readable> {
  const client = createSftpClientFn();

  await client.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30_000,
  });

  const output = new PassThrough();
  const remoteStream =
    typeof client.createReadStream === 'function'
      ? toReadableStream(client.createReadStream(filename))
      : toReadableStream(await client.get(filename));
  const gunzipStream = remoteStream.pipe(createGunzip());
  let closed = false;
  const closeClient = () => {
    if (closed) {
      return;
    }

    closed = true;
    void client.end().catch(() => undefined);
  };

  gunzipStream.on('error', (error) => {
    output.destroy(error);
    closeClient();
  });
  gunzipStream.on('end', closeClient);
  gunzipStream.on('close', closeClient);
  remoteStream.on('error', (error) => {
    output.destroy(error);
    closeClient();
  });

  return gunzipStream.pipe(output);
}

export async function listRakutenLegoFeedFiles({
  dependencies,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies;
} = {}): Promise<RakutenSftpListResult> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const config = getRakutenLegoFeedConfigFn();
  const client = createSftpClientFn();
  const entries: RakutenSftpListEntry[] = [];
  const failures: RakutenSftpListFailure[] = [];
  const successfulPaths: string[] = [];
  let pwd: string | undefined;

  await client.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30_000,
  });

  try {
    if (typeof client.pwd === 'function') {
      try {
        pwd = await client.pwd();
      } catch {
        pwd = undefined;
      }
    }

    for (const listPath of buildRakutenListCandidatePaths(config)) {
      try {
        const listEntries = await client.list(listPath);
        successfulPaths.push(listPath);

        for (const entry of listEntries) {
          entries.push({
            listPath,
            modifyTime: entry.modifyTime,
            name: entry.name,
            path: joinRemotePath(
              listPath === '.' ? undefined : listPath,
              entry.name,
            ),
            size: entry.size,
            type: entry.type,
          });
        }
      } catch (error) {
        failures.push({
          message: getErrorMessage(error),
          path: listPath,
        });
      }
    }
  } finally {
    await client.end();
  }

  return {
    entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
    failures,
    pwd,
    successfulPaths,
  };
}

function buildDebugSample(product: RakutenXmlProduct): RakutenLegoDebugSample {
  return {
    normalizedRow: normalizeRakutenLegoProductToAffiliateFeedRow(product),
    rawAvailability: readRakutenAvailabilityText(product),
    rawCurrency: readRakutenCurrency(product),
    rawPrice: readProductField(product, ['price', 'sale_price', 'saleprice']),
    rawProductId: readProductField(product, [
      'product_id',
      'productid',
      'sku',
      'merchant_sku',
      'rakuten_product_id',
      'id',
    ]),
    rawTitle: readProductField(product, [
      'product_name',
      'productname',
      'name',
      'title',
      'product_title',
      'producttitle',
    ]),
    selectedLegoSetNumber: extractRakutenLegoSetNumberFromHumanFields(product),
    setNumberCandidateFields: buildHumanSetNumberCandidateFields(product),
  };
}

export async function syncRakutenLegoFeed({
  dependencies,
  options,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies;
  options?: RakutenLegoFeedSyncOptions;
} = {}): Promise<RakutenLegoFeedSyncResult> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getRakutenLegoFeedConfigFn();
  const filename = resolveRakutenLegoFeedRemotePath(config);
  const xmlStream = await downloadRakutenFeedXmlStream({
    config,
    createSftpClientFn,
    filename,
  });
  const rows: AlternateAffiliateFeedRow[] = [];
  const debugSamples: RakutenLegoDebugSample[] = [];
  let fetchedProductCount = 0;
  let legoCandidateCount = 0;
  let parseFailureCount = 0;

  for await (const product of parseRakutenLegoProductFeedXmlStream(xmlStream, {
    maxProducts: options?.maxProducts,
    onParseFailure: () => {
      parseFailureCount += 1;
    },
  })) {
    fetchedProductCount += 1;

    if (isStrictRakutenLegoSetCandidate(product)) {
      legoCandidateCount += 1;
    }

    if (
      options?.debugSamples &&
      options.debugSamples > 0 &&
      debugSamples.length < options.debugSamples
    ) {
      debugSamples.push(buildDebugSample(product));
    }

    rows.push(normalizeRakutenLegoProductToAffiliateFeedRow(product));
  }

  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'Rakuten',
      name: config.merchantName,
      notes: RAKUTEN_LEGO_MERCHANT_NOTES,
      slug: config.merchantSlug,
      sourceType: 'affiliate',
    } satisfies AffiliateFeedMerchantConfig,
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      persistDiscoveredSets: options?.persistDiscoveredSets ?? false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });
  const debugInfo =
    options?.debugSamples && options.debugSamples > 0
      ? {
          fetchedProductCount,
          legoCandidateCount,
          sampleCount: debugSamples.length,
          samples: debugSamples,
        }
      : undefined;

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount,
    legoCandidateCount,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
    parseFailureCount,
  };
}
