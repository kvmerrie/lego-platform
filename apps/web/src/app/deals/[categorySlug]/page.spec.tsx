import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dealCategoryPageMocks = vi.hoisted(() => ({
  catalogBrowsePagination: vi.fn(),
  catalogSetCard: vi.fn(),
  getCatalogDealPageSnapshot: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock('next/navigation', () => ({
  notFound: dealCategoryPageMocks.notFound,
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getCatalogDealPageSnapshot: dealCategoryPageMocks.getCatalogDealPageSnapshot,
}));

vi.mock('@lego-platform/catalog/ui', async () => {
  const actual = await vi.importActual<
    typeof import('@lego-platform/catalog/ui')
  >('@lego-platform/catalog/ui');

  return {
    ...actual,
    CatalogBrowsePagination: (props: unknown) => {
      dealCategoryPageMocks.catalogBrowsePagination(props);
      return <nav data-testid="pagination" />;
    },
    CatalogSetCard: (props: unknown) => {
      dealCategoryPageMocks.catalogSetCard(props);
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

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

describe('deal category route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dealCategoryPageMocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    dealCategoryPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 1,
      },
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
  });

  it('renders a valid path-based deal category route', async () => {
    const pageModule = await import('./page');

    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({
          categorySlug: 'grootste-kortingen',
        }),
      }),
    );

    expect(
      dealCategoryPageMocks.getCatalogDealPageSnapshot,
    ).toHaveBeenCalledWith({
      limit: 40,
      offset: 0,
      sortKey: 'largest-discount',
    });
    expect(dealCategoryPageMocks.catalogBrowsePagination).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '/deals/grootste-kortingen',
        currentPage: 1,
        pageCount: 2,
      }),
    );
    expect(dealCategoryPageMocks.catalogSetCard).toHaveBeenCalledWith(
      expect.objectContaining({
        href: '/sets/eiffel-tower-10307',
      }),
    );
  });

  it('returns notFound for an invalid deal category slug', async () => {
    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({
          categorySlug: 'niet-bestaand',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(dealCategoryPageMocks.notFound).toHaveBeenCalled();
    expect(
      dealCategoryPageMocks.getCatalogDealPageSnapshot,
    ).not.toHaveBeenCalled();
  });

  it('emits path-based category metadata canonicals', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({
        categorySlug: 'grootste-kortingen',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals/grootste-kortingen',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals/grootste-kortingen',
      },
      title: 'Grootste LEGO korting',
    });
  });

  it('emits paginated category metadata canonicals', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({
        categorySlug: 'grootste-kortingen',
      }),
      searchParams: Promise.resolve({
        page: '2',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals/grootste-kortingen?page=2',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals/grootste-kortingen?page=2',
      },
    });
  });
});
