import {
  getTradeTrackerConradFeedConfig,
  type TradeTrackerConradFeedConfig,
} from '@lego-platform/shared/config';
import { SaxesParser } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface TradeTrackerConradXmlFeedProduct {
  additional: Record<string, string>;
  category?: string;
  description?: string;
  id?: string;
  imageUrl?: string;
  name?: string;
  price?: number;
  priceCurrency?: string;
  productUrl?: string;
}

export interface TradeTrackerConradFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getTradeTrackerConradFeedConfigFn?: typeof getTradeTrackerConradFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface TradeTrackerConradFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  persistDiscoveredSets?: boolean;
  requestTimeoutMs?: number;
  unmatchedSampleLimit?: number;
}

export interface TradeTrackerConradDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  productId?: string;
  propertyKeys: readonly string[];
  rawCurrency?: string;
  rawPrice?: number;
  rawProductTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface TradeTrackerConradDebugInfo {
  availabilityRawCounts: Record<string, number>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  normalizedAvailabilityCounts: Record<string, number>;
  parseFailureCount: number;
  sampleCount: number;
  samples: readonly TradeTrackerConradDebugSample[];
  unknownAfterMappingCount: number;
  uniquePropertyKeys: readonly string[];
}

export interface TradeTrackerConradFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  availabilityRawCounts: Record<string, number>;
  debugInfo?: TradeTrackerConradDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedAvailabilityCounts: Record<string, number>;
  normalizedRowCount: number;
  parseFailureCount: number;
  unknownAfterMappingCount: number;
}

export interface TradeTrackerConradParserResult {
  parseFailureCount: number;
  productCount: number;
  products: readonly TradeTrackerConradXmlFeedProduct[];
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
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

function readDecimal(value: unknown): number | undefined {
  const rawValue = readString(value);

  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.replace(/\u00a0/g, ' ').replace(/\s/g, '');
  const lastCommaIndex = normalizedValue.lastIndexOf(',');
  const lastDotIndex = normalizedValue.lastIndexOf('.');
  const decimalValue =
    lastCommaIndex >= 0 && lastDotIndex >= 0
      ? lastCommaIndex > lastDotIndex
        ? normalizedValue.replace(/\./g, '').replace(',', '.')
        : normalizedValue.replace(/,/g, '')
      : lastCommaIndex >= 0
        ? normalizedValue.replace(/\./g, '').replace(',', '.')
        : normalizedValue;
  const parsedValue = Number(decimalValue);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : undefined;
}

function pickAdditionalField(
  additional: Record<string, string>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = additional[normalizeLookupKey(alias)];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readAdditionalField(
  additional: Record<string, string>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const key = normalizeLookupKey(alias);

    if (Object.prototype.hasOwnProperty.call(additional, key)) {
      return additional[key];
    }
  }

  return undefined;
}

function parseConradProductFeedChunked({
  collectProducts = true,
  chunks,
  maxProducts,
  onProduct,
}: {
  collectProducts?: boolean;
  chunks: Iterable<string> | AsyncIterable<string>;
  maxProducts?: number;
  onProduct?: (product: TradeTrackerConradXmlFeedProduct) => void;
}): Promise<TradeTrackerConradParserResult> {
  return new Promise((resolve, reject) => {
    const products: TradeTrackerConradXmlFeedProduct[] = [];
    const parser = new SaxesParser({
      xmlns: false,
    });
    const path: string[] = [];
    let currentProduct: TradeTrackerConradXmlFeedProduct | undefined;
    let currentText = '';
    let currentPropertyName: string | undefined;
    let currentPropertyValue: string | undefined;
    let parseFailureCount = 0;
    let productCount = 0;
    let shouldStop = false;

    parser.on('opentag', (tag) => {
      const tagName = tag.name;
      path.push(tagName);
      currentText = '';

      if (shouldStop) {
        return;
      }

      if (tagName === 'product' && path.length === 2) {
        currentProduct = {
          additional: {},
          id: readString(tag.attributes['ID']),
        };
        currentPropertyName = undefined;
        currentPropertyValue = undefined;
      }

      if (currentProduct && tagName === 'price' && path.length === 3) {
        currentProduct.priceCurrency = readString(tag.attributes['currency']);
      }

      if (currentProduct && tagName === 'category') {
        currentProduct.category ??= readString(tag.attributes['path']);
      }

      if (currentProduct && tagName === 'property') {
        currentPropertyName = readString(tag.attributes['name']);
        currentPropertyValue = undefined;
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
      reject(error);
    });
    parser.on('closetag', (tag) => {
      if (shouldStop) {
        path.pop();

        return;
      }

      const text = currentText.trim();
      const parentTag = path[path.length - 2];

      try {
        if (currentProduct && tag.name === 'name' && parentTag === 'product') {
          currentProduct.name = readString(text);
        } else if (
          currentProduct &&
          tag.name === 'price' &&
          parentTag === 'product'
        ) {
          currentProduct.price = readDecimal(text);
        } else if (
          currentProduct &&
          tag.name === 'URL' &&
          parentTag === 'product'
        ) {
          currentProduct.productUrl = readString(text);
        } else if (
          currentProduct &&
          tag.name === 'image' &&
          parentTag === 'images' &&
          !currentProduct.imageUrl
        ) {
          currentProduct.imageUrl = readString(text);
        } else if (
          currentProduct &&
          tag.name === 'description' &&
          parentTag === 'product'
        ) {
          currentProduct.description = readString(text);
        } else if (
          currentProduct &&
          tag.name === 'category' &&
          parentTag === 'categories'
        ) {
          currentProduct.category ??= readString(text);
        } else if (
          currentProduct &&
          tag.name === 'name' &&
          parentTag === 'property'
        ) {
          currentPropertyName = readString(text);
        } else if (
          currentProduct &&
          tag.name === 'value' &&
          parentTag === 'property'
        ) {
          currentPropertyValue = readString(text) ?? '';
        } else if (
          currentProduct &&
          tag.name === 'property' &&
          currentPropertyName
        ) {
          currentProduct.additional[normalizeLookupKey(currentPropertyName)] =
            currentPropertyValue ?? '';
          currentPropertyName = undefined;
          currentPropertyValue = undefined;
        } else if (tag.name === 'product' && currentProduct) {
          onProduct?.(currentProduct);

          if (collectProducts) {
            products.push(currentProduct);
          }

          productCount += 1;
          currentProduct = undefined;
          currentPropertyName = undefined;
          currentPropertyValue = undefined;

          if (maxProducts && productCount >= maxProducts) {
            shouldStop = true;
          }
        }
      } catch {
        parseFailureCount += 1;
      } finally {
        path.pop();
        currentText = '';
      }
    });
    parser.on('end', () => {
      resolve({
        parseFailureCount,
        productCount,
        products,
      });
    });

    void (async () => {
      try {
        for await (const chunk of chunks) {
          parser.write(chunk);
        }

        parser.close();
      } catch (error) {
        reject(error);
      }
    })();
  });
}

export async function parseTradeTrackerConradProductFeedXml(
  xml: string,
  options: {
    maxProducts?: number;
  } = {},
): Promise<TradeTrackerConradParserResult> {
  return parseConradProductFeedChunked({
    collectProducts: true,
    chunks: [xml],
    maxProducts: options.maxProducts,
  });
}

async function parseTradeTrackerConradProductFeedStream({
  body,
  collectProducts,
  maxProducts,
  onProduct,
}: {
  body: ReadableStream<Uint8Array>;
  collectProducts?: boolean;
  maxProducts?: number;
  onProduct?: (product: TradeTrackerConradXmlFeedProduct) => void;
}): Promise<TradeTrackerConradParserResult> {
  const decoder = new TextDecoder();

  async function* decodeChunks() {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      yield decoder.decode(chunk, {
        stream: true,
      });
    }

    const trailingText = decoder.decode();

    if (trailingText) {
      yield trailingText;
    }
  }

  return parseConradProductFeedChunked({
    collectProducts,
    chunks: decodeChunks(),
    maxProducts,
    onProduct,
  });
}

function isLegoContext(product: TradeTrackerConradXmlFeedProduct): boolean {
  const title = normalizeSearchText(product.name);
  const brand = normalizeSearchText(
    pickAdditionalField(product.additional, [
      'brand',
      'merk',
      'manufacturer',
      'vendor',
    ]),
  );

  return /\blego\b/iu.test(title) || brand.startsWith('lego');
}

function isNonConstructionLegoProduct(
  product: TradeTrackerConradXmlFeedProduct,
): boolean {
  const text = normalizeSearchText(
    [
      product.name,
      product.description,
      product.category,
      pickAdditionalField(product.additional, [
        'brand',
        'merk',
        'sku',
        'mpn',
        'subcategories',
        'categorypath',
      ]),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' '),
  );

  return /\b(acryl|boek|book|boeken|display case|display stand|displaystand|led|licht|lighting|losse stenen|loose parts|onderdelen|sleutelhanger|keychain|vitrine|stofkap|opberg|storage|minifiguur los|minifigure display|alternative brick|compatible bricks|cada|cobi|mould king)\b/iu.test(
    text,
  );
}

function normalizeBrand(
  product: TradeTrackerConradXmlFeedProduct,
): string | undefined {
  const explicitBrand = pickAdditionalField(product.additional, [
    'brand',
    'merk',
    'manufacturer',
    'vendor',
  ]);

  if (explicitBrand) {
    return normalizeSearchText(explicitBrand).startsWith('lego')
      ? 'LEGO'
      : explicitBrand;
  }

  return isLegoContext(product) ? 'LEGO' : undefined;
}

function extractFiveDigitSetNumbers(value?: string): readonly string[] {
  const matches =
    value?.match(/(?<!\d)(\d{5})(?:-\d+)?(?!\d)/gu)?.map((match) => {
      const [setNumber] = match.split('-', 1);

      return setNumber;
    }) ?? [];

  return [...new Set(matches)];
}

function canonicalizeExplicitSetNumber(value?: string): string | undefined {
  const exactMatch = value?.trim().match(/^(\d{5})(?:-\d+)?$/u);

  return exactMatch?.[1];
}

function resolveSetNumber(
  product: TradeTrackerConradXmlFeedProduct,
): string | undefined {
  if (!isLegoContext(product) || isNonConstructionLegoProduct(product)) {
    return undefined;
  }

  return (
    canonicalizeExplicitSetNumber(
      pickAdditionalField(product.additional, ['mpn', 'sku']),
    ) ??
    extractFiveDigitSetNumbers(product.name)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0] ??
    extractFiveDigitSetNumbers(
      pickAdditionalField(product.additional, ['categorypath']),
    )[0]
  );
}

function resolvePrice(
  product: TradeTrackerConradXmlFeedProduct,
): number | undefined {
  return (
    product.price ??
    readDecimal(pickAdditionalField(product.additional, ['lowestprice'])) ??
    readDecimal(pickAdditionalField(product.additional, ['fromprice']))
  );
}

function resolveCurrency(
  product: TradeTrackerConradXmlFeedProduct,
): string | undefined {
  return (
    product.priceCurrency?.trim().toUpperCase() ||
    pickAdditionalField(product.additional, ['currency', 'valuta'])
      ?.trim()
      .toUpperCase() ||
    (typeof resolvePrice(product) === 'number' ? 'EUR' : undefined)
  );
}

const conradAvailabilityFieldAliases = [
  'availability',
  'availabilitytext',
  'delivery',
  'deliverytext',
  'deliverytime',
  'instock',
  'leverbaarheid',
  'stock',
  'stockstatus',
  'voorraad',
] as const;

function normalizeConradAvailabilityText(
  availabilityText?: string,
): string | undefined {
  const normalizedValue = normalizeSearchText(availabilityText);

  if (!normalizedValue) {
    return undefined;
  }

  if (
    ['0', 'false', 'nee', 'no', 'n', 'uitverkocht'].includes(normalizedValue) ||
    /\b(geen voorraad|niet op voorraad|niet voorradig|out of stock|uitverkocht|tijdelijk niet leverbaar|niet leverbaar|niet beschikbaar)\b/iu.test(
      normalizedValue,
    )
  ) {
    return 'Out of stock';
  }

  if (
    /\b(pre-?order|voorbestel|voorbestelling|reserveren|verwacht|binnenkort)\b/iu.test(
      normalizedValue,
    )
  ) {
    return 'Preorder';
  }

  if (
    /\b(beperkte voorraad|limited stock|laatste stuks|laatste stuk|bijna uitverkocht|nog maar \d+)\b/iu.test(
      normalizedValue,
    )
  ) {
    return 'Limited stock';
  }

  const stockNumber = Number(availabilityText);

  if (
    ['1', 'true', 'yes', 'ja', 'y'].includes(normalizedValue) ||
    (Number.isFinite(stockNumber) && stockNumber > 0) ||
    /\b(leverbaar|op voorraad|in stock|direct leverbaar|voorraad|voorradig|beschikbaar)\b/iu.test(
      normalizedValue,
    )
  ) {
    return 'In stock';
  }

  return undefined;
}

function resolveAvailabilityRawValue(
  product: TradeTrackerConradXmlFeedProduct,
): string | undefined {
  return readAdditionalField(
    product.additional,
    conradAvailabilityFieldAliases,
  );
}

function normalizeAvailability(
  product: TradeTrackerConradXmlFeedProduct,
): string | undefined {
  return normalizeConradAvailabilityText(resolveAvailabilityRawValue(product));
}

function incrementCount(counts: Record<string, number>, value?: string): void {
  const key = value?.trim() || 'missing';

  counts[key] = (counts[key] ?? 0) + 1;
}

function buildSetNumberCandidateFields(
  product: TradeTrackerConradXmlFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  for (const field of ['mpn', 'sku', 'artikelnummer']) {
    const fieldValue = pickAdditionalField(product.additional, [field]);

    if (fieldValue) {
      candidateFields[`property.${field}`] = fieldValue;
    }
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.name,
  ).entries()) {
    candidateFields[`name.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    stripHtml(product.description),
  ).entries()) {
    candidateFields[`description.numberCandidate${index + 1}`] = candidate;
  }

  return candidateFields;
}

export function normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(
  product: TradeTrackerConradXmlFeedProduct,
): AlternateAffiliateFeedRow {
  return {
    affiliateDeeplink: product.productUrl ?? '',
    availabilityText: normalizeAvailability(product),
    brand: normalizeBrand(product),
    category:
      product.category ??
      pickAdditionalField(product.additional, ['category', 'categorie']),
    condition: 'new',
    currency: resolveCurrency(product),
    description: stripHtml(product.description),
    ean: pickAdditionalField(product.additional, [
      'ean',
      'ean13',
      'gtin',
      'barcode',
    ]),
    imageUrl: product.imageUrl,
    legoSetNumber: resolveSetNumber(product),
    price: resolvePrice(product),
    productId:
      product.id ??
      pickAdditionalField(product.additional, ['artikelnummer', 'sku']),
    productTitle: product.name,
    shippingCost: pickAdditionalField(product.additional, [
      'shippingcost',
      'shipping',
      'shippingprice',
      'deliverycosts',
      'deliverycost',
      'verzendkosten',
    ]),
  };
}

function buildDebugInfo({
  availabilityRawCounts,
  fetchedProductCount,
  legoCandidateCount,
  normalizedAvailabilityCounts,
  parseFailureCount,
  samples,
  sampleLimit,
  uniquePropertyKeys,
  unknownAfterMappingCount,
}: {
  availabilityRawCounts: Record<string, number>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  normalizedAvailabilityCounts: Record<string, number>;
  parseFailureCount: number;
  samples: readonly TradeTrackerConradDebugSample[];
  sampleLimit?: number;
  uniquePropertyKeys: ReadonlySet<string>;
  unknownAfterMappingCount: number;
}): TradeTrackerConradDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  return {
    availabilityRawCounts,
    fetchedProductCount,
    legoCandidateCount,
    normalizedAvailabilityCounts,
    parseFailureCount,
    sampleCount: samples.length,
    samples,
    unknownAfterMappingCount,
    uniquePropertyKeys: [...uniquePropertyKeys].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');

  if (!retryAfter) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfter);

  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : undefined;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProducts({
  collectProducts,
  config,
  fetchFn,
  maxProducts,
  onProduct,
  requestTimeoutMs = 45_000,
}: {
  collectProducts?: boolean;
  config: TradeTrackerConradFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
  onProduct?: (product: TradeTrackerConradXmlFeedProduct) => void;
  requestTimeoutMs?: number;
}): Promise<TradeTrackerConradParserResult> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

    try {
      const response = await fetchFn(config.feedUrl, {
        headers: {
          Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'gzip,br,deflate',
        },
        signal: abortController.signal,
      });

      if (
        !response.ok &&
        attempt < maxAttempts &&
        (response.status === 429 || response.status >= 500)
      ) {
        await wait(getRetryAfterMs(response) ?? attempt * 1500);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `TradeTracker Conrad feed request failed with ${response.status} ${response.statusText}.`,
        );
      }

      if (response.body) {
        return parseTradeTrackerConradProductFeedStream({
          body: response.body,
          collectProducts,
          maxProducts,
          onProduct,
        });
      }

      return parseConradProductFeedChunked({
        collectProducts,
        chunks: [await response.text()],
        maxProducts,
        onProduct,
      });
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      await wait(attempt * 1500);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('TradeTracker Conrad feed request failed.');
}

export async function syncTradeTrackerConradFeed({
  dependencies,
  options,
}: {
  dependencies?: TradeTrackerConradFeedSyncDependencies;
  options?: TradeTrackerConradFeedSyncOptions;
} = {}): Promise<TradeTrackerConradFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getTradeTrackerConradFeedConfigFn =
    dependencies?.getTradeTrackerConradFeedConfigFn ??
    getTradeTrackerConradFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getTradeTrackerConradFeedConfigFn();
  const rows: AlternateAffiliateFeedRow[] = [];
  const availabilityRawCounts: Record<string, number> = {};
  const normalizedAvailabilityCounts: Record<string, number> = {};
  const debugSamples: TradeTrackerConradDebugSample[] = [];
  const uniquePropertyKeys = new Set<string>();
  let legoCandidateCount = 0;
  let missingSetNumberProductCount = 0;
  let nonConstructionLegoProductCount = 0;

  const { parseFailureCount, productCount } = await fetchProducts({
    collectProducts: false,
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
    onProduct: (product) => {
      if (!isLegoContext(product)) {
        return;
      }

      legoCandidateCount += 1;

      for (const key of Object.keys(product.additional)) {
        uniquePropertyKeys.add(key);
      }

      if (
        options?.debugSamples &&
        options.debugSamples > 0 &&
        debugSamples.length < options.debugSamples
      ) {
        debugSamples.push({
          normalizedRow:
            normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(product),
          productId: product.id,
          propertyKeys: Object.keys(product.additional).sort((left, right) =>
            left.localeCompare(right),
          ),
          rawCurrency: product.priceCurrency,
          rawPrice: product.price,
          rawProductTitle: product.name,
          selectedLegoSetNumber: resolveSetNumber(product),
          setNumberCandidateFields: buildSetNumberCandidateFields(product),
        });
      }

      if (isNonConstructionLegoProduct(product)) {
        nonConstructionLegoProductCount += 1;

        return;
      }

      if (!resolveSetNumber(product)) {
        missingSetNumberProductCount += 1;

        return;
      }

      incrementCount(
        availabilityRawCounts,
        resolveAvailabilityRawValue(product),
      );
      incrementCount(
        normalizedAvailabilityCounts,
        normalizeAvailability(product),
      );
      rows.push(
        normalizeTradeTrackerConradFeedProductToAffiliateFeedRow(product),
      );
    },
    requestTimeoutMs: options?.requestTimeoutMs,
  });
  const unknownAfterMappingCount = normalizedAvailabilityCounts['missing'] ?? 0;
  const debugInfo = buildDebugInfo({
    availabilityRawCounts,
    fetchedProductCount: productCount,
    legoCandidateCount,
    normalizedAvailabilityCounts,
    parseFailureCount,
    samples: debugSamples,
    sampleLimit: options?.debugSamples,
    uniquePropertyKeys,
    unknownAfterMappingCount,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'TradeTracker',
      name: config.merchantName,
      notes:
        'Feed-driven merchant. Current offer state is imported from the Conrad TradeTracker product feed.',
      slug: config.merchantSlug,
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      persistDiscoveredSets: options?.persistDiscoveredSets ?? false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    ...importResult,
    availabilityRawCounts,
    debugInfo,
    fetchedProductCount: productCount,
    legoCandidateCount,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedAvailabilityCounts,
    normalizedRowCount: rows.length,
    parseFailureCount,
    unknownAfterMappingCount,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount + (productCount - legoCandidateCount),
    skippedNonNewCount:
      importResult.skippedNonNewCount + nonConstructionLegoProductCount,
  };
}
