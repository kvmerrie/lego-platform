import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const merchantsPageMocks = vi.hoisted(() => ({
  getActiveCommerceMerchantsOverview: vi.fn(),
}));

vi.mock('@lego-platform/catalog/data-access-web', () => ({
  getActiveCommerceMerchantsOverview:
    merchantsPageMocks.getActiveCommerceMerchantsOverview,
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogMerchantBrand: ({
    merchant,
  }: {
    merchant: { merchantLabel: string };
  }) => <span>{merchant.merchantLabel}</span>,
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
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

function merchantOverviewItem({
  name,
  publicSlug,
  slug,
}: {
  name: string;
  publicSlug: string;
  slug: string;
}) {
  return {
    bestSavingsMinor: undefined,
    comparableDealCount: 0,
    dealCount: 0,
    merchant: {
      createdAt: '2026-06-12T09:00:00.000Z',
      id: `merchant-${slug}`,
      isActive: true,
      name,
      notes: '',
      publicSlug,
      seoPresentation: {
        canonicalUrl: `https://www.brickhunt.nl/winkels/${publicSlug}`,
        displayName: name,
        publicSlug,
      },
      slug,
      sourceType: 'affiliate',
      updatedAt: '2026-06-12T09:00:00.000Z',
    },
    offerCount: 0,
    onlyAtMerchantDealCount: 0,
    previewDeals: [],
    snapshotMissing: false,
  };
}

describe('merchants overview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links LEGO merchant cards to the public LEGO slug', async () => {
    merchantsPageMocks.getActiveCommerceMerchantsOverview.mockResolvedValue([
      merchantOverviewItem({
        name: 'LEGO®',
        publicSlug: 'lego',
        slug: 'rakuten-lego-eu',
      }),
    ]);
    const pageModule = await import('./page');

    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('href="/winkels/lego"');
    expect(markup).toContain('LEGO®');
    expect(markup).not.toContain('/winkels/rakuten-lego-eu');
  });

  it('keeps merchant cards without a public slug override on their own slug', async () => {
    merchantsPageMocks.getActiveCommerceMerchantsOverview.mockResolvedValue([
      merchantOverviewItem({
        name: 'Goodbricks',
        publicSlug: 'goodbricks',
        slug: 'goodbricks',
      }),
    ]);
    const pageModule = await import('./page');

    const markup = renderToStaticMarkup(await pageModule.default());

    expect(markup).toContain('href="/winkels/goodbricks"');
  });
});
