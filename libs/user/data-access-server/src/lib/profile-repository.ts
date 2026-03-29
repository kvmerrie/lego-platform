import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  phaseOneCollectorIdentity,
  type UpdateCollectorProfileInput,
} from '@lego-platform/user/util';

const profileColumns = [
  'user_id',
  'display_name',
  'collector_handle',
  'tier',
  'location',
  'collection_focus',
  'created_at',
  'updated_at',
].join(',');

interface ProfileRow {
  user_id: string;
  display_name: string;
  collector_handle: string;
  tier: string;
  location: string;
  collection_focus: string;
  created_at: string;
  updated_at: string;
}

interface ProfileUpsertRow {
  user_id: string;
  display_name: string;
  collector_handle: string;
  tier: string;
  location: string;
  collection_focus: string;
}

export interface UserProfileRecord {
  userId: string;
  displayName: string;
  collectorHandle: string;
  tier: string;
  location: string;
  collectionFocus: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnsureUserProfileInput {
  email: string | null;
  userId: string;
}

export interface UserProfileRepository {
  ensureProfile(
    ensureUserProfileInput: EnsureUserProfileInput,
  ): Promise<UserProfileRecord>;
  getByUserId(userId: string): Promise<UserProfileRecord | null>;
  updateProfile(input: {
    updateCollectorProfileInput: UpdateCollectorProfileInput;
    userId: string;
  }): Promise<UserProfileRecord>;
}

export class CollectorHandleConflictError extends Error {
  constructor() {
    super('Collector handle is already in use.');
    this.name = 'CollectorHandleConflictError';
  }
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((valuePart) => valuePart[0].toUpperCase() + valuePart.slice(1))
    .join(' ');
}

function sanitizeCollectorHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function buildDefaultDisplayName(email: string | null): string {
  const emailLocalPart = email?.split('@')[0]?.trim();

  if (!emailLocalPart) {
    return phaseOneCollectorIdentity.name;
  }

  return toTitleCase(emailLocalPart);
}

function buildDefaultCollectorHandle({
  email,
  userId,
}: EnsureUserProfileInput): string {
  const emailLocalPart = email?.split('@')[0]?.trim();
  const handleSeed =
    sanitizeCollectorHandle(emailLocalPart ?? '') ||
    sanitizeCollectorHandle(phaseOneCollectorIdentity.name) ||
    'collector';

  return `${handleSeed}-${userId.slice(0, 8)}`;
}

function buildDefaultProfileUpsertRow(
  ensureUserProfileInput: EnsureUserProfileInput,
): ProfileUpsertRow {
  return {
    user_id: ensureUserProfileInput.userId,
    display_name: buildDefaultDisplayName(ensureUserProfileInput.email),
    collector_handle: buildDefaultCollectorHandle(ensureUserProfileInput),
    tier: phaseOneCollectorIdentity.tier,
    location: phaseOneCollectorIdentity.location,
    collection_focus: phaseOneCollectorIdentity.collectionFocus,
  };
}

function mapProfileRow(profileRow: ProfileRow): UserProfileRecord {
  return {
    userId: profileRow.user_id,
    displayName: profileRow.display_name,
    collectorHandle: profileRow.collector_handle,
    tier: profileRow.tier,
    location: profileRow.location,
    collectionFocus: profileRow.collection_focus,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
  };
}

function isCollectorHandleConflict(error: { code?: string; message?: string }) {
  return (
    error.code === '23505' &&
    error.message?.toLowerCase().includes('collector_handle')
  );
}

export function createUserProfileRepository(
  supabaseAdminClient?: SupabaseClient,
): UserProfileRepository {
  function getSupabaseAdminClient() {
    return supabaseAdminClient ?? getServerSupabaseAdminClient();
  }

  async function getByUserId(
    userId: string,
  ): Promise<UserProfileRecord | null> {
    const { data, error } = await getSupabaseAdminClient()
      .from('profiles')
      .select(profileColumns)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error('Unable to load the collector profile.');
    }

    return data ? mapProfileRow(data as unknown as ProfileRow) : null;
  }

  return {
    getByUserId,

    async ensureProfile(ensureUserProfileInput: EnsureUserProfileInput) {
      const existingProfile = await getByUserId(ensureUserProfileInput.userId);

      if (existingProfile) {
        return existingProfile;
      }

      const { data, error } = await getSupabaseAdminClient()
        .from('profiles')
        .upsert(buildDefaultProfileUpsertRow(ensureUserProfileInput), {
          onConflict: 'user_id',
        })
        .select(profileColumns)
        .single();

      if (error) {
        throw new Error('Unable to create the collector profile.');
      }

      return mapProfileRow(data as unknown as ProfileRow);
    },

    async updateProfile({ updateCollectorProfileInput, userId }) {
      const { data, error } = await getSupabaseAdminClient()
        .from('profiles')
        .update({
          display_name: updateCollectorProfileInput.displayName,
          collector_handle: updateCollectorProfileInput.collectorHandle,
          location: updateCollectorProfileInput.location,
          collection_focus: updateCollectorProfileInput.collectionFocus,
        })
        .eq('user_id', userId)
        .select(profileColumns)
        .single();

      if (error) {
        if (isCollectorHandleConflict(error)) {
          throw new CollectorHandleConflictError();
        }

        throw new Error('Unable to update the collector profile.');
      }

      return mapProfileRow(data as unknown as ProfileRow);
    },
  };
}
