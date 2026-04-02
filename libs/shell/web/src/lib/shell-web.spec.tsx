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
    expect(markup).toContain('Discover');
    expect(markup).toContain('Themes');
    expect(markup).toContain('Open profile');
    expect(markup).toContain('Open saved lists');
    expect(markup).toContain('Profile');
    expect(markup).toContain('Lists');
    expect(markup).toContain('Skip to main content');
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('for="site-search-desktop"');
    expect(markup).toContain('id="site-search-desktop"');
    expect(markup).toContain('aria-label="Open search"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('Search sets or set number');
    expect(markup).not.toContain('id="site-search-mobile"');
    expect(markup).toContain('href="/account"');
    expect(markup).toContain('href="/wishlist"');
    expect(markup).toContain(
      'Brickhunt helps you browse standout sets, compare reviewed Dutch offers',
    );
    expect(markup).not.toContain('Home');
    expect(markup).not.toContain('Featured shortlist');
    expect(markup).not.toContain('Checking');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Sign out');
  });
});
