import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildThemePath,
  cacheTags,
  getPublicWebRevalidationConfig,
  hasPublicWebRevalidationConfig,
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
  'homepage',
  'deals',
  'prices',
  'sitemap',
]);
const loggedValueLimit = 12;

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
  paths,
  reason,
  skipped,
  source,
  tags,
}: {
  attempted: boolean;
  paths: readonly string[];
  reason?: string;
  skipped: boolean;
  source: 'catalog' | 'generic';
  tags: readonly string[];
}): void {
  const broadTags = getBroadRevalidationTags(tags);
  const pathSummary = summarizeValues(paths);
  const tagSummary = summarizeValues(tags);

  console.info('[public-web-revalidation] request', {
    attempted,
    broadTagCount: broadTags.length,
    pathCount: paths.length,
    pathSample: pathSummary.sample,
    pathSampleOmittedCount: pathSummary.omittedCount,
    reason,
    skipped,
    source,
    tagCount: tags.length,
    tagSample: tagSummary.sample,
    tagSampleOmittedCount: tagSummary.omittedCount,
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
  pathCount,
  reason,
  source,
  status,
  tagCount,
}: {
  durationMs: number;
  pathCount: number;
  reason?: string;
  source: 'catalog' | 'generic';
  status: number;
  tagCount: number;
}): void {
  console.info('[public-web-revalidation] response', {
    durationMs,
    pathCount,
    reason,
    source,
    status,
    tagCount,
  });
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

  if (
    (paths.length === 0 && tags.length === 0) ||
    !hasPublicWebRevalidationConfig()
  ) {
    logPublicWebRevalidationRequest({
      attempted: false,
      paths,
      reason,
      skipped: true,
      source: 'catalog',
      tags,
    });

    return {
      attempted: false,
      pathCount: paths.length,
      paths,
      skipped: true,
      tagCount: tags.length,
      tags,
    };
  }

  const revalidationConfig = getPublicWebRevalidationConfig();
  logPublicWebRevalidationRequest({
    attempted: true,
    paths,
    reason,
    skipped: false,
    source: 'catalog',
    tags,
  });
  const startedAt = Date.now();
  const response = await fetchImpl(
    `${revalidationConfig.webBaseUrl}/api/revalidate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': revalidationConfig.secret,
      },
      body: JSON.stringify({
        paths,
        reason,
        tags,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Public web revalidation failed with status ${response.status}.`,
    );
  }

  logPublicWebRevalidationResponse({
    durationMs: Date.now() - startedAt,
    pathCount: paths.length,
    reason,
    source: 'catalog',
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

  if (
    (normalizedPaths.length === 0 && normalizedTags.length === 0) ||
    !hasPublicWebRevalidationConfig()
  ) {
    logPublicWebRevalidationRequest({
      attempted: false,
      paths: normalizedPaths,
      reason,
      skipped: true,
      source: 'generic',
      tags: normalizedTags,
    });

    return {
      attempted: false,
      pathCount: normalizedPaths.length,
      paths: normalizedPaths,
      skipped: true,
      tagCount: normalizedTags.length,
      tags: normalizedTags,
    };
  }

  const revalidationConfig = getPublicWebRevalidationConfig();
  logPublicWebRevalidationRequest({
    attempted: true,
    paths: normalizedPaths,
    reason,
    skipped: false,
    source: 'generic',
    tags: normalizedTags,
  });
  const startedAt = Date.now();
  const response = await fetchImpl(
    `${revalidationConfig.webBaseUrl}/api/revalidate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': revalidationConfig.secret,
      },
      body: JSON.stringify({
        paths: normalizedPaths,
        reason,
        tags: normalizedTags,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Public web revalidation failed with status ${response.status}.`,
    );
  }

  logPublicWebRevalidationResponse({
    durationMs: Date.now() - startedAt,
    pathCount: normalizedPaths.length,
    reason,
    source: 'generic',
    status: response.status,
    tagCount: normalizedTags.length,
  });

  return {
    attempted: true,
    pathCount: normalizedPaths.length,
    paths: normalizedPaths,
    skipped: false,
    tagCount: normalizedTags.length,
    tags: normalizedTags,
  };
}
