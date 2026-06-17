import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  type CommerceMerchantSeoPresentationProfile,
  resolveCommerceMerchantInternalSlug,
  resolveCommerceMerchantSeoPresentation,
  type CommerceMerchantSeoPresentation,
  getBrowserSupabaseConfig,
  hasBrowserSupabaseConfig,
} from '@lego-platform/shared/config';
import { createClient } from '@supabase/supabase-js';

const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_MERCHANT_PROFILES_TABLE = 'commerce_merchant_profiles';
const COMMERCE_MERCHANT_PAGE_SNAPSHOTS_TABLE =
  'commerce_merchant_page_snapshots';
const MERCHANT_PAGE_ROW_PAGE_SIZE = 1000;
const MERCHANT_OVERVIEW_PREVIEW_DEAL_LIMIT = 3;
const MERCHANT_PAGE_SNAPSHOT_VERSION = 1;
const commerceMerchantSourceTypes = [
  'direct',
  'affiliate',
  'marketplace',
] as const;

type CommerceMerchantSourceType = (typeof commerceMerchantSourceTypes)[number];

type CommerceMerchantPageQuery<TRow> = PromiseLike<{
  data: TRow[] | null;
  error: unknown;
}> & {
  eq?: (column: string, value: unknown) => CommerceMerchantPageQuery<TRow>;
  order?: (
    column: string,
    options?: { ascending?: boolean },
  ) => CommerceMerchantPageQuery<TRow>;
  range?: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: TRow[] | null;
    error: unknown;
  }>;
};

interface CommerceMerchantPageSupabaseClient {
  from(table: string): {
    select(columns: string): CommerceMerchantPageQuery<Record<string, unknown>>;
  };
}

interface CommerceMerchantPageMerchantRow {
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

interface CommerceMerchantProfileRow {
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

interface CommerceMerchantPageSnapshotRow {
  generated_at: string;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string;
  snapshot: unknown;
  source_version: string | null;
}

interface CommerceMerchantPublicProfile
  extends CommerceMerchantSeoPresentationProfile {
  displayName: string;
  internalSlug: string;
  isPublic: boolean;
  merchantId: string;
  publicSlug: string;
}

export interface CommerceMerchantPageMerchant {
  affiliateNetwork?: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string;
  publicSlug: string;
  seoPresentation: CommerceMerchantSeoPresentation;
  slug: string;
  sourceType: CommerceMerchantSourceType;
  updatedAt: string;
}

export interface CommerceMerchantDeal {
  checkedAt?: string;
  comparedMerchantCount: number;
  currencyCode: string;
  latestOfferId: string;
  merchant: CommerceMerchantPageMerchant;
  nextBestMerchant?: CommerceMerchantPageMerchant;
  nextBestPriceMinor?: number;
  offerSeedId: string;
  priceMinor: number;
  productUrl: string;
  savingsMinor?: number;
  savingsPercentage?: number;
  set: CatalogHomepageSetCard;
}

export interface CommerceMerchantDealsResult {
  bestDealCount: number;
  comparableDeals: CommerceMerchantDeal[];
  dealCount: number;
  generatedAt?: string;
  lastFetchedAt?: string;
  merchant: CommerceMerchantPageMerchant;
  offerCount: number;
  onlyAtMerchantDealCount: number;
  onlyAtMerchantDeals: CommerceMerchantDeal[];
  snapshotMissing: boolean;
}

export interface CommerceMerchantOverviewItem {
  bestSavingsMinor?: number;
  bestSavingsPercentage?: number;
  comparableDealCount: number;
  dealCount: number;
  generatedAt?: string;
  lastFetchedAt?: string;
  merchant: CommerceMerchantPageMerchant;
  offerCount: number;
  onlyAtMerchantDealCount: number;
  previewDeals: CommerceMerchantDeal[];
  snapshotMissing: boolean;
}

interface CommerceMerchantPageSnapshotPayload {
  bestDealCount?: unknown;
  bestDeals?: unknown;
  dealCount?: unknown;
  lastFetchedAt?: unknown;
  merchant?: unknown;
  offerCount?: unknown;
  onlyAtMerchantDealCount?: unknown;
  onlyAtMerchantDeals?: unknown;
  version?: unknown;
}

interface NormalizedMerchantSnapshot {
  bestDealCount: number;
  bestDeals: CommerceMerchantDeal[];
  dealCount: number;
  generatedAt: string;
  lastFetchedAt?: string;
  offerCount: number;
  onlyAtMerchantDealCount: number;
  onlyAtMerchantDeals: CommerceMerchantDeal[];
}

function getMerchantPageSupabaseClient():
  | CommerceMerchantPageSupabaseClient
  | undefined {
  if (!hasBrowserSupabaseConfig()) {
    return undefined;
  }

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
  ) as unknown as CommerceMerchantPageSupabaseClient;
}

function applyQueryOrder<TRow>({
  column,
  query,
  ascending = true,
}: {
  ascending?: boolean;
  column: string;
  query: CommerceMerchantPageQuery<TRow>;
}): CommerceMerchantPageQuery<TRow> {
  return typeof query.order === 'function'
    ? query.order(column, { ascending })
    : query;
}

function applyQueryEq<TRow>({
  column,
  query,
  value,
}: {
  column: string;
  query: CommerceMerchantPageQuery<TRow>;
  value: unknown;
}): CommerceMerchantPageQuery<TRow> {
  return typeof query.eq === 'function' ? query.eq(column, value) : query;
}

async function readMerchantPageRows<TRow>({
  errorMessage,
  query,
}: {
  errorMessage: string;
  query: CommerceMerchantPageQuery<TRow>;
}): Promise<TRow[]> {
  if (typeof query.range !== 'function') {
    const { data, error } = await query;

    if (error) {
      throw new Error(errorMessage);
    }

    return data ?? [];
  }

  const rows: TRow[] = [];

  for (let from = 0; ; from += MERCHANT_PAGE_ROW_PAGE_SIZE) {
    const to = from + MERCHANT_PAGE_ROW_PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      throw new Error(errorMessage);
    }

    const pageRows = data ?? [];

    rows.push(...pageRows);

    if (pageRows.length < MERCHANT_PAGE_ROW_PAGE_SIZE) {
      return rows;
    }
  }
}

function getAllowedMerchantSourceType(
  value: string,
): CommerceMerchantSourceType {
  return commerceMerchantSourceTypes.includes(
    value as CommerceMerchantSourceType,
  )
    ? (value as CommerceMerchantSourceType)
    : 'direct';
}

function toMerchantPageMerchant(
  row: CommerceMerchantPageMerchantRow,
  profile?: CommerceMerchantPublicProfile,
): CommerceMerchantPageMerchant {
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
    sourceType: getAllowedMerchantSourceType(row.source_type),
    updatedAt: row.updated_at,
  };
}

function normalizeMerchantSlug(value: string): string {
  return value.trim().toLocaleLowerCase('nl-NL');
}

function toOptionalString(value?: string | null): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
}

function toCommerceMerchantPublicProfile(
  row: CommerceMerchantProfileRow,
): CommerceMerchantPublicProfile {
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
  profiles: readonly CommerceMerchantPublicProfile[],
): Map<string, CommerceMerchantPublicProfile> {
  return new Map(
    profiles.map(
      (profile) =>
        [normalizeMerchantSlug(profile.internalSlug), profile] as const,
    ),
  );
}

function getProfileByPublicSlug(
  profiles: readonly CommerceMerchantPublicProfile[],
): Map<string, CommerceMerchantPublicProfile> {
  return new Map(
    profiles.map(
      (profile) =>
        [normalizeMerchantSlug(profile.publicSlug), profile] as const,
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCatalogSetCard(value: unknown): value is CatalogHomepageSetCard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.theme === 'string' &&
    typeof value.releaseYear === 'number' &&
    typeof value.pieces === 'number'
  );
}

function isMerchant(value: unknown): value is CommerceMerchantPageMerchant {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.isActive === 'boolean'
  );
}

function withMerchantSeoPresentation(
  merchant: CommerceMerchantPageMerchant,
  profileByInternalSlug?: ReadonlyMap<string, CommerceMerchantPublicProfile>,
): CommerceMerchantPageMerchant {
  const profile = profileByInternalSlug?.get(
    normalizeMerchantSlug(merchant.slug),
  );
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

function withDealMerchantSeoPresentation(
  deal: CommerceMerchantDeal,
  profileByInternalSlug?: ReadonlyMap<string, CommerceMerchantPublicProfile>,
): CommerceMerchantDeal {
  return {
    ...deal,
    merchant: withMerchantSeoPresentation(deal.merchant, profileByInternalSlug),
    ...(deal.nextBestMerchant
      ? {
          nextBestMerchant: withMerchantSeoPresentation(
            deal.nextBestMerchant,
            profileByInternalSlug,
          ),
        }
      : {}),
  };
}

function isMerchantDeal(value: unknown): value is CommerceMerchantDeal {
  return (
    isRecord(value) &&
    typeof value.comparedMerchantCount === 'number' &&
    typeof value.currencyCode === 'string' &&
    typeof value.latestOfferId === 'string' &&
    isMerchant(value.merchant) &&
    typeof value.offerSeedId === 'string' &&
    typeof value.priceMinor === 'number' &&
    typeof value.productUrl === 'string' &&
    isCatalogSetCard(value.set)
  );
}

function toMerchantDealArray(
  value: unknown,
  profileByInternalSlug?: ReadonlyMap<string, CommerceMerchantPublicProfile>,
): CommerceMerchantDeal[] {
  return Array.isArray(value)
    ? value
        .filter(isMerchantDeal)
        .map((deal) =>
          withDealMerchantSeoPresentation(deal, profileByInternalSlug),
        )
    : [];
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeSnapshotPayload({
  profileByInternalSlug,
  row,
}: {
  profileByInternalSlug?: ReadonlyMap<string, CommerceMerchantPublicProfile>;
  row: CommerceMerchantPageSnapshotRow;
}): NormalizedMerchantSnapshot | undefined {
  if (!isRecord(row.snapshot)) {
    return undefined;
  }

  const snapshot = row.snapshot as CommerceMerchantPageSnapshotPayload;

  if (snapshot.version !== MERCHANT_PAGE_SNAPSHOT_VERSION) {
    return undefined;
  }

  const bestDeals = toMerchantDealArray(
    snapshot.bestDeals,
    profileByInternalSlug,
  );
  const onlyAtMerchantDeals = toMerchantDealArray(
    snapshot.onlyAtMerchantDeals,
    profileByInternalSlug,
  );

  return {
    bestDealCount: toNonNegativeInteger(snapshot.bestDealCount),
    bestDeals,
    dealCount: toNonNegativeInteger(snapshot.dealCount),
    generatedAt: row.generated_at,
    lastFetchedAt:
      typeof snapshot.lastFetchedAt === 'string'
        ? snapshot.lastFetchedAt
        : undefined,
    offerCount: toNonNegativeInteger(snapshot.offerCount),
    onlyAtMerchantDealCount: toNonNegativeInteger(
      snapshot.onlyAtMerchantDealCount,
    ),
    onlyAtMerchantDeals,
  };
}

async function listActiveMerchantPageMerchants({
  profileByInternalSlug,
  supabaseClient,
}: {
  profileByInternalSlug?: ReadonlyMap<string, CommerceMerchantPublicProfile>;
  supabaseClient: CommerceMerchantPageSupabaseClient;
}): Promise<CommerceMerchantPageMerchant[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    ) as unknown as CommerceMerchantPageQuery<CommerceMerchantPageMerchantRow>;
  const activeQuery = applyQueryEq({
    column: 'is_active',
    query: selectedQuery,
    value: true,
  });
  const orderedQuery = applyQueryOrder({
    column: 'name',
    query: activeQuery,
  });
  const rows = await readMerchantPageRows({
    errorMessage: 'Unable to load active commerce merchants.',
    query: orderedQuery,
  });

  return rows
    .filter((row) => row.is_active)
    .map((row) =>
      toMerchantPageMerchant(
        row,
        profileByInternalSlug?.get(normalizeMerchantSlug(row.slug)),
      ),
    );
}

async function listMerchantProfiles({
  supabaseClient,
}: {
  supabaseClient: CommerceMerchantPageSupabaseClient;
}): Promise<CommerceMerchantPublicProfile[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANT_PROFILES_TABLE)
    .select(
      'merchant_id, internal_slug, public_slug, display_name, seo_title, seo_description, short_description, long_description, logo_url, favicon_url, brand_color, brand_text_color, canonical_path, is_public',
    ) as unknown as CommerceMerchantPageQuery<CommerceMerchantProfileRow>;
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
    const rows = await readMerchantPageRows({
      errorMessage: 'Unable to load commerce merchant profiles.',
      query: orderedQuery,
    });

    return rows
      .filter((row) => row.is_public)
      .map(toCommerceMerchantPublicProfile);
  } catch {
    return [];
  }
}

async function listMerchantPageSnapshotRows({
  merchantSlug,
  supabaseClient,
}: {
  merchantSlug?: string;
  supabaseClient: CommerceMerchantPageSupabaseClient;
}): Promise<CommerceMerchantPageSnapshotRow[]> {
  const selectedQuery = supabaseClient
    .from(COMMERCE_MERCHANT_PAGE_SNAPSHOTS_TABLE)
    .select(
      'merchant_id, merchant_slug, merchant_name, snapshot, generated_at, source_version',
    ) as unknown as CommerceMerchantPageQuery<CommerceMerchantPageSnapshotRow>;
  const merchantQuery = merchantSlug
    ? applyQueryEq({
        column: 'merchant_slug',
        query: selectedQuery,
        value: merchantSlug,
      })
    : selectedQuery;
  const orderedQuery = applyQueryOrder({
    column: 'merchant_name',
    query: merchantQuery,
  });

  try {
    return await readMerchantPageRows({
      errorMessage: 'Unable to load commerce merchant page snapshots.',
      query: orderedQuery,
    });
  } catch {
    return [];
  }
}

function getEmptyMerchantDealsResult(
  merchant: CommerceMerchantPageMerchant,
): CommerceMerchantDealsResult {
  return {
    bestDealCount: 0,
    comparableDeals: [],
    dealCount: 0,
    merchant,
    offerCount: 0,
    onlyAtMerchantDealCount: 0,
    onlyAtMerchantDeals: [],
    snapshotMissing: true,
  };
}

function toMerchantDealsResult({
  merchant,
  snapshot,
}: {
  merchant: CommerceMerchantPageMerchant;
  snapshot?: NormalizedMerchantSnapshot;
}): CommerceMerchantDealsResult {
  if (!snapshot) {
    return getEmptyMerchantDealsResult(merchant);
  }

  return {
    bestDealCount: snapshot.bestDealCount,
    comparableDeals: snapshot.bestDeals,
    dealCount: snapshot.dealCount,
    generatedAt: snapshot.generatedAt,
    lastFetchedAt: snapshot.lastFetchedAt,
    merchant,
    offerCount: snapshot.offerCount,
    onlyAtMerchantDealCount: snapshot.onlyAtMerchantDealCount,
    onlyAtMerchantDeals: snapshot.onlyAtMerchantDeals,
    snapshotMissing: false,
  };
}

function toOverviewItem({
  merchant,
  snapshot,
}: {
  merchant: CommerceMerchantPageMerchant;
  snapshot?: NormalizedMerchantSnapshot;
}): CommerceMerchantOverviewItem {
  const result = toMerchantDealsResult({ merchant, snapshot });
  const previewDeals = [
    ...result.comparableDeals,
    ...result.onlyAtMerchantDeals,
  ].slice(0, MERCHANT_OVERVIEW_PREVIEW_DEAL_LIMIT);
  const bestSavingsDeal = result.comparableDeals.find(
    (deal) => typeof deal.savingsMinor === 'number',
  );

  return {
    bestSavingsMinor: bestSavingsDeal?.savingsMinor,
    bestSavingsPercentage: bestSavingsDeal?.savingsPercentage,
    comparableDealCount: result.bestDealCount,
    dealCount: result.dealCount,
    generatedAt: result.generatedAt,
    lastFetchedAt: result.lastFetchedAt,
    merchant,
    offerCount: result.offerCount,
    onlyAtMerchantDealCount: result.onlyAtMerchantDealCount,
    previewDeals,
    snapshotMissing: result.snapshotMissing,
  };
}

export async function getActiveCommerceMerchantsOverview({
  supabaseClient = getMerchantPageSupabaseClient(),
}: {
  supabaseClient?: CommerceMerchantPageSupabaseClient;
} = {}): Promise<CommerceMerchantOverviewItem[]> {
  if (!supabaseClient) {
    return [];
  }

  let merchants: CommerceMerchantPageMerchant[];
  let merchantProfiles: CommerceMerchantPublicProfile[];
  let snapshotRows: CommerceMerchantPageSnapshotRow[];

  try {
    [merchantProfiles, snapshotRows] = await Promise.all([
      listMerchantProfiles({ supabaseClient }),
      listMerchantPageSnapshotRows({ supabaseClient }),
    ]);
    merchants = await listActiveMerchantPageMerchants({
      profileByInternalSlug: getProfileByInternalSlug(merchantProfiles),
      supabaseClient,
    });
  } catch {
    return [];
  }

  const profileByInternalSlug = getProfileByInternalSlug(merchantProfiles);

  const snapshotByMerchantSlug = new Map(
    snapshotRows.flatMap((row) => {
      const snapshot = normalizeSnapshotPayload({
        profileByInternalSlug,
        row,
      });

      return snapshot
        ? [[normalizeMerchantSlug(row.merchant_slug), snapshot] as const]
        : [];
    }),
  );

  return merchants
    .map((merchant) =>
      toOverviewItem({
        merchant,
        snapshot: snapshotByMerchantSlug.get(
          normalizeMerchantSlug(merchant.slug),
        ),
      }),
    )
    .sort(
      (left, right) =>
        right.dealCount - left.dealCount ||
        (right.bestSavingsPercentage ?? -1) -
          (left.bestSavingsPercentage ?? -1) ||
        left.merchant.name.localeCompare(right.merchant.name, 'nl-NL') ||
        left.merchant.id.localeCompare(right.merchant.id),
    );
}

export async function getMerchantDeals(
  merchantSlug: string,
  {
    supabaseClient = getMerchantPageSupabaseClient(),
  }: {
    supabaseClient?: CommerceMerchantPageSupabaseClient;
  } = {},
): Promise<CommerceMerchantDealsResult | null> {
  const normalizedRequestedSlug = normalizeMerchantSlug(merchantSlug);

  if (!normalizedRequestedSlug || !supabaseClient) {
    return null;
  }

  let merchants: CommerceMerchantPageMerchant[];
  let profileByInternalSlug: Map<string, CommerceMerchantPublicProfile>;

  try {
    const merchantProfiles = await listMerchantProfiles({ supabaseClient });
    const profileByPublicSlug = getProfileByPublicSlug(merchantProfiles);
    profileByInternalSlug = getProfileByInternalSlug(merchantProfiles);
    const resolvedProfile = profileByPublicSlug.get(normalizedRequestedSlug);
    const normalizedMerchantSlug = normalizeMerchantSlug(
      resolvedProfile?.internalSlug ??
        resolveCommerceMerchantInternalSlug(merchantSlug),
    );

    merchants = (
      await listActiveMerchantPageMerchants({
        profileByInternalSlug,
        supabaseClient,
      })
    ).filter(
      (candidateMerchant) =>
        normalizeMerchantSlug(candidateMerchant.slug) ===
        normalizedMerchantSlug,
    );
  } catch {
    return null;
  }

  const merchant = merchants[0];

  if (!merchant) {
    return null;
  }

  const [snapshotRow] = await listMerchantPageSnapshotRows({
    merchantSlug: merchant.slug,
    supabaseClient,
  });
  const snapshot = snapshotRow
    ? normalizeSnapshotPayload({ profileByInternalSlug, row: snapshotRow })
    : undefined;

  return toMerchantDealsResult({
    merchant,
    snapshot,
  });
}
