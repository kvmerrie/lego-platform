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

    expect(markup).toContain('Owned saved.');
    expect(markup).toContain('Owned saved');
    expect(markup).not.toContain('Private collector state');
    expect(markup).toContain('Your collector account is up to date.');
    expect(markup).toContain('Private to you. Set facts stay public.');
    expect(markup).toContain('Remove from owned');
  });

  it('renders a compact product-page variant for set detail actions', () => {
    const markup = renderToStaticMarkup(
      <OwnedSetToggleCard
        hasResolvedState
        isOwned={false}
        setId="10316"
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).not.toContain('Owned');
    expect(markup).not.toContain('Save to owned');
    expect(markup).not.toContain('Private to you.');
    expect(markup).not.toContain('Not saved yet');
    expect(markup).toContain('Save as owned');
    expect(markup).not.toContain('Private collector state');
  });
});

describe('CollectorCollectionPanel', () => {
  it('renders a clear signed-out state for the private collection route', () => {
    const markup = renderToStaticMarkup(
      <CollectorCollectionPanel state="signed-out" />,
    );

    expect(markup).toContain('Sign in to open your private collection');
    expect(markup).toContain('Private account area');
    expect(markup).toContain('Browse catalog');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open wishlist');
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

    expect(markup).toContain('Alex Rivera, here is your collection');
    expect(markup).toContain('2 visible');
    expect(markup).toContain('1 outside public catalog');
    expect(markup).toContain('Owned set card');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open wishlist');
    expect(markup).not.toContain('Owned collection');
  });
});
