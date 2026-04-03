import { describe, expect, test } from 'vitest';
import {
  createCollectorProfileDraft,
  createAnonymousUserSession,
  getCollectorSetCounts,
  getUserSetState,
  isAuthenticatedSession,
  listUserSetStates,
  UserSession,
  validateUpdateCollectorProfileInput,
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
      notificationPreferences: {
        wishlistDealAlerts: true,
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
        setStateTimingBySetId: {
          '10316': {
            createdAt: '2026-04-01T09:00:00.000Z',
            updatedAt: '2026-04-01T09:00:00.000Z',
          },
          '42177': {
            createdAt: '2026-04-02T09:00:00.000Z',
            updatedAt: '2026-04-03T09:00:00.000Z',
          },
        },
        wantedSetIds: ['21348', '42177'],
      }),
    ).toEqual([
      {
        createdAt: '2026-04-01T09:00:00.000Z',
        setId: '10316',
        state: 'owned',
        updatedAt: '2026-04-01T09:00:00.000Z',
      },
      {
        setId: '21348',
        state: 'owned',
      },
      {
        createdAt: '2026-04-02T09:00:00.000Z',
        setId: '42177',
        state: 'wishlist',
        updatedAt: '2026-04-03T09:00:00.000Z',
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

  test('keeps wishlist deal alerts enabled by default in normalized profile input', () => {
    expect(
      validateUpdateCollectorProfileInput({
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        location: 'Amsterdam',
        collectionFocus: 'Display-scale fantasy and castle icons',
      }),
    ).toEqual({
      displayName: 'Alex Rivera',
      collectorHandle: 'alex-rivera',
      location: 'Amsterdam',
      collectionFocus: 'Display-scale fantasy and castle icons',
      wishlistDealAlerts: true,
    });

    expect(
      createCollectorProfileDraft({
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        location: 'Amsterdam',
        collectionFocus: 'Display-scale fantasy and castle icons',
        tier: 'Founding Collector',
        email: 'collector@example.com',
        wishlistDealAlerts: false,
      }),
    ).toEqual({
      displayName: 'Alex Rivera',
      collectorHandle: 'alex-rivera',
      location: 'Amsterdam',
      collectionFocus: 'Display-scale fantasy and castle icons',
      wishlistDealAlerts: false,
    });
  });
});
