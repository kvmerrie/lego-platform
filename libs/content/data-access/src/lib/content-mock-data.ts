import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';

export const homepageEditorialPage: EditorialPage = {
  id: 'home',
  pageType: 'homepage',
  title: 'Brickhunt',
  seo: {
    title: 'Brickhunt – LEGO sets kiezen, vergelijken en bewaren',
    description:
      'Van Rivendell tot AT-AT: vind sneller de LEGO-doos die je wilt hebben.',
  },
  sections: [
    {
      id: 'home-hero',
      type: 'hero',
      eyebrow: 'Van Rivendell tot McLaren P1',
      title: 'Welke doos wil je?',
      body: 'Kies sneller welke doos je wilt bouwen, neerzetten of nu wilt kopen.',
      ctaLabel: 'Bekijk LEGO-werelden',
      ctaHref: '#explore-themes',
    },
    {
      id: 'home-foundation',
      type: 'richText',
      eyebrow: 'Minifigs, schaal, details',
      title: 'Zie wat blijft.',
      body: 'Council of Elrond. Marvel-minifigs. Een AT-AT-silhouet. Meer heb je niet nodig.',
    },
    {
      id: 'home-callout',
      type: 'callout',
      eyebrow: 'Als de prijs meehelpt',
      title: 'Nu zakt die doos.',
      body: 'Voor die modular, walker of botanical die al weken blijft hangen.',
    },
  ],
};

export const editorialPages: readonly EditorialPage[] = [
  {
    id: 'about',
    pageType: 'page',
    slug: 'about',
    title: 'Over Brickhunt',
    seo: {
      title: 'Over Brickhunt',
      description:
        'Lees hoe Brickhunt LEGO-verzamelaars helpt sneller te kiezen, vergelijken en bewaren.',
    },
    sections: [
      {
        id: 'about-hero',
        type: 'hero',
        eyebrow: 'Over Brickhunt',
        title:
          'Brickhunt is er voor verzamelaars die snel willen kiezen welke set ze willen hebben.',
        body: 'We houden het bewust simpel: sets vinden, prijzen vergelijken die we hebben nagekeken en je eigen lijstjes bijhouden.',
      },
      {
        id: 'about-principles',
        type: 'richText',
        eyebrow: 'Uitgangspunt',
        title: 'Eerst nuttig, dan groter.',
        body: 'Setpagina’s, prijsinfo en lijstjes moeten je eerst echt helpen kiezen. Daarna breiden we uit. Extra verhalen en tools mogen helpen, maar nemen dat niet over.',
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
