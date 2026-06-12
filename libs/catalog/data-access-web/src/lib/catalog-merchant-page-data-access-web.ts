import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { getServerSupabaseConfig } from '@lego-platform/shared/config';
import { createClient } from '@supabase/supabase-js';

const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
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

interface CommerceMerchantPageSnapshotRow {
  generated_at: string;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string;
  snapshot: unknown;
  source_version: string | null;
}

export interface CommerceMerchantPageMerchant {
  affiliateNetwork?: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string;
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

function getMerchantPageSupabaseClient(): CommerceMerchantPageSupabaseClient {
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
): CommerceMerchantPageMerchant {
  return {
    affiliateNetwork: row.affiliate_network ?? undefined,
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes ?? '',
    slug: row.slug,
    sourceType: getAllowedMerchantSourceType(row.source_type),
    updatedAt: row.updated_at,
  };
}

function normalizeMerchantSlug(value: string): string {
  return value.trim().toLocaleLowerCase('nl-NL');
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

function toMerchantDealArray(value: unknown): CommerceMerchantDeal[] {
  return Array.isArray(value) ? value.filter(isMerchantDeal) : [];
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeSnapshotPayload({
  row,
}: {
  row: CommerceMerchantPageSnapshotRow;
}): NormalizedMerchantSnapshot | undefined {
  if (!isRecord(row.snapshot)) {
    return undefined;
  }

  const snapshot = row.snapshot as CommerceMerchantPageSnapshotPayload;

  if (snapshot.version !== MERCHANT_PAGE_SNAPSHOT_VERSION) {
    return undefined;
  }

  const bestDeals = toMerchantDealArray(snapshot.bestDeals);
  const onlyAtMerchantDeals = toMerchantDealArray(snapshot.onlyAtMerchantDeals);

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
  supabaseClient,
}: {
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

  return rows.filter((row) => row.is_active).map(toMerchantPageMerchant);
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
  const [merchants, snapshotRows] = await Promise.all([
    listActiveMerchantPageMerchants({ supabaseClient }),
    listMerchantPageSnapshotRows({ supabaseClient }),
  ]);
  const snapshotByMerchantSlug = new Map(
    snapshotRows.flatMap((row) => {
      const snapshot = normalizeSnapshotPayload({ row });

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
  const normalizedMerchantSlug = normalizeMerchantSlug(merchantSlug);

  if (!normalizedMerchantSlug) {
    return null;
  }

  const merchants = await listActiveMerchantPageMerchants({ supabaseClient });
  const merchant = merchants.find(
    (candidateMerchant) =>
      normalizeMerchantSlug(candidateMerchant.slug) === normalizedMerchantSlug,
  );

  if (!merchant) {
    return null;
  }

  const [snapshotRow] = await listMerchantPageSnapshotRows({
    merchantSlug: merchant.slug,
    supabaseClient,
  });
  const snapshot = snapshotRow
    ? normalizeSnapshotPayload({ row: snapshotRow })
    : undefined;

  return toMerchantDealsResult({
    merchant,
    snapshot,
  });
}
