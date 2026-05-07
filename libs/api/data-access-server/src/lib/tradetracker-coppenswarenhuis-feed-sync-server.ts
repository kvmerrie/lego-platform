import {
  getTradeTrackerCoppenswarenhuisFeedConfig,
  type TradeTrackerCoppenswarenhuisFeedConfig,
} from '@lego-platform/shared/config';
import { XMLParser } from 'fast-xml-parser';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

const tradeTrackerXmlFeedParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  textNodeName: '#text',
  trimValues: true,
});

interface TradeTrackerCoppenswarenhuisXmlFeedProduct {
  additional: Record<string, string>;
  category?: string;
  description?: string;
  id?: string;
  imageUrl?: string;
  model?: string;
  name?: string;
  price?: number;
  priceCurrency?: string;
  productUrl?: string;
  shortDescription?: string;
}

export interface TradeTrackerCoppenswarenhuisFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getTradeTrackerCoppenswarenhuisFeedConfigFn?: typeof getTradeTrackerCoppenswarenhuisFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface TradeTrackerCoppenswarenhuisFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  discoverMissingSets?: boolean;
  dryRun?: boolean;
  maxProducts?: number;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export interface TradeTrackerCoppenswarenhuisDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  productId?: string;
  propertyKeys: readonly string[];
  rawCurrency?: string;
  rawPrice?: number;
  rawProductTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface TradeTrackerCoppenswarenhuisDebugInfo {
  fetchedProductCount: number;
  legoCandidateCount: number;
  sampleCount: number;
  samples: readonly TradeTrackerCoppenswarenhuisDebugSample[];
  uniquePropertyKeys: readonly string[];
}

export interface TradeTrackerCoppenswarenhuisFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: TradeTrackerCoppenswarenhuisDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
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

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return readString((value as Record<string, unknown>)['#text']);
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

  const normalizedValue = rawValue
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/\.(?=.*\.)/g, '.');
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

function toProperties(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return ensureArray((value as Record<string, unknown>)['property']).reduce<
    Record<string, string>
  >((properties, propertyValue) => {
    if (
      !propertyValue ||
      typeof propertyValue !== 'object' ||
      Array.isArray(propertyValue)
    ) {
      return properties;
    }

    const propertyRecord = propertyValue as Record<string, unknown>;
    const propertyName = readString(propertyRecord['name']);
    const propertyValueText = readString(propertyRecord['value']);

    if (propertyName && propertyValueText) {
      properties[normalizeLookupKey(propertyName)] = propertyValueText;
    }

    return properties;
  }, {});
}

function toCategory(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return readString(value);
  }

  const firstCategory = ensureArray(
    (value as Record<string, unknown>)['category'],
  )[0];

  if (
    !firstCategory ||
    typeof firstCategory !== 'object' ||
    Array.isArray(firstCategory)
  ) {
    return readString(firstCategory);
  }

  const categoryRecord = firstCategory as Record<string, unknown>;

  return (
    readString(categoryRecord['#text']) ?? readString(categoryRecord['path'])
  );
}

function toImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return readString(value);
  }

  return readString(
    ensureArray((value as Record<string, unknown>)['image'])[0],
  );
}

function toFeedProduct(
  value: unknown,
): TradeTrackerCoppenswarenhuisXmlFeedProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TradeTracker Coppenswarenhuis feed product is invalid.');
  }

  const record = value as Record<string, unknown>;
  const priceValue = record['price'];
  const priceRecord =
    priceValue && typeof priceValue === 'object' && !Array.isArray(priceValue)
      ? (priceValue as Record<string, unknown>)
      : undefined;
  const additional = toProperties(record['properties']);

  return {
    additional,
    category: toCategory(record['categories']),
    description: readString(record['description']),
    id: readString(record['ID']),
    imageUrl: toImageUrl(record['images']),
    model:
      readString(record['model']) ??
      pickAdditionalField(additional, ['model', 'mpn']),
    name: readString(record['name']),
    price: readDecimal(priceValue),
    priceCurrency: readString(priceRecord?.['currency']),
    productUrl: readString(record['URL']),
    shortDescription:
      readString(record['shortDescription']) ??
      readString(record['short_description']),
  };
}

export function parseTradeTrackerCoppenswarenhuisProductFeedXml(
  xml: string,
  options: {
    maxProducts?: number;
  } = {},
): readonly TradeTrackerCoppenswarenhuisXmlFeedProduct[] {
  const parsedXml = tradeTrackerXmlFeedParser.parse(xml) as Record<
    string,
    unknown
  >;
  const productsNode = parsedXml['products'];

  if (
    !productsNode ||
    typeof productsNode !== 'object' ||
    Array.isArray(productsNode)
  ) {
    throw new Error(
      'TradeTracker Coppenswarenhuis feed XML is missing a products root.',
    );
  }

  const products = ensureArray(
    (productsNode as Record<string, unknown>)['product'],
  ).map(toFeedProduct);

  return options.maxProducts && options.maxProducts > 0
    ? products.slice(0, options.maxProducts)
    : products;
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

function isLegoContext(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): boolean {
  return /\blego\b/iu.test(
    normalizeSearchText(
      [
        product.name,
        product.model,
        product.shortDescription,
        stripHtml(product.description),
        product.category,
        pickAdditionalField(product.additional, ['brand', 'merk']),
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' '),
    ),
  );
}

function isNonConstructionLegoProduct(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): boolean {
  const text = normalizeSearchText(
    [
      product.name,
      product.model,
      product.shortDescription,
      stripHtml(product.description),
      product.category,
      pickAdditionalField(product.additional, ['brand', 'merk']),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' '),
  );

  return /\b(nintendo switch|playstation|ps5|xbox|videogame|software|game|boek|book|boeken|kleding|shirt|pyjama|rugzak|tas|beker|drinkfles|sleutelhanger|keychain|watch|horloge|lamp|storage|opberg|etui|puzzel|puzzle)\b/iu.test(
    text,
  );
}

function normalizeBrand(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
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
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): string | undefined {
  if (!isLegoContext(product) || isNonConstructionLegoProduct(product)) {
    return undefined;
  }

  return (
    canonicalizeExplicitSetNumber(product.model) ??
    extractFiveDigitSetNumbers(product.name)[0] ??
    extractFiveDigitSetNumbers(product.model)[0] ??
    extractFiveDigitSetNumbers(product.shortDescription)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0]
  );
}

function resolvePrice(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): number | undefined {
  return (
    readDecimal(pickAdditionalField(product.additional, ['lowestprice'])) ??
    product.price ??
    readDecimal(pickAdditionalField(product.additional, ['fromprice']))
  );
}

function resolveCurrency(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): string | undefined {
  return (
    product.priceCurrency?.trim().toUpperCase() ||
    pickAdditionalField(product.additional, ['currency', 'valuta'])
      ?.trim()
      .toUpperCase() ||
    (typeof resolvePrice(product) === 'number' ? 'EUR' : undefined)
  );
}

function normalizeAvailability(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): string | undefined {
  const stockValue = pickAdditionalField(product.additional, [
    'stock',
    'stocklevel',
    'instock',
    'voorraad',
  ]);

  if (stockValue) {
    const normalizedStock = normalizeSearchText(stockValue);
    const stockNumber = Number(stockValue);

    if (
      ['true', 'yes', 'ja', '1'].includes(normalizedStock) ||
      (Number.isFinite(stockNumber) && stockNumber > 0)
    ) {
      return 'In stock';
    }

    if (
      ['false', 'no', 'nee', '0'].includes(normalizedStock) ||
      normalizedStock.includes('niet op voorraad') ||
      normalizedStock.includes('out of stock')
    ) {
      return 'Out of stock';
    }

    return stockValue;
  }

  return pickAdditionalField(product.additional, [
    'availability',
    'availabilitytext',
    'stockstatus',
  ]);
}

function buildSetNumberCandidateFields(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
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

  if (product.productUrl) {
    candidateFields.productUrlIgnored = product.productUrl;
  }

  if (product.id) {
    candidateFields.productIdIgnored = product.id;
  }

  for (const ignoredField of ['ean', 'ean13', 'gtin', 'barcode', 'sku']) {
    const ignoredValue = pickAdditionalField(product.additional, [
      ignoredField,
    ]);

    if (ignoredValue) {
      candidateFields[`property.${ignoredField}Ignored`] = ignoredValue;
    }
  }

  return candidateFields;
}

export function normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
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
    productId: product.id,
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
  products,
  sampleLimit,
}: {
  products: readonly TradeTrackerCoppenswarenhuisXmlFeedProduct[];
  sampleLimit?: number;
}): TradeTrackerCoppenswarenhuisDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isLegoContext);
  const uniquePropertyKeys = [
    ...new Set(
      legoCandidates.flatMap((product) => Object.keys(product.additional)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<TradeTrackerCoppenswarenhuisDebugSample>((product) => ({
      normalizedRow:
        normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow(
          product,
        ),
      productId: product.id,
      propertyKeys: Object.keys(product.additional).sort((left, right) =>
        left.localeCompare(right),
      ),
      rawCurrency: product.priceCurrency,
      rawPrice: product.price,
      rawProductTitle: product.name,
      selectedLegoSetNumber: resolveSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    sampleCount: samples.length,
    samples,
    uniquePropertyKeys,
  };
}

async function fetchProducts({
  config,
  fetchFn,
  maxProducts,
}: {
  config: TradeTrackerCoppenswarenhuisFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
}): Promise<readonly TradeTrackerCoppenswarenhuisXmlFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `TradeTracker Coppenswarenhuis feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseTradeTrackerCoppenswarenhuisProductFeedXml(
    await response.text(),
    {
      maxProducts,
    },
  );
}

export async function syncTradeTrackerCoppenswarenhuisFeed({
  dependencies,
  options,
}: {
  dependencies?: TradeTrackerCoppenswarenhuisFeedSyncDependencies;
  options?: TradeTrackerCoppenswarenhuisFeedSyncOptions;
} = {}): Promise<TradeTrackerCoppenswarenhuisFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getTradeTrackerCoppenswarenhuisFeedConfigFn =
    dependencies?.getTradeTrackerCoppenswarenhuisFeedConfigFn ??
    getTradeTrackerCoppenswarenhuisFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getTradeTrackerCoppenswarenhuisFeedConfigFn();
  const rawProducts = await fetchProducts({
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
  });
  const legoCandidates = rawProducts.filter(isLegoContext);
  const nonConstructionLegoProducts = legoCandidates.filter(
    isNonConstructionLegoProduct,
  );
  const constructionCandidates = legoCandidates.filter(
    (product) => !isNonConstructionLegoProduct(product),
  );
  const missingSetNumberProductCount = constructionCandidates.filter(
    (product) => !resolveSetNumber(product),
  ).length;
  const rows = constructionCandidates
    .map(normalizeTradeTrackerCoppenswarenhuisFeedProductToAffiliateFeedRow)
    .filter((row) => Boolean(row.legoSetNumber));
  const debugInfo = buildDebugInfo({
    products: rawProducts,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'TradeTracker',
      name: config.merchantName,
      notes:
        'Feed-driven merchant. Current offer state is imported from the Coppenswarenhuis TradeTracker product feed.',
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
    legoCandidateCount: legoCandidates.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (rawProducts.length - legoCandidates.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount + nonConstructionLegoProducts.length,
  };
}
