import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import {
  extractPrimarySetNumberFromArticleBody,
  normalizePublicContentArticleTheme,
  sortContentArticlesByDateDesc,
  type ContentArticle,
  type ContentArticleListItem,
  type ContentArticleStatus,
} from '@lego-platform/content/util';
import {
  getBrowserSupabaseConfig,
  getServerSupabaseConfig,
  hasBrowserSupabaseConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

const ARTICLES_TABLE_NAME = 'articles';
const ARTICLE_EVENTS_TABLE_NAME = 'article_events';
const ARTICLE_PREVIEWS_TABLE_NAME = 'article_previews';
const ARTICLE_EVENT_SELECT_FIELDS = 'slug';
const ARTICLE_ROW_SELECT_FIELDS =
  'created_at, frontmatter, mdx, published_at, slug, status, title, updated_at';
const ARTICLE_PREVIEW_ROW_SELECT_FIELDS =
  'created_at, expires_at, frontmatter, id, mdx';

let contentArticlesSupabaseAdminClient: SupabaseClient | undefined;
let contentArticlesSupabasePublicClient: SupabaseClient | undefined;

export function resetContentArticleQueryStateForTests(): void {
  contentArticlesSupabaseAdminClient = undefined;
  contentArticlesSupabasePublicClient = undefined;
}

export interface ContentArticleSupabaseRow {
  created_at: string;
  frontmatter: Record<string, unknown> | null;
  mdx: string;
  published_at: string;
  slug: string;
  status: ContentArticleStatus;
  title: string;
  updated_at: string;
}

export interface ContentArticlePreviewSupabaseRow {
  created_at: string;
  expires_at: string;
  frontmatter: Record<string, unknown> | null;
  id: string;
  mdx: string;
}

type ContentArticleSupabaseClient = Pick<SupabaseClient, 'from'>;
type ArticleEventName = 'article_click' | 'set_click';

interface ArticleEventRow {
  slug: string;
}

export interface ContentArticleQueryOptions {
  supabaseClient?: ContentArticleSupabaseClient;
}

interface ParsedContentArticleFrontmatter {
  cardImage?: string;
  cardImageAlt?: string;
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt?: string;
  heroImageCredit?: string;
  slug: string;
  sourceDisplayMode?:
    | 'auto'
    | 'hideSignalSource'
    | 'showExplicitSource'
    | 'showViaSource';
  signalSourceName?: string;
  sourceUrl?: string;
  status: ContentArticleStatus;
  theme?: string;
  title: string;
  updatedAt?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeArticleSourceDisplayMode(
  value: unknown,
): ParsedContentArticleFrontmatter['sourceDisplayMode'] {
  return value === 'hideSignalSource' ||
    value === 'showExplicitSource' ||
    value === 'showViaSource'
    ? value
    : 'auto';
}

function getSourceNameFromUrl(sourceUrl?: string): string | undefined {
  if (!sourceUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./u, '');

    if (hostname.includes('brickset.com')) {
      return 'Brickset';
    }

    if (hostname.includes('bricktastic.nl')) {
      return 'BrickTastic';
    }

    return hostname;
  } catch {
    return undefined;
  }
}

function stripLegacySourceAttribution(bodySource: string): string {
  return bodySource
    .replace(
      /\n{0,2}(?:(?:Bron|Via):|Bronnen:)\s*(?:\[[^\]]+\]\([^)]+\)|[^\n]+)\s*$/iu,
      '',
    )
    .trim();
}

function resolveContentArticleSourceAttribution(
  frontmatter: ParsedContentArticleFrontmatter,
) {
  const signalSourceName =
    frontmatter.signalSourceName ?? getSourceNameFromUrl(frontmatter.sourceUrl);

  if (
    frontmatter.sourceDisplayMode === 'showExplicitSource' &&
    signalSourceName
  ) {
    return {
      ...(frontmatter.heroImageCredit
        ? { imageCredit: frontmatter.heroImageCredit }
        : {}),
      label: `Bronnen: officiële setinformatie en ${signalSourceName}.`,
      signalSourceName,
      tone: 'explicit' as const,
    };
  }

  if (frontmatter.sourceDisplayMode === 'showViaSource' && signalSourceName) {
    return {
      ...(frontmatter.heroImageCredit
        ? { imageCredit: frontmatter.heroImageCredit }
        : {}),
      label: `Via: ${signalSourceName}`,
      signalSourceName,
      tone: 'subtle' as const,
    };
  }

  return {
    ...(frontmatter.heroImageCredit
      ? { imageCredit: frontmatter.heroImageCredit }
      : {}),
    label:
      frontmatter.sourceDisplayMode === 'hideSignalSource'
        ? 'Bronnen: officiële setinformatie.'
        : 'Bronnen: officiële setinformatie en openbare berichtgeving.',
    ...(signalSourceName ? { signalSourceName } : {}),
    tone: 'subtle' as const,
  };
}

function readRequiredStringField(
  frontmatter: Record<string, unknown>,
  fieldName: keyof ParsedContentArticleFrontmatter,
  filename: string,
): string {
  const value = frontmatter[fieldName];

  if (!isNonEmptyString(value)) {
    throw new Error(
      `Article "${filename}" is missing required frontmatter field "${String(fieldName)}".`,
    );
  }

  return value.trim();
}

function readStatusField(
  frontmatter: Record<string, unknown>,
  filename: string,
): ContentArticleStatus {
  const value = frontmatter['status'];

  if (value === 'draft' || value === 'published') {
    return value;
  }

  throw new Error(
    `Article "${filename}" has invalid frontmatter field "status".`,
  );
}

function parseContentArticleFrontmatter({
  filename,
  frontmatter,
}: {
  filename: string;
  frontmatter: Record<string, unknown>;
}): ParsedContentArticleFrontmatter {
  return {
    cardImage: normalizeOptionalString(frontmatter['cardImage']),
    cardImageAlt: normalizeOptionalString(frontmatter['cardImageAlt']),
    date: readRequiredStringField(frontmatter, 'date', filename),
    description: readRequiredStringField(frontmatter, 'description', filename),
    heroImage: normalizeOptionalString(frontmatter['heroImage']),
    heroImageAlt: normalizeOptionalString(frontmatter['heroImageAlt']),
    heroImageCredit: normalizeOptionalString(frontmatter['heroImageCredit']),
    slug: readRequiredStringField(frontmatter, 'slug', filename),
    sourceDisplayMode: normalizeArticleSourceDisplayMode(
      frontmatter['sourceDisplayMode'],
    ),
    signalSourceName:
      normalizeOptionalString(frontmatter['signalSourceName']) ??
      normalizeOptionalString(frontmatter['signalSource']),
    sourceUrl: normalizeOptionalString(frontmatter['sourceUrl']),
    status: readStatusField(frontmatter, filename),
    theme: normalizePublicContentArticleTheme(
      normalizeOptionalString(frontmatter['theme']),
    ),
    title: readRequiredStringField(frontmatter, 'title', filename),
    updatedAt: normalizeOptionalString(frontmatter['updatedAt']),
  };
}

function resolveStoredArticleImagePath(
  publicPath?: string,
): string | undefined {
  return publicPath?.startsWith('https://') || publicPath?.startsWith('http://')
    ? publicPath
    : undefined;
}

function createContentArticlesSupabaseAdminClient(): SupabaseClient {
  const serverSupabaseConfig = getServerSupabaseConfig();

  return createClient(
    serverSupabaseConfig.url,
    serverSupabaseConfig.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getContentArticlesSupabaseAdminClient(): SupabaseClient {
  contentArticlesSupabaseAdminClient ??=
    createContentArticlesSupabaseAdminClient();

  return contentArticlesSupabaseAdminClient;
}

function createContentArticlesSupabasePublicClient(): SupabaseClient {
  const browserSupabaseConfig = getBrowserSupabaseConfig();

  return createClient(
    browserSupabaseConfig.url,
    browserSupabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getContentArticlesSupabasePublicClient(): SupabaseClient {
  contentArticlesSupabasePublicClient ??=
    createContentArticlesSupabasePublicClient();

  return contentArticlesSupabasePublicClient;
}

function getContentArticlesSupabaseReadClient():
  | ContentArticleSupabaseClient
  | undefined {
  if (hasServerSupabaseConfig()) {
    return getContentArticlesSupabaseAdminClient();
  }

  if (hasBrowserSupabaseConfig()) {
    return getContentArticlesSupabasePublicClient();
  }

  return undefined;
}

function parseContentArticleSupabaseRow({
  row,
}: {
  row: ContentArticleSupabaseRow;
}): ContentArticle {
  const parsedMdx = matter(row.mdx);
  const frontmatter =
    row.frontmatter && typeof row.frontmatter === 'object'
      ? row.frontmatter
      : {};
  const mergedFrontmatter: Record<string, unknown> = {
    ...(typeof parsedMdx.data === 'object' && parsedMdx.data !== null
      ? parsedMdx.data
      : {}),
    ...frontmatter,
    slug: row.slug,
    status: 'published',
    title: row.title,
  };
  const parsedFrontmatter = parseContentArticleFrontmatter({
    filename: `${row.slug}.mdx`,
    frontmatter: {
      cardImage: mergedFrontmatter['cardImage'],
      cardImageAlt: mergedFrontmatter['cardImageAlt'],
      date:
        normalizeOptionalString(mergedFrontmatter['date']) ??
        row.created_at.slice(0, 10),
      description:
        normalizeOptionalString(mergedFrontmatter['description']) ?? row.title,
      heroImage: mergedFrontmatter['heroImage'],
      heroImageAlt: mergedFrontmatter['heroImageAlt'],
      heroImageCredit: mergedFrontmatter['heroImageCredit'],
      slug: mergedFrontmatter['slug'],
      sourceDisplayMode: mergedFrontmatter['sourceDisplayMode'],
      signalSourceName:
        mergedFrontmatter['signalSourceName'] ??
        mergedFrontmatter['signalSource'],
      sourceUrl: mergedFrontmatter['sourceUrl'],
      status: mergedFrontmatter['status'],
      theme: mergedFrontmatter['theme'],
      title: mergedFrontmatter['title'],
      updatedAt:
        normalizeOptionalString(mergedFrontmatter['updatedAt']) ??
        row.updated_at,
    },
  });
  const trimmedBodySource = stripLegacySourceAttribution(
    parsedMdx.content.trim(),
  );
  const resolvedHeroImage = resolveStoredArticleImagePath(
    parsedFrontmatter.heroImage,
  );
  const resolvedCardImage = resolveStoredArticleImagePath(
    parsedFrontmatter.cardImage,
  );

  return {
    bodySource: trimmedBodySource,
    cardImage: resolvedCardImage ?? resolvedHeroImage,
    cardImageAlt:
      parsedFrontmatter.cardImageAlt ??
      parsedFrontmatter.heroImageAlt ??
      parsedFrontmatter.title,
    cardImageSource:
      resolvedCardImage || resolvedHeroImage ? 'manual' : undefined,
    date: parsedFrontmatter.date,
    description: parsedFrontmatter.description,
    heroImage: resolvedHeroImage,
    heroImageAlt: parsedFrontmatter.heroImageAlt ?? parsedFrontmatter.title,
    heroImageSource: resolvedHeroImage ? 'manual' : undefined,
    primarySetNumber: extractPrimarySetNumberFromArticleBody(trimmedBodySource),
    slug: parsedFrontmatter.slug,
    sourceAttribution:
      resolveContentArticleSourceAttribution(parsedFrontmatter),
    status: parsedFrontmatter.status,
    theme: parsedFrontmatter.theme,
    title: parsedFrontmatter.title,
    updatedAt: parsedFrontmatter.updatedAt,
  };
}

function parseContentArticlePreviewSupabaseRow({
  row,
}: {
  row: ContentArticlePreviewSupabaseRow;
}): ContentArticle {
  const parsedMdx = matter(row.mdx);
  const frontmatter =
    row.frontmatter && typeof row.frontmatter === 'object'
      ? row.frontmatter
      : {};
  const mergedFrontmatter: Record<string, unknown> = {
    ...(typeof parsedMdx.data === 'object' && parsedMdx.data !== null
      ? parsedMdx.data
      : {}),
    ...frontmatter,
    slug: `preview-${row.id}`,
    status: 'draft',
  };
  const title =
    normalizeOptionalString(mergedFrontmatter['title']) ?? 'Artikel preview';
  const parsedFrontmatter = parseContentArticleFrontmatter({
    filename: `preview-${row.id}.mdx`,
    frontmatter: {
      cardImage: mergedFrontmatter['cardImage'],
      cardImageAlt: mergedFrontmatter['cardImageAlt'],
      date:
        normalizeOptionalString(mergedFrontmatter['date']) ??
        row.created_at.slice(0, 10),
      description:
        normalizeOptionalString(mergedFrontmatter['description']) ?? title,
      heroImage: mergedFrontmatter['heroImage'],
      heroImageAlt: mergedFrontmatter['heroImageAlt'],
      heroImageCredit: mergedFrontmatter['heroImageCredit'],
      slug: mergedFrontmatter['slug'],
      sourceDisplayMode: mergedFrontmatter['sourceDisplayMode'],
      signalSourceName:
        mergedFrontmatter['signalSourceName'] ??
        mergedFrontmatter['signalSource'],
      sourceUrl: mergedFrontmatter['sourceUrl'],
      status: mergedFrontmatter['status'],
      theme: mergedFrontmatter['theme'],
      title,
      updatedAt: row.created_at,
    },
  });
  const trimmedBodySource = stripLegacySourceAttribution(
    parsedMdx.content.trim(),
  );
  const resolvedHeroImage = resolveStoredArticleImagePath(
    parsedFrontmatter.heroImage,
  );
  const resolvedCardImage = resolveStoredArticleImagePath(
    parsedFrontmatter.cardImage,
  );

  return {
    bodySource: trimmedBodySource,
    cardImage: resolvedCardImage ?? resolvedHeroImage,
    cardImageAlt:
      parsedFrontmatter.cardImageAlt ??
      parsedFrontmatter.heroImageAlt ??
      parsedFrontmatter.title,
    cardImageSource:
      resolvedCardImage || resolvedHeroImage ? 'manual' : undefined,
    date: parsedFrontmatter.date,
    description: parsedFrontmatter.description,
    heroImage: resolvedHeroImage,
    heroImageAlt: parsedFrontmatter.heroImageAlt ?? parsedFrontmatter.title,
    heroImageSource: resolvedHeroImage ? 'manual' : undefined,
    primarySetNumber: extractPrimarySetNumberFromArticleBody(trimmedBodySource),
    slug: parsedFrontmatter.slug,
    sourceAttribution:
      resolveContentArticleSourceAttribution(parsedFrontmatter),
    status: parsedFrontmatter.status,
    theme: parsedFrontmatter.theme,
    title: parsedFrontmatter.title,
    updatedAt: parsedFrontmatter.updatedAt,
  };
}

async function listPublishedContentArticleSupabaseRows({
  slugs,
  supabaseClient,
}: {
  slugs?: readonly string[];
  supabaseClient?: ContentArticleSupabaseClient;
}): Promise<readonly ContentArticleSupabaseRow[]> {
  const activeSupabaseClient =
    supabaseClient ?? getContentArticlesSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  let query = activeSupabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select(ARTICLE_ROW_SELECT_FIELDS)
    .eq('status', 'published');

  if (slugs?.length) {
    query = query.in('slug', [...new Set(slugs)]);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return Array.isArray(data) ? (data as ContentArticleSupabaseRow[]) : [];
}

function toContentArticleListItem(
  contentArticle: ContentArticle,
): ContentArticleListItem {
  return {
    bodySource: contentArticle.bodySource,
    cardImage: contentArticle.cardImage,
    cardImageAlt: contentArticle.cardImageAlt,
    cardImageSource: contentArticle.cardImageSource,
    date: contentArticle.date,
    description: contentArticle.description,
    heroImage: contentArticle.heroImage,
    heroImageAlt: contentArticle.heroImageAlt,
    heroImageSource: contentArticle.heroImageSource,
    primarySetNumber: contentArticle.primarySetNumber,
    slug: contentArticle.slug,
    status: contentArticle.status,
    theme: contentArticle.theme,
    title: contentArticle.title,
    updatedAt: contentArticle.updatedAt,
  };
}

export async function listPublishedArticles({
  limit,
  supabaseClient,
}: ContentArticleQueryOptions & {
  limit?: number;
} = {}): Promise<readonly ContentArticleListItem[]> {
  const supabaseRows = await listPublishedContentArticleSupabaseRows({
    supabaseClient,
  });
  const publishedArticles = sortContentArticlesByDateDesc(
    supabaseRows.map((row) => parseContentArticleSupabaseRow({ row })),
  )
    .filter((contentArticle) => contentArticle.status === 'published')
    .map(toContentArticleListItem);

  return typeof limit === 'number'
    ? publishedArticles.slice(0, limit)
    : publishedArticles;
}

export async function listPublishedArticleSlugs(
  options?: ContentArticleQueryOptions,
): Promise<readonly string[]> {
  return (await listPublishedArticles(options)).map(
    (contentArticle) => contentArticle.slug,
  );
}

export async function getPublishedArticleBySlug(
  slug: string,
  options?: ContentArticleQueryOptions,
): Promise<ContentArticle | null> {
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return null;
  }

  const [row] = await listPublishedContentArticleSupabaseRows({
    slugs: [trimmedSlug],
    supabaseClient: options?.supabaseClient,
  });

  if (!row) {
    return null;
  }

  const contentArticle = parseContentArticleSupabaseRow({ row });

  return contentArticle.status === 'published' ? contentArticle : null;
}

export async function getArticleBySlug(
  slug: string,
  options?: ContentArticleQueryOptions,
): Promise<ContentArticle | null> {
  return getPublishedArticleBySlug(slug, options);
}

export async function getArticlePreviewById({
  now = new Date(),
  previewId,
  supabaseClient,
}: {
  now?: Date;
  previewId: string;
  supabaseClient?: ContentArticleSupabaseClient;
}): Promise<ContentArticle | null> {
  const normalizedPreviewId = previewId.trim();

  if (!normalizedPreviewId) {
    return null;
  }

  const activeSupabaseClient =
    supabaseClient ?? getContentArticlesSupabaseAdminClient();
  const { data, error } = await activeSupabaseClient
    .from(ARTICLE_PREVIEWS_TABLE_NAME)
    .select(ARTICLE_PREVIEW_ROW_SELECT_FIELDS)
    .eq('id', normalizedPreviewId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as ContentArticlePreviewSupabaseRow;

  if (Date.parse(row.expires_at) <= now.getTime()) {
    return null;
  }

  return parseContentArticlePreviewSupabaseRow({ row });
}

function normalizePopularArticlesWindowDays(days: number): number {
  return Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 7;
}

function normalizePopularArticlesLimit(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 24) : 6;
}

export async function logArticleEvent({
  eventName,
  slug,
  supabaseClient = getContentArticlesSupabaseAdminClient(),
}: {
  eventName: ArticleEventName;
  slug: string;
  supabaseClient?: ContentArticleSupabaseClient;
}): Promise<void> {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error('Artikel-slug ontbreekt.');
  }

  const { error } = await supabaseClient
    .from(ARTICLE_EVENTS_TABLE_NAME)
    .insert({
      event_name: eventName,
      slug: normalizedSlug,
    });

  if (error) {
    throw new Error('Artikel-event opslaan is mislukt.');
  }
}

export async function logArticleClickEvent({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient?: ContentArticleSupabaseClient;
}): Promise<void> {
  await logArticleEvent({
    eventName: 'article_click',
    slug,
    supabaseClient,
  });
}

export async function getPopularArticles({
  days = 7,
  limit = 6,
  supabaseClient,
}: {
  days?: number;
  limit?: number;
  supabaseClient?: ContentArticleSupabaseClient;
} = {}): Promise<readonly ContentArticleListItem[]> {
  const activeSupabaseClient =
    supabaseClient ?? getContentArticlesSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const normalizedDays = normalizePopularArticlesWindowDays(days);
  const normalizedLimit = normalizePopularArticlesLimit(limit);
  const since = new Date(
    Date.now() - normalizedDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await activeSupabaseClient
    .from(ARTICLE_EVENTS_TABLE_NAME)
    .select(ARTICLE_EVENT_SELECT_FIELDS)
    .eq('event_name', 'article_click')
    .gte('created_at', since);

  if (error || !Array.isArray(data)) {
    return [];
  }

  const clickCountBySlug = new Map<string, number>();

  for (const eventRow of data as ArticleEventRow[]) {
    const slug = eventRow.slug?.trim();

    if (slug) {
      clickCountBySlug.set(slug, (clickCountBySlug.get(slug) ?? 0) + 1);
    }
  }

  const popularSlugs = [...clickCountBySlug.entries()]
    .sort(
      ([leftSlug, leftCount], [rightSlug, rightCount]) =>
        rightCount - leftCount || leftSlug.localeCompare(rightSlug, 'nl-NL'),
    )
    .slice(0, normalizedLimit)
    .map(([slug]) => slug);

  if (!popularSlugs.length) {
    return [];
  }

  const articleRows = await listPublishedContentArticleSupabaseRows({
    slugs: popularSlugs,
    supabaseClient: activeSupabaseClient,
  });
  const articles = articleRows.map((row) =>
    parseContentArticleSupabaseRow({
      row,
    }),
  );
  const articleBySlug = new Map(
    articles
      .filter((contentArticle) => contentArticle.status === 'published')
      .map((contentArticle) => [
        contentArticle.slug,
        toContentArticleListItem(contentArticle),
      ]),
  );

  return popularSlugs.flatMap((slug) => {
    const article = articleBySlug.get(slug);

    return article ? [article] : [];
  });
}
