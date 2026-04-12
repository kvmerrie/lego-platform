import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  advanceShellHeaderRevealState,
  getShellHeaderRevealConfig,
} from './shell-web-header-reveal';
import { getActiveMobileTabId } from './shell-web-mobile-tab-bar';
import { getShellMobileViewportBottomOffset } from './shell-web-mobile-viewport-offset';
import {
  getFollowLinkLabel,
  getFollowingNavPageSurface,
} from './shell-web-follow-link';
import { ShellWeb } from './shell-web';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => ({
    get: () => null,
  }),
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('ShellWeb', () => {
  it('renders a compact retail-style shell header with calm mobile chrome and a shared bottom tab bar', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb>
        <div>Collector page content</div>
      </ShellWeb>,
    );

    expect(markup).toContain('Brickhunt');
    expect(markup).toContain('Ontdekken');
    expect(markup).toContain('Thema&#x27;s');
    expect(markup).toContain('Volgt');
    expect(markup).toContain('Ga naar account');
    expect(markup).toContain('Ga naar lijsten');
    expect(markup).toContain('Account');
    expect(markup).toContain('Ga direct naar de hoofdinhoud');
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('for="site-search-desktop"');
    expect(markup).toContain('id="site-search-desktop"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('Zoek op set of setnummer');
    expect(markup).toContain('href="/account"');
    expect(markup).toContain('href="/volgt"');
    expect(markup).toContain('href="/search?overlay=1"');
    expect(markup).toContain('href="/discover?filter=best-deals"');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="/account/wishlist"');
    expect(markup).toContain('Mobiele tabnavigatie');
    expect(markup).toContain('Deals');
    expect(markup).toContain('Zoeken');
    expect(markup).toContain('Thema&#x27;s');
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

describe('getActiveMobileTabId', () => {
  it('matches search, themes, following, and deals routes to the intended tabs', () => {
    expect(getActiveMobileTabId({ pathname: '/search' })).toBe('search');
    expect(getActiveMobileTabId({ pathname: '/themes' })).toBe('themes');
    expect(getActiveMobileTabId({ pathname: '/themes/icons' })).toBe('themes');
    expect(getActiveMobileTabId({ pathname: '/volgt' })).toBe('following');
    expect(getActiveMobileTabId({ pathname: '/account/wishlist' })).toBe(
      'following',
    );
    expect(
      getActiveMobileTabId({
        pathname: '/discover',
        searchFilter: 'best-deals',
      }),
    ).toBe('deals');
  });

  it('returns no active tab for routes outside the main mobile tab model', () => {
    expect(getActiveMobileTabId({ pathname: '/' })).toBeUndefined();
    expect(getActiveMobileTabId({ pathname: '/discover' })).toBeUndefined();
    expect(
      getActiveMobileTabId({ pathname: '/sets/rivendell-10316' }),
    ).toBeUndefined();
    expect(getActiveMobileTabId({ pathname: '/account' })).toBeUndefined();
    expect(
      getActiveMobileTabId({ pathname: '/hoe-werkt-het' }),
    ).toBeUndefined();
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

describe('getShellMobileViewportBottomOffset', () => {
  it('returns no extra offset when the visual viewport already reaches the bottom', () => {
    expect(
      getShellMobileViewportBottomOffset({
        innerHeight: 844,
        visualViewportHeight: 844,
        visualViewportOffsetTop: 0,
      }),
    ).toBe(0);
  });

  it('returns the bottom chrome inset when the visual viewport is shorter', () => {
    expect(
      getShellMobileViewportBottomOffset({
        innerHeight: 844,
        visualViewportHeight: 780,
        visualViewportOffsetTop: 0,
      }),
    ).toBe(64);
  });

  it('keeps the bottom anchor stable when the visual viewport is also shifted down', () => {
    expect(
      getShellMobileViewportBottomOffset({
        innerHeight: 844,
        visualViewportHeight: 760,
        visualViewportOffsetTop: 24,
      }),
    ).toBe(60);
  });
});

describe('getShellHeaderRevealConfig', () => {
  it('uses more aggressive thresholds on mobile than on desktop', () => {
    expect(getShellHeaderRevealConfig(390)).toEqual({
      hideDistance: 24,
      minDelta: 4,
      showDistance: 14,
      topVisibleOffset: 56,
    });

    expect(getShellHeaderRevealConfig(1280)).toEqual({
      hideDistance: 56,
      minDelta: 6,
      showDistance: 26,
      topVisibleOffset: 96,
    });
  });
});

describe('advanceShellHeaderRevealState', () => {
  it('keeps the header visible near the top of the page', () => {
    expect(
      advanceShellHeaderRevealState({
        currentScrollY: 32,
        state: {
          accumulatedDown: 18,
          accumulatedUp: 0,
          hidden: true,
          lastScrollY: 18,
        },
        viewportWidth: 390,
      }),
    ).toEqual({
      accumulatedDown: 0,
      accumulatedUp: 0,
      hidden: false,
      lastScrollY: 32,
    });
  });

  it('hides faster on mobile and requires a calmer, longer scroll on desktop', () => {
    const mobileHidden = advanceShellHeaderRevealState({
      currentScrollY: 120,
      state: {
        accumulatedDown: 0,
        accumulatedUp: 0,
        hidden: false,
        lastScrollY: 92,
      },
      viewportWidth: 390,
    });

    const desktopStillVisible = advanceShellHeaderRevealState({
      currentScrollY: 152,
      state: {
        accumulatedDown: 0,
        accumulatedUp: 0,
        hidden: false,
        lastScrollY: 120,
      },
      viewportWidth: 1280,
    });

    expect(mobileHidden.hidden).toBe(true);
    expect(desktopStillVisible.hidden).toBe(false);
  });

  it('reveals the header again after a meaningful upward scroll', () => {
    expect(
      advanceShellHeaderRevealState({
        currentScrollY: 212,
        state: {
          accumulatedDown: 0,
          accumulatedUp: 0,
          hidden: true,
          lastScrollY: 242,
        },
        viewportWidth: 1280,
      }),
    ).toEqual({
      accumulatedDown: 0,
      accumulatedUp: 0,
      hidden: false,
      lastScrollY: 212,
    });
  });

  it('forces the header visible while the fullscreen search overlay is open', () => {
    expect(
      advanceShellHeaderRevealState({
        currentScrollY: 420,
        overlayOpen: true,
        state: {
          accumulatedDown: 22,
          accumulatedUp: 0,
          hidden: true,
          lastScrollY: 408,
        },
        viewportWidth: 390,
      }),
    ).toEqual({
      accumulatedDown: 0,
      accumulatedUp: 0,
      hidden: false,
      lastScrollY: 420,
    });
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
