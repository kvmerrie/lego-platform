import {
  WantedSetState,
  WishlistItem,
  WishlistOverview,
} from '@lego-platform/wishlist/util';
import { apiPaths } from '@lego-platform/shared/config';
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

export async function getWantedSetState(setId: string): Promise<WantedSetState> {
  const response = await fetch(apiPaths.session, {
    cache: 'no-store',
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
  const response = await fetch(`${apiPaths.wantedSets}/${encodeURIComponent(setId)}`, {
    method: 'PUT',
  });

  if (!response.ok) {
    throw new Error('Unable to mark the set as wanted.');
  }

  return (await response.json()) as WantedSetState;
}

export async function removeWantedSet(setId: string): Promise<WantedSetState> {
  const response = await fetch(`${apiPaths.wantedSets}/${encodeURIComponent(setId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Unable to remove the set from wanted items.');
  }

  return (await response.json()) as WantedSetState;
}
