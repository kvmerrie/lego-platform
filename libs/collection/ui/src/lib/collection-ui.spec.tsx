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
        successMessage="Gemarkeerd als in collectie. Je verzamelaarsaccount is bijgewerkt."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('In collectie');
    expect(markup).not.toContain('Private collector state');
    expect(markup).toContain('Je verzamelaarsaccount is bijgewerkt.');
    expect(markup).toContain(
      'Prive opgeslagen. Setinformatie blijft openbaar.',
    );
    expect(markup).toContain('Uit collectie verwijderen');
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
    expect(markup).toContain('Markeer als in collectie');
    expect(markup).not.toContain('Private collector state');
  });
});

describe('CollectorCollectionPanel', () => {
  it('renders a clear signed-out state for the private collection route', () => {
    const markup = renderToStaticMarkup(
      <CollectorCollectionPanel state="signed-out" />,
    );

    expect(markup).toContain('Log in om je collectie te bekijken');
    expect(markup).toContain('<h1');
    expect(markup).toContain('Log in om prive op te slaan');
    expect(markup).toContain('Bekijk catalogus');
    expect(markup).toContain('Bekijk thema&#x27;s');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open verlanglijst');
  });

  it('renders populated collection context with hidden-set messaging when needed', () => {
    const markup = renderToStaticMarkup(
      <CollectorCollectionPanel
        collectorName="Alex Rivera"
        controls={<button type="button">Thema</button>}
        hiddenOwnedCount={1}
        ownedCount={2}
        statusMessage="Rivendell is uit je collectie verwijderd."
        state="populated"
      >
        <article>Owned set card</article>
      </CollectorCollectionPanel>,
    );

    expect(markup).toContain('Je collectie');
    expect(markup).toContain('<h1');
    expect(markup).toContain('2 in collectie');
    expect(markup).toContain('1 buiten de catalogus van vandaag');
    expect(markup).toContain('Owned set card');
    expect(markup).toContain('Thema');
    expect(markup).toContain('Rivendell is uit je collectie verwijderd.');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open verlanglijst');
    expect(markup).toContain('Bekijk thema&#x27;s');
    expect(markup).not.toContain('Owned collection');
  });
});
