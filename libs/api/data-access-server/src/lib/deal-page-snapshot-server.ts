import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import { resolvePublicMerchantDisplayName } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichCatalogSetsWithPresentationTitles } from './catalog-presentation-title-server';

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
  | 'under-50'
  | 'best-price-per-brick'
  | 'largest-discount'
  | 'under-20'
  | 'premium-deals'
  | 'new-deals';

type DealPageSnapshotCategory =
  | 'recommended'
  | 'best-price-per-brick'
  | 'largest-discount'
  | 'under-20'
  | 'under-50'
  | 'premium-deals'
  | 'new-deals';

const dealPageSnapshotSortConfigs = [
  { category: 'recommended', sortKey: 'recommended' },
  { category: 'largest-discount', sortKey: 'discount-desc' },
  { category: 'best-price-per-brick', sortKey: 'price-per-brick' },
  { category: 'under-50', sortKey: 'under-50' },
  { category: 'best-price-per-brick', sortKey: 'best-price-per-brick' },
  { category: 'largest-discount', sortKey: 'largest-discount' },
  { category: 'under-20', sortKey: 'under-20' },
  { category: 'premium-deals', sortKey: 'premium-deals' },
  { category: 'new-deals', sortKey: 'new-deals' },
] as const satisfies readonly {
  category: DealPageSnapshotCategory;
  sortKey: DealPageSnapshotSortKey;
}[];

const dealPageSnapshotSortKeys: readonly DealPageSnapshotSortKey[] =
  dealPageSnapshotSortConfigs.map((config) => config.sortKey);

const POPULAR_THEME_SCORE_BY_NAME = new Map<string, number>([
  ['star wars', 100],
  ['icons', 94],
  ['harry potter', 88],
  ['technic', 84],
  ['ideas', 80],
  ['marvel', 76],
  ['speed champions', 72],
  ['botanicals', 70],
  ['architecture', 68],
  ['disney', 64],
  ['jurassic world', 62],
]);

const DISPLAY_THEME_NAMES = new Set([
  'architecture',
  'art',
  'botanicals',
  'icons',
  'ideas',
  'lord of the rings',
  'star wars',
]);

export interface DealPageSnapshotStats {
  activeDealCount: number;
  averageDiscountPercent?: number;
  averagePricePerBrickMinor?: number;
  highestDiscountPercent?: number;
  lowestPricePerBrickMinor?: number;
}

interface DealPageSnapshotItemsJson {
  items: readonly DealPageSnapshotCard[];
  stats: DealPageSnapshotStats;
}

const EMPTY_DEAL_PAGE_SNAPSHOT_STATS: DealPageSnapshotStats = {
  activeDealCount: 0,
};

const MIN_RECOMMENDED_PRICE_MINOR = 1_000;
const MIN_PRICE_PER_BRICK_BROWSE_PRICE_MINOR = 1_000;
const MIN_PRICE_PER_BRICK_BROWSE_PIECES = 200;
const MIN_UNDER_20_PIECES = 100;
const RECOMMENDED_PRICE_PER_BRICK_THRESHOLD_MINOR = 10;
const UNDER_20_PRICE_PER_BRICK_THRESHOLD_MINOR = 10;
const MIN_STRONG_SAVINGS_MINOR = 1_000;
const MAX_SAVINGS_SCORE_MINOR = 5_000;
const NEW_DEAL_OBSERVED_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const LOW_PRICE_RECOMMENDATION_ALLOWLIST_SET_IDS = new Set<string>();
const OTHER_THEME_DEAL_ALLOWLIST_SET_IDS = new Set<string>([
  '43020', // FIFA World Cup Official Trophy is a large display build.
]);

const MAGAZINE_OR_BOOK_TERMS = [
  'activity book',
  'book',
  'boek',
  'magazine',
  'tijdschrift',
];

const FOOTBALL_HIGHLIGHT_TERMS = [
  'football highlights',
  'soccer highlights',
  'voetbalhoogtepunten',
];

function getDealPageSnapshotCategory(
  sortKey: DealPageSnapshotSortKey,
): DealPageSnapshotCategory {
  return (
    dealPageSnapshotSortConfigs.find((config) => config.sortKey === sortKey)
      ?.category ?? 'recommended'
  );
}

function normalizeThemeName(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('nl-NL') ?? '';
}

function getCatalogSetThemeName({
  primaryTheme,
  publicTheme,
}: Pick<
  Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number],
  'primaryTheme' | 'publicTheme'
>): string {
  return publicTheme?.name ?? primaryTheme;
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: readonly number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function getCatalogSetNumberValue(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function getCatalogSetBaseNumber({
  setId,
  sourceSetNumber,
}: {
  setId: string;
  sourceSetNumber?: string;
}): string {
  return (
    getCatalogSetNumberValue(sourceSetNumber)?.split('-')[0] ??
    getCatalogSetNumberValue(setId) ??
    ''
  );
}

function normalizeDealName(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('nl-NL') ?? '';
}

function isCatalogSetPolybagLike({
  setId,
  sourceSetNumber,
}: {
  setId: string;
  sourceSetNumber?: string;
}): boolean {
  return /^30\d{3}$/.test(getCatalogSetBaseNumber({ setId, sourceSetNumber }));
}

function isCatalogSetPromotional({
  setId,
  sourceSetNumber,
}: {
  setId: string;
  sourceSetNumber?: string;
}): boolean {
  const baseNumber = getCatalogSetBaseNumber({ setId, sourceSetNumber });

  return /^30\d{3}$/.test(baseNumber) || /^40\d{3}$/.test(baseNumber);
}

function isCatalogSetMagazineOrBook({ name }: { name?: string }): boolean {
  const normalizedName = normalizeDealName(name);

  return MAGAZINE_OR_BOOK_TERMS.some((term) => normalizedName.includes(term));
}

function isCatalogSetFootballHighlight({ name }: { name?: string }): boolean {
  const normalizedName = normalizeDealName(name);

  return FOOTBALL_HIGHLIGHT_TERMS.some((term) => normalizedName.includes(term));
}

function isOtherThemeDealCard(card: DealPageSnapshotCard): boolean {
  return normalizeThemeName(card.publicTheme?.name ?? card.theme) === 'other';
}

function isPromotionalDealCard(card: DealPageSnapshotCard): boolean {
  return isCatalogSetPromotional({
    setId: card.id,
    sourceSetNumber: card.setNumber,
  });
}

function isPolybagDealCard(card: DealPageSnapshotCard): boolean {
  return isCatalogSetPolybagLike({
    setId: card.id,
    sourceSetNumber: card.setNumber,
  });
}

function isMagazineOrBookDealCard(card: DealPageSnapshotCard): boolean {
  return isCatalogSetMagazineOrBook({ name: card.name });
}

function isFootballHighlightDealCard(card: DealPageSnapshotCard): boolean {
  return isCatalogSetFootballHighlight({ name: card.name });
}

function hasStrongDealValueSignal(card: DealPageSnapshotCard): boolean {
  return (
    (card.discountPercent ?? 0) >= 10 ||
    (card.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) <=
      RECOMMENDED_PRICE_PER_BRICK_THRESHOLD_MINOR ||
    (card.savingsVsLegoMinor ?? 0) >= MIN_STRONG_SAVINGS_MINOR
  );
}

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
    merchantName?: string;
    merchantSlug?: string;
    primaryActionHref?: string;
    pricePositionLabel?: string;
    pricePositionTone?: 'info' | 'neutral' | 'positive' | 'warning';
    reviewedLabel: string;
  };
  pricePerBrickMinor?: number;
  recommendedDealScore: number;
  savingsVsLegoMinor?: number;
  setNumber: string;
  snapshotObservedAt?: string;
}

export interface DealPageSnapshot {
  generatedAt: string;
  items: readonly DealPageSnapshotCard[];
  page: number;
  pageSize: number;
  sortKey: DealPageSnapshotSortKey;
  sourceVersion?: string;
  stats: DealPageSnapshotStats;
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
        stats: DealPageSnapshotStats;
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
  now,
}: {
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  now: Date;
  snapshot: DealPageCurrentOfferRow;
}): {
  dealScore: number;
  discountPercent?: number;
  legoReferencePriceMinor?: number;
  pricePerBrickMinor?: number;
  recommendedDealScore: number;
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
  const pieces = catalogSet.pieceCount;
  const pricePerBrickMinor =
    pieces > 0 ? Math.round(bestPriceMinor / pieces) : undefined;
  const themeName = normalizeThemeName(getCatalogSetThemeName(catalogSet));
  const themePopularityScore = POPULAR_THEME_SCORE_BY_NAME.get(themeName) ?? 48;
  const releaseAge =
    typeof catalogSet.releaseYear === 'number'
      ? Math.max(0, now.getFullYear() - catalogSet.releaseYear)
      : 4;
  const setPopularityScore = clampScore(
    (pieces >= 2000 ? 30 : pieces >= 1000 ? 22 : pieces >= 500 ? 14 : 8) +
      (releaseAge <= 1 ? 22 : releaseAge <= 3 ? 14 : releaseAge <= 6 ? 8 : 4) +
      themePopularityScore * 0.4,
  );
  const adultDisplayScore = clampScore(
    (DISPLAY_THEME_NAMES.has(themeName) ? 58 : 22) +
      (pieces >= 1500 ? 28 : pieces >= 800 ? 18 : 8),
  );
  const pricePerBrickScore =
    typeof pricePerBrickMinor === 'number'
      ? clampScore(100 - pricePerBrickMinor * 5)
      : 0;
  const currentPriceAttractivenessScore = clampScore(
    (bestPriceMinor <= 2_000
      ? 92
      : bestPriceMinor <= 5_000
        ? 78
        : bestPriceMinor <= 10_000
          ? 58
          : bestPriceMinor <= 20_000
            ? 42
            : 28) *
      0.6 +
      pricePerBrickScore * 0.4,
  );
  const availabilityConfidenceScore = clampScore(
    (snapshot.trusted_offer_count ?? 0) * 24 +
      (snapshot.comparable_offer_count ?? 0) * 12 +
      (snapshot.offer_count ?? 0) * 6 +
      (snapshot.best_availability === 'in_stock' ? 20 : 0),
  );
  const cappedSavingsVsLegoMinor =
    typeof savingsVsLegoMinor === 'number'
      ? Math.min(savingsVsLegoMinor, MAX_SAVINGS_SCORE_MINOR)
      : 0;
  const discountScore = clampScore(
    (discountPercent ?? 0) * 2.2 + (cappedSavingsVsLegoMinor / 100) * 0.45,
  );
  const qualityPenaltyScore =
    (themeName === 'duplo' ? 80 : 0) +
    (themeName === 'other' ? 70 : 0) +
    (isCatalogSetPromotional({
      setId: catalogSet.setId,
      sourceSetNumber: catalogSet.sourceSetNumber,
    })
      ? 110
      : 0) +
    (isCatalogSetFootballHighlight({ name: catalogSet.name }) ? 120 : 0);

  /*
   * recommendedDealScore is deterministic snapshot data, not request-time commerce.
   * Formula: discount strength (35%) + price-per-brick value (20%) +
   * set/theme popularity (15%) + adult display value (10%) + current price
   * attractiveness (10%) + availability confidence (10%), minus product
   * quality penalties for weak deal surfaces such as Duplo, Other,
   * promotional items and football highlight sets. Savings contribution is
   * capped so high absolute-price sets cannot dominate on euro savings alone.
   */
  const recommendedDealScore = Math.max(
    0,
    Math.round(
      discountScore * 3.5 +
        pricePerBrickScore * 2 +
        setPopularityScore * 0.9 +
        themePopularityScore * 0.6 +
        adultDisplayScore +
        currentPriceAttractivenessScore +
        availabilityConfidenceScore -
        qualityPenaltyScore,
    ),
  );
  const dealScore = recommendedDealScore;

  return {
    dealScore,
    ...(typeof discountPercent === 'number' ? { discountPercent } : {}),
    ...(typeof legoReferencePriceMinor === 'number'
      ? { legoReferencePriceMinor }
      : {}),
    ...(typeof pricePerBrickMinor === 'number' ? { pricePerBrickMinor } : {}),
    recommendedDealScore,
    ...(typeof savingsVsLegoMinor === 'number' ? { savingsVsLegoMinor } : {}),
  };
}

function toDealSnapshotCard({
  catalogSet,
  now,
  snapshot,
}: {
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  now: Date;
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

  const metrics = getDealMetrics({ catalogSet, now, snapshot });
  const discountMetric =
    typeof metrics.savingsVsLegoMinor === 'number'
      ? `${formatPrice(metrics.savingsVsLegoMinor)} goedkoper dan LEGO`
      : undefined;
  const pricePerBrickLabel =
    typeof metrics.pricePerBrickMinor === 'number'
      ? `${metrics.pricePerBrickMinor} cent per steen`
      : undefined;
  const merchantName = resolvePublicMerchantDisplayName({
    merchantName: snapshot.best_merchant_name,
    merchantSlug: snapshot.best_merchant_slug ?? undefined,
  });

  return {
    ...(catalogSet.catalogName ? { catalogName: catalogSet.catalogName } : {}),
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
    displayTitle: catalogSet.displayTitle ?? catalogSet.name,
    ...(catalogSet.displayTitleSource
      ? { displayTitleSource: catalogSet.displayTitleSource }
      : {}),
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
      decisionNote: `Laagst bij ${merchantName}`,
      merchantLabel: `Laagst bij ${merchantName}`,
      merchantName,
      ...(snapshot.best_merchant_slug
        ? { merchantSlug: snapshot.best_merchant_slug }
        : {}),
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
    recommendedDealScore: metrics.recommendedDealScore,
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
    ...((snapshot.best_checked_at ?? snapshot.computed_at)
      ? {
          snapshotObservedAt:
            snapshot.best_checked_at ?? snapshot.computed_at ?? undefined,
        }
      : {}),
    theme: catalogSet.primaryTheme,
    ...(catalogSet.publicTheme ? { publicTheme: catalogSet.publicTheme } : {}),
  };
}

function withSortSpecificPriceContext(
  card: DealPageSnapshotCard,
  sortKey: DealPageSnapshotSortKey,
): DealPageSnapshotCard {
  const category = getDealPageSnapshotCategory(sortKey);

  if (category === 'best-price-per-brick') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Prijs per steen',
        pricePositionLabel: card.priceContext.dealReason ?? 'Prijs per steen',
      },
    };
  }

  if (category === 'under-20') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Onder €20',
        pricePositionLabel:
          typeof card.discountPercent === 'number'
            ? card.priceContext.pricePositionLabel
            : 'Onder €20',
      },
    };
  }

  if (category === 'under-50') {
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

  if (category === 'premium-deals') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Premium deal',
        pricePositionLabel:
          typeof card.discountPercent === 'number'
            ? card.priceContext.pricePositionLabel
            : 'Sterke prijs',
      },
    };
  }

  if (category === 'new-deals') {
    return {
      ...card,
      priceContext: {
        ...card.priceContext,
        decisionLabel: 'Nieuwe deal',
      },
    };
  }

  if (category === 'largest-discount') {
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
    const category = getDealPageSnapshotCategory(sortKey);

    if (category === 'largest-discount') {
      return (
        (right.discountPercent ?? 0) - (left.discountPercent ?? 0) ||
        (right.savingsVsLegoMinor ?? 0) - (left.savingsVsLegoMinor ?? 0) ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    if (category === 'best-price-per-brick') {
      return (
        (left.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) -
          (right.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) ||
        right.recommendedDealScore - left.recommendedDealScore ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    if (category === 'under-20' || category === 'under-50') {
      return (
        right.recommendedDealScore - left.recommendedDealScore ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    if (category === 'new-deals') {
      return (
        (parseTimestamp(right.snapshotObservedAt) ?? 0) -
          (parseTimestamp(left.snapshotObservedAt) ?? 0) ||
        right.recommendedDealScore - left.recommendedDealScore ||
        left.bestPriceMinor - right.bestPriceMinor ||
        left.name.localeCompare(right.name, 'nl')
      );
    }

    return (
      right.recommendedDealScore - left.recommendedDealScore ||
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
  const category = getDealPageSnapshotCategory(sortKey);

  if (category === 'largest-discount') {
    return cards.filter(
      (card) =>
        typeof card.savingsVsLegoMinor === 'number' &&
        card.savingsVsLegoMinor > 0 &&
        typeof card.discountPercent === 'number' &&
        card.discountPercent > 0,
    );
  }

  if (category === 'best-price-per-brick') {
    return cards.filter(
      (card) =>
        typeof card.pricePerBrickMinor === 'number' &&
        card.pricePerBrickMinor > 0 &&
        card.pieces >= MIN_PRICE_PER_BRICK_BROWSE_PIECES &&
        card.bestPriceMinor >= MIN_PRICE_PER_BRICK_BROWSE_PRICE_MINOR &&
        !isPolybagDealCard(card) &&
        !isPromotionalDealCard(card) &&
        !isMagazineOrBookDealCard(card) &&
        (!isOtherThemeDealCard(card) ||
          OTHER_THEME_DEAL_ALLOWLIST_SET_IDS.has(card.id)),
    );
  }

  if (category === 'under-20') {
    return cards.filter(
      (card) =>
        card.bestPriceMinor < 2_000 &&
        card.pieces >= MIN_UNDER_20_PIECES &&
        ((card.discountPercent ?? 0) >= 10 ||
          (card.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) <=
            UNDER_20_PRICE_PER_BRICK_THRESHOLD_MINOR),
    );
  }

  if (category === 'under-50') {
    return cards.filter((card) => card.bestPriceMinor < 5_000);
  }

  if (category === 'premium-deals') {
    return cards.filter(
      (card) =>
        card.bestPriceMinor > 10_000 &&
        ((card.discountPercent ?? 0) >= 10 ||
          (card.savingsVsLegoMinor ?? 0) >= 3_000 ||
          (card.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) <= 8),
    );
  }

  if (category === 'new-deals') {
    const latestObservedAt = cards.reduce(
      (latest, card) =>
        Math.max(latest, parseTimestamp(card.snapshotObservedAt) ?? 0),
      0,
    );

    return cards.filter((card) => {
      const observedAt = parseTimestamp(card.snapshotObservedAt);

      return (
        typeof observedAt === 'number' &&
        latestObservedAt - observedAt <= NEW_DEAL_OBSERVED_MAX_AGE_MS &&
        ((card.discountPercent ?? 0) >= 10 ||
          card.recommendedDealScore >= 220 ||
          (card.pricePerBrickMinor ?? Number.MAX_SAFE_INTEGER) <= 10)
      );
    });
  }

  return cards.filter(
    (card) =>
      card.pieces > 0 &&
      (card.bestPriceMinor >= MIN_RECOMMENDED_PRICE_MINOR ||
        LOW_PRICE_RECOMMENDATION_ALLOWLIST_SET_IDS.has(card.id)) &&
      hasStrongDealValueSignal(card) &&
      !isPromotionalDealCard(card) &&
      !isFootballHighlightDealCard(card),
  );
}

function buildDealPageSnapshotStats(
  cards: readonly DealPageSnapshotCard[],
): DealPageSnapshotStats {
  if (cards.length === 0) {
    return EMPTY_DEAL_PAGE_SNAPSHOT_STATS;
  }

  const discountPercents = cards.flatMap((card) =>
    typeof card.discountPercent === 'number' ? [card.discountPercent] : [],
  );
  const pricePerBrickValues = cards.flatMap((card) =>
    typeof card.pricePerBrickMinor === 'number'
      ? [card.pricePerBrickMinor]
      : [],
  );
  const highestDiscountPercent =
    discountPercents.length > 0 ? Math.max(...discountPercents) : undefined;
  const lowestPricePerBrickMinor =
    pricePerBrickValues.length > 0
      ? Math.min(...pricePerBrickValues)
      : undefined;
  const averageDiscountPercent = average(discountPercents);
  const averagePricePerBrickMinor = average(pricePerBrickValues);

  return {
    activeDealCount: cards.length,
    ...(typeof averageDiscountPercent === 'number'
      ? { averageDiscountPercent }
      : {}),
    ...(typeof averagePricePerBrickMinor === 'number'
      ? { averagePricePerBrickMinor }
      : {}),
    ...(typeof highestDiscountPercent === 'number'
      ? { highestDiscountPercent }
      : {}),
    ...(typeof lowestPricePerBrickMinor === 'number'
      ? { lowestPricePerBrickMinor }
      : {}),
  };
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
  const [rawCatalogSets, offerSnapshotResult] = await Promise.all([
    listCanonicalCatalogSetsFn({ includeInactive: false, supabaseClient }),
    listDealCurrentOfferSnapshots({ supabaseClient }),
  ]);
  const catalogSets = await enrichCatalogSetsWithPresentationTitles({
    catalogSets: rawCatalogSets,
    supabaseClient,
  });
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

    const card = toDealSnapshotCard({ catalogSet, now, snapshot });

    return card ? [card] : [];
  });
  const snapshots: DealPageSnapshot[] = [];
  const summaryBySortKey: Record<
    string,
    {
      itemsBuilt: number;
      pageCount: number;
      stats: DealPageSnapshotStats;
      totalCount: number;
    }
  > = {};

  for (const sortKey of dealPageSnapshotSortKeys) {
    const sortedCandidates = filterDealCardsForSort(candidates, sortKey)
      .sort(compareDealCards(sortKey))
      .map((card) => withSortSpecificPriceContext(card, sortKey));
    const stats = buildDealPageSnapshotStats(sortedCandidates);
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
        stats,
        totalCount: sortedCandidates.length,
      });
    });

    summaryBySortKey[sortKey] = {
      itemsBuilt: sortedCandidates.length,
      pageCount: Math.max(1, Math.ceil(sortedCandidates.length / pageSize)),
      stats,
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
    items_json: {
      items: snapshot.items,
      stats: snapshot.stats,
    } satisfies DealPageSnapshotItemsJson,
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
