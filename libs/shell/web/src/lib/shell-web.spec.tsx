import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  getFollowLinkLabel,
  getFollowingNavPageSurface,
} from './shell-web-follow-link';
import { ShellWeb } from './shell-web';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

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
    expect(markup).toContain('Volgt');
    expect(markup).toContain('Ga naar account');
    expect(markup).toContain('Ga naar lijsten');
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
    expect(markup).toContain('href="/volgt"');
    expect(markup).toContain('href="/account/wishlist"');
    expect(markup).toContain(
      'Brickhunt laat snel zien welke doos je wilt hebben',
    );
    expect(markup).toContain('waar de prijs nu goed zit');
    expect(markup).not.toContain('Home');
    expect(markup).not.toContain('Featured shortlist');
    expect(markup).not.toContain('Checking');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Sign out');
  });
});

describe('getFollowLinkLabel', () => {
  it('shows only the follow label when there are no followed sets', () => {
    expect(getFollowLinkLabel({})).toBe('Volgt');
    expect(
      getFollowLinkLabel({
        followedSetCount: 0,
        interestingSetCount: 0,
      }),
    ).toBe('Volgt');
  });

  it('shows only the total count when nothing is interesting now', () => {
    expect(
      getFollowLinkLabel({
        followedSetCount: 3,
        interestingSetCount: 0,
      }),
    ).toBe('Volgt (3)');
  });

  it('adds a subtle return trigger when something is interesting now', () => {
    expect(
      getFollowLinkLabel({
        followedSetCount: 3,
        interestingSetCount: 1,
      }),
    ).toBe('Volgt (3) · 1 nu interessant');
  });
});

describe('getFollowingNavPageSurface', () => {
  it('maps core routes to stable page surfaces', () => {
    expect(getFollowingNavPageSurface('/')).toBe('homepage');
    expect(getFollowingNavPageSurface('/discover')).toBe('discover');
    expect(getFollowingNavPageSurface('/search')).toBe('search');
    expect(getFollowingNavPageSurface('/sets/rivendell-10316')).toBe(
      'set_detail',
    );
    expect(getFollowingNavPageSurface('/themes/icons')).toBe('theme_page');
    expect(getFollowingNavPageSurface('/volgt')).toBe('following');
    expect(getFollowingNavPageSurface('/hoe-werkt-het')).toBe('how_it_works');
    expect(getFollowingNavPageSurface('/iets-anders')).toBe('other');
  });
});
