import {
  getTradeTrackerLidlFeedConfig,
  type TradeTrackerLidlFeedConfig,
} from '@lego-platform/shared/config';
import { XMLParser } from 'fast-xml-parser';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

const tradeTrackerXmlFeedParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  textNodeName: '#text',
  trimValues: true,
});

export interface TradeTrackerLidlFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getTradeTrackerLidlFeedConfigFn?: typeof getTradeTrackerLidlFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface TradeTrackerLidlFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  unmatchedSampleLimit?: number;
}

interface TradeTrackerXmlFeedProduct {
  additional: Record<string, string>;
  campaignId?: string;
  category?: string;
  description?: string;
  id?: string;
  imageUrl?: string;
  name?: string;
  price?: number;
  priceCurrency?: string;
  productUrl?: string;
}

export interface TradeTrackerLidlDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  productId?: string;
  propertyKeys: readonly string[];
  rawCurrency?: string;
  rawPrice?: number;
  rawProductTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
  titleNumberCandidates: readonly string[];
}

export interface TradeTrackerLidlDebugInfo {
  aggregatedProductCount: number;
  rawRowCount: number;
  sampleCount: number;
  samples: readonly TradeTrackerLidlDebugSample[];
  uniquePropertyKeys: readonly string[];
}

export interface TradeTrackerLidlFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  aggregatedProductCount: number;
  debugInfo?: TradeTrackerLidlDebugInfo;
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

  const record = value as Record<string, unknown>;

  return readString(record['#text']);
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

function readDecimal(value: unknown): number | undefined {
  const rawValue = readString(value);

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue.replace(',', '.'));

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function toTradeTrackerXmlProperties(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const propertiesValue = (value as Record<string, unknown>)['property'];

  return ensureArray(propertiesValue).reduce<Record<string, string>>(
    (properties, propertyValue) => {
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

      if (!propertyName || !propertyValueText) {
        return properties;
      }

      properties[normalizeLookupKey(propertyName)] = propertyValueText;

      return properties;
    },
    {},
  );
}

function toTradeTrackerXmlCategory(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return readString(value);
  }

  const categoriesRecord = value as Record<string, unknown>;
  const categoryValue = categoriesRecord['category'];
  const firstCategory = ensureArray(categoryValue)[0];

  if (
    !firstCategory ||
    typeof firstCategory !== 'object' ||
    Array.isArray(firstCategory)
  ) {
    return readString(firstCategory);
  }

  return (
    readString((firstCategory as Record<string, unknown>)['#text']) ??
    readString((firstCategory as Record<string, unknown>)['path'])
  );
}

function toTradeTrackerXmlImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return readString(value);
  }

  const imagesRecord = value as Record<string, unknown>;
  const imageValue = imagesRecord['image'];
  const firstImage = ensureArray(imageValue)[0];

  return readString(firstImage);
}

function toTradeTrackerXmlFeedProduct(
  value: unknown,
): TradeTrackerXmlFeedProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TradeTracker Lidl feed product is invalid.');
  }

  const record = value as Record<string, unknown>;
  const priceValue = record['price'];
  const priceRecord =
    priceValue && typeof priceValue === 'object' && !Array.isArray(priceValue)
      ? (priceValue as Record<string, unknown>)
      : undefined;

  return {
    additional: toTradeTrackerXmlProperties(record['properties']),
    campaignId: readString(record['campaignID']),
    category: toTradeTrackerXmlCategory(record['categories']),
    description: readString(record['description']),
    id: readString(record['ID']),
    imageUrl: toTradeTrackerXmlImageUrl(record['images']),
    name: readString(record['name']),
    price: readDecimal(priceValue),
    priceCurrency: readString(priceRecord?.['currency']),
    productUrl: readString(record['URL']),
  };
}

export function aggregateTradeTrackerLidlFeedProducts(
  products: readonly TradeTrackerXmlFeedProduct[],
): readonly TradeTrackerXmlFeedProduct[] {
  const aggregatedProductsById = new Map<string, TradeTrackerXmlFeedProduct>();

  for (const [index, product] of products.entries()) {
    const aggregateKey = product.id?.trim() || `__row_${index}`;
    const existingProduct = aggregatedProductsById.get(aggregateKey);

    if (!existingProduct) {
      aggregatedProductsById.set(aggregateKey, {
        ...product,
        additional: {
          ...product.additional,
        },
      });
      continue;
    }

    aggregatedProductsById.set(aggregateKey, {
      id: existingProduct.id ?? product.id,
      campaignId: existingProduct.campaignId ?? product.campaignId,
      category: existingProduct.category ?? product.category,
      description: existingProduct.description ?? product.description,
      imageUrl: existingProduct.imageUrl ?? product.imageUrl,
      name: existingProduct.name ?? product.name,
      price: existingProduct.price ?? product.price,
      priceCurrency: existingProduct.priceCurrency ?? product.priceCurrency,
      productUrl: existingProduct.productUrl ?? product.productUrl,
      additional: {
        ...existingProduct.additional,
        ...Object.fromEntries(
          Object.entries(product.additional).filter(
            ([propertyKey, propertyValue]) =>
              !existingProduct.additional[propertyKey] &&
              Boolean(propertyValue),
          ),
        ),
      },
    });
  }

  return [...aggregatedProductsById.values()];
}

export function parseTradeTrackerLidlProductFeedXml(
  xml: string,
): readonly TradeTrackerXmlFeedProduct[] {
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
    throw new Error('TradeTracker Lidl feed XML is missing a products root.');
  }

  const productValue = (productsNode as Record<string, unknown>)['product'];

  return ensureArray(productValue).map(toTradeTrackerXmlFeedProduct);
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

function isLegoText(value?: string): boolean {
  return /\blego\b/i.test(normalizeSearchText(value));
}

function normalizeLidlBrand(
  product: TradeTrackerXmlFeedProduct,
): string | undefined {
  const explicitBrand = pickAdditionalField(product.additional, [
    'brand',
    'merk',
  ]);

  if (explicitBrand) {
    return normalizeSearchText(explicitBrand).startsWith('lego')
      ? 'LEGO'
      : explicitBrand;
  }

  return isLegoText(product.name) ? 'LEGO' : undefined;
}

function extractStandaloneFiveDigitNumbers(value?: string): string[] {
  const matches = value?.match(/\b\d{5}\b/g) ?? [];

  return [...new Set(matches.map((match) => match.trim()))];
}

function extractUrlPathFiveDigitNumbers(url?: string): string[] {
  if (!url) {
    return [];
  }

  try {
    const parsedUrl = new URL(url);
    const rawProductUrl =
      parsedUrl.searchParams.get('u') ??
      parsedUrl.searchParams.get('url') ??
      parsedUrl.toString();
    const decodedPath = decodeURIComponent(
      (() => {
        try {
          return new URL(rawProductUrl).pathname;
        } catch {
          return rawProductUrl;
        }
      })(),
    );

    return extractStandaloneFiveDigitNumbers(decodedPath);
  } catch {
    return extractStandaloneFiveDigitNumbers(url);
  }
}

function normalizeExplicitSetNumberCandidate(
  value?: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const exactSourceStyleMatch = value.trim().match(/\b\d{5}(?:-\d+)?\b/u);

  return exactSourceStyleMatch?.[0];
}

function getLidlTitleNumberCandidates(
  product: TradeTrackerXmlFeedProduct,
): readonly string[] {
  return extractStandaloneFiveDigitNumbers(product.name);
}

function resolveLidlSetNumber(
  product: TradeTrackerXmlFeedProduct,
): string | undefined {
  const explicitSetNumber = normalizeExplicitSetNumberCandidate(
    pickAdditionalField(product.additional, [
      'mpn',
      'legosetnumber',
      'setnumber',
      'setnr',
      'legosetid',
      'productnumber',
      'productnr',
      'artikelnummer',
      'articlenumber',
      'itemnumber',
      'sku',
      'modelnumber',
    ]),
  );

  if (explicitSetNumber) {
    return explicitSetNumber;
  }

  if (
    !isLegoText(product.name) &&
    !isLegoText(product.description) &&
    normalizeSearchText(
      pickAdditionalField(product.additional, ['brand', 'merk']),
    ).startsWith('lego') === false
  ) {
    return undefined;
  }

  return (
    getLidlTitleNumberCandidates(product)[0] ??
    extractUrlPathFiveDigitNumbers(product.productUrl)[0] ??
    extractStandaloneFiveDigitNumbers(product.description)[0]
  );
}

function resolveLidlPrice(
  product: TradeTrackerXmlFeedProduct,
): number | undefined {
  const lowestPrice = readDecimal(
    pickAdditionalField(product.additional, ['lowestprice']),
  );
  const fromPrice = readDecimal(
    pickAdditionalField(product.additional, ['fromprice']),
  );

  return lowestPrice ?? product.price ?? fromPrice;
}

function normalizeStockAvailability(
  product: TradeTrackerXmlFeedProduct,
): string | undefined {
  const stockValue = pickAdditionalField(product.additional, ['stock']);

  if (stockValue) {
    const parsedStock = Number(stockValue);

    if (Number.isFinite(parsedStock) && parsedStock > 0) {
      return 'In stock';
    }

    if (!Number.isFinite(parsedStock)) {
      return stockValue;
    }
  }

  const stockText = pickAdditionalField(product.additional, [
    'availability',
    'availabilitytext',
    'stockstatus',
    'voorraad',
  ]);

  if (stockText) {
    return stockText;
  }

  return undefined;
}

function buildSetNumberCandidateFields(
  product: TradeTrackerXmlFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  for (const [propertyKey, propertyValue] of Object.entries(
    product.additional,
  )) {
    if (
      /(mpn|set|number|nummer|sku|item|article|artikel|product|model|ean|gtin|code|id)$/i.test(
        propertyKey,
      )
    ) {
      candidateFields[`property.${propertyKey}`] = propertyValue;
    }
  }

  if (product.id) {
    candidateFields['topLevel.productId'] = product.id;
  }

  for (const [index, candidate] of getLidlTitleNumberCandidates(
    product,
  ).entries()) {
    candidateFields[`title.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractStandaloneFiveDigitNumbers(
    product.description,
  ).entries()) {
    candidateFields[`description.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractUrlPathFiveDigitNumbers(
    product.productUrl,
  ).entries()) {
    candidateFields[`url.numberCandidate${index + 1}`] = candidate;
  }

  return candidateFields;
}

export function normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(
  product: TradeTrackerXmlFeedProduct,
): AlternateAffiliateFeedRow {
  const currency =
    product.priceCurrency?.trim().toUpperCase() ??
    (typeof resolveLidlPrice(product) === 'number' ? 'EUR' : undefined);

  return {
    affiliateDeeplink: product.productUrl ?? '',
    availabilityText: normalizeStockAvailability(product),
    brand: normalizeLidlBrand(product),
    category:
      product.category ??
      pickAdditionalField(product.additional, ['category', 'categorie']),
    condition: pickAdditionalField(product.additional, [
      'condition',
      'conditie',
      'staat',
    ]),
    currency,
    description: product.description,
    ean: pickAdditionalField(product.additional, [
      'ean',
      'ean13',
      'gtin',
      'barcode',
    ]),
    imageUrl: product.imageUrl,
    legoSetNumber: resolveLidlSetNumber(product),
    price: resolveLidlPrice(product),
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

function buildTradeTrackerLidlDebugInfo({
  aggregatedProducts,
  rawRowCount,
  sampleLimit,
}: {
  aggregatedProducts: readonly TradeTrackerXmlFeedProduct[];
  rawRowCount: number;
  sampleLimit?: number;
}): TradeTrackerLidlDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const uniquePropertyKeys = [
    ...new Set(
      aggregatedProducts.flatMap((product) => Object.keys(product.additional)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const samples = aggregatedProducts
    .slice(0, sampleLimit)
    .map<TradeTrackerLidlDebugSample>((product) => ({
      normalizedRow:
        normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow(product),
      productId: product.id,
      propertyKeys: Object.keys(product.additional).sort((left, right) =>
        left.localeCompare(right),
      ),
      rawCurrency: product.priceCurrency,
      rawPrice: product.price,
      rawProductTitle: product.name,
      selectedLegoSetNumber: resolveLidlSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
      titleNumberCandidates: getLidlTitleNumberCandidates(product),
    }));

  return {
    aggregatedProductCount: aggregatedProducts.length,
    rawRowCount,
    sampleCount: samples.length,
    samples,
    uniquePropertyKeys,
  };
}

async function fetchTradeTrackerLidlFeedProducts({
  config,
  fetchFn,
}: {
  config: TradeTrackerLidlFeedConfig;
  fetchFn: typeof fetch;
}): Promise<readonly TradeTrackerXmlFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `TradeTracker Lidl feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseTradeTrackerLidlProductFeedXml(await response.text());
}

export async function syncTradeTrackerLidlFeed({
  dependencies,
  options,
}: {
  dependencies?: TradeTrackerLidlFeedSyncDependencies;
  options?: TradeTrackerLidlFeedSyncOptions;
} = {}): Promise<TradeTrackerLidlFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getTradeTrackerLidlFeedConfigFn =
    dependencies?.getTradeTrackerLidlFeedConfigFn ??
    getTradeTrackerLidlFeedConfig;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getTradeTrackerLidlFeedConfigFn();
  const rawProducts = await fetchTradeTrackerLidlFeedProducts({
    config,
    fetchFn,
  });
  const aggregatedProducts = aggregateTradeTrackerLidlFeedProducts(rawProducts);
  const rows = aggregatedProducts.map(
    normalizeTradeTrackerLidlFeedProductToAffiliateFeedRow,
  );
  const debugInfo = buildTradeTrackerLidlDebugInfo({
    aggregatedProducts,
    rawRowCount: rawProducts.length,
    sampleLimit: options?.debugSamples,
  });
  const importResult = await importAffiliateFeedRowsForMerchantFn({
    merchant: {
      affiliateNetwork: 'TradeTracker',
      name: config.merchantName,
      notes:
        'Feed-driven merchant. Current offer state is imported from the Lidl TradeTracker product feed.',
      slug: config.merchantSlug,
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    ...importResult,
    aggregatedProductCount: aggregatedProducts.length,
    debugInfo,
    fetchedProductCount: rawProducts.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
  };
}
