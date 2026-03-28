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

export interface AnonymousUserSession {
  state: 'anonymous';
  ownedSetIds: string[];
  wantedSetIds: string[];
}

export interface AuthenticatedUserSession {
  state: 'authenticated';
  account?: AuthenticatedAccountIdentity;
  collector: CollectorIdentity;
  ownedSetIds: string[];
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

export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
