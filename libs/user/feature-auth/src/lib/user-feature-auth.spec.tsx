/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UserFeatureAuth,
  resolveUserAuthPostAuthRedirectPath,
} from './user-feature-auth';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const userDataAccessMocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  isUserAuthAvailable: vi.fn(),
  requestUserSignIn: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  signUpWithEmailPassword: vi.fn(),
  subscribeToUserAccountChanges: vi.fn(),
  subscribeToUserAuthChanges: vi.fn(),
  updateCurrentUserPassword: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@lego-platform/user/data-access', () => userDataAccessMocks);

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  warnAboutMissingBrowserSupabaseConfig: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}));

const anonymousSession = {
  state: 'anonymous',
  ownedSetIds: [],
  setStates: [],
  wantedSetIds: [],
};

const authenticatedSession = {
  state: 'authenticated',
  account: {
    email: 'collector@example.com',
    userId: 'user-1',
  },
  collector: {
    collectionFocus: 'Icons',
    id: 'collector',
    location: 'Amsterdam',
    name: 'Collector',
    tier: 'Collector',
  },
  notificationPreferences: {
    wishlistDealAlerts: false,
  },
  ownedSetIds: [],
  setStates: [],
  wantedSetIds: [],
};

describe('UserFeatureAuth post-auth redirect', () => {
  let container: HTMLDivElement;
  let root: Root;
  let assignSpy: ReturnType<typeof vi.fn>;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;
  let authChangeListener: (() => void) | undefined;
  let accountChangeListener: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    assignSpy = vi.fn();
    authChangeListener = undefined;
    accountChangeListener = undefined;
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        assign: assignSpy,
        search:
          '?next=%2Fsets%2Fnew-york-city-the-big-apple-21066%23productbeoordelingen',
      },
    });

    userDataAccessMocks.isUserAuthAvailable.mockReturnValue(true);
    userDataAccessMocks.subscribeToUserAuthChanges.mockImplementation(
      (listener: () => void) => {
        authChangeListener = listener;

        return () => undefined;
      },
    );
    userDataAccessMocks.subscribeToUserAccountChanges.mockImplementation(
      (listener: () => void) => {
        accountChangeListener = listener;

        return () => undefined;
      },
    );
    userDataAccessMocks.signInWithEmailPassword.mockResolvedValue(undefined);
    userDataAccessMocks.signUpWithEmailPassword.mockResolvedValue({
      requiresEmailConfirmation: false,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('redirects with Next router.replace to a valid set-detail anchor after auth succeeds', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await act(async () => {
      root.render(<UserFeatureAuth />);
    });

    expect(routerMocks.replace).toHaveBeenCalledWith(
      '/sets/new-york-city-the-big-apple-21066#productbeoordelingen',
    );
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does not use history.replaceState for post-auth next redirects', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await act(async () => {
      root.render(<UserFeatureAuth />);
    });

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('ignores an invalid external next path', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await act(async () => {
      root.render(<UserFeatureAuth postAuthRedirectPath="https://evil.test" />);
    });

    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('preserves hash fragments when sanitizing next paths', () => {
    expect(
      resolveUserAuthPostAuthRedirectPath(
        '/sets/new-york-city-the-big-apple-21066#productbeoordelingen',
      ),
    ).toBe('/sets/new-york-city-the-big-apple-21066#productbeoordelingen');
  });

  it('redirects directly when the account page already has an authenticated session', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await act(async () => {
      root.render(<UserFeatureAuth />);
    });

    expect(routerMocks.replace).toHaveBeenCalledWith(
      '/sets/new-york-city-the-big-apple-21066#productbeoordelingen',
    );
  });

  it('redirects at most once across auth and account refresh events', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await act(async () => {
      root.render(<UserFeatureAuth />);
    });
    await act(async () => {
      authChangeListener?.();
      accountChangeListener?.();
    });

    expect(routerMocks.replace).toHaveBeenCalledTimes(1);
  });
});
