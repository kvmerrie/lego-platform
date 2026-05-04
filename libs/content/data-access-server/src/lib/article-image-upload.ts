import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

const ARTICLE_IMAGES_BUCKET = 'article-images';
const MAX_ARTICLE_IMAGE_BYTES = 5 * 1024 * 1024;
const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const LEGO_IMAGE_CREDIT = 'Beeld: © The LEGO Group';

const SUPPORTED_ARTICLE_IMAGE_CONTENT_TYPE = 'image/webp';
const SUPPORTED_REMOTE_ARTICLE_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type ArticleImageStorageClient = Pick<SupabaseClient, 'storage'>;

export class ContentArticleImageUploadValidationError extends Error {}

export interface ContentArticleHeroImageUploadInput {
  base64Data: string;
  contentType: string;
  fileName: string;
  slug: string;
}

export interface ContentArticleHeroImageUploadResult {
  path: string;
  publicUrl: string;
}

export interface ContentArticleImageUploadInput {
  base64Data: string;
  contentType: string;
  fileName: string;
  imageId?: string;
  slug: string;
  type: 'gallery' | 'hero';
}

export interface ContentArticleImageUploadResult {
  path: string;
  publicUrl: string;
}

export interface ContentArticleHeroImageUrlImportInput {
  imageUrl: string;
  slug: string;
}

export interface ContentArticleHeroImageUrlImportResult {
  heroImage: string;
  heroImageCredit: string;
  path: string;
}

export interface ContentArticleImageUrlImportInput {
  imageId?: string;
  imageUrl: string;
  slug: string;
  type: 'gallery' | 'hero';
}

export interface ContentArticleImageUrlImportResult {
  imageCredit: string;
  imageUrl: string;
  path: string;
}

function decodeArticleImageBase64(base64Data: string): Uint8Array {
  const normalizedBase64 = base64Data.includes(',')
    ? base64Data.slice(base64Data.indexOf(',') + 1)
    : base64Data;

  try {
    return Buffer.from(normalizedBase64, 'base64');
  } catch {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding kon niet worden gelezen.',
    );
  }
}

function validateArticleSlug(slug: string): void {
  if (!ARTICLE_SLUG_PATTERN.test(slug)) {
    throw new ContentArticleImageUploadValidationError(
      'Artikel-slug ontbreekt of is ongeldig.',
    );
  }
}

function validateLegoImageUrl(imageUrl: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new ContentArticleImageUploadValidationError(
      'Afbeeldings-URL is ongeldig.',
    );
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new ContentArticleImageUploadValidationError(
      'Afbeeldings-URL moet https gebruiken.',
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowedLegoHost =
    hostname === 'lego.com' ||
    hostname === 'www.lego.com' ||
    hostname === 'assets.lego.com';

  if (!isAllowedLegoHost) {
    throw new ContentArticleImageUploadValidationError(
      'Alleen officiële LEGO afbeeldings-URL’s zijn toegestaan.',
    );
  }

  return parsedUrl;
}

function normalizeImageContentType(contentType: string | null): string {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readRemoteImageBytes(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);

  if (contentLength > MAX_ARTICLE_IMAGE_BYTES) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding is te groot. Gebruik maximaal 5 MB.',
    );
  }

  if (!response.body) {
    const imageBytes = new Uint8Array(await response.arrayBuffer());

    if (imageBytes.byteLength > MAX_ARTICLE_IMAGE_BYTES) {
      throw new ContentArticleImageUploadValidationError(
        'Hero afbeelding is te groot. Gebruik maximaal 5 MB.',
      );
    }

    return imageBytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (value) {
      totalBytes += value.byteLength;

      if (totalBytes > MAX_ARTICLE_IMAGE_BYTES) {
        throw new ContentArticleImageUploadValidationError(
          'Hero afbeelding is te groot. Gebruik maximaal 5 MB.',
        );
      }

      chunks.push(value);
    }
  }

  const imageBytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    imageBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return imageBytes;
}

async function optimizeArticleHeroImageToWebp(
  imageBytes: Uint8Array,
): Promise<Buffer> {
  try {
    return await sharp(imageBytes)
      .rotate()
      .resize({
        width: 1600,
        withoutEnlargement: true,
      })
      .webp({
        quality: 86,
      })
      .toBuffer();
  } catch {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding kon niet worden verwerkt.',
    );
  }
}

async function storeOptimizedArticleHeroImage({
  imageBytes,
  imageId,
  slug,
  supabaseClient,
  type = 'hero',
}: {
  imageId?: string;
  imageBytes: Uint8Array;
  slug: string;
  supabaseClient: ArticleImageStorageClient;
  type?: 'gallery' | 'hero';
}): Promise<ContentArticleImageUploadResult> {
  const path =
    type === 'gallery'
      ? `articles/${slug}/gallery/${imageId || randomUUID()}.webp`
      : `articles/${slug}/hero.webp`;
  const bucket = supabaseClient.storage.from(ARTICLE_IMAGES_BUCKET);
  const { error } = await bucket.upload(path, imageBytes, {
    contentType: SUPPORTED_ARTICLE_IMAGE_CONTENT_TYPE,
    upsert: true,
  });

  if (error) {
    throw new Error('Hero afbeelding uploaden is mislukt.');
  }

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(path);

  return {
    path,
    publicUrl,
  };
}

export async function uploadContentArticleImage({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: ContentArticleImageUploadInput;
  supabaseClient?: ArticleImageStorageClient;
}): Promise<ContentArticleImageUploadResult> {
  const slug = input.slug.trim();
  const contentType = input.contentType.trim().toLowerCase();

  validateArticleSlug(slug);

  if (contentType !== SUPPORTED_ARTICLE_IMAGE_CONTENT_TYPE) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding moet als webp worden geüpload.',
    );
  }

  const imageBytes = decodeArticleImageBase64(input.base64Data);

  if (imageBytes.byteLength === 0) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding ontbreekt.',
    );
  }

  if (imageBytes.byteLength > MAX_ARTICLE_IMAGE_BYTES) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding is te groot. Gebruik maximaal 5 MB.',
    );
  }

  return storeOptimizedArticleHeroImage({
    imageId: input.imageId,
    imageBytes,
    slug,
    supabaseClient,
    type: input.type,
  });
}

export async function uploadContentArticleHeroImage({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: ContentArticleHeroImageUploadInput;
  supabaseClient?: ArticleImageStorageClient;
}): Promise<ContentArticleHeroImageUploadResult> {
  return uploadContentArticleImage({
    input: {
      ...input,
      type: 'hero',
    },
    supabaseClient,
  });
}

export async function importContentArticleImageFromUrl({
  fetchFn = fetch,
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  fetchFn?: typeof fetch;
  input: ContentArticleImageUrlImportInput;
  supabaseClient?: ArticleImageStorageClient;
}): Promise<ContentArticleImageUrlImportResult> {
  const slug = input.slug.trim();
  const imageUrl = input.imageUrl.trim();

  validateArticleSlug(slug);

  const parsedUrl = validateLegoImageUrl(imageUrl);
  const response = await fetchFn(parsedUrl);

  if (!response.ok) {
    throw new ContentArticleImageUploadValidationError(
      'Afbeelding kon niet worden opgehaald.',
    );
  }

  const contentType = normalizeImageContentType(
    response.headers.get('content-type'),
  );

  if (!SUPPORTED_REMOTE_ARTICLE_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new ContentArticleImageUploadValidationError(
      'Afbeeldings-URL moet een jpg, png of webp afbeelding zijn.',
    );
  }

  const remoteImageBytes = await readRemoteImageBytes(response);

  if (remoteImageBytes.byteLength === 0) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding ontbreekt.',
    );
  }

  const optimizedImageBytes =
    await optimizeArticleHeroImageToWebp(remoteImageBytes);
  const result = await storeOptimizedArticleHeroImage({
    imageId: input.imageId,
    imageBytes: optimizedImageBytes,
    slug,
    supabaseClient,
    type: input.type,
  });

  return {
    imageCredit: LEGO_IMAGE_CREDIT,
    imageUrl: result.publicUrl,
    path: result.path,
  };
}

export async function importContentArticleHeroImageFromUrl({
  fetchFn = fetch,
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  fetchFn?: typeof fetch;
  input: ContentArticleHeroImageUrlImportInput;
  supabaseClient?: ArticleImageStorageClient;
}): Promise<ContentArticleHeroImageUrlImportResult> {
  const result = await importContentArticleImageFromUrl({
    fetchFn,
    input: {
      ...input,
      type: 'hero',
    },
    supabaseClient,
  });

  return {
    heroImage: result.imageUrl,
    heroImageCredit: result.imageCredit,
    path: result.path,
  };
}
