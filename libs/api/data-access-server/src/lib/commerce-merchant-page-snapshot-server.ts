import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import type {
  CatalogCanonicalSet,
  CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import {
  buildCommerceMerchantPath,
  buildWebPath,
  type CommerceMerchantSeoPresentationProfile,
  resolveCommerceMerchantSeoPresentation,
  type CommerceMerchantSeoPresentation,
  webPathnames,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import { enrichCatalogSetsWithPresentationTitles } from './catalog-presentation-title-server';
import { revalidatePublicWeb } from './public-web-revalidation-server';

export const COMMERCE_MERCHANT_PAGE_SNAPSHOTS_TABLE =
  'commerce_merchant_page_snapshots';

const COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE =
  'commerce_current_offer_snapshots';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_MERCHANT_PROFILES_TABLE = 'commerce_merchant_profiles';
const BEST_DEAL_SNAPSHOT_LIMIT = 48;
const ONLY_AT_MERCHANT_SNAPSHOT_LIMIT = 24;
const MERCHANT_PAGE_SNAPSHOT_VERSION = 1;
const MERCHANT_PAGE_SNAPSHOT_SOURCE_VERSION = 'merchant_page_snapshot_v1';
const MERCHANT_PAGE_SNAPSHOT_ROW_PAGE_SIZE = 1000;
const DUTCH_REGION_CODE = 'NL';
const EURO_CURRENCY_CODE = 'EUR';
const NEW_OFFER_CONDITION = 'new';
const MERCHANT_PAGE_REVALIDATION_TAGS = ['merchants'] as const;

type CommerceMerchantPageSnapshotQuery<TRow> = PromiseLike<{
  data: TRow[] | null;
  error: unknown;
}> & {
  eq?: (
    column: string,
    value: unknown,
  ) => CommerceMerchantPageSnapshotQuery<TRow>;
  gt?: (
    column: string,
    value: unknown,
  ) => CommerceMerchantPageSnapshotQuery<TRow>;
  order?: (
    column: string,
    options?: { ascending?: boolean },
  ) => CommerceMerchantPageSnapshotQuery<TRow>;
  range?: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: TRow[] | null;
    error: unknown;
  }>;
  upsert?: (
    rows: readonly Record<string, unknown>[],
    options?: { onConflict?: string },
  ) => PromiseLike<{
    data: TRow[] | null;
    error: unknown;
  }>;
};

interface CommerceMerchantPageSnapshotSupabaseClient {
  from(table: string): {
    select(
      columns: string,
    ): CommerceMerchantPageSnapshotQuery<Record<string, unknown>>;
    upsert?(
      rows: readonly Record<string, unknown>[],
      options?: { onConflict?: string },
    ): PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: unknown;
    }>;
  };
}

interface CommerceMerchantPageSnapshotMerchantRow {
  affiliate_network: string | null;
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  slug: string;
  source_type: string;
  updated_at: string;
}

interface CommerceMerchantPageSnapshotProfileRow {
  brand_color: string | null;
  brand_text_color: string | null;
  canonical_path: string | null;
  display_name: string;
  favicon_url: string | null;
  internal_slug: string;
  is_public: boolean;
  logo_url: string | null;
  long_description: string | null;
  merchant_id: string;
  public_slug: string;
  seo_description: string | null;
  seo_title: string | null;
  short_description: string | null;
}

interface CommerceMerchantPageSnapshotCurrentOfferRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_merchant_id: string | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_offer_seed_id: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  comparable_offer_count: number | null;
  computed_at: string | null;
  condition: string;
  currency_code: string;
  next_best_price_minor: number | null;
  offer_count: number | null;
  offers: unknown;
  region_code: string;
  set_id: string;
}

interface CommerceMerchantPageSnapshotExistingRow {
  merchant_slug: string;
  snapshot: unknown;
}

export interface CommerceMerchantPageSnapshotProfile
  extends CommerceMerchantSeoPresentationProfile {
  displayName: string;
  internalSlug: string;
  isPublic: boolean;
  merchantId: string;
  publicSlug: string;
}

export interface CommerceMerchantPageSnapshotMerchant {
  affiliateNetwork?: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string;
  publicSlug: string;
  seoPresentation: CommerceMerchantSeoPresentation;
  slug: string;
  sourceType: 'direct' | 'affiliate' | 'marketplace';
  updatedAt: string;
}

export interface CommerceMerchantPageSnapshotDeal {
  checkedAt?: string;
  comparedMerchantCount: number;
  currencyCode: string;
  latestOfferId: string;
  merchant: CommerceMerchantPageSnapshotMerchant;
  nextBestMerchant?: CommerceMerchantPageSnapshotMerchant;
  nextBestPriceMinor?: number;
  offerSeedId: string;
  priceMinor: number;
  productUrl: string;
  savingsMinor?: number;
  savingsPercentage?: number;
  set: CatalogHomepageSetCard;
}

export interface CommerceMerchantPageSnapshotPayload {
  bestDealCount: number;
  bestDeals: readonly CommerceMerchantPageSnapshotDeal[];
  dealCount: number;
  lastFetchedAt?: string;
  merchant: CommerceMerchantPageSnapshotMerchant;
  offerCount: number;
  onlyAtMerchantDealCount: number;
  onlyAtMerchantDeals: readonly CommerceMerchantPageSnapshotDeal[];
  version: typeof MERCHANT_PAGE_SNAPSHOT_VERSION;
}

export interface CommerceMerchantPageSnapshotRecord {
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  snapshot: CommerceMerchantPageSnapshotPayload;
}

export interface CommerceMerchantPageSnapshotBuildResult {
  changedMerchantSlugs: readonly string[];
  dryRun: boolean;
  phaseTimings: Record<string, number>;
  revalidation?: Awaited<ReturnType<typeof revalidatePublicWeb>>;
  snapshots: readonly CommerceMerchantPageSnapshotRecord[];
  upsertedCount: number;
}

interface EligibleMerchantSnapshotOffer {
  checkedAt?: string;
  currencyCode: string;
  latestOfferId: string;
  merchant: CommerceMerchantPageSnapshotMerchant;
  offerSeedId: string;
  priceMinor: number;
  productUrl: string;
  set: CatalogHomepageSetCard;
}

interface RawCurrentSnapshotOffer {
  availability?: unknown;
  checkedAt?: unknown;
  currency?: unknown;
  merchantId?: unknown;
  merchantName?: unknown;
  merchantSlug?: unknown;
  offerSeedId?: unknown;
  priceMinor?: unknown;
  setId?: unknown;
  url?: unknown;
}

function normalizeMerchantSlug(value: string): string {
  return value.trim().toLocaleLowerCase('nl-NL');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyQueryEq<TRow>({
  column,
  query,
  value,
}: {
  column: string;
  query: CommerceMerchantPageSnapshotQuery<TRow>;
  value: unknown;
}): CommerceMerchantPageSnapshotQuery<TRow> {
  return typeof query.eq === 'function' ? query.eq(column, value) : query;
}

function applyQueryGt<TRow>({
  column,
  query,
  value,
}: {
  column: string;
  query: CommerceMerchantPageSnapshotQuery<TRow>;
  value: unknown;
}): CommerceMerchantPageSnapshotQuery<TRow> {
  return typeof query.gt === 'function' ? query.gt(column, value) : query;
}

function applyQueryOrder<TRow>({
  column,
  query,
  ascending = true,
}: {
  ascending?: boolean;
  column: string;
  query: CommerceMerchantPageSnapshotQuery<TRow>;
}): CommerceMerchantPageSnapshotQuery<TRow> {
  return typeof query.order === 'function'
    ? query.order(column, { ascending })
    : query;
}

async function readSnapshotRows<TRow>({
  errorMessage,
  query,
}: {
  errorMessage: string;
  query: CommerceMerchantPageSnapshotQuery<TRow>;
}): Promise<TRow[]> {
  if (typeof query.range !== 'function') {
    const { data, error } = await query;

    if (error) {
      throw new Error(errorMessage);
    }

    return data ?? [];
  }

  const rows: TRow[] = [];

  for (let from = 0; ; from += MERCHANT_PAGE_SNAPSHOT_ROW_PAGE_SIZE) {
    const to = from + MERCHANT_PAGE_SNAPSHOT_ROW_PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      throw new Error(errorMessage);
    }

    const pageRows = data ?? [];

    rows.push(...pageRows);

    if (pageRows.length < MERCHANT_PAGE_SNAPSHOT_ROW_PAGE_SIZE) {
      return rows;
    }
  }
}

function getMerchantSourceType(
  value: string,
): CommerceMerchantPageSnapshotMerchant['sourceType'] {
  return value === 'affiliate' || value === 'marketplace' || value === 'direct'
    ? value
    : 'direct';
}

function toOptionalString(value?: string | null): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
}

function toMerchantProfile(
  row: CommerceMerchantPageSnapshotProfileRow,
): CommerceMerchantPageSnapshotProfile {
  const brandColor = toOptionalString(row.brand_color);
  const brandTextColor = toOptionalString(row.brand_text_color);
  const canonicalPath = toOptionalString(row.canonical_path);
  const faviconUrl = toOptionalString(row.favicon_url);
  const logoUrl = toOptionalString(row.logo_url);
  const longDescription = toOptionalString(row.long_description);
  const seoDescription = toOptionalString(row.seo_description);
  const seoTitle = toOptionalString(row.seo_title);
  const shortDescription = toOptionalString(row.short_description);

  return {
    ...(brandColor ? { brandColor } : {}),
    ...(brandTextColor ? { brandTextColor } : {}),
    ...(canonicalPath ? { canonicalPath } : {}),
    displayName: row.display_name,
    ...(faviconUrl ? { faviconUrl } : {}),
    internalSlug: normalizeMerchantSlug(row.internal_slug),
    isPublic: row.is_public,
    ...(logoUrl ? { logoUrl } : {}),
    ...(longDescription ? { longDescription } : {}),
    merchantId: row.merchant_id,
    publicSlug: normalizeMerchantSlug(row.public_slug),
    ...(seoDescription ? { seoDescription } : {}),
    ...(seoTitle ? { seoTitle } : {}),
    ...(shortDescription ? { shortDescription } : {}),
  };
}

function getProfileByInternalSlug(
  profiles: readonly CommerceMerchantPageSnapshotProfile[],
): Map<string, CommerceMerchantPageSnapshotProfile> {
  return new Map(
    profiles.map(
      (profile) =>
        [normalizeMerchantSlug(profile.internalSlug), profile] as const,
    ),
  );
}

function toMerchant(
  row: CommerceMerchantPageSnapshotMerchantRow,
  profile?: CommerceMerchantPageSnapshotProfile,
): CommerceMerchantPageSnapshotMerchant {
  const seoPresentation = resolveCommerceMerchantSeoPresentation({
    affiliateNetwork: row.affiliate_network,
    merchantName: row.name,
    merchantSlug: row.slug,
    profile,
  });

  return {
    affiliateNetwork: row.affiliate_network ?? undefined,
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    name: seoPresentation.displayName,
    notes: row.notes ?? '',
    publicSlug: seoPresentation.publicSlug,
    seoPresentation,
    slug: row.slug,
    sourceType: getMerchantSourceType(row.source_type),
    updatedAt: row.updated_at,
  };
}

function withMerchantProfile(
  merchant: CommerceMerchantPageSnapshotMerchant,
  profile?: CommerceMerchantPageSnapshotProfile,
): CommerceMerchantPageSnapshotMerchant {
  const seoPresentation = resolveCommerceMerchantSeoPresentation({
    affiliateNetwork: merchant.affiliateNetwork,
    merchantName: merchant.name,
    merchantSlug: merchant.slug,
    profile,
  });

  return {
    ...merchant,
    name: seoPresentation.displayName,
    publicSlug: seoPresentation.publicSlug,
    seoPresentation,
  };
}

function getCanonicalSetCardImageUrl(
  catalogSet: CatalogCanonicalSet,
): string | undefined {
  return (
    catalogSet.cardImageUrl ??
    catalogSet.imageUrl ??
    catalogSet.images?.find((image) => image.type === 'card')?.url ??
    catalogSet.images?.[0]?.url
  );
}

function toCatalogSetCard(
  catalogSet: CatalogCanonicalSet,
): CatalogHomepageSetCard {
  const imageUrl = getCanonicalSetCardImageUrl(catalogSet);

  return {
    ...(catalogSet.cardImageUrl
      ? { cardImageUrl: catalogSet.cardImageUrl }
      : {}),
    ...(catalogSet.catalogName ? { catalogName: catalogSet.catalogName } : {}),
    ...(catalogSet.createdAt ? { createdAt: catalogSet.createdAt } : {}),
    ...(catalogSet.displayTitle
      ? { displayTitle: catalogSet.displayTitle }
      : {}),
    ...(catalogSet.displayTitleSource
      ? { displayTitleSource: catalogSet.displayTitleSource }
      : {}),
    id: catalogSet.setId,
    slug: catalogSet.slug,
    name: catalogSet.displayTitle ?? catalogSet.catalogName ?? catalogSet.name,
    theme: catalogSet.publicTheme?.name ?? catalogSet.primaryTheme,
    ...(catalogSet.publicTheme ? { publicTheme: catalogSet.publicTheme } : {}),
    ...(catalogSet.secondaryLabels.length
      ? { secondaryLabels: catalogSet.secondaryLabels }
      : {}),
    releaseYear: catalogSet.releaseYear,
    ...(catalogSet.releaseDate ? { releaseDate: catalogSet.releaseDate } : {}),
    ...(catalogSet.releaseDatePrecision
      ? { releaseDatePrecision: catalogSet.releaseDatePrecision }
      : {}),
    pieces: catalogSet.pieceCount,
    ...(imageUrl ? { imageUrl } : {}),
    ...(catalogSet.images?.length ? { images: catalogSet.images } : {}),
    ...(imageUrl ? { primaryImage: imageUrl } : {}),
  };
}

function parseCurrentSnapshotOffers(value: unknown): RawCurrentSnapshotOffer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((offer) => ({
    availability: offer.availability,
    checkedAt: offer.checkedAt,
    currency: offer.currency,
    merchantId: offer.merchantId,
    merchantName: offer.merchantName,
    merchantSlug: offer.merchantSlug,
    offerSeedId: offer.offerSeedId,
    priceMinor: offer.priceMinor,
    setId: offer.setId,
    url: offer.url,
  }));
}

function compareMerchantOffersForSet(
  left: EligibleMerchantSnapshotOffer,
  right: EligibleMerchantSnapshotOffer,
): number {
  return (
    left.priceMinor - right.priceMinor ||
    (right.checkedAt ?? '').localeCompare(left.checkedAt ?? '') ||
    left.merchant.name.localeCompare(right.merchant.name, 'nl-NL') ||
    left.offerSeedId.localeCompare(right.offerSeedId)
  );
}

function getLowestOfferByMerchant(
  offers: readonly EligibleMerchantSnapshotOffer[],
): EligibleMerchantSnapshotOffer[] {
  const offerByMerchantId = new Map<string, EligibleMerchantSnapshotOffer>();

  for (const offer of offers) {
    const existingOffer = offerByMerchantId.get(offer.merchant.id);

    if (
      !existingOffer ||
      compareMerchantOffersForSet(offer, existingOffer) < 0
    ) {
      offerByMerchantId.set(offer.merchant.id, offer);
    }
  }

  return [...offerByMerchantId.values()].sort(compareMerchantOffersForSet);
}

function getCanonicalBestMerchantSnapshotOffer({
  currentSnapshot,
  offers,
}: {
  currentSnapshot: CommerceMerchantPageSnapshotCurrentOfferRow;
  offers: readonly EligibleMerchantSnapshotOffer[];
}): EligibleMerchantSnapshotOffer | undefined {
  if (
    !currentSnapshot.best_offer_seed_id &&
    !currentSnapshot.best_merchant_id &&
    !currentSnapshot.best_merchant_slug
  ) {
    return undefined;
  }

  return offers.find((offer) => {
    if (
      currentSnapshot.best_offer_seed_id &&
      offer.offerSeedId !== currentSnapshot.best_offer_seed_id
    ) {
      return false;
    }

    if (
      currentSnapshot.best_merchant_id &&
      offer.merchant.id !== currentSnapshot.best_merchant_id
    ) {
      return false;
    }

    if (
      currentSnapshot.best_merchant_slug &&
      offer.merchant.slug !== currentSnapshot.best_merchant_slug
    ) {
      return false;
    }

    if (
      typeof currentSnapshot.best_price_minor === 'number' &&
      offer.priceMinor !== currentSnapshot.best_price_minor
    ) {
      return false;
    }

    if (
      currentSnapshot.best_product_url &&
      offer.productUrl !== currentSnapshot.best_product_url
    ) {
      return false;
    }

    return true;
  });
}

function toMerchantDeal({
  comparedMerchantCount,
  nextBestOffer,
  offer,
}: {
  comparedMerchantCount: number;
  nextBestOffer?: EligibleMerchantSnapshotOffer;
  offer: EligibleMerchantSnapshotOffer;
}): CommerceMerchantPageSnapshotDeal {
  const savingsMinor =
    nextBestOffer && nextBestOffer.priceMinor > offer.priceMinor
      ? nextBestOffer.priceMinor - offer.priceMinor
      : undefined;
  const savingsPercentage =
    nextBestOffer && typeof savingsMinor === 'number' && savingsMinor > 0
      ? (savingsMinor / nextBestOffer.priceMinor) * 100
      : undefined;

  return {
    checkedAt: offer.checkedAt,
    comparedMerchantCount,
    currencyCode: offer.currencyCode,
    latestOfferId: offer.latestOfferId,
    merchant: offer.merchant,
    nextBestMerchant: nextBestOffer?.merchant,
    nextBestPriceMinor: nextBestOffer?.priceMinor,
    offerSeedId: offer.offerSeedId,
    priceMinor: offer.priceMinor,
    productUrl: offer.productUrl,
    savingsMinor,
    savingsPercentage,
    set: offer.set,
  };
}

function compareMerchantDeals(
  left: CommerceMerchantPageSnapshotDeal,
  right: CommerceMerchantPageSnapshotDeal,
): number {
  return (
    (right.savingsPercentage ?? -1) - (left.savingsPercentage ?? -1) ||
    (right.savingsMinor ?? -1) - (left.savingsMinor ?? -1) ||
    right.comparedMerchantCount - left.comparedMerchantCount ||
    left.priceMinor - right.priceMinor ||
    left.set.name.localeCompare(right.set.name, 'nl-NL') ||
    left.set.id.localeCompare(right.set.id)
  );
}

function updateLastFetchedAt({
  checkedAt,
  lastFetchedAtByMerchantSlug,
  merchantSlug,
}: {
  checkedAt?: string;
  lastFetchedAtByMerchantSlug: Map<string, string>;
  merchantSlug: string;
}): void {
  if (!checkedAt) {
    return;
  }

  const existingValue = lastFetchedAtByMerchantSlug.get(merchantSlug);

  if (!existingValue || checkedAt > existingValue) {
    lastFetchedAtByMerchantSlug.set(merchantSlug, checkedAt);
  }
}

function buildDealsFromCurrentSnapshots({
  activeMerchantById,
  catalogSetCardById,
  currentSnapshots,
}: {
  activeMerchantById: ReadonlyMap<string, CommerceMerchantPageSnapshotMerchant>;
  catalogSetCardById: ReadonlyMap<string, CatalogHomepageSetCard>;
  currentSnapshots: readonly CommerceMerchantPageSnapshotCurrentOfferRow[];
}): {
  dealsByMerchantSlug: Map<string, CommerceMerchantPageSnapshotDeal[]>;
  lastFetchedAtByMerchantSlug: Map<string, string>;
  offerCountByMerchantSlug: Map<string, number>;
} {
  const dealsByMerchantSlug = new Map<
    string,
    CommerceMerchantPageSnapshotDeal[]
  >();
  const lastFetchedAtByMerchantSlug = new Map<string, string>();
  const offerCountByMerchantSlug = new Map<string, number>();

  for (const currentSnapshot of currentSnapshots) {
    const setId = normalizeCatalogSetId(currentSnapshot.set_id);
    const set = catalogSetCardById.get(setId);

    if (!set) {
      continue;
    }

    const eligibleOffers = parseCurrentSnapshotOffers(currentSnapshot.offers)
      .flatMap((rawOffer) => {
        if (
          rawOffer.availability !== 'in_stock' ||
          typeof rawOffer.merchantId !== 'string' ||
          typeof rawOffer.merchantSlug !== 'string' ||
          typeof rawOffer.merchantName !== 'string' ||
          typeof rawOffer.offerSeedId !== 'string' ||
          typeof rawOffer.priceMinor !== 'number' ||
          rawOffer.priceMinor <= 0 ||
          typeof rawOffer.url !== 'string' ||
          !rawOffer.url.trim()
        ) {
          return [];
        }

        const merchant = activeMerchantById.get(rawOffer.merchantId);

        if (!merchant) {
          return [];
        }

        return [
          {
            checkedAt:
              typeof rawOffer.checkedAt === 'string'
                ? rawOffer.checkedAt
                : (currentSnapshot.best_checked_at ??
                  currentSnapshot.computed_at ??
                  undefined),
            currencyCode:
              typeof rawOffer.currency === 'string'
                ? rawOffer.currency
                : currentSnapshot.currency_code,
            latestOfferId: rawOffer.offerSeedId,
            merchant,
            offerSeedId: rawOffer.offerSeedId,
            priceMinor: rawOffer.priceMinor,
            productUrl: rawOffer.url,
            set,
          } satisfies EligibleMerchantSnapshotOffer,
        ];
      })
      .sort(compareMerchantOffersForSet);
    const lowestOffersByMerchant = getLowestOfferByMerchant(eligibleOffers);
    const bestOffer = getCanonicalBestMerchantSnapshotOffer({
      currentSnapshot,
      offers: lowestOffersByMerchant,
    });

    for (const offer of lowestOffersByMerchant) {
      const merchantSlug = normalizeMerchantSlug(offer.merchant.slug);

      offerCountByMerchantSlug.set(
        merchantSlug,
        (offerCountByMerchantSlug.get(merchantSlug) ?? 0) + 1,
      );
      updateLastFetchedAt({
        checkedAt: offer.checkedAt,
        lastFetchedAtByMerchantSlug,
        merchantSlug,
      });
    }

    if (!bestOffer) {
      continue;
    }

    const nextBestOffer = lowestOffersByMerchant.find(
      (candidate) => candidate.merchant.id !== bestOffer.merchant.id,
    );
    const merchantSlug = normalizeMerchantSlug(bestOffer.merchant.slug);
    const deal = toMerchantDeal({
      comparedMerchantCount: lowestOffersByMerchant.length,
      nextBestOffer,
      offer: bestOffer,
    });

    dealsByMerchantSlug.set(merchantSlug, [
      ...(dealsByMerchantSlug.get(merchantSlug) ?? []),
      deal,
    ]);
  }

  for (const [merchantSlug, deals] of dealsByMerchantSlug) {
    dealsByMerchantSlug.set(
      merchantSlug,
      [...deals].sort(compareMerchantDeals),
    );
  }

  return {
    dealsByMerchantSlug,
    lastFetchedAtByMerchantSlug,
    offerCountByMerchantSlug,
  };
}

export function buildCommerceMerchantPageSnapshotRecords({
  catalogSets,
  currentSnapshots,
  merchantProfiles = [],
  merchants,
}: {
  catalogSets: readonly CatalogCanonicalSet[];
  currentSnapshots: readonly CommerceMerchantPageSnapshotCurrentOfferRow[];
  merchantProfiles?: readonly CommerceMerchantPageSnapshotProfile[];
  merchants: readonly CommerceMerchantPageSnapshotMerchant[];
}): CommerceMerchantPageSnapshotRecord[] {
  const profileByInternalSlug = getProfileByInternalSlug(merchantProfiles);
  const activeMerchants = merchants
    .filter((merchant) => merchant.isActive)
    .map((merchant) =>
      withMerchantProfile(
        merchant,
        profileByInternalSlug.get(normalizeMerchantSlug(merchant.slug)),
      ),
    );
  const activeMerchantById = new Map(
    activeMerchants.map((merchant) => [merchant.id, merchant] as const),
  );
  const catalogSetCardById = new Map(
    catalogSets
      .filter((catalogSet) => catalogSet.status === 'active')
      .map(
        (catalogSet) =>
          [
            normalizeCatalogSetId(catalogSet.setId),
            toCatalogSetCard(catalogSet),
          ] as const,
      ),
  );
  const {
    dealsByMerchantSlug,
    lastFetchedAtByMerchantSlug,
    offerCountByMerchantSlug,
  } = buildDealsFromCurrentSnapshots({
    activeMerchantById,
    catalogSetCardById,
    currentSnapshots,
  });

  return activeMerchants
    .map((merchant) => {
      const merchantSlug = normalizeMerchantSlug(merchant.slug);
      const merchantDeals = dealsByMerchantSlug.get(merchantSlug) ?? [];
      const bestDeals = merchantDeals.filter(
        (deal) => typeof deal.nextBestPriceMinor === 'number',
      );
      const onlyAtMerchantDeals = merchantDeals.filter(
        (deal) => typeof deal.nextBestPriceMinor !== 'number',
      );

      return {
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSlug: merchant.slug,
        snapshot: {
          bestDealCount: bestDeals.length,
          bestDeals: bestDeals.slice(0, BEST_DEAL_SNAPSHOT_LIMIT),
          dealCount: bestDeals.length + onlyAtMerchantDeals.length,
          lastFetchedAt: lastFetchedAtByMerchantSlug.get(merchantSlug),
          merchant,
          offerCount: offerCountByMerchantSlug.get(merchantSlug) ?? 0,
          onlyAtMerchantDealCount: onlyAtMerchantDeals.length,
          onlyAtMerchantDeals: onlyAtMerchantDeals.slice(
            0,
            ONLY_AT_MERCHANT_SNAPSHOT_LIMIT,
          ),
          version: MERCHANT_PAGE_SNAPSHOT_VERSION,
        },
      } satisfies CommerceMerchantPageSnapshotRecord;
    })
    .sort((left, right) =>
      left.merchantName.localeCompare(right.merchantName, 'nl-NL'),
    );
}

async function listActiveMerchantRows({
  profileByInternalSlug,
  supabaseClient,
}: {
  profileByInternalSlug?: ReadonlyMap<
    string,
    CommerceMerchantPageSnapshotProfile
  >;
  supabaseClient: CommerceMerchantPageSnapshotSupabaseClient;
}): Promise<CommerceMerchantPageSnapshotMerchant[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    ) as unknown as CommerceMerchantPageSnapshotQuery<CommerceMerchantPageSnapshotMerchantRow>;
  const activeQuery = applyQueryEq({
    column: 'is_active',
    query: selectedQuery,
    value: true,
  });
  const orderedQuery = applyQueryOrder({
    column: 'name',
    query: activeQuery,
  });
  const rows = await readSnapshotRows({
    errorMessage: 'Unable to load active commerce merchants.',
    query: orderedQuery,
  });

  return rows
    .filter((row) => row.is_active)
    .map((row) =>
      toMerchant(
        row,
        profileByInternalSlug?.get(normalizeMerchantSlug(row.slug)),
      ),
    );
}

async function listMerchantProfileRows({
  supabaseClient,
}: {
  supabaseClient: CommerceMerchantPageSnapshotSupabaseClient;
}): Promise<CommerceMerchantPageSnapshotProfile[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANT_PROFILES_TABLE)
    .select(
      'merchant_id, internal_slug, public_slug, display_name, seo_title, seo_description, short_description, long_description, logo_url, favicon_url, brand_color, brand_text_color, canonical_path, is_public',
    ) as unknown as CommerceMerchantPageSnapshotQuery<CommerceMerchantPageSnapshotProfileRow>;
  const publicQuery = applyQueryEq({
    column: 'is_public',
    query: selectedQuery,
    value: true,
  });
  const orderedQuery = applyQueryOrder({
    column: 'public_slug',
    query: publicQuery,
  });

  try {
    const rows = await readSnapshotRows({
      errorMessage: 'Unable to load commerce merchant profiles.',
      query: orderedQuery,
    });

    return rows.filter((row) => row.is_public).map(toMerchantProfile);
  } catch {
    return [];
  }
}

async function listCurrentOfferSnapshotRows({
  supabaseClient,
}: {
  supabaseClient: CommerceMerchantPageSnapshotSupabaseClient;
}): Promise<CommerceMerchantPageSnapshotCurrentOfferRow[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, best_availability, best_checked_at, best_merchant_id, best_merchant_name, best_merchant_slug, best_offer_seed_id, best_price_minor, best_product_url, offer_count, comparable_offer_count, next_best_price_minor, offers, computed_at',
    ) as unknown as CommerceMerchantPageSnapshotQuery<CommerceMerchantPageSnapshotCurrentOfferRow>;
  const regionQuery = applyQueryEq({
    column: 'region_code',
    query: selectedQuery,
    value: DUTCH_REGION_CODE,
  });
  const currencyQuery = applyQueryEq({
    column: 'currency_code',
    query: regionQuery,
    value: EURO_CURRENCY_CODE,
  });
  const conditionQuery = applyQueryEq({
    column: 'condition',
    query: currencyQuery,
    value: NEW_OFFER_CONDITION,
  });
  const offeredQuery = applyQueryGt({
    column: 'offer_count',
    query: conditionQuery,
    value: 0,
  });
  const orderedQuery = applyQueryOrder({
    column: 'set_id',
    query: offeredQuery,
  });
  const rows = await readSnapshotRows({
    errorMessage: 'Unable to load current offer snapshots.',
    query: orderedQuery,
  });

  return rows.filter(
    (row) =>
      row.region_code === DUTCH_REGION_CODE &&
      row.currency_code === EURO_CURRENCY_CODE &&
      row.condition === NEW_OFFER_CONDITION &&
      (row.offer_count ?? 0) > 0,
  );
}

async function listExistingMerchantSnapshotRows({
  supabaseClient,
}: {
  supabaseClient: CommerceMerchantPageSnapshotSupabaseClient;
}): Promise<CommerceMerchantPageSnapshotExistingRow[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANT_PAGE_SNAPSHOTS_TABLE)
    .select(
      'merchant_slug, snapshot',
    ) as unknown as CommerceMerchantPageSnapshotQuery<CommerceMerchantPageSnapshotExistingRow>;
  const orderedQuery = applyQueryOrder({
    column: 'merchant_slug',
    query: selectedQuery,
  });

  return readSnapshotRows({
    errorMessage: 'Unable to load existing merchant page snapshots.',
    query: orderedQuery,
  });
}

function serializeSnapshotPayload(value: unknown): string {
  return JSON.stringify(value);
}

async function upsertMerchantPageSnapshots({
  generatedAt,
  snapshots,
  sourceVersion,
  supabaseClient,
}: {
  generatedAt: string;
  snapshots: readonly CommerceMerchantPageSnapshotRecord[];
  sourceVersion: string;
  supabaseClient: CommerceMerchantPageSnapshotSupabaseClient;
}): Promise<number> {
  if (!snapshots.length) {
    return 0;
  }

  const query = supabaseClient
    .from(COMMERCE_MERCHANT_PAGE_SNAPSHOTS_TABLE)
    .upsert?.(
      snapshots.map((snapshotRecord) => ({
        generated_at: generatedAt,
        merchant_id: snapshotRecord.merchantId,
        merchant_name: snapshotRecord.merchantName,
        merchant_slug: snapshotRecord.merchantSlug,
        snapshot: snapshotRecord.snapshot,
        source_version: sourceVersion,
      })),
      {
        onConflict: 'merchant_slug',
      },
    );

  if (!query) {
    throw new Error('Unable to upsert commerce merchant page snapshots.');
  }

  const { error } = await query;

  if (error) {
    throw new Error('Unable to upsert commerce merchant page snapshots.');
  }

  return snapshots.length;
}

function getChangedMerchantSlugs({
  existingRows,
  snapshots,
}: {
  existingRows: readonly CommerceMerchantPageSnapshotExistingRow[];
  snapshots: readonly CommerceMerchantPageSnapshotRecord[];
}): string[] {
  const existingSnapshotBySlug = new Map(
    existingRows.map((row) => [
      normalizeMerchantSlug(row.merchant_slug),
      serializeSnapshotPayload(row.snapshot),
    ]),
  );

  return snapshots
    .filter((snapshotRecord) => {
      const merchantSlug = normalizeMerchantSlug(snapshotRecord.merchantSlug);

      return (
        existingSnapshotBySlug.get(merchantSlug) !==
        serializeSnapshotPayload(snapshotRecord.snapshot)
      );
    })
    .map((snapshotRecord) => snapshotRecord.merchantSlug);
}

export function getMerchantPageRevalidationPaths(
  merchantSlugs: readonly string[],
  merchantProfiles: readonly CommerceMerchantPageSnapshotProfile[] = [],
): string[] {
  const merchantsPath = buildWebPath(webPathnames.merchants);
  const profileByInternalSlug = getProfileByInternalSlug(merchantProfiles);

  return [
    merchantsPath,
    ...new Set(
      merchantSlugs.map((merchantSlug) =>
        buildCommerceMerchantPath(
          merchantSlug,
          profileByInternalSlug.get(normalizeMerchantSlug(merchantSlug)),
        ),
      ),
    ),
  ];
}

export async function buildCommerceMerchantPageSnapshots({
  dryRun = false,
  listCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  revalidate = !dryRun,
  revalidatePublicWebFn = revalidatePublicWeb,
  sourceVersion = MERCHANT_PAGE_SNAPSHOT_SOURCE_VERSION,
  supabaseClient = getServerSupabaseAdminClient() as unknown as CommerceMerchantPageSnapshotSupabaseClient,
}: {
  dryRun?: boolean;
  listCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  revalidate?: boolean;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
  sourceVersion?: string;
  supabaseClient?: CommerceMerchantPageSnapshotSupabaseClient;
} = {}): Promise<CommerceMerchantPageSnapshotBuildResult> {
  const startedAt = Date.now();
  const phaseTimings: Record<string, number> = {};
  const markPhase = (phase: string, phaseStartedAt: number): void => {
    phaseTimings[phase] = Date.now() - phaseStartedAt;
  };

  let phaseStartedAt = Date.now();
  const merchantProfiles = await listMerchantProfileRows({ supabaseClient });
  const merchants = await listActiveMerchantRows({
    profileByInternalSlug: getProfileByInternalSlug(merchantProfiles),
    supabaseClient,
  });
  markPhase('load_active_merchants_ms', phaseStartedAt);

  phaseStartedAt = Date.now();
  const currentSnapshots = await listCurrentOfferSnapshotRows({
    supabaseClient,
  });
  markPhase('load_current_offer_snapshots_ms', phaseStartedAt);

  phaseStartedAt = Date.now();
  const rawCatalogSets = await listCatalogSetsFn({
    includeInactive: false,
    supabaseClient: supabaseClient as never,
  });
  const catalogSets = await enrichCatalogSetsWithPresentationTitles({
    catalogSets: rawCatalogSets,
    supabaseClient,
  });
  markPhase('load_catalog_sets_ms', phaseStartedAt);

  phaseStartedAt = Date.now();
  const snapshots = buildCommerceMerchantPageSnapshotRecords({
    catalogSets,
    currentSnapshots,
    merchantProfiles,
    merchants,
  });
  markPhase('build_snapshots_ms', phaseStartedAt);

  phaseStartedAt = Date.now();
  const existingRows = await listExistingMerchantSnapshotRows({
    supabaseClient,
  });
  const changedMerchantSlugs = getChangedMerchantSlugs({
    existingRows,
    snapshots,
  });
  markPhase('load_existing_snapshots_ms', phaseStartedAt);

  let upsertedCount = 0;

  if (!dryRun) {
    phaseStartedAt = Date.now();
    upsertedCount = await upsertMerchantPageSnapshots({
      generatedAt: now.toISOString(),
      snapshots,
      sourceVersion,
      supabaseClient,
    });
    markPhase('upsert_snapshots_ms', phaseStartedAt);
  }

  let revalidation: Awaited<ReturnType<typeof revalidatePublicWeb>> | undefined;

  if (!dryRun && revalidate && changedMerchantSlugs.length) {
    phaseStartedAt = Date.now();
    revalidation = await revalidatePublicWebFn({
      paths: getMerchantPageRevalidationPaths(
        changedMerchantSlugs,
        merchantProfiles,
      ),
      reason: 'commerce_merchant_page_snapshots',
      tags: MERCHANT_PAGE_REVALIDATION_TAGS,
    });
    markPhase('revalidate_public_web_ms', phaseStartedAt);
  }

  phaseTimings.total_ms = Date.now() - startedAt;

  return {
    changedMerchantSlugs,
    dryRun,
    phaseTimings,
    revalidation,
    snapshots,
    upsertedCount,
  };
}
