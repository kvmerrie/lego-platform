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
import {
  normalizeCatalogSetId,
  readStringArrayProperty,
} from '@lego-platform/shared/util';

const LOCAL_FOLLOWED_PRICE_SET_IDS_STORAGE_KEY =
  'brickhunt.followed-price-set-ids';

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

export interface WantedSetContext {
  alertsEnabled: boolean;
  isAuthenticated: boolean;
  wantedCount: number;
  wantedSetState: WantedSetState;
}

export interface FollowedPriceSetCollection {
  alertsEnabled: boolean;
  followedSetIds: string[];
  isAuthenticated: boolean;
}

function getBrowserStorage():
  | Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.localStorage;
}

function readLocalFollowedPriceSetIds(): string[] {
  const browserStorage = getBrowserStorage();

  if (!browserStorage) {
    return [];
  }

  try {
    const rawValue = browserStorage.getItem(
      LOCAL_FOLLOWED_PRICE_SET_IDS_STORAGE_KEY,
    );

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return [
      ...new Set(
        parsedValue.flatMap((value) =>
          typeof value === 'string' ? [normalizeCatalogSetId(value)] : [],
        ),
      ),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

function writeLocalFollowedPriceSetIds(setIds: readonly string[]): void {
  const browserStorage = getBrowserStorage();

  if (!browserStorage) {
    return;
  }

  const nextSetIds = [
    ...new Set(setIds.map((setId) => normalizeCatalogSetId(setId))),
  ].filter(Boolean);

  if (nextSetIds.length === 0) {
    browserStorage.removeItem(LOCAL_FOLLOWED_PRICE_SET_IDS_STORAGE_KEY);
    return;
  }

  browserStorage.setItem(
    LOCAL_FOLLOWED_PRICE_SET_IDS_STORAGE_KEY,
    JSON.stringify(nextSetIds),
  );
}

export function addLocalFollowedPriceSet(setId: string): WantedSetState {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const localFollowedPriceSetIds = readLocalFollowedPriceSetIds();

  writeLocalFollowedPriceSetIds([canonicalSetId, ...localFollowedPriceSetIds]);
  notifyBrowserAccountDataChanged();

  return {
    isWanted: true,
    setId: canonicalSetId,
  };
}

export function removeLocalFollowedPriceSet(setId: string): WantedSetState {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const localFollowedPriceSetIds = readLocalFollowedPriceSetIds();

  writeLocalFollowedPriceSetIds(
    localFollowedPriceSetIds.filter(
      (localFollowedPriceSetId) => localFollowedPriceSetId !== canonicalSetId,
    ),
  );
  notifyBrowserAccountDataChanged();

  return {
    isWanted: false,
    setId: canonicalSetId,
  };
}

function readFollowedPriceSetCollection(
  sessionPayload: unknown,
): FollowedPriceSetCollection {
  const wantedSetIds = [
    ...new Set(
      readStringArrayProperty(sessionPayload, 'wantedSetIds').map((setId) =>
        normalizeCatalogSetId(setId),
      ),
    ),
  ].filter(Boolean);
  const isAuthenticated =
    Boolean(sessionPayload) &&
    typeof sessionPayload === 'object' &&
    (sessionPayload as Record<string, unknown>).state === 'authenticated';
  const notificationPreferences =
    sessionPayload && typeof sessionPayload === 'object'
      ? (sessionPayload as Record<string, unknown>).notificationPreferences
      : undefined;
  const alertsEnabled =
    Boolean(notificationPreferences) &&
    typeof notificationPreferences === 'object' &&
    (notificationPreferences as Record<string, unknown>).wishlistDealAlerts ===
      true;
  const localFollowedPriceSetIds = readLocalFollowedPriceSetIds();

  return {
    alertsEnabled: isAuthenticated ? alertsEnabled : false,
    followedSetIds: isAuthenticated ? wantedSetIds : localFollowedPriceSetIds,
    isAuthenticated,
  };
}

export async function getFollowedPriceSetCollection(): Promise<FollowedPriceSetCollection> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(apiPaths.session, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('De gevolgde sets konden nu niet worden geladen.');
  }

  return readFollowedPriceSetCollection(await response.json());
}

export async function getWantedSetContext(
  setId: string,
): Promise<WantedSetContext> {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const followedPriceSetCollection = await getFollowedPriceSetCollection();

  return {
    alertsEnabled: followedPriceSetCollection.alertsEnabled,
    isAuthenticated: followedPriceSetCollection.isAuthenticated,
    wantedCount: followedPriceSetCollection.followedSetIds.length,
    wantedSetState: {
      setId: canonicalSetId,
      isWanted:
        followedPriceSetCollection.followedSetIds.includes(canonicalSetId),
    },
  };
}

export async function getWantedSetState(
  setId: string,
): Promise<WantedSetState> {
  const wantedSetContext = await getWantedSetContext(setId);

  return wantedSetContext.wantedSetState;
}

export async function addWantedSet(setId: string): Promise<WantedSetState> {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(
    `${apiPaths.wantedSets}/${encodeURIComponent(canonicalSetId)}`,
    {
      headers,
      method: 'PUT',
    },
  );

  if (response.status === 401) {
    throw new Error('Log in om deze set aan je verlanglijst toe te voegen.');
  }

  if (!response.ok) {
    throw new Error('Deze set kon niet aan je verlanglijst worden toegevoegd.');
  }

  const wantedSetState = (await response.json()) as WantedSetState;

  notifyBrowserAccountDataChanged();

  return wantedSetState;
}

export async function removeWantedSet(setId: string): Promise<WantedSetState> {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(
    `${apiPaths.wantedSets}/${encodeURIComponent(canonicalSetId)}`,
    {
      headers,
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw new Error('Log in om je verlanglijst bij te werken.');
  }

  if (!response.ok) {
    throw new Error('Deze set kon niet van je verlanglijst worden verwijderd.');
  }

  const wantedSetState = (await response.json()) as WantedSetState;

  notifyBrowserAccountDataChanged();

  return wantedSetState;
}
