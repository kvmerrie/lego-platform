import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const merchantPageMocks = vi.hoisted(() => ({
  catalogSetCard: vi.fn(),
  getMerchantDeals: vi.fn(),
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getMerchantDeals: merchantPageMocks.getMerchantDeals,
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogSectionShell: ({
    children,
    title,
  }: {
    children?: React.ReactNode;
    title?: string;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  CatalogSetCard: (props: unknown) => {
    merchantPageMocks.catalogSetCard(props);
    return <article data-testid="merchant-deal-card" />;
  },
  CatalogSetCardCollection: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: () => <button type="button">wishlist</button>,
}));

vi.mock('next/navigation', () => ({
  notFound: merchantPageMocks.notFound,
  permanentRedirect: merchantPageMocks.permanentRedirect,
}));

function createMerchantDeals(overrides: Record<string, unknown> = {}) {
  return {
    bestDealCount: 0,
    comparableDeals: [],
    dealCount: 0,
    merchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: 'merchant-goodbricks',
      isActive: true,
      name: 'Goodbricks',
      notes: '',
      publicSlug: 'goodbricks',
      seoPresentation: {
        canonicalUrl: 'https://www.brickhunt.nl/winkels/goodbricks',
        displayName: 'Goodbricks',
        publicSlug: 'goodbricks',
      },
      slug: 'goodbricks',
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    offerCount: 0,
    onlyAtMerchantDealCount: 0,
    onlyAtMerchantDeals: [],
    snapshotMissing: false,
    ...overrides,
  };
}

function createDeal() {
  return {
    checkedAt: '2026-06-12T09:55:00.000Z',
    comparedMerchantCount: 3,
    currencyCode: 'EUR',
    latestOfferId: 'latest-goodbricks-10316',
    merchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: 'merchant-goodbricks',
      isActive: true,
      name: 'Goodbricks',
      notes: '',
      publicSlug: 'goodbricks',
      seoPresentation: {
        canonicalUrl: 'https://www.brickhunt.nl/winkels/goodbricks',
        displayName: 'Goodbricks',
        publicSlug: 'goodbricks',
      },
      slug: 'goodbricks',
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    nextBestMerchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: 'merchant-bol',
      isActive: true,
      name: 'bol',
      notes: '',
      publicSlug: 'bol',
      seoPresentation: {
        canonicalUrl: 'https://www.brickhunt.nl/winkels/bol',
        displayName: 'bol',
        publicSlug: 'bol',
      },
      slug: 'bol',
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    nextBestPriceMinor: 10_000,
    offerSeedId: 'seed-goodbricks-10316',
    priceMinor: 8_000,
    productUrl: 'https://goodbricks.example/10316',
    savingsMinor: 2_000,
    savingsPercentage: 20,
    set: {
      id: '10316',
      imageUrl: 'https://images.example/10316.jpg',
      name: 'Rivendell',
      pieces: 6167,
      releaseDatePrecision: 'year',
      releaseYear: 2023,
      slug: 'rivendell-10316',
      theme: 'Icons',
    },
  };
}

describe('merchant deals page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    merchantPageMocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    merchantPageMocks.permanentRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    merchantPageMocks.getMerchantDeals.mockResolvedValue(createMerchantDeals());
  });

  it('renders the empty state when a merchant has no comparable deals', async () => {
    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({ merchantSlug: 'goodbricks' }),
      }),
    );

    expect(markup).toContain('LEGO aanbiedingen bij Goodbricks');
    expect(markup).toContain(
      'Deze winkel is nu niet goedkoper dan een volgende winkel',
    );
    expect(markup).not.toContain('Alleen bij deze winkel');
    expect(merchantPageMocks.catalogSetCard).not.toHaveBeenCalled();
  });

  it('renders the LEGO merchant page from the public lego slug', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(
      createMerchantDeals({
        merchant: {
          createdAt: '2026-06-12T09:00:00.000Z',
          id: 'merchant-rakuten-lego-eu',
          isActive: true,
          name: 'LEGO®',
          notes: '',
          publicSlug: 'lego',
          seoPresentation: {
            canonicalUrl: 'https://www.brickhunt.nl/winkels/lego',
            displayName: 'LEGO®',
            publicSlug: 'lego',
            seoDescription:
              'Vergelijk actuele LEGO prijzen en aanbiedingen bij de officiële LEGO winkel op Brickhunt.',
            seoTitle: 'LEGO aanbiedingen en prijzen vergelijken',
            shortDescription:
              'Officiële LEGO winkel met actuele prijzen en aanbiedingen.',
          },
          slug: 'rakuten-lego-eu',
          sourceType: 'affiliate',
          updatedAt: '2026-06-12T09:00:00.000Z',
        },
      }),
    );

    const pageModule = await import('./page');
    const markup = renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({ merchantSlug: 'lego' }),
      }),
    );

    expect(merchantPageMocks.getMerchantDeals).toHaveBeenCalledWith('lego');
    expect(markup).toContain('LEGO aanbiedingen bij LEGO®');
    expect(markup).toContain(
      'Officiële LEGO winkel met actuele prijzen en aanbiedingen.',
    );
    expect(merchantPageMocks.permanentRedirect).not.toHaveBeenCalled();
  });

  it('redirects the legacy Rakuten LEGO merchant route to the public LEGO route', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(
      createMerchantDeals({
        merchant: {
          createdAt: '2026-06-12T09:00:00.000Z',
          id: 'merchant-rakuten-lego-eu',
          isActive: true,
          name: 'LEGO®',
          notes: '',
          publicSlug: 'lego',
          seoPresentation: {
            canonicalUrl: 'https://www.brickhunt.nl/winkels/lego',
            displayName: 'LEGO®',
            publicSlug: 'lego',
          },
          slug: 'rakuten-lego-eu',
          sourceType: 'affiliate',
          updatedAt: '2026-06-12T09:00:00.000Z',
        },
      }),
    );
    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({ merchantSlug: 'rakuten-lego-eu' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(merchantPageMocks.permanentRedirect).toHaveBeenCalledWith(
      '/winkels/lego',
    );
  });

  it('uses merchant SEO metadata for title, description, and canonical URL', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(
      createMerchantDeals({
        merchant: {
          createdAt: '2026-06-12T09:00:00.000Z',
          id: 'merchant-rakuten-lego-eu',
          isActive: true,
          name: 'LEGO®',
          notes: '',
          publicSlug: 'lego',
          seoPresentation: {
            canonicalUrl: 'https://www.brickhunt.nl/winkels/lego',
            displayName: 'LEGO®',
            publicSlug: 'lego',
            seoDescription:
              'Vergelijk actuele LEGO prijzen en aanbiedingen bij de officiële LEGO winkel op Brickhunt.',
            seoTitle: 'LEGO aanbiedingen en prijzen vergelijken',
          },
          slug: 'rakuten-lego-eu',
          sourceType: 'affiliate',
          updatedAt: '2026-06-12T09:00:00.000Z',
        },
      }),
    );
    const pageModule = await import('./page');

    await expect(
      pageModule.generateMetadata({
        params: Promise.resolve({ merchantSlug: 'lego' }),
      }),
    ).resolves.toMatchObject({
      alternates: {
        canonical: 'https://www.brickhunt.nl/winkels/lego',
      },
      description:
        'Vergelijk actuele LEGO prijzen en aanbiedingen bij de officiële LEGO winkel op Brickhunt.',
      openGraph: {
        description:
          'Vergelijk actuele LEGO prijzen en aanbiedingen bij de officiële LEGO winkel op Brickhunt.',
        title: 'LEGO aanbiedingen en prijzen vergelijken',
        url: 'https://www.brickhunt.nl/winkels/lego',
      },
      title: 'LEGO aanbiedingen en prijzen vergelijken',
    });
  });

  it('passes set detail href and affiliate CTA context to existing deal cards', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(
      createMerchantDeals({
        bestDealCount: 1,
        comparableDeals: [createDeal()],
        dealCount: 1,
        offerCount: 3,
      }),
    );

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({ merchantSlug: 'goodbricks' }),
      }),
    );

    expect(merchantPageMocks.catalogSetCard).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaMode: 'commerce',
        href: '/sets/rivendell-10316',
        priceContext: expect.objectContaining({
          discountMetric: expect.stringContaining('20,00 goedkoper dan bol'),
          merchantLabel: 'Laagst bij Goodbricks',
          primaryActionHref: 'https://goodbricks.example/10316',
        }),
      }),
    );
  });

  it('labels only-found merchant cards without making a lowest-price claim', async () => {
    const onlyAtDeal = {
      ...createDeal(),
      nextBestMerchant: undefined,
      nextBestPriceMinor: undefined,
      savingsMinor: undefined,
      savingsPercentage: undefined,
    };

    merchantPageMocks.getMerchantDeals.mockResolvedValue(
      createMerchantDeals({
        dealCount: 1,
        offerCount: 1,
        onlyAtMerchantDealCount: 1,
        onlyAtMerchantDeals: [onlyAtDeal],
      }),
    );

    const pageModule = await import('./page');
    renderToStaticMarkup(
      await pageModule.default({
        params: Promise.resolve({ merchantSlug: 'goodbricks' }),
      }),
    );

    expect(merchantPageMocks.catalogSetCard).toHaveBeenCalledWith(
      expect.objectContaining({
        priceContext: expect.objectContaining({
          coverageLabel: 'Alleen bij deze winkel',
          decisionLabel: 'Alleen hier gevonden',
          merchantLabel: 'Alleen gevonden bij Goodbricks',
        }),
      }),
    );
    expect(
      merchantPageMocks.catalogSetCard.mock.calls[0]?.[0]?.priceContext
        ?.merchantLabel,
    ).not.toBe('Laagst bij Goodbricks');
  });

  it('returns notFound when the merchant is missing or inactive', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(null);
    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({ merchantSlug: 'inactive-shop' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns notFound for the deprecated lego-nl merchant route', async () => {
    merchantPageMocks.getMerchantDeals.mockResolvedValue(null);
    const pageModule = await import('./page');

    await expect(
      pageModule.default({
        params: Promise.resolve({ merchantSlug: 'lego-nl' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(merchantPageMocks.getMerchantDeals).toHaveBeenCalledWith('lego-nl');
  });
});
