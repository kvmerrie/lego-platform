import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const themeIndexPageMocks = vi.hoisted(() => ({
  catalogFeatureThemeIndex: vi.fn(),
  getCachedPublicLandingPageData: vi.fn(),
  listCatalogThemeDirectoryItems: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  listCatalogThemeDirectoryItems:
    themeIndexPageMocks.listCatalogThemeDirectoryItems,
}));

vi.mock('@lego-platform/catalog/feature-theme-page', () => ({
  CatalogFeatureThemeIndex: (props: unknown) => {
    themeIndexPageMocks.catalogFeatureThemeIndex(props);

    return <main data-testid="theme-index" />;
  },
}));

vi.mock('../lib/public-landing-page-cache', () => ({
  getCachedPublicLandingPageData:
    themeIndexPageMocks.getCachedPublicLandingPageData,
}));

vi.mock('@lego-platform/shared/config', () => ({
  buildCanonicalUrl: (path: string) => `https://www.brickhunt.nl${path}`,
  buildWebPath: (path: string) => path,
  cacheTags: {
    catalog: () => 'catalog',
    sets: () => 'sets',
    themes: () => 'themes',
  },
  webPathnames: {
    themes: '/themes',
  },
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('themes index page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeIndexPageMocks.listCatalogThemeDirectoryItems.mockResolvedValue([]);
    themeIndexPageMocks.getCachedPublicLandingPageData.mockImplementation(
      async ({ load }) => load(),
    );
  });

  it('uses the default light-blue hero instead of discovery tile variants', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('data-testid="theme-index"');
    expect(themeIndexPageMocks.catalogFeatureThemeIndex).toHaveBeenCalled();
    expect(
      themeIndexPageMocks.catalogFeatureThemeIndex.mock.calls[0]?.[0] as {
        visual?: unknown;
      },
    ).not.toHaveProperty('visual');
    expect(markup).not.toContain('--theme-index-surface:');

    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/catalog/feature-theme-page/src/lib/catalog-feature-theme-index.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('--theme-index-surface: var(--lego-surface-accent);');
  });
});
