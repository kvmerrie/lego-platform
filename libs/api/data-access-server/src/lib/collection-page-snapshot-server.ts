import { catalogSetOverlays } from '@lego-platform/catalog/data-access';
import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  catalogCollectionPageSnapshotSlugs,
  getCatalogCollectionLandingPageConfig,
  getCanonicalCatalogSetId,
  isCatalogCollectionPageSnapshotSlug,
  type CollectionCommerceCard,
  type CollectionCommerceIntent,
  type CatalogCollectionLandingPageSortKey,
  type CatalogCollectionPageSnapshotSlug,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import { resolvePublicMerchantDisplayName } from '@lego-platform/shared/config';
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
  comparable_offer_count?: number | null;
  computed_at: string | null;
  next_best_price_minor?: number | null;
  offer_count: number | null;
  price_spread_minor?: number | null;
  set_id: string;
  trusted_offer_count?: number | null;
}

export interface CollectionPageSnapshotCard extends CatalogHomepageSetCard {
  adultCollectorScore?: number;
  effectivePieces?: number;
  bestPriceMinor?: number;
  commerce?: CollectionCommerceCard;
  priceContext?: {
    commerceIntent?: CollectionCommerceIntent;
    confidenceLabel?: string;
    coverageLabel: string;
    currentPrice: string;
    currentPriceMinor?: number;
    dealLabel?: string;
    merchantLabel: string;
    merchantName?: string;
    merchantSlug?: string;
    primaryActionHref?: string;
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

function readMetadataStringArray(
  metadataJson: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const value = metadataJson?.[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseDateTimestamp(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return undefined;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeScoringText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function includesScoringText({
  haystack,
  needle,
}: {
  haystack: string;
  needle: string;
}): boolean {
  return haystack.includes(needle.toLowerCase());
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
        'set_id, best_price_minor, best_merchant_name, best_merchant_slug, best_availability, best_product_url, best_checked_at, offer_count, computed_at, trusted_offer_count, comparable_offer_count, next_best_price_minor, price_spread_minor',
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

function isActionableCurrentOffer(
  priceSnapshot: CommerceCurrentOfferSnapshotRow | undefined,
): priceSnapshot is CommerceCurrentOfferSnapshotRow & {
  best_price_minor: number;
  best_product_url: string;
} {
  return (
    priceSnapshot !== undefined &&
    typeof priceSnapshot.best_price_minor === 'number' &&
    priceSnapshot.best_price_minor > 0 &&
    typeof priceSnapshot.best_product_url === 'string' &&
    priceSnapshot.best_product_url.trim().length > 0 &&
    (priceSnapshot.best_availability === 'in_stock' ||
      priceSnapshot.best_availability === 'limited')
  );
}

function getCollectionDefaultCommerceIntent(
  collectionSlug: CatalogCollectionPageSnapshotSlug,
): CollectionCommerceIntent {
  switch (collectionSlug) {
    case 'lego-sets-onder-50-euro':
    case 'lego-sets-onder-100-euro':
    case 'retiring-lego-sets':
      return 'merchant';
    case 'lego-voor-volwassenen':
    case 'nieuwe-lego-sets':
      return 'setdetail';
  }
}

function getCollectionCommerceIntent({
  collectionSlug,
  priceSnapshot,
}: {
  collectionSlug: CatalogCollectionPageSnapshotSlug;
  priceSnapshot?: CommerceCurrentOfferSnapshotRow;
}): CollectionCommerceIntent {
  if (!priceSnapshot || !isActionableCurrentOffer(priceSnapshot)) {
    return 'follow';
  }

  return getCollectionDefaultCommerceIntent(collectionSlug);
}

function getPublicMerchantName(
  priceSnapshot: CommerceCurrentOfferSnapshotRow,
): string | undefined {
  if (!priceSnapshot.best_merchant_name) {
    return undefined;
  }

  return resolvePublicMerchantDisplayName({
    merchantName: priceSnapshot.best_merchant_name,
    merchantSlug: priceSnapshot.best_merchant_slug ?? undefined,
  });
}

function getPriceSpreadMinor(
  priceSnapshot: CommerceCurrentOfferSnapshotRow,
): number {
  if (
    typeof priceSnapshot.price_spread_minor === 'number' &&
    priceSnapshot.price_spread_minor > 0
  ) {
    return priceSnapshot.price_spread_minor;
  }

  if (
    typeof priceSnapshot.best_price_minor === 'number' &&
    typeof priceSnapshot.next_best_price_minor === 'number' &&
    priceSnapshot.next_best_price_minor > priceSnapshot.best_price_minor
  ) {
    return priceSnapshot.next_best_price_minor - priceSnapshot.best_price_minor;
  }

  return 0;
}

function getCollectionDealLabel(
  priceSnapshot: CommerceCurrentOfferSnapshotRow,
): string {
  const spreadMinor = getPriceSpreadMinor(priceSnapshot);

  if (
    spreadMinor >= 2_500 &&
    (priceSnapshot.comparable_offer_count ?? 0) >= 2
  ) {
    return 'Sterke deal';
  }

  if (spreadMinor >= 500) {
    return 'Beste marktprijs';
  }

  return 'Beste prijs';
}

function getCollectionConfidenceLabel(
  priceSnapshot: CommerceCurrentOfferSnapshotRow,
): string | undefined {
  const offerCount = priceSnapshot.offer_count ?? 0;

  if (offerCount <= 0) {
    return undefined;
  }

  return `${offerCount} vergeleken winkel${offerCount === 1 ? '' : 's'}`;
}

function toCollectionCommerceCard({
  collectionSlug,
  priceSnapshot,
  setId,
  slug,
}: {
  collectionSlug: CatalogCollectionPageSnapshotSlug;
  priceSnapshot?: CommerceCurrentOfferSnapshotRow;
  setId: string;
  slug: string;
}): CollectionCommerceCard | undefined {
  const bestPriceMinor = priceSnapshot?.best_price_minor;

  if (typeof bestPriceMinor !== 'number' || bestPriceMinor <= 0) {
    return undefined;
  }

  const merchantName = getPublicMerchantName(priceSnapshot);
  const commerceIntent = getCollectionCommerceIntent({
    collectionSlug,
    priceSnapshot,
  });
  const confidenceLabel = getCollectionConfidenceLabel(priceSnapshot);

  return {
    setId,
    slug,
    currentPriceMinor: bestPriceMinor,
    ...(merchantName ? { merchantName } : {}),
    ...(priceSnapshot.best_merchant_slug
      ? { merchantSlug: priceSnapshot.best_merchant_slug }
      : {}),
    dealLabel: getCollectionDealLabel(priceSnapshot),
    ...(confidenceLabel ? { confidenceLabel } : {}),
    ...(isActionableCurrentOffer(priceSnapshot)
      ? { primaryActionHref: priceSnapshot.best_product_url }
      : {}),
    commerceIntent,
    ...(commerceIntent === 'follow' ? { followRecommended: true } : {}),
  };
}

function toSnapshotCard({
  bricksetMetadata,
  catalogSet,
  recommendedAge,
  priceSnapshot,
  rakutenMetadata,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  catalogSet: Awaited<ReturnType<typeof listCanonicalCatalogSets>>[number];
  recommendedAge?: number;
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
          bestPriceMinor,
          priceContext: {
            coverageLabel: 'Actuele prijs gevonden',
            currentPrice: `Vanaf ${formatPrice(bestPriceMinor)}`,
            currentPriceMinor: bestPriceMinor,
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
    ...(recommendedAge ? { recommendedAge } : {}),
    ...(catalogSet.secondaryLabels
      ? {
          secondaryLabels: catalogSet.secondaryLabels,
        }
      : {}),
    setNumber: catalogSet.sourceSetNumber ?? catalogSet.setId,
    slug: catalogSet.slug,
    theme: catalogSet.primaryTheme,
    ...(catalogSet.publicTheme ? { publicTheme: catalogSet.publicTheme } : {}),
  };
}

function withCollectionCommerce({
  card,
  collectionSlug,
  priceSnapshot,
}: {
  card: CollectionPageSnapshotCard;
  collectionSlug: CatalogCollectionPageSnapshotSlug;
  priceSnapshot?: CommerceCurrentOfferSnapshotRow;
}): CollectionPageSnapshotCard {
  const commerce = toCollectionCommerceCard({
    collectionSlug,
    priceSnapshot,
    setId: card.id,
    slug: card.slug,
  });

  if (!commerce) {
    return card;
  }

  return {
    ...card,
    commerce,
    priceContext: {
      ...(card.priceContext ?? {
        coverageLabel: 'Actuele prijs gevonden',
        currentPrice: `Vanaf ${formatPrice(commerce.currentPriceMinor ?? 0)}`,
        merchantLabel: commerce.merchantName
          ? `Laagst bij ${commerce.merchantName}`
          : 'Laagste bekende prijs',
      }),
      commerceIntent: commerce.commerceIntent,
      ...(commerce.confidenceLabel
        ? { confidenceLabel: commerce.confidenceLabel }
        : {}),
      currentPriceMinor: commerce.currentPriceMinor,
      ...(commerce.dealLabel ? { dealLabel: commerce.dealLabel } : {}),
      ...(commerce.merchantName ? { merchantName: commerce.merchantName } : {}),
      ...(commerce.merchantSlug ? { merchantSlug: commerce.merchantSlug } : {}),
      ...(commerce.primaryActionHref
        ? { primaryActionHref: commerce.primaryActionHref }
        : {}),
    },
  };
}

function scoreAdultCollectorCandidate({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): number {
  const tags = readMetadataStringArray(bricksetMetadata?.metadata_json, 'tags');
  const normalizedTags = tags.map(normalizeScoringText);
  const theme = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'theme') ??
      setCard.theme,
  );
  const themeGroup = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'themeGroup'),
  );
  const subtheme = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'subtheme'),
  );
  const setName = normalizeScoringText(setCard.name);
  const searchableText = [
    theme,
    themeGroup,
    subtheme,
    setName,
    ...normalizedTags,
  ]
    .filter(Boolean)
    .join(' ');
  let score = 0;

  if ((setCard.recommendedAge ?? 0) >= 18) {
    score += 100;
  }

  for (const adultTag of [
    '18 plus',
    '18+',
    'd2c',
    'display stand',
    'real place',
    'landmarks',
    'art',
    'architecture',
    'botanical',
    'vehicle',
  ]) {
    if (normalizedTags.some((tag) => tag === adultTag)) {
      score += adultTag === '18 plus' || adultTag === '18+' ? 70 : 18;
    }
  }

  if (['icons', 'architecture', 'art', 'ideas'].includes(theme)) {
    score += 55;
  }

  if (theme === 'botanicals' || subtheme === 'botanical collection') {
    score += 55;
  }

  if (themeGroup === 'model making') {
    score += 45;
  }

  if (
    theme === 'star wars' &&
    (includesScoringText({
      haystack: subtheme,
      needle: 'ultimate collector',
    }) ||
      includesScoringText({ haystack: subtheme, needle: 'ucs' }) ||
      includesScoringText({ haystack: searchableText, needle: 'display' }))
  ) {
    score += 45;
  }

  const pieces = setCard.effectivePieces ?? setCard.pieces;

  if (pieces >= 2_000) {
    score += 12;
  } else if (pieces >= 1_000) {
    score += 8;
  } else if (pieces >= 500) {
    score += 3;
  }

  return score;
}

function getAdultCollectorTextSignals({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): {
  normalizedTags: string[];
  searchableText: string;
  subtheme: string;
  theme: string;
  themeGroup: string;
} {
  const normalizedTags = readMetadataStringArray(
    bricksetMetadata?.metadata_json,
    'tags',
  ).map(normalizeScoringText);
  const theme = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'theme') ??
      setCard.theme,
  );
  const themeGroup = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'themeGroup'),
  );
  const subtheme = normalizeScoringText(
    readMetadataString(bricksetMetadata?.metadata_json, 'subtheme'),
  );
  const setName = normalizeScoringText(setCard.name);
  const searchableText = [
    theme,
    themeGroup,
    subtheme,
    setName,
    ...normalizedTags,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    normalizedTags,
    searchableText,
    subtheme,
    theme,
    themeGroup,
  };
}

function hasStrongAdultCollectorSignal({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  const normalizedTags = readMetadataStringArray(
    bricksetMetadata?.metadata_json,
    'tags',
  ).map(normalizeScoringText);

  return (
    (setCard.recommendedAge ?? 0) >= 18 ||
    normalizedTags.includes('18 plus') ||
    normalizedTags.includes('18+')
  );
}

function isExplicitAdultCollectorCategory({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  const { normalizedTags, searchableText, subtheme, theme, themeGroup } =
    getAdultCollectorTextSignals({ bricksetMetadata, setCard });

  return (
    hasStrongAdultCollectorSignal({ bricksetMetadata, setCard }) ||
    ['icons', 'architecture', 'art', 'ideas'].includes(theme) ||
    theme === 'botanicals' ||
    theme === 'lord of the rings' ||
    subtheme === 'botanical collection' ||
    includesScoringText({ haystack: subtheme, needle: 'modular buildings' }) ||
    themeGroup === 'model making' ||
    (theme === 'star wars' &&
      (includesScoringText({
        haystack: subtheme,
        needle: 'ultimate collector',
      }) ||
        includesScoringText({ haystack: subtheme, needle: 'ucs' }) ||
        includesScoringText({
          haystack: searchableText,
          needle: 'display',
        }))) ||
    (normalizedTags.includes('vehicle') &&
      (includesScoringText({ haystack: searchableText, needle: 'display' }) ||
        themeGroup === 'model making'))
  );
}

function isAdultCollectorNoveltyOrImpulseCandidate({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  const { normalizedTags, searchableText, theme } =
    getAdultCollectorTextSignals({
      bricksetMetadata,
      setCard,
    });
  const pieces = setCard.effectivePieces ?? setCard.pieces;

  return (
    theme === 'seasonal' ||
    normalizedTags.some((tag) =>
      ['polybag', 'promotional', 'gift with purchase', 'gwp'].includes(tag),
    ) ||
    includesScoringText({ haystack: searchableText, needle: 'birthday' }) ||
    includesScoringText({ haystack: searchableText, needle: 'easter' }) ||
    includesScoringText({ haystack: searchableText, needle: 'holiday' }) ||
    includesScoringText({ haystack: searchableText, needle: 'christmas' }) ||
    includesScoringText({
      haystack: searchableText,
      needle: 'snow adventure',
    }) ||
    (theme === 'creator 3-in-1' &&
      pieces < 500 &&
      (includesScoringText({ haystack: searchableText, needle: 'animal' }) ||
        includesScoringText({ haystack: searchableText, needle: 'bunny' }) ||
        includesScoringText({ haystack: searchableText, needle: 'bear' }) ||
        includesScoringText({ haystack: searchableText, needle: 'cat' }) ||
        includesScoringText({ haystack: searchableText, needle: 'dog' })))
  );
}

function isObviousKidsOrPreschoolCandidate({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  const fields = [
    setCard.theme,
    setCard.name,
    readMetadataString(bricksetMetadata?.metadata_json, 'theme'),
    readMetadataString(bricksetMetadata?.metadata_json, 'themeGroup'),
    readMetadataString(bricksetMetadata?.metadata_json, 'subtheme'),
    ...readMetadataStringArray(bricksetMetadata?.metadata_json, 'tags'),
  ]
    .map(normalizeScoringText)
    .join(' ');

  return (
    includesScoringText({ haystack: fields, needle: 'duplo' }) ||
    includesScoringText({ haystack: fields, needle: 'juniors' }) ||
    includesScoringText({ haystack: fields, needle: 'spidey' }) ||
    includesScoringText({ haystack: fields, needle: '4+' })
  );
}

function isAdultCollectorCandidate({
  bricksetMetadata,
  setCard,
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
  setCard: CollectionPageSnapshotCard;
}): boolean {
  const score = scoreAdultCollectorCandidate({ bricksetMetadata, setCard });
  const explicitAdultCategory = isExplicitAdultCollectorCategory({
    bricksetMetadata,
    setCard,
  });
  const effectivePieces = setCard.effectivePieces ?? setCard.pieces;

  if (
    isAdultCollectorNoveltyOrImpulseCandidate({ bricksetMetadata, setCard })
  ) {
    return false;
  }

  if (
    !explicitAdultCategory &&
    (effectivePieces < 250 ||
      (typeof setCard.bestPriceMinor === 'number' &&
        setCard.bestPriceMinor > 0 &&
        setCard.bestPriceMinor < 2_000))
  ) {
    return false;
  }

  if (!explicitAdultCategory && score < 80) {
    return false;
  }

  return (
    !isObviousKidsOrPreschoolCandidate({ bricksetMetadata, setCard }) ||
    hasStrongAdultCollectorSignal({ bricksetMetadata, setCard })
  );
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
}: {
  bricksetMetadata?: CatalogSetSourceMetadataRow;
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
        }) -
          getRetiringSortTimestamp({
            bricksetMetadata: bricksetBySetId.get(right.id),
          }) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (collectionSlug === 'lego-voor-volwassenen') {
      return (
        (right.adultCollectorScore ?? 0) - (left.adultCollectorScore ?? 0) ||
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
  const overlayRecommendedAgeBySetId = new Map(
    catalogSetOverlays.flatMap((overlay) =>
      overlay.recommendedAge
        ? [
            [
              getCanonicalCatalogSetId(overlay.canonicalId),
              overlay.recommendedAge,
            ],
          ]
        : [],
    ),
  );
  const cards = activeCatalogSets.map((catalogSet) =>
    toSnapshotCard({
      bricksetMetadata: sourceMetadata.bricksetBySetId.get(catalogSet.setId),
      catalogSet,
      priceSnapshot: priceSnapshots.get(catalogSet.setId),
      rakutenMetadata: sourceMetadata.rakutenBySetId.get(catalogSet.setId),
      recommendedAge: overlayRecommendedAgeBySetId.get(catalogSet.setId),
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

    if (
      collectionSlug === 'lego-sets-onder-50-euro' ||
      collectionSlug === 'lego-sets-onder-100-euro'
    ) {
      const maxBestPriceMinor =
        collectionSlug === 'lego-sets-onder-50-euro' ? 5_000 : 10_000;

      candidates = cards.filter((card) => {
        const priceSnapshot = priceSnapshots.get(card.id);
        const priceMinor = priceSnapshot?.best_price_minor;

        if (!priceSnapshot) {
          missingPriceSnapshotCount += 1;
        }

        return (
          typeof priceMinor === 'number' &&
          priceMinor > 0 &&
          priceMinor <= maxBestPriceMinor &&
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

    if (collectionSlug === 'lego-voor-volwassenen') {
      candidates = cards
        .map((card) => ({
          ...card,
          adultCollectorScore: scoreAdultCollectorCandidate({
            bricksetMetadata: sourceMetadata.bricksetBySetId.get(card.id),
            setCard: card,
          }),
        }))
        .filter((card) =>
          isAdultCollectorCandidate({
            bricksetMetadata: sourceMetadata.bricksetBySetId.get(card.id),
            setCard: card,
          }),
        );
    }

    const bricksetMetadataUsedCount = candidates.filter((card) =>
      sourceMetadata.bricksetBySetId.has(card.id),
    ).length;
    const commerceCandidates = candidates.map((card) =>
      withCollectionCommerce({
        card,
        collectionSlug,
        priceSnapshot: priceSnapshots.get(card.id),
      }),
    );

    for (const sortKey of config.sort.options) {
      const sortedCandidates = [...commerceCandidates].sort(
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
