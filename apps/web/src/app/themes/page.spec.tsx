import { renderToStaticMarkup } from 'react-dom/server';
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

  it('keeps the themes hub visual independent from discovery tile variants', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('data-testid="theme-index"');
    expect(themeIndexPageMocks.catalogFeatureThemeIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        visual: {
          backgroundColor: '#234bcd',
          textColor: '#ffffff',
        },
      }),
    );
    expect(
      themeIndexPageMocks.catalogFeatureThemeIndex,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        visual: expect.objectContaining({
          backgroundColor: '#8758d8',
        }),
      }),
    );
  });
});
