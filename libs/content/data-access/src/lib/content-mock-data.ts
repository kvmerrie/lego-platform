import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';

export const homepageEditorialPage: EditorialPage = {
  id: 'home',
  pageType: 'homepage',
  title: 'Brickhunt',
  seo: {
    title: 'Brickhunt – LEGO sets kiezen, vergelijken en bewaren',
    description:
      'Van Rivendell tot AT-AT: vind sneller LEGO-sets die je wilt bouwen, neerzetten of bewaren.',
  },
  sections: [
    {
      id: 'home-hero',
      type: 'hero',
      eyebrow: 'Van Rivendell tot McLaren P1',
      title: 'Vind de LEGO-doos waar je plek voor maakt.',
      body: 'Van elfendorp tot supercar: zie snel welke doos je wilt bouwen, neerzetten of eindelijk hebben.',
      ctaLabel: 'Bekijk alle LEGO-werelden',
      ctaHref: '#explore-themes',
    },
    {
      id: 'home-foundation',
      type: 'richText',
      eyebrow: 'Minifigs, schaal, details',
      title: 'Zie meteen wat blijft hangen.',
      body: 'De Council of Elrond. Een rij Marvel-minifigs. Dat AT-AT-silhouet. Dan weet je genoeg.',
    },
    {
      id: 'home-callout',
      type: 'callout',
      eyebrow: 'Als de prijs meehelpt',
      title: 'Soms zakt precies die UCS-doos.',
      body: 'Handig als een modular, walker of bloemenboeket al weken in je hoofd zit.',
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
