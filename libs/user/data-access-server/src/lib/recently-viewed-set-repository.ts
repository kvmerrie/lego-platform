import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';

export const RECENTLY_VIEWED_SET_LIMIT = 50;

const recentlyViewedSetColumns = [
  'user_id',
  'set_id',
  'viewed_at',
  'created_at',
].join(',');

interface RecentlyViewedSetRow {
  user_id: string;
  set_id: string;
  viewed_at: string;
  created_at: string;
}

export interface RecentlyViewedSetRecord {
  createdAt: string;
  setId: string;
  userId: string;
  viewedAt: string;
}

export interface RecentlyViewedSetRepository {
  listByUserId(
    userId: string,
    limit?: number,
  ): Promise<RecentlyViewedSetRecord[]>;
  mergeViewedSets(input: {
    setIds: readonly string[];
    userId: string;
  }): Promise<RecentlyViewedSetRecord[]>;
  upsertViewedSet(input: {
    setId: string;
    userId: string;
    viewedAt?: string;
  }): Promise<RecentlyViewedSetRecord>;
}

function mapRecentlyViewedSetRow(
  recentlyViewedSetRow: RecentlyViewedSetRow,
): RecentlyViewedSetRecord {
  return {
    createdAt: recentlyViewedSetRow.created_at,
    setId: recentlyViewedSetRow.set_id,
    userId: recentlyViewedSetRow.user_id,
    viewedAt: recentlyViewedSetRow.viewed_at,
  };
}

function normalizeRecentlyViewedSetIds(setIds: readonly string[]): string[] {
  const uniqueSetIds: string[] = [];
  const seenSetIds = new Set<string>();

  for (const setId of setIds) {
    const canonicalSetId = normalizeCatalogSetId(setId);

    if (!canonicalSetId || seenSetIds.has(canonicalSetId)) {
      continue;
    }

    uniqueSetIds.push(canonicalSetId);
    seenSetIds.add(canonicalSetId);

    if (uniqueSetIds.length >= RECENTLY_VIEWED_SET_LIMIT) {
      break;
    }
  }

  return uniqueSetIds;
}

async function pruneRecentlyViewedSets({
  supabaseAdminClient,
  userId,
}: {
  supabaseAdminClient: SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await supabaseAdminClient
    .from('recently_viewed_sets')
    .select('set_id')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .order('set_id', { ascending: true })
    .range(RECENTLY_VIEWED_SET_LIMIT, 10_000);

  if (error) {
    throw new Error('Unable to load old recently viewed sets for cleanup.');
  }

  const staleSetIds = ((data as { set_id: string }[] | null) ?? []).map(
    (row) => row.set_id,
  );

  if (staleSetIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabaseAdminClient
    .from('recently_viewed_sets')
    .delete()
    .eq('user_id', userId)
    .in('set_id', staleSetIds);

  if (deleteError) {
    throw new Error('Unable to prune old recently viewed sets.');
  }
}

export function createRecentlyViewedSetRepository(
  supabaseAdminClient?: SupabaseClient,
): RecentlyViewedSetRepository {
  function getSupabaseAdminClient() {
    return supabaseAdminClient ?? getServerSupabaseAdminClient();
  }

  async function listByUserId(
    userId: string,
    limit = RECENTLY_VIEWED_SET_LIMIT,
  ): Promise<RecentlyViewedSetRecord[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from('recently_viewed_sets')
      .select(recentlyViewedSetColumns)
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .order('set_id', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), RECENTLY_VIEWED_SET_LIMIT));

    if (error) {
      throw new Error('Unable to load recently viewed sets.');
    }

    return ((data as unknown as RecentlyViewedSetRow[] | null) ?? []).map(
      mapRecentlyViewedSetRow,
    );
  }

  return {
    listByUserId,

    async mergeViewedSets({ setIds, userId }) {
      const canonicalSetIds = normalizeRecentlyViewedSetIds(setIds);

      if (canonicalSetIds.length === 0) {
        return listByUserId(userId);
      }

      const nowMs = Date.now();
      const rows = canonicalSetIds.map((setId, index) => ({
        user_id: userId,
        set_id: setId,
        viewed_at: new Date(nowMs - index).toISOString(),
      }));
      const { error } = await getSupabaseAdminClient()
        .from('recently_viewed_sets')
        .upsert(rows, {
          onConflict: 'user_id,set_id',
        });

      if (error) {
        throw new Error('Unable to merge recently viewed sets.');
      }

      await pruneRecentlyViewedSets({
        supabaseAdminClient: getSupabaseAdminClient(),
        userId,
      });

      return listByUserId(userId);
    },

    async upsertViewedSet({ setId, userId, viewedAt }) {
      const canonicalSetId = normalizeCatalogSetId(setId);
      const { data, error } = await getSupabaseAdminClient()
        .from('recently_viewed_sets')
        .upsert(
          {
            user_id: userId,
            set_id: canonicalSetId,
            viewed_at: viewedAt ?? new Date().toISOString(),
          },
          {
            onConflict: 'user_id,set_id',
          },
        )
        .select(recentlyViewedSetColumns)
        .single();

      if (error) {
        throw new Error('Unable to persist recently viewed set.');
      }

      await pruneRecentlyViewedSets({
        supabaseAdminClient: getSupabaseAdminClient(),
        userId,
      });

      return mapRecentlyViewedSetRow(data as unknown as RecentlyViewedSetRow);
    },
  };
}
