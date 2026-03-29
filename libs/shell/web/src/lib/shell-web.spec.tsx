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

    expect(markup).toContain('Curated public browse');
    expect(markup).toContain('Collector destinations');
    expect(markup).toContain('Public browse');
    expect(markup).toContain('Curated discovery and featured sets.');
    expect(markup).toContain(
      'Private destinations for owned, wanted, and signed-in collector state.',
    );
    expect(markup).toContain('Home');
    expect(markup).toContain('Featured sets');
    expect(markup).toContain('My collection');
    expect(markup).toContain('My wishlist');
    expect(markup).toContain('Public route');
    expect(markup).toContain('Private route');
  });
});
