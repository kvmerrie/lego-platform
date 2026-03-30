import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShellWeb } from './shell-web';

describe('ShellWeb', () => {
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
