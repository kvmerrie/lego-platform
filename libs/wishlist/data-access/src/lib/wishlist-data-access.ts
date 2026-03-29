import {
  WantedSetState,
  WishlistItem,
  WishlistOverview,
} from '@lego-platform/wishlist/util';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';
import { readStringArrayProperty } from '@lego-platform/shared/util';

const wishlistOverview: WishlistOverview = {
  trackedSets: 19,
  highPriority: 6,
  nextReviewWindow: 'Weekly',
};

const wishlistItems: readonly WishlistItem[] = [
  {
    id: '42177',
    name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
    targetPrice: '$199',
    reason: 'Strong display presence with an approachable premium ceiling.',
    urgency: 'High',
  },
  {
    id: '10318',
    name: 'Concorde',
    targetPrice: '$169',
    reason: 'Aspirational display piece for a future feature collection.',
    urgency: 'Medium',
  },
  {
    id: '10294',
    name: 'Titanic',
    targetPrice: '$499',
    reason: 'Long-horizon acquisition with room-scale planning attached.',
    urgency: 'Low',
  },
];

export function getWishlistOverview(): WishlistOverview {
  return wishlistOverview;
}

export function listWishlistItems(): WishlistItem[] {
  return [...wishlistItems];
}

export async function getWantedSetState(
  setId: string,
): Promise<WantedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(apiPaths.session, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Unable to load wanted-set state.');
  }

  const wantedSetIds = readStringArrayProperty(
    await response.json(),
    'wantedSetIds',
  );

  return {
    setId,
    isWanted: wantedSetIds.includes(setId),
  };
}

export async function addWantedSet(setId: string): Promise<WantedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(
    `${apiPaths.wantedSets}/${encodeURIComponent(setId)}`,
    {
      headers,
      method: 'PUT',
    },
  );

  if (response.status === 401) {
    throw new Error('Sign in to save this set to your wanted list.');
  }

  if (!response.ok) {
    throw new Error('Unable to mark the set as wanted.');
  }

  const wantedSetState = (await response.json()) as WantedSetState;

  notifyBrowserAccountDataChanged();

  return wantedSetState;
}

export async function removeWantedSet(setId: string): Promise<WantedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(
    `${apiPaths.wantedSets}/${encodeURIComponent(setId)}`,
    {
      headers,
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw new Error('Sign in to update your wanted list.');
  }

  if (!response.ok) {
    throw new Error('Unable to remove the set from wanted items.');
  }

  const wantedSetState = (await response.json()) as WantedSetState;

  notifyBrowserAccountDataChanged();

  return wantedSetState;
}
