/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFragmentScrollBehavior,
  isSamePageFragmentUrl,
  ShellWebSamePageFragmentLinks,
} from './shell-web-same-page-fragment-links';

describe('same-page fragment helpers', () => {
  it('matches only same-page fragment URLs', () => {
    expect(
      isSamePageFragmentUrl({
        currentUrl: new URL('https://brickhunt.test/themes/icons'),
        targetUrl: new URL('https://brickhunt.test/themes/icons#theme-browse'),
      }),
    ).toBe(true);

    expect(
      isSamePageFragmentUrl({
        currentUrl: new URL('https://brickhunt.test/themes/icons'),
        targetUrl: new URL('https://brickhunt.test/themes/marvel#theme-browse'),
      }),
    ).toBe(false);
  });

  it('respects reduced motion when picking scroll behavior', () => {
    expect(
      getFragmentScrollBehavior({
        prefersReducedMotion: false,
      }),
    ).toBe('smooth');

    expect(
      getFragmentScrollBehavior({
        prefersReducedMotion: true,
      }),
    ).toBe('auto');
  });
});

describe('ShellWebSamePageFragmentLinks', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    window.history.replaceState({}, '', '/themes/icons#theme-browse');
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = '';
  });

  it('re-scrolls when the same fragment link is clicked again', () => {
    const target = document.createElement('section');
    target.id = 'theme-browse';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const link = document.createElement('a');
    link.href = '#theme-browse';
    link.textContent = 'Bekijk alle sets';
    document.body.appendChild(link);

    act(() => {
      root.render(<ShellWebSamePageFragmentLinks />);
    });

    act(() => {
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    act(() => {
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(window.location.hash).toBe('#theme-browse');
    expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(target.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('still scrolls when a nested CTA child is clicked and the anchor prevents default later', () => {
    const target = document.createElement('section');
    target.id = 'theme-deals';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const link = document.createElement('a');
    link.href = '#theme-deals';
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });

    const label = document.createElement('span');
    label.textContent = 'Bekijk beste deals';
    link.appendChild(label);
    document.body.appendChild(link);

    act(() => {
      root.render(<ShellWebSamePageFragmentLinks />);
    });

    window.history.replaceState({}, '', '/themes/icons#theme-deals');

    act(() => {
      label.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(window.location.hash).toBe('#theme-deals');
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(target.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('pushes a new hash when navigating to another fragment on the same page', () => {
    const target = document.createElement('section');
    target.id = 'theme-deals';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const link = document.createElement('a');
    link.href = '#theme-deals';
    document.body.appendChild(link);

    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    act(() => {
      root.render(<ShellWebSamePageFragmentLinks />);
    });

    act(() => {
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(window.location.hash).toBe('#theme-deals');
    expect(pushStateSpy).toHaveBeenCalled();
    expect(target.scrollIntoView).toHaveBeenCalledOnce();

    pushStateSpy.mockRestore();
  });
});
