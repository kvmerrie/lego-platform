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

export type ContentArticleStatus = 'draft' | 'published';

export interface ContentArticleListItem {
  cardImage?: string;
  cardImageAlt: string;
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt: string;
  slug: string;
  status: ContentArticleStatus;
  theme?: string;
  title: string;
  updatedAt?: string;
}

export interface ContentArticle extends ContentArticleListItem {
  bodySource: string;
}

const contentArticleDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatContentArticleDate(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return contentArticleDateFormatter.format(new Date(timestamp));
}

export function sortContentArticlesByDateDesc<
  T extends Pick<ContentArticleListItem, 'date' | 'slug' | 'title'>,
>(contentArticles: readonly T[]): T[] {
  return [...contentArticles].sort(
    (left, right) =>
      Date.parse(right.date) - Date.parse(left.date) ||
      right.title.localeCompare(left.title, 'nl-NL') ||
      left.slug.localeCompare(right.slug, 'nl-NL'),
  );
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

export function cloneEditorialPage(
  editorialPage: EditorialPage,
): EditorialPage {
  return {
    ...editorialPage,
    seo: { ...editorialPage.seo },
    sections: editorialPage.sections.map((editorialSection) => ({
      ...editorialSection,
    })),
  };
}
