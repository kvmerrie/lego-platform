import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';

const userSetStatusColumns = [
  'user_id',
  'set_id',
  'is_owned',
  'is_wanted',
  'created_at',
  'updated_at',
].join(',');

interface UserSetStatusRow {
  user_id: string;
  set_id: string;
  is_owned: boolean;
  is_wanted: boolean;
  created_at: string;
  updated_at: string;
}

interface UserSetStatusUpsertRow {
  user_id: string;
  set_id: string;
  is_owned: boolean;
  is_wanted: boolean;
}

export interface UserSetStatusRecord {
  userId: string;
  setId: string;
  isOwned: boolean;
  isWanted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSetStatusRepository {
  getByUserIdAndSetId(
    userId: string,
    setId: string,
  ): Promise<UserSetStatusRecord | null>;
  listByUserId(userId: string): Promise<UserSetStatusRecord[]>;
  setOwnedState(input: {
    userId: string;
    setId: string;
    isOwned: boolean;
  }): Promise<UserSetStatusRecord | null>;
  setWantedState(input: {
    userId: string;
    setId: string;
    isWanted: boolean;
  }): Promise<UserSetStatusRecord | null>;
}

function mapUserSetStatusRow(
  userSetStatusRow: UserSetStatusRow,
): UserSetStatusRecord {
  return {
    userId: userSetStatusRow.user_id,
    setId: userSetStatusRow.set_id,
    isOwned: userSetStatusRow.is_owned,
    isWanted: userSetStatusRow.is_wanted,
    createdAt: userSetStatusRow.created_at,
    updatedAt: userSetStatusRow.updated_at,
  };
}

async function deleteUserSetStatusRow({
  setId,
  supabaseAdminClient,
  userId,
}: {
  setId: string;
  supabaseAdminClient: SupabaseClient;
  userId: string;
}) {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const { error } = await supabaseAdminClient
    .from('user_set_statuses')
    .delete()
    .eq('user_id', userId)
    .eq('set_id', canonicalSetId);

  if (error) {
    throw new Error('Unable to clear the user set status.');
  }
}

async function upsertUserSetStatusRow({
  row,
  supabaseAdminClient,
}: {
  row: UserSetStatusUpsertRow;
  supabaseAdminClient: SupabaseClient;
}): Promise<UserSetStatusRecord> {
  const { data, error } = await supabaseAdminClient
    .from('user_set_statuses')
    .upsert(row, {
      onConflict: 'user_id,set_id',
    })
    .select(userSetStatusColumns)
    .single();

  if (error) {
    throw new Error('Unable to persist the user set status.');
  }

  return mapUserSetStatusRow(data as unknown as UserSetStatusRow);
}

export function createUserSetStatusRepository(
  supabaseAdminClient?: SupabaseClient,
): UserSetStatusRepository {
  function getSupabaseAdminClient() {
    return supabaseAdminClient ?? getServerSupabaseAdminClient();
  }

  async function getByUserIdAndSetId(
    userId: string,
    setId: string,
  ): Promise<UserSetStatusRecord | null> {
    const canonicalSetId = normalizeCatalogSetId(setId);
    const { data, error } = await getSupabaseAdminClient()
      .from('user_set_statuses')
      .select(userSetStatusColumns)
      .eq('user_id', userId)
      .eq('set_id', canonicalSetId)
      .maybeSingle();

    if (error) {
      throw new Error('Unable to load the user set status.');
    }

    return data
      ? mapUserSetStatusRow(data as unknown as UserSetStatusRow)
      : null;
  }

  return {
    async listByUserId(userId: string) {
      const { data, error } = await getSupabaseAdminClient()
        .from('user_set_statuses')
        .select(userSetStatusColumns)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .order('set_id', { ascending: true });

      if (error) {
        throw new Error('Unable to load the user set statuses.');
      }

      return (data as unknown as UserSetStatusRow[]).map(mapUserSetStatusRow);
    },

    getByUserIdAndSetId,

    async setOwnedState({ userId, setId, isOwned }) {
      const canonicalSetId = normalizeCatalogSetId(setId);
      const currentStatus = await getByUserIdAndSetId(userId, canonicalSetId);
      const nextStatus = {
        user_id: userId,
        set_id: canonicalSetId,
        is_owned: isOwned,
        is_wanted: isOwned ? false : (currentStatus?.isWanted ?? false),
      };

      if (!nextStatus.is_owned && !nextStatus.is_wanted) {
        await deleteUserSetStatusRow({
          setId: canonicalSetId,
          supabaseAdminClient: getSupabaseAdminClient(),
          userId,
        });

        return null;
      }

      return upsertUserSetStatusRow({
        row: nextStatus,
        supabaseAdminClient: getSupabaseAdminClient(),
      });
    },

    async setWantedState({ userId, setId, isWanted }) {
      const canonicalSetId = normalizeCatalogSetId(setId);
      const currentStatus = await getByUserIdAndSetId(userId, canonicalSetId);
      const nextStatus = {
        user_id: userId,
        set_id: canonicalSetId,
        is_owned: isWanted ? false : (currentStatus?.isOwned ?? false),
        is_wanted: isWanted,
      };

      if (!nextStatus.is_owned && !nextStatus.is_wanted) {
        await deleteUserSetStatusRow({
          setId: canonicalSetId,
          supabaseAdminClient: getSupabaseAdminClient(),
          userId,
        });

        return null;
      }

      return upsertUserSetStatusRow({
        row: nextStatus,
        supabaseAdminClient: getSupabaseAdminClient(),
      });
    },
  };
}
