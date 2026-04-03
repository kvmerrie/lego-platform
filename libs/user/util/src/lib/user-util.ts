export interface CollectorIdentity {
  id: string;
  name: string;
  tier: string;
  location: string;
  collectionFocus: string;
}

export interface AuthenticatedAccountIdentity {
  userId: string;
  email: string | null;
}

export interface CollectorProfile {
  collectorHandle: string;
  collectionFocus: string;
  displayName: string;
  email: string | null;
  location: string;
  tier: string;
}

export interface UpdateCollectorProfileInput {
  collectorHandle: string;
  collectionFocus: string;
  displayName: string;
  location: string;
}

export type UserSetListState = 'owned' | 'wishlist';

export interface UserSetState {
  setId: string;
  state: UserSetListState;
}

export interface AnonymousUserSession {
  state: 'anonymous';
  ownedSetIds: string[];
  setStates: UserSetState[];
  wantedSetIds: string[];
}

export interface AuthenticatedUserSession {
  state: 'authenticated';
  account?: AuthenticatedAccountIdentity;
  collector: CollectorIdentity;
  ownedSetIds: string[];
  setStates: UserSetState[];
  wantedSetIds: string[];
}

export type UserSession = AnonymousUserSession | AuthenticatedUserSession;

export type UserProfile = CollectorIdentity;

export const phaseOneCollectorIdentity: CollectorIdentity = {
  id: 'collector-phase-one',
  name: 'Alex Rivera',
  tier: 'Founding Collector',
  location: 'Amsterdam',
  collectionFocus: 'Premium display sets and licensed flagships',
};

export function createAnonymousUserSession(): AnonymousUserSession {
  return {
    state: 'anonymous',
    ownedSetIds: [],
    setStates: [],
    wantedSetIds: [],
  };
}

export function isAuthenticatedSession(
  userSession: UserSession,
): userSession is AuthenticatedUserSession {
  return userSession.state === 'authenticated';
}

export function getCollectorSetCounts(userSession: UserSession): {
  ownedCount: number;
  wantedCount: number;
} {
  return {
    ownedCount: userSession.ownedSetIds.length,
    wantedCount: userSession.wantedSetIds.length,
  };
}

export function listUserSetStates({
  ownedSetIds,
  wantedSetIds,
}: Pick<UserSession, 'ownedSetIds' | 'wantedSetIds'>): UserSetState[] {
  const ownedSetIdSet = new Set(ownedSetIds);
  const wantedStates = [...new Set(wantedSetIds)]
    .filter((setId) => !ownedSetIdSet.has(setId))
    .map((setId) => ({
      setId,
      state: 'wishlist' as const,
    }));
  const ownedStates = [...ownedSetIdSet].map((setId) => ({
    setId,
    state: 'owned' as const,
  }));

  return [...wantedStates, ...ownedStates].sort((left, right) =>
    left.setId.localeCompare(right.setId),
  );
}

export function getUserSetState(
  userSession: Pick<UserSession, 'ownedSetIds' | 'wantedSetIds'>,
  setId: string,
): UserSetListState | undefined {
  if (userSession.ownedSetIds.includes(setId)) {
    return 'owned';
  }

  if (userSession.wantedSetIds.includes(setId)) {
    return 'wishlist';
  }

  return undefined;
}

export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function readRequiredTextField(input: unknown, fieldName: string): string {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedInput;
}

function sanitizeCollectorHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function assertMaxLength({
  fieldName,
  maxLength,
  value,
}: {
  fieldName: string;
  maxLength: number;
  value: string;
}) {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }
}

export function normalizeCollectorHandle(value: string): string {
  return sanitizeCollectorHandle(
    readRequiredTextField(value, 'Collector handle'),
  );
}

export function createCollectorProfileDraft(
  collectorProfile: CollectorProfile,
): UpdateCollectorProfileInput {
  return {
    displayName: collectorProfile.displayName,
    collectorHandle: collectorProfile.collectorHandle,
    location: collectorProfile.location,
    collectionFocus: collectorProfile.collectionFocus,
  };
}

export function validateUpdateCollectorProfileInput(
  input: unknown,
): UpdateCollectorProfileInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Collector profile updates must be an object.');
  }

  const inputRecord = input as Record<string, unknown>;
  const displayName = readRequiredTextField(
    inputRecord.displayName,
    'Display name',
  );
  const collectorHandle = normalizeCollectorHandle(
    inputRecord.collectorHandle as string,
  );
  const location = readRequiredTextField(inputRecord.location, 'Location');
  const collectionFocus = readRequiredTextField(
    inputRecord.collectionFocus,
    'Collection focus',
  );

  if (collectorHandle.length < 3) {
    throw new Error('Collector handle must be at least 3 characters long.');
  }

  assertMaxLength({
    fieldName: 'Display name',
    maxLength: 80,
    value: displayName,
  });
  assertMaxLength({
    fieldName: 'Collector handle',
    maxLength: 32,
    value: collectorHandle,
  });
  assertMaxLength({
    fieldName: 'Location',
    maxLength: 80,
    value: location,
  });
  assertMaxLength({
    fieldName: 'Collection focus',
    maxLength: 140,
    value: collectionFocus,
  });

  return {
    displayName,
    collectorHandle,
    location,
    collectionFocus,
  };
}
