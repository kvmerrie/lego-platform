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

    expect(markup).toContain('Private collector state is not active yet');
    expect(markup).toContain('Browse the public catalog first');
    expect(markup).toContain('Sign in to save privately');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain(
      'Public set facts and reviewed pricing stay visible without an account.',
    );
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
    expect(markup).toContain(
      'Collection, wishlist, and profile are private collector state.',
    );
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

    expect(markup).toContain('Collector account active');
    expect(markup).toContain(
      'Keep browsing the public set pages, then use this signed-in collector account',
    );
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wanted saved');
    expect(markup).toContain('Private account');
    expect(markup).toContain('Collector identity');
    expect(markup).toContain('Collector destinations');
    expect(markup).toContain('Open collection');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain('After you browse a set');
    expect(markup).toContain(
      'Used for sign-in and saved collector state. It is not shown as public catalog information.',
    );
    expect(markup).toContain(
      'Public set facts, pricing guidance, and reviewed offers remain shared catalog surfaces.',
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

    expect(markup).toContain('Refine your collector profile');
    expect(markup).toContain(
      'Display name, handle, location, and collection focus are your collector-facing identity.',
    );
    expect(markup).toContain(
      'Use the name you want shown on your collector card.',
    );
    expect(markup).toContain('After saving, this stays product-facing');
    expect(markup).toContain(
      'Private sign-in email. This is used for account access, not as public catalog identity.',
    );
    expect(markup).toContain('Product-facing account status shown');
    expect(markup).toContain(
      'A short line about the sets and themes you care about most in this signed-in collector area.',
    );
  });
});
