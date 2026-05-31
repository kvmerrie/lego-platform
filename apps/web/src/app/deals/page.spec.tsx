import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dealsPageMocks = vi.hoisted(() => ({
  catalogBrowsePagination: vi.fn(),
  catalogSetCard: vi.fn(),
  getCatalogDealPageSnapshot: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogDealPageSnapshot: dealsPageMocks.getCatalogDealPageSnapshot,
}));

vi.mock('@lego-platform/catalog/ui', async () => {
  const actual = await vi.importActual<
    typeof import('@lego-platform/catalog/ui')
  >('@lego-platform/catalog/ui');

  return {
    ...actual,
    CatalogBrowsePagination: (props: unknown) => {
      dealsPageMocks.catalogBrowsePagination(props);
      return <nav data-testid="pagination" />;
    },
    CatalogSetCard: (props: unknown) => {
      dealsPageMocks.catalogSetCard(props);
      return <article data-testid="deal-card" />;
    },
  };
});

vi.mock('@lego-platform/shared/ui', async () => {
  const actual = await vi.importActual<
    typeof import('@lego-platform/shared/ui')
  >('@lego-platform/shared/ui');

  return {
    ...actual,
    SectionHeading: () => null,
  };
});

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

describe('deals page snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      setCards: [],
      totalSetCount: 0,
    });
  });

  it('reads /deals from deal snapshots without live commerce rail loaders', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      setCards: [
        {
          id: '10307',
          name: 'Eiffeltoren',
          pieces: 10001,
          priceContext: {
            coverageLabel: '2 actuele winkels',
            currentPrice: 'Vanaf €100,00',
            merchantLabel: 'Laagst bij MediaMarkt',
            reviewedLabel: 'Snapshot bijgewerkt',
          },
          releaseYear: 2022,
          slug: 'eiffel-tower-10307',
          theme: 'Icons',
        },
      ],
      totalSetCount: 41,
    });

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        searchParams: Promise.resolve({ page: '2', sort: 'discount-desc' }),
      }),
    );

    expect(dealsPageMocks.getCatalogDealPageSnapshot).toHaveBeenCalledWith({
      limit: 40,
      offset: 40,
      sortKey: 'discount-desc',
    });
    expect(dealsPageMocks.catalogSetCard).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaMode: 'commerce',
        href: '/sets/eiffel-tower-10307',
        variant: 'featured',
      }),
    );
  });

  it('renders pagination with the active sort query', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      setCards: [
        {
          id: '10307',
          name: 'Eiffeltoren',
          pieces: 10001,
          releaseYear: 2022,
          slug: 'eiffel-tower-10307',
          theme: 'Icons',
        },
      ],
      totalSetCount: 80,
    });

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        searchParams: Promise.resolve({ sort: 'price-per-brick' }),
      }),
    );

    expect(dealsPageMocks.catalogBrowsePagination).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '/deals',
        currentPage: 1,
        pageCount: 2,
        queryParams: { sort: 'price-per-brick' },
      }),
    );
  });

  it('uses the default light-blue hero instead of discovery tile variants', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(markup).not.toContain('--deals-page-surface:');
    expect(markup).not.toContain('--deals-page-surface:#00a99d');

    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/deals/deals-page.module.css'),
      'utf-8',
    );

    expect(css).toContain('--deals-page-surface: var(--lego-surface-accent);');
  });
});
