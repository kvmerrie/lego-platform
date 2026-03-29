import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  UserProfileEditorCard,
  UserSessionCard,
} from './user-ui';

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
    expect(markup).toContain('Owned, wanted, and profile changes save back');
    expect(markup).toContain('2 owned saved');
    expect(markup).toContain('1 wanted saved');
    expect(markup).toContain('This collector identity is the source of truth');
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
    expect(markup).toContain('Keep these details concise and recognizable');
    expect(markup).toContain('Use the name you want shown on your collector card.');
    expect(markup).toContain('After saving, this stays product-facing');
    expect(markup).toContain('A short line about the sets and themes you care about most.');
  });
});
