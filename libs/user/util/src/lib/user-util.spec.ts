import { describe, expect, test } from 'vitest';
import {
  createAnonymousUserSession,
  getCollectorSetCounts,
  getUserSetState,
  isAuthenticatedSession,
  listUserSetStates,
  UserSession,
} from './user-util';

describe('user session contracts', () => {
  test('builds an anonymous session with empty set preferences', () => {
    expect(createAnonymousUserSession()).toEqual({
      state: 'anonymous',
      ownedSetIds: [],
      setStates: [],
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
      setStates: [
        {
          setId: '10316',
          state: 'owned',
        },
        {
          setId: '21348',
          state: 'owned',
        },
      ],
      wantedSetIds: ['10316'],
    };

    expect(isAuthenticatedSession(userSession)).toBe(true);
    expect(getCollectorSetCounts(userSession)).toEqual({
      ownedCount: 2,
      wantedCount: 1,
    });
  });

  test('builds a minimal user-set-state list with owned taking precedence', () => {
    expect(
      listUserSetStates({
        ownedSetIds: ['10316', '21348'],
        wantedSetIds: ['21348', '42177'],
      }),
    ).toEqual([
      {
        setId: '10316',
        state: 'owned',
      },
      {
        setId: '21348',
        state: 'owned',
      },
      {
        setId: '42177',
        state: 'wishlist',
      },
    ]);
  });

  test('returns the saved state for one set id', () => {
    expect(
      getUserSetState(
        {
          ownedSetIds: ['10316'],
          wantedSetIds: ['42177'],
        },
        '10316',
      ),
    ).toBe('owned');
    expect(
      getUserSetState(
        {
          ownedSetIds: ['10316'],
          wantedSetIds: ['42177'],
        },
        '42177',
      ),
    ).toBe('wishlist');
    expect(
      getUserSetState(
        {
          ownedSetIds: ['10316'],
          wantedSetIds: ['42177'],
        },
        '21348',
      ),
    ).toBeUndefined();
  });
});
