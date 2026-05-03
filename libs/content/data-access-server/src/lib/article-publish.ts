import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type ContentArticleFrontmatterInput,
  type ContentArticlePublishInput,
} from '@lego-platform/content/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

const ARTICLES_TABLE_NAME = 'articles';

type ArticlePublishSupabaseClient = Pick<SupabaseClient, 'from'>;

interface ArticleSlugRow {
  slug: string;
}

interface PublishedArticleRow {
  slug: string;
}

export class ContentArticlePublishValidationError extends Error {}
export class ContentArticlePublishConflictError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function slugifyContentArticleTitle(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/&/gu, ' en ')
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 90)
      .replace(/-+$/gu, '') || 'artikel'
  );
}

function normalizePublishFrontmatter(
  frontmatter: ContentArticleFrontmatterInput,
): ContentArticleFrontmatterInput {
  const title = readNonEmptyString(frontmatter.title);

  if (!title) {
    throw new ContentArticlePublishValidationError(
      'Artikel-frontmatter mist een titel.',
    );
  }

  return {
    ...frontmatter,
    date:
      readNonEmptyString(frontmatter.date) ??
      new Date().toISOString().slice(0, 10),
    description: readNonEmptyString(frontmatter.description) ?? title,
    slug: readNonEmptyString(frontmatter.slug),
    status: 'published',
    title,
  };
}

function readPublishInput(value: ContentArticlePublishInput): {
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
} {
  if (!isRecord(value.frontmatter)) {
    throw new ContentArticlePublishValidationError(
      'Artikel-frontmatter ontbreekt.',
    );
  }

  const mdx = readNonEmptyString(value.mdx);

  if (!mdx) {
    throw new ContentArticlePublishValidationError('Artikel-MDX ontbreekt.');
  }

  return {
    frontmatter: normalizePublishFrontmatter(value.frontmatter),
    mdx,
  };
}

async function listExistingArticleSlugs({
  baseSlug,
  supabaseClient,
}: {
  baseSlug: string;
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<readonly string[]> {
  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select('slug')
    .like('slug', `${baseSlug}%`);

  if (error) {
    throw new Error('Bestaande artikelslugs konden niet worden opgehaald.');
  }

  return Array.isArray(data)
    ? (data as ArticleSlugRow[]).map((row) => row.slug)
    : [];
}

function getNextAvailableSlug({
  baseSlug,
  existingSlugs,
}: {
  baseSlug: string;
  existingSlugs: readonly string[];
}): string {
  let highestSuffix = 0;

  for (const existingSlug of existingSlugs) {
    if (existingSlug === baseSlug) {
      highestSuffix = Math.max(highestSuffix, 1);
      continue;
    }

    const suffixMatch = existingSlug.match(
      new RegExp(`^${escapeRegExp(baseSlug)}-(\\d+)$`, 'u'),
    );

    if (!suffixMatch) {
      continue;
    }

    highestSuffix = Math.max(highestSuffix, Number(suffixMatch[1]));
  }

  return highestSuffix === 0 ? baseSlug : `${baseSlug}-${highestSuffix + 1}`;
}

export async function createUniqueContentArticleSlug({
  preferredSlug,
  supabaseClient = getServerSupabaseAdminClient(),
  title,
}: {
  preferredSlug?: string;
  supabaseClient?: ArticlePublishSupabaseClient;
  title: string;
}): Promise<string> {
  const baseSlug = slugifyContentArticleTitle(preferredSlug || title);

  return getNextAvailableSlug({
    baseSlug,
    existingSlugs: await listExistingArticleSlugs({
      baseSlug,
      supabaseClient,
    }),
  });
}

function isUniqueSlugConflict(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error['code'] === '23505' ||
      (typeof error['message'] === 'string' &&
        error['message'].toLowerCase().includes('duplicate key')))
  );
}

async function insertPublishedArticle({
  frontmatter,
  mdx,
  slug,
  supabaseClient,
}: {
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
  slug: string;
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<{ slug: string }> {
  const publishedFrontmatter: ContentArticleFrontmatterInput = {
    ...frontmatter,
    slug,
    status: 'published',
  };
  const publishedAt = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .insert({
      frontmatter: publishedFrontmatter,
      mdx,
      published_at: publishedAt,
      slug,
      status: 'published',
      title: publishedFrontmatter.title,
    })
    .select('slug')
    .single();

  if (error) {
    if (isUniqueSlugConflict(error)) {
      throw new ContentArticlePublishConflictError('Artikel-slug bestaat al.');
    }

    throw new Error('Artikel publiceren naar Supabase is mislukt.');
  }

  return {
    slug: (data as PublishedArticleRow | null)?.slug ?? slug,
  };
}

export async function publishContentArticle({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: ContentArticlePublishInput;
  supabaseClient?: ArticlePublishSupabaseClient;
}): Promise<{ slug: string }> {
  const { frontmatter, mdx } = readPublishInput(input);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await createUniqueContentArticleSlug({
      preferredSlug: frontmatter.slug,
      supabaseClient,
      title: frontmatter.title,
    });

    try {
      return await insertPublishedArticle({
        frontmatter,
        mdx,
        slug,
        supabaseClient,
      });
    } catch (error) {
      if (error instanceof ContentArticlePublishConflictError) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Er kon geen unieke artikelslug worden gemaakt.');
}

export const contentArticlePublishTestUtils = {
  getNextAvailableSlug,
};
