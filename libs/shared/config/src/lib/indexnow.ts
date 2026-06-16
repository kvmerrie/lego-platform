import {
  buildCanonicalUrl,
  getIndexNowConfig,
  indexNowEnvKeys,
  isIndexablePage,
  publicWebBaseUrls,
} from './config';

export const INDEXNOW_MAX_URLS_PER_BATCH = 10_000;
const responseBodyExcerptLimit = 500;
const loggedUrlLimit = 25;
const successStatusCodes = new Set([200, 202]);
const allowedInputHosts = new Set(['www.brickhunt.nl', 'brickhunt.nl']);

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: readonly string[];
}

export interface IndexNowInvalidUrl {
  reason: string;
  url: string;
}

export interface IndexNowBatchResult {
  batchIndex: number;
  endpoint: string;
  responseBody?: string;
  statusCode?: number;
  success: boolean;
  urlCount: number;
  urls: readonly string[];
}

export interface IndexNowSubmitResult {
  attempted: boolean;
  batchCount: number;
  batches: readonly IndexNowBatchResult[];
  enabled: boolean;
  invalidUrls: readonly IndexNowInvalidUrl[];
  skipped: boolean;
  skipReason?: string;
  submittedUrlCount: number;
  urls: readonly string[];
}

export interface IndexNowLogger {
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
}

export interface IndexNowSubmitOptions {
  environment?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  logger?: IndexNowLogger;
  reason?: string;
}

interface NormalizedIndexNowUrls {
  invalidUrls: readonly IndexNowInvalidUrl[];
  urls: readonly string[];
}

function summarizeUrls(urls: readonly string[]): {
  omittedCount: number;
  sample: readonly string[];
} {
  return {
    omittedCount: Math.max(0, urls.length - loggedUrlLimit),
    sample: urls.slice(0, loggedUrlLimit),
  };
}

function readResponseBodyExcerpt(body: string): string | undefined {
  const trimmedBody = body.trim();

  return trimmedBody
    ? trimmedBody.slice(0, responseBodyExcerptLimit)
    : undefined;
}

function getIndexNowUrlValidationError(url: string): string | undefined {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return 'invalid_url';
  }

  if (parsedUrl.protocol !== 'https:') {
    return 'non_https_url';
  }

  if (parsedUrl.host !== new URL(publicWebBaseUrls.production).host) {
    return 'non_canonical_host';
  }

  if (
    !isIndexablePage({
      allowIndexing: true,
      pathname: parsedUrl,
    })
  ) {
    return 'non_indexable_route';
  }

  return undefined;
}

function getInputUrlValidationError(url: string): string | undefined {
  if (url.startsWith('/')) {
    return undefined;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return 'invalid_url';
  }

  return allowedInputHosts.has(parsedUrl.host) ? undefined : 'external_url';
}

export function normalizeIndexNowUrls(
  urls: readonly string[],
): NormalizedIndexNowUrls {
  const dedupedUrls = new Set<string>();
  const invalidUrls: IndexNowInvalidUrl[] = [];

  for (const url of urls) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      invalidUrls.push({
        reason: 'empty_url',
        url,
      });
      continue;
    }

    const inputValidationError = getInputUrlValidationError(trimmedUrl);

    if (inputValidationError) {
      invalidUrls.push({
        reason: inputValidationError,
        url,
      });
      continue;
    }

    let canonicalUrl: string;

    try {
      canonicalUrl = buildCanonicalUrl(trimmedUrl);
    } catch {
      invalidUrls.push({
        reason: 'invalid_url',
        url,
      });
      continue;
    }

    const validationError = getIndexNowUrlValidationError(canonicalUrl);

    if (validationError) {
      invalidUrls.push({
        reason: validationError,
        url,
      });
      continue;
    }

    dedupedUrls.add(canonicalUrl);
  }

  return {
    invalidUrls,
    urls: [...dedupedUrls],
  };
}

export function chunkIndexNowUrls(
  urls: readonly string[],
  size = INDEXNOW_MAX_URLS_PER_BATCH,
): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < urls.length; index += size) {
    chunks.push(urls.slice(index, index + size));
  }

  return chunks;
}

export function buildIndexNowPayload({
  host,
  key,
  keyLocation,
  urls,
}: {
  host: string;
  key: string;
  keyLocation: string;
  urls: readonly string[];
}): IndexNowPayload {
  return {
    host,
    key,
    keyLocation,
    urlList: urls,
  };
}

export function isIndexNowEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  try {
    const config = getIndexNowConfig(environment);

    return config.enabled;
  } catch {
    return false;
  }
}

export async function submitUrl(
  url: string,
  options: IndexNowSubmitOptions = {},
): Promise<IndexNowSubmitResult> {
  return submitUrls([url], options);
}

export async function submitUrls(
  urls: readonly string[],
  {
    environment = process.env,
    fetchImpl = fetch,
    logger = console,
    reason,
  }: IndexNowSubmitOptions = {},
): Promise<IndexNowSubmitResult> {
  let config: ReturnType<typeof getIndexNowConfig>;

  try {
    config = getIndexNowConfig(environment);
  } catch (error) {
    if (environment[indexNowEnvKeys.enabled]?.trim().toLowerCase() === 'true') {
      logger.warn('[indexnow] skipped', {
        error: error instanceof Error ? error.message : String(error),
        reason,
        skipReason: 'missing_or_invalid_key',
      });
    }

    return {
      attempted: false,
      batchCount: 0,
      batches: [],
      enabled: false,
      invalidUrls: [],
      skipped: true,
      skipReason: 'missing_or_invalid_key',
      submittedUrlCount: 0,
      urls: [],
    };
  }

  if (!config.enabled) {
    return {
      attempted: false,
      batchCount: 0,
      batches: [],
      enabled: false,
      invalidUrls: [],
      skipped: true,
      skipReason: 'disabled',
      submittedUrlCount: 0,
      urls: [],
    };
  }

  const normalizedUrls = normalizeIndexNowUrls(urls);

  if (normalizedUrls.invalidUrls.length > 0) {
    logger.warn('[indexnow] invalid urls skipped', {
      invalidUrls: normalizedUrls.invalidUrls,
      reason,
    });
  }

  if (normalizedUrls.urls.length === 0) {
    return {
      attempted: false,
      batchCount: 0,
      batches: [],
      enabled: true,
      invalidUrls: normalizedUrls.invalidUrls,
      skipped: true,
      skipReason: 'no_valid_urls',
      submittedUrlCount: 0,
      urls: [],
    };
  }

  const chunks = chunkIndexNowUrls(normalizedUrls.urls);
  const batches: IndexNowBatchResult[] = [];

  for (const [batchIndex, chunk] of chunks.entries()) {
    const payload = buildIndexNowPayload({
      host: config.host,
      key: config.key,
      keyLocation: config.keyLocation,
      urls: chunk,
    });

    try {
      const response = await fetchImpl(config.endpoint, {
        body: JSON.stringify(payload),
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
        method: 'POST',
      });
      const responseText = await response.text().catch(() => '');
      const success = successStatusCodes.has(response.status);
      const urlSummary = summarizeUrls(chunk);
      const batchResult: IndexNowBatchResult = {
        batchIndex,
        endpoint: config.endpoint,
        ...(readResponseBodyExcerpt(responseText)
          ? { responseBody: readResponseBodyExcerpt(responseText) }
          : {}),
        statusCode: response.status,
        success,
        urlCount: chunk.length,
        urls: chunk,
      };

      batches.push(batchResult);

      const logMetadata = {
        batchIndex,
        event: 'indexnow_submit_urls',
        reason,
        responseBody: batchResult.responseBody,
        statusCode: response.status,
        success,
        urlCount: chunk.length,
        urlOmittedCount: urlSummary.omittedCount,
        urls: urlSummary.sample,
      };

      if (success) {
        logger.info('[indexnow] submitted urls', logMetadata);
      } else {
        logger.warn('[indexnow] submit urls failed', logMetadata);
      }
    } catch (error) {
      const urlSummary = summarizeUrls(chunk);
      const batchResult: IndexNowBatchResult = {
        batchIndex,
        endpoint: config.endpoint,
        responseBody: error instanceof Error ? error.message : String(error),
        success: false,
        urlCount: chunk.length,
        urls: chunk,
      };

      batches.push(batchResult);
      logger.warn('[indexnow] submit urls failed', {
        batchIndex,
        error: batchResult.responseBody,
        event: 'indexnow_submit_urls',
        reason,
        success: false,
        urlCount: chunk.length,
        urlOmittedCount: urlSummary.omittedCount,
        urls: urlSummary.sample,
      });
    }
  }

  return {
    attempted: true,
    batchCount: batches.length,
    batches,
    enabled: true,
    invalidUrls: normalizedUrls.invalidUrls,
    skipped: false,
    submittedUrlCount: normalizedUrls.urls.length,
    urls: normalizedUrls.urls,
  };
}
