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
      'Sign in once to keep collection, wishlist, and collector details in one place.',
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
    expect(markup).toContain('Used only for sign-in links.');
    expect(markup).toContain(
      'Your saves stay private. Set pages and price checks stay public.',
    );
    expect(markup).toContain('Account · Founding Collector');
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
        }}
        draft={{
          displayName: 'Alex Rivera',
          collectorHandle: 'alex-rivera',
          location: 'Amsterdam',
          collectionFocus: 'Display-scale fantasy and castle icons',
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
  });
});
