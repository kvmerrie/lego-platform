import { catalogPopularitySnapshot } from '@lego-platform/catalog/data-access';
import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  HOMEPAGE_COMMERCE_SNAPSHOT_COLLECTION_SLUG,
  HOMEPAGE_COMMERCE_SNAPSHOT_PAGE,
  HOMEPAGE_COMMERCE_SNAPSHOT_PAGE_SIZE,
  HOMEPAGE_COMMERCE_SNAPSHOT_SORT_KEY,
  createEmptyHomepageCommerceSnapshot,
  getCatalogCollectionLandingPageConfig,
  type CatalogCanonicalSet,
  type CatalogHomepageSetCard,
  type CatalogPopularitySnapshot,
  type HomepageCommerceCard,
  type HomepageCommerceSnapshot,
} from '@lego-platform/catalog/util';
import { getSetDecisionState } from '@lego-platform/pricing/data-access';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCollectionPageSnapshots,
  COLLECTION_PAGE_SNAPSHOTS_TABLE,
  type CollectionPageSnapshot,
  type CollectionPageSnapshotCard,
} from './collection-page-snapshot-server';
import {
  buildDealPageSnapshots,
  type DealPageSnapshot,
  type DealPageSnapshotCard,
} from './deal-page-snapshot-server';
import { enrichCatalogSetsWithPresentationTitles } from './catalog-presentation-title-server';

const HOMEPAGE_COMMERCE_TAB_LIMIT = 20;
const HOMEPAGE_COMMERCE_SYNC_PAGE_SIZE = 40;
const HOMEPAGE_COMMERCE_SNAPSHOT_SOURCE = 'homepage_commerce_snapshot_sync';
const HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE = 1000;
const UNDER_100_COLLECTION_SLUG = 'lego-sets-onder-100-euro';

type HomepageCommerceSnapshotSupabaseClient = Pick<
  SupabaseClient,
  'from' | 'rpc'
>;

export interface HomepageCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  comparable_offer_count?: number | null;
  computed_at: string | null;
  offer_count: number | null;
  set_id: string;
  trusted_offer_count?: number | null;
}

export interface HomepagePriceHistoryRow {
  headline_price_minor: number | null;
  observed_at: string | null;
  recorded_on: string | null;
  reference_price_minor: number | null;
  set_id: string;
}

export interface HomepageCommerceSnapshotSummary {
  buyRailSetCount: number;
  followRailSetCount: number;
  overlapRemovedCount: number;
  payloadBytes: number;
  titleAudit: Record<
    | keyof HomepageCommerceSnapshot['buyRail']
    | keyof HomepageCommerceSnapshot['followRail'],
    {
      fallbackTitleCount: number;
      missingNlTitleCount: number;
      nlTitleAppliedCount: number;
    }
  >;
  tabCounts: {
    bestDeals: number;
    popularThisWeek: number;
    giftsUnder100: number;
    smartToFollow: number;
    biggestPriceDrops: number;
    waitCanPayOff: number;
  };
}

export interface HomepageCommerceSnapshotBuildResult {
  dryRun: boolean;
  generatedAt: string;
  snapshot: HomepageCommerceSnapshot;
  summary: HomepageCommerceSnapshotSummary;
  upsertedCount: number;
}

function formatPrice(minorUnits: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    style: 'currency',
  }).format(minorUnits / 100);
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareByName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, 'nl');
}

function uniqueCardsBySetId(
  cards: readonly HomepageCommerceCard[],
  limit: number,
): HomepageCommerceCard[] {
  const seenSetIds = new Set<string>();
  const uniqueCards: HomepageCommerceCard[] = [];

  for (const card of cards) {
    if (seenSetIds.has(card.setId)) {
      continue;
    }

    seenSetIds.add(card.setId);
    uniqueCards.push(card);

    if (uniqueCards.length >= limit) {
      break;
    }
  }

  return uniqueCards;
}

function getCardImageUrl(
  card: Pick<CatalogHomepageSetCard, 'imageUrl' | 'primaryImage'>,
): string {
  return card.imageUrl ?? card.primaryImage ?? '';
}

function getCatalogSetImageUrl(catalogSet: CatalogCanonicalSet): string {
  return catalogSet.imageUrl ?? catalogSet.cardImageUrl ?? '';
}

function toHomepageCardFromDeal({
  card,
  currentOfferBySetId,
}: {
  card: DealPageSnapshotCard;
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
}): HomepageCommerceCard | undefined {
  const offer = currentOfferBySetId.get(card.id);

  if (!isActionableCurrentOffer(offer)) {
    return undefined;
  }

  return {
    setId: card.id,
    slug: card.slug,
    ...(card.catalogName ? { catalogName: card.catalogName } : {}),
    displayTitle: card.displayTitle ?? card.name,
    ...(card.displayTitleSource
      ? { displayTitleSource: card.displayTitleSource }
      : {}),
    name: card.name,
    imageUrl: getCardImageUrl(card),
    theme: card.publicTheme?.name ?? card.theme,
    releaseYear: card.releaseYear,
    pieces: card.pieces,
    currentPriceMinor: offer.best_price_minor,
    dealLabel:
      card.priceContext.decisionLabel ?? card.priceContext.pricePositionLabel,
    confidenceLabel: offer.offer_count
      ? `${offer.offer_count} vergeleken winkel${
          offer.offer_count === 1 ? '' : 's'
        }`
      : card.priceContext.coverageLabel,
    ctaUrl: offer.best_product_url,
    merchantName: offer.best_merchant_name,
    ...(offer.best_merchant_slug
      ? { merchantSlug: offer.best_merchant_slug }
      : {}),
  };
}

function isActionableCurrentOffer(
  row: HomepageCurrentOfferSnapshotRow | undefined,
): row is HomepageCurrentOfferSnapshotRow & {
  best_merchant_name: string;
  best_price_minor: number;
  best_product_url: string;
} {
  return (
    row !== undefined &&
    typeof row.best_price_minor === 'number' &&
    row.best_price_minor > 0 &&
    typeof row.best_merchant_name === 'string' &&
    row.best_merchant_name.trim().length > 0 &&
    typeof row.best_product_url === 'string' &&
    row.best_product_url.trim().length > 0 &&
    (row.best_availability === 'in_stock' ||
      row.best_availability === 'limited')
  );
}

function toHomepageCardFromCurrentOffer({
  catalogSet,
  dealLabel,
  followRecommended = false,
  includeCta,
  offer,
}: {
  catalogSet: CatalogCanonicalSet;
  dealLabel?: string;
  followRecommended?: boolean;
  includeCta: boolean;
  offer?: HomepageCurrentOfferSnapshotRow;
}): HomepageCommerceCard {
  const currentPriceMinor =
    typeof offer?.best_price_minor === 'number' && offer.best_price_minor > 0
      ? offer.best_price_minor
      : undefined;

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
    theme: catalogSet.publicTheme?.name ?? catalogSet.primaryTheme,
    releaseYear: catalogSet.releaseYear,
    pieces: catalogSet.pieceCount,
    ...(typeof currentPriceMinor === 'number' ? { currentPriceMinor } : {}),
    ...(offer?.best_merchant_name
      ? { merchantName: offer.best_merchant_name }
      : {}),
    ...(offer?.best_merchant_slug
      ? { merchantSlug: offer.best_merchant_slug }
      : {}),
    ...(dealLabel ? { dealLabel } : {}),
    ...(offer?.offer_count
      ? {
          confidenceLabel: `${offer.offer_count} vergeleken winkel${
            offer.offer_count === 1 ? '' : 's'
          }`,
        }
      : {}),
    ...(includeCta && isActionableCurrentOffer(offer)
      ? { ctaUrl: offer.best_product_url }
      : {}),
    ...(followRecommended ? { followRecommended: true } : {}),
  };
}

function applyPresentationTitleToHomepageCard({
  card,
  catalogSetById,
}: {
  card: HomepageCommerceCard;
  catalogSetById: ReadonlyMap<string, CatalogCanonicalSet>;
}): HomepageCommerceCard {
  const catalogSet = catalogSetById.get(card.setId);

  if (!catalogSet) {
    return card;
  }

  return {
    ...card,
    ...(catalogSet.catalogName ? { catalogName: catalogSet.catalogName } : {}),
    displayTitle: catalogSet.displayTitle ?? catalogSet.name,
    ...(catalogSet.displayTitleSource
      ? { displayTitleSource: catalogSet.displayTitleSource }
      : {}),
    name: catalogSet.displayTitle ?? catalogSet.name,
  };
}

function applyPresentationTitlesToHomepageCards({
  cards,
  catalogSetById,
}: {
  cards: readonly HomepageCommerceCard[];
  catalogSetById: ReadonlyMap<string, CatalogCanonicalSet>;
}): HomepageCommerceCard[] {
  return cards.map((card) =>
    applyPresentationTitleToHomepageCard({ card, catalogSetById }),
  );
}

function toHomepageCardFromCollection({
  card,
  currentOfferBySetId,
}: {
  card: CollectionPageSnapshotCard;
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
}): HomepageCommerceCard {
  const offer = currentOfferBySetId.get(card.id);
  const currentPriceMinor =
    typeof offer?.best_price_minor === 'number' && offer.best_price_minor > 0
      ? offer.best_price_minor
      : typeof card.bestPriceMinor === 'number' && card.bestPriceMinor > 0
        ? card.bestPriceMinor
        : undefined;

  return {
    setId: card.id,
    slug: card.slug,
    ...(card.catalogName ? { catalogName: card.catalogName } : {}),
    displayTitle: card.displayTitle ?? card.name,
    ...(card.displayTitleSource
      ? { displayTitleSource: card.displayTitleSource }
      : {}),
    name: card.name,
    imageUrl: getCardImageUrl(card),
    theme: card.publicTheme?.name ?? card.theme,
    releaseYear: card.releaseYear,
    pieces: card.pieces,
    ...(typeof currentPriceMinor === 'number' ? { currentPriceMinor } : {}),
    ...(offer?.best_merchant_name
      ? { merchantName: offer.best_merchant_name }
      : {}),
    ...(offer?.best_merchant_slug
      ? { merchantSlug: offer.best_merchant_slug }
      : {}),
    dealLabel: card.priceContext?.coverageLabel ?? 'Onder EUR 100',
    confidenceLabel: card.priceContext?.merchantLabel ?? 'Actuele prijs',
    ...(isActionableCurrentOffer(offer)
      ? { ctaUrl: offer.best_product_url }
      : {}),
  };
}

async function listHomepageCurrentOfferSnapshots({
  supabaseClient,
}: {
  supabaseClient: HomepageCommerceSnapshotSupabaseClient;
}): Promise<HomepageCurrentOfferSnapshotRow[]> {
  const rows: HomepageCurrentOfferSnapshotRow[] = [];

  for (let from = 0; ; from += HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('commerce_current_offer_snapshots')
      .select(
        'set_id, best_price_minor, best_merchant_name, best_merchant_slug, best_availability, best_product_url, best_checked_at, offer_count, computed_at, trusted_offer_count, comparable_offer_count',
      )
      .eq('region_code', 'NL')
      .eq('currency_code', 'EUR')
      .eq('condition', 'new')
      .range(from, from + HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load homepage current offer snapshots.');
    }

    const pageRows = (data as HomepageCurrentOfferSnapshotRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function listHomepagePriceHistoryRows({
  supabaseClient,
}: {
  supabaseClient: HomepageCommerceSnapshotSupabaseClient;
}): Promise<HomepagePriceHistoryRow[]> {
  const rows: HomepagePriceHistoryRow[] = [];

  for (let from = 0; ; from += HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from('pricing_daily_set_history')
      .select(
        'set_id, headline_price_minor, reference_price_minor, recorded_on, observed_at',
      )
      .eq('region_code', 'NL')
      .eq('currency_code', 'EUR')
      .eq('condition', 'new')
      .order('recorded_on', { ascending: false })
      .range(from, from + HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error('Unable to load homepage price history.');
    }

    const pageRows = (data as HomepagePriceHistoryRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < HOMEPAGE_COMMERCE_QUERY_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function groupHistoryRowsBySetId(
  rows: readonly HomepagePriceHistoryRow[],
): Map<string, HomepagePriceHistoryRow[]> {
  const rowsBySetId = new Map<string, HomepagePriceHistoryRow[]>();

  for (const row of rows) {
    const setRows = rowsBySetId.get(row.set_id) ?? [];

    setRows.push(row);
    rowsBySetId.set(row.set_id, setRows);
  }

  for (const setRows of rowsBySetId.values()) {
    setRows.sort(
      (left, right) =>
        parseTimestamp(right.observed_at ?? right.recorded_on) -
        parseTimestamp(left.observed_at ?? left.recorded_on),
    );
  }

  return rowsBySetId;
}

function selectDealSnapshot(
  snapshots: readonly DealPageSnapshot[],
): DealPageSnapshot | undefined {
  return snapshots.find(
    (snapshot) => snapshot.sortKey === 'recommended' && snapshot.page === 1,
  );
}

function selectUnder100CollectionSnapshot(
  snapshots: readonly CollectionPageSnapshot[],
): CollectionPageSnapshot | undefined {
  const defaultSortKey =
    getCatalogCollectionLandingPageConfig(UNDER_100_COLLECTION_SLUG)?.sort
      .default ?? 'recommended';

  return (
    snapshots.find(
      (snapshot) =>
        snapshot.collectionSlug === UNDER_100_COLLECTION_SLUG &&
        snapshot.sortKey === defaultSortKey &&
        snapshot.page === 1,
    ) ??
    snapshots.find(
      (snapshot) =>
        snapshot.collectionSlug === UNDER_100_COLLECTION_SLUG &&
        snapshot.page === 1,
    )
  );
}

function getCatalogSetFollowScore(catalogSet: CatalogCanonicalSet): number {
  const searchableText = [
    catalogSet.displayTitle,
    catalogSet.name,
    catalogSet.primaryTheme,
    catalogSet.publicTheme?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('nl-NL');
  const theme = (catalogSet.publicTheme?.name ?? catalogSet.primaryTheme)
    .trim()
    .toLocaleLowerCase('nl-NL');
  const pieces = catalogSet.pieceCount;
  let score = 0;

  if (
    [
      'star wars',
      'icons',
      'ideas',
      'harry potter',
      'lord of the rings',
      'architecture',
      'technic',
      'botanicals',
    ].includes(theme)
  ) {
    score += 42;
  }

  if (
    /\b(rivendell|hogwarts|falcon|death star|castle|tower|modular|botanical|bouquet|orchid|lighthouse|diorama|helmet|ucs|ultimate collector|display)\b/u.test(
      searchableText,
    )
  ) {
    score += 38;
  }

  if (pieces >= 3000) {
    score += 36;
  } else if (pieces >= 1500) {
    score += 28;
  } else if (pieces >= 700) {
    score += 18;
  } else if (pieces >= 250) {
    score += 8;
  }

  if (catalogSet.imageUrl || catalogSet.cardImageUrl) {
    score += 14;
  }

  return score;
}

function buildPopularThisWeekCards({
  catalogSetById,
  currentOfferBySetId,
  popularitySnapshot,
  tabLimit,
}: {
  catalogSetById: ReadonlyMap<string, CatalogCanonicalSet>;
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
  popularitySnapshot: CatalogPopularitySnapshot;
  tabLimit: number;
}): HomepageCommerceCard[] {
  return uniqueCardsBySetId(
    popularitySnapshot.windows.week
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.unique_sessions - left.unique_sessions ||
          left.set_num.localeCompare(right.set_num),
      )
      .flatMap((item) => {
        const catalogSet = catalogSetById.get(item.set_num);
        const offer = currentOfferBySetId.get(item.set_num);

        if (!catalogSet || !isActionableCurrentOffer(offer)) {
          return [];
        }

        return [
          toHomepageCardFromCurrentOffer({
            catalogSet,
            dealLabel: 'Populair deze week',
            includeCta: true,
            offer,
          }),
        ];
      }),
    tabLimit,
  );
}

function buildSmartToFollowCards({
  buySetIds,
  catalogSets,
  currentOfferBySetId,
  tabLimit,
}: {
  buySetIds: ReadonlySet<string>;
  catalogSets: readonly CatalogCanonicalSet[];
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
  tabLimit: number;
}): HomepageCommerceCard[] {
  return uniqueCardsBySetId(
    catalogSets
      .filter((catalogSet) => !buySetIds.has(catalogSet.setId))
      .map((catalogSet) => ({
        catalogSet,
        score:
          getCatalogSetFollowScore(catalogSet) +
          Math.min(
            (currentOfferBySetId.get(catalogSet.setId)?.offer_count ?? 0) * 6,
            30,
          ),
      }))
      .filter(({ score }) => score >= 58)
      .sort(
        (left, right) =>
          right.score - left.score ||
          compareByName(left.catalogSet, right.catalogSet),
      )
      .map(({ catalogSet }) =>
        toHomepageCardFromCurrentOffer({
          catalogSet,
          dealLabel: 'Slim om te volgen',
          followRecommended: true,
          includeCta: false,
          offer: currentOfferBySetId.get(catalogSet.setId),
        }),
      ),
    tabLimit,
  );
}

function buildBiggestPriceDropCards({
  buySetIds,
  catalogSetById,
  currentOfferBySetId,
  historyRowsBySetId,
  tabLimit,
}: {
  buySetIds: ReadonlySet<string>;
  catalogSetById: ReadonlyMap<string, CatalogCanonicalSet>;
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
  historyRowsBySetId: ReadonlyMap<string, readonly HomepagePriceHistoryRow[]>;
  tabLimit: number;
}): HomepageCommerceCard[] {
  return uniqueCardsBySetId(
    [...historyRowsBySetId.entries()]
      .flatMap(([setId, historyRows]) => {
        if (buySetIds.has(setId) || historyRows.length < 2) {
          return [];
        }

        const catalogSet = catalogSetById.get(setId);
        const latestPrice = historyRows[0]?.headline_price_minor;
        const previousPrices = historyRows
          .slice(1)
          .flatMap((row) =>
            typeof row.headline_price_minor === 'number' &&
            row.headline_price_minor > 0
              ? [row.headline_price_minor]
              : [],
          );
        const previousHigh = previousPrices.length
          ? Math.max(...previousPrices)
          : undefined;

        if (
          !catalogSet ||
          typeof latestPrice !== 'number' ||
          latestPrice <= 0 ||
          typeof previousHigh !== 'number' ||
          previousHigh <= latestPrice
        ) {
          return [];
        }

        const dropMinor = previousHigh - latestPrice;
        const dropPercent = Math.round((dropMinor / previousHigh) * 100);

        if (dropMinor < 500 || dropPercent < 5) {
          return [];
        }

        return [
          {
            card: toHomepageCardFromCurrentOffer({
              catalogSet,
              dealLabel: `${formatPrice(dropMinor)} gedaald`,
              followRecommended: true,
              includeCta: false,
              offer: currentOfferBySetId.get(setId),
            }),
            dropMinor,
            dropPercent,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.dropMinor - left.dropMinor ||
          right.dropPercent - left.dropPercent ||
          compareByName(left.card, right.card),
      )
      .map(({ card }) => card),
    tabLimit,
  );
}

function getHistoryReferencePriceMinor(
  historyRows: readonly HomepagePriceHistoryRow[],
): number | undefined {
  const latestReference = historyRows.find(
    (row) =>
      typeof row.reference_price_minor === 'number' &&
      row.reference_price_minor > 0,
  )?.reference_price_minor;

  if (typeof latestReference === 'number') {
    return latestReference;
  }

  const previousPrices = historyRows
    .slice(1)
    .flatMap((row) =>
      typeof row.headline_price_minor === 'number' &&
      row.headline_price_minor > 0
        ? [row.headline_price_minor]
        : [],
    );

  if (!previousPrices.length) {
    return undefined;
  }

  return Math.round(
    previousPrices.reduce((total, price) => total + price, 0) /
      previousPrices.length,
  );
}

function buildWaitCanPayOffCards({
  buySetIds,
  catalogSetById,
  currentOfferBySetId,
  historyRowsBySetId,
  tabLimit,
}: {
  buySetIds: ReadonlySet<string>;
  catalogSetById: ReadonlyMap<string, CatalogCanonicalSet>;
  currentOfferBySetId: ReadonlyMap<string, HomepageCurrentOfferSnapshotRow>;
  historyRowsBySetId: ReadonlyMap<string, readonly HomepagePriceHistoryRow[]>;
  tabLimit: number;
}): HomepageCommerceCard[] {
  return uniqueCardsBySetId(
    [...historyRowsBySetId.entries()]
      .flatMap(([setId, historyRows]) => {
        if (buySetIds.has(setId) || historyRows.length < 2) {
          return [];
        }

        const catalogSet = catalogSetById.get(setId);
        const offer = currentOfferBySetId.get(setId);
        const latestPrice =
          typeof offer?.best_price_minor === 'number' &&
          offer.best_price_minor > 0
            ? offer.best_price_minor
            : historyRows[0]?.headline_price_minor;
        const referencePriceMinor = getHistoryReferencePriceMinor(historyRows);

        if (
          !catalogSet ||
          typeof latestPrice !== 'number' ||
          latestPrice <= 0 ||
          typeof referencePriceMinor !== 'number' ||
          referencePriceMinor <= 0
        ) {
          return [];
        }

        const deltaMinor = latestPrice - referencePriceMinor;

        if (
          getSetDecisionState({
            deltaMinor,
            referencePriceMinor,
          }) !== 'wait'
        ) {
          return [];
        }

        return [
          {
            card: toHomepageCardFromCurrentOffer({
              catalogSet,
              dealLabel: 'Wachten kan lonen',
              followRecommended: true,
              includeCta: false,
              offer,
            }),
            deltaMinor,
            offerCount: offer?.offer_count ?? 0,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.deltaMinor - left.deltaMinor ||
          right.offerCount - left.offerCount ||
          compareByName(left.card, right.card),
      )
      .map(({ card }) => card),
    tabLimit,
  );
}

function createSummary(
  snapshot: HomepageCommerceSnapshot,
): HomepageCommerceSnapshotSummary {
  const buyRailSetIds = new Set(
    [
      ...snapshot.buyRail.bestDeals,
      ...snapshot.buyRail.popularThisWeek,
      ...snapshot.buyRail.giftsUnder100,
    ].map((card) => card.setId),
  );
  const followRailSetIds = new Set(
    [
      ...snapshot.followRail.smartToFollow,
      ...snapshot.followRail.biggestPriceDrops,
      ...snapshot.followRail.waitCanPayOff,
    ].map((card) => card.setId),
  );

  return {
    buyRailSetCount: buyRailSetIds.size,
    followRailSetCount: followRailSetIds.size,
    overlapRemovedCount: 0,
    payloadBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    titleAudit: {
      bestDeals: summarizeTitleAudit(snapshot.buyRail.bestDeals),
      popularThisWeek: summarizeTitleAudit(snapshot.buyRail.popularThisWeek),
      giftsUnder100: summarizeTitleAudit(snapshot.buyRail.giftsUnder100),
      smartToFollow: summarizeTitleAudit(snapshot.followRail.smartToFollow),
      biggestPriceDrops: summarizeTitleAudit(
        snapshot.followRail.biggestPriceDrops,
      ),
      waitCanPayOff: summarizeTitleAudit(snapshot.followRail.waitCanPayOff),
    },
    tabCounts: {
      bestDeals: snapshot.buyRail.bestDeals.length,
      popularThisWeek: snapshot.buyRail.popularThisWeek.length,
      giftsUnder100: snapshot.buyRail.giftsUnder100.length,
      smartToFollow: snapshot.followRail.smartToFollow.length,
      biggestPriceDrops: snapshot.followRail.biggestPriceDrops.length,
      waitCanPayOff: snapshot.followRail.waitCanPayOff.length,
    },
  };
}

function summarizeTitleAudit(cards: readonly HomepageCommerceCard[]) {
  const nlTitleAppliedCount = cards.filter(
    (card) => card.displayTitleSource === 'rakuten-lego-eu',
  ).length;
  const fallbackTitleCount = cards.length - nlTitleAppliedCount;

  return {
    fallbackTitleCount,
    missingNlTitleCount: fallbackTitleCount,
    nlTitleAppliedCount,
  };
}

export async function buildHomepageCommerceSnapshot({
  buildCollectionPageSnapshotsFn = buildCollectionPageSnapshots,
  buildDealPageSnapshotsFn = buildDealPageSnapshots,
  catalogSets,
  collectionSnapshots,
  currentOfferRows,
  dealSnapshots,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  popularitySnapshot = catalogPopularitySnapshot,
  priceHistoryRows,
  supabaseClient = getServerSupabaseAdminClient(),
  tabLimit = HOMEPAGE_COMMERCE_TAB_LIMIT,
}: {
  buildCollectionPageSnapshotsFn?: typeof buildCollectionPageSnapshots;
  buildDealPageSnapshotsFn?: typeof buildDealPageSnapshots;
  catalogSets?: readonly CatalogCanonicalSet[];
  collectionSnapshots?: readonly CollectionPageSnapshot[];
  currentOfferRows?: readonly HomepageCurrentOfferSnapshotRow[];
  dealSnapshots?: readonly DealPageSnapshot[];
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  popularitySnapshot?: CatalogPopularitySnapshot;
  priceHistoryRows?: readonly HomepagePriceHistoryRow[];
  supabaseClient?: HomepageCommerceSnapshotSupabaseClient;
  tabLimit?: number;
} = {}): Promise<
  Omit<HomepageCommerceSnapshotBuildResult, 'dryRun' | 'upsertedCount'>
> {
  const generatedAt = now.toISOString();
  const [
    resolvedCatalogSets,
    resolvedDealSnapshots,
    resolvedCollectionSnapshots,
    resolvedCurrentOfferRows,
    resolvedPriceHistoryRows,
  ] = await Promise.all([
    catalogSets
      ? Promise.resolve([...catalogSets])
      : listCanonicalCatalogSetsFn({ includeInactive: false, supabaseClient }),
    dealSnapshots
      ? Promise.resolve([...dealSnapshots])
      : buildDealPageSnapshotsFn({
          now,
          pageSize: HOMEPAGE_COMMERCE_SYNC_PAGE_SIZE,
          supabaseClient,
        }).then((result) => result.snapshots),
    collectionSnapshots
      ? Promise.resolve([...collectionSnapshots])
      : buildCollectionPageSnapshotsFn({
          collectionSlugs: [UNDER_100_COLLECTION_SLUG],
          now,
          pageSize: HOMEPAGE_COMMERCE_SYNC_PAGE_SIZE,
          supabaseClient,
        }).then((result) => result.snapshots),
    currentOfferRows
      ? Promise.resolve([...currentOfferRows])
      : listHomepageCurrentOfferSnapshots({ supabaseClient }),
    priceHistoryRows
      ? Promise.resolve([...priceHistoryRows])
      : listHomepagePriceHistoryRows({ supabaseClient }),
  ]);
  const currentOfferBySetId = new Map(
    resolvedCurrentOfferRows.map((row) => [row.set_id, row]),
  );
  const presentationCatalogSets = catalogSets
    ? resolvedCatalogSets
    : await enrichCatalogSetsWithPresentationTitles({
        catalogSets: resolvedCatalogSets,
        supabaseClient,
      });
  const catalogSetById = new Map(
    resolvedCatalogSets.map((catalogSet) => [catalogSet.setId, catalogSet]),
  );
  const presentationCatalogSetById = new Map(
    presentationCatalogSets.map((catalogSet) => [catalogSet.setId, catalogSet]),
  );
  const historyRowsBySetId = groupHistoryRowsBySetId(resolvedPriceHistoryRows);
  const bestDeals = uniqueCardsBySetId(
    (selectDealSnapshot(resolvedDealSnapshots)?.items ?? []).flatMap((card) => {
      const homepageCard = toHomepageCardFromDeal({
        card,
        currentOfferBySetId,
      });

      return homepageCard ? [homepageCard] : [];
    }),
    tabLimit,
  );
  const popularThisWeek = buildPopularThisWeekCards({
    catalogSetById,
    currentOfferBySetId,
    popularitySnapshot,
    tabLimit,
  });
  const giftsUnder100 = uniqueCardsBySetId(
    (selectUnder100CollectionSnapshot(resolvedCollectionSnapshots)?.items ?? [])
      .map((card) =>
        toHomepageCardFromCollection({
          card,
          currentOfferBySetId,
        }),
      )
      .filter((card) => Boolean(card.ctaUrl)),
    tabLimit,
  );
  const buySetIds = new Set(
    [...bestDeals, ...popularThisWeek, ...giftsUnder100].map(
      (card) => card.setId,
    ),
  );
  const smartToFollow = buildSmartToFollowCards({
    buySetIds,
    catalogSets: resolvedCatalogSets,
    currentOfferBySetId,
    tabLimit,
  });
  const biggestPriceDrops = buildBiggestPriceDropCards({
    buySetIds,
    catalogSetById,
    currentOfferBySetId,
    historyRowsBySetId,
    tabLimit,
  });
  const waitCanPayOff = buildWaitCanPayOffCards({
    buySetIds,
    catalogSetById,
    currentOfferBySetId,
    historyRowsBySetId,
    tabLimit,
  });
  const snapshot: HomepageCommerceSnapshot = {
    generatedAt,
    buyRail: {
      bestDeals: applyPresentationTitlesToHomepageCards({
        cards: bestDeals,
        catalogSetById: presentationCatalogSetById,
      }),
      popularThisWeek: applyPresentationTitlesToHomepageCards({
        cards: popularThisWeek,
        catalogSetById: presentationCatalogSetById,
      }),
      giftsUnder100: applyPresentationTitlesToHomepageCards({
        cards: giftsUnder100,
        catalogSetById: presentationCatalogSetById,
      }),
    },
    followRail: {
      smartToFollow: applyPresentationTitlesToHomepageCards({
        cards: smartToFollow,
        catalogSetById: presentationCatalogSetById,
      }),
      biggestPriceDrops: applyPresentationTitlesToHomepageCards({
        cards: biggestPriceDrops,
        catalogSetById: presentationCatalogSetById,
      }),
      waitCanPayOff: applyPresentationTitlesToHomepageCards({
        cards: waitCanPayOff,
        catalogSetById: presentationCatalogSetById,
      }),
    },
  };

  return {
    generatedAt,
    snapshot,
    summary: createSummary(snapshot),
  };
}

function toSnapshotRow(snapshot: HomepageCommerceSnapshot) {
  return {
    collection_slug: HOMEPAGE_COMMERCE_SNAPSHOT_COLLECTION_SLUG,
    generated_at: snapshot.generatedAt,
    items_json: snapshot,
    page: HOMEPAGE_COMMERCE_SNAPSHOT_PAGE,
    page_size: HOMEPAGE_COMMERCE_SNAPSHOT_PAGE_SIZE,
    snapshot_source: HOMEPAGE_COMMERCE_SNAPSHOT_SOURCE,
    sort_key: HOMEPAGE_COMMERCE_SNAPSHOT_SORT_KEY,
    source_version: snapshot.generatedAt,
    total_count: [
      ...snapshot.buyRail.bestDeals,
      ...snapshot.buyRail.popularThisWeek,
      ...snapshot.buyRail.giftsUnder100,
      ...snapshot.followRail.smartToFollow,
      ...snapshot.followRail.biggestPriceDrops,
      ...snapshot.followRail.waitCanPayOff,
    ].length,
  };
}

export async function upsertHomepageCommerceSnapshot({
  snapshot,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshot: HomepageCommerceSnapshot;
  supabaseClient?: HomepageCommerceSnapshotSupabaseClient;
}): Promise<number> {
  const { error } = await supabaseClient
    .from(COLLECTION_PAGE_SNAPSHOTS_TABLE)
    .upsert(toSnapshotRow(snapshot), {
      onConflict: 'collection_slug,sort_key,page,page_size',
    });

  if (error) {
    throw new Error('Unable to upsert homepage commerce snapshot.');
  }

  return 1;
}

export async function syncHomepageCommerceSnapshot({
  dryRun = true,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
  ...options
}: {
  buildCollectionPageSnapshotsFn?: typeof buildCollectionPageSnapshots;
  buildDealPageSnapshotsFn?: typeof buildDealPageSnapshots;
  catalogSets?: readonly CatalogCanonicalSet[];
  collectionSnapshots?: readonly CollectionPageSnapshot[];
  currentOfferRows?: readonly HomepageCurrentOfferSnapshotRow[];
  dealSnapshots?: readonly DealPageSnapshot[];
  dryRun?: boolean;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  popularitySnapshot?: CatalogPopularitySnapshot;
  priceHistoryRows?: readonly HomepagePriceHistoryRow[];
  supabaseClient?: HomepageCommerceSnapshotSupabaseClient;
  tabLimit?: number;
} = {}): Promise<HomepageCommerceSnapshotBuildResult> {
  const buildResult = await buildHomepageCommerceSnapshot({
    ...options,
    now,
    supabaseClient,
  });
  const snapshot =
    buildResult.snapshot ??
    createEmptyHomepageCommerceSnapshot(now.toISOString());
  const upsertedCount = dryRun
    ? 0
    : await upsertHomepageCommerceSnapshot({
        snapshot,
        supabaseClient,
      });

  return {
    ...buildResult,
    dryRun,
    snapshot,
    upsertedCount,
  };
}
