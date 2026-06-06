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

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

describe('deals page snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dealsPageMocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 0,
      },
      setCards: [],
      totalSetCount: 0,
    });
  });

  it('reads /deals from deal snapshots without live commerce rail loaders', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 41,
        averageDiscountPercent: 18,
        highestDiscountPercent: 33,
        lowestPricePerBrickMinor: 7,
      },
      setCards: [
        {
          id: '10307',
          name: 'Eiffeltoren',
          pieces: 10001,
          priceContext: {
            coverageLabel: '2 actuele winkels',
            currentPrice: 'Vanaf €100,00',
            decisionLabel: 'Sterke deal',
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
        priceContext: expect.objectContaining({
          currentPrice: 'Vanaf €100,00',
          decisionLabel: 'Sterke deal',
        }),
        variant: 'featured',
      }),
    );
  });

  it('renders pagination with the active sort query', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 80,
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

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        searchParams: Promise.resolve({ sort: 'price-per-brick' }),
      }),
    );

    expect(dealsPageMocks.catalogBrowsePagination).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '/deals/prijs-per-steen',
        currentPage: 1,
        pageCount: 2,
      }),
    );
    expect(dealsPageMocks.catalogBrowsePagination).toHaveBeenCalledWith(
      expect.not.objectContaining({
        queryParams: expect.anything(),
      }),
    );
  });

  it('uses a full-width light-blue hero instead of discovery tile variants', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(markup).not.toContain('--deals-page-surface:');
    expect(markup).not.toContain('--deals-page-surface:#00a99d');

    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/deals/deals-page.module.css'),
      'utf-8',
    );

    expect(css).toContain('--deals-page-surface: var(--lego-surface-accent);');
    expect(css).toContain('font-size: clamp(2rem, 1.55rem + 1.6vw, 3.2rem);');
    expect(css).toContain('width: 100%;');
    expect(css).not.toContain('max-width: min(70rem, 100%);');
  });

  it('renders the calm hero CTA to the deal collection section', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(markup).toContain('Bekijk deals');
    expect(markup).toContain('href="#deals-collection"');
    expect(markup).toContain('id="deals-collection"');
  });

  it('renders snapshot deal stats and discovery tile navigation', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 1234,
        averageDiscountPercent: 21,
        highestDiscountPercent: 45,
        lowestPricePerBrickMinor: 6,
      },
      setCards: [],
      totalSetCount: 1234,
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(markup).toContain('1.234');
    expect(markup).toContain('21%');
    expect(markup).toContain('45%');
    expect(markup).toContain('6 cent');
    expect(markup).toContain('Nieuwe deals');
    expect(markup).toContain('Premium deals');
    expect(markup).toContain('Onder €20');
    const discoveryStart = markup.indexOf('Ontdek deals op jouw manier');
    const discoveryEnd = markup.indexOf('id="deals-collection"');
    const discoveryMarkup = markup.slice(
      Math.max(0, discoveryStart - 700),
      discoveryEnd,
    );
    expect(discoveryMarkup).toContain('sectionShellInverse');
    expect(discoveryMarkup).toContain('sectionHeaderInverse');
    expect(markup).toContain('/deals/nieuwe-deals#deals-collection');
    expect(markup).toContain('/deals/grootste-kortingen#deals-collection');
    expect(markup).toContain('/deals/prijs-per-steen#deals-collection');
    expect(markup).toContain('/deals/onder-50#deals-collection');
    expect(markup).toContain('/deals/onder-20#deals-collection');
    expect(markup).toContain('/deals/premium#deals-collection');
    expect(markup).toContain('href="/deals#deals-collection"');
    expect(markup).not.toContain('/deals?sort=');
    expect(markup.match(/data-visual-tile=/gu)).toHaveLength(7);
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/76454-1/155297.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/75416-1/154252.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/77071-1/143092.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/31165-1/149769.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/43269-1/155014.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/77244-1/148260.jpg',
    );
    expect(markup).toContain(
      'https://cdn.rebrickable.com/media/sets/10350-1/149051.jpg',
    );
  });

  it('marks the active deal discovery tile and keeps legacy aliases active', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(
      await pageModule.default({
        searchParams: Promise.resolve({ sort: 'discount-desc' }),
      }),
    );

    expect(markup).toContain('data-visual-tile="largest-discount"');
    expect(markup).toContain('aria-current="page"');
    expect(markup.match(/aria-current="page"/gu)).toHaveLength(1);
  });

  it('removes the old pill filter area', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));
    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/deals/deals-page.module.css'),
      'utf-8',
    );

    expect(markup).not.toContain('Extra deal categorieen');
    expect(css).not.toContain('.dealNavLink');
    expect(css).not.toContain('.secondaryDealNavLink');
  });

  it('renders the snapshot grid below the discovery rail', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
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
      totalSetCount: 1,
    });

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(await pageModule.default({}));

    expect(markup.indexOf('Ontdek deals op jouw manier')).toBeLessThan(
      markup.indexOf('id="deals-collection"'),
    );
    expect(dealsPageMocks.catalogSetCard).toHaveBeenCalledWith(
      expect.objectContaining({
        href: '/sets/eiffel-tower-10307',
        variant: 'featured',
      }),
    );
  });

  it('does not include sibling fade behavior for the deal discovery rail', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/deals/deals-page.module.css'),
      'utf-8',
    );

    expect(css).not.toContain('opacity: 0.35;');
    expect(css).not.toContain('.discoveryTileTrack:hover > *');
    expect(css).not.toContain('.discoveryTileTrack:focus-within > *');
    expect(css).not.toContain('transition: opacity 170ms');
  });

  it('emits unique metadata and canonical URLs for sorted deal pages', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({ sort: 'price-per-brick' }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals/prijs-per-steen',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals/prijs-per-steen',
      },
      description: expect.stringContaining('prijs per steen'),
      title: 'Beste LEGO prijs per steen',
    });
  });

  it('emits page-one deals canonical metadata without a page query', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals',
      },
    });
  });

  it('emits paginated deals metadata canonicals for recommended pages', async () => {
    const pageModule = await import('./page');
    const pageTwoMetadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({ page: '2' }),
    });
    const pageSevenMetadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({ page: '7' }),
    });

    expect(pageTwoMetadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals?page=2',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals?page=2',
      },
    });
    expect(pageSevenMetadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals?page=7',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals?page=7',
      },
    });
  });

  it('preserves sorted deals canonicals on paginated pages', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({
        page: '3',
        sort: 'largest-discount',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals/grootste-kortingen?page=3',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals/grootste-kortingen?page=3',
      },
      title: 'Grootste LEGO korting',
    });
  });

  it('normalizes invalid deals page values to the page-one canonical', async () => {
    const pageModule = await import('./page');
    const metadata = await pageModule.generateMetadata({
      searchParams: Promise.resolve({
        page: 'geen-pagina',
      }),
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/deals',
      },
      openGraph: {
        url: 'https://www.brickhunt.nl/deals',
      },
    });
  });

  it('renders an intentional empty state when a fresh snapshot has total_count=0', async () => {
    dealsPageMocks.getCatalogDealPageSnapshot.mockResolvedValue({
      snapshotGeneratedAt: new Date().toISOString(),
      stats: {
        activeDealCount: 0,
      },
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
      totalSetCount: 1,
    });

    const pageModule = await import('./page');

    await expect(pageModule.default({})).rejects.toThrow('NEXT_NOT_FOUND');

    expect(dealsPageMocks.notFound).toHaveBeenCalled();
    expect(dealsPageMocks.catalogSetCard).not.toHaveBeenCalled();
  });
});
