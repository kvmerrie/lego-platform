import { Readable } from 'node:stream';
import {
  getUniekeBricksFeedConfig,
  type UniekeBricksFeedConfig,
} from '@lego-platform/shared/config';
import { SaxesParser } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

export interface UniekeBricksFeedProduct {
  availability?: string;
  condition?: string;
  description?: string;
  gtin?: string;
  id?: string;
  imageUrl?: string;
  link?: string;
  price?: string;
  title?: string;
}

export interface UniekeBricksFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getUniekeBricksFeedConfigFn?: typeof getUniekeBricksFeedConfig;
  importFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
  sleepFn?: (delayMs: number) => Promise<void>;
}

export interface UniekeBricksFeedSyncOptions {
  collectStaleLatestDiagnostics?: boolean;
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  unmatchedSampleLimit?: number;
}

export interface UniekeBricksDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawCondition?: string;
  rawGtin?: string;
  rawId?: string;
  rawPrice?: string;
  rawProductTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: Record<string, string>;
}

export interface UniekeBricksDebugInfo {
  availabilityDistribution: Readonly<Record<string, number>>;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  parseFailureCount: number;
  sampleCount: number;
  samples: readonly UniekeBricksDebugSample[];
}

export interface UniekeBricksFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  availabilityDistribution: Readonly<Record<string, number>>;
  debugInfo?: UniekeBricksDebugInfo;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
  originMode: UniekeBricksFeedOriginMode;
  parseFailureCount: number;
}

type UniekeBricksFeedOriginMode = 'ip' | 'public';

interface UniekeBricksFeedRequest {
  headers: HeadersInit;
  originMode: UniekeBricksFeedOriginMode;
  url: string;
}

const uniekeBricksFeedRetryDelayMs = 250;
const uniekeBricksFeedResponseSnippetLimit = 500;
const retriableUniekeBricksFeedStatuses = new Set([403, 429]);

function buildUniekeBricksFeedRequestHeaders(): HeadersInit {
  return {
    Accept: 'application/xml,text/xml,*/*',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent':
      'Mozilla/5.0 compatible BrickhuntBot/1.0; +https://www.brickhunt.nl',
  };
}

function buildUniekeBricksFeedRequest(
  config: UniekeBricksFeedConfig,
): UniekeBricksFeedRequest {
  const headers = buildUniekeBricksFeedRequestHeaders();

  if (!config.feedOriginUrl) {
    return {
      headers,
      originMode: 'public',
      url: config.feedUrl,
    };
  }

  return {
    headers: {
      ...headers,
      Host: new URL(config.feedUrl).hostname,
    },
    originMode: 'ip',
    url: config.feedOriginUrl,
  };
}

function shouldRetryUniekeBricksFeedStatus(status: number): boolean {
  return retriableUniekeBricksFeedStatuses.has(status) || status >= 500;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function normalizeResponseBodySnippet(value: string): string | undefined {
  const snippet = value
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, uniekeBricksFeedResponseSnippetLimit);

  return snippet || undefined;
}

async function readResponseBodySnippet(
  response: Response,
): Promise<string | undefined> {
  try {
    return normalizeResponseBodySnippet(await response.text());
  } catch {
    return undefined;
  }
}

async function buildUniekeBricksFeedResponseError(
  response: Response,
  originMode: UniekeBricksFeedOriginMode,
): Promise<Error> {
  const contentType = response.headers.get('content-type')?.trim();
  const bodySnippet = await readResponseBodySnippet(response);
  const diagnostics = [
    `origin_mode=${originMode}`,
    `status_code=${response.status}`,
    response.statusText
      ? `status_text=${JSON.stringify(response.statusText)}`
      : '',
    contentType ? `content_type=${JSON.stringify(contentType)}` : '',
    bodySnippet ? `body_snippet=${JSON.stringify(bodySnippet)}` : '',
  ].filter(Boolean);

  return new Error(
    `Unieke Bricks feed request failed with ${response.status} ${response.statusText}. upstream_http ${diagnostics.join(' ')}`,
  );
}

function isLikelyUniekeBricksFeedXml({
  bodyText,
  contentType,
}: {
  bodyText: string;
  contentType?: string;
}): boolean {
  const normalizedContentType = contentType?.toLowerCase() ?? '';
  const trimmedBodyStart = bodyText.trimStart().slice(0, 200).toLowerCase();

  if (
    trimmedBodyStart.startsWith('<html') ||
    trimmedBodyStart.includes('challenges.cloudflare.com') ||
    trimmedBodyStart.includes('just a moment')
  ) {
    return false;
  }

  return (
    normalizedContentType.includes('xml') ||
    trimmedBodyStart.startsWith('<?xml') ||
    trimmedBodyStart.startsWith('<rss') ||
    trimmedBodyStart.startsWith('<feed')
  );
}

function buildUniekeBricksInvalidFeedResponseError({
  bodyText,
  contentType,
  originMode,
}: {
  bodyText: string;
  contentType?: string;
  originMode: UniekeBricksFeedOriginMode;
}): Error {
  const bodySnippet = normalizeResponseBodySnippet(bodyText);
  const diagnostics = [
    `origin_mode=${originMode}`,
    contentType ? `content_type=${JSON.stringify(contentType)}` : '',
    bodySnippet ? `body_snippet=${JSON.stringify(bodySnippet)}` : '',
  ].filter(Boolean);
  const normalizedBodyStart = bodyText.trimStart().slice(0, 200).toLowerCase();

  if (!bodyText.trim()) {
    return new Error(
      `Unieke Bricks feed response had an empty body. upstream_invalid_response ${diagnostics.join(' ')}`,
    );
  }

  if (
    normalizedBodyStart.startsWith('<html') ||
    normalizedBodyStart.includes('challenges.cloudflare.com') ||
    normalizedBodyStart.includes('just a moment')
  ) {
    return new Error(
      `Unieke Bricks feed returned HTML response instead of XML. upstream_invalid_response ${diagnostics.join(' ')}`,
    );
  }

  return new Error(
    `Unieke Bricks feed returned non-XML upstream response. upstream_invalid_response ${diagnostics.join(' ')}`,
  );
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

function getSearchableProductText(product: UniekeBricksFeedProduct): string {
  return [product.title, stripHtml(product.description)]
    .filter(isNonEmptyString)
    .join(' ');
}

function isLegoContext(product: UniekeBricksFeedProduct): boolean {
  return /\blego\b/iu.test(
    normalizeSearchText(getSearchableProductText(product)),
  );
}

function isNonConstructionLegoProduct(
  product: UniekeBricksFeedProduct,
): boolean {
  const text = normalizeSearchText(getSearchableProductText(product));

  return /\b(nintendo switch|playstation|ps5|xbox|videogame|software|game|boek|book|boeken|kleding|shirt|pyjama|rugzak|tas|beker|drinkfles|sleutelhanger|keychain|watch|horloge|lamp|storage|opberg|etui|puzzel|puzzle|poster|kalender|calendar|minifigure display|display case)\b/iu.test(
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

export function resolveUniekeBricksSetNumber(
  product: UniekeBricksFeedProduct,
): string | undefined {
  if (!isLegoContext(product) || isNonConstructionLegoProduct(product)) {
    return undefined;
  }

  return (
    extractFiveDigitSetNumbers(product.title)[0] ??
    extractFiveDigitSetNumbers(stripHtml(product.description))[0]
  );
}

function resolveUniekeBricksBrand(
  product: UniekeBricksFeedProduct,
): string | undefined {
  return isLegoContext(product) ? 'LEGO' : undefined;
}

function normalizeUniekeBricksAvailability(
  availability?: string,
): string | undefined {
  const normalizedAvailability = normalizeSearchText(availability);

  if (!normalizedAvailability) {
    return undefined;
  }

  if (
    normalizedAvailability.includes('in stock') ||
    normalizedAvailability.includes('in_stock') ||
    normalizedAvailability.includes('op voorraad')
  ) {
    return 'In stock';
  }

  if (
    normalizedAvailability.includes('out of stock') ||
    normalizedAvailability.includes('out_of_stock') ||
    normalizedAvailability.includes('uitverkocht') ||
    normalizedAvailability.includes('niet op voorraad')
  ) {
    return 'Out of stock';
  }

  if (
    normalizedAvailability.includes('preorder') ||
    normalizedAvailability.includes('pre-order')
  ) {
    return 'Preorder';
  }

  return availability;
}

function resolveUniekeBricksCurrency(price?: string): string | undefined {
  if (!price?.trim()) {
    return undefined;
  }

  const trimmedPrice = price.trim();
  const prefixMatch = trimmedPrice.match(/^([A-Z]{3})\s*\d/iu);
  const suffixMatch = trimmedPrice.match(/\d\s*([A-Z]{3})$/iu);

  return (prefixMatch?.[1] ?? suffixMatch?.[1] ?? 'EUR').toUpperCase();
}

function normalizeUniekeBricksPrice(price?: string): string | undefined {
  const trimmedPrice = price?.trim();

  if (!trimmedPrice) {
    return undefined;
  }

  const prefixMatch = trimmedPrice.match(
    /^[A-Z]{3}\s*([0-9]+(?:[.,][0-9]+)?)/iu,
  );
  const suffixMatch = trimmedPrice.match(
    /^([0-9]+(?:[.,][0-9]+)?)\s*[A-Z]{3}$/iu,
  );

  return (prefixMatch?.[1] ?? suffixMatch?.[1] ?? trimmedPrice).replace(
    ',',
    '.',
  );
}

function normalizeUniekeBricksCondition(condition?: string): string {
  const normalizedCondition = normalizeSearchText(condition);

  if (!normalizedCondition || normalizedCondition === 'new') {
    return 'new';
  }

  if (normalizedCondition === 'nieuw') {
    return 'new';
  }

  return condition?.trim() || 'new';
}

function buildSetNumberCandidateFields(
  product: UniekeBricksFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};

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

  if (product.id) {
    candidateFields.productIdIgnored = product.id;
  }

  if (product.gtin) {
    candidateFields.gtinIgnored = product.gtin;
  }

  return candidateFields;
}

export function normalizeUniekeBricksFeedProductToFeedRow(
  product: UniekeBricksFeedProduct,
): AlternateAffiliateFeedRow {
  return {
    affiliateDeeplink: product.link ?? '',
    availabilityText: normalizeUniekeBricksAvailability(product.availability),
    brand: resolveUniekeBricksBrand(product),
    condition: normalizeUniekeBricksCondition(product.condition),
    currency: resolveUniekeBricksCurrency(product.price),
    description: stripHtml(product.description),
    ean: product.gtin,
    imageUrl: product.imageUrl,
    legoSetNumber: resolveUniekeBricksSetNumber(product),
    price: normalizeUniekeBricksPrice(product.price),
    productId: product.id,
    productTitle: product.title,
    sourceMetadata: {
      availability: product.availability,
      condition: product.condition,
      source: 'uniekebricks-direct-feed',
    },
  };
}

export async function parseUniekeBricksProductFeedXmlStream({
  maxProducts,
  stream,
}: {
  maxProducts?: number;
  stream: NodeJS.ReadableStream;
}): Promise<readonly UniekeBricksFeedProduct[]> {
  const products: UniekeBricksFeedProduct[] = [];
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
        products.push(toUniekeBricksFeedProduct(currentProduct));
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

function toUniekeBricksFeedProduct(
  record: Record<string, string>,
): UniekeBricksFeedProduct {
  return {
    availability: record['g:availability'] ?? record['availability'],
    condition: record['g:condition'] ?? record['condition'],
    description: record['g:description'] ?? record['description'],
    gtin: record['g:gtin'] ?? record['gtin'] ?? record['ean'],
    id: record['g:id'] ?? record['id'],
    imageUrl: record['g:image_link'] ?? record['image_link'] ?? record['image'],
    link: record['g:link'] ?? record['link'],
    price: record['g:price'] ?? record['price'],
    title: record['g:title'] ?? record['title'],
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

function getExcludedReason(
  product: UniekeBricksFeedProduct,
): string | undefined {
  if (!isLegoContext(product)) {
    return 'non_lego';
  }

  if (isNonConstructionLegoProduct(product)) {
    return 'non_construction_lego';
  }

  if (!resolveUniekeBricksSetNumber(product)) {
    return 'missing_or_invalid_set_number';
  }

  return undefined;
}

function buildExcludedReasonCounts(
  products: readonly UniekeBricksFeedProduct[],
): Readonly<Record<string, number>> {
  return countBy(products.map(getExcludedReason).filter(isNonEmptyString));
}

function buildDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly UniekeBricksFeedProduct[];
  sampleLimit?: number;
}): UniekeBricksDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isLegoContext);
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<UniekeBricksDebugSample>((product) => ({
      normalizedRow: normalizeUniekeBricksFeedProductToFeedRow(product),
      rawAvailability: product.availability,
      rawCondition: product.condition,
      rawGtin: product.gtin,
      rawId: product.id,
      rawPrice: product.price,
      rawProductTitle: product.title,
      selectedLegoSetNumber: resolveUniekeBricksSetNumber(product),
      setNumberCandidateFields: buildSetNumberCandidateFields(product),
    }));

  return {
    availabilityDistribution: countBy(
      products.map((product) =>
        normalizeUniekeBricksAvailability(product.availability),
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

async function fetchProducts({
  config,
  fetchFn,
  maxProducts,
  sleepFn,
}: {
  config: UniekeBricksFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
  sleepFn: (delayMs: number) => Promise<void>;
}): Promise<{
  originMode: UniekeBricksFeedOriginMode;
  products: readonly UniekeBricksFeedProduct[];
}> {
  const request = buildUniekeBricksFeedRequest(config);
  let response = await fetchFn(request.url, {
    headers: request.headers,
  });

  if (!response.ok && shouldRetryUniekeBricksFeedStatus(response.status)) {
    await sleepFn(uniekeBricksFeedRetryDelayMs);
    response = await fetchFn(request.url, {
      headers: request.headers,
    });
  }

  if (!response.ok) {
    throw await buildUniekeBricksFeedResponseError(
      response,
      request.originMode,
    );
  }

  const contentType = response.headers.get('content-type')?.trim();
  const bodyText = await response.text();

  if (
    !isLikelyUniekeBricksFeedXml({
      bodyText,
      contentType,
    })
  ) {
    throw buildUniekeBricksInvalidFeedResponseError({
      bodyText,
      contentType,
      originMode: request.originMode,
    });
  }

  return {
    originMode: request.originMode,
    products: await parseUniekeBricksProductFeedXmlStream({
      maxProducts,
      stream: Readable.from([bodyText]),
    }),
  };
}

export async function syncUniekeBricksFeed({
  dependencies,
  options,
}: {
  dependencies?: UniekeBricksFeedSyncDependencies;
  options?: UniekeBricksFeedSyncOptions;
} = {}): Promise<UniekeBricksFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getUniekeBricksFeedConfigFn =
    dependencies?.getUniekeBricksFeedConfigFn ?? getUniekeBricksFeedConfig;
  const importFeedRowsForMerchantFn =
    dependencies?.importFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const sleepFn = dependencies?.sleepFn ?? sleep;
  const config = getUniekeBricksFeedConfigFn();
  const feed = await fetchProducts({
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
    sleepFn,
  });
  const products = feed.products;
  const legoCandidates = products.filter(isLegoContext);
  const nonConstructionLegoProducts = legoCandidates.filter(
    isNonConstructionLegoProduct,
  );
  const constructionCandidates = legoCandidates.filter(
    (product) => !isNonConstructionLegoProduct(product),
  );
  const missingSetNumberProductCount = constructionCandidates.filter(
    (product) => !resolveUniekeBricksSetNumber(product),
  ).length;
  const normalizedRows = constructionCandidates
    .map(normalizeUniekeBricksFeedProductToFeedRow)
    .filter((row) => Boolean(row.legoSetNumber));
  const importResult = await importFeedRowsForMerchantFn({
    merchant: {
      slug: config.merchantSlug,
      name: config.merchantName,
      sourceType: 'direct',
      notes:
        'Feed-driven non-affiliate merchant. Current offer state is imported from the Unieke Bricks product feed.',
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
        normalizeUniekeBricksAvailability(product.availability),
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
    originMode: feed.originMode,
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
