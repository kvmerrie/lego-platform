import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShellWebAccountStatus } from './shell-web-account-status';
import { ShellWeb } from './shell-web';

describe('ShellWeb', () => {
  it('renders a stable bootstrapping placeholder for the shell account area', () => {
    const markup = renderToStaticMarkup(
      <ShellWebAccountStatus variant="header" />,
    );

    expect(markup).toContain('Checking');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Sign out');
  });

  it('renders a compact shell header with direct nav links and account access', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb>
        <div>Collector page content</div>
      </ShellWeb>,
    );

    expect(markup).toContain('Brick Ledger');
    expect(markup).toContain('Menu');
    expect(markup).toContain('Home');
    expect(markup).toContain('Featured shortlist');
    expect(markup).toContain('Collection');
    expect(markup).toContain('Wishlist');
    expect(markup).toContain('Checking');
    expect(markup).toContain('Curated browsing, private collector saves');
  });
});
