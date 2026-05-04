import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AdminContentArticleDetail,
  type AdminContentArticleDeleteSummary,
  type AdminContentArticleSummary,
  type AdminContentArticleUpdateInput,
  type ContentArticleFrontmatterInput,
  type ContentArticleStatus,
  sortContentArticlesByDateDesc,
} from '@lego-platform/content/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

const ARTICLES_TABLE_NAME = 'articles';
const ARTICLE_EVENTS_TABLE_NAME = 'article_events';
const ARTICLE_IMAGES_BUCKET_NAME = 'article-images';
const ARTICLE_PREVIEWS_TABLE_NAME = 'article_previews';
const EDITORIAL_FEED_ITEMS_TABLE_NAME = 'editorial_feed_items';
const ADMIN_ARTICLE_SELECT =
  'created_at, frontmatter, mdx, published_at, slug, status, title, updated_at';
const ARTICLE_PREVIEW_SELECT = 'id, frontmatter, mdx, created_at, expires_at';
const ARTICLE_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

type AdminArticleSupabaseClient = Pick<SupabaseClient, 'from'>;
type AdminArticleDeleteSupabaseClient = Pick<
  SupabaseClient,
  'from' | 'storage'
>;

interface AdminArticleRow {
  created_at?: string | null;
  frontmatter?: unknown;
  mdx?: string | null;
  published_at?: string | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
}

export class ContentArticleAdminValidationError extends Error {}
export class ContentArticleAdminNotFoundError extends Error {}
export class ContentArticlePreviewNotFoundError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeArticleSlug(value: string): string {
  const normalizedSlug = readString(value);

  if (!normalizedSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedSlug)) {
    throw new ContentArticleAdminValidationError('Artikel-slug is ongeldig.');
  }

  return normalizedSlug;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function readStatus(value: unknown): ContentArticleStatus {
  return value === 'draft' || value === 'published' ? value : 'published';
}

function readFrontmatter(row: AdminArticleRow): ContentArticleFrontmatterInput {
  const frontmatter = isRecord(row.frontmatter) ? row.frontmatter : {};
  const title = readString(frontmatter['title']) ?? readString(row.title);

  return {
    ...frontmatter,
    date: readString(frontmatter['date']) ?? '',
    description: readString(frontmatter['description']) ?? title ?? '',
    heroImage: readOptionalString(frontmatter['heroImage']) ?? '',
    slug: readString(frontmatter['slug']) ?? readString(row.slug),
    status: readStatus(frontmatter['status'] ?? row.status),
    theme: readOptionalString(frontmatter['theme']) ?? undefined,
    title: title ?? '',
  };
}

function parseArticleRow(row: AdminArticleRow): AdminContentArticleDetail {
  const slug = readString(row.slug) ?? '';
  const frontmatter = {
    ...readFrontmatter(row),
    slug,
    status: 'published' as const,
  };

  return {
    date: frontmatter.date,
    description: frontmatter.description,
    frontmatter,
    heroImage: frontmatter.heroImage,
    mdx: row.mdx ?? '',
    publishedAt: row.published_at ?? undefined,
    slug,
    status: 'published',
    theme: frontmatter.theme,
    title: frontmatter.title || readString(row.title) || slug,
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
}

function toArticleSummary(
  detail: AdminContentArticleDetail,
): AdminContentArticleSummary {
  return {
    date: detail.date,
    slug: detail.slug,
    status: detail.status,
    theme: detail.theme,
    title: detail.title,
    updatedAt: detail.updatedAt,
  };
}

function hasMarkdownHeading(mdx: string): boolean {
  return /^#{1,6}\s+\S/mu.test(mdx);
}

function readMutationCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isNotFoundStorageError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const message =
    typeof error['message'] === 'string' ? error['message'].toLowerCase() : '';
  const statusCode =
    typeof error['statusCode'] === 'string'
      ? error['statusCode']
      : String(error['statusCode'] ?? '');

  return statusCode === '404' || message.includes('not found');
}

async function listArticleStorageObjects({
  bucket,
  prefix,
}: {
  bucket: ReturnType<SupabaseClient['storage']['from']>;
  prefix: string;
}): Promise<string[]> {
  const { data, error } = await bucket.list(prefix, {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    if (isNotFoundStorageError(error)) {
      return [];
    }

    throw new Error('Artikel-afbeeldingen konden niet worden opgehaald.');
  }

  const objects: string[] = [];

  for (const item of Array.isArray(data) ? data : []) {
    const name = typeof item.name === 'string' ? item.name : '';

    if (!name || name === '.' || name === '..') {
      continue;
    }

    const path = `${prefix}/${name}`;
    const metadata = isRecord(item.metadata) ? item.metadata : null;
    const isFolder =
      !metadata &&
      (typeof item.id !== 'string' || item.id.length === 0) &&
      (typeof item.updated_at !== 'string' || item.updated_at.length === 0);

    if (isFolder) {
      objects.push(
        ...(await listArticleStorageObjects({
          bucket,
          prefix: path,
        })),
      );
      continue;
    }

    objects.push(path);
  }

  return objects;
}

async function deleteArticleStorageObjects({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient: AdminArticleDeleteSupabaseClient;
}): Promise<number> {
  const bucket = supabaseClient.storage.from(ARTICLE_IMAGES_BUCKET_NAME);
  const prefix = `articles/${slug}`;
  const objectPaths = await listArticleStorageObjects({
    bucket,
    prefix,
  });

  if (!objectPaths.length) {
    return 0;
  }

  const { data, error } = await bucket.remove(objectPaths);

  if (error) {
    throw new Error('Artikel-afbeeldingen verwijderen is mislukt.');
  }

  return Array.isArray(data) ? data.length : objectPaths.length;
}

function validatePreviewInput(input: AdminContentArticleUpdateInput): {
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
} {
  const mdx = readString(input.mdx);

  if (!mdx) {
    throw new ContentArticleAdminValidationError('Artikel-MDX ontbreekt.');
  }

  if (!hasMarkdownHeading(mdx)) {
    throw new ContentArticleAdminValidationError(
      'Artikel-MDX moet minimaal één heading bevatten.',
    );
  }

  if (!isRecord(input.frontmatter)) {
    throw new ContentArticleAdminValidationError(
      'Artikel-frontmatter ontbreekt.',
    );
  }

  const title = readString(input.frontmatter.title) ?? 'Artikel preview';

  return {
    frontmatter: {
      ...input.frontmatter,
      date:
        readString(input.frontmatter.date) ??
        new Date().toISOString().slice(0, 10),
      description: readString(input.frontmatter.description) ?? title,
      heroImage: readOptionalString(input.frontmatter.heroImage) ?? '',
      status: input.frontmatter.status ?? 'draft',
      theme: readOptionalString(input.frontmatter.theme),
      title,
    },
    mdx,
  };
}

function normalizeAdminArticleUpdateInput({
  existingFrontmatter,
  input,
  slug,
}: {
  existingFrontmatter: ContentArticleFrontmatterInput;
  input: AdminContentArticleUpdateInput;
  slug: string;
}): {
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
} {
  const mdx = readString(input.mdx);

  if (!mdx) {
    throw new ContentArticleAdminValidationError('Artikel-MDX ontbreekt.');
  }

  if (!hasMarkdownHeading(mdx)) {
    throw new ContentArticleAdminValidationError(
      'Artikel-MDX moet minimaal één heading bevatten.',
    );
  }

  if (!isRecord(input.frontmatter)) {
    throw new ContentArticleAdminValidationError(
      'Artikel-frontmatter ontbreekt.',
    );
  }

  const nextFrontmatter = input.frontmatter;
  const title = readString(nextFrontmatter.title);

  if (!title) {
    throw new ContentArticleAdminValidationError(
      'Artikel-frontmatter mist een titel.',
    );
  }

  const description = readString(nextFrontmatter.description) ?? title;
  const date =
    readString(nextFrontmatter.date) ??
    readString(existingFrontmatter.date) ??
    new Date().toISOString().slice(0, 10);

  return {
    frontmatter: {
      ...existingFrontmatter,
      ...nextFrontmatter,
      date,
      description,
      heroImage: readOptionalString(nextFrontmatter.heroImage) ?? '',
      slug,
      status: 'published',
      theme: readOptionalString(nextFrontmatter.theme),
      title,
    },
    mdx,
  };
}

export async function listAdminPublishedArticles({
  limit = 50,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  limit?: number;
  supabaseClient?: AdminArticleSupabaseClient;
} = {}): Promise<readonly AdminContentArticleSummary[]> {
  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select(ADMIN_ARTICLE_SELECT)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error('Gepubliceerde artikelen konden niet worden opgehaald.');
  }

  return sortContentArticlesByDateDesc(
    (Array.isArray(data) ? (data as AdminArticleRow[]) : [])
      .map(parseArticleRow)
      .map(toArticleSummary),
  ).slice(0, limit);
}

export async function getAdminPublishedArticleBySlug({
  slug,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  slug: string;
  supabaseClient?: AdminArticleSupabaseClient;
}): Promise<AdminContentArticleDetail | null> {
  const normalizedSlug = readString(slug);

  if (!normalizedSlug) {
    throw new ContentArticleAdminValidationError('Artikel-slug ontbreekt.');
  }

  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select(ADMIN_ARTICLE_SELECT)
    .eq('slug', normalizedSlug)
    .eq('status', 'published')
    .single();

  if (error) {
    const code = isRecord(error) ? error['code'] : undefined;

    if (code === 'PGRST116') {
      return null;
    }

    throw new Error('Artikel kon niet worden opgehaald.');
  }

  return data ? parseArticleRow(data as AdminArticleRow) : null;
}

export async function updateAdminPublishedArticle({
  input,
  slug,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: AdminContentArticleUpdateInput;
  slug: string;
  supabaseClient?: AdminArticleSupabaseClient;
}): Promise<AdminContentArticleDetail> {
  const existingArticle = await getAdminPublishedArticleBySlug({
    slug,
    supabaseClient,
  });

  if (!existingArticle) {
    throw new ContentArticleAdminNotFoundError('Artikel niet gevonden.');
  }

  const normalizedInput = normalizeAdminArticleUpdateInput({
    existingFrontmatter: existingArticle.frontmatter,
    input,
    slug: existingArticle.slug,
  });
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .update({
      frontmatter: normalizedInput.frontmatter,
      mdx: normalizedInput.mdx,
      title: normalizedInput.frontmatter.title,
      updated_at: updatedAt,
    })
    .eq('slug', existingArticle.slug)
    .eq('status', 'published')
    .select(ADMIN_ARTICLE_SELECT)
    .single();

  if (error) {
    throw new Error('Artikel opslaan is mislukt.');
  }

  return parseArticleRow(data as AdminArticleRow);
}

export async function deleteAdminPublishedArticleBySlug({
  slug,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  slug: string;
  supabaseClient?: AdminArticleDeleteSupabaseClient;
}): Promise<AdminContentArticleDeleteSummary> {
  const normalizedSlug = normalizeArticleSlug(slug);
  const existingArticle = await getAdminPublishedArticleBySlug({
    slug: normalizedSlug,
    supabaseClient,
  });

  if (!existingArticle) {
    throw new ContentArticleAdminNotFoundError('Artikel niet gevonden.');
  }

  const deletedStorageObjects = await deleteArticleStorageObjects({
    slug: normalizedSlug,
    supabaseClient,
  });

  const { count: deletedEventsCount, error: eventsError } = await supabaseClient
    .from(ARTICLE_EVENTS_TABLE_NAME)
    .delete({
      count: 'exact',
    })
    .eq('slug', normalizedSlug);

  if (eventsError) {
    throw new Error('Artikel-events verwijderen is mislukt.');
  }

  const { count: deletedPreviewsCount, error: previewsError } =
    await supabaseClient
      .from(ARTICLE_PREVIEWS_TABLE_NAME)
      .delete({
        count: 'exact',
      })
      .eq('frontmatter->>slug', normalizedSlug);

  if (previewsError) {
    throw new Error('Artikel-previews verwijderen is mislukt.');
  }

  const { count: clearedFeedItemsCount, error: feedItemsError } =
    await supabaseClient
      .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
      .update(
        {
          article_slug: null,
          status: 'new',
        },
        {
          count: 'exact',
        },
      )
      .eq('article_slug', normalizedSlug);

  if (feedItemsError) {
    throw new Error('Feed-item koppelingen opschonen is mislukt.');
  }

  const { count: deletedArticlesCount, error: articleError } =
    await supabaseClient
      .from(ARTICLES_TABLE_NAME)
      .delete({
        count: 'exact',
      })
      .eq('slug', normalizedSlug)
      .eq('status', 'published');

  if (articleError || readMutationCount(deletedArticlesCount) !== 1) {
    throw new Error('Artikel verwijderen is mislukt.');
  }

  return {
    clearedFeedItems: readMutationCount(clearedFeedItemsCount),
    deletedArticle: true,
    deletedEvents: readMutationCount(deletedEventsCount),
    deletedPreviews: readMutationCount(deletedPreviewsCount),
    deletedStorageObjects,
  };
}

export async function createAdminArticlePreview({
  input,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: AdminContentArticleUpdateInput;
  now?: Date;
  supabaseClient?: AdminArticleSupabaseClient;
}): Promise<{
  expiresAt: string;
  previewId: string;
}> {
  const normalizedInput = validatePreviewInput(input);
  const expiresAt = new Date(
    now.getTime() + ARTICLE_PREVIEW_TTL_MS,
  ).toISOString();
  const { data, error } = await supabaseClient
    .from(ARTICLE_PREVIEWS_TABLE_NAME)
    .insert({
      expires_at: expiresAt,
      frontmatter: normalizedInput.frontmatter,
      mdx: normalizedInput.mdx,
    })
    .select(ARTICLE_PREVIEW_SELECT)
    .single();

  if (error || !isRecord(data) || !readString(data['id'])) {
    throw new Error('Artikel-preview aanmaken is mislukt.');
  }

  return {
    expiresAt,
    previewId: readString(data['id']) ?? '',
  };
}

export const contentArticleAdminTestUtils = {
  hasMarkdownHeading,
};
