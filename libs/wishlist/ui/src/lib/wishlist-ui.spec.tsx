import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectorWishlistPanel, WantedSetToggleCard } from './wishlist-ui';

describe('WantedSetToggleCard', () => {
  it('renders clear saved-state confirmation for wanted sets', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isWanted
        setId="21348"
        successMessage="Saved to your private wanted list. Your collector account is up to date."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Wishlist saved.');
    expect(markup).toContain('Wanted saved');
    expect(markup).toContain('Private collector state');
    expect(markup).toContain('Your collector account is up to date.');
    expect(markup).toContain('Private to you. Set facts stay public.');
    expect(markup).toContain('Remove from wanted');
  });
});

describe('CollectorWishlistPanel', () => {
  it('renders a clear signed-out state for the private wishlist route', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel state="signed-out" />,
    );

    expect(markup).toContain('Sign in to open your private wishlist');
    expect(markup).toContain('Private collector page');
    expect(markup).toContain('Wishlist');
    expect(markup).toContain('Browse featured sets');
    expect(markup).toContain('Open collection');
  });

  it('renders populated wishlist context with hidden-set messaging when needed', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel
        collectorName="Alex Rivera"
        hiddenWantedCount={1}
        state="populated"
        wantedCount={2}
      >
        <article>Wanted set card</article>
      </CollectorWishlistPanel>,
    );

    expect(markup).toContain('Alex Rivera, here is your wishlist');
    expect(markup).toContain('2 visible');
    expect(markup).toContain('Wishlist');
    expect(markup).toContain('1 outside public catalog');
    expect(markup).toContain('Wanted set card');
    expect(markup).toContain('Open collection');
  });
});
