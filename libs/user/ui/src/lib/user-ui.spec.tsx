import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  UserProfileEditorCard,
  UserSessionCard,
  UserShellAccountStatusCard,
} from './user-ui';

describe('UserShellAccountStatusCard', () => {
  it('renders a clear signed-out collector status surface for the shell', () => {
    const markup = renderToStaticMarkup(
      <UserShellAccountStatusCard
        isAuthAvailable
        userSession={{
          state: 'anonymous',
          ownedSetIds: [],
          setStates: [],
          wantedSetIds: [],
        }}
      />,
    );

    expect(markup).toContain('Sign in to save sets');
    expect(markup).toContain(
      'Sign in with email and password or Google to keep collection, wishlist, and collector details in one place.',
    );
    expect(markup).toContain('Sign in to save privately');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain('signed out');
  });

  it('renders a signed-in collector summary with collection and wishlist access', () => {
    const markup = renderToStaticMarkup(
      <UserShellAccountStatusCard
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Alex Rivera');
    expect(markup).toContain('@brick-curator');
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wishlist saved');
    expect(markup).toContain('Open collection (2)');
    expect(markup).toContain('Open wishlist (1)');
    expect(markup).toContain('Sign out');
    expect(markup).toContain(
      'Your saved sets and collector details are one click away.',
    );
    expect(markup).toContain('Signed in · Founding Collector');
  });
});

describe('UserSessionCard', () => {
  it('renders email and password auth as the primary signed-out account flow', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        authEmail="collector@example.com"
        authMode="sign-in"
        authPassword="super-secret"
        isAuthAvailable
        userSession={{
          state: 'anonymous',
          ownedSetIds: [],
          setStates: [],
          wantedSetIds: [],
        }}
      />,
    );

    expect(markup).toContain('Sign in to open your account');
    expect(markup).toContain(
      'Sign in with email and password first. Google is available when this environment supports it, and magic link stays here as a fallback.',
    );
    expect(markup).toContain('Email address');
    expect(markup).toContain('Password');
    expect(markup).toContain('Continue with Google');
    expect(markup).toContain('Create an account');
    expect(markup).toContain('Forgot password?');
    expect(markup).toContain('Use a magic link instead');
    expect(markup).toContain(
      'Account sign-in only unlocks private collector state.',
    );
  });

  it('renders a more productized signed-in collector account surface', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Your account');
    expect(markup).toContain('<h1');
    expect(markup).toContain(
      'Collection, wishlist, and account details in one place.',
    );
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wishlist saved');
    expect(markup).toContain('Sign-in email');
    expect(markup).toContain('Collector handle');
    expect(markup).toContain('Your saves');
    expect(markup).toContain('Open collection (2)');
    expect(markup).toContain('Open wishlist (1)');
    expect(markup).toContain('Used for sign-in and account recovery.');
    expect(markup).toContain(
      'Your saves stay private. Set pages and price checks stay public.',
    );
    expect(markup).toContain('Account · Founding Collector');
  });

  it('renders a password reset form inside the signed-in account view when recovery is active', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        isPasswordRecoveryMode
        passwordRecoveryConfirmation="new-password"
        passwordRecoveryValue="new-password"
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Finish resetting your password');
    expect(markup).toContain(
      'Choose a new password for this account. Your collection and wishlist stay in place.',
    );
    expect(markup).toContain('New password');
    expect(markup).toContain('Confirm new password');
    expect(markup).toContain('Save new password');
  });
});

describe('UserProfileEditorCard', () => {
  it('renders clearer supporting copy for the collector profile surface', () => {
    const markup = renderToStaticMarkup(
      <UserProfileEditorCard
        collectorProfile={{
          displayName: 'Alex Rivera',
          collectorHandle: 'alex-rivera',
          location: 'Amsterdam',
          collectionFocus: 'Display-scale fantasy and castle icons',
          tier: 'Founding Collector',
          email: 'collector@example.com',
          wishlistDealAlerts: true,
        }}
        draft={{
          displayName: 'Alex Rivera',
          collectorHandle: 'alex-rivera',
          location: 'Amsterdam',
          collectionFocus: 'Display-scale fantasy and castle icons',
          wishlistDealAlerts: true,
        }}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain('Edit your collector details');
    expect(markup).toContain(
      'Update the name and details shown on your account and saved sets.',
    );
    expect(markup).toContain('Shown on your account and saved sets.');
    expect(markup).toContain('Letters, numbers, and hyphens only.');
    expect(markup).toContain('Private sign-in email.');
    expect(markup).toContain('Shown in your collector area.');
    expect(markup).toContain(
      'One short line about the sets and themes you follow.',
    );
    expect(markup).toContain(
      'Notify me when a wishlist set becomes a better deal',
    );
    expect(markup).toContain(
      'This only saves your preference for future wishlist deal alerts.',
    );
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('checked=""');
  });
});
