import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
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

const WORKSPACE_ROOT_MARKERS = ['pnpm-workspace.yaml', 'nx.json'] as const;
const ARTICLES_TABLE_NAME = 'articles';

let hasWarnedMissingContentDirectory = false;
let contentArticlesSupabaseAdminClient: SupabaseClient | undefined;
let contentArticlesSupabasePublicClient: SupabaseClient | undefined;

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);

    return true;
  } catch {
    return false;
  }
}

async function resolveWorkspaceRoot(
  startDirectory = process.cwd(),
): Promise<string> {
  let currentDirectory = path.resolve(startDirectory);

  for (;;) {
    const hasWorkspaceMarker = await Promise.all(
      WORKSPACE_ROOT_MARKERS.map((marker) =>
        pathExists(path.join(currentDirectory, marker)),
      ),
    );

    if (hasWorkspaceMarker.every(Boolean)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return path.resolve(startDirectory);
    }

    currentDirectory = parentDirectory;
  }
}

async function getContentArticlesDirectory(
  contentDirectory?: string,
): Promise<string> {
  if (contentDirectory) {
    return contentDirectory;
  }

  return path.join(await resolveWorkspaceRoot(), 'content', 'articles');
}

async function getWebPublicDirectory(): Promise<string> {
  return path.join(await resolveWorkspaceRoot(), 'apps', 'web', 'public');
}

function warnMissingContentDirectory(contentDirectory: string): void {
  if (hasWarnedMissingContentDirectory) {
    return;
  }

  hasWarnedMissingContentDirectory = true;
  console.warn(
    `Content articles directory not found at "${contentDirectory}". Published article queries will return no results until the directory exists.`,
  );
}

export function resetContentArticleQueryStateForTests(): void {
  hasWarnedMissingContentDirectory = false;
  contentArticlesSupabaseAdminClient = undefined;
  contentArticlesSupabasePublicClient = undefined;
}

export interface ContentArticleSourceFile {
  filename: string;
  source: string;
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

type ContentArticleSupabaseClient = Pick<SupabaseClient, 'from'>;

export interface ContentArticleQueryOptions {
  articleFiles?: readonly ContentArticleSourceFile[];
  assetExistsFn?: (absolutePath: string) => Promise<boolean>;
  contentDirectory?: string;
  includeSupabase?: boolean;
  supabaseClient?: ContentArticleSupabaseClient;
}

interface ParsedContentArticleFrontmatter {
  cardImage?: string;
  cardImageAlt?: string;
  date: string;
  description: string;
  heroImage?: string;
  heroImageAlt?: string;
  slug: string;
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
    slug: readRequiredStringField(frontmatter, 'slug', filename),
    status: readStatusField(frontmatter, filename),
    theme: normalizePublicContentArticleTheme(
      normalizeOptionalString(frontmatter['theme']),
    ),
    title: readRequiredStringField(frontmatter, 'title', filename),
    updatedAt: normalizeOptionalString(frontmatter['updatedAt']),
  };
}

async function defaultAssetExists(absolutePath: string): Promise<boolean> {
  return pathExists(absolutePath);
}

async function resolvePublicAssetPath({
  assetExistsFn,
  publicPath,
}: {
  assetExistsFn: (absolutePath: string) => Promise<boolean>;
  publicPath?: string;
}): Promise<string | undefined> {
  if (!publicPath?.startsWith('/')) {
    return undefined;
  }

  const normalizedRelativePath = publicPath.replace(/^\/+/, '');
  const absolutePath = path.join(
    await getWebPublicDirectory(),
    normalizedRelativePath,
  );

  return (await assetExistsFn(absolutePath)) ? publicPath : undefined;
}

async function listContentArticleSourceFiles({
  articleFiles,
  contentDirectory,
}: ContentArticleQueryOptions): Promise<readonly ContentArticleSourceFile[]> {
  if (articleFiles) {
    return articleFiles;
  }

  const resolvedContentDirectory =
    await getContentArticlesDirectory(contentDirectory);

  try {
    const entries = await readdir(resolvedContentDirectory, {
      withFileTypes: true,
    });
    const filenames = entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mdx'),
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, 'nl-NL'));

    return Promise.all(
      filenames.map(async (filename) => ({
        filename,
        source: await readFile(
          path.join(resolvedContentDirectory, filename),
          'utf8',
        ),
      })),
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      warnMissingContentDirectory(resolvedContentDirectory);
      return [];
    }

    return [];
  }
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

async function parseContentArticleSourceFile({
  articleFile,
  assetExistsFn,
}: {
  articleFile: ContentArticleSourceFile;
  assetExistsFn: (absolutePath: string) => Promise<boolean>;
}): Promise<ContentArticle> {
  const { content, data } = matter(articleFile.source);
  const trimmedBodySource = content.trim();
  const parsedFrontmatter = parseContentArticleFrontmatter({
    filename: articleFile.filename,
    frontmatter:
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)
        : {},
  });
  const resolvedHeroImage = await resolvePublicAssetPath({
    assetExistsFn,
    publicPath: parsedFrontmatter.heroImage,
  });
  const resolvedCardImage = await resolvePublicAssetPath({
    assetExistsFn,
    publicPath: parsedFrontmatter.cardImage,
  });

  return {
    bodySource: trimmedBodySource,
    cardImage: resolvedCardImage ?? resolvedHeroImage,
    cardImageAlt:
      parsedFrontmatter.cardImageAlt ??
      parsedFrontmatter.heroImageAlt ??
      parsedFrontmatter.title,
    date: parsedFrontmatter.date,
    description: parsedFrontmatter.description,
    heroImage: resolvedHeroImage,
    heroImageAlt: parsedFrontmatter.heroImageAlt ?? parsedFrontmatter.title,
    primarySetNumber: extractPrimarySetNumberFromArticleBody(trimmedBodySource),
    slug: parsedFrontmatter.slug,
    status: parsedFrontmatter.status,
    theme: parsedFrontmatter.theme,
    title: parsedFrontmatter.title,
    updatedAt: parsedFrontmatter.updatedAt,
  };
}

async function parseContentArticleSupabaseRow({
  assetExistsFn,
  row,
}: {
  assetExistsFn: (absolutePath: string) => Promise<boolean>;
  row: ContentArticleSupabaseRow;
}): Promise<ContentArticle> {
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
      slug: mergedFrontmatter['slug'],
      status: mergedFrontmatter['status'],
      theme: mergedFrontmatter['theme'],
      title: mergedFrontmatter['title'],
      updatedAt:
        normalizeOptionalString(mergedFrontmatter['updatedAt']) ??
        row.updated_at,
    },
  });
  const trimmedBodySource = parsedMdx.content.trim();
  const resolvedHeroImage = await resolvePublicAssetPath({
    assetExistsFn,
    publicPath: parsedFrontmatter.heroImage,
  });
  const resolvedCardImage = await resolvePublicAssetPath({
    assetExistsFn,
    publicPath: parsedFrontmatter.cardImage,
  });

  return {
    bodySource: trimmedBodySource,
    cardImage: resolvedCardImage ?? resolvedHeroImage,
    cardImageAlt:
      parsedFrontmatter.cardImageAlt ??
      parsedFrontmatter.heroImageAlt ??
      parsedFrontmatter.title,
    date: parsedFrontmatter.date,
    description: parsedFrontmatter.description,
    heroImage: resolvedHeroImage,
    heroImageAlt: parsedFrontmatter.heroImageAlt ?? parsedFrontmatter.title,
    primarySetNumber: extractPrimarySetNumberFromArticleBody(trimmedBodySource),
    slug: parsedFrontmatter.slug,
    status: parsedFrontmatter.status,
    theme: parsedFrontmatter.theme,
    title: parsedFrontmatter.title,
    updatedAt: parsedFrontmatter.updatedAt,
  };
}

async function listPublishedContentArticleSupabaseRows({
  supabaseClient,
}: {
  supabaseClient?: ContentArticleSupabaseClient;
}): Promise<readonly ContentArticleSupabaseRow[]> {
  const activeSupabaseClient =
    supabaseClient ?? getContentArticlesSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const { data, error } = await activeSupabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select(
      'created_at, frontmatter, mdx, published_at, slug, status, title, updated_at',
    )
    .eq('status', 'published');

  if (error) {
    return [];
  }

  return Array.isArray(data) ? (data as ContentArticleSupabaseRow[]) : [];
}

async function listAllContentArticles({
  articleFiles,
  assetExistsFn = defaultAssetExists,
  contentDirectory,
  includeSupabase,
  supabaseClient,
}: ContentArticleQueryOptions = {}): Promise<readonly ContentArticle[]> {
  const contentArticleSourceFiles = await listContentArticleSourceFiles({
    articleFiles,
    contentDirectory,
  });
  const [fileArticles, supabaseRows] = await Promise.all([
    Promise.all(
      contentArticleSourceFiles.map((articleFile) =>
        parseContentArticleSourceFile({
          articleFile,
          assetExistsFn,
        }),
      ),
    ),
    (includeSupabase ?? !articleFiles)
      ? listPublishedContentArticleSupabaseRows({ supabaseClient })
      : Promise.resolve([]),
  ]);
  const supabaseArticles = await Promise.all(
    supabaseRows.map((row) =>
      parseContentArticleSupabaseRow({
        assetExistsFn,
        row,
      }),
    ),
  );
  const contentArticleBySlug = new Map<string, ContentArticle>();

  for (const contentArticle of fileArticles) {
    contentArticleBySlug.set(contentArticle.slug, contentArticle);
  }

  for (const contentArticle of supabaseArticles) {
    contentArticleBySlug.set(contentArticle.slug, contentArticle);
  }

  return sortContentArticlesByDateDesc([...contentArticleBySlug.values()]);
}

function toContentArticleListItem(
  contentArticle: ContentArticle,
): ContentArticleListItem {
  return {
    cardImage: contentArticle.cardImage,
    cardImageAlt: contentArticle.cardImageAlt,
    date: contentArticle.date,
    description: contentArticle.description,
    heroImage: contentArticle.heroImage,
    heroImageAlt: contentArticle.heroImageAlt,
    primarySetNumber: contentArticle.primarySetNumber,
    slug: contentArticle.slug,
    status: contentArticle.status,
    theme: contentArticle.theme,
    title: contentArticle.title,
    updatedAt: contentArticle.updatedAt,
  };
}

export async function listPublishedArticles({
  articleFiles,
  assetExistsFn,
  contentDirectory,
  includeSupabase,
  limit,
  supabaseClient,
}: ContentArticleQueryOptions & {
  limit?: number;
} = {}): Promise<readonly ContentArticleListItem[]> {
  const publishedArticles = (
    await listAllContentArticles({
      articleFiles,
      assetExistsFn,
      contentDirectory,
      includeSupabase,
      supabaseClient,
    })
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
  const contentArticles = await listAllContentArticles(options);
  const matchingArticle = contentArticles.find(
    (contentArticle) =>
      contentArticle.slug === slug && contentArticle.status === 'published',
  );

  return matchingArticle ?? null;
}

export async function getArticleBySlug(
  slug: string,
  options?: ContentArticleQueryOptions,
): Promise<ContentArticle | null> {
  return getPublishedArticleBySlug(slug, options);
}
