import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShellWeb } from './shell-web';

describe('ShellWeb', () => {
  it('renders a compact retail-style shell header with browse nav and icon actions', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb>
        <div>Collector page content</div>
      </ShellWeb>,
    );

    expect(markup).toContain('Brickhunt');
    expect(markup).toContain('Menu');
    expect(markup).toContain('Ontdekken');
    expect(markup).toContain('Thema&#x27;s');
    expect(markup).toContain('Open account');
    expect(markup).toContain('Open saved lists');
    expect(markup).toContain('Account');
    expect(markup).toContain('Lijsten');
    expect(markup).toContain('Ga direct naar de hoofdinhoud');
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('for="site-search-desktop"');
    expect(markup).toContain('id="site-search-desktop"');
    expect(markup).toContain('aria-label="Open zoeken"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('Zoek op set of setnummer');
    expect(markup).not.toContain('id="site-search-mobile"');
    expect(markup).toContain('href="/account"');
    expect(markup).toContain('href="/account/wishlist"');
    expect(markup).toContain(
      'Brickhunt helpt je opvallende sets te ontdekken, reviewed Nederlandse aanbiedingen',
    );
    expect(markup).not.toContain('Home');
    expect(markup).not.toContain('Featured shortlist');
    expect(markup).not.toContain('Checking');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Sign out');
  });
});
