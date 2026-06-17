import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  buildCatalogThemeSlug,
  buildThemeCommerceSnapshotCollectionSlug,
  THEME_COMMERCE_SNAPSHOT_PAGE,
  THEME_COMMERCE_SNAPSHOT_PAGE_SIZE,
  THEME_COMMERCE_SNAPSHOT_SORT_KEY,
  type CatalogCanonicalSet,
  type ThemeBrowsePriceContext,
  type ThemeCommerceCard,
  type ThemeCommerceSnapshot,
  type ThemeCommerceSnapshotHealth,
} from '@lego-platform/catalog/util';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { resolvePublicMerchantDisplayName } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichCatalogSetsWithPresentationTitles } from './catalog-presentation-title-server';
import { COLLECTION_PAGE_SNAPSHOTS_TABLE } from './collection-page-snapshot-server';

const THEME_COMMERCE_SNAPSHOT_SOURCE = 'theme_commerce_snapshot_sync';
const THEME_COMMERCE_QUERY_PAGE_SIZE = 1000;
const THEME_COMMERCE_FEATURED_DEAL_LIMIT = 20;
const MIN_FEATURED_SPREAD_MINOR = 500;
const MIN_FEATURED_COMPARABLE_OFFER_COUNT = 2;

type ThemeCommerceSnapshotSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

export interface ThemeCommercePublicThemeRow {
  display_name: string;
  is_public: boolean;
  public_display_name: string | null;
  slug: string;
  status: string;
}

export interface ThemeCommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  comparable_offer_count: number | null;
  computed_at: string | null;
  next_best_price_minor: number | null;
  offer_count: number | null;
  price_spread_minor: number | null;
  set_id: string;
  trusted_offer_count: number | null;
}

export interface ThemeCommerceSnapshotSummary {
  healthCounts: Record<ThemeCommerceSnapshotHealth, number>;
  payloadBytes: number;
  payloadSizeSamples: readonly {
    bytes: number;
    themeSlug: string;
  }[];
  sampleSlugs: readonly string[];
  snapshotCount: number;
  themeCount: number;
  totalFeaturedDealCount: number;
  totalPricedSetCount: number;
}

export interface ThemeCommerceSnapshotBuildResult {
  dryRun: boolean;
  generatedAt: string;
  snapshots: readonly ThemeCommerceSnapshot[];
  summary: ThemeCommerceSnapshotSummary;
  upsertedCount: number;
}

interface SupabaseDiagnosticError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function getSupabaseErrorDiagnostic(error: unknown): SupabaseDiagnosticError {
  if (!error || typeof error !== 'object') {
    return {
      message: error instanceof Error ? error.message : 'unknown',
    };
  }

  const candidate = error as Partial<SupabaseDiagnosticError>;

  return {
    ...(typeof candidate.message === 'string'
      ? { message: candidate.message }
      : {}),
    ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
    ...(typeof candidate.details === 'string'
      ? { details: candidate.details }
      : {}),
    ...(typeof candidate.hint === 'string' ? { hint: candidate.hint } : {}),
  };
}

function getCatalogSetImageUrl(catalogSet: CatalogCanonicalSet): string {
  return catalogSet.imageUrl ?? catalogSet.cardImageUrl ?? '';
}

function getCatalogSetThemeSlug(catalogSet: CatalogCanonicalSet): string {
  return (
    catalogSet.publicTheme?.slug ??
    buildCatalogThemeSlug(
      catalogSet.publicTheme?.name ?? catalogSet.primaryTheme,
    )
  );
}

function getPublicMerchantName(
  offer: ThemeCommerceCurrentOfferSnapshotRow,
): string | undefined {
  if (!offer.best_merchant_name) {
    return undefined;
  }

  return resolvePublicMerchantDisplayName({
    merchantName: offer.best_merchant_name,
    merchantSlug: offer.best_merchant_slug ?? undefined,
  });
}

function getPriceSpreadMinor(
  offer: ThemeCommerceCurrentOfferSnapshotRow,
): number {
  if (
    typeof offer.price_spread_minor === 'number' &&
    offer.price_spread_minor > 0
  ) {
    return offer.price_spread_minor;
  }

  if (
    typeof offer.best_price_minor === 'number' &&
    typeof offer.next_best_price_minor === 'number' &&
    offer.next_best_price_minor > offer.best_price_minor
  ) {
    return offer.next_best_price_minor - offer.best_price_minor;
  }

  return 0;
}

function isActionableCurrentOffer(
  offer: ThemeCommerceCurrentOfferSnapshotRow | undefined,
): offer is ThemeCommerceCurrentOfferSnapshotRow & {
  best_price_minor: number;
  best_product_url: string;
} {
  return (
    offer !== undefined &&
    typeof offer.best_price_minor === 'number' &&
    offer.best_price_minor > 0 &&
    typeof offer.best_product_url === 'string' &&
    offer.best_product_url.trim().length > 0 &&
    (offer.best_availability === 'in_stock' ||
      offer.best_availability === 'limited')
  );
}

function isFeaturedDealCandidate(
  offer: ThemeCommerceCurrentOfferSnapshotRow | undefined,
): offer is ThemeCommerceCurrentOfferSnapshotRow & {
  best_price_minor: number;
  best_product_url: string;
} {
  if (!isActionableCurrentOffer(offer)) {
    return false;
  }

  return (
    getPriceSpreadMinor(offer) >= MIN_FEATURED_SPREAD_MINOR ||
    (offer.comparable_offer_count ?? 0) >= MIN_FEATURED_COMPARABLE_OFFER_COUNT
  );
}

function getConfidenceLabel(
  offer: ThemeCommerceCurrentOfferSnapshotRow,
): string | undefined {
  const offerCount = offer.offer_count ?? 0;

  if (offerCount <= 0) {
    return undefined;
  }

  return `${offerCount} vergeleken winkel${offerCount === 1 ? '' : 's'}`;
}

function getDealLabel(offer: ThemeCommerceCurrentOfferSnapshotRow): string {
  const spreadMinor = getPriceSpreadMinor(offer);

  if (spreadMinor >= 2_500 && (offer.comparable_offer_count ?? 0) >= 2) {
    return 'Sterke deal';
  }

  if (spreadMinor >= MIN_FEATURED_SPREAD_MINOR) {
    return 'Beste marktprijs';
  }

  return 'Beste prijs';
}

function getFeaturedDealScore({
  catalogSet,
  offer,
}: {
  catalogSet: CatalogCanonicalSet;
  offer: ThemeCommerceCurrentOfferSnapshotRow;
}): number {
  const spreadMinor = getPriceSpreadMinor(offer);
  const priceMinor = offer.best_price_minor ?? 0;
  const pricePerPiece =
    catalogSet.pieceCount > 0
      ? Math.round(priceMinor / catalogSet.pieceCount)
      : 0;

  return (
    Math.min(spreadMinor / 100, 80) +
    (offer.trusted_offer_count ?? 0) * 28 +
    (offer.comparable_offer_count ?? 0) * 18 +
    (offer.offer_count ?? 0) * 6 +
    (offer.best_availability === 'in_stock' ? 24 : 8) +
    (catalogSet.pieceCount >= 1500
      ? 20
      : catalogSet.pieceCount >= 700
        ? 12
        : 4) +
    (pricePerPiece > 0 ? Math.max(0, 28 - pricePerPiece * 2) : 0)
  );
}

function toThemeBrowsePriceContext(
  offer: ThemeCommerceCurrentOfferSnapshotRow | undefined,
): ThemeBrowsePriceContext | undefined {
  if (!isActionableCurrentOffer(offer)) {
    return undefined;
  }

  const merchantName = getPublicMerchantName(offer);

  return {
    priceLabel: `Vanaf ${formatPriceMinor({
      currencyCode: 'EUR',
      minorUnits: offer.best_price_minor,
    })}`,
    currentPriceMinor: offer.best_price_minor,
    ...(merchantName ? { merchantName } : {}),
    ...(offer.best_merchant_slug
      ? { merchantSlug: offer.best_merchant_slug }
      : {}),
    ctaUrl: offer.best_product_url,
    dealLabel: 'Beste prijs',
    ...(getConfidenceLabel(offer)
      ? { confidenceLabel: getConfidenceLabel(offer) }
      : {}),
  };
}

function toThemeCommerceCard({
  catalogSet,
  offer,
}: {
  catalogSet: CatalogCanonicalSet;
  offer: ThemeCommerceCurrentOfferSnapshotRow;
}): ThemeCommerceCard {
  const merchantName = getPublicMerchantName(offer);

  return {
    setId: catalogSet.setId,
    slug: catalogSet.slug,
    ...(catalogSet.catalogName ? { catalogName: catalogSet.catalogName } : {}),
    displayTitle: catalogSet.displayTitle ?? catalogSet.name,
    ...(catalogSet.displayTitleSource
      ? { displayTitleSource: catalogSet.displayTitleSource }
      : {}),
    name: catalogSet.displayTitle ?? catalogSet.name,
    imageUrl: getCatalogSetImageUrl(catalogSet),
    ...(catalogSet.publicTheme ? { publicTheme: catalogSet.publicTheme } : {}),
    theme: catalogSet.publicTheme?.name ?? catalogSet.primaryTheme,
    releaseYear: catalogSet.releaseYear,
    pieces: catalogSet.pieceCount,
    ...(typeof offer.best_price_minor === 'number'
      ? { currentPriceMinor: offer.best_price_minor }
      : {}),
    ...(merchantName ? { merchantName } : {}),
    ...(offer.best_merchant_slug
      ? { merchantSlug: offer.best_merchant_slug }
      : {}),
    ...(offer.best_product_url ? { ctaUrl: offer.best_product_url } : {}),
    dealLabel: getDealLabel(offer),
    ...(getConfidenceLabel(offer)
      ? { confidenceLabel: getConfidenceLabel(offer) }
      : {}),
  };
}

function getSnapshotHealth({
  featuredDealCount,
  pricedSetCount,
  totalSetCount,
}: {
  featuredDealCount: number;
  pricedSetCount: number;
  totalSetCount: number;
}): ThemeCommerceSnapshotHealth {
  if (totalSetCount === 0 || pricedSetCount === 0) {
    return 'empty';
  }

  if (featuredDealCount === 0 || pricedSetCount < totalSetCount) {
    return 'partial';
  }

  return 'healthy';
}

async function listPublicThemeRows({
  supabaseClient,
}: {
  supabaseClient: ThemeCommerceSnapshotSupabaseClient;
}): Promise<ThemeCommercePublicThemeRow[]> {
  const { data, error } = await supabaseClient
    .from('catalog_themes')
    .select('slug, display_name, public_display_name, status, is_public')
    .eq('status', 'active')
    .eq('is_public', true);

  if (error) {
    throw new Error(
      'Unable to load public themes for theme commerce snapshots.',
    );
  }

  return ((data as ThemeCommercePublicThemeRow[] | null) ?? []).filter(
    (theme) =>
      theme.status === 'active' &&
      theme.is_public === true &&
      theme.slug.trim().length > 0,
  );
}

async function listThemeCommerceCurrentOfferSnapshots({
  supabaseClient,
}: {
  supabaseClient: ThemeCommerceSnapshotSupabaseClient;
}): Promise<ThemeCommerceCurrentOfferSnapshotRow[]> {
  const rows: ThemeCommerceCurrentOfferSnapshotRow[] = [];

  for (let from = 0; ; from += THEME_COMMERCE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('commerce_current_offer_snapshots')
      .select(
        'set_id, best_price_minor, best_merchant_name, best_merchant_slug, best_availability, best_product_url, best_checked_at, offer_count, computed_at, next_best_price_minor, price_spread_minor, trusted_offer_count, comparable_offer_count',
      )
      .eq('region_code', 'NL')
      .eq('currency_code', 'EUR')
      .eq('condition', 'new')
      .range(from, from + THEME_COMMERCE_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load theme current-offer snapshots.');
    }

    const pageRows =
      (data as ThemeCommerceCurrentOfferSnapshotRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < THEME_COMMERCE_QUERY_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function groupCatalogSetsByThemeSlug(
  catalogSets: readonly CatalogCanonicalSet[],
): Map<string, CatalogCanonicalSet[]> {
  const setsByThemeSlug = new Map<string, CatalogCanonicalSet[]>();

  for (const catalogSet of catalogSets) {
    const themeSlug = getCatalogSetThemeSlug(catalogSet);
    const themeSets = setsByThemeSlug.get(themeSlug) ?? [];

    themeSets.push(catalogSet);
    setsByThemeSlug.set(themeSlug, themeSets);
  }

  return setsByThemeSlug;
}

function buildThemeCommerceSnapshot({
  catalogSets,
  currentOfferBySetId,
  featuredDealLimit,
  generatedAt,
  themeSlug,
}: {
  catalogSets: readonly CatalogCanonicalSet[];
  currentOfferBySetId: ReadonlyMap<
    string,
    ThemeCommerceCurrentOfferSnapshotRow
  >;
  featuredDealLimit: number;
  generatedAt: string;
  themeSlug: string;
}): ThemeCommerceSnapshot {
  const browsePriceContextBySetId: Record<string, ThemeBrowsePriceContext> = {};

  for (const catalogSet of catalogSets) {
    const priceContext = toThemeBrowsePriceContext(
      currentOfferBySetId.get(catalogSet.setId),
    );

    if (priceContext) {
      browsePriceContextBySetId[catalogSet.setId] = priceContext;
    }
  }

  const featuredDealSetIds = new Set<string>();
  const featuredDeals = catalogSets
    .flatMap((catalogSet) => {
      const offer = currentOfferBySetId.get(catalogSet.setId);

      if (!isFeaturedDealCandidate(offer)) {
        return [];
      }

      return [
        {
          card: toThemeCommerceCard({ catalogSet, offer }),
          score: getFeaturedDealScore({ catalogSet, offer }),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.card.currentPriceMinor ?? 0) -
          (left.card.currentPriceMinor ?? 0) ||
        left.card.name.localeCompare(right.card.name, 'nl') ||
        left.card.setId.localeCompare(right.card.setId),
    )
    .filter(({ card }) => {
      if (featuredDealSetIds.has(card.setId)) {
        return false;
      }

      featuredDealSetIds.add(card.setId);
      return true;
    })
    .slice(0, featuredDealLimit)
    .map(({ card }) => card);
  const pricedSetCount = Object.keys(browsePriceContextBySetId).length;

  return {
    themeSlug,
    generatedAt,
    sourceVersion: generatedAt,
    featuredDeals,
    browsePriceContextBySetId,
    stats: {
      totalSetCount: catalogSets.length,
      pricedSetCount,
      featuredDealCount: featuredDeals.length,
      snapshotHealth: getSnapshotHealth({
        featuredDealCount: featuredDeals.length,
        pricedSetCount,
        totalSetCount: catalogSets.length,
      }),
    },
  };
}

function createSummary(
  snapshots: readonly ThemeCommerceSnapshot[],
): ThemeCommerceSnapshotSummary {
  const healthCounts: Record<ThemeCommerceSnapshotHealth, number> = {
    empty: 0,
    healthy: 0,
    partial: 0,
  };

  for (const snapshot of snapshots) {
    healthCounts[snapshot.stats.snapshotHealth] += 1;
  }

  return {
    healthCounts,
    payloadBytes: Buffer.byteLength(JSON.stringify(snapshots)),
    payloadSizeSamples: snapshots.slice(0, 5).map((snapshot) => ({
      bytes: Buffer.byteLength(JSON.stringify(snapshot)),
      themeSlug: snapshot.themeSlug,
    })),
    sampleSlugs: snapshots.slice(0, 5).map((snapshot) => snapshot.themeSlug),
    snapshotCount: snapshots.length,
    themeCount: snapshots.length,
    totalFeaturedDealCount: snapshots.reduce(
      (total, snapshot) => total + snapshot.featuredDeals.length,
      0,
    ),
    totalPricedSetCount: snapshots.reduce(
      (total, snapshot) => total + snapshot.stats.pricedSetCount,
      0,
    ),
  };
}

export async function buildThemeCommerceSnapshots({
  catalogSets,
  currentOfferRows,
  featuredDealLimit = THEME_COMMERCE_FEATURED_DEAL_LIMIT,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  publicThemeRows,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  catalogSets?: readonly CatalogCanonicalSet[];
  currentOfferRows?: readonly ThemeCommerceCurrentOfferSnapshotRow[];
  featuredDealLimit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  publicThemeRows?: readonly ThemeCommercePublicThemeRow[];
  supabaseClient?: ThemeCommerceSnapshotSupabaseClient;
} = {}): Promise<
  Omit<ThemeCommerceSnapshotBuildResult, 'dryRun' | 'upsertedCount'>
> {
  const generatedAt = now.toISOString();
  const [
    resolvedCatalogSets,
    resolvedCurrentOfferRows,
    resolvedPublicThemeRows,
  ] = await Promise.all([
    catalogSets
      ? Promise.resolve([...catalogSets])
      : listCanonicalCatalogSetsFn({ includeInactive: false, supabaseClient }),
    currentOfferRows
      ? Promise.resolve([...currentOfferRows])
      : listThemeCommerceCurrentOfferSnapshots({ supabaseClient }),
    publicThemeRows
      ? Promise.resolve([...publicThemeRows])
      : listPublicThemeRows({ supabaseClient }),
  ]);
  const presentationCatalogSets = catalogSets
    ? resolvedCatalogSets
    : await enrichCatalogSetsWithPresentationTitles({
        catalogSets: resolvedCatalogSets,
        supabaseClient,
      });
  const setsByThemeSlug = groupCatalogSetsByThemeSlug(presentationCatalogSets);
  const currentOfferBySetId = new Map(
    resolvedCurrentOfferRows.map((row) => [row.set_id, row]),
  );
  const snapshots = resolvedPublicThemeRows
    .filter(
      (theme) =>
        theme.status === 'active' &&
        theme.is_public === true &&
        theme.slug.trim().length > 0,
    )
    .sort((left, right) => left.slug.localeCompare(right.slug, 'nl'))
    .map((theme) =>
      buildThemeCommerceSnapshot({
        catalogSets: setsByThemeSlug.get(theme.slug) ?? [],
        currentOfferBySetId,
        featuredDealLimit,
        generatedAt,
        themeSlug: theme.slug,
      }),
    );

  return {
    generatedAt,
    snapshots,
    summary: createSummary(snapshots),
  };
}

function toSnapshotRows(snapshots: readonly ThemeCommerceSnapshot[]) {
  return snapshots.map((snapshot) => ({
    collection_slug: buildThemeCommerceSnapshotCollectionSlug(
      snapshot.themeSlug,
    ),
    generated_at: snapshot.generatedAt,
    items_json: snapshot,
    page: THEME_COMMERCE_SNAPSHOT_PAGE,
    page_size: THEME_COMMERCE_SNAPSHOT_PAGE_SIZE,
    snapshot_source: THEME_COMMERCE_SNAPSHOT_SOURCE,
    sort_key: THEME_COMMERCE_SNAPSHOT_SORT_KEY,
    source_version: snapshot.sourceVersion,
    total_count: snapshot.stats.totalSetCount,
  }));
}

export async function upsertThemeCommerceSnapshots({
  snapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshots: readonly ThemeCommerceSnapshot[];
  supabaseClient?: ThemeCommerceSnapshotSupabaseClient;
}): Promise<number> {
  let upsertedCount = 0;
  const rows = toSnapshotRows(snapshots);

  for (const chunk of chunkRows(rows, 100)) {
    const { error } = await supabaseClient
      .from(COLLECTION_PAGE_SNAPSHOTS_TABLE)
      .upsert(chunk, {
        onConflict: 'collection_slug,sort_key,page,page_size',
      });

    if (error) {
      console.error('[theme-commerce-snapshot] upsert_failed', {
        error: getSupabaseErrorDiagnostic(error),
        samplePayloadShape: chunk[0]
          ? {
              collection_slug: chunk[0].collection_slug,
              itemKeys:
                chunk[0].items_json && typeof chunk[0].items_json === 'object'
                  ? Object.keys(chunk[0].items_json)
                  : [],
              page: chunk[0].page,
              page_size: chunk[0].page_size,
              sort_key: chunk[0].sort_key,
            }
          : undefined,
        sampleSnapshotKeys: snapshots
          .slice(0, 5)
          .map((snapshot) => snapshot.themeSlug),
        snapshotCount: snapshots.length,
      });

      throw new Error('Unable to upsert theme commerce snapshots.');
    }

    upsertedCount += chunk.length;
  }

  return upsertedCount;
}

export async function syncThemeCommerceSnapshots({
  dryRun = true,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
  ...options
}: {
  catalogSets?: readonly CatalogCanonicalSet[];
  currentOfferRows?: readonly ThemeCommerceCurrentOfferSnapshotRow[];
  dryRun?: boolean;
  featuredDealLimit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  publicThemeRows?: readonly ThemeCommercePublicThemeRow[];
  supabaseClient?: ThemeCommerceSnapshotSupabaseClient;
} = {}): Promise<ThemeCommerceSnapshotBuildResult> {
  const buildResult = await buildThemeCommerceSnapshots({
    ...options,
    now,
    supabaseClient,
  });
  const upsertedCount = dryRun
    ? 0
    : await upsertThemeCommerceSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      });

  return {
    ...buildResult,
    dryRun,
    upsertedCount,
  };
}
