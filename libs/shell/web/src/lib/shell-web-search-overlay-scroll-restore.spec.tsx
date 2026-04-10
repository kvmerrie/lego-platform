/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellWebSearchOverlayScrollRestore } from './shell-web-search-overlay-scroll-restore';
import { writeSearchOverlayReturnState } from './shell-web-search-overlay-return-state';

vi.mock('next/navigation', () => ({
  usePathname: () => '/themes/icons',
}));

describe('ShellWebSearchOverlayScrollRestore', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queuedFrames: FrameRequestCallback[];
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;
  let originalScrollTo: typeof window.scrollTo;
  let scrollHeight = 900;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queuedFrames = [];
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    originalScrollTo = window.scrollTo;

    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 600,
      writable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    window.cancelAnimationFrame = vi.fn();
    window.scrollTo = vi.fn(
      ({
        left = 0,
        top = 0,
      }: ScrollToOptions | { left?: number; top?: number }) => {
        const maxScrollableY = Math.max(0, scrollHeight - window.innerHeight);
        window.scrollX = left;
        window.scrollY = Math.min(top, maxScrollableY);
      },
    );

    window.history.replaceState({}, '', '/themes/icons');
    window.sessionStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    window.scrollTo = originalScrollTo;
    window.sessionStorage.clear();
    container.remove();
  });

  it('keeps retrying until the page is tall enough to restore the saved scroll position', () => {
    writeSearchOverlayReturnState(window.sessionStorage, {
      href: '/themes/icons',
      scrollX: 0,
      scrollY: 800,
    });

    act(() => {
      root.render(<ShellWebSearchOverlayScrollRestore />);
    });

    act(() => {
      queuedFrames.shift()?.(0);
    });

    expect(window.scrollY).toBe(0);
    expect(
      window.sessionStorage.getItem('brickhunt.search-overlay-return-state'),
    ).not.toBeNull();

    scrollHeight = 1800;

    act(() => {
      queuedFrames.shift()?.(0);
    });

    expect(window.scrollY).toBe(800);
    expect(
      window.sessionStorage.getItem('brickhunt.search-overlay-return-state'),
    ).toBeNull();
  });
});
