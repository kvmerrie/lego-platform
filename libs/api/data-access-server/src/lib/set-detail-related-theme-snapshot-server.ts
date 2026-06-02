import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  buildCatalogThemeSlug,
  getCanonicalCatalogSetId,
  type CatalogCanonicalSet,
} from '@lego-platform/catalog/util';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COLLECTION_PAGE_SNAPSHOTS_TABLE } from './collection-page-snapshot-server';

const SET_DETAIL_RELATED_THEME_SNAPSHOT_SOURCE =
  'set_detail_related_theme_snapshot_sync';
const SET_DETAIL_RELATED_THEME_SNAPSHOT_SORT_KEY = 'same-theme';
const SET_DETAIL_RELATED_THEME_SNAPSHOT_PAGE = 1;
export const SET_DETAIL_RELATED_THEME_SNAPSHOT_PAGE_SIZE = 20;

type SetDetailRelatedThemeSnapshotSupabaseClient = Pick<
  SupabaseClient,
  'from' | 'rpc'
>;

export interface CommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_merchant_name: string | null;
  best_price_minor: number | null;
  computed_at: string | null;
  set_id: string;
}

export interface SetDetailRelatedThemeSnapshotCard {
  id: string;
  slug: string;
  name: string;
  publicTheme?: CatalogCanonicalSet['publicTheme'];
  theme: string;
  secondaryLabels?: readonly string[];
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogCanonicalSet['releaseDatePrecision'];
  pieces: number;
  imageUrl?: string;
  images?: CatalogCanonicalSet['images'];
  primaryImage?: string;
  priceContext?: {
    coverageLabel: string;
    currentPrice: string;
    merchantLabel: string;
    reviewedLabel: string;
  };
}

export interface SetDetailRelatedThemeSnapshot {
  generatedAt: string;
  items: readonly SetDetailRelatedThemeSnapshotCard[];
  page: number;
  pageSize: number;
  setId: string;
  snapshotSlug: string;
  totalCount: number;
}

export interface SetDetailRelatedThemeSnapshotBuildResult {
  dryRun: boolean;
  generatedAt: string;
  snapshots: readonly SetDetailRelatedThemeSnapshot[];
  summary: {
    setCount: number;
    snapshotCount: number;
    snapshotWithItemsCount: number;
  };
  upsertedCount: number;
}

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

export function buildSetDetailRelatedThemeSnapshotSlug(setId: string): string {
  return `set-detail-related-theme:${getCanonicalCatalogSetId(setId)}`;
}

function formatCheckedOn(value: string): string {
  const checkedAt = new Date(value);

  if (Number.isNaN(checkedAt.getTime())) {
    return 'snapshot';
  }

  return checkedAt.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });
}

function toSnapshotCard({
  priceSnapshot,
  set,
}: {
  priceSnapshot?: CommerceCurrentOfferSnapshotRow;
  set: CatalogCanonicalSet;
}): SetDetailRelatedThemeSnapshotCard {
  const priceMinor = priceSnapshot?.best_price_minor;
  const priceContext =
    typeof priceMinor === 'number' && priceMinor > 0
      ? {
          coverageLabel: 'Actuele prijs gevonden',
          currentPrice: `Vanaf ${formatPriceMinor({
            currencyCode: 'EUR',
            minorUnits: priceMinor,
          })}`,
          merchantLabel: priceSnapshot.best_merchant_name
            ? `Laagst bij ${priceSnapshot.best_merchant_name}`
            : 'Laagste bekende prijs',
          reviewedLabel: priceSnapshot.best_checked_at
            ? `Nagekeken ${formatCheckedOn(priceSnapshot.best_checked_at)}`
            : 'Snapshot bijgewerkt',
        }
      : undefined;

  return {
    id: set.setId,
    slug: set.slug,
    name: set.name,
    ...(set.publicTheme ? { publicTheme: set.publicTheme } : {}),
    theme: set.primaryTheme,
    ...(set.secondaryLabels.length
      ? { secondaryLabels: set.secondaryLabels }
      : {}),
    releaseYear: set.releaseYear,
    ...(set.releaseDate ? { releaseDate: set.releaseDate } : {}),
    releaseDatePrecision: set.releaseDatePrecision,
    pieces: set.pieceCount,
    ...(set.imageUrl
      ? { imageUrl: set.imageUrl, primaryImage: set.imageUrl }
      : {}),
    ...(set.images?.length ? { images: set.images } : {}),
    ...(priceContext ? { priceContext } : {}),
  };
}

async function listCommerceCurrentOfferSnapshots({
  supabaseClient,
}: {
  supabaseClient: SetDetailRelatedThemeSnapshotSupabaseClient;
}): Promise<Map<string, CommerceCurrentOfferSnapshotRow>> {
  const snapshotBySetId = new Map<string, CommerceCurrentOfferSnapshotRow>();
  let start = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseClient
      .from('commerce_current_offer_snapshots')
      .select(
        'set_id, best_price_minor, best_merchant_name, best_availability, best_checked_at, computed_at',
      )
      .range(start, start + pageSize - 1);

    if (error) {
      throw new Error('Unable to load related-theme commerce snapshots.');
    }

    const rows = (data as CommerceCurrentOfferSnapshotRow[] | null) ?? [];

    for (const row of rows) {
      snapshotBySetId.set(getCanonicalCatalogSetId(row.set_id), row);
    }

    if (rows.length < pageSize) {
      break;
    }

    start += pageSize;
  }

  return snapshotBySetId;
}

function compareRelatedThemeCandidates({
  priceSnapshots,
}: {
  priceSnapshots: ReadonlyMap<string, CommerceCurrentOfferSnapshotRow>;
}) {
  return (left: CatalogCanonicalSet, right: CatalogCanonicalSet): number => {
    const leftHasPrice = priceSnapshots.has(left.setId) ? 1 : 0;
    const rightHasPrice = priceSnapshots.has(right.setId) ? 1 : 0;

    return (
      rightHasPrice - leftHasPrice ||
      right.releaseYear - left.releaseYear ||
      right.pieceCount - left.pieceCount ||
      left.name.localeCompare(right.name) ||
      left.setId.localeCompare(right.setId)
    );
  };
}

export async function buildSetDetailRelatedThemeSnapshots({
  catalogSets,
  limit = 8,
  now = new Date(),
  priceSnapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  catalogSets?: readonly CatalogCanonicalSet[];
  limit?: number;
  now?: Date;
  priceSnapshots?: ReadonlyMap<string, CommerceCurrentOfferSnapshotRow>;
  supabaseClient?: SetDetailRelatedThemeSnapshotSupabaseClient;
} = {}): Promise<
  Omit<SetDetailRelatedThemeSnapshotBuildResult, 'dryRun' | 'upsertedCount'>
> {
  const generatedAt = now.toISOString();
  const [resolvedCatalogSets, resolvedPriceSnapshots] = await Promise.all([
    catalogSets ?? listCanonicalCatalogSets({ supabaseClient }),
    priceSnapshots ?? listCommerceCurrentOfferSnapshots({ supabaseClient }),
  ]);
  const activeCatalogSets = resolvedCatalogSets.filter(
    (set) => set.status === 'active',
  );
  const setsByThemeSlug = new Map<string, CatalogCanonicalSet[]>();

  for (const set of activeCatalogSets) {
    const themeSlug = buildCatalogThemeSlug(set.primaryTheme);
    const themeSets = setsByThemeSlug.get(themeSlug) ?? [];

    themeSets.push(set);
    setsByThemeSlug.set(themeSlug, themeSets);
  }

  const snapshots = activeCatalogSets.map((currentSet) => {
    const themeSlug = buildCatalogThemeSlug(currentSet.primaryTheme);
    const themeSets = setsByThemeSlug.get(themeSlug) ?? [];
    const candidates = themeSets
      .filter((set) => set.setId !== currentSet.setId)
      .sort(
        compareRelatedThemeCandidates({
          priceSnapshots: resolvedPriceSnapshots,
        }),
      );
    const items = candidates.slice(0, limit).map((set) =>
      toSnapshotCard({
        priceSnapshot: resolvedPriceSnapshots.get(set.setId),
        set,
      }),
    );

    return {
      generatedAt,
      items,
      page: SET_DETAIL_RELATED_THEME_SNAPSHOT_PAGE,
      pageSize: SET_DETAIL_RELATED_THEME_SNAPSHOT_PAGE_SIZE,
      setId: currentSet.setId,
      snapshotSlug: buildSetDetailRelatedThemeSnapshotSlug(currentSet.setId),
      totalCount: candidates.length,
    };
  });

  return {
    generatedAt,
    snapshots,
    summary: {
      setCount: activeCatalogSets.length,
      snapshotCount: snapshots.length,
      snapshotWithItemsCount: snapshots.filter(
        (snapshot) => snapshot.items.length > 0,
      ).length,
    },
  };
}

function toSnapshotRows(
  snapshots: readonly SetDetailRelatedThemeSnapshot[],
): Record<string, unknown>[] {
  return snapshots.map((snapshot) => ({
    collection_slug: snapshot.snapshotSlug,
    generated_at: snapshot.generatedAt,
    items_json: snapshot.items,
    page: snapshot.page,
    page_size: snapshot.pageSize,
    snapshot_source: SET_DETAIL_RELATED_THEME_SNAPSHOT_SOURCE,
    sort_key: SET_DETAIL_RELATED_THEME_SNAPSHOT_SORT_KEY,
    source_version: snapshot.generatedAt,
    total_count: snapshot.totalCount,
  }));
}

export async function upsertSetDetailRelatedThemeSnapshots({
  snapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshots: readonly SetDetailRelatedThemeSnapshot[];
  supabaseClient?: SetDetailRelatedThemeSnapshotSupabaseClient;
}): Promise<number> {
  let upsertedCount = 0;

  for (const chunk of chunkRows(toSnapshotRows(snapshots), 100)) {
    const { error } = await supabaseClient
      .from(COLLECTION_PAGE_SNAPSHOTS_TABLE)
      .upsert(chunk, {
        onConflict: 'collection_slug,sort_key,page,page_size',
      });

    if (error) {
      throw new Error('Unable to upsert set detail related-theme snapshots.');
    }

    upsertedCount += chunk.length;
  }

  return upsertedCount;
}

export async function syncSetDetailRelatedThemeSnapshots({
  dryRun = true,
  limit = 8,
  now = new Date(),
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
  supabaseClient?: SetDetailRelatedThemeSnapshotSupabaseClient;
} = {}): Promise<SetDetailRelatedThemeSnapshotBuildResult> {
  const buildResult = await buildSetDetailRelatedThemeSnapshots({
    limit,
    now,
    supabaseClient,
  });
  const upsertedCount = dryRun
    ? 0
    : await upsertSetDetailRelatedThemeSnapshots({
        snapshots: buildResult.snapshots,
        supabaseClient,
      });

  return {
    ...buildResult,
    dryRun,
    upsertedCount,
  };
}
