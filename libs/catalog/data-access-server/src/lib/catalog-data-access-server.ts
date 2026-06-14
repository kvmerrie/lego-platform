import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import {
  type CatalogCanonicalSet,
  type CatalogDiscoverySignal,
  type CatalogExternalSetSearchResult,
  type CatalogThemeDirectoryItem,
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
  selectBestPurchasableOffer,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CATALOG_SETS_TABLE = 'catalog_sets';
export const CATALOG_DISCOVERY_CANDIDATES_TABLE =
  'catalog_discovery_candidates';
const CATALOG_DISCOVERY_CANDIDATE_SELECT_COLUMNS = [
  'id',
  'normalized_set_id',
  'source_set_number',
  'source',
  'source_product_url',
  'source_product_title',
  'source_image_url',
  'source_price_minor',
  'source_currency_code',
  'source_payload',
  'rebrickable_payload',
  'brickset_payload',
  'evidence',
  'confidence',
  'confidence_score',
  'required_fields_present',
  'auto_create_eligible',
  'status',
  'imported_set_id',
  'import_error',
  'first_seen_at',
  'last_seen_at',
] as const;
const CATALOG_DISCOVERY_CANDIDATE_SELECT =
  'id, normalized_set_id, source_set_number, source, source_product_url, source_product_title, source_image_url, source_price_minor, source_currency_code, source_payload, rebrickable_payload, brickset_payload, evidence, confidence, confidence_score, required_fields_present, auto_create_eligible, status, imported_set_id, import_error, first_seen_at, last_seen_at';
export const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const CATALOG_SET_SOURCE_METADATA_PAGE_SIZE = 1000;
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const CATALOG_THEME_SUMMARIES_TABLE = 'catalog_theme_summaries';
const USER_THEME_FAVORITES_TABLE = 'user_theme_favorites';
const REBRICKABLE_SETS_TABLE = 'rebrickable_sets';
const REBRICKABLE_THEMES_TABLE = 'rebrickable_themes';
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

type CatalogSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'> &
  Partial<Pick<SupabaseClient, 'schema'>>;

interface SupabaseDiagnosticError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

interface UserThemeFavoriteRow {
  created_at: string;
  theme_id: string;
  user_id: string;
}

interface UserThemeFavoriteThemeRow {
  display_name: string;
  id: string;
  is_public: boolean;
  public_accent_color: string | null;
  public_description: string | null;
  public_display_name: string | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_surface_color: string | null;
  public_tile_image_url: string | null;
  slug: string;
  status: string;
}

interface UserThemeFavoriteSummaryRow {
  active_set_count: number | null;
  representative_image_url: string | null;
  representative_set_id: string | null;
  theme_id: string;
}

export interface UserThemeFavoriteState {
  isFavorited: boolean;
  themeId: string;
}

export interface UserThemeFavoriteItem extends CatalogThemeDirectoryItem {
  favoritedAt: string;
}

export interface UserThemeFavoriteRepository {
  addFavorite(input: {
    themeId: string;
    userId: string;
  }): Promise<UserThemeFavoriteState>;
  getFavoriteState(input: {
    themeId: string;
    userId: string;
  }): Promise<UserThemeFavoriteState>;
  listFavoriteThemeIds(userId: string): Promise<string[]>;
  listFavoriteThemes(userId: string): Promise<UserThemeFavoriteItem[]>;
  removeFavorite(input: {
    themeId: string;
    userId: string;
  }): Promise<UserThemeFavoriteState>;
}

function normalizeUserThemeFavoriteThemeId(themeId: string): string {
  return themeId.trim();
}

function normalizePublicThemeText(value?: string | null): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizePublicThemeImageUrl(
  value?: string | null,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue && /^https?:\/\/[^\s"'<>]+$/iu.test(normalizedValue)
    ? normalizedValue
    : undefined;
}

function normalizePublicThemeColor(value?: string | null): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(normalizedValue)
    ? normalizedValue
    : undefined;
}

function createFavoriteThemeDirectoryItem({
  favorite,
  summary,
  theme,
}: {
  favorite: UserThemeFavoriteRow;
  summary?: UserThemeFavoriteSummaryRow;
  theme: UserThemeFavoriteThemeRow;
}): UserThemeFavoriteItem | undefined {
  if (theme.status !== 'active' || theme.is_public !== true) {
    return undefined;
  }

  const displayName =
    normalizePublicThemeText(theme.public_display_name) ?? theme.display_name;
  const publicDescription = normalizePublicThemeText(theme.public_description);
  const publicImageUrl = normalizePublicThemeImageUrl(theme.public_image_url);
  const publicTileImageUrl = normalizePublicThemeImageUrl(
    theme.public_tile_image_url,
  );
  const representativeImageUrl = normalizePublicThemeImageUrl(
    summary?.representative_image_url,
  );
  const imageUrl =
    publicTileImageUrl ?? publicImageUrl ?? representativeImageUrl;
  const backgroundColor =
    normalizePublicThemeColor(theme.public_surface_color) ??
    normalizePublicThemeColor(theme.public_accent_color);
  return {
    favoritedAt: favorite.created_at,
    ...(imageUrl ? { imageUrl } : {}),
    themeSnapshot: {
      id: theme.id,
      introSupport: undefined,
      momentum:
        publicDescription ??
        `Bekijk welke ${displayName}-sets de moeite waard zijn.`,
      name: displayName,
      setCount: summary?.active_set_count ?? 0,
      signatureSet: displayName,
      slug: theme.slug,
    },
    visual: {
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(publicImageUrl ? { imageUrl: publicImageUrl } : {}),
      ...(publicTileImageUrl ? { tileImageUrl: publicTileImageUrl } : {}),
    },
  } satisfies UserThemeFavoriteItem;
}

export function createUserThemeFavoriteRepository(
  supabaseAdminClient?: CatalogSupabaseClient,
): UserThemeFavoriteRepository {
  function getSupabaseAdminClient() {
    return supabaseAdminClient ?? getServerSupabaseAdminClient();
  }

  async function getFavoriteRows(
    userId: string,
  ): Promise<UserThemeFavoriteRow[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from(USER_THEME_FAVORITES_TABLE)
      .select('user_id, theme_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('theme_id', { ascending: true });

    if (error) {
      throw new Error('Unable to load theme favorites.');
    }

    return (data as UserThemeFavoriteRow[] | null) ?? [];
  }

  return {
    async addFavorite({ themeId, userId }) {
      const normalizedThemeId = normalizeUserThemeFavoriteThemeId(themeId);
      const { error } = await getSupabaseAdminClient()
        .from(USER_THEME_FAVORITES_TABLE)
        .upsert(
          {
            theme_id: normalizedThemeId,
            user_id: userId,
          },
          { onConflict: 'user_id,theme_id' },
        );

      if (error) {
        throw new Error('Unable to save theme favorite.');
      }

      return {
        isFavorited: true,
        themeId: normalizedThemeId,
      };
    },

    async getFavoriteState({ themeId, userId }) {
      const normalizedThemeId = normalizeUserThemeFavoriteThemeId(themeId);
      const { data, error } = await getSupabaseAdminClient()
        .from(USER_THEME_FAVORITES_TABLE)
        .select('theme_id')
        .eq('user_id', userId)
        .eq('theme_id', normalizedThemeId)
        .maybeSingle();

      if (error) {
        throw new Error('Unable to load theme favorite.');
      }

      return {
        isFavorited: Boolean(data),
        themeId: normalizedThemeId,
      };
    },

    async listFavoriteThemeIds(userId) {
      return (await getFavoriteRows(userId)).map((row) => row.theme_id);
    },

    async listFavoriteThemes(userId) {
      const favoriteRows = await getFavoriteRows(userId);
      const themeIds = favoriteRows.map((favoriteRow) => favoriteRow.theme_id);

      if (themeIds.length === 0) {
        return [];
      }

      const [themeResponse, summaryResponse] = await Promise.all([
        getSupabaseAdminClient()
          .from(CATALOG_THEMES_TABLE)
          .select(
            'id, slug, display_name, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, status, is_public',
          )
          .in('id', themeIds),
        getSupabaseAdminClient()
          .from(CATALOG_THEME_SUMMARIES_TABLE)
          .select(
            'theme_id, active_set_count, representative_set_id, representative_image_url',
          )
          .in('theme_id', themeIds),
      ]);

      if (themeResponse.error || summaryResponse.error) {
        throw new Error('Unable to load favorite themes.');
      }

      const themeById = new Map(
        ((themeResponse.data as UserThemeFavoriteThemeRow[] | null) ?? []).map(
          (themeRow) => [themeRow.id, themeRow] as const,
        ),
      );
      const summaryByThemeId = new Map(
        (
          (summaryResponse.data as UserThemeFavoriteSummaryRow[] | null) ?? []
        ).map((summaryRow) => [summaryRow.theme_id, summaryRow] as const),
      );

      return favoriteRows.flatMap((favoriteRow) => {
        const theme = themeById.get(favoriteRow.theme_id);

        if (!theme) {
          return [];
        }

        const favoriteTheme = createFavoriteThemeDirectoryItem({
          favorite: favoriteRow,
          summary: summaryByThemeId.get(favoriteRow.theme_id),
          theme,
        });

        return favoriteTheme ? [favoriteTheme] : [];
      });
    },

    async removeFavorite({ themeId, userId }) {
      const normalizedThemeId = normalizeUserThemeFavoriteThemeId(themeId);
      const { error } = await getSupabaseAdminClient()
        .from(USER_THEME_FAVORITES_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('theme_id', normalizedThemeId);

      if (error) {
        throw new Error('Unable to remove theme favorite.');
      }

      return {
        isFavorited: false,
        themeId: normalizedThemeId,
      };
    },
  };
}

function formatSupabaseDiagnosticError(error: unknown): string {
  const diagnosticError = error as SupabaseDiagnosticError;
  const message =
    typeof diagnosticError.message === 'string'
      ? diagnosticError.message
      : error instanceof Error
        ? error.message
        : String(error);
  const details =
    typeof diagnosticError.details === 'string' ? diagnosticError.details : '';
  const hint =
    typeof diagnosticError.hint === 'string' ? diagnosticError.hint : '';
  const code =
    typeof diagnosticError.code === 'string' ? diagnosticError.code : '';

  return [
    `message=${JSON.stringify(message)}`,
    `code=${JSON.stringify(code || 'unknown')}`,
    `details=${JSON.stringify(details || 'none')}`,
    `hint=${JSON.stringify(hint || 'none')}`,
  ].join(' ');
}

function createCatalogDiscoveryCandidateLoadError({
  error,
  limit,
  status,
}: {
  error: unknown;
  limit: number;
  status?: CatalogDiscoveryCandidateStatus | 'all';
}): Error {
  return new Error(
    [
      'Unable to load catalog discovery candidates.',
      formatSupabaseDiagnosticError(error),
      `table=${JSON.stringify(CATALOG_DISCOVERY_CANDIDATES_TABLE)}`,
      `status=${JSON.stringify(status ?? 'all')}`,
      `limit=${limit}`,
      `selected_columns=${JSON.stringify(
        CATALOG_DISCOVERY_CANDIDATE_SELECT_COLUMNS,
      )}`,
    ].join(' '),
  );
}

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

export type CatalogDiscoveryCandidateConfidence = 'high' | 'low' | 'medium';

export type CatalogDiscoveryCandidateStatus =
  | 'failed'
  | 'ignored'
  | 'imported'
  | 'non_set'
  | 'new'
  | 'onboarding_started'
  | 'processing'
  | 'rejected'
  | 'reviewed';

export interface CatalogDiscoveryCandidatesPreflightResult {
  expectedColumns: readonly string[];
  informationSchemaError?: string;
  missingColumns?: readonly string[];
  optionalStoredOperatorConfidenceColumn: {
    error?: string;
    exists: boolean;
  };
  selectedColumns: readonly string[];
  selectedColumnProbe: {
    error?: string;
    ok: boolean;
  };
  statusCounts: Partial<Record<CatalogDiscoveryCandidateStatus, number>>;
  statusCountErrors: Partial<Record<CatalogDiscoveryCandidateStatus, string>>;
  table: string;
  tableAccess: {
    count?: number;
    error?: string;
    ok: boolean;
  };
  usedSetNumberColumns: readonly string[];
}

export interface CatalogDiscoveryCandidateInput {
  autoCreateEligible: boolean;
  bricksetPayload?: Readonly<Record<string, unknown>>;
  confidence: CatalogDiscoveryCandidateConfidence;
  confidenceScore: number;
  evidence: Readonly<Record<string, unknown>>;
  firstSeenAt: string;
  importError?: string | null;
  importedSetId?: string | null;
  lastSeenAt: string;
  normalizedSetId: string;
  rebrickablePayload?: Readonly<Record<string, unknown>>;
  requiredFieldsPresent: boolean;
  source: string;
  sourceCurrencyCode?: string;
  sourceImageUrl?: string;
  sourcePayload: Readonly<Record<string, unknown>>;
  sourcePriceMinor?: number;
  sourceProductTitle?: string;
  sourceProductUrl: string;
  sourceSetNumber: string;
  status?: CatalogDiscoveryCandidateStatus;
}

export interface CatalogDiscoveryCandidate {
  autoCreateEligible: boolean;
  bricksetPayload?: Readonly<Record<string, unknown>>;
  confidence: CatalogDiscoveryCandidateConfidence;
  confidenceScore: number;
  evidence: Readonly<Record<string, unknown>>;
  firstSeenAt: string;
  id: string;
  importError?: string | null;
  importedSetId?: string | null;
  lastSeenAt: string;
  normalizedSetId: string;
  operatorConfidence: CatalogDiscoveryCandidateConfidence;
  operatorConfidenceReasons: readonly string[];
  rebrickablePayload?: Readonly<Record<string, unknown>>;
  requiredFieldsPresent: boolean;
  source: string;
  sourceCurrencyCode?: string;
  sourceImageUrl?: string;
  sourcePayload: Readonly<Record<string, unknown>>;
  sourcePriceMinor?: number;
  sourceProductTitle?: string;
  sourceProductUrl: string;
  sourceSetNumber: string;
  status: CatalogDiscoveryCandidateStatus;
}

export interface CatalogSetSourceMetadataBackfillResult {
  found: boolean;
  missing: boolean;
  upsertedCount: number;
}

interface CatalogSetSourceMetadataRow {
  last_seen_at: string | null;
  metadata_json: Record<string, unknown> | null;
  policy: string | null;
  set_number: string;
}

interface CatalogDiscoveryCandidateRow {
  auto_create_eligible: boolean;
  brickset_payload: Record<string, unknown> | null;
  confidence: string;
  confidence_score: number;
  evidence: Record<string, unknown> | null;
  first_seen_at: string;
  id: string;
  import_error: string | null;
  imported_set_id: string | null;
  last_seen_at: string;
  normalized_set_id: string;
  rebrickable_payload: Record<string, unknown> | null;
  required_fields_present: boolean;
  source: string;
  source_currency_code: string | null;
  source_image_url: string | null;
  source_payload: Record<string, unknown> | null;
  source_price_minor: number | null;
  source_product_title: string | null;
  source_product_url: string;
  source_set_number: string;
  status: string;
}

const RAKUTEN_LEGO_SOURCE = 'rakuten-lego-eu';
const RAKUTEN_LEGO_NL_LOCALE = 'nl-NL';
const RAKUTEN_LEGO_EXACT_MATCH_CONFIDENCE = 'exact_set_number';
const RAKUTEN_LEGO_DEFAULT_METADATA_POLICY = 'metadata_only_pending_audit';

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

interface LocalRebrickableSetRow {
  img_url?: string | null;
  name: string;
  num_parts?: number | null;
  set_img_url?: string | null;
  set_num: string;
  theme_id: number;
  year: number;
}

interface LocalRebrickableThemeRow {
  id: number;
  name: string;
  parent_id?: number | null;
}

export interface LocalRebrickableSetMirrorMetadata {
  catalogSetInput: CatalogExternalSetSearchResult;
  imgUrl?: string;
  name: string;
  numParts: number;
  setNum: string;
  setImgUrl?: string;
  themeId: number;
  themeName: string;
  year: number;
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
  return (
    selectBestPurchasableOffer(offers, {
      maxOfferAgeDays: Number.POSITIVE_INFINITY,
      strategicTieBreakerOffer: sortLiveCatalogOffers(offers)[0],
    }).offer ?? undefined
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

function buildCatalogCandidateSourceThemeRecordId(primaryThemeName: string) {
  return `rebrickable:operator:${buildCatalogThemeSlug(primaryThemeName)}`;
}

function resolveCandidateThemeName({
  fallbackTitle,
  payload,
  sourcePayload,
}: {
  fallbackTitle?: string;
  payload?: Readonly<Record<string, unknown>>;
  sourcePayload?: Readonly<Record<string, unknown>>;
}): string {
  const payloadTheme = payload?.['theme'];

  if (typeof payloadTheme === 'string' && payloadTheme.trim()) {
    return payloadTheme.trim();
  }

  const isGenericSourceTheme = (value: string): boolean => {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue === 'other' ||
      normalizedValue === 'toys & games' ||
      normalizedValue === 'toys and games' ||
      normalizedValue === 'unknown'
    );
  };

  for (const key of [
    'theme',
    'sourceTheme',
    'category',
    'productCategory',
    'merchantCategory',
  ]) {
    const value = sourcePayload?.[key];

    if (
      typeof value === 'string' &&
      value.trim() &&
      !isGenericSourceTheme(value)
    ) {
      return value.trim();
    }
  }

  const title = fallbackTitle?.toLowerCase() ?? '';
  const themePatterns: Array<[RegExp, string]> = [
    [/\bstar wars\b/, 'Star Wars'],
    [/\btechnic\b/, 'Technic'],
    [/\bicons?\b/, 'Icons'],
    [/\bideas?\b/, 'Ideas'],
    [/\bharry potter\b|\bhogwarts\b/, 'Harry Potter'],
    [/\bmarvel\b|\bspider-man\b|\bavengers\b/, 'Marvel'],
    [/\bdisney\b/, 'Disney'],
    [/\bminecraft\b/, 'Minecraft'],
    [/\bninjago\b/, 'NINJAGO'],
    [/\bfriends\b/, 'Friends'],
    [/\bspeed champions\b/, 'Speed Champions'],
    [/\barchitecture\b/, 'Architecture'],
    [/\bbotanical\b|\bbotanicals\b/, 'Botanicals'],
  ];
  const matchedTheme = themePatterns.find(([pattern]) => pattern.test(title));

  return matchedTheme?.[1] ?? 'LEGO';
}

function buildCatalogThemePersistenceFromCandidateTheme(
  rawTheme: string,
): CatalogResolvedThemePersistence {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme,
  });
  const primaryTheme = themeIdentity.primaryTheme || 'LEGO';
  const primaryThemeId = buildCatalogThemeRecordId(primaryTheme);
  const sourceThemeId = buildCatalogCandidateSourceThemeRecordId(primaryTheme);

  return {
    primaryTheme: {
      display_name: primaryTheme,
      id: primaryThemeId,
      slug: buildCatalogThemeSlug(primaryTheme),
      status: 'active',
    },
    sourceTheme: {
      id: sourceThemeId,
      parent_source_theme_id: null,
      source_system: 'rebrickable',
      source_theme_name: rawTheme || primaryTheme,
    },
    sourceThemeMapping: {
      primary_theme_id: primaryThemeId,
      source_theme_id: sourceThemeId,
    },
  };
}

async function getLocalRebrickableThemeRow({
  supabaseClient,
  themeId,
}: {
  supabaseClient: CatalogSupabaseClient;
  themeId: number;
}): Promise<LocalRebrickableThemeRow | undefined> {
  const { data, error } = await supabaseClient
    .from(REBRICKABLE_THEMES_TABLE)
    .select('id, name, parent_id')
    .eq('id', themeId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to read the local Rebrickable theme mirror.');
  }

  return (data as LocalRebrickableThemeRow | null) ?? undefined;
}

async function resolveLocalRebrickableThemePersistence({
  sourceTheme,
  supabaseClient,
}: {
  sourceTheme: LocalRebrickableThemeRow;
  supabaseClient: CatalogSupabaseClient;
}): Promise<CatalogResolvedThemePersistence> {
  const parentSourceTheme = sourceTheme.parent_id
    ? await getLocalRebrickableThemeRow({
        supabaseClient,
        themeId: sourceTheme.parent_id,
      })
    : undefined;
  const primaryTheme = resolveCatalogThemeIdentity({
    rawTheme: sourceTheme.name,
    ...(parentSourceTheme ? { parentTheme: parentSourceTheme.name } : {}),
  }).primaryTheme;
  const primaryThemeId = buildCatalogThemeRecordId(primaryTheme);
  const sourceThemeId = buildCatalogSourceThemeRecordId({
    sourceSystem: 'rebrickable',
    sourceThemeId: sourceTheme.id,
  });

  return {
    primaryTheme: {
      display_name: primaryTheme,
      id: primaryThemeId,
      slug: buildCatalogThemeSlug(primaryTheme),
      status: 'active',
    },
    sourceTheme: {
      id: sourceThemeId,
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
      source_theme_id: sourceThemeId,
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

function toCatalogDiscoveryCandidate(
  row: CatalogDiscoveryCandidateRow,
): CatalogDiscoveryCandidate {
  const confidence =
    row.confidence === 'high' ||
    row.confidence === 'medium' ||
    row.confidence === 'low'
      ? row.confidence
      : 'low';
  const status =
    row.status === 'failed' ||
    row.status === 'imported' ||
    row.status === 'ignored' ||
    row.status === 'non_set' ||
    row.status === 'onboarding_started' ||
    row.status === 'processing' ||
    row.status === 'rejected' ||
    row.status === 'reviewed' ||
    row.status === 'new'
      ? row.status
      : 'new';
  const evidence = row.evidence ?? {};
  const operatorConfidence =
    evidence['operatorConfidence'] === 'high' ||
    evidence['operatorConfidence'] === 'medium' ||
    evidence['operatorConfidence'] === 'low'
      ? evidence['operatorConfidence']
      : confidence;
  const operatorConfidenceReasons = Array.isArray(
    evidence['operatorConfidenceReasons'],
  )
    ? evidence['operatorConfidenceReasons'].filter(
        (reason): reason is string => typeof reason === 'string',
      )
    : [];

  return {
    autoCreateEligible: row.auto_create_eligible,
    ...(row.brickset_payload ? { bricksetPayload: row.brickset_payload } : {}),
    confidence,
    confidenceScore: row.confidence_score,
    evidence,
    firstSeenAt: row.first_seen_at,
    id: row.id,
    importError: row.import_error,
    importedSetId: row.imported_set_id,
    lastSeenAt: row.last_seen_at,
    normalizedSetId: row.normalized_set_id,
    operatorConfidence,
    operatorConfidenceReasons,
    ...(row.rebrickable_payload
      ? { rebrickablePayload: row.rebrickable_payload }
      : {}),
    requiredFieldsPresent: row.required_fields_present,
    source: row.source,
    ...(row.source_currency_code
      ? { sourceCurrencyCode: row.source_currency_code }
      : {}),
    ...(row.source_image_url ? { sourceImageUrl: row.source_image_url } : {}),
    sourcePayload: row.source_payload ?? {},
    ...(typeof row.source_price_minor === 'number'
      ? { sourcePriceMinor: row.source_price_minor }
      : {}),
    ...(row.source_product_title
      ? { sourceProductTitle: row.source_product_title }
      : {}),
    sourceProductUrl: row.source_product_url,
    sourceSetNumber: row.source_set_number,
    status,
  };
}

export async function upsertCatalogDiscoveryCandidates({
  inputs,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  inputs: readonly CatalogDiscoveryCandidateInput[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogDiscoveryCandidate[]> {
  if (inputs.length === 0) {
    return [];
  }

  const upsertedRows: CatalogDiscoveryCandidateRow[] = [];

  for (const chunk of chunkCatalogRows(inputs, 250)) {
    const { data, error } = await supabaseClient
      .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
      .upsert(
        chunk.map((input) => ({
          auto_create_eligible: input.autoCreateEligible,
          brickset_payload: input.bricksetPayload ?? null,
          confidence: input.confidence,
          confidence_score: Math.max(
            0,
            Math.min(100, Math.floor(input.confidenceScore)),
          ),
          evidence: input.evidence,
          first_seen_at: input.firstSeenAt,
          import_error: input.importError ?? null,
          imported_set_id: input.importedSetId ?? null,
          last_seen_at: input.lastSeenAt,
          normalized_set_id: input.normalizedSetId,
          rebrickable_payload: input.rebrickablePayload ?? null,
          required_fields_present: input.requiredFieldsPresent,
          source: input.source,
          source_currency_code: input.sourceCurrencyCode ?? null,
          source_image_url: input.sourceImageUrl ?? null,
          source_payload: input.sourcePayload,
          source_price_minor: input.sourcePriceMinor ?? null,
          source_product_title: input.sourceProductTitle ?? null,
          source_product_url: input.sourceProductUrl,
          source_set_number: input.sourceSetNumber,
          status: input.status ?? 'new',
        })),
        {
          onConflict: 'normalized_set_id',
        },
      )
      .select(CATALOG_DISCOVERY_CANDIDATE_SELECT);

    if (error) {
      throw new Error('Unable to upsert catalog discovery candidates.');
    }

    upsertedRows.push(
      ...((data as CatalogDiscoveryCandidateRow[] | null) ?? []),
    );
  }

  return upsertedRows.map(toCatalogDiscoveryCandidate);
}

export async function listCatalogDiscoveryCandidatesBySetIds({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogDiscoveryCandidate[]> {
  const uniqueSetIds = [
    ...new Set(
      setIds.map((setId) => getCanonicalCatalogSetId(setId)).filter(Boolean),
    ),
  ];

  if (!uniqueSetIds.length || (!supabaseClient && !hasServerSupabaseConfig())) {
    return [];
  }

  const { data, error } = await (
    supabaseClient ?? getServerSupabaseAdminClient()
  )
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select(CATALOG_DISCOVERY_CANDIDATE_SELECT)
    .in('normalized_set_id', uniqueSetIds);

  if (error) {
    throw createCatalogDiscoveryCandidateLoadError({
      error,
      limit: uniqueSetIds.length,
      status: 'all',
    });
  }

  return ((data as CatalogDiscoveryCandidateRow[] | null) ?? []).map(
    toCatalogDiscoveryCandidate,
  );
}

export async function listCatalogDiscoveryCandidates({
  limit = 250,
  status,
  supabaseClient,
}: {
  limit?: number;
  status?: CatalogDiscoveryCandidateStatus | 'all';
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogDiscoveryCandidate[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  const selectedQuery = (supabaseClient ?? getServerSupabaseAdminClient())
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select(CATALOG_DISCOVERY_CANDIDATE_SELECT);
  const filteredQuery =
    status && status !== 'all'
      ? selectedQuery.eq('status', status)
      : selectedQuery;
  const query =
    typeof filteredQuery.order === 'function'
      ? filteredQuery
          .order('last_seen_at', { ascending: false })
          .limit(safeLimit)
      : filteredQuery;
  const { data, error } = await query;

  if (error) {
    throw createCatalogDiscoveryCandidateLoadError({
      error,
      limit: safeLimit,
      status,
    });
  }

  return ((data as CatalogDiscoveryCandidateRow[] | null) ?? []).map(
    toCatalogDiscoveryCandidate,
  );
}

export async function preflightCatalogDiscoveryCandidates({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogDiscoveryCandidatesPreflightResult> {
  const statusCounts: Partial<Record<CatalogDiscoveryCandidateStatus, number>> =
    {};
  const statusCountErrors: Partial<
    Record<CatalogDiscoveryCandidateStatus, string>
  > = {};
  const statuses: readonly CatalogDiscoveryCandidateStatus[] = [
    'new',
    'failed',
    'processing',
    'onboarding_started',
    'imported',
    'ignored',
    'non_set',
    'rejected',
    'reviewed',
  ];
  const { count: tableCount, error: tableAccessError } = await supabaseClient
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select('id', { count: 'exact', head: true })
    .limit(1);

  for (const status of statuses) {
    const { count, error } = await supabaseClient
      .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

    if (error) {
      statusCountErrors[status] = formatSupabaseDiagnosticError(error);
      continue;
    }

    statusCounts[status] = count ?? 0;
  }

  const { error: selectedColumnProbeError } = await supabaseClient
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select(CATALOG_DISCOVERY_CANDIDATE_SELECT)
    .limit(1);
  const informationSchemaClient =
    typeof supabaseClient.schema === 'function'
      ? supabaseClient.schema('information_schema')
      : supabaseClient;
  const { data: informationSchemaRows, error: informationSchemaError } =
    await informationSchemaClient
      .from('columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', CATALOG_DISCOVERY_CANDIDATES_TABLE);
  const knownColumns = Array.isArray(informationSchemaRows)
    ? new Set(
        (informationSchemaRows as { column_name?: unknown }[])
          .map((row) => row.column_name)
          .filter(
            (columnName): columnName is string =>
              typeof columnName === 'string',
          ),
      )
    : undefined;
  const { error: operatorConfidenceColumnError } = await supabaseClient
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select('operator_confidence')
    .limit(1);

  return {
    expectedColumns: CATALOG_DISCOVERY_CANDIDATE_SELECT_COLUMNS,
    ...(informationSchemaError
      ? {
          informationSchemaError: formatSupabaseDiagnosticError(
            informationSchemaError,
          ),
        }
      : {}),
    ...(knownColumns
      ? {
          missingColumns: CATALOG_DISCOVERY_CANDIDATE_SELECT_COLUMNS.filter(
            (columnName) => !knownColumns.has(columnName),
          ),
        }
      : {}),
    optionalStoredOperatorConfidenceColumn: {
      ...(operatorConfidenceColumnError
        ? {
            error: formatSupabaseDiagnosticError(operatorConfidenceColumnError),
          }
        : {}),
      exists: !operatorConfidenceColumnError,
    },
    selectedColumns: CATALOG_DISCOVERY_CANDIDATE_SELECT_COLUMNS,
    selectedColumnProbe: {
      ...(selectedColumnProbeError
        ? { error: formatSupabaseDiagnosticError(selectedColumnProbeError) }
        : {}),
      ok: !selectedColumnProbeError,
    },
    statusCounts,
    statusCountErrors,
    table: CATALOG_DISCOVERY_CANDIDATES_TABLE,
    tableAccess: {
      ...(typeof tableCount === 'number' ? { count: tableCount } : {}),
      ...(tableAccessError
        ? { error: formatSupabaseDiagnosticError(tableAccessError) }
        : {}),
      ok: !tableAccessError,
    },
    usedSetNumberColumns: ['source_set_number', 'normalized_set_id'],
  };
}

export async function updateCatalogDiscoveryCandidateReviewStatus({
  evidence,
  id,
  importError,
  importedSetId,
  status,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  evidence?: Readonly<Record<string, unknown>>;
  id: string;
  importError?: string | null;
  importedSetId?: string | null;
  status: CatalogDiscoveryCandidateStatus;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogDiscoveryCandidate> {
  const { data, error } = await supabaseClient
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .update({
      ...(typeof importError !== 'undefined'
        ? { import_error: importError }
        : {}),
      ...(typeof importedSetId !== 'undefined'
        ? { imported_set_id: importedSetId }
        : {}),
      ...(typeof evidence !== 'undefined' ? { evidence } : {}),
      last_seen_at: new Date().toISOString(),
      status,
    })
    .eq('id', id)
    .select(CATALOG_DISCOVERY_CANDIDATE_SELECT)
    .single();

  if (error || !data) {
    throw new Error('Unable to update catalog discovery candidate.');
  }

  return toCatalogDiscoveryCandidate(data as CatalogDiscoveryCandidateRow);
}

export async function getCatalogDiscoveryCandidate({
  id,
  supabaseClient,
}: {
  id: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogDiscoveryCandidate | null> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return null;
  }

  const { data, error } = await (
    supabaseClient ?? getServerSupabaseAdminClient()
  )
    .from(CATALOG_DISCOVERY_CANDIDATES_TABLE)
    .select(CATALOG_DISCOVERY_CANDIDATE_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error('Unable to load catalog discovery candidate.');
  }

  return data
    ? toCatalogDiscoveryCandidate(data as CatalogDiscoveryCandidateRow)
    : null;
}

export async function listCatalogSetSourceMetadataSetIds({
  locale,
  matchConfidence,
  source,
  supabaseClient,
}: {
  locale: string;
  matchConfidence: string;
  source: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<string[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  const client = supabaseClient ?? getServerSupabaseAdminClient();
  const setIds: string[] = [];

  for (let from = 0; ; from += CATALOG_SET_SOURCE_METADATA_PAGE_SIZE) {
    const { data, error } = await client
      .from(CATALOG_SET_SOURCE_METADATA_TABLE)
      .select('catalog_set_id')
      .eq('source', source)
      .eq('locale', locale)
      .eq('match_confidence', matchConfidence)
      .range(from, from + CATALOG_SET_SOURCE_METADATA_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load catalog set source metadata set ids.');
    }

    const pageSetIds = ((data ?? []) as { catalog_set_id?: string | null }[])
      .map((row) => row.catalog_set_id?.trim())
      .filter((setId): setId is string => Boolean(setId));

    setIds.push(...pageSetIds);

    if ((data ?? []).length < CATALOG_SET_SOURCE_METADATA_PAGE_SIZE) {
      break;
    }
  }

  return setIds;
}

function buildCatalogSetSourceMetadataSetNumberVariants(
  setNumber: string,
): string[] {
  const trimmedSetNumber = setNumber.trim();
  const canonicalSetId = getCanonicalCatalogSetId(trimmedSetNumber);

  return [
    ...new Set(
      [
        trimmedSetNumber,
        canonicalSetId,
        canonicalSetId ? `${canonicalSetId}-1` : undefined,
      ].filter((value): value is string => Boolean(value?.trim())),
    ),
  ];
}

function pickRakutenLegoSourceMetadataJson(
  metadataJson: Record<string, unknown> | null,
): Record<string, unknown> {
  const sourceMetadata = metadataJson ?? {};
  const features = Array.isArray(sourceMetadata['features'])
    ? sourceMetadata['features']
    : undefined;

  return {
    description:
      typeof sourceMetadata['description'] === 'string'
        ? sourceMetadata['description']
        : null,
    ...(features ? { features } : {}),
    gtin:
      typeof sourceMetadata['gtin'] === 'string'
        ? sourceMetadata['gtin']
        : null,
    imageUrl:
      typeof sourceMetadata['imageUrl'] === 'string'
        ? sourceMetadata['imageUrl']
        : null,
    priceSourceSeen: sourceMetadata['priceSourceSeen'] === true,
    title:
      typeof sourceMetadata['title'] === 'string'
        ? sourceMetadata['title']
        : null,
  };
}

export async function backfillRakutenLegoSourceMetadataForCatalogSet({
  catalogSetId,
  lastSeenAt = new Date().toISOString(),
  setNumber,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  catalogSetId: string;
  lastSeenAt?: string;
  setNumber: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetSourceMetadataBackfillResult> {
  const setNumberVariants =
    buildCatalogSetSourceMetadataSetNumberVariants(setNumber);

  if (!setNumberVariants.length) {
    console.info('[catalog-source-metadata] metadata_backfill_missing', {
      catalogSetId,
      setNumber,
      source: RAKUTEN_LEGO_SOURCE,
    });

    return {
      found: false,
      missing: true,
      upsertedCount: 0,
    };
  }

  const { data, error } = await supabaseClient
    .from(CATALOG_SET_SOURCE_METADATA_TABLE)
    .select('set_number, metadata_json, policy, last_seen_at')
    .eq('source', RAKUTEN_LEGO_SOURCE)
    .eq('locale', RAKUTEN_LEGO_NL_LOCALE)
    .eq('match_confidence', RAKUTEN_LEGO_EXACT_MATCH_CONFIDENCE)
    .in('set_number', setNumberVariants)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      'Unable to load Rakuten LEGO source metadata for backfill.',
    );
  }

  const sourceMetadata = data as CatalogSetSourceMetadataRow | null;

  if (!sourceMetadata) {
    console.info('[catalog-source-metadata] metadata_backfill_missing', {
      catalogSetId,
      setNumber,
      setNumberVariants,
      source: RAKUTEN_LEGO_SOURCE,
    });

    return {
      found: false,
      missing: true,
      upsertedCount: 0,
    };
  }

  console.info('[catalog-source-metadata] metadata_backfill_found', {
    catalogSetId,
    setNumber: sourceMetadata.set_number,
    source: RAKUTEN_LEGO_SOURCE,
  });

  const upsertedCount = await upsertCatalogSetSourceMetadata({
    inputs: [
      {
        catalogSetId,
        lastSeenAt: sourceMetadata.last_seen_at ?? lastSeenAt,
        locale: RAKUTEN_LEGO_NL_LOCALE,
        matchConfidence: RAKUTEN_LEGO_EXACT_MATCH_CONFIDENCE,
        metadataJson: pickRakutenLegoSourceMetadataJson(
          sourceMetadata.metadata_json,
        ),
        policy:
          sourceMetadata.policy?.trim() || RAKUTEN_LEGO_DEFAULT_METADATA_POLICY,
        setNumber:
          getCanonicalCatalogSetId(sourceMetadata.set_number) ?? setNumber,
        source: RAKUTEN_LEGO_SOURCE,
      },
    ],
    supabaseClient,
  });

  console.info('[catalog-source-metadata] metadata_backfill_upserted', {
    catalogSetId,
    setNumber,
    source: RAKUTEN_LEGO_SOURCE,
    upsertedCount,
  });

  return {
    found: true,
    missing: false,
    upsertedCount,
  };
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
      await backfillRakutenLegoSourceMetadataForCatalogSet({
        catalogSetId: setConflict.setId,
        setNumber: setConflict.sourceSetNumber,
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
    await backfillRakutenLegoSourceMetadataForCatalogSet({
      catalogSetId: data.set_id,
      setNumber: data.source_set_number ?? normalizedSet.sourceSetNumber,
      supabaseClient: activeSupabaseClient,
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

function getLocalRebrickableSetNumberCandidates(setNumberOrId: string) {
  const trimmed = setNumberOrId.trim();
  const canonicalSetId = getCanonicalCatalogSetId(trimmed);

  return [
    ...new Set(
      [
        trimmed,
        canonicalSetId,
        canonicalSetId ? `${canonicalSetId}-1` : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
}

function toLocalRebrickableSetMirrorMetadata({
  row,
  themeName,
}: {
  row: LocalRebrickableSetRow;
  themeName: string;
}): LocalRebrickableSetMirrorMetadata {
  const imageUrl = row.img_url ?? row.set_img_url ?? undefined;
  const numParts =
    typeof row.num_parts === 'number' && Number.isFinite(row.num_parts)
      ? row.num_parts
      : 0;
  const year =
    typeof row.year === 'number' && Number.isFinite(row.year)
      ? row.year
      : new Date().getUTCFullYear();
  const catalogSetInput = toSearchResult({
    ...(imageUrl ? { imageUrl } : {}),
    name: row.name,
    numParts,
    setNumber: row.set_num,
    themeName,
    year,
  });

  return {
    catalogSetInput,
    ...(row.img_url ? { imgUrl: row.img_url } : {}),
    name: row.name,
    numParts,
    setNum: row.set_num,
    ...(row.set_img_url ? { setImgUrl: row.set_img_url } : {}),
    themeId: row.theme_id,
    themeName,
    year,
  };
}

export async function getLocalRebrickableSetMirrorMetadata({
  setNumberOrId,
  supabaseClient,
}: {
  setNumberOrId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<LocalRebrickableSetMirrorMetadata | undefined> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return undefined;
  }

  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const setNumberCandidates =
    getLocalRebrickableSetNumberCandidates(setNumberOrId);

  if (setNumberCandidates.length === 0) {
    return undefined;
  }

  const { data, error } = await activeSupabaseClient
    .from(REBRICKABLE_SETS_TABLE)
    .select('set_num, name, year, theme_id, num_parts, img_url, set_img_url')
    .in('set_num', setNumberCandidates)
    .limit(1);

  if (error) {
    throw new Error('Unable to read the local Rebrickable sets mirror.');
  }

  const row = ((data as LocalRebrickableSetRow[] | null) ?? [])[0];

  if (!row) {
    return undefined;
  }

  const sourceTheme = await getLocalRebrickableThemeRow({
    supabaseClient: activeSupabaseClient,
    themeId: row.theme_id,
  });
  const themeName = sourceTheme?.name ?? 'LEGO';

  return toLocalRebrickableSetMirrorMetadata({
    row,
    themeName,
  });
}

export async function getLocalRebrickableSetMetadata({
  setNumberOrId,
  supabaseClient,
}: {
  setNumberOrId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogExternalSetSearchResult | undefined> {
  return (
    await getLocalRebrickableSetMirrorMetadata({
      setNumberOrId,
      supabaseClient,
    })
  )?.catalogSetInput;
}

export async function createCatalogSetFromLocalRebrickableMirror({
  setNumberOrId,
  supabaseClient,
}: {
  setNumberOrId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSet | undefined> {
  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const setNumberCandidates =
    getLocalRebrickableSetNumberCandidates(setNumberOrId);

  if (setNumberCandidates.length === 0) {
    return undefined;
  }

  const { data, error } = await activeSupabaseClient
    .from(REBRICKABLE_SETS_TABLE)
    .select('set_num, name, year, theme_id, num_parts, img_url, set_img_url')
    .in('set_num', setNumberCandidates)
    .limit(1);

  if (error) {
    throw new Error('Unable to read the local Rebrickable sets mirror.');
  }

  const row = ((data as LocalRebrickableSetRow[] | null) ?? [])[0];

  if (!row) {
    return undefined;
  }

  const sourceTheme = await getLocalRebrickableThemeRow({
    supabaseClient: activeSupabaseClient,
    themeId: row.theme_id,
  });

  if (!sourceTheme) {
    throw new Error(
      `Local Rebrickable theme ${row.theme_id} is missing for ${row.set_num}.`,
    );
  }

  const normalizedSet = toSearchResult({
    ...(row.img_url || row.set_img_url
      ? { imageUrl: row.img_url ?? row.set_img_url ?? undefined }
      : {}),
    name: row.name,
    numParts:
      typeof row.num_parts === 'number' && Number.isFinite(row.num_parts)
        ? row.num_parts
        : 0,
    setNumber: row.set_num,
    themeName: sourceTheme.name,
    year:
      typeof row.year === 'number' && Number.isFinite(row.year)
        ? row.year
        : new Date().getUTCFullYear(),
  });
  const setConflict = await getCatalogOverlaySetByColumn({
    column: 'set_id',
    includeInactive: true,
    supabaseClient: activeSupabaseClient,
    value: normalizedSet.setId,
  });

  if (setConflict) {
    return setConflict;
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

  const themePersistence = await resolveLocalRebrickableThemePersistence({
    sourceTheme,
    supabaseClient: activeSupabaseClient,
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

    throw new Error('Unable to create the catalog set from local mirror.');
  }
}

function readCandidatePayloadString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readCandidatePayloadInteger(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
  minValue: number,
): number | undefined {
  const value = payload?.[key];

  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minValue
    ? value
    : undefined;
}

function getTrustedDiscoveryCandidateDisplayTitle(
  candidate: CatalogDiscoveryCandidate,
): string | undefined {
  return candidate.sourceProductTitle?.trim() || undefined;
}

function getDiscoveryCandidateBricksetName(
  candidate: CatalogDiscoveryCandidate,
): string | undefined {
  const value = candidate.bricksetPayload?.['name'];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getDiscoveryCandidateRebrickableName({
  candidate,
  localMirrorMetadata,
}: {
  candidate: CatalogDiscoveryCandidate;
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata;
}): string | undefined {
  return (
    localMirrorMetadata?.name ||
    readCandidatePayloadString(candidate.rebrickablePayload, 'name')
  );
}

function buildReferencePriceEvidence(
  candidate: CatalogDiscoveryCandidate,
): Readonly<Record<string, unknown>> | undefined {
  if (
    typeof candidate.sourcePriceMinor !== 'number' ||
    candidate.sourcePriceMinor <= 0
  ) {
    return undefined;
  }

  return {
    currencyCode: candidate.sourceCurrencyCode ?? 'EUR',
    priceMinor: candidate.sourcePriceMinor,
    source: candidate.source,
    sourceProductUrl: candidate.sourceProductUrl,
    usage: 'reference_price_only',
  };
}

function buildCatalogSetInputFromDiscoveryCandidate(
  candidate: CatalogDiscoveryCandidate,
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata,
): {
  input: CatalogExternalSetSearchResult;
  metadataIncomplete: boolean;
  missingFields: readonly string[];
} {
  const payload = candidate.rebrickablePayload;
  const localMirrorInput = localMirrorMetadata?.catalogSetInput;
  const missingFields: string[] = [];
  const setId =
    localMirrorInput?.setId ||
    readCandidatePayloadString(payload, 'setId') ||
    getCanonicalCatalogSetId(candidate.sourceSetNumber) ||
    candidate.normalizedSetId;
  const sourceSetNumber =
    localMirrorInput?.sourceSetNumber ||
    readCandidatePayloadString(payload, 'sourceSetNumber') ||
    candidate.sourceSetNumber ||
    `${setId}-1`;
  const name =
    localMirrorInput?.name ||
    readCandidatePayloadString(payload, 'name') ||
    getTrustedDiscoveryCandidateDisplayTitle(candidate) ||
    `LEGO set ${setId}`;
  const imageUrl =
    localMirrorInput?.imageUrl ||
    readCandidatePayloadString(payload, 'imageUrl') ||
    candidate.sourceImageUrl?.trim();
  const pieces =
    (typeof localMirrorInput?.pieces === 'number'
      ? localMirrorInput.pieces
      : undefined) ??
    readCandidatePayloadInteger(payload, 'pieces', 0) ??
    0;
  const releaseYear =
    (typeof localMirrorInput?.releaseYear === 'number'
      ? localMirrorInput.releaseYear
      : undefined) ??
    readCandidatePayloadInteger(payload, 'releaseYear', 1) ??
    new Date().getUTCFullYear();
  const theme =
    localMirrorInput?.theme ||
    resolveCandidateThemeName({
      fallbackTitle: name,
      payload,
      sourcePayload: candidate.sourcePayload,
    });
  const input = toSearchResult({
    ...(imageUrl ? { imageUrl } : {}),
    name,
    numParts: pieces,
    setNumber: sourceSetNumber,
    themeName: theme,
    year: releaseYear,
  });

  if (!localMirrorInput?.name && !readCandidatePayloadString(payload, 'name')) {
    missingFields.push('name');
  }

  if (
    typeof localMirrorInput?.pieces !== 'number' &&
    readCandidatePayloadInteger(payload, 'pieces', 0) === undefined
  ) {
    missingFields.push('pieces');
  }

  if (
    typeof localMirrorInput?.releaseYear !== 'number' &&
    readCandidatePayloadInteger(payload, 'releaseYear', 1) === undefined
  ) {
    missingFields.push('releaseYear');
  }

  if (
    !localMirrorInput?.theme &&
    !readCandidatePayloadString(payload, 'theme')
  ) {
    missingFields.push('theme');
  }

  if (!imageUrl) {
    missingFields.push('imageUrl');
  }

  return {
    input,
    metadataIncomplete: missingFields.length > 0,
    missingFields,
  };
}

async function resolveDiscoveryCandidateThemePersistence({
  localMirrorMetadata,
  supabaseClient,
  themeName,
}: {
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata;
  supabaseClient: CatalogSupabaseClient;
  themeName: string;
}): Promise<CatalogResolvedThemePersistence> {
  if (localMirrorMetadata) {
    const sourceTheme = await getLocalRebrickableThemeRow({
      supabaseClient,
      themeId: localMirrorMetadata.themeId,
    });

    if (sourceTheme) {
      return resolveLocalRebrickableThemePersistence({
        sourceTheme,
        supabaseClient,
      });
    }
  }

  return buildCatalogThemePersistenceFromCandidateTheme(themeName);
}

async function upsertDiscoveryCandidateImportMetadata({
  catalogSet,
  candidate,
  localMirrorMetadata,
  missingFields,
  supabaseClient,
}: {
  catalogSet: CatalogSet;
  candidate: CatalogDiscoveryCandidate;
  localMirrorMetadata?: LocalRebrickableSetMirrorMetadata;
  missingFields: readonly string[];
  supabaseClient: CatalogSupabaseClient;
}) {
  const referencePriceEvidence = buildReferencePriceEvidence(candidate);
  const trustedDisplayTitle =
    getTrustedDiscoveryCandidateDisplayTitle(candidate);
  const importedAt = new Date().toISOString();
  const rebrickableName = getDiscoveryCandidateRebrickableName({
    candidate,
    localMirrorMetadata,
  });
  const bricksetName = getDiscoveryCandidateBricksetName(candidate);

  await upsertCatalogSetSourceMetadata({
    inputs: [
      {
        catalogSetId: catalogSet.setId,
        lastSeenAt: candidate.lastSeenAt,
        locale: RAKUTEN_LEGO_NL_LOCALE,
        matchConfidence: RAKUTEN_LEGO_EXACT_MATCH_CONFIDENCE,
        metadataJson: {
          aliases: [trustedDisplayTitle, rebrickableName, bricksetName].filter(
            (alias): alias is string => Boolean(alias),
          ),
          candidateId: candidate.id,
          discovered_at: candidate.firstSeenAt,
          evidence: candidate.evidence,
          discoveryOperatorConfidence: candidate.operatorConfidence,
          discoveryOperatorConfidenceReasons:
            candidate.operatorConfidenceReasons,
          importMode: 'discovery_candidate_evidence',
          imported_at: importedAt,
          indexingPolicy: missingFields.length
            ? 'metadata_incomplete_needs_enrichment'
            : 'source_evidence_complete',
          metadataQuality: missingFields.length
            ? 'needs_enrichment'
            : 'source_evidence',
          missingFields,
          feed_title_nl: trustedDisplayTitle,
          localized_title_nl: trustedDisplayTitle,
          ...(referencePriceEvidence ? { referencePriceEvidence } : {}),
          title: trustedDisplayTitle,
          ...(bricksetName ? { bricksetName } : {}),
          rebrickableEnrichmentUsed: Boolean(candidate.rebrickablePayload),
          ...(rebrickableName ? { rebrickableName } : {}),
          normalized_set_number: candidate.normalizedSetId,
          rakuten_product_title: candidate.sourceProductTitle,
          source_set_number: candidate.sourceSetNumber,
          sourcePayload: candidate.sourcePayload,
          source_url: candidate.sourceProductUrl,
          sourcePriceEvidence: referencePriceEvidence,
          product_url: candidate.sourceProductUrl,
          sourceProductUrl: candidate.sourceProductUrl,
        },
        policy: RAKUTEN_LEGO_DEFAULT_METADATA_POLICY,
        setNumber: catalogSet.sourceSetNumber,
        source: candidate.source,
      },
    ],
    supabaseClient,
  });
}

async function updateCatalogSetPresentationFromDiscoveryCandidate({
  candidate,
  desiredSet,
  existingSet,
  supabaseClient,
}: {
  candidate: CatalogDiscoveryCandidate;
  desiredSet: CatalogExternalSetSearchResult;
  existingSet: CatalogSet;
  supabaseClient: CatalogSupabaseClient;
}): Promise<CatalogSet> {
  const hasCanonicalSourceName =
    desiredSet.name !== getTrustedDiscoveryCandidateDisplayTitle(candidate) &&
    !/^LEGO set \d/u.test(desiredSet.name);

  if (!hasCanonicalSourceName) {
    return existingSet;
  }

  const slugConflict =
    desiredSet.slug === existingSet.slug
      ? undefined
      : await getCatalogOverlaySetByColumn({
          column: 'slug',
          includeInactive: true,
          supabaseClient,
          value: desiredSet.slug,
        });
  const nextSlug =
    !slugConflict || slugConflict.setId === existingSet.setId
      ? desiredSet.slug
      : existingSet.slug;

  if (existingSet.name === desiredSet.name && existingSet.slug === nextSlug) {
    return existingSet;
  }

  const { error } = await supabaseClient
    .from(CATALOG_SETS_TABLE)
    .update({
      name: desiredSet.name,
      slug: nextSlug,
      updated_at: new Date().toISOString(),
    })
    .eq('set_id', existingSet.setId);

  if (error) {
    throw new Error('Unable to update catalog set presentation metadata.');
  }

  return (
    (await getCatalogOverlaySetByColumn({
      column: 'set_id',
      includeInactive: true,
      supabaseClient,
      value: existingSet.setId,
    })) ?? existingSet
  );
}

export async function createCatalogSetFromDiscoveryCandidate({
  candidate,
  supabaseClient,
}: {
  candidate: CatalogDiscoveryCandidate;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<{ catalogSet: CatalogSet; metadataIncomplete: boolean }> {
  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const localMirrorMetadata = await getLocalRebrickableSetMirrorMetadata({
    setNumberOrId: candidate.sourceSetNumber || candidate.normalizedSetId,
    supabaseClient: activeSupabaseClient,
  });
  const { input, metadataIncomplete, missingFields } =
    buildCatalogSetInputFromDiscoveryCandidate(candidate, localMirrorMetadata);
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
    const presentationSet =
      await updateCatalogSetPresentationFromDiscoveryCandidate({
        candidate,
        desiredSet: normalizedSet,
        existingSet: setConflict,
        supabaseClient: activeSupabaseClient,
      });

    await upsertDiscoveryCandidateImportMetadata({
      catalogSet: presentationSet,
      candidate,
      localMirrorMetadata,
      missingFields,
      supabaseClient: activeSupabaseClient,
    });

    return {
      catalogSet: presentationSet,
      metadataIncomplete,
    };
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

  const themePersistence = await resolveDiscoveryCandidateThemePersistence({
    localMirrorMetadata,
    supabaseClient: activeSupabaseClient,
    themeName: normalizedSet.theme,
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
    const catalogSet = toCatalogSet({
      row: data,
      themeIdentity: resolveCatalogThemeIdentityFromPersistence({
        legacyTheme: data.theme,
        primaryThemeName: themePersistence.primaryTheme.display_name,
        sourceThemeName: themePersistence.sourceTheme.source_theme_name,
      }),
    });

    await upsertDiscoveryCandidateImportMetadata({
      catalogSet,
      candidate,
      localMirrorMetadata,
      missingFields,
      supabaseClient: activeSupabaseClient,
    });
    await refreshCatalogThemeSummaries({
      supabaseClient: activeSupabaseClient,
    });

    return {
      catalogSet,
      metadataIncomplete,
    };
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

    throw new Error(
      'Unable to create the catalog set from candidate evidence.',
    );
  }
}
