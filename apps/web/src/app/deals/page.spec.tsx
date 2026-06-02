import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dealsPageMocks = vi.hoisted(() => ({
  catalogBrowsePagination: vi.fn(),
  catalogSetCard: vi.fn(),
  getCatalogDealPageSnapshot: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogDealPageSnapshot: dealsPageMocks.getCatalogDealPageSnapshot,
}));

vi.mock('next/navigation', () => ({
  notFound: dealsPageMocks.notFound,
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
    dealsPageMocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      setCards: [],
      totalSetCount: 0,
    });
  });

  it('reads /deals from deal snapshots without live commerce rail loaders', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
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
      snapshotGeneratedAt: new Date().toISOString(),
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

  it('renders an intentional empty state when a fresh snapshot has total_count=0', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      setCards: [],
      totalSetCount: 0,
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(dealsPageMocks.notFound).not.toHaveBeenCalled();
    expect(markup).toContain('De deal-snapshot is nog leeg');
  });

  it('does not render an indexable empty page when the deal snapshot is missing', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue(undefined);

    const pageModule = await import('./page');

    await expect(pageModule.default({})).rejects.toThrow('NEXT_NOT_FOUND');

    expect(dealsPageMocks.notFound).toHaveBeenCalled();
    expect(dealsPageMocks.catalogSetCard).not.toHaveBeenCalled();
  });

  it('does not render a normal indexable page when the deal snapshot is stale', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: '2020-01-01T00:00:00.000Z',
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
      totalSetCount: 1,
    });

    const pageModule = await import('./page');

    await expect(pageModule.default({})).rejects.toThrow('NEXT_NOT_FOUND');

    expect(dealsPageMocks.notFound).toHaveBeenCalled();
    expect(dealsPageMocks.catalogSetCard).not.toHaveBeenCalled();
  });
});
