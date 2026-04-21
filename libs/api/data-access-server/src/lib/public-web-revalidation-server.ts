import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildThemePath,
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

export function buildPublicCatalogRevalidationPaths({
  includeHome = true,
  includeThemeDirectory = true,
  targets,
}: {
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

export async function revalidatePublicCatalogPaths({
  fetchImpl = fetch,
  includeHome = true,
  includeThemeDirectory = true,
  reason,
  targets,
}: {
  fetchImpl?: typeof fetch;
  includeHome?: boolean;
  includeThemeDirectory?: boolean;
  reason?: string;
  targets: readonly PublicWebCatalogRevalidationTarget[];
}): Promise<PublicWebCatalogRevalidationResult> {
  const paths = buildPublicCatalogRevalidationPaths({
    includeHome,
    includeThemeDirectory,
    targets,
  });

  if (paths.length === 0 || !hasPublicWebRevalidationConfig()) {
    return {
      attempted: false,
      pathCount: paths.length,
      paths,
      skipped: true,
    };
  }

  const revalidationConfig = getPublicWebRevalidationConfig();
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
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Public web revalidation failed with status ${response.status}.`,
    );
  }

  return {
    attempted: true,
    pathCount: paths.length,
    paths,
    skipped: false,
  };
}
