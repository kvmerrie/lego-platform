export interface SeoFields {
  title: string;
  description: string;
  noIndex?: boolean;
  openGraphImageUrl?: string;
}

interface EditorialSectionBase {
  id: string;
  title: string;
  body: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface HeroEditorialSection extends EditorialSectionBase {
  type: 'hero';
}

export interface RichTextEditorialSection extends EditorialSectionBase {
  type: 'richText';
}

export interface CalloutEditorialSection extends EditorialSectionBase {
  type: 'callout';
}

export type EditorialSection =
  | HeroEditorialSection
  | RichTextEditorialSection
  | CalloutEditorialSection;

export interface EditorialPage {
  id: string;
  pageType: 'homepage' | 'page';
  title: string;
  slug?: string;
  seo: SeoFields;
  sections: EditorialSection[];
}

export interface PreviewPanel {
  status: string;
  summary: string;
  updatedAt: string;
}

export function getHeroSection(
  sections: readonly EditorialSection[],
): HeroEditorialSection | undefined {
  const firstSection = sections[0];

  if (!firstSection || firstSection.type !== 'hero') {
    return undefined;
  }

  return firstSection;
}

export function cloneEditorialPage(editorialPage: EditorialPage): EditorialPage {
  return {
    ...editorialPage,
    seo: { ...editorialPage.seo },
    sections: editorialPage.sections.map((editorialSection) => ({
      ...editorialSection,
    })),
  };
}
