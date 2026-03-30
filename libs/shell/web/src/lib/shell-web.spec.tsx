import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShellWeb } from './shell-web';

describe('ShellWeb', () => {
  it('renders grouped public and collector destinations in the primary navigation', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb>
        <div>Collector page content</div>
      </ShellWeb>,
    );

    expect(markup).toContain('Browse curated sets');
    expect(markup).toContain('Save privately');
    expect(markup).toContain('Start here');
    expect(markup).toContain('Curated homepage and featured shortlist.');
    expect(markup).toContain('Private saves, collection, and wishlist.');
    expect(markup).toContain('Home');
    expect(markup).toContain('Featured shortlist');
    expect(markup).toContain('Collection');
    expect(markup).toContain('Wishlist');
    expect(markup).toContain('Public route');
    expect(markup).toContain('Private route');
    expect(markup).toContain('Checking collector status');
    expect(markup).toContain('Collector status');
  });
});
