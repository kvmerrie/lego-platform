import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
import { isShellWebNavLinkActive } from './shell-web-nav-link';
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
  const readShellCss = () =>
    readFileSync(
      fileURLToPath(new URL('./shell-web.module.css', import.meta.url)),
      'utf-8',
    );

  it('keeps desktop search wide while layering focused search above the backdrop', () => {
    const css = readShellCss();

    expect(css).toContain('inline-size: clamp(18rem, 32vw, 25rem);');
    expect(css).toContain('max-inline-size: 25rem;');
    expect(css).toContain('.searchBackdrop {');
    expect(css).toContain('background: rgba(12, 18, 32, 0.82);');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('z-index: 1200;');
    expect(css).toContain(
      ":global(html[data-shell-search-open='true']) .header {",
    );
    expect(css).not.toContain('z-index: 1250;');
    expect(css).toContain('.searchOverlayLayer {');
    expect(css).toContain('--shell-navbar-control-height: 2.5rem;');
    expect(css).toContain('.searchShellActive {\n  z-index: 1302;');
    expect(css).toContain('--shell-navbar-control-height: 2.5rem;');
    expect(css).toContain(
      'block-size: var(--shell-navbar-control-height, 2.5rem);',
    );
    expect(css).toContain('.searchPlaceholder {');
    expect(css).toContain('.mobileSearchOverlay {');
    expect(css).toContain('z-index: 1300;');
  });

  it('keeps navbar interactive controls on the same 40px rhythm', () => {
    const css = readShellCss();

    expect(css).toContain('--shell-navbar-control-height: 2.5rem;');
    expect(css).toContain('.brandLink {');
    expect(css).toContain('min-height: var(--shell-navbar-control-height);');
    expect(css).toContain('.brandMark {');
    expect(css).toContain('height: 2.3rem;');
    expect(css).toContain('.navLink {\n  align-items: center;');
    expect(css).toContain('block-size: var(--shell-navbar-control-height);');
    expect(css).toContain('min-height: var(--shell-navbar-control-height);');
    expect(css).toContain('.searchInput {\n  appearance: none;');
    expect(css).toContain(
      'block-size: var(--shell-navbar-control-height, 2.5rem);',
    );
    expect(css).toContain('box-sizing: border-box;');
    expect(css).toContain(
      'max-block-size: var(--shell-navbar-control-height, 2.5rem);',
    );
    expect(css).toContain(
      'min-block-size: var(--shell-navbar-control-height, 2.5rem);',
    );
    expect(css).toContain('.searchInput:focus-visible {');
    expect(css).toContain(
      '.searchInput:focus-visible {\n  block-size: var(--shell-navbar-control-height, 2.5rem);',
    );
    expect(css).toContain('padding: 0 0.92rem 0 2.45rem;');
    expect(css).toContain('.iconActionLink {\n  align-items: center;');
    expect(css).toContain('height: var(--shell-navbar-control-height);');
    expect(css).toContain('width: var(--shell-navbar-control-height);');
  });

  it('aligns icon action hover and focus treatment with desktop nav links', () => {
    const css = readShellCss();

    expect(css).toContain('.navLink:hover,');
    expect(css).toContain(
      '.iconActionLink:hover,\n.iconActionLink:focus-visible {\n  background: color-mix(in srgb, white 34%, transparent);',
    );
    expect(css).toContain(
      '.iconActionLink:focus-visible {\n  box-shadow: 0 0 0 4px var(--lego-focus-ring);',
    );
    expect(css).not.toContain(
      '.iconActionLink:hover,\n.iconActionLink:focus-visible {\n  background: color-mix(in srgb, white 28%, transparent);\n  box-shadow:',
    );
  });

  it('uses the shared section gutter for header and footer alignment', () => {
    const css = readShellCss();

    expect(css).toContain('.shell {\n  --shell-header-height:');
    expect(css).toContain(
      '--lego-section-inline-padding: var(--lego-space-3);',
    );
    expect(css).toMatch(
      /\.headerBar \{\n  align-items: center;[\s\S]*padding-inline: var\(--lego-section-inline-padding\);/u,
    );
    expect(css).toContain(
      '.footerInner {\n  padding-bottom: calc(var(--lego-space-8) + var(--shell-mobile-tabbar-offset));\n  padding-inline: var(--lego-section-inline-padding);',
    );
    expect(css).not.toContain('padding-left: var(--lego-space-6);');
    expect(css).not.toContain('padding-right: var(--lego-space-6);');
  });

  it('renders a compact retail-style shell header with calm mobile chrome and a shared bottom tab bar', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb>
        <div>Collector page content</div>
      </ShellWeb>,
    );

    expect(markup).toContain('Brickhunt');
    expect(markup).toContain('Deals');
    expect(markup).toContain('Thema&#x27;s');
    expect(markup).toContain('Volgt');
    expect(markup.indexOf('Deals')).toBeLessThan(
      markup.indexOf('Thema&#x27;s'),
    );
    expect(markup.indexOf('Thema&#x27;s')).toBeLessThan(
      markup.indexOf('Volgt'),
    );
    expect(markup).toContain('Ga naar account');
    expect(markup).toContain('Ga naar lijsten');
    expect(markup).toContain('Account');
    expect(markup).toContain('Ga direct naar de hoofdinhoud');
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('for="site-search-desktop"');
    expect(markup).toContain('id="site-search-desktop"');
    expect(markup).toContain('id="shell-desktop-account-action"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('Zoek op set of setnummer');
    expect(markup).toContain('href="/account"');
    expect(markup).toContain('href="/volgt"');
    expect(markup).not.toContain('href="/artikelen"');
    expect(markup).toContain('href="/search?overlay=1"');
    expect(markup).toContain('href="/deals"');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="/account/wishlist"');
    expect(markup).toContain('Mobiele tabnavigatie');
    expect(markup).toContain('Deals');
    expect(markup).toContain('Zoeken');
    expect(markup).toContain('Thema&#x27;s');
    const mobileTabbarMarkup = markup.slice(
      markup.indexOf('Mobiele tabnavigatie'),
    );
    const mobileTabbarHrefs = [
      ...mobileTabbarMarkup.matchAll(/href="([^"]+)"/g),
    ].map((match) => match[1]);

    expect(mobileTabbarHrefs).toHaveLength(4);
    expect(mobileTabbarHrefs.slice(0, 4)).toEqual([
      '/deals',
      '/search?overlay=1',
      '/themes',
      '/volgt',
    ]);
    expect(mobileTabbarMarkup).toContain('mobileTabListColumns4');
    expect(mobileTabbarMarkup).not.toContain('mobileTabListColumns5');
    expect(mobileTabbarHrefs.indexOf('/search?overlay=1')).toBe(1);
    expect(mobileTabbarMarkup.indexOf('Deals')).toBeLessThan(
      mobileTabbarMarkup.indexOf('Zoeken'),
    );
    expect(mobileTabbarMarkup.indexOf('Zoeken')).toBeLessThan(
      mobileTabbarMarkup.indexOf('Thema&#x27;s'),
    );
    expect(mobileTabbarMarkup.indexOf('Thema&#x27;s')).toBeLessThan(
      mobileTabbarMarkup.indexOf('Volgt'),
    );
    expect(markup).toContain(
      'Brickhunt laat snel zien welke doos je wilt hebben',
    );
    expect(markup).toContain('waar de prijs nu goed zit');
    expect(markup).toContain('href="/over-brickhunt"');
    expect(markup).toContain('href="/hoe-werkt-het"');
    expect(markup).toContain('href="/contact"');
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/cookiebeleid"');
    expect(markup).toContain('href="/affiliate-disclosure"');
    expect(markup).toContain('Affiliate disclosure');
    expect(markup).not.toContain('Home');
    expect(markup).not.toContain('Ontdekken');
    expect(markup).not.toContain('Featured shortlist');
    expect(markup).not.toContain('Checking');
    expect(markup).not.toContain('Sign in');
    expect(markup).not.toContain('Sign out');
  });

  it('restores Nieuws in desktop and mobile navigation when article content reaches the threshold', () => {
    const markup = renderToStaticMarkup(
      <ShellWeb publishedArticleCount={5}>
        <div>Collector page content</div>
      </ShellWeb>,
    );
    const mobileTabbarMarkup = markup.slice(
      markup.indexOf('Mobiele tabnavigatie'),
    );
    const mobileTabbarHrefs = [
      ...mobileTabbarMarkup.matchAll(/href="([^"]+)"/g),
    ].map((match) => match[1]);

    expect(markup).toContain('href="/artikelen"');
    expect(markup.indexOf('Nieuws')).toBeLessThan(markup.indexOf('Deals'));
    expect(mobileTabbarHrefs).toHaveLength(5);
    expect(mobileTabbarHrefs.slice(0, 5)).toEqual([
      '/artikelen',
      '/deals',
      '/search?overlay=1',
      '/themes',
      '/volgt',
    ]);
    expect(mobileTabbarMarkup).toContain('mobileTabListColumns5');
    expect(mobileTabbarMarkup).not.toContain('mobileTabListColumns4');
  });
});

describe('getActiveMobileTabId', () => {
  it('matches search, themes, following, and deals routes to the intended tabs', () => {
    expect(getActiveMobileTabId({ pathname: '/search' })).toBe('search');
    expect(getActiveMobileTabId({ pathname: '/artikelen' })).toBe('articles');
    expect(
      getActiveMobileTabId({ pathname: '/artikelen/star-wars/lego-nieuws' }),
    ).toBe('articles');
    expect(getActiveMobileTabId({ pathname: '/themes' })).toBe('themes');
    expect(getActiveMobileTabId({ pathname: '/themes/icons' })).toBe('themes');
    expect(getActiveMobileTabId({ pathname: '/volgt' })).toBe('following');
    expect(getActiveMobileTabId({ pathname: '/account/wishlist' })).toBe(
      'following',
    );
    expect(
      getActiveMobileTabId({
        pathname: '/deals',
      }),
    ).toBe('deals');
  });

  it('returns no active tab for routes outside the main mobile tab model', () => {
    expect(getActiveMobileTabId({ pathname: '/' })).toBeUndefined();
    expect(getActiveMobileTabId({ pathname: '/legacy' })).toBeUndefined();
    expect(
      getActiveMobileTabId({ pathname: '/sets/rivendell-10316' }),
    ).toBeUndefined();
    expect(getActiveMobileTabId({ pathname: '/account' })).toBeUndefined();
    expect(
      getActiveMobileTabId({ pathname: '/hoe-werkt-het' }),
    ).toBeUndefined();
  });
});

describe('isShellWebNavLinkActive', () => {
  it('matches desktop navigation links on index and detail routes', () => {
    expect(
      isShellWebNavLinkActive({
        href: '/deals',
        pathname: '/deals',
      }),
    ).toBe(true);
    expect(
      isShellWebNavLinkActive({
        href: '/deals',
        pathname: '/legacy',
      }),
    ).toBe(false);
    expect(
      isShellWebNavLinkActive({
        href: '/artikelen',
        pathname: '/artikelen',
      }),
    ).toBe(true);
    expect(
      isShellWebNavLinkActive({
        href: '/artikelen',
        pathname: '/artikelen/star-wars/lego-nieuws',
      }),
    ).toBe(true);
    expect(
      isShellWebNavLinkActive({
        href: '/artikelen',
        pathname: '/themes',
      }),
    ).toBe(false);
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
    expect(getFollowingNavPageSurface('/deals')).toBe('deals');
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
