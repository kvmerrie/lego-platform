import {
  CollectionDashboardSnapshot,
  CollectionEditorSection,
  CollectionShelf,
  OwnedSetState,
} from '@lego-platform/collection/util';
import { apiPaths } from '@lego-platform/shared/config';
import { buildSupabaseAuthorizationHeaders } from '@lego-platform/shared/data-access-auth';
import { readStringArrayProperty } from '@lego-platform/shared/util';

const collectionSnapshot: CollectionDashboardSnapshot = {
  ownedSets: 128,
  wantedSets: 19,
  completionRate: 84,
  insuredValue: '$18.4k',
};

const collectionShelves: readonly CollectionShelf[] = [
  {
    name: 'Icons Wall',
    completion: '92%',
    focus: 'Large display anchors and architectural silhouettes.',
    notes: 'Ready for room-by-room presentation in the public portal.',
  },
  {
    name: 'Licensed Showcase',
    completion: '76%',
    focus: 'Marvel and fantasy crossovers with pricing velocity.',
    notes: 'Needs stronger editorial tagging and duplicate tracking.',
  },
  {
    name: 'Retired Favourites',
    completion: '61%',
    focus: 'Personal collection goals with slower acquisition cadence.',
    notes: 'Good candidate for long-horizon wishlist automation.',
  },
];

const collectionEditorSections: readonly CollectionEditorSection[] = [
  {
    title: 'Identity',
    description:
      'Define how the collection appears in public and admin contexts.',
    fields: ['Collection name', 'Audience visibility', 'Public description'],
  },
  {
    title: 'Valuation',
    description: 'Track replacement cost and insurance posture.',
    fields: ['Acquisition cost', 'Replacement estimate', 'Last appraisal date'],
  },
  {
    title: 'Display planning',
    description: 'Capture shelf constraints and rotation rules.',
    fields: ['Room zone', 'Display width', 'Rotation cadence'],
  },
];

export function getCollectionSnapshot(): CollectionDashboardSnapshot {
  return collectionSnapshot;
}

export function listCollectionShelves(): CollectionShelf[] {
  return [...collectionShelves];
}

export function listCollectionEditorSections(): CollectionEditorSection[] {
  return [...collectionEditorSections];
}

export async function getOwnedSetState(setId: string): Promise<OwnedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(apiPaths.session, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Unable to load owned-set state.');
  }

  const ownedSetIds = readStringArrayProperty(
    await response.json(),
    'ownedSetIds',
  );

  return {
    setId,
    isOwned: ownedSetIds.includes(setId),
  };
}

export async function addOwnedSet(setId: string): Promise<OwnedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(`${apiPaths.ownedSets}/${encodeURIComponent(setId)}`, {
    headers,
    method: 'PUT',
  });

  if (response.status === 401) {
    throw new Error('Sign in to save this set to your owned list.');
  }

  if (!response.ok) {
    throw new Error('Unable to mark the set as owned.');
  }

  return (await response.json()) as OwnedSetState;
}

export async function removeOwnedSet(setId: string): Promise<OwnedSetState> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(`${apiPaths.ownedSets}/${encodeURIComponent(setId)}`, {
    headers,
    method: 'DELETE',
  });

  if (response.status === 401) {
    throw new Error('Sign in to update your owned list.');
  }

  if (!response.ok) {
    throw new Error('Unable to remove the set from owned items.');
  }

  return (await response.json()) as OwnedSetState;
}
