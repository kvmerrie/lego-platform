import {
  dedupeCatalogOffersByPublicMerchant,
  getCatalogOfferMerchantSlug,
  getCatalogOfferPublicMerchantName,
  selectBestPurchasableOffer,
  sortCatalogOffers,
  type CatalogOffer,
} from '@lego-platform/affiliate/util';
import type { Metadata } from 'next';
import React, { cache, Suspense } from 'react';
import {
  getCatalogPrimaryOfferAvailabilityStateBySetId,
  type CatalogPrimaryOfferAvailabilityState,
  type CatalogCurrentOfferSummary,
  type CatalogRuntimeOffer,
  type CatalogDiscoverySignal,
  listCatalogCurrentOfferCandidateSetIds,
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogDiscoverySignalsBySetId,
  getCatalogSetDetailRelatedThemeSnapshot,
  getCatalogSetBySlug,
  listCatalogSetCards,
  listCatalogSetCardsByIds,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
  summarizeCatalogCurrentOffers,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogFeatureSetList,
  type CatalogFeatureSetListItem,
} from '@lego-platform/catalog/feature-set-list';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import {
  CatalogFeatureRecentlyViewed,
  CatalogRecentlyViewedSetTracker,
} from '@lego-platform/catalog/feature-recently-viewed';
import {
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
  type CatalogSetDetailSupportItem,
  type CatalogSetDetailTrustSignal,
  type CatalogSetDetailVerdict,
} from '@lego-platform/catalog/ui';
import { isThemeVisible, normalizeTheme } from '@lego-platform/catalog/util';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import { listPublishedArticlesByPrimarySetNumber } from '@lego-platform/content/data-access';
import type { ContentArticleListItem } from '@lego-platform/content/util';
import {
  buildSetDecisionPresentation,
  buildBrickhuntValueItems,
  buildSetDecisionSupportItems,
  buildSetDealVerdict,
  getHeroDealPresentation,
  getPricePanelSnapshot,
} from '@lego-platform/pricing/data-access';
import {
  buildEffectiveSetDealSnapshot,
  formatPriceMinor,
  type HeroDealPresentation,
  type PricePanelSnapshot,
} from '@lego-platform/pricing/util';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { ReviewsFeatureSetReviews } from '@lego-platform/reviews/feature-set-reviews';
import { getCatalogSetReviewsPublicPayload } from '@lego-platform/reviews/data-access-web';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  buildArticlePath,
  buildCatalogSetDetailCacheTags,
  buildCanonicalUrl,
  buildSetDetailPath,
  cacheTags,
  getDefaultFormattingLocale,
  getBricksetGalleryRenderMode,
  getSetDetailPageRobotsDirective,
  publicWebBaseUrls,
  webPathnames,
} from '@lego-platform/shared/config';
import {
  getAccessibleForegroundColor,
  getBrickhuntAnalyticsPriceVerdict,
} from '@lego-platform/shared/util';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import {
  type CatalogSetImage,
  buildCatalogMerchantPresentation,
  type CatalogMerchantClaim,
  getCatalogCollectionLandingPageConfig,
  getCatalogReleaseYear,
  resolveCatalogReleaseDatePrecision,
  type CatalogHomepageSetCard,
  type CatalogSetDetail,
  type CatalogReleaseDatePrecision,
  type CatalogSetStatus,
} from '@lego-platform/catalog/util';
import { buildCurrentSetCardPriceContext } from '../../lib/current-set-card-price-context';
import { JsonLdScript } from '../../lib/json-ld';
import {
  buildSetBreadcrumbJsonLd,
  buildSetProductJsonLd,
} from '../../lib/structured-data';
import styles from './page.module.css';

export const dynamicParams = true;
export const revalidate = 21_600;
const SET_DETAIL_CACHE_VERSION = 'v3';

const BRICKHUNT_TIME_ZONE = 'Europe/Amsterdam';
const SET_DETAIL_INTERNAL_LINK_RAIL_LIMIT = 8;
const SET_NEWS_RAIL_LIMIT = 4;
const SET_DETAIL_STATIC_PARAMS_DEFAULT_LIMIT = 240;
const SET_DETAIL_OPTIONAL_RAIL_TIMEOUT_MS = 350;
const SET_DETAIL_SIMILAR_RAIL_TIMEOUT_MS = 1_500;
const SET_DETAIL_RECENT_RELEASE_LOOKBACK_DAYS = 90;
const SET_DETAIL_RECENT_RELEASE_LOOKAHEAD_DAYS = 30;
const DEFAULT_SET_DETAIL_OG_IMAGE = '/favicon.ico';
const SET_DETAIL_METADATA_IMAGE_VERSION_LENGTH = 12;
const SET_DETAIL_OG_IMAGE_WIDTH = 1200;
const SET_DETAIL_OG_IMAGE_HEIGHT = 1200;
const SET_DETAIL_THEME_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SET_DETAIL_HIDDEN_THEME_SLUGS = new Set(['other', 'unknown']);
const SET_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS = 500;
const SET_PAGE_PERF_DEFAULT_LOG_LIMIT = 12;
let setPagePerfLogCount = 0;
let similarRailCompletedCount = 0;
let similarRailDurationTotalMs = 0;
let similarRailTimeoutCount = 0;
let similarRailCancelledQueryCount = 0;
let similarRailSkippedAfterTimeoutCount = 0;

class SetPageOptionalRailAbortError extends Error {
  constructor(message = 'Set detail optional rail aborted.') {
    super(message);
    this.name = 'SetPageOptionalRailAbortError';
  }
}

function getSetDetailStaticParamsLimit(): number {
  const value = Number(process.env['SET_DETAIL_STATIC_PARAMS_LIMIT']);

  return Number.isFinite(value) && value > 0
    ? Math.min(Math.trunc(value), 1_000)
    : SET_DETAIL_STATIC_PARAMS_DEFAULT_LIMIT;
}

function isSetPagePerfDebugEnabled(): boolean {
  return process.env['DEBUG_SET_PAGE_PERF'] === 'true';
}

function isSetPagePerfVerboseEnabled(): boolean {
  return process.env['DEBUG_SET_PAGE_PERF_VERBOSE'] === 'true';
}

function isSetPageSimilarRailDebugEnabled(): boolean {
  return process.env['DEBUG_SET_PAGE_SIMILAR_RAIL'] === 'true';
}

function getSetPagePerfNumber({
  defaultValue,
  envName,
}: {
  defaultValue: number;
  envName: string;
}): number {
  const value = Number(process.env[envName]);

  return Number.isFinite(value) && value >= 0 ? value : defaultValue;
}

function shouldLogSetPagePerf({
  durationMs,
  status,
}: {
  durationMs: number;
  status: 'ok' | 'error' | 'timeout';
}): boolean {
  if (!isSetPagePerfDebugEnabled()) {
    return status === 'timeout';
  }

  if (isSetPagePerfVerboseEnabled()) {
    return true;
  }

  if (status !== 'ok') {
    return true;
  }

  return (
    durationMs >=
    getSetPagePerfNumber({
      defaultValue: SET_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS,
      envName: 'DEBUG_SET_PAGE_PERF_SLOW_MS',
    })
  );
}

function logSetPagePerf({
  details,
  durationMs,
  label,
  slug,
  status,
}: {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  label: string;
  slug: string;
  status: 'ok' | 'error' | 'timeout';
}) {
  if (!shouldLogSetPagePerf({ durationMs, status })) {
    return;
  }

  const logLimit = getSetPagePerfNumber({
    defaultValue: SET_PAGE_PERF_DEFAULT_LOG_LIMIT,
    envName: 'DEBUG_SET_PAGE_PERF_LOG_LIMIT',
  });

  if (status !== 'error' && setPagePerfLogCount >= logLimit) {
    return;
  }

  setPagePerfLogCount += 1;

  const log =
    status === 'timeout' || status === 'error' ? console.warn : console.info;

  log('[set-page-perf]', {
    ...details,
    durationMs,
    label,
    slug,
    status,
  });
}

function logSimilarSetRailDebug(
  details: Readonly<Record<string, unknown>>,
): void {
  if (!isSetPageSimilarRailDebugEnabled()) {
    return;
  }

  console.info('[set-page-similar-rail]', details);
}

function isSetPageAbortError(error: unknown): boolean {
  return (
    error instanceof SetPageOptionalRailAbortError ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function getSimilarRailDiagnostics({
  durationMs,
}: {
  durationMs?: number;
} = {}) {
  return {
    average_similar_rail_duration_ms: similarRailCompletedCount
      ? Math.round(similarRailDurationTotalMs / similarRailCompletedCount)
      : durationMs,
    cancelled_query_count: similarRailCancelledQueryCount,
    similar_rail_timeout_count: similarRailTimeoutCount,
    skipped_after_timeout_count: similarRailSkippedAfterTimeoutCount,
  };
}

function recordSimilarRailCompletion(durationMs: number) {
  similarRailCompletedCount += 1;
  similarRailDurationTotalMs += durationMs;
}

function recordSimilarRailTimeout() {
  similarRailTimeoutCount += 1;
  similarRailCancelledQueryCount += 1;
}

function throwIfSimilarRailAborted(signal: AbortSignal) {
  if (!signal.aborted) {
    return;
  }

  similarRailSkippedAfterTimeoutCount += 1;
  throw new SetPageOptionalRailAbortError();
}

async function measureSetPageFetch<T>({
  label,
  load,
  slug,
}: {
  label: string;
  load: () => Promise<T>;
  slug: string;
}): Promise<T> {
  if (!isSetPagePerfDebugEnabled()) {
    return load();
  }

  const startedAt = Date.now();

  try {
    const result = await load();

    logSetPagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'ok',
    });

    return result;
  } catch (error) {
    logSetPagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'error',
    });

    throw error;
  }
}

function measureSetPageSync<T>({
  label,
  load,
  slug,
}: {
  label: string;
  load: () => T;
  slug: string;
}): T {
  if (!isSetPagePerfDebugEnabled()) {
    return load();
  }

  const startedAt = Date.now();

  try {
    const result = load();

    logSetPagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'ok',
    });

    return result;
  } catch (error) {
    logSetPagePerf({
      durationMs: Date.now() - startedAt,
      label,
      slug,
      status: 'error',
    });

    throw error;
  }
}

async function getCachedCatalogSetBySlug({ slug }: { slug: string }) {
  const bricksetGalleryRenderMode = getBricksetGalleryRenderMode();

  return unstable_cache(
    () => getCatalogSetBySlug({ slug }),
    [
      'catalog-set-detail',
      SET_DETAIL_CACHE_VERSION,
      slug,
      bricksetGalleryRenderMode,
    ],
    {
      revalidate,
      tags: buildCatalogSetDetailCacheTags({ slug }),
    },
  )();
}

const getRequestCachedCatalogSetBySlug = cache(async (slug: string) =>
  getCachedCatalogSetBySlug({ slug }),
);

const getRequestCachedSetDetailLiveOffersBySetId = cache(
  async (setId: string) => loadSetDetailLiveOffers({ setId }),
);

const getRequestCachedSnapshotCurrentOfferSummaryBySetId = cache(
  async (setId: string) => {
    const currentOfferSummaryBySetId =
      await listCatalogCurrentOfferSummariesBySetIds({
        cacheOptions: {
          revalidateSeconds: revalidate,
          tags: [cacheTags.prices(), cacheTags.set(setId)],
        },
        liveFallbackSetIdLimit: 0,
        setIds: [setId],
      });

    return currentOfferSummaryBySetId.get(setId);
  },
);

const getRequestCachedCatalogSetReviewsPublicPayload = cache(
  async ({ setId, slug }: { setId: string; slug: string }) =>
    unstable_cache(
      () => getCatalogSetReviewsPublicPayload({ setId }),
      ['catalog-set-reviews', SET_DETAIL_CACHE_VERSION, setId],
      {
        revalidate,
        tags: [
          ...buildCatalogSetDetailCacheTags({ setId, slug }),
          cacheTags.reviews(),
          cacheTags.setReviews(setId),
        ],
      },
    )(),
);

async function withSetPageOptionalTimeout<T>({
  fallback,
  label,
  load,
  slug,
  timeoutMs = SET_DETAIL_OPTIONAL_RAIL_TIMEOUT_MS,
}: {
  fallback: T;
  label: string;
  load: (signal: AbortSignal) => Promise<T>;
  slug: string;
  timeoutMs?: number;
}): Promise<T> {
  const abortController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;
  const startedAt = Date.now();
  const workPromise = load(abortController.signal)
    .then((result) => {
      if (abortController.signal.aborted) {
        return fallback;
      }

      if (label === 'similar-sets:rail') {
        recordSimilarRailCompletion(Date.now() - startedAt);
      }

      return result;
    })
    .catch((error) => {
      if (isSetPageAbortError(error) || abortController.signal.aborted) {
        return fallback;
      }

      logSetPagePerf({
        durationMs: Date.now() - startedAt,
        label,
        slug,
        status: 'error',
      });

      return fallback;
    });
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      didTimeout = true;
      abortController.abort();

      if (label === 'similar-sets:rail') {
        recordSimilarRailTimeout();
      }

      logSetPagePerf({
        details:
          label === 'similar-sets:rail'
            ? getSimilarRailDiagnostics({ durationMs: timeoutMs })
            : undefined,
        durationMs: timeoutMs,
        label,
        slug,
        status: 'timeout',
      });

      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([workPromise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (didTimeout) {
      workPromise.catch(() => undefined);
    }
  }
}

export type SetDetailAvailabilityFallbackState =
  | 'available'
  | 'no_current_price'
  | 'no_current_stock'
  | 'retired';

const SET_DETAIL_UNAVAILABLE_OFFER_STATE: CatalogPrimaryOfferAvailabilityState =
  {
    primaryMerchantCount: 0,
    primarySeedCount: 1,
    validPrimaryOfferCount: 0,
  };

function getCalendarDayValue(date: Date): number {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);

  const day = Number(
    dateParts.find((part) => part.type === 'day')?.value ?? '0',
  );
  const month = Number(
    dateParts.find((part) => part.type === 'month')?.value ?? '0',
  );
  const year = Number(
    dateParts.find((part) => part.type === 'year')?.value ?? '0',
  );

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatOfferCheckedTime(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

function formatOfferCheckedDate(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

function isEuroCatalogOffer(catalogOffer: CatalogOffer): boolean {
  return catalogOffer.currency === 'EUR';
}

export async function loadSetDetailLiveOffers({
  setId,
}: {
  setId: string;
}): Promise<CatalogOffer[]> {
  try {
    return await listCatalogSetLiveOffersBySetId({
      cacheOptions: {
        revalidateSeconds: revalidate,
        tags: [cacheTags.prices(), cacheTags.set(setId)],
      },
      setId,
    });
  } catch {
    return [];
  }
}

export async function loadSetDetailPrimaryOfferAvailability({
  setId,
}: {
  setId: string;
}): Promise<CatalogPrimaryOfferAvailabilityState> {
  try {
    return await getCatalogPrimaryOfferAvailabilityStateBySetId({
      setId,
    });
  } catch {
    return SET_DETAIL_UNAVAILABLE_OFFER_STATE;
  }
}

export async function loadSetDetailDiscoverySignal({
  setId,
}: {
  setId: string;
}): Promise<CatalogDiscoverySignal | undefined> {
  try {
    const discoverySignalsBySetId = await listCatalogDiscoverySignalsBySetId({
      cacheOptions: {
        revalidateSeconds: revalidate,
        tags: [cacheTags.prices(), cacheTags.set(setId)],
      },
      setIds: [setId],
    });

    return discoverySignalsBySetId.get(setId);
  } catch {
    return undefined;
  }
}

function formatOfferPrice(catalogOffer: CatalogOffer): string {
  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    style: 'currency',
    currency: catalogOffer.currency,
  }).format(catalogOffer.priceCents / 100);
}

function formatMetadataPrice({
  currencyCode,
  minorUnits,
}: {
  currencyCode: string;
  minorUnits: number;
}): string {
  return formatPriceMinor({
    currencyCode,
    minorUnits,
  }).replace(/\u00a0/g, ' ');
}

function toAbsoluteMetadataUrl(url: string | undefined): string {
  const baseUrl = getSetDetailMetadataBaseUrl();

  if (!url) {
    return `${baseUrl}${DEFAULT_SET_DETAIL_OG_IMAGE}`;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'https:';
    }

    return parsedUrl.toString();
  } catch {
    return new URL(url, baseUrl).toString();
  }
}

function getSetDetailMetadataBaseUrl(): string {
  const configuredBaseUrl =
    process.env['WEB_BASE_URL'] ??
    process.env['NEXT_PUBLIC_WEB_BASE_URL'] ??
    process.env['NEXT_PUBLIC_SITE_URL'];

  if (configuredBaseUrl) {
    try {
      const configuredUrl = new URL(configuredBaseUrl);
      const hostname = configuredUrl.hostname.toLowerCase();

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return publicWebBaseUrls.local;
      }

      if (
        hostname === 'staging.brickhunt.nl' ||
        hostname.startsWith('staging.') ||
        hostname.startsWith('staging-')
      ) {
        return publicWebBaseUrls.staging;
      }

      return publicWebBaseUrls.production;
    } catch {
      // Fall back to deploy environment below.
    }
  }

  const deployEnvironment = (
    process.env['BRICKHUNT_DEPLOY_ENV'] ?? process.env['VERCEL_ENV']
  )
    ?.trim()
    .toLowerCase();

  if (deployEnvironment === 'staging' || deployEnvironment === 'preview') {
    return publicWebBaseUrls.staging;
  }

  if (deployEnvironment === 'production') {
    return publicWebBaseUrls.production;
  }

  return process.env.NODE_ENV === 'development'
    ? publicWebBaseUrls.local
    : publicWebBaseUrls.production;
}

function getMetadataImageMimeType(imageUrl: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(
        imageUrl,
        getSetDetailMetadataBaseUrl(),
      ).pathname.toLowerCase();
    } catch {
      return imageUrl.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
    }
  })();

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (pathname.endsWith('.png')) {
    return 'image/png';
  }

  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }

  return undefined;
}

function isSharePreferredImageUrl(imageUrl: string | undefined): boolean {
  if (!imageUrl) {
    return false;
  }

  const pathname = (() => {
    try {
      return new URL(
        imageUrl,
        getSetDetailMetadataBaseUrl(),
      ).pathname.toLowerCase();
    } catch {
      return imageUrl.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
    }
  })();

  return (
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.png')
  );
}

function getSetDetailMetadataImageVersion(
  sha256: string | undefined,
): string | undefined {
  const normalizedSha256 = sha256?.trim().toLowerCase();

  return normalizedSha256 && /^[a-f0-9]{8,}$/.test(normalizedSha256)
    ? normalizedSha256.slice(0, SET_DETAIL_METADATA_IMAGE_VERSION_LENGTH)
    : undefined;
}

function withSetDetailMetadataImageVersion(
  image: CatalogSetImage | undefined,
): string | undefined {
  if (!image?.url) {
    return undefined;
  }

  const version = getSetDetailMetadataImageVersion(image.sha256);

  if (!version) {
    return image.url;
  }

  try {
    const versionedUrl = new URL(image.url);
    versionedUrl.searchParams.set('v', version);

    return versionedUrl.toString();
  } catch {
    const [urlWithoutHash = '', hash = ''] = image.url.split('#', 2);
    const [pathname = '', search = ''] = urlWithoutHash.split('?', 2);
    const searchParams = new URLSearchParams(search);
    searchParams.set('v', version);
    const queryString = searchParams.toString();

    return `${pathname}${queryString ? `?${queryString}` : ''}${
      hash ? `#${hash}` : ''
    }`;
  }
}

function getSetDetailMetadataImageCandidateUrl(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
): string {
  const socialImage = catalogSetDetail.images?.find(
    (image) => image.type === 'social',
  );
  const candidates = [
    withSetDetailMetadataImageVersion(socialImage),
    catalogSetDetail.primaryImage,
    catalogSetDetail.images?.find((image) => image.type === 'hero')?.url,
    catalogSetDetail.imageUrl,
    ...(catalogSetDetail.images?.map((image) => image.url) ?? []),
  ].filter((imageUrl): imageUrl is string => Boolean(imageUrl));
  const preferredCandidate =
    candidates.find(isSharePreferredImageUrl) ?? candidates[0];

  return toAbsoluteMetadataUrl(preferredCandidate);
}

function getSetDetailMetadataImage(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
  alt: string,
) {
  const imageUrl = getSetDetailMetadataImageCandidateUrl(catalogSetDetail);
  const imageType = getMetadataImageMimeType(imageUrl);

  return {
    url: imageUrl,
    secureUrl: imageUrl,
    alt,
    width: SET_DETAIL_OG_IMAGE_WIDTH,
    height: SET_DETAIL_OG_IMAGE_HEIGHT,
    ...(imageType ? { type: imageType } : {}),
  };
}

function getCatalogSetDisplayTitle(
  catalogSetDetail: Pick<CatalogSetDetail, 'displayTitle' | 'name'>,
): string {
  return catalogSetDetail.displayTitle?.trim() || catalogSetDetail.name;
}

function shouldLogSetDetailOgImageDebug(): boolean {
  return process.env['DEBUG_SET_OG_IMAGE']?.trim().toLowerCase() === 'true';
}

export async function resolveSetDetailOgImageDebugInfo({
  fetchFn = fetch,
  imageUrl,
}: {
  fetchFn?: typeof fetch;
  imageUrl: string;
}): Promise<{
  imageUrl: string;
  ok: boolean;
  status?: number;
}> {
  try {
    const response = await fetchFn(imageUrl, {
      method: 'HEAD',
      cache: 'no-store',
    });

    return {
      imageUrl,
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return {
      imageUrl,
      ok: false,
    };
  }
}

async function logSetDetailOgImageDebug(imageUrl: string): Promise<void> {
  if (!shouldLogSetDetailOgImageDebug()) {
    return;
  }

  const debugInfo = await resolveSetDetailOgImageDebugInfo({ imageUrl });

  console.warn('[set-detail-og-image]', debugInfo);
}

function getReliableDiscountPercentage(
  pricePanelSnapshot?: Pick<
    PricePanelSnapshot,
    'deltaMinor' | 'referencePriceMinor'
  >,
): number | undefined {
  if (
    typeof pricePanelSnapshot?.deltaMinor !== 'number' ||
    pricePanelSnapshot.deltaMinor >= 0 ||
    typeof pricePanelSnapshot.referencePriceMinor !== 'number' ||
    pricePanelSnapshot.referencePriceMinor <= 0
  ) {
    return undefined;
  }

  const percentage = Math.round(
    (Math.abs(pricePanelSnapshot.deltaMinor) /
      pricePanelSnapshot.referencePriceMinor) *
      100,
  );

  return percentage >= 5 ? percentage : undefined;
}

function getNextBestOfferPriceDeltaMinor(
  offers: readonly CatalogOffer[],
  bestOffer: CatalogOffer,
): number | undefined {
  const nextBestOffer = selectBestPurchasableOffer(offers).rankedOffers.find(
    (catalogOffer) => catalogOffer.url !== bestOffer.url,
  );
  const deltaMinor = nextBestOffer
    ? nextBestOffer.priceCents - bestOffer.priceCents
    : undefined;

  return typeof deltaMinor === 'number' && deltaMinor > 0
    ? deltaMinor
    : undefined;
}

function getLowestComparableCatalogOffer(
  offers: readonly CatalogOffer[],
  strategicTieBreakerOffer?: CatalogOffer | null,
): CatalogOffer | undefined {
  return (
    selectBestPurchasableOffer(offers, {
      strategicTieBreakerOffer: strategicTieBreakerOffer ?? null,
    }).offer ?? undefined
  );
}

function isLowestComparableCatalogOffer({
  catalogOffer,
  lowestOffer,
}: {
  catalogOffer: CatalogOffer;
  lowestOffer?: CatalogOffer;
}): boolean {
  if (!lowestOffer || catalogOffer.priceCents <= 0) {
    return false;
  }

  return (
    catalogOffer.currency === lowestOffer.currency &&
    catalogOffer.priceCents === lowestOffer.priceCents &&
    catalogOffer.url === lowestOffer.url &&
    (catalogOffer.availability === 'in_stock' ||
      catalogOffer.availability === 'unknown')
  );
}

function toCatalogRuntimeOffer(
  catalogOffer: CatalogOffer,
): CatalogRuntimeOffer {
  return {
    ...catalogOffer,
    merchantSlug:
      getCatalogOfferMerchantSlug(catalogOffer) ?? catalogOffer.merchant,
  };
}

function summarizeSetDetailCurrentOffersFromLiveOffers({
  liveOffers,
  setId,
}: {
  liveOffers: readonly CatalogOffer[];
  setId: string;
}): CatalogCurrentOfferSummary | undefined {
  if (!liveOffers.length) {
    return undefined;
  }

  return summarizeCatalogCurrentOffers({
    generatedOffers: [],
    liveOffers: liveOffers.map(toCatalogRuntimeOffer),
    setId,
  });
}

function isOfficialLegoCatalogOffer(catalogOffer: CatalogOffer): boolean {
  const merchantSlug = getCatalogOfferMerchantSlug(catalogOffer);

  return (
    merchantSlug === 'rakuten-lego-eu' ||
    merchantSlug === 'lego-nl' ||
    merchantSlug === 'lego' ||
    catalogOffer.merchant === 'lego' ||
    getCatalogOfferPublicMerchantName(catalogOffer) === 'LEGO®'
  );
}

function getOfficialLegoOfferReferencePriceMinor({
  catalogOffer,
  catalogOffers,
}: {
  catalogOffer?: CatalogOffer | null;
  catalogOffers?: readonly CatalogOffer[];
}): number | undefined {
  if (!catalogOffer?.currency || !catalogOffers?.length) {
    return undefined;
  }

  return [...catalogOffers]
    .filter(
      (candidate) =>
        isOfficialLegoCatalogOffer(candidate) &&
        candidate.currency === catalogOffer.currency &&
        candidate.priceCents > 0,
    )
    .sort(
      (left, right) =>
        right.checkedAt.localeCompare(left.checkedAt) ||
        right.priceCents - left.priceCents,
    )[0]?.priceCents;
}

function withCatalogOfferPublicMerchantName(
  catalogOffer: CatalogOffer,
): CatalogOffer {
  const merchantName = getCatalogOfferPublicMerchantName(catalogOffer);

  return merchantName === catalogOffer.merchantName
    ? catalogOffer
    : {
        ...catalogOffer,
        merchantName,
      };
}

export function buildSetDetailMetadata({
  allowIndexing,
  catalogSetDetail,
  currentOfferSummary,
  pricePanelSnapshot,
}: {
  allowIndexing?: boolean;
  catalogSetDetail: CatalogSetDetail;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  pricePanelSnapshot?: PricePanelSnapshot;
}): Metadata {
  const bestOffer = currentOfferSummary?.bestOffer;
  const bestOfferMerchantName = bestOffer
    ? getCatalogOfferPublicMerchantName(bestOffer)
    : undefined;
  const discountPercentage = getReliableDiscountPercentage(pricePanelSnapshot);
  const displayTitle = getCatalogSetDisplayTitle(catalogSetDetail);
  const metadataImage = getSetDetailMetadataImage(
    catalogSetDetail,
    `${displayTitle} setbeeld`,
  );
  const priceLabel = bestOffer
    ? formatMetadataPrice({
        currencyCode: bestOffer.currency,
        minorUnits: bestOffer.priceCents,
      })
    : undefined;
  const titleParts = [
    displayTitle,
    priceLabel ? `Nu ${priceLabel}` : undefined,
    discountPercentage ? `${discountPercentage}% korting` : undefined,
  ].filter(Boolean);
  const title = titleParts.join('. ');
  const nextBestPriceDeltaMinor =
    bestOffer && currentOfferSummary
      ? getNextBestOfferPriceDeltaMinor(currentOfferSummary.offers, bestOffer)
      : undefined;
  const fallbackDescriptionParts = [
    `LEGO ${catalogSetDetail.theme}-set`,
    catalogSetDetail.releaseYear
      ? `uit ${catalogSetDetail.releaseYear}`
      : undefined,
    catalogSetDetail.pieces > 0
      ? `met ${catalogSetDetail.pieces} stenen`
      : undefined,
  ].filter(Boolean);
  const description =
    bestOffer && typeof nextBestPriceDeltaMinor === 'number'
      ? `Laagste nagekeken prijs bij ${bestOfferMerchantName}. ${formatMetadataPrice(
          {
            currencyCode: bestOffer.currency,
            minorUnits: nextBestPriceDeltaMinor,
          },
        )} goedkoper dan de rest.`
      : bestOffer && (currentOfferSummary?.offers.length ?? 0) > 1
        ? `Nu verkrijgbaar bij ${currentOfferSummary?.offers.length} winkels. Laagste nagekeken prijs: ${priceLabel}.`
        : bestOffer
          ? `Laagste nagekeken prijs bij ${bestOfferMerchantName}: ${priceLabel}.`
          : `${fallbackDescriptionParts.join(' ')}. Prijs volgt nog; volg deze set zodra er een koopmoment is.`;
  const canonicalUrl = buildCanonicalUrl(
    buildSetDetailPath(catalogSetDetail.slug),
  );

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      images: [metadataImage],
      type: 'website',
      url: canonicalUrl,
    },
    robots: getSetDetailPageRobotsDirective({
      allowIndexing,
      slug: catalogSetDetail.slug,
    }),
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [metadataImage],
    },
  };
}

function formatOfferCheckedAt(checkedAt: string): string {
  return formatOfferCheckedAtCompact(checkedAt);
}

function formatOfferCheckedAtCompact(checkedAt: string): string {
  const checkedDate = new Date(checkedAt);

  if (Number.isNaN(checkedDate.getTime())) {
    return '';
  }

  const dayDifference =
    getCalendarDayValue(new Date()) - getCalendarDayValue(checkedDate);
  const timeLabel = formatOfferCheckedTime(checkedAt);

  if (dayDifference === 0) {
    return `Vandaag om ${timeLabel}`;
  }

  if (dayDifference === 1) {
    return `Gisteren om ${timeLabel}`;
  }

  if (dayDifference === 2) {
    return `Eergisteren om ${timeLabel}`;
  }

  return `${formatOfferCheckedDate(checkedAt)} om ${timeLabel}`;
}

function getSetDetailReleaseTimestamp({
  releaseDate,
  releaseDatePrecision,
  releaseYear,
}: {
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
}): number | undefined {
  const resolvedPrecision = resolveCatalogReleaseDatePrecision({
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  });
  const parsedReleaseDate = releaseDate
    ? Date.parse(`${releaseDate}T00:00:00Z`)
    : Number.NaN;

  if (
    (resolvedPrecision === 'day' || resolvedPrecision === 'month') &&
    Number.isFinite(parsedReleaseDate)
  ) {
    return parsedReleaseDate;
  }

  return undefined;
}

export function isCurrentOrRecentCatalogRelease({
  now = new Date(),
  releaseDate,
  releaseDatePrecision,
  releaseYear,
}: {
  now?: Date;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
}): boolean {
  const currentYear = now.getUTCFullYear();
  const resolvedReleaseYear = getCatalogReleaseYear({
    releaseDate,
    releaseYear,
  });

  if (resolvedReleaseYear === currentYear) {
    return true;
  }

  const releaseTimestamp = getSetDetailReleaseTimestamp({
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  });

  if (typeof releaseTimestamp !== 'number') {
    return false;
  }

  const lowerBound =
    now.getTime() - SET_DETAIL_RECENT_RELEASE_LOOKBACK_DAYS * 86_400_000;
  const upperBound =
    now.getTime() + SET_DETAIL_RECENT_RELEASE_LOOKAHEAD_DAYS * 86_400_000;

  return releaseTimestamp >= lowerBound && releaseTimestamp <= upperBound;
}

export function resolveSetDetailAvailabilityFallbackState({
  hasInStockOffer,
  now = new Date(),
  primaryOfferAvailability,
  releaseDate,
  releaseDatePrecision,
  releaseYear,
  setStatus,
}: {
  hasInStockOffer: boolean;
  now?: Date;
  primaryOfferAvailability: {
    primarySeedCount: number;
    validPrimaryOfferCount: number;
  };
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
  setStatus?: CatalogSetStatus;
}): SetDetailAvailabilityFallbackState {
  const hasExplicitRetiredLifecycle = setStatus === 'retired';

  if (
    hasExplicitRetiredLifecycle &&
    !hasInStockOffer &&
    primaryOfferAvailability.validPrimaryOfferCount === 0
  ) {
    return 'retired';
  }

  const hasTrackedOfferGap =
    primaryOfferAvailability.primarySeedCount > 0 &&
    primaryOfferAvailability.validPrimaryOfferCount === 0 &&
    !hasInStockOffer;

  if (!hasTrackedOfferGap) {
    return 'available';
  }

  return isCurrentOrRecentCatalogRelease({
    now,
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  })
    ? 'no_current_price'
    : 'no_current_stock';
}

function getOfferStockLabel(
  availability: CatalogOffer['availability'],
): string {
  if (availability === 'in_stock') {
    return 'Op voorraad';
  }

  if (availability === 'out_of_stock') {
    return 'Uitverkocht';
  }

  return 'Voorraad onbekend';
}

function buildMerchantCoverageLabel(
  merchantCount?: number,
): string | undefined {
  if (typeof merchantCount !== 'number' || merchantCount <= 0) {
    return undefined;
  }

  return `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`;
}

function buildOfferSummaryLabel({
  merchantCount,
  observedAt,
}: {
  merchantCount?: number;
  observedAt?: string;
}): string | undefined {
  const parts = [
    buildMerchantCoverageLabel(merchantCount),
    observedAt ? formatOfferCheckedAtCompact(observedAt) : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function buildBestOfferRankingLabel({
  availability,
  currencyCode,
  lowestPriceDeltaMinor,
  merchantCount,
  nextBestPriceDeltaMinor,
}: {
  availability: CatalogOffer['availability'];
  currencyCode: string;
  lowestPriceDeltaMinor?: number;
  merchantCount?: number;
  nextBestPriceDeltaMinor?: number;
}): string {
  if (typeof lowestPriceDeltaMinor === 'number' && lowestPriceDeltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: lowestPriceDeltaMinor,
    })} boven laagste prijs`;
  }

  if (
    typeof nextBestPriceDeltaMinor === 'number' &&
    nextBestPriceDeltaMinor > 0
  ) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: nextBestPriceDeltaMinor,
    })} goedkoper dan de rest`;
  }

  if (typeof merchantCount === 'number' && merchantCount <= 1) {
    return availability === 'in_stock'
      ? 'Enige nagekeken prijs op voorraad.'
      : 'Enige nagekeken prijs nu.';
  }

  if (availability === 'in_stock') {
    return 'Laagste nagekeken prijs op voorraad.';
  }

  if (availability === 'unknown') {
    return 'Laagste nagekeken prijs, voorraad nog onzeker.';
  }

  return 'Laagste nagekeken prijs, nu uitverkocht.';
}

function buildOfferRankingLabel({
  bestOffer,
  catalogOffer,
  lowestOffer,
}: {
  bestOffer?: CatalogOffer | null;
  catalogOffer: CatalogOffer;
  lowestOffer?: CatalogOffer;
}): string | undefined {
  if (!bestOffer) {
    return undefined;
  }

  if (
    lowestOffer?.url === catalogOffer.url &&
    bestOffer.url !== catalogOffer.url
  ) {
    return 'Laagste prijs';
  }

  if (bestOffer.url === catalogOffer.url) {
    if (lowestOffer && lowestOffer.url !== catalogOffer.url) {
      const lowestPriceDeltaMinor =
        catalogOffer.priceCents - lowestOffer.priceCents;

      if (lowestPriceDeltaMinor > 0) {
        return `${formatPriceMinor({
          currencyCode: catalogOffer.currency,
          minorUnits: lowestPriceDeltaMinor,
        })} boven laagste prijs`;
      }
    }

    return bestOffer.availability === 'in_stock'
      ? 'Laagste prijs op voorraad'
      : 'Laagste nagekeken prijs';
  }

  const comparisonOffer = lowestOffer ?? bestOffer;
  const priceDeltaMinor = catalogOffer.priceCents - comparisonOffer.priceCents;

  if (priceDeltaMinor < 0) {
    const lowerPriceLabel = formatPriceMinor({
      currencyCode: catalogOffer.currency,
      minorUnits: Math.abs(priceDeltaMinor),
    });

    if (catalogOffer.availability === 'out_of_stock') {
      return `${lowerPriceLabel} lager, maar uitverkocht`;
    }

    if (catalogOffer.availability === 'unknown') {
      return `${lowerPriceLabel} lager, maar voorraad onbekend`;
    }

    return `${lowerPriceLabel} lager, maar niet de beste keuze nu`;
  }

  if (priceDeltaMinor === 0) {
    return comparisonOffer.url === catalogOffer.url
      ? 'Laagste prijs'
      : 'Zelfde prijs als de beste optie';
  }

  return `${formatPriceMinor({
    currencyCode: catalogOffer.currency,
    minorUnits: priceDeltaMinor,
  })} hoger dan de beste optie`;
}

type SetDetailDealVerdict = Omit<
  ReturnType<typeof buildSetDealVerdict>,
  'label'
> & {
  label: string;
};

function getHeroDealDecisionTone(
  state: HeroDealPresentation['state'],
): CatalogSetDetailVerdict['tone'] {
  switch (state) {
    case 'exceptional_deal':
    case 'strong_deal':
    case 'good_deal':
      return 'positive';
    case 'wait':
      return 'warning';
    case 'market_price':
      return 'info';
    case 'no_reliable_offer':
    case 'price_building':
      return 'neutral';
  }
}

function getHeroMerchantCtaLabel({
  merchantName,
  presentation,
}: {
  merchantName: string;
  presentation: HeroDealPresentation;
}): string {
  switch (presentation.merchantCtaIntent) {
    case 'availability_check':
      return `Bekijk voorraad bij ${merchantName}`;
    case 'deal':
      return `Bekijk deal bij ${merchantName}`;
    case 'price_check':
    default:
      return `Bekijk prijs bij ${merchantName}`;
  }
}

function getHeroPrimaryMerchantCta({
  ctaHref,
  merchantName,
  presentation,
}: {
  ctaHref: string;
  merchantName: string;
  presentation: HeroDealPresentation;
}):
  | Pick<CatalogSetDetailBestDeal, 'ctaHref' | 'ctaLabel' | 'ctaTone'>
  | Record<string, never> {
  const shouldShowMerchantCta =
    presentation.primaryAction === 'merchant' ||
    presentation.secondaryAction === 'merchant' ||
    presentation.hasPurchasableOffer;

  if (!shouldShowMerchantCta) {
    return {};
  }

  return {
    ctaHref,
    ctaLabel: getHeroMerchantCtaLabel({ merchantName, presentation }),
    ctaTone: presentation.primaryAction === 'merchant' ? 'accent' : 'secondary',
  };
}

function getHeroMerchantClaim({
  isBestCurrentOffer,
  presentation,
}: {
  isBestCurrentOffer: boolean;
  presentation: HeroDealPresentation;
}): CatalogMerchantClaim {
  if (presentation.merchantCtaIntent === 'availability_check') {
    return 'availability';
  }

  return isBestCurrentOffer ? 'lowest-current' : 'selected-price';
}

function buildBestDeal({
  catalogOffer,
  catalogOffers,
  decisionPresentation,
  dealVerdict,
  merchantCount,
  setId,
  pricePanelSnapshot,
  theme,
}: {
  catalogOffer?: CatalogOffer | null;
  catalogOffers?: readonly CatalogOffer[];
  decisionPresentation: ReturnType<typeof buildSetDecisionPresentation>;
  dealVerdict: SetDetailDealVerdict;
  merchantCount?: number;
  setId: string;
  pricePanelSnapshot?: PricePanelSnapshot;
  theme: string;
}): CatalogSetDetailBestDeal | undefined {
  if (!catalogOffer && !pricePanelSnapshot) {
    return undefined;
  }

  if (!catalogOffer && pricePanelSnapshot) {
    const effectiveMerchantCount =
      merchantCount ?? pricePanelSnapshot.merchantCount;
    const coverageLabel = buildMerchantCoverageLabel(effectiveMerchantCount);
    const heroDealPresentation = getHeroDealPresentation({
      currencyCode: pricePanelSnapshot.currencyCode,
      currentPriceMinor: pricePanelSnapshot.headlinePriceMinor,
      hasMerchantOffer: false,
      merchantCount: effectiveMerchantCount,
      observedAt: pricePanelSnapshot.observedAt,
      referencePriceMinor: pricePanelSnapshot.referencePriceMinor,
    });

    return {
      checkedLabel: formatOfferCheckedAtCompact(pricePanelSnapshot.observedAt),
      coverageLabel,
      decisionHelper: heroDealPresentation.advice,
      decisionLabel: heroDealPresentation.title,
      decisionTone: getHeroDealDecisionTone(heroDealPresentation.state),
      merchantLabel:
        heroDealPresentation.state === 'no_reliable_offer' ||
        heroDealPresentation.state === 'price_building'
          ? decisionPresentation.noOfferTitle
          : 'Prijs gezien, klikroute volgt',
      price: formatPriceMinor({
        currencyCode: pricePanelSnapshot.currencyCode,
        minorUnits: pricePanelSnapshot.headlinePriceMinor,
      }),
      rankingLabel:
        heroDealPresentation.evidence[0] ??
        ([pricePanelSnapshot.lowestAvailabilityLabel, coverageLabel]
          .filter(Boolean)
          .join(' · ') ||
          undefined),
      stockLabel:
        pricePanelSnapshot.lowestAvailabilityLabel ?? 'Prijs wordt gevolgd',
    };
  }

  if (!catalogOffer) {
    return undefined;
  }

  const merchantSlug = getCatalogOfferMerchantSlug(catalogOffer);
  const merchantName = getCatalogOfferPublicMerchantName(catalogOffer);
  const effectiveMerchantCount = merchantCount ?? catalogOffers?.length ?? 1;
  const lowestComparableOffer = getLowestComparableCatalogOffer(
    catalogOffers ?? [catalogOffer],
    catalogOffer,
  );
  const lowestPriceDeltaMinor =
    lowestComparableOffer && lowestComparableOffer.url !== catalogOffer.url
      ? catalogOffer.priceCents - lowestComparableOffer.priceCents
      : undefined;
  const isBestCurrentOffer =
    !lowestComparableOffer ||
    lowestComparableOffer.url === catalogOffer.url ||
    catalogOffer.priceCents <= lowestComparableOffer.priceCents;
  const nextBestPriceDeltaMinor = getNextBestOfferPriceDeltaMinor(
    catalogOffers ?? [catalogOffer],
    catalogOffer,
  );
  const heroDealPresentation = getHeroDealPresentation({
    availability: catalogOffer.availability,
    currencyCode: catalogOffer.currency,
    currentPriceMinor: catalogOffer.priceCents,
    hasMerchantOffer: Boolean(catalogOffer.url),
    isBestCurrentOffer,
    isTrustedMerchant: true,
    legoOfferPriceMinor: getOfficialLegoOfferReferencePriceMinor({
      catalogOffer,
      catalogOffers,
    }),
    merchantCount: effectiveMerchantCount,
    observedAt: catalogOffer.checkedAt,
    referencePriceMinor: pricePanelSnapshot?.referencePriceMinor,
  });

  return {
    affiliateNote:
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
    ...getHeroPrimaryMerchantCta({
      ctaHref: catalogOffer.url,
      merchantName,
      presentation: heroDealPresentation,
    }),
    coverageLabel: buildMerchantCoverageLabel(effectiveMerchantCount),
    decisionHelper: heroDealPresentation.advice,
    decisionLabel: heroDealPresentation.title,
    decisionTone: getHeroDealDecisionTone(heroDealPresentation.state),
    evidence: heroDealPresentation.evidence,
    merchantLabel: merchantName,
    merchantName,
    merchantPresentation: buildCatalogMerchantPresentation({
      claim: getHeroMerchantClaim({
        isBestCurrentOffer,
        presentation: heroDealPresentation,
      }),
      merchantName,
      merchantSlug,
    }),
    merchantSlug,
    price: formatOfferPrice(catalogOffer),
    rankingLabel:
      heroDealPresentation.evidence[0] ??
      buildBestOfferRankingLabel({
        availability: catalogOffer.availability,
        currencyCode: catalogOffer.currency,
        lowestPriceDeltaMinor,
        merchantCount,
        nextBestPriceDeltaMinor,
      }),
    stockLabel: getOfferStockLabel(catalogOffer.availability),
    trackingEvent: {
      event: 'offer_click',
      properties: {
        merchantCount: effectiveMerchantCount,
        merchantName,
        merchantSlug,
        offerPlacement: 'best_offer',
        offerRole: 'best',
        pageSurface: 'set_detail',
        priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
        rankPosition: 1,
        setId,
        theme,
      },
    },
  };
}

function buildOfferList(
  catalogOffers: readonly CatalogOffer[],
  {
    dealVerdict,
    merchantCount,
    setId,
    theme,
  }: {
    dealVerdict: {
      tone?: 'info' | 'neutral' | 'positive' | 'warning';
    };
    merchantCount?: number;
    setId: string;
    theme: string;
  },
  bestOffer?: CatalogOffer | null,
): CatalogSetDetailOfferItem[] {
  const lowestOffer = getLowestComparableCatalogOffer(catalogOffers, bestOffer);

  return sortCatalogOffers(
    dedupeCatalogOffersByPublicMerchant(catalogOffers),
  ).map((catalogOffer, index) => {
    const merchantName = getCatalogOfferPublicMerchantName(catalogOffer);
    const isLowestCurrentPrice = isLowestComparableCatalogOffer({
      catalogOffer,
      lowestOffer,
    });

    return {
      checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
      ctaHref: catalogOffer.url,
      ctaLabel: `Bekijk bij ${merchantName}`,
      isBest: isLowestCurrentPrice,
      merchantLabel: merchantName,
      merchantSlug: getCatalogOfferMerchantSlug(catalogOffer),
      price: formatOfferPrice(catalogOffer),
      rankingLabel: buildOfferRankingLabel({
        bestOffer,
        catalogOffer,
        lowestOffer,
      }),
      stockLabel: getOfferStockLabel(catalogOffer.availability),
      trackingEvent: {
        event: 'offer_click',
        properties: {
          merchantCount,
          merchantName,
          merchantSlug: getCatalogOfferMerchantSlug(catalogOffer),
          offerPlacement: 'comparison_row',
          offerRole: isLowestCurrentPrice ? 'best' : 'alternative',
          pageSurface: 'set_detail',
          priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
          rankPosition: index + 1,
          setId,
          theme,
        },
      },
    };
  });
}

function buildTrustSignals({
  bestOffer,
  merchantCount,
  observedAt,
}: {
  bestOffer?: CatalogOffer | null;
  merchantCount?: number;
  observedAt?: string;
}): CatalogSetDetailTrustSignal[] {
  return [
    ...(bestOffer || observedAt
      ? [
          {
            label: 'Laatst nagekeken',
            value: formatOfferCheckedAt(
              bestOffer?.checkedAt ?? observedAt ?? '',
            ),
          },
        ]
      : []),
    ...(typeof merchantCount === 'number'
      ? [
          {
            label: 'Winkels nagekeken',
            value: `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`,
          },
        ]
      : []),
  ];
}

function buildTrackedAvailabilityFallbackBestDeal({
  checkedAt,
  primarySeedCount,
  state,
}: {
  checkedAt?: string;
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailBestDeal {
  const sharedFields = {
    checkedLabel: checkedAt
      ? formatOfferCheckedAtCompact(checkedAt)
      : 'Recent gecontroleerd',
    coverageLabel: buildMerchantCoverageLabel(primarySeedCount),
  };

  if (state === 'retired') {
    return {
      ...sharedFields,
      decisionHelper:
        'Bij de vaste winkels zien we nu geen nieuwe voorraad meer. Deze set lijkt uit productie en duikt vooral nog op via losse restvoorraad.',
      decisionLabel: 'Uit productie',
      decisionTone: 'neutral' as const,
      merchantLabel: 'Niet meer verkrijgbaar',
      price: 'Niet meer verkrijgbaar',
      stockLabel: 'Soms nog tweedehands te vinden',
    };
  }

  if (state === 'no_current_price') {
    return {
      ...sharedFields,
      decisionHelper:
        'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
      decisionLabel: 'Nog geen deal',
      decisionTone: 'warning' as const,
      merchantLabel: 'Prijsbeeld bouwt nog op',
      price: 'Nog geen actuele prijs',
      stockLabel: 'Prijsbeeld bouwt nog op',
    };
  }

  return {
    ...sharedFields,
    decisionHelper:
      'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    decisionLabel: 'Geen actuele voorraad gevonden',
    decisionTone: 'neutral' as const,
    merchantLabel: 'Geen actuele voorraad gevonden',
    price: 'Geen actuele voorraad gevonden',
    stockLabel: 'Geen actuele voorraad',
  };
}

function buildTrackedAvailabilityFallbackDealVerdict({
  state,
}: {
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailVerdict {
  if (state === 'retired') {
    return {
      explanation:
        'Bij de vaste winkels zien we nu geen nieuwe voorraad meer. Deze set lijkt uit productie en vooral nog incidenteel vindbaar.',
      label: 'Niet meer verkrijgbaar',
      tone: 'neutral' as const,
    };
  }

  if (state === 'no_current_price') {
    return {
      explanation:
        'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.',
      label: 'Nog geen actuele prijs',
      tone: 'neutral' as const,
    };
  }

  return {
    explanation:
      'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    label: 'Geen actuele voorraad gevonden',
    tone: 'neutral' as const,
  };
}

function buildTrackedAvailabilityFallbackSupportItems({
  primarySeedCount,
  state,
}: {
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailSupportItem[] {
  return [
    {
      id: 'availability-primary-shops',
      text:
        state === 'no_current_price'
          ? 'We volgen deze set, maar hebben op dit moment nog geen actuele voorraad bij de winkels die Brickhunt controleert.'
          : state === 'retired'
            ? 'Bij de vaste winkels zien we nu geen nieuwe voorraad meer.'
            : 'Bij de winkels die Brickhunt volgt zien we nu geen nieuwe voorraad.',
    },
    ...(primarySeedCount > 0
      ? [
          {
            id: 'availability-merchant-coverage',
            text: `${primarySeedCount} winkel${primarySeedCount === 1 ? '' : 's'} nagekeken.`,
          },
        ]
      : []),
    ...(state === 'retired'
      ? [
          {
            id: 'availability-secondhand',
            text: 'Soms duikt hij nog op via tweedehands of losse restvoorraad.',
          },
        ]
      : []),
  ];
}

function buildTrackedAvailabilityFallbackTrustSignals({
  checkedAt,
  primarySeedCount,
  state,
}: {
  checkedAt?: string;
  primarySeedCount: number;
  state: Exclude<SetDetailAvailabilityFallbackState, 'available'>;
}): CatalogSetDetailTrustSignal[] {
  return [
    {
      label: 'Beschikbaarheid',
      value:
        state === 'no_current_price'
          ? 'Nog geen actuele voorraad'
          : state === 'retired'
            ? 'Niet meer verkrijgbaar'
            : 'Geen actuele voorraad gevonden',
    },
    ...(checkedAt
      ? [
          {
            label: 'Laatst nagekeken',
            value: formatOfferCheckedAt(checkedAt),
          },
        ]
      : []),
    ...(primarySeedCount > 0
      ? [
          {
            label: 'Winkels nagekeken',
            value: `${primarySeedCount} winkel${primarySeedCount === 1 ? '' : 's'} nagekeken`,
          },
        ]
      : []),
    ...(state === 'retired'
      ? [
          {
            label: 'Alternatief',
            value: 'Soms nog tweedehands te vinden',
          },
        ]
      : []),
  ];
}

export interface SetDetailInternalLinkBlock {
  id: 'same-theme';
  items: readonly CatalogFeatureSetListItem[];
  title: string;
}

export interface SetDetailDiscoveryLink {
  href: string;
  label: string;
}

function getSetDetailThemeKey(
  setCard: Pick<CatalogHomepageSetCard, 'publicTheme' | 'theme'>,
): string {
  return (
    setCard.publicTheme?.slug ??
    normalizeTheme(setCard.theme)?.key ??
    setCard.theme.toLowerCase()
  );
}

function getCollectionDiscoveryLink(slug: string): SetDetailDiscoveryLink {
  const config = getCatalogCollectionLandingPageConfig(slug);

  return {
    href: config?.canonicalPath ?? `/${slug}`,
    label: config?.h1 ?? slug,
  };
}

export function buildSetDetailCollectionDiscoveryLinks({
  bestPriceMinor,
  catalogSetDetail,
}: {
  bestPriceMinor?: number;
  catalogSetDetail: CatalogSetDetail;
}): SetDetailDiscoveryLink[] {
  const links: SetDetailDiscoveryLink[] = [
    getCollectionDiscoveryLink('nieuwe-lego-sets'),
  ];
  const themeKey = getSetDetailThemeKey(catalogSetDetail);
  const isAdultCollectorSet =
    (catalogSetDetail.recommendedAge ?? 0) >= 18 ||
    catalogSetDetail.pieces >= 1_000 ||
    ['architecture', 'ideas', 'icons', 'technic'].includes(themeKey);

  if (typeof bestPriceMinor === 'number' && bestPriceMinor > 0) {
    if (bestPriceMinor <= 5_000) {
      links.push(getCollectionDiscoveryLink('lego-sets-onder-50-euro'));
    }

    if (bestPriceMinor <= 10_000) {
      links.push(getCollectionDiscoveryLink('lego-sets-onder-100-euro'));
    }
  }

  if (themeKey === 'star-wars') {
    links.push({
      href: '/themes/star-wars',
      label: 'Star Wars thema',
    });
  }

  if (isAdultCollectorSet) {
    links.push(getCollectionDiscoveryLink('lego-voor-volwassenen'));
  }

  if (
    catalogSetDetail.setStatus === 'retiring_soon' ||
    catalogSetDetail.setStatus === 'retired'
  ) {
    links.push(getCollectionDiscoveryLink('laatste-kans-lego-sets'));
  }

  return links.filter(
    (link, index, allLinks) =>
      allLinks.findIndex((candidate) => candidate.href === link.href) === index,
  );
}

function formatSetNewsArticleDate(date: string): string {
  const parsedDate = Date.parse(`${date}T00:00:00Z`);

  if (!Number.isFinite(parsedDate)) {
    return date;
  }

  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'long',
    timeZone: BRICKHUNT_TIME_ZONE,
    year: 'numeric',
  }).format(new Date(parsedDate));
}

function getArticleThemeSlug(
  article: Pick<ContentArticleListItem, 'theme' | 'themeSlug'>,
): string {
  return article.themeSlug ?? normalizeTheme(article.theme)?.key ?? 'lego';
}

function buildValidSetDetailThemeHref(
  themeSlug?: string | null,
): string | undefined {
  const normalizedThemeSlug = themeSlug?.trim();

  return normalizedThemeSlug &&
    SET_DETAIL_THEME_SLUG_PATTERN.test(normalizedThemeSlug) &&
    !SET_DETAIL_HIDDEN_THEME_SLUGS.has(normalizedThemeSlug) &&
    isThemeVisible(normalizedThemeSlug)
    ? buildThemePath(normalizedThemeSlug)
    : undefined;
}

export function getSetDetailThemeHref({
  publicTheme,
  theme,
}: {
  publicTheme?: { slug?: string | null } | null;
  theme?: string | null;
}): string | undefined {
  return (
    buildValidSetDetailThemeHref(publicTheme?.slug) ??
    buildValidSetDetailThemeHref(normalizeTheme(theme ?? undefined)?.key)
  );
}

export function SetNewsRail({
  articles,
}: {
  articles: readonly ContentArticleListItem[];
}) {
  if (!articles.length) {
    return null;
  }

  return (
    <section aria-labelledby="set-news-title" className={styles.setNewsRail}>
      <div className={styles.setNewsHeader}>
        <h2 className={styles.setNewsTitle} id="set-news-title">
          Laatste updates
        </h2>
      </div>
      <div className={styles.setNewsGrid}>
        {articles.slice(0, SET_NEWS_RAIL_LIMIT).map((article) => (
          <a
            className={styles.setNewsCard}
            href={buildArticlePath(article.slug, getArticleThemeSlug(article))}
            key={article.slug}
          >
            <time className={styles.setNewsDate} dateTime={article.date}>
              {formatSetNewsArticleDate(article.date)}
            </time>
            <h3 className={styles.setNewsCardTitle}>{article.title}</h3>
            <p className={styles.setNewsDescription}>{article.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export function buildSetDetailComparableRailStyle(
  catalogSetDetail: CatalogSetDetail,
): React.CSSProperties | undefined {
  const backgroundColor =
    catalogSetDetail.publicTheme?.surfaceColor ??
    catalogSetDetail.publicTheme?.accentColor;
  const surfaceForeground = getAccessibleForegroundColor(backgroundColor);

  if (!backgroundColor) {
    return undefined;
  }

  const railStyle: React.CSSProperties & Record<string, string> = {};

  if (backgroundColor) {
    railStyle['--article-theme-surface'] = backgroundColor;
  }

  if (surfaceForeground) {
    railStyle['--article-theme-surface-text'] = surfaceForeground;
  }

  return railStyle;
}

export function SetDetailInternalLinkRails({
  blocks,
  catalogSetDetail,
}: {
  blocks: readonly SetDetailInternalLinkBlock[];
  catalogSetDetail: CatalogSetDetail;
}) {
  if (!blocks.length) {
    return null;
  }

  const displayTitle = getCatalogSetDisplayTitle(catalogSetDetail);
  const themeHref = getSetDetailThemeHref(catalogSetDetail);

  return (
    <>
      {blocks.map((block) => (
        <CatalogFeatureSetList
          className={styles.comparableSetsRail}
          description={`Meer ${catalogSetDetail.theme}-sets die logisch naast ${displayTitle} staan.`}
          headingActionLabel={`Bekijk alle ${catalogSetDetail.theme}-sets`}
          headingHref={themeHref}
          key={block.id}
          railLayoutMode="default"
          sectionId="same-theme-sets"
          setCards={block.items.slice(0, SET_DETAIL_INTERNAL_LINK_RAIL_LIMIT)}
          signalText={`${block.items.length} sets uit ${catalogSetDetail.theme}`}
          style={buildSetDetailComparableRailStyle(catalogSetDetail)}
          surfaceVariant="themed"
          tone="default"
          title={block.title}
        />
      ))}
    </>
  );
}

export function SetDetailCollectionDiscoveryLinks({
  links,
}: {
  links: readonly SetDetailDiscoveryLink[];
}) {
  if (!links.length) {
    return null;
  }

  return (
    <section
      aria-labelledby="set-discovery-links-title"
      className={styles.discoveryLinks}
    >
      <div className={styles.discoveryLinksHeader}>
        <h2
          className={styles.discoveryLinksTitle}
          id="set-discovery-links-title"
        >
          Verder ontdekken
        </h2>
      </div>
      <div className={styles.discoveryLinksList}>
        {links.map((link) => (
          <a className={styles.discoveryLink} href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}

export async function generateStaticParams() {
  const startedAt = Date.now();
  const staticParamsLimit = getSetDetailStaticParamsLimit();
  const [allSetSlugs, commerceCandidateSetIds, recentSetCards] =
    await Promise.all([
      listCatalogSetSlugs(),
      listCatalogCurrentOfferCandidateSetIds({
        limit: staticParamsLimit,
      }),
      listCatalogSetCards({
        limit: staticParamsLimit,
      }),
    ]);
  const commerceCandidateSetCards = commerceCandidateSetIds.length
    ? await listCatalogSetCardsByIds({
        canonicalIds: commerceCandidateSetIds,
      })
    : [];
  const knownSlugSet = new Set(allSetSlugs);
  const prerenderSlugs = [
    ...new Set(
      [...commerceCandidateSetCards, ...recentSetCards]
        .map((setCard) => setCard.slug)
        .filter((slug) => knownSlugSet.has(slug)),
    ),
  ].slice(0, staticParamsLimit);
  const fallbackSlugs = prerenderSlugs.length
    ? prerenderSlugs
    : allSetSlugs.slice(0, staticParamsLimit);

  console.info('[set-detail-static-params]', {
    candidate_set_count: commerceCandidateSetIds.length,
    duration_ms: Date.now() - startedAt,
    prerendered_set_count: fallbackSlugs.length,
    recent_set_count: recentSetCards.length,
    skipped_static_set_count: Math.max(
      allSetSlugs.length - fallbackSlugs.length,
      0,
    ),
    total_set_count: allSetSlugs.length,
  });

  return fallbackSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const catalogSetDetail = await measureSetPageFetch({
    label: 'metadata:set-detail',
    slug,
    load: () => getRequestCachedCatalogSetBySlug(slug),
  });

  if (!catalogSetDetail) {
    return {};
  }

  const metadataCurrentOfferSummary = await measureSetPageFetch({
    label: 'metadata:current-offer-summary',
    slug,
    load: () =>
      getRequestCachedSnapshotCurrentOfferSummaryBySetId(catalogSetDetail.id),
  });

  const metadata = measureSetPageSync({
    label: 'metadata:build',
    slug,
    load: () =>
      buildSetDetailMetadata({
        catalogSetDetail,
        currentOfferSummary: metadataCurrentOfferSummary,
        pricePanelSnapshot: getPricePanelSnapshot(catalogSetDetail.id),
      }),
  });

  const metadataImage = Array.isArray(metadata.openGraph?.images)
    ? metadata.openGraph.images[0]
    : metadata.openGraph?.images;
  const metadataImageUrl =
    typeof metadataImage === 'string' || metadataImage instanceof URL
      ? metadataImage.toString()
      : metadataImage?.url?.toString();

  if (metadataImageUrl) {
    await logSetDetailOgImageDebug(metadataImageUrl);
  }

  return metadata;
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const serverRenderStartedAt = Date.now();
  const { slug } = await params;
  const catalogSetDetail = await measureSetPageFetch({
    label: 'set-detail',
    slug,
    load: () => getRequestCachedCatalogSetBySlug(slug),
  });

  if (!catalogSetDetail) {
    notFound();
  }

  const liveSetDetailOffers = await measureSetPageFetch({
    label: 'offers',
    slug,
    load: () => getRequestCachedSetDetailLiveOffersBySetId(catalogSetDetail.id),
  });
  // Only live validated offers count as current public pricing.
  const localizedSetDetailOffers = dedupeCatalogOffersByPublicMerchant(
    liveSetDetailOffers.filter(isEuroCatalogOffer),
  );
  const hasInStockOffer = localizedSetDetailOffers.some(
    (catalogOffer) => catalogOffer.availability === 'in_stock',
  );
  const primaryOfferAvailability = hasInStockOffer
    ? {
        primaryMerchantCount: 0,
        primarySeedCount: 0,
        validPrimaryOfferCount: 1,
      }
    : await measureSetPageFetch({
        label: 'offer-availability',
        slug,
        load: () =>
          loadSetDetailPrimaryOfferAvailability({
            setId: catalogSetDetail.id,
          }),
      });
  const availabilityFallbackState = resolveSetDetailAvailabilityFallbackState({
    hasInStockOffer,
    primaryOfferAvailability,
    releaseDate: catalogSetDetail.releaseDate,
    releaseDatePrecision: catalogSetDetail.releaseDatePrecision,
    releaseYear: catalogSetDetail.releaseYear,
    setStatus: catalogSetDetail.setStatus,
  });
  const hasTrackedAvailabilityFallback =
    availabilityFallbackState !== 'available';
  const snapshotCurrentOfferSummary = await measureSetPageFetch({
    label: 'current-offer-summary',
    slug,
    load: () =>
      getRequestCachedSnapshotCurrentOfferSummaryBySetId(catalogSetDetail.id),
  });
  const sourceCurrentOfferSummary =
    snapshotCurrentOfferSummary ??
    summarizeSetDetailCurrentOffersFromLiveOffers({
      liveOffers: localizedSetDetailOffers,
      setId: catalogSetDetail.id,
    });
  const offerRailBestOffer = selectBestPurchasableOffer(
    localizedSetDetailOffers,
    {
      strategicTieBreakerOffer: sourceCurrentOfferSummary?.bestOffer ?? null,
    },
  ).offer;
  const currentOfferSummary: CatalogCurrentOfferSummary | undefined =
    offerRailBestOffer
      ? {
          bestOffer:
            offerRailBestOffer as CatalogCurrentOfferSummary['bestOffer'],
          offers:
            localizedSetDetailOffers as CatalogCurrentOfferSummary['offers'],
          setId: catalogSetDetail.id,
        }
      : sourceCurrentOfferSummary;
  const reviewPayload = await measureSetPageFetch({
    label: 'reviews',
    slug,
    load: () =>
      getRequestCachedCatalogSetReviewsPublicPayload({
        setId: catalogSetDetail.id,
        slug: catalogSetDetail.slug,
      }),
  });
  const bestOffer = currentOfferSummary?.bestOffer;
  const pricePanelSnapshot = getPricePanelSnapshot(catalogSetDetail.id);
  const hasLiveCurrentOffer =
    Boolean(bestOffer) && !hasTrackedAvailabilityFallback;
  const needsCurrentDealSignal =
    hasLiveCurrentOffer &&
    (typeof pricePanelSnapshot?.deltaMinor !== 'number' ||
      pricePanelSnapshot.headlinePriceMinor !== bestOffer?.priceCents);
  const catalogDiscoverySignal = needsCurrentDealSignal
    ? await measureSetPageFetch({
        label: 'deal-signal',
        slug,
        load: () =>
          loadSetDetailDiscoverySignal({
            setId: catalogSetDetail.id,
          }),
      })
    : undefined;
  const effectiveDealSnapshotResult = buildEffectiveSetDealSnapshot({
    currentOffer: bestOffer
      ? {
          availabilityLabel: getOfferStockLabel(bestOffer.availability),
          condition: bestOffer.condition,
          currencyCode: bestOffer.currency,
          merchantCount:
            localizedSetDetailOffers.length > 0
              ? localizedSetDetailOffers.length
              : undefined,
          merchantId: bestOffer.merchant,
          merchantName: getCatalogOfferPublicMerchantName(bestOffer),
          observedAt: bestOffer.checkedAt,
          priceMinor: bestOffer.priceCents,
          regionCode: bestOffer.market,
          setId: catalogSetDetail.id,
        }
      : undefined,
    discoveryInput: catalogDiscoverySignal
      ? {
          bestPriceMinor: catalogDiscoverySignal.bestPriceMinor,
          merchantCount: catalogDiscoverySignal.merchantCount,
          referenceDeltaMinor: catalogDiscoverySignal.referenceDeltaMinor,
        }
      : undefined,
    pricePanelSnapshot,
  });
  const effectiveDealPricePanelSnapshot = effectiveDealSnapshotResult.snapshot;
  const defaultDecisionPresentation = buildSetDecisionPresentation({
    hasCurrentOffer: hasLiveCurrentOffer,
    pricePanelSnapshot: effectiveDealPricePanelSnapshot,
    theme: catalogSetDetail.theme,
  });
  const defaultDealVerdict = buildSetDealVerdict(
    effectiveDealPricePanelSnapshot,
    {
      hasCurrentOffer: hasLiveCurrentOffer,
      theme: catalogSetDetail.theme,
    },
  );
  const currentDealPriceContext =
    currentOfferSummary && !hasTrackedAvailabilityFallback
      ? buildCurrentSetCardPriceContext({
          catalogDiscoverySignal,
          currentOfferSummary,
          pricePanelSnapshot: effectiveDealPricePanelSnapshot,
          theme: catalogSetDetail.theme,
        })
      : undefined;
  const effectiveDealVerdict =
    currentDealPriceContext?.decisionLabel &&
    currentDealPriceContext.decisionLabel !== defaultDealVerdict.label
      ? {
          ...defaultDealVerdict,
          label: currentDealPriceContext.decisionLabel,
          tone:
            currentDealPriceContext.decisionLabel === 'Goede deal' ||
            currentDealPriceContext.decisionLabel === 'Sterke deal' ||
            currentDealPriceContext.decisionLabel === 'Topdeal'
              ? 'positive'
              : defaultDealVerdict.tone,
        }
      : defaultDealVerdict;
  const dealVerdict: CatalogSetDetailVerdict = hasTrackedAvailabilityFallback
    ? buildTrackedAvailabilityFallbackDealVerdict({
        state: availabilityFallbackState,
      })
    : effectiveDealVerdict;
  const trackedMerchantCount = localizedSetDetailOffers.length;
  const unavailableCheckedAt =
    primaryOfferAvailability.latestPrimaryOfferCheckedAt ??
    pricePanelSnapshot?.observedAt;
  const unavailablePrimarySeedCount = primaryOfferAvailability.primarySeedCount;
  const analyticsPriceVerdict = hasTrackedAvailabilityFallback
    ? 'neutral'
    : getBrickhuntAnalyticsPriceVerdict(defaultDealVerdict.tone);
  const themeHref = getSetDetailThemeHref(catalogSetDetail);
  const canonicalUrl = buildCanonicalUrl(
    buildSetDetailPath(catalogSetDetail.slug),
  );
  const jsonLd = measureSetPageSync({
    label: 'structured-data',
    slug,
    load: () =>
      [
        buildSetProductJsonLd({
          canonicalUrl,
          catalogSetDetail,
          offers: hasTrackedAvailabilityFallback
            ? []
            : localizedSetDetailOffers.map(withCatalogOfferPublicMerchantName),
          reviewSummary: reviewPayload.summary,
          reviews: reviewPayload.reviews,
        }),
        buildSetBreadcrumbJsonLd({
          catalogSetDetail,
          themeUrl: themeHref,
        }),
      ].filter(
        (item): item is Exclude<typeof item, undefined> => item !== undefined,
      ),
  });
  const similarSetsRail = await withSetPageOptionalTimeout({
    fallback: null,
    label: 'similar-sets:rail',
    load: (signal) =>
      loadSetDetailSimilarSetsRail({
        bestPriceMinor:
          bestOffer?.priceCents ?? pricePanelSnapshot?.headlinePriceMinor,
        catalogSetDetail,
        signal,
        slug,
      }),
    slug,
    timeoutMs: SET_DETAIL_SIMILAR_RAIL_TIMEOUT_MS,
  });

  logSetPagePerf({
    details: {
      lcpImageCandidate:
        catalogSetDetail.primaryImage ?? catalogSetDetail.imageUrl,
      setId: catalogSetDetail.id,
    },
    durationMs: 0,
    label: 'price-history',
    slug,
    status: 'ok',
  });
  logSetPagePerf({
    details: {
      lcpImageCandidate:
        catalogSetDetail.primaryImage ?? catalogSetDetail.imageUrl,
      setId: catalogSetDetail.id,
    },
    durationMs: Date.now() - serverRenderStartedAt,
    label: 'server-render-total',
    slug,
    status: 'ok',
  });

  return (
    <ShellWeb>
      <JsonLdScript data={jsonLd} />
      <CatalogRecentlyViewedSetTracker setNum={catalogSetDetail.id} />
      <CatalogFeatureSetDetail
        bestDeal={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackBestDeal({
                checkedAt: unavailableCheckedAt,
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildBestDeal({
                catalogOffer: bestOffer,
                catalogOffers: localizedSetDetailOffers,
                decisionPresentation: defaultDecisionPresentation,
                dealVerdict: effectiveDealVerdict,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                setId: catalogSetDetail.id,
                pricePanelSnapshot: effectiveDealPricePanelSnapshot,
                theme: catalogSetDetail.theme,
              })
        }
        brickhuntValueItems={buildBrickhuntValueItems({
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
        })}
        catalogSetDetail={catalogSetDetail}
        dealSupportItems={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackSupportItems({
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildSetDecisionSupportItems({
                hasCurrentOffer: hasLiveCurrentOffer,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                pricePanelSnapshot: effectiveDealPricePanelSnapshot,
              })
        }
        dealVerdict={dealVerdict}
        heroCtaSideAction={
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount:
                trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
              pageSurface: 'set_detail',
              priceVerdict: analyticsPriceVerdict,
              sectionId: 'set-detail-hero',
              setId: catalogSetDetail.id,
              theme: catalogSetDetail.theme,
            }}
            appearance="hero-action"
            productIntent="price-alert"
            setId={catalogSetDetail.id}
            variant="inline"
          />
        }
        offerList={
          hasTrackedAvailabilityFallback
            ? []
            : buildOfferList(
                localizedSetDetailOffers,
                {
                  dealVerdict: defaultDealVerdict,
                  merchantCount:
                    trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                  setId: catalogSetDetail.id,
                  theme: catalogSetDetail.theme,
                },
                bestOffer,
              )
        }
        offerSummaryLabel={
          hasTrackedAvailabilityFallback
            ? undefined
            : buildOfferSummaryLabel({
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                observedAt:
                  bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
              })
        }
        ownershipActions={
          <>
            <CollectionFeatureOwnedToggle
              setId={catalogSetDetail.id}
              variant="compact"
            />
          </>
        }
        priceAlertAction={
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount:
                trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
              pageSurface: 'set_detail',
              priceVerdict: analyticsPriceVerdict,
              setId: catalogSetDetail.id,
              theme: catalogSetDetail.theme,
            }}
            productIntent="price-alert"
            setId={catalogSetDetail.id}
            variant="product"
          />
        }
        priceHistoryPanel={
          <PricingFeaturePriceHistory
            currentOffer={
              hasLiveCurrentOffer && bestOffer
                ? {
                    condition: bestOffer.condition,
                    currencyCode: bestOffer.currency,
                    merchantId: bestOffer.merchant,
                    observedAt: bestOffer.checkedAt,
                    priceMinor: bestOffer.priceCents,
                    regionCode: bestOffer.market,
                    setId: catalogSetDetail.id,
                  }
                : undefined
            }
            hasCurrentOffer={hasLiveCurrentOffer}
            merchantCount={
              trackedMerchantCount > 0 ? trackedMerchantCount : undefined
            }
            setId={catalogSetDetail.id}
            variant="set-detail"
          />
        }
        productReviewsSlot={
          <ReviewsFeatureSetReviews
            initialPayload={reviewPayload}
            setId={catalogSetDetail.id}
            setSlug={catalogSetDetail.slug}
          />
        }
        recentlyViewedRail={
          <CatalogFeatureRecentlyViewed currentSetNum={catalogSetDetail.id} />
        }
        reviewSummary={reviewPayload.summary}
        similarSetsRail={similarSetsRail}
        setNewsRail={
          <Suspense fallback={null}>
            <SetDetailNewsRailSlot setId={catalogSetDetail.id} slug={slug} />
          </Suspense>
        }
        themeDirectoryHref={buildWebPath(webPathnames.themes)}
        themeHref={themeHref}
        trustSignals={
          hasTrackedAvailabilityFallback
            ? buildTrackedAvailabilityFallbackTrustSignals({
                checkedAt: unavailableCheckedAt,
                primarySeedCount: unavailablePrimarySeedCount,
                state: availabilityFallbackState,
              })
            : buildTrustSignals({
                bestOffer,
                merchantCount:
                  trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
                observedAt:
                  bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
              })
        }
        followCopy={
          availabilityFallbackState === 'retired'
            ? 'Hou deze set op je lijst als je hem later nog eens wilt spotten.'
            : availabilityFallbackState === 'no_current_price'
              ? 'Zodra we actuele voorraad zien bij de winkels die Brickhunt controleert, zie je dat hier terug.'
              : availabilityFallbackState === 'no_current_stock'
                ? 'Zodra er weer nieuwe voorraad opduikt bij de winkels die Brickhunt volgt, zie je dat hier terug.'
                : defaultDecisionPresentation.followCopy
        }
        followTitle={
          availabilityFallbackState === 'retired'
            ? 'Soms nog tweedehands te vinden'
            : availabilityFallbackState === 'no_current_price'
              ? 'We volgen deze set'
              : availabilityFallbackState === 'no_current_stock'
                ? 'Volg deze set'
                : defaultDecisionPresentation.followTitle
        }
      />
    </ShellWeb>
  );
}

export async function loadSetDetailSimilarSetsRail({
  bestPriceMinor,
  catalogSetDetail,
  signal,
  slug,
}: {
  bestPriceMinor?: number;
  catalogSetDetail: CatalogSetDetail;
  signal: AbortSignal;
  slug: string;
}) {
  throwIfSimilarRailAborted(signal);

  logSimilarSetRailDebug({
    current_set_id: catalogSetDetail.id,
    current_set_slug: catalogSetDetail.slug,
    current_set_theme: catalogSetDetail.theme,
    label: 'input',
    page_slug: slug,
    reference_best_price_minor: bestPriceMinor,
  });

  const relatedThemeSnapshot = await measureSetPageFetch({
    label: 'similar-sets:snapshot',
    slug,
    load: () =>
      getCatalogSetDetailRelatedThemeSnapshot({
        setId: catalogSetDetail.id,
      }),
  });

  logSimilarSetRailDebug({
    candidate_count: relatedThemeSnapshot?.setCards.length ?? 0,
    candidate_sample:
      relatedThemeSnapshot?.setCards.slice(0, 5).map((setCard) => setCard.id) ??
      [],
    label: relatedThemeSnapshot ? 'snapshot' : 'snapshot-missing',
    page_slug: slug,
  });

  throwIfSimilarRailAborted(signal);

  throwIfSimilarRailAborted(signal);

  const internalLinkBlocks: SetDetailInternalLinkBlock[] = relatedThemeSnapshot
    ?.setCards.length
    ? [
        {
          id: 'same-theme',
          items: relatedThemeSnapshot.setCards.map((setCard) => ({
            ...setCard,
            ctaMode: 'default' as const,
          })),
          title: 'Meer uit dit thema',
        },
      ]
    : [];
  const discoveryLinks = buildSetDetailCollectionDiscoveryLinks({
    bestPriceMinor,
    catalogSetDetail,
  });

  logSimilarSetRailDebug({
    block_count: internalLinkBlocks.length,
    discovery_link_count: discoveryLinks.length,
    final_rendered_count: internalLinkBlocks.reduce(
      (count, block) => count + block.items.length,
      0,
    ),
    final_rendered_sample: internalLinkBlocks.flatMap((block) =>
      block.items.slice(0, 3).map((setCard) => setCard.id),
    ),
    label: 'rendered',
    page_slug: slug,
  });

  if (!internalLinkBlocks.length && !discoveryLinks.length) {
    return null;
  }

  return (
    <>
      <SetDetailInternalLinkRails
        blocks={internalLinkBlocks}
        catalogSetDetail={catalogSetDetail}
      />
      <SetDetailCollectionDiscoveryLinks links={discoveryLinks} />
    </>
  );
}

async function SetDetailNewsRailSlot({
  setId,
  slug,
}: {
  setId: string;
  slug: string;
}) {
  return withSetPageOptionalTimeout({
    fallback: null,
    label: 'articles:rail',
    load: () =>
      loadSetDetailNewsRail({
        setId,
        slug,
      }),
    slug,
  });
}

async function loadSetDetailNewsRail({
  setId,
  slug,
}: {
  setId: string;
  slug: string;
}) {
  const setNewsArticles = await measureSetPageFetch({
    label: 'articles',
    slug,
    load: () =>
      listPublishedArticlesByPrimarySetNumber({
        limit: SET_NEWS_RAIL_LIMIT,
        setNumber: setId,
      }),
  });

  return <SetNewsRail articles={setNewsArticles} />;
}
