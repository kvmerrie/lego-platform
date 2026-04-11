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
        successMessage="Deze set staat nu op je verlanglijst."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Op verlanglijst');
    expect(markup).toContain('Op verlanglijst');
    expect(markup).not.toContain('Private collector state');
    expect(markup).toContain('Deze set staat nu op je verlanglijst.');
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

  it('supports a price-alert CTA label on set detail pages', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        alertsEnabled={false}
        hasResolvedState
        isWanted={false}
        productIntent="price-alert"
        setId="21348"
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).not.toContain('Aan verlanglijst toevoegen');
    expect(markup).toContain(
      'Volg deze prijs. Dan zie je sneller wanneer dit een beter moment wordt.',
    );
  });

  it('shows a clearer service state after following a price on set detail', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        alertsEnabled
        followedSetCount={4}
        hasResolvedState
        isWanted
        productIntent="price-alert"
        setId="21348"
        successMessage="Brickhunt houdt deze set nu voor je in de gaten."
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain(
      'Brickhunt houdt deze set nu voor je in de gaten.',
    );
    expect(markup).toContain(
      'Brickhunt houdt deze set nu voor je in de gaten. We laten het weten als dit een beter moment wordt.',
    );
    expect(markup).toContain('Volgt prijs');
    expect(markup).toContain('Je volgt nu 4 sets · Bekijk');
    expect(markup).toContain('href="/volgt"');
  });

  it('guides logged-out users softly toward login instead of a hard follow error', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isAuthenticated={false}
        isWanted={false}
        productIntent="price-alert"
        setId="21348"
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Volg prijs');
    expect(markup).toContain(
      'Volg deze prijs. Dan zie je sneller wanneer dit een beter moment wordt.',
    );
    expect(markup).not.toContain('Log in om te volgen');
  });

  it('shows an immediate local follow state for logged-out price follows', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isAuthenticated={false}
        isWanted
        productIntent="price-alert"
        setId="21348"
        successMessage="Brickhunt houdt deze set nu voor je in de gaten."
        variant="product"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain(
      'Brickhunt houdt deze set nu voor je in de gaten.',
    );
    expect(markup).toContain('Volgt prijs');
    expect(markup).toContain(
      'Brickhunt houdt deze set nu op dit apparaat voor je in de gaten. Log in om deze set op al je apparaten te volgen.',
    );
    expect(markup).toContain('Bekijk gevolgde sets');
    expect(markup).toContain('href="/volgt"');
    expect(markup).toContain('Log in voor al je apparaten');
  });

  it('renders a lighter inline variant for homepage follow-later actions', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isWanted={false}
        productIntent="price-alert"
        setId="21348"
        variant="inline"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Volg');
    expect(markup).toContain('aria-label="Volg"');
    expect(markup).not.toContain('Zet prijsalert aan');
    expect(markup).not.toContain('Aan verlanglijst toevoegen');
  });

  it('uses a filled icon for followed inline price states so cards read faster at a glance', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isWanted
        productIntent="price-alert"
        setId="21348"
        variant="inline"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Volgt');
    expect(markup).toContain('fill="currentColor"');
  });

  it('keeps the inline loading state compact instead of expanding to a long status label', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isLoading
        isWanted={false}
        productIntent="price-alert"
        setId="21348"
        variant="inline"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Volg');
    expect(markup).toContain('data-loading="true"');
    expect(markup).not.toContain('Controleren...');
    expect(markup).not.toContain('Volgen...');
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
    expect(markup).toContain(
      'Hier zie je sneller welke opnieuw de moeite waard zijn om te checken.',
    );
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
    expect(markup).toContain(
      'Hier zie je sneller welke opnieuw de moeite waard zijn om te checken.',
    );
    expect(markup).toContain('Wanted set card');
    expect(markup).toContain('Recent');
    expect(markup).toContain('Rivendell is naar je collectie verplaatst.');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open collectie');
    expect(markup).toContain('Bekijk thema&#x27;s');
  });
});
