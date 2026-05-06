import { Readable } from 'node:stream';
import {
  getMisterBricksFeedConfig,
  type MisterBricksFeedConfig,
} from '@lego-platform/shared/config';
import { SaxesParser } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface MisterBricksFeedProduct {
  availability?: string;
  category?: string;
  description?: string;
  ean?: string;
  imageUrl?: string;
  link?: string;
  model?: string;
  price?: string;
  shipping?: string;
  sku?: string;
  title?: string;
}

export interface MisterBricksFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getMisterBricksFeedConfigFn?: typeof getMisterBricksFeedConfig;
  importFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

export interface MisterBricksFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  unmatchedSampleLimit?: number;
}

export interface MisterBricksDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawEan?: string;
  rawPrice?: string;
  rawProductTitle?: string;
  rawSku?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface MisterBricksDebugInfo {
  fetchedProductCount: number;
  legoCandidateCount: number;
  sampleCount: number;
  samples: readonly MisterBricksDebugSample[];
}

export interface MisterBricksFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: MisterBricksDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isLegoContext(product: MisterBricksFeedProduct): boolean {
  return /\blego\b/iu.test(
    normalizeSearchText(
      [
        product.title,
        product.model,
        stripHtml(product.description),
        product.category,
      ]
        .filter(isNonEmptyString)
        .join(' '),
    ),
  );
}

function isNonConstructionLegoProduct(
  product: MisterBricksFeedProduct,
): boolean {
  const text = normalizeSearchText(
    [
      product.title,
      product.model,
      stripHtml(product.description),
      product.category,
    ]
      .filter(isNonEmptyString)
      .join(' '),
  );

  return /\b(nintendo switch|playstation|ps5|xbox|videogame|software|game|boek|book|boeken|kleding|shirt|pyjama|rugzak|tas|beker|drinkfles|sleutelhanger|keychain|watch|horloge|lamp|storage|opberg|etui|puzzel|puzzle|poster|kalender|calendar)\b/iu.test(
    text,
  );
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

export function resolveMisterBricksSetNumber(
  product: MisterBricksFeedProduct,
): string | undefined {
  if (!isLegoContext(product) || isNonConstructionLegoProduct(product)) {
    return undefined;
  }

  return (
    canonicalizeExplicitSetNumber(product.model) ??
    extractFiveDigitSetNumbers(product.title)[0] ??
    extractFiveDigitSetNumbers(product.model)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0]
  );
}

function resolveMisterBricksBrand(
  product: MisterBricksFeedProduct,
): string | undefined {
  return isLegoContext(product) ? 'LEGO' : undefined;
}

function normalizeMisterBricksAvailability(
  availability?: string,
): string | undefined {
  const normalizedAvailability = normalizeSearchText(availability);

  if (!normalizedAvailability) {
    return undefined;
  }

  if (
    normalizedAvailability.includes('in stock') ||
    normalizedAvailability.includes('op voorraad') ||
    normalizedAvailability.includes('direct leverbaar')
  ) {
    return 'In stock';
  }

  if (
    normalizedAvailability.includes('out of stock') ||
    normalizedAvailability.includes('uitverkocht') ||
    normalizedAvailability.includes('niet op voorraad')
  ) {
    return 'Out of stock';
  }

  return availability;
}

function buildSetNumberCandidateFields(
  product: MisterBricksFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

  if (product.model) {
    candidateFields.model = product.model;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    product.title,
  ).entries()) {
    candidateFields[`title.numberCandidate${index + 1}`] = candidate;
  }

  for (const [index, candidate] of extractFiveDigitSetNumbers(
    stripHtml(product.description),
  ).entries()) {
    candidateFields[`description.numberCandidate${index + 1}`] = candidate;
  }

  if (product.link) {
    candidateFields.productUrlIgnored = product.link;
  }

  if (product.sku) {
    candidateFields.skuIgnored = product.sku;
  }

  if (product.ean) {
    candidateFields.eanIgnored = product.ean;
  }

  return candidateFields;
}

export function normalizeMisterBricksFeedProductToFeedRow(
  product: MisterBricksFeedProduct,
): AlternateAffiliateFeedRow {
  return {
    affiliateDeeplink: product.link ?? '',
    availabilityText: normalizeMisterBricksAvailability(product.availability),
    brand: resolveMisterBricksBrand(product),
    category: product.category,
    condition: 'new',
    currency: product.price ? 'EUR' : undefined,
    description: stripHtml(product.description),
    ean: product.ean,
    imageUrl: product.imageUrl,
    legoSetNumber: resolveMisterBricksSetNumber(product),
    price: product.price,
    productId: product.sku,
    productTitle: product.title,
    shippingCost: product.shipping,
  };
}

export async function parseMisterBricksProductFeedXmlStream({
  maxProducts,
  stream,
}: {
  maxProducts?: number;
  stream: NodeJS.ReadableStream;
}): Promise<readonly MisterBricksFeedProduct[]> {
  const products: MisterBricksFeedProduct[] = [];
  const parser = new SaxesParser({
    xmlns: false,
  });
  let currentProduct: Record<string, string> | undefined;
  let currentField: string | undefined;
  let currentText = '';

  parser.on('opentag', (node) => {
    const tagName = node.name;

    if (tagName === 'item') {
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

    if (tagName === 'item') {
      if (!maxProducts || products.length < maxProducts) {
        products.push(toMisterBricksFeedProduct(currentProduct));
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

function toMisterBricksFeedProduct(
  record: Record<string, string>,
): MisterBricksFeedProduct {
  return {
    availability: record['availability'],
    category: record['category'] ?? record['category_path'],
    description: record['description'],
    ean: record['ean'],
    imageUrl: record['image_link'] ?? record['image'],
    link: record['link'],
    model: record['model'],
    price: record['price'],
    shipping: record['shipping'],
    sku: record['sku'],
    title: record['title'] ?? record['name'],
  };
}

function buildDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly MisterBricksFeedProduct[];
  sampleLimit?: number;
}): MisterBricksDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isLegoContext);
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<MisterBricksDebugSample>((product) => ({
      normalizedRow: normalizeMisterBricksFeedProductToFeedRow(product),
      rawAvailability: product.availability,
      rawEan: product.ean,
      rawPrice: product.price,
      rawProductTitle: product.title,
      rawSku: product.sku,
      selectedLegoSetNumber: resolveMisterBricksSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    sampleCount: samples.length,
    samples,
  };
}

function responseBodyToNodeStream(response: Response): NodeJS.ReadableStream {
  if (!response.body) {
    throw new Error('MisterBricks feed response did not include a body.');
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
  config: MisterBricksFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
}): Promise<readonly MisterBricksFeedProduct[]> {
  const response = await fetchFn(config.feedUrl, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(
      `MisterBricks feed request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseMisterBricksProductFeedXmlStream({
    maxProducts,
    stream: responseBodyToNodeStream(response),
  });
}

export async function syncMisterBricksFeed({
  dependencies,
  options,
}: {
  dependencies?: MisterBricksFeedSyncDependencies;
  options?: MisterBricksFeedSyncOptions;
} = {}): Promise<MisterBricksFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getMisterBricksFeedConfigFn =
    dependencies?.getMisterBricksFeedConfigFn ?? getMisterBricksFeedConfig;
  const importFeedRowsForMerchantFn =
    dependencies?.importFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getMisterBricksFeedConfigFn();
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
    (product) => !resolveMisterBricksSetNumber(product),
  ).length;
  const normalizedRows = constructionCandidates
    .map(normalizeMisterBricksFeedProductToFeedRow)
    .filter((row) => Boolean(row.legoSetNumber));
  const importResult = await importFeedRowsForMerchantFn({
    merchant: {
      slug: config.merchantSlug,
      name: config.merchantName,
      sourceType: 'direct',
      notes:
        'Feed-driven non-affiliate merchant. Current offer state is imported from the MisterBricks product feed.',
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: options?.dryRun,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows: normalizedRows,
  });

  return {
    ...importResult,
    debugInfo: buildDebugInfo({
      products,
      sampleLimit: options?.debugSamples,
    }),
    fetchedProductCount: products.length,
    legoCandidateCount: legoCandidates.length,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: normalizedRows.length,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (products.length - legoCandidates.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount + nonConstructionLegoProducts.length,
  };
}
