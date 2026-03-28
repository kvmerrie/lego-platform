import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';

export const homepageEditorialPage: EditorialPage = {
  id: 'home',
  pageType: 'homepage',
  title: 'Brick Ledger',
  seo: {
    title: 'Brick Ledger | Collector intelligence for serious LEGO fans',
    description:
      'Explore a polished LEGO collector platform with catalog discovery, clean ownership tracking, and room for curated editorial storytelling.',
  },
  sections: [
    {
      id: 'home-hero',
      type: 'hero',
      eyebrow: 'Collector intelligence',
      title: 'A premium editorial layer for a modern LEGO collector platform.',
      body: 'Brick Ledger pairs catalog discovery with curated storytelling so the public experience can grow into richer landing pages without turning the catalog into CMS-managed data.',
      ctaLabel: 'Browse featured sets',
      ctaHref: '#featured-sets',
    },
    {
      id: 'home-foundation',
      type: 'richText',
      eyebrow: 'Editorial foundation',
      title: 'Keep storytelling flexible while core product data stays system-owned.',
      body: 'Homepage content is shaped like a future Contentful page, but the featured set list still comes from the catalog domain so editorial content never becomes the source of truth for collector data.',
    },
    {
      id: 'home-callout',
      type: 'callout',
      eyebrow: 'Phase 1.5',
      title: 'Start with stable sections, SEO fields, and safe fallbacks.',
      body: 'The initial CMS skeleton supports homepage storytelling and future editorial pages, while live Contentful fetching remains optional behind a mock-backed facade.',
    },
  ],
};

export const editorialPages: readonly EditorialPage[] = [
  {
    id: 'about',
    pageType: 'page',
    slug: 'about',
    title: 'About Brick Ledger',
    seo: {
      title: 'About Brick Ledger',
      description:
        'Learn how Brick Ledger approaches LEGO collecting with a focus on maintainable architecture, strong content foundations, and future editorial flexibility.',
    },
    sections: [
      {
        id: 'about-hero',
        type: 'hero',
        eyebrow: 'About',
        title: 'Brick Ledger is built to respect both collectors and the systems behind the product.',
        body: 'The platform starts narrow on purpose: browse sets, track ownership, and layer in editorial depth without collapsing product structure into page-specific code.',
      },
      {
        id: 'about-principles',
        type: 'richText',
        eyebrow: 'Principles',
        title: 'Editorial pages should be curated, ordered, and SEO-aware.',
        body: 'Contentful will eventually power flexible pages and sections, but the catalog, pricing, and user state remain domain-owned so content management never replaces business truth.',
      },
    ],
  },
];

export const previewPanel: PreviewPanel = {
  status: 'Preview flow reserved for a later phase',
  summary:
    'The content domain keeps a placeholder preview surface so Next draft mode and Contentful preview tokens can be added cleanly later.',
  updatedAt: 'Not enabled yet',
};
