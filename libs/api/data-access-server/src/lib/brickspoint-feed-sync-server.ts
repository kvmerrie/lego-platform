import { Readable } from 'node:stream';
import {
  getBrickspointFeedConfig,
  type BrickspointFeedConfig,
} from '@lego-platform/shared/config';
import {
  importAffiliateFeedRowsForMerchant,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';
import {
  buildDirectWooCommerceSetNumberCandidateFields,
  type DirectWooCommerceFeedProduct,
  isDirectWooCommerceLegoContext,
  isDirectWooCommerceNonConstructionLegoProduct,
  normalizeDirectWooCommerceFeedProductToFeedRow,
  parseDirectWooCommerceProductFeedXmlStream,
  resolveDirectWooCommerceSetNumber,
} from './unieke-bricks-feed-sync-server';

export interface BrickspointFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getBrickspointFeedConfigFn?: typeof getBrickspointFeedConfig;
  importFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
  sleepFn?: (delayMs: number) => Promise<void>;
}

export interface BrickspointFeedSyncOptions {
  collectStaleLatestDiagnostics?: boolean;
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  unmatchedSampleLimit?: number;
}

export interface BrickspointDebugSample {
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

export interface BrickspointDebugInfo {
  availabilityDistribution: Readonly<Record<string, number>>;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  parseFailureCount: number;
  sampleCount: number;
  samples: readonly BrickspointDebugSample[];
}

export interface BrickspointFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  availabilityDistribution: Readonly<Record<string, number>>;
  debugInfo?: BrickspointDebugInfo;
  excludedReasonCounts: Readonly<Record<string, number>>;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
  originMode: 'public';
  parseFailureCount: number;
}

const brickspointFeedRetryDelayMs = 250;
const brickspointFeedResponseSnippetLimit = 500;
const retriableBrickspointFeedStatuses = new Set([403, 429]);
const brickspointSourceMetadataSource = 'brickspoint-direct-feed';

function buildBrickspointFeedRequestHeaders(): HeadersInit {
  return {
    Accept: 'application/xml,text/xml,*/*',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent':
      'Mozilla/5.0 compatible BrickhuntBot/1.0; +https://www.brickhunt.nl',
  };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function shouldRetryBrickspointFeedStatus(status: number): boolean {
  return retriableBrickspointFeedStatuses.has(status) || status >= 500;
}

function normalizeResponseBodySnippet(value: string): string | undefined {
  const snippet = value
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, brickspointFeedResponseSnippetLimit);

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

async function buildBrickspointFeedResponseError(
  response: Response,
): Promise<Error> {
  const contentType = response.headers.get('content-type')?.trim();
  const bodySnippet = await readResponseBodySnippet(response);
  const diagnostics = [
    'origin_mode=public',
    `status_code=${response.status}`,
    response.statusText
      ? `status_text=${JSON.stringify(response.statusText)}`
      : '',
    contentType ? `content_type=${JSON.stringify(contentType)}` : '',
    bodySnippet ? `body_snippet=${JSON.stringify(bodySnippet)}` : '',
  ].filter(Boolean);

  return new Error(
    `Brickspoint feed request failed with ${response.status} ${response.statusText}. upstream_http ${diagnostics.join(' ')}`,
  );
}

function isLikelyBrickspointFeedXml({
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

function buildBrickspointInvalidFeedResponseError({
  bodyText,
  contentType,
}: {
  bodyText: string;
  contentType?: string;
}): Error {
  const bodySnippet = normalizeResponseBodySnippet(bodyText);
  const diagnostics = [
    'origin_mode=public',
    contentType ? `content_type=${JSON.stringify(contentType)}` : '',
    bodySnippet ? `body_snippet=${JSON.stringify(bodySnippet)}` : '',
  ].filter(Boolean);
  const normalizedBodyStart = bodyText.trimStart().slice(0, 200).toLowerCase();

  if (!bodyText.trim()) {
    return new Error(
      `Brickspoint feed response had an empty body. upstream_invalid_response ${diagnostics.join(' ')}`,
    );
  }

  if (
    normalizedBodyStart.startsWith('<html') ||
    normalizedBodyStart.includes('challenges.cloudflare.com') ||
    normalizedBodyStart.includes('just a moment')
  ) {
    return new Error(
      `Brickspoint feed returned HTML response instead of XML. upstream_invalid_response ${diagnostics.join(' ')}`,
    );
  }

  return new Error(
    `Brickspoint feed returned non-XML upstream response. upstream_invalid_response ${diagnostics.join(' ')}`,
  );
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeBrickspointFeedProductToFeedRow(
  product: DirectWooCommerceFeedProduct,
): AlternateAffiliateFeedRow {
  return normalizeDirectWooCommerceFeedProductToFeedRow(product, {
    sourceMetadataSource: brickspointSourceMetadataSource,
  });
}

function getExcludedReason(
  product: DirectWooCommerceFeedProduct,
): string | undefined {
  if (!isDirectWooCommerceLegoContext(product)) {
    return 'non_lego';
  }

  if (isDirectWooCommerceNonConstructionLegoProduct(product)) {
    return 'non_construction_lego';
  }

  if (!resolveDirectWooCommerceSetNumber(product)) {
    return 'missing_or_invalid_set_number';
  }

  return undefined;
}

function buildExcludedReasonCounts(
  products: readonly DirectWooCommerceFeedProduct[],
): Readonly<Record<string, number>> {
  return countBy(products.map(getExcludedReason).filter(isNonEmptyString));
}

function buildAvailabilityDistribution(
  products: readonly DirectWooCommerceFeedProduct[],
): Readonly<Record<string, number>> {
  return countBy(
    products.map(
      (product) =>
        normalizeBrickspointFeedProductToFeedRow(product).availabilityText,
    ),
  );
}

function buildDebugInfo({
  products,
  sampleLimit,
}: {
  products: readonly DirectWooCommerceFeedProduct[];
  sampleLimit?: number;
}): BrickspointDebugInfo | undefined {
  if (!sampleLimit || sampleLimit <= 0) {
    return undefined;
  }

  const legoCandidates = products.filter(isDirectWooCommerceLegoContext);
  const samples = legoCandidates
    .slice(0, sampleLimit)
    .map<BrickspointDebugSample>((product) => ({
      normalizedRow: normalizeBrickspointFeedProductToFeedRow(product),
      rawAvailability: product.availability,
      rawCondition: product.condition,
      rawGtin: product.gtin,
      rawId: product.id,
      rawPrice: product.price,
      rawProductTitle: product.title,
      selectedLegoSetNumber: resolveDirectWooCommerceSetNumber(product),
      setNumberCandidateFields:
        buildDirectWooCommerceSetNumberCandidateFields(product),
    }));

  return {
    availabilityDistribution: buildAvailabilityDistribution(products),
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
  config: BrickspointFeedConfig;
  fetchFn: typeof fetch;
  maxProducts?: number;
  sleepFn: (delayMs: number) => Promise<void>;
}): Promise<readonly DirectWooCommerceFeedProduct[]> {
  const headers = buildBrickspointFeedRequestHeaders();

  console.log(
    `[brickspoint-feed-sync] fetch_request origin_mode=public attempt=1 request_url_host=${JSON.stringify(new URL(config.feedUrl).host)}`,
  );
  let response = await fetchFn(config.feedUrl, {
    headers,
  });

  if (!response.ok && shouldRetryBrickspointFeedStatus(response.status)) {
    await sleepFn(brickspointFeedRetryDelayMs);
    console.log(
      `[brickspoint-feed-sync] fetch_request origin_mode=public attempt=2 request_url_host=${JSON.stringify(new URL(config.feedUrl).host)}`,
    );
    response = await fetchFn(config.feedUrl, {
      headers,
    });
  }

  if (!response.ok) {
    throw await buildBrickspointFeedResponseError(response);
  }

  const contentType = response.headers.get('content-type')?.trim();
  const bodyText = await response.text();

  if (
    !isLikelyBrickspointFeedXml({
      bodyText,
      contentType,
    })
  ) {
    throw buildBrickspointInvalidFeedResponseError({
      bodyText,
      contentType,
    });
  }

  return await parseDirectWooCommerceProductFeedXmlStream({
    maxProducts,
    stream: Readable.from([bodyText]),
  });
}

export async function syncBrickspointFeed({
  dependencies,
  options,
}: {
  dependencies?: BrickspointFeedSyncDependencies;
  options?: BrickspointFeedSyncOptions;
} = {}): Promise<BrickspointFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getBrickspointFeedConfigFn =
    dependencies?.getBrickspointFeedConfigFn ?? getBrickspointFeedConfig;
  const importFeedRowsForMerchantFn =
    dependencies?.importFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const sleepFn = dependencies?.sleepFn ?? sleep;
  const config = getBrickspointFeedConfigFn();
  const products = await fetchProducts({
    config,
    fetchFn,
    maxProducts: options?.maxProducts,
    sleepFn,
  });
  const legoCandidates = products.filter(isDirectWooCommerceLegoContext);
  const constructionCandidates = legoCandidates.filter(
    (product) => !isDirectWooCommerceNonConstructionLegoProduct(product),
  );
  const missingSetNumberProductCount = constructionCandidates.filter(
    (product) => !resolveDirectWooCommerceSetNumber(product),
  ).length;
  const normalizedRows = constructionCandidates
    .map(normalizeBrickspointFeedProductToFeedRow)
    .filter((row) => Boolean(row.legoSetNumber));
  const importResult = await importFeedRowsForMerchantFn({
    merchant: {
      slug: config.merchantSlug,
      name: config.merchantName,
      sourceType: 'direct',
      notes:
        'Feed-driven non-affiliate merchant. Current offer state is imported from the Brickspoint product feed.',
    },
    options: {
      collectStaleLatestDiagnostics:
        options?.collectStaleLatestDiagnostics ?? false,
      collectUnmatchedDebug: options?.collectUnmatchedDebug ?? false,
      dryRun: options?.dryRun ?? false,
      persistDiscoveredSets: false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows: normalizedRows,
  });

  return {
    ...importResult,
    availabilityDistribution: buildAvailabilityDistribution(products),
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
    originMode: 'public',
    parseFailureCount: 0,
    skippedMissingSetNumberCount:
      importResult.skippedMissingSetNumberCount + missingSetNumberProductCount,
    skippedNonLegoCount:
      importResult.skippedNonLegoCount +
      (products.length - legoCandidates.length),
    skippedNonNewCount:
      importResult.skippedNonNewCount +
      (legoCandidates.length - constructionCandidates.length),
  };
}
