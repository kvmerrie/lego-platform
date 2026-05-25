import { Readable } from 'node:stream';
import {
  getBrickfeverFeedConfig,
  type BrickfeverFeedConfig,
} from '@lego-platform/shared/config';
import { SaxesParser } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface BrickfeverFeedProduct {
  ean?: string;
  legoSetId?: string;
  price?: string;
  stockQuantity?: string;
  stockStatus?: string;
  title?: string;
  url?: string;
}

export interface BrickfeverFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getBrickfeverFeedConfigFn?: typeof getBrickfeverFeedConfig;
  importFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface BrickfeverFeedSyncOptions {
  collectStaleLatestDiagnostics?: boolean;
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  unmatchedSampleLimit?: number;
}

export interface BrickfeverDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawEan?: string;
  rawLegoSetId?: string;
  rawPrice?: string;
  rawProductTitle?: string;
  rawStockQuantity?: string;
  rawStockStatus?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface BrickfeverDebugInfo {
  availabilityDistribution: Readonly<Record<string, number>>;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  parseFailureCount: number;
  sampleCount: number;
  samples: readonly BrickfeverDebugSample[];
}

export interface BrickfeverFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  availabilityDistribution: Readonly<Record<string, number>>;
  debugInfo?: BrickfeverDebugInfo;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
  parseFailureCount: number;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalizeExplicitSetNumber(value?: string): string | undefined {
  const exactMatch = value?.trim().match(/^(\d{5})(?:-\d+)?$/u);

  return exactMatch?.[1];
}

function isLegoContext(product: BrickfeverFeedProduct): boolean {
  return /\blego\b/iu.test(normalizeSearchText(product.title));
}

function isNonConstructionLegoProduct(product: BrickfeverFeedProduct): boolean {
  const text = normalizeSearchText(product.title);

  return /\b(nintendo switch|playstation|ps5|xbox|videogame|software|game|boek|book|boeken|kleding|shirt|pyjama|rugzak|tas|beker|drinkfles|sleutelhanger|keychain|watch|horloge|lamp|storage|opberg|etui|puzzel|puzzle|poster|kalender|calendar|minifigure display|display case)\b/iu.test(
    text,
  );
}

export function resolveBrickfeverSetNumber(
  product: BrickfeverFeedProduct,
): string | undefined {
  if (!isLegoContext(product) || isNonConstructionLegoProduct(product)) {
    return undefined;
  }

  return canonicalizeExplicitSetNumber(product.legoSetId);
}

function normalizeBrickfeverAvailability({
  stockQuantity,
  stockStatus,
}: Pick<BrickfeverFeedProduct, 'stockQuantity' | 'stockStatus'>):
  | string
  | undefined {
  const normalizedStockStatus = normalizeSearchText(stockStatus);
  const parsedStockQuantity =
    stockQuantity && Number.isFinite(Number(stockQuantity))
      ? Number(stockQuantity)
      : undefined;

  if (
    normalizedStockStatus.includes('niet op voorraad') ||
    normalizedStockStatus.includes('uitverkocht') ||
    normalizedStockStatus.includes('out of stock')
  ) {
    return 'Out of stock';
  }

  if (
    normalizedStockStatus.includes('op voorraad') ||
    normalizedStockStatus.includes('in stock') ||
    (parsedStockQuantity !== undefined && parsedStockQuantity > 0)
  ) {
    return 'In stock';
  }

  if (parsedStockQuantity === 0) {
    return 'Out of stock';
  }

  return stockStatus;
}

function buildSetNumberCandidateFields(
  product: BrickfeverFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  if (product.legoSetId) {
    candidateFields.legoSetId = product.legoSetId;
  }

  if (product.title) {
    candidateFields.titleIgnored = product.title;
  }

  if (product.url) {
    candidateFields.productUrlIgnored = product.url;
  }

  if (product.ean) {
    candidateFields.eanIgnored = product.ean;
  }

  return candidateFields;
}

export function normalizeBrickfeverFeedProductToFeedRow(
  product: BrickfeverFeedProduct,
): AlternateAffiliateFeedRow {
  const stockQuantity =
    product.stockQuantity && Number.isFinite(Number(product.stockQuantity))
      ? Number(product.stockQuantity)
      : undefined;

  return {
    affiliateDeeplink: product.url ?? '',
    availabilityText: normalizeBrickfeverAvailability(product),
    brand: isLegoContext(product) ? 'LEGO' : undefined,
    condition: 'new',
    currency: product.price ? 'EUR' : undefined,
    ean: product.ean,
    legoSetNumber: resolveBrickfeverSetNumber(product),
    price: product.price,
    productTitle: product.title,
    sourceMetadata: {
      source: 'brickfever-direct-feed',
      stockQuantity,
      stockStatus: product.stockStatus,
    },
  };
}

export async function parseBrickfeverProductFeedXmlStream({
  maxProducts,
  stream,
}: {
  maxProducts?: number;
  stream: NodeJS.ReadableStream;
}): Promise<readonly BrickfeverFeedProduct[]> {
  const products: BrickfeverFeedProduct[] = [];
  const parser = new SaxesParser({
    xmlns: false,
  });
  let currentProduct: Record<string, string> | undefined;
  let currentField: string | undefined;
  let currentText = '';

  parser.on('opentag', (node) => {
    const tagName = node.name;

    if (tagName === 'product') {
      currentProduct = {};
      return;
    }

    if (currentProduct) {
      currentField = tagName;
      currentText = '';
    }
  });
  parser.on('text', (text) => {
    if (currentProduct && currentField) {
      currentText += text;
    }
  });
  parser.on('cdata', (text) => {
    if (currentProduct && currentField) {
      currentText += text;
    }
  });
  parser.on('closetag', (node) => {
    const tagName = node.name;

    if (!currentProduct) {
      return;
    }

    if (tagName === 'product') {
      if (!maxProducts || products.length < maxProducts) {
        products.push(toBrickfeverFeedProduct(currentProduct));
      }

      currentProduct = undefined;
      currentField = undefined;
      currentText = '';
      return;
    }

    if (currentField === tagName) {
      const trimmedText = currentText.trim();

      if (trimmedText) {
        currentProduct[tagName] = trimmedText;
      }

      currentField = undefined;
      currentText = '';
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.on('error', reject);
    stream.on('data', (chunk: Buffer | string) => {
      parser.write(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
      resolve();
    });
  });

  return products;
}

function toBrickfeverFeedProduct(
  record: Record<string, string>,
): BrickfeverFeedProduct {
  return {
    ean: record['ean'],
    legoSetId: record['lego_set_id'],
    price: record['price'],
    stockQuantity: record['stock_quantity'],
    stockStatus: record['stock_status'],
    title: record['title'],
    url: record['url'],
  };
}

function countBy<T extends string | undefined>(
  values: readonly T[],
): Readonly<Record<string, number>> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = value?.trim() || 'unknown';

    counts[key] = (counts[key] ?? 0) + 1;

    return counts;
  }, {});
}

function getExcludedReason(product: BrickfeverFeedProduct): string | undefined {
  if (!isLegoContext(product)) {
    return 'non_lego';
  }

  if (isNonConstructionLegoProduct(product)) {
    return 'non_construction_lego';
  }

  if (!resolveBrickfeverSetNumber(product)) {
    return 'missing_or_invalid_lego_set_id';
  }

  return undefined;
}

function buildExcludedReasonCounts(
  products: readonly BrickfeverFeedProduct[],
): Readonly<Record<string, number>> {
  return countBy(products.map(getExcludedReason).filter(isNonEmptyString));
}

function buildDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly BrickfeverFeedProduct[];
  sampleLimit?: number;
}): BrickfeverDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isLegoContext);
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<BrickfeverDebugSample>((product) => ({
      normalizedRow: normalizeBrickfeverFeedProductToFeedRow(product),
      rawEan: product.ean,
      rawLegoSetId: product.legoSetId,
      rawPrice: product.price,
      rawProductTitle: product.title,
      rawStockQuantity: product.stockQuantity,
      rawStockStatus: product.stockStatus,
      selectedLegoSetNumber: resolveBrickfeverSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    availabilityDistribution: countBy(
      products.map((product) =>
        normalizeBrickfeverAvailability({
          stockQuantity: product.stockQuantity,
          stockStatus: product.stockStatus,
        }),
      ),
    ),
    excludedReasonCounts: buildExcludedReasonCounts(products),
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    parseFailureCount: 0,
    sampleCount: samples.length,
    samples,
  };
}

function responseBodyToNodeStream(response: Response): NodeJS.ReadableStream {
  if (!response.body) {
    throw new Error('Brickfever feed response did not include a body.');
  }

  return Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  );
}

async function fetchProducts({
  config,
  fetchFn,
  maxProducts,
}: {
  config: BrickfeverFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
}): Promise<readonly BrickfeverFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Brickfever feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseBrickfeverProductFeedXmlStream({
    maxProducts,
    stream: responseBodyToNodeStream(response),
  });
}

export async function syncBrickfeverFeed({
  dependencies,
  options,
}: {
  dependencies?: BrickfeverFeedSyncDependencies;
  options?: BrickfeverFeedSyncOptions;
} = {}): Promise<BrickfeverFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getBrickfeverFeedConfigFn =
    dependencies?.getBrickfeverFeedConfigFn ?? getBrickfeverFeedConfig;
  const importFeedRowsForMerchantFn =
    dependencies?.importFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getBrickfeverFeedConfigFn();
  const products = await fetchProducts({
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
  });
  const legoCandidates = products.filter(isLegoContext);
  const nonConstructionLegoProducts = legoCandidates.filter(
    isNonConstructionLegoProduct,
  );
  const constructionCandidates = legoCandidates.filter(
    (product) => !isNonConstructionLegoProduct(product),
  );
  const missingSetNumberProductCount = constructionCandidates.filter(
    (product) => !resolveBrickfeverSetNumber(product),
  ).length;
  const normalizedRows = constructionCandidates
    .map(normalizeBrickfeverFeedProductToFeedRow)
    .filter((row) => Boolean(row.legoSetNumber));
  const importResult = await importFeedRowsForMerchantFn({
    merchant: {
      slug: config.merchantSlug,
      name: config.merchantName,
      sourceType: 'direct',
      notes:
        'Feed-driven non-affiliate merchant. Current offer state is imported from the Brickfever product feed.',
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      persistDiscoveredSets: false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
      ...(options?.collectStaleLatestDiagnostics === undefined
        ? {}
        : {
            collectStaleLatestDiagnostics:
              options.collectStaleLatestDiagnostics,
          }),
    } satisfies AlternateAffiliateFeedImportOptions,
    rows: normalizedRows,
  });

  return {
    ...importResult,
    availabilityDistribution: countBy(
      products.map((product) =>
        normalizeBrickfeverAvailability({
          stockQuantity: product.stockQuantity,
          stockStatus: product.stockStatus,
        }),
      ),
    ),
    debugInfo: buildDebugInfo({
      products,
      sampleLimit: options?.debugSamples,
    }),
    excludedReasonCounts: buildExcludedReasonCounts(products),
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: normalizedRows.length,
    parseFailureCount: 0,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (products.length - legoCandidates.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount + nonConstructionLegoProducts.length,
  };
}
