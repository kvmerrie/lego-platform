import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';

export const homepageEditorialPage: EditorialPage = {
  id: 'home',
  pageType: 'homepage',
  title: 'Brick Ledger',
  seo: {
    title: 'Brick Ledger | Compare LEGO set prices, offers, and saves',
    description:
      'Browse standout LEGO sets, compare reviewed Dutch shop prices, and keep track of what you own or still want.',
  },
  sections: [
    {
      id: 'home-hero',
      type: 'hero',
      eyebrow: 'Collector guide',
      title: 'Find the right set before you buy.',
      body: 'Brick Ledger brings together standout sets, reviewed shop prices, and private save tools so collectors can decide faster.',
      ctaLabel: 'Explore by theme',
      ctaHref: '#explore-themes',
    },
    {
      id: 'home-foundation',
      type: 'richText',
      eyebrow: 'Why it helps',
      title: 'One set page, the details that matter.',
      body: 'Open a set page to see why it stands out, where reviewed prices sit today, and which shops are closest on price.',
    },
    {
      id: 'home-callout',
      type: 'callout',
      eyebrow: 'Worth checking',
      title: 'Simple price guidance, not noise.',
      body: 'We keep the buying read clear: current reviewed price, best current deal, and a clean shop comparison.',
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
        'Learn how Brick Ledger helps LEGO collectors browse, compare, and keep track of standout sets.',
    },
    sections: [
      {
        id: 'about-hero',
        type: 'hero',
        eyebrow: 'About',
        title:
          'Brick Ledger is built for collectors who want a clear read before they click out.',
        body: 'The product stays intentionally focused: browse strong sets, compare reviewed prices, and keep private saves close at hand.',
      },
      {
        id: 'about-principles',
        type: 'richText',
        eyebrow: 'Principles',
        title: 'The product should stay useful before it gets bigger.',
        body: 'Catalog pages, price checks, and private saves come first. Editorial depth can grow around that core without turning the product into a content shell.',
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
