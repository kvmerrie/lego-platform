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
  collectStaleLatestDiagnostics?: boolean;
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
  availabilityRawCounts: Record<string, number>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  normalizedAvailabilityCounts: Record<string, number>;
  sampleCount: number;
  samples: readonly TradeTrackerCoppenswarenhuisDebugSample[];
  unknownAfterMappingCount: number;
  uniquePropertyKeys: readonly string[];
}

export interface TradeTrackerCoppenswarenhuisFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  availabilityRawCounts: Record<string, number>;
  debugInfo?: TradeTrackerCoppenswarenhuisDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedAvailabilityCounts: Record<string, number>;
  normalizedRowCount: number;
  unknownAfterMappingCount: number;
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

    if (propertyName) {
      properties[normalizeLookupKey(propertyName)] = propertyValueText ?? '';
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

const coppensAvailabilityFieldAliases = [
  'availability',
  'availabilitytext',
  'beschikbaarheid',
  'delivery',
  'deliverytext',
  'deliverytime',
  'instock',
  'levertijd',
  'leverbaarheid',
  'stock',
  'stocklevel',
  'stockstatus',
  'voorraad',
] as const;

function normalizeCoppensAvailabilityText(
  availabilityText?: string,
): string | undefined {
  const normalizedValue = normalizeSearchText(availabilityText);

  if (!normalizedValue) {
    return undefined;
  }

  if (
    ['0', 'false', 'nee', 'no', 'n', 'niet', 'uitverkocht'].includes(
      normalizedValue,
    ) ||
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
    /\b(op voorraad|in stock|direct leverbaar|voorraad|voorradig|beschikbaar)\b/iu.test(
      normalizedValue,
    )
  ) {
    return 'In stock';
  }

  return undefined;
}

function hasCompleteCoppensFeedOffer(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): boolean {
  return Boolean(
    product.productUrl &&
      typeof resolvePrice(product) === 'number' &&
      resolveCurrency(product) === 'EUR' &&
      pickAdditionalField(product.additional, ['fromprice']),
  );
}

function resolveAvailabilityRawValue(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): string | undefined {
  const explicitAvailabilityValue = readAdditionalField(
    product.additional,
    coppensAvailabilityFieldAliases,
  );

  if (explicitAvailabilityValue !== undefined) {
    return explicitAvailabilityValue;
  }

  return hasCompleteCoppensFeedOffer(product)
    ? '__feed_product_present__'
    : undefined;
}

function normalizeAvailability(
  product: TradeTrackerCoppenswarenhuisXmlFeedProduct,
): string | undefined {
  const explicitAvailabilityValue = readAdditionalField(
    product.additional,
    coppensAvailabilityFieldAliases,
  );

  if (explicitAvailabilityValue !== undefined) {
    return normalizeCoppensAvailabilityText(explicitAvailabilityValue);
  }

  return hasCompleteCoppensFeedOffer(product) ? 'In stock' : undefined;
}

function incrementCount(counts: Record<string, number>, value?: string): void {
  const key = value?.trim() || 'missing';

  counts[key] = (counts[key] ?? 0) + 1;
}

function buildAvailabilityDebugCounts(
  products: readonly TradeTrackerCoppenswarenhuisXmlFeedProduct[],
): {
  availabilityRawCounts: Record<string, number>;
  normalizedAvailabilityCounts: Record<string, number>;
  unknownAfterMappingCount: number;
} {
  const availabilityRawCounts: Record<string, number> = {};
  const normalizedAvailabilityCounts: Record<string, number> = {};

  for (const product of products) {
    const rawValue = resolveAvailabilityRawValue(product);
    const normalizedValue = normalizeAvailability(product);

    incrementCount(availabilityRawCounts, rawValue);
    incrementCount(normalizedAvailabilityCounts, normalizedValue);
  }

  return {
    availabilityRawCounts,
    normalizedAvailabilityCounts,
    unknownAfterMappingCount: normalizedAvailabilityCounts['missing'] ?? 0,
  };
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
  availabilityRawCounts,
  normalizedAvailabilityCounts,
  products,
  sampleLimit,
  unknownAfterMappingCount,
}: {
  availabilityRawCounts: Record<string, number>;
  normalizedAvailabilityCounts: Record<string, number>;
  products: readonly TradeTrackerCoppenswarenhuisXmlFeedProduct[];
  sampleLimit?: number;
  unknownAfterMappingCount: number;
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
    availabilityRawCounts,
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    normalizedAvailabilityCounts,
    sampleCount: samples.length,
    samples,
    unknownAfterMappingCount,
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
  const constructionProductsWithSetNumber = constructionCandidates.filter(
    (product) => Boolean(resolveSetNumber(product)),
  );
  const availabilityDebugCounts = buildAvailabilityDebugCounts(
    constructionProductsWithSetNumber,
  );
  const debugInfo = buildDebugInfo({
    availabilityRawCounts: availabilityDebugCounts.availabilityRawCounts,
    normalizedAvailabilityCounts:
      availabilityDebugCounts.normalizedAvailabilityCounts,
    products: rawProducts,
    sampleLimit: options?.debugSamples,
    unknownAfterMappingCount: availabilityDebugCounts.unknownAfterMappingCount,
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
      ...(options?.collectStaleLatestDiagnostics === undefined
        ? {}
        : {
            collectStaleLatestDiagnostics:
              options.collectStaleLatestDiagnostics,
          }),
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    ...importResult,
    availabilityRawCounts: availabilityDebugCounts.availabilityRawCounts,
    debugInfo,
    fetchedProductCount: rawProducts.length,
    legoCandidateCount: legoCandidates.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedAvailabilityCounts:
      availabilityDebugCounts.normalizedAvailabilityCounts,
    normalizedRowCount: rows.length,
    unknownAfterMappingCount: availabilityDebugCounts.unknownAfterMappingCount,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (rawProducts.length - legoCandidates.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount + nonConstructionLegoProducts.length,
  };
}
