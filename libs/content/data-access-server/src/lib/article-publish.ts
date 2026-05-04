import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type ContentArticleNearDuplicateMatch,
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

interface PublishedArticleSourceRow {
  frontmatter?: unknown;
  mdx?: string;
  slug: string;
  title?: string;
}

export class ContentArticlePublishValidationError extends Error {}
export class ContentArticlePublishConflictError extends Error {}
export class ContentArticleDuplicateSourceError extends Error {
  constructor(
    message: string,
    readonly existingSlug?: string,
  ) {
    super(message);
  }
}
export class ContentArticleNearDuplicateError extends Error {
  constructor(
    message: string,
    readonly matches: readonly ContentArticleNearDuplicateMatch[],
  ) {
    super(message);
  }
}

const LOW_CONFIDENCE_PUBLISH_ERROR_MESSAGE =
  'Dit artikel is nog niet klaar voor publicatie.';
const DUPLICATE_SOURCE_PUBLISH_ERROR_MESSAGE =
  'Dit bronartikel is al gepubliceerd.';
const NEAR_DUPLICATE_PUBLISH_ERROR_MESSAGE =
  'Mogelijk overlappend artikel gevonden.';
const TRACKING_SEARCH_PARAM_PATTERNS = [
  /^utm_/iu,
  /^pk_/iu,
  /^sc_/iu,
  /^ref$/iu,
  /^ref_src$/iu,
  /^source$/iu,
  /^fbclid$/iu,
  /^gclid$/iu,
  /^gbraid$/iu,
  /^wbraid$/iu,
  /^msclkid$/iu,
  /^mc_cid$/iu,
  /^mc_eid$/iu,
  /^igshid$/iu,
] as const;

const PUBLICATION_UNSAFE_FALLBACK_PHRASES = [
  'Conceptdraft',
  'Controleer de bron',
  'nog niet alles hangt strak genoeg',
  'Gebruik deze draft',
  'niet als af verhaal',
  'catalog matches',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function normalizeArticleSourceUrl(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  try {
    const url = new URL(trimmedValue);
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';

    for (const searchParamKey of [...url.searchParams.keys()]) {
      if (
        TRACKING_SEARCH_PARAM_PATTERNS.some((pattern) =>
          pattern.test(searchParamKey),
        )
      ) {
        url.searchParams.delete(searchParamKey);
      }
    }

    url.searchParams.sort();

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/gu, '');
    }

    return url.toString().replace(/\/$/u, '');
  } catch {
    return trimmedValue.replace(/\/+$/gu, '');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => collectStringValues(item));
  }

  return [];
}

export function assertContentArticleReadyForPublication({
  frontmatter,
  mdx,
}: ContentArticlePublishInput): void {
  const searchableContent = [mdx, ...collectStringValues(frontmatter)]
    .join('\n')
    .toLowerCase();

  const containsUnsafeFallbackPhrase = PUBLICATION_UNSAFE_FALLBACK_PHRASES.some(
    (phrase) => searchableContent.includes(phrase.toLowerCase()),
  );

  if (containsUnsafeFallbackPhrase) {
    throw new ContentArticlePublishValidationError(
      LOW_CONFIDENCE_PUBLISH_ERROR_MESSAGE,
    );
  }
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

  const frontmatter = normalizePublishFrontmatter(value.frontmatter);
  const publishInput = {
    frontmatter,
    mdx,
  };

  assertContentArticleReadyForPublication(publishInput);

  return publishInput;
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

function readFrontmatterSourceUrl(frontmatter: unknown): string | undefined {
  return isRecord(frontmatter)
    ? readNonEmptyString(frontmatter['sourceUrl'])
    : undefined;
}

function readFrontmatterDate(frontmatter: unknown): string | undefined {
  return isRecord(frontmatter)
    ? readNonEmptyString(frontmatter['date'])
    : undefined;
}

function readFrontmatterTheme(frontmatter: unknown): string | undefined {
  return isRecord(frontmatter)
    ? readNonEmptyString(frontmatter['theme'])
    : undefined;
}

function readFrontmatterEventFingerprint(
  frontmatter: unknown,
): string | undefined {
  if (!isRecord(frontmatter)) {
    return undefined;
  }

  const eventFingerprint = frontmatter['eventFingerprint'];

  if (typeof eventFingerprint === 'string') {
    return readNonEmptyString(eventFingerprint);
  }

  if (isRecord(eventFingerprint)) {
    const type = readNonEmptyString(eventFingerprint['type']);
    const key = readNonEmptyString(eventFingerprint['key']);

    return type && key ? `${type}:${key}` : undefined;
  }

  return undefined;
}

function readArticleTitle({
  frontmatter,
  title,
}: {
  frontmatter?: unknown;
  title?: string;
}): string {
  return (
    (isRecord(frontmatter) ? readNonEmptyString(frontmatter['title']) : '') ||
    readNonEmptyString(title) ||
    'Bestaand artikel'
  );
}

function extractArticleSetNumbersFromMdx(mdx: string): Set<string> {
  const setNumbers = new Set<string>();

  for (const match of mdx.matchAll(
    /\bsetNumber\s*=\s*(?:"([^"]+)"|'([^']+)')/giu,
  )) {
    const setNumber = readNonEmptyString(match[1] ?? match[2]);

    if (setNumber) {
      setNumbers.add(setNumber.replace(/-1$/u, ''));
    }
  }

  for (const match of mdx.matchAll(
    /\bsetIds\s*=\s*(?:"([^"]+)"|'([^']+)')/giu,
  )) {
    for (const setNumber of (match[1] ?? match[2] ?? '').split(',')) {
      const trimmedSetNumber = readNonEmptyString(setNumber);

      if (trimmedSetNumber) {
        setNumbers.add(trimmedSetNumber.replace(/-1$/u, ''));
      }
    }
  }

  return setNumbers;
}

function extractPrimaryFeaturedSetNumber(mdx: string): string | undefined {
  const match = mdx.match(
    /<FeaturedSet\b[^>]*\bsetNumber\s*=\s*(?:"([^"]+)"|'([^']+)')/iu,
  );

  return readNonEmptyString(match?.[1] ?? match?.[2])?.replace(/-1$/u, '');
}

function normalizeComparableText(value?: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

function calculateTitleSimilarity(left?: string, right?: string): number {
  const leftTokens = new Set(
    normalizeComparableText(left)
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3),
  );
  const rightTokens = new Set(
    normalizeComparableText(right)
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3),
  );

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);

  return overlap.length / union.size;
}

function isSameTheme(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeComparableText(left).trim();
  const normalizedRight = normalizeComparableText(right).trim();

  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

function isWithinArticleDateWindow(left?: string, right?: string): boolean {
  const leftTimestamp = left
    ? Date.parse(`${left.slice(0, 10)}T00:00:00Z`)
    : NaN;
  const rightTimestamp = right
    ? Date.parse(`${right.slice(0, 10)}T00:00:00Z`)
    : NaN;

  if (!Number.isFinite(leftTimestamp) || !Number.isFinite(rightTimestamp)) {
    return false;
  }

  return Math.abs(leftTimestamp - rightTimestamp) <= 14 * 24 * 60 * 60 * 1000;
}

async function findPublishedArticleBySourceUrl({
  sourceUrl,
  supabaseClient,
}: {
  sourceUrl?: string;
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<PublishedArticleSourceRow | null> {
  const normalizedSourceUrl = sourceUrl
    ? normalizeArticleSourceUrl(sourceUrl)
    : '';

  if (!normalizedSourceUrl) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select('slug, frontmatter')
    .eq('status', 'published');

  if (error) {
    throw new Error('Bestaande artikelbronnen konden niet worden opgehaald.');
  }

  if (!Array.isArray(data)) {
    return null;
  }

  return (
    (data as PublishedArticleSourceRow[]).find((row) => {
      const existingSourceUrl = readFrontmatterSourceUrl(row.frontmatter);

      return (
        existingSourceUrl &&
        normalizeArticleSourceUrl(existingSourceUrl) === normalizedSourceUrl
      );
    }) ?? null
  );
}

async function assertPublishedSourceUrlIsUnique({
  frontmatter,
  supabaseClient,
}: {
  frontmatter: ContentArticleFrontmatterInput;
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<void> {
  const existingArticle = await findPublishedArticleBySourceUrl({
    sourceUrl: frontmatter.sourceUrl,
    supabaseClient,
  });

  if (existingArticle) {
    throw new ContentArticleDuplicateSourceError(
      DUPLICATE_SOURCE_PUBLISH_ERROR_MESSAGE,
      existingArticle.slug,
    );
  }
}

async function listPublishedArticleDuplicateCandidates({
  supabaseClient,
}: {
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<readonly PublishedArticleSourceRow[]> {
  const { data, error } = await supabaseClient
    .from(ARTICLES_TABLE_NAME)
    .select('slug, title, frontmatter, mdx')
    .eq('status', 'published');

  if (error) {
    throw new Error('Bestaande artikelen konden niet worden opgehaald.');
  }

  return Array.isArray(data) ? (data as PublishedArticleSourceRow[]) : [];
}

function findNearDuplicateMatches({
  existingArticles,
  frontmatter,
  mdx,
}: {
  existingArticles: readonly PublishedArticleSourceRow[];
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
}): ContentArticleNearDuplicateMatch[] {
  const articleDate = frontmatter.date;
  const articleTheme = frontmatter.theme;
  const articleTitle = frontmatter.title;
  const eventFingerprint = readFrontmatterEventFingerprint(frontmatter);
  const primarySetNumber = extractPrimaryFeaturedSetNumber(mdx);
  const setNumbers = extractArticleSetNumbersFromMdx(mdx);
  const matches: ContentArticleNearDuplicateMatch[] = [];

  for (const existingArticle of existingArticles) {
    const existingMdx = existingArticle.mdx ?? '';
    const existingTitle = readArticleTitle(existingArticle);
    const existingDate = readFrontmatterDate(existingArticle.frontmatter);
    const existingTheme = readFrontmatterTheme(existingArticle.frontmatter);
    const existingEventFingerprint = readFrontmatterEventFingerprint(
      existingArticle.frontmatter,
    );
    const existingPrimarySetNumber =
      extractPrimaryFeaturedSetNumber(existingMdx);
    const existingSetNumbers = extractArticleSetNumbersFromMdx(existingMdx);
    const sameTheme = isSameTheme(articleTheme, existingTheme);
    const inDateWindow = isWithinArticleDateWindow(articleDate, existingDate);
    const overlappingSetNumbers = [...setNumbers].filter((setNumber) =>
      existingSetNumbers.has(setNumber),
    );

    if (
      eventFingerprint &&
      existingEventFingerprint &&
      eventFingerprint === existingEventFingerprint
    ) {
      matches.push({
        reason: 'Zelfde event fingerprint',
        slug: existingArticle.slug,
        title: existingTitle,
      });
      continue;
    }

    if (
      primarySetNumber &&
      primarySetNumber === existingPrimarySetNumber &&
      sameTheme &&
      inDateWindow &&
      calculateTitleSimilarity(articleTitle, existingTitle) >= 0.15
    ) {
      matches.push({
        reason: `Zelfde uitgelichte set ${primarySetNumber}`,
        slug: existingArticle.slug,
        title: existingTitle,
      });
      continue;
    }

    if (overlappingSetNumbers.length && sameTheme && inDateWindow) {
      matches.push({
        reason: `Overlappende set(s): ${overlappingSetNumbers.join(', ')}`,
        slug: existingArticle.slug,
        title: existingTitle,
      });
    }
  }

  return matches;
}

async function assertNoNearDuplicatePublishedArticle({
  force,
  frontmatter,
  mdx,
  supabaseClient,
}: {
  force?: boolean;
  frontmatter: ContentArticleFrontmatterInput;
  mdx: string;
  supabaseClient: ArticlePublishSupabaseClient;
}): Promise<void> {
  if (force) {
    return;
  }

  const matches = findNearDuplicateMatches({
    existingArticles: await listPublishedArticleDuplicateCandidates({
      supabaseClient,
    }),
    frontmatter,
    mdx,
  });

  if (matches.length) {
    throw new ContentArticleNearDuplicateError(
      NEAR_DUPLICATE_PUBLISH_ERROR_MESSAGE,
      matches,
    );
  }
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

  await assertPublishedSourceUrlIsUnique({
    frontmatter,
    supabaseClient,
  });
  await assertNoNearDuplicatePublishedArticle({
    force: input.force,
    frontmatter,
    mdx,
    supabaseClient,
  });

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
  normalizeArticleSourceUrl,
};
