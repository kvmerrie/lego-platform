import { createHash } from 'node:crypto';
import sharp = require('sharp');
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalCatalogSetId } from '@lego-platform/catalog/util';

export const CATALOG_SET_IMAGES_BUCKET = 'catalog-set-images';
export const CATALOG_SET_IMAGES_TABLE = 'catalog_set_images';
const BRICKHUNT_SET_IMAGE_PUBLIC_PATH_PREFIX = '/images/';
const CATALOG_STORED_SET_IMAGE_TYPES = [
  'card',
  'gallery',
  'hero',
  'social',
  'thumbnail',
] as const;
const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const BRICKSET_SOURCE = 'brickset';
const BRICKSET_LOCALE = 'en-US';
const BRICKSET_MATCH_CONFIDENCE = 'exact_set_number';
const SUPPORTED_REMOTE_SET_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_REMOTE_SET_IMAGE_BYTES = 12 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 12_000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 3;
const DEFAULT_UPLOAD_RETRY_COUNT = 0;
const MAX_UPLOAD_RETRY_COUNT = 3;
const STORAGE_PROJECTION_SET_COUNTS = [100, 1000] as const;
const BYTES_PER_GB = 1_000_000_000;
const SOCIAL_IMAGE_BACKGROUND = { b: 255, g: 255, r: 255 } as const;
const SOCIAL_IMAGE_HEIGHT = 630;
const SOCIAL_IMAGE_WIDTH = 1200;
const PERCEPTUAL_DUPLICATE_DISTANCE_THRESHOLD = 5;
const DEDUPE_AUDIT_THRESHOLDS = [5, 8, 10, 12, 16] as const;
const DEDUPE_AUDIT_GALLERY_PAIR_LIMIT = 10;
const HERO_SIMILARITY_SUPPRESSION_DISTANCE_THRESHOLD = 32;
const HERO_SIMILARITY_SUPPRESSION_POSITION_LIMIT = 2;
const IMAGE_ROLE_VALUES = [
  'box_back',
  'box_front',
  'build',
  'detail',
  'lifestyle_people',
  'lifestyle_room',
  'logo',
  'minifigure',
  'model_primary',
  'model_secondary',
  'unknown',
] as const;

export type CatalogSetImageSource = 'brickset' | 'manual' | 'rebrickable';
export type CatalogStoredSetImageType =
  (typeof CATALOG_STORED_SET_IMAGE_TYPES)[number];
export type CatalogStoredSetImageStatus = 'active' | 'duplicate' | 'failed';
export type CatalogSetImageRole = (typeof IMAGE_ROLE_VALUES)[number];
export type CatalogSetImageDuplicateReason = 'perceptual' | 'sha256';

type CatalogSetImageSyncClient = Pick<SupabaseClient, 'from' | 'storage'>;
type CatalogSetImageMetadataClient = Pick<SupabaseClient, 'from'>;
type CatalogSetImageStorageClient = Pick<SupabaseClient, 'storage'>;

interface CatalogSetImageCandidateRow {
  image_url: string | null;
  name: string;
  set_id: string;
  source_set_number: string | null;
  status: string;
}

interface CatalogSetSourceMetadataRow {
  catalog_set_id: string;
  metadata_json: unknown;
  policy: string | null;
}

export interface CatalogSetImageSourceCandidate {
  imageUrl: string;
  preferredType: 'gallery' | 'hero';
  source: CatalogSetImageSource;
}

export interface CatalogSetImageSyncCandidate {
  imageUrl?: string;
  name: string;
  setId: string;
  sourceSetNumber?: string;
}

export interface CatalogSetImageSyncItemResult {
  cardImageStored: boolean;
  dedupeAudit?: CatalogSetImageDedupeAudit;
  duplicateGroups: readonly CatalogSetImageDuplicateGroup[];
  duplicateSourceCount: number;
  estimatedUploadBytes: number;
  exactDuplicateCount: number;
  failedSourceCount: number;
  failedSourceSamples: readonly CatalogSetImageFailureSample[];
  failedVariantCount: number;
  failedVariantSamples: readonly CatalogSetImageFailureSample[];
  galleryImageCount: number;
  heroImageStored: boolean;
  imageBytesByType: Record<CatalogStoredSetImageType, number>;
  imageCountByType: Record<CatalogStoredSetImageType, number>;
  heroSimilaritySuppressedCount: number;
  perceptualDuplicateCount: number;
  roleCounts: Record<CatalogSetImageRole, number>;
  setId: string;
  socialImageStored: boolean;
  suppressedImages: readonly CatalogSetImageSuppressedImage[];
  thumbnailImageStored: boolean;
  uploadedBytes: number;
  visibleGalleryOrder: readonly CatalogSetImageVisibleGalleryOrderItem[];
  orphanThumbnailRows: readonly CatalogSetImageOrphanThumbnailRow[];
  warnings: readonly string[];
}

export interface CatalogSetImageDuplicateGroup {
  duplicateDistance: number | null;
  duplicateReason: CatalogSetImageDuplicateReason;
  duplicateSlot: string;
  keptSlot: string;
}

export interface CatalogSetImageDedupeAuditCandidate {
  filename: string;
  galleryRank: number | null;
  gallerySuppressed: boolean;
  gallerySuppressionReason: string | null;
  heroSimilarityDistance: number | null;
  heroCandidate: boolean;
  height: number;
  imageRole: CatalogSetImageRole;
  imageTypeCandidate: 'gallery' | 'hero';
  perceptualHash: string;
  roleReason: string;
  sha256Prefix: string;
  sortOrder: number;
  source: CatalogSetImageSource;
  sourceUrl: string;
  slot: string;
  width: number;
}

export interface CatalogSetImageDedupeAuditPair {
  currentDecision: CatalogSetImageDuplicateReason | 'none';
  exactDuplicate: boolean;
  leftSlot: string;
  pairType: 'gallery-gallery' | 'hero-gallery';
  perceptualDistance: number;
  rightSlot: string;
  wouldDuplicateAtThresholds: Record<string, boolean>;
}

export interface CatalogSetImageDedupeAudit {
  candidates: readonly CatalogSetImageDedupeAuditCandidate[];
  pairs: readonly CatalogSetImageDedupeAuditPair[];
  recommendation: string;
  setId: string;
  visibleGalleryOrder: readonly CatalogSetImageVisibleGalleryOrderItem[];
}

export interface CatalogSetImageSuppressedImage {
  galleryRank: number;
  heroSimilarityDistance: number;
  reason: string;
  role: CatalogSetImageRole;
  slot: string;
  sourceUrl: string;
}

export interface CatalogSetImageVisibleGalleryOrderItem {
  filename: string;
  galleryRank: number;
  heroCandidate: boolean;
  heroSimilarityDistance: number | null;
  role: CatalogSetImageRole;
  slot: string;
  sortOrder: number;
  sourceUrl: string;
}

export interface CatalogSetImageOrphanThumbnailRow {
  publicUrl: string | null;
  reason: string;
  setId: string;
  sortOrder: number;
  storagePath: string | null;
}

export interface CatalogSetImageTypeFootprint {
  averageBytes: number;
  imageCount: number;
  totalBytes: number;
}

export interface CatalogSetImageFootprintProjection {
  bandwidthBytesPerFullImagePayloadView: number;
  bandwidthGbPerFullImagePayloadView: number;
  setCount: number;
  storageBytes: number;
  storageGb: number;
}

export interface CatalogSetImageFootprintReport {
  averageBytesPerSet: number;
  averageGalleryImagesPerSet: number;
  bandwidthAssumptions: {
    cdnCacheHitRate: number;
    fullImagePayloadViewsPerSet: number;
    note: string;
  };
  byType: Record<CatalogStoredSetImageType, CatalogSetImageTypeFootprint>;
  currentCatalogSetCount: number;
  projections: {
    currentCatalog: CatalogSetImageFootprintProjection;
    sets100: CatalogSetImageFootprintProjection;
    sets1000: CatalogSetImageFootprintProjection;
  };
  sampleSetCount: number;
}

export interface CatalogSetImageSyncResult {
  activeCatalogSetCount: number;
  bucket: string;
  debugDedupe: boolean;
  dedupeAudits: readonly CatalogSetImageDedupeAudit[];
  dryRun: boolean;
  duplicateGroups: readonly CatalogSetImageDuplicateGroup[];
  duplicateSourceCount: number;
  estimatedUploadBytes: number;
  exactDuplicateCount: number;
  failedSetCount: number;
  failedSourceCount: number;
  failedSourceSamples: readonly CatalogSetImageFailureSample[];
  failedVariantCount: number;
  failedVariantSamples: readonly CatalogSetImageFailureSample[];
  footprintReport: CatalogSetImageFootprintReport;
  heroSimilaritySuppressedCount: number;
  missingOnly: boolean;
  orphanThumbnailRowCount: number;
  orphanThumbnailRows: readonly CatalogSetImageOrphanThumbnailRow[];
  perceptualDuplicateCount: number;
  processedSetCount: number;
  refreshImageMetadata: boolean;
  refreshFailed: boolean;
  refreshSocial: boolean;
  refreshCard: boolean;
  refreshThumbnails: boolean;
  roleCounts: Record<CatalogSetImageRole, number>;
  selectedSetCount: number;
  setIds?: readonly string[];
  skippedSetCount: number;
  suppressedImages: readonly CatalogSetImageSuppressedImage[];
  uploadedBytes: number;
  uploadRetryCount: number;
  write: boolean;
  results: readonly CatalogSetImageSyncItemResult[];
}

export interface CatalogSetImageSyncOptions {
  concurrency?: number;
  dryRun?: boolean;
  fetchFn?: typeof fetch;
  limit?: number;
  metadataSupabaseClient?: CatalogSetImageMetadataClient;
  missingOnly?: boolean;
  debugDedupe?: boolean;
  refreshImageMetadata?: boolean;
  refreshFailed?: boolean;
  refreshCard?: boolean;
  refreshSocial?: boolean;
  refreshThumbnails?: boolean;
  setIds?: readonly string[];
  storageSupabaseClient?: CatalogSetImageStorageClient;
  supabaseClient?: CatalogSetImageSyncClient;
  uploadRetryCount?: number;
}

export interface CatalogSetImageFailureSample {
  bucket: string | null;
  byteSize: number | null;
  details: string | null;
  imageType: CatalogStoredSetImageType;
  message: string;
  setId: string;
  sortOrder: number;
  sourceUrl: string;
  status: string | null;
  storagePath: string | null;
}

export interface CatalogSetImageMetadataCopyResult {
  copiedCount: number;
  dryRun: boolean;
  readCount: number;
  setIds?: readonly string[];
  skippedCount: number;
  source: 'production';
  target: 'staging';
}

export interface CopyCatalogSetImageMetadataOptions {
  dryRun?: boolean;
  setIds?: readonly string[];
  sourceSupabaseClient: CatalogSetImageMetadataClient;
  targetSupabaseClient: CatalogSetImageMetadataClient;
}

export interface CatalogSetImagePublicUrlRewriteResult {
  dryRun: boolean;
  readCount: number;
  rewrittenCount: number;
  setIds?: readonly string[];
  skippedCount: number;
}

export interface RewriteCatalogSetImagePublicUrlsOptions {
  dryRun?: boolean;
  setIds?: readonly string[];
  supabaseClient: CatalogSetImageMetadataClient;
}

interface DownloadedSetImage {
  bytes: Uint8Array;
  contentType: string;
  sha256: string;
}

interface CatalogSetImageAnalysis {
  backgroundEdgeWhiteRatio: number;
  height: number;
  perceptualHash: string;
  width: number;
}

interface CatalogSetImageRoleClassification {
  confidence: 'high' | 'low' | 'medium';
  reason: string;
  role: CatalogSetImageRole;
  source: 'deterministic-v2';
}

interface AnalyzedSetImage {
  analysis: CatalogSetImageAnalysis;
  candidate: CatalogSetImageSourceCandidate;
  downloadedImage: DownloadedSetImage;
  imageType: 'gallery' | 'hero';
  roleClassification: CatalogSetImageRoleClassification;
  sortOrder: number;
  slotKey: string;
}

interface DuplicateDecision {
  duplicateDistance: number | null;
  duplicateOfSlotKey: string;
  duplicateReason: CatalogSetImageDuplicateReason;
}

interface GalleryCurationDecision {
  galleryRank: number;
  galleryRoleRank: number;
  heroSimilarityDistance: number | null;
  suppressed: boolean;
  suppressionReason: string | null;
}

interface OptimizedSetImageVariant {
  bytes: Buffer;
  byteSize: number;
  contentType: 'image/jpeg' | 'image/webp';
  height: number;
  imageType: CatalogStoredSetImageType;
  sha256: string;
  storagePath: string;
  width: number;
}

interface CatalogSetImageUpsertRow {
  byte_size: number | null;
  content_type: string | null;
  duplicate_distance: number | null;
  duplicate_of_id: string | null;
  duplicate_reason: CatalogSetImageDuplicateReason | null;
  height: number | null;
  image_role: CatalogSetImageRole;
  image_type: CatalogStoredSetImageType;
  metadata_json: Record<string, unknown>;
  perceptual_hash: string | null;
  public_url: string | null;
  set_id: string;
  sha256: string | null;
  sort_order: number;
  source: CatalogSetImageSource;
  source_url: string;
  status: CatalogStoredSetImageStatus;
  storage_bucket: string | null;
  storage_path: string | null;
  width: number | null;
}

interface CatalogSetImageProcessContext {
  bricksetImageCandidatesBySetId: ReadonlyMap<
    string,
    readonly CatalogSetImageSourceCandidate[]
  >;
  dryRun: boolean;
  fetchFn: typeof fetch;
  metadataSupabaseClient: CatalogSetImageMetadataClient;
  debugDedupe: boolean;
  refreshImageMetadata: boolean;
  refreshCard: boolean;
  refreshSocial: boolean;
  refreshThumbnails: boolean;
  storageSupabaseClient: CatalogSetImageStorageClient;
  uploadRetryCount: number;
}

interface CatalogSetImageUploadErrorDetails {
  bucket: string;
  byteSize: number;
  details: string | null;
  imageType: CatalogStoredSetImageType;
  message: string;
  rawError: unknown;
  retryCount: number;
  setId: string;
  sortOrder: number;
  status: string | null;
  storagePath: string;
}

class CatalogSetImageUploadError extends Error {
  readonly uploadDetails: CatalogSetImageUploadErrorDetails;

  constructor(details: CatalogSetImageUploadErrorDetails) {
    const statusText = details.status ? ` status=${details.status}` : '';
    const detailText = details.details ? ` details=${details.details}` : '';

    super(
      `Unable to upload catalog set image variant bucket=${details.bucket} storage_path=${details.storagePath} set_id=${details.setId} image_type=${details.imageType} sort_order=${details.sortOrder} byte_size=${details.byteSize}${statusText} message=${details.message}${detailText}`,
    );
    this.name = 'CatalogSetImageUploadError';
    this.uploadDetails = details;
  }
}

function normalizeRemoteImageContentType(contentType: string | null): string {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function createEmptyImageTypeNumberRecord(): Record<
  CatalogStoredSetImageType,
  number
> {
  return {
    card: 0,
    gallery: 0,
    hero: 0,
    social: 0,
    thumbnail: 0,
  };
}

function encodeStoragePath(storagePath: string): string {
  return storagePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function toBrickhuntCatalogSetImagePublicUrl(
  storagePath: string | null | undefined,
): string | null {
  const normalizedStoragePath = storagePath?.trim();

  if (!normalizedStoragePath?.startsWith('sets/')) {
    return null;
  }

  return `${BRICKHUNT_SET_IMAGE_PUBLIC_PATH_PREFIX}${encodeStoragePath(normalizedStoragePath)}`;
}

function isBrickhuntCatalogSetImagePublicUrl(publicUrl: string): boolean {
  try {
    const parsedUrl = new URL(publicUrl);

    return parsedUrl.pathname.startsWith(
      `${BRICKHUNT_SET_IMAGE_PUBLIC_PATH_PREFIX}sets/`,
    );
  } catch {
    return publicUrl.startsWith(
      `${BRICKHUNT_SET_IMAGE_PUBLIC_PATH_PREFIX}sets/`,
    );
  }
}

function toCatalogSetImageMetadataWithStoragePublicUrl({
  metadataJson,
  storagePublicUrl,
}: {
  metadataJson: Record<string, unknown>;
  storagePublicUrl: string | null | undefined;
}): Record<string, unknown> {
  if (!storagePublicUrl) {
    return metadataJson;
  }

  return {
    ...metadataJson,
    storagePublicUrl,
  };
}

function normalizeCatalogSetImagePublicUrlRow(
  row: CatalogSetImageUpsertRow,
): CatalogSetImageUpsertRow {
  const brickhuntPublicUrl = toBrickhuntCatalogSetImagePublicUrl(
    row.storage_path,
  );

  if (!brickhuntPublicUrl) {
    return row;
  }

  const metadataJson =
    row.metadata_json && typeof row.metadata_json === 'object'
      ? row.metadata_json
      : {};
  const existingStoragePublicUrl = metadataJson['storagePublicUrl'];
  const storagePublicUrl =
    typeof existingStoragePublicUrl === 'string' && existingStoragePublicUrl
      ? existingStoragePublicUrl
      : row.public_url && !isBrickhuntCatalogSetImagePublicUrl(row.public_url)
        ? row.public_url
        : null;

  return {
    ...row,
    metadata_json: toCatalogSetImageMetadataWithStoragePublicUrl({
      metadataJson,
      storagePublicUrl,
    }),
    public_url: brickhuntPublicUrl,
  };
}

function createEmptyRoleCountRecord(): Record<CatalogSetImageRole, number> {
  return {
    box_back: 0,
    box_front: 0,
    build: 0,
    detail: 0,
    lifestyle_people: 0,
    lifestyle_room: 0,
    logo: 0,
    minifigure: 0,
    model_primary: 0,
    model_secondary: 0,
    unknown: 0,
  };
}

function getGalleryRoleRank(role: CatalogSetImageRole): number {
  switch (role) {
    case 'box_front':
      return 0;
    case 'lifestyle_room':
      return 1;
    case 'model_secondary':
      return 2;
    case 'detail':
      return 3;
    case 'minifigure':
      return 4;
    case 'build':
      return 5;
    case 'box_back':
      return 6;
    case 'lifestyle_people':
      return 7;
    case 'model_primary':
      return 8;
    case 'logo':
      return 9;
    case 'unknown':
      return 10;
  }
}

function isModelRole(role: CatalogSetImageRole): boolean {
  return role === 'model_primary' || role === 'model_secondary';
}

function isHeroCandidateRole(role: CatalogSetImageRole): boolean {
  return role === 'model_primary';
}

function getImageUsePreferenceRanks(
  role: CatalogSetImageRole,
): Record<'collectionPage' | 'newsArticle' | 'themePage', number | null> {
  return {
    collectionPage:
      role === 'model_primary' ? 1 : role === 'box_front' ? 2 : null,
    newsArticle:
      role === 'lifestyle_room'
        ? 1
        : role === 'lifestyle_people'
          ? 2
          : role === 'model_primary'
            ? 3
            : null,
    themePage:
      role === 'model_primary' ? 1 : role === 'lifestyle_room' ? 2 : null,
  };
}

function clampConcurrency(concurrency?: number): number {
  if (!Number.isInteger(concurrency) || !concurrency) {
    return DEFAULT_CONCURRENCY;
  }

  return Math.min(Math.max(concurrency, 1), MAX_CONCURRENCY);
}

function clampUploadRetryCount(uploadRetryCount?: number): number {
  if (!Number.isInteger(uploadRetryCount) || !uploadRetryCount) {
    return DEFAULT_UPLOAD_RETRY_COUNT;
  }

  return Math.min(Math.max(uploadRetryCount, 0), MAX_UPLOAD_RETRY_COUNT);
}

function normalizeSyncSetIds(setIds?: readonly string[]): string[] | undefined {
  const normalizedSetIds = [
    ...new Set(
      (setIds ?? [])
        .map((setId) => setId.trim())
        .filter(Boolean)
        .map(getCanonicalCatalogSetId),
    ),
  ];

  return normalizedSetIds.length ? normalizedSetIds : undefined;
}

function toCatalogSetImageSyncCandidate(
  row: CatalogSetImageCandidateRow,
): CatalogSetImageSyncCandidate {
  return {
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    name: row.name,
    setId: row.set_id,
    ...(row.source_set_number
      ? { sourceSetNumber: row.source_set_number }
      : {}),
  };
}

function readBricksetImageSourceCandidates(
  metadataJson: unknown,
): CatalogSetImageSourceCandidate[] {
  if (
    !metadataJson ||
    typeof metadataJson !== 'object' ||
    Array.isArray(metadataJson)
  ) {
    return [];
  }

  const sourceMetadata = metadataJson as { images?: unknown };

  if (!Array.isArray(sourceMetadata.images)) {
    return [];
  }

  return sourceMetadata.images
    .map((image): CatalogSetImageSourceCandidate | undefined => {
      if (!image || typeof image !== 'object' || Array.isArray(image)) {
        return undefined;
      }

      const imageReference = image as {
        imageUrl?: unknown;
        sourceField?: unknown;
        type?: unknown;
      };
      const imageUrl =
        typeof imageReference.imageUrl === 'string'
          ? imageReference.imageUrl.trim()
          : '';

      if (!imageUrl) {
        return undefined;
      }

      return {
        imageUrl,
        preferredType:
          imageReference.type === 'primary' ||
          imageReference.sourceField === 'image.imageURL'
            ? 'hero'
            : 'gallery',
        source: 'brickset',
      };
    })
    .filter(
      (candidate): candidate is CatalogSetImageSourceCandidate =>
        candidate != null,
    );
}

function buildSourceCandidatesForSet({
  bricksetCandidates,
  candidate,
}: {
  bricksetCandidates: readonly CatalogSetImageSourceCandidate[];
  candidate: CatalogSetImageSyncCandidate;
}): CatalogSetImageSourceCandidate[] {
  const candidates: CatalogSetImageSourceCandidate[] = [
    ...(candidate.imageUrl
      ? [
          {
            imageUrl: candidate.imageUrl,
            preferredType: 'hero' as const,
            source: 'rebrickable' as const,
          },
        ]
      : []),
    ...bricksetCandidates,
  ];
  const seenUrls = new Set<string>();

  return candidates.filter((sourceCandidate) => {
    const key = sourceCandidate.imageUrl.toLowerCase();

    if (seenUrls.has(key)) {
      return false;
    }

    seenUrls.add(key);

    return true;
  });
}

async function readRemoteImageBytes(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);

  if (contentLength > MAX_REMOTE_SET_IMAGE_BYTES) {
    throw new Error('Remote image is too large.');
  }

  const imageBytes = new Uint8Array(await response.arrayBuffer());

  if (imageBytes.byteLength > MAX_REMOTE_SET_IMAGE_BYTES) {
    throw new Error('Remote image is too large.');
  }

  if (imageBytes.byteLength === 0) {
    throw new Error('Remote image is empty.');
  }

  return imageBytes;
}

async function downloadSetImage({
  fetchFn,
  imageUrl,
}: {
  fetchFn: typeof fetch;
  imageUrl: string;
}): Promise<DownloadedSetImage> {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetchFn(imageUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote image returned ${response.status}.`);
    }

    const contentType = normalizeRemoteImageContentType(
      response.headers.get('content-type'),
    );

    if (!SUPPORTED_REMOTE_SET_IMAGE_CONTENT_TYPES.has(contentType)) {
      throw new Error(`Unsupported remote image content type: ${contentType}.`);
    }

    const bytes = await readRemoteImageBytes(response);

    return {
      bytes,
      contentType,
      sha256: sha256Hex(bytes),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function slotKey({
  imageType,
  sortOrder,
}: {
  imageType: CatalogStoredSetImageType | 'gallery' | 'hero';
  sortOrder: number;
}): string {
  return `${imageType}:${sortOrder}`;
}

function computeDHashHex(grayscalePixels: Buffer): string {
  let high = 0;
  let low = 0;
  let bitIndex = 0;

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = grayscalePixels[y * 9 + x] ?? 0;
      const right = grayscalePixels[y * 9 + x + 1] ?? 0;

      if (left > right) {
        if (bitIndex < 32) {
          low = (low | (1 << bitIndex)) >>> 0;
        } else {
          high = (high | (1 << (bitIndex - 32))) >>> 0;
        }
      }

      bitIndex += 1;
    }
  }

  return `${high.toString(16).padStart(8, '0')}${low
    .toString(16)
    .padStart(8, '0')}`;
}

function countSetBits(value: number): number {
  let remaining = value >>> 0;
  let count = 0;

  while (remaining !== 0) {
    remaining = (remaining & (remaining - 1)) >>> 0;
    count += 1;
  }

  return count;
}

function hammingDistanceHex(leftHash: string, rightHash: string): number {
  const leftHigh = Number.parseInt(leftHash.slice(0, 8), 16) >>> 0;
  const leftLow = Number.parseInt(leftHash.slice(8), 16) >>> 0;
  const rightHigh = Number.parseInt(rightHash.slice(0, 8), 16) >>> 0;
  const rightLow = Number.parseInt(rightHash.slice(8), 16) >>> 0;

  return (
    countSetBits((leftHigh ^ rightHigh) >>> 0) +
    countSetBits((leftLow ^ rightLow) >>> 0)
  );
}

function calculateEdgeWhiteRatio({
  pixels,
  width,
}: {
  pixels: Buffer;
  width: number;
}): number {
  if (width <= 0 || pixels.length === 0) {
    return 0;
  }

  const height = Math.floor(pixels.length / 3 / width);
  let edgePixelCount = 0;
  let whiteEdgePixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) {
        continue;
      }

      const pixelIndex = (y * width + x) * 3;
      const red = pixels[pixelIndex] ?? 0;
      const green = pixels[pixelIndex + 1] ?? 0;
      const blue = pixels[pixelIndex + 2] ?? 0;

      edgePixelCount += 1;

      if (red >= 238 && green >= 238 && blue >= 238) {
        whiteEdgePixelCount += 1;
      }
    }
  }

  return edgePixelCount ? whiteEdgePixelCount / edgePixelCount : 0;
}

async function analyzeSetImageBytes(
  inputBytes: Uint8Array,
): Promise<CatalogSetImageAnalysis> {
  const image = sharp(inputBytes).rotate();
  const metadata = await image.metadata();
  const dhashPixels = await image
    .clone()
    .resize({
      fit: 'fill',
      height: 8,
      width: 9,
    })
    .grayscale()
    .raw()
    .toBuffer();
  const edgeSample = await image
    .clone()
    .resize({
      background: { alpha: 1, b: 255, g: 255, r: 255 },
      fit: 'contain',
      height: 24,
      width: 24,
    })
    .flatten({
      background: { b: 255, g: 255, r: 255 },
    })
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  return {
    backgroundEdgeWhiteRatio: calculateEdgeWhiteRatio({
      pixels: edgeSample.data,
      width: edgeSample.info.width,
    }),
    height: metadata.height ?? edgeSample.info.height,
    perceptualHash: computeDHashHex(dhashPixels),
    width: metadata.width ?? edgeSample.info.width,
  };
}

function classifySetImageRole({
  analysis,
  imageType,
  sortOrder,
  sourceUrl,
}: {
  analysis: CatalogSetImageAnalysis;
  imageType: 'gallery' | 'hero';
  sortOrder: number;
  sourceUrl: string;
}): CatalogSetImageRoleClassification {
  const normalizedUrl = (() => {
    try {
      return decodeURIComponent(sourceUrl).toLowerCase();
    } catch {
      return sourceUrl.toLowerCase();
    }
  })();
  const filename = normalizedUrl.split(/[/?#]/).filter(Boolean).at(-1) ?? '';
  const normalizedFilename = filename.replace(/[-_.]+/g, ' ');
  const matchFilename = (patterns: readonly RegExp[]) =>
    patterns.some((pattern) => pattern.test(normalizedFilename));
  const makeRole = ({
    confidence,
    reason,
    role,
  }: {
    confidence: CatalogSetImageRoleClassification['confidence'];
    reason: string;
    role: CatalogSetImageRole;
  }): CatalogSetImageRoleClassification => ({
    confidence,
    reason,
    role,
    source: 'deterministic-v2',
  });

  if (
    matchFilename([
      /\bbox back\b/,
      /\bbox rear\b/,
      /\bback box\b/,
      /\bback of box\b/,
      /\bboxback\b/,
      /\brear box\b/,
      /\bboxrear\b/,
      /\brear packaging\b/,
      /\bpackage back\b/,
      /\bpackaging back\b/,
      /\bdoos achterkant\b/,
      /\bachterkant doos\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains rear box/package language',
      role: 'box_back',
    });
  }

  if (
    matchFilename([
      /\bbox\b/,
      /\bbox art\b/,
      /\bbox front\b/,
      /\bbox shot\b/,
      /\bbox\d+\b/,
      /\bboxprod\b/,
      /\bdoos\b/,
      /\bfront box\b/,
      /\bfront package\b/,
      /\bpack\b/,
      /\bpackage\b/,
      /\bpackaging\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains box/package language',
      role: 'box_front',
    });
  }

  if (matchFilename([/\bminifig\b/, /\bminifigure\b/, /\bfigure\b/])) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains minifigure language',
      role: 'minifigure',
    });
  }

  if (matchFilename([/\blogo\b/, /\bbrand\b/])) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains logo language',
      role: 'logo',
    });
  }

  if (
    matchFilename([
      /\bclose up\b/,
      /\bcloseup\b/,
      /\bcrop\b/,
      /\bdetail\b/,
      /\bmacro\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains close-up/detail language',
      role: 'detail',
    });
  }

  if (
    matchFilename([
      /\bbag\b/,
      /\bbuild\b/,
      /\binstruction\b/,
      /\bparts\b/,
      /\bpieces\b/,
      /\bstep\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains build/parts language',
      role: 'build',
    });
  }

  if (
    matchFilename([
      /\bchild\b/,
      /\bchildren\b/,
      /\bfamily\b/,
      /\bhand\b/,
      /\bhands\b/,
      /\bkid\b/,
      /\bkids\b/,
      /\bpeople\b/,
      /\bperson\b/,
      /\bplay\b/,
      /\bplaying\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains people/play lifestyle language',
      role: 'lifestyle_people',
    });
  }

  if (
    matchFilename([
      /\bambient\b/,
      /\bcontext\b/,
      /\blifestyle\b/,
      /\broom\b/,
      /\bscene\b/,
      /\bshelf\b/,
      /\bhome\b/,
      /\binterior\b/,
    ])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'filename contains lifestyle/context language',
      role: 'lifestyle_room',
    });
  }

  if (imageType === 'hero') {
    return makeRole({
      confidence: 'high',
      reason: 'current catalog hero image',
      role: 'model_primary',
    });
  }

  if (
    normalizedUrl.includes('/sets/images/') ||
    matchFilename([/^\d{4,6}\s*1$/])
  ) {
    return makeRole({
      confidence: 'medium',
      reason: 'source path looks like Brickset primary product image',
      role: 'model_primary',
    });
  }

  if (analysis.backgroundEdgeWhiteRatio >= 0.82) {
    return makeRole({
      confidence: 'medium',
      reason: 'image has a mostly white outer background',
      role: sortOrder <= 1 ? 'model_primary' : 'model_secondary',
    });
  }

  return makeRole({
    confidence: 'low',
    reason: 'no reliable filename or background signal',
    role: 'unknown',
  });
}

async function analyzeDownloadedSetImage({
  downloadedImage,
  imageType,
  sortOrder,
  sourceCandidate,
}: {
  downloadedImage: DownloadedSetImage;
  imageType: 'gallery' | 'hero';
  sortOrder: number;
  sourceCandidate: CatalogSetImageSourceCandidate;
}): Promise<AnalyzedSetImage> {
  const analysis = await analyzeSetImageBytes(downloadedImage.bytes);

  return {
    analysis,
    candidate: sourceCandidate,
    downloadedImage,
    imageType,
    roleClassification: classifySetImageRole({
      analysis,
      imageType,
      sortOrder,
      sourceUrl: sourceCandidate.imageUrl,
    }),
    sortOrder,
    slotKey: slotKey({
      imageType,
      sortOrder,
    }),
  };
}

function getDuplicateDecisions(
  images: readonly AnalyzedSetImage[],
): Map<string, DuplicateDecision> {
  const duplicateDecisions = new Map<string, DuplicateDecision>();
  const activeImages: AnalyzedSetImage[] = [];

  for (const image of images) {
    const exactDuplicate = activeImages.find(
      (activeImage) =>
        activeImage.downloadedImage.sha256 === image.downloadedImage.sha256,
    );

    if (exactDuplicate) {
      duplicateDecisions.set(image.slotKey, {
        duplicateDistance: 0,
        duplicateOfSlotKey: exactDuplicate.slotKey,
        duplicateReason: 'sha256',
      });
      continue;
    }

    const perceptualDuplicate = activeImages
      .map((activeImage) => ({
        distance: hammingDistanceHex(
          activeImage.analysis.perceptualHash,
          image.analysis.perceptualHash,
        ),
        image: activeImage,
      }))
      .filter(
        (candidate) =>
          candidate.distance <= PERCEPTUAL_DUPLICATE_DISTANCE_THRESHOLD,
      )
      .sort((left, right) => left.distance - right.distance)[0];

    if (perceptualDuplicate) {
      duplicateDecisions.set(image.slotKey, {
        duplicateDistance: perceptualDuplicate.distance,
        duplicateOfSlotKey: perceptualDuplicate.image.slotKey,
        duplicateReason: 'perceptual',
      });
      continue;
    }

    activeImages.push(image);
  }

  return duplicateDecisions;
}

function getGalleryCurationDecisions({
  analyzedGalleryImages,
  analyzedHeroImage,
  duplicateDecisions,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  analyzedHeroImage: AnalyzedSetImage;
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
}): Map<string, GalleryCurationDecision> {
  const rankedImages = [...analyzedGalleryImages].sort(
    (left, right) =>
      getGalleryRoleRank(left.roleClassification.role) -
        getGalleryRoleRank(right.roleClassification.role) ||
      left.sortOrder - right.sortOrder,
  );
  const decisions = new Map<string, GalleryCurationDecision>();

  for (const [index, image] of rankedImages.entries()) {
    const heroSimilarityDistance = hammingDistanceHex(
      analyzedHeroImage.analysis.perceptualHash,
      image.analysis.perceptualHash,
    );
    const isEarlyModelImage =
      isModelRole(image.roleClassification.role) &&
      image.sortOrder <= HERO_SIMILARITY_SUPPRESSION_POSITION_LIMIT;
    const shouldSuppress =
      !duplicateDecisions.has(image.slotKey) &&
      isEarlyModelImage &&
      heroSimilarityDistance < HERO_SIMILARITY_SUPPRESSION_DISTANCE_THRESHOLD;

    decisions.set(image.slotKey, {
      galleryRank: index + 1,
      galleryRoleRank: getGalleryRoleRank(image.roleClassification.role),
      heroSimilarityDistance,
      suppressed: shouldSuppress,
      suppressionReason: shouldSuppress
        ? `model image in the first ${HERO_SIMILARITY_SUPPRESSION_POSITION_LIMIT} gallery positions is too similar to hero (dHash distance ${heroSimilarityDistance} < ${HERO_SIMILARITY_SUPPRESSION_DISTANCE_THRESHOLD})`
        : null,
    });
  }

  return decisions;
}

function getSuppressedImages({
  analyzedGalleryImages,
  curationDecisions,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  curationDecisions: ReadonlyMap<string, GalleryCurationDecision>;
}): CatalogSetImageSuppressedImage[] {
  return analyzedGalleryImages
    .map((image): CatalogSetImageSuppressedImage | undefined => {
      const decision = curationDecisions.get(image.slotKey);

      if (!decision?.suppressed || decision.heroSimilarityDistance == null) {
        return undefined;
      }

      return {
        galleryRank: decision.galleryRank,
        heroSimilarityDistance: decision.heroSimilarityDistance,
        reason: decision.suppressionReason ?? 'gallery image suppressed',
        role: image.roleClassification.role,
        slot: image.slotKey,
        sourceUrl: image.candidate.imageUrl,
      };
    })
    .filter((image): image is CatalogSetImageSuppressedImage => image != null);
}

function getVisibleGalleryOrder({
  analyzedGalleryImages,
  curationDecisions,
  duplicateDecisions,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  curationDecisions: ReadonlyMap<string, GalleryCurationDecision>;
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
}): CatalogSetImageVisibleGalleryOrderItem[] {
  return analyzedGalleryImages
    .map((image): CatalogSetImageVisibleGalleryOrderItem | undefined => {
      const curationDecision = curationDecisions.get(image.slotKey);

      if (
        !curationDecision ||
        duplicateDecisions.has(image.slotKey) ||
        curationDecision.suppressed
      ) {
        return undefined;
      }

      return {
        filename: getImageFilename(image.candidate.imageUrl),
        galleryRank: curationDecision.galleryRank,
        heroCandidate: isHeroCandidateRole(image.roleClassification.role),
        heroSimilarityDistance: curationDecision.heroSimilarityDistance,
        role: image.roleClassification.role,
        slot: image.slotKey,
        sortOrder: image.sortOrder,
        sourceUrl: image.candidate.imageUrl,
      };
    })
    .filter(
      (image): image is CatalogSetImageVisibleGalleryOrderItem => image != null,
    )
    .sort((left, right) => left.galleryRank - right.galleryRank);
}

function getImageFilename(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);

    return url.pathname.split('/').filter(Boolean).at(-1) ?? sourceUrl;
  } catch {
    return sourceUrl.split(/[/?#]/).filter(Boolean).at(-1) ?? sourceUrl;
  }
}

function toDedupeAuditCandidate(
  image: AnalyzedSetImage,
  curationDecisions: ReadonlyMap<string, GalleryCurationDecision>,
): CatalogSetImageDedupeAuditCandidate {
  const curationDecision = curationDecisions.get(image.slotKey);

  return {
    filename: getImageFilename(image.candidate.imageUrl),
    galleryRank: curationDecision?.galleryRank ?? null,
    gallerySuppressed: curationDecision?.suppressed ?? false,
    gallerySuppressionReason: curationDecision?.suppressionReason ?? null,
    heroSimilarityDistance: curationDecision?.heroSimilarityDistance ?? null,
    heroCandidate: isHeroCandidateRole(image.roleClassification.role),
    height: image.analysis.height,
    imageRole: image.roleClassification.role,
    imageTypeCandidate: image.imageType,
    perceptualHash: image.analysis.perceptualHash,
    roleReason: image.roleClassification.reason,
    sha256Prefix: image.downloadedImage.sha256.slice(0, 12),
    sortOrder: image.sortOrder,
    source: image.candidate.source,
    sourceUrl: image.candidate.imageUrl,
    slot: image.slotKey,
    width: image.analysis.width,
  };
}

function getCurrentDedupePairDecision({
  duplicateDecisions,
  leftImage,
  rightImage,
}: {
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
  leftImage: AnalyzedSetImage;
  rightImage: AnalyzedSetImage;
}): CatalogSetImageDuplicateReason | 'none' {
  const rightDecision = duplicateDecisions.get(rightImage.slotKey);

  if (rightDecision?.duplicateOfSlotKey === leftImage.slotKey) {
    return rightDecision.duplicateReason;
  }

  const leftDecision = duplicateDecisions.get(leftImage.slotKey);

  if (leftDecision?.duplicateOfSlotKey === rightImage.slotKey) {
    return leftDecision.duplicateReason;
  }

  return 'none';
}

function toDedupeAuditPair({
  duplicateDecisions,
  leftImage,
  pairType,
  rightImage,
}: {
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
  leftImage: AnalyzedSetImage;
  pairType: CatalogSetImageDedupeAuditPair['pairType'];
  rightImage: AnalyzedSetImage;
}): CatalogSetImageDedupeAuditPair {
  const exactDuplicate =
    leftImage.downloadedImage.sha256 === rightImage.downloadedImage.sha256;
  const perceptualDistance = hammingDistanceHex(
    leftImage.analysis.perceptualHash,
    rightImage.analysis.perceptualHash,
  );

  return {
    currentDecision: getCurrentDedupePairDecision({
      duplicateDecisions,
      leftImage,
      rightImage,
    }),
    exactDuplicate,
    leftSlot: leftImage.slotKey,
    pairType,
    perceptualDistance,
    rightSlot: rightImage.slotKey,
    wouldDuplicateAtThresholds: Object.fromEntries(
      DEDUPE_AUDIT_THRESHOLDS.map((threshold) => [
        String(threshold),
        exactDuplicate || perceptualDistance <= threshold,
      ]),
    ),
  };
}

function buildDedupeAuditRecommendation({
  pairs,
}: {
  pairs: readonly CatalogSetImageDedupeAuditPair[];
}): string {
  const heroGalleryPairs = pairs.filter(
    (pair) => pair.pairType === 'hero-gallery',
  );

  if (!heroGalleryPairs.length) {
    return 'No gallery candidates to compare. Keep threshold 5.';
  }

  const closestHeroGalleryPair = [...heroGalleryPairs].sort(
    (left, right) => left.perceptualDistance - right.perceptualDistance,
  )[0];

  if (!closestHeroGalleryPair) {
    return 'No hero/gallery pair was available. Keep threshold 5.';
  }

  if (closestHeroGalleryPair.exactDuplicate) {
    return 'Exact SHA256 duplicate is present. Keep threshold 5; exact dedupe should catch it.';
  }

  if (
    closestHeroGalleryPair.perceptualDistance <=
    PERCEPTUAL_DUPLICATE_DISTANCE_THRESHOLD
  ) {
    return 'Current dHash threshold catches the closest hero/gallery duplicate. Keep threshold 5.';
  }

  if (closestHeroGalleryPair.perceptualDistance <= 12) {
    return `Closest hero/gallery distance is ${closestHeroGalleryPair.perceptualDistance}. Inspect a small batch before raising globally; threshold 12 would catch this pair.`;
  }

  if (closestHeroGalleryPair.perceptualDistance <= 16) {
    return `Closest hero/gallery distance is ${closestHeroGalleryPair.perceptualDistance}. Prefer crop/trim before hashing or a second hash before raising globally to 16.`;
  }

  return `Closest hero/gallery distance is ${closestHeroGalleryPair.perceptualDistance}. Keep threshold 5 and add crop/trim or an additional average/color hash/manual source heuristic; global threshold changes are unlikely to be safe.`;
}

function buildDedupeAudit({
  analyzedGalleryImages,
  analyzedHeroImage,
  curationDecisions,
  duplicateDecisions,
  setId,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  analyzedHeroImage: AnalyzedSetImage;
  curationDecisions: ReadonlyMap<string, GalleryCurationDecision>;
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
  setId: string;
}): CatalogSetImageDedupeAudit {
  const galleryImagesForPairing = analyzedGalleryImages.slice(
    0,
    DEDUPE_AUDIT_GALLERY_PAIR_LIMIT,
  );
  const pairs: CatalogSetImageDedupeAuditPair[] = [
    ...analyzedGalleryImages.map((galleryImage) =>
      toDedupeAuditPair({
        duplicateDecisions,
        leftImage: analyzedHeroImage,
        pairType: 'hero-gallery' as const,
        rightImage: galleryImage,
      }),
    ),
  ];

  for (
    let leftIndex = 0;
    leftIndex < galleryImagesForPairing.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < galleryImagesForPairing.length;
      rightIndex += 1
    ) {
      const leftImage = galleryImagesForPairing[leftIndex];
      const rightImage = galleryImagesForPairing[rightIndex];

      if (!leftImage || !rightImage) {
        continue;
      }

      pairs.push(
        toDedupeAuditPair({
          duplicateDecisions,
          leftImage,
          pairType: 'gallery-gallery',
          rightImage,
        }),
      );
    }
  }

  return {
    candidates: [analyzedHeroImage, ...analyzedGalleryImages].map((image) =>
      toDedupeAuditCandidate(image, curationDecisions),
    ),
    pairs,
    recommendation: buildDedupeAuditRecommendation({
      pairs,
    }),
    setId,
    visibleGalleryOrder: getVisibleGalleryOrder({
      analyzedGalleryImages,
      curationDecisions,
      duplicateDecisions,
    }),
  };
}

async function optimizeSetImageVariant({
  imageType,
  inputBytes,
  storagePath,
}: {
  imageType: CatalogStoredSetImageType;
  inputBytes: Uint8Array;
  storagePath: string;
}): Promise<OptimizedSetImageVariant> {
  const image = sharp(inputBytes).rotate();
  const transformed =
    imageType === 'social'
      ? image
          .flatten({
            background: SOCIAL_IMAGE_BACKGROUND,
          })
          .resize({
            background: SOCIAL_IMAGE_BACKGROUND,
            fit: 'contain',
            height: SOCIAL_IMAGE_HEIGHT,
            position: 'centre',
            width: SOCIAL_IMAGE_WIDTH,
          })
          .flatten({
            background: SOCIAL_IMAGE_BACKGROUND,
          })
          .jpeg({
            mozjpeg: true,
            quality: 88,
          })
      : imageType === 'card'
        ? image
            .resize({
              fit: 'inside',
              width: 640,
              withoutEnlargement: true,
            })
            .webp({
              quality: 82,
            })
        : imageType === 'thumbnail'
          ? image
              .resize({
                fit: 'inside',
                width: 320,
                withoutEnlargement: true,
              })
              .webp({
                quality: 78,
              })
          : image
              .resize({
                fit: 'inside',
                height: 1280,
                width: 1280,
                withoutEnlargement: true,
              })
              .webp({
                quality: 84,
              });
  const output = await transformed.toBuffer({ resolveWithObject: true });

  return {
    bytes: output.data,
    byteSize: output.data.byteLength,
    contentType: imageType === 'social' ? 'image/jpeg' : 'image/webp',
    height: output.info.height,
    imageType,
    sha256: sha256Hex(output.data),
    storagePath,
    width: output.info.width,
  };
}

async function uploadCatalogSetImageVariant({
  bucketName,
  setId,
  storageSupabaseClient,
  sortOrder,
  uploadRetryCount,
  variant,
}: {
  bucketName: string;
  setId: string;
  storageSupabaseClient: CatalogSetImageStorageClient;
  sortOrder: number;
  uploadRetryCount: number;
  variant: OptimizedSetImageVariant;
}): Promise<string> {
  const bucket = storageSupabaseClient.storage.from(bucketName);
  let retryCount = 0;

  for (;;) {
    const { error } = await bucket.upload(variant.storagePath, variant.bytes, {
      contentType: variant.contentType,
      upsert: true,
    });

    if (!error) {
      break;
    }

    if (retryCount < uploadRetryCount && isTransientStorageUploadError(error)) {
      retryCount += 1;
      continue;
    }

    throw new CatalogSetImageUploadError({
      bucket: bucketName,
      byteSize: variant.byteSize,
      imageType: variant.imageType,
      rawError: error,
      retryCount,
      setId,
      sortOrder,
      storagePath: variant.storagePath,
      ...readSupabaseStorageErrorDetails(error),
    });
  }

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(variant.storagePath);

  return publicUrl;
}

function readRecordStringValue(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const property = (value as Record<string, unknown>)[key];

  if (typeof property === 'string' && property.length > 0) {
    return property;
  }

  if (typeof property === 'number') {
    return String(property);
  }

  return null;
}

function readSupabaseStorageErrorDetails(error: unknown): {
  details: string | null;
  message: string;
  status: string | null;
} {
  const message =
    error instanceof Error
      ? error.message
      : (readRecordStringValue(error, 'message') ?? 'Unknown storage error.');
  const status =
    readRecordStringValue(error, 'status') ??
    readRecordStringValue(error, 'statusCode') ??
    readRecordStringValue(error, 'code');
  const details =
    readRecordStringValue(error, 'details') ??
    readRecordStringValue(error, 'hint') ??
    readRecordStringValue(error, 'name');

  return {
    details,
    message,
    status,
  };
}

function isTransientStorageUploadError(error: unknown): boolean {
  const { message, status } = readSupabaseStorageErrorDetails(error);
  const numericStatus = status ? Number(status) : Number.NaN;

  return (
    numericStatus === 408 ||
    numericStatus === 429 ||
    (numericStatus >= 500 && numericStatus <= 599) ||
    /timeout|temporar|network|fetch failed|econnreset|etimedout/i.test(message)
  );
}

async function upsertCatalogSetImageRows({
  metadataSupabaseClient,
  rows,
}: {
  metadataSupabaseClient: CatalogSetImageMetadataClient;
  rows: readonly CatalogSetImageUpsertRow[];
}): Promise<void> {
  if (!rows.length) {
    return;
  }

  const { error } = await metadataSupabaseClient
    .from(CATALOG_SET_IMAGES_TABLE)
    .upsert(rows, {
      onConflict: 'set_id,image_type,sort_order',
    });

  if (error) {
    throw new Error('Unable to upsert catalog set image rows.');
  }
}

async function readExistingCatalogSetImageRowsForSet({
  metadataSupabaseClient,
  setId,
}: {
  metadataSupabaseClient: CatalogSetImageMetadataClient;
  setId: string;
}): Promise<Map<string, CatalogSetImageUpsertRow>> {
  const { data, error } = await metadataSupabaseClient
    .from(CATALOG_SET_IMAGES_TABLE)
    .select(
      'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, status, metadata_json',
    )
    .eq('set_id', setId);

  if (error) {
    throw new Error('Unable to read existing catalog set image rows.');
  }

  return new Map(
    ((data as Array<Partial<CatalogSetImageUpsertRow>> | null) ?? []).map(
      (row) => {
        const normalizedRow = {
          duplicate_distance: null,
          duplicate_of_id: null,
          duplicate_reason: null,
          image_role: 'unknown',
          ...row,
        } as CatalogSetImageUpsertRow;

        return [
          slotKey({
            imageType: normalizedRow.image_type,
            sortOrder: normalizedRow.sort_order,
          }),
          normalizedRow,
        ];
      },
    ),
  );
}

function getImageForStoredSlot({
  analyzedGalleryImages,
  analyzedHeroImage,
  imageType,
  sortOrder,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  analyzedHeroImage: AnalyzedSetImage;
  imageType: CatalogStoredSetImageType;
  sortOrder: number;
}): AnalyzedSetImage | undefined {
  if (imageType === 'card' || imageType === 'hero' || imageType === 'social') {
    return sortOrder === 0 ? analyzedHeroImage : undefined;
  }

  if (imageType === 'thumbnail') {
    return sortOrder === 0
      ? analyzedHeroImage
      : analyzedGalleryImages.find((image) => image.sortOrder === sortOrder);
  }

  return analyzedGalleryImages.find((image) => image.sortOrder === sortOrder);
}

function getDuplicateDecisionForStoredSlot({
  duplicateDecisions,
  image,
  imageType,
}: {
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
  image: AnalyzedSetImage;
  imageType: CatalogStoredSetImageType;
}): DuplicateDecision | undefined {
  if (imageType === 'card' || imageType === 'hero' || imageType === 'social') {
    return undefined;
  }

  return duplicateDecisions.get(image.slotKey);
}

function buildMetadataRefreshRows({
  analyzedGalleryImages,
  analyzedHeroImage,
  curationDecisions,
  duplicateDecisions,
  existingRowsBySlot,
}: {
  analyzedGalleryImages: readonly AnalyzedSetImage[];
  analyzedHeroImage: AnalyzedSetImage;
  curationDecisions: ReadonlyMap<string, GalleryCurationDecision>;
  duplicateDecisions: ReadonlyMap<string, DuplicateDecision>;
  existingRowsBySlot: ReadonlyMap<string, CatalogSetImageUpsertRow>;
}): CatalogSetImageUpsertRow[] {
  return [...existingRowsBySlot.values()]
    .map((existingRow): CatalogSetImageUpsertRow | undefined => {
      const image = getImageForStoredSlot({
        analyzedGalleryImages,
        analyzedHeroImage,
        imageType: existingRow.image_type,
        sortOrder: existingRow.sort_order,
      });

      if (!image) {
        return undefined;
      }

      const duplicateDecision = getDuplicateDecisionForStoredSlot({
        duplicateDecisions,
        image,
        imageType: existingRow.image_type,
      });
      const curationDecision =
        existingRow.image_type === 'gallery' ||
        (existingRow.image_type === 'thumbnail' && existingRow.sort_order > 0)
          ? curationDecisions.get(image.slotKey)
          : undefined;

      return toMetadataRefreshImageRow({
        ...(curationDecision ? { curationDecision } : {}),
        ...(duplicateDecision ? { duplicateDecision } : {}),
        existingRow,
        image,
      });
    })
    .filter((row): row is CatalogSetImageUpsertRow => row != null);
}

function isStoredGalleryRowSuppressed(row: CatalogSetImageUpsertRow): boolean {
  return row.metadata_json['gallerySuppressed'] === true;
}

function getOrphanThumbnailRows(
  rows: readonly CatalogSetImageUpsertRow[],
): CatalogSetImageOrphanThumbnailRow[] {
  const visibleImageSortOrders = new Set<number>();

  for (const row of rows) {
    if (row.status !== 'active') {
      continue;
    }

    if (row.image_type === 'hero' && row.sort_order === 0) {
      visibleImageSortOrders.add(0);
    }

    if (row.image_type === 'gallery' && !isStoredGalleryRowSuppressed(row)) {
      visibleImageSortOrders.add(row.sort_order);
    }
  }

  return rows
    .filter(
      (row) =>
        row.status === 'active' &&
        row.image_type === 'thumbnail' &&
        !visibleImageSortOrders.has(row.sort_order) &&
        (row.storage_path || row.public_url),
    )
    .map((row) => ({
      publicUrl: row.public_url,
      reason: 'no matching active visible hero/gallery image',
      setId: row.set_id,
      sortOrder: row.sort_order,
      storagePath: row.storage_path,
    }));
}

function toActiveImageRow({
  curationDecision,
  duplicateDecision,
  image,
  originalSha256,
  publicUrl,
  setId,
  sortOrder,
  source,
  sourceUrl,
  storagePublicUrl,
  variant,
}: {
  curationDecision?: GalleryCurationDecision;
  duplicateDecision?: DuplicateDecision;
  image: AnalyzedSetImage;
  originalSha256: string;
  publicUrl: string | null;
  setId: string;
  sortOrder: number;
  source: CatalogSetImageSource;
  sourceUrl: string;
  storagePublicUrl: string | null;
  variant: OptimizedSetImageVariant;
}): CatalogSetImageUpsertRow {
  const isDuplicate = duplicateDecision != null;

  return {
    byte_size: variant.byteSize,
    content_type: variant.contentType,
    duplicate_distance: duplicateDecision?.duplicateDistance ?? null,
    duplicate_of_id: null,
    duplicate_reason: duplicateDecision?.duplicateReason ?? null,
    height: variant.height,
    image_role: image.roleClassification.role,
    image_type: variant.imageType,
    metadata_json: {
      duplicateOfSlot: duplicateDecision?.duplicateOfSlotKey ?? null,
      galleryRank: curationDecision?.galleryRank ?? null,
      galleryRoleRank: curationDecision?.galleryRoleRank ?? null,
      gallerySuppressed: curationDecision?.suppressed ?? false,
      gallerySuppressionReason: curationDecision?.suppressionReason ?? null,
      heroSimilarityDistance: curationDecision?.heroSimilarityDistance ?? null,
      heroCandidate: isHeroCandidateRole(image.roleClassification.role),
      imageUsePreferences: getImageUsePreferenceRanks(
        image.roleClassification.role,
      ),
      originalSha256,
      optimizedAt: new Date().toISOString(),
      perceptualHashAlgorithm: 'dhash-64',
      roleClassification: image.roleClassification,
      ...(storagePublicUrl ? { storagePublicUrl } : {}),
    },
    perceptual_hash: image.analysis.perceptualHash,
    public_url: publicUrl,
    set_id: setId,
    sha256: variant.sha256,
    sort_order: sortOrder,
    source,
    source_url: sourceUrl,
    status: isDuplicate ? 'duplicate' : 'active',
    storage_bucket: CATALOG_SET_IMAGES_BUCKET,
    storage_path: variant.storagePath,
    width: variant.width,
  };
}

function toMetadataRefreshImageRow({
  curationDecision,
  duplicateDecision,
  existingRow,
  image,
}: {
  curationDecision?: GalleryCurationDecision;
  duplicateDecision?: DuplicateDecision;
  existingRow: CatalogSetImageUpsertRow;
  image: AnalyzedSetImage;
}): CatalogSetImageUpsertRow {
  const metadataJson =
    existingRow.metadata_json && typeof existingRow.metadata_json === 'object'
      ? existingRow.metadata_json
      : {};

  return normalizeCatalogSetImagePublicUrlRow({
    ...existingRow,
    duplicate_distance: duplicateDecision?.duplicateDistance ?? null,
    duplicate_of_id: null,
    duplicate_reason: duplicateDecision?.duplicateReason ?? null,
    image_role: image.roleClassification.role,
    metadata_json: {
      ...metadataJson,
      duplicateOfSlot: duplicateDecision?.duplicateOfSlotKey ?? null,
      galleryRank: curationDecision?.galleryRank ?? null,
      galleryRoleRank: curationDecision?.galleryRoleRank ?? null,
      gallerySuppressed: curationDecision?.suppressed ?? false,
      gallerySuppressionReason: curationDecision?.suppressionReason ?? null,
      heroSimilarityDistance: curationDecision?.heroSimilarityDistance ?? null,
      heroCandidate: isHeroCandidateRole(image.roleClassification.role),
      imageUsePreferences: getImageUsePreferenceRanks(
        image.roleClassification.role,
      ),
      metadataRefreshedAt: new Date().toISOString(),
      perceptualHashAlgorithm: 'dhash-64',
      roleClassification: image.roleClassification,
    },
    perceptual_hash: image.analysis.perceptualHash,
    status: duplicateDecision ? 'duplicate' : 'active',
  });
}

function toDuplicateImageRow({
  curationDecision,
  duplicateDecision,
  image,
  setId,
}: {
  curationDecision?: GalleryCurationDecision;
  duplicateDecision: DuplicateDecision;
  image: AnalyzedSetImage;
  setId: string;
}): CatalogSetImageUpsertRow {
  return {
    byte_size: null,
    content_type: image.downloadedImage.contentType,
    duplicate_distance: duplicateDecision.duplicateDistance,
    duplicate_of_id: null,
    duplicate_reason: duplicateDecision.duplicateReason,
    height: image.analysis.height,
    image_role: image.roleClassification.role,
    image_type: image.imageType,
    metadata_json: {
      duplicateOfSlot: duplicateDecision.duplicateOfSlotKey,
      galleryRank: curationDecision?.galleryRank ?? null,
      galleryRoleRank: curationDecision?.galleryRoleRank ?? null,
      gallerySuppressed: false,
      gallerySuppressionReason: null,
      heroSimilarityDistance: curationDecision?.heroSimilarityDistance ?? null,
      heroCandidate: isHeroCandidateRole(image.roleClassification.role),
      imageUsePreferences: getImageUsePreferenceRanks(
        image.roleClassification.role,
      ),
      originalSha256: image.downloadedImage.sha256,
      perceptualHashAlgorithm: 'dhash-64',
      roleClassification: image.roleClassification,
    },
    perceptual_hash: image.analysis.perceptualHash,
    public_url: null,
    set_id: setId,
    sha256: image.downloadedImage.sha256,
    sort_order: image.sortOrder,
    source: image.candidate.source,
    source_url: image.candidate.imageUrl,
    status: 'duplicate',
    storage_bucket: CATALOG_SET_IMAGES_BUCKET,
    storage_path: null,
    width: image.analysis.width,
  };
}

function toFailedImageRow({
  byteSize,
  contentType,
  error,
  height,
  imageRole,
  imageType,
  perceptualHash,
  setId,
  sha256,
  sortOrder,
  source,
  sourceUrl,
  storagePath,
  width,
}: {
  byteSize?: number | null;
  contentType?: string | null;
  error: unknown;
  height?: number | null;
  imageRole?: CatalogSetImageRole;
  imageType: CatalogStoredSetImageType;
  perceptualHash?: string | null;
  setId: string;
  sha256?: string | null;
  sortOrder: number;
  source: CatalogSetImageSource;
  sourceUrl: string;
  storagePath?: string | null;
  width?: number | null;
}): CatalogSetImageUpsertRow {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown image sync failure.';
  const uploadDetails =
    error instanceof CatalogSetImageUploadError
      ? error.uploadDetails
      : undefined;

  return {
    byte_size: byteSize ?? uploadDetails?.byteSize ?? null,
    content_type: contentType ?? null,
    duplicate_distance: null,
    duplicate_of_id: null,
    duplicate_reason: null,
    height: height ?? null,
    image_role: imageRole ?? 'unknown',
    image_type: imageType,
    metadata_json: {
      errorMessage,
      failedAt: new Date().toISOString(),
      ...(uploadDetails
        ? {
            uploadError: {
              bucket: uploadDetails.bucket,
              byteSize: uploadDetails.byteSize,
              details: uploadDetails.details,
              message: uploadDetails.message,
              retryCount: uploadDetails.retryCount,
              status: uploadDetails.status,
              storagePath: uploadDetails.storagePath,
            },
          }
        : {}),
    },
    perceptual_hash: perceptualHash ?? null,
    public_url: null,
    set_id: setId,
    sha256: sha256 ?? null,
    sort_order: sortOrder,
    source,
    source_url: sourceUrl,
    status: 'failed',
    storage_bucket: CATALOG_SET_IMAGES_BUCKET,
    storage_path: storagePath ?? uploadDetails?.storagePath ?? null,
    width: width ?? null,
  };
}

function toFailureSample({
  byteSize,
  error,
  imageType,
  setId,
  sortOrder,
  sourceUrl,
  storagePath,
}: {
  byteSize?: number | null;
  error: unknown;
  imageType: CatalogStoredSetImageType;
  setId: string;
  sortOrder: number;
  sourceUrl: string;
  storagePath?: string | null;
}): CatalogSetImageFailureSample {
  const uploadDetails =
    error instanceof CatalogSetImageUploadError
      ? error.uploadDetails
      : undefined;
  const storageErrorDetails = readSupabaseStorageErrorDetails(
    uploadDetails?.rawError ?? error,
  );

  return {
    bucket: uploadDetails?.bucket ?? CATALOG_SET_IMAGES_BUCKET,
    byteSize: byteSize ?? uploadDetails?.byteSize ?? null,
    details: uploadDetails?.details ?? storageErrorDetails.details,
    imageType,
    message:
      uploadDetails?.message ??
      (error instanceof Error ? error.message : storageErrorDetails.message),
    setId,
    sortOrder,
    sourceUrl,
    status: uploadDetails?.status ?? storageErrorDetails.status,
    storagePath: storagePath ?? uploadDetails?.storagePath ?? null,
  };
}

function sampleFailures(
  samples: readonly CatalogSetImageFailureSample[],
): readonly CatalogSetImageFailureSample[] {
  return samples.slice(0, 5);
}

async function processCatalogSetImageSyncCandidate({
  bricksetImageCandidatesBySetId,
  candidate,
  debugDedupe,
  dryRun,
  fetchFn,
  metadataSupabaseClient,
  refreshImageMetadata,
  refreshCard,
  refreshSocial,
  refreshThumbnails,
  storageSupabaseClient,
  uploadRetryCount,
}: CatalogSetImageProcessContext & {
  candidate: CatalogSetImageSyncCandidate;
}): Promise<CatalogSetImageSyncItemResult> {
  const warnings: string[] = [];
  const failedSourceSamples: CatalogSetImageFailureSample[] = [];
  const failedVariantSamples: CatalogSetImageFailureSample[] = [];
  const sourceCandidates = buildSourceCandidatesForSet({
    bricksetCandidates:
      bricksetImageCandidatesBySetId.get(candidate.setId) ?? [],
    candidate,
  });

  if (!sourceCandidates.length) {
    return {
      duplicateGroups: [],
      cardImageStored: false,
      duplicateSourceCount: 0,
      estimatedUploadBytes: 0,
      exactDuplicateCount: 0,
      failedSourceCount: 0,
      failedSourceSamples,
      failedVariantCount: 0,
      failedVariantSamples,
      galleryImageCount: 0,
      heroImageStored: false,
      heroSimilaritySuppressedCount: 0,
      imageBytesByType: createEmptyImageTypeNumberRecord(),
      imageCountByType: createEmptyImageTypeNumberRecord(),
      perceptualDuplicateCount: 0,
      roleCounts: createEmptyRoleCountRecord(),
      setId: candidate.setId,
      socialImageStored: false,
      suppressedImages: [],
      thumbnailImageStored: false,
      uploadedBytes: 0,
      visibleGalleryOrder: [],
      orphanThumbnailRows: [],
      warnings: ['No source images found.'],
    };
  }

  const downloadedImages: Array<{
    candidate: CatalogSetImageSourceCandidate;
    downloadedImage: DownloadedSetImage;
  }> = [];
  const failedRows: CatalogSetImageUpsertRow[] = [];
  let failedSourceCount = 0;
  let duplicateSourceCount = 0;
  const seenSourceHashes = new Set<string>();

  for (const [index, sourceCandidate] of sourceCandidates.entries()) {
    try {
      const downloadedImage = await downloadSetImage({
        fetchFn,
        imageUrl: sourceCandidate.imageUrl,
      });

      if (seenSourceHashes.has(downloadedImage.sha256)) {
        duplicateSourceCount += 1;
      }

      seenSourceHashes.add(downloadedImage.sha256);
      downloadedImages.push({
        candidate: sourceCandidate,
        downloadedImage,
      });
    } catch (error) {
      failedSourceCount += 1;
      failedSourceSamples.push(
        toFailureSample({
          error,
          imageType:
            sourceCandidate.preferredType === 'hero' ? 'hero' : 'gallery',
          setId: candidate.setId,
          sortOrder: 9000 + index,
          sourceUrl: sourceCandidate.imageUrl,
        }),
      );
      warnings.push(
        `${sourceCandidate.imageUrl}: ${
          error instanceof Error ? error.message : 'download failed'
        }`,
      );
      failedRows.push(
        toFailedImageRow({
          error,
          imageType:
            sourceCandidate.preferredType === 'hero' ? 'hero' : 'gallery',
          setId: candidate.setId,
          sortOrder: 9000 + index,
          source: sourceCandidate.source,
          sourceUrl: sourceCandidate.imageUrl,
        }),
      );
    }
  }

  const heroImage =
    downloadedImages.find(
      (image) => image.candidate.preferredType === 'hero',
    ) ?? downloadedImages[0];

  if (!heroImage) {
    if (!dryRun) {
      await upsertCatalogSetImageRows({
        metadataSupabaseClient,
        rows: failedRows,
      });
    }

    return {
      duplicateGroups: [],
      cardImageStored: false,
      duplicateSourceCount,
      estimatedUploadBytes: 0,
      exactDuplicateCount: 0,
      failedSourceCount,
      failedSourceSamples: sampleFailures(failedSourceSamples),
      failedVariantCount: 0,
      failedVariantSamples,
      galleryImageCount: 0,
      heroImageStored: false,
      heroSimilaritySuppressedCount: 0,
      imageBytesByType: createEmptyImageTypeNumberRecord(),
      imageCountByType: createEmptyImageTypeNumberRecord(),
      perceptualDuplicateCount: 0,
      roleCounts: createEmptyRoleCountRecord(),
      setId: candidate.setId,
      socialImageStored: false,
      suppressedImages: [],
      thumbnailImageStored: false,
      uploadedBytes: 0,
      visibleGalleryOrder: [],
      orphanThumbnailRows: [],
      warnings,
    };
  }

  const galleryImages = downloadedImages.filter((image) => image !== heroImage);
  const analyzedHeroImage = await analyzeDownloadedSetImage({
    downloadedImage: heroImage.downloadedImage,
    imageType: 'hero',
    sortOrder: 0,
    sourceCandidate: heroImage.candidate,
  });
  const analyzedGalleryImages = await Promise.all(
    galleryImages.map((galleryImage, index) =>
      analyzeDownloadedSetImage({
        downloadedImage: galleryImage.downloadedImage,
        imageType: 'gallery',
        sortOrder: index + 1,
        sourceCandidate: galleryImage.candidate,
      }),
    ),
  );
  const analyzedVisibleImages = [analyzedHeroImage, ...analyzedGalleryImages];
  const duplicateDecisions = getDuplicateDecisions(analyzedVisibleImages);
  const curationDecisions = getGalleryCurationDecisions({
    analyzedGalleryImages,
    analyzedHeroImage,
    duplicateDecisions,
  });
  const suppressedImages = getSuppressedImages({
    analyzedGalleryImages,
    curationDecisions,
  });
  const visibleGalleryOrder = getVisibleGalleryOrder({
    analyzedGalleryImages,
    curationDecisions,
    duplicateDecisions,
  });
  const visibleGallerySlotKeys = new Set(
    visibleGalleryOrder.map((image) => image.slot),
  );
  const orphanThumbnailRows = dryRun
    ? getOrphanThumbnailRows([
        ...(
          await readExistingCatalogSetImageRowsForSet({
            metadataSupabaseClient,
            setId: candidate.setId,
          })
        ).values(),
      ])
    : [];
  const dedupeAudit = debugDedupe
    ? buildDedupeAudit({
        analyzedGalleryImages,
        analyzedHeroImage,
        curationDecisions,
        duplicateDecisions,
        setId: candidate.setId,
      })
    : undefined;
  const duplicateGroups = [...duplicateDecisions.entries()].map(
    ([duplicateSlot, duplicateDecision]) => ({
      duplicateDistance: duplicateDecision.duplicateDistance,
      duplicateReason: duplicateDecision.duplicateReason,
      duplicateSlot,
      keptSlot: duplicateDecision.duplicateOfSlotKey,
    }),
  );
  const exactDuplicateCount = duplicateGroups.filter(
    (duplicateGroup) => duplicateGroup.duplicateReason === 'sha256',
  ).length;
  const perceptualDuplicateCount = duplicateGroups.filter(
    (duplicateGroup) => duplicateGroup.duplicateReason === 'perceptual',
  ).length;
  duplicateSourceCount = exactDuplicateCount + perceptualDuplicateCount;
  const roleCounts = createEmptyRoleCountRecord();

  for (const image of analyzedVisibleImages) {
    roleCounts[image.roleClassification.role] += 1;
  }

  if (refreshImageMetadata) {
    const existingRowsBySlot = await readExistingCatalogSetImageRowsForSet({
      metadataSupabaseClient,
      setId: candidate.setId,
    });
    const refreshRows = buildMetadataRefreshRows({
      analyzedGalleryImages,
      analyzedHeroImage,
      curationDecisions,
      duplicateDecisions,
      existingRowsBySlot,
    });
    const imageCountByType = createEmptyImageTypeNumberRecord();

    for (const row of refreshRows) {
      imageCountByType[row.image_type] += 1;
    }

    if (!dryRun) {
      await upsertCatalogSetImageRows({
        metadataSupabaseClient,
        rows: [...refreshRows, ...failedRows],
      });
    }

    return {
      ...(dedupeAudit ? { dedupeAudit } : {}),
      duplicateGroups,
      duplicateSourceCount,
      estimatedUploadBytes: 0,
      exactDuplicateCount,
      failedSourceCount,
      failedSourceSamples: sampleFailures(failedSourceSamples),
      failedVariantCount: 0,
      failedVariantSamples,
      galleryImageCount: analyzedGalleryImages.filter((image) => {
        const curationDecision = curationDecisions.get(image.slotKey);

        return (
          !duplicateDecisions.has(image.slotKey) &&
          curationDecision?.suppressed !== true
        );
      }).length,
      heroImageStored: refreshRows.some((row) => row.image_type === 'hero'),
      heroSimilaritySuppressedCount: suppressedImages.length,
      imageBytesByType: createEmptyImageTypeNumberRecord(),
      imageCountByType,
      perceptualDuplicateCount,
      roleCounts,
      setId: candidate.setId,
      cardImageStored: refreshRows.some((row) => row.image_type === 'card'),
      socialImageStored: refreshRows.some((row) => row.image_type === 'social'),
      suppressedImages,
      thumbnailImageStored: refreshRows.some(
        (row) => row.image_type === 'thumbnail',
      ),
      uploadedBytes: 0,
      visibleGalleryOrder,
      orphanThumbnailRows,
      warnings,
    };
  }

  const variants: Array<{
    image: AnalyzedSetImage;
    originalSha256: string;
    sortOrder: number;
    source: CatalogSetImageSource;
    sourceUrl: string;
    variant: OptimizedSetImageVariant;
  }> = [];
  const duplicateRows = analyzedGalleryImages
    .map((galleryImage): CatalogSetImageUpsertRow | undefined => {
      const duplicateDecision = duplicateDecisions.get(galleryImage.slotKey);
      const curationDecision = curationDecisions.get(galleryImage.slotKey);

      return duplicateDecision
        ? toDuplicateImageRow({
            ...(curationDecision ? { curationDecision } : {}),
            duplicateDecision,
            image: galleryImage,
            setId: candidate.setId,
          })
        : undefined;
    })
    .filter((row): row is CatalogSetImageUpsertRow => row != null);
  const shouldGenerateFullImages =
    !refreshCard && !refreshSocial && !refreshThumbnails;
  const shouldGenerateCardImage = shouldGenerateFullImages || refreshCard;
  const shouldGenerateSocialImage = shouldGenerateFullImages || refreshSocial;
  const shouldGenerateThumbnailImages =
    shouldGenerateFullImages || refreshThumbnails;

  if (shouldGenerateFullImages) {
    variants.push({
      image: analyzedHeroImage,
      originalSha256: analyzedHeroImage.downloadedImage.sha256,
      sortOrder: 0,
      source: analyzedHeroImage.candidate.source,
      sourceUrl: analyzedHeroImage.candidate.imageUrl,
      variant: await optimizeSetImageVariant({
        imageType: 'hero',
        inputBytes: analyzedHeroImage.downloadedImage.bytes,
        storagePath: `sets/${candidate.setId}/hero.webp`,
      }),
    });
  }

  if (shouldGenerateCardImage) {
    variants.push({
      image: analyzedHeroImage,
      originalSha256: analyzedHeroImage.downloadedImage.sha256,
      sortOrder: 0,
      source: analyzedHeroImage.candidate.source,
      sourceUrl: analyzedHeroImage.candidate.imageUrl,
      variant: await optimizeSetImageVariant({
        imageType: 'card',
        inputBytes: analyzedHeroImage.downloadedImage.bytes,
        storagePath: `sets/${candidate.setId}/card.webp`,
      }),
    });
  }

  if (shouldGenerateSocialImage) {
    variants.push({
      image: analyzedHeroImage,
      originalSha256: analyzedHeroImage.downloadedImage.sha256,
      sortOrder: 0,
      source: analyzedHeroImage.candidate.source,
      sourceUrl: analyzedHeroImage.candidate.imageUrl,
      variant: await optimizeSetImageVariant({
        imageType: 'social',
        inputBytes: analyzedHeroImage.downloadedImage.bytes,
        storagePath: `sets/${candidate.setId}/social.jpg`,
      }),
    });
  }

  if (shouldGenerateThumbnailImages) {
    variants.push({
      image: analyzedHeroImage,
      originalSha256: analyzedHeroImage.downloadedImage.sha256,
      sortOrder: 0,
      source: analyzedHeroImage.candidate.source,
      sourceUrl: analyzedHeroImage.candidate.imageUrl,
      variant: await optimizeSetImageVariant({
        imageType: 'thumbnail',
        inputBytes: analyzedHeroImage.downloadedImage.bytes,
        storagePath: `sets/${candidate.setId}/thumbs/0.webp`,
      }),
    });
  }

  for (const galleryImage of analyzedGalleryImages) {
    const duplicateDecision = duplicateDecisions.get(galleryImage.slotKey);
    const sortOrder = galleryImage.sortOrder;

    if (duplicateDecision) {
      continue;
    }

    if (shouldGenerateFullImages) {
      variants.push({
        image: galleryImage,
        originalSha256: galleryImage.downloadedImage.sha256,
        sortOrder,
        source: galleryImage.candidate.source,
        sourceUrl: galleryImage.candidate.imageUrl,
        variant: await optimizeSetImageVariant({
          imageType: 'gallery',
          inputBytes: galleryImage.downloadedImage.bytes,
          storagePath: `sets/${candidate.setId}/gallery/${sortOrder}.webp`,
        }),
      });
    }

    if (
      shouldGenerateThumbnailImages &&
      visibleGallerySlotKeys.has(galleryImage.slotKey)
    ) {
      variants.push({
        image: galleryImage,
        originalSha256: galleryImage.downloadedImage.sha256,
        sortOrder,
        source: galleryImage.candidate.source,
        sourceUrl: galleryImage.candidate.imageUrl,
        variant: await optimizeSetImageVariant({
          imageType: 'thumbnail',
          inputBytes: galleryImage.downloadedImage.bytes,
          storagePath: `sets/${candidate.setId}/thumbs/${sortOrder}.webp`,
        }),
      });
    }
  }

  const estimatedUploadBytes = variants.reduce(
    (totalBytes, variant) => totalBytes + variant.variant.byteSize,
    0,
  );
  const imageBytesByType = createEmptyImageTypeNumberRecord();
  const imageCountByType = createEmptyImageTypeNumberRecord();

  for (const { variant } of variants) {
    imageBytesByType[variant.imageType] += variant.byteSize;
    imageCountByType[variant.imageType] += 1;
  }
  let uploadedBytes = 0;
  const activeRows: CatalogSetImageUpsertRow[] = [];
  const failedVariantRows: CatalogSetImageUpsertRow[] = [];

  if (!dryRun) {
    for (const variant of variants) {
      let storagePublicUrl: string;

      try {
        storagePublicUrl = await uploadCatalogSetImageVariant({
          bucketName: CATALOG_SET_IMAGES_BUCKET,
          setId: candidate.setId,
          sortOrder: variant.sortOrder,
          storageSupabaseClient,
          uploadRetryCount,
          variant: variant.variant,
        });
      } catch (error) {
        failedVariantSamples.push(
          toFailureSample({
            byteSize: variant.variant.byteSize,
            error,
            imageType: variant.variant.imageType,
            setId: candidate.setId,
            sortOrder: variant.sortOrder,
            sourceUrl: variant.sourceUrl,
            storagePath: variant.variant.storagePath,
          }),
        );
        warnings.push(
          `${variant.variant.storagePath}: ${
            error instanceof Error ? error.message : 'upload failed'
          }`,
        );
        failedVariantRows.push(
          toFailedImageRow({
            byteSize: variant.variant.byteSize,
            contentType: variant.variant.contentType,
            error,
            height: variant.variant.height,
            imageRole: variant.image.roleClassification.role,
            imageType: variant.variant.imageType,
            perceptualHash: variant.image.analysis.perceptualHash,
            setId: candidate.setId,
            sha256: variant.variant.sha256,
            sortOrder: variant.sortOrder,
            source: variant.source,
            sourceUrl: variant.sourceUrl,
            storagePath: variant.variant.storagePath,
            width: variant.variant.width,
          }),
        );
        continue;
      }

      const publicUrl = toBrickhuntCatalogSetImagePublicUrl(
        variant.variant.storagePath,
      );
      const curationDecision =
        variant.variant.imageType === 'gallery' ||
        (variant.variant.imageType === 'thumbnail' && variant.sortOrder > 0)
          ? curationDecisions.get(variant.image.slotKey)
          : undefined;
      uploadedBytes += variant.variant.byteSize;
      activeRows.push(
        toActiveImageRow({
          ...(curationDecision ? { curationDecision } : {}),
          image: variant.image,
          originalSha256: variant.originalSha256,
          publicUrl,
          setId: candidate.setId,
          sortOrder: variant.sortOrder,
          source: variant.source,
          sourceUrl: variant.sourceUrl,
          storagePublicUrl,
          variant: variant.variant,
        }),
      );
    }

    await upsertCatalogSetImageRows({
      metadataSupabaseClient,
      rows: [
        ...activeRows,
        ...duplicateRows,
        ...failedRows,
        ...failedVariantRows,
      ],
    });
  }

  const isImageTypeStored = (imageType: CatalogStoredSetImageType) =>
    dryRun
      ? variants.some((variant) => variant.variant.imageType === imageType)
      : activeRows.some((row) => row.image_type === imageType);

  return {
    ...(dedupeAudit ? { dedupeAudit } : {}),
    duplicateGroups,
    duplicateSourceCount,
    estimatedUploadBytes,
    exactDuplicateCount,
    failedSourceCount,
    failedSourceSamples: sampleFailures(failedSourceSamples),
    failedVariantCount: failedVariantRows.length,
    failedVariantSamples: sampleFailures(failedVariantSamples),
    galleryImageCount: analyzedGalleryImages.filter((image) => {
      const curationDecision = curationDecisions.get(image.slotKey);

      return (
        !duplicateDecisions.has(image.slotKey) &&
        curationDecision?.suppressed !== true
      );
    }).length,
    heroImageStored: isImageTypeStored('hero'),
    heroSimilaritySuppressedCount: suppressedImages.length,
    imageBytesByType,
    imageCountByType,
    perceptualDuplicateCount,
    roleCounts,
    setId: candidate.setId,
    cardImageStored: isImageTypeStored('card'),
    socialImageStored: isImageTypeStored('social'),
    suppressedImages,
    thumbnailImageStored: isImageTypeStored('thumbnail'),
    uploadedBytes,
    visibleGalleryOrder,
    orphanThumbnailRows,
    warnings,
  };
}

async function listCatalogSetImageSyncCandidates({
  limit,
  missingOnly,
  refreshImageMetadata,
  refreshFailed,
  refreshCard,
  refreshSocial,
  refreshThumbnails,
  setIds,
  supabaseClient,
}: {
  limit?: number;
  missingOnly: boolean;
  refreshImageMetadata: boolean;
  refreshFailed: boolean;
  refreshCard: boolean;
  refreshSocial: boolean;
  refreshThumbnails: boolean;
  setIds?: readonly string[];
  supabaseClient: CatalogSetImageMetadataClient;
}): Promise<CatalogSetImageSyncCandidate[]> {
  let query = supabaseClient
    .from(CATALOG_SETS_TABLE)
    .select('set_id, source_set_number, name, image_url, status')
    .eq('status', 'active')
    .order('created_at', {
      ascending: false,
    });

  if (setIds?.length) {
    query = query.in('set_id', setIds);
  }

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to list catalog sets for image sync.');
  }

  const candidates = ((data as CatalogSetImageCandidateRow[] | null) ?? []).map(
    toCatalogSetImageSyncCandidate,
  );

  if (!missingOnly && !refreshFailed) {
    return candidates;
  }

  const state = await readCatalogSetImageState({
    setIds: candidates.map((candidate) => candidate.setId),
    supabaseClient,
  });

  return candidates.filter((candidate) => {
    const isMissing = (() => {
      if (refreshImageMetadata) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          state.imageMetadataIncompleteSetIds.has(candidate.setId)
        );
      }

      if (refreshCard && refreshSocial && refreshThumbnails) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          (!state.activeCardSetIds.has(candidate.setId) ||
            !state.activeSocialSetIds.has(candidate.setId) ||
            !state.activeThumbnailSetIds.has(candidate.setId))
        );
      }

      if (refreshCard && refreshSocial) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          (!state.activeCardSetIds.has(candidate.setId) ||
            !state.activeSocialSetIds.has(candidate.setId))
        );
      }

      if (refreshCard && refreshThumbnails) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          (!state.activeCardSetIds.has(candidate.setId) ||
            !state.activeThumbnailSetIds.has(candidate.setId))
        );
      }

      if (refreshSocial && refreshThumbnails) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          (!state.activeSocialSetIds.has(candidate.setId) ||
            !state.activeThumbnailSetIds.has(candidate.setId))
        );
      }

      if (refreshCard) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          !state.activeCardSetIds.has(candidate.setId)
        );
      }

      if (refreshSocial) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          !state.activeSocialSetIds.has(candidate.setId)
        );
      }

      if (refreshThumbnails) {
        return (
          state.activeHeroSetIds.has(candidate.setId) &&
          !state.activeThumbnailSetIds.has(candidate.setId)
        );
      }

      return !state.activeHeroSetIds.has(candidate.setId);
    })();
    const hasFailed = state.failedSetIds.has(candidate.setId);

    if (missingOnly && refreshFailed) {
      return isMissing || hasFailed;
    }

    if (missingOnly) {
      return isMissing;
    }

    return hasFailed;
  });
}

async function readCatalogSetImageState({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogSetImageMetadataClient;
}): Promise<{
  activeHeroSetIds: Set<string>;
  activeCardSetIds: Set<string>;
  activeSocialSetIds: Set<string>;
  activeThumbnailSetIds: Set<string>;
  failedSetIds: Set<string>;
  imageMetadataIncompleteSetIds: Set<string>;
}> {
  const activeHeroSetIds = new Set<string>();
  const activeCardSetIds = new Set<string>();
  const activeSocialSetIds = new Set<string>();
  const activeThumbnailSetIds = new Set<string>();
  const failedSetIds = new Set<string>();
  const imageMetadataIncompleteSetIds = new Set<string>();

  if (!setIds.length) {
    return {
      activeHeroSetIds,
      activeCardSetIds,
      activeSocialSetIds,
      activeThumbnailSetIds,
      failedSetIds,
      imageMetadataIncompleteSetIds,
    };
  }

  const { data, error } = await supabaseClient
    .from(CATALOG_SET_IMAGES_TABLE)
    .select('set_id, image_type, perceptual_hash, status')
    .in('set_id', setIds);

  if (error) {
    throw new Error('Unable to load catalog set image state.');
  }

  for (const row of (data as Array<{
    image_type: string;
    perceptual_hash: string | null;
    set_id: string;
    status: string;
  }> | null) ?? []) {
    if (row.image_type === 'card' && row.status === 'active') {
      activeCardSetIds.add(row.set_id);
    }

    if (row.image_type === 'hero' && row.status === 'active') {
      activeHeroSetIds.add(row.set_id);
    }

    if (row.image_type === 'social' && row.status === 'active') {
      activeSocialSetIds.add(row.set_id);
    }

    if (row.image_type === 'thumbnail' && row.status === 'active') {
      activeThumbnailSetIds.add(row.set_id);
    }

    if (row.status === 'failed') {
      failedSetIds.add(row.set_id);
    }

    if (
      row.status !== 'failed' &&
      (typeof row.perceptual_hash !== 'string' ||
        row.perceptual_hash.length === 0)
    ) {
      imageMetadataIncompleteSetIds.add(row.set_id);
    }
  }

  return {
    activeHeroSetIds,
    activeCardSetIds,
    activeSocialSetIds,
    activeThumbnailSetIds,
    failedSetIds,
    imageMetadataIncompleteSetIds,
  };
}

async function countActiveCatalogSets({
  supabaseClient,
}: {
  supabaseClient: CatalogSetImageMetadataClient;
}): Promise<number> {
  const { count, error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .select('set_id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'active');

  if (error) {
    throw new Error('Unable to count active catalog sets for image footprint.');
  }

  return typeof count === 'number' ? count : 0;
}

async function listBricksetImageCandidatesBySetId({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogSetImageMetadataClient;
}): Promise<Map<string, readonly CatalogSetImageSourceCandidate[]>> {
  const candidatesBySetId = new Map<
    string,
    readonly CatalogSetImageSourceCandidate[]
  >();

  if (!setIds.length) {
    return candidatesBySetId;
  }

  const { data, error } = await supabaseClient
    .from(CATALOG_SET_SOURCE_METADATA_TABLE)
    .select('catalog_set_id, metadata_json, policy')
    .eq('source', BRICKSET_SOURCE)
    .eq('locale', BRICKSET_LOCALE)
    .eq('match_confidence', BRICKSET_MATCH_CONFIDENCE)
    .in('catalog_set_id', setIds);

  if (error) {
    throw new Error('Unable to load Brickset image metadata.');
  }

  for (const row of (data as CatalogSetSourceMetadataRow[] | null) ?? []) {
    candidatesBySetId.set(
      row.catalog_set_id,
      readBricksetImageSourceCandidates(row.metadata_json),
    );
  }

  return candidatesBySetId;
}

async function runWithConcurrency<T, R>({
  concurrency,
  items,
  worker,
}: {
  concurrency: number;
  items: readonly T[];
  worker: (item: T) => Promise<R>;
}): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );

  return results;
}

function bytesToStorageGb(bytes: number): number {
  return Number((bytes / BYTES_PER_GB).toFixed(4));
}

function roundNumber(value: number, fractionDigits = 0): number {
  return Number(value.toFixed(fractionDigits));
}

function createFootprintProjection({
  averageBytesPerSet,
  setCount,
}: {
  averageBytesPerSet: number;
  setCount: number;
}): CatalogSetImageFootprintProjection {
  const storageBytes = Math.round(averageBytesPerSet * setCount);

  return {
    bandwidthBytesPerFullImagePayloadView: storageBytes,
    bandwidthGbPerFullImagePayloadView: bytesToStorageGb(storageBytes),
    setCount,
    storageBytes,
    storageGb: bytesToStorageGb(storageBytes),
  };
}

function buildCatalogSetImageFootprintReport({
  activeCatalogSetCount,
  results,
}: {
  activeCatalogSetCount: number;
  results: readonly CatalogSetImageSyncItemResult[];
}): CatalogSetImageFootprintReport {
  const sampledResults = results.filter((result) => result.heroImageStored);
  const sampleSetCount = sampledResults.length;
  const byType = {
    card: {
      averageBytes: 0,
      imageCount: 0,
      totalBytes: 0,
    },
    gallery: {
      averageBytes: 0,
      imageCount: 0,
      totalBytes: 0,
    },
    hero: {
      averageBytes: 0,
      imageCount: 0,
      totalBytes: 0,
    },
    social: {
      averageBytes: 0,
      imageCount: 0,
      totalBytes: 0,
    },
    thumbnail: {
      averageBytes: 0,
      imageCount: 0,
      totalBytes: 0,
    },
  } satisfies Record<CatalogStoredSetImageType, CatalogSetImageTypeFootprint>;

  for (const result of sampledResults) {
    for (const imageType of CATALOG_STORED_SET_IMAGE_TYPES) {
      byType[imageType].imageCount += result.imageCountByType[imageType];
      byType[imageType].totalBytes += result.imageBytesByType[imageType];
    }
  }

  for (const imageType of CATALOG_STORED_SET_IMAGE_TYPES) {
    byType[imageType].averageBytes = byType[imageType].imageCount
      ? Math.round(byType[imageType].totalBytes / byType[imageType].imageCount)
      : 0;
  }

  const totalBytes = sampledResults.reduce(
    (total, result) => total + result.estimatedUploadBytes,
    0,
  );
  const totalGalleryImages = sampledResults.reduce(
    (total, result) => total + result.galleryImageCount,
    0,
  );
  const averageBytesPerSet = sampleSetCount
    ? Math.round(totalBytes / sampleSetCount)
    : 0;
  const averageGalleryImagesPerSet = sampleSetCount
    ? roundNumber(totalGalleryImages / sampleSetCount, 2)
    : 0;

  return {
    averageBytesPerSet,
    averageGalleryImagesPerSet,
    bandwidthAssumptions: {
      cdnCacheHitRate: 0,
      fullImagePayloadViewsPerSet: 1,
      note: 'Bandwidth projection assumes one full stored image payload per set, no CDN/browser cache hit, and all card/hero/gallery/social/thumbnail images requested once. Real egress should be lower because galleries are lazy/interacted with and Supabase CDN/browser caching absorbs repeat views.',
    },
    byType,
    currentCatalogSetCount: activeCatalogSetCount,
    projections: {
      currentCatalog: createFootprintProjection({
        averageBytesPerSet,
        setCount: activeCatalogSetCount,
      }),
      sets100: createFootprintProjection({
        averageBytesPerSet,
        setCount: STORAGE_PROJECTION_SET_COUNTS[0],
      }),
      sets1000: createFootprintProjection({
        averageBytesPerSet,
        setCount: STORAGE_PROJECTION_SET_COUNTS[1],
      }),
    },
    sampleSetCount,
  };
}

function isCatalogSetImageSyncResultFailedForMode({
  refreshCard,
  refreshImageMetadata,
  refreshSocial,
  refreshThumbnails,
  result,
}: {
  refreshCard: boolean;
  refreshImageMetadata: boolean;
  refreshSocial: boolean;
  refreshThumbnails: boolean;
  result: CatalogSetImageSyncItemResult;
}): boolean {
  if (refreshCard || refreshSocial || refreshThumbnails) {
    return (
      result.failedVariantCount > 0 ||
      (refreshCard && !result.cardImageStored) ||
      (refreshSocial && !result.socialImageStored) ||
      (refreshThumbnails && !result.thumbnailImageStored)
    );
  }

  if (refreshImageMetadata) {
    return !result.heroImageStored && !result.imageCountByType.hero;
  }

  return !result.heroImageStored;
}

export async function syncCatalogSetImages({
  concurrency,
  debugDedupe = false,
  dryRun = true,
  fetchFn = fetch,
  limit,
  metadataSupabaseClient,
  missingOnly = false,
  refreshImageMetadata = false,
  refreshFailed = false,
  refreshCard = false,
  refreshSocial = false,
  refreshThumbnails = false,
  setIds,
  storageSupabaseClient,
  supabaseClient,
  uploadRetryCount,
}: CatalogSetImageSyncOptions): Promise<CatalogSetImageSyncResult> {
  const resolvedMetadataSupabaseClient =
    metadataSupabaseClient ?? supabaseClient;
  const resolvedStorageSupabaseClient = storageSupabaseClient ?? supabaseClient;

  if (!resolvedMetadataSupabaseClient) {
    throw new Error('A metadata Supabase client is required.');
  }

  if (!resolvedStorageSupabaseClient) {
    throw new Error('A storage Supabase client is required.');
  }

  if (debugDedupe && !dryRun) {
    throw new Error('--debug-dedupe is dry-run only.');
  }

  const normalizedSetIds = normalizeSyncSetIds(setIds);
  const resolvedUploadRetryCount = clampUploadRetryCount(uploadRetryCount);
  const activeCatalogSetCount = await countActiveCatalogSets({
    supabaseClient: resolvedMetadataSupabaseClient,
  });
  const candidates = await listCatalogSetImageSyncCandidates({
    limit,
    missingOnly,
    refreshImageMetadata,
    refreshFailed,
    refreshCard,
    refreshSocial,
    refreshThumbnails,
    setIds: normalizedSetIds,
    supabaseClient: resolvedMetadataSupabaseClient,
  });
  const bricksetImageCandidatesBySetId =
    await listBricksetImageCandidatesBySetId({
      setIds: candidates.map((candidate) => candidate.setId),
      supabaseClient: resolvedMetadataSupabaseClient,
    });
  const results = await runWithConcurrency({
    concurrency: clampConcurrency(concurrency),
    items: candidates,
    worker: (candidate) =>
      processCatalogSetImageSyncCandidate({
        bricksetImageCandidatesBySetId,
        candidate,
        debugDedupe,
        dryRun,
        fetchFn,
        metadataSupabaseClient: resolvedMetadataSupabaseClient,
        refreshImageMetadata,
        refreshCard,
        refreshSocial,
        refreshThumbnails,
        storageSupabaseClient: resolvedStorageSupabaseClient,
        uploadRetryCount: resolvedUploadRetryCount,
      }),
  });
  const footprintReport = buildCatalogSetImageFootprintReport({
    activeCatalogSetCount,
    results,
  });

  return {
    activeCatalogSetCount,
    bucket: CATALOG_SET_IMAGES_BUCKET,
    debugDedupe,
    dedupeAudits: results
      .map((result) => result.dedupeAudit)
      .filter((audit): audit is CatalogSetImageDedupeAudit => audit != null),
    dryRun,
    duplicateGroups: results.flatMap((result) => result.duplicateGroups),
    duplicateSourceCount: results.reduce(
      (totalCount, result) => totalCount + result.duplicateSourceCount,
      0,
    ),
    estimatedUploadBytes: results.reduce(
      (totalBytes, result) => totalBytes + result.estimatedUploadBytes,
      0,
    ),
    exactDuplicateCount: results.reduce(
      (totalCount, result) => totalCount + result.exactDuplicateCount,
      0,
    ),
    failedSetCount: results.filter((result) =>
      isCatalogSetImageSyncResultFailedForMode({
        refreshCard,
        refreshImageMetadata,
        refreshSocial,
        refreshThumbnails,
        result,
      }),
    ).length,
    failedSourceCount: results.reduce(
      (totalCount, result) => totalCount + result.failedSourceCount,
      0,
    ),
    failedSourceSamples: sampleFailures(
      results.flatMap((result) => result.failedSourceSamples),
    ),
    failedVariantCount: results.reduce(
      (totalCount, result) => totalCount + result.failedVariantCount,
      0,
    ),
    failedVariantSamples: sampleFailures(
      results.flatMap((result) => result.failedVariantSamples),
    ),
    footprintReport,
    heroSimilaritySuppressedCount: results.reduce(
      (totalCount, result) => totalCount + result.heroSimilaritySuppressedCount,
      0,
    ),
    missingOnly,
    orphanThumbnailRowCount: results.reduce(
      (totalCount, result) => totalCount + result.orphanThumbnailRows.length,
      0,
    ),
    orphanThumbnailRows: results
      .flatMap((result) => result.orphanThumbnailRows)
      .slice(0, 20),
    perceptualDuplicateCount: results.reduce(
      (totalCount, result) => totalCount + result.perceptualDuplicateCount,
      0,
    ),
    processedSetCount: results.length,
    refreshImageMetadata,
    refreshFailed,
    refreshCard,
    refreshSocial,
    refreshThumbnails,
    results,
    roleCounts: results.reduce((roleCounts, result) => {
      for (const role of IMAGE_ROLE_VALUES) {
        roleCounts[role] += result.roleCounts[role];
      }

      return roleCounts;
    }, createEmptyRoleCountRecord()),
    selectedSetCount: candidates.length,
    ...(normalizedSetIds ? { setIds: normalizedSetIds } : {}),
    skippedSetCount: candidates.filter(
      (candidate) =>
        !candidate.imageUrl &&
        !(bricksetImageCandidatesBySetId.get(candidate.setId) ?? []).length,
    ).length,
    suppressedImages: results.flatMap((result) => result.suppressedImages),
    uploadedBytes: results.reduce(
      (totalBytes, result) => totalBytes + result.uploadedBytes,
      0,
    ),
    uploadRetryCount: resolvedUploadRetryCount,
    write: !dryRun,
  };
}

async function readCatalogSetImageMetadataRows({
  setIds,
  supabaseClient,
}: {
  setIds?: readonly string[];
  supabaseClient: CatalogSetImageMetadataClient;
}): Promise<CatalogSetImageUpsertRow[]> {
  const rows: CatalogSetImageUpsertRow[] = [];
  const normalizedSetIds = normalizeSyncSetIds(setIds);

  for (let from = 0; ; from += 1000) {
    let query = supabaseClient
      .from(CATALOG_SET_IMAGES_TABLE)
      .select(
        'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, duplicate_reason, duplicate_distance, status, metadata_json',
      )
      .order('set_id', { ascending: true })
      .range(from, from + 999);

    if (normalizedSetIds?.length) {
      query = query.in('set_id', normalizedSetIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Unable to read catalog set image metadata rows.');
    }

    const pageRows = (data as CatalogSetImageUpsertRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < 1000) {
      return rows;
    }
  }
}

export async function copyCatalogSetImageMetadata({
  dryRun = true,
  setIds,
  sourceSupabaseClient,
  targetSupabaseClient,
}: CopyCatalogSetImageMetadataOptions): Promise<CatalogSetImageMetadataCopyResult> {
  const normalizedSetIds = normalizeSyncSetIds(setIds);
  const rows = (
    await readCatalogSetImageMetadataRows({
      setIds: normalizedSetIds,
      supabaseClient: sourceSupabaseClient,
    })
  ).map((row) => normalizeCatalogSetImagePublicUrlRow(row));

  if (!dryRun) {
    await upsertCatalogSetImageRows({
      metadataSupabaseClient: targetSupabaseClient,
      rows,
    });
  }

  return {
    copiedCount: dryRun ? 0 : rows.length,
    dryRun,
    readCount: rows.length,
    ...(normalizedSetIds ? { setIds: normalizedSetIds } : {}),
    skippedCount: dryRun ? rows.length : 0,
    source: 'production',
    target: 'staging',
  };
}

export async function rewriteCatalogSetImagePublicUrls({
  dryRun = true,
  setIds,
  supabaseClient,
}: RewriteCatalogSetImagePublicUrlsOptions): Promise<CatalogSetImagePublicUrlRewriteResult> {
  const normalizedSetIds = normalizeSyncSetIds(setIds);
  const rows = await readCatalogSetImageMetadataRows({
    setIds: normalizedSetIds,
    supabaseClient,
  });
  const rewrittenRows = rows
    .map((row) => normalizeCatalogSetImagePublicUrlRow(row))
    .filter(
      (row, index) => JSON.stringify(row) !== JSON.stringify(rows[index]),
    );

  if (!dryRun && rewrittenRows.length) {
    await upsertCatalogSetImageRows({
      metadataSupabaseClient: supabaseClient,
      rows: rewrittenRows,
    });
  }

  return {
    dryRun,
    readCount: rows.length,
    rewrittenCount: rewrittenRows.length,
    ...(normalizedSetIds ? { setIds: normalizedSetIds } : {}),
    skippedCount: rows.length - rewrittenRows.length,
  };
}
