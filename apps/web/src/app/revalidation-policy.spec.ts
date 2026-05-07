import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const workspaceRoot = join(__dirname, '../../../..');

const allowedForceDynamicFiles = new Set([
  'apps/web/src/app/api/admin/commerce-rails-diagnostics/route.ts',
  'apps/web/src/app/api/catalog/search-suggestions/route.ts',
  'apps/web/src/app/api/catalog/set-cards/route.ts',
  'apps/web/src/app/api/events/article-click/route.ts',
  'apps/web/src/app/api/revalidate/route.ts',
  'apps/web/src/app/artikelen/preview/[previewId]/page.tsx',
  'apps/web/src/app/search/page.tsx',
]);

const allowedRevalidateZeroFiles = new Set([
  'apps/web/src/app/api/admin/commerce-rails-diagnostics/route.ts',
  'apps/web/src/app/artikelen/preview/[previewId]/page.tsx',
]);

const allowedNoStoreFiles = new Set([
  'apps/web/src/app/sets/[slug]/page.tsx',
  'libs/catalog/data-access-web/src/lib/catalog-effective-data-access-browser.ts',
  'libs/collection/data-access/src/lib/collection-data-access.ts',
  'libs/shell/web/src/lib/shell-web-search-form.tsx',
  'libs/user/data-access/src/lib/user-data-access.ts',
  'libs/wishlist/data-access/src/lib/wishlist-data-access.ts',
]);

function findPolicyMatches(pattern: RegExp): string[] {
  const files = ['apps', 'libs'].flatMap((rootDirectory) =>
    listSourceFiles(join(workspaceRoot, rootDirectory)),
  );

  return files
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(workspaceRoot, file))
    .sort();
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entryName) => {
    const entryPath = join(directory, entryName);
    const entryStats = statSync(entryPath);

    if (entryStats.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    if (!/\.(ts|tsx)$/.test(entryName) || /\.spec\.(ts|tsx)$/.test(entryName)) {
      return [];
    }

    return [entryPath];
  });
}

describe('web revalidation policy', () => {
  test('keeps force-dynamic usage intentionally allowlisted', () => {
    expect(findPolicyMatches(/dynamic\s*=\s*['"]force-dynamic/)).toEqual(
      [...allowedForceDynamicFiles].sort(),
    );
  });

  test('keeps revalidate zero usage intentionally allowlisted', () => {
    expect(findPolicyMatches(/revalidate\s*=\s*0/)).toEqual(
      [...allowedRevalidateZeroFiles].sort(),
    );
  });

  test('keeps no-store usage limited to utility or personalized reads', () => {
    expect(findPolicyMatches(/cache:\s*['"]no-store/)).toEqual(
      [...allowedNoStoreFiles].sort(),
    );
  });
});
