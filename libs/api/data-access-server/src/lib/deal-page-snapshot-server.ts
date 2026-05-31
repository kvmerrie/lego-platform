import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DEAL_PAGE_SNAPSHOT_SLUG = 'deals';
export const DEAL_PAGE_SNAPSHOTS_TABLE = 'collection_page_snapshots';

const SNAPSHOT_PAGE_SIZE = 1000;
const SNAPSHOT_SOURCE = 'deal_snapshot_sync';
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LEGO_REFERENCE_MERCHANT_SLUG = 'rakuten-lego-eu';

export type DealPageSnapshotSortKey =
  | 'recommended'
  | 'discount-desc'
  | 'price-per-brick'
  | 'under-50';

const dealPageSnapshotSortKeys: readonly DealPageSnapshotSortKey[] = [
  'recommended',
  'discount-desc',
  'price-per-brick',
  'under-50',
];

type DealPageSnapshotSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

interface DealPageCurrentOfferRow {
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
  offers: unknown;
  price_spread_minor: number | null;
  set_id: string;
  trusted_offer_count: number | null;
}

interface DealPageSnapshotOffer {
  availability?: string;
  merchantSlug?: string;
  priceMinor?: number;
}

export interface DealPageSnapshotCard extends CatalogHomepageSetCard {
  bestPriceMinor: number;
  dealScore: number;
  discountPercent?: number;
  legoReferencePriceMinor?: number;
  priceContext: {
    coverageLabel: string;
    currentPrice: string;
    dealReason?: string;
    discountMetric?: string;
    decisionLabel?: string;
    decisionNote?: string;
    merchantLabel: string;
    primaryActionHref?: string;
    pricePositionLabel?: string;
    pricePositionTone?: 'info' | 'neutral' | 'positive' | 'warning';
    reviewedLabel: string;
  };
  pricePerBrickMinor?: number;
  savingsVsLegoMinor?: number;
  setNumber: string;
}

export interface DealPageSnapshot {
  generatedAt: string;
  items: readonly DealPageSnapshotCard[];
  page: number;
  pageSize: number;
  sortKey: DealPageSnapshotSortKey;
  sourceVersion?: string;
  totalCount: number;
}

export interface DealPageSnapshotBuildResult {
  debugCounters: DealPageSnapshotDebugCounters;
  dryRun: boolean;
  generatedAt: string;
  snapshots: readonly DealPageSnapshot[];
  summaryBySortKey: Readonly<
    Record<
      string,
      {
        itemsBuilt: number;
        pageCount: number;
        totalCount: number;
      }
    >
  >;
  upsertedCount: number;
}

export interface DealPageSnapshotDebugCounters {
  latestSnapshotObservedAt?: string;
  oldestSnapshotObservedAt?: string;
  snapshotRowsRead: number;
  rowsRejectedByReason: Readonly<Record<string, number>>;
  rowsUnder50: number;
  rowsWithBestOffer: number;
  rowsWithDiscount: number;
  rowsWithInStockOffer: number;
  rowsWithOfferCount: number;
  rowsWithOffersJson: number;
  rowsWithPieces: number;
  rowsWithReferencePrice: number;
}

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function formatPrice(minorUnits: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    style: 'currency',
  }).format(minorUnits / 100);
}

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function isFreshSnapshot({
  now,
  snapshot,
}: {
  now: Date;
  snapshot: DealPageCurrentOfferRow;
}): boolean {
  const observedTimestamp =
    parseTimestamp(snapshot.best_checked_at) ??
    parseTimestamp(snapshot.computed_at);

  return (
    typeof observedTimestamp === 'number' &&
    now.getTime() - observedTimestamp <= SNAPSHOT_MAX_AGE_MS
  );
}

function readSnapshotOffers(value: unknown): DealPageSnapshotOffer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((offer): offer is DealPageSnapshotOffer => {
    if (!offer || typeof offer !== 'object' || Array.isArray(offer)) {
      return false;
    }

    const candidate = offer as Partial<DealPageSnapshotOffer>;

    return (
      typeof candidate.merchantSlug === 'string' &&
      typeof candidate.priceMinor === 'number'
    );
  });
}

function getLegoReferencePriceMinor(
  snapshot: DealPageCurrentOfferRow,
): number | undefined {
  return readSnapshotOffers(snapshot.offers).find(
    (offer) =>
      offer.merchantSlug === LEGO_REFERENCE_MERCHANT_SLUG &&
      typeof offer.priceMinor === 'number' &&
      offer.priceMinor > 0 &&
      offer.availability !== 'out_of_stock',
  )?.priceMinor;
}

function createDebugCounters(): DealPageSnapshotDebugCounters {
  return {
    snapshotRowsRead: 0,
    rowsRejectedByReason: {},
    rowsUnder50: 0,
    rowsWithBestOffer: 0,
    rowsWithDiscount: 0,
    rowsWithInStockOffer: 0,
    rowsWithOfferCount: 0,
    rowsWithOffersJson: 0,
    rowsWithPieces: 0,
    rowsWithReferencePrice: 0,
  };
}

function trackObservedTimestamp(
  counters: Pick<
    DealPageSnapshotDebugCounters,
    'latestSnapshotObservedAt' | 'oldestSnapshotObservedAt'
  >,
  value: string | null | undefined,
) {
  const timestamp = parseTimestamp(value);

  if (typeof timestamp !== 'number') {
    return;
  }

  const isoValue = new Date(timestamp).toISOString();
  const latestTimestamp = parseTimestamp(counters.latestSnapshotObservedAt);
  const oldestTimestamp = parseTimestamp(counters.oldestSnapshotObservedAt);

  if (typeof latestTimestamp !== 'number' || timestamp > latestTimestamp) {
    counters.latestSnapshotObservedAt = isoValue;
  }

  if (typeof oldestTimestamp !== 'number' || timestamp < oldestTimestamp) {
    counters.oldestSnapshotObservedAt = isoValue;
  }
}

function incrementRejectReason(
  counters: DealPageSnapshotDebugCounters,
  reason: string,
) {
  const mutableReasons = counters.rowsRejectedByReason as Record<
    string,
    number
  >;

  mutableReasons[reason] = (mutableReasons[reason] ?? 0) + 1;
}

function getDealMetrics({
  catalogSet,
  snapshot,
}: {
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  snapshot: DealPageCurrentOfferRow;
}): {
  dealScore: number;
  discountPercent?: number;
  legoReferencePriceMinor?: number;
  pricePerBrickMinor?: number;
  savingsVsLegoMinor?: number;
} {
  const bestPriceMinor = snapshot.best_price_minor ?? 0;
  const legoReferencePriceMinor = getLegoReferencePriceMinor(snapshot);
  const savingsVsLegoMinor =
    typeof legoReferencePriceMinor === 'number' &&
    legoReferencePriceMinor > bestPriceMinor
      ? legoReferencePriceMinor - bestPriceMinor
      : undefined;
  const discountPercent =
    typeof savingsVsLegoMinor === 'number' &&
    typeof legoReferencePriceMinor === 'number'
      ? Math.round((savingsVsLegoMinor / legoReferencePriceMinor) * 100)
      : undefined;
  const marketSpreadMinor =
    typeof snapshot.next_best_price_minor === 'number' &&
    snapshot.next_best_price_minor > bestPriceMinor
      ? snapshot.next_best_price_minor - bestPriceMinor
      : typeof snapshot.price_spread_minor === 'number'
        ? snapshot.price_spread_minor
        : 0;
  const pieces = catalogSet.pieceCount;
  const pricePerBrickMinor =
    pieces > 0 ? Math.round(bestPriceMinor / pieces) : undefined;
  const dealScore =
    (savingsVsLegoMinor ?? 0) * 3 +
    (discountPercent ?? 0) * 120 +
    marketSpreadMinor +
    (snapshot.trusted_offer_count ?? 0) * 50 +
    (snapshot.comparable_offer_count ?? 0) * 25;

  return {
    dealScore,
    ...(typeof discountPercent === 'number' ? { discountPercent } : {}),
    ...(typeof legoReferencePriceMinor === 'number'
      ? { legoReferencePriceMinor }
      : {}),
    ...(typeof pricePerBrickMinor === 'number' ? { pricePerBrickMinor } : {}),
    ...(typeof savingsVsLegoMinor === 'number' ? { savingsVsLegoMinor } : {}),
  };
}

function toDealSnapshotCard({
  catalogSet,
  snapshot,
}: {
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  snapshot: DealPageCurrentOfferRow;
}): DealPageSnapshotCard | undefined {
  const bestPriceMinor = snapshot.best_price_minor;

  if (
    typeof bestPriceMinor !== 'number' ||
    bestPriceMinor <= 0 ||
    snapshot.best_availability !== 'in_stock' ||
    !snapshot.best_product_url ||
    !snapshot.best_merchant_name
  ) {
    return undefined;
  }

  const metrics = getDealMetrics({ catalogSet, snapshot });
  const discountMetric =
    typeof metrics.savingsVsLegoMinor === 'number'
      ? `${formatPrice(metrics.savingsVsLegoMinor)} goedkoper dan LEGO`
      : undefined;
  const pricePerBrickLabel =
    typeof metrics.pricePerBrickMinor === 'number'
      ? `${metrics.pricePerBrickMinor} cent per steen`
      : undefined;

  return {
    ...(catalogSet.createdAt ? { createdAt: catalogSet.createdAt } : {}),
    bestPriceMinor,
    dealScore: metrics.dealScore,
    ...(typeof metrics.discountPercent === 'number'
      ? { discountPercent: metrics.discountPercent }
      : {}),
    ...(typeof metrics.legoReferencePriceMinor === 'number'
      ? { legoReferencePriceMinor: metrics.legoReferencePriceMinor }
      : {}),
    ...(catalogSet.imageUrl ? { imageUrl: catalogSet.imageUrl } : {}),
    id: catalogSet.setId,
    name: catalogSet.displayTitle ?? catalogSet.name,
    pieces: catalogSet.pieceCount,
    priceContext: {
      coverageLabel: `${snapshot.offer_count ?? 1} vergeleken winkel${snapshot.offer_count === 1 ? '' : 's'}`,
      currentPrice: `Vanaf ${formatPrice(bestPriceMinor)}`,
      ...(discountMetric ? { discountMetric } : {}),
      ...(pricePerBrickLabel ? { dealReason: pricePerBrickLabel } : {}),
      decisionLabel:
        typeof metrics.discountPercent === 'number' &&
        metrics.discountPercent >= 30 &&
        typeof metrics.savingsVsLegoMinor === 'number' &&
        metrics.savingsVsLegoMinor >= 4_000
          ? 'Topdeal'
          : typeof metrics.discountPercent === 'number' &&
              metrics.discountPercent >= 20
            ? 'Sterke deal'
            : typeof metrics.discountPercent === 'number' &&
                metrics.discountPercent >= 10
              ? 'Goede deal'
              : 'Beste prijs',
      decisionNote: `Laagst bij ${snapshot.best_merchant_name}`,
      merchantLabel: `Laagst bij ${snapshot.best_merchant_name}`,
      primaryActionHref: snapshot.best_product_url,
      pricePositionLabel:
        typeof metrics.discountPercent === 'number'
          ? `${metrics.discountPercent}% onder LEGO`
          : 'Laagste prijs',
      pricePositionTone: 'positive',
      reviewedLabel: 'Snapshot bijgewerkt',
    },
    ...(typeof metrics.pricePerBrickMinor === 'number'
      ? { pricePerBrickMinor: metrics.pricePerBrickMinor }
      : {}),
    releaseYear: catalogSet.releaseYear,
    ...(catalogSet.releaseDate ? { releaseDate: catalogSet.releaseDate } : {}),
    ...(catalogSet.releaseDatePrecision
      ? { releaseDatePrecision: catalogSet.releaseDatePrecision }
      : {}),
    ...(typeof metrics.savingsVsLegoMinor === 'number'
      ? { savingsVsLegoMinor: metrics.savingsVsLegoMinor }
      : {}),
    ...(catalogSet.secondaryLabels
      ? { secondaryLabels: catalogSet.secondaryLabels }
      : {}),
    setNumber: catalogSet.sourceSetNumber ?? catalogSet.setId,
    slug: catalogSet.slug,
    theme: catalogSet.primaryTheme,
    ...(catalogSet.publicTheme ? { publicTheme: catalogSet.publicTheme } : {}),
  };
}

function withSortSpecificPriceContext(
  card: DealPageSnapshotCard,
  sortKey: DealPageSnapshotSortKey,
): DealPageSnapshotCard {
  if (sortKey === 'price-per-brick') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Prijs per steen',
        pricePositionLabel: card.priceContext.dealReason ?? 'Prijs per steen',
      },
    };
  }

  if (sortKey === 'under-50') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Onder €50',
        pricePositionLabel:
          typeof card.discountPercent === 'number'
            ? card.priceContext.pricePositionLabel
            : 'Onder €50',
      },
    };
  }

  if (sortKey === 'discount-desc') {
    return card;
  }

  if (typeof card.discountPercent !== 'number') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Beste prijs',
      },
    };
  }

  return card;
}

async function listDealCurrentOfferSnapshots({
  supabaseClient,
}: {
  supabaseClient: DealPageSnapshotSupabaseClient;
}): Promise<{
  counters: Pick<
    DealPageSnapshotDebugCounters,
    | 'snapshotRowsRead'
    | 'rowsWithBestOffer'
    | 'rowsWithInStockOffer'
    | 'rowsWithOfferCount'
    | 'rowsWithOffersJson'
    | 'rowsWithReferencePrice'
    | 'rowsWithDiscount'
    | 'rowsUnder50'
  >;
  snapshotBySetId: Map<string, DealPageCurrentOfferRow>;
}> {
  const snapshotBySetId = new Map<string, DealPageCurrentOfferRow>();
  const counters: Pick<
    DealPageSnapshotDebugCounters,
    | 'latestSnapshotObservedAt'
    | 'oldestSnapshotObservedAt'
    | 'snapshotRowsRead'
    | 'rowsUnder50'
    | 'rowsWithBestOffer'
    | 'rowsWithDiscount'
    | 'rowsWithInStockOffer'
    | 'rowsWithOfferCount'
    | 'rowsWithOffersJson'
    | 'rowsWithReferencePrice'
  > = {
    snapshotRowsRead: 0,
    rowsUnder50: 0,
    rowsWithBestOffer: 0,
    rowsWithDiscount: 0,
    rowsWithInStockOffer: 0,
    rowsWithOfferCount: 0,
    rowsWithOffersJson: 0,
    rowsWithReferencePrice: 0,
  };

  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('commerce_current_offer_snapshots')
      .select(
        'set_id, best_price_minor, best_merchant_name, best_merchant_slug, best_availability, best_product_url, best_checked_at, offer_count, computed_at, next_best_price_minor, price_spread_minor, trusted_offer_count, comparable_offer_count, offers',
      )
      .eq('region_code', 'NL')
      .eq('currency_code', 'EUR')
      .eq('condition', 'new')
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load deal commerce snapshots.');
    }

    const rows = (data as DealPageCurrentOfferRow[] | null) ?? [];

    for (const row of rows) {
      counters.snapshotRowsRead += 1;
      if (
        typeof row.best_price_minor === 'number' &&
        row.best_price_minor > 0
      ) {
        counters.rowsWithBestOffer += 1;
      }
      if (row.best_availability === 'in_stock') {
        counters.rowsWithInStockOffer += 1;
      }
      if (typeof row.offer_count === 'number' && row.offer_count > 0) {
        counters.rowsWithOfferCount += 1;
      }
      if (readSnapshotOffers(row.offers).length > 0) {
        counters.rowsWithOffersJson += 1;
      }
      if (typeof getLegoReferencePriceMinor(row) === 'number') {
        counters.rowsWithReferencePrice += 1;
      }
      const bestPriceMinor = row.best_price_minor ?? 0;
      const referencePriceMinor = getLegoReferencePriceMinor(row);
      trackObservedTimestamp(counters, row.best_checked_at ?? row.computed_at);
      if (
        typeof referencePriceMinor === 'number' &&
        referencePriceMinor > bestPriceMinor &&
        bestPriceMinor > 0
      ) {
        counters.rowsWithDiscount += 1;
      }
      if (bestPriceMinor > 0 && bestPriceMinor < 5_000) {
        counters.rowsUnder50 += 1;
      }
      snapshotBySetId.set(row.set_id, row);
    }

    if (rows.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return {
    counters,
    snapshotBySetId,
  };
}

function compareDealCards(sortKey: DealPageSnapshotSortKey) {
  return (left: DealPageSnapshotCard, right: DealPageSnapshotCard): number => {
    if (sortKey === 'discount-desc') {
      return (
        (right.savingsVsLegoMinor ?? 0) - (left.savingsVsLegoMinor ?? 0) ||
        (right.discountPercent ?? 0) - (left.discountPercent ?? 0) ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    if (sortKey === 'price-per-brick') {
      return (
        (left.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) -
          (right.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) ||
        right.dealScore - left.dealScore ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    if (sortKey === 'under-50') {
      return (
        right.dealScore - left.dealScore ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    return (
      right.dealScore - left.dealScore ||
      (right.savingsVsLegoMinor ?? 0) - (left.savingsVsLegoMinor ?? 0) ||
      left.bestPriceMinor - right.bestPriceMinor ||
      left.name.localeCompare(right.name, 'nl')
    );
  };
}

function filterDealCardsForSort(
  cards: readonly DealPageSnapshotCard[],
  sortKey: DealPageSnapshotSortKey,
): DealPageSnapshotCard[] {
  if (sortKey === 'discount-desc') {
    return cards.filter(
      (card) =>
        typeof card.savingsVsLegoMinor === 'number' &&
        card.savingsVsLegoMinor > 0,
    );
  }

  if (sortKey === 'price-per-brick') {
    return cards.filter(
      (card) =>
        typeof card.pricePerBrickMinor === 'number' &&
        card.pricePerBrickMinor > 0,
    );
  }

  if (sortKey === 'under-50') {
    return cards.filter((card) => card.bestPriceMinor < 5_000);
  }

  return [...cards];
}

export async function buildDealPageSnapshots({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  pageSize?: number;
  supabaseClient?: DealPageSnapshotSupabaseClient;
} = {}): Promise<
  Omit<DealPageSnapshotBuildResult, 'dryRun' | 'upsertedCount'>
> {
  const generatedAt = now.toISOString();
  const [catalogSets, offerSnapshotResult] = await Promise.all([
    listCanonicalCatalogSetsFn({ includeInactive: false, supabaseClient }),
    listDealCurrentOfferSnapshots({ supabaseClient }),
  ]);
  const offerSnapshots = offerSnapshotResult.snapshotBySetId;
  const debugCounters = createDebugCounters();

  Object.assign(debugCounters, offerSnapshotResult.counters);

  const candidates = catalogSets.flatMap((catalogSet) => {
    const snapshot = offerSnapshots.get(catalogSet.setId);

    if (catalogSet.pieceCount > 0) {
      debugCounters.rowsWithPieces += 1;
    }

    if (!snapshot) {
      incrementRejectReason(debugCounters, 'missing_snapshot');
      return [];
    }

    if (!isFreshSnapshot({ now, snapshot })) {
      incrementRejectReason(debugCounters, 'stale_snapshot');
      return [];
    }

    if (
      typeof snapshot.best_price_minor !== 'number' ||
      snapshot.best_price_minor <= 0
    ) {
      incrementRejectReason(debugCounters, 'invalid_best_price');
      return [];
    }

    if (snapshot.best_availability !== 'in_stock') {
      incrementRejectReason(debugCounters, 'best_offer_not_in_stock');
      return [];
    }

    if (!snapshot.best_product_url) {
      incrementRejectReason(debugCounters, 'missing_best_product_url');
      return [];
    }

    if (!snapshot.best_merchant_name) {
      incrementRejectReason(debugCounters, 'missing_best_merchant_name');
      return [];
    }

    const card = toDealSnapshotCard({ catalogSet, snapshot });

    return card ? [card] : [];
  });
  const snapshots: DealPageSnapshot[] = [];
  const summaryBySortKey: Record<
    string,
    { itemsBuilt: number; pageCount: number; totalCount: number }
  > = {};

  for (const sortKey of dealPageSnapshotSortKeys) {
    const sortedCandidates = filterDealCardsForSort(candidates, sortKey)
      .sort(compareDealCards(sortKey))
      .map((card) => withSortSpecificPriceContext(card, sortKey));
    const pageChunks =
      sortedCandidates.length > 0
        ? chunkRows(sortedCandidates, pageSize)
        : [[] as DealPageSnapshotCard[]];

    pageChunks.forEach((items, pageIndex) => {
      snapshots.push({
        generatedAt,
        items,
        page: pageIndex + 1,
        pageSize,
        sortKey,
        sourceVersion: generatedAt,
        totalCount: sortedCandidates.length,
      });
    });

    summaryBySortKey[sortKey] = {
      itemsBuilt: sortedCandidates.length,
      pageCount: Math.max(1, Math.ceil(sortedCandidates.length / pageSize)),
      totalCount: sortedCandidates.length,
    };
  }

  return {
    debugCounters,
    generatedAt,
    snapshots,
    summaryBySortKey,
  };
}

function toSnapshotRows(snapshots: readonly DealPageSnapshot[]) {
  return snapshots.map((snapshot) => ({
    collection_slug: DEAL_PAGE_SNAPSHOT_SLUG,
    generated_at: snapshot.generatedAt,
    items_json: snapshot.items,
    page: snapshot.page,
    page_size: snapshot.pageSize,
    snapshot_source: SNAPSHOT_SOURCE,
    sort_key: snapshot.sortKey,
    source_version: snapshot.sourceVersion ?? snapshot.generatedAt,
    total_count: snapshot.totalCount,
  }));
}

export async function upsertDealPageSnapshots({
  snapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshots: readonly DealPageSnapshot[];
  supabaseClient?: DealPageSnapshotSupabaseClient;
}): Promise<number> {
  let upsertedCount = 0;

  for (const chunk of chunkRows(toSnapshotRows(snapshots), 100)) {
    const { error } = await supabaseClient
      .from(DEAL_PAGE_SNAPSHOTS_TABLE)
      .upsert(chunk, {
        onConflict: 'collection_slug,sort_key,page,page_size',
      });

    if (error) {
      throw new Error('Unable to upsert deal page snapshots.');
    }

    upsertedCount += chunk.length;
  }

  return upsertedCount;
}

export async function syncDealPageSnapshots({
  dryRun = true,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  dryRun?: boolean;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  pageSize?: number;
  supabaseClient?: DealPageSnapshotSupabaseClient;
} = {}): Promise<DealPageSnapshotBuildResult> {
  const buildResult = await buildDealPageSnapshots({
    listCanonicalCatalogSetsFn,
    now,
    pageSize,
    supabaseClient,
  });
  const upsertedCount = dryRun
    ? 0
    : await upsertDealPageSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      });

  return {
    ...buildResult,
    dryRun,
    upsertedCount,
  };
}
