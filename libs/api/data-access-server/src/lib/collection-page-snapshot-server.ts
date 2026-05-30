import { catalogSetOverlays } from '@lego-platform/catalog/data-access';
import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  catalogCollectionPageSnapshotSlugs,
  getCatalogCollectionLandingPageConfig,
  getCanonicalCatalogSetId,
  isCatalogCollectionPageSnapshotSlug,
  type CatalogCollectionLandingPageSortKey,
  type CatalogCollectionPageSnapshotSlug,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COLLECTION_PAGE_SNAPSHOTS_TABLE = 'collection_page_snapshots';

const BRICKSET_SOURCE = 'brickset';
const BRICKSET_LOCALE = 'en-US';
const RAKUTEN_LEGO_SOURCE = 'rakuten-lego-eu';
const RAKUTEN_LEGO_LOCALE = 'nl-NL';
const EXACT_SET_NUMBER_MATCH = 'exact_set_number';
const COLLECTION_SNAPSHOT_SOURCE = 'collection_snapshot_sync';
const SNAPSHOT_PAGE_SIZE = 1000;
const RECENT_RELEASE_LOOKBACK_DAYS = 210;
const RECENT_RELEASE_LOOKAHEAD_DAYS = 45;
const RETIRING_EXIT_LOOKAHEAD_DAYS = 365;

type CollectionPageSnapshotSupabaseClient = Pick<
  SupabaseClient,
  'from' | 'rpc'
>;

interface CatalogSetSourceMetadataRow {
  catalog_set_id: string;
  locale: string;
  match_confidence: string;
  metadata_json: Record<string, unknown> | null;
  policy: string | null;
  set_number: string;
  source: string;
}

interface CommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  computed_at: string | null;
  offer_count: number | null;
  set_id: string;
}

export interface CollectionPageSnapshotCard extends CatalogHomepageSetCard {
  effectivePieces?: number;
  priceContext?: {
    coverageLabel: string;
    currentPrice: string;
    merchantLabel: string;
  };
  setNumber: string;
}

export interface CollectionPageSnapshot {
  collectionSlug: CatalogCollectionPageSnapshotSlug;
  generatedAt: string;
  items: readonly CollectionPageSnapshotCard[];
  missingPriceSnapshotCount: number;
  page: number;
  pageSize: number;
  sortKey: CatalogCollectionLandingPageSortKey;
  sourceVersion?: string;
  totalCount: number;
  bricksetMetadataUsedCount: number;
}

export interface CollectionPageSnapshotBuildResult {
  dryRun: boolean;
  generatedAt: string;
  snapshots: readonly CollectionPageSnapshot[];
  summaryByCollectionSlug: Readonly<
    Record<
      string,
      {
        bricksetMetadataUsedCount: number;
        itemsBuilt: number;
        missingPriceSnapshotCount: number;
        pageCount: number;
        totalCount: number;
      }
    >
  >;
  upsertedCount: number;
}

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function readMetadataString(
  metadataJson: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = metadataJson?.[key];

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readMetadataNumber(
  metadataJson: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const value = metadataJson?.[key];

  return typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : undefined;
}

function parseDateTimestamp(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return undefined;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function formatPrice(minorUnits: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    style: 'currency',
  }).format(minorUnits / 100);
}

async function listCollectionSourceMetadata({
  supabaseClient,
}: {
  supabaseClient: CollectionPageSnapshotSupabaseClient;
}): Promise<{
  bricksetBySetId: Map<string, CatalogSetSourceMetadataRow>;
  rakutenBySetId: Map<string, CatalogSetSourceMetadataRow>;
}> {
  const bricksetBySetId = new Map<string, CatalogSetSourceMetadataRow>();
  const rakutenBySetId = new Map<string, CatalogSetSourceMetadataRow>();

  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('catalog_set_source_metadata')
      .select(
        'catalog_set_id, set_number, source, locale, metadata_json, match_confidence, policy',
      )
      .in('source', [BRICKSET_SOURCE, RAKUTEN_LEGO_SOURCE])
      .in('locale', [BRICKSET_LOCALE, RAKUTEN_LEGO_LOCALE])
      .eq('match_confidence', EXACT_SET_NUMBER_MATCH)
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load collection source metadata.');
    }

    const rows = (data as CatalogSetSourceMetadataRow[] | null) ?? [];

    for (const row of rows) {
      if (row.source === BRICKSET_SOURCE && row.locale === BRICKSET_LOCALE) {
        bricksetBySetId.set(row.catalog_set_id, row);
      }

      if (
        row.source === RAKUTEN_LEGO_SOURCE &&
        row.locale === RAKUTEN_LEGO_LOCALE
      ) {
        rakutenBySetId.set(row.catalog_set_id, row);
      }
    }

    if (rows.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return {
    bricksetBySetId,
    rakutenBySetId,
  };
}

async function listCommerceCurrentOfferSnapshots({
  supabaseClient,
}: {
  supabaseClient: CollectionPageSnapshotSupabaseClient;
}): Promise<Map<string, CommerceCurrentOfferSnapshotRow>> {
  const snapshotBySetId = new Map<string, CommerceCurrentOfferSnapshotRow>();

  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('commerce_current_offer_snapshots')
      .select(
        'set_id, best_price_minor, best_merchant_name, best_merchant_slug, best_availability, best_product_url, best_checked_at, offer_count, computed_at',
      )
      .eq('region_code', 'NL')
      .eq('currency_code', 'EUR')
      .eq('condition', 'new')
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load collection commerce snapshots.');
    }

    const rows = (data as CommerceCurrentOfferSnapshotRow[] | null) ?? [];

    for (const row of rows) {
      snapshotBySetId.set(row.set_id, row);
    }

    if (rows.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return snapshotBySetId;
}

function toSnapshotCard({
  bricksetMetadata,
  catalogSet,
  priceSnapshot,
  rakutenMetadata,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  priceSnapshot?: CommerceCurrentOfferSnapshotRow;
  rakutenMetadata?: CatalogSetSourceMetadataRow;
}): CollectionPageSnapshotCard {
  const bricksetPieces = readMetadataNumber(
    bricksetMetadata?.metadata_json,
    'pieces',
  );
  const effectivePieces =
    catalogSet.pieceCount > 0 ? catalogSet.pieceCount : bricksetPieces;
  const displayTitle = readMetadataString(
    rakutenMetadata?.metadata_json,
    'title',
  );
  const bestPriceMinor = priceSnapshot?.best_price_minor;

  return {
    ...(catalogSet.createdAt ? { createdAt: catalogSet.createdAt } : {}),
    ...(displayTitle
      ? {
          displayTitle,
          displayTitleSource: 'rakuten-lego-eu' as const,
        }
      : {}),
    ...(typeof effectivePieces === 'number'
      ? {
          effectivePieces,
        }
      : {}),
    id: catalogSet.setId,
    ...(catalogSet.imageUrl ? { imageUrl: catalogSet.imageUrl } : {}),
    name: displayTitle ?? catalogSet.name,
    pieces: effectivePieces ?? catalogSet.pieceCount,
    ...(bestPriceMinor && bestPriceMinor > 0
      ? {
          priceContext: {
            coverageLabel: 'Actuele prijs gevonden',
            currentPrice: `Vanaf ${formatPrice(bestPriceMinor)}`,
            merchantLabel: priceSnapshot.best_merchant_name
              ? `Laagst bij ${priceSnapshot.best_merchant_name}`
              : 'Laagste bekende prijs',
          },
        }
      : {}),
    ...(catalogSet.releaseDate ? { releaseDate: catalogSet.releaseDate } : {}),
    ...(catalogSet.releaseDatePrecision
      ? {
          releaseDatePrecision: catalogSet.releaseDatePrecision,
        }
      : {}),
    releaseYear: catalogSet.releaseYear,
    ...(catalogSet.secondaryLabels
      ? {
          secondaryLabels: catalogSet.secondaryLabels,
        }
      : {}),
    setNumber: catalogSet.sourceSetNumber ?? catalogSet.setId,
    slug: catalogSet.slug,
    theme: catalogSet.primaryTheme,
  };
}

function getEffectiveReleaseDate({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): string | undefined {
  return (
    readMetadataString(bricksetMetadata?.metadata_json, 'launchDate') ??
    readMetadataString(bricksetMetadata?.metadata_json, 'dateFirstAvailable') ??
    setCard.releaseDate
  );
}

function getEffectiveReleaseTimestamp({
  allowReleaseYearFallback = true,
  bricksetMetadata,
  setCard,
}: {
  allowReleaseYearFallback?: boolean;
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): number | undefined {
  const releaseTimestamp = parseDateTimestamp(
    getEffectiveReleaseDate({ bricksetMetadata, setCard }),
  );

  if (releaseTimestamp !== undefined || !allowReleaseYearFallback) {
    return releaseTimestamp;
  }

  return Number.isFinite(setCard.releaseYear)
    ? Date.UTC(setCard.releaseYear, 0, 1)
    : undefined;
}

function isRecentReleaseCandidate({
  bricksetMetadata,
  now,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  now: Date;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  if ((setCard.effectivePieces ?? setCard.pieces) <= 0) {
    return false;
  }

  const releaseTimestamp = parseDateTimestamp(
    getEffectiveReleaseDate({ bricksetMetadata, setCard }),
  );
  const lowerBound = now.getTime() - RECENT_RELEASE_LOOKBACK_DAYS * 86_400_000;
  const upperBound = now.getTime() + RECENT_RELEASE_LOOKAHEAD_DAYS * 86_400_000;

  if (releaseTimestamp !== undefined) {
    return releaseTimestamp >= lowerBound && releaseTimestamp <= upperBound;
  }

  return setCard.releaseYear === now.getUTCFullYear();
}

function getRecentReleaseSortTimestamp({
  bricksetMetadata,
  now,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  now: Date;
  setCard: CollectionPageSnapshotCard;
}): number {
  const timestamp =
    parseDateTimestamp(
      getEffectiveReleaseDate({ bricksetMetadata, setCard }),
    ) ?? Date.UTC(setCard.releaseYear, 0, 1);

  if (timestamp > now.getTime()) {
    const daysUntilRelease = Math.ceil(
      (timestamp - now.getTime()) / 86_400_000,
    );

    return timestamp - Math.max(daysUntilRelease, 1) * 86_400_000 * 4;
  }

  return timestamp;
}

function isRetiringCandidate({
  bricksetMetadata,
  now,
  setCard,
  statusBySetId,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  now: Date;
  setCard: CollectionPageSnapshotCard;
  statusBySetId: ReadonlyMap<string, string>;
}): boolean {
  const effectivePieces = setCard.effectivePieces ?? setCard.pieces;

  if (effectivePieces <= 0) {
    return false;
  }

  const overlayStatus = statusBySetId.get(setCard.id);

  if (overlayStatus === 'retiring_soon') {
    const releaseTimestamp = getEffectiveReleaseTimestamp({
      allowReleaseYearFallback: true,
      bricksetMetadata,
      setCard,
    });

    return releaseTimestamp !== undefined && releaseTimestamp <= now.getTime();
  }

  const releaseTimestamp = getEffectiveReleaseTimestamp({
    allowReleaseYearFallback: false,
    bricksetMetadata,
    setCard,
  });

  if (releaseTimestamp === undefined || releaseTimestamp > now.getTime()) {
    return false;
  }

  const exitDate = readMetadataString(
    bricksetMetadata?.metadata_json,
    'exitDate',
  );
  const exitTimestamp = parseDateTimestamp(exitDate);

  if (exitTimestamp === undefined) {
    return false;
  }

  const lowerBound = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const upperBound = now.getTime() + RETIRING_EXIT_LOOKAHEAD_DAYS * 86_400_000;

  return exitTimestamp >= lowerBound && exitTimestamp <= upperBound;
}

function getRetiringSortTimestamp({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): number {
  return (
    parseDateTimestamp(
      readMetadataString(bricksetMetadata?.metadata_json, 'exitDate'),
    ) ?? Number.POSITIVE_INFINITY
  );
}

function compareSnapshotCards({
  bricksetBySetId,
  collectionSlug,
  priceBySetId,
  sortKey,
  now,
}: {
  bricksetBySetId: ReadonlyMap<string, CatalogSetSourceMetadataRow>;
  collectionSlug: CatalogCollectionPageSnapshotSlug;
  now: Date;
  priceBySetId: ReadonlyMap<string, CommerceCurrentOfferSnapshotRow>;
  sortKey: CatalogCollectionLandingPageSortKey;
}) {
  return (
    left: CollectionPageSnapshotCard,
    right: CollectionPageSnapshotCard,
  ): number => {
    if (collectionSlug === 'retiring-lego-sets') {
      return (
        getRetiringSortTimestamp({
          bricksetMetadata: bricksetBySetId.get(left.id),
          setCard: left,
        }) -
          getRetiringSortTimestamp({
            bricksetMetadata: bricksetBySetId.get(right.id),
            setCard: right,
          }) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (sortKey === 'price-asc') {
      return (
        (priceBySetId.get(left.id)?.best_price_minor ??
          Number.POSITIVE_INFINITY) -
          (priceBySetId.get(right.id)?.best_price_minor ??
            Number.POSITIVE_INFINITY) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (sortKey === 'newest') {
      return (
        getRecentReleaseSortTimestamp({
          bricksetMetadata: bricksetBySetId.get(right.id),
          now,
          setCard: right,
        }) -
          getRecentReleaseSortTimestamp({
            bricksetMetadata: bricksetBySetId.get(left.id),
            now,
            setCard: left,
          }) ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (sortKey === 'pieces-desc') {
      return (
        right.pieces - left.pieces ||
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      right.pieces - left.pieces ||
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
  };
}

function toSnapshotRows(
  snapshots: readonly CollectionPageSnapshot[],
): Record<string, unknown>[] {
  return snapshots.map((snapshot) => ({
    collection_slug: snapshot.collectionSlug,
    generated_at: snapshot.generatedAt,
    items_json: snapshot.items,
    page: snapshot.page,
    page_size: snapshot.pageSize,
    snapshot_source: COLLECTION_SNAPSHOT_SOURCE,
    sort_key: snapshot.sortKey,
    source_version: snapshot.sourceVersion ?? null,
    total_count: snapshot.totalCount,
  }));
}

export async function buildCollectionPageSnapshots({
  collectionSlugs = catalogCollectionPageSnapshotSlugs,
  now = new Date(),
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  collectionSlugs?: readonly string[];
  now?: Date;
  pageSize?: number;
  supabaseClient?: CollectionPageSnapshotSupabaseClient;
} = {}): Promise<
  Omit<CollectionPageSnapshotBuildResult, 'dryRun' | 'upsertedCount'>
> {
  const activeCollectionSlugs = collectionSlugs.filter(
    isCatalogCollectionPageSnapshotSlug,
  );
  const generatedAt = now.toISOString();
  const [catalogSets, sourceMetadata, priceSnapshots] = await Promise.all([
    listCanonicalCatalogSets({ supabaseClient }),
    listCollectionSourceMetadata({ supabaseClient }),
    listCommerceCurrentOfferSnapshots({ supabaseClient }),
  ]);
  const activeCatalogSets = catalogSets.filter(
    (catalogSet) => catalogSet.status === 'active',
  );
  const overlayStatusBySetId = new Map(
    catalogSetOverlays.flatMap((overlay) =>
      overlay.setStatus
        ? [[getCanonicalCatalogSetId(overlay.canonicalId), overlay.setStatus]]
        : [],
    ),
  );
  const cards = activeCatalogSets.map((catalogSet) =>
    toSnapshotCard({
      bricksetMetadata: sourceMetadata.bricksetBySetId.get(catalogSet.setId),
      catalogSet,
      priceSnapshot: priceSnapshots.get(catalogSet.setId),
      rakutenMetadata: sourceMetadata.rakutenBySetId.get(catalogSet.setId),
    }),
  );
  const cardBySetId = new Map(cards.map((card) => [card.id, card]));
  const snapshots: CollectionPageSnapshot[] = [];
  const summaryByCollectionSlug: Record<
    string,
    {
      bricksetMetadataUsedCount: number;
      itemsBuilt: number;
      missingPriceSnapshotCount: number;
      pageCount: number;
      totalCount: number;
    }
  > = {};

  for (const collectionSlug of activeCollectionSlugs) {
    const config = getCatalogCollectionLandingPageConfig(collectionSlug);

    if (!config) {
      continue;
    }

    let candidates: CollectionPageSnapshotCard[] = [];
    let missingPriceSnapshotCount = 0;

    if (collectionSlug === 'lego-sets-onder-50-euro') {
      candidates = cards.filter((card) => {
        const priceSnapshot = priceSnapshots.get(card.id);
        const priceMinor = priceSnapshot?.best_price_minor;

        if (!priceSnapshot) {
          missingPriceSnapshotCount += 1;
        }

        return (
          typeof priceMinor === 'number' &&
          priceMinor > 0 &&
          priceMinor <= 5_000 &&
          (priceSnapshot.best_availability === 'in_stock' ||
            priceSnapshot.best_availability === 'limited')
        );
      });
    }

    if (collectionSlug === 'nieuwe-lego-sets') {
      candidates = cards.filter((card) =>
        isRecentReleaseCandidate({
          bricksetMetadata: sourceMetadata.bricksetBySetId.get(card.id),
          now,
          setCard: card,
        }),
      );
    }

    if (collectionSlug === 'retiring-lego-sets') {
      candidates = cards.filter((card) =>
        isRetiringCandidate({
          bricksetMetadata: sourceMetadata.bricksetBySetId.get(card.id),
          now,
          setCard: card,
          statusBySetId: overlayStatusBySetId,
        }),
      );
    }

    const bricksetMetadataUsedCount = candidates.filter((card) =>
      sourceMetadata.bricksetBySetId.has(card.id),
    ).length;

    for (const sortKey of config.sort.options) {
      const sortedCandidates = [...candidates].sort(
        compareSnapshotCards({
          bricksetBySetId: sourceMetadata.bricksetBySetId,
          collectionSlug,
          now,
          priceBySetId: priceSnapshots,
          sortKey,
        }),
      );
      const pageChunks =
        sortedCandidates.length > 0
          ? chunkRows(sortedCandidates, pageSize)
          : [[] as CollectionPageSnapshotCard[]];

      pageChunks.forEach((items, pageIndex) => {
        snapshots.push({
          bricksetMetadataUsedCount,
          collectionSlug,
          generatedAt,
          items,
          missingPriceSnapshotCount,
          page: pageIndex + 1,
          pageSize,
          sortKey,
          sourceVersion: generatedAt,
          totalCount: sortedCandidates.length,
        });
      });
    }

    const defaultSortCandidates = [...candidates].sort(
      compareSnapshotCards({
        bricksetBySetId: sourceMetadata.bricksetBySetId,
        collectionSlug,
        now,
        priceBySetId: priceSnapshots,
        sortKey: config.sort.default,
      }),
    );
    const retainedSetIds = new Set(
      defaultSortCandidates.map((card) => card.id),
    );
    const itemsBuilt = [...retainedSetIds].filter((setId) =>
      cardBySetId.has(setId),
    ).length;

    summaryByCollectionSlug[collectionSlug] = {
      bricksetMetadataUsedCount,
      itemsBuilt,
      missingPriceSnapshotCount,
      pageCount: Math.max(1, Math.ceil(candidates.length / pageSize)),
      totalCount: candidates.length,
    };
  }

  return {
    generatedAt,
    snapshots,
    summaryByCollectionSlug,
  };
}

export async function upsertCollectionPageSnapshots({
  snapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshots: readonly CollectionPageSnapshot[];
  supabaseClient?: CollectionPageSnapshotSupabaseClient;
}): Promise<number> {
  let upsertedCount = 0;

  for (const chunk of chunkRows(toSnapshotRows(snapshots), 100)) {
    const { error } = await supabaseClient
      .from(COLLECTION_PAGE_SNAPSHOTS_TABLE)
      .upsert(chunk, {
        onConflict: 'collection_slug,sort_key,page,page_size',
      });

    if (error) {
      throw new Error('Unable to upsert collection page snapshots.');
    }

    upsertedCount += chunk.length;
  }

  return upsertedCount;
}

export async function syncCollectionPageSnapshots({
  collectionSlugs,
  dryRun = true,
  now = new Date(),
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  collectionSlugs?: readonly string[];
  dryRun?: boolean;
  now?: Date;
  pageSize?: number;
  supabaseClient?: CollectionPageSnapshotSupabaseClient;
} = {}): Promise<CollectionPageSnapshotBuildResult> {
  const buildResult = await buildCollectionPageSnapshots({
    collectionSlugs,
    now,
    pageSize,
    supabaseClient,
  });
  const upsertedCount = dryRun
    ? 0
    : await upsertCollectionPageSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      });

  return {
    ...buildResult,
    dryRun,
    upsertedCount,
  };
}
