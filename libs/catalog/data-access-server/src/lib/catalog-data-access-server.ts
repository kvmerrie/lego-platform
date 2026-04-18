import {
  catalogSnapshot,
  getCatalogSetBySlug,
  listCatalogSetSummaries,
} from '@lego-platform/catalog/data-access';
import { createRebrickableClient } from '@lego-platform/catalog/data-access-sync';
import {
  type CatalogCanonicalSet,
  type CatalogExternalSetSearchResult,
  type CatalogOverlaySet,
  type CatalogSetDetail,
  type CatalogSetRecord,
  type CatalogSetSummary,
  buildCatalogThemeSlug,
  createCatalogSetRecord,
  mergeCanonicalCatalogSets,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  getRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CATALOG_SETS_OVERLAY_TABLE = 'catalog_sets_overlay';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';

type CatalogSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogOverlaySetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  primary_theme_id?: string | null;
  release_year: number;
  set_id: string;
  slug: string;
  source: string;
  source_theme_id?: string | null;
  source_set_number: string;
  status: string;
  theme: string;
  updated_at: string;
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

export interface CatalogThemeBackfillResult {
  processedCount: number;
  skippedCount: number;
  updatedCount: number;
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

function toCatalogOverlaySet({
  row,
  themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: row.theme,
  }),
}: {
  row: CatalogOverlaySetRow;
  themeIdentity?: ReturnType<typeof resolveCatalogThemeIdentity>;
}): CatalogOverlaySet {
  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieces: row.piece_count,
    primaryThemeId: row.primary_theme_id ?? undefined,
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

function toCanonicalCatalogSetFromSnapshotRecord(
  catalogSetRecord: CatalogSetRecord,
): CatalogCanonicalSet {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: catalogSetRecord.theme,
  });

  return {
    createdAt: catalogSnapshot.generatedAt,
    imageUrl: catalogSetRecord.imageUrl,
    name: catalogSetRecord.name,
    pieceCount: catalogSetRecord.pieces,
    primaryTheme: themeIdentity.primaryTheme,
    releaseYear: catalogSetRecord.releaseYear,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: catalogSetRecord.canonicalId,
    slug: catalogSetRecord.slug,
    source: 'snapshot',
    sourceSetNumber: catalogSetRecord.sourceSetNumber,
    status: 'active',
    updatedAt: catalogSnapshot.generatedAt,
  };
}

function toCanonicalCatalogSetFromOverlaySet(
  overlaySet: CatalogOverlaySet,
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
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    collectorAngle: `Nieuw in Brickhunt. ${canonicalCatalogSet.primaryTheme} staat klaar voor de eerste prijscheck.`,
    imageUrl: canonicalCatalogSet.imageUrl,
  };
}

function toCatalogSetDetailFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetDetail {
  return {
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
    collectorAngle: `Nieuw in Brickhunt. ${canonicalCatalogSet.name} staat klaar voor de eerste prijscheck.`,
    tagline: `We bouwen nu de eerste prijsvergelijking op voor deze ${canonicalCatalogSet.primaryTheme}-set.`,
    availability: 'Eerste winkels worden nu gekoppeld',
    collectorHighlights: [
      `${canonicalCatalogSet.pieceCount.toLocaleString('nl-NL')} stenen`,
      `Release ${canonicalCatalogSet.releaseYear}`,
      'Zodra de eerste merchants landen, zie je hier de beste route',
    ],
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
        rawTheme: overlayRow.theme,
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
            legacyTheme: overlayRow.theme,
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
  catalogSet: Pick<CatalogCanonicalSet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget;
function toCatalogConflictTarget(
  catalogSet:
    | Pick<CatalogSetSummary, 'id' | 'name' | 'slug'>
    | Pick<CatalogOverlaySet, 'setId' | 'name' | 'slug'>
    | Pick<CatalogCanonicalSet, 'setId' | 'name' | 'slug'>,
): CatalogConflictTarget {
  return {
    name: catalogSet.name,
    setId: 'id' in catalogSet ? catalogSet.id : catalogSet.setId,
    slug: catalogSet.slug,
  };
}

function getCatalogOverlayInsertConflictMessage({
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
    return buildCatalogOverlaySlugConflictMessage({
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
    return buildCatalogOverlaySetIdConflictMessage({
      conflictTarget: toCatalogConflictTarget(setConflict),
      source: setConflict.source === 'snapshot' ? 'snapshot' : 'overlay',
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
      throw new Error('Unable to persist the parent source theme.');
    }
  }

  const [
    { error: sourceThemeError },
    { error: primaryThemeError },
    { error: sourceThemeMappingError },
  ] = await Promise.all([
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
    supabaseClient
      .from(CATALOG_THEME_MAPPINGS_TABLE)
      .upsert(themePersistence.sourceThemeMapping, {
        onConflict: 'source_theme_id',
      }),
  ]);

  if (sourceThemeError) {
    throw new Error('Unable to persist the source theme.');
  }

  if (primaryThemeError) {
    throw new Error('Unable to persist the primary theme.');
  }

  if (sourceThemeMappingError) {
    throw new Error('Unable to persist the source-to-primary theme mapping.');
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
      'set_id, source_set_number, slug, name, theme, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
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

const snapshotCanonicalCatalogSets = sortCanonicalCatalogSets(
  catalogSnapshot.setRecords.map(toCanonicalCatalogSetFromSnapshotRecord),
);
const snapshotCatalogSummaryById = new Map(
  listCatalogSetSummaries().map((catalogSetSummary) => [
    catalogSetSummary.id,
    catalogSetSummary,
  ]),
);

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
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      overlayRows: rows,
      supabaseClient: activeSupabaseClient,
    });

    return rows.map((row) =>
      toCatalogOverlaySet({
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
  const candidateRows = overlayRows.filter((overlayRow) => {
    if (setIds?.length && !setIds.includes(overlayRow.set_id)) {
      return false;
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

    const { error } = await activeSupabaseClient
      .from(CATALOG_SETS_OVERLAY_TABLE)
      .update({
        primary_theme_id: themePersistence.primaryTheme.id,
        source_theme_id: themePersistence.sourceTheme.id,
      })
      .eq('set_id', overlayRow.set_id);

    if (error) {
      throw new Error('Unable to backfill catalog theme identity.');
    }

    updatedCount += 1;
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
    return snapshotCanonicalCatalogSets;
  }

  try {
    const canonicalOverlaySets = (
      await listCatalogOverlaySets({
        includeInactive,
        supabaseClient,
      })
    ).map(toCanonicalCatalogSetFromOverlaySet);

    return sortCanonicalCatalogSets(
      mergeCanonicalCatalogSets({
        fallbackSets: snapshotCanonicalCatalogSets,
        preferredSets: canonicalOverlaySets,
      }),
    );
  } catch (error) {
    if (!supabaseClient) {
      return snapshotCanonicalCatalogSets;
    }

    throw error;
  }
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
  const canonicalCatalogSets = await listCanonicalCatalogSets({
    includeInactive,
    supabaseClient,
  });

  return canonicalCatalogSets.find(
    (canonicalCatalogSet) => canonicalCatalogSet.setId === setId,
  );
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
  const canonicalCatalogSets = await listCanonicalCatalogSets({
    includeInactive,
    supabaseClient,
  });

  return canonicalCatalogSets.find(
    (canonicalCatalogSet) => canonicalCatalogSet.slug === slug,
  );
}

export async function listCatalogSetSummariesWithOverlay({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogSetSummary[]> {
  const canonicalCatalogSets = await listCanonicalCatalogSets({
    supabaseClient,
  });

  return sortCatalogSetSummaries(
    canonicalCatalogSets.map((canonicalCatalogSet) =>
      canonicalCatalogSet.source === 'snapshot'
        ? (snapshotCatalogSummaryById.get(canonicalCatalogSet.setId) ??
          toCatalogSummaryFromCanonicalSet(canonicalCatalogSet))
        : toCatalogSummaryFromCanonicalSet(canonicalCatalogSet),
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

  return canonicalCatalogSet.source === 'snapshot'
    ? (snapshotCatalogSummaryById.get(canonicalCatalogSet.setId) ??
        toCatalogSummaryFromCanonicalSet(canonicalCatalogSet))
    : toCatalogSummaryFromCanonicalSet(canonicalCatalogSet);
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
  const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
    slug,
    supabaseClient,
  });

  if (!canonicalCatalogSet) {
    return undefined;
  }

  if (canonicalCatalogSet.source === 'snapshot') {
    return getCatalogSetBySlug(slug);
  }

  return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
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
  fetchImpl,
  input,
  supabaseClient,
}: {
  fetchImpl?: typeof fetch;
  input: CatalogExternalSetSearchResult;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogOverlaySet> {
  const activeSupabaseClient = supabaseClient ?? getServerSupabaseAdminClient();
  const normalizedSet = toSearchResult({
    imageUrl: input.imageUrl,
    name: input.name,
    numParts: input.pieces,
    setNumber: input.sourceSetNumber,
    themeName: input.theme,
    year: input.releaseYear,
  });
  const existingCatalogSets = await listCanonicalCatalogSets({
    includeInactive: true,
    supabaseClient,
  });
  const snapshotSetConflict = existingCatalogSets.find(
    (catalogSet) =>
      catalogSet.setId === normalizedSet.setId &&
      catalogSet.source === 'snapshot',
  );

  if (snapshotSetConflict) {
    throw new Error(
      buildCatalogOverlaySetIdConflictMessage({
        conflictTarget: toCatalogConflictTarget(snapshotSetConflict),
        source: 'snapshot',
      }),
    );
  }

  const snapshotSlugConflict = existingCatalogSets.find(
    (catalogSet) =>
      catalogSet.slug === normalizedSet.slug &&
      catalogSet.source === 'snapshot',
  );

  if (snapshotSlugConflict) {
    throw new Error(
      buildCatalogOverlaySlugConflictMessage({
        conflictTarget: toCatalogConflictTarget(snapshotSlugConflict),
        slug: normalizedSet.slug,
      }),
    );
  }

  const overlaySetConflict = existingCatalogSets.find(
    (catalogSet) =>
      catalogSet.setId === normalizedSet.setId &&
      catalogSet.source !== 'snapshot',
  );

  if (overlaySetConflict) {
    throw new Error(
      buildCatalogOverlaySetIdConflictMessage({
        conflictTarget: toCatalogConflictTarget(overlaySetConflict),
        source: 'overlay',
      }),
    );
  }

  const overlaySlugConflict = existingCatalogSets.find(
    (catalogSet) =>
      catalogSet.slug === normalizedSet.slug &&
      catalogSet.source !== 'snapshot',
  );

  if (overlaySlugConflict) {
    throw new Error(
      buildCatalogOverlaySlugConflictMessage({
        conflictTarget: toCatalogConflictTarget(overlaySlugConflict),
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

  const { data, error } = await activeSupabaseClient
    .from(CATALOG_SETS_OVERLAY_TABLE)
    .insert({
      image_url: normalizedSet.imageUrl ?? null,
      name: normalizedSet.name,
      piece_count: normalizedSet.pieces,
      primary_theme_id: themePersistence.primaryTheme.id,
      release_year: normalizedSet.releaseYear,
      set_id: normalizedSet.setId,
      slug: normalizedSet.slug,
      source: normalizedSet.source,
      source_theme_id: themePersistence.sourceTheme.id,
      source_set_number: normalizedSet.sourceSetNumber,
      status: 'active',
      theme: themePersistence.primaryTheme.display_name,
    })
    .select(
      'set_id, source_set_number, slug, name, theme, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    const conflictMessage =
      error &&
      getCatalogOverlayInsertConflictMessage({
        existingCatalogSets,
        error,
        normalizedSet,
      });

    if (conflictMessage) {
      throw new Error(conflictMessage);
    }

    throw new Error('Unable to create the catalog overlay set.');
  }

  return toCatalogOverlaySet({
    row: data as CatalogOverlaySetRow,
    themeIdentity: resolveCatalogThemeIdentityFromPersistence({
      legacyTheme: (data as CatalogOverlaySetRow).theme,
      primaryThemeName: themePersistence.primaryTheme.display_name,
      sourceThemeName: themePersistence.sourceTheme.source_theme_name,
    }),
  });
}
