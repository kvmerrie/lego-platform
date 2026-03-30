import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectorCollectionPanel, OwnedSetToggleCard } from './collection-ui';

describe('OwnedSetToggleCard', () => {
  it('renders clear saved-state confirmation for owned sets', () => {
    const markup = renderToStaticMarkup(
      <OwnedSetToggleCard
        hasResolvedState
        isOwned
        setId="10316"
        successMessage="Saved to your private owned collection. Your collector account is up to date."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Saved to your owned collection.');
    expect(markup).toContain('Owned saved');
    expect(markup).toContain('Private collector state');
    expect(markup).toContain('Your collector account is up to date.');
    expect(markup).toContain(
      'Private to your account. Public set facts and pricing stay shared.',
    );
    expect(markup).toContain('Remove from owned');
  });
});

describe('CollectorCollectionPanel', () => {
  it('renders a clear signed-out state for the private collection route', () => {
    const markup = renderToStaticMarkup(
      <CollectorCollectionPanel state="signed-out" />,
    );

    expect(markup).toContain('Sign in to view your private owned collection');
    expect(markup).toContain('Private collector page');
    expect(markup).toContain('Browse featured sets');
    expect(markup).toContain('Open wishlist');
    expect(markup).toContain('Owned sets stay separate from your wishlist.');
  });

  it('renders populated collection context with hidden-set messaging when needed', () => {
    const markup = renderToStaticMarkup(
      <CollectorCollectionPanel
        collectorName="Alex Rivera"
        hiddenOwnedCount={1}
        ownedCount={2}
        state="populated"
      >
        <article>Owned set card</article>
      </CollectorCollectionPanel>,
    );

    expect(markup).toContain('Alex Rivera, here is your owned collection');
    expect(markup).toContain('2 visible');
    expect(markup).toContain('1 outside public slice');
    expect(markup).toContain('Owned set card');
    expect(markup).toContain('Open wishlist');
  });
});
