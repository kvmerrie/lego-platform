import type { EditorialPage, PreviewPanel } from '@lego-platform/content/util';

export const homepageEditorialPage: EditorialPage = {
  id: 'home',
  pageType: 'homepage',
  title: 'Brickhunt',
  seo: {
    title: 'Brickhunt – LEGO sets kiezen, vergelijken en slimmer kopen',
    description:
      'Ontdek LEGO sets, vergelijk prijzen en zie sneller wanneer een set interessant geprijsd is.',
  },
  sections: [
    {
      id: 'home-hero',
      type: 'hero',
      eyebrow: 'Van Rivendell tot McLaren P1',
      title: 'Welke set wil je?',
      body: 'Ontdek welke sets het waard zijn — en of dit een slim moment is om te kopen.',
      ctaLabel: 'Ontdek sets',
      ctaHref: '#best-current-deals',
    },
    {
      id: 'home-foundation',
      type: 'richText',
      eyebrow: 'Sets die blijven hangen',
      title: 'Begin bij de sets die je wilt blijven bekijken.',
      body: 'Van open displaystukken tot torens, walkers en iconische voertuigen: hier zie je sneller wat echt de moeite waard voelt.',
    },
    {
      id: 'home-callout',
      type: 'callout',
      eyebrow: 'Als de prijs interessanter wordt',
      title: 'Nu slimmer geprijsd.',
      body: 'Voor sets die je al op het oog had en nu nét interessanter worden om te bekijken.',
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
