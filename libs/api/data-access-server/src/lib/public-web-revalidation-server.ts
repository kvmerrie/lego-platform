import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import {
  batchRevalidationPayloads,
  buildSetDetailPath,
  buildThemePath,
  cacheTags,
  productEmailEnvKeys,
  publicWebRevalidationEnvKeys,
  webPathnames,
} from '@lego-platform/shared/config';

export interface PublicWebCatalogRevalidationTarget {
  setId: string;
  slug: string;
  theme: string;
}

export interface PublicWebCatalogRevalidationResult {
  attempted: boolean;
  pathCount: number;
  paths: readonly string[];
  skipped: boolean;
  tagCount: number;
  tags: readonly string[];
}

export interface PublicWebRevalidationResult {
  attempted: boolean;
  pathCount: number;
  paths: readonly string[];
  skipped: boolean;
  tagCount: number;
  tags: readonly string[];
}

const broadRevalidationTags = new Set([
  'catalog',
  'homepage',
  'deals',
  'prices',
  'sitemap',
]);
const loggedValueLimit = 12;
const largePriceChangeSetCountThreshold = 100;
const largePriceChangeExplicitSetPathLimit = 23;
const responseBodyExcerptLimit = 500;
const productionEnvironmentNames = new Set(['production', 'prod']);

type PublicWebRevalidationSource = 'catalog' | 'generic';

interface PublicWebRevalidationRequestDiagnostics {
  hasOrigin: boolean;
  hasSecret: boolean;
  originEnvName: string;
  targetHost?: string;
  targetPathname: string;
}

function isProductionEnvironment(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const deploymentEnvironment = (
    environment['BRICKHUNT_DEPLOY_ENV'] ??
    environment['VERCEL_ENV'] ??
    environment['NODE_ENV']
  )
    ?.trim()
    .toLowerCase();

  return deploymentEnvironment
    ? productionEnvironmentNames.has(deploymentEnvironment)
    : false;
}

function isPublicWebRevalidationDebugEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment['DEBUG_REVALIDATION'] === 'true';
}

function buildRequestDiagnostics(
  environment: Record<string, string | undefined> = process.env,
): PublicWebRevalidationRequestDiagnostics {
  const explicitOrigin = environment[productEmailEnvKeys.webBaseUrl]?.trim();
  const hasOrigin = Boolean(explicitOrigin);
  const originEnvName = hasOrigin
    ? productEmailEnvKeys.webBaseUrl
    : 'runtime:web.baseUrl';
  const targetUrl = explicitOrigin
    ? tryBuildRevalidationUrl(explicitOrigin)
    : undefined;

  return {
    hasOrigin,
    hasSecret: Boolean(environment[publicWebRevalidationEnvKeys.secret]),
    originEnvName,
    targetHost: targetUrl?.host,
    targetPathname: targetUrl?.pathname ?? '/api/revalidate',
  };
}

function tryBuildRevalidationUrl(webBaseUrl: string): URL | undefined {
  try {
    return new URL('/api/revalidate', webBaseUrl);
  } catch {
    return undefined;
  }
}

function buildRevalidationUrl(webBaseUrl: string): URL {
  const targetUrl = tryBuildRevalidationUrl(webBaseUrl);

  if (!targetUrl) {
    throw new Error(
      `Invalid public web revalidation origin: ${productEmailEnvKeys.webBaseUrl}.`,
    );
  }

  return targetUrl;
}

function normalizeRevalidationPath(pathname: string): string | undefined {
  const trimmedPathname = pathname.trim();

  if (!trimmedPathname.startsWith('/')) {
    return undefined;
  }

  return trimmedPathname === '/'
    ? trimmedPathname
    : trimmedPathname.replace(/\/+$/, '') || '/';
}

function summarizeValues(values: readonly string[]): {
  omittedCount: number;
  sample: readonly string[];
} {
  return {
    omittedCount: Math.max(0, values.length - loggedValueLimit),
    sample: values.slice(0, loggedValueLimit),
  };
}

function getBroadRevalidationTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => broadRevalidationTags.has(tag));
}

function logPublicWebRevalidationRequest({
  attempted,
  diagnostics,
  paths,
  reason,
  skipReason,
  skipped,
  source,
  tags,
}: {
  attempted: boolean;
  diagnostics: PublicWebRevalidationRequestDiagnostics;
  paths: readonly string[];
  reason?: string;
  skipReason?: string;
  skipped: boolean;
  source: PublicWebRevalidationSource;
  tags: readonly string[];
}): void {
  const broadTags = getBroadRevalidationTags(tags);
  const pathSummary = summarizeValues(paths);
  const tagSummary = summarizeValues(tags);

  if (skipped) {
    console.info('[public-web-revalidation] skipped', {
      attempted,
      pathCount: paths.length,
      reason,
      skipReason,
      source,
      tagCount: tags.length,
    });
  }

  if (!isPublicWebRevalidationDebugEnabled()) {
    return;
  }

  console.info('[public-web-revalidation] request diagnostics', {
    attempted,
    broad_tag_count: broadTags.length,
    event: 'public_web_revalidation_request',
    has_origin: diagnostics.hasOrigin,
    has_secret: diagnostics.hasSecret,
    origin_env_name: diagnostics.originEnvName,
    path_count: paths.length,
    path_sample: pathSummary.sample,
    path_sample_omitted_count: pathSummary.omittedCount,
    reason,
    skipped,
    skip_reason: skipReason,
    source,
    tag_count: tags.length,
    tag_sample: tagSummary.sample,
    tag_sample_omitted_count: tagSummary.omittedCount,
    target_host: diagnostics.targetHost,
    target_pathname: diagnostics.targetPathname,
  });

  if (broadTags.length > 0) {
    console.warn('[public-web-revalidation] broad tags requested', {
      broadTags,
      reason,
      source,
    });
  }
}

function logPublicWebRevalidationResponse({
  durationMs,
  diagnostics,
  pathCount,
  reason,
  source,
  status,
  tagCount,
}: {
  durationMs: number;
  diagnostics: PublicWebRevalidationRequestDiagnostics;
  pathCount: number;
  reason?: string;
  source: PublicWebRevalidationSource;
  status: number;
  tagCount: number;
}): void {
  console.info('[public-web-revalidation] success', {
    duration_ms: durationMs,
    event: 'public_web_revalidation_succeeded',
    path_count: pathCount,
    reason,
    source,
    status,
    tag_count: tagCount,
    target_host: diagnostics.targetHost,
    target_pathname: diagnostics.targetPathname,
  });

  if (isPublicWebRevalidationDebugEnabled()) {
    console.info('[public-web-revalidation] response diagnostics', {
      duration_ms: durationMs,
      event: 'public_web_revalidation_response',
      path_count: pathCount,
      reason,
      source,
      status,
      tag_count: tagCount,
      target_host: diagnostics.targetHost,
      target_pathname: diagnostics.targetPathname,
    });
  }
}

function getErrorCauseDiagnostics(error: unknown): {
  causeCode?: string;
  causeMessage?: string;
  errorMessage: string;
  errorName: string;
} {
  const errorName = error instanceof Error ? error.name : typeof error;
  const errorMessage =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const cause =
    error instanceof Error && 'cause' in error ? error.cause : undefined;
  const causeCode =
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    typeof cause.code === 'string'
      ? cause.code
      : undefined;
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'object' &&
          cause !== null &&
          'message' in cause &&
          typeof cause.message === 'string'
        ? cause.message
        : undefined;

  return {
    causeCode,
    causeMessage,
    errorMessage,
    errorName,
  };
}

function logPublicWebRevalidationFetchFailure({
  diagnostics,
  error,
  reason,
  source,
}: {
  diagnostics: PublicWebRevalidationRequestDiagnostics;
  error: unknown;
  reason?: string;
  source: PublicWebRevalidationSource;
}): void {
  const errorDiagnostics = getErrorCauseDiagnostics(error);

  console.error('[public-web-revalidation] fetch failed', {
    error_cause_code: errorDiagnostics.causeCode,
    error_cause_message: errorDiagnostics.causeMessage,
    error_message: errorDiagnostics.errorMessage,
    error_name: errorDiagnostics.errorName,
    event: 'public_web_revalidation_fetch_failed',
    reason,
    source,
    target_host: diagnostics.targetHost,
    target_pathname: diagnostics.targetPathname,
  });
}

async function readResponseBodyExcerpt(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, responseBodyExcerptLimit);
  } catch (error) {
    return error instanceof Error
      ? `[failed to read response body: ${error.message}]`
      : '[failed to read response body]';
  }
}

function logPublicWebRevalidationHttpFailure({
  bodyExcerpt,
  diagnostics,
  reason,
  source,
  status,
}: {
  bodyExcerpt: string;
  diagnostics: PublicWebRevalidationRequestDiagnostics;
  reason?: string;
  source: PublicWebRevalidationSource;
  status: number;
}): void {
  console.error('[public-web-revalidation] http failed', {
    event: 'public_web_revalidation_http_failed',
    reason,
    response_body_excerpt: bodyExcerpt,
    source,
    status,
    target_host: diagnostics.targetHost,
    target_pathname: diagnostics.targetPathname,
  });
}

async function sendPublicWebRevalidationRequest({
  fetchImpl,
  paths,
  reason,
  source,
  tags,
}: {
  fetchImpl: typeof fetch;
  paths: readonly string[];
  reason?: string;
  source: PublicWebRevalidationSource;
  tags: readonly string[];
}): Promise<PublicWebRevalidationResult> {
  const diagnostics = buildRequestDiagnostics();
  const skipReason =
    paths.length === 0 && tags.length === 0
      ? 'empty_targets'
      : !diagnostics.hasSecret
        ? `missing_${publicWebRevalidationEnvKeys.secret}`
        : !diagnostics.hasOrigin
          ? `missing_${productEmailEnvKeys.webBaseUrl}`
          : undefined;

  if (skipReason) {
    logPublicWebRevalidationRequest({
      attempted: false,
      diagnostics,
      paths,
      reason,
      skipReason,
      skipped: true,
      source,
      tags,
    });

    if (isProductionEnvironment()) {
      throw new Error(
        `Public web revalidation is not configured: ${skipReason}.`,
      );
    }

    return {
      attempted: false,
      pathCount: paths.length,
      paths,
      skipped: true,
      tagCount: tags.length,
      tags,
    };
  }

  let targetUrl: URL;

  try {
    targetUrl = buildRevalidationUrl(
      process.env[productEmailEnvKeys.webBaseUrl] ?? '',
    );
  } catch (error) {
    logPublicWebRevalidationFetchFailure({
      diagnostics,
      error,
      reason,
      source,
    });
    throw error;
  }

  const requestDiagnostics = {
    ...diagnostics,
    targetHost: targetUrl.host,
    targetPathname: targetUrl.pathname,
  };

  logPublicWebRevalidationRequest({
    attempted: true,
    diagnostics: requestDiagnostics,
    paths,
    reason,
    skipped: false,
    source,
    tags,
  });

  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetchImpl(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret':
          process.env[publicWebRevalidationEnvKeys.secret] ?? '',
      },
      body: JSON.stringify({
        paths,
        reason,
        tags,
      }),
    });
  } catch (error) {
    logPublicWebRevalidationFetchFailure({
      diagnostics: requestDiagnostics,
      error,
      reason,
      source,
    });
    throw error;
  }

  if (!response.ok) {
    const bodyExcerpt = await readResponseBodyExcerpt(response);

    logPublicWebRevalidationHttpFailure({
      bodyExcerpt,
      diagnostics: requestDiagnostics,
      reason,
      source,
      status: response.status,
    });

    throw new Error(
      `Public web revalidation failed with status ${response.status}.`,
    );
  }

  logPublicWebRevalidationResponse({
    diagnostics: requestDiagnostics,
    durationMs: Date.now() - startedAt,
    pathCount: paths.length,
    reason,
    source,
    status: response.status,
    tagCount: tags.length,
  });

  return {
    attempted: true,
    pathCount: paths.length,
    paths,
    skipped: false,
    tagCount: tags.length,
    tags,
  };
}

export function buildPublicCatalogRevalidationPaths({
  includeDeals = true,
  includeHome = true,
  includeThemeDirectory = true,
  targets,
}: {
  includeDeals?: boolean;
  includeHome?: boolean;
  includeThemeDirectory?: boolean;
  targets: readonly PublicWebCatalogRevalidationTarget[];
}): string[] {
  const dedupedPaths = new Set<string>();

  if (includeHome) {
    dedupedPaths.add(webPathnames.home);
  }

  if (includeThemeDirectory) {
    dedupedPaths.add(webPathnames.themes);
  }

  if (includeDeals) {
    dedupedPaths.add(webPathnames.deals);
  }

  for (const target of targets) {
    const setPath = normalizeRevalidationPath(buildSetDetailPath(target.slug));
    const themePath = normalizeRevalidationPath(
      buildThemePath(buildCatalogThemeSlug(target.theme)),
    );

    if (setPath) {
      dedupedPaths.add(setPath);
    }

    if (themePath) {
      dedupedPaths.add(themePath);
    }
  }

  return [...dedupedPaths];
}

export function buildPublicCatalogRevalidationTags({
  includeDeals = true,
  includeHome = true,
  includeThemeDirectory = true,
  targets,
}: {
  includeDeals?: boolean;
  includeHome?: boolean;
  includeThemeDirectory?: boolean;
  targets: readonly PublicWebCatalogRevalidationTarget[];
}): string[] {
  const dedupedTags = new Set<string>();

  if (includeHome) {
    dedupedTags.add(cacheTags.homepage());
  }

  dedupedTags.add(cacheTags.prices());
  dedupedTags.add(cacheTags.catalog());

  if (includeThemeDirectory) {
    dedupedTags.add(cacheTags.themes());
  }

  if (includeDeals) {
    dedupedTags.add(cacheTags.deals());
  }

  for (const target of targets) {
    dedupedTags.add(cacheTags.set(target.setId));
    dedupedTags.add(cacheTags.set(target.slug));
    dedupedTags.add(cacheTags.theme(buildCatalogThemeSlug(target.theme)));
  }

  return [...dedupedTags];
}

export async function revalidatePublicCatalogPaths({
  fetchImpl = fetch,
  includeDeals = true,
  includeHome = true,
  includeThemeDirectory = true,
  reason,
  targets,
}: {
  fetchImpl?: typeof fetch;
  includeDeals?: boolean;
  includeHome?: boolean;
  includeThemeDirectory?: boolean;
  reason?: string;
  targets: readonly PublicWebCatalogRevalidationTarget[];
}): Promise<PublicWebCatalogRevalidationResult> {
  const paths = buildPublicCatalogRevalidationPaths({
    includeDeals,
    includeHome,
    includeThemeDirectory,
    targets,
  });
  const tags = buildPublicCatalogRevalidationTags({
    includeDeals,
    includeHome,
    includeThemeDirectory,
    targets,
  });

  const batches = batchRevalidationPayloads({
    paths,
    reason: reason ?? 'catalog_revalidation',
    tags,
  });
  const results: PublicWebCatalogRevalidationResult[] = [];

  for (const batch of batches) {
    results.push(
      await sendPublicWebRevalidationRequest({
        fetchImpl,
        paths: batch.paths,
        reason,
        source: 'catalog',
        tags: batch.tags,
      }),
    );
  }

  if (results.length === 0) {
    return sendPublicWebRevalidationRequest({
      fetchImpl,
      paths: [],
      reason,
      source: 'catalog',
      tags: [],
    });
  }

  return {
    attempted: results.some((result) => result.attempted),
    pathCount: paths.length,
    paths,
    skipped: results.every((result) => result.skipped),
    tagCount: tags.length,
    tags,
  };
}

export async function revalidatePublicWeb({
  fetchImpl = fetch,
  paths = [],
  reason,
  tags = [],
}: {
  fetchImpl?: typeof fetch;
  paths?: readonly string[];
  reason?: string;
  tags?: readonly string[];
}): Promise<PublicWebRevalidationResult> {
  const normalizedPaths = [
    ...new Set(
      paths
        .map(normalizeRevalidationPath)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const normalizedTags = [...new Set(tags)];

  const batches = batchRevalidationPayloads({
    paths: normalizedPaths,
    reason: reason ?? 'manual_revalidation',
    tags: normalizedTags,
  });
  const results: PublicWebRevalidationResult[] = [];

  for (const batch of batches) {
    results.push(
      await sendPublicWebRevalidationRequest({
        fetchImpl,
        paths: batch.paths,
        reason,
        source: 'generic',
        tags: batch.tags,
      }),
    );
  }

  if (results.length === 0) {
    return sendPublicWebRevalidationRequest({
      fetchImpl,
      paths: [],
      reason,
      source: 'generic',
      tags: [],
    });
  }

  return {
    attempted: results.some((result) => result.attempted),
    pathCount: normalizedPaths.length,
    paths: normalizedPaths,
    skipped: results.every((result) => result.skipped),
    tagCount: normalizedTags.length,
    tags: normalizedTags,
  };
}

export async function revalidatePublicCatalogPriceChanges({
  changedSetIds,
  changedSetSlugs = [],
  fetchImpl = fetch,
  reason,
}: {
  changedSetIds: readonly string[];
  changedSetSlugs?: readonly string[];
  fetchImpl?: typeof fetch;
  reason: string;
}): Promise<PublicWebRevalidationResult> {
  const isLargePriceChangeBatch =
    changedSetIds.length > largePriceChangeSetCountThreshold;
  const allSetPaths = changedSetSlugs
    .map((slug) => normalizeRevalidationPath(buildSetDetailPath(slug)))
    .filter((path): path is string => Boolean(path));
  const setPaths = isLargePriceChangeBatch
    ? allSetPaths.slice(0, largePriceChangeExplicitSetPathLimit)
    : allSetPaths;
  const paths = [webPathnames.home, webPathnames.deals, ...setPaths];
  const broadTags = [
    cacheTags.homepage(),
    cacheTags.deals(),
    cacheTags.prices(),
    cacheTags.catalog(),
  ];
  const tags = isLargePriceChangeBatch
    ? broadTags
    : [
        ...broadTags,
        ...changedSetIds.map((setId) => cacheTags.set(setId)),
        ...changedSetSlugs.map((slug) => cacheTags.set(slug)),
      ];

  console.info('[public-web-revalidation] price changes', {
    changed_set_count: changedSetIds.length,
    explicit_set_path_limit: isLargePriceChangeBatch
      ? largePriceChangeExplicitSetPathLimit
      : undefined,
    large_batch_guard: isLargePriceChangeBatch,
    omitted_set_path_count: Math.max(0, allSetPaths.length - setPaths.length),
    omitted_set_tag_count: isLargePriceChangeBatch
      ? changedSetIds.length + changedSetSlugs.length
      : 0,
    reason,
    revalidated_set_path_count: setPaths.length,
    set_slug_sample: changedSetSlugs.slice(0, loggedValueLimit),
    tag_count: tags.length,
  });

  return revalidatePublicWeb({
    fetchImpl,
    paths,
    reason,
    tags,
  });
}
