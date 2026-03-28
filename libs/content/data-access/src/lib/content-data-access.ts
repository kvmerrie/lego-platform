import { EditorialSection, PreviewPanel } from '@lego-platform/content/util';

const landingPageSections: readonly EditorialSection[] = [
  {
    id: 'hero',
    eyebrow: 'Collector intelligence',
    title: 'A professional foundation for modern LEGO collecting.',
    copy: 'Track premium sets, plan collection growth, evaluate pricing movement, and leave room for editorial storytelling and commerce integrations.',
    ctaLabel: 'Explore the catalog',
    ctaHref: '#catalog',
  },
  {
    id: 'curation',
    eyebrow: 'Collection curation',
    title: 'Treat your collection like a living asset.',
    copy: 'Model shelves, coverage gaps, and collection value without letting your pages devolve into one-off app logic.',
  },
  {
    id: 'commerce',
    eyebrow: 'Offer intelligence',
    title: 'Keep affiliate paths and price tracking close to collector intent.',
    copy: 'The repo is structured so pricing history, offer aggregation, and future marketplace feeds can evolve in domain-owned libraries.',
  },
];

const previewPanel: PreviewPanel = {
  status: 'Draft preview ready',
  summary:
    'Content previews are wired as a first-class feature so Contentful preview flows can land cleanly later.',
  updatedAt: 'Moments ago',
};

export function listLandingPageSections(): EditorialSection[] {
  return [...landingPageSections];
}

export function getPreviewPanel(): PreviewPanel {
  return previewPanel;
}
