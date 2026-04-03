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
        successMessage="Added to your wishlist. Your collector account is up to date."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('In wishlist');
    expect(markup).toContain('In wishlist');
    expect(markup).not.toContain('Private collector state');
    expect(markup).toContain('Your collector account is up to date.');
    expect(markup).toContain('Private save. Set facts stay public.');
    expect(markup).toContain('Remove from wishlist');
  });

  it('renders a compact product-page variant for set detail actions', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isWanted={false}
        setId="21348"
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).not.toContain('Wishlist');
    expect(markup).not.toContain('Save to wishlist');
    expect(markup).not.toContain('Private to you.');
    expect(markup).not.toContain('Not saved yet');
    expect(markup).toContain('Add to wishlist');
    expect(markup).not.toContain('Private collector state');
  });
});

describe('CollectorWishlistPanel', () => {
  it('renders a clear signed-out state for the private wishlist route', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel state="signed-out" />,
    );

    expect(markup).toContain('Sign in to see your wishlist');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Sign in to save privately');
    expect(markup).toContain('Browse catalog');
    expect(markup).toContain('Browse themes');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open collection');
  });

  it('renders populated wishlist context with hidden-set messaging when needed', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel
        collectorName="Alex Rivera"
        controls={<button type="button">Recent</button>}
        hiddenWantedCount={1}
        statusMessage="Rivendell moved to your collection."
        state="populated"
        wantedCount={2}
      >
        <article>Wanted set card</article>
      </CollectorWishlistPanel>,
    );

    expect(markup).toContain('Your wishlist');
    expect(markup).toContain('<h1');
    expect(markup).toContain('2 in wishlist');
    expect(markup).toContain('1 outside today&#x27;s catalog');
    expect(markup).toContain('Wanted set card');
    expect(markup).toContain('Recent');
    expect(markup).toContain('Rivendell moved to your collection.');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open collection');
    expect(markup).toContain('Browse themes');
  });
});
