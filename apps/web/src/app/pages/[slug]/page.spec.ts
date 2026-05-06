import { describe, expect, it, vi } from 'vitest';

const pageMocks = vi.hoisted(() => ({
  getEditorialPageBySlug: vi.fn(),
  listEditorialPageSlugs: vi.fn(),
}));

vi.mock('@lego-platform/content/data-access', () => ({
  getEditorialPageBySlug: pageMocks.getEditorialPageBySlug,
  listEditorialPageSlugs: pageMocks.listEditorialPageSlugs,
}));

vi.mock('@lego-platform/content/feature-page-renderer', () => ({
  ContentFeaturePageRenderer: () => null,
}));

vi.mock('@lego-platform/shell/web', () => ({
  ShellWeb: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: vi.fn(async () => ({ isEnabled: false })),
}));

describe('CMS page metadata', () => {
  it('canonicalizes CMS pages to the served /pages/[slug] route', async () => {
    pageMocks.getEditorialPageBySlug.mockResolvedValue({
      id: 'about',
      pageType: 'page',
      sections: [],
      seo: {
        description: 'Alles over Brickhunt.',
        noIndex: false,
        title: 'Over Brickhunt',
      },
      slug: 'about',
      title: 'Over Brickhunt',
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'about' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://www.brickhunt.nl/pages/about',
    );
    expect(metadata.openGraph?.url).toBe(
      'https://www.brickhunt.nl/pages/about',
    );
  });

  it('keeps CMS noIndex pages noindex while preserving canonical metadata', async () => {
    pageMocks.getEditorialPageBySlug.mockResolvedValue({
      id: 'private-page',
      pageType: 'page',
      sections: [],
      seo: {
        description: 'Deze pagina is niet openbaar bedoeld.',
        noIndex: true,
        title: 'Private page',
      },
      slug: 'private-page',
      title: 'Private page',
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'private-page' }),
    });

    expect(metadata).toMatchObject({
      title: 'Private page',
      description: 'Deze pagina is niet openbaar bedoeld.',
      alternates: {
        canonical: 'https://www.brickhunt.nl/pages/private-page',
      },
      robots: {
        follow: false,
        index: false,
      },
      openGraph: {
        title: 'Private page',
        url: 'https://www.brickhunt.nl/pages/private-page',
      },
    });
  });
});
