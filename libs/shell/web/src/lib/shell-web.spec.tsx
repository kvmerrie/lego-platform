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

    expect(markup).toContain('Start with set discovery');
    expect(markup).toContain('Save privately as you go');
    expect(markup).toContain('Start here');
    expect(markup).toContain(
      'Browse the curated homepage and featured shortlist first.',
    );
    expect(markup).toContain(
      'Private follow-through after you start saving sets.',
    );
    expect(markup).toContain('Home');
    expect(markup).toContain('Featured shortlist');
    expect(markup).toContain('Collection');
    expect(markup).toContain('Wishlist');
    expect(markup).toContain('Public route');
    expect(markup).toContain('Private route');
  });
});
