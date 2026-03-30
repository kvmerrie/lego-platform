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
          wantedSetIds: [],
        }}
      />,
    );

    expect(markup).toContain('Sign in to start saving privately');
    expect(markup).toContain('Sign in once to save your collection');
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
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Alex Rivera');
    expect(markup).toContain('@brick-curator');
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wanted saved');
    expect(markup).toContain('Open collection');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain('Sign out');
    expect(markup).toContain('Your private collector state is ready.');
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
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Collector account ready');
    expect(markup).toContain(
      'Your owned sets, wishlist, and profile stay private to you.',
    );
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wanted saved');
    expect(markup).toContain('Private account');
    expect(markup).toContain('Collector identity');
    expect(markup).toContain('Collector destinations');
    expect(markup).toContain('Open collection');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain('For sign-in and private saves.');
    expect(markup).toContain(
      'Owned sets and wishlist stay private. Set facts and pricing stay public.',
    );
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

    expect(markup).toContain('Shape your collector profile');
    expect(markup).toContain(
      'Edit the collector details shown with your saved sets.',
    );
    expect(markup).toContain('Shown on your collector card.');
    expect(markup).toContain('Letters, numbers, and hyphens only.');
    expect(markup).toContain('Private sign-in email.');
    expect(markup).toContain('Shown with your signed-in account.');
    expect(markup).toContain(
      'One short line about the sets and themes you follow.',
    );
  });
});
