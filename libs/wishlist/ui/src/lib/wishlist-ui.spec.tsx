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
        successMessage="Toegevoegd aan je verlanglijst. Je verzamelaarsaccount is bijgewerkt."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Op verlanglijst');
    expect(markup).toContain('Op verlanglijst');
    expect(markup).not.toContain('Private collector state');
    expect(markup).toContain('Je verzamelaarsaccount is bijgewerkt.');
    expect(markup).toContain(
      'Prive opgeslagen. Setinformatie blijft openbaar.',
    );
    expect(markup).toContain('Van verlanglijst verwijderen');
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
    expect(markup).toContain('Aan verlanglijst toevoegen');
    expect(markup).not.toContain('Private collector state');
  });
});

describe('CollectorWishlistPanel', () => {
  it('renders a clear signed-out state for the private wishlist route', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel state="signed-out" />,
    );

    expect(markup).toContain('Log in om je verlanglijst te bekijken');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Log in om prive op te slaan');
    expect(markup).toContain('Bekijk catalogus');
    expect(markup).toContain('Bekijk thema&#x27;s');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open collectie');
  });

  it('renders populated wishlist context with hidden-set messaging when needed', () => {
    const markup = renderToStaticMarkup(
      <CollectorWishlistPanel
        collectorName="Alex Rivera"
        controls={<button type="button">Recent</button>}
        hiddenWantedCount={1}
        statusMessage="Rivendell is naar je collectie verplaatst."
        state="populated"
        wantedCount={2}
      >
        <article>Wanted set card</article>
      </CollectorWishlistPanel>,
    );

    expect(markup).toContain('Je verlanglijst');
    expect(markup).toContain('<h1');
    expect(markup).toContain('2 op verlanglijst');
    expect(markup).toContain('1 buiten de catalogus van vandaag');
    expect(markup).toContain('Wanted set card');
    expect(markup).toContain('Recent');
    expect(markup).toContain('Rivendell is naar je collectie verplaatst.');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open collectie');
    expect(markup).toContain('Bekijk thema&#x27;s');
  });
});
