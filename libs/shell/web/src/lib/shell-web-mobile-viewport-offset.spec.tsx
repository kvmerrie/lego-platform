/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShellWebMobileViewportOffset,
  shouldSyncShellMobileViewportOffsetOnWindowResize,
} from './shell-web-mobile-viewport-offset';

describe('shouldSyncShellMobileViewportOffsetOnWindowResize', () => {
  it('skips desktop window resize work when the visual viewport matches the layout viewport', () => {
    expect(
      shouldSyncShellMobileViewportOffsetOnWindowResize({
        hasCoarsePointer: false,
        innerHeight: 900,
        visualViewportHeight: 900,
      }),
    ).toBe(false);
  });

  it('keeps window resize sync for coarse pointers and active viewport offsets', () => {
    expect(
      shouldSyncShellMobileViewportOffsetOnWindowResize({
        hasCoarsePointer: true,
        innerHeight: 900,
        visualViewportHeight: 900,
      }),
    ).toBe(true);
    expect(
      shouldSyncShellMobileViewportOffsetOnWindowResize({
        hasCoarsePointer: false,
        innerHeight: 900,
        visualViewportHeight: 720,
      }),
    ).toBe(true);
  });
});

describe('ShellWebMobileViewportOffset', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalVisualViewportDescriptor: PropertyDescriptor | undefined;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalInnerHeightDescriptor: PropertyDescriptor | undefined;
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let cancelAnimationFrameSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'visualViewport',
    );
    originalMatchMedia = window.matchMedia;
    originalInnerHeightDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'innerHeight',
    );
    requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);

        return 1;
      });
    cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    container.remove();
    document.documentElement.style.removeProperty(
      '--shell-mobile-viewport-bottom-offset',
    );
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    if (originalVisualViewportDescriptor) {
      Object.defineProperty(
        window,
        'visualViewport',
        originalVisualViewportDescriptor,
      );
    } else {
      delete (window as { visualViewport?: VisualViewport }).visualViewport;
    }
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
    if (originalInnerHeightDescriptor) {
      Object.defineProperty(
        window,
        'innerHeight',
        originalInnerHeightDescriptor,
      );
    }
    vi.restoreAllMocks();
  });

  function configureViewport({
    hasCoarsePointer,
    visualViewportHeight = 900,
  }: {
    hasCoarsePointer: boolean;
    visualViewportHeight?: number;
  }) {
    const visualViewport = {
      addEventListener: vi.fn(),
      height: visualViewportHeight,
      offsetTop: 0,
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport;

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: hasCoarsePointer,
      media: '(pointer: coarse)',
      onchange: null,
      removeEventListener: vi.fn(),
    });

    return visualViewport;
  }

  it('does not register desktop window resize work when visualViewport events are enough', () => {
    const visualViewport = configureViewport({ hasCoarsePointer: false });
    const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const windowRemoveEventListenerSpy = vi.spyOn(
      window,
      'removeEventListener',
    );

    act(() => {
      root.render(<ShellWebMobileViewportOffset />);
    });

    expect(windowAddEventListenerSpy).not.toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
    expect(visualViewport.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
    expect(visualViewport.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    );

    act(() => {
      root.unmount();
    });

    expect(windowRemoveEventListenerSpy).not.toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });

  it('keeps the window resize fallback for mobile coarse pointers', () => {
    configureViewport({ hasCoarsePointer: true });
    const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');

    act(() => {
      root.render(<ShellWebMobileViewportOffset />);
    });

    expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });
});
