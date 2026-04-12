'use client';

import { useEffect } from 'react';
import { mobileSearchOverlayVisibilityChangeEventName } from './shell-web-search-overlay-events';

const mobileBreakpoint = 48 * 16;
const desktopBreakpoint = 64 * 16;
const shellHeaderHiddenAttribute = 'data-shell-header-hidden';

export interface ShellHeaderRevealConfig {
  hideDistance: number;
  minDelta: number;
  showDistance: number;
  topVisibleOffset: number;
}

export interface ShellHeaderRevealState {
  accumulatedDown: number;
  accumulatedUp: number;
  hidden: boolean;
  lastScrollY: number;
}

export function getShellHeaderRevealConfig(
  viewportWidth: number,
): ShellHeaderRevealConfig {
  if (viewportWidth >= desktopBreakpoint) {
    return {
      hideDistance: 56,
      minDelta: 6,
      showDistance: 26,
      topVisibleOffset: 96,
    };
  }

  if (viewportWidth >= mobileBreakpoint) {
    return {
      hideDistance: 38,
      minDelta: 5,
      showDistance: 20,
      topVisibleOffset: 80,
    };
  }

  return {
    hideDistance: 24,
    minDelta: 4,
    showDistance: 14,
    topVisibleOffset: 56,
  };
}

export function advanceShellHeaderRevealState({
  currentScrollY,
  overlayOpen = false,
  state,
  viewportWidth,
}: {
  currentScrollY: number;
  overlayOpen?: boolean;
  state: ShellHeaderRevealState;
  viewportWidth: number;
}): ShellHeaderRevealState {
  const nextScrollY = Math.max(currentScrollY, 0);
  const config = getShellHeaderRevealConfig(viewportWidth);

  if (overlayOpen || nextScrollY <= config.topVisibleOffset) {
    return {
      accumulatedDown: 0,
      accumulatedUp: 0,
      hidden: false,
      lastScrollY: nextScrollY,
    };
  }

  const delta = nextScrollY - state.lastScrollY;

  if (Math.abs(delta) < config.minDelta) {
    return {
      ...state,
      lastScrollY: nextScrollY,
    };
  }

  if (delta > 0) {
    const accumulatedDown = state.accumulatedDown + delta;

    return {
      accumulatedDown:
        !state.hidden && accumulatedDown >= config.hideDistance
          ? 0
          : accumulatedDown,
      accumulatedUp: 0,
      hidden:
        state.hidden || accumulatedDown < config.hideDistance
          ? state.hidden
          : true,
      lastScrollY: nextScrollY,
    };
  }

  const accumulatedUp = state.accumulatedUp + Math.abs(delta);

  return {
    accumulatedDown: 0,
    accumulatedUp:
      state.hidden && accumulatedUp >= config.showDistance ? 0 : accumulatedUp,
    hidden:
      state.hidden && accumulatedUp >= config.showDistance
        ? false
        : state.hidden,
    lastScrollY: nextScrollY,
  };
}

function applyShellHeaderHiddenState(hidden: boolean) {
  if (typeof document === 'undefined') {
    return;
  }

  if (hidden) {
    document.documentElement.setAttribute(shellHeaderHiddenAttribute, 'true');
    return;
  }

  document.documentElement.removeAttribute(shellHeaderHiddenAttribute);
}

export function ShellWebHeaderReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let animationFrameId = 0;
    let isOverlayOpen = false;
    let state: ShellHeaderRevealState = {
      accumulatedDown: 0,
      accumulatedUp: 0,
      hidden: false,
      lastScrollY: Math.max(window.scrollY, 0),
    };

    function syncHeaderVisibility() {
      animationFrameId = 0;
      state = advanceShellHeaderRevealState({
        currentScrollY: Math.max(window.scrollY, 0),
        overlayOpen: isOverlayOpen,
        state,
        viewportWidth: window.innerWidth,
      });
      applyShellHeaderHiddenState(state.hidden);
    }

    function scheduleHeaderVisibilitySync() {
      if (animationFrameId !== 0) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(syncHeaderVisibility);
    }

    function handleOverlayVisibilityChange(event: Event) {
      isOverlayOpen = Boolean(
        (event as CustomEvent<{ isOpen?: boolean }>).detail?.isOpen,
      );
      scheduleHeaderVisibilitySync();
    }

    applyShellHeaderHiddenState(false);
    scheduleHeaderVisibilitySync();

    window.addEventListener('scroll', scheduleHeaderVisibilitySync, {
      passive: true,
    });
    window.addEventListener('resize', scheduleHeaderVisibilitySync);
    window.addEventListener('orientationchange', scheduleHeaderVisibilitySync);
    window.addEventListener(
      mobileSearchOverlayVisibilityChangeEventName,
      handleOverlayVisibilityChange as EventListener,
    );

    return () => {
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('scroll', scheduleHeaderVisibilitySync);
      window.removeEventListener('resize', scheduleHeaderVisibilitySync);
      window.removeEventListener(
        'orientationchange',
        scheduleHeaderVisibilitySync,
      );
      window.removeEventListener(
        mobileSearchOverlayVisibilityChangeEventName,
        handleOverlayVisibilityChange as EventListener,
      );
      applyShellHeaderHiddenState(false);
    };
  }, []);

  return null;
}

export default ShellWebHeaderReveal;
