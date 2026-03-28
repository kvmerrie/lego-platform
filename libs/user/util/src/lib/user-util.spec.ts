import { describe, expect, test } from 'vitest';
import {
  createAnonymousUserSession,
  getCollectorSetCounts,
  isAuthenticatedSession,
  UserSession,
} from './user-util';

describe('user session contracts', () => {
  test('builds an anonymous session with empty set preferences', () => {
    expect(createAnonymousUserSession()).toEqual({
      state: 'anonymous',
      ownedSetIds: [],
      wantedSetIds: [],
    });
  });

  test('detects authenticated sessions and reports owned/wanted counts', () => {
    const userSession: UserSession = {
      state: 'authenticated',
      collector: {
        id: 'collector-phase-one',
        name: 'Alex Rivera',
        tier: 'Founding Collector',
        location: 'Amsterdam',
        collectionFocus: 'Premium display sets and licensed flagships',
      },
      ownedSetIds: ['10316', '21348'],
      wantedSetIds: ['10316'],
    };

    expect(isAuthenticatedSession(userSession)).toBe(true);
    expect(getCollectorSetCounts(userSession)).toEqual({
      ownedCount: 2,
      wantedCount: 1,
    });
  });
});
