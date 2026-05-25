import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import {
  type CatalogCanonicalSet,
  type CatalogDiscoverySignal,
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSetConfidence,
  type CatalogSuggestedSet,
  type CatalogSet,
  type CatalogSetDetail,
  type CatalogSetSummary,
  buildCatalogThemeSlug,
  createCatalogSetRecord,
  getCanonicalCatalogSetId,
  resolveCatalogReleaseDatePrecision,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  classifyCommerceCommercialUnitType,
  canStrategicManualOfferBeatProductionFeed,
  compareCommerceCommercialUnitPreference,
  type CommerceCommercialUnitType,
  getCommerceCommercialUnitComparisonGroup,
  getCommerceMerchantReliabilityTier,
  getRebrickableApiConfig,
  hasServerSupabaseConfig,
  resolvePublicMerchantDisplayName,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CATALOG_SETS_TABLE = 'catalog_sets';
export const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE =
  'commerce_current_offer_snapshots';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
const PRICING_DAILY_SET_HISTORY_TABLE = 'pricing_daily_set_history';
const DUTCH_REGION_CODE = 'NL';
const EURO_CURRENCY_CODE = 'EUR';
const NEW_OFFER_CONDITION = 'new';
const CATALOG_DISCOVERY_PRICE_HISTORY_ROWS_PER_SET = 8;
const CURRENT_OFFER_SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

type CatalogSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

export interface CatalogSetSourceMetadataInput {
  catalogSetId: string;
  lastSeenAt: string;
  locale: string;
  matchConfidence: string;
  metadataJson: Readonly<Record<string, unknown>>;
  policy: string;
  setNumber: string;
  source: string;
}

function chunkCatalogRows<TRow>(rows: readonly TRow[], size: number): TRow[][] {
  const chunks: TRow[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function getCatalogSetIdOfferLookupVariants(
  setIds: readonly string[],
): string[] {
  return [
    ...new Set(
      setIds.flatMap((setId) => {
        const canonicalSetId = getCanonicalCatalogSetId(setId);

        if (!canonicalSetId) {
          return [];
        }

        return /^\d{5,6}$/.test(canonicalSetId)
          ? [setId, canonicalSetId, `${canonicalSetId}-1`]
          : [setId, canonicalSetId];
      }),
    ),
  ].filter((setId) => setId.length > 0);
}

interface CatalogOverlaySetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  primary_theme_id?: string | null;
  release_date?: string | null;
  release_date_precision?: string | null;
  release_year: number;
  set_id: string;
  slug: string;
  source: string;
  source_theme_id?: string | null;
  source_set_number: string;
  status: string;
  theme?: string | null;
  updated_at: string;
}

interface CatalogSetMinifigSummaryRow {
  minifig_count: number;
  set_id: string;
}

interface CatalogSourceThemeRow {
  id: string;
  parent_source_theme_id: string | null;
  source_system: 'rebrickable';
  source_theme_name: string;
}

interface CatalogThemeRow {
  display_name: string;
  id: string;
  slug: string;
  status: 'active' | 'inactive';
}

interface CatalogThemeMappingRow {
  primary_theme_id: string;
  source_theme_id: string;
}

interface CatalogCommerceMerchantRow {
  id: string;
  is_active: boolean;
  name: string;
  slug: string;
}

interface CatalogCommerceOfferLatestRow {
  availability: string | null;
  currency_code: string | null;
  fetched_at?: string | null;
  fetch_status: string;
  observed_at: string | null;
  offer_seed_id: string;
  price_minor: number | null;
  updated_at: string;
}

interface CatalogCommerceOfferSeedRow {
  id: string;
  is_active: boolean;
  merchant_id: string;
  notes?: string | null;
  product_url: string;
  set_id: string;
  validation_status: string;
}

interface CatalogCommerceCurrentOfferSnapshotOfferRow {
  availability?: string | null;
  checkedAt?: string | null;
  commercialUnitType?: CommerceCommercialUnitType | null;
  condition?: string | null;
  currency?: string | null;
  market?: string | null;
  merchantName?: string | null;
  merchantSlug?: string | null;
  priceMinor?: number | null;
  setId?: string | null;
  url?: string | null;
}

interface CatalogCommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_commercial_unit_type: CommerceCommercialUnitType | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  computed_at: string | null;
  condition: string | null;
  currency_code: string | null;
  offer_count: number | null;
  offers: unknown;
  region_code: string | null;
  set_id: string;
}

interface CatalogPriceHistoryRow {
  recorded_on: string;
  reference_price_minor: number | null;
  set_id: string;
}

export interface CatalogLiveOffer {
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  checkedAt: string;
  condition: 'new';
  commercialUnitType: CommerceCommercialUnitType;
  currency: 'EUR';
  market: 'NL';
  merchant: 'amazon' | 'bol' | 'lego' | 'other';
  merchantName: string;
  merchantSlug: string;
  priceCents: number;
  setId: string;
  url: string;
}

export interface CatalogCurrentOfferSummaryRecord {
  bestOffer?: CatalogLiveOffer;
  offers: readonly CatalogLiveOffer[];
  setId: string;
}

export interface CatalogDiscoverySignalRecord extends CatalogDiscoverySignal {
  setId: string;
}

interface CatalogReferencePriceSnapshot {
  recordedOn: string;
  referencePriceMinor: number;
}

interface CatalogDiscoveryCurrentOffer {
  commercialUnitType?: CommerceCommercialUnitType;
  merchantSlug: string;
  observedAt: string;
  priceMinor: number;
}

interface ValidatedRebrickableSearchSet {
  imageUrl?: string;
  name: string;
  numParts: number;
  setNumber: string;
  themeId: number;
  year: number;
}

interface ValidatedRebrickableTheme {
  id: number;
  name: string;
  parentId?: number;
}

interface CatalogConflictTarget {
  name: string;
  setId: string;
  slug: string;
}

interface CatalogRebrickableSetThemePayload {
  setNumber: string;
  themeId: number;
}

interface CatalogResolvedThemePersistence {
  primaryTheme: CatalogThemeRow;
  sourceTheme: CatalogSourceThemeRow;
  sourceThemeMapping: CatalogThemeMappingRow;
  sourceThemeParent?: CatalogSourceThemeRow;
}

const CATALOG_SUGGESTED_SET_DEFAULT_LIMIT = 36;
const CATALOG_SUGGESTED_SET_FETCH_PAGE_SIZE = 100;
const CATALOG_SUGGESTED_SET_MAX_PAGES = 3;
const CATALOG_SUGGESTED_SET_RECENT_YEAR_WINDOW = 3;
const CATALOG_OVERLAY_SET_FETCH_PAGE_SIZE = 1000;
const CATALOG_SUGGESTED_EXCLUDED_THEMES = new Set([
  'BrickLink Designer Program',
  'Editions',
  'Other',
  'Pokemon',
  'Pokémon',
]);
const CATALOG_SUGGESTED_PRIMARY_THEME_SCORE_BY_THEME = new Map([
  ['Technic', 240],
  ['Disney', 220],
  ['Icons', 190],
  ['Harry Potter', 185],
  ['Botanicals', 180],
  ['Art', 145],
  ['Ideas', 140],
]);
const CATALOG_SUGGESTED_SECONDARY_THEME_SCORE_BY_THEME = new Map([
  ['Architecture', 95],
  ['Marvel', 90],
  ['Star Wars', 90],
  ['Speed Champions', 85],
  ['Super Mario', 80],
  ['Jurassic World', 70],
  ['Friends', 40],
  ['NINJAGO', 35],
  ['Dreamzzz', 20],
]);

export interface CatalogThemeBackfillResult {
  processedCount: number;
  skippedCount: number;
  updatedCount: number;
}

export interface CatalogZeroPieceRefreshResult {
  checkedCount: number;
  failedCount: number;
  stillUnknownCount: number;
  updatedCount: number;
  updatedSetIds: readonly string[];
}

export interface RefreshZeroPieceSetsOptions {
  fetchImpl?: typeof fetch;
  limit?: number;
  setIds?: readonly string[];
  sourceSetNumbers?: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
}

interface DatabaseConflictLike {
  code?: string;
  details?: string;
  message?: string;
}

function formatSupabaseLikeError(error: {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}): string {
  return [error.message, error.details, error.hint, error.code]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .join(' | ');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function normalizeRuntimeOfferAvailability(
  availability: string | null,
): CatalogLiveOffer['availability'] {
  if (!availability) {
    return 'unknown';
  }

  const normalizedAvailability = availability.trim().toLowerCase();

  if (
    normalizedAvailability === 'in_stock' ||
    normalizedAvailability === 'instock' ||
    normalizedAvailability === 'available' ||
    normalizedAvailability === 'op voorraad'
  ) {
    return 'in_stock';
  }

  if (
    normalizedAvailability === 'out_of_stock' ||
    normalizedAvailability === 'outofstock' ||
    normalizedAvailability === 'unavailable' ||
    normalizedAvailability === 'uitverkocht'
  ) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function normalizeCatalogDiscoveryOfferAvailability(
  availability: string | null,
): 'in_stock' | 'limited' | 'out_of_stock' | 'unknown' {
  if (!availability) {
    return 'unknown';
  }

  const normalizedAvailability = availability.trim().toLowerCase();

  if (
    normalizedAvailability === 'limited' ||
    normalizedAvailability.includes('limited')
  ) {
    return 'limited';
  }

  if (
    normalizedAvailability === 'in_stock' ||
    normalizedAvailability === 'instock' ||
    normalizedAvailability === 'available' ||
    normalizedAvailability === 'op voorraad'
  ) {
    return 'in_stock';
  }

  if (
    normalizedAvailability === 'out_of_stock' ||
    normalizedAvailability === 'outofstock' ||
    normalizedAvailability === 'unavailable' ||
    normalizedAvailability === 'uitverkocht'
  ) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function isEligibleCatalogDiscoveryOfferAvailability(
  availability: string | null,
): boolean {
  const normalizedAvailability =
    normalizeCatalogDiscoveryOfferAvailability(availability);

  return (
    normalizedAvailability === 'in_stock' ||
    normalizedAvailability === 'limited'
  );
}

function selectComparableCatalogDiscoveryOffers(
  currentOffers: readonly CatalogDiscoveryCurrentOffer[],
): CatalogDiscoveryCurrentOffer[] {
  if (currentOffers.length <= 1) {
    return [...currentOffers];
  }

  const priorities = {
    set_package: 0,
    single_item: 1,
    accessory: 2,
    magazine_bonus: 3,
  } as const;
  const preferredGroup = currentOffers
    .map((currentOffer) =>
      getCommerceCommercialUnitComparisonGroup(currentOffer.commercialUnitType),
    )
    .filter((group): group is keyof typeof priorities => group in priorities)
    .sort((left, right) => priorities[left] - priorities[right])[0];

  if (!preferredGroup) {
    return [];
  }

  return currentOffers.filter(
    (currentOffer) =>
      getCommerceCommercialUnitComparisonGroup(
        currentOffer.commercialUnitType,
      ) === preferredGroup,
  );
}

function getCatalogOfferMerchantFromMerchantSlug(
  merchantSlug: string,
): CatalogLiveOffer['merchant'] {
  if (merchantSlug === 'amazon-nl') {
    return 'amazon';
  }

  if (merchantSlug === 'bol') {
    return 'bol';
  }

  if (merchantSlug === 'lego-nl' || merchantSlug === 'rakuten-lego-eu') {
    return 'lego';
  }

  return 'other';
}

function getOfferSortAvailabilityPriority(
  availability: CatalogLiveOffer['availability'],
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

function compareLiveCatalogOfferReliability<Offer extends CatalogLiveOffer>(
  left: Offer,
  right: Offer,
): number {
  const leftTier = getCommerceMerchantReliabilityTier(left.merchantSlug);
  const rightTier = getCommerceMerchantReliabilityTier(right.merchantSlug);

  if (leftTier === rightTier) {
    return 0;
  }

  const leftIsProductionFeed = leftTier === 'production_feed';
  const productionFeedOffer = leftIsProductionFeed ? left : right;
  const strategicManualOffer = leftIsProductionFeed ? right : left;

  if (
    canStrategicManualOfferBeatProductionFeed({
      productionFeedPriceMinor: productionFeedOffer.priceCents,
      strategicManualPriceMinor: strategicManualOffer.priceCents,
    })
  ) {
    return 0;
  }

  return leftIsProductionFeed ? -1 : 1;
}

function sortLiveCatalogOffers<Offer extends CatalogLiveOffer>(
  offers: readonly Offer[],
): Offer[] {
  return [...offers].sort((left, right) => {
    const availabilityPriorityDelta =
      getOfferSortAvailabilityPriority(left.availability) -
      getOfferSortAvailabilityPriority(right.availability);

    if (availabilityPriorityDelta !== 0) {
      return availabilityPriorityDelta;
    }

    const commercialUnitPriorityDelta = compareCommerceCommercialUnitPreference(
      left.commercialUnitType,
      right.commercialUnitType,
    );

    if (commercialUnitPriorityDelta !== 0) {
      return commercialUnitPriorityDelta;
    }

    const reliabilityPriorityDelta = compareLiveCatalogOfferReliability(
      left,
      right,
    );

    if (reliabilityPriorityDelta !== 0) {
      return reliabilityPriorityDelta;
    }

    if (left.priceCents !== right.priceCents) {
      return left.priceCents - right.priceCents;
    }

    return left.merchantName.localeCompare(right.merchantName, 'nl');
  });
}

function selectBestLiveCatalogOffer<Offer extends CatalogLiveOffer>(
  offers: readonly Offer[],
): Offer | undefined {
  return sortLiveCatalogOffers(offers).find(
    (offer) =>
      offer.availability === 'in_stock' &&
      offer.priceCents > 0 &&
      offer.url.length > 0,
  );
}

function isKnownCommercialUnitType(
  value: unknown,
): value is CommerceCommercialUnitType {
  return (
    value === 'full_set' ||
    value === 'display_box' ||
    value === 'blind_bag' ||
    value === 'single_unit' ||
    value === 'accessory' ||
    value === 'magazine_bonus' ||
    value === 'unknown'
  );
}

function normalizeCatalogLiveOfferAvailability(
  availability: string | null | undefined,
): CatalogLiveOffer['availability'] {
  return availability === 'in_stock' || availability === 'out_of_stock'
    ? availability
    : 'unknown';
}

function toCatalogLiveOfferFromSnapshotOffer(
  offer: CatalogCommerceCurrentOfferSnapshotOfferRow,
): CatalogLiveOffer | undefined {
  const setId = getCanonicalCatalogSetId(offer.setId ?? '');
  const merchantSlug = offer.merchantSlug?.trim();
  const merchantName = offer.merchantName?.trim();
  const url = offer.url?.trim();
  const checkedAt = offer.checkedAt?.trim();

  if (
    !setId ||
    !merchantSlug ||
    !merchantName ||
    !url ||
    !checkedAt ||
    offer.currency !== EURO_CURRENCY_CODE ||
    offer.market !== DUTCH_REGION_CODE ||
    offer.condition !== NEW_OFFER_CONDITION ||
    !isInteger(offer.priceMinor) ||
    !isKnownCommercialUnitType(offer.commercialUnitType)
  ) {
    return undefined;
  }

  return {
    availability: normalizeCatalogLiveOfferAvailability(offer.availability),
    checkedAt,
    condition: NEW_OFFER_CONDITION,
    commercialUnitType: offer.commercialUnitType,
    currency: EURO_CURRENCY_CODE,
    market: DUTCH_REGION_CODE,
    merchant: getCatalogOfferMerchantFromMerchantSlug(merchantSlug),
    merchantName: resolvePublicMerchantDisplayName({
      merchantName,
      merchantSlug,
    }),
    merchantSlug,
    priceCents: offer.priceMinor,
    setId,
    url,
  };
}

function toCatalogBestOfferFromSnapshotRow({
  row,
  setId,
}: {
  row: CatalogCommerceCurrentOfferSnapshotRow;
  setId: string;
}): CatalogLiveOffer | undefined {
  if (
    !row.best_checked_at ||
    !row.best_merchant_name ||
    !row.best_merchant_slug ||
    !row.best_product_url ||
    !isInteger(row.best_price_minor) ||
    !isKnownCommercialUnitType(row.best_commercial_unit_type)
  ) {
    return undefined;
  }

  return {
    availability: normalizeCatalogLiveOfferAvailability(row.best_availability),
    checkedAt: row.best_checked_at,
    condition: NEW_OFFER_CONDITION,
    commercialUnitType: row.best_commercial_unit_type,
    currency: EURO_CURRENCY_CODE,
    market: DUTCH_REGION_CODE,
    merchant: getCatalogOfferMerchantFromMerchantSlug(row.best_merchant_slug),
    merchantName: resolvePublicMerchantDisplayName({
      merchantName: row.best_merchant_name,
      merchantSlug: row.best_merchant_slug,
    }),
    merchantSlug: row.best_merchant_slug,
    priceCents: row.best_price_minor,
    setId,
    url: row.best_product_url,
  };
}

function getSnapshotInvalidReason(
  row: CatalogCommerceCurrentOfferSnapshotRow,
  now = new Date(),
): string | undefined {
  if (
    row.region_code !== DUTCH_REGION_CODE ||
    row.currency_code !== EURO_CURRENCY_CODE ||
    row.condition !== NEW_OFFER_CONDITION
  ) {
    return 'invalid_scope';
  }

  if (!row.computed_at) {
    return 'missing_computed_at';
  }

  const computedAt = new Date(row.computed_at);

  if (
    Number.isNaN(computedAt.getTime()) ||
    now.getTime() - computedAt.getTime() > CURRENT_OFFER_SNAPSHOT_MAX_AGE_MS
  ) {
    return 'stale_snapshot';
  }

  if (!isInteger(row.best_price_minor)) {
    return 'missing_best_offer';
  }

  if (!Array.isArray(row.offers)) {
    return 'invalid_offers_json';
  }

  return undefined;
}

function toCatalogCurrentOfferSummaryFromSnapshotRow(
  row: CatalogCommerceCurrentOfferSnapshotRow,
): CatalogCurrentOfferSummaryRecord | undefined {
  const setId = getCanonicalCatalogSetId(row.set_id);
  const bestOffer = toCatalogBestOfferFromSnapshotRow({
    row,
    setId,
  });

  if (!setId || !bestOffer || !Array.isArray(row.offers)) {
    return undefined;
  }

  const offers = row.offers
    .map((offer) =>
      typeof offer === 'object' && offer !== null
        ? toCatalogLiveOfferFromSnapshotOffer(
            offer as CatalogCommerceCurrentOfferSnapshotOfferRow,
          )
        : undefined,
    )
    .filter((offer): offer is CatalogLiveOffer => Boolean(offer));

  if (!offers.length) {
    return undefined;
  }

  return {
    bestOffer,
    offers,
    setId,
  };
}

function toCatalogLiveOffer({
  latestOffer,
  merchant,
  offerSeed,
}: {
  latestOffer: CatalogCommerceOfferLatestRow;
  merchant: CatalogCommerceMerchantRow;
  offerSeed: CatalogCommerceOfferSeedRow;
}): CatalogLiveOffer | undefined {
  if (
    latestOffer.fetch_status !== 'success' ||
    latestOffer.currency_code !== 'EUR' ||
    !isInteger(latestOffer.price_minor)
  ) {
    return undefined;
  }

  const checkedAt =
    latestOffer.observed_at ?? latestOffer.fetched_at ?? latestOffer.updated_at;

  if (!checkedAt) {
    return undefined;
  }

  const commercialUnitType = classifyCommerceCommercialUnitType({
    notes: offerSeed.notes,
    productUrl: offerSeed.product_url,
    setId: offerSeed.set_id,
  });

  return {
    availability: normalizeRuntimeOfferAvailability(latestOffer.availability),
    checkedAt,
    condition: 'new',
    commercialUnitType,
    currency: 'EUR',
    market: 'NL',
    merchant: getCatalogOfferMerchantFromMerchantSlug(merchant.slug),
    merchantName: resolvePublicMerchantDisplayName({
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
    }),
    merchantSlug: merchant.slug,
    priceCents: latestOffer.price_minor,
    setId: getCanonicalCatalogSetId(offerSeed.set_id),
    url: offerSeed.product_url,
  };
}

async function listCatalogLiveOffersBySetIdsInternal({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, CatalogLiveOffer[]>> {
  const uniqueSetIds = [
    ...new Set(
      setIds
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];
  const liveOffersBySetId = new Map(
    uniqueSetIds.map((setId) => [setId, [] as CatalogLiveOffer[]]),
  );

  if (!uniqueSetIds.length) {
    return liveOffersBySetId;
  }

  const setIdLookupVariants = getCatalogSetIdOfferLookupVariants(setIds);

  const { data: seedData, error: seedError } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
    )
    .in('set_id', setIdLookupVariants)
    .eq('is_active', true)
    .eq('validation_status', 'valid');

  if (seedError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

  if (!offerSeeds.length) {
    return liveOffersBySetId;
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
  const offerSeedIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.id)),
  ];
  const [
    { data: merchantData, error: merchantError },
    { data: latestOfferData, error: latestOfferError },
  ] = await Promise.all([
    supabaseClient
      .from(COMMERCE_MERCHANTS_TABLE)
      .select('id, slug, name, is_active')
      .in('id', merchantIds)
      .eq('is_active', true),
    supabaseClient
      .from(COMMERCE_OFFER_LATEST_TABLE)
      .select(
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
      )
      .in('offer_seed_id', offerSeedIds)
      .order('updated_at', {
        ascending: false,
      }),
  ]);

  if (merchantError || latestOfferError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const merchantById = new Map(
    ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
      (merchantRow) => [merchantRow.id, merchantRow],
    ),
  );
  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOfferRow of (latestOfferData as
    | CatalogCommerceOfferLatestRow[]
    | null) ?? []) {
    if (!latestOfferBySeedId.has(latestOfferRow.offer_seed_id)) {
      latestOfferBySeedId.set(latestOfferRow.offer_seed_id, latestOfferRow);
    }
  }

  for (const offerSeed of offerSeeds) {
    const merchant = merchantById.get(offerSeed.merchant_id);
    const latestOffer = latestOfferBySeedId.get(offerSeed.id);

    if (!merchant || !latestOffer) {
      continue;
    }

    const catalogLiveOffer = toCatalogLiveOffer({
      latestOffer,
      merchant,
      offerSeed,
    });

    if (!catalogLiveOffer) {
      continue;
    }

    const existingOffers = liveOffersBySetId.get(
      getCanonicalCatalogSetId(offerSeed.set_id),
    );

    if (!existingOffers) {
      continue;
    }

    existingOffers.push(catalogLiveOffer);
  }

  return new Map(
    [...liveOffersBySetId.entries()].map(([setId, offers]) => [
      setId,
      sortLiveCatalogOffers(offers),
    ]),
  );
}

function shouldLogCurrentOfferSnapshotDiagnostics({
  fallbackCount,
  invalidSample,
}: {
  fallbackCount: number;
  invalidSample: readonly Record<string, unknown>[];
}): boolean {
  return (
    process.env['DEBUG_CURRENT_OFFER_SNAPSHOT_READ'] === 'true' ||
    fallbackCount > 0 ||
    invalidSample.length > 0
  );
}

function logCurrentOfferSnapshotDiagnostics({
  invalidSample,
  liveFallbackCount,
  liveFallbackDurationMs,
  requestedCount,
  snapshotDurationMs,
  snapshotHitCount,
  snapshotMissingBestOfferCount,
  snapshotMissCount,
  snapshotStaleCount,
}: {
  invalidSample: readonly Record<string, unknown>[];
  liveFallbackCount: number;
  liveFallbackDurationMs: number;
  requestedCount: number;
  snapshotDurationMs: number;
  snapshotHitCount: number;
  snapshotMissingBestOfferCount: number;
  snapshotMissCount: number;
  snapshotStaleCount: number;
}): void {
  if (
    !shouldLogCurrentOfferSnapshotDiagnostics({
      fallbackCount: liveFallbackCount,
      invalidSample,
    })
  ) {
    return;
  }

  console.info(
    [
      '[catalog-current-offer-snapshots]',
      `snapshot_requested_count=${requestedCount}`,
      `snapshot_hit_count=${snapshotHitCount}`,
      `snapshot_miss_count=${snapshotMissCount}`,
      `snapshot_stale_count=${snapshotStaleCount}`,
      `snapshot_missing_best_offer_count=${snapshotMissingBestOfferCount}`,
      `live_fallback_count=${liveFallbackCount}`,
      `snapshot_read_duration_ms=${snapshotDurationMs}`,
      `live_fallback_duration_ms=${liveFallbackDurationMs}`,
      invalidSample.length
        ? `snapshot_invalid_sample=${JSON.stringify(invalidSample)}`
        : undefined,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' '),
  );
}

async function listCatalogCurrentOfferSnapshotsBySetIds({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<{
  fallbackSetIds: string[];
  invalidSample: Record<string, unknown>[];
  snapshotMissingBestOfferCount: number;
  snapshotStaleCount: number;
  summaryBySetId: Map<string, CatalogCurrentOfferSummaryRecord>;
}> {
  const summaryBySetId = new Map<string, CatalogCurrentOfferSummaryRecord>();
  const fallbackSetIds = new Set(setIds);
  const invalidSample: Record<string, unknown>[] = [];
  let snapshotMissingBestOfferCount = 0;
  let snapshotStaleCount = 0;

  const { data, error } = await supabaseClient
    .from(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, best_availability, best_checked_at, best_commercial_unit_type, best_merchant_name, best_merchant_slug, best_price_minor, best_product_url, offer_count, offers, computed_at',
    )
    .in('set_id', setIds);

  if (error) {
    return {
      fallbackSetIds: [...fallbackSetIds],
      invalidSample: [
        {
          reason: 'snapshot_query_failed',
        },
      ],
      snapshotMissingBestOfferCount,
      snapshotStaleCount,
      summaryBySetId,
    };
  }

  for (const row of (data as CatalogCommerceCurrentOfferSnapshotRow[] | null) ??
    []) {
    const setId = getCanonicalCatalogSetId(row.set_id);

    if (!setId) {
      continue;
    }

    const invalidReason = getSnapshotInvalidReason(row);

    if (invalidReason) {
      if (invalidReason === 'stale_snapshot') {
        snapshotStaleCount += 1;
      }

      if (invalidReason === 'missing_best_offer') {
        snapshotMissingBestOfferCount += 1;
      }

      if (invalidSample.length < 5) {
        invalidSample.push({
          reason: invalidReason,
          setId,
        });
      }

      continue;
    }

    const summary = toCatalogCurrentOfferSummaryFromSnapshotRow(row);

    if (!summary) {
      if (invalidSample.length < 5) {
        invalidSample.push({
          reason: 'snapshot_parse_failed',
          setId,
        });
      }

      continue;
    }

    fallbackSetIds.delete(setId);
    summaryBySetId.set(setId, summary);
  }

  return {
    fallbackSetIds: [...fallbackSetIds],
    invalidSample,
    snapshotMissingBestOfferCount,
    snapshotStaleCount,
    summaryBySetId,
  };
}

function toCatalogSet({
  row,
  themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: row.theme ?? 'Unknown',
  }),
}: {
  row: CatalogOverlaySetRow;
  themeIdentity?: ReturnType<typeof resolveCatalogThemeIdentity>;
}): CatalogSet {
  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieces: row.piece_count,
    primaryThemeId: row.primary_theme_id ?? undefined,
    ...(row.release_date
      ? {
          releaseDate: row.release_date,
        }
      : {}),
    releaseDatePrecision: resolveCatalogReleaseDatePrecision({
      releaseDate: row.release_date ?? undefined,
      releaseDatePrecision:
        row.release_date_precision === 'day' ||
        row.release_date_precision === 'month' ||
        row.release_date_precision === 'year' ||
        row.release_date_precision === 'unknown'
          ? row.release_date_precision
          : undefined,
      releaseYear: row.release_year,
    }),
    releaseYear: row.release_year,
    secondaryThemeLabels: themeIdentity.secondaryThemes,
    setId: row.set_id,
    slug: row.slug,
    source: row.source === 'rebrickable' ? 'rebrickable' : 'rebrickable',
    sourceThemeId: row.source_theme_id ?? undefined,
    sourceSetNumber: row.source_set_number,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    theme: themeIdentity.primaryTheme,
    updatedAt: row.updated_at,
  };
}

function toCanonicalCatalogSetFromOverlaySet(
  overlaySet: CatalogSet,
): CatalogCanonicalSet {
  const themeIdentity = overlaySet.secondaryThemeLabels
    ? {
        primaryTheme: overlaySet.theme,
        secondaryThemes: overlaySet.secondaryThemeLabels,
      }
    : resolveCatalogThemeIdentity({
        rawTheme: overlaySet.theme,
      });

  return {
    createdAt: overlaySet.createdAt,
    imageUrl: overlaySet.imageUrl,
    name: overlaySet.name,
    pieceCount: overlaySet.pieces,
    primaryTheme: themeIdentity.primaryTheme,
    ...(overlaySet.releaseDate
      ? {
          releaseDate: overlaySet.releaseDate,
        }
      : {}),
    releaseDatePrecision: overlaySet.releaseDatePrecision,
    releaseYear: overlaySet.releaseYear,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: overlaySet.setId,
    slug: overlaySet.slug,
    source: overlaySet.source,
    sourceSetNumber: overlaySet.sourceSetNumber,
    status: overlaySet.status,
    updatedAt: overlaySet.updatedAt,
  };
}

function toCatalogSummaryFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetSummary {
  return {
    createdAt: canonicalCatalogSet.createdAt,
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    ...(canonicalCatalogSet.releaseDate
      ? {
          releaseDate: canonicalCatalogSet.releaseDate,
        }
      : {}),
    releaseDatePrecision: canonicalCatalogSet.releaseDatePrecision,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
  };
}

function toCatalogSetDetailFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetDetail {
  return {
    createdAt: canonicalCatalogSet.createdAt,
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    ...(canonicalCatalogSet.releaseDate
      ? {
          releaseDate: canonicalCatalogSet.releaseDate,
        }
      : {}),
    releaseDatePrecision: canonicalCatalogSet.releaseDatePrecision,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
    ...(typeof canonicalCatalogSet.minifigureCount === 'number'
      ? {
          minifigureCount: canonicalCatalogSet.minifigureCount,
        }
      : {}),
    ...(canonicalCatalogSet.secondaryLabels[0]
      ? {
          subtheme: canonicalCatalogSet.secondaryLabels[0],
        }
      : {}),
    ...(canonicalCatalogSet.imageUrl
      ? {
          images: [
            {
              order: 0,
              type: 'hero',
              url: canonicalCatalogSet.imageUrl,
            },
          ],
          primaryImage: canonicalCatalogSet.imageUrl,
        }
      : {}),
  };
}

async function getCatalogSetMinifigCountBySetId({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: CatalogSupabaseClient;
}): Promise<number | undefined> {
  const { data, error } = await supabaseClient
    .from(CATALOG_SET_MINIFIG_SUMMARIES_TABLE)
    .select('set_id, minifig_count')
    .eq('set_id', setId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load catalog set minifig summary.');
  }

  const summary = data as CatalogSetMinifigSummaryRow | null;

  if (!summary || typeof summary.minifig_count !== 'number') {
    return undefined;
  }

  return summary.minifig_count;
}

async function listCatalogThemeIdentityBySetId({
  overlayRows,
  supabaseClient,
}: {
  overlayRows: readonly CatalogOverlaySetRow[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, ReturnType<typeof resolveCatalogThemeIdentity>>> {
  const fallbackThemeIdentityBySetId = new Map(
    overlayRows.map((overlayRow) => [
      overlayRow.set_id,
      resolveCatalogThemeIdentity({
        rawTheme: overlayRow.theme ?? 'Unknown',
      }),
    ]),
  );
  const sourceThemeIds = [
    ...new Set(
      overlayRows
        .map((overlayRow) => overlayRow.source_theme_id)
        .filter((sourceThemeId): sourceThemeId is string =>
          Boolean(sourceThemeId),
        ),
    ),
  ];
  const primaryThemeIds = [
    ...new Set(
      overlayRows
        .map((overlayRow) => overlayRow.primary_theme_id)
        .filter((primaryThemeId): primaryThemeId is string =>
          Boolean(primaryThemeId),
        ),
    ),
  ];

  if (!sourceThemeIds.length && !primaryThemeIds.length) {
    return fallbackThemeIdentityBySetId;
  }

  try {
    const [sourceThemeResponse, themeMappingResponse] = await Promise.all([
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_SOURCE_THEMES_TABLE)
            .select('id, source_theme_name')
            .in('id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_THEME_MAPPINGS_TABLE)
            .select('source_theme_id, primary_theme_id')
            .in('source_theme_id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sourceThemeResponse.error || themeMappingResponse.error) {
      return fallbackThemeIdentityBySetId;
    }

    const sourceThemes =
      (sourceThemeResponse.data as CatalogSourceThemeRow[]) ?? [];
    const themeMappings =
      (themeMappingResponse.data as CatalogThemeMappingRow[]) ?? [];
    const primaryThemeIdsToLoad = [
      ...new Set([
        ...primaryThemeIds,
        ...themeMappings.map((themeMapping) => themeMapping.primary_theme_id),
      ]),
    ];
    const primaryThemeResponse = primaryThemeIdsToLoad.length
      ? await supabaseClient
          .from(CATALOG_THEMES_TABLE)
          .select('id, slug, display_name, status')
          .in('id', primaryThemeIdsToLoad)
      : { data: [], error: null };

    if (primaryThemeResponse.error) {
      return fallbackThemeIdentityBySetId;
    }

    const sourceThemeById = new Map(
      sourceThemes.map((sourceTheme) => [sourceTheme.id, sourceTheme]),
    );
    const primaryThemeById = new Map(
      ((primaryThemeResponse.data as CatalogThemeRow[]) ?? []).map(
        (catalogTheme) => [catalogTheme.id, catalogTheme],
      ),
    );
    const primaryThemeIdBySourceThemeId = new Map(
      themeMappings.map((themeMapping) => [
        themeMapping.source_theme_id,
        themeMapping.primary_theme_id,
      ]),
    );

    return new Map(
      overlayRows.map((overlayRow) => {
        const sourceThemeName = overlayRow.source_theme_id
          ? sourceThemeById.get(overlayRow.source_theme_id)?.source_theme_name
          : undefined;
        const primaryThemeId =
          overlayRow.primary_theme_id ??
          (overlayRow.source_theme_id
            ? primaryThemeIdBySourceThemeId.get(overlayRow.source_theme_id)
            : undefined);
        const primaryThemeName = primaryThemeId
          ? primaryThemeById.get(primaryThemeId)?.display_name
          : undefined;

        return [
          overlayRow.set_id,
          resolveCatalogThemeIdentityFromPersistence({
            legacyTheme:
              overlayRow.theme ??
              sourceThemeName ??
              primaryThemeName ??
              'Unknown',
            primaryThemeName,
            sourceThemeName,
          }),
        ] as const;
      }),
    );
  } catch {
    return fallbackThemeIdentityBySetId;
  }
}

function buildCatalogConflictTargetLabel(
  conflictTarget: CatalogConflictTarget,
) {
  return `${conflictTarget.name} (${conflictTarget.setId})`;
}

function buildCatalogSetIdConflictMessage({
  conflictTarget,
}: {
  conflictTarget: CatalogConflictTarget;
}) {
  return `Set ${conflictTarget.setId} staat al in de Brickhunt-catalogus als ${buildCatalogConflictTargetLabel(conflictTarget)}.`;
}

function buildCatalogSetSlugConflictMessage({
  conflictTarget,
  slug,
}: {
  conflictTarget?: CatalogConflictTarget;
  slug: string;
}) {
  return conflictTarget
    ? `Deze set kan niet worden toegevoegd, omdat slug "${slug}" al gebruikt wordt door ${buildCatalogConflictTargetLabel(conflictTarget)}.`
    : `Deze set kan niet worden toegevoegd, omdat slug "${slug}" al in Brickhunt gebruikt wordt.`;
}

function toCatalogConflictTarget(
  catalogSet: Pick<CatalogSetSummary, 'id' | 'name' | 'slug'>,
): CatalogConflictTarget;
function toCatalogConflictTarget(
  catalogSet: Pick<CatalogSet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget;
function toCatalogConflictTarget(
  catalogSet: Pick<CatalogCanonicalSet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget;
function toCatalogConflictTarget(
  catalogSet:
    | Pick<CatalogSetSummary, 'id' | 'name' | 'slug'>
    | Pick<CatalogSet, 'setId' | 'name' | 'slug'>
    | Pick<CatalogCanonicalSet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget {
  return {
    name: catalogSet.name,
    setId: 'id' in catalogSet ? catalogSet.id : catalogSet.setId,
    slug: catalogSet.slug,
  };
}

function getCatalogSetInsertConflictMessage({
  existingCatalogSets,
  error,
  normalizedSet,
}: {
  existingCatalogSets: readonly CatalogCanonicalSet[];
  error: DatabaseConflictLike;
  normalizedSet: CatalogExternalSetSearchResult;
}) {
  if (error.code !== '23505') {
    return null;
  }

  const rawConflictText =
    `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const slugConflict = existingCatalogSets.find(
    (catalogSet) => catalogSet.slug === normalizedSet.slug,
  );

  if (rawConflictText.includes('slug')) {
    return buildCatalogSetSlugConflictMessage({
      conflictTarget: slugConflict
        ? toCatalogConflictTarget(slugConflict)
        : undefined,
      slug: normalizedSet.slug,
    });
  }

  const setConflict = existingCatalogSets.find(
    (catalogSet) => catalogSet.setId === normalizedSet.setId,
  );

  if (setConflict) {
    return buildCatalogSetIdConflictMessage({
      conflictTarget: toCatalogConflictTarget(setConflict),
    });
  }

  return `Set ${normalizedSet.setId} bestaat al in Brickhunt of wordt op dit moment al toegevoegd.`;
}

function validateRebrickableSearchPayload(payload: unknown): unknown[] {
  if (!isObjectRecord(payload) || !Array.isArray(payload['results'])) {
    throw new Error(
      'Invalid Rebrickable search payload: expected a paginated results list.',
    );
  }

  return payload['results'];
}

function validateRebrickableSearchSetPayload(
  payload: unknown,
): ValidatedRebrickableSearchSet {
  if (!isObjectRecord(payload)) {
    throw new Error('Invalid Rebrickable search result: expected an object.');
  }

  const {
    name,
    num_parts: numParts,
    set_img_url: setImgUrl,
    set_num: setNumber,
    theme_id: themeId,
    year,
  } = payload;

  if (typeof setNumber !== 'string' || !setNumber.trim()) {
    throw new Error('Invalid Rebrickable search result: set_num is required.');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Invalid Rebrickable search result: name is required.');
  }

  if (!isInteger(year) || year < 1940) {
    throw new Error('Invalid Rebrickable search result: year is invalid.');
  }

  if (!isInteger(numParts) || numParts < 0) {
    throw new Error(
      'Invalid Rebrickable search result: num_parts must be a non-negative integer.',
    );
  }

  if (!isInteger(themeId) || themeId <= 0) {
    throw new Error(
      'Invalid Rebrickable search result: theme_id must be a positive integer.',
    );
  }

  if (
    setImgUrl !== undefined &&
    setImgUrl !== null &&
    typeof setImgUrl !== 'string'
  ) {
    throw new Error(
      'Invalid Rebrickable search result: set_img_url must be a string when present.',
    );
  }

  return {
    imageUrl:
      typeof setImgUrl === 'string' && setImgUrl.trim()
        ? setImgUrl.trim()
        : undefined,
    name: name.trim(),
    numParts,
    setNumber: setNumber.trim(),
    themeId,
    year,
  };
}

function createExactRebrickableSetLookupQueries(query: string): string[] {
  const normalizedQuery = query.trim();

  if (!/^\d+(?:-[0-9A-Za-z]+)?$/u.test(normalizedQuery)) {
    return [];
  }

  const queries = [normalizedQuery];

  if (/^\d+$/u.test(normalizedQuery)) {
    queries.push(`${normalizedQuery}-1`);
  }

  return [...new Set(queries)];
}

async function lookupExactRebrickableSearchSets({
  query,
  rebrickableClient,
}: {
  query: string;
  rebrickableClient: ReturnType<typeof createRebrickableClient>;
}): Promise<ValidatedRebrickableSearchSet[]> {
  const exactLookupQueries = createExactRebrickableSetLookupQueries(query);
  const exactLookupResults = await Promise.all(
    exactLookupQueries.map(async (exactLookupQuery) => {
      try {
        return validateRebrickableSearchSetPayload(
          await rebrickableClient.getSet(exactLookupQuery),
        );
      } catch {
        return undefined;
      }
    }),
  );

  return exactLookupResults.filter(
    (exactLookupResult): exactLookupResult is ValidatedRebrickableSearchSet =>
      exactLookupResult !== undefined,
  );
}

function validateRebrickableThemePayload(
  payload: unknown,
  expectedThemeId: number,
): ValidatedRebrickableTheme {
  if (!isObjectRecord(payload)) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: expected an object.`,
    );
  }

  const { id, name, parent_id: parentId } = payload;

  if (!isInteger(id) || id !== expectedThemeId) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: id is missing or mismatched.`,
    );
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: name is required.`,
    );
  }

  if (
    parentId !== undefined &&
    parentId !== null &&
    (!isInteger(parentId) || parentId <= 0)
  ) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: parent_id must be a positive integer when present.`,
    );
  }

  return {
    id,
    name: name.trim(),
    ...(isInteger(parentId)
      ? {
          parentId,
        }
      : {}),
  };
}

function validateRebrickableSetThemePayload(
  payload: unknown,
  expectedSetNumber: string,
): CatalogRebrickableSetThemePayload {
  if (!isObjectRecord(payload)) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: expected an object.`,
    );
  }

  const { set_num: setNumber, theme_id: themeId } = payload;

  if (typeof setNumber !== 'string' || setNumber.trim() !== expectedSetNumber) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: set_num is missing or mismatched.`,
    );
  }

  if (!isInteger(themeId) || themeId <= 0) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: theme_id must be a positive integer.`,
    );
  }

  return {
    setNumber: setNumber.trim(),
    themeId,
  };
}

function validateRebrickableSetPayload(
  payload: unknown,
  expectedSetNumber: string,
): ValidatedRebrickableSearchSet {
  const validatedSet = validateRebrickableSearchSetPayload(payload);

  if (validatedSet.setNumber !== expectedSetNumber) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: set_num is missing or mismatched.`,
    );
  }

  return validatedSet;
}

async function getValidatedRebrickableTheme({
  rebrickableClient,
  themeCache,
  themeId,
}: {
  rebrickableClient: ReturnType<typeof createRebrickableClient>;
  themeCache: Map<number, ValidatedRebrickableTheme>;
  themeId: number;
}): Promise<ValidatedRebrickableTheme> {
  const cachedTheme = themeCache.get(themeId);

  if (cachedTheme) {
    return cachedTheme;
  }

  const validatedTheme = validateRebrickableThemePayload(
    await rebrickableClient.getTheme(themeId),
    themeId,
  );

  themeCache.set(validatedTheme.id, validatedTheme);

  return validatedTheme;
}

async function resolveRebrickablePrimaryThemeName({
  rebrickableClient,
  resolvedThemeNameById,
  themeCache,
  themeId,
  visitedThemeIds = new Set<number>(),
}: {
  rebrickableClient: ReturnType<typeof createRebrickableClient>;
  resolvedThemeNameById: Map<number, string>;
  themeCache: Map<number, ValidatedRebrickableTheme>;
  themeId: number;
  visitedThemeIds?: Set<number>;
}): Promise<string> {
  const cachedThemeName = resolvedThemeNameById.get(themeId);

  if (cachedThemeName) {
    return cachedThemeName;
  }

  if (visitedThemeIds.has(themeId)) {
    throw new Error(
      `Invalid Rebrickable theme hierarchy: recursive parent detected for ${themeId}.`,
    );
  }

  visitedThemeIds.add(themeId);

  const validatedTheme = await getValidatedRebrickableTheme({
    rebrickableClient,
    themeCache,
    themeId,
  });
  const parentThemeName = validatedTheme.parentId
    ? await resolveRebrickablePrimaryThemeName({
        rebrickableClient,
        resolvedThemeNameById,
        themeCache,
        themeId: validatedTheme.parentId,
        visitedThemeIds,
      })
    : undefined;
  const resolvedThemeName = resolveCatalogThemeIdentity({
    rawTheme: validatedTheme.name,
    ...(parentThemeName
      ? {
          parentTheme: parentThemeName,
        }
      : {}),
  }).primaryTheme;

  resolvedThemeNameById.set(themeId, resolvedThemeName);

  return resolvedThemeName;
}

function buildCatalogSourceThemeRecordId({
  sourceSystem,
  sourceThemeId,
}: {
  sourceSystem: 'rebrickable';
  sourceThemeId: number;
}): string {
  return `${sourceSystem}:${sourceThemeId}`;
}

function buildCatalogThemeRecordId(primaryThemeName: string): string {
  return `theme:${buildCatalogThemeSlug(primaryThemeName)}`;
}

async function resolveCatalogThemePersistenceForSourceSetNumber({
  fetchImpl,
  rebrickableClient,
  resolvedThemeNameById,
  sourceSetNumber,
  themeCache,
}: {
  fetchImpl?: typeof fetch;
  rebrickableClient?: ReturnType<typeof createRebrickableClient>;
  resolvedThemeNameById?: Map<number, string>;
  sourceSetNumber: string;
  themeCache?: Map<number, ValidatedRebrickableTheme>;
}): Promise<CatalogResolvedThemePersistence> {
  const activeThemeCache =
    themeCache ?? new Map<number, ValidatedRebrickableTheme>();
  const activeResolvedThemeNameById =
    resolvedThemeNameById ?? new Map<number, string>();
  const activeRebrickableClient =
    rebrickableClient ??
    createRebrickableClient({
      apiKey: getRebrickableApiConfig().apiKey,
      baseUrl: getRebrickableApiConfig().baseUrl,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  const validatedSetThemePayload = validateRebrickableSetThemePayload(
    await activeRebrickableClient.getSet(sourceSetNumber),
    sourceSetNumber,
  );
  const sourceTheme = await getValidatedRebrickableTheme({
    rebrickableClient: activeRebrickableClient,
    themeCache: activeThemeCache,
    themeId: validatedSetThemePayload.themeId,
  });
  const parentSourceTheme = sourceTheme.parentId
    ? await getValidatedRebrickableTheme({
        rebrickableClient: activeRebrickableClient,
        themeCache: activeThemeCache,
        themeId: sourceTheme.parentId,
      })
    : undefined;
  const primaryTheme = resolveCatalogThemeIdentity({
    rawTheme: sourceTheme.name,
    ...(parentSourceTheme
      ? {
          parentTheme: parentSourceTheme.name,
        }
      : {}),
  }).primaryTheme;
  const primaryThemeId = buildCatalogThemeRecordId(primaryTheme);

  if (parentSourceTheme) {
    activeResolvedThemeNameById.set(
      parentSourceTheme.id,
      parentSourceTheme.name,
    );
  }

  activeResolvedThemeNameById.set(sourceTheme.id, primaryTheme);

  return {
    primaryTheme: {
      display_name: primaryTheme,
      id: primaryThemeId,
      slug: buildCatalogThemeSlug(primaryTheme),
      status: 'active',
    },
    sourceTheme: {
      id: buildCatalogSourceThemeRecordId({
        sourceSystem: 'rebrickable',
        sourceThemeId: sourceTheme.id,
      }),
      parent_source_theme_id: parentSourceTheme
        ? buildCatalogSourceThemeRecordId({
            sourceSystem: 'rebrickable',
            sourceThemeId: parentSourceTheme.id,
          })
        : null,
      source_system: 'rebrickable',
      source_theme_name: sourceTheme.name,
    },
    sourceThemeMapping: {
      primary_theme_id: primaryThemeId,
      source_theme_id: buildCatalogSourceThemeRecordId({
        sourceSystem: 'rebrickable',
        sourceThemeId: sourceTheme.id,
      }),
    },
    ...(parentSourceTheme
      ? {
          sourceThemeParent: {
            id: buildCatalogSourceThemeRecordId({
              sourceSystem: 'rebrickable',
              sourceThemeId: parentSourceTheme.id,
            }),
            parent_source_theme_id: null,
            source_system: 'rebrickable' as const,
            source_theme_name: parentSourceTheme.name,
          },
        }
      : {}),
  };
}

async function ensureCatalogThemePersistence({
  supabaseClient,
  themePersistence,
}: {
  supabaseClient: CatalogSupabaseClient;
  themePersistence: CatalogResolvedThemePersistence;
}): Promise<void> {
  if (themePersistence.sourceThemeParent) {
    const { error } = await supabaseClient
      .from(CATALOG_SOURCE_THEMES_TABLE)
      .upsert(themePersistence.sourceThemeParent, {
        onConflict: 'id',
      });

    if (error) {
      throw new Error(
        `Unable to persist the parent source theme. ${formatSupabaseLikeError(error)}`,
      );
    }
  }

  const [{ error: sourceThemeError }, { error: primaryThemeError }] =
    await Promise.all([
      supabaseClient
        .from(CATALOG_SOURCE_THEMES_TABLE)
        .upsert(themePersistence.sourceTheme, {
          onConflict: 'id',
        }),
      supabaseClient
        .from(CATALOG_THEMES_TABLE)
        .upsert(themePersistence.primaryTheme, {
          onConflict: 'id',
        }),
    ]);

  if (sourceThemeError) {
    throw new Error(
      `Unable to persist the source theme. ${formatSupabaseLikeError(sourceThemeError)}`,
    );
  }

  if (primaryThemeError) {
    throw new Error(
      `Unable to persist the primary theme. ${formatSupabaseLikeError(primaryThemeError)}`,
    );
  }

  const { error: sourceThemeMappingError } = await supabaseClient
    .from(CATALOG_THEME_MAPPINGS_TABLE)
    .upsert(themePersistence.sourceThemeMapping, {
      onConflict: 'source_theme_id',
    });

  if (sourceThemeMappingError) {
    throw new Error(
      `Unable to persist the source-to-primary theme mapping. ${formatSupabaseLikeError(sourceThemeMappingError)}`,
    );
  }
}

function toSearchResult({
  imageUrl,
  name,
  numParts,
  setNumber,
  themeName,
  year,
}: {
  imageUrl?: string;
  name: string;
  numParts: number;
  setNumber: string;
  themeName: string;
  year: number;
}): CatalogExternalSetSearchResult {
  const catalogSetRecord = createCatalogSetRecord({
    sourceSetNumber: setNumber,
    name,
    theme: themeName,
    releaseYear: year,
    pieces: numParts,
    imageUrl,
  });

  return {
    imageUrl: catalogSetRecord.imageUrl,
    name: catalogSetRecord.name,
    pieces: catalogSetRecord.pieces,
    releaseYear: catalogSetRecord.releaseYear,
    setId: catalogSetRecord.canonicalId,
    slug: catalogSetRecord.slug,
    source: 'rebrickable',
    sourceSetNumber: catalogSetRecord.sourceSetNumber,
    theme: catalogSetRecord.theme,
  };
}

function getCanonicalCatalogSetIdFromSourceSetNumber(
  setNumber: string,
): string {
  return createCatalogSetRecord({
    name: 'placeholder',
    pieces: 1,
    releaseYear: 2000,
    sourceSetNumber: setNumber,
    theme: 'placeholder',
  }).canonicalId;
}

function getCatalogSuggestedThemeFit(themeName: string): {
  isExcluded: boolean;
  isRetailFriendlyTheme: boolean;
  score: number;
} {
  if (CATALOG_SUGGESTED_EXCLUDED_THEMES.has(themeName)) {
    return {
      isExcluded: true,
      isRetailFriendlyTheme: false,
      score: Number.NEGATIVE_INFINITY,
    };
  }

  const primaryThemeScore =
    CATALOG_SUGGESTED_PRIMARY_THEME_SCORE_BY_THEME.get(themeName);

  if (typeof primaryThemeScore === 'number') {
    return {
      isExcluded: false,
      isRetailFriendlyTheme: true,
      score: primaryThemeScore,
    };
  }

  const secondaryThemeScore =
    CATALOG_SUGGESTED_SECONDARY_THEME_SCORE_BY_THEME.get(themeName);

  if (typeof secondaryThemeScore === 'number') {
    return {
      isExcluded: false,
      isRetailFriendlyTheme: false,
      score: secondaryThemeScore,
    };
  }

  return {
    isExcluded: false,
    isRetailFriendlyTheme: false,
    score: 45,
  };
}

function getCatalogSuggestedRecencyScore({
  currentYear,
  releaseYear,
}: {
  currentYear: number;
  releaseYear: number;
}): number {
  const yearDelta = Math.max(0, currentYear - releaseYear);

  if (yearDelta === 0) {
    return 95;
  }

  if (yearDelta === 1) {
    return 72;
  }

  if (yearDelta === 2) {
    return 48;
  }

  return 20;
}

function getCatalogSuggestedPieceBandScore(pieces: number): number {
  if (pieces < 250) {
    return -50;
  }

  if (pieces < 500) {
    return -20;
  }

  if (pieces < 900) {
    return 12;
  }

  if (pieces < 1800) {
    return 42;
  }

  if (pieces < 3200) {
    return 60;
  }

  if (pieces < 5000) {
    return 38;
  }

  return 24;
}

function buildCatalogSuggestedSetScore({
  currentYear,
  pieces,
  releaseYear,
  themeFitScore,
}: {
  currentYear: number;
  pieces: number;
  releaseYear: number;
  themeFitScore: number;
}): number {
  return (
    themeFitScore +
    getCatalogSuggestedRecencyScore({
      currentYear,
      releaseYear,
    }) +
    getCatalogSuggestedPieceBandScore(pieces)
  );
}

function getCatalogSuggestedConfidence({
  isRetailFriendlyTheme,
  score,
  themeName,
}: {
  isRetailFriendlyTheme: boolean;
  score: number;
  themeName: string;
}): CatalogSuggestedSetConfidence {
  if (CATALOG_SUGGESTED_EXCLUDED_THEMES.has(themeName)) {
    return 'experimental';
  }

  if (isRetailFriendlyTheme && score >= 250) {
    return 'high';
  }

  if (score >= 150) {
    return 'medium';
  }

  return 'experimental';
}

function sortCatalogSuggestedSets(
  suggestions: readonly CatalogSuggestedSet[],
): CatalogSuggestedSet[] {
  return [...suggestions].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.releaseYear !== left.releaseYear) {
      return right.releaseYear - left.releaseYear;
    }

    if (right.pieces !== left.pieces) {
      return right.pieces - left.pieces;
    }

    return left.setId.localeCompare(right.setId);
  });
}

async function listCatalogOverlaySetRows({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogSupabaseClient;
}): Promise<CatalogOverlaySetRow[]> {
  const rows: CatalogOverlaySetRow[] = [];

  for (let offset = 0; ; offset += CATALOG_OVERLAY_SET_FETCH_PAGE_SIZE) {
    let query = supabaseClient
      .from(CATALOG_SETS_TABLE)
      .select(
        'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
      );

    if (!includeInactive) {
      query = query.eq('status', 'active');
    }

    query = query.order('created_at', { ascending: false });

    if ('range' in query && typeof query.range === 'function') {
      query = query.range(
        offset,
        offset + CATALOG_OVERLAY_SET_FETCH_PAGE_SIZE - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Unable to load catalog sets.');
    }

    const pageRows = (data as CatalogOverlaySetRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CATALOG_OVERLAY_SET_FETCH_PAGE_SIZE) {
      break;
    }

    if (!('range' in query) || typeof query.range !== 'function') {
      break;
    }
  }

  return rows;
}

async function getCatalogOverlaySetByColumn({
  column,
  includeInactive = false,
  supabaseClient,
  value,
}: {
  column: 'set_id' | 'slug';
  includeInactive?: boolean;
  supabaseClient: CatalogSupabaseClient;
  value: string;
}): Promise<CatalogSet | undefined> {
  let query = supabaseClient
    .from(CATALOG_SETS_TABLE)
    .select(
      'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
    )
    .eq(column, value);

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error('Unable to load catalog set.');
  }

  if (!data) {
    return undefined;
  }

  const row = data as CatalogOverlaySetRow;
  const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
    overlayRows: [row],
    supabaseClient,
  });

  return toCatalogSet({
    row,
    themeIdentity: themeIdentityBySetId.get(row.set_id),
  });
}

async function updateCatalogThemeIdentityRow({
  primaryThemeId,
  setId,
  sourceThemeId,
  supabaseClient,
}: {
  primaryThemeId: string;
  setId: string;
  sourceThemeId: string;
  supabaseClient: CatalogSupabaseClient;
}) {
  const { error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .update({
      primary_theme_id: primaryThemeId,
      source_theme_id: sourceThemeId,
    })
    .eq('set_id', setId);

  if (error) {
    throw new Error('Unable to backfill catalog theme identity.');
  }
}

async function refreshCatalogThemeSummaries({
  supabaseClient,
}: {
  supabaseClient: CatalogSupabaseClient;
}) {
  const { error } = await supabaseClient.rpc('refresh_catalog_theme_summaries');

  if (error) {
    throw new Error(
      `Unable to refresh catalog theme summaries after catalog mutation. ${formatSupabaseLikeError(error)}`,
    );
  }
}

async function updateCatalogSetPieceCountRow({
  pieceCount,
  setId,
  supabaseClient,
}: {
  pieceCount: number;
  setId: string;
  supabaseClient: CatalogSupabaseClient;
}) {
  const { error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .update({
      piece_count: pieceCount,
      updated_at: new Date().toISOString(),
    })
    .eq('set_id', setId);

  if (error) {
    throw new Error('Unable to update the catalog set piece count.');
  }
}

async function touchCatalogSetRow({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: CatalogSupabaseClient;
}) {
  const { error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('set_id', setId);

  if (error) {
    throw new Error('Unable to update the catalog set refresh timestamp.');
  }
}

async function insertCatalogSetRow({
  normalizedSet,
  supabaseClient,
  themePersistence,
}: {
  normalizedSet: CatalogExternalSetSearchResult;
  supabaseClient: CatalogSupabaseClient;
  themePersistence: Awaited<
    ReturnType<typeof resolveCatalogThemePersistenceForSourceSetNumber>
  >;
}): Promise<CatalogOverlaySetRow> {
  const { data, error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .insert({
      image_url: normalizedSet.imageUrl ?? null,
      name: normalizedSet.name,
      piece_count: normalizedSet.pieces,
      primary_theme_id: themePersistence.primaryTheme.id,
      release_date: normalizedSet.releaseDate ?? null,
      release_date_precision: resolveCatalogReleaseDatePrecision({
        releaseDate: normalizedSet.releaseDate,
        releaseDatePrecision: normalizedSet.releaseDatePrecision,
        releaseYear: normalizedSet.releaseYear,
      }),
      release_year: normalizedSet.releaseYear,
      set_id: normalizedSet.setId,
      slug: normalizedSet.slug,
      source: normalizedSet.source,
      source_theme_id: themePersistence.sourceTheme.id,
      source_set_number: normalizedSet.sourceSetNumber,
      status: 'active',
    })
    .select(
      'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create the catalog set.');
  }

  return data as CatalogOverlaySetRow;
}

export async function listCatalogOverlaySets({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogSet[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const rows = await listCatalogOverlaySetRows({
      includeInactive,
      supabaseClient: supabaseClient ?? getServerSupabaseAdminClient(),
    });
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      overlayRows: rows,
      supabaseClient: activeSupabaseClient,
    });

    return rows.map((row) =>
      toCatalogSet({
        row,
        themeIdentity: themeIdentityBySetId.get(row.set_id),
      }),
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function refreshZeroPieceSets(
  optionsOrLimit: RefreshZeroPieceSetsOptions | number = {},
): Promise<CatalogZeroPieceRefreshResult> {
  const options =
    typeof optionsOrLimit === 'number'
      ? {
          limit: optionsOrLimit,
        }
      : optionsOrLimit;
  const safeLimit =
    options.limit === undefined
      ? undefined
      : Math.max(1, Math.min(500, Math.floor(options.limit)));
  const activeSupabaseClient =
    options.supabaseClient ?? getServerSupabaseAdminClient();
  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  let query = activeSupabaseClient
    .from(CATALOG_SETS_TABLE)
    .select(
      'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
    )
    .eq('piece_count', 0)
    .order('updated_at', {
      ascending: true,
    });

  if (options.setIds?.length) {
    query = query.in('set_id', [...new Set(options.setIds)]);
  }

  if (options.sourceSetNumbers?.length) {
    query = query.in('source_set_number', [
      ...new Set(options.sourceSetNumbers),
    ]);
  }

  if (safeLimit !== undefined && 'limit' in query) {
    query = query.limit(safeLimit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to load zero-piece catalog sets.');
  }

  const rows = ((data as CatalogOverlaySetRow[] | null) ?? []).slice(
    0,
    safeLimit,
  );
  const updatedSetIds: string[] = [];
  let failedCount = 0;
  let stillUnknownCount = 0;

  for (const row of rows) {
    try {
      const sourceSet = validateRebrickableSetPayload(
        await rebrickableClient.getSet(row.source_set_number),
        row.source_set_number,
      );

      if (sourceSet.numParts > 0) {
        await updateCatalogSetPieceCountRow({
          pieceCount: sourceSet.numParts,
          setId: row.set_id,
          supabaseClient: activeSupabaseClient,
        });
        updatedSetIds.push(row.set_id);
      } else {
        await touchCatalogSetRow({
          setId: row.set_id,
          supabaseClient: activeSupabaseClient,
        });
        stillUnknownCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return {
    checkedCount: rows.length,
    failedCount,
    stillUnknownCount,
    updatedCount: updatedSetIds.length,
    updatedSetIds,
  };
}

export async function backfillCatalogOverlayThemeIdentity({
  fetchImpl,
  setIds,
  supabaseClient,
}: {
  fetchImpl?: typeof fetch;
  setIds?: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeBackfillResult> {
  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const overlayRows = await listCatalogOverlaySetRows({
    includeInactive: true,
    supabaseClient: activeSupabaseClient,
  });
  const hasScopedSetIds = Boolean(setIds?.length);
  const candidateRows = overlayRows.filter((overlayRow) => {
    if (hasScopedSetIds && !setIds.includes(overlayRow.set_id)) {
      return false;
    }

    if (hasScopedSetIds) {
      return true;
    }

    return !overlayRow.source_theme_id || !overlayRow.primary_theme_id;
  });

  if (!candidateRows.length) {
    return {
      processedCount: 0,
      skippedCount: overlayRows.length,
      updatedCount: 0,
    };
  }

  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  const themeCache = new Map<number, ValidatedRebrickableTheme>();
  const resolvedThemeNameById = new Map<number, string>();
  let updatedCount = 0;

  for (const overlayRow of candidateRows) {
    const themePersistence =
      await resolveCatalogThemePersistenceForSourceSetNumber({
        rebrickableClient,
        resolvedThemeNameById,
        sourceSetNumber: overlayRow.source_set_number,
        themeCache,
      });

    await ensureCatalogThemePersistence({
      supabaseClient: activeSupabaseClient,
      themePersistence,
    });

    await updateCatalogThemeIdentityRow({
      primaryThemeId: themePersistence.primaryTheme.id,
      setId: overlayRow.set_id,
      sourceThemeId: themePersistence.sourceTheme.id,
      supabaseClient: activeSupabaseClient,
    });

    updatedCount += 1;
  }

  if (updatedCount > 0) {
    await refreshCatalogThemeSummaries({
      supabaseClient: activeSupabaseClient,
    });
  }

  return {
    processedCount: candidateRows.length,
    skippedCount: overlayRows.length - candidateRows.length,
    updatedCount,
  };
}

export async function listCanonicalCatalogSets({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogCanonicalSet[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    return sortCanonicalCatalogSets(
      (
        await listCatalogOverlaySets({
          includeInactive,
          supabaseClient,
        })
      ).map(toCanonicalCatalogSetFromOverlaySet),
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function upsertCatalogSetSourceMetadata({
  inputs,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  inputs: readonly CatalogSetSourceMetadataInput[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<number> {
  if (inputs.length === 0) {
    return 0;
  }

  let upsertedCount = 0;

  for (const chunk of chunkCatalogRows(inputs, 500)) {
    const { error } = await supabaseClient
      .from(CATALOG_SET_SOURCE_METADATA_TABLE)
      .upsert(
        chunk.map((input) => ({
          catalog_set_id: input.catalogSetId,
          last_seen_at: input.lastSeenAt,
          locale: input.locale,
          match_confidence: input.matchConfidence,
          metadata_json: input.metadataJson,
          policy: input.policy,
          set_number: input.setNumber,
          source: input.source,
        })),
        {
          onConflict: 'catalog_set_id,source,locale',
        },
      );

    if (error) {
      throw new Error('Unable to upsert catalog set source metadata.');
    }

    upsertedCount += chunk.length;
  }

  return upsertedCount;
}

export async function getCanonicalCatalogSetById({
  includeInactive = false,
  setId,
  supabaseClient,
}: {
  includeInactive?: boolean;
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet | undefined> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return undefined;
  }

  try {
    const catalogSet = await getCatalogOverlaySetByColumn({
      column: 'set_id',
      includeInactive,
      supabaseClient: supabaseClient ?? getServerSupabaseAdminClient(),
      value: setId,
    });

    return catalogSet
      ? toCanonicalCatalogSetFromOverlaySet(catalogSet)
      : undefined;
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
    }

    throw error;
  }
}

export async function getCanonicalCatalogSetBySlug({
  includeInactive = false,
  slug,
  supabaseClient,
}: {
  includeInactive?: boolean;
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet | undefined> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return undefined;
  }

  try {
    const catalogSet = await getCatalogOverlaySetByColumn({
      column: 'slug',
      includeInactive,
      supabaseClient: supabaseClient ?? getServerSupabaseAdminClient(),
      value: slug,
    });

    return catalogSet
      ? toCanonicalCatalogSetFromOverlaySet(catalogSet)
      : undefined;
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
    }

    throw error;
  }
}

export async function listCatalogSetSummariesWithOverlay({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogSetSummary[]> {
  return sortCatalogSetSummaries(
    (
      await listCanonicalCatalogSets({
        supabaseClient,
      })
    ).map((canonicalCatalogSet) =>
      toCatalogSummaryFromCanonicalSet(canonicalCatalogSet),
    ),
  );
}

export async function findCatalogSetSummaryByIdWithOverlay({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetSummary | undefined> {
  const canonicalCatalogSet = await getCanonicalCatalogSetById({
    setId,
    supabaseClient,
  });

  if (!canonicalCatalogSet) {
    return undefined;
  }

  return toCatalogSummaryFromCanonicalSet(canonicalCatalogSet);
}

export async function listCatalogDiscoverySignals({
  setIds,
  supabaseClient,
}: {
  setIds?: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogDiscoverySignalRecord[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();
    const uniqueSetIds = [...new Set((setIds ?? []).filter(Boolean))];
    let seedQuery = activeSupabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
      )
      .eq('is_active', true)
      .eq('validation_status', 'valid');

    if (uniqueSetIds.length) {
      seedQuery = seedQuery.in('set_id', uniqueSetIds);
    }

    const { data: seedData, error: seedError } = await seedQuery;

    if (seedError) {
      throw new Error('Unable to load catalog discovery signals.');
    }

    const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

    if (!offerSeeds.length) {
      return [];
    }

    const merchantIds = [
      ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
    ];
    const offerSeedIds = offerSeeds.map((offerSeed) => offerSeed.id);
    const [
      { data: merchantData, error: merchantError },
      { data: latestOfferData, error: latestOfferError },
    ] = await Promise.all([
      activeSupabaseClient
        .from(COMMERCE_MERCHANTS_TABLE)
        .select('id, slug, name, is_active')
        .in('id', merchantIds)
        .eq('is_active', true),
      activeSupabaseClient
        .from(COMMERCE_OFFER_LATEST_TABLE)
        .select(
          'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, updated_at',
        )
        .in('offer_seed_id', offerSeedIds)
        .order('updated_at', {
          ascending: false,
        }),
    ]);

    if (merchantError || latestOfferError) {
      throw new Error('Unable to load catalog discovery signals.');
    }

    const merchantById = new Map(
      ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
        (merchantRow) => [merchantRow.id, merchantRow],
      ),
    );
    const latestOfferBySeedId = new Map<
      string,
      CatalogCommerceOfferLatestRow
    >();

    for (const latestOfferRow of (latestOfferData as
      | CatalogCommerceOfferLatestRow[]
      | null) ?? []) {
      if (!latestOfferBySeedId.has(latestOfferRow.offer_seed_id)) {
        latestOfferBySeedId.set(latestOfferRow.offer_seed_id, latestOfferRow);
      }
    }

    const currentOfferBySetAndMerchantSlug = new Map<
      string,
      {
        commercialUnitType?: CommerceCommercialUnitType;
        merchantSlug: string;
        observedAt: string;
        priceMinor: number;
        setId: string;
      }
    >();

    for (const offerSeed of offerSeeds) {
      const merchant = merchantById.get(offerSeed.merchant_id);
      const latestOffer = latestOfferBySeedId.get(offerSeed.id);

      if (
        !merchant ||
        !latestOffer ||
        latestOffer.fetch_status !== 'success' ||
        latestOffer.currency_code !== EURO_CURRENCY_CODE ||
        !isInteger(latestOffer.price_minor) ||
        latestOffer.price_minor <= 0 ||
        !latestOffer.observed_at ||
        !isEligibleCatalogDiscoveryOfferAvailability(latestOffer.availability)
      ) {
        continue;
      }

      const observationKey = `${offerSeed.set_id}:${merchant.slug}`;
      const existingObservation =
        currentOfferBySetAndMerchantSlug.get(observationKey);

      if (
        !existingObservation ||
        latestOffer.observed_at > existingObservation.observedAt
      ) {
        currentOfferBySetAndMerchantSlug.set(observationKey, {
          commercialUnitType: classifyCommerceCommercialUnitType({
            notes: offerSeed.notes,
            productUrl: offerSeed.product_url,
            setId: offerSeed.set_id,
          }),
          merchantSlug: merchant.slug,
          observedAt: latestOffer.observed_at,
          priceMinor: latestOffer.price_minor,
          setId: offerSeed.set_id,
        });
      }
    }

    const currentOfferGroupsBySetId = new Map<
      string,
      CatalogDiscoveryCurrentOffer[]
    >();

    for (const currentOffer of currentOfferBySetAndMerchantSlug.values()) {
      const currentOfferGroup =
        currentOfferGroupsBySetId.get(currentOffer.setId) ?? [];

      currentOfferGroup.push({
        commercialUnitType: currentOffer.commercialUnitType,
        merchantSlug: currentOffer.merchantSlug,
        observedAt: currentOffer.observedAt,
        priceMinor: currentOffer.priceMinor,
      });
      currentOfferGroupsBySetId.set(currentOffer.setId, currentOfferGroup);
    }

    const discoverySignalSetIds = [...currentOfferGroupsBySetId.keys()];
    const referencePriceMinorBySetId = new Map<string, number>();
    const recentReferencePriceSnapshotsBySetId = new Map<
      string,
      CatalogReferencePriceSnapshot[]
    >();

    if (discoverySignalSetIds.length) {
      const { data: priceHistoryData, error: priceHistoryError } =
        await activeSupabaseClient
          .from(PRICING_DAILY_SET_HISTORY_TABLE)
          .select('set_id, reference_price_minor, recorded_on')
          .in('set_id', discoverySignalSetIds)
          .eq('region_code', DUTCH_REGION_CODE)
          .eq('currency_code', EURO_CURRENCY_CODE)
          .eq('condition', NEW_OFFER_CONDITION)
          .order('recorded_on', {
            ascending: false,
          })
          .limit(
            discoverySignalSetIds.length *
              CATALOG_DISCOVERY_PRICE_HISTORY_ROWS_PER_SET,
          );

      if (priceHistoryError) {
        throw new Error('Unable to load catalog discovery signals.');
      }

      for (const priceHistoryRow of (priceHistoryData as
        | CatalogPriceHistoryRow[]
        | null) ?? []) {
        if (!isInteger(priceHistoryRow.reference_price_minor)) {
          continue;
        }

        if (!referencePriceMinorBySetId.has(priceHistoryRow.set_id)) {
          referencePriceMinorBySetId.set(
            priceHistoryRow.set_id,
            priceHistoryRow.reference_price_minor,
          );
        }

        const existingSnapshots =
          recentReferencePriceSnapshotsBySetId.get(priceHistoryRow.set_id) ??
          [];

        if (existingSnapshots.length >= 2) {
          continue;
        }

        existingSnapshots.push({
          recordedOn: priceHistoryRow.recorded_on,
          referencePriceMinor: priceHistoryRow.reference_price_minor,
        });
        recentReferencePriceSnapshotsBySetId.set(
          priceHistoryRow.set_id,
          existingSnapshots,
        );
      }
    }

    const catalogDiscoverySignalRecords: CatalogDiscoverySignalRecord[] = [];

    for (const [setId, currentOffers] of currentOfferGroupsBySetId.entries()) {
      const comparableCurrentOffers =
        selectComparableCatalogDiscoveryOffers(currentOffers);
      const sortedPriceMinorValues = comparableCurrentOffers
        .map((currentOffer) => currentOffer.priceMinor)
        .sort((left, right) => left - right);
      const bestPriceMinor = sortedPriceMinorValues[0];

      if (typeof bestPriceMinor !== 'number') {
        continue;
      }

      const highestPriceMinor =
        sortedPriceMinorValues[sortedPriceMinorValues.length - 1] ??
        bestPriceMinor;
      const referencePriceMinor = referencePriceMinorBySetId.get(setId);
      const recentReferencePriceSnapshots =
        recentReferencePriceSnapshotsBySetId.get(setId) ?? [];
      const latestReferencePriceSnapshot = recentReferencePriceSnapshots[0];
      const previousReferencePriceSnapshot = recentReferencePriceSnapshots[1];
      const recentReferencePriceChangeMinor =
        latestReferencePriceSnapshot && previousReferencePriceSnapshot
          ? latestReferencePriceSnapshot.referencePriceMinor -
            previousReferencePriceSnapshot.referencePriceMinor
          : undefined;

      catalogDiscoverySignalRecords.push({
        bestPriceMinor,
        merchantCount: comparableCurrentOffers.length,
        nextBestPriceMinor: sortedPriceMinorValues[1],
        observedAt: comparableCurrentOffers.reduce(
          (latestObservedAt, currentOffer) =>
            currentOffer.observedAt > latestObservedAt
              ? currentOffer.observedAt
              : latestObservedAt,
          comparableCurrentOffers[0]?.observedAt ?? '',
        ),
        priceSpreadMinor: Math.max(0, highestPriceMinor - bestPriceMinor),
        recentReferencePriceChangeMinor:
          recentReferencePriceChangeMinor &&
          recentReferencePriceChangeMinor !== 0
            ? recentReferencePriceChangeMinor
            : undefined,
        recentReferencePriceChangedAt:
          recentReferencePriceChangeMinor &&
          recentReferencePriceChangeMinor !== 0
            ? latestReferencePriceSnapshot?.recordedOn
            : undefined,
        referenceDeltaMinor:
          typeof referencePriceMinor === 'number'
            ? bestPriceMinor - referencePriceMinor
            : undefined,
        setId,
      });
    }

    return catalogDiscoverySignalRecords.sort((left, right) =>
      left.setId.localeCompare(right.setId),
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogSetLiveOffersBySetId({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogLiveOffer[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();
    const liveOffersBySetId = await listCatalogLiveOffersBySetIdsInternal({
      setIds: [setId],
      supabaseClient: activeSupabaseClient,
    });

    return liveOffersBySetId.get(setId) ?? [];
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogCurrentOfferSummariesBySetIds({
  preferSnapshots = true,
  setIds,
  supabaseClient,
}: {
  preferSnapshots?: boolean;
  setIds: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCurrentOfferSummaryRecord[]> {
  const uniqueSetIds = [
    ...new Set(
      setIds
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];

  if (!uniqueSetIds.length) {
    return [];
  }

  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();

    if (!preferSnapshots) {
      const liveOffersBySetId = await listCatalogLiveOffersBySetIdsInternal({
        setIds: uniqueSetIds,
        supabaseClient: activeSupabaseClient,
      });

      return [...liveOffersBySetId.entries()].flatMap(([setId, offers]) => {
        if (!offers.length) {
          return [];
        }

        return [
          {
            bestOffer: selectBestLiveCatalogOffer(offers),
            offers,
            setId,
          },
        ];
      });
    }

    const snapshotStartedAt = Date.now();
    const snapshotResult = await listCatalogCurrentOfferSnapshotsBySetIds({
      setIds: uniqueSetIds,
      supabaseClient: activeSupabaseClient,
    });
    const snapshotDurationMs = Date.now() - snapshotStartedAt;
    const liveFallbackStartedAt = Date.now();
    const liveFallbackOffersBySetId = snapshotResult.fallbackSetIds.length
      ? await listCatalogLiveOffersBySetIdsInternal({
          setIds: snapshotResult.fallbackSetIds,
          supabaseClient: activeSupabaseClient,
        })
      : new Map<string, CatalogLiveOffer[]>();
    const liveFallbackDurationMs = Date.now() - liveFallbackStartedAt;
    const liveFallbackSummaryBySetId = new Map(
      [...liveFallbackOffersBySetId.entries()].flatMap(([setId, offers]) => {
        if (!offers.length) {
          return [];
        }

        return [
          [
            setId,
            {
              bestOffer: selectBestLiveCatalogOffer(offers),
              offers,
              setId,
            },
          ] as const,
        ];
      }),
    );
    const summaryBySetId = new Map([
      ...snapshotResult.summaryBySetId,
      ...liveFallbackSummaryBySetId,
    ]);

    logCurrentOfferSnapshotDiagnostics({
      invalidSample: snapshotResult.invalidSample,
      liveFallbackCount: snapshotResult.fallbackSetIds.length,
      liveFallbackDurationMs,
      requestedCount: uniqueSetIds.length,
      snapshotDurationMs,
      snapshotHitCount: snapshotResult.summaryBySetId.size,
      snapshotMissingBestOfferCount:
        snapshotResult.snapshotMissingBestOfferCount,
      snapshotMissCount:
        uniqueSetIds.length -
        snapshotResult.summaryBySetId.size -
        snapshotResult.invalidSample.length,
      snapshotStaleCount: snapshotResult.snapshotStaleCount,
    });

    return uniqueSetIds.flatMap((setId) => {
      const summary = summaryBySetId.get(setId);

      return summary && summary.offers.length > 0 ? [summary] : [];
    });
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function probeCatalogCurrentOfferSnapshotHitRateBySetIds({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<{
  hitCount: number;
  missingSample: Array<{
    reason:
      | 'invalid_scope'
      | 'missing_best_offer'
      | 'missing_snapshot'
      | 'stale_snapshot';
    setId: string;
  }>;
  missCount: number;
  requestedCount: number;
}> {
  const uniqueSetIds = [
    ...new Set(
      setIds
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];

  if (!uniqueSetIds.length) {
    return {
      hitCount: 0,
      missingSample: [],
      missCount: 0,
      requestedCount: 0,
    };
  }

  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return {
      hitCount: 0,
      missingSample: uniqueSetIds.slice(0, 5).map((setId) => ({
        reason: 'missing_snapshot',
        setId,
      })),
      missCount: uniqueSetIds.length,
      requestedCount: uniqueSetIds.length,
    };
  }

  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const snapshotResult = await listCatalogCurrentOfferSnapshotsBySetIds({
    setIds: uniqueSetIds,
    supabaseClient: activeSupabaseClient,
  });
  const invalidReasonBySetId = new Map(
    snapshotResult.invalidSample.flatMap((sample) => {
      const setId = typeof sample['setId'] === 'string' ? sample['setId'] : '';
      const reason =
        sample['reason'] === 'invalid_scope' ||
        sample['reason'] === 'missing_best_offer' ||
        sample['reason'] === 'stale_snapshot'
          ? sample['reason']
          : undefined;

      return setId && reason ? [[setId, reason] as const] : [];
    }),
  );

  return {
    hitCount: snapshotResult.summaryBySetId.size,
    missingSample: snapshotResult.fallbackSetIds.slice(0, 5).map((setId) => ({
      reason: invalidReasonBySetId.get(setId) ?? 'missing_snapshot',
      setId,
    })),
    missCount: uniqueSetIds.length - snapshotResult.summaryBySetId.size,
    requestedCount: uniqueSetIds.length,
  };
}

export async function getCatalogSetBySlugWithOverlay({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetDetail | undefined> {
  const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
    slug,
    supabaseClient,
  });

  if (!canonicalCatalogSet) {
    return undefined;
  }

  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const minifigureCount = await getCatalogSetMinifigCountBySetId({
    setId: canonicalCatalogSet.setId,
    supabaseClient: activeSupabaseClient,
  });

  return toCatalogSetDetailFromCanonicalSet({
    ...canonicalCatalogSet,
    ...(typeof minifigureCount === 'number'
      ? {
          minifigureCount,
        }
      : {}),
  });
}

export async function searchCatalogMissingSets({
  fetchImpl,
  query,
  supabaseClient,
}: {
  fetchImpl?: typeof fetch;
  query: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogExternalSetSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  const [existingCatalogSets, payload] = await Promise.all([
    listCanonicalCatalogSets({
      includeInactive: true,
      supabaseClient,
    }),
    rebrickableClient.searchSets(normalizedQuery, {
      pageSize: 12,
    }),
  ]);
  const existingSetIds = new Set(
    existingCatalogSets.map((catalogSet) => catalogSet.setId),
  );
  const validatedSearchSetsBySetNumber = new Map<
    string,
    ValidatedRebrickableSearchSet
  >();
  const validatedSearchSets = [
    ...validateRebrickableSearchPayload(payload).flatMap((searchSetPayload) => {
      try {
        return [validateRebrickableSearchSetPayload(searchSetPayload)];
      } catch {
        return [];
      }
    }),
    ...(await lookupExactRebrickableSearchSets({
      query: normalizedQuery,
      rebrickableClient,
    })),
  ];

  for (const validatedSearchSet of validatedSearchSets) {
    validatedSearchSetsBySetNumber.set(
      validatedSearchSet.setNumber,
      validatedSearchSet,
    );
  }

  const uniqueValidatedSearchSets = [
    ...validatedSearchSetsBySetNumber.values(),
  ];
  const uniqueThemeIds = [
    ...new Set(uniqueValidatedSearchSets.map((searchSet) => searchSet.themeId)),
  ];
  const themeCache = new Map<number, ValidatedRebrickableTheme>();
  const resolvedThemeNameById = new Map<number, string>();
  const themeEntries = await Promise.all(
    uniqueThemeIds.map(async (themeId) => {
      const themeName = await resolveRebrickablePrimaryThemeName({
        rebrickableClient,
        resolvedThemeNameById,
        themeCache,
        themeId,
      });

      return [themeId, themeName] as const;
    }),
  );
  const themeNameById = new Map(themeEntries);

  return uniqueValidatedSearchSets
    .map((validatedSearchSet) =>
      toSearchResult({
        ...validatedSearchSet,
        themeName:
          themeNameById.get(validatedSearchSet.themeId) ?? 'Onbekend thema',
      }),
    )
    .filter((searchResult) => !existingSetIds.has(searchResult.setId));
}

export async function listCatalogSuggestedMissingSets({
  fetchImpl,
  limit = CATALOG_SUGGESTED_SET_DEFAULT_LIMIT,
  nowImpl = Date.now,
  supabaseClient,
}: {
  fetchImpl?: typeof fetch;
  limit?: number;
  nowImpl?: () => number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogSuggestedSet[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const currentYear = new Date(nowImpl()).getUTCFullYear();
  const minYear = currentYear - (CATALOG_SUGGESTED_SET_RECENT_YEAR_WINDOW - 1);
  const rebrickableConfig = getRebrickableApiConfig();
  const rebrickableClient = createRebrickableClient({
    apiKey: rebrickableConfig.apiKey,
    baseUrl: rebrickableConfig.baseUrl,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  const existingCatalogSets = await listCanonicalCatalogSets({
    includeInactive: true,
    supabaseClient,
  });
  const existingSetIds = new Set(
    existingCatalogSets.flatMap((catalogSet) => [
      getCanonicalCatalogSetId(catalogSet.setId),
      ...(catalogSet.sourceSetNumber
        ? [getCanonicalCatalogSetId(catalogSet.sourceSetNumber)]
        : []),
    ]),
  );
  const fetchedSearchSets: ValidatedRebrickableSearchSet[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= CATALOG_SUGGESTED_SET_MAX_PAGES;
    pageNumber += 1
  ) {
    const payload = await rebrickableClient.listSets({
      minYear,
      ordering: '-year,-num_parts',
      page: pageNumber,
      pageSize: CATALOG_SUGGESTED_SET_FETCH_PAGE_SIZE,
    });
    const validatedSearchSets = validateRebrickableSearchPayload(
      payload,
    ).flatMap((searchSetPayload) => {
      try {
        return [validateRebrickableSearchSetPayload(searchSetPayload)];
      } catch {
        return [];
      }
    });
    const missingSearchSets = validatedSearchSets.filter(
      (searchSet) =>
        !existingSetIds.has(
          getCanonicalCatalogSetIdFromSourceSetNumber(searchSet.setNumber),
        ),
    );

    fetchedSearchSets.push(...missingSearchSets);

    if (validatedSearchSets.length < CATALOG_SUGGESTED_SET_FETCH_PAGE_SIZE) {
      break;
    }
  }

  const uniqueSuggestedSets = new Map<string, ValidatedRebrickableSearchSet>();

  for (const searchSet of fetchedSearchSets) {
    const normalizedSetId = getCanonicalCatalogSetIdFromSourceSetNumber(
      searchSet.setNumber,
    );

    if (
      existingSetIds.has(normalizedSetId) ||
      uniqueSuggestedSets.has(normalizedSetId)
    ) {
      continue;
    }

    uniqueSuggestedSets.set(normalizedSetId, searchSet);
  }

  const uniqueThemeIds = [
    ...new Set(
      [...uniqueSuggestedSets.values()].map((searchSet) => searchSet.themeId),
    ),
  ];
  const themeCache = new Map<number, ValidatedRebrickableTheme>();
  const resolvedThemeNameById = new Map<number, string>();
  const themeEntries = await Promise.all(
    uniqueThemeIds.map(async (themeId) => {
      const themeName = await resolveRebrickablePrimaryThemeName({
        rebrickableClient,
        resolvedThemeNameById,
        themeCache,
        themeId,
      });

      return [themeId, themeName] as const;
    }),
  );
  const themeNameById = new Map(themeEntries);

  return sortCatalogSuggestedSets(
    [...uniqueSuggestedSets.values()].flatMap((searchSet) => {
      const themeName =
        themeNameById.get(searchSet.themeId) ?? 'Onbekend thema';
      const themeFit = getCatalogSuggestedThemeFit(themeName);

      if (themeFit.isExcluded) {
        return [];
      }

      const normalizedSet = toSearchResult({
        imageUrl: searchSet.imageUrl,
        name: searchSet.name,
        numParts: searchSet.numParts,
        setNumber: searchSet.setNumber,
        themeName,
        year: searchSet.year,
      });
      const score = buildCatalogSuggestedSetScore({
        currentYear,
        pieces: normalizedSet.pieces,
        releaseYear: normalizedSet.releaseYear,
        themeFitScore: themeFit.score,
      });

      return [
        {
          ...normalizedSet,
          confidence: getCatalogSuggestedConfidence({
            isRetailFriendlyTheme: themeFit.isRetailFriendlyTheme,
            score,
            themeName: normalizedSet.theme,
          }),
          isRetailFriendlyTheme: themeFit.isRetailFriendlyTheme,
          score,
        },
      ];
    }),
  ).slice(0, safeLimit);
}

export async function createCatalogSet({
  fetchImpl,
  input,
  supabaseClient,
}: {
  fetchImpl?: typeof fetch;
  input: CatalogExternalSetSearchResult;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSet> {
  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const normalizedSet = toSearchResult({
    imageUrl: input.imageUrl,
    name: input.name,
    numParts: input.pieces,
    setNumber: input.sourceSetNumber,
    themeName: input.theme,
    year: input.releaseYear,
  });
  const setConflict = await getCatalogOverlaySetByColumn({
    column: 'set_id',
    includeInactive: true,
    supabaseClient: activeSupabaseClient,
    value: normalizedSet.setId,
  });

  if (setConflict) {
    if (setConflict.pieces === 0 && normalizedSet.pieces > 0) {
      await updateCatalogSetPieceCountRow({
        pieceCount: normalizedSet.pieces,
        setId: setConflict.setId,
        supabaseClient: activeSupabaseClient,
      });

      return {
        ...setConflict,
        pieces: normalizedSet.pieces,
        updatedAt: new Date().toISOString(),
      };
    }

    throw new Error(
      buildCatalogSetIdConflictMessage({
        conflictTarget: toCatalogConflictTarget(setConflict),
      }),
    );
  }

  const slugConflict = await getCatalogOverlaySetByColumn({
    column: 'slug',
    includeInactive: true,
    supabaseClient: activeSupabaseClient,
    value: normalizedSet.slug,
  });

  if (slugConflict) {
    throw new Error(
      buildCatalogSetSlugConflictMessage({
        conflictTarget: toCatalogConflictTarget(slugConflict),
        slug: normalizedSet.slug,
      }),
    );
  }

  const themePersistence =
    await resolveCatalogThemePersistenceForSourceSetNumber({
      ...(fetchImpl ? { fetchImpl } : {}),
      sourceSetNumber: normalizedSet.sourceSetNumber,
    });

  await ensureCatalogThemePersistence({
    supabaseClient: activeSupabaseClient,
    themePersistence,
  });

  try {
    const data = await insertCatalogSetRow({
      normalizedSet,
      supabaseClient: activeSupabaseClient,
      themePersistence,
    });
    await refreshCatalogThemeSummaries({
      supabaseClient: activeSupabaseClient,
    });

    return toCatalogSet({
      row: data,
      themeIdentity: resolveCatalogThemeIdentityFromPersistence({
        legacyTheme: data.theme,
        primaryThemeName: themePersistence.primaryTheme.display_name,
        sourceThemeName: themePersistence.sourceTheme.source_theme_name,
      }),
    });
  } catch (error) {
    const conflictMessage =
      error &&
      getCatalogSetInsertConflictMessage({
        existingCatalogSets: [],
        error: error as DatabaseConflictLike,
        normalizedSet,
      });

    if (conflictMessage) {
      throw new Error(conflictMessage);
    }

    throw new Error('Unable to create the catalog set.');
  }
}
