import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {
  sortContentArticlesByDateDesc,
  type ContentArticle,
  type ContentArticleListItem,
  type ContentArticleStatus,
} from '@lego-platform/content/util';

const WORKSPACE_ROOT_MARKERS = ['pnpm-workspace.yaml', 'nx.json'] as const;

let hasWarnedMissingContentDirectory = false;

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
}

export interface ContentArticleSourceFile {
  filename: string;
  source: string;
}

export interface ContentArticleQueryOptions {
  articleFiles?: readonly ContentArticleSourceFile[];
  assetExistsFn?: (absolutePath: string) => Promise<boolean>;
  contentDirectory?: string;
}

interface ParsedContentArticleFrontmatter {
  cardImage?: string;
  cardImageAlt?: string;
  date: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
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
    heroImage: readRequiredStringField(frontmatter, 'heroImage', filename),
    heroImageAlt: readRequiredStringField(
      frontmatter,
      'heroImageAlt',
      filename,
    ),
    slug: readRequiredStringField(frontmatter, 'slug', filename),
    status: readStatusField(frontmatter, filename),
    theme: normalizeOptionalString(frontmatter['theme']),
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

async function parseContentArticleSourceFile({
  articleFile,
  assetExistsFn,
}: {
  articleFile: ContentArticleSourceFile;
  assetExistsFn: (absolutePath: string) => Promise<boolean>;
}): Promise<ContentArticle> {
  const { content, data } = matter(articleFile.source);
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
    bodySource: content.trim(),
    cardImage: resolvedCardImage ?? resolvedHeroImage,
    cardImageAlt:
      parsedFrontmatter.cardImageAlt ?? parsedFrontmatter.heroImageAlt,
    date: parsedFrontmatter.date,
    description: parsedFrontmatter.description,
    heroImage: resolvedHeroImage,
    heroImageAlt: parsedFrontmatter.heroImageAlt,
    slug: parsedFrontmatter.slug,
    status: parsedFrontmatter.status,
    theme: parsedFrontmatter.theme,
    title: parsedFrontmatter.title,
    updatedAt: parsedFrontmatter.updatedAt,
  };
}

async function listAllContentArticles({
  articleFiles,
  assetExistsFn = defaultAssetExists,
  contentDirectory,
}: ContentArticleQueryOptions = {}): Promise<readonly ContentArticle[]> {
  const contentArticleSourceFiles = await listContentArticleSourceFiles({
    articleFiles,
    contentDirectory,
  });
  const contentArticles = await Promise.all(
    contentArticleSourceFiles.map((articleFile) =>
      parseContentArticleSourceFile({
        articleFile,
        assetExistsFn,
      }),
    ),
  );

  return sortContentArticlesByDateDesc(contentArticles);
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
  limit,
}: ContentArticleQueryOptions & {
  limit?: number;
} = {}): Promise<readonly ContentArticleListItem[]> {
  const publishedArticles = (
    await listAllContentArticles({
      articleFiles,
      assetExistsFn,
      contentDirectory,
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
