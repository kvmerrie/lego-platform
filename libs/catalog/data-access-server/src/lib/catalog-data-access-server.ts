import {
  getCatalogSetBySlug,
  listCatalogSetSummaries,
} from '@lego-platform/catalog/data-access';
import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import {
  type CatalogExternalSetSearchResult,
  type CatalogOverlaySet,
  type CatalogSetDetail,
  type CatalogSetSummary,
  createCatalogSetRecord,
  getCatalogPrimaryTheme,
  resolveCatalogThemeIdentity,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  getRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CATALOG_SETS_OVERLAY_TABLE = 'catalog_sets_overlay';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';

type CatalogSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogOverlaySetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  release_year: number;
  set_id: string;
  slug: string;
  source: string;
  source_set_number: string;
  status: string;
  theme: string;
  updated_at: string;
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
  product_url: string;
  set_id: string;
  validation_status: string;
}

export interface CatalogLiveOffer {
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  checkedAt: string;
  condition: 'new';
  currency: 'EUR';
  market: 'NL';
  merchant: 'amazon' | 'bol' | 'lego' | 'other';
  merchantName: string;
  merchantSlug: string;
  priceCents: number;
  setId: string;
  url: string;
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

interface DatabaseConflictLike {
  code?: string;
  details?: string;
  message?: string;
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

function getCatalogOfferMerchantFromMerchantSlug(
  merchantSlug: string,
): CatalogLiveOffer['merchant'] {
  if (merchantSlug === 'amazon-nl') {
    return 'amazon';
  }

  if (merchantSlug === 'bol') {
    return 'bol';
  }

  if (merchantSlug === 'lego-nl') {
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

    if (left.priceCents !== right.priceCents) {
      return left.priceCents - right.priceCents;
    }

    return left.merchantName.localeCompare(right.merchantName, 'nl');
  });
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

  const checkedAt = latestOffer.observed_at ?? latestOffer.updated_at;

  if (!checkedAt) {
    return undefined;
  }

  return {
    availability: normalizeRuntimeOfferAvailability(latestOffer.availability),
    checkedAt,
    condition: 'new',
    currency: 'EUR',
    market: 'NL',
    merchant: getCatalogOfferMerchantFromMerchantSlug(merchant.slug),
    merchantName: merchant.name,
    merchantSlug: merchant.slug,
    priceCents: latestOffer.price_minor,
    setId: offerSeed.set_id,
    url: offerSeed.product_url,
  };
}

function toCatalogOverlaySet(row: CatalogOverlaySetRow): CatalogOverlaySet {
  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieces: row.piece_count,
    releaseYear: row.release_year,
    setId: row.set_id,
    slug: row.slug,
    source: row.source === 'rebrickable' ? 'rebrickable' : 'rebrickable',
    sourceSetNumber: row.source_set_number,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    theme: getCatalogPrimaryTheme({
      rawTheme: row.theme,
    }),
    updatedAt: row.updated_at,
  };
}

function toCatalogSummary(overlaySet: CatalogOverlaySet): CatalogSetSummary {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: overlaySet.theme,
  });

  return {
    id: overlaySet.setId,
    slug: overlaySet.slug,
    name: overlaySet.name,
    theme: themeIdentity.primaryTheme,
    releaseYear: overlaySet.releaseYear,
    pieces: overlaySet.pieces,
    collectorAngle: `Nieuw in Brickhunt. ${themeIdentity.primaryTheme} staat klaar voor de eerste prijscheck.`,
    imageUrl: overlaySet.imageUrl,
  };
}

function toCatalogSetDetail(overlaySet: CatalogOverlaySet): CatalogSetDetail {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: overlaySet.theme,
  });

  return {
    id: overlaySet.setId,
    slug: overlaySet.slug,
    name: overlaySet.name,
    theme: themeIdentity.primaryTheme,
    releaseYear: overlaySet.releaseYear,
    pieces: overlaySet.pieces,
    imageUrl: overlaySet.imageUrl,
    collectorAngle: `Nieuw in Brickhunt. ${overlaySet.name} staat klaar voor de eerste prijscheck.`,
    tagline: `We bouwen nu de eerste prijsvergelijking op voor deze ${themeIdentity.primaryTheme}-set.`,
    availability: 'Eerste winkels worden nu gekoppeld',
    collectorHighlights: [
      `${overlaySet.pieces.toLocaleString('nl-NL')} stenen`,
      `Release ${overlaySet.releaseYear}`,
      'Zodra de eerste merchants landen, zie je hier de beste route',
    ],
    ...(themeIdentity.secondaryThemes[0]
      ? {
          subtheme: themeIdentity.secondaryThemes[0],
        }
      : {}),
  };
}

function buildCatalogConflictTargetLabel(
  conflictTarget: CatalogConflictTarget,
) {
  return `${conflictTarget.name} (${conflictTarget.setId})`;
}

function buildCatalogOverlaySetIdConflictMessage({
  conflictTarget,
  source,
}: {
  conflictTarget: CatalogConflictTarget;
  source: 'overlay' | 'snapshot';
}) {
  return source === 'snapshot'
    ? `Set ${conflictTarget.setId} staat al in de Brickhunt-catalogus als ${buildCatalogConflictTargetLabel(conflictTarget)}.`
    : `Set ${conflictTarget.setId} staat al in de catalog-overlay als ${buildCatalogConflictTargetLabel(conflictTarget)}.`;
}

function buildCatalogOverlaySlugConflictMessage({
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
  catalogSet: Pick<CatalogOverlaySet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget;
function toCatalogConflictTarget(
  catalogSet:
    | Pick<CatalogSetSummary, 'id' | 'name' | 'slug'>
    | Pick<CatalogOverlaySet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget {
  return {
    name: catalogSet.name,
    setId: 'id' in catalogSet ? catalogSet.id : catalogSet.setId,
    slug: catalogSet.slug,
  };
}

function getCatalogOverlayInsertConflictMessage({
  error,
  normalizedSet,
  overlaySets,
  snapshotSummaries,
}: {
  error: DatabaseConflictLike;
  normalizedSet: CatalogExternalSetSearchResult;
  overlaySets: readonly CatalogOverlaySet[];
  snapshotSummaries: readonly CatalogSetSummary[];
}) {
  if (error.code !== '23505') {
    return null;
  }

  const rawConflictText =
    `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const snapshotSlugConflict = snapshotSummaries.find(
    (catalogSetSummary) => catalogSetSummary.slug === normalizedSet.slug,
  );
  const overlaySlugConflict = overlaySets.find(
    (overlaySet) => overlaySet.slug === normalizedSet.slug,
  );

  if (rawConflictText.includes('slug')) {
    return buildCatalogOverlaySlugConflictMessage({
      conflictTarget:
        (snapshotSlugConflict
          ? toCatalogConflictTarget(snapshotSlugConflict)
          : undefined) ??
        (overlaySlugConflict
          ? toCatalogConflictTarget(overlaySlugConflict)
          : undefined),
      slug: normalizedSet.slug,
    });
  }

  const snapshotSetConflict = snapshotSummaries.find(
    (catalogSetSummary) => catalogSetSummary.id === normalizedSet.setId,
  );

  if (snapshotSetConflict) {
    return buildCatalogOverlaySetIdConflictMessage({
      conflictTarget: toCatalogConflictTarget(snapshotSetConflict),
      source: 'snapshot',
    });
  }

  const overlaySetConflict = overlaySets.find(
    (overlaySet) => overlaySet.setId === normalizedSet.setId,
  );

  if (overlaySetConflict) {
    return buildCatalogOverlaySetIdConflictMessage({
      conflictTarget: toCatalogConflictTarget(overlaySetConflict),
      source: 'overlay',
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

  if (!isInteger(numParts) || numParts <= 0) {
    throw new Error(
      'Invalid Rebrickable search result: num_parts must be a positive integer.',
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

async function listCatalogOverlaySetRows({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogSupabaseClient;
}): Promise<CatalogOverlaySetRow[]> {
  const query = supabaseClient
    .from(CATALOG_SETS_OVERLAY_TABLE)
    .select(
      'set_id, source_set_number, slug, name, theme, release_year, piece_count, image_url, source, status, created_at, updated_at',
    );

  const { data, error } = includeInactive
    ? await query.order('created_at', { ascending: false })
    : await query.eq('status', 'active').order('created_at', {
        ascending: false,
      });

  if (error) {
    throw new Error('Unable to load catalog overlay sets.');
  }

  return (data as CatalogOverlaySetRow[] | null) ?? [];
}

export async function listCatalogOverlaySets({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogOverlaySet[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const rows = await listCatalogOverlaySetRows({
      includeInactive,
      supabaseClient: supabaseClient ?? getServerSupabaseAdminClient(),
    });

    return rows.map(toCatalogOverlaySet);
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogSetSummariesWithOverlay({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogSetSummary[]> {
  const snapshotSummaries = listCatalogSetSummaries();
  const overlaySummaries = (await listCatalogOverlaySets({ supabaseClient }))
    .filter(
      (overlaySet) =>
        !snapshotSummaries.some((summary) => summary.id === overlaySet.setId),
    )
    .map(toCatalogSummary);

  return sortCatalogSetSummaries([...snapshotSummaries, ...overlaySummaries]);
}

export async function findCatalogSetSummaryByIdWithOverlay({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetSummary | undefined> {
  const snapshotSummary = listCatalogSetSummaries().find(
    (catalogSetSummary) => catalogSetSummary.id === setId,
  );

  if (snapshotSummary) {
    return snapshotSummary;
  }

  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return undefined;
  }

  try {
    const overlayRows = await listCatalogOverlaySetRows({
      supabaseClient: supabaseClient ?? getServerSupabaseAdminClient(),
    });
    const overlaySet = overlayRows
      .map(toCatalogOverlaySet)
      .find((candidate) => candidate.setId === setId);

    return overlaySet ? toCatalogSummary(overlaySet) : undefined;
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
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
    const { data: seedData, error: seedError } = await activeSupabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, product_url, is_active, validation_status',
      )
      .eq('set_id', setId)
      .eq('is_active', true)
      .eq('validation_status', 'valid');

    if (seedError) {
      throw new Error('Unable to load live catalog offers.');
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
      throw new Error('Unable to load live catalog offers.');
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

    return sortLiveCatalogOffers(
      offerSeeds.flatMap((offerSeed) => {
        const merchant = merchantById.get(offerSeed.merchant_id);
        const latestOffer = latestOfferBySeedId.get(offerSeed.id);

        if (!merchant || !latestOffer) {
          return [];
        }

        const catalogLiveOffer = toCatalogLiveOffer({
          latestOffer,
          merchant,
          offerSeed,
        });

        return catalogLiveOffer ? [catalogLiveOffer] : [];
      }),
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function getCatalogSetBySlugWithOverlay({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetDetail | undefined> {
  const snapshotSet = getCatalogSetBySlug(slug);

  if (snapshotSet) {
    return snapshotSet;
  }

  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return undefined;
  }

  try {
    const { data, error } = await (
      supabaseClient ?? getServerSupabaseAdminClient()
    )
      .from(CATALOG_SETS_OVERLAY_TABLE)
      .select(
        'set_id, source_set_number, slug, name, theme, release_year, piece_count, image_url, source, status, created_at, updated_at',
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error('Unable to load the catalog overlay set by slug.');
    }

    return data
      ? toCatalogSetDetail(toCatalogOverlaySet(data as CatalogOverlaySetRow))
      : undefined;
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
    }

    throw error;
  }
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
  const [overlaySets, snapshotSummaries, payload] = await Promise.all([
    listCatalogOverlaySets({
      includeInactive: true,
      supabaseClient,
    }),
    Promise.resolve(listCatalogSetSummaries()),
    rebrickableClient.searchSets(normalizedQuery, {
      pageSize: 12,
    }),
  ]);
  const existingSetIds = new Set([
    ...snapshotSummaries.map((catalogSetSummary) => catalogSetSummary.id),
    ...overlaySets.map((overlaySet) => overlaySet.setId),
  ]);
  const validatedSearchSets = validateRebrickableSearchPayload(payload).map(
    validateRebrickableSearchSetPayload,
  );
  const uniqueThemeIds = [
    ...new Set(validatedSearchSets.map((searchSet) => searchSet.themeId)),
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

  return validatedSearchSets
    .map((validatedSearchSet) =>
      toSearchResult({
        ...validatedSearchSet,
        themeName:
          themeNameById.get(validatedSearchSet.themeId) ?? 'Onbekend thema',
      }),
    )
    .filter((searchResult) => !existingSetIds.has(searchResult.setId));
}

export async function createCatalogOverlaySet({
  input,
  supabaseClient,
}: {
  input: CatalogExternalSetSearchResult;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogOverlaySet> {
  const normalizedSet = toSearchResult({
    imageUrl: input.imageUrl,
    name: input.name,
    numParts: input.pieces,
    setNumber: input.sourceSetNumber,
    themeName: input.theme,
    year: input.releaseYear,
  });
  const snapshotSummaries = listCatalogSetSummaries();
  const snapshotSetConflict = snapshotSummaries.find(
    (catalogSetSummary) => catalogSetSummary.id === normalizedSet.setId,
  );

  if (snapshotSetConflict) {
    throw new Error(
      buildCatalogOverlaySetIdConflictMessage({
        conflictTarget: toCatalogConflictTarget(snapshotSetConflict),
        source: 'snapshot',
      }),
    );
  }

  const snapshotSlugConflict = snapshotSummaries.find(
    (catalogSetSummary) => catalogSetSummary.slug === normalizedSet.slug,
  );

  if (snapshotSlugConflict) {
    throw new Error(
      buildCatalogOverlaySlugConflictMessage({
        conflictTarget: toCatalogConflictTarget(snapshotSlugConflict),
        slug: normalizedSet.slug,
      }),
    );
  }

  const existingOverlaySets = await listCatalogOverlaySets({
    includeInactive: true,
    supabaseClient,
  });
  const overlaySetConflict = existingOverlaySets.find(
    (overlaySet) => overlaySet.setId === normalizedSet.setId,
  );

  if (overlaySetConflict) {
    throw new Error(
      buildCatalogOverlaySetIdConflictMessage({
        conflictTarget: toCatalogConflictTarget(overlaySetConflict),
        source: 'overlay',
      }),
    );
  }

  const overlaySlugConflict = existingOverlaySets.find(
    (overlaySet) => overlaySet.slug === normalizedSet.slug,
  );

  if (overlaySlugConflict) {
    throw new Error(
      buildCatalogOverlaySlugConflictMessage({
        conflictTarget: toCatalogConflictTarget(overlaySlugConflict),
        slug: normalizedSet.slug,
      }),
    );
  }

  const { data, error } = await (
    supabaseClient ?? getServerSupabaseAdminClient()
  )
    .from(CATALOG_SETS_OVERLAY_TABLE)
    .insert({
      image_url: normalizedSet.imageUrl ?? null,
      name: normalizedSet.name,
      piece_count: normalizedSet.pieces,
      release_year: normalizedSet.releaseYear,
      set_id: normalizedSet.setId,
      slug: normalizedSet.slug,
      source: normalizedSet.source,
      source_set_number: normalizedSet.sourceSetNumber,
      status: 'active',
      theme: normalizedSet.theme,
    })
    .select(
      'set_id, source_set_number, slug, name, theme, release_year, piece_count, image_url, source, status, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    const conflictMessage =
      error &&
      getCatalogOverlayInsertConflictMessage({
        error,
        normalizedSet,
        overlaySets: existingOverlaySets,
        snapshotSummaries,
      });

    if (conflictMessage) {
      throw new Error(conflictMessage);
    }

    throw new Error('Unable to create the catalog overlay set.');
  }

  return toCatalogOverlaySet(data as CatalogOverlaySetRow);
}
