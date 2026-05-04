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

export type ContentArticleHeroImageSource =
  | 'manual'
  | 'featuredSet'
  | 'spotlight'
  | 'rail'
  | 'representativeThemeSet'
  | 'themeTile';

export type ContentArticleSourceDisplayMode =
  | 'auto'
  | 'hideSignalSource'
  | 'showExplicitSource'
  | 'showViaSource';

export interface ContentArticleSourceAttribution {
  imageCredit?: string;
  label: string;
  signalSourceName?: string;
  tone: 'explicit' | 'subtle';
}

export interface ContentArticleListItem {
  bodySource?: string;
  cardImage?: string;
  cardImageAlt: string;
  cardImageSource?: ContentArticleHeroImageSource;
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt: string;
  heroImageSource?: ContentArticleHeroImageSource;
  primarySetNumber?: string;
  slug: string;
  sourceAttribution?: ContentArticleSourceAttribution;
  status: ContentArticleStatus;
  theme?: string;
  themeSlug?: string;
  title: string;
  updatedAt?: string;
}

export interface ContentArticle extends ContentArticleListItem {
  bodySource: string;
}

export interface ContentArticleFrontmatterInput {
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt?: string;
  heroImageCredit?: string;
  slug?: string;
  sourceDisplayMode?: ContentArticleSourceDisplayMode;
  signalSource?: string;
  signalSourceName?: string;
  sourceUrl?: string;
  status?: ContentArticleStatus;
  theme?: string;
  title: string;
  [key: string]: unknown;
}

export interface ContentArticlePublishInput {
  force?: boolean;
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
  primarySetNumber?: string;
}

export interface ContentArticleNearDuplicateMatch {
  reason: string;
  slug: string;
  title: string;
}

export interface ContentArticlePublishResult {
  article: ContentArticle;
  revalidated: boolean;
  revalidationWarnings: readonly string[];
  slug: string;
}

const TRACKING_QUERY_PARAMS = [
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
] as const;

export function normalizeEditorialSourceUrlForComparison(
  value?: string,
): string {
  const trimmedValue = (value ?? '').trim();

  if (!trimmedValue) {
    return '';
  }

  try {
    const url = new URL(trimmedValue);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.protocol = 'https:';

    for (const trackingParam of TRACKING_QUERY_PARAMS) {
      url.searchParams.delete(trackingParam);
    }

    url.searchParams.sort();

    return url.toString().replace(/\/+$/u, '');
  } catch {
    return trimmedValue.replace(/\/+$/u, '');
  }
}

export interface AdminContentArticleSummary {
  date: string;
  slug: string;
  status: ContentArticleStatus;
  theme?: string;
  title: string;
  updatedAt: string;
}

export interface AdminContentArticleDetail extends AdminContentArticleSummary {
  description: string;
  frontmatter: ContentArticleFrontmatterInput;
  heroImage?: string;
  mdx: string;
  publishedAt?: string;
  theme?: string;
}

export interface AdminContentArticleUpdateInput {
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
}

export interface AdminContentArticleDeleteSummary {
  clearedFeedItems: number;
  deletedArticle: boolean;
  deletedEvents: number;
  deletedPreviews: number;
  deletedStorageObjects: number;
}

const PUBLIC_UNHELPFUL_THEME_LABELS = new Set(['other', 'unknown']);

export function normalizePublicContentArticleTheme(
  theme?: string | null,
): string | undefined {
  const normalizedTheme = typeof theme === 'string' ? theme.trim() : '';

  if (!normalizedTheme) {
    return undefined;
  }

  if (PUBLIC_UNHELPFUL_THEME_LABELS.has(normalizedTheme.toLowerCase())) {
    return undefined;
  }

  return normalizedTheme;
}

export function normalizeContentArticleSetNumber(
  setNumber?: string,
): string | undefined {
  if (typeof setNumber !== 'string') {
    return undefined;
  }

  const normalizedSetNumber = setNumber.trim().replace(/-1$/u, '');

  return normalizedSetNumber.length > 0 ? normalizedSetNumber : undefined;
}

export function extractPrimarySetNumberFromArticleBody(
  bodySource: string,
): string | undefined {
  return readFirstMdxComponentSetIds({
    bodySource,
    componentName: 'FeaturedSet',
  })[0];
}

function readFirstMdxComponentSetIds({
  bodySource,
  componentName,
}: {
  bodySource: string;
  componentName: string;
}): string[] {
  const componentMatch = bodySource.match(
    new RegExp(`<${componentName}\\b[^>]*>`, 'iu'),
  );

  if (!componentMatch) {
    return [];
  }

  const componentSource = componentMatch[0];
  const singleSetMatch = componentSource.match(
    /<FeaturedSet\b[^>]*\bsetNumber\s*=\s*(?:"([^"]+)"|'([^']+)')/u,
  );

  if (singleSetMatch) {
    const setNumber = normalizeContentArticleSetNumber(
      singleSetMatch[1] ?? singleSetMatch[2],
    );

    return setNumber ? [setNumber] : [];
  }

  const setIdsMatch = componentSource.match(
    /\bsetIds\s*=\s*(?:"([^"]+)"|'([^']+)')/u,
  );

  return (setIdsMatch?.[1] ?? setIdsMatch?.[2] ?? '')
    .split(',')
    .map(normalizeContentArticleSetNumber)
    .filter((setNumber): setNumber is string => Boolean(setNumber));
}

export function extractArticleHeroSetNumberCandidatesFromBody(
  bodySource: string,
): string[] {
  const setNumbers = [
    ...readFirstMdxComponentSetIds({
      bodySource,
      componentName: 'FeaturedSet',
    }),
    ...readFirstMdxComponentSetIds({
      bodySource,
      componentName: 'SetSpotlightList',
    }),
    ...readFirstMdxComponentSetIds({
      bodySource,
      componentName: 'SetRail',
    }),
  ];

  return [...new Set(setNumbers)];
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
